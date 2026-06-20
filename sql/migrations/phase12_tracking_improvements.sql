-- ================================================================
-- PHASE 12: TRACKING IMPROVEMENTS
-- Fix: Add 'status_change' to action_type constraint (for future use)
-- Fix: Ensure status_before / status_after are indexed properly
-- ================================================================

-- ⚠️ APLICAR PRIMERO EN TESTING (ubqscyfefgfbmndnypbp)
-- ⚠️ Solo aplicar en PRODUCCIÓN (mtxqqamitglhehaktgxm) con autorización explícita

-- 1. Expandir el constraint de action_type para incluir 'status_change'
--    Esto permite registrar cambios de estado directos sin mezclarse con llamadas
ALTER TABLE call_activities DROP CONSTRAINT IF EXISTS valid_action_type;

ALTER TABLE call_activities
ADD CONSTRAINT valid_action_type
CHECK (action_type IN (
    'call',
    'email',
    'whatsapp',
    'telegram',
    'quote_sent',
    'info_sent',
    'meeting',
    'status_change'   -- ← NUEVO: cambio de estado directo (sin contacto)
));

-- 2. Índice para acelerar queries de cambios de estado
CREATE INDEX IF NOT EXISTS idx_call_activities_status_change
ON call_activities(company_id, user_id, call_date DESC)
WHERE status_before IS DISTINCT FROM status_after
  AND status_after IS NOT NULL;

-- 3. Vista conveniente para debugging: ver cambios de estado por usuario
-- (No es requerida, es opcional para análisis)
CREATE OR REPLACE VIEW v_status_changes AS
SELECT
    ca.id,
    ca.company_id,
    ca.user_id,
    p.full_name AS user_name,
    ca.lead_id,
    l.name AS lead_name,
    ca.status_before,
    ca.status_after,
    ca.call_date AS changed_at,
    ca.notes
FROM call_activities ca
LEFT JOIN profiles p ON p.id = ca.user_id
LEFT JOIN leads l ON l.id = ca.lead_id
WHERE ca.status_before IS DISTINCT FROM ca.status_after
  AND ca.status_after IS NOT NULL
ORDER BY ca.call_date DESC;

-- ================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ================================================================
-- Ejecutar esto para confirmar que funcionó:
--
-- SELECT COUNT(*) FROM call_activities
-- WHERE status_before IS DISTINCT FROM status_after
--   AND status_after IS NOT NULL;
--
-- Debería mostrar > 0 después de que los asesores empiecen a usar
-- el nuevo selector de estado en el QuickCallLogger.

-- ================================================================
-- NOTA PARA EL EQUIPO
-- ================================================================
-- La lógica de conteo de "Cambios Estado" en el RPC get_call_activity_summary
-- YA ES CORRECTA. El bug era en el frontend (statusAfter nunca se pasaba).
-- Con este fix de Phase 12, el frontend ahora pasa statusAfter correctamente
-- en TRES flujos:
--   1. QuickCallLogger → selector "¿Cambió el estado?" (nuevo)
--   2. Kanban drag-drop → logStatusChange() automático
--   3. Panel de detalle → logStatusChange() automático al cambiar dropdown
