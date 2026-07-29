-- ============================================================
-- FIX: Lead Hunter - google_place_id column + unique index
-- ============================================================
-- PROBLEMA: El Lead Hunter no guardaba prospectos porque el upsert
-- con onConflict: 'google_place_id' requiere un UNIQUE INDEX en la
-- tabla. La columna fue agregada manualmente en el pasado pero sin
-- el índice único requerido por Supabase para el upsert.
--
-- IMPACTO: Todos los leads importados desde Lead Hunter AI fallaban
-- silenciosamente — el error era capturado y contado como "failed".
--
-- SOLUCIÓN:
-- 1. ADD COLUMN IF NOT EXISTS (seguro si ya existe)
-- 2. UNIQUE INDEX IF NOT EXISTS (lo que Supabase necesita para onConflict)
-- ============================================================

-- Step 1: Ensure the column exists (safe if already present)
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Step 2: Create the UNIQUE INDEX required by upsert onConflict
-- This is what Supabase's PostgREST needs for onConflict: 'google_place_id'
-- Using IF NOT EXISTS to be safe if it was already created manually
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_google_place_id
    ON public.leads (google_place_id)
    WHERE google_place_id IS NOT NULL;

-- Step 3: Verify
DO $$
BEGIN
    -- Check column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'leads'
          AND column_name = 'google_place_id'
    ) THEN
        RAISE NOTICE '✅ Columna google_place_id existe en leads.';
    ELSE
        RAISE EXCEPTION '❌ ERROR: La columna google_place_id NO fue creada.';
    END IF;

    -- Check index exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'leads'
          AND indexname = 'idx_leads_google_place_id'
    ) THEN
        RAISE NOTICE '✅ Índice único idx_leads_google_place_id existe.';
    ELSE
        RAISE EXCEPTION '❌ ERROR: El índice único NO fue creado.';
    END IF;

    RAISE NOTICE '🎯 Lead Hunter Fix: Migración aplicada exitosamente. El upsert con onConflict: google_place_id ahora funcionará correctamente.';
END $$;
