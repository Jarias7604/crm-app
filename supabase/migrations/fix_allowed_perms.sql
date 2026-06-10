UPDATE companies 
SET allowed_permissions = '["leads", "clientes", "proyectos", "quotes", "finanzas", "tickets", "marketing", "chat", "calendar", "pricing", "paquetes", "financial_rules", "items", "branding", "team_manage", "loss_reasons", "reports", "view_financials", "dashboard_full"]'::jsonb 
WHERE name = 'Arias Defense Testing';
