-- Migration: Add is_default to social_accounts
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);

-- Ensure only one default per platform per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_default 
  ON social_accounts(company_id, platform) 
  WHERE is_default = true;
