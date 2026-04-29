-- ============================================================
-- MIGRATION: Delete FK references before user deletion
-- DATE: 2026-04-29
-- DESCRIPTION: Procedimiento reutilizable para eliminar un
--   usuario de forma segura limpiando primero todas las FK.
--   También elimina los usuarios de prueba de Arias Defense:
--   - admin_salvador_test@arias-defense.com
--   - dmorales_old@ariasdefense.com
-- ============================================================

-- Función helper para eliminar un usuario de forma segura
CREATE OR REPLACE FUNCTION public.safe_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.marketing_ai_agents    SET representative_id = NULL     WHERE representative_id     = target_user_id;
    UPDATE public.leads                  SET next_followup_assignee = NULL WHERE next_followup_assignee = target_user_id;
    UPDATE public.cotizaciones           SET created_by = NULL             WHERE created_by            = target_user_id;
    UPDATE public.client_documents       SET uploaded_by = NULL            WHERE uploaded_by           = target_user_id;
    UPDATE public.client_pipeline_stages SET assigned_to = NULL            WHERE assigned_to           = target_user_id;
    UPDATE public.client_stage_comments  SET created_by = NULL             WHERE created_by            = target_user_id;
    UPDATE public.clients                SET assigned_to = NULL            WHERE assigned_to           = target_user_id;
    UPDATE public.company_invitations    SET invited_by = NULL             WHERE invited_by            = target_user_id;
    UPDATE public.flyer_assets           SET created_by = NULL             WHERE created_by            = target_user_id;
    UPDATE public.flyer_schedules        SET created_by = NULL             WHERE created_by            = target_user_id;
    UPDATE public.follow_ups             SET assigned_to = NULL            WHERE assigned_to           = target_user_id;
    UPDATE public.follow_ups             SET user_id = NULL                WHERE user_id               = target_user_id;
    UPDATE public.follow_ups             SET completed_by = NULL           WHERE completed_by          = target_user_id;
    UPDATE public.pagos                  SET registrado_por = NULL         WHERE registrado_por        = target_user_id;
    UPDATE public.request_messages       SET sender_id = NULL              WHERE sender_id             = target_user_id;
    UPDATE public.request_status_history SET changed_by = NULL             WHERE changed_by            = target_user_id;
    UPDATE public.sales_goals            SET agent_id = NULL               WHERE agent_id              = target_user_id;
    UPDATE public.service_requests       SET contractor_id = NULL           WHERE contractor_id         = target_user_id;
    UPDATE public.team_members           SET user_id = NULL                WHERE user_id               = target_user_id;
    UPDATE public.teams                  SET leader_id = NULL              WHERE leader_id             = target_user_id;
    UPDATE public.ticket_comments        SET author_id = NULL              WHERE author_id             = target_user_id;
    UPDATE public.tickets                SET created_by = NULL             WHERE created_by            = target_user_id;
    UPDATE public.tickets                SET assigned_to = NULL            WHERE assigned_to           = target_user_id;

    DELETE FROM public.notification_preferences WHERE user_id   = target_user_id;
    DELETE FROM public.contractor_profiles      WHERE profile_id = target_user_id;
    DELETE FROM public.profiles                 WHERE id         = target_user_id;
    DELETE FROM auth.users                      WHERE id         = target_user_id;
END;
$$;

-- Ahora en entornos que tengan los usuarios de prueba, eliminarlos
-- (En producción ya están eliminados; en local/testing esta función los limpiará)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin_salvador_test@arias-defense.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    PERFORM public.safe_delete_user(v_user_id);
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dmorales_old@ariasdefense.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    PERFORM public.safe_delete_user(v_user_id);
  END IF;
END $$;
