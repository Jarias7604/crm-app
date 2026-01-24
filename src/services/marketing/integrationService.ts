import { supabase } from '../supabase';

export interface MarketingIntegration {
    id: string;
    company_id: string;
    type: 'email' | 'whatsapp' | 'chat' | 'sms' | 'telegram';
    provider: 'gmail' | 'outlook' | 'resend' | 'twilio' | 'meta' | 'openai' | 'custom_webhook' | 'telegram';
    name: string;
    settings: {
        email?: string;
        apiKey?: string;
        token?: string;
        accountSid?: string;
        phoneNumberId?: string;
        host?: string;
        port?: number;
        user?: string;
        baseUrl?: string;
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
        return data as MarketingIntegration[];
    },

    async saveIntegration(integration: Partial<MarketingIntegration>) {
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
