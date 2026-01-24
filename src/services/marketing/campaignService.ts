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

    // Simulates sending the campaign
    async sendCampaign(id: string) {
        // 1. Update status to 'sending'
        await this.updateCampaign(id, { status: 'sending' });

        // 2. Simulate delay (sending emails...)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Update status to 'completed' and mock stats
        const mockStats = {
            sent: Math.floor(Math.random() * 100) + 50,
            opened: 0,
            clicked: 0
        };

        await this.updateCampaign(id, {
            status: 'completed',
            sent_at: new Date().toISOString(),
            stats: mockStats
        });
    },

    // NEW: Get audience preview based on filters
    async getAudiencePreview(filters: { status?: string[], dateRange?: 'all' | 'new' }, companyId: string) {
        if (!companyId) return [];

        let query = supabase
            .from('leads')
            .select('id, first_name, last_name, email, created_at, status')
            .eq('company_id', companyId)
            .not('email', 'is', null);

        if (filters.dateRange === 'new') {
            // Last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.gte('created_at', thirtyDaysAgo.toISOString());
        }

        if (filters.status && filters.status.length > 0) {
            query = query.in('status', filters.status);
        }

        const { data, error } = await query.limit(50); // Preview limit

        if (error) {
            console.error('Error fetching audience:', error);
            // Return empty if error (table might typically be empty in dev)
            return [];
        }

        return data || [];
    }
};
