-- PHASE 4 - FEATURE 4.1: Audit Log System (HubSpot-style)
-- Applied: 2026-02-17
-- Status: PRODUCTION ✅

-- Migration 1: create_audit_logs_table
-- Creates audit_logs table with RLS, indexes, log_audit_event() function,
-- and automatic triggers for leads, profiles, and cotizaciones tables.

-- Migration 2: fix_audit_functions_search_path
-- Fixes search_path for all audit functions to pass security linter.

-- See Supabase migrations dashboard for full SQL.
-- Rollback instructions below.

-- === ROLLBACK (if needed) ===
-- DROP TRIGGER IF EXISTS audit_leads_changes ON public.leads;
-- DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
-- DROP TRIGGER IF EXISTS audit_cotizacion_changes ON public.cotizaciones;
-- DROP FUNCTION IF EXISTS public.audit_lead_changes();
-- DROP FUNCTION IF EXISTS public.audit_profile_changes();
-- DROP FUNCTION IF EXISTS public.audit_cotizacion_changes();
-- DROP FUNCTION IF EXISTS public.log_audit_event(text, text, text, text, text, jsonb, jsonb, jsonb);
-- DROP TABLE IF EXISTS public.audit_logs;
