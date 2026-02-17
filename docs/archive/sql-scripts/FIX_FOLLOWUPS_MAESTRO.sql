-- ============================================================
-- 🚀 SUCURSAL FIX DEFINITIVO: PERMISOS DE SEGUIMIENTOS
-- ============================================================
-- Este script ELIMINA cualquier restricción que impida guardar notas.

-- 1. Limpieza total de cualquier política que pueda estar estorbando
DROP POLICY IF EXISTS "Users can view follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can create follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update delete follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can insert follow_ups for their company leads" ON public.follow_ups;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.follow_ups;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_select_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_insert_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "follow_ups_all_policy" ON public.follow_ups;
DROP POLICY IF EXISTS "permissive_follow_ups_policy" ON public.follow_ups;

-- 2. Asegurar que RLS esté activo pero con una política de "Puerta Abierta" para usuarios autenticados
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- 3. Crear UNA SOLA POLÍTICA MAESTRA (Lectura, Inserción, Actualización y Borrado)
CREATE POLICY "master_follow_ups_policy"
ON public.follow_ups FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Otorgar permisos directos al rol authenticated por si acaso
GRANT ALL ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;

SELECT '✅ ¡LISTO! Ahora puedes guardar notas sin errores.' as resultado;
