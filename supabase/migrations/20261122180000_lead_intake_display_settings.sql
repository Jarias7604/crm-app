-- =============================================================================
-- SaaS Multi-Tenant Lead Intake Display & Qualification Field Configuration
-- Allows each company to configure which Excel / form fields appear in
-- Lead Detail, Lead Discovery Table, and AI Agent context, plus timeline visibility.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lead_intake_display_settings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    visible_in_detail   text[] NOT NULL DEFAULT ARRAY[
        'urgencia',
        'punto_de_mejora',
        'facturas_anual',
        'cargo',
        'metodo_actual',
        'proyectos_disponibles',
        'anuncio',
        'comentarios'
    ]::text[],
    visible_in_table    text[] NOT NULL DEFAULT ARRAY[
        'punto_de_mejora',
        'urgencia'
    ]::text[],
    visible_in_ai       text[] NOT NULL DEFAULT ARRAY[
        'urgencia',
        'punto_de_mejora',
        'facturas_anual',
        'cargo',
        'metodo_actual',
        'proyectos_disponibles',
        'anuncio',
        'comentarios'
    ]::text[],
    custom_field_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
    show_in_timeline    boolean NOT NULL DEFAULT true,
    updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_lead_intake_display_settings_company UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_intake_display_settings_company_id
    ON public.lead_intake_display_settings(company_id);

CREATE OR REPLACE FUNCTION public.update_lead_intake_display_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_lead_intake_display_settings_updated_at
    ON public.lead_intake_display_settings;

CREATE TRIGGER tr_lead_intake_display_settings_updated_at
    BEFORE UPDATE ON public.lead_intake_display_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_lead_intake_display_settings_timestamp();

ALTER TABLE public.lead_intake_display_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_intake_display_settings_select ON public.lead_intake_display_settings;
CREATE POLICY lead_intake_display_settings_select
    ON public.lead_intake_display_settings
    FOR SELECT
    TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

DROP POLICY IF EXISTS lead_intake_display_settings_manage ON public.lead_intake_display_settings;
CREATE POLICY lead_intake_display_settings_manage
    ON public.lead_intake_display_settings
    FOR ALL
    TO authenticated
    USING (
        (
            company_id = public.get_auth_company_id()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('company_admin', 'super_admin')
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    )
    WITH CHECK (
        (
            company_id = public.get_auth_company_id()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('company_admin', 'super_admin')
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );
