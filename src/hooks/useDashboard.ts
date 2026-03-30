import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { dashboardService } from '../services/dashboard';
import { logger } from '../utils/logger';

/**
 * Hook to fetch dashboard statistics using optimized SQL function
 * Automatically caches data for 5 minutes
 */
export function useDashboardStats(companyId?: string, startDate?: string, endDate?: string, assignedTo?: string) {
    return useQuery({
        queryKey: queryKeys.dashboard.stats(companyId || 'no-company', startDate, endDate, assignedTo),
        queryFn: async () => {
            logger.debug('Fetching dashboard stats', { companyId, startDate, endDate, assignedTo });
            return dashboardService.getDashboardStats(startDate, endDate, companyId, assignedTo);
        },
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000, // 2 minutes — dashboard data doesn't change rapidly
        gcTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: keepPreviousData,
    });
}
