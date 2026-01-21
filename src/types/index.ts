export type Role = 'super_admin' | 'company_admin' | 'sales_agent';
export type CompanyStatus = 'active' | 'trial' | 'suspended';
export type LicenseStatus = 'active' | 'trial' | 'suspended' | 'expired' | 'manual_hold';
export type LeadStatus = 'Nuevo lead' | 'Potencial – En seguimiento' | 'Cliente 2025' | 'Cliente 2026' | 'Lead perdido' | 'Lead erróneo';
export type LeadPriority = 'very_high' | 'high' | 'medium' | 'low';
export type FollowUpActionType = 'call' | 'email' | 'meeting' | 'whatsapp' | 'other';
export type DateRange = 'today' | 'this_week' | 'this_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'all';

export interface Profile {
    id: string;
    email: string;
    role: Role;
    company_id: string;
    full_name: string | null;
    phone: string | null;
    status: CompanyStatus;
    is_active?: boolean;
    created_at: string;
}

export interface Company {
    id: string;
    name: string;
    trial_start_date: string | null;
    max_users?: number;
    is_active?: boolean;
    trial_end_date: string | null;
    license_status: LicenseStatus;
    created_at: string;
}

export interface Lead {
    id: string;
    company_id: string;
    assigned_to: string | null;
    name: string; // Contact Name
    company_name?: string; // Client Company Name
    email: string | null;
    phone: string | null;
    source: string | null;
    status: LeadStatus;
    priority: LeadPriority;
    value: number; // Potential value
    closing_amount: number; // Actual closing amount
    next_followup_date: string | null;
    next_followup_assignee: string | null;
    next_action_notes: string | null;
    document_path?: string | null;
    created_at: string;
}

export interface FollowUp {
    id: string;
    lead_id: string;
    user_id: string;
    date: string;
    notes: string | null;
    action_type: FollowUpActionType;
    created_at: string;
    profiles?: { email: string };
}

// Helper constants for UI
export const PRIORITY_CONFIG = {
    very_high: { label: 'Altísima', color: 'bg-red-500', textColor: 'text-white' },
    high: { label: 'Alta', color: 'bg-orange-500', textColor: 'text-white' },
    medium: { label: 'Media', color: 'bg-yellow-400', textColor: 'text-gray-900' },
    low: { label: 'Baja', color: 'bg-gray-300', textColor: 'text-gray-700' },
};

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
    'Nuevo lead': { label: 'Nuevo', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    'Potencial – En seguimiento': { label: 'En Seguimiento', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    'Cliente 2025': { label: 'Cliente 2025', color: 'text-green-700', bgColor: 'bg-green-100' },
    'Cliente 2026': { label: 'Cliente 2026', color: 'text-green-700', bgColor: 'bg-green-100' },
    'Lead perdido': { label: 'Perdido', color: 'text-red-700', bgColor: 'bg-red-100' },
    'Lead erróneo': { label: 'Erróneo', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const ACTION_TYPES = [
    { value: 'call', label: 'Llamada', icon: '📞' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'meeting', label: 'Reunión', icon: '🤝' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { value: 'other', label: 'Otro', icon: '📝' },
];

// Lead Source Configuration
export const SOURCE_CONFIG: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
    'redes_sociales': { label: 'Redes Sociales', icon: '📱', color: 'text-pink-700', bgColor: 'bg-pink-100' },
    'referidos': { label: 'Referidos', icon: '🤝', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    'visita_campo': { label: 'Visita Campo', icon: '🚗', color: 'text-green-700', bgColor: 'bg-green-100' },
    'sitio_web': { label: 'Sitio Web', icon: '🌐', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    'llamada_fria': { label: 'Llamada Fría', icon: '📞', color: 'text-orange-700', bgColor: 'bg-orange-100' },
    'evento': { label: 'Evento', icon: '🎪', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    'otro': { label: 'Otro', icon: '📋', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const SOURCE_OPTIONS = Object.entries(SOURCE_CONFIG).map(([value, config]) => ({
    value,
    ...config
}));

export const DATE_RANGE_OPTIONS: Record<DateRange, { label: string }> = {
    today: { label: 'Hoy' },
    this_week: { label: 'Esta semana' },
    this_month: { label: 'Este mes' },
    last_3_months: { label: 'Últimos 3 meses' },
    last_6_months: { label: 'Últimos 6 meses' },
    this_year: { label: 'Este año' },
    all: { label: 'Todo el tiempo' },
};
