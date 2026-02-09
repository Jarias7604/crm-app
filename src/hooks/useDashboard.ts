import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { dashboardService } from '../services/dashboard';
import { logger } from '../utils/logger';

/**
 * Hook to fetch dashboard statistics using optimized SQL function
 * Automatically caches data for 5 minutes
 */
export function useDashboardStats(companyId?: string, startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: queryKeys.dashboard.stats(companyId || 'no-company', startDate, endDate),
        queryFn: async () => {
            logger.debug('Fetching dashboard stats', { companyId, startDate, endDate });
            return dashboardService.getDashboardStats(startDate, endDate, companyId);
        },
        enabled: !!companyId,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: keepPreviousData,
    });
}
