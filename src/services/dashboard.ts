import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { getCurrentUserCompanyId } from '../utils/auth';

/**
 * Optimized Dashboard Service
 * Uses single RPC call instead of 5 separate queries
 */
export const dashboardService = {
    /**
     * Get all dashboard statistics in a single query
     * @param startDate - Optional start date filter
     * @param endDate - Optional end date filter
     * @returns All dashboard data (stats, byStatus, bySource, byPriority, topOpportunities, upcomingFollowUps, recentConversions)
     */
    async getDashboardStats(startDate?: string, endDate?: string, companyId?: string) {
        try {
            const finalCompanyId = companyId || await getCurrentUserCompanyId();
            logger.debug('🔍 FETCHING OPTIMIZED DASHBOARD:', { companyId: finalCompanyId, startDate, endDate });

            logger.time('getDashboardStats');

            // Single RPC call for EVERYTHING
            const { data, error } = await supabase.rpc('get_dashboard_stats', {
                p_company_id: finalCompanyId,
                p_start_date: startDate || null,
                p_end_date: endDate || null
            });

            logger.timeEnd('getDashboardStats');

            if (error) {
                logger.error('Failed to fetch dashboard stats via RPC', error, {
                    action: 'getDashboardStats',
                    companyId: finalCompanyId
                });
                throw error;
            }

            // The RPC returns a single JSONB object with all keys
            return {
                stats: data?.stats || {
                    totalLeads: 0,
                    totalLeadsTrend: 0,
                    totalPipeline: 0,
                    totalPipelineTrend: 0,
                    wonDeals: 0,
                    wonDealsTrend: 0,
                    totalWonAmount: 0,
                    conversionRate: 0,
                    conversionRateTrend: 0,
                    erroneousLeads: 0,
                    erroneousLeadsTrend: 0
                },
                byStatus: data?.byStatus || [],
                bySource: data?.bySource || [],
                byPriority: data?.byPriority || [],
                topOpportunities: data?.topOpportunities || [],
                upcomingFollowUps: data?.upcomingFollowUps || [],
                recentConversions: data?.recentConversions || [],
                lossReasons: data?.lossReasons || [],
                lossStages: data?.lossStages || [],
                qualityTrend: data?.qualityTrend || [],
                salesKpis: data?.salesKpis || []
            };
        } catch (error) {
            logger.error('Unhandled error in getDashboardStats', error);
            throw error;
        }
    }

};
