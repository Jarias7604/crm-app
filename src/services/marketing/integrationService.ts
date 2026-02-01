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
            .from('company_integrations')
            .select('*')
            .eq('company_id', companyId);

        if (error) throw error;
        return data as MarketingIntegration[];
    },

    async saveIntegration(integration: Partial<MarketingIntegration>) {
        const { data, error } = await supabase
            .from('company_integrations')
            .upsert({
                company_id: integration.company_id,
                provider: integration.provider,
                credentials: integration.credentials,
                is_active: integration.is_active ?? true
            }, { onConflict: 'company_id, provider' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteIntegration(id: string) {
        const { error } = await supabase
            .from('company_integrations')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
