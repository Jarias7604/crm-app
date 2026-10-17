-- ═══════════════════════════════════════════════════════════════════════════
-- AMPLIACIÓN DE CONTRATOS: FECHAS DE GRACIA, PRIMER COBRO Y NOTAS
-- Fecha: 2026-10-17
-- Permite formalizar contratos en Go-Live con meses gratis / diferidos
-- y recordatorios de vencimiento.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contracts 
    ADD COLUMN IF NOT EXISTS meses_gracia INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fecha_primer_cobro DATE,
    ADD COLUMN IF NOT EXISTS notas TEXT;

COMMENT ON COLUMN public.contracts.meses_gracia IS 'Cantidad de meses gratis o periodo de gracia antes del primer cobro';
COMMENT ON COLUMN public.contracts.fecha_primer_cobro IS 'Fecha calculada o estipulada para el primer cargo/cobro recurrente';
COMMENT ON COLUMN public.contracts.notas IS 'Notas internas o acuerdos especiales de la formalización en Go-Live';
