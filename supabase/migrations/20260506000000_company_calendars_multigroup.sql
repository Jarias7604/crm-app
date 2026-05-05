-- ================================================================
-- FEATURE: Sistema de Calendarios Multi-Grupo
-- Permite al admin crear múltiples calendarios compartidos
-- y asignar acceso por usuario individual o por rol
-- ================================================================

-- Tabla 1: Calendarios compartidos de la empresa
CREATE TABLE IF NOT EXISTS company_calendars (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  color           TEXT        NOT NULL DEFAULT '#4285F4',
  integration_id  UUID        REFERENCES calendar_integrations(id) ON DELETE SET NULL,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla 2: Control de acceso — quién ve qué calendario
CREATE TABLE IF NOT EXISTS calendar_access (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_calendar_id UUID        NOT NULL REFERENCES company_calendars(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view            BOOLEAN     NOT NULL DEFAULT true,
  granted_by          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_calendar_id, user_id)
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_company_calendars_company_id ON company_calendars(company_id);
CREATE INDEX IF NOT EXISTS idx_calendar_access_user_id ON calendar_access(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_access_calendar_id ON calendar_access(company_calendar_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_company_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_calendars_updated_at ON company_calendars;
CREATE TRIGGER trg_company_calendars_updated_at
  BEFORE UPDATE ON company_calendars
  FOR EACH ROW EXECUTE FUNCTION update_company_calendars_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE company_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_access ENABLE ROW LEVEL SECURITY;

-- company_calendars: todos en la empresa pueden leer
DROP POLICY IF EXISTS company_calendars_select ON company_calendars;
CREATE POLICY company_calendars_select ON company_calendars FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id());

-- company_calendars: solo admin puede crear/editar/borrar
DROP POLICY IF EXISTS company_calendars_admin ON company_calendars;
CREATE POLICY company_calendars_admin ON company_calendars
  FOR ALL TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
        = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
  )
  WITH CHECK (
    company_id = get_auth_company_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
        = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
  );

-- calendar_access: usuario solo ve sus propios accesos (o si es admin ve todo)
DROP POLICY IF EXISTS calendar_access_user_select ON calendar_access;
CREATE POLICY calendar_access_user_select ON calendar_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('company_admin'::app_role, 'super_admin'::app_role)
      AND company_id = get_auth_company_id()
    )
  );

-- calendar_access: solo admin puede gestionar accesos
DROP POLICY IF EXISTS calendar_access_admin ON calendar_access;
CREATE POLICY calendar_access_admin ON calendar_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_calendars cc
      WHERE cc.id = calendar_access.company_calendar_id
      AND cc.company_id = get_auth_company_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_calendars cc
      WHERE cc.id = calendar_access.company_calendar_id
      AND cc.company_id = get_auth_company_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1)
          = ANY (ARRAY['company_admin'::app_role, 'super_admin'::app_role])
    )
  );
