export type Role = 'super_admin' | 'company_admin' | 'collaborator';

export interface CustomRole {
    id: string;
    company_id: string | null;
    name: string;
    description: string | null;
    base_role: Role;
    is_system: boolean;
    created_at: string;
}
export type CompanyStatus = 'active' | 'trial' | 'suspended';
export type LicenseStatus = 'active' | 'trial' | 'suspended' | 'expired' | 'manual_hold';
export type LeadStatus =
    | 'Prospecto'
    | 'Lead calificado'
    | 'En seguimiento'
    | 'Negociación'
    | 'Cerrado'
    | 'Cliente'
    | 'Perdido'
    | 'Erróneo';
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
    avatar_url?: string | null;
    website?: string | null;
    birth_date?: string | null;
    address?: string | null;
    created_at: string;
    permissions?: {
        leads?: boolean;
        quotes?: boolean;
        calendar?: boolean;
        marketing?: boolean;
        chat?: boolean;
        [key: string]: boolean | undefined;
    };
    custom_role_id?: string;
}

export interface Company {
    id: string;
    name: string;
    trial_start_date: string | null;
    max_users?: number;
    is_active?: boolean;
    trial_end_date: string | null;
    logo_url?: string | null;
    website?: string | null;
    address?: string | null;
    phone?: string | null;
    tax_id?: string | null;
    terminos_condiciones?: string | null;
    license_status: LicenseStatus;
    created_at: string;
    features?: {
        marketing: boolean;
        chat: boolean;
    };
    date_format?: string;
    time_format?: string;
    timezone?: string;
    allowed_permissions?: string[];
}

export interface PermissionDefinition {
    id: string;
    category: string;
    permission_key: string;
    label: string;
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
    address?: string | null;
    document_path?: string | null;
    lost_reason_id?: string | null;
    lost_at_stage?: string | null;
    lost_notes?: string | null;
    lost_date?: string | null;
    internal_won_date?: string | null;
    industry?: string | null;
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
    profiles?: { email: string; full_name?: string | null; avatar_url?: string | null };
}

export interface LossReason {
    id: string;
    company_id: string | null;
    reason: string;
    is_active: boolean;
    display_order: number;
    created_at: string;
    updated_at?: string;
}

export interface Industry {
    id: string;
    company_id: string;
    name: string;
    is_active: boolean;
    display_order: number;
    created_at: string;
    updated_at?: string;
}

// Helper constants for UI
export const PRIORITY_CONFIG = {
    very_high: { label: 'Altísima', color: 'bg-red-500', textColor: 'text-white', icon: '🔥' },
    high: { label: 'Alta', color: 'bg-orange-500', textColor: 'text-white', icon: '⚡' },
    medium: { label: 'Media', color: 'bg-yellow-400', textColor: 'text-gray-900', icon: '💎' },
    low: { label: 'Baja', color: 'bg-gray-300', textColor: 'text-gray-700', icon: '🌊' },
};

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string; icon: string }> = {
    'Prospecto': { label: 'Prospecto', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: '🎯' },
    'Lead calificado': { label: 'Lead calificado', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: '⭐' },
    'En seguimiento': { label: 'En seguimiento', color: 'text-teal-700', bgColor: 'bg-teal-100', icon: '📞' },
    'Negociación': { label: 'Negociación', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: '💼' },
    'Cerrado': { label: 'Cerrado', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: '🔒' },
    'Cliente': { label: 'Cliente', color: 'text-green-700', bgColor: 'bg-green-100', icon: '✅' },
    'Perdido': { label: 'Perdido', color: 'text-red-700', bgColor: 'bg-red-100', icon: '❌' },
    'Erróneo': { label: 'Erróneo', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: '⚠️' },
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
