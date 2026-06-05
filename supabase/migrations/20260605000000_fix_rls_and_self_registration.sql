-- ============================================================
-- MIGRATION: Fix RLS data isolation + self-registration
-- DATE: 2026-06-05
-- CRITICAL: Ensures SaaS multi-tenant isolation is complete
-- ============================================================

-- ─── 1. FIX: follow_ups must be company-scoped ──────────────────────────────
-- The old is_company_manager() check doesn't filter by company_id
-- A company_admin of Tenant A was able to see/modify Tenant B's follow_ups

DROP POLICY IF EXISTS "follow_ups_admin_all" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_company_read" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_company_write" ON follow_ups;

-- New policy: users can only see follow_ups from leads in their own company
CREATE POLICY "follow_ups_company_scoped_select" ON follow_ups
  FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "follow_ups_company_scoped_insert" ON follow_ups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM leads WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "follow_ups_company_scoped_update" ON follow_ups
  FOR UPDATE
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM leads WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "follow_ups_company_scoped_delete" ON follow_ups
  FOR DELETE
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ─── 2. FIX: clients/clientes table anon read exposure ──────────────────────
-- Clients should NEVER be readable by anon users
-- Only the public portal token lookup should be allowed via a specific policy

DROP POLICY IF EXISTS "anon_portal_read" ON clients;
DROP POLICY IF EXISTS "clients_anon_portal_read" ON clients;

-- Keep only company-scoped authenticated access
DROP POLICY IF EXISTS "clients_company_select" ON clients;
CREATE POLICY "clients_company_select" ON clients
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow anon to read ONLY the specific portal token record (for client portal page)
CREATE POLICY "clients_anon_portal_token_only" ON clients
  FOR SELECT
  TO anon
  USING (
    portal_token IS NOT NULL 
    AND portal_token = current_setting('request.jwt.claims', true)::jsonb->>'portal_token'
  );

-- ─── 3. FIX: service_request_quotes anon read exposure ──────────────────────
DROP POLICY IF EXISTS "Allow public read for marketplace quotes" ON service_request_quotes;

-- Only authenticated users from same company can read quotes
DROP POLICY IF EXISTS "quotes_company_select" ON service_request_quotes;
CREATE POLICY "quotes_company_select" ON service_request_quotes
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── 4. FIX: crm_projects must be company-scoped ────────────────────────────
-- Verify and reinforce project isolation
DROP POLICY IF EXISTS "projects_admin_bypass" ON crm_projects;
DROP POLICY IF EXISTS "crm_projects_super_admin_all" ON crm_projects;

-- Super admin can see all (needed for admin panel)
CREATE POLICY "crm_projects_super_admin" ON crm_projects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Regular users only see their company's projects
DROP POLICY IF EXISTS "crm_projects_company_select" ON crm_projects;
CREATE POLICY "crm_projects_company_select" ON crm_projects
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── 5. CREATE: register_new_tenant RPC for self-registration ───────────────
-- This is called by SignUp.tsx after a user registers
-- It creates a new company and assigns the user as company_admin

CREATE OR REPLACE FUNCTION register_new_tenant(company_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_result jsonb;
BEGIN
  -- Get the current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a company
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  -- Create the new company with trial status
  INSERT INTO companies (
    id,
    name,
    license_status,
    max_users,
    allowed_permissions,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    company_name,
    'trial',
    5,
    ARRAY['leads', 'quotes', 'calendar', 'loss_reasons'],
    now(),
    now()
  ) RETURNING id INTO v_company_id;

  -- Upsert the user's profile as company_admin
  INSERT INTO profiles (id, email, full_name, role, company_id, is_active, created_at, updated_at)
  SELECT 
    v_user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'company_admin',
    v_company_id,
    true,
    now(),
    now()
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    role = 'company_admin',
    company_id = v_company_id,
    is_active = true,
    updated_at = now();

  v_result := jsonb_build_object(
    'company_id', v_company_id,
    'company_name', company_name,
    'status', 'trial'
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION register_new_tenant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_new_tenant(TEXT) TO authenticated;

-- ─── 6. VERIFY: leads table isolation ───────────────────────────────────────
-- Ensure the super_admin bypass on leads doesn't leak cross-tenant data
-- when super_admin is simulating a company (this is handled in app layer)

-- ─── 7. ADD: Default permissions for new trial companies ────────────────────
-- This comment documents that trial companies get: leads, quotes, calendar, loss_reasons
-- Full access (active) gets all modules
-- This is enforced in the register_new_tenant function above

-- ─── SUMMARY ─────────────────────────────────────────────────────────────────
-- Changes made:
-- 1. follow_ups: restricted to same-company leads only
-- 2. clients: removed anon public read, kept only token-based portal access
-- 3. service_request_quotes: removed anon public read
-- 4. crm_projects: reinforced company_id isolation  
-- 5. register_new_tenant: created for self-service signup
-- ─────────────────────────────────────────────────────────────────────────────
