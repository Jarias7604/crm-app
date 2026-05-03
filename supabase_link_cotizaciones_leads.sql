-- ============================================================
-- PASO 1: Ver qué cotizaciones no tienen lead vinculado
-- Corre esto primero para revisar cuántas hay
-- ============================================================
SELECT 
    c.id,
    c.nombre_cliente,
    c.empresa_cliente,
    c.estado,
    l.id as lead_id_encontrado,
    l.name as lead_nombre_match
FROM cotizaciones c
LEFT JOIN leads l 
    ON LOWER(TRIM(l.name)) = LOWER(TRIM(c.nombre_cliente))
    AND l.company_id = c.company_id
WHERE c.lead_id IS NULL
ORDER BY c.created_at DESC;

-- ============================================================
-- PASO 2: Vincular cotizaciones a leads por nombre exacto
-- Solo actualiza cotizaciones que aún no tienen lead_id
-- ============================================================
UPDATE cotizaciones c
SET lead_id = l.id
FROM leads l
WHERE c.lead_id IS NULL
  AND l.company_id = c.company_id
  AND LOWER(TRIM(l.name)) = LOWER(TRIM(c.nombre_cliente));

-- ============================================================
-- PASO 3: Ver el resultado después del update
-- ============================================================
SELECT 
    COUNT(*) FILTER (WHERE lead_id IS NOT NULL) as cotizaciones_vinculadas,
    COUNT(*) FILTER (WHERE lead_id IS NULL)     as cotizaciones_sin_lead,
    COUNT(*)                                     as total
FROM cotizaciones;
