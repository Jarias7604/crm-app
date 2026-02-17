-- PHASE 4 - FEATURE 4.4: Teams & Departments System
-- Applied: 2026-02-17
-- Status: PRODUCTION ✅

-- Migration: create_teams_system
-- Creates:
--   - teams table (with emoji, color, leader, active status)
--   - team_members junction table (with leader/member roles)
--   - RLS policies (company-scoped access, admin-only write)
--   - Updated_at trigger
--   - Audit triggers (logs team changes to audit_logs)

-- See Supabase migrations dashboard for full SQL.

-- === ROLLBACK (if needed) ===
-- DROP TRIGGER IF EXISTS audit_team_changes ON public.teams;
-- DROP TRIGGER IF EXISTS set_teams_updated_at ON public.teams;
-- DROP FUNCTION IF EXISTS public.audit_team_changes();
-- DROP FUNCTION IF EXISTS public.update_teams_updated_at();
-- DROP TABLE IF EXISTS public.team_members;
-- DROP TABLE IF EXISTS public.teams;
