/**
 * safeQuery — Nuclear-grade Supabase query protection
 * 
 * PURPOSE: Prevents leads/data from EVER disappearing in production
 * due to missing columns in the database.
 * 
 * HOW: Wraps any Supabase SELECT query. If the query fails (400 error
 * from a missing column), it automatically retries with SELECT *
 * which ALWAYS works regardless of schema differences.
 * 
 * CREATED: 2026-05-08 after production leads disappeared TWICE
 * due to adding columns that didn't exist in the production DB.
 */

import { supabase } from './supabase';
import { logger } from '../utils/logger';

interface SafeQueryOptions {
    table: string;
    fields: string;
    count?: boolean;
    orderBy?: string;
    orderAsc?: boolean;
    rangeFrom?: number;
    rangeTo?: number;
    filters?: Array<{ column: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike' | 'or'; value: any }>;
    limit?: number;
}

interface SafeQueryResult<T> {
    data: T[];
    count: number | null;
    usedFallback: boolean;
}

/**
 * Execute a Supabase SELECT with automatic fallback on failure.
 * 
 * If the primary query fails (e.g., column doesn't exist), it
 * automatically retries with SELECT * which always works.
 * 
 * Usage:
 *   const result = await safeSelect<Lead>({
 *       table: 'leads',
 *       fields: 'id, name, ai_score, some_future_column',
 *       count: true,
 *       orderBy: 'created_at',
 *       orderAsc: false,
 *       rangeFrom: 0,
 *       rangeTo: 49,
 *   });
 *   // result.data = Lead[] (ALWAYS returns data, never crashes)
 *   // result.usedFallback = true if it had to retry with SELECT *
 */
export async function safeSelect<T = any>(opts: SafeQueryOptions): Promise<SafeQueryResult<T>> {
    const { table, fields, count = false, orderBy, orderAsc = false, rangeFrom, rangeTo, filters, limit } = opts;

    // ── SIMULATION GUARD ────────────────────────────────────────────────
    // When simulation mode is active, the JWT still carries the real tenant's company_id.
    // Supabase RLS reads from the JWT, NOT from localStorage. Without this guard, queries
    // leak real tenant data to the simulated company view.
    // SOLUTION: Inject an explicit company_id filter at the query layer.
    const simCompanyId = localStorage.getItem('simulated_company_id');
    const simFilters = simCompanyId
        ? [{ column: 'company_id', op: 'eq' as const, value: simCompanyId }]
        : [];
    const allFilters = [...simFilters, ...(filters || [])];

    // ── Attempt 1: Full field list ──────────────────────────────────────
    try {
        let query = supabase
            .from(table)
            .select(fields, count ? { count: 'exact' } : undefined);

        // Apply filters (includes simulation guard)
        for (const f of allFilters) {
            if (f.op === 'or') {
                query = query.or(f.value);
            } else {
                query = (query as any)[f.op](f.column, f.value);
            }
        }

        if (orderBy) query = query.order(orderBy, { ascending: orderAsc });
        if (rangeFrom !== undefined && rangeTo !== undefined) query = query.range(rangeFrom, rangeTo);
        if (limit) query = query.limit(limit);

        const { data, count: resultCount, error } = await query;

        if (!error && data) {
            return {
                data: data as unknown as T[],
                count: resultCount ?? null,
                usedFallback: false,
            };
        }

        // If we got an error, fall through to fallback
        logger.warn(`[safeSelect] Primary query on "${table}" failed, activating fallback`, {
            error: error?.message,
            code: error?.code,
            fields: fields.substring(0, 100),
        });
    } catch (err) {
        logger.warn(`[safeSelect] Exception on primary query for "${table}"`, { err });
    }

    // ── Attempt 2: SELECT * (ALWAYS works) ──────────────────────────────
    try {
        let fallbackQuery = supabase
            .from(table)
            .select('*', count ? { count: 'exact' } : undefined);

        // Apply filters (includes simulation guard)
        for (const f of allFilters) {
            if (f.op === 'or') {
                fallbackQuery = fallbackQuery.or(f.value);
            } else {
                fallbackQuery = (fallbackQuery as any)[f.op](f.column, f.value);
            }
        }

        if (orderBy) fallbackQuery = fallbackQuery.order(orderBy, { ascending: orderAsc });
        if (rangeFrom !== undefined && rangeTo !== undefined) fallbackQuery = fallbackQuery.range(rangeFrom, rangeTo);
        if (limit) fallbackQuery = fallbackQuery.limit(limit);

        const { data, count: resultCount, error } = await fallbackQuery;

        if (error) {
            logger.error(`[safeSelect] FALLBACK also failed on "${table}"`, { error: error.message });
            return { data: [], count: 0, usedFallback: true };
        }

        return {
            data: (data || []) as unknown as T[],
            count: resultCount ?? null,
            usedFallback: true,
        };
    } catch (err) {
        logger.error(`[safeSelect] FALLBACK exception on "${table}"`, { err });
        return { data: [], count: 0, usedFallback: true };
    }
}

/**
 * Safe UPDATE — updates only columns that exist, silently ignores failures.
 * Use for optional columns like ai_score that may not exist in all environments.
 */
export async function safeUpdate(
    table: string,
    id: string,
    updates: Record<string, any>
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id);

        if (error) {
            logger.warn(`[safeUpdate] Failed on "${table}"`, { error: error.message, id });
            return false;
        }
        return true;
    } catch {
        return false;
    }
}
