-- ================================================================
-- PURGA DEFINITIVA: Eliminar TODOS los proyectos contaminados
-- que el auto-seed creó incorrectamente para tenants no-Arias Defense
-- ================================================================

BEGIN;

-- 1. Eliminar tareas de proyectos contaminados en Abogados
DELETE FROM crm_tasks 
WHERE project_id IN (
  SELECT id FROM crm_projects 
  WHERE company_id = 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b'  -- Abogados
);

-- 2. Eliminar tareas de proyectos contaminados en empresa "c"
DELETE FROM crm_tasks 
WHERE project_id IN (
  SELECT id FROM crm_projects 
  WHERE company_id = '5a1661c5-c2e1-40e9-9b0e-e15e0981be81'  -- empresa "c" (test)
);

-- 3. Eliminar los proyectos contaminados de Abogados
DELETE FROM crm_projects 
WHERE company_id = 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b';  -- Abogados

-- 4. Eliminar los proyectos de empresa "c" (empresa de prueba, no real)
DELETE FROM crm_projects 
WHERE company_id = '5a1661c5-c2e1-40e9-9b0e-e15e0981be81';  -- empresa "c"

-- 5. Verificar estado final
DO $$
DECLARE
  v_abogados_count int;
  v_arias_count int;
BEGIN
  SELECT COUNT(*) INTO v_abogados_count FROM crm_projects 
  WHERE company_id = 'ee91c9f0-3e3a-44b6-8907-42a4af518f4b';
  
  SELECT COUNT(*) INTO v_arias_count FROM crm_projects 
  WHERE company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
  
  RAISE NOTICE 'Abogados proyectos: % (debe ser 0)', v_abogados_count;
  RAISE NOTICE 'Arias Defense proyectos: % (deben ser sus proyectos reales)', v_arias_count;
  
  IF v_abogados_count > 0 THEN
    RAISE EXCEPTION 'FALLO: Aún quedan proyectos en Abogados!';
  END IF;
END $$;

COMMIT;
