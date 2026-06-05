-- ================================================================
-- EMERGENCY FIX: Aislamiento total de tenants + corrección admin
-- FECHA: 2026-06-05
-- PROBLEMA: Nuevo admin ve datos de otro tenant (Arias Defense)
-- CAUSA: 
--   1. crm_projects_super_admin policy permite ver TODOS los proyectos
--      sin importar company_id (falta filtro de empresa)
--   2. RLS de leads, clients, projects no bloquea al nuevo admin
--      si su company_id no quedó asignado correctamente
-- ================================================================

-- ─── 1. ELIMINAR política insegura de crm_projects ──────────────────────────
-- La política "crm_projects_super_admin" de la migración anterior
-- permite al super_admin ver TODOS los proyectos de TODOS los tenants.
-- Esto es correcto para el super_admin real, PERO no para un nuevo
-- company_admin de una empresa nueva que no tiene projects aún.
-- El problema real: si el nuevo admin tiene company_id NULL o incorrecto,
-- cae en la política del super_admin y ve todo.

DROP POLICY IF EXISTS "crm_projects_super_admin" ON crm_projects;
DROP POLICY IF EXISTS "crm_projects_company_select" ON crm_projects;
DROP POLICY IF EXISTS "projects_company_access" ON crm_projects;
DROP POLICY IF EXISTS "projects_tenant_access" ON crm_projects;

-- Política única y segura: solo ves proyectos de TU empresa
-- El super_admin accede vía Supabase Dashboard o RPC SECURITY DEFINER, no por RLS bypass
CREATE POLICY "crm_projects_strict_company" ON crm_projects
  FOR ALL
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── 2. ELIMINAR y recrear RLS de crm_tasks con el mismo patrón ─────────────
DROP POLICY IF EXISTS "crm_tasks_super_admin" ON crm_tasks;
DROP POLICY IF EXISTS "crm_tasks_company_select" ON crm_tasks;
DROP POLICY IF EXISTS "tasks_company_access" ON crm_tasks;

CREATE POLICY "crm_tasks_strict_company" ON crm_tasks
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM crm_projects WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM crm_projects WHERE company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ─── 3. ASEGURAR que crm_task_time_logs también está aislado ─────────────────
DROP POLICY IF EXISTS "time_logs_company_access" ON crm_task_time_logs;

CREATE POLICY "crm_task_time_logs_strict_company" ON crm_task_time_logs
  FOR ALL
  TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM crm_tasks t
      JOIN crm_projects p ON p.id = t.project_id
      WHERE p.company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM crm_tasks t
      JOIN crm_projects p ON p.id = t.project_id
      WHERE p.company_id = (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ─── 4. LEADS: reforzar aislamiento ──────────────────────────────────────────
-- Verificar que la política de leads es 100% strict
-- (No debe haber ninguna política que permita ver leads de otro tenant)

-- Eliminar cualquier bypass antiguo
DROP POLICY IF EXISTS "leads_super_admin_bypass" ON leads;
DROP POLICY IF EXISTS "super_admin_leads_bypass" ON leads;

-- ─── 5. CLIENTES: eliminar política anon permisiva que puede filtrar datos ───
-- (Ya en migración anterior, reforzar aquí)
DROP POLICY IF EXISTS "clients_anon_portal_read" ON clients;

-- ─── 6. FIX CRÍTICO: Función admin_create_user mejorada ──────────────────────
-- Reescribir para garantizar que el nuevo admin SIEMPRE queda ligado
-- al company_id correcto y NO puede ver datos de otros tenants

CREATE OR REPLACE FUNCTION admin_create_user(
  new_email       text,
  new_password    text,
  new_full_name   text,
  new_role        text         DEFAULT 'collaborator',
  new_company_id  uuid         DEFAULT NULL,
  new_phone       text         DEFAULT NULL,
  new_custom_role_id uuid      DEFAULT NULL,
  new_birth_date  date         DEFAULT NULL,
  new_address     text         DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id      uuid;
  v_caller_role    text;
  v_caller_company uuid;
  v_new_user_id    uuid;
  v_effective_company uuid;
BEGIN
  -- Quién está llamando esta función
  v_caller_id := auth.uid();
  
  SELECT role, company_id
  INTO v_caller_role, v_caller_company
  FROM profiles
  WHERE id = v_caller_id;

  -- Solo super_admin o company_admin pueden crear usuarios
  IF v_caller_role NOT IN ('super_admin', 'company_admin') THEN
    RAISE EXCEPTION 'Permission denied: only admins can create users';
  END IF;

  -- Determinar la empresa del nuevo usuario:
  -- Si el caller es company_admin, SIEMPRE usa su propia empresa (no puede crear en otras)
  -- Si el caller es super_admin, usa el new_company_id especificado
  IF v_caller_role = 'company_admin' THEN
    v_effective_company := v_caller_company;
  ELSE
    -- super_admin: debe especificar una empresa válida
    IF new_company_id IS NULL THEN
      RAISE EXCEPTION 'super_admin must specify a company_id';
    END IF;
    v_effective_company := new_company_id;
  END IF;

  -- Verificar que la empresa objetivo existe
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = v_effective_company) THEN
    RAISE EXCEPTION 'Company % does not exist', v_effective_company;
  END IF;

  -- Crear el usuario en auth.users
  v_new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    new_email,
    crypt(new_password, gen_salt('bf')),
    now(),   -- Email pre-confirmado (admin lo crea, no necesita confirmar)
    'authenticated',
    'authenticated',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', new_full_name)
  );

  -- Crear / actualizar perfil con el company_id CORRECTO
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    company_id,          -- ← CRÍTICO: siempre el v_effective_company
    phone,
    custom_role_id,
    address,
    is_active,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_new_user_id,
    new_email,
    new_full_name,
    new_role,
    v_effective_company, -- ← NUNCA NULL, NUNCA el company_id equivocado
    new_phone,
    new_custom_role_id,
    new_address,
    true,
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = new_email,
    full_name    = new_full_name,
    role         = new_role,
    company_id   = v_effective_company,  -- ← Forzar siempre
    phone        = new_phone,
    custom_role_id = new_custom_role_id,
    address      = new_address,
    is_active    = true,
    status       = 'active',
    updated_at   = now();

  RETURN jsonb_build_object(
    'user_id',    v_new_user_id,
    'email',      new_email,
    'role',       new_role,
    'company_id', v_effective_company,
    'status',     'created'
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email % already exists in the system', new_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END;
$$;

-- Permisos
REVOKE ALL ON FUNCTION admin_create_user(text, text, text, text, uuid, text, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, text, uuid, text, uuid, date, text) TO authenticated;

-- ─── 7. FIX: provision_new_tenant también asegura el company_id ─────────────
-- Reescribir para asegurar aislamiento completo desde la creación

CREATE OR REPLACE FUNCTION provision_new_tenant(
  p_company_name          text,
  p_license_status        text         DEFAULT 'active',
  p_rnc                   text         DEFAULT NULL,
  p_telefono              text         DEFAULT NULL,
  p_email                 text         DEFAULT NULL,
  p_direccion             text         DEFAULT NULL,
  p_max_users             int          DEFAULT 10,
  p_allowed_permissions   text[]       DEFAULT ARRAY['leads','quotes','calendar'],
  p_admin_email           text         DEFAULT NULL,
  p_admin_password        text         DEFAULT NULL,
  p_admin_full_name       text         DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role    text;
  v_company_id     uuid;
  v_admin_user_id  uuid;
BEGIN
  -- Solo super_admin puede crear empresas nuevas
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can provision new tenants';
  END IF;

  -- 1. Crear la empresa
  INSERT INTO companies (
    id,
    name,
    license_status,
    tax_id,
    phone,
    address,
    max_users,
    allowed_permissions,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_company_name,
    p_license_status,
    p_rnc,
    p_telefono,
    p_direccion,
    p_max_users,
    p_allowed_permissions,
    now(),
    now()
  ) RETURNING id INTO v_company_id;

  -- 2. Crear el admin inicial si se especificó
  IF p_admin_email IS NOT NULL AND p_admin_password IS NOT NULL THEN
    v_admin_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      v_admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_admin_email,
      crypt(p_admin_password, gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', COALESCE(p_admin_full_name, p_admin_email))
    );

    -- Perfil con el company_id de la NUEVA empresa (no de otra)
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      company_id,         -- ← SIEMPRE la nueva empresa
      is_active,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_admin_user_id,
      p_admin_email,
      COALESCE(p_admin_full_name, p_admin_email),
      'company_admin',
      v_company_id,       -- ← La empresa recién creada, nunca NULL
      true,
      'active',
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role       = 'company_admin',
      company_id = v_company_id,
      is_active  = true,
      status     = 'active',
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'company_id',   v_company_id,
    'company_name', p_company_name,
    'admin_email',  p_admin_email,
    'admin_id',     v_admin_user_id,
    'status',       'provisioned'
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email % already exists in the system', p_admin_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error provisioning tenant: %', SQLERRM;
END;
$$;

-- Permisos
REVOKE ALL ON FUNCTION provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_new_tenant(text, text, text, text, text, text, int, text[], text, text, text) TO authenticated;

-- ─── 8. DIAGNÓSTICO: detectar perfiles con company_id NULL ───────────────────
-- Cualquier perfil con company_id NULL es un vector de fuga de datos.
-- Asignar a una empresa 'orphan' o alertar.
-- (Solo registra en log, no modifica datos sin confirmación manual)

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM profiles
  WHERE company_id IS NULL
    AND role != 'super_admin';
  
  IF v_count > 0 THEN
    RAISE WARNING 'SECURITY ALERT: % profile(s) found with NULL company_id and non-super_admin role. These users may see cross-tenant data. Review immediately.', v_count;
  END IF;
END;
$$;

-- ─── RESUMEN ──────────────────────────────────────────────────────────────────
-- 1. crm_projects: eliminada política insegura, un solo policy strict por company_id
-- 2. crm_tasks: aislamiento reforzado  
-- 3. crm_task_time_logs: aislamiento reforzado
-- 4. admin_create_user: reescrita para garantizar company_id correcto SIEMPRE
-- 5. provision_new_tenant: reescrita para garantizar company_id correcto SIEMPRE
-- 6. Diagnóstico de perfiles huérfanos
-- ─────────────────────────────────────────────────────────────────────────────
