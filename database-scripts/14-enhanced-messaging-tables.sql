-- Enhanced Messaging System Tables
-- Create the tables needed for the ThreadedMessaging component

-- Drop existing tables if they exist (to handle schema changes)
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS message_threads CASCADE;

-- Rename existing coaching_messages table to backup
ALTER TABLE IF EXISTS coaching_messages RENAME TO coaching_messages_backup;

-- Create message_threads table
CREATE TABLE message_threads (
    id SERIAL PRIMARY KEY,
    advisor_user_id INTEGER NOT NULL REFERENCES users(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL DEFAULT 'Coaching Thread',
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create coaching_messages table (enhanced version)
CREATE TABLE coaching_messages (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    advisor_user_id INTEGER NOT NULL REFERENCES users(id),
    author_user_id INTEGER NOT NULL REFERENCES users(id),
    parent_message_id INTEGER REFERENCES coaching_messages(id) ON DELETE SET NULL,
    message TEXT NOT NULL DEFAULT '',
    message_type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    reactions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE
);

-- Create message_attachments table
CREATE TABLE message_attachments (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES coaching_messages(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    thumbnail_path TEXT,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_message_threads_advisor ON message_threads(advisor_user_id);
CREATE INDEX idx_message_threads_last_message ON message_threads(last_message_at DESC);
CREATE INDEX idx_coaching_messages_thread ON coaching_messages(thread_id);
CREATE INDEX idx_coaching_messages_author ON coaching_messages(author_user_id);
CREATE INDEX idx_coaching_messages_created ON coaching_messages(created_at);
CREATE INDEX idx_coaching_messages_parent ON coaching_messages(parent_message_id);
CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);

-- Create trigger to update thread metadata when messages are added
CREATE OR REPLACE FUNCTION update_thread_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE message_threads 
    SET 
        last_message_at = NEW.created_at,
        message_count = message_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.thread_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_on_message_insert
    AFTER INSERT ON coaching_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_on_message_insert();

-- Migrate existing coaching_messages data if backup table exists
DO $$
DECLARE
    rec RECORD;
    thread_id INT;
BEGIN
    -- Check if backup table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coaching_messages_backup') THEN
        -- Migrate old messages to new structure
        FOR rec IN SELECT DISTINCT advisor_user_id FROM coaching_messages_backup LOOP
            -- Create a thread for each advisor
            INSERT INTO message_threads (advisor_user_id, created_by, subject)
            VALUES (rec.advisor_user_id, 1, 'Migrated Coaching Thread')
            RETURNING id INTO thread_id;
            
            -- Insert messages into the new structure
            INSERT INTO coaching_messages (thread_id, advisor_user_id, author_user_id, message, created_at, is_read)
            SELECT 
                thread_id,
                advisor_user_id,
                author_user_id,
                message,
                created_at,
                is_read
            FROM coaching_messages_backup
            WHERE advisor_user_id = rec.advisor_user_id;
        END LOOP;
        
        RAISE NOTICE 'Successfully migrated coaching messages to new enhanced structure';
    END IF;
END $$;

COMMENT ON TABLE message_threads IS 'Message threads for advisor coaching conversations';
COMMENT ON TABLE coaching_messages IS 'Individual messages within coaching threads with reply support';
COMMENT ON TABLE message_attachments IS 'File attachments for coaching messages';