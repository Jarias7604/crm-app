import { supabase } from '../supabase';

export interface LeadMemory {
    id: string;
    lead_id: string;
    company_id: string;
    known_facts: Record<string, any>;
    conversation_stage: 'nuevo' | 'calificado' | 'cotizado' | 'seguimiento' | 'negociacion' | 'cerrado' | 'perdido';
    last_objection: string | null;
    sentiment_score: number;
    best_contact_time: string | null;
    next_action: string;
    followup_count: number;
    last_followup_at: string | null;
    followup_paused: boolean;
    last_followup_msg: string | null;
    created_at: string;
    updated_at: string;
}

export interface CockpitMetrics {
    company_id: string;
    total_leads_tracked: number;
    leads_nuevos: number;
    leads_calificados: number;
    leads_cotizados: number;
    leads_en_seguimiento: number;
    leads_cerrados: number;
    leads_perdidos: number;
    avg_sentiment: number;
    pendientes_escalar: number;
    en_seguimiento_auto: number;
    last_activity: string;
}

export const leadMemoryService = {
    /** Get memory for a specific lead */
    async getLeadMemory(leadId: string): Promise<LeadMemory | null> {
        const { data } = await supabase
            .from('lead_ai_memory')
            .select('*')
            .eq('lead_id', leadId)
            .maybeSingle();
        return data as LeadMemory | null;
    },

    /** Get all memories for a company with lead info joined */
    async getCompanyMemories(companyId: string, options?: {
        stage?: string;
        nextAction?: string;
        limit?: number;
    }) {
        let query = supabase
            .from('lead_ai_memory')
            .select(`
                *,
                lead:leads(id, name, phone, company_name, status, email)
            `)
            .eq('company_id', companyId)
            .order('updated_at', { ascending: false });

        if (options?.stage) query = query.eq('conversation_stage', options.stage);
        if (options?.nextAction) query = query.eq('next_action', options.nextAction);
        if (options?.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /** Get agent cockpit metrics for a company */
    async getCockpitMetrics(companyId: string): Promise<CockpitMetrics | null> {
        const { data } = await supabase
            .from('agent_cockpit_metrics')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        return data as CockpitMetrics | null;
    },

    /** Pause/resume followups for a lead */
    async toggleFollowupPause(leadId: string, paused: boolean) {
        const { error } = await supabase
            .from('lead_ai_memory')
            .update({ followup_paused: paused })
            .eq('lead_id', leadId);
        if (error) throw error;
    },

    /** Manually reset followup count */
    async resetFollowups(leadId: string) {
        const { error } = await supabase
            .from('lead_ai_memory')
            .update({ followup_count: 0, last_followup_at: null, followup_paused: false })
            .eq('lead_id', leadId);
        if (error) throw error;
    },

    /** Completely wipe a lead's memory so Sofía starts fresh */
    async resetMemory(leadId: string) {
        const { error } = await supabase
            .from('lead_ai_memory')
            .delete()
            .eq('lead_id', leadId);
        if (error) throw error;
    },

    /** Manually update the next action */
    async setNextAction(leadId: string, action: string) {
        const { error } = await supabase
            .from('lead_ai_memory')
            .update({ next_action: action })
            .eq('lead_id', leadId);
        if (error) throw error;
    },

    /** Trigger manual followup run */
    async triggerFollowupRun(companyId?: string) {
        const { data, error } = await supabase.functions.invoke('auto-followup', {
            body: { company_id: companyId }
        });
        if (error) throw error;
        return data;
    },

    /** Get leads pending human escalation */
    async getEscalationQueue(companyId: string) {
        const { data, error } = await supabase
            .from('lead_ai_memory')
            .select(`
                *,
                lead:leads(id, name, phone, company_name, status)
            `)
            .eq('company_id', companyId)
            .eq('next_action', 'escalar_humano')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }
};
