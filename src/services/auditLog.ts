import { supabase } from './supabase';

export interface AuditLogEntry {
    id: string;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
    user_role: string | null;
    company_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_name: string | null;
    description: string | null;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    metadata: Record<string, any>;
    created_at: string;
}

export interface AuditLogFilters {
    action?: string;
    entity_type?: string;
    user_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
}

export interface AuditLogStats {
    total_events: number;
    events_today: number;
    unique_users: number;
    top_actions: { action: string; count: number }[];
}

const PAGE_SIZE = 50;

export const auditLogService = {
    /**
     * Fetch paginated audit logs with optional filters
     */
    async getLogs(
        page: number = 0,
        filters: AuditLogFilters = {}
    ): Promise<{ data: AuditLogEntry[]; count: number }> {
        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (filters.action) {
            query = query.eq('action', filters.action);
        }
        if (filters.entity_type) {
            query = query.eq('entity_type', filters.entity_type);
        }
        if (filters.user_id) {
            query = query.eq('user_id', filters.user_id);
        }
        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to + 'T23:59:59');
        }
        if (filters.search) {
            query = query.or(
                `entity_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`
            );
        }

        const { data, error, count } = await query;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
    },

    /**
     * Get summary stats for the audit dashboard
     */
    async getStats(): Promise<AuditLogStats> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [totalRes, todayRes, usersRes] = await Promise.all([
            supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
            supabase
                .from('audit_logs')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', todayStart.toISOString()),
            supabase
                .from('audit_logs')
                .select('user_id')
                .not('user_id', 'is', null)
        ]);

        // Count unique users from the data
        const uniqueUsers = new Set(
            (usersRes.data || []).map((r: any) => r.user_id)
        ).size;

        return {
            total_events: totalRes.count || 0,
            events_today: todayRes.count || 0,
            unique_users: uniqueUsers,
            top_actions: [] // Will be computed client-side from logs
        };
    },

    /**
     * Get distinct entity types for filter dropdowns
     */
    async getEntityTypes(): Promise<string[]> {
        const { data } = await supabase
            .from('audit_logs')
            .select('entity_type')
            .limit(100);

        const types = [...new Set((data || []).map((d: any) => d.entity_type))];
        return types.sort();
    },

    /**
     * Manually log an event from the frontend (for actions like exports)
     */
    async logEvent(
        action: string,
        entityType: string,
        entityId?: string,
        entityName?: string,
        description?: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        await supabase.rpc('log_audit_event', {
            p_action: action,
            p_entity_type: entityType,
            p_entity_id: entityId || null,
            p_entity_name: entityName || null,
            p_description: description || null,
            p_old_values: null,
            p_new_values: null,
            p_metadata: metadata || {}
        });
    }
};
