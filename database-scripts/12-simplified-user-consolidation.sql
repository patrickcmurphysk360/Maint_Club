-- Simplified User Consolidation
-- This script consolidates the dual ID system by using the existing numeric 'id' column

-- Step 1: Backup current state
CREATE TABLE IF NOT EXISTS users_backup_consolidation AS SELECT * FROM users;

-- Step 2: Update all foreign key references to use numeric ID
-- First, let's check which tables need updating
SELECT 'Tables referencing user_id:';
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name LIKE '%user_id%' 
AND table_schema = 'public'
AND table_name != 'users';

-- Step 3: Update advisor_mappings to use numeric IDs
UPDATE advisor_mappings am
SET user_id = u.id
FROM users u
WHERE am.user_id::TEXT = u.user_id;

-- Step 4: Update performance_data to reference correct advisor IDs
-- This is already using numeric IDs, so we just need to ensure they match
UPDATE performance_data pd
SET advisor_user_id = u.id
FROM users u
WHERE pd.advisor_user_id = u.id;

-- Step 5: Update user_stores to use numeric IDs
UPDATE user_stores us
SET user_id = u.id::VARCHAR
FROM users u
WHERE us.user_id = u.user_id;

-- Step 6: Update user_markets to use numeric IDs  
UPDATE user_markets um
SET user_id = u.id::VARCHAR
FROM users u
WHERE um.user_id = u.user_id;

-- Step 7: Update coaching_messages
UPDATE coaching_messages cm
SET from_user_id = u.id::VARCHAR
FROM users u
WHERE cm.from_user_id = u.user_id;

UPDATE coaching_messages cm
SET to_user_id = u.id::VARCHAR
FROM users u
WHERE cm.to_user_id = u.user_id;

-- Step 8: Update goals
UPDATE goals g
SET advisor_user_id = u.id
FROM users u
WHERE g.advisor_user_id::TEXT = u.user_id;

UPDATE goals g
SET set_by_user_id = u.id
FROM users u
WHERE g.set_by_user_id::TEXT = u.user_id;

-- Step 9: Drop the string user_id column from users table
ALTER TABLE users DROP COLUMN IF EXISTS user_id;

-- Step 10: Add any missing columns for production readiness
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 11: Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Rename password column to password_hash for clarity
ALTER TABLE users RENAME COLUMN password TO password_hash;

-- Step 13: Display final status
SELECT 'User Consolidation Complete' as status;
SELECT COUNT(*) as total_users FROM users;
SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role;
SELECT 'Performance data linked to users:', COUNT(DISTINCT advisor_user_id) FROM performance_data WHERE advisor_user_id IN (SELECT id FROM users);