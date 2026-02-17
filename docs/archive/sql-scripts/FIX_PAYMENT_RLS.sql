-- ================================================================
-- 🛠️ FIX RLS: POLÍTICAS DE ACCESO PARA MOTOR DE PAGOS
-- ================================================================

-- Habilitar acceso total a usuarios autenticados para gestión de precios
-- (Esto soluciona el error "Error al actualizar plan")

-- 1. Policies para payment_settings
DROP POLICY IF EXISTS "Enable all interaction for authenticated users" ON payment_settings;
CREATE POLICY "Enable all interaction for authenticated users" 
ON payment_settings 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Policies para financing_plans
DROP POLICY IF EXISTS "Enable all interaction for authenticated users" ON financing_plans;
CREATE POLICY "Enable all interaction for authenticated users" 
ON financing_plans 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Asegurar que las tablas tengan RLS activo
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_plans ENABLE ROW LEVEL SECURITY;
