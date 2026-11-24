-- =============================================================================
-- ARIAS CRM — OAuth 2.1 PKCE (S256) support for ChatGPT Plugins / Custom MCP
-- =============================================================================
ALTER TABLE public.social_bridge_oauth_codes
    ADD COLUMN IF NOT EXISTS code_challenge TEXT,
    ADD COLUMN IF NOT EXISTS code_challenge_method TEXT;
