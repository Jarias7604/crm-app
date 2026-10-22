/**
 * Permission Normalizer & License Validator (SSOT)
 * Single source of truth for cross-referencing user permissions (granular or base)
 * against tenant-licensed modules (companies.allowed_permissions).
 * 
 * Prevents language/prefix mismatches (e.g. cotizaciones.* vs quotes, clientes.* vs leads)
 * from silently purging valid user permissions during login or UI permission matrix rendering.
 */

// Infrastructure prefixes that are ALWAYS granted regardless of tenant license
export const INFRASTRUCTURE_PREFIXES = ['team', 'dashboard', 'branding', 'onboarding', 'pipeline'];

// Canonical map translating all language, shorthand and legacy module variants to the company license key
export const MODULE_LICENSE_MAP: Record<string, string> = {
    // Quotes / Cotizaciones
    cotizaciones:    'quotes',
    quotes:          'quotes',

    // Leads / Clientes
    leads:           'leads',
    clientes:        'leads',
    clients:         'leads',

    // Invoicing / Facturas
    invoices:        'invoices',
    facturas:        'invoices',

    // Projects / Proyectos
    proyectos:       'proyectos',
    projects:        'proyectos',

    // Marketing / Campañas
    marketing:       'marketing',
    mkt:             'marketing',
    ai_agents:       'marketing',

    // Finance / Finanzas
    finanzas:        'finanzas',
    finance:         'finanzas',

    // Other core modules
    tickets:         'tickets',
    chat:            'chat',
    calendar:        'calendar',
    calendario:      'calendar',
    followups:       'leads',
    followup:        'leads',
    seguimientos:    'leads',
    seguimiento:     'leads',
    pricing:         'pricing',
    paquetes:        'paquetes',
    items:           'items',
    financial_rules: 'financial_rules',
    loss_reasons:    'loss_reasons',
    loss:            'loss_reasons',
    reports:         'reports',
    view_financials: 'view_financials',
    dashboard_full:  'dashboard_full',
};

/**
 * Returns the canonical module license key for any permission key or prefix.
 * e.g.:
 *  'cotizaciones.change_payment_method' -> 'quotes'
 *  'clientes.view'                      -> 'leads'
 *  'mkt_campaigns'                      -> 'marketing'
 */
export function getCanonicalModuleKey(permissionKey: string): string {
    const base = permissionKey.split(/[._:]/)[0].toLowerCase();
    return MODULE_LICENSE_MAP[base] || base;
}

/**
 * Verifies whether a given permission key is allowed under the company's licensed modules.
 * Used identically across AuthProvider (real login & simulation) and Permissions UI.
 * 
 * @param permissionKey The exact permission key (e.g., 'cotizaciones.change_payment_method')
 * @param rawCompanyLicense Array of allowed modules from companies.allowed_permissions
 * @returns boolean
 */
export function isPermissionAllowedByCompanyLicense(
    permissionKey: string,
    rawCompanyLicense?: string[] | null
): boolean {
    // Fail-open guardrail: If company license is undefined or empty, do not lock out permissions
    if (!rawCompanyLicense || rawCompanyLicense.length === 0) {
        return true;
    }

    const companyLicense = rawCompanyLicense.map(k => String(k).trim().toLowerCase());
    const lowerKey = permissionKey.toLowerCase();
    const baseModule = lowerKey.split(/[._:]/)[0];

    // 1. Always allow infrastructure keys
    if (INFRASTRUCTURE_PREFIXES.some(prefix => baseModule.startsWith(prefix))) {
        return true;
    }

    // 2. Direct match (e.g. key or base module in license)
    if (companyLicense.includes(lowerKey) || companyLicense.includes(baseModule)) {
        return true;
    }

    // 3. Mapped canonical license check (e.g. cotizaciones -> quotes, clientes -> leads)
    const canonical = MODULE_LICENSE_MAP[baseModule];
    if (canonical && companyLicense.includes(canonical)) {
        return true;
    }

    // 4. Granular prefix checks for legacy or compound naming conventions
    if ((lowerKey.startsWith('followups') || lowerKey.startsWith('seguimiento')) &&
        (companyLicense.includes('leads') || companyLicense.includes('calendar') || companyLicense.includes('clientes'))) return true;
    if ((lowerKey.startsWith('calendar') || lowerKey.startsWith('calendario')) &&
        (companyLicense.includes('calendar') || companyLicense.includes('leads'))) return true;
    if (lowerKey.startsWith('cotizaciones.') && companyLicense.includes('quotes')) return true;
    if (lowerKey.startsWith('quotes.') && companyLicense.includes('quotes')) return true;
    if (lowerKey.startsWith('clientes.') && companyLicense.includes('leads')) return true;
    if (lowerKey.startsWith('mkt_') && companyLicense.includes('marketing')) return true;
    if ((lowerKey.startsWith('proyectos.') || lowerKey.startsWith('projects.')) &&
        (companyLicense.includes('proyectos') || companyLicense.includes('projects'))) return true;
    if ((lowerKey.startsWith('facturas.') || lowerKey.startsWith('invoices.')) &&
        (companyLicense.includes('invoices') || companyLicense.includes('facturas'))) return true;
    if ((lowerKey.startsWith('finanzas.') || lowerKey.startsWith('finance.')) &&
        (companyLicense.includes('finanzas') || companyLicense.includes('finance'))) return true;

    return false;
}
