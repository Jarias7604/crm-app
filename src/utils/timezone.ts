/**
 * Timezone utilities for the CRM SaaS.
 * Uses native Intl API — zero external dependencies.
 * 
 * The core problem:
 *   - User picks "10:30 AM" in El Salvador (UTC-6)
 *   - We must store "16:30:00Z" in Supabase (UTC)
 *   - When displaying, we convert UTC → company timezone
 */

/**
 * Converts a local datetime string (e.g. "2026-02-26T10:30")
 * interpreted in the given IANA timezone to a proper UTC ISO string.
 *
 * Works correctly for all IANA timezones, including DST-observing ones.
 *
 * @param localStr  - "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
 * @param ianaTimezone - e.g. "America/El_Salvador"
 * @returns ISO string in UTC, e.g. "2026-02-26T16:30:00.000Z"
 */
export function localToUtcISO(localStr: string, ianaTimezone: string): string {
    // Normalize: ensure seconds are present
    const normalized = localStr.length === 16 ? localStr + ':00' : localStr;

    // Step 1: Parse the localStr as if it were UTC (browser-agnostic)
    const fakeUtc = new Date(normalized + 'Z');

    // Step 2: Find what the timezone clock shows at this fake-UTC instant
    const tzFormatter = new Intl.DateTimeFormat('sv', {  // sv gives "YYYY-MM-DD HH:mm:ss"
        timeZone: ianaTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const tzDisplayStr = tzFormatter.format(fakeUtc);     // e.g. "2026-02-26 04:30:00"

    // Step 3: Compute the offset between what we want (input) and what Intl showed
    const shownAsUtcMs = new Date(tzDisplayStr.replace(' ', 'T') + 'Z').getTime();
    const offsetMs = fakeUtc.getTime() - shownAsUtcMs;   // e.g. +6h for El Salvador

    // Step 4: Apply offset to get the REAL UTC instant
    // i.e., when converted back to ianaTimezone, it WILL show the original localStr time
    return new Date(fakeUtc.getTime() + offsetMs).toISOString();
}

/**
 * Formats a UTC date string (from Supabase) in the given IANA timezone.
 *
 * @param utcStr       - ISO date string from DB, e.g. "2026-02-26T16:30:00+00"
 * @param ianaTimezone - e.g. "America/El_Salvador"
 * @param use12h       - true for "10:30 AM", false for "10:30"
 * @returns Formatted time string in the company's local timezone
 */
export function formatTimeInZone(
    utcStr: string,
    ianaTimezone: string,
    use12h = true
): string {
    return new Intl.DateTimeFormat('es', {
        timeZone: ianaTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: use12h,
    }).format(new Date(utcStr));
}

/**
 * Returns the day-only Date object in the company's timezone,
 * useful for isSameDay comparisons in the Calendar.
 *
 * @param utcStr       - ISO date string from DB
 * @param ianaTimezone - e.g. "America/El_Salvador"
 * @returns A Date object set to midnight of that local day (in local browser time)
 */
export function utcToLocalDate(utcStr: string, ianaTimezone: string): Date {
    const formatter = new Intl.DateTimeFormat('sv', {
        timeZone: ianaTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const localDateStr = formatter.format(new Date(utcStr)); // "YYYY-MM-DD"
    const [y, m, d] = localDateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);  // noon local — safe for isSameDay
}

/** Fallback timezone if company setting is not loaded yet */
export const DEFAULT_TIMEZONE = 'America/El_Salvador';
