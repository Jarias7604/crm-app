import { supabase } from '../supabase';

export interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'whatsapp' | 'telegram' | 'sms';
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
        const { data: campaigns, error } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch real-time stats from marketing_messages
        const { data: messages } = await supabase
            .from('marketing_messages')
            .select('status, metadata')
            .order('created_at', { ascending: false })
            .limit(5000);

        // Aggregate stats by campaign_id
        const realStats: Record<string, { sent: number, opened: number, clicked: number }> = {};

        messages?.forEach(msg => {
            const campaignId = (msg.metadata as any)?.campaign_id;
            const status = msg.status;
            if (!campaignId) return;

            if (!realStats[campaignId]) {
                realStats[campaignId] = { sent: 0, opened: 0, clicked: 0 };
            }

            realStats[campaignId].sent++;
            if (status === 'opened' || status === 'read' || status === 'clicked') realStats[campaignId].opened++;
            if (status === 'clicked') realStats[campaignId].clicked++;
        });

        // Merge real stats into campaigns
        return (campaigns as Campaign[]).map(c => ({
            ...c,
            stats: {
                ...c.stats,
                sent: realStats[c.id]?.sent || c.stats?.sent || 0,
                opened: realStats[c.id]?.opened || c.stats?.opened || 0,
                clicked: realStats[c.id]?.clicked || c.stats?.clicked || 0
            }
        }));
    },

    async getCampaignById(id: string) {
        const { data: c, error } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        const campaign = c as Campaign;

        // Fetch real-time stats for this campaign
        const { data: messages } = await supabase
            .from('marketing_messages')
            .select('status')
            .eq('metadata->>campaign_id', id);

        if (messages) {
            campaign.stats = {
                sent: messages.length,
                opened: messages.filter(m => ['opened', 'read', 'clicked'].includes(m.status)).length,
                clicked: messages.filter(m => m.status === 'clicked').length
            };
        }

        return campaign;
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

    async deleteCampaign(id: string) {
        const { error } = await supabase
            .from('marketing_campaigns')
            .delete()
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
    }, companyId: string, channel: string = 'email') {
        if (!companyId) return [];

        let query = supabase
            .from('leads')
            .select(`
                id, name, company_name, email, phone, created_at, status, priority,
                marketing_conversations(external_id)
            `)
            .eq('company_id', companyId)
            .eq('marketing_conversations.channel', channel);

        // Filter by availability based on channel
        if (channel === 'email') {
            query = query.not('email', 'is', null);
        } else {
            query = query.not('phone', 'is', null);
        }

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
