import { supabase } from '../supabase';
import { simGuard, getSimulatedCompanyId } from '../simGuard';

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
        const { data: campaigns, error } = await simGuard(
            supabase.from('marketing_campaigns').select('*')
        ).order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch real-time stats from marketing_messages — scoped to same tenant
        let msgQuery = supabase
            .from('marketing_messages')
            .select('status, metadata, marketing_conversations!inner(company_id)');
        
        const simId = getSimulatedCompanyId();
        if (simId) {
            msgQuery = msgQuery.eq('marketing_conversations.company_id', simId);
        }
        
        const { data: messages } = await msgQuery
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
        const { data: c, error } = await simGuard(
            supabase.from('marketing_campaigns').select('*')
        ).eq('id', id).single();

        if (error) throw error;
        const campaign = c as Campaign;

        // Fetch real-time stats for this campaign — scoped to same tenant
        let msgQuery = supabase
            .from('marketing_messages')
            .select('status, marketing_conversations!inner(company_id)')
            .eq('metadata->>campaign_id', id);
        
        const simId = getSimulatedCompanyId();
        if (simId) {
            msgQuery = msgQuery.eq('marketing_conversations.company_id', simId);
        }
        
        const { data: messages } = await msgQuery;

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

    // Get audience preview based on advanced filters
    async getAudiencePreview(filters: {
        status?: string[],
        industry?: string[],
        priority?: string,
        dateRange?: 'all' | 'new',
        specificIds?: string[],
        idType?: 'id' | 'google_place_id'
    }, companyId: string, channel: string = 'email') {
        if (!companyId) return [];

        // IMPORTANT: No joins on marketing_conversations here.
        // Joining that table can silently fail due to RLS and return [] with no error shown.
        let query = supabase
            .from('leads')
            .select('id, name, company_name, email, phone, created_at, status, priority')
            .eq('company_id', companyId);

        // Filter by channel contact availability
        if (channel === 'email') {
            query = query.not('email', 'is', null).neq('email', '');
        } else {
            query = query.not('phone', 'is', null).neq('phone', '');
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
            if (filters.industry && filters.industry.length > 0) {
                query = query.in('industry', filters.industry);
            }
        }

        const { data, error } = await query.limit(1000);

        // Throw so the UI shows the real error — never swallow it silently
        if (error) throw new Error(`Error cargando audiencia: ${error.message}`);

        const leads = data || [];

        // For Telegram: fetch connected lead IDs in a separate isolated query
        if (channel === 'telegram' && leads.length > 0) {
            const leadIds = leads.map((l: any) => l.id);
            const { data: convData } = await supabase
                .from('marketing_conversations')
                .select('lead_id, external_id')
                .eq('channel', 'telegram')
                .not('external_id', 'is', null)
                .in('lead_id', leadIds);

            const connectedIds = new Set((convData || []).map((c: any) => c.lead_id));
            return leads.map((l: any) => ({
                ...l,
                marketing_conversations: connectedIds.has(l.id)
                    ? [{ channel: 'telegram', external_id: true }]
                    : []
            }));
        }

        return leads;
    },

    /**
     * Get per-lead interaction data for a specific campaign.
     * Returns each recipient with their status: sent, opened, or clicked.
     */
    async getCampaignRecipients(campaignId: string) {
        // 1. Fetch all messages belonging to this campaign — scoped to active tenant
        let msgQuery = supabase
            .from('marketing_messages')
            .select('metadata, status, sent_at, created_at, marketing_conversations!inner(company_id)')
            .eq('metadata->>campaign_id', campaignId);
        
        const simId = getSimulatedCompanyId();
        if (simId) {
            msgQuery = msgQuery.eq('marketing_conversations.company_id', simId);
        }
        
        const { data: messages, error } = await msgQuery.order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Aggregate per lead: best status wins (clicked > opened > sent)
        const statusPriority: Record<string, number> = { clicked: 3, read: 2, opened: 2, delivered: 1, sent: 0, failed: -1 };
        const leadMap: Record<string, { bestStatus: string; bestPriority: number; sentAt: string; lastActivity: string }> = {};

        (messages || []).forEach(msg => {
            const leadId = (msg.metadata as any)?.lead_id;
            if (!leadId) return;

            const status = msg.status || 'sent';
            const priority = statusPriority[status] ?? 0;

            if (!leadMap[leadId]) {
                leadMap[leadId] = {
                    bestStatus: status,
                    bestPriority: priority,
                    sentAt: msg.sent_at || msg.created_at,
                    lastActivity: msg.created_at
                };
            } else {
                if (priority > leadMap[leadId].bestPriority) {
                    leadMap[leadId].bestStatus = status;
                    leadMap[leadId].bestPriority = priority;
                }
                // Track latest activity timestamp
                if (msg.created_at > leadMap[leadId].lastActivity) {
                    leadMap[leadId].lastActivity = msg.created_at;
                }
            }
        });

        const leadIds = Object.keys(leadMap);
        if (leadIds.length === 0) return [];

        // 3. Fetch lead details
        const { data: leads, error: leadsError } = await simGuard(
            supabase.from('leads').select('id, name, email, phone, company_name, status')
        ).in('id', leadIds);

        if (leadsError) throw leadsError;

        // 4. Merge and sort: opened/clicked first, then sent
        return (leads || [])
            .map(lead => ({
                id: lead.id,
                name: lead.name || 'Sin nombre',
                email: lead.email || '-',
                phone: lead.phone || '',
                companyName: lead.company_name || '',
                leadStatus: lead.status || '',
                interactionStatus: leadMap[lead.id]?.bestStatus || 'sent',
                sentAt: leadMap[lead.id]?.sentAt || '',
                lastActivity: leadMap[lead.id]?.lastActivity || ''
            }))
            .sort((a, b) => {
                const pa = statusPriority[a.interactionStatus] ?? 0;
                const pb = statusPriority[b.interactionStatus] ?? 0;
                return pb - pa; // Higher priority first (opened > sent)
            });
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
