-- ============================================================
-- MIGRATION: Granular Permissions for Cotizaciones Module
-- Adds two new controllable permissions visible in the
-- "Matriz de Seguridad" UI panel:
--   • cotizaciones.change_payment_method  → Cambiar Forma de Pago
--   • cotizaciones.edit_prices            → Editar Precios de Items
--
-- Logic:
--   - super_admin: always TRUE (handled in get_user_permissions)
--   - company_admin: always TRUE (seeded here per role)
--   - sales_agent / collaborator: FALSE by default (must be granted)
-- ============================================================

-- 1. Register the two new permission definitions
INSERT INTO public.permission_definitions (permission_key, category, label, description, is_system_only)
VALUES
    (
        'cotizaciones.change_payment_method',
        'Cotizaciones',
        'Cambiar Forma de Pago',
        'Permite seleccionar y cambiar los planes de financiamiento y forma de pago en una cotización.',
        false
    ),
    (
        'cotizaciones.edit_prices',
        'Cotizaciones',
        'Editar Precios de Ítems',
        'Permite modificar manualmente los precios de módulos, servicios e implementación en una cotización.',
        false
    )
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- 2. Grant BOTH permissions to every company_admin role
--    (system roles that have base_role = 'company_admin')
--    so existing admins immediately gain full access.
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM public.custom_roles
        WHERE base_role IN ('company_admin', 'super_admin')
    LOOP
        INSERT INTO public.role_permissions (role_id, permission_key, is_enabled, updated_at)
        VALUES
            (r.id, 'cotizaciones.change_payment_method', true, now()),
            (r.id, 'cotizaciones.edit_prices',           true, now())
        ON CONFLICT (role_id, permission_key)
        DO UPDATE SET is_enabled = true, updated_at = now();
    END LOOP;
END;
$$;

-- ============================================================
-- 3. Ensure sales_agent / collaborator roles have these
--    permissions set to FALSE by default (explicit, auditable).
--    Admins can flip them ON per-role from the UI.
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM public.custom_roles
        WHERE base_role NOT IN ('company_admin', 'super_admin')
    LOOP
        INSERT INTO public.role_permissions (role_id, permission_key, is_enabled, updated_at)
        VALUES
            (r.id, 'cotizaciones.change_payment_method', false, now()),
            (r.id, 'cotizaciones.edit_prices',           false, now())
        ON CONFLICT (role_id, permission_key)
        DO NOTHING;  -- Don't overwrite if admin already configured them manually
    END LOOP;
END;
$$;

SELECT 'Migration 20260509120000 applied: cotizaciones.change_payment_method and cotizaciones.edit_prices registered.' AS result;
