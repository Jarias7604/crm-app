import { supabase } from '../supabase';

export interface EmailIntegration {
    id: string;
    company_id: string;
    provider: 'gmail' | 'outlook' | 'resend' | 'sendgrid' | 'smtp';
    name: string;
    settings: {
        email?: string;
        apiKey?: string;
        host?: string;
        port?: number;
        user?: string;
    };
    is_active: boolean;
}

export const integrationService = {
    async getIntegrations(companyId: string) {
        if (!companyId) return [];
        const { data, error } = await supabase
            .from('marketing_integrations')
            .select('*')
            .eq('company_id', companyId);

        if (error) throw error;
        return data as EmailIntegration[];
    },

    async saveIntegration(integration: Partial<EmailIntegration>) {
        const { data, error } = await supabase
            .from('marketing_integrations')
            .upsert(integration, { onConflict: 'company_id, provider' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteIntegration(id: string) {
        const { error } = await supabase
            .from('marketing_integrations')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
