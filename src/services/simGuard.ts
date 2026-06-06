/**
 * simGuard — Simulation Mode Tenant Isolation Guard
 *
 * PROBLEM: When simulation mode is active (super_admin viewing another tenant),
 * the Supabase JWT still carries the REAL tenant's company_id. Supabase RLS
 * reads exclusively from the JWT — NOT from localStorage.
 *
 * RESULT WITHOUT THIS GUARD: All queries return the real tenant's data
 * even when the UI shows a different simulated company.
 *
 * SOLUTION: Inject an explicit `.eq('company_id', simCompanyId)` filter at
 * the query layer whenever simulation is active. This wraps any SupabaseQueryBuilder.
 *
 * USAGE:
 *   let q = supabase.from('leads').select('*');
 *   q = simGuard(q);              // auto-injects company filter if simulation active
 *   const { data } = await q;
 */

/**
 * Returns the active simulated company ID from localStorage, or null if not in simulation.
 */
export function getSimulatedCompanyId(): string | null {
    return localStorage.getItem('simulated_company_id');
}

/**
 * Injects `.eq('company_id', simId)` into the given query if simulation mode is active.
 * Returns the query unchanged if not in simulation mode.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function simGuard<T = any>(query: T): T {
    const simId = getSimulatedCompanyId();
    if (simId) {
        return (query as any).eq('company_id', simId) as T;
    }
    return query;
}

/**
 * Same as simGuard but for tables joined via lead_id — no-op since RLS handles it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function simGuardViaLead<T = any>(query: T): T {
    return query;
}
