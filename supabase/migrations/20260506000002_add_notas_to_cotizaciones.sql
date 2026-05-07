-- Migration: Add notes field to quotes
-- Date: 2026-05-06

ALTER TABLE cotizaciones
    ADD COLUMN IF NOT EXISTS notas TEXT;

COMMENT ON COLUMN cotizaciones.notas IS 'Notas profesionales adicionales para la cotización';
