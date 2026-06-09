INSERT INTO public.permission_definitions (category, permission_key, label, is_system_only)
SELECT 'Finanzas', 'finanzas', 'Acceso a Finanzas', false
WHERE NOT EXISTS (SELECT 1 FROM public.permission_definitions WHERE permission_key = 'finanzas');

INSERT INTO public.permission_definitions (category, permission_key, label, is_system_only)
SELECT 'Reportes BI', 'reports', 'Acceso a Reportes BI', false
WHERE NOT EXISTS (SELECT 1 FROM public.permission_definitions WHERE permission_key = 'reports');
