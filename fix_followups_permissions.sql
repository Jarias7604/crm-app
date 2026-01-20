-- Asegurar que la tabla follow_ups existe y tiene los permisos correctos
CREATE TABLE IF NOT EXISTS public.follow_ups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    date DATE NOT NULL,
    action_type TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Users can view follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can create follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.follow_ups;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update delete follow ups" ON public.follow_ups;

-- Crear nuevas políticas simples y permisivas para usuarios autenticados
-- 1. Ver seguimientos (Lectura)
CREATE POLICY "Users can view follow ups"
ON public.follow_ups FOR SELECT
TO authenticated
USING (true); -- Simplificado para debug. Idealmente filtrar por company_id a través del lead

-- 2. Crear seguimientos (Escritura)
CREATE POLICY "Users can create follow ups"
ON public.follow_ups FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Actualizar/Borrar (Opcional)
CREATE POLICY "Users can update delete follow ups"
ON public.follow_ups FOR ALL
TO authenticated
USING (true);

-- Asegurar que leads tiene la columna correcta (just in case)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS document_path TEXT;
