import { supabase } from './supabase';
import {
    DEFAULT_BUSINESS_HOURS,
    DEFAULT_FIRST_TOUCH_TEMPLATE,
    DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
    DEFAULT_HANDOFF_BUSINESS_REPLY,
    DEFAULT_HANDOFF_KEYWORDS,
    DEFAULT_PAIN_PLAYBOOKS,
    DEFAULT_QUALIFIER_SYSTEM_PROMPT,
    DEFAULT_TZ,
    type LeadQualifierConfig,
    type LeadQualifierSession,
    type RoutingRuleLike,
} from '../utils/leadQualifierDefaults';

export interface LeadDemoRoutingRule extends RoutingRuleLike {
    company_id: string;
    created_at?: string;
    updated_at?: string;
}

export interface TeamMemberOption {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    role: string;
}

export interface ProductOption {
    id: string;
    name: string;
}

export function buildDefaultQualifierConfig(companyId: string): LeadQualifierConfig {
    return {
        company_id: companyId,
        is_enabled: false,
        mode: 'draft',
        response_24_7: true,
        allowed_sources: ['facebook_ads', 'google_sheets'],
        max_ai_turns: 6,
        timezone: DEFAULT_TZ,
        business_hours: { ...DEFAULT_BUSINESS_HOURS },
        system_prompt: DEFAULT_QUALIFIER_SYSTEM_PROMPT,
        first_touch_template: DEFAULT_FIRST_TOUCH_TEMPLATE,
        handoff_reply_business_hours: DEFAULT_HANDOFF_BUSINESS_REPLY,
        handoff_reply_after_hours: DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
        handoff_keywords: [...DEFAULT_HANDOFF_KEYWORDS],
        pain_playbooks: DEFAULT_PAIN_PLAYBOOKS.map((p) => ({ ...p, keywords: [...p.keywords] })),
        demo_duration_minutes: 30,
        demo_buffer_minutes: 15,
        notify_on_urgent_intake: false,
        notify_on_handoff: true,
        notify_on_demo_booked: true,
        notify_advisors_24_7: true,
        notify_channels: { whatsapp: true, crm_alert: true, email: false },
        sla_escalation_minutes: 15,
        sla_backup_user_id: null,
        crm_base_url: typeof window !== 'undefined' ? window.location.origin : 'https://ariascrm.com',
    };
}

function hydrateConfig(companyId: string, row: any): LeadQualifierConfig {
    const base = buildDefaultQualifierConfig(companyId);
    if (!row) return base;
    return {
        id: row.id,
        company_id: row.company_id || companyId,
        is_enabled: Boolean(row.is_enabled),
        mode: row.mode === 'auto' ? 'auto' : 'draft',
        response_24_7: typeof row.response_24_7 === 'boolean' ? row.response_24_7 : base.response_24_7,
        allowed_sources:
            Array.isArray(row.allowed_sources) && row.allowed_sources.length > 0
                ? row.allowed_sources
                : base.allowed_sources,
        max_ai_turns: Number(row.max_ai_turns) || base.max_ai_turns,
        timezone: String(row.timezone || base.timezone),
        business_hours: {
            ...base.business_hours,
            ...(row.business_hours && typeof row.business_hours === 'object' ? row.business_hours : {}),
        },
        system_prompt: String(row.system_prompt || '').trim() || base.system_prompt,
        first_touch_template: String(row.first_touch_template || '').trim() || base.first_touch_template,
        handoff_reply_business_hours:
            String(row.handoff_reply_business_hours || '').trim() || base.handoff_reply_business_hours,
        handoff_reply_after_hours:
            String(row.handoff_reply_after_hours || '').trim() || base.handoff_reply_after_hours,
        handoff_keywords:
            Array.isArray(row.handoff_keywords) && row.handoff_keywords.length > 0
                ? row.handoff_keywords
                : base.handoff_keywords,
        pain_playbooks:
            Array.isArray(row.pain_playbooks) && row.pain_playbooks.length > 0
                ? row.pain_playbooks
                : base.pain_playbooks,
        demo_duration_minutes: Number(row.demo_duration_minutes) || base.demo_duration_minutes,
        demo_buffer_minutes: Number(row.demo_buffer_minutes ?? base.demo_buffer_minutes),
        notify_on_urgent_intake: Boolean(row.notify_on_urgent_intake),
        notify_on_handoff:
            typeof row.notify_on_handoff === 'boolean' ? row.notify_on_handoff : base.notify_on_handoff,
        notify_on_demo_booked:
            typeof row.notify_on_demo_booked === 'boolean' ? row.notify_on_demo_booked : base.notify_on_demo_booked,
        notify_advisors_24_7:
            typeof row.notify_advisors_24_7 === 'boolean' ? row.notify_advisors_24_7 : base.notify_advisors_24_7,
        notify_channels: {
            ...base.notify_channels,
            ...(row.notify_channels && typeof row.notify_channels === 'object' ? row.notify_channels : {}),
        },
        sla_escalation_minutes: Number(row.sla_escalation_minutes) || base.sla_escalation_minutes,
        sla_backup_user_id: row.sla_backup_user_id || null,
        crm_base_url: String(row.crm_base_url || base.crm_base_url),
    };
}

export const leadQualifierService = {
    async getConfig(companyId: string): Promise<LeadQualifierConfig> {
        const { data, error } = await supabase
            .from('lead_qualifier_configs')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

        if (error) {
            console.warn('[leadQualifierService] getConfig:', error.message);
            return buildDefaultQualifierConfig(companyId);
        }
        return hydrateConfig(companyId, data);
    },

    async saveConfig(
        companyId: string,
        userId: string | undefined,
        patch: Partial<LeadQualifierConfig>,
    ): Promise<LeadQualifierConfig> {
        const current = await this.getConfig(companyId);
        const merged = { ...current, ...patch, company_id: companyId };

        const dbRow = {
            company_id: companyId,
            is_enabled: merged.is_enabled,
            mode: merged.mode,
            response_24_7: merged.response_24_7,
            allowed_sources: merged.allowed_sources,
            max_ai_turns: merged.max_ai_turns,
            timezone: merged.timezone,
            business_hours: merged.business_hours,
            system_prompt: merged.system_prompt,
            first_touch_template: merged.first_touch_template,
            handoff_reply_business_hours: merged.handoff_reply_business_hours,
            handoff_reply_after_hours: merged.handoff_reply_after_hours,
            handoff_keywords: merged.handoff_keywords,
            pain_playbooks: merged.pain_playbooks,
            demo_duration_minutes: merged.demo_duration_minutes,
            demo_buffer_minutes: merged.demo_buffer_minutes,
            notify_on_urgent_intake: merged.notify_on_urgent_intake,
            notify_on_handoff: merged.notify_on_handoff,
            notify_on_demo_booked: merged.notify_on_demo_booked,
            notify_advisors_24_7: merged.notify_advisors_24_7,
            notify_channels: merged.notify_channels,
            sla_escalation_minutes: merged.sla_escalation_minutes,
            sla_backup_user_id: merged.sla_backup_user_id || null,
            crm_base_url: merged.crm_base_url,
            updated_by: userId || null,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('lead_qualifier_configs')
            .upsert(dbRow, { onConflict: 'company_id' })
            .select('*')
            .single();

        if (error) throw error;
        return hydrateConfig(companyId, data);
    },

    async getRoutingRules(companyId: string): Promise<LeadDemoRoutingRule[]> {
        const { data, error } = await supabase
            .from('lead_demo_routing_rules')
            .select('*')
            .eq('company_id', companyId)
            .order('priority', { ascending: true });

        if (error) throw error;
        return (data || []) as LeadDemoRoutingRule[];
    },

    async upsertRoutingRule(
        companyId: string,
        rule: Partial<LeadDemoRoutingRule> & { name: string },
    ): Promise<LeadDemoRoutingRule> {
        const payload: Record<string, any> = {
            ...(rule.id ? { id: rule.id } : {}),
            company_id: companyId,
            name: rule.name.trim(),
            product_id: rule.product_id || null,
            strategy: rule.strategy === 'fixed' ? 'fixed' : 'round_robin',
            assignee_user_ids: rule.assignee_user_ids || [],
            notify_extra_user_ids: rule.notify_extra_user_ids || [],
            priority: Number(rule.priority ?? 10),
            is_active: rule.is_active !== false,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('lead_demo_routing_rules')
            .upsert(payload)
            .select('*')
            .single();

        if (error) throw error;
        return data as LeadDemoRoutingRule;
    },

    async deleteRoutingRule(ruleId: string): Promise<void> {
        const { error } = await supabase
            .from('lead_demo_routing_rules')
            .delete()
            .eq('id', ruleId);
        if (error) throw error;
    },

    async getSessions(companyId: string, limit = 80): Promise<LeadQualifierSession[]> {
        const { data, error } = await supabase
            .from('lead_qualifier_sessions')
            .select('*, leads(id, name, company_name, phone, status, interested_product_id)')
            .eq('company_id', companyId)
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as LeadQualifierSession[];
    },

    async updateSessionStatus(
        sessionId: string,
        status: LeadQualifierSession['status'],
    ): Promise<void> {
        const { error } = await supabase
            .from('lead_qualifier_sessions')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        if (error) throw error;
    },

    async getTeamMembers(companyId: string): Promise<TeamMemberOption[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, role')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('full_name', { ascending: true });

        if (error) throw error;
        return (data || []) as TeamMemberOption[];
    },

    async getProducts(companyId: string): Promise<ProductOption[]> {
        const { data, error } = await supabase
            .from('lead_products')
            .select('id, name')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) return [];
        return (data || []) as ProductOption[];
    },

    async invokeEngine<T = any>(body: Record<string, any>): Promise<T> {
        const { data, error } = await supabase.functions.invoke('lead-qualifier-engine', {
            body,
        });
        if (error) throw new Error(error.message || 'Error al invocar Calificador IA');
        if (data && data.ok === false) {
            throw new Error(data.error || 'El motor Calificador IA reportó un error');
        }
        return data as T;
    },

    async approveAndSendDraft(companyId: string, leadId: string, messageText: string) {
        return this.invokeEngine({
            action: 'approve_and_send_draft',
            company_id: companyId,
            lead_id: leadId,
            message_text: messageText,
        });
    },

    async simulateConversation(
        companyId: string,
        payload: {
            lead_name?: string;
            company_name?: string;
            pain_text?: string;
            volume_text?: string;
            urgency_text?: string;
            role_title?: string;
            product_label?: string;
            incoming_message?: string;
            simulated_iso?: string;
            history?: string[];
            offered_slots?: any[];
        },
    ) {
        return this.invokeEngine({
            action: 'simulate_conversation',
            company_id: companyId,
            ...payload,
        });
    },

    async checkSlaEscalations(companyId: string) {
        return this.invokeEngine({
            action: 'check_sla_escalations',
            company_id: companyId,
        });
    },

    async sendTestAdvisorAlert(companyId: string, advisorUserId: string) {
        return this.invokeEngine({
            action: 'send_test_advisor_alert',
            company_id: companyId,
            advisor_user_id: advisorUserId,
        });
    },
};
