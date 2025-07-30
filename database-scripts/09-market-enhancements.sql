-- Add location and contact fields to markets table
ALTER TABLE phase1_markets
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(2),
ADD COLUMN IF NOT EXISTS zip VARCHAR(10),
ADD COLUMN IF NOT EXISTS contact_market_manager_id VARCHAR(50);

-- Add foreign key constraint for contact market manager
ALTER TABLE phase1_markets
ADD CONSTRAINT fk_contact_market_manager
FOREIGN KEY (contact_market_manager_id) 
REFERENCES phase1_users(user_id)
ON DELETE SET NULL;

-- Add index for vendor tags search
CREATE INDEX IF NOT EXISTS idx_phase1_markets_vendor_tags ON phase1_markets USING GIN (vendor_tags);

-- Update any existing markets to have proper vendor tags from vendor partners
-- This will be handled in the application logic