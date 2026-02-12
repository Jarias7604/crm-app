-- ================================================================
-- 🛡️ ARQUITECTURA DE SEGURIDAD: ESTÁNDAR HUBSPOT (FEBRERO 2026)
-- CONSOLIDADO FINAL DE ESTABILIZACIÓN
-- ================================================================

/*
  PRINCIPIOS DE ESTE SISTEMA:
  1. No Recursión: Se usan funciones SECURITY DEFINER (get_my_role, get_my_company_id).
  2. Una sola Verdad: Cada tabla tiene UNA política principal de aislamiento por empresa.
  3. Super Admin Total: El rol 'super_admin' tiene pase libre garantizado.
*/

-- 1. FUNCIONES CORE (Las "Llaves Maestras")
-- Estas funciones evitan que el sistema se bloquee al consultar perfiles.
-- NO ELIMINAR NI CAMBIAR A 'SECURITY INVOKER'.

/* 
CREATE OR REPLACE FUNCTION public.get_my_company_id() RETURNS uuid ...
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS public.app_role ...
CREATE OR REPLACE FUNCTION public.check_is_super_admin() RETURNS boolean ...
*/

-- 2. POLÍTICA TIPO PARA NUEVAS TABLAS
-- Si en el futuro creas una tabla 'ventas', usa este patrón:
/*
CREATE POLICY "hubspot_style_ventas_isolation" ON public.ventas
FOR ALL USING (
    public.get_my_role() = 'super_admin'
    OR company_id = public.get_my_company_id()
);
*/

-- 3. TABLAS CRÍTICAS PROTEGIDAS HOY:
-- - profiles (Lectura segura y actualización protegida)
-- - leads (Aislamiento total por empresa)
-- - marketing_ai_agents (Aislamiento total)
-- - follow_ups (Vinculado a leads de la empresa)
-- - cotizador_items (Lectura global, edición restringida)
