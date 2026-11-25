export const TICKET_MODULES = [
    'Inventario',
    'Facturación DTE',
    'Contabilidad',
    'Planilla',
    'Compras',
    'Accesos / Usuarios',
    'Reportes',
    'POS / Caja',
    'WhatsApp / CRM',
    'General',
] as const;

export type TicketModuleName = (typeof TICKET_MODULES)[number] | string;

export type TicketLifecycleKey = 'new' | 'open' | 'pending' | 'resolved' | 'closed';

export const TICKET_STATUS_META: Record<
    TicketLifecycleKey,
    { label: string; shortLabel: string; color: string; bg: string; darkColor: string }
> = {
    new: {
        label: 'Ticket Generado',
        shortLabel: 'Generado',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        darkColor: 'text-blue-300',
    },
    open: {
        label: 'En Proceso',
        shortLabel: 'En Proceso',
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        darkColor: 'text-indigo-300',
    },
    pending: {
        label: 'En Espera',
        shortLabel: 'En Espera',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        darkColor: 'text-amber-300',
    },
    resolved: {
        label: 'Completado',
        shortLabel: 'Completado',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        darkColor: 'text-emerald-300',
    },
    closed: {
        label: 'Cerrado',
        shortLabel: 'Cerrado',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        darkColor: 'text-slate-400',
    },
};

const LEADING_GREETING_RE =
    /^(?:(?:hola+|ola+|(?:muy\s+)?buen(?:os|as)?(?:\s+(?:d[ií]as?|tardes?|noches?))?|saludos|estimados?|disculpen?|perd[oó]n|qu[eé]\s+tal)(?:\s+(?:muchachos|chicos|equipo|soporte|amigos?|inges?|ingenieros?|lic(?:enciados?)?|paty|patricia|gerson|melvin|jimmy|estimados?|por\s+favor))?|(?:nos\s+pueden\s+ayudar(?:\s+por\s+favor)?|me\s+pueden\s+ayudar(?:\s+por\s+favor)?|por\s+favor))[\s,!¡¿?.:;\-–—]+/i;

export function cleanProblemHeadline(raw: string): string {
    let text = String(raw || '').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 4; i++) {
        const next = text.replace(LEADING_GREETING_RE, '').trim();
        if (next === text) break;
        text = next;
    }
    if (!text) return '';
    const capped = text.length > 75 ? `${text.slice(0, 72).trim()}...` : text;
    return capped.charAt(0).toUpperCase() + capped.slice(1);
}

export function buildStructuredTicketTitle(moduleName: string, problem: string): string {
    const cleanMod = String(moduleName || 'General').trim() || 'General';
    const cleanProb = cleanProblemHeadline(problem);
    if (!cleanProb) return cleanMod;
    return `${cleanMod} — ${cleanProb}`;
}

export function validateTicketProblemText(problem: string): { valid: boolean; reason?: string } {
    const clean = cleanProblemHeadline(problem);
    if (!clean || clean.length < 10) {
        return {
            valid: false,
            reason: 'Describe el problema concreto (mínimo 10 caracteres, ej. "No reduce inventario al facturar").',
        };
    }

    const normalized = clean
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[¡!¿?.,;:]+/g, ' ')
        .replace(/\b(?:por favor|de favor|muchachos|equipo|soporte|amigos?|gracias)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const vagueOnly =
        !normalized ||
        /^(hola+|buenos dias|buenas tardes|buenas noches|saludos|que tal|ayuda|necesito ayuda|me ayudan|pueden ayudar|ayudenme|una duda|una consulta|tengo una duda|tengo una consulta|consulta|duda|pregunta|ok|revisar)$/.test(
            normalized,
        );
    if (vagueOnly) {
        return {
            valid: false,
            reason: 'El título es demasiado vago. Indica el problema técnico puntual (ej. "No genera PDF de crédito fiscal").',
        };
    }

    return { valid: true };
}

export function shouldSendTicketStatusEmail(status: string): boolean {
    return status === 'new' || status === 'open' || status === 'resolved';
}

export function resolveTicketNotifyRecipients(input: {
    actorId?: string | null;
    createdBy?: string | null;
    assignedTo?: string | null;
    watchers?: Array<string | null | undefined> | null;
}): string[] {
    const set = new Set<string>();
    const actor = String(input.actorId || '').trim();
    const candidates = [input.createdBy, input.assignedTo, ...(Array.isArray(input.watchers) ? input.watchers : [])];
    for (const raw of candidates) {
        const id = String(raw || '').trim();
        if (id && id !== actor) {
            set.add(id);
        }
    }
    return Array.from(set);
}

export const CANONICAL_CRM_ORIGIN = 'https://ariascrm.com';

export function resolveCanonicalCrmOrigin(rawOrigin?: string | null): string {
    const clean = String(rawOrigin || '').trim().replace(/\/+$/, '');
    if (
        !clean ||
        !clean.startsWith('http') ||
        /vercel\.app/i.test(clean) ||
        /localhost|127\.0\.0\.1/i.test(clean)
    ) {
        return CANONICAL_CRM_ORIGIN;
    }
    return clean;
}

export function buildCanonicalTicketUrl(ticketId: string, rawOrigin?: string | null): string {
    const origin = resolveCanonicalCrmOrigin(rawOrigin);
    const id = encodeURIComponent(String(ticketId || '').trim());
    return id ? `${origin}/support/tickets?ticket=${id}` : `${origin}/support/tickets`;
}

export function sanitizePostLoginNextPath(rawNext?: string | null): string {
    const clean = String(rawNext || '').trim();
    if (
        !clean ||
        !clean.startsWith('/') ||
        clean.startsWith('//') ||
        clean.startsWith('/login') ||
        /^[a-z]+:/i.test(clean)
    ) {
        return '/dashboard';
    }
    return clean;
}

function normalizeSearchToken(value?: string | null): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function matchesTicketSearchQuery(
    ticket: {
        id: string;
        title?: string | null;
        description?: string | null;
        solution?: string | null;
        lead?: { name?: string | null } | null;
        lead_name?: string | null;
        category?: { name?: string | null } | null;
        metadata?: Record<string, any> | null;
        assigned_to?: string | null;
        created_by?: string | null;
    },
    rawQuery: string,
    agentNameMap?: Map<string, string>,
): boolean {
    const cleaned = normalizeSearchToken(rawQuery).replace(/^#+/, '').trim();
    if (!cleaned) return true;
    const tokens = cleaned
        .split(/\s+/)
        .map((tok) => tok.replace(/^#+/, ''))
        .filter(Boolean);
    if (tokens.length === 0) return true;

    const assignedName = ticket.assigned_to ? agentNameMap?.get(ticket.assigned_to) || '' : '';
    const creatorName = ticket.created_by ? agentNameMap?.get(ticket.created_by) || '' : '';

    const haystack = [
        ticket.id,
        ticket.id.slice(0, 8),
        ticket.title,
        ticket.lead?.name,
        ticket.lead_name,
        ticket.solution,
        ticket.description,
        ticket.category?.name,
        ticket.metadata?.module_name,
        ticket.metadata?.ai_category,
        assignedName,
        creatorName,
    ]
        .map((part) => normalizeSearchToken(part))
        .filter(Boolean)
        .join(' | ');

    return tokens.every((tok) => haystack.includes(tok));
}
