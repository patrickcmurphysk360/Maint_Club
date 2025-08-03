-- User Behavior Tracking System
-- Creates foundation for AI to learn user behaviors and preferences over time

-- AI Interaction History Table
CREATE TABLE IF NOT EXISTS ai_interaction_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  query_text TEXT NOT NULL,
  query_type VARCHAR(50), -- 'organizational', 'performance', 'general', etc.
  query_intent VARCHAR(100), -- extracted intent/purpose
  response_text TEXT,
  response_quality_score INTEGER CHECK (response_quality_score >= 1 AND response_quality_score <= 5),
  user_feedback VARCHAR(20), -- 'helpful', 'not_helpful', 'partially_helpful'
  context_data JSONB, -- store context used for the query
  model_used VARCHAR(50),
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_id VARCHAR(100) -- to group related queries
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS ai_user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  preference_type VARCHAR(100) NOT NULL, -- 'query_style', 'detail_level', 'format_preference'
  preference_value JSONB NOT NULL,
  confidence_score FLOAT DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  learned_from_interactions INTEGER DEFAULT 1, -- how many interactions contributed to this preference
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, preference_type)
);

-- User Knowledge Base Table (tracks what users commonly ask about)
CREATE TABLE IF NOT EXISTS ai_user_knowledge_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  knowledge_domain VARCHAR(100) NOT NULL, -- 'stores', 'performance', 'employees', etc.
  specific_topics JSONB, -- array of specific topics user asks about
  frequency_score INTEGER DEFAULT 1,
  last_queried TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, knowledge_domain)
);

-- Query Pattern Analysis Table
CREATE TABLE IF NOT EXISTS ai_query_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(100) NOT NULL, -- 'store_lookup', 'performance_trend', etc.
  pattern_template VARCHAR(500) NOT NULL, -- regex or template pattern
  success_rate FLOAT DEFAULT 0.0,
  total_uses INTEGER DEFAULT 0,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_interaction_user_id ON ai_interaction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interaction_created_at ON ai_interaction_history(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_interaction_query_type ON ai_interaction_history(query_type);
CREATE INDEX IF NOT EXISTS idx_ai_interaction_session ON ai_interaction_history(session_id);

CREATE INDEX IF NOT EXISTS idx_ai_user_preferences_user_id ON ai_user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_preferences_type ON ai_user_preferences(preference_type);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_patterns_user_id ON ai_user_knowledge_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_patterns_domain ON ai_user_knowledge_patterns(knowledge_domain);

-- Insert initial query patterns based on our current organizational queries
INSERT INTO ai_query_patterns (pattern_type, pattern_template, success_rate, total_uses) VALUES
('store_employee_lookup', 'who (works|is) at .+ (store|location)?', 0.9, 10),
('role_based_search', 'show me (all )?([a-z]+)(s|rs)$', 0.8, 5),
('employee_search', 'who is [A-Za-z]+ [A-Za-z]+', 0.7, 3),
('performance_query', '.*(sales|revenue|performance|numbers).*', 0.6, 15),
('top_performers', '.*(top|best).*(performer|advisor|employee).*', 0.8, 8)
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE ai_interaction_history IS 'Tracks all AI interactions for learning user behavior patterns';
COMMENT ON TABLE ai_user_preferences IS 'Stores learned user preferences for personalized AI responses';
COMMENT ON TABLE ai_user_knowledge_patterns IS 'Tracks what knowledge domains users frequently ask about';
COMMENT ON TABLE ai_query_patterns IS 'Stores successful query patterns for improved intent recognition';

-- Function to log AI interactions
CREATE OR REPLACE FUNCTION log_ai_interaction(
  p_user_id INTEGER,
  p_query_text TEXT,
  p_query_type VARCHAR(50),
  p_response_text TEXT,
  p_context_data JSONB DEFAULT NULL,
  p_model_used VARCHAR(50) DEFAULT 'llama3.1:8b',
  p_response_time_ms INTEGER DEFAULT NULL,
  p_session_id VARCHAR(100) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  interaction_id INTEGER;
  detected_intent VARCHAR(100);
BEGIN
  -- Simple intent detection based on query patterns
  SELECT pattern_type INTO detected_intent
  FROM ai_query_patterns
  WHERE p_query_text ~* pattern_template
  ORDER BY success_rate DESC
  LIMIT 1;
  
  -- Insert interaction record
  INSERT INTO ai_interaction_history (
    user_id, query_text, query_type, query_intent, response_text,
    context_data, model_used, response_time_ms, session_id
  ) VALUES (
    p_user_id, p_query_text, p_query_type, detected_intent, p_response_text,
    p_context_data, p_model_used, p_response_time_ms, p_session_id
  ) RETURNING id INTO interaction_id;
  
  -- Update knowledge patterns
  INSERT INTO ai_user_knowledge_patterns (user_id, knowledge_domain, specific_topics, frequency_score)
  VALUES (p_user_id, COALESCE(p_query_type, 'general'), jsonb_build_array(detected_intent), 1)
  ON CONFLICT (user_id, knowledge_domain)
  DO UPDATE SET
    frequency_score = ai_user_knowledge_patterns.frequency_score + 1,
    last_queried = CURRENT_TIMESTAMP,
    specific_topics = CASE
      WHEN ai_user_knowledge_patterns.specific_topics ? detected_intent THEN
        ai_user_knowledge_patterns.specific_topics
      ELSE
        ai_user_knowledge_patterns.specific_topics || jsonb_build_array(detected_intent)
    END;
  
  RETURN interaction_id;
END;
$$ LANGUAGE plpgsql;