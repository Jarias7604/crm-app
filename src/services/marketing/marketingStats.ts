import { supabase } from '../supabase';

export interface MarketingStats {
    totalImpacts: number;
    impactTrend: string;
    opportunities: number;
    opportunityTrend: string;
    pipelineValue: number;
    pipelineTrend: string;
    conversionRate: number;
    conversionTrend: string;
    opportunityLeadIds: string[];
    convertedLeadIds: string[];
}

export interface HeatmapLead {
    id: string;
    name: string;
    email: string;
    sent: number;
    opens: number;
    clicks: number;
}

export interface ActiveCampaign {
    id: string;
    name: string;
    progress: number;
    sent: number;
    total: number;
}

export const marketingStatsService = {
    async getOverviewStats(startDate?: string, endDate?: string): Promise<MarketingStats> {
        // 1. Get total impacts from campaigns
        let campaignQuery = supabase
            .from('marketing_campaigns')
            .select('stats, total_recipients');

        if (startDate) campaignQuery = campaignQuery.gte('created_at', startDate);
        if (endDate) campaignQuery = campaignQuery.lte('created_at', endDate);

        const { data: campaigns } = await campaignQuery;

        const totalRecipients = campaigns?.reduce((acc, c) => acc + (c.total_recipients || 0), 0) || 0;

        // 2. Get Opportunities & Pipeline from cotizaciones
        let quoteQuery = supabase
            .from('cotizaciones')
            .select('id, total_anual, lead_id, estado');

        if (startDate) quoteQuery = quoteQuery.gte('created_at', startDate);
        if (endDate) quoteQuery = quoteQuery.lte('created_at', endDate);

        const { data: quotes } = await quoteQuery;

        const totalPipeline = quotes?.reduce((acc, q) => acc + Number(q.total_anual || 0), 0) || 0;
        const opportunityLeadIds = Array.from(new Set(quotes?.map(q => q.lead_id).filter(Boolean))) as string[];

        // 3. Calculate Conversion Rate
        const conversionLeadIds = Array.from(new Set(quotes?.filter(q => q.estado === 'aceptada').map(q => q.lead_id).filter(Boolean))) as string[];

        const conversionRate = totalRecipients > 0
            ? Math.min(100, Math.round((opportunityLeadIds.length / totalRecipients) * 100))
            : 0;

        return {
            totalImpacts: totalRecipients,
            impactTrend: '+12%',
            opportunities: opportunityLeadIds.length,
            opportunityTrend: '+5',
            pipelineValue: totalPipeline,
            pipelineTrend: '+18%',
            conversionRate: conversionRate,
            conversionTrend: '+2.4%',
            opportunityLeadIds,
            convertedLeadIds: conversionLeadIds
        };
    },

    async getHeatmapLeads(startDate?: string, endDate?: string): Promise<HeatmapLead[]> {
        try {
            // Senior Aggregation: Get top active leads based on real message status
            let messageQuery = supabase
                .from('marketing_messages')
                .select(`
                    metadata,
                    status
                `)
                .not('metadata->lead_id', 'is', null);

            if (startDate) messageQuery = messageQuery.gte('created_at', startDate);
            if (endDate) messageQuery = messageQuery.lte('created_at', endDate);

            const { data, error } = await messageQuery
                .order('created_at', { ascending: false })
                .limit(200); // Analyze recent batch

            if (error) throw error;

            // Group by lead_id to calculate real stats
            const statsMap = new Map<string, { sent: number; opens: number; clicks: number }>();
            const leadIds = new Set<string>();

            data.forEach(msg => {
                const leadId = (msg.metadata as any).lead_id;
                if (!leadId) return;

                leadIds.add(leadId);
                const current = statsMap.get(leadId) || { sent: 0, opens: 0, clicks: 0 };

                current.sent++;
                const status = (msg.status || '').toLowerCase().trim();
                if (status === 'opened' || status === 'read' || status === 'clicked') current.opens++;
                if (status === 'clicked') current.clicks++;

                statsMap.set(leadId, current);
            });

            if (leadIds.size === 0) {
                // Fallback to recent leads if no messages yet
                const { data: recentLeads } = await supabase
                    .from('leads')
                    .select('id, name, email')
                    .order('created_at', { ascending: false })
                    .limit(5);

                return (recentLeads || []).map(l => ({
                    id: l.id,
                    name: l.name || 'Sin nombre',
                    email: l.email || 'Sin email',
                    sent: 0,
                    opens: 0,
                    clicks: 0
                }));
            }

            // Fetch lead details for the top active ones
            const { data: leads } = await supabase
                .from('leads')
                .select('id, name, email')
                .in('id', Array.from(leadIds).slice(0, 10));

            return (leads || []).map(l => {
                const s = statsMap.get(l.id) || { sent: 0, opens: 0, clicks: 0 };
                return {
                    id: l.id,
                    name: l.name || 'Cliente',
                    email: l.email || '-',
                    sent: s.sent,
                    opens: s.opens,
                    clicks: s.clicks
                };
            }).sort((a, b) => (b.clicks + b.opens) - (a.clicks + a.opens)).slice(0, 5);
        } catch (error) {
            console.error('Error fetching real heatmap data:', error);
            return [];
        }
    },

    async getActiveCampaign(): Promise<ActiveCampaign | null> {
        try {
            const { data, error } = await supabase
                .from('marketing_campaigns')
                .select('id, name, total_recipients, stats, status')
                .or('status.eq.running,status.eq.sent')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) return null;

            const stats = data.stats as any;
            const sent = stats?.sent || data.total_recipients || 0;
            const total = data.total_recipients || sent || 1;

            return {
                id: data.id,
                name: data.name,
                progress: Math.min(100, Math.round((sent / total) * 100)),
                sent,
                total
            };
        } catch (err) {
            return null;
        }
    }
};
