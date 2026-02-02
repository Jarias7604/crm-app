import { supabase } from '../supabase';

export interface MarketingIntegration {
    id: string;
    company_id: string;
    provider: 'openai' | 'telegram'; // Solo soportamos estos 2 por ahora
    name?: string; // Optional if not in DB
    credentials: {
        apiKey?: string;
        token?: string;
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

        // Map DB 'settings' to Frontend 'credentials'
        return (data || []).map(item => ({
            ...item,
            credentials: item.settings // Map settings to credentials
        })) as MarketingIntegration[];
    },

    async saveIntegration(integration: Partial<MarketingIntegration>) {
        const { data, error } = await supabase
            .from('marketing_integrations')
            .upsert({
                company_id: integration.company_id,
                provider: integration.provider,
                settings: integration.credentials, // Map credentials to settings
                is_active: integration.is_active ?? true
            }, { onConflict: 'company_id, provider' })
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
