-- ================================================================
-- PHASE 9b: Fix Notifications SELECT RLS
-- Fecha: 2026-03-30
--
-- BUG RAÍZ: La policy "notifications_select_optimized" tenía:
--   USING (user_id = auth.uid() OR company_id = get_auth_company_id())
--
-- La condición OR company_id = ... hacía que los admins vieran
-- TODAS las notificaciones de la empresa (Jimmy veía las de Patricia,
-- Melvin, etc.) resultando en duplicados en la campana de notificaciones.
--
-- FIX: SELECT permite ver ÚNICAMENTE tus propias notificaciones.
-- El frontend también fue actualizado para pasar userId explícito
-- en notifications.ts y useNotifications.ts como doble capa de defensa.
-- ================================================================
DROP POLICY IF EXISTS "notifications_select_optimized" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own"        ON public.notifications;

-- Un usuario solo ve SUS PROPIAS notificaciones
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
