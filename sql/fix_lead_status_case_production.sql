-- ============================================================
-- FIX: Normalizar lead statuses a TitleCase en producción
-- Proyecto: crm-app | DB: mtxqqamitglhehaktgxm (PRODUCCIÓN)
-- Fecha: 2026-07-07
-- Problema: Statuses en minúscula no coinciden con el RPC ni el frontend
-- ============================================================

-- PASO 1: Diagnóstico previo — ver distribución actual de statuses
SELECT status, COUNT(*) as total
FROM public.leads
GROUP BY status
ORDER BY COUNT(*) DESC;

-- ============================================================
-- PASO 2: Fix — normalizar todos los statuses a TitleCase
-- Ejecutar SOLO en PRODUCCIÓN (mtxqqamitglhehaktgxm)
-- ============================================================
UPDATE public.leads SET status = 'Prospecto'       WHERE LOWER(status) = 'prospecto'        AND status != 'Prospecto';
UPDATE public.leads SET status = 'Llamada fría'    WHERE LOWER(status) = 'llamada fría'     AND status != 'Llamada fría';
UPDATE public.leads SET status = 'En Nutrición'    WHERE LOWER(status) IN ('en nutrición','en nutricion','nutrición','nutricion') AND status != 'En Nutrición';
UPDATE public.leads SET status = 'Lead calificado' WHERE LOWER(status) = 'lead calificado'  AND status != 'Lead calificado';
UPDATE public.leads SET status = 'En seguimiento'  WHERE LOWER(status) = 'en seguimiento'   AND status != 'En seguimiento';
UPDATE public.leads SET status = 'Negociación'     WHERE LOWER(status) IN ('negociación','negociacion') AND status != 'Negociación';
UPDATE public.leads SET status = 'Cerrado'         WHERE LOWER(status) = 'cerrado'          AND status != 'Cerrado';
UPDATE public.leads SET status = 'Cliente'         WHERE LOWER(status) = 'cliente'          AND status != 'Cliente';
UPDATE public.leads SET status = 'Perdido'         WHERE LOWER(status) = 'perdido'          AND status != 'Perdido';
UPDATE public.leads SET status = 'Erróneo'         WHERE LOWER(status) IN ('erróneo','erroneo') AND status != 'Erróneo';

-- PASO 3: Verificación post-fix — debe mostrar solo TitleCase
SELECT status, COUNT(*) as total
FROM public.leads
GROUP BY status
ORDER BY COUNT(*) DESC;

-- ============================================================
-- PASO 4: Verificación de salud RLS
-- Leads accesibles del cliente Arias Defense (debe ser >= 500)
-- ============================================================
SELECT COUNT(*) as leads_arias_defense
FROM public.leads
WHERE company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
