-- Scorecard Field Validation Logging Table
-- Tracks violations when AI responses use non-approved fields

CREATE TABLE IF NOT EXISTS ai_scorecard_violations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    violations JSONB NOT NULL DEFAULT '[]',
    response_excerpt TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Add index for efficient querying
    INDEX idx_scorecard_violations_user_date (user_id, created_at),
    INDEX idx_scorecard_violations_severity (severity),
    INDEX idx_scorecard_violations_created (created_at)
);

-- Add comments for documentation
COMMENT ON TABLE ai_scorecard_violations IS 'Logs violations when AI responses use non-approved scorecard fields';
COMMENT ON COLUMN ai_scorecard_violations.user_id IS 'ID of user who made the query';
COMMENT ON COLUMN ai_scorecard_violations.query IS 'Original user query that triggered the response';
COMMENT ON COLUMN ai_scorecard_violations.violations IS 'JSON array of detected violations with field names and types';
COMMENT ON COLUMN ai_scorecard_violations.response_excerpt IS 'Excerpt of AI response containing violations';
COMMENT ON COLUMN ai_scorecard_violations.severity IS 'Severity level: low, medium, high, critical';

-- Create view for violation statistics
CREATE OR REPLACE VIEW scorecard_violation_stats AS
SELECT 
    DATE(created_at) as violation_date,
    COUNT(*) as total_violations,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(json_array_length(violations)) as avg_violations_per_response,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count
FROM ai_scorecard_violations 
GROUP BY DATE(created_at)
ORDER BY violation_date DESC;

COMMENT ON VIEW scorecard_violation_stats IS 'Daily statistics for scorecard field validation violations';

-- Create function to get top violated fields
CREATE OR REPLACE FUNCTION get_top_violated_fields(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    field_name TEXT,
    violation_count BIGINT,
    violation_type TEXT,
    severity_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (violation->>'field')::TEXT as field_name,
        COUNT(*) as violation_count,
        (violation->>'type')::TEXT as violation_type,
        json_object_agg(
            violation->>'severity', 
            COUNT(*)
        )::JSONB as severity_distribution
    FROM ai_scorecard_violations,
         json_array_elements(violations) as violation
    WHERE created_at >= NOW() - INTERVAL '1 day' * days_back
    GROUP BY (violation->>'field'), (violation->>'type')
    ORDER BY violation_count DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_top_violated_fields IS 'Returns the most frequently violated fields in scorecard validation';

-- Insert initial test data (optional - remove in production)
-- INSERT INTO ai_scorecard_violations (user_id, query, violations, response_excerpt, severity) VALUES 
-- (1, 'What were my sales last month?', '[{"field": "rawSales", "type": "forbidden_field", "severity": "high"}]', 'Your rawSales last month were...', 'high'),
-- (2, 'Show me TPP calculations', '[{"field": "calculatedTPP", "type": "unapproved_performance_field", "severity": "medium"}]', 'The calculatedTPP shows...', 'medium');

COMMIT;