import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { dashboardService } from '../services/dashboard';
import { logger } from '../utils/logger';

/**
 * Hook to fetch dashboard statistics using optimized SQL function
 * Automatically caches data for 5 minutes
 */
export function useDashboardStats(startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: queryKeys.dashboard.stats(startDate, endDate),
        queryFn: async () => {
            logger.debug('Fetching dashboard stats', { startDate, endDate });
            return dashboardService.getDashboardStats(startDate, endDate);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    });
}
