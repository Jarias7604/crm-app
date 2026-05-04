-- Phase 11: Security Hardening

-- 1. Add platform owner flag to replace hardcoded bypass
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_owner BOOLEAN DEFAULT false;

-- 2. Set the actual owners (based on previous hardcoded values)
UPDATE profiles SET is_platform_owner = true 
WHERE email IN ('jarias7604@gmail.com', 'jarias@ariasdefense.com');

-- 3. Create rate limiting table for future implementation
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    ip_address TEXT,
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    successful BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempt_time);
