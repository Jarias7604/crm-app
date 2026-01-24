import { supabase } from '../../supabase';

export interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'whatsapp' | 'sms';
    status: 'draft' | 'scheduled' | 'sending' | 'completed';
    subject?: string;
    content?: string;
    total_recipients: number;
    scheduled_at?: string;
    stats: {
        sent: number;
        opened: number;
        clicked: number;
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
    }
};
