import { supabase } from './supabase';

// === TYPES ===

export type CallOutcome = 'connected' | 'no_answer' | 'voicemail' | 'busy' | 'wrong_number' | 'scheduled';

export type ActionType = 'call' | 'email' | 'whatsapp' | 'telegram' | 'quote_sent' | 'info_sent' | 'meeting';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

export interface CallActivity {
    id: string;
    company_id: string;
    user_id: string;
    lead_id: string;
    call_date: string;
    duration_seconds: number | null;
    outcome: CallOutcome;
    action_type: ActionType;
    notes: string | null;
    status_before: string | null;
    status_after: string | null;
    created_at: string;
}

export interface CallGoal {
    id: string;
    company_id: string;
    user_id: string | null;
    team_id: string | null;
    daily_call_goal: number;
    goal_target: number | null;
    goal_period: GoalPeriod;
    action_type: ActionType | null;
    created_at: string;
    updated_at: string;
}

export interface CallActivitySummary {
    user_id: string;
    calls_total: number;
    calls_connected: number;
    calls_no_answer: number;
    calls_voicemail: number;
    calls_busy: number;
    calls_wrong_number: number;
    unique_leads_called: number;
    leads_with_status_change: number;
    connect_rate: number;
}

export interface ContactActivitySummary {
    user_id: string;
    action_type: ActionType;
    total_actions: number;
    actions_connected: number;
    actions_no_answer: number;
    unique_leads: number;
    leads_with_status_change: number;
    avg_duration_seconds: number;
}

export interface DailyCallBreakdown {
    date: string;
    calls: number;
    connected: number;
}

// UI Constants
export const ACTION_TYPE_CONFIG: Record<ActionType, { label: string; icon: string; color: string; bgColor: string }> = {
    call: { label: 'Llamada', icon: '📞', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    email: { label: 'Email', icon: '📧', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    whatsapp: { label: 'WhatsApp', icon: '💬', color: 'text-green-700', bgColor: 'bg-green-100' },
    telegram: { label: 'Telegram', icon: '✈️', color: 'text-sky-700', bgColor: 'bg-sky-100' },
    quote_sent: { label: 'Cotización', icon: '📋', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    info_sent: { label: 'Info Enviada', icon: '📄', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    meeting: { label: 'Reunión', icon: '🤝', color: 'text-rose-700', bgColor: 'bg-rose-100' },
};

export const CALL_OUTCOME_CONFIG: Record<CallOutcome, { label: string; icon: string; color: string; bgColor: string }> = {
    connected: { label: 'Conectada', icon: '✅', color: 'text-green-700', bgColor: 'bg-green-100' },
    no_answer: { label: 'Sin respuesta', icon: '📵', color: 'text-orange-700', bgColor: 'bg-orange-100' },
    voicemail: { label: 'Buzón de voz', icon: '📩', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    busy: { label: 'Ocupado', icon: '🔴', color: 'text-red-700', bgColor: 'bg-red-100' },
    wrong_number: { label: 'Número equivocado', icon: '❌', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    scheduled: { label: 'Programada', icon: '📅', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

export const GOAL_PERIOD_CONFIG: Record<GoalPeriod, { label: string; shortLabel: string }> = {
    daily: { label: 'Diaria', shortLabel: '/día' },
    weekly: { label: 'Semanal', shortLabel: '/sem' },
    monthly: { label: 'Mensual', shortLabel: '/mes' },
};

// === SERVICE ===

export const callActivityService = {

    /**
     * Log a new contact activity (call, email, whatsapp, etc.)
     */
    async logCall(data: {
        companyId: string;
        leadId: string;
        outcome: CallOutcome;
        actionType?: ActionType;
        notes?: string;
        statusBefore?: string;
        statusAfter?: string;
        durationSeconds?: number;
    }): Promise<CallActivity> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: result, error } = await supabase
            .from('call_activities')
            .insert({
                company_id: data.companyId,
                user_id: user.id,
                lead_id: data.leadId,
                call_date: new Date().toISOString(),
                outcome: data.outcome,
                action_type: data.actionType || 'call',
                notes: data.notes || null,
                status_before: data.statusBefore || null,
                status_after: data.statusAfter || null,
                duration_seconds: data.durationSeconds || null,
            })
            .select()
            .single();

        if (error) throw error;
        return result;
    },

    /**
     * Get multi-channel contact summary using the new RPC function
     */
    async getContactSummary(companyId: string, dateFrom?: string, dateTo?: string): Promise<ContactActivitySummary[]> {
        const { data, error } = await supabase.rpc('get_contact_activity_summary', {
            p_company_id: companyId,
            p_date_from: dateFrom || null,
            p_date_to: dateTo || null,
        });

        if (error) {
            console.error('Error fetching contact summary:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Get call activities for a specific lead
     */
    async getLeadCalls(leadId: string): Promise<CallActivity[]> {
        const { data, error } = await supabase
            .from('call_activities')
            .select('*')
            .eq('lead_id', leadId)
            .order('call_date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Get call activities for the company within a date range
     */
    async getCompanyCalls(companyId: string, dateFrom?: string, dateTo?: string): Promise<CallActivity[]> {
        let query = supabase
            .from('call_activities')
            .select('*')
            .eq('company_id', companyId)
            .order('call_date', { ascending: false });

        if (dateFrom) query = query.gte('call_date', dateFrom);
        if (dateTo) query = query.lte('call_date', dateTo);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Get aggregated call summary using the RPC function
     */
    async getCallSummary(companyId: string, dateFrom?: string, dateTo?: string): Promise<CallActivitySummary[]> {
        const { data, error } = await supabase.rpc('get_call_activity_summary', {
            p_company_id: companyId,
            p_date_from: dateFrom || null,
            p_date_to: dateTo || null,
        });

        if (error) {
            console.error('Error fetching call summary:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Get today's call count for the current user (quick KPI)
     */
    async getTodayCallCount(companyId: string): Promise<{ total: number; connected: number; goal: number }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { total: 0, connected: 0, goal: 0 };

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: calls, error } = await supabase
            .from('call_activities')
            .select('outcome')
            .eq('company_id', companyId)
            .eq('user_id', user.id)
            .gte('call_date', todayStart.toISOString());

        if (error) {
            console.error('Error fetching today calls:', error);
            return { total: 0, connected: 0, goal: 0 };
        }

        const total = calls?.length || 0;
        const connected = calls?.filter(c => c.outcome === 'connected').length || 0;

        // Get user's daily goal
        const { data: goalData } = await supabase
            .from('call_goals')
            .select('daily_call_goal')
            .eq('company_id', companyId)
            .eq('user_id', user.id)
            .maybeSingle();

        return {
            total,
            connected,
            goal: goalData?.daily_call_goal || 0,
        };
    },

    /**
     * Get daily breakdown for charts (last N days)
     */
    async getDailyBreakdown(companyId: string, userId?: string, days: number = 7): Promise<DailyCallBreakdown[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        let query = supabase
            .from('call_activities')
            .select('call_date, outcome')
            .eq('company_id', companyId)
            .gte('call_date', startDate.toISOString())
            .order('call_date', { ascending: true });

        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching daily breakdown:', error);
            return [];
        }

        // Group by date
        const byDate: Record<string, { calls: number; connected: number }> = {};

        // Initialize all days
        for (let d = 0; d < days; d++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + d);
            const key = date.toISOString().split('T')[0];
            byDate[key] = { calls: 0, connected: 0 };
        }

        // Fill with actual data
        data?.forEach(call => {
            const key = call.call_date.split('T')[0];
            if (byDate[key]) {
                byDate[key].calls++;
                if (call.outcome === 'connected') byDate[key].connected++;
            }
        });

        return Object.entries(byDate).map(([date, stats]) => ({
            date,
            calls: stats.calls,
            connected: stats.connected,
        }));
    },

    // === GOALS MANAGEMENT ===

    /**
     * Get all call goals for a company
     */
    async getGoals(companyId: string): Promise<CallGoal[]> {
        const { data, error } = await supabase
            .from('call_goals')
            .select('*')
            .eq('company_id', companyId);

        if (error) {
            console.error('Error fetching call goals:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Save user contact goals (upsert) with dynamic periods
     */
    async saveUserGoals(
        companyId: string,
        userGoals: { user_id: string; daily_call_goal: number; goal_period?: GoalPeriod }[]
    ): Promise<void> {
        for (const goal of userGoals) {
            const period = goal.goal_period || 'daily';
            // Skip if goal is 0 — delete existing
            if (goal.daily_call_goal === 0) {
                await supabase
                    .from('call_goals')
                    .delete()
                    .eq('company_id', companyId)
                    .eq('user_id', goal.user_id)
                    .is('team_id', null);
                continue;
            }

            const { data: existing } = await supabase
                .from('call_goals')
                .select('id')
                .eq('company_id', companyId)
                .eq('user_id', goal.user_id)
                .is('team_id', null)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('call_goals')
                    .update({
                        daily_call_goal: goal.daily_call_goal,
                        goal_target: goal.daily_call_goal,
                        goal_period: period,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('call_goals').insert({
                    company_id: companyId,
                    user_id: goal.user_id,
                    team_id: null,
                    daily_call_goal: goal.daily_call_goal,
                    goal_target: goal.daily_call_goal,
                    goal_period: period,
                });
            }
        }
    },

    /**
     * Save team call goals (upsert)
     */
    async saveTeamGoals(
        companyId: string,
        teamGoals: { team_id: string; daily_call_goal: number }[]
    ): Promise<void> {
        for (const goal of teamGoals) {
            if (goal.daily_call_goal === 0) {
                await supabase
                    .from('call_goals')
                    .delete()
                    .eq('company_id', companyId)
                    .eq('team_id', goal.team_id)
                    .is('user_id', null);
                continue;
            }

            const { data: existing } = await supabase
                .from('call_goals')
                .select('id')
                .eq('company_id', companyId)
                .eq('team_id', goal.team_id)
                .is('user_id', null)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('call_goals')
                    .update({
                        daily_call_goal: goal.daily_call_goal,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('call_goals').insert({
                    company_id: companyId,
                    user_id: null,
                    team_id: goal.team_id,
                    daily_call_goal: goal.daily_call_goal,
                });
            }
        }
    },

    /**
     * Get status evolution data (how leads moved through stages via calls)
     */
    async getStatusEvolution(companyId: string, dateFrom?: string, dateTo?: string): Promise<{
        from: string;
        to: string;
        count: number;
    }[]> {
        let query = supabase
            .from('call_activities')
            .select('status_before, status_after')
            .eq('company_id', companyId)
            .not('status_after', 'is', null)
            .not('status_before', 'eq', 'status_after');

        if (dateFrom) query = query.gte('call_date', dateFrom);
        if (dateTo) query = query.lte('call_date', dateTo);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching status evolution:', error);
            return [];
        }

        // Group transitions
        const transitions: Record<string, number> = {};
        data?.forEach(call => {
            if (call.status_before && call.status_after && call.status_before !== call.status_after) {
                const key = `${call.status_before}→${call.status_after}`;
                transitions[key] = (transitions[key] || 0) + 1;
            }
        });

        return Object.entries(transitions)
            .map(([key, count]) => {
                const [from, to] = key.split('→');
                return { from, to, count };
            })
            .sort((a, b) => b.count - a.count);
    },

    /**
     * Get activity timeline for advanced charting
     * Supports date range, user filtering, and grouping by day/week/month
     */
    async getActivityTimeline(options: {
        companyId: string;
        dateFrom: string;
        dateTo: string;
        userIds?: string[];
        groupBy?: 'day' | 'week' | 'month';
    }): Promise<{ key: string; label: string; total: number;[k: string]: number | string }[]> {
        const { companyId, dateFrom, dateTo, userIds, groupBy = 'day' } = options;

        let query = supabase
            .from('call_activities')
            .select('call_date, action_type, user_id')
            .eq('company_id', companyId)
            .gte('call_date', dateFrom)
            .lte('call_date', dateTo)
            .order('call_date', { ascending: true });

        if (userIds && userIds.length > 0) {
            query = query.in('user_id', userIds);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching activity timeline:', error);
            return [];
        }

        const getGroupKey = (dateStr: string): { key: string; label: string } => {
            const d = new Date(dateStr);
            if (groupBy === 'month') {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('es', { month: 'short', year: 'numeric' });
                return { key, label };
            }
            if (groupBy === 'week') {
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(d);
                monday.setDate(diff);
                const key = monday.toISOString().split('T')[0];
                const label = `Sem ${monday.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;
                return { key, label };
            }
            const key = dateStr.split('T')[0];
            const label = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
            return { key, label };
        };

        const timeline: Record<string, { label: string; counts: Record<string, number> }> = {};
        const start = new Date(dateFrom);
        const end = new Date(dateTo);

        if (groupBy === 'day') {
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const { key, label } = getGroupKey(d.toISOString());
                if (!timeline[key]) timeline[key] = { label, counts: {} };
            }
        } else if (groupBy === 'week') {
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
                const { key, label } = getGroupKey(d.toISOString());
                if (!timeline[key]) timeline[key] = { label, counts: {} };
            }
        } else {
            for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
                const { key, label } = getGroupKey(d.toISOString());
                if (!timeline[key]) timeline[key] = { label, counts: {} };
            }
        }

        data?.forEach(row => {
            const { key } = getGroupKey(row.call_date);
            const type = row.action_type || 'call';
            if (!timeline[key]) timeline[key] = { label: key, counts: {} };
            timeline[key].counts[type] = (timeline[key].counts[type] || 0) + 1;
        });

        return Object.entries(timeline)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, { label, counts }]) => ({
                key,
                label,
                total: Object.values(counts).reduce((s, v) => s + v, 0),
                call: counts['call'] || 0,
                email: counts['email'] || 0,
                whatsapp: counts['whatsapp'] || 0,
                telegram: counts['telegram'] || 0,
                quote_sent: counts['quote_sent'] || 0,
                info_sent: counts['info_sent'] || 0,
                meeting: counts['meeting'] || 0,
            }));
    },

    /**
     * Get daily activity breakdown (legacy wrapper)
     */
    async getDailyActivityBreakdown(
        companyId: string,
        days: number = 10
    ): Promise<{ date: string; label: string;[key: string]: number | string }[]> {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        dateFrom.setHours(0, 0, 0, 0);
        const dateTo = new Date().toISOString();

        const result = await this.getActivityTimeline({
            companyId,
            dateFrom: dateFrom.toISOString(),
            dateTo,
            groupBy: 'day',
        });

        return result.map(r => ({ ...r, date: r.key }));
    },
};
