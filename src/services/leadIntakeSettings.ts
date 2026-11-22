import { supabase } from './supabase';
import {
    DEFAULT_INTAKE_DISPLAY_SETTINGS,
    type LeadIntakeDisplaySettings,
} from '../utils/leadIntakeProfile';

export const leadIntakeSettingsService = {
    async getSettings(companyId?: string | null): Promise<LeadIntakeDisplaySettings> {
        if (!companyId) {
            return {
                company_id: '',
                ...DEFAULT_INTAKE_DISPLAY_SETTINGS,
            };
        }

        try {
            const { data, error } = await supabase
                .from('lead_intake_display_settings')
                .select(
                    'company_id, visible_in_detail, visible_in_table, visible_in_ai, custom_field_labels, show_in_timeline',
                )
                .eq('company_id', companyId)
                .maybeSingle();

            if (error || !data) {
                return {
                    company_id: companyId,
                    ...DEFAULT_INTAKE_DISPLAY_SETTINGS,
                };
            }

            return {
                company_id: data.company_id || companyId,
                visible_in_detail: Array.isArray(data.visible_in_detail)
                    ? data.visible_in_detail
                    : DEFAULT_INTAKE_DISPLAY_SETTINGS.visible_in_detail,
                visible_in_table: Array.isArray(data.visible_in_table)
                    ? data.visible_in_table
                    : DEFAULT_INTAKE_DISPLAY_SETTINGS.visible_in_table,
                visible_in_ai: Array.isArray(data.visible_in_ai)
                    ? data.visible_in_ai
                    : DEFAULT_INTAKE_DISPLAY_SETTINGS.visible_in_ai,
                custom_field_labels:
                    data.custom_field_labels && typeof data.custom_field_labels === 'object'
                        ? data.custom_field_labels
                        : {},
                show_in_timeline:
                    typeof data.show_in_timeline === 'boolean' ? data.show_in_timeline : true,
            };
        } catch {
            return {
                company_id: companyId,
                ...DEFAULT_INTAKE_DISPLAY_SETTINGS,
            };
        }
    },

    async saveSettings(
        companyId: string,
        userId: string | undefined,
        patch: Partial<LeadIntakeDisplaySettings>,
    ): Promise<LeadIntakeDisplaySettings> {
        const current = await this.getSettings(companyId);
        const payload = {
            company_id: companyId,
            visible_in_detail: patch.visible_in_detail ?? current.visible_in_detail,
            visible_in_table: patch.visible_in_table ?? current.visible_in_table,
            visible_in_ai: patch.visible_in_ai ?? current.visible_in_ai,
            custom_field_labels: patch.custom_field_labels ?? current.custom_field_labels,
            show_in_timeline: patch.show_in_timeline ?? current.show_in_timeline,
            updated_by: userId || null,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('lead_intake_display_settings')
            .upsert(payload, { onConflict: 'company_id' })
            .select(
                'company_id, visible_in_detail, visible_in_table, visible_in_ai, custom_field_labels, show_in_timeline',
            )
            .single();

        if (error) throw error;

        return {
            company_id: data.company_id || companyId,
            visible_in_detail: data.visible_in_detail ?? payload.visible_in_detail,
            visible_in_table: data.visible_in_table ?? payload.visible_in_table,
            visible_in_ai: data.visible_in_ai ?? payload.visible_in_ai,
            custom_field_labels: data.custom_field_labels ?? payload.custom_field_labels,
            show_in_timeline:
                typeof data.show_in_timeline === 'boolean'
                    ? data.show_in_timeline
                    : payload.show_in_timeline,
        };
    },
};
