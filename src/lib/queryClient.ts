import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration
 * Optimized for multi-tenant CRM — aggressive caching with tenant isolation
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 3 minutes (balance: freshness vs performance)
            staleTime: 3 * 60 * 1000,

            // Keep unused data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,

            // Retry failed requests once
            retry: 1,

            // Refetch on window focus — catches updates from other tabs
            refetchOnWindowFocus: true,

            // Always refetch on mount — ensures fresh data after navigation
            refetchOnMount: true,

            // Refetch on reconnect — catches updates after offline periods
            refetchOnReconnect: true,
        },
        mutations: {
            // No retry on mutations — user should decide
            retry: 0,
        },
    },
});

/**
 * Query Keys Factory — Multi-Tenant Safe
 *
 * ARCHITECTURE RULE: Every query key MUST include companyId.
 * This creates natural cache isolation between tenants:
 * - Company A's leads are cached under ['leads', 'list', 'companyA-id', ...]
 * - Company B's leads are cached under ['leads', 'list', 'companyB-id', ...]
 * - Even if queryClient.clear() is missed, different tenants NEVER share cache.
 *
 * This is Layer 2 of the multi-tenant cache safety system.
 * Layer 1: queryClient.clear() on user switch (AuthProvider.tsx)
 * Layer 2: companyId in all query keys (this file)
 * Layer 3: Loading gate — don't render until profile.company_id is confirmed
 */
export const queryKeys = {
    // Dashboard queries
    dashboard: {
        all: (companyId: string) => ['dashboard', companyId] as const,
        stats: (companyId: string, startDate?: string, endDate?: string, assignedTo?: string) =>
            ['dashboard', 'stats', companyId, { startDate, endDate, assignedTo }] as const,
    },

    // Leads queries
    leads: {
        all: (companyId: string) => ['leads', companyId] as const,
        list: (companyId: string, page = 1, pageSize = 50) =>
            ['leads', 'list', companyId, { page, pageSize }] as const,
        detail: (companyId: string, id: string) =>
            ['leads', 'detail', companyId, id] as const,
        followUps: (companyId: string, leadId: string) =>
            ['leads', 'followUps', companyId, leadId] as const,
    },

    // Team queries
    team: {
        all: (companyId: string) => ['team', companyId] as const,
        members: (companyId: string) => ['team', 'members', companyId] as const,
    },

    // Quotations queries
    quotations: {
        all: (companyId: string) => ['quotations', companyId] as const,
        list: (companyId: string, page = 1) =>
            ['quotations', 'list', companyId, { page }] as const,
        detail: (companyId: string, id: string) =>
            ['quotations', 'detail', companyId, id] as const,
    },

    // Cotizador queries
    cotizador: {
        all: (companyId: string) => ['cotizador', companyId] as const,
        packages: (companyId: string) => ['cotizador', 'packages', companyId] as const,
        items: (companyId: string) => ['cotizador', 'items', companyId] as const,
    },

    // Calendar / Follow-ups
    calendar: {
        all: (companyId: string) => ['calendar', companyId] as const,
        followUps: (companyId: string, startDate?: string, endDate?: string) =>
            ['calendar', 'followUps', companyId, { startDate, endDate }] as const,
    },

    // Notifications
    notifications: {
        all: (companyId: string) => ['notifications', companyId] as const,
    },

    // Marketing
    marketing: {
        all: (companyId: string) => ['marketing', companyId] as const,
        campaigns: (companyId: string) => ['marketing', 'campaigns', companyId] as const,
    },
};
