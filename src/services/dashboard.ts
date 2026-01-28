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
     * @returns All dashboard data (stats, byStatus, bySource, byPriority, topOpportunities)
     */
    async getDashboardStats(startDate?: string, endDate?: string) {
        try {
            const companyId = await getCurrentUserCompanyId();

            logger.time('getDashboardStats');

            const { data, error } = await supabase.rpc('get_dashboard_stats', {
                p_company_id: companyId,
                p_start_date: startDate || null,
                p_end_date: endDate || null
            });

            logger.timeEnd('getDashboardStats');

            if (error) {
                logger.error('Failed to fetch dashboard stats', error, {
                    action: 'getDashboardStats',
                    companyId,
                    startDate,
                    endDate
                });
                throw error;
            }

            logger.debug('Dashboard stats fetched successfully', {
                totalLeads: data?.stats?.totalLeads,
                hasData: !!data
            });

            return {
                stats: data?.stats || {
                    totalLeads: 0,
                    totalPipeline: 0,
                    wonDeals: 0,
                    conversionRate: 0
                },
                byStatus: data?.byStatus || [],
                bySource: data?.bySource || [],
                byPriority: data?.byPriority || [],
                topOpportunities: data?.topOpportunities || []
            };
        } catch (error) {
            logger.error('Unhandled error in getDashboardStats', error, {
                startDate,
                endDate
            });
            throw error;
        }
    }
};
