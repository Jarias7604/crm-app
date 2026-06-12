-- ============================================================
-- FIX CRÍTICO: Restaurar get_auth_company_id()
-- 
-- PROBLEMA: La migración 20260608183000_add_parent_company_id.sql
--   cambió esta función para leer del JWT. El JWT de producción
--   no siempre lleva company_id en app_metadata, por lo que la 
--   función devuelve NULL y RLS oculta TODOS los datos del usuario
--   (documentos, clientes, leads, cotizaciones, pipeline, etc.)
--
-- SOLUCIÓN: Restaurar el patrón correcto — leer de la tabla profiles.
--   Documentado en el Incidente 2026-03-29 y en session-start.md:
--   "get_auth_company_id() lee desde profiles (siempre correcto, nunca del JWT)"
--
-- IMPACTO: Solo esta función. Las políticas RLS de todas las tablas
--   ya están correctas — solo necesitan que esta función devuelva el
--   company_id correcto.
--
-- TESTED EN: ubqscyfefgfbmndnypbp (testing) primero
-- FECHA: 2026-06-11
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ── Verificación post-fix ────────────────────────────────────
-- Correr después de aplicar:
--
--   SELECT * FROM public.crm_rls_health_check();
--   → Los 5 checks deben estar en ✅
--
--   SELECT COUNT(*) FROM public.leads;
--   → Debe ser > 0
--
--   SELECT COUNT(*) FROM public.client_stage_document_types;
--   → Debe mostrar los tipos de documentos configurados
-- ────────────────────────────────────────────────────────────
