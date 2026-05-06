-- Migration: add etiqueta_ajuste to financing_plans
-- Purpose: Allow each company admin to customize the label shown on the
--          financing/discount charge line in quotes (web, public view, PDF).
--          When null/empty, the UI falls back to "Financiamiento" or "Descuento".
--
-- Deployed: 2026-05-06

ALTER TABLE financing_plans
    ADD COLUMN IF NOT EXISTS etiqueta_ajuste TEXT;

COMMENT ON COLUMN financing_plans.etiqueta_ajuste IS
    'Etiqueta personalizada para la línea de cargo/descuento en cotizaciones. '
    'Si es NULL o vacío, los clientes verán "Financiamiento" o "Descuento anticipado" por defecto.';
