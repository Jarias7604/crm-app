-- ================================================================
-- FASE 1: Catálogo Universal Multi-Industria
-- Objetivo: Agregar modelo_precio a cotizador_items y pricing_items
--           para soportar servicios, productos, horas, proyectos
-- 
-- ✅ NO ROMPE: Motor de cálculo, PDF Pro, cotizaciones existentes
-- ✅ ADITIVO: Solo agrega columnas con DEFAULT seguros
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. COTIZADOR_ITEMS: Agregar modelo_precio + unidad + qty
-- ────────────────────────────────────────────────────────────────

ALTER TABLE cotizador_items
  ADD COLUMN IF NOT EXISTS modelo_precio TEXT NOT NULL DEFAULT 'precio_fijo'
    CHECK (modelo_precio IN (
      'precio_fijo',           -- Precio único (ej: honorario notarial $300)
      'por_hora',              -- Precio por hora (ej: $150/hr × hrs_estimadas)
      'por_unidad',            -- Precio por unidad con cantidad (ej: $50 × 10 docs)
      'suscripcion_mensual',   -- Recurrente mensual (ej: $99/mes)
      'suscripcion_anual',     -- Recurrente anual (ej: $999/año, mejor precio)
      'implementacion',        -- Setup único + luego recurrente
      'por_volumen'            -- Precio escalonado por volumen (ej: DTEs)
    )),
  ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'servicio'
    CHECK (unidad IN (
      'servicio',   -- Por servicio/trabajo
      'hora',       -- Por hora trabajada
      'unidad',     -- Por unidad física (doc, producto)
      'mes',        -- Por mes
      'año',        -- Por año
      'dte',        -- Por documento tributario
      'usuario',    -- Por usuario/licencia
      'proyecto'    -- Por proyecto completo
    )),
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_default NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS etiqueta_cantidad TEXT DEFAULT 'Cantidad';

-- ────────────────────────────────────────────────────────────────
-- 2. PRICING_ITEMS (catálogo visual): Igual estructura
-- ────────────────────────────────────────────────────────────────

ALTER TABLE pricing_items
  ADD COLUMN IF NOT EXISTS modelo_precio TEXT NOT NULL DEFAULT 'precio_fijo'
    CHECK (modelo_precio IN (
      'precio_fijo', 'por_hora', 'por_unidad',
      'suscripcion_mensual', 'suscripcion_anual',
      'implementacion', 'por_volumen'
    )),
  ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'servicio',
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_default NUMERIC DEFAULT 1;

-- ────────────────────────────────────────────────────────────────
-- 3. COTIZADOR_PAQUETES: Marcar si el paquete aplica para industria
-- ────────────────────────────────────────────────────────────────

ALTER TABLE cotizador_paquetes
  ADD COLUMN IF NOT EXISTS industria TEXT DEFAULT 'general'
    CHECK (industria IN (
      'general',        -- Aplica a todo (default)
      'legal',          -- Abogados, notarios
      'medico',         -- Clínicas, médicos
      'tecnologia',     -- SaaS, software
      'contabilidad',   -- Contadores, auditores
      'construccion',   -- Constructoras, arquitectos
      'comercio',       -- Tiendas, retail
      'educacion',      -- Escuelas, tutores
      'consultoria'     -- Consultoras generales
    )),
  ADD COLUMN IF NOT EXISTS resumen_corto TEXT DEFAULT NULL;  -- Descripción de 1 línea para el wizard

-- ────────────────────────────────────────────────────────────────
-- 4. Sincronizar precio_unitario con datos existentes
--    (precio_fijo items: precio_unitario = pago_unico OR precio_anual)
-- ────────────────────────────────────────────────────────────────

UPDATE cotizador_items
SET 
  precio_unitario = CASE 
    WHEN pago_unico > 0 THEN pago_unico
    WHEN precio_anual > 0 THEN precio_anual
    WHEN precio_mensual > 0 THEN precio_mensual
    ELSE 0
  END,
  modelo_precio = CASE
    WHEN pago_unico > 0 AND precio_anual = 0 AND precio_mensual = 0 THEN 'precio_fijo'
    WHEN precio_por_dte > 0 THEN 'por_volumen'
    WHEN pago_unico > 0 AND (precio_anual > 0 OR precio_mensual > 0) THEN 'implementacion'
    WHEN precio_mensual > 0 AND precio_anual = 0 THEN 'suscripcion_mensual'
    WHEN precio_anual > 0 THEN 'suscripcion_anual'
    ELSE 'precio_fijo'
  END
WHERE precio_unitario = 0;

-- ────────────────────────────────────────────────────────────────
-- 5. Comentarios de documentación en columnas
-- ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN cotizador_items.modelo_precio IS
  'Modelo de precio: precio_fijo | por_hora | por_unidad | suscripcion_mensual | suscripcion_anual | implementacion | por_volumen';

COMMENT ON COLUMN cotizador_items.unidad IS  
  'Unidad de medida para mostrar en wizard y PDF: servicio | hora | unidad | mes | año | dte | usuario | proyecto';

COMMIT;

-- Verificación
SELECT 
  tipo, 
  nombre, 
  modelo_precio, 
  unidad,
  precio_unitario
FROM cotizador_items 
ORDER BY tipo, nombre
LIMIT 20;
