import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration
 * Optimized for CRM application with aggressive caching
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 5 minutes by default
            staleTime: 5 * 60 * 1000,

            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,

            // Retry failed requests 1 time
            retry: 1,

            // Refetch on window focus for fresh data
            refetchOnWindowFocus: true,

            // Don't refetch on mount if data is fresh
            refetchOnMount: false,

            // Don't refetch on reconnect if data is fresh
            refetchOnReconnect: false,
        },
        mutations: {
            // Retry failed mutations 0 times (user should retry manually)
            retry: 0,
        },
    },
});

/**
 * Query Keys Factory
 * Centralized query key management for type safety and consistency
 */
export const queryKeys = {
    // Dashboard queries
    dashboard: {
        all: ['dashboard'] as const,
        stats: (companyId: string, startDate?: string, endDate?: string) =>
            ['dashboard', 'stats', companyId, { startDate, endDate }] as const,
    },

    // Leads queries
    leads: {
        all: ['leads'] as const,
        list: (page = 1, pageSize = 50) =>
            ['leads', 'list', { page, pageSize }] as const,
        detail: (id: string) =>
            ['leads', 'detail', id] as const,
        followUps: (leadId: string) =>
            ['leads', 'followUps', leadId] as const,
    },

    // Team queries
    team: {
        all: ['team'] as const,
        members: () => ['team', 'members'] as const,
    },

    // Quotations queries
    quotations: {
        all: ['quotations'] as const,
        list: (page = 1) =>
            ['quotations', 'list', { page }] as const,
        detail: (id: string) =>
            ['quotations', 'detail', id] as const,
    },

    // Cotizador queries
    cotizador: {
        all: ['cotizador'] as const,
        packages: () => ['cotizador', 'packages'] as const,
        items: () => ['cotizador', 'items'] as const,
    },
};
