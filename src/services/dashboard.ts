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
            console.log('🔍 FETCHING DASHBOARD STATS:', { companyId: finalCompanyId, startDate, endDate });

            logger.time('getDashboardStats');

            // 1. Fetch main stats via RPC
            const { data, error } = await supabase.rpc('get_dashboard_stats', {
                p_company_id: finalCompanyId,
                p_start_date: startDate || null,
                p_end_date: endDate || null
            });

            console.log('✅ RPC DASHBOARD RESPONSE:', data);

            // 2. Fetch upcoming follow-ups manually since we can't update the RPC
            const { data: upcomingFollowUps } = await supabase
                .from('leads')
                .select('id, name, next_followup_date, next_action_notes, priority')
                .eq('company_id', finalCompanyId)
                .not('next_followup_date', 'is', null)
                .gte('next_followup_date', new Date().toISOString().split('T')[0])
                .order('next_followup_date', { ascending: true })
                .limit(5);

            // 3. Fetch recent conversions
            const { data: recentConversions } = await supabase
                .from('leads')
                .select('id, name, company_name, value, closing_amount, created_at')
                .eq('company_id', finalCompanyId)
                .in('status', ['Cerrado', 'Cliente'])
                .order('created_at', { ascending: false })
                .limit(5);

            // 4. Fetch top opportunities with source manually since RPC is missing it
            const { data: topOpportunitiesManual } = await supabase
                .from('leads')
                .select('id, name, company_name, value, status, priority, source, created_at')
                .eq('company_id', finalCompanyId)
                .gt('value', 0)
                .order('value', { ascending: false })
                .limit(5);

            logger.timeEnd('getDashboardStats');

            if (error) {
                logger.error('Failed to fetch dashboard stats', error, {
                    action: 'getDashboardStats',
                    companyId: finalCompanyId,
                    startDate,
                    endDate
                });
                throw error;
            }

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
                topOpportunities: topOpportunitiesManual || [],
                upcomingFollowUps: upcomingFollowUps || [],
                recentConversions: recentConversions || []
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
