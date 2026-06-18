-- ================================================================
-- Migration: Remove hardcoded check constraints on catalog item types
-- Date: 2026-06-18
-- Description: Drop pricing_items_tipo_check and cotizador_items_tipo_check
--              to allow custom catalog categories created dynamically in catalog_item_types.
-- ================================================================

-- 1. Drop check constraint on pricing_items table
ALTER TABLE public.pricing_items 
  DROP CONSTRAINT IF EXISTS pricing_items_tipo_check;

-- 2. Drop check constraint on cotizador_items table
ALTER TABLE public.cotizador_items 
  DROP CONSTRAINT IF EXISTS cotizador_items_tipo_check;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
