-- =====================================================
-- SCRIPT OBLIGATORIO - EJECUTAR EN SUPABASE SQL EDITOR
-- =====================================================
-- URL: https://supabase.com/dashboard/project/ikofyypxphrqkncimszt/sql
-- 
-- INSTRUCCIONES:
-- 1. Copia todo este código
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Haz clic en "Run"
-- =====================================================

-- Paso 1: Crear empresa si no existe
INSERT INTO public.companies (name, license_status)
SELECT 'Mi Empresa CRM', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.companies LIMIT 1);

-- Paso 2: Crear perfil para TODOS los usuarios de auth que no tengan perfil
INSERT INTO public.profiles (id, email, role, company_id, status)
SELECT 
    u.id,
    u.email,
    'super_admin',
    (SELECT id FROM public.companies LIMIT 1),
    'active'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Paso 3: Asegurar que todos los perfiles tengan company_id
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE company_id IS NULL;

-- Paso 4: Agregar columnas a leads si faltan
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;

-- Verificación final
SELECT 'ÉXITO - Perfiles reparados:' as mensaje, count(*) as total FROM public.profiles;
