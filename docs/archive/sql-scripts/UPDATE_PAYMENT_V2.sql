-- ================================================================
-- 🚀 MIGRACIÓN A MOTOR DE PAGOS V2: LÓGICA UNIFICADA
-- ================================================================

-- 1. Agregar columna `tipo_ajuste`
-- Valores permitidos: 'discount' (Descuento), 'recharge' (Recargo), 'none' (Ninguno/Neutro)
ALTER TABLE financing_plans 
ADD COLUMN IF NOT EXISTS tipo_ajuste VARCHAR(20) DEFAULT 'none';

-- 2. Migrar datos existentes para que tengan sentido en el nuevo modelo

-- Caso A: Plan "1 Solo Pago" (o 12 meses sin interés) -> Ahora es "Descuento por Pago Único"
-- Asumimos que si tiene 12 meses y 0 interés, era el plan "Anual de Contado"
UPDATE financing_plans
SET 
  tipo_ajuste = 'discount',
  interes_porcentaje = 20, -- Seteamos un default de 20% como pidió el usuario
  titulo = 'Pago De Contado (Anual)',
  descripcion = 'Ahorras 20% por pago adelantado',
  meses = 1 -- Duración de pago: 1 vez
WHERE meses = 12 AND interes_porcentaje = 0;

-- Caso B: Planes financiados con interés -> Son "Recargos"
UPDATE financing_plans
SET tipo_ajuste = 'recharge'
WHERE interes_porcentaje > 0;

-- Caso C: Planes financiados SIN interés (ej: 3 Cuotas Sin Interés) -> Son "Neutros"
UPDATE financing_plans
SET tipo_ajuste = 'none'
WHERE interes_porcentaje = 0 AND tipo_ajuste = 'none';

-- 3. Verificación
SELECT id, titulo, meses, tipo_ajuste, interes_porcentaje FROM financing_plans ORDER BY meses;
