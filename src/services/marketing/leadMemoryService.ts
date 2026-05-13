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

export interface ConversionReportRow {
    lead_id: string;
    lead_name: string;
    company_name: string | null;
    plan: string | null;
    closed_at: string | null;
    assigned_agent: string | null;
    sentiment_at_close: number;
    followup_count: number;
    channel: string | null;
}

export interface ConversionReport {
    total_attended: number;       // leads Sofía touched (has memory)
    total_closed: number;         // leads.status = 'Cliente' | 'cerrado'
    conversion_rate: number;      // %
    avg_followups_to_close: number;
    rows: ConversionReportRow[];
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

    /** Send a custom price offer to a lead via Telegram */
    async sendPriceOffer(leadId: string, companyId: string, discountPct: number, originalPrice: number, plan: string) {
        const finalPrice = (originalPrice * (1 - discountPct / 100)).toFixed(2);
        const { data, error } = await supabase.functions.invoke('auto-followup', {
            body: {
                company_id: companyId,
                force_lead_id: leadId,
                custom_message: `Hola, hemos preparado una oferta especial exclusiva para ti 🎁\n\nPlan: *${plan}*\nPrecio original: $${originalPrice}/mes\n✨ *Tu precio especial: $${finalPrice}/mes* (${discountPct}% de descuento)\n\nEsta oferta es válida solo por 48 horas. ¿Te interesa proceder con este precio?`
            }
        });
        if (error) throw error;
        return data;
    },

    /** Get price objection leads for a company */
    async getPriceObjections(companyId: string) {
        const { data, error } = await supabase
            .from('lead_ai_memory')
            .select(`*, lead:leads(id, name, phone, company_name, status, assigned_to)`)
            .eq('company_id', companyId)
            .eq('last_objection', 'precio')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data || [];
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
    },

    /** Build the bot conversion report for a company */
    async getConversionReport(companyId: string): Promise<ConversionReport> {
        // 1. All leads Sofía touched (has memory)
        const { data: allMemory, error: memErr } = await supabase
            .from('lead_ai_memory')
            .select('lead_id, followup_count, sentiment_score, conversation_stage')
            .eq('company_id', companyId);
        if (memErr) throw memErr;

        const total_attended = allMemory?.length || 0;
        const attendedIds = (allMemory || []).map(m => m.lead_id);

        if (attendedIds.length === 0) {
            return { total_attended: 0, total_closed: 0, conversion_rate: 0, avg_followups_to_close: 0, rows: [] };
        }

        // 2. Leads that closed
        const { data: closedLeads, error: leadErr } = await supabase
            .from('leads')
            .select('id, name, company_name, status, updated_at, assigned_to')
            .in('id', attendedIds)
            .in('status', ['Cliente', 'cerrado', 'Cerrado', 'Ganado']);
        if (leadErr) throw leadErr;

        const closedIds = (closedLeads || []).map((l: any) => l.id);

        // 3. Fetch agent names safely
        const assignedIds = [...new Set((closedLeads || []).map((l: any) => l.assigned_to).filter(Boolean))];
        const agentMap: Record<string, string> = {};
        if (assignedIds.length > 0) {
            const { data: agents } = await supabase.from('profiles').select('id, full_name').in('id', assignedIds);
            (agents || []).forEach((a: any) => { agentMap[a.id] = a.full_name; });
        }

        // 4. Get channels for closed leads
        const { data: convData } = await supabase
            .from('marketing_conversations').select('lead_id, channel')
            .in('lead_id', closedIds.length > 0 ? closedIds : ['00000000-0000-0000-0000-000000000000']);
        const channelMap: Record<string, string> = {};
        (convData || []).forEach(c => { channelMap[c.lead_id] = c.channel; });

        // 5. Build memory map
        const memoryMap: Record<string, typeof allMemory[0]> = {};
        (allMemory || []).forEach(m => { memoryMap[m.lead_id] = m; });

        const rows: ConversionReportRow[] = (closedLeads || []).map((lead: any) => {
            const mem = memoryMap[lead.id];
            return {
                lead_id: lead.id, lead_name: lead.name,
                company_name: lead.company_name || null,
                plan: mem?.conversation_stage === 'cerrado' ? 'Bot cerro' : null,
                closed_at: lead.updated_at || null,
                assigned_agent: agentMap[lead.assigned_to] || null,
                sentiment_at_close: mem?.sentiment_score || 50,
                followup_count: mem?.followup_count || 0,
                channel: channelMap[lead.id] || 'desconocido',
            };
        });

        const total_closed = rows.length;
        const conversion_rate = total_attended > 0 ? Math.round((total_closed / total_attended) * 100) : 0;
        const avg_followups_to_close = total_closed > 0
            ? Math.round(rows.reduce((sum, r) => sum + r.followup_count, 0) / total_closed)
            : 0;

        return { total_attended, total_closed, conversion_rate, avg_followups_to_close, rows };
    }
};
