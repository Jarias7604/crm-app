import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { getCurrentUserCompanyId } from '../utils/auth';

const EMPTY_STATS = {
    stats: { totalLeads: 0, totalLeadsTrend: 0, totalPipeline: 0, totalPipelineTrend: 0, wonDeals: 0, wonDealsTrend: 0, totalWonAmount: 0, totalWonPotential: 0, conversionRate: 0, conversionRateTrend: 0, erroneousLeads: 0, erroneousLeadsTrend: 0 },
    byStatus: [], bySource: [], byPriority: [], topOpportunities: [],
    upcomingFollowUps: [], recentConversions: [], lossReasons: [],
    lossStages: [], qualityTrend: [], salesTrend: [], salesKpis: []
};

/**
 * Optimized Dashboard Service
 * Uses single RPC call instead of 5 separate queries
 * Supports multiple assignees by making parallel calls and merging results
 */
export const dashboardService = {
    /**
     * Get all dashboard statistics in a single query
     * @param startDate - Optional start date filter
     * @param endDate - Optional end date filter
     * @param companyId - Company ID
     * @param assignedTo - Single UUID or array of UUIDs (multi-select agents)
     * @returns All dashboard data merged across selected agents
     */
    async getDashboardStats(startDate?: string, endDate?: string, companyId?: string, assignedTo?: string | string[]) {
        try {
            const finalCompanyId = companyId || await getCurrentUserCompanyId();
            logger.debug('🔍 FETCHING OPTIMIZED DASHBOARD:', { companyId: finalCompanyId, startDate, endDate, assignedTo });

            // Normalize assignedTo to array (null = all agents)
            const agentIds: (string | null)[] = (() => {
                if (!assignedTo || (Array.isArray(assignedTo) && assignedTo.length === 0)) return [null];
                if (Array.isArray(assignedTo)) return assignedTo.length === 1 ? assignedTo : assignedTo;
                return [assignedTo];
            })();

            logger.time('getDashboardStats');

            // Parallel calls for each agent
            const results = await Promise.all(agentIds.map(agentId =>
                supabase.rpc('get_dashboard_stats', {
                    p_company_id: finalCompanyId,
                    p_start_date: startDate || null,
                    p_end_date: endDate || null,
                    p_assigned_to: agentId || null
                })
            ));

            logger.timeEnd('getDashboardStats');

            // Check for errors
            const hasError = results.some(r => r.error);
            if (hasError) {
                results.forEach(r => { if (r.error) logger.error('RPC error', r.error); });
                return EMPTY_STATS;
            }

            // If single agent (or all), return directly
            if (agentIds.length === 1) {
                const data = results[0].data;
                return {
                    stats: data?.stats || EMPTY_STATS.stats,
                    byStatus: data?.byStatus || [],
                    bySource: data?.bySource || [],
                    byPriority: data?.byPriority || [],
                    topOpportunities: data?.topOpportunities || [],
                    upcomingFollowUps: data?.upcomingFollowUps || [],
                    recentConversions: data?.recentConversions || [],
                    lossReasons: data?.lossReasons || [],
                    lossStages: data?.lossStages || [],
                    qualityTrend: data?.qualityTrend || [],
                    salesTrend: data?.salesTrend || [],
                    salesKpis: data?.salesKpis || []
                };
            }

            // Multiple agents: merge results
            const datasets = results.map(r => r.data);

            // Merge stats (sum numeric values)
            const mergedStats = datasets.reduce((acc: any, d: any) => {
                const s = d?.stats || {};
                return {
                    totalLeads: (acc.totalLeads || 0) + (s.totalLeads || 0),
                    totalLeadsTrend: 0,
                    totalPipeline: (acc.totalPipeline || 0) + (s.totalPipeline || 0),
                    totalPipelineTrend: 0,
                    wonDeals: (acc.wonDeals || 0) + (s.wonDeals || 0),
                    wonDealsTrend: 0,
                    totalWonAmount: (acc.totalWonAmount || 0) + (s.totalWonAmount || 0),
                    totalWonPotential: (acc.totalWonPotential || 0) + (s.totalWonPotential || 0),
                    conversionRate: 0, // computed below
                    conversionRateTrend: 0,
                    erroneousLeads: (acc.erroneousLeads || 0) + (s.erroneousLeads || 0),
                    erroneousLeadsTrend: 0,
                };
            }, {});

            // Compute combined conversionRate
            mergedStats.conversionRate = mergedStats.totalLeads > 0
                ? Math.round((mergedStats.wonDeals / mergedStats.totalLeads) * 100)
                : 0;

            // Merge byStatus (group by status name, sum values)
            const statusMap: Record<string, { name: string; value: number; amount: number }> = {};
            datasets.forEach((d: any) => {
                (d?.byStatus || []).forEach((s: any) => {
                    if (!statusMap[s.name]) statusMap[s.name] = { name: s.name, value: 0, amount: 0 };
                    statusMap[s.name].value += s.value || 0;
                    statusMap[s.name].amount += s.amount || 0;
                });
            });

            // Merge bySource
            const sourceMap: Record<string, { name: string; value: number }> = {};
            datasets.forEach((d: any) => {
                (d?.bySource || []).forEach((s: any) => {
                    if (!sourceMap[s.name]) sourceMap[s.name] = { name: s.name, value: 0 };
                    sourceMap[s.name].value += s.value || 0;
                });
            });

            // Merge byPriority
            const priorityMap: Record<string, { name: string; value: number }> = {};
            datasets.forEach((d: any) => {
                (d?.byPriority || []).forEach((p: any) => {
                    if (!priorityMap[p.name]) priorityMap[p.name] = { name: p.name, value: 0 };
                    priorityMap[p.name].value += p.value || 0;
                });
            });

            // Calculate correct monthly conversion rate for each month across agents
            const monthlyRates: Record<string, number[]> = {};
            datasets.forEach((d: any) => {
                const agentRatesByMonth: Record<string, number> = {};
                (d?.salesTrend || []).forEach((t: any) => {
                    const monthKey = t.date.substring(0, 7); // "yyyy-MM"
                    if (t.conversionRate !== undefined && t.conversionRate !== null) {
                        agentRatesByMonth[monthKey] = t.conversionRate;
                    }
                });
                Object.entries(agentRatesByMonth).forEach(([monthKey, rate]) => {
                    if (!monthlyRates[monthKey]) monthlyRates[monthKey] = [];
                    monthlyRates[monthKey].push(rate);
                });
            });

            const monthlyAverageRate: Record<string, number> = {};
            Object.entries(monthlyRates).forEach(([monthKey, rates]) => {
                const sum = rates.reduce((a, b) => a + b, 0);
                monthlyAverageRate[monthKey] = rates.length > 0 ? Math.round(sum / rates.length) : 0;
            });

            // Merge salesTrend by date
            const trendMap: Record<string, { date: string; amount: number; count: number }> = {};
            datasets.forEach((d: any) => {
                (d?.salesTrend || []).forEach((t: any) => {
                    if (!trendMap[t.date]) trendMap[t.date] = { date: t.date, amount: 0, count: 0 };
                    trendMap[t.date].amount += t.amount || 0;
                    trendMap[t.date].count += t.count || 0;
                });
            });

            const mergedSalesTrend = Object.values(trendMap)
                .map(t => {
                    const monthKey = t.date.substring(0, 7);
                    return {
                        date: t.date,
                        amount: t.amount,
                        count: t.count,
                        conversionRate: monthlyAverageRate[monthKey] !== undefined ? monthlyAverageRate[monthKey] : 0
                    };
                })
                .sort((a, b) => a.date.localeCompare(b.date));

            // Merge qualityTrend by date
            const qualityMap: Record<string, { date: string; count: number }> = {};
            datasets.forEach((d: any) => {
                (d?.qualityTrend || []).forEach((q: any) => {
                    if (!qualityMap[q.date]) qualityMap[q.date] = { date: q.date, count: 0 };
                    qualityMap[q.date].count += q.count || 0;
                });
            });

            // Merge followups (deduplicate by id)
            const followupMap: Record<string, any> = {};
            datasets.forEach((d: any) => {
                (d?.upcomingFollowUps || []).forEach((f: any) => { followupMap[f.id] = f; });
            });

            // Merge conversions (deduplicate by id)
            const conversionMap: Record<string, any> = {};
            datasets.forEach((d: any) => {
                (d?.recentConversions || []).forEach((c: any) => { conversionMap[c.id] = c; });
            });

            // Merge opportunities (deduplicate by id)
            const oppMap: Record<string, any> = {};
            datasets.forEach((d: any) => {
                (d?.topOpportunities || []).forEach((o: any) => { oppMap[o.id] = o; });
            });

            // Merge salesKpis (combine by agent)
            const kpiMap: Record<string, any> = {};
            datasets.forEach((d: any) => {
                (d?.salesKpis || []).forEach((k: any) => {
                    if (!kpiMap[k.agent_name]) kpiMap[k.agent_name] = { ...k };
                    else {
                        kpiMap[k.agent_name].actual += k.actual || 0;
                        kpiMap[k.agent_name].target += k.target || 0;
                        kpiMap[k.agent_name].percentage = kpiMap[k.agent_name].target > 0
                            ? Math.round((kpiMap[k.agent_name].actual / kpiMap[k.agent_name].target) * 100)
                            : 0;
                    }
                });
            });

            return {
                stats: mergedStats,
                byStatus: Object.values(statusMap),
                bySource: Object.values(sourceMap).sort((a, b) => b.value - a.value),
                byPriority: Object.values(priorityMap),
                topOpportunities: Object.values(oppMap).sort((a: any, b: any) => (b.value || 0) - (a.value || 0)).slice(0, 4),
                upcomingFollowUps: Object.values(followupMap).sort((a: any, b: any) => new Date(a.next_followup_date).getTime() - new Date(b.next_followup_date).getTime()).slice(0, 10),
                recentConversions: Object.values(conversionMap).sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 15),
                lossReasons: datasets[0]?.lossReasons || [],
                lossStages: datasets[0]?.lossStages || [],
                qualityTrend: Object.values(qualityMap).sort((a, b) => a.date.localeCompare(b.date)),
                salesTrend: mergedSalesTrend,
                salesKpis: Object.values(kpiMap)
            };

        } catch (error) {
            logger.error('Unhandled error in getDashboardStats', error);
            return EMPTY_STATS;
        }
    }

};
