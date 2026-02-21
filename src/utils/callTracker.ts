/**
 * callTracker — Click-to-Call timestamp bridge for mobile devices.
 *
 * When a user taps the phone button on mobile:
 *   1. We save the exact start timestamp to localStorage BEFORE the dialer opens.
 *   2. The browser goes to background while the call happens.
 *   3. On return, Leads.tsx detects `visibilitychange` → reads the timestamp
 *      → auto-opens QuickActionLogger with the real call duration.
 *
 * localStorage persists during background → this captures real call duration
 * even though the browser was sleeping.
 */

const KEY = 'crm_pending_call';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — stale after this

export interface PendingCall {
    leadId: string;
    startedAt: number; // Date.now() timestamp (ms)
}

export const callTracker = {
    /** Call this RIGHT BEFORE opening tel:// — records the exact call start */
    start(leadId: string): void {
        const call: PendingCall = { leadId, startedAt: Date.now() };
        localStorage.setItem(KEY, JSON.stringify(call));
    },

    /** Returns the pending call, or null if none / expired */
    getPending(): PendingCall | null {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return null;
            const call = JSON.parse(raw) as PendingCall;
            if (Date.now() - call.startedAt > MAX_AGE_MS) {
                localStorage.removeItem(KEY);
                return null;
            }
            return call;
        } catch {
            return null;
        }
    },

    /** Duration in seconds from when the call started until now */
    getDurationSeconds(): number {
        const call = this.getPending();
        if (!call) return 0;
        return Math.round((Date.now() - call.startedAt) / 1000);
    },

    /** Clear the pending call after it's been handled */
    clear(): void {
        localStorage.removeItem(KEY);
    },
};
