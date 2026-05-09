/**
 * Lead Scoring AI Service
 * 
 * Calculates an intelligent score (0-100) for each lead based on multiple
 * data signals. This replaces what HubSpot charges $450+/mo for.
 * 
 * The score determines the lead's "temperature":
 *   🔴 HOT   (75-100) → Call immediately, high conversion probability
 *   🟡 WARM  (40-74)  → Good prospect, needs nurturing
 *   🔵 COLD  (0-39)   → Low priority, passive follow-up
 * 
 * Scoring factors:
 *   - Deal value (higher = more important)
 *   - Contact completeness (email + phone + company = serious buyer)
 *   - Pipeline stage advancement (further along = hotter)
 *   - Follow-up engagement (more interactions = more interested)
 *   - Email domain quality (corporate vs free email)
 *   - Recency (fresh leads score higher)
 *   - Source quality (referrals > cold calls)
 */

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { Lead, LeadPriority } from '../types';

// ─── Score Thresholds ────────────────────────────────────────────────────────
export const SCORE_THRESHOLDS = {
    HOT:  75,
    WARM: 40,
    COLD: 0,
} as const;

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface ScoreBreakdown {
    total: number;
    temperature: LeadTemperature;
    factors: {
        name: string;
        points: number;
        maxPoints: number;
        reason: string;
    }[];
}

// ─── Corporate Email Domains (free = low value) ──────────────────────────────
const FREE_EMAIL_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com',
    'ymail.com', 'gmx.com', 'inbox.com', 'fastmail.com',
]);

// ─── Stage Weights (further in pipeline = hotter) ────────────────────────────
const STAGE_SCORES: Record<string, number> = {
    'Prospecto':        5,
    'Llamada fría':     10,
    'En Nutrición':     15,
    'Lead calificado':  25,
    'En seguimiento':   30,
    'Negociación':      40,
    'Cerrado':          50,
    'Cliente':          50,
    'Perdido':          0,
    'Erróneo':          0,
};

// ─── Source Quality Weights ──────────────────────────────────────────────────
const SOURCE_SCORES: Record<string, number> = {
    'referidos':        15,
    'sitio_web':        12,
    'redes_sociales':   10,
    'evento':           10,
    'visita_campo':     8,
    'llamada_fria':     5,
    'otro':             3,
    // Legacy/production values (case-insensitive match)
    'Referido':         15,
    'Web':              12,
    'LinkedIn':         10,
    'Facebook Ads':     10,
    'Google Ads':       12,
    'Email':            8,
};

// ─── Main Scoring Engine ─────────────────────────────────────────────────────

export function calculateLeadScore(lead: Partial<Lead>): ScoreBreakdown {
    const factors: ScoreBreakdown['factors'] = [];
    let total = 0;

    // ── Factor 1: Deal Value (0-20 points) ──────────────────────────────────
    const value = lead.value || lead.closing_amount || 0;
    let valuePoints = 0;
    if (value >= 10000) valuePoints = 20;
    else if (value >= 5000) valuePoints = 15;
    else if (value >= 2000) valuePoints = 10;
    else if (value >= 500) valuePoints = 5;
    else valuePoints = 2;

    factors.push({
        name: 'Valor del Deal',
        points: valuePoints,
        maxPoints: 20,
        reason: value > 0 ? `$${value.toLocaleString()}` : 'Sin valor asignado',
    });
    total += valuePoints;

    // ── Factor 2: Contact Completeness (0-15 points) ────────────────────────
    let contactPoints = 0;
    const hasEmail = !!lead.email && lead.email.trim().length > 0;
    const hasPhone = !!lead.phone && lead.phone.trim().length > 0;
    const hasCompany = !!lead.company_name && lead.company_name.trim().length > 0;
    const hasAddress = !!lead.address && lead.address.trim().length > 0;

    if (hasEmail) contactPoints += 4;
    if (hasPhone) contactPoints += 4;
    if (hasCompany) contactPoints += 5;
    if (hasAddress) contactPoints += 2;

    const completeParts = [hasEmail && 'email', hasPhone && 'tel', hasCompany && 'empresa', hasAddress && 'dirección'].filter(Boolean);
    factors.push({
        name: 'Datos de Contacto',
        points: contactPoints,
        maxPoints: 15,
        reason: completeParts.length > 0 ? `Tiene: ${completeParts.join(', ')}` : 'Sin datos de contacto',
    });
    total += contactPoints;

    // ── Factor 3: Email Domain Quality (0-10 points) ────────────────────────
    let emailPoints = 0;
    if (hasEmail) {
        const domain = lead.email!.split('@')[1]?.toLowerCase();
        if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
            emailPoints = 10; // Corporate email = serious buyer
        } else {
            emailPoints = 3;  // Free email = casual interest
        }
    }
    factors.push({
        name: 'Dominio Email',
        points: emailPoints,
        maxPoints: 10,
        reason: emailPoints >= 10 ? 'Email corporativo (comprador serio)' : emailPoints > 0 ? 'Email gratuito' : 'Sin email',
    });
    total += emailPoints;

    // ── Factor 4: Pipeline Stage (0-20 points) ──────────────────────────────
    const stageKey = lead.status || 'Prospecto';
    // Normalize: try exact match first, then case-insensitive
    let stagePoints = STAGE_SCORES[stageKey];
    if (stagePoints === undefined) {
        const lower = stageKey.toLowerCase();
        const found = Object.entries(STAGE_SCORES).find(([k]) => k.toLowerCase() === lower);
        stagePoints = found ? found[1] : 5;
    }
    // Cap at 20 (Negociación/Cerrado get the most)
    stagePoints = Math.min(stagePoints, 20);

    factors.push({
        name: 'Etapa del Pipeline',
        points: stagePoints,
        maxPoints: 20,
        reason: `Estado: ${stageKey}`,
    });
    total += stagePoints;

    // ── Factor 5: Follow-up Engagement (0-15 points) ────────────────────────
    const contactCount = lead.contact_count || 0;
    let engagementPoints = 0;
    if (contactCount >= 5) engagementPoints = 15;
    else if (contactCount >= 3) engagementPoints = 10;
    else if (contactCount >= 1) engagementPoints = 5;

    factors.push({
        name: 'Engagement (Seguimientos)',
        points: engagementPoints,
        maxPoints: 15,
        reason: contactCount > 0 ? `${contactCount} interacciones registradas` : 'Sin seguimientos',
    });
    total += engagementPoints;

    // ── Factor 6: Source Quality (0-15 points) ──────────────────────────────
    const source = lead.source || '';
    let sourcePoints = SOURCE_SCORES[source] || 3;
    sourcePoints = Math.min(sourcePoints, 15);

    factors.push({
        name: 'Fuente de Origen',
        points: sourcePoints,
        maxPoints: 15,
        reason: source ? `Fuente: ${source}` : 'Sin fuente registrada',
    });
    total += sourcePoints;

    // ── Factor 7: Recency Bonus (0-5 points) ────────────────────────────────
    let recencyPoints = 0;
    if (lead.created_at) {
        const daysSinceCreation = Math.floor(
            (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCreation <= 3) recencyPoints = 5;
        else if (daysSinceCreation <= 7) recencyPoints = 4;
        else if (daysSinceCreation <= 14) recencyPoints = 3;
        else if (daysSinceCreation <= 30) recencyPoints = 2;
        else recencyPoints = 1;
    }

    factors.push({
        name: 'Frescura',
        points: recencyPoints,
        maxPoints: 5,
        reason: recencyPoints >= 4 ? 'Lead reciente (< 7 días)' : recencyPoints >= 2 ? 'Lead de este mes' : 'Lead antiguo',
    });
    total += recencyPoints;

    // ── Clamp total to 0-100 ────────────────────────────────────────────────
    total = Math.min(100, Math.max(0, total));

    // ── Determine temperature ───────────────────────────────────────────────
    let temperature: LeadTemperature;
    if (total >= SCORE_THRESHOLDS.HOT) temperature = 'hot';
    else if (total >= SCORE_THRESHOLDS.WARM) temperature = 'warm';
    else temperature = 'cold';

    return { total, temperature, factors };
}

// ─── Map score to priority ───────────────────────────────────────────────────

export function scoreToPriority(score: number): LeadPriority {
    if (score >= 80) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

// ─── Temperature UI Configuration ────────────────────────────────────────────

export const TEMPERATURE_CONFIG: Record<LeadTemperature, {
    label: string;
    emoji: string;
    color: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
}> = {
    hot: {
        label: 'Caliente',
        emoji: '🔥',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        glowColor: 'shadow-red-100',
    },
    warm: {
        label: 'Tibio',
        emoji: '☀️',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        glowColor: 'shadow-amber-100',
    },
    cold: {
        label: 'Frío',
        emoji: '❄️',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        glowColor: 'shadow-blue-100',
    },
};

// ─── Persist Score to Database ───────────────────────────────────────────────

export async function persistLeadScore(leadId: string, score: number): Promise<void> {
    try {
        const priority = scoreToPriority(score);
        // Only update priority — this column exists in ALL environments
        const { error } = await supabase
            .from('leads')
            .update({ priority })
            .eq('id', leadId);

        if (error) {
            logger.warn('[LeadScoring] Failed to persist priority', { leadId, error: error.message });
        }

        // Try to persist ai_score too (column may not exist in production)
        // This is fire-and-forget — if it fails, no problem
        try {
            await supabase
                .from('leads')
                .update({ ai_score: score } as any)
                .eq('id', leadId);
        } catch {
            // silently ignore — ai_score column may not exist
        }
    } catch (err) {
        // Never throw — scoring failures must never break lead operations
        logger.warn('[LeadScoring] Exception persisting score', { leadId, err });
    }
}

// ─── Batch Score All Leads (for initial migration / admin action) ────────────

export async function scoreAllLeads(companyId?: string): Promise<{ scored: number; errors: number }> {
    let query = supabase
        .from('leads')
        .select('id, name, company_name, email, phone, status, priority, value, closing_amount, source, contact_count, address, created_at');

    if (companyId) {
        query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error || !data) {
        logger.error('[LeadScoring] Failed to fetch leads for batch scoring', error);
        return { scored: 0, errors: 1 };
    }

    let scored = 0;
    let errors = 0;

    for (const lead of data) {
        try {
            const result = calculateLeadScore(lead as Partial<Lead>);
            await persistLeadScore(lead.id, result.total);
            scored++;
        } catch {
            errors++;
        }
    }

    logger.info('[LeadScoring] Batch scoring complete', { scored, errors, total: data.length });
    return { scored, errors };
}
