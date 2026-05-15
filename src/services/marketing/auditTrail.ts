/**
 * AI Audit Trail — Decision Log & Transparency Layer
 * 
 * Registers EVERY autonomous decision made by any AI agent (Sofía, Oracle, Maya, Atlas, CallBot).
 * Provides human-readable explanations for each action taken.
 * 
 * PRINCIPLES:
 *   → Append-only: Nobody can edit or delete audit entries
 *   → Human-readable: Reasoning in Spanish, not code
 *   → Multi-agent: Each entry tagged with agent name
 *   → Fire-and-forget: Never blocks the critical path
 * 
 * TABLE: ai_audit_trail
 *   - company_id, lead_id, agent_name
 *   - decision_type, reasoning, context_snapshot
 *   - outcome, confidence, created_at
 */

import { supabase } from '../supabase';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentName = 'sofia' | 'oracle' | 'maya' | 'atlas' | 'callbot' | 'orchestrator' | 'autopilot';

export type DecisionType =
    | 'message_sent'           // Sent a follow-up or nurture message
    | 'discount_offered'       // Auto-generated discount offer
    | 'stage_changed'          // Moved lead to different pipeline stage
    | 'channel_switched'       // Changed contact channel (WA→TG, etc.)
    | 'escalated_to_human'     // Escalated to human agent
    | 'lead_scored'            // Predictive score calculated
    | 'lead_reactivated'       // Dormant lead reactivated
    | 'content_generated'      // AI-generated email/message content
    | 'data_enriched'          // Lead data enriched from external source
    | 'duplicate_detected'     // Duplicate lead found
    | 'call_initiated'         // Voice call started via CallBot
    | 'followup_scheduled'     // Automatic follow-up scheduled
    | 'objection_detected'     // Price/trust/timing objection identified
    | 'close_signal_detected'  // High probability of closing detected
    | 'workflow_triggered'     // Agent Studio workflow activated
    | 'quote_generated';       // Auto-quote created and sent

export interface AuditEntry {
    id: string;
    company_id: string;
    lead_id: string | null;
    agent_name: AgentName;
    decision_type: DecisionType;
    reasoning: string;
    context_snapshot: Record<string, any>;
    outcome: string | null;
    confidence: number;
    created_at: string;
    // Joined from leads table (optional)
    lead?: {
        id: string;
        name: string;
        company_name: string | null;
        phone: string | null;
        status: string;
    };
}

export interface AuditFilters {
    agentName?: AgentName;
    decisionType?: DecisionType;
    leadId?: string;
    dateFrom?: string;
    dateTo?: string;
    minConfidence?: number;
    limit?: number;
}

export interface AuditStats {
    total_decisions: number;
    by_agent: Record<AgentName, number>;
    by_type: Record<string, number>;
    avg_confidence: number;
    last_24h: number;
    escalations: number;
}

// ─── Decision Type Config (for UI) ───────────────────────────────────────────

export const DECISION_TYPE_CONFIG: Record<DecisionType, {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
}> = {
    message_sent:          { label: 'Mensaje enviado',       icon: '💬', color: 'text-blue-700',    bgColor: 'bg-blue-50 border-blue-200' },
    discount_offered:      { label: 'Descuento ofrecido',    icon: '🏷️', color: 'text-amber-700',   bgColor: 'bg-amber-50 border-amber-200' },
    stage_changed:         { label: 'Etapa cambiada',        icon: '🔄', color: 'text-purple-700',  bgColor: 'bg-purple-50 border-purple-200' },
    channel_switched:      { label: 'Canal cambiado',        icon: '📡', color: 'text-indigo-700',  bgColor: 'bg-indigo-50 border-indigo-200' },
    escalated_to_human:    { label: 'Escalado a humano',     icon: '🙋', color: 'text-red-700',     bgColor: 'bg-red-50 border-red-200' },
    lead_scored:           { label: 'Score calculado',       icon: '🎯', color: 'text-teal-700',    bgColor: 'bg-teal-50 border-teal-200' },
    lead_reactivated:      { label: 'Lead reactivado',       icon: '🔥', color: 'text-orange-700',  bgColor: 'bg-orange-50 border-orange-200' },
    content_generated:     { label: 'Contenido generado',    icon: '✍️', color: 'text-violet-700',  bgColor: 'bg-violet-50 border-violet-200' },
    data_enriched:         { label: 'Datos enriquecidos',    icon: '📊', color: 'text-cyan-700',    bgColor: 'bg-cyan-50 border-cyan-200' },
    duplicate_detected:    { label: 'Duplicado detectado',   icon: '👥', color: 'text-yellow-700',  bgColor: 'bg-yellow-50 border-yellow-200' },
    call_initiated:        { label: 'Llamada iniciada',      icon: '📞', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
    followup_scheduled:    { label: 'Seguimiento agendado',  icon: '📅', color: 'text-sky-700',     bgColor: 'bg-sky-50 border-sky-200' },
    objection_detected:    { label: 'Objeción detectada',    icon: '⚠️', color: 'text-rose-700',    bgColor: 'bg-rose-50 border-rose-200' },
    close_signal_detected: { label: 'Señal de cierre',       icon: '🏆', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
    workflow_triggered:    { label: 'Workflow activado',      icon: '⚡', color: 'text-fuchsia-700', bgColor: 'bg-fuchsia-50 border-fuchsia-200' },
    quote_generated:       { label: 'Cotización generada',   icon: '📋', color: 'text-green-700',   bgColor: 'bg-green-50 border-green-200' },
};

export const AGENT_CONFIG: Record<AgentName, {
    label: string;
    icon: string;
    color: string;
}> = {
    sofia:        { label: 'Sofía',        icon: '🤖', color: 'text-violet-600' },
    oracle:       { label: 'Oracle',       icon: '🎯', color: 'text-teal-600' },
    maya:         { label: 'Maya',         icon: '✍️', color: 'text-pink-600' },
    atlas:        { label: 'Atlas',        icon: '📊', color: 'text-cyan-600' },
    callbot:      { label: 'CallBot',      icon: '📞', color: 'text-emerald-600' },
    orchestrator: { label: 'Orchestrator', icon: '🧠', color: 'text-indigo-600' },
    autopilot:    { label: 'Autopilot',    icon: '🚀', color: 'text-orange-600' },
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const auditTrailService = {

    /**
     * Log a decision — FIRE-AND-FORGET
     * This is the main entry point. Call it from any agent without awaiting.
     * Never blocks the caller.
     */
    logDecision(params: {
        companyId: string;
        leadId?: string;
        agentName: AgentName;
        decisionType: DecisionType;
        reasoning: string;
        contextSnapshot?: Record<string, any>;
        confidence?: number;
    }): void {
        const { companyId, leadId, agentName, decisionType, reasoning, contextSnapshot, confidence } = params;

        // Fire-and-forget — never block the critical path
        Promise.resolve(
            supabase.from('ai_audit_trail').insert({
                company_id: companyId,
                lead_id: leadId || null,
                agent_name: agentName,
                decision_type: decisionType,
                reasoning,
                context_snapshot: contextSnapshot || {},
                confidence: confidence ?? 50,
            })
        ).then(({ error }) => {
            if (error) {
                // Log but never throw — audit failures must not break operations
                logger.warn('[AuditTrail] Failed to log decision (non-critical)', {
                    agentName,
                    decisionType,
                    error: error.message,
                });
            }
        }).catch(() => {
            // Silently swallow — this is intentional
        });
    },

    /**
     * Update the outcome of a previous decision (optional)
     * Used when we learn the result of an autonomous action
     */
    async updateOutcome(entryId: string, outcome: string): Promise<void> {
        try {
            await supabase
                .from('ai_audit_trail')
                .update({ outcome })
                .eq('id', entryId);
        } catch {
            // fire-and-forget — silently swallow
        }
    },

    /**
     * Get audit trail entries with optional filtering
     */
    async getEntries(companyId: string, filters: AuditFilters = {}): Promise<AuditEntry[]> {
        let query = supabase
            .from('ai_audit_trail')
            .select(`
                *,
                lead:leads(id, name, company_name, phone, status)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (filters.agentName) query = query.eq('agent_name', filters.agentName);
        if (filters.decisionType) query = query.eq('decision_type', filters.decisionType);
        if (filters.leadId) query = query.eq('lead_id', filters.leadId);
        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.minConfidence) query = query.gte('confidence', filters.minConfidence);
        query = query.limit(filters.limit || 100);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as AuditEntry[];
    },

    /**
     * Get audit entries for a specific lead (for lead detail view)
     */
    async getLeadAuditHistory(leadId: string): Promise<AuditEntry[]> {
        const { data, error } = await supabase
            .from('ai_audit_trail')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return (data || []) as AuditEntry[];
    },

    /**
     * Get aggregated stats for the cockpit dashboard
     */
    async getStats(companyId: string): Promise<AuditStats> {
        const { data, error } = await supabase
            .from('ai_audit_trail')
            .select('agent_name, decision_type, confidence, created_at')
            .eq('company_id', companyId);

        if (error) throw error;

        const entries = data || [];
        const now = Date.now();
        const last24h = entries.filter(e =>
            now - new Date(e.created_at).getTime() < 24 * 60 * 60 * 1000
        );

        const byAgent: Record<string, number> = {};
        const byType: Record<string, number> = {};
        let totalConfidence = 0;

        entries.forEach(e => {
            byAgent[e.agent_name] = (byAgent[e.agent_name] || 0) + 1;
            byType[e.decision_type] = (byType[e.decision_type] || 0) + 1;
            totalConfidence += e.confidence || 0;
        });

        return {
            total_decisions: entries.length,
            by_agent: byAgent as Record<AgentName, number>,
            by_type: byType,
            avg_confidence: entries.length > 0 ? Math.round(totalConfidence / entries.length) : 0,
            last_24h: last24h.length,
            escalations: byType['escalated_to_human'] || 0,
        };
    },
};
