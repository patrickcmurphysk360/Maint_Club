-- User Consolidation Migration Script
-- Purpose: Migrate from dual ID system (string/numeric) to single numeric ID system
-- Date: 2025-07-29

-- Step 1: Create backup tables
CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS advisor_mappings_backup AS SELECT * FROM advisor_mappings;
CREATE TABLE IF NOT EXISTS performance_data_backup AS SELECT * FROM performance_data;

-- Step 2: Create temporary mapping table for ID transitions
CREATE TABLE IF NOT EXISTS user_id_migration_map (
    old_string_id VARCHAR(50) PRIMARY KEY,
    new_numeric_id INTEGER,
    email VARCHAR(255),
    migration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Add new numeric ID column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS numeric_id SERIAL;

-- Step 4: Create sequence starting from a safe number (avoiding conflicts)
CREATE SEQUENCE IF NOT EXISTS users_new_id_seq START WITH 1000;

-- Step 5: Populate migration map with new IDs for existing users
INSERT INTO user_id_migration_map (old_string_id, new_numeric_id, email)
SELECT 
    user_id,
    nextval('users_new_id_seq')::INTEGER,
    email
FROM users
WHERE user_id NOT SIMILAR TO '[0-9]+';

-- Step 6: Create new users table with proper structure
CREATE TABLE users_new (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    is_vendor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE
);

-- Step 7: Migrate users to new table
INSERT INTO users_new (id, email, password_hash, first_name, last_name, role, status, is_vendor, created_at, updated_at)
SELECT 
    COALESCE(m.new_numeric_id, u.user_id::INTEGER),
    u.email,
    u.password_hash,
    u.first_name,
    u.last_name,
    u.role,
    u.status,
    u.is_vendor,
    u.created_at,
    u.updated_at
FROM users u
LEFT JOIN user_id_migration_map m ON u.user_id = m.old_string_id;

-- Step 8: Update foreign key references in related tables
-- Update user_stores
ALTER TABLE user_stores ADD COLUMN IF NOT EXISTS new_user_id INTEGER;
UPDATE user_stores us
SET new_user_id = COALESCE(m.new_numeric_id, us.user_id::INTEGER)
FROM user_id_migration_map m
WHERE us.user_id = m.old_string_id;

-- Update user_markets  
ALTER TABLE user_markets ADD COLUMN IF NOT EXISTS new_user_id INTEGER;
UPDATE user_markets um
SET new_user_id = COALESCE(m.new_numeric_id, um.user_id::INTEGER)
FROM user_id_migration_map m
WHERE um.user_id = m.old_string_id;

-- Update coaching_messages
ALTER TABLE coaching_messages ADD COLUMN IF NOT EXISTS new_from_user_id INTEGER;
ALTER TABLE coaching_messages ADD COLUMN IF NOT EXISTS new_to_user_id INTEGER;

UPDATE coaching_messages cm
SET new_from_user_id = COALESCE(m.new_numeric_id, cm.from_user_id::INTEGER)
FROM user_id_migration_map m
WHERE cm.from_user_id = m.old_string_id;

UPDATE coaching_messages cm
SET new_to_user_id = COALESCE(m.new_numeric_id, cm.to_user_id::INTEGER)
FROM user_id_migration_map m
WHERE cm.to_user_id = m.old_string_id;

-- Update goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS new_advisor_user_id INTEGER;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS new_set_by_user_id INTEGER;

UPDATE goals g
SET new_advisor_user_id = COALESCE(m.new_numeric_id, g.advisor_user_id::INTEGER)
FROM user_id_migration_map m
WHERE g.advisor_user_id::TEXT = m.old_string_id;

UPDATE goals g
SET new_set_by_user_id = COALESCE(m.new_numeric_id, g.set_by_user_id::INTEGER)
FROM user_id_migration_map m
WHERE g.set_by_user_id::TEXT = m.old_string_id;

-- Step 9: Create missing advisor users from performance data
-- First, identify advisor names from performance data that don't have user accounts
INSERT INTO users_new (email, first_name, last_name, role, status, password_hash)
SELECT DISTINCT
    LOWER(REPLACE(pd.data->>'employee', ' ', '.')) || '@example.com' as email,
    SPLIT_PART(pd.data->>'employee', ' ', 1) as first_name,
    SPLIT_PART(pd.data->>'employee', ' ', 2) as last_name,
    'advisor' as role,
    'active' as status,
    '$2b$10$XKXxKxXKXxKxXKXxKxXKXO.default.password.hash' as password_hash
FROM performance_data pd
WHERE pd.advisor_user_id NOT IN (SELECT id FROM users_new)
AND pd.data->>'employee' IS NOT NULL
AND pd.data->>'employee' != ''
ON CONFLICT (email) DO NOTHING;

-- Step 10: Update advisor_mappings to link performance data with users
INSERT INTO advisor_mappings (spreadsheet_name, user_id, market_id, store_id, is_active)
SELECT DISTINCT
    pd.data->>'employee' as spreadsheet_name,
    u.id as user_id,
    COALESCE((pd.data->>'marketId')::INTEGER, 1) as market_id,
    COALESCE((pd.data->>'storeId')::INTEGER, 1) as store_id,
    true as is_active
FROM performance_data pd
JOIN users_new u ON LOWER(REPLACE(pd.data->>'employee', ' ', '.')) || '@example.com' = u.email
WHERE NOT EXISTS (
    SELECT 1 FROM advisor_mappings am 
    WHERE am.user_id = u.id 
    AND am.spreadsheet_name = pd.data->>'employee'
);

-- Step 11: Display migration summary
SELECT 'Migration Summary' as status;
SELECT 'Original users count: ' || COUNT(*) FROM users;
SELECT 'New users count: ' || COUNT(*) FROM users_new;
SELECT 'Performance data advisors linked: ' || COUNT(DISTINCT advisor_user_id) FROM performance_data;
SELECT 'Advisor mappings created: ' || COUNT(*) FROM advisor_mappings;

-- Step 12: Instructions for final cutover (DO NOT RUN AUTOMATICALLY)
/*
-- FINAL CUTOVER STEPS (Run manually after verification):

-- 1. Drop old foreign key constraints
ALTER TABLE user_stores DROP CONSTRAINT IF EXISTS user_stores_user_id_fkey;
ALTER TABLE user_markets DROP CONSTRAINT IF EXISTS user_markets_user_id_fkey;
ALTER TABLE coaching_messages DROP CONSTRAINT IF EXISTS coaching_messages_from_user_id_fkey;
ALTER TABLE coaching_messages DROP CONSTRAINT IF EXISTS coaching_messages_to_user_id_fkey;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_advisor_user_id_fkey;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_set_by_user_id_fkey;

-- 2. Rename tables
ALTER TABLE users RENAME TO users_old;
ALTER TABLE users_new RENAME TO users;

-- 3. Update columns in related tables
ALTER TABLE user_stores DROP COLUMN user_id;
ALTER TABLE user_stores RENAME COLUMN new_user_id TO user_id;

ALTER TABLE user_markets DROP COLUMN user_id;
ALTER TABLE user_markets RENAME COLUMN new_user_id TO user_id;

ALTER TABLE coaching_messages DROP COLUMN from_user_id;
ALTER TABLE coaching_messages RENAME COLUMN new_from_user_id TO from_user_id;
ALTER TABLE coaching_messages DROP COLUMN to_user_id;
ALTER TABLE coaching_messages RENAME COLUMN new_to_user_id TO to_user_id;

ALTER TABLE goals DROP COLUMN advisor_user_id;
ALTER TABLE goals RENAME COLUMN new_advisor_user_id TO advisor_user_id;
ALTER TABLE goals DROP COLUMN set_by_user_id;
ALTER TABLE goals RENAME COLUMN new_set_by_user_id TO set_by_user_id;

-- 4. Re-add foreign key constraints
ALTER TABLE user_stores ADD CONSTRAINT user_stores_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE user_markets ADD CONSTRAINT user_markets_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE coaching_messages ADD CONSTRAINT coaching_messages_from_user_id_fkey 
    FOREIGN KEY (from_user_id) REFERENCES users(id);
ALTER TABLE coaching_messages ADD CONSTRAINT coaching_messages_to_user_id_fkey 
    FOREIGN KEY (to_user_id) REFERENCES users(id);
ALTER TABLE goals ADD CONSTRAINT goals_advisor_user_id_fkey 
    FOREIGN KEY (advisor_user_id) REFERENCES users(id);
ALTER TABLE goals ADD CONSTRAINT goals_set_by_user_id_fkey 
    FOREIGN KEY (set_by_user_id) REFERENCES users(id);

-- 5. Update sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users) + 1);

-- 6. Clean up
DROP TABLE IF EXISTS users_old;
DROP TABLE IF EXISTS user_id_migration_map;
DROP SEQUENCE IF EXISTS users_new_id_seq;
*/