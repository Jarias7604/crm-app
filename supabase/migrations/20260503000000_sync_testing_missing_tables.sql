-- ============================================================
-- SYNC MIGRATION: Testing Environment Missing Tables
-- Ejecutar en: https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/sql
-- ============================================================

-- ============================================================
-- 1. TABLE: catalog_item_types (Catálogo de Productos - Tipos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.catalog_item_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,  -- NULL = sistema global
    name text NOT NULL,
    slug text NOT NULL,
    color text NOT NULL DEFAULT '#6366F1',
    icon text NOT NULL DEFAULT 'Package',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, slug)
);

-- RLS
ALTER TABLE public.catalog_item_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_item_types_select" ON public.catalog_item_types;
CREATE POLICY "catalog_item_types_select" ON public.catalog_item_types
    FOR SELECT TO authenticated
    USING (company_id IS NULL OR company_id = (SELECT get_auth_company_id()));

DROP POLICY IF EXISTS "catalog_item_types_insert" ON public.catalog_item_types;
CREATE POLICY "catalog_item_types_insert" ON public.catalog_item_types
    FOR INSERT TO authenticated
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

DROP POLICY IF EXISTS "catalog_item_types_update" ON public.catalog_item_types;
CREATE POLICY "catalog_item_types_update" ON public.catalog_item_types
    FOR UPDATE TO authenticated
    USING (company_id = (SELECT get_auth_company_id()));

DROP POLICY IF EXISTS "catalog_item_types_delete" ON public.catalog_item_types;
CREATE POLICY "catalog_item_types_delete" ON public.catalog_item_types
    FOR DELETE TO authenticated
    USING (company_id = (SELECT get_auth_company_id()));

-- Default system types (global, visible to all)
INSERT INTO public.catalog_item_types (id, company_id, name, slug, color, icon, is_active, sort_order)
VALUES
    (gen_random_uuid(), NULL, 'Plan', 'plan', '#4449AA', 'Shield', true, 1),
    (gen_random_uuid(), NULL, 'Paquete', 'paquete', '#7C3AED', 'Package', true, 2),
    (gen_random_uuid(), NULL, 'Módulo', 'modulo', '#2563EB', 'Puzzle', true, 3),
    (gen_random_uuid(), NULL, 'Servicio', 'servicio', '#059669', 'Wrench', true, 4),
    (gen_random_uuid(), NULL, 'Implementación', 'implementacion', '#D97706', 'Settings', true, 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. TABLE: industries (Rubros/Industrias)
-- ============================================================
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

DROP POLICY IF EXISTS "industries_company_isolation" ON public.industries;
CREATE POLICY "industries_company_isolation" ON public.industries
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- ============================================================
-- 3. RPC: get_industries
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_industries()
RETURNS TABLE (
    id uuid,
    company_id uuid,
    name text,
    is_active boolean,
    display_order integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, company_id, name, is_active, display_order, created_at, updated_at
    FROM public.industries
    WHERE company_id = get_auth_company_id()
    ORDER BY display_order ASC, name ASC;
$$;

-- ============================================================
-- 4. RPC: create_industry
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_industry(
    p_name text,
    p_display_order integer DEFAULT 999
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id uuid;
    v_result json;
BEGIN
    v_company_id := get_auth_company_id();
    
    INSERT INTO public.industries (company_id, name, display_order)
    VALUES (v_company_id, p_name, p_display_order)
    RETURNING to_json(industries.*) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- ============================================================
-- 5. RPC: update_industry
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_industry(
    p_id uuid,
    p_name text DEFAULT NULL,
    p_is_active boolean DEFAULT NULL,
    p_display_order integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.industries
    SET
        name = COALESCE(p_name, name),
        is_active = COALESCE(p_is_active, is_active),
        display_order = COALESCE(p_display_order, display_order),
        updated_at = now()
    WHERE id = p_id
      AND company_id = get_auth_company_id();
END;
$$;

-- ============================================================
-- 6. TABLE: pricing_items (Catálogo de Precios)
--    (Si no existe — la tabla que usa el cotizador dinámico)
-- ============================================================
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

DROP POLICY IF EXISTS "pricing_items_company_isolation" ON public.pricing_items;
CREATE POLICY "pricing_items_company_isolation" ON public.pricing_items
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- ============================================================
-- 7. SEED: Industrias de prueba para la compañía principal
--    Reemplaza el UUID con el de tu compañía en Testing
-- ============================================================
DO $$
DECLARE
    v_company_id uuid;
BEGIN
    -- Tomar la primera compañía activa que exista
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
    END IF;
END;
$$;

-- ============================================================
-- 8. SEED: Leads de prueba (10 leads, mezcla con/sin documento)
-- ============================================================
DO $$
DECLARE
    v_company_id uuid;
    v_user_id uuid;
BEGIN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    IF v_company_id IS NOT NULL THEN
        INSERT INTO public.leads (company_id, name, company_name, email, phone, status, priority, value, source, assigned_to, document_path)
        VALUES
            (v_company_id, 'Carlos Méndez', 'TechSolutions SRL', 'carlos@techsolutions.com', '7200-1111', 'Prospecto', 'high', 2500.00, 'LinkedIn', v_user_id, NULL),
            (v_company_id, 'María López', 'Seguridad Nacional SA', 'maria@segnacional.com', '7300-2222', 'Contactado', 'medium', 4800.00, 'Referido', v_user_id, NULL),
            (v_company_id, 'Roberto García', 'Grupo Industrial GAR', 'roberto@gar.com', '7400-3333', 'Negociación', 'high', 12000.00, 'Web', v_user_id, 'https://example.com/cotizacion-garcia.pdf'),
            (v_company_id, 'Ana Martínez', 'Clínica Salud Plus', 'ana@saludplus.com', '7500-4444', 'Prospecto', 'low', 1800.00, 'Google Ads', v_user_id, NULL),
            (v_company_id, 'Luis Hernández', 'Academia Elite', 'luis@academiaelite.edu', '7600-5555', 'Interesado', 'medium', 3200.00, 'Email', v_user_id, 'https://example.com/cotizacion-hernandez.pdf'),
            (v_company_id, 'Patricia Rivas', 'Distribuidora Rivas', 'patricia@rivas.com', '7700-6666', 'Contactado', 'high', 6500.00, 'LinkedIn', v_user_id, NULL),
            (v_company_id, 'Diego Castillo', 'Exportaciones DC', 'diego@expdc.com', '7800-7777', 'Negociación', 'medium', 9000.00, 'Referido', v_user_id, 'https://example.com/cotizacion-castillo.pdf'),
            (v_company_id, 'Laura Fuentes', 'Ministerio de Educación', 'laura@mined.gob', '7900-8888', 'Prospecto', 'low', 25000.00, 'Web', v_user_id, NULL),
            (v_company_id, 'Marcos Alvarado', 'Farmacia Central', 'marcos@farmcentral.com', '7100-9999', 'Interesado', 'high', 4200.00, 'Facebook Ads', v_user_id, 'https://example.com/cotizacion-alvarado.pdf'),
            (v_company_id, 'Sofía Reyes', 'Constructora Reyes', 'sofia@constructreyes.com', '7200-0000', 'Cerrado', 'medium', 18000.00, 'Google Ads', v_user_id, 'https://example.com/cotizacion-reyes.pdf')
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

-- Done!
SELECT 'Migration applied successfully. Tables created: catalog_item_types, industries, pricing_items. Seed data inserted.' AS result;
