-- Insert 'Finanzas' and 'Reportes BI' permission definitions
INSERT INTO public.permission_definitions (category, permission_key, label, description, is_system_only)
VALUES
  ('Finanzas', 'finanzas', 'Acceso a Finanzas', 'Permite el acceso a la vista principal de finanzas', false),
  ('Reportes BI', 'reports', 'Acceso a Reportes BI', 'Permite el acceso al módulo de Inteligencia de Negocios', false)
ON CONFLICT (permission_key) DO UPDATE
SET category = EXCLUDED.category, label = EXCLUDED.label;
