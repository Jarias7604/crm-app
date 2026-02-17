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
}

export interface TeamPerformance {
    team_id: string;
    team_name: string;
    team_emoji: string;
    team_color: string;
    member_count: number;
    total_leads: number;
    leads_won: number;
    leads_lost: number;
    win_rate: number;
    total_value: number;
    total_closing_amount: number;
    avg_deal_size: number;
    top_performer: string | null;
}

export interface PerformanceFilters {
    period: 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
    team_id?: string;
    date_from?: string;
    date_to?: string;
}

function getDateRange(filters: PerformanceFilters): { start: Date | null; end: Date | null } {
    if (filters.period === 'custom') {
        return {
            start: filters.date_from ? new Date(filters.date_from) : null,
            end: filters.date_to ? new Date(filters.date_to + 'T23:59:59') : null,
        };
    }

    const now = new Date();
    let start: Date | null = null;

    switch (filters.period) {
        case 'week': {
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            break;
        }
        case 'month': {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }
        case 'quarter': {
            const qMonth = Math.floor(now.getMonth() / 3) * 3;
            start = new Date(now.getFullYear(), qMonth, 1);
            break;
        }
        case 'year': {
            start = new Date(now.getFullYear(), 0, 1);
            break;
        }
        default:
            start = null;
    }

    return { start, end: null };
}

// === SERVICE ===
export const teamPerformanceService = {

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

        // 3. Get leads with assignment info
        let leadsQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, value, closing_amount, created_at')
            .eq('company_id', companyId);

        if (start) {
            leadsQuery = leadsQuery.gte('created_at', start.toISOString());
        }
        if (end) {
            leadsQuery = leadsQuery.lte('created_at', end.toISOString());
        }

        // Filter by team members if team_id is specified
        if (filters.team_id) {
            const { data: teamMembers } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('team_id', filters.team_id);

            const teamUserIds = (teamMembers || []).map(tm => tm.user_id);
            if (teamUserIds.length === 0) return [];
            leadsQuery = leadsQuery.in('assigned_to', teamUserIds);
        }

        const { data: leads, error: leadsError } = await leadsQuery;
        if (leadsError) throw leadsError;

        // 4. Aggregate per user
        const userStats: Record<string, {
            total: number; won: number; lost: number; active: number; erroneous: number;
            totalValue: number; totalClosing: number;
        }> = {};

        (leads || []).forEach(lead => {
            const uid = lead.assigned_to;
            if (!uid) return;

            if (!userStats[uid]) {
                userStats[uid] = { total: 0, won: 0, lost: 0, active: 0, erroneous: 0, totalValue: 0, totalClosing: 0 };
            }

            userStats[uid].total++;
            userStats[uid].totalValue += Number(lead.value || 0);
            userStats[uid].totalClosing += Number(lead.closing_amount || 0);

            if (lead.status === 'Cerrado' || lead.status === 'Cliente') {
                userStats[uid].won++;
            } else if (lead.status === 'Perdido') {
                userStats[uid].lost++;
            } else if (lead.status === 'Erróneo') {
                userStats[uid].erroneous++;
            } else {
                userStats[uid].active++;
            }
        });

        // 5. Build results
        return profiles
            .map(p => {
                const stats = userStats[p.id] || { total: 0, won: 0, lost: 0, active: 0, erroneous: 0, totalValue: 0, totalClosing: 0 };
                const validLeads = stats.total - stats.erroneous;
                const winRate = validLeads > 0 ? (stats.won / validLeads) * 100 : 0;
                const avgDeal = stats.won > 0 ? stats.totalClosing / stats.won : 0;
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

        // 3. Get leads
        let leadsQuery = supabase
            .from('leads')
            .select('id, assigned_to, status, value, closing_amount, created_at')
            .eq('company_id', companyId);

        if (start) {
            leadsQuery = leadsQuery.gte('created_at', start.toISOString());
        }
        if (end) {
            leadsQuery = leadsQuery.lte('created_at', end.toISOString());
        }

        const { data: leads } = await leadsQuery;

        // Build user -> lead stats
        const userLeads: Record<string, typeof leads> = {};
        (leads || []).forEach(lead => {
            if (!lead.assigned_to) return;
            if (!userLeads[lead.assigned_to]) userLeads[lead.assigned_to] = [];
            userLeads[lead.assigned_to]!.push(lead);
        });

        // 4. Aggregate per team
        return teams.map(team => {
            const members = teamUsers[team.id] || [];
            let totalLeads = 0, won = 0, lost = 0, totalValue = 0, totalClosing = 0;
            let topPerformer = '';
            let topWins = 0;

            // Per-user stats for finding top performer

            const userWins: Record<string, number> = {};

            members.forEach(userId => {
                const uLeads = userLeads[userId] || [];
                uLeads.forEach(lead => {
                    totalLeads++;
                    totalValue += Number(lead.value || 0);
                    totalClosing += Number(lead.closing_amount || 0);

                    if (lead.status === 'Cerrado' || lead.status === 'Cliente') {
                        won++;
                        userWins[userId] = (userWins[userId] || 0) + 1;
                    } else if (lead.status === 'Perdido') {
                        lost++;
                    }
                });
            });

            // Find top performer
            Object.entries(userWins).forEach(([uid, wins]) => {
                if (wins > topWins) {
                    topWins = wins;
                    topPerformer = uid;
                }
            });

            const validLeads = totalLeads;
            const winRate = validLeads > 0 ? (won / validLeads) * 100 : 0;
            const avgDeal = won > 0 ? totalClosing / won : 0;

            return {
                team_id: team.id,
                team_name: team.name,
                team_emoji: team.emoji,
                team_color: team.color,
                member_count: members.length,
                total_leads: totalLeads,
                leads_won: won,
                leads_lost: lost,
                win_rate: Math.round(winRate * 10) / 10,
                total_value: totalValue,
                total_closing_amount: totalClosing,
                avg_deal_size: Math.round(avgDeal * 100) / 100,
                top_performer: topPerformer || null,
            };
        }).sort((a, b) => b.leads_won - a.leads_won);
    },
};
