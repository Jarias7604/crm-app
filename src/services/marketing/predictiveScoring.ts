/**
 * Oracle — Predictive Lead Scoring Engine
 * 
 * Multi-factor scoring engine that predicts the probability of closing a lead.
 * Uses ONLY data already in the database — no external AI calls needed.
 * 
 * SCORING FACTORS (all derived from existing CRM data):
 *   1. Engagement Velocity   — How fast does the lead respond?
 *   2. Pipeline Momentum     — How quickly is the lead moving through stages?
 *   3. Data Completeness     — How much do we know about this lead?
 *   4. Interaction Quality   — Sentiment, objections, follow-up engagement
 *   5. Behavioral Signals    — Contact frequency, channel preference, quote interactions
 *   6. Temporal Patterns     — Day of week, time of day, recency of last interaction
 * 
 * ZERO COST — Runs entirely on client-side logic + existing DB queries.
 * NO external API calls. No OpenAI. No third-party dependencies.
 */

import { supabase } from '../supabase';
import { auditTrailService } from './auditTrail';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictionResult {
    leadId: string;
    leadName: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    status: string;

    // Oracle Scores
    closeProb: number;            // 0-100 probability of closing
    confidenceLevel: 'high' | 'medium' | 'low';
    predictedAction: PredictedAction;
    predictedCloseDate: string | null; // ISO date estimate
    trend: 'improving' | 'stable' | 'declining';

    // Factor Breakdown (for transparency / audit)
    factors: {
        engagement: number;       // 0-25
        momentum: number;         // 0-25
        dataQuality: number;      // 0-15
        interactionQuality: number; // 0-20
        behavioral: number;       // 0-10
        temporal: number;         // 0-5
    };

    // From lead_ai_memory (if exists)
    sentimentScore: number;
    followupCount: number;
    lastObjection: string | null;
    conversationStage: string | null;
}

export type PredictedAction =
    | 'close_now'          // High probability — push for close immediately
    | 'send_offer'         // Ready for a tailored offer
    | 'nurture'            // Needs more touchpoints before ready
    | 'reactivate'         // Gone cold — needs reactivation campaign
    | 'escalate_human'     // Complex situation — needs human judgment
    | 'enrich_data'        // Not enough data to predict — needs enrichment
    | 'wait';              // Timing isn't right — wait and monitor

export const PREDICTED_ACTION_CONFIG: Record<PredictedAction, {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
}> = {
    close_now:      { label: 'Cerrar ahora',        icon: '🏆', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', description: 'Alta probabilidad de cierre. Contactar de inmediato.' },
    send_offer:     { label: 'Enviar oferta',        icon: '📋', color: 'text-blue-700',    bgColor: 'bg-blue-50 border-blue-200',       description: 'Listo para recibir una oferta personalizada.' },
    nurture:        { label: 'Nutrir',               icon: '🌱', color: 'text-violet-700',  bgColor: 'bg-violet-50 border-violet-200',   description: 'Necesita más puntos de contacto antes de estar listo.' },
    reactivate:     { label: 'Reactivar',            icon: '🔥', color: 'text-orange-700',  bgColor: 'bg-orange-50 border-orange-200',   description: 'Lead frío. Necesita campaña de reactivación.' },
    escalate_human: { label: 'Escalar a humano',     icon: '🙋', color: 'text-red-700',     bgColor: 'bg-red-50 border-red-200',         description: 'Situación compleja. Requiere juicio humano.' },
    enrich_data:    { label: 'Enriquecer datos',     icon: '📊', color: 'text-cyan-700',    bgColor: 'bg-cyan-50 border-cyan-200',       description: 'Datos insuficientes para predecir. Necesita enriquecimiento.' },
    wait:           { label: 'Esperar',              icon: '⏳', color: 'text-gray-600',    bgColor: 'bg-gray-50 border-gray-200',       description: 'El timing no es óptimo. Monitorear sin presionar.' },
};

// ─── Score Calculations ───────────────────────────────────────────────────────

function calcEngagement(lead: any, memory: any): number {
    let score = 0;
    const contactCount = lead.contact_count || 0;
    const hasMemory = !!memory;

    // Responded to messages (has memory means Sofía interacted)
    if (hasMemory) score += 8;

    // Multiple interactions
    if (contactCount >= 1) score += 3;
    if (contactCount >= 3) score += 4;
    if (contactCount >= 5) score += 3;

    // Has active follow-up (engaged enough to schedule)
    if (lead.next_followup_date) score += 4;

    // Has been quoted (serious interest)
    if (memory?.conversation_stage === 'cotizado' || memory?.conversation_stage === 'negociacion') score += 3;

    return Math.min(score, 25);
}

function calcMomentum(lead: any, memory: any): number {
    let score = 0;
    const daysSinceCreation = Math.floor(
        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Stage progression speed
    const stage = memory?.conversation_stage;
    const stageWeights: Record<string, number> = {
        'nuevo': 2, 'calificado': 6, 'cotizado': 12,
        'seguimiento': 8, 'negociacion': 18, 'cerrado': 25,
    };
    score += stageWeights[stage || 'nuevo'] || 2;

    // Fast progression bonus (advanced stage in few days)
    if (daysSinceCreation < 7 && (stage === 'cotizado' || stage === 'negociacion')) {
        score += 5;
    }

    // Recent activity (last contact within 3 days)
    const lastContact = lead.last_follow_up_at
        ? (Date.now() - new Date(lead.last_follow_up_at).getTime()) / (1000 * 60 * 60 * 24)
        : daysSinceCreation;
    if (lastContact < 3) score += 3;
    else if (lastContact > 14) score -= 5;

    return Math.max(0, Math.min(score, 25));
}

function calcDataQuality(lead: any): number {
    let score = 0;
    if (lead.name) score += 2;
    if (lead.email) score += 3;
    if (lead.phone) score += 3;
    if (lead.company_name) score += 2;
    if (lead.value > 0 || lead.closing_amount > 0) score += 3;
    if (lead.source) score += 1;
    if (lead.industry_id) score += 1;
    return Math.min(score, 15);
}

function calcInteractionQuality(lead: any, memory: any): number {
    let score = 10; // Start at neutral

    if (!memory) return 5; // No memory = can't assess quality

    // Sentiment score (0-100, 50 is neutral)
    const sentiment = memory.sentiment_score || 50;
    if (sentiment >= 70) score += 5;
    else if (sentiment >= 50) score += 2;
    else if (sentiment < 30) score -= 5;

    // Objection handling
    if (memory.last_objection === 'precio') score -= 2; // Price = harder close
    if (memory.last_objection === 'confianza') score -= 3; // Trust = harder
    if (memory.last_objection === null && memory.followup_count > 0) score += 3; // No objection = good

    // Follow-up engagement
    if (memory.followup_count >= 2 && !memory.followup_paused) score += 2;
    if (memory.followup_paused) score -= 3; // Paused = potential lost interest

    return Math.max(0, Math.min(score, 20));
}

function calcBehavioral(lead: any): number {
    let score = 0;

    // High-value deal
    const value = lead.value || lead.closing_amount || 0;
    if (value > 0) score += 3;
    if (value > 1000) score += 2;
    if (value > 5000) score += 2;

    // Source quality (referred leads close better)
    const source = (lead.source || '').toLowerCase();
    if (source.includes('referido') || source.includes('referral')) score += 3;
    if (source.includes('web') || source.includes('landing')) score += 1;

    return Math.min(score, 10);
}

function calcTemporal(lead: any): number {
    let score = 0;
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Business hours bonus (leads contacted during business hours convert better)
    if (hour >= 8 && hour <= 18) score += 2;

    // Weekday bonus
    if (day >= 1 && day <= 5) score += 1;

    // Recency of lead creation (fresh leads convert better)
    const daysOld = Math.floor(
        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysOld < 3) score += 2;
    else if (daysOld < 7) score += 1;

    return Math.min(score, 5);
}

function determineTrend(memory: any, lead: any): PredictionResult['trend'] {
    if (!memory) return 'stable';

    const sentiment = memory.sentiment_score || 50;
    const followups = memory.followup_count || 0;
    const paused = memory.followup_paused;

    if (paused || sentiment < 30) return 'declining';
    if (sentiment >= 60 && followups >= 2) return 'improving';
    return 'stable';
}

function determineAction(closeProb: number, memory: any, lead: any, dataQuality: number): PredictedAction {
    // Not enough data
    if (dataQuality < 5) return 'enrich_data';

    // Lead already closed/won
    if (lead.status === 'Cliente' || lead.status === 'Ganado') return 'wait';

    // High probability → push for close
    if (closeProb >= 75) return 'close_now';

    // Good probability + has been quoted → send offer
    if (closeProb >= 55 && memory?.conversation_stage === 'cotizado') return 'send_offer';

    // Medium probability → continue nurturing
    if (closeProb >= 35) return 'nurture';

    // Lost lead with some probability → reactivate
    if (lead.status === 'Perdido' && closeProb >= 20) return 'reactivate';

    // Complex objection → human judgment
    if (memory?.last_objection && closeProb < 30) return 'escalate_human';

    // Low probability, lead is stale
    if (closeProb < 20) return 'wait';

    return 'nurture';
}

function estimateCloseDate(closeProb: number, lead: any): string | null {
    if (closeProb < 20) return null;

    const now = new Date();
    // Higher probability = closer estimated close date
    if (closeProb >= 80) {
        now.setDate(now.getDate() + 7);
    } else if (closeProb >= 60) {
        now.setDate(now.getDate() + 14);
    } else if (closeProb >= 40) {
        now.setDate(now.getDate() + 30);
    } else {
        now.setDate(now.getDate() + 60);
    }
    return now.toISOString().split('T')[0];
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export const predictiveScoringService = {

    /**
     * Score a single lead — returns full prediction result
     */
    async scoreLead(leadId: string, companyId: string): Promise<PredictionResult | null> {
        // 1. Get lead data (select * to avoid column mismatch issues)
        const { data: lead, error: leadErr } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadErr || !lead) return null;

        // 2. Get memory (may not exist)
        const { data: memory } = await supabase
            .from('lead_ai_memory')
            .select('*')
            .eq('lead_id', leadId)
            .maybeSingle();

        // 3. Calculate each factor
        const factors = {
            engagement: calcEngagement(lead, memory),
            momentum: calcMomentum(lead, memory),
            dataQuality: calcDataQuality(lead),
            interactionQuality: calcInteractionQuality(lead, memory),
            behavioral: calcBehavioral(lead),
            temporal: calcTemporal(lead),
        };

        // 4. Total score = sum of all factors (max 100)
        const closeProb = Math.min(100,
            factors.engagement + factors.momentum + factors.dataQuality +
            factors.interactionQuality + factors.behavioral + factors.temporal
        );

        // 5. Confidence level based on data completeness
        const confidence: PredictionResult['confidenceLevel'] =
            factors.dataQuality >= 12 ? 'high' :
            factors.dataQuality >= 7 ? 'medium' : 'low';

        // 6. Determine recommended action
        const predictedAction = determineAction(closeProb, memory, lead, factors.dataQuality);

        // 7. Estimate close date
        const predictedCloseDate = estimateCloseDate(closeProb, lead);

        // 8. Determine trend
        const trend = determineTrend(memory, lead);

        const result: PredictionResult = {
            leadId: lead.id,
            leadName: lead.name,
            companyName: lead.company_name,
            phone: lead.phone,
            email: lead.email,
            status: lead.status,
            closeProb,
            confidenceLevel: confidence,
            predictedAction,
            predictedCloseDate,
            trend,
            factors,
            sentimentScore: memory?.sentiment_score || 50,
            followupCount: memory?.followup_count || 0,
            lastObjection: memory?.last_objection || null,
            conversationStage: memory?.conversation_stage || null,
        };

        // 9. Log to audit trail (fire-and-forget)
        auditTrailService.logDecision({
            companyId,
            leadId,
            agentName: 'oracle',
            decisionType: 'lead_scored',
            reasoning: `Oracle calculó probabilidad de cierre: ${closeProb}%. Acción recomendada: ${PREDICTED_ACTION_CONFIG[predictedAction].label}. Tendencia: ${trend}.`,
            contextSnapshot: { factors, closeProb, predictedAction, trend },
            confidence: factors.dataQuality >= 12 ? 85 : factors.dataQuality >= 7 ? 60 : 35,
        });

        return result;
    },

    /**
     * Score all leads for a company — for the predictive board
     */
    async scoreCompanyLeads(companyId: string, options: {
        statuses?: string[];
        minScore?: number;
        limit?: number;
        sortBy?: 'score' | 'trend' | 'value';
    } = {}): Promise<PredictionResult[]> {
        const {
            statuses = ['Prospecto', 'En seguimiento', 'En Nutrición', 'Calificado', 'Cotizado', 'Negociación', 'Sin respuesta'],
            limit = 50,
        } = options;

        // Get all leads matching filter
        const { data: leads, error } = await supabase
            .from('leads')
            .select('id, status')
            .eq('company_id', companyId)
            .limit(limit);

        if (error || !leads?.length) return [];

        // Score each lead in parallel (batched for performance)
        const results: PredictionResult[] = [];
        const BATCH_SIZE = 10;

        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
            const batch = leads.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(l => this.scoreLead(l.id, companyId))
            );
            results.push(...batchResults.filter(Boolean) as PredictionResult[]);
        }

        // Sort by close probability (highest first)
        results.sort((a, b) => b.closeProb - a.closeProb);

        // Apply min score filter
        if (options.minScore) {
            return results.filter(r => r.closeProb >= options.minScore!);
        }

        return results;
    },

    /**
     * Get top N "hot leads" — leads most likely to close
     */
    async getHotLeads(companyId: string, top: number = 5): Promise<PredictionResult[]> {
        const all = await this.scoreCompanyLeads(companyId, { limit: 30 });
        return all
            .filter(r => r.closeProb >= 40 && r.status !== 'Perdido')
            .slice(0, top);
    },

    /**
     * Get leads that need attention (declining trend + medium+ probability)
     */
    async getAtRiskLeads(companyId: string): Promise<PredictionResult[]> {
        const all = await this.scoreCompanyLeads(companyId, { limit: 50 });
        return all.filter(r =>
            r.trend === 'declining' && r.closeProb >= 25
        );
    },

    /**
     * Get summary stats for the dashboard
     */
    async getPredictionSummary(companyId: string): Promise<{
        hotLeads: number;
        avgCloseProb: number;
        atRisk: number;
        readyToClose: number;
        needsNurture: number;
        projectedCloses: number;
    }> {
        const all = await this.scoreCompanyLeads(companyId, { limit: 100 });
        if (all.length === 0) {
            return { hotLeads: 0, avgCloseProb: 0, atRisk: 0, readyToClose: 0, needsNurture: 0, projectedCloses: 0 };
        }

        const avgCloseProb = Math.round(all.reduce((s, r) => s + r.closeProb, 0) / all.length);

        return {
            hotLeads: all.filter(r => r.closeProb >= 70).length,
            avgCloseProb,
            atRisk: all.filter(r => r.trend === 'declining').length,
            readyToClose: all.filter(r => r.predictedAction === 'close_now').length,
            needsNurture: all.filter(r => r.predictedAction === 'nurture').length,
            projectedCloses: all.filter(r => r.closeProb >= 60).length,
        };
    },
};
