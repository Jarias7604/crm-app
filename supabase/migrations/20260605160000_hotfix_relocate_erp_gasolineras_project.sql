-- ================================================================
-- HOTFIX: Reubicar proyecto "ERP - Gasolineras" al company_id correcto
-- 
-- PROBLEMA: Proyecto creado durante simulación → quedó con company_id de
--           "Abogados y Asociados" en vez de "Arias Defense Components"
--
-- Proyecto afectado: f58dc756-e0ca-4eeb-ac9c-3b56f47ce02b
-- company_id INCORRECTO: ee91c9f0-3e3a-44b6-8907-42a4af518f4b (Abogados)
-- company_id CORRECTO:   7a582ba5-f7d0-4ae3-9985-35788deb1c30 (Arias Defense)
-- ================================================================

BEGIN;

-- 1. Verificar estado actual
DO $$
DECLARE
  v_project_name text;
  v_current_company text;
BEGIN
  SELECT p.name, c.name INTO v_project_name, v_current_company
  FROM crm_projects p
  JOIN companies c ON c.id = p.company_id
  WHERE p.id = 'f58dc756-e0ca-4eeb-ac9c-3b56f47ce02b';
  
  RAISE NOTICE 'Proyecto: % | Empresa actual: %', v_project_name, v_current_company;
END $$;

-- 2. Mover el proyecto al company_id correcto (Arias Defense)
UPDATE crm_projects
SET company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
WHERE id = 'f58dc756-e0ca-4eeb-ac9c-3b56f47ce02b'
  AND company_id = 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b';  -- guardia de seguridad

-- 3. Confirmar resultado
DO $$
DECLARE
  v_project_name text;
  v_new_company text;
  v_task_count int;
BEGIN
  SELECT p.name, c.name INTO v_project_name, v_new_company
  FROM crm_projects p
  JOIN companies c ON c.id = p.company_id
  WHERE p.id = 'f58dc756-e0ca-4eeb-ac9c-3b56f47ce02b';
  
  SELECT COUNT(*) INTO v_task_count
  FROM crm_tasks
  WHERE project_id = 'f58dc756-e0ca-4eeb-ac9c-3b56f47ce02b';
  
  RAISE NOTICE 'RESULTADO: Proyecto "%" → movido a "%" con % tareas', v_project_name, v_new_company, v_task_count;
END $$;

COMMIT;
