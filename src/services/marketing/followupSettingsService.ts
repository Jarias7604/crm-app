import { supabase } from '../supabase';

export interface FollowupSettings {
    id?: string;
    company_id: string;
    first_followup_hours: number;
    second_followup_hours: number;
    third_followup_hours: number;
    max_followups: number;
    auto_escalate: boolean;
    only_business_hours: boolean;
    timezone: string;
    pause_after_quote: boolean;
    followup_1_template: string | null;
    followup_2_template: string | null;
    followup_3_template: string | null;
    is_active: boolean;
    // A/B Testing
    ab_testing_enabled:    boolean;
    followup_1_template_b: string | null;
    followup_2_template_b: string | null;
    followup_3_template_b: string | null;
    ab_stats: {
        a_sent: number; b_sent: number;
        a_responses: number; b_responses: number;
    };
    // Advanced Escalation — Multi-Channel Hub
    escalation_channel: 'agent_telegram' | 'central_telegram' | 'slack_webhook'; // DB compat
    escalation_ch_agent_tg: boolean;
    escalation_ch_group_tg: boolean;
    escalation_ch_whatsapp: boolean;
    escalation_ch_slack: boolean;
    // Global channel credentials
    escalation_telegram_chat_id: string | null;
    escalation_whatsapp_number: string | null;
    escalation_whatsapp_token: string | null;
    escalation_webhook_url: string | null;
    // SLA & DND
    escalation_sla_minutes: number;
    escalation_backup_agent_id: string | null;
    escalation_dnd_enabled: boolean;
    escalation_dnd_start: string;
    escalation_dnd_end: string;
    // Department routing — per channel per department (JSONB)
    dept_routing: {
        sales:      { telegram: string; whatsapp: string; slack: string };
        accounting: { telegram: string; whatsapp: string; slack: string };
        support:    { telegram: string; whatsapp: string; slack: string };
    };
}

const EMPTY_DEPT_ROUTE = { telegram: '', whatsapp: '', slack: '' };
export const DEFAULT_DEPT_ROUTING = {
    sales:      { ...EMPTY_DEPT_ROUTE },
    accounting: { ...EMPTY_DEPT_ROUTE },
    support:    { ...EMPTY_DEPT_ROUTE },
};

export const DEFAULT_FOLLOWUP_SETTINGS: Omit<FollowupSettings, 'company_id'> = {
    first_followup_hours:  24,
    second_followup_hours: 72,
    third_followup_hours:  168,
    max_followups:         3,
    auto_escalate:         true,
    only_business_hours:   false,
    timezone:              'America/El_Salvador',
    pause_after_quote:     false,
    followup_1_template:   null,
    followup_2_template:   null,
    followup_3_template:   null,
    is_active:             true,
    ab_testing_enabled:    false,
    followup_1_template_b: null,
    followup_2_template_b: null,
    followup_3_template_b: null,
    ab_stats: { a_sent: 0, b_sent: 0, a_responses: 0, b_responses: 0 },
    escalation_channel:      'agent_telegram',
    escalation_ch_agent_tg:  true,
    escalation_ch_group_tg:  false,
    escalation_ch_whatsapp:  false,
    escalation_ch_slack:     false,
    escalation_telegram_chat_id: null,
    escalation_whatsapp_number:  null,
    escalation_whatsapp_token:   null,
    escalation_webhook_url:      null,
    escalation_sla_minutes:      30,
    escalation_backup_agent_id:  null,
    escalation_dnd_enabled:      false,
    escalation_dnd_start:        '19:00',
    escalation_dnd_end:          '08:00',
    dept_routing:                DEFAULT_DEPT_ROUTING,
};

export const followupSettingsService = {
    async get(companyId: string): Promise<FollowupSettings> {
        const { data, error } = await supabase
            .from('ai_followup_settings')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            // Return defaults if no row yet
            return { company_id: companyId, ...DEFAULT_FOLLOWUP_SETTINGS };
        }
        return data as FollowupSettings;
    },

    async save(settings: FollowupSettings): Promise<void> {
        const { error } = await supabase
            .from('ai_followup_settings')
            .upsert(settings, { onConflict: 'company_id' });

        if (error) throw error;
    },

    /** Targeted update for is_active only — verifies rows were actually changed */
    async updateActiveState(companyId: string, isActive: boolean): Promise<void> {
        // First try update (row already exists)
        const { data, error } = await supabase
            .from('ai_followup_settings')
            .update({ is_active: isActive })
            .eq('company_id', companyId)
            .select('id');

        if (error) throw error;

        // If no rows updated, the row doesn't exist yet — insert it
        if (!data || data.length === 0) {
            const { error: insertError } = await supabase
                .from('ai_followup_settings')
                .insert({ company_id: companyId, is_active: isActive });
            if (insertError) throw insertError;
        }
    },

    async triggerNow(companyId: string): Promise<{ followups_sent: number; evaluated: number; skipped: number }> {
        const { data, error } = await supabase.functions.invoke('auto-followup', {
            body: { company_id: companyId }
        });
        if (error) throw error;
        return data;
    },

    /** Fetch current A/B stats for a company */
    async getAbStats(companyId: string) {
        const { data } = await supabase
            .from('ai_followup_settings')
            .select('ab_stats, ab_testing_enabled')
            .eq('company_id', companyId)
            .maybeSingle();
        return data?.ab_stats || { a_sent: 0, b_sent: 0, a_responses: 0, b_responses: 0 };
    },

    /** Reset A/B stats to zero */
    async resetAbStats(companyId: string) {
        const { error } = await supabase
            .from('ai_followup_settings')
            .update({ ab_stats: { a_sent: 0, b_sent: 0, a_responses: 0, b_responses: 0 } })
            .eq('company_id', companyId);
        if (error) throw error;
    }
};
