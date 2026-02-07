import { supabase } from '../supabase';

export interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'whatsapp' | 'sms';
    status: 'draft' | 'scheduled' | 'sending' | 'completed';
    subject?: string;
    content?: string;
    total_recipients: number;
    audience_filters?: any;
    company_id?: string;
    scheduled_at?: string;
    sent_at?: string;
    stats: {
        sent: number;
        opened: number;
        clicked: number;
        delivered?: number;
        replied?: number;
        bounced?: number;
    };
    created_at: string;
}

export const campaignService = {
    async getCampaigns() {
        const { data, error } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Campaign[];
    },

    async getCampaignById(id: string) {
        const { data, error } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Campaign;
    },

    async createCampaign(campaign: Partial<Campaign>) {
        const { data, error } = await supabase
            .from('marketing_campaigns')
            .insert(campaign)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateCampaign(id: string, updates: Partial<Campaign>) {
        const { error } = await supabase
            .from('marketing_campaigns')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    // Triggers the real marketing-engine Edge Function
    async sendCampaign(id: string) {
        const { data: { session } } = await supabase.auth.getSession();

        const { data, error } = await supabase.functions.invoke('marketing-engine', {
            body: { campaignId: id },
            headers: {
                Authorization: `Bearer ${session?.access_token}`
            }
        });

        if (error) throw error;
        return data;
    },

    // NEW: Get audience preview based on advanced filters
    async getAudiencePreview(filters: {
        status?: string[],
        priority?: string,
        dateRange?: 'all' | 'new',
        specificIds?: string[],
        idType?: 'id' | 'google_place_id'
    }, companyId: string) {
        if (!companyId) return [];

        let query = supabase
            .from('leads')
            .select('id, name, company_name, email, created_at, status, priority')
            .eq('company_id', companyId)
            .not('email', 'is', null);

        if (filters.specificIds && filters.specificIds.length > 0) {
            const idField = filters.idType || 'id';
            query = query.in(idField, filters.specificIds);
        } else {
            if (filters.dateRange === 'new') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                query = query.gte('created_at', thirtyDaysAgo.toISOString());
            }

            if (filters.status && filters.status.length > 0) {
                query = query.in('status', filters.status);
            }

            if (filters.priority && filters.priority !== 'all') {
                query = query.eq('priority', filters.priority);
            }
        }

        const { data, error } = await query.limit(1000);

        if (error) {
            console.error('Error fetching audience:', error);
            // Return empty if error (table might typically be empty in dev)
            return [];
        }

        return data || [];
    },

    async uploadMarketingAsset(file: File) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('marketing_assets')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('marketing_assets')
            .getPublicUrl(filePath);

        return publicUrl;
    }
};
