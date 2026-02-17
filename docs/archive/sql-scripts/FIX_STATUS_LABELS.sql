-- ============================================================
-- 🔧 CORRECCIÓN DEFINITIVA - Normalizar Estados en BD
-- ============================================================
-- Este script convierte los LABELS que están guardados
-- a las KEYS correctas que espera el código
-- ============================================================

-- Ver el estado ANTES de la corrección
SELECT 
    name as "Lead",
    CONCAT('''', status, '''') as "Estado Actual",
    LENGTH(status) as "Longitud"
FROM public.leads
ORDER BY name;

-- PASO 1: Corregir todos los labels a sus keys completas
UPDATE public.leads 
SET status = 'Lead frío' 
WHERE status IN ('Frío', 'Lead frío', 'Lead Frío', 'lead frío');

UPDATE public.leads 
SET status = 'Cotización enviada' 
WHERE status IN ('Cotización', 'Cotizacion', 'cotización enviada');

UPDATE public.leads 
SET status = 'Sin respuesta' 
WHERE status IN ('Sin Respuesta', 'sin respuesta', 'Sin respuesta');

UPDATE public.leads 
SET status = 'Seguimiento / Negociación' 
WHERE status IN ('Negociación', 'Negociacion', 'Seguimiento', 'seguimiento / negociación');

UPDATE public.leads 
SET status = 'Lead calificado' 
WHERE status IN ('Calificado', 'calificado', 'Lead Calificado');

-- PASO 2: Ver el resultado DESPUÉS de la corrección
SELECT 
    name as "Lead",
    CONCAT('''', status, '''') as "Estado Corregido",
    LENGTH(status) as "Longitud"
FROM public.leads
ORDER BY name;

-- PASO 3: Verificar que todos los estados sean válidos
SELECT 
    status,
    COUNT(*) as cantidad
FROM public.leads
GROUP BY status
ORDER BY cantidad DESC;

SELECT '✅ Estados normalizados correctamente' as resultado;
