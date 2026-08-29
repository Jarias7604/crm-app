/**
 * Shared ChatHub conversation cache
 * 
 * Lives outside ChatHub.tsx so Sidebar can write to it (hover prefetch)
 * and ChatHub can read from it (instant display on navigation).
 * 
 * Pattern: Gmail-style hover prefetch — when user hovers over ''Mensajes''
 * the fetch starts before they click, eliminating perceived load time.
 */
import type { ChatConversation } from './chatService';

export const CONV_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export const convCache: {
    data: ChatConversation[];
    companyId: string | null;
    ts: number;
    pending: boolean;
} = {
    data: [],
    companyId: null,
    ts: 0,
    pending: false,
};

/**
 * Trigger a background fetch of conversations for a given companyId.
 * Safe to call multiple times — no-ops if cache is fresh or fetch is in progress.
 */
export function prefetchConversations(companyId: string | undefined | null): void {
    if (!companyId) return;

    // Already have fresh data for this company
    if (
        convCache.companyId === companyId &&
        Date.now() - convCache.ts < CONV_CACHE_TTL_MS &&
        convCache.data.length > 0
    ) return;

    // Fetch already in progress
    if (convCache.pending) return;

    convCache.pending = true;

    // Dynamic import to avoid circular deps — chatService imports supabase, not vice versa
    import('./chatService')
        .then(({ chatService }) => chatService.getConversations(companyId))
        .then(data => {
            if (data && data.length > 0) {
                convCache.data = data;
                convCache.companyId = companyId;
                convCache.ts = Date.now();
            }
        })
        .catch(() => {}) // Silent fail — prefetch is best-effort
        .finally(() => { convCache.pending = false; });
}
