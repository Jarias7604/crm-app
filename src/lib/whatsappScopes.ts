// WhatsApp Soporte (+503 7971-8911) — who sees which conversations.
// The database enforces the same rules with RLS (wa_viewer_scopes / wa_ticket_visible);
// this file only drives what the UI offers.

export type WaScope = 'soporte' | 'por_clasificar' | 'lead' | 'interno' | 'spam';

export interface WaViewerScopes {
    all: boolean;      // Admin: everything
    soporte: boolean;  // Tech: client chats & support groups
    leads: boolean;    // Sales: unclassified numbers + own leads
    any: boolean;
}

interface ProfileLike {
    role?: string | null;
    is_platform_owner?: boolean | null;
    permissions?: Record<string, boolean | undefined> | null;
}

export function getWaViewerScopes(profile: ProfileLike | null | undefined): WaViewerScopes {
    if (!profile) return { all: false, soporte: false, leads: false, any: false };
    // Platform owners see everything regardless of the role they are simulating.
    const isAdmin = profile.is_platform_owner === true || profile.role === 'super_admin' || profile.role === 'company_admin';
    const p = profile.permissions || {};
    const all = isAdmin || p.wa_chat_all === true;
    const soporte = all || p.wa_chat_soporte === true;
    const leads = all || p.wa_chat_leads === true;
    return { all, soporte, leads, any: all || soporte || leads };
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
