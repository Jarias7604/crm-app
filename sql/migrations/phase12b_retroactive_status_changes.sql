-- =============================================================================
-- MIGRACIÓN RETROACTIVA: Cambios de Estado
-- =============================================================================
-- Qué hace: Crea registros históricos en call_activities para todos los leads
--           que ya no están en el status inicial ('Prospecto') pero no tienen
--           ningún registro de cambio de estado previo.
--
-- SEGURO: Solo inserta si NO existe ya un registro status_before IS NOT NULL
--         para ese lead. Puede ejecutarse varias veces sin duplicar.
--
-- Ejecutar en: Supabase Production → SQL Editor
-- =============================================================================

DO $$
DECLARE
    inserted_count INTEGER;
BEGIN
    INSERT INTO call_activities (
        company_id,
        user_id,
        lead_id,
        call_date,
        outcome,
        action_type,
        notes,
        status_before,
        status_after
    )
    SELECT
        l.company_id,
        l.assigned_to                                         AS user_id,
        l.id                                                  AS lead_id,
        -- Usar updated_at del lead como aproximación de cuándo cambió el estado
        l.created_at                                          AS call_date,
        'connected'                                           AS outcome,
        'status_change'                                       AS action_type,
        '[Histórico] Estado registrado retroactivamente'      AS notes,
        'Prospecto'                                           AS status_before,
        l.status                                              AS status_after
    FROM leads l
    WHERE
        -- Solo leads que ya no están en el status inicial
        l.status <> 'Prospecto'

        -- Solo leads con asesor asignado (necesario para el KPI por usuario)
        AND l.assigned_to IS NOT NULL

        -- Excluir si ya tiene algún registro de cambio de estado
        AND NOT EXISTS (
            SELECT 1
            FROM call_activities ca
            WHERE ca.lead_id = l.id
              AND ca.status_before IS NOT NULL
              AND ca.status_after  IS NOT NULL
        );

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Insertados % registros retroactivos de cambio de estado.', inserted_count;
END $$;

-- Verificación: cuántos quedaron insertados por empresa y status
SELECT
    l.company_id,
    ca.status_after,
    COUNT(*) AS total_registros
FROM call_activities ca
JOIN leads l ON l.id = ca.lead_id
WHERE ca.notes = '[Histórico] Estado registrado retroactivamente'
GROUP BY l.company_id, ca.status_after
ORDER BY l.company_id, total_registros DESC;
