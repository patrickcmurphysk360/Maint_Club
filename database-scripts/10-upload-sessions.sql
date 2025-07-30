-- Create upload sessions table for managing spreadsheet processing workflow
CREATE TABLE IF NOT EXISTS upload_sessions (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'services' or 'operations'
    report_date DATE NOT NULL,
    uploaded_by INTEGER,
    market_id VARCHAR(100), -- The market ID from filename
    
    -- Discovered data from spreadsheet
    discovered_markets JSONB DEFAULT '[]',
    discovered_stores JSONB DEFAULT '[]',
    discovered_advisors JSONB DEFAULT '[]',
    
    -- Raw parsed data
    raw_data JSONB,
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending_review', -- 'pending_review', 'confirmed', 'processed', 'failed'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Error handling
    error_message TEXT,
    
    FOREIGN KEY (uploaded_by) REFERENCES phase1_users(id) ON DELETE SET NULL
);

-- Create indexes for upload sessions
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_uploaded_by ON upload_sessions(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_market_id ON upload_sessions(market_id);

-- Update existing file_uploads table to work with new system
ALTER TABLE file_uploads 
ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES upload_sessions(id);

-- Create advisor discovery table for tracking found vs mapped advisors
CREATE TABLE IF NOT EXISTS discovered_advisors (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    spreadsheet_name VARCHAR(255) NOT NULL,
    market VARCHAR(255),
    store VARCHAR(255),
    
    -- Mapping status
    status VARCHAR(50) DEFAULT 'discovered', -- 'discovered', 'mapped_to_user', 'create_user', 'ignored'
    mapped_user_id VARCHAR(50) REFERENCES phase1_users(user_id),
    
    -- Auto-suggestion fields
    suggested_first_name VARCHAR(100),
    suggested_last_name VARCHAR(100),
    suggested_email VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create discovered markets table
CREATE TABLE IF NOT EXISTS discovered_markets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    spreadsheet_name VARCHAR(255) NOT NULL,
    source VARCHAR(50), -- 'services_data' or 'operations_data'
    
    -- Mapping status
    status VARCHAR(50) DEFAULT 'discovered', -- 'discovered', 'mapped_to_existing', 'create_new', 'ignored'
    mapped_market_id VARCHAR(100) REFERENCES phase1_markets(id),
    
    -- Auto-suggestion fields
    suggested_market_id VARCHAR(100),
    suggested_name VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create discovered stores table
CREATE TABLE IF NOT EXISTS discovered_stores (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    spreadsheet_name VARCHAR(255) NOT NULL,
    market_name VARCHAR(255) NOT NULL,
    source VARCHAR(50), -- 'services_data' or 'operations_data'
    
    -- Mapping status
    status VARCHAR(50) DEFAULT 'discovered', -- 'discovered', 'mapped_to_existing', 'create_new', 'ignored'
    mapped_store_id VARCHAR(100) REFERENCES phase1_stores(store_id),
    
    -- Auto-suggestion fields
    suggested_store_id VARCHAR(100),
    suggested_name VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for discovery tables
CREATE INDEX IF NOT EXISTS idx_discovered_advisors_session ON discovered_advisors(session_id);
CREATE INDEX IF NOT EXISTS idx_discovered_advisors_status ON discovered_advisors(status);
CREATE INDEX IF NOT EXISTS idx_discovered_markets_session ON discovered_markets(session_id);
CREATE INDEX IF NOT EXISTS idx_discovered_markets_status ON discovered_markets(status);
CREATE INDEX IF NOT EXISTS idx_discovered_stores_session ON discovered_stores(session_id);
CREATE INDEX IF NOT EXISTS idx_discovered_stores_status ON discovered_stores(status);