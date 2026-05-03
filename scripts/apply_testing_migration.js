/**
 * Script to apply missing migrations to Testing Supabase via REST API
 * Run with: node scripts/apply_testing_migration.js
 */

const SUPABASE_URL = 'https://ubqscyfefgfbmndnypbp.supabase.co';
// Use service role key - needed for DDL operations
// You need to get this from: https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/settings/api
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SQL = `
-- ============================================================
-- SYNC: Create missing tables in Testing environment
-- ============================================================

-- 1. catalog_item_types
CREATE TABLE IF NOT EXISTS public.catalog_item_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    color text NOT NULL DEFAULT '#6366F1',
    icon text NOT NULL DEFAULT 'Package',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.catalog_item_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalog_item_types' AND policyname='catalog_item_types_select') THEN
    CREATE POLICY "catalog_item_types_select" ON public.catalog_item_types
      FOR SELECT TO authenticated
      USING (company_id IS NULL OR company_id = (SELECT get_auth_company_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalog_item_types' AND policyname='catalog_item_types_write') THEN
    CREATE POLICY "catalog_item_types_write" ON public.catalog_item_types
      FOR ALL TO authenticated
      USING (company_id = (SELECT get_auth_company_id()))
      WITH CHECK (company_id = (SELECT get_auth_company_id()));
  END IF;
END $$;

INSERT INTO public.catalog_item_types (company_id, name, slug, color, icon, is_active, sort_order)
VALUES
  (NULL, 'Plan', 'plan', '#4449AA', 'Shield', true, 1),
  (NULL, 'Paquete', 'paquete', '#7C3AED', 'Package', true, 2),
  (NULL, 'Módulo', 'modulo', '#2563EB', 'Puzzle', true, 3),
  (NULL, 'Servicio', 'servicio', '#059669', 'Wrench', true, 4),
  (NULL, 'Implementación', 'implementacion', '#D97706', 'Settings', true, 5)
ON CONFLICT DO NOTHING;

-- 2. industries
CREATE TABLE IF NOT EXISTS public.industries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='industries' AND policyname='industries_company_isolation') THEN
    CREATE POLICY "industries_company_isolation" ON public.industries
      FOR ALL TO authenticated
      USING (company_id = (SELECT get_auth_company_id()))
      WITH CHECK (company_id = (SELECT get_auth_company_id()));
  END IF;
END $$;

-- 3. RPC: get_industries
CREATE OR REPLACE FUNCTION public.get_industries()
RETURNS TABLE (id uuid, company_id uuid, name text, is_active boolean, display_order integer, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, company_id, name, is_active, display_order, created_at, updated_at
  FROM public.industries
  WHERE company_id = get_auth_company_id()
  ORDER BY display_order ASC, name ASC;
$$;

-- 4. RPC: create_industry
CREATE OR REPLACE FUNCTION public.create_industry(p_name text, p_display_order integer DEFAULT 999)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid; v_result json;
BEGIN
  v_company_id := get_auth_company_id();
  INSERT INTO public.industries (company_id, name, display_order)
  VALUES (v_company_id, p_name, p_display_order)
  RETURNING to_json(industries.*) INTO v_result;
  RETURN v_result;
END; $$;

-- 5. RPC: update_industry
CREATE OR REPLACE FUNCTION public.update_industry(p_id uuid, p_name text DEFAULT NULL, p_is_active boolean DEFAULT NULL, p_display_order integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.industries
  SET name = COALESCE(p_name, name),
      is_active = COALESCE(p_is_active, is_active),
      display_order = COALESCE(p_display_order, display_order),
      updated_at = now()
  WHERE id = p_id AND company_id = get_auth_company_id();
END; $$;

-- 6. pricing_items
CREATE TABLE IF NOT EXISTS public.pricing_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    descripcion text,
    tipo text NOT NULL DEFAULT 'modulo',
    codigo text,
    precio_anual numeric(10,2) NOT NULL DEFAULT 0,
    precio_mensual numeric(10,2) NOT NULL DEFAULT 0,
    costo_unico numeric(10,2) NOT NULL DEFAULT 0,
    precio_por_dte numeric(10,4) DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pricing_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pricing_items' AND policyname='pricing_items_company_isolation') THEN
    CREATE POLICY "pricing_items_company_isolation" ON public.pricing_items
      FOR ALL TO authenticated
      USING (company_id = (SELECT get_auth_company_id()))
      WITH CHECK (company_id = (SELECT get_auth_company_id()));
  END IF;
END $$;

-- 7. Seed: industries + leads de prueba
DO $$
DECLARE v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.industries (company_id, name, display_order)
    VALUES
      (v_company_id, 'Tecnología', 1),
      (v_company_id, 'Defensa y Seguridad', 2),
      (v_company_id, 'Salud', 3),
      (v_company_id, 'Educación', 4),
      (v_company_id, 'Retail / Comercio', 5),
      (v_company_id, 'Manufactura', 6),
      (v_company_id, 'Servicios Profesionales', 7),
      (v_company_id, 'Gobierno', 8)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.leads (company_id, name, company_name, email, phone, status, priority, value, source, document_path)
    VALUES
      (v_company_id, 'Carlos Méndez', 'TechSolutions SRL', 'carlos@techsolutions.com', '7200-1111', 'Prospecto', 'high', 2500.00, 'LinkedIn', NULL),
      (v_company_id, 'María López', 'Seguridad Nacional SA', 'maria@segnacional.com', '7300-2222', 'Contactado', 'medium', 4800.00, 'Referido', NULL),
      (v_company_id, 'Roberto García', 'Grupo Industrial GAR', 'roberto@gar.com', '7400-3333', 'Negociación', 'high', 12000.00, 'Web', 'https://ubqscyfefgfbmndnypbp.supabase.co/storage/v1/object/public/lead-documents/sample.pdf'),
      (v_company_id, 'Ana Martínez', 'Clínica Salud Plus', 'ana@saludplus.com', '7500-4444', 'Prospecto', 'low', 1800.00, 'Google Ads', NULL),
      (v_company_id, 'Luis Hernández', 'Academia Elite', 'luis@academiaelite.edu', '7600-5555', 'Interesado', 'medium', 3200.00, 'Email', 'https://ubqscyfefgfbmndnypbp.supabase.co/storage/v1/object/public/lead-documents/sample2.pdf'),
      (v_company_id, 'Patricia Rivas', 'Distribuidora Rivas', 'patricia@rivas.com', '7700-6666', 'Contactado', 'high', 6500.00, 'LinkedIn', NULL),
      (v_company_id, 'Diego Castillo', 'Exportaciones DC', 'diego@expdc.com', '7800-7777', 'Negociación', 'medium', 9000.00, 'Referido', 'https://ubqscyfefgfbmndnypbp.supabase.co/storage/v1/object/public/lead-documents/sample3.pdf'),
      (v_company_id, 'Laura Fuentes', 'Ministerio de Educación', 'laura@mined.gob', '7900-8888', 'Prospecto', 'low', 25000.00, 'Web', NULL),
      (v_company_id, 'Marcos Alvarado', 'Farmacia Central', 'marcos@farmcentral.com', '7100-9999', 'Interesado', 'high', 4200.00, 'Facebook Ads', 'https://ubqscyfefgfbmndnypbp.supabase.co/storage/v1/object/public/lead-documents/sample4.pdf'),
      (v_company_id, 'Sofía Reyes', 'Constructora Reyes', 'sofia@constructreyes.com', '7200-0000', 'Cerrado', 'medium', 18000.00, 'Google Ads', 'https://ubqscyfefgfbmndnypbp.supabase.co/storage/v1/object/public/lead-documents/sample5.pdf')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

SELECT 'OK - All missing tables created and seed data inserted' AS result;
`;

async function applyMigration() {
  if (!SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY env variable');
    console.log('Get it from: https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/settings/api');
    process.exit(1);
  }

  console.log('🚀 Applying migration to Testing Supabase...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql: SQL }),
    });

    if (!response.ok) {
      // Try the pg endpoint
      const resp2 = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: SQL }),
      });
      
      const text2 = await resp2.text();
      console.log('Response 2:', text2);
    } else {
      const data = await response.json();
      console.log('✅ Success:', data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

applyMigration();
