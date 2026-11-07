// WhatsApp Soporte (+503 7971-8911) — who sees which conversations.
// The database enforces the same rules with RLS (wa_viewer_scopes / wa_ticket_visible);
// this file drives what the UI offers and enforces client-side scope & alert isolation.

export type WaScope = 'soporte' | 'por_clasificar' | 'lead' | 'interno' | 'spam';

export type WaAccessMode =
    | 'admin_all'
    | 'soporte_team'
    | 'soporte_assigned'
    | 'ventas_pool'
    | 'ventas_assigned'
    | 'both'
    | 'none';

export interface WaViewerScopes {
    all: boolean;                  // Admin: everything (Soporte + all Leads + Equipo + Spam)
    soporte: boolean;              // Tech: client chats & support groups
    soporteAssignedOnly: boolean;  // Tech restricted to only support tickets assigned to them
    leads: boolean;                // Sales: own leads (+ unclassified pool if leadsPool is true)
    leadsPool: boolean;            // Sales: can see & claim 'por_clasificar' new leads
    leadsAssignedOnly: boolean;    // Sales restricted to only leads assigned to them (no pool)
    any: boolean;
    mode: WaAccessMode;
}

export const WA_ACCESS_MODE_OPTIONS: {
    mode: WaAccessMode;
    label: string;
    shortLabel: string;
    badgeColor: string;
    description: string;
}[] = [
    {
        mode: 'admin_all',
        label: '🛡️ Administrador (Ve Todo)',
        shortLabel: 'Admin · Todo',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: 'Ve Soporte, Leads nuevos, todos los Leads de todos los vendedores, Equipo y Spam.',
    },
    {
        mode: 'soporte_team',
        label: '🔧 Técnico — Equipo Soporte',
        shortLabel: 'Técnico · Soporte',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        description: 'Ve todos los grupos y clientes de Soporte para apoyarse en equipo. 0% acceso a Ventas/Leads.',
    },
    {
        mode: 'soporte_assigned',
        label: '🔧🔒 Técnico — Solo Asignados',
        shortLabel: 'Técnico · Solo Míos',
        badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        description: 'Ve únicamente los chats de Soporte asignados a su nombre. 0% acceso a Ventas/Leads.',
    },
    {
        mode: 'ventas_pool',
        label: '💼 Vendedor — Cola Nueva + Mis Leads',
        shortLabel: 'Ventas · Cola + Míos',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Ve "Leads nuevos · por tomar" para cotizar y únicamente sus propios Leads. No ve Leads de otros ni Soporte.',
    },
    {
        mode: 'ventas_assigned',
        label: '💼🔒 Vendedor — Solo Leads Asignados',
        shortLabel: 'Ventas · Solo Míos',
        badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
        description: 'Solo ve los Leads que el Admin le asigne directamente. No ve la bolsa común ni Soporte.',
    },
    {
        mode: 'none',
        label: '🚫 Sin acceso a WhatsApp',
        shortLabel: 'Sin acceso',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
        description: 'Bloquea completamente el módulo de Chat WhatsApp para este usuario.',
    },
];

interface ProfileLike {
    role?: string | null;
    is_platform_owner?: boolean | null;
    permissions?: Record<string, any> | null;
}

export function buildScopesFromMode(mode: WaAccessMode): WaViewerScopes {
    switch (mode) {
        case 'admin_all':
            return {
                all: true,
                soporte: true,
                soporteAssignedOnly: false,
                leads: true,
                leadsPool: true,
                leadsAssignedOnly: false,
                any: true,
                mode: 'admin_all',
            };
        case 'soporte_team':
            return {
                all: false,
                soporte: true,
                soporteAssignedOnly: false,
                leads: false,
                leadsPool: false,
                leadsAssignedOnly: false,
                any: true,
                mode: 'soporte_team',
            };
        case 'soporte_assigned':
            return {
                all: false,
                soporte: true,
                soporteAssignedOnly: true,
                leads: false,
                leadsPool: false,
                leadsAssignedOnly: false,
                any: true,
                mode: 'soporte_assigned',
            };
        case 'ventas_pool':
            return {
                all: false,
                soporte: false,
                soporteAssignedOnly: false,
                leads: true,
                leadsPool: true,
                leadsAssignedOnly: false,
                any: true,
                mode: 'ventas_pool',
            };
        case 'ventas_assigned':
            return {
                all: false,
                soporte: false,
                soporteAssignedOnly: false,
                leads: true,
                leadsPool: false,
                leadsAssignedOnly: true,
                any: true,
                mode: 'ventas_assigned',
            };
        case 'both':
            return {
                all: false,
                soporte: true,
                soporteAssignedOnly: false,
                leads: true,
                leadsPool: true,
                leadsAssignedOnly: false,
                any: true,
                mode: 'both',
            };
        case 'none':
        default:
            return {
                all: false,
                soporte: false,
                soporteAssignedOnly: false,
                leads: false,
                leadsPool: false,
                leadsAssignedOnly: false,
                any: false,
                mode: 'none',
            };
    }
}

export function getWaViewerScopes(
    profile: ProfileLike | null | undefined,
    previewMode?: WaAccessMode | null
): WaViewerScopes {
    if (!profile) return buildScopesFromMode('none');
    if (previewMode) return buildScopesFromMode(previewMode);

    // Platform owners and company admins see everything by default.
    const isAdmin =
        profile.is_platform_owner === true ||
        profile.role === 'super_admin' ||
        profile.role === 'company_admin';
    if (isAdmin) return buildScopesFromMode('admin_all');

    const p = (profile.permissions || {}) as Record<string, any>;
    const explicitMode = String(p.wa_access_mode || '') as WaAccessMode;
    if (
        explicitMode === 'admin_all' ||
        explicitMode === 'soporte_team' ||
        explicitMode === 'soporte_assigned' ||
        explicitMode === 'ventas_pool' ||
        explicitMode === 'ventas_assigned' ||
        explicitMode === 'both' ||
        explicitMode === 'none'
    ) {
        return buildScopesFromMode(explicitMode);
    }

    const all = p.wa_chat_all === true;
    if (all) return buildScopesFromMode('admin_all');

    const soporte = p.wa_chat_soporte === true;
    const leads = p.wa_chat_leads === true;
    const soporteAssignedOnly = Boolean(p.wa_soporte_assigned_only);
    const leadsAssignedOnly = Boolean(p.wa_leads_assigned_only);

    if (soporte && leads) return buildScopesFromMode('both');
    if (soporte) return buildScopesFromMode(soporteAssignedOnly ? 'soporte_assigned' : 'soporte_team');
    if (leads) return buildScopesFromMode(leadsAssignedOnly ? 'ventas_assigned' : 'ventas_pool');

    return buildScopesFromMode('none');
}


interface TicketLike {
    metadata?: Record<string, unknown> | null;
    title?: string | null;
}

export function isWhatsappTicket(t: TicketLike): boolean {
    const m = (t.metadata || {}) as Record<string, unknown>;
    return m.source === 'whatsapp_evolution' || Boolean(m.whatsapp_jid) || Boolean(m.whatsapp_phone);
}

export function getWaScope(t: TicketLike): WaScope {
    const m = (t.metadata || {}) as Record<string, unknown>;
    const s = String(m.wa_scope || '');
    if (s === 'soporte' || s === 'por_clasificar' || s === 'lead' || s === 'interno' || s === 'spam') return s;
    return 'soporte';
}

// A real support ticket: every non-WhatsApp ticket, and WhatsApp chats of clients.
// Lead / unclassified / team / spam chats are conversations, not support work.
export function isSupportTicket(t: TicketLike): boolean {
    return !isWhatsappTicket(t) || getWaScope(t) === 'soporte';
}

export const WA_SCOPE_LABELS: Record<WaScope, string> = {
    soporte: 'Soporte',
    por_clasificar: 'Lead nuevo (por tomar)',
    lead: 'Lead',
    interno: 'Equipo',
    spam: 'Spam',
};
