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
    engagementScore: number;
}

export interface ActiveCampaign {
    id: string;
    name: string;
    progress: number;
    sent: number;
    total: number;
}

export const marketingStatsService = {
    async getOverviewStats(campaignId?: string): Promise<MarketingStats> {
        // 1. Get total impacts from campaigns
        let campaignQuery = supabase
            .from('marketing_campaigns')
            .select('stats, total_recipients');

        if (campaignId) {
            campaignQuery = campaignQuery.eq('id', campaignId);
        }

        const { data: campaigns } = await campaignQuery;

        let totalRecipients = 0;
        if (campaignId) {
            // For a single campaign, get real-time sent count from marketing_messages
            const { count } = await supabase
                .from('marketing_messages')
                .select('id', { count: 'exact', head: true })
                .eq('metadata->>campaign_id', campaignId);
            totalRecipients = count || campaigns?.[0]?.total_recipients || 0;
        } else {
            totalRecipients = campaigns?.reduce((acc, c) => acc + (c.total_recipients || 0), 0) || 0;
        }

        // Get leads associated with this campaign (if campaignId is provided)
        let eligibleLeadIds: string[] = [];
        if (campaignId) {
            const { data: campaignMsgs } = await supabase
                .from('marketing_messages')
                .select('metadata')
                .eq('metadata->>campaign_id', campaignId);
            
            const ids = (campaignMsgs || []).map(m => (m.metadata as any)?.lead_id).filter(Boolean);
            eligibleLeadIds = Array.from(new Set(ids)) as string[];
        }

        // 2. Get Opportunities & Pipeline from cotizaciones
        let quotesQuery = supabase
            .from('cotizaciones')
            .select('id, total_anual, lead_id, estado');

        if (campaignId && eligibleLeadIds.length > 0) {
            quotesQuery = quotesQuery.in('lead_id', eligibleLeadIds);
        } else if (campaignId && eligibleLeadIds.length === 0) {
            // No messages sent yet for this campaign, so 0 conversions
            return {
                totalImpacts: totalRecipients,
                impactTrend: '0%',
                opportunities: 0,
                opportunityTrend: '0',
                pipelineValue: 0,
                pipelineTrend: '0%',
                conversionRate: 0,
                conversionTrend: '0%',
                opportunityLeadIds: [],
                convertedLeadIds: []
            };
        }

        const { data: quotes } = await quotesQuery;

        const totalPipeline = quotes?.reduce((acc, q) => acc + Number(q.total_anual || 0), 0) || 0;
        const opportunityLeadIds = Array.from(new Set(quotes?.map(q => q.lead_id).filter(Boolean))) as string[];
        const conversionLeadIds = Array.from(new Set(quotes?.filter(q => q.estado === 'aceptada').map(q => q.lead_id).filter(Boolean))) as string[];

        const conversionRate = totalRecipients > 0
            ? Math.min(100, Math.round((opportunityLeadIds.length / totalRecipients) * 100))
            : 0;

        return {
            totalImpacts: totalRecipients,
            impactTrend: campaignId ? 'Camp. Activa' : '+12%',
            opportunities: opportunityLeadIds.length,
            opportunityTrend: campaignId ? 'De esta Camp.' : '+5',
            pipelineValue: totalPipeline,
            pipelineTrend: campaignId ? 'Retorno' : '+18%',
            conversionRate: conversionRate,
            conversionTrend: campaignId ? 'Ratio' : '+2.4%',
            opportunityLeadIds,
            convertedLeadIds: conversionLeadIds
        };
    },

    async getHeatmapLeads(campaignId?: string): Promise<HeatmapLead[]> {
        try {
            // 1. Get real data from marketing_messages
            let query = supabase
                .from('marketing_messages')
                .select('metadata, status')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (campaignId) {
                query = query.eq('metadata->>campaign_id', campaignId);
            }

            const { data: realStats, error: statsError } = await query;

            if (statsError) throw statsError;

            // Aggregate stats in memory
            const statsMap: Record<string, { sent: number, opens: number, clicks: number }> = {};

            realStats.forEach(msg => {
                const leadId = (msg.metadata as any)?.lead_id;
                const status = (msg as any).status;

                if (!leadId || !statsMap[leadId]) {
                    if (leadId) statsMap[leadId] = { sent: 0, opens: 0, clicks: 0 };
                    else return;
                }

                statsMap[leadId].sent++;
                if (status === 'opened' || status === 'read' || status === 'clicked') statsMap[leadId].opens++;
                if (status === 'clicked') statsMap[leadId].clicks++;
            });

            const leadIds = Object.keys(statsMap);
            if (leadIds.length === 0) {
                if (campaignId) {
                    return [];
                }
                // Fallback to most recent leads
                const { data: recentLeads } = await supabase.from('leads').select('id, name, email').limit(20);
                return (recentLeads || []).map(l => ({
                    id: l.id,
                    name: l.name || 'Sin nombre',
                    email: l.email || '-',
                    sent: 0, opens: 0, clicks: 0, engagementScore: 0
                }));
            }

            // Get lead details
            const { data: leads, error: leadsError } = await supabase
                .from('leads')
                .select('id, name, email, engagement_score')
                .in('id', leadIds);

            if (leadsError) throw leadsError;

            const realLeads = (leads || []).map(l => ({
                id: l.id,
                name: l.name || 'Cliente',
                email: l.email || '-',
                sent: statsMap[l.id]?.sent || 0,
                opens: statsMap[l.id]?.opens || 0,
                clicks: statsMap[l.id]?.clicks || 0,
                engagementScore: (l as any).engagement_score || 0
            }));

            // Complete with recent leads up to 20 total
            if (!campaignId && realLeads.length < 20) {
                const { data: moreLeads } = await supabase
                    .from('leads')
                    .select('id, name, email')
                    .not('id', 'in', `(${leadIds.join(',')})`)
                    .order('created_at', { ascending: false })
                    .limit(20 - realLeads.length);

                const additionalLeads = (moreLeads || []).map(l => ({
                    id: l.id,
                    name: l.name || 'Sin nombre',
                    email: l.email || '-',
                    sent: 0, opens: 0, clicks: 0, engagementScore: 0
                }));

                return [...realLeads, ...additionalLeads].sort((a, b) => (b.clicks + b.opens) - (a.clicks + a.opens));
            }

            return realLeads.sort((a, b) => (b.clicks + b.opens) - (a.clicks + a.opens));
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
