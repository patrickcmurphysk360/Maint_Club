-- AI Validation Audit Tables
-- Tracks AI response validation results and mismatch detection for compliance

-- Create audit log table for AI validation results
CREATE TABLE IF NOT EXISTS ai_validation_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  query TEXT NOT NULL,
  validation_type VARCHAR(50) NOT NULL DEFAULT 'performance_metric_validation',
  is_valid BOOLEAN NOT NULL,
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  expected_values JSONB,
  detected_values JSONB,
  mismatches JSONB,
  disclaimer TEXT,
  validation_duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_validation_audit_user_date 
ON ai_validation_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_validation_audit_validity 
ON ai_validation_audit_log(is_valid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_validation_audit_confidence 
ON ai_validation_audit_log(confidence_score, created_at DESC);

-- Create table for tracking specific metric mismatches
CREATE TABLE IF NOT EXISTS ai_metric_mismatches (
  id SERIAL PRIMARY KEY,
  audit_log_id INTEGER REFERENCES ai_validation_audit_log(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  expected_value DECIMAL(15,4),
  detected_value DECIMAL(15,4),
  tolerance DECIMAL(10,4),
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
  metric_type VARCHAR(20) NOT NULL, -- 'currency', 'integer', 'decimal', 'percentage'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for mismatch analysis
CREATE INDEX IF NOT EXISTS idx_ai_metric_mismatches_metric 
ON ai_metric_mismatches(metric_name, severity, created_at DESC);

-- Create function to get validation statistics
CREATE OR REPLACE FUNCTION get_ai_validation_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  total_validations BIGINT,
  passed_validations BIGINT,
  failed_validations BIGINT,
  avg_confidence_score DECIMAL(3,2),
  avg_mismatch_count DECIMAL(5,2),
  unique_users BIGINT,
  top_mismatched_metrics JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_validations,
    COUNT(*) FILTER (WHERE is_valid = true) as passed_validations,
    COUNT(*) FILTER (WHERE is_valid = false) as failed_validations,
    ROUND(AVG(confidence_score), 2) as avg_confidence_score,
    ROUND(AVG(mismatch_count), 2) as avg_mismatch_count,
    COUNT(DISTINCT user_id) as unique_users,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'metric', metric_name,
          'count', mismatch_count,
          'avg_severity', avg_severity
        )
      )
      FROM (
        SELECT 
          mm.metric_name,
          COUNT(*) as mismatch_count,
          ROUND(AVG(
            CASE mm.severity
              WHEN 'low' THEN 1
              WHEN 'medium' THEN 2  
              WHEN 'high' THEN 3
              ELSE 2
            END
          ), 1) as avg_severity
        FROM ai_metric_mismatches mm
        JOIN ai_validation_audit_log al ON mm.audit_log_id = al.id
        WHERE al.created_at >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY mm.metric_name
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) top_metrics
    ) as top_mismatched_metrics
  FROM ai_validation_audit_log
  WHERE created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;

-- Create function to get mismatch trends
CREATE OR REPLACE FUNCTION get_ai_mismatch_trends(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_validations BIGINT,
  failed_validations BIGINT,
  avg_confidence DECIMAL(3,2),
  most_common_mismatch VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(al.created_at) as date,
    COUNT(*) as total_validations,
    COUNT(*) FILTER (WHERE al.is_valid = false) as failed_validations,
    ROUND(AVG(al.confidence_score), 2) as avg_confidence,
    (
      SELECT mm.metric_name
      FROM ai_metric_mismatches mm
      WHERE mm.audit_log_id IN (
        SELECT id FROM ai_validation_audit_log 
        WHERE DATE(created_at) = DATE(al.created_at)
      )
      GROUP BY mm.metric_name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_common_mismatch
  FROM ai_validation_audit_log al
  WHERE al.created_at >= NOW() - INTERVAL '1 day' * days_back
  GROUP BY DATE(al.created_at)
  ORDER BY DATE(al.created_at) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to log detailed mismatch information
CREATE OR REPLACE FUNCTION log_ai_validation_result(
  p_user_id INTEGER,
  p_query TEXT,
  p_validation_type VARCHAR(50),
  p_is_valid BOOLEAN,
  p_confidence_score DECIMAL(3,2),
  p_expected_values JSONB,
  p_detected_values JSONB,
  p_mismatches JSONB,
  p_disclaimer TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  audit_id INTEGER;
  mismatch JSONB;
BEGIN
  -- Insert main audit record
  INSERT INTO ai_validation_audit_log (
    user_id, query, validation_type, is_valid, mismatch_count,
    confidence_score, expected_values, detected_values, mismatches,
    disclaimer, validation_duration_ms
  ) VALUES (
    p_user_id, p_query, p_validation_type, p_is_valid,
    COALESCE(jsonb_array_length(p_mismatches), 0),
    p_confidence_score, p_expected_values, p_detected_values,
    p_mismatches, p_disclaimer, p_duration_ms
  ) RETURNING id INTO audit_id;
  
  -- Insert detailed mismatch records if any
  IF p_mismatches IS NOT NULL AND jsonb_array_length(p_mismatches) > 0 THEN
    FOR mismatch IN SELECT * FROM jsonb_array_elements(p_mismatches)
    LOOP
      INSERT INTO ai_metric_mismatches (
        audit_log_id, metric_name, expected_value, detected_value,
        tolerance, severity, metric_type
      ) VALUES (
        audit_id,
        mismatch->>'metric',
        (mismatch->>'expected')::DECIMAL,
        (mismatch->>'detected')::DECIMAL,
        (mismatch->>'tolerance')::DECIMAL,
        mismatch->>'severity',
        mismatch->>'type'
      );
    END LOOP;
  END IF;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for dashboard reporting
CREATE OR REPLACE VIEW ai_validation_dashboard AS
SELECT 
  DATE(created_at) as validation_date,
  COUNT(*) as total_validations,
  COUNT(*) FILTER (WHERE is_valid = true) as passed,
  COUNT(*) FILTER (WHERE is_valid = false) as failed,
  ROUND(AVG(confidence_score), 2) as avg_confidence,
  ROUND(AVG(mismatch_count), 1) as avg_mismatches,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as latest_validation
FROM ai_validation_audit_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY validation_date DESC;

-- Add helpful comments
COMMENT ON TABLE ai_validation_audit_log IS 'Audit trail for AI response validations against scorecard API endpoints';
COMMENT ON TABLE ai_metric_mismatches IS 'Detailed tracking of specific metric mismatches for analysis';
COMMENT ON FUNCTION get_ai_validation_stats IS 'Returns comprehensive validation statistics for admin dashboard';
COMMENT ON FUNCTION get_ai_mismatch_trends IS 'Returns daily trends in validation failures and mismatches';
COMMENT ON FUNCTION log_ai_validation_result IS 'Structured logging function for validation results with detailed mismatch tracking';
COMMENT ON VIEW ai_validation_dashboard IS 'Daily summary view for validation monitoring dashboard';

-- Grant appropriate permissions
GRANT SELECT, INSERT ON ai_validation_audit_log TO PUBLIC;
GRANT SELECT, INSERT ON ai_metric_mismatches TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_ai_validation_stats TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_ai_mismatch_trends TO PUBLIC;
GRANT EXECUTE ON FUNCTION log_ai_validation_result TO PUBLIC;
GRANT SELECT ON ai_validation_dashboard TO PUBLIC;

-- Initial success message
DO $$
BEGIN
  RAISE NOTICE 'AI Validation Audit Tables created successfully';
  RAISE NOTICE 'Created tables: ai_validation_audit_log, ai_metric_mismatches';
  RAISE NOTICE 'Created functions: get_ai_validation_stats, get_ai_mismatch_trends, log_ai_validation_result';
  RAISE NOTICE 'Created view: ai_validation_dashboard';
END $$;