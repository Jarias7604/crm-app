export const EARLY_UNTOUCHED_LEAD_STATUSES = [
    '',
    'Prospecto',
    'Llamada fría',
    'En Nutrición',
] as const;

export const PROTECTED_LEAD_STATUSES = ['Cliente', 'Cerrado'] as const;

export const DISCARD_LEAD_STATUSES = ['Perdido', 'Erróneo'] as const;

export const ALLOWED_LEAD_STATUSES = [
    'Prospecto',
    'Llamada fría',
    'En Nutrición',
    'Lead calificado',
    'En seguimiento',
    'Cotizado',
    'Negociación',
    'En Negociación',
    'Cerrado',
    'Cliente',
    'Perdido',
    'Erróneo',
] as const;

export function canAutoMarkLeadErroneo(status?: string | null): boolean {
    const clean = String(status || '').trim();
    return (EARLY_UNTOUCHED_LEAD_STATUSES as readonly string[]).includes(clean);
}

export function shouldPauseAiOnLeadStatus(status?: string | null): boolean {
    const clean = String(status || '').trim();
    return clean === 'Perdido' || clean === 'Erróneo' || clean === 'Cliente' || clean === 'Cerrado';
}

export function resolveCircleLeadStatus(input: {
    leadStatus?: string | null;
    metaLeadStatus?: string | null;
    isNonWaError: boolean;
    hasManualOverride?: boolean;
}): string | null {
    const lead = String(input.leadStatus || '').trim() || null;
    const meta = String(input.metaLeadStatus || '').trim() || null;

    // 1. Real lead stages (Perdido, En seguimiento, Cotizado, Cliente, Cerrado, etc.)
    // are the single source of truth and must NEVER be hijacked back to Erróneo.
    if (lead && !canAutoMarkLeadErroneo(lead)) {
        return lead;
    }

    // 2. If an agent explicitly overrode the stage from CRM/Chat, honor it.
    if (input.hasManualOverride) {
        return lead || meta;
    }

    // 3. Auto-detected WhatsApp delivery failure ("exists:false") on untouched early leads.
    if (input.isNonWaError) {
        return 'Erróneo';
    }

    return lead || meta;
}
