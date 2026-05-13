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
}

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
