INSERT INTO public.permission_definitions (category, permission_key, label, is_system_only)
SELECT 'Soporte', 'tickets', 'Acceso a Tickets (Service Hub)', false
WHERE NOT EXISTS (SELECT 1 FROM public.permission_definitions WHERE permission_key = 'tickets');

INSERT INTO public.permission_definitions (category, permission_key, label, is_system_only)
SELECT 'Finanzas', 'view_financials', 'Ver Montos Financieros', false
WHERE NOT EXISTS (SELECT 1 FROM public.permission_definitions WHERE permission_key = 'view_financials');
