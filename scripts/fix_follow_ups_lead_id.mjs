// Fix: Allow NULL lead_id in follow_ups + update RLS policies
// Executes directly against production via Supabase Management API

const PROD_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const PROJ_REF = 'mtxqqamitglhehaktgxm';

const SQL = `
-- 1. Hacer lead_id opcional en follow_ups
ALTER TABLE public.follow_ups
  ALTER COLUMN lead_id DROP NOT NULL;

-- 2. Verificar resultado
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'follow_ups' AND column_name = 'lead_id';
`;

const RLS_SQL = `
-- Eliminar políticas RLS existentes de follow_ups
DROP POLICY IF EXISTS follow_ups_company_scoped_select ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_select ON public.follow_ups;
DROP POLICY IF EXISTS "Users can view follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_tenant_policy ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_company_scoped_insert ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_insert ON public.follow_ups;
DROP POLICY IF EXISTS "Users can insert follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_update ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_delete ON public.follow_ups;
DROP POLICY IF EXISTS "Users can delete follow ups" ON public.follow_ups;

-- Crear nuevas políticas que soportan lead_id NULL usando company_id directamente
CREATE POLICY follow_ups_select ON public.follow_ups
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR (
      lead_id IS NOT NULL
      AND lead_id IN (
        SELECT id FROM public.leads WHERE company_id = public.get_auth_company_id()
      )
    )
  );

CREATE POLICY follow_ups_insert ON public.follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_auth_company_id()
  );

CREATE POLICY follow_ups_update ON public.follow_ups
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR (
      lead_id IS NOT NULL
      AND lead_id IN (
        SELECT id FROM public.leads WHERE company_id = public.get_auth_company_id()
      )
    )
  )
  WITH CHECK (
    company_id = public.get_auth_company_id()
  );

CREATE POLICY follow_ups_delete ON public.follow_ups
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_auth_company_id()
    OR (
      lead_id IS NOT NULL
      AND lead_id IN (
        SELECT id FROM public.leads WHERE company_id = public.get_auth_company_id()
      )
    )
  );

-- Verificar políticas creadas
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'follow_ups';
`;

async function runSQL(sql, label) {
  console.log(`\n🔧 Running: ${label}`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJ_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (res.ok) {
    const data = await res.json();
    console.log('✅ Success:', JSON.stringify(data, null, 2));
    return true;
  } else {
    // Try alternate endpoint (REST SQL)
    const text = await res.text();
    console.log(`⚠️ Management API failed (${res.status}): ${text.substring(0, 300)}`);
    return false;
  }
}

async function runViaRestRPC(sql, label) {
  // Use pg_net or direct REST endpoint that accepts raw SQL
  console.log(`\n🔧 Trying REST RPC: ${label}`);
  const res = await fetch(`${PROD_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  });
  const text = await res.text();
  console.log(`Response (${res.status}): ${text.substring(0, 500)}`);
}

async function main() {
  console.log('🚀 Applying fix: allow NULL lead_id in follow_ups');
  console.log(`📡 Target: ${PROD_URL}\n`);

  // Try Management API first
  const ok1 = await runSQL(SQL, 'ALTER COLUMN lead_id DROP NOT NULL');
  if (!ok1) {
    await runViaRestRPC(SQL, 'ALTER COLUMN lead_id DROP NOT NULL (fallback)');
  }

  const ok2 = await runSQL(RLS_SQL, 'Update RLS policies for follow_ups');
  if (!ok2) {
    await runViaRestRPC(RLS_SQL, 'Update RLS policies (fallback)');
  }
}

main().catch(console.error);
