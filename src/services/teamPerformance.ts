import { supabase } from './supabase';

// === TYPES ===
export interface UserPerformance {
    user_id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    team_names: string[];
    team_colors: string[];
    total_leads: number;
    leads_won: number;
    leads_lost: number;
    leads_active: number;
    leads_erroneous: number;
    win_rate: number;
    total_value: number;
    total_closing_amount: number;
    avg_deal_size: number;
    avg_days_to_close: number; // Average days from lead creation to won
    avg_response_time?: number; // Average response time in hours
}

export interface TeamPerformance {
    team_id: string;
    team_name: string;
    team_emoji: string;
    team_color: string;
    member_count: number;
    member_ids: string[];
    total_leads: number;
    leads_won: number;
    leads_lost: number;
    win_rate: number;
    total_value: number;
    total_closing_amount: number;
    avg_deal_size: number;
    avg_days_to_close: number;
    top_performer: string | null;
}

export interface CompanySummary {
    totalLeads: number;
    wonDeals: number;
    lostDeals: number;
    totalValue: number;
    totalClosing: number;
}

export interface PerformanceFilters {
    period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
    team_id?: string;
    date_from?: string;
    date_to?: string;
}

export function getDateRange(filters: PerformanceFilters): { start: Date | null; end: Date | null } {
    if (filters.period === 'custom') {
        return {
            start: filters.date_from ? new Date(filters.date_from) : null,
            end: filters.date_to ? new Date(filters.date_to + 'T23:59:59') : null,
        };
    }

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (filters.period) {
        case 'today': {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        }
        case 'week': {
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            end = now;
            break;
        }
        case 'month': {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            // Last day of current month at 23:59:59
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        }
        case 'quarter': {
            const qMonth = Math.floor(now.getMonth() / 3) * 3;
            start = new Date(now.getFullYear(), qMonth, 1);
            // Last day of quarter
            end = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59);
            break;
        }
        case 'year': {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        }
        default:
            start = null;
            end = null;
    }

    return { start, end };
}

/**
 * Returns filters for the previous comparable period (used for trend arrows).
 * Returns null if no comparison is meaningful (e.g. 'all' or 'custom').
 */
export function getPreviousPeriodFilters(filters: PerformanceFilters): PerformanceFilters | null {
    if (filters.period === 'all' || filters.period === 'custom') return null;
    const now = new Date();
    switch (filters.period) {
        case 'today': {
            const prev = new Date(now);
            prev.setDate(prev.getDate() - 1);
            const dateStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
            return { period: 'custom', date_from: dateStr, date_to: dateStr };
        }
        case 'week': {
            const s = new Date(now); s.setDate(s.getDate() - 14);
            const e = new Date(now); e.setDate(e.getDate() - 7);
            return { period: 'custom', date_from: s.toISOString().split('T')[0], date_to: e.toISOString().split('T')[0] };
        }
        case 'month': {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            return { period: 'custom', date_from: s.toISOString().split('T')[0], date_to: e.toISOString().split('T')[0] };
        }
        case 'quarter': {
            const qM = Math.floor(now.getMonth() / 3) * 3;
            const s = new Date(now.getFullYear(), qM - 3, 1);
            const e = new Date(now.getFullYear(), qM, 0, 23, 59, 59);
            return { period: 'custom', date_from: s.toISOString().split('T')[0], date_to: e.toISOString().split('T')[0] };
        }
        case 'year': {
            const s = new Date(now.getFullYear() - 1, 0, 1);
            const e = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            return { period: 'custom', date_from: s.toISOString().split('T')[0], date_to: e.toISOString().split('T')[0] };
        }
        default: return null;
    }
}

// === SERVICE ===
export const teamPerformanceService = {

    /**
     * Get company-wide summary totals (ALL leads, including unassigned)
     * Uses same logic as Dashboard RPC: COALESCE(internal_won_date, created_at)
     */
    async getCompanySummary(companyId: string, filters: PerformanceFilters): Promise<CompanySummary> {
        const { start, end } = getDateRange(filters);

        // Total leads (by created_at)
        let totalQuery = supabase.from('leads').select('id, value', { count: 'exact' })
            .eq('company_id', companyId);
        if (start) totalQuery = totalQuery.gte('created_at', start.toISOString());
        if (end) totalQuery = totalQuery.lte('created_at', end.toISOString());
        const { data: totalLeads, count: totalCount } = await totalQuery;

        // Won leads (by internal_won_date, matching Dashboard: COALESCE logic)
        // We fetch all won leads for the company, then filter in JS using COALESCE
        let wonQuery = supabase.from('leads')
            .select('id, value, closing_amount, internal_won_date, created_at')
            .eq('company_id', companyId)
            .in('status', ['Cerrado', 'Cliente']);

        // Apply date range using the COALESCE logic to match Dashboard
        // Since Supabase doesn't support COALESCE in filters, we fetch broadly and filter in JS
        const { data: allWonLeads } = await wonQuery;
        const filteredWon = (allWonLeads || []).filter(lead => {
            const effectiveDate = lead.internal_won_date || lead.created_at;
            if (start && effectiveDate < start.toISOString()) return false;
            if (end && effectiveDate > end.toISOString()) return false;
            return true;
        });

        // Lost leads (by lost_date)
        let lostQuery = supabase.from('leads').select('id', { count: 'exact' })
            .eq('company_id', companyId)
            .eq('status', 'Perdido')
            .not('lost_date', 'is', null);
        if (start) lostQuery = lostQuery.gte('lost_date', start.toISOString());
        if (end) lostQuery = lostQuery.lte('lost_date', end.toISOString());
        const { count: lostCount } = await lostQuery;

        const totalValue = (totalLeads || []).reduce((sum, l) => sum + Number(l.value || 0), 0);
        const totalClosing = filteredWon.reduce((sum, l) => sum + Number(l.closing_amount || l.value || 0), 0);

        return {
            totalLeads: totalCount || 0,
            wonDeals: filteredWon.length,
            lostDeals: lostCount || 0,
            totalValue,
            totalClosing,
        };
    },

    /**
     * Get performance metrics for all users in a company
     */
    async getUserPerformance(companyId: string, filters: PerformanceFilters): Promise<UserPerformance[]> {
        const { start, end } = getDateRange(filters);

        // 1. Get all company profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, role')
            .eq('company_id', companyId)
            .order('full_name');

        if (profilesError) throw profilesError;
        if (!profiles || profiles.length === 0) return [];

        // 2. Get team memberships
        const userIds = profiles.map(p => p.id);

        const { data: memberships } = await supabase
            .from('team_members')
            .select('user_id, team_id, teams(name, color)')
            .in('user_id', userIds);

        // Build user -> teams map
        const userTeams: Record<string, { names: string[]; colors: string[] }> = {};
        (memberships || []).forEach((m: any) => {
            if (!userTeams[m.user_id]) userTeams[m.user_id] = { names: [], colors: [] };
            if (m.teams) {
                userTeams[m.user_id].names.push(m.teams.name);
                userTeams[m.user_id].colors.push(m.teams.color);
            }
        });

        // 3a. Get leads created in period (pipeline metrics: total, active, value)
        let leadsQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, value, closing_amount, created_at, first_follow_up_at, assigned_at')
            .eq('company_id', companyId);

        if (start) {
            leadsQuery = leadsQuery.gte('created_at', start.toISOString());
        }
        if (end) {
            leadsQuery = leadsQuery.lte('created_at', end.toISOString());
        }

        // Filter by team members if team_id is specified
        let teamUserIds: string[] | null = null;
        if (filters.team_id) {
            const { data: teamMembers } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('team_id', filters.team_id);

            teamUserIds = (teamMembers || []).map(tm => tm.user_id);
            if (teamUserIds.length === 0) return [];
            leadsQuery = leadsQuery.in('assigned_to', teamUserIds);
        }

        const { data: leads, error: leadsError } = await leadsQuery;
        if (leadsError) throw leadsError;

        // 3b. Get leads WON in the period.
        // Uses COALESCE(internal_won_date, created_at) to match Dashboard logic:
        // - If internal_won_date exists, use it (captures deals closed this month even if created months ago)
        // - If internal_won_date is null (manually moved to Cliente/Cerrado), fall back to created_at
        // We fetch ALL won leads broadly and filter in JS — same strategy as getCompanySummary.
        let wonQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, value, closing_amount, internal_won_date, created_at')
            .eq('company_id', companyId)
            .in('status', ['Cerrado', 'Cliente']);

        if (teamUserIds) {
            wonQuery = wonQuery.in('assigned_to', teamUserIds);
        }

        const { data: allWonLeads } = await wonQuery;

        // Filter by date using COALESCE: prefer internal_won_date, fall back to created_at
        const wonLeads = (allWonLeads || []).filter(lead => {
            const effectiveDate = lead.internal_won_date || lead.created_at;
            if (start && effectiveDate < start.toISOString()) return false;
            if (end && effectiveDate > end.toISOString()) return false;
            return true;
        });

        // 3c. Get leads LOST in the period (by lost_date)
        let lostQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, lost_date')
            .eq('company_id', companyId)
            .eq('status', 'Perdido')
            .not('lost_date', 'is', null);

        if (start) {
            lostQuery = lostQuery.gte('lost_date', start.toISOString());
        }
        if (end) {
            lostQuery = lostQuery.lte('lost_date', end.toISOString());
        }
        if (teamUserIds) {
            lostQuery = lostQuery.in('assigned_to', teamUserIds);
        }

        const { data: lostLeads } = await lostQuery;

        // 4. Aggregate per user
                const userStats: Record<string, {
            total: number; won: number; lost: number; active: number; erroneous: number;
            totalValue: number; totalClosing: number;
            totalDaysToClose: number; wonWithDate: number;
            totalResponseTimeHours: number;
            leadsWithResponseTime: number;
        }> = {};

        const ensureUser = (uid: string) => {
            if (!userStats[uid]) {
                userStats[uid] = {
                    total: 0, won: 0, lost: 0, active: 0, erroneous: 0,
                    totalValue: 0, totalClosing: 0, totalDaysToClose: 0, wonWithDate: 0,
                    totalResponseTimeHours: 0, leadsWithResponseTime: 0
                };
            }
        };

        // Pipeline metrics from created_at query (total, active, erroneous, pipeline value)
        // totalValue = ONLY active leads in pipeline (not won/lost — those go to totalClosing)
        (leads || []).forEach(lead => {
            const uid = lead.assigned_to;
            if (!uid) return;
            ensureUser(uid);

            userStats[uid].total++;

            if (lead.status === 'Erróneo') {
                userStats[uid].erroneous++;
            } else if (lead.status === 'Cerrado' || lead.status === 'Cliente' || lead.status === 'Perdido') {
                // Won/Lost leads DO count toward total leads but NOT toward pipeline value
            } else {
                // Active pipeline leads only
                userStats[uid].active++;
                userStats[uid].totalValue += Number(lead.value || 0);
            }

            // Lead response time calculation: assignment (or creation if not explicitly assigned) to first follow up
            const baseTime = lead.assigned_at || lead.created_at;
            if (lead.first_follow_up_at && baseTime) {
                const diffMs = new Date(lead.first_follow_up_at).getTime() - new Date(baseTime).getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours >= 0) {
                    userStats[uid].totalResponseTimeHours += diffHours;
                    userStats[uid].leadsWithResponseTime++;
                }
            }
        });

        // Won metrics from internal_won_date query
        (wonLeads || []).forEach(lead => {
            const uid = lead.assigned_to;
            if (!uid) return;
            ensureUser(uid);

            userStats[uid].won++;
            userStats[uid].totalClosing += Number(lead.closing_amount || lead.value || 0);
            // Calculate days from creation to close (only when internal_won_date is set)
            if (lead.internal_won_date && lead.created_at) {
                const days = (new Date(lead.internal_won_date).getTime() - new Date(lead.created_at).getTime()) / 86400000;
                if (days >= 0) {
                    userStats[uid].totalDaysToClose += days;
                    userStats[uid].wonWithDate++;
                }
            }
        });

        // Lost metrics from lost_date query
        (lostLeads || []).forEach(lead => {
            const uid = lead.assigned_to;
            if (!uid) return;
            ensureUser(uid);

            userStats[uid].lost++;
        });

        // 5. Build results
        return profiles
            .map(p => {
                const stats = userStats[p.id] || {
                    total: 0, won: 0, lost: 0, active: 0, erroneous: 0,
                    totalValue: 0, totalClosing: 0, totalDaysToClose: 0, wonWithDate: 0,
                    totalResponseTimeHours: 0, leadsWithResponseTime: 0
                };
                // Win rate = won / (won + lost) — only decided deals, same logic as Salesforce/HubSpot
                const decidedDeals = stats.won + stats.lost;
                const winRate = decidedDeals > 0 ? (stats.won / decidedDeals) * 100 : 0;
                const avgDeal = stats.won > 0 ? stats.totalClosing / stats.won : 0;
                const avgDaysToClose = stats.wonWithDate > 0 ? Math.round(stats.totalDaysToClose / stats.wonWithDate) : 0;
                const avgResponseTime = stats.leadsWithResponseTime > 0 ? stats.totalResponseTimeHours / stats.leadsWithResponseTime : 0;
                const teams = userTeams[p.id] || { names: [], colors: [] };

                return {
                    user_id: p.id,
                    full_name: p.full_name || p.email.split('@')[0],
                    email: p.email,
                    avatar_url: p.avatar_url,
                    role: p.role,
                    team_names: teams.names,
                    team_colors: teams.colors,
                    total_leads: stats.total,
                    leads_won: stats.won,
                    leads_lost: stats.lost,
                    leads_active: stats.active,
                    leads_erroneous: stats.erroneous,
                    win_rate: Math.round(winRate * 10) / 10,
                    total_value: stats.totalValue,
                    total_closing_amount: stats.totalClosing,
                    avg_deal_size: Math.round(avgDeal * 100) / 100,
                    avg_days_to_close: avgDaysToClose,
                    avg_response_time: avgResponseTime,
                };
            })
            .sort((a, b) => b.leads_won - a.leads_won || b.win_rate - a.win_rate);
    },

    /**
     * Get performance metrics aggregated by team
     */
    async getTeamPerformance(companyId: string, filters: PerformanceFilters): Promise<TeamPerformance[]> {
        const { start, end } = getDateRange(filters);

        // 1. Get all teams
        const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('id, name, emoji, color')
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (teamsError) throw teamsError;
        if (!teams || teams.length === 0) return [];

        // 2. Get all team memberships
        const teamIds = teams.map(t => t.id);
        const { data: allMembers } = await supabase
            .from('team_members')
            .select('team_id, user_id')
            .in('team_id', teamIds);

        // Build team -> users map
        const teamUsers: Record<string, string[]> = {};
        (allMembers || []).forEach(m => {
            if (!teamUsers[m.team_id]) teamUsers[m.team_id] = [];
            teamUsers[m.team_id].push(m.user_id);
        });

        // 3a. Get leads created in period (pipeline metrics)
        let leadsQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, value, created_at')
            .eq('company_id', companyId);

        if (start) {
            leadsQuery = leadsQuery.gte('created_at', start.toISOString());
        }
        if (end) {
            leadsQuery = leadsQuery.lte('created_at', end.toISOString());
        }

        const { data: leads } = await leadsQuery;

        // 3b. Get leads WON in period.
        // Uses COALESCE(internal_won_date, created_at) — same logic as getUserPerformance and getCompanySummary.
        let wonQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, value, closing_amount, internal_won_date, created_at')
            .eq('company_id', companyId)
            .in('status', ['Cerrado', 'Cliente']);

        const { data: allWonLeadsTeam } = await wonQuery;

        // Filter by date in JS using COALESCE: prefer internal_won_date, fall back to created_at
        const wonLeads = (allWonLeadsTeam || []).filter(lead => {
            const effectiveDate = lead.internal_won_date || lead.created_at;
            if (start && effectiveDate < start.toISOString()) return false;
            if (end && effectiveDate > end.toISOString()) return false;
            return true;
        });

        // 3c. Get leads LOST in period (by lost_date)
        let lostQuery = supabase
            .from('leads')
            .select('id, assigned_to, lost_date')
            .eq('company_id', companyId)
            .eq('status', 'Perdido')
            .not('lost_date', 'is', null);

        if (start) {
            lostQuery = lostQuery.gte('lost_date', start.toISOString());
        }
        if (end) {
            lostQuery = lostQuery.lte('lost_date', end.toISOString());
        }

        const { data: lostLeads } = await lostQuery;

        // Build user -> lead stats (pipeline by created_at)
        const userLeads: Record<string, typeof leads> = {};
        (leads || []).forEach(lead => {
            if (!lead.assigned_to) return;
            if (!userLeads[lead.assigned_to]) userLeads[lead.assigned_to] = [];
            userLeads[lead.assigned_to]!.push(lead);
        });

        // Build user -> won leads (by internal_won_date)
        const userWonLeads: Record<string, typeof wonLeads> = {};
        (wonLeads || []).forEach(lead => {
            if (!lead.assigned_to) return;
            if (!userWonLeads[lead.assigned_to]) userWonLeads[lead.assigned_to] = [];
            userWonLeads[lead.assigned_to]!.push(lead);
        });

        // Build user -> lost leads (by lost_date)
        const userLostLeads: Record<string, typeof lostLeads> = {};
        (lostLeads || []).forEach(lead => {
            if (!lead.assigned_to) return;
            if (!userLostLeads[lead.assigned_to]) userLostLeads[lead.assigned_to] = [];
            userLostLeads[lead.assigned_to]!.push(lead);
        });

        // 4. Aggregate per team
        return teams.map(team => {
            const members = teamUsers[team.id] || [];
            let totalLeads = 0, won = 0, lost = 0, totalValue = 0, totalClosing = 0;
            let totalDaysToClose = 0, wonWithDate = 0;
            let topPerformer = '';
            let topWins = 0;

            const userWins: Record<string, number> = {};

            members.forEach(userId => {
                // Pipeline metrics from created_at — only active leads contribute to pipeline value
                const uLeads = userLeads[userId] || [];
                uLeads.forEach(lead => {
                    totalLeads++;
                    // Only active leads (not won/lost) count toward pipeline value
                    if (lead.status !== 'Cerrado' && lead.status !== 'Cliente' && lead.status !== 'Perdido' && lead.status !== 'Erróneo') {
                        totalValue += Number(lead.value || 0);
                    }
                });

                // Won metrics from internal_won_date
                const uWon = userWonLeads[userId] || [];
                uWon.forEach(lead => {
                    won++;
                    totalClosing += Number(lead.closing_amount || lead.value || 0);
                    userWins[userId] = (userWins[userId] || 0) + 1;
                    if (lead.internal_won_date && lead.created_at) {
                        const days = (new Date(lead.internal_won_date).getTime() - new Date(lead.created_at).getTime()) / 86400000;
                        if (days >= 0) { totalDaysToClose += days; wonWithDate++; }
                    }
                });

                // Lost metrics from lost_date
                const uLost = userLostLeads[userId] || [];
                lost += uLost.length;
            });

            // Find top performer
            Object.entries(userWins).forEach(([uid, wins]) => {
                if (wins > topWins) {
                    topWins = wins;
                    topPerformer = uid;
                }
            });

            // Win rate = won / (won + lost) — only decided deals (same as Salesforce/HubSpot standard)
            const decidedDeals = won + lost;
            const winRate = decidedDeals > 0 ? (won / decidedDeals) * 100 : 0;
            const avgDeal = won > 0 ? totalClosing / won : 0;
            const avgDaysToClose = wonWithDate > 0 ? Math.round(totalDaysToClose / wonWithDate) : 0;

            return {
                team_id: team.id,
                team_name: team.name,
                team_emoji: team.emoji,
                team_color: team.color,
                member_count: members.length,
                member_ids: members,
                total_leads: totalLeads,
                leads_won: won,
                leads_lost: lost,
                win_rate: Math.round(winRate * 10) / 10,
                total_value: totalValue,
                total_closing_amount: totalClosing,
                avg_deal_size: Math.round(avgDeal * 100) / 100,
                avg_days_to_close: avgDaysToClose,
                top_performer: topPerformer || null,
            };
        }).sort((a, b) => b.leads_won - a.leads_won);
    },
};
