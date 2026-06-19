import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReportSchedule {
    id: string;
    company_id: string;
    advisor_id: string;
    advisor_name: string;
    recipient_emails: string;
    frequency: 'weekly' | 'monthly' | 'manual';
    day_of_week: number | null;
    day_of_month: number | null;
    period: string;
    next_send_at: string;
    is_active: boolean;
}

function getDateRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    let start: Date;

    switch (period) {
        case 'week': {
            start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'month': {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            break;
        }
        case 'quarter': {
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
            break;
        }
        default: { // 'all' or unknown — use current month
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        }
    }
    return { start, end };
}

function computeNextSendAt(schedule: ReportSchedule): Date {
    const now = new Date();
    const next = new Date(now);

    if (schedule.frequency === 'weekly' && schedule.day_of_week !== null) {
        const targetDay = schedule.day_of_week;
        const diff = (targetDay - now.getDay() + 7) % 7 || 7;
        next.setDate(now.getDate() + diff);
    } else if (schedule.frequency === 'monthly' && schedule.day_of_month !== null) {
        next.setDate(schedule.day_of_month);
        if (next <= now) next.setMonth(next.getMonth() + 1);
    } else {
        // manual — set far future so it won't re-trigger
        next.setFullYear(next.getFullYear() + 10);
    }
    next.setHours(8, 0, 0, 0);
    return next;
}

function isWorkingDay(date: Date): boolean {
    return date.getDay() !== 0; // exclude Sundays
}

function countWorkingDaysElapsed(start: Date, end: Date): number {
    let count = 0;
    const cur = new Date(start);
    cur.setHours(12, 0, 0, 0);
    const lim = new Date(Math.min(end.getTime(), new Date().getTime()));
    while (cur <= lim) {
        if (isWorkingDay(cur)) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        const now = new Date();

        // 1. Fetch all due schedules
        const { data: schedules, error: schedErr } = await supabase
            .from('report_schedules')
            .select('*')
            .eq('is_active', true)
            .lte('next_send_at', now.toISOString());

        if (schedErr) throw schedErr;
        if (!schedules || schedules.length === 0) {
            console.log('[process-report-schedules] No schedules due.');
            return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[process-report-schedules] Processing ${schedules.length} due schedules`);
        const results: { id: string; status: string; error?: string }[] = [];

        for (const schedule of schedules as ReportSchedule[]) {
            try {
                const { start, end } = getDateRange(schedule.period);
                const periodLabel = `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                const generatedAt = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                // 2. Fetch advisor's call goal
                const { data: goalData } = await supabase
                    .from('call_goals')
                    .select('daily_call_goal')
                    .eq('user_id', schedule.advisor_id)
                    .eq('company_id', schedule.company_id)
                    .maybeSingle();
                const dailyGoal = goalData?.daily_call_goal || 0;

                // 3. Fetch call activities in range
                const { data: calls } = await supabase
                    .from('call_activities')
                    .select('id, call_date, call_type')
                    .eq('user_id', schedule.advisor_id)
                    .eq('company_id', schedule.company_id)
                    .gte('call_date', start.toISOString())
                    .lte('call_date', end.toISOString());

                const callList = calls || [];
                const actual = callList.length;
                const actualConnected = callList.filter(c => c.call_type === 'Llamada' || c.call_type === 'connected').length;

                // 4. Build day grid
                const elapsedDays = countWorkingDaysElapsed(start, end);
                const goalUpToDate = dailyGoal * elapsedDays;

                // Build day grid entries
                const dayMap: Record<string, number> = {};
                for (const c of callList) {
                    const d = new Date(c.call_date);
                    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    dayMap[key] = (dayMap[key] || 0) + 1;
                }

                const dayGrid: { label: string; count: number; goal: number; isFuture: boolean }[] = [];
                const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
                const cur = new Date(start); cur.setHours(12, 0, 0, 0);
                while (cur <= end) {
                    if (isWorkingDay(cur)) {
                        const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
                        dayGrid.push({
                            label: cur.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
                            count: dayMap[key] || 0,
                            goal: dailyGoal,
                            isFuture: cur > todayEnd,
                        });
                    }
                    cur.setDate(cur.getDate() + 1);
                }

                const pastDays = dayGrid.filter(d => !d.isFuture);
                const daysOK = pastDays.filter(d => dailyGoal > 0 ? d.count >= dailyGoal : d.count > 0).length;
                const deviation = actual - goalUpToDate;
                const percent = goalUpToDate > 0 ? (actual / goalUpToDate) * 100 : 0;
                const periodGoal = dailyGoal * (elapsedDays || 1);

                // 5. Fetch opportunity loss data
                const { data: activeLeads } = await supabase
                    .from('leads')
                    .select('id, value')
                    .eq('company_id', schedule.company_id)
                    .eq('assigned_to', schedule.advisor_id)
                    .in('status', ['Nuevo', 'Seguimiento', 'Propuesta', 'Negociación', 'En proceso'])
                    .lte('created_at', end.toISOString());

                const { data: activitiesForFollowUp } = await supabase
                    .from('call_activities')
                    .select('lead_id')
                    .eq('user_id', schedule.advisor_id)
                    .eq('company_id', schedule.company_id)
                    .gte('call_date', start.toISOString())
                    .lte('call_date', end.toISOString());

                const contactedLeadIds = new Set((activitiesForFollowUp || []).map(a => a.lead_id).filter(Boolean));
                const leadsWithoutFollowUp = (activeLeads || []).filter(l => !contactedLeadIds.has(l.id)).length;

                // Simple estimates
                const conversionRate = 15; // default
                const avgDealSize = 298; // default; ideally computed from won leads
                const deficit = Math.max(0, goalUpToDate - actual);
                const callsPerClose = dailyGoal > 0 ? (elapsedDays * dailyGoal) / Math.max(1, daysOK) : 10;
                const userNeglectLoss = leadsWithoutFollowUp * (conversionRate / 100) * avgDealSize;
                const userActivityLoss = (deficit / Math.max(1, callsPerClose)) * (conversionRate / 100) * avgDealSize;
                const userConsolidated = userNeglectLoss + userActivityLoss;

                // 6. Build payload and call send-performance-report
                const payload = {
                    companyId: schedule.company_id,
                    advisorId: schedule.advisor_id,
                    advisorName: schedule.advisor_name,
                    recipientEmail: schedule.recipient_emails,
                    periodLabel,
                    generatedAt,
                    actual,
                    actualConnected,
                    goalUpToDate,
                    periodGoal,
                    dailyGoal,
                    deviation,
                    percent,
                    avgResponseTime: 0,
                    dayGrid,
                    daysOK,
                    pastDaysCount: pastDays.length,
                    leadsWithoutFollowUp,
                    deficit,
                    userNeglectLoss,
                    userActivityLoss,
                    userConsolidated,
                    conversionRate,
                    avgDealSize,
                    scheduleId: schedule.id,
                };

                const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-performance-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
                    body: JSON.stringify(payload),
                });

                if (!sendRes.ok) {
                    const errText = await sendRes.text();
                    throw new Error(`send-performance-report failed: ${errText}`);
                }

                // 7. Update schedule: last_sent_at + next_send_at
                const nextSendAt = computeNextSendAt(schedule);
                await supabase.from('report_schedules').update({
                    last_sent_at: now.toISOString(),
                    next_send_at: nextSendAt.toISOString(),
                }).eq('id', schedule.id);

                console.log(`[process-report-schedules] Sent OK: ${schedule.advisor_name} → ${schedule.recipient_emails}`);
                results.push({ id: schedule.id, status: 'sent' });

            } catch (err) {
                console.error(`[process-report-schedules] Error for schedule ${schedule.id}:`, err);
                results.push({ id: schedule.id, status: 'error', error: String(err) });
            }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[process-report-schedules] Fatal:', err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
