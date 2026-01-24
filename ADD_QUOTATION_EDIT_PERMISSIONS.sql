-- Add new permission definitions for editing costs in quotations
INSERT INTO permission_definitions (category, permission_key, label)
VALUES 
('Cotizaciones', 'cotizaciones.edit_prices', 'Editar precios de planes y módulos'),
('Cotizaciones', 'cotizaciones.manage_implementation', 'Gestionar cobro de implementación')
ON CONFLICT (permission_key) DO NOTHING;

-- Enable these permissions for super_admin and company_admin by default
INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 'super_admin', 'cotizaciones.edit_prices', true
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 'super_admin', 'cotizaciones.manage_implementation', true
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 'company_admin', 'cotizaciones.edit_prices', true
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;

INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT 'company_admin', 'cotizaciones.manage_implementation', true
ON CONFLICT (role, permission_key) DO UPDATE SET is_enabled = true;
