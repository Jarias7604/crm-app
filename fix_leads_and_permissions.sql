-- INSTRUCCIONES:
-- 1. Ve a Supabase SQL Editor.
-- 2. Copia y pega todo este contenido.
-- 3. Reemplaza 'TU_EMAIL_AQUI' con tu email de login (ej: jarias7604@gmail.com).
-- 4. Ejecuta.

-- A) AGREGAR COLUMNA 'company_name' A LA TABLA LEADS
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS company_name text;

-- Asegurar que existe la columna 'value' también
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;

-- B) ASEGURAR EMPRESA Y VINCULAR USUARIO
-- 1. Crear empresa por defecto si no existe
INSERT INTO public.companies (name, license_status)
SELECT 'Empresa Admin', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.companies LIMIT 1);

-- 2. Asignar esa empresa al usuario si no tiene una
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE email = 'TU_EMAIL_AQUI' 
  AND company_id IS NULL;

-- 3. Hacerse Super Admin (por si acaso)
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'TU_EMAIL_AQUI';

-- C) CONFIRMACIÓN
SELECT email, company_id, role FROM public.profiles WHERE email = 'TU_EMAIL_AQUI';
