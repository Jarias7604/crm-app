import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { dashboardService } from '../services/dashboard';
import { logger } from '../utils/logger';

/**
 * Hook to fetch dashboard statistics using optimized SQL function
 * Automatically caches data for 5 minutes
 * Supports multi-agent selection (assignedTo can be a string or string[])
 */
export function useDashboardStats(companyId?: string, startDate?: string, endDate?: string, assignedTo?: string | string[]) {
    // Normalize key for cache
    const assignedToKey = Array.isArray(assignedTo) ? assignedTo.sort().join(',') : (assignedTo || '');

    return useQuery({
        queryKey: queryKeys.dashboard.stats(companyId || 'no-company', startDate, endDate, assignedToKey),
        queryFn: async () => {
            logger.debug('Fetching dashboard stats', { companyId, startDate, endDate, assignedTo });
            return dashboardService.getDashboardStats(startDate, endDate, companyId, assignedTo);
        },
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000,    // 5 minutes
        placeholderData: keepPreviousData,
    });
}
