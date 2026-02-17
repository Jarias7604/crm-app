import { supabase } from './supabase';

// === TYPES ===
export interface Team {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    emoji: string;
    color: string;
    leader_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Computed (from joins)
    member_count?: number;
    leader?: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
    members?: TeamMember[];
}

export interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    role: 'leader' | 'member';
    joined_at: string;
    // Joined from profiles
    profile?: {
        id: string;
        full_name: string | null;
        email: string;
        avatar_url: string | null;
        role: string;
        is_active: boolean;
    };
}

export interface CreateTeamData {
    name: string;
    description?: string;
    emoji?: string;
    color?: string;
    leader_id?: string;
}

export interface UpdateTeamData {
    name?: string;
    description?: string | null;
    emoji?: string;
    color?: string;
    leader_id?: string | null;
    is_active?: boolean;
}

// === SERVICE ===
export const teamsService = {
    /**
     * Get all teams for the current user's company
     */
    async getTeams(companyId: string): Promise<Team[]> {
        const { data: teams, error } = await supabase
            .from('teams')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!teams || teams.length === 0) return [];

        // Get member counts and leader info for each team
        const teamIds = teams.map(t => t.id);

        const { data: members } = await supabase
            .from('team_members')
            .select('team_id, user_id, role')
            .in('team_id', teamIds);

        // Count members per team
        const memberCounts: Record<string, number> = {};
        (members || []).forEach(m => {
            memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
        });

        // Get leader profiles
        const leaderIds = teams.map(t => t.leader_id).filter(Boolean) as string[];
        let leaderProfiles: Record<string, any> = {};

        if (leaderIds.length > 0) {
            const { data: leaders } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .in('id', leaderIds);

            (leaders || []).forEach(l => {
                leaderProfiles[l.id] = l;
            });
        }

        return teams.map(t => ({
            ...t,
            member_count: memberCounts[t.id] || 0,
            leader: t.leader_id ? leaderProfiles[t.leader_id] || null : null,
        }));
    },

    /**
     * Get a single team with its members
     */
    async getTeamWithMembers(teamId: string): Promise<Team | null> {
        const { data: team, error } = await supabase
            .from('teams')
            .select('*')
            .eq('id', teamId)
            .single();

        if (error) throw error;
        if (!team) return null;

        // Get members with profile info
        const { data: members } = await supabase
            .from('team_members')
            .select('id, team_id, user_id, role, joined_at')
            .eq('team_id', teamId)
            .order('role', { ascending: true })
            .order('joined_at', { ascending: true });

        // Get profiles for members
        const userIds = (members || []).map(m => m.user_id);
        let profileMap: Record<string, any> = {};

        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, role, is_active')
                .in('id', userIds);

            (profiles || []).forEach(p => {
                profileMap[p.id] = p;
            });
        }

        const enrichedMembers: TeamMember[] = (members || []).map(m => ({
            ...m,
            profile: profileMap[m.user_id] || null,
        }));

        // Leader profile
        let leader = null;
        if (team.leader_id) {
            const { data: leaderProfile } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .eq('id', team.leader_id)
                .single();
            leader = leaderProfile;
        }

        return {
            ...team,
            member_count: enrichedMembers.length,
            leader,
            members: enrichedMembers,
        };
    },

    /**
     * Create a new team
     */
    async createTeam(companyId: string, data: CreateTeamData): Promise<Team> {
        const leaderId = data.leader_id && data.leader_id.trim() !== '' ? data.leader_id : null;

        console.log('[teamsService] Creating team:', { companyId, name: data.name, leaderId });

        const { data: team, error } = await supabase
            .from('teams')
            .insert({
                company_id: companyId,
                name: data.name,
                description: data.description && data.description.trim() !== '' ? data.description : null,
                emoji: data.emoji || '👥',
                color: data.color || '#4449AA',
                leader_id: leaderId,
            })
            .select()
            .single();

        if (error) {
            console.error('[teamsService] Error creating team:', error);
            throw error;
        }

        console.log('[teamsService] Team created:', team);

        // If leader is specified, also add them as a team member with 'leader' role
        if (leaderId) {
            const { error: memberError } = await supabase
                .from('team_members')
                .upsert({
                    team_id: team.id,
                    user_id: leaderId,
                    role: 'leader',
                }, { onConflict: 'team_id,user_id' });

            if (memberError) console.error('[teamsService] Error adding leader as member:', memberError);
        }

        return team;
    },

    /**
     * Update a team
     */
    async updateTeam(teamId: string, data: UpdateTeamData): Promise<void> {
        const { error } = await supabase
            .from('teams')
            .update(data)
            .eq('id', teamId);

        if (error) throw error;

        // If leader changed, update team_members roles
        if (data.leader_id !== undefined) {
            // Downgrade old leader to member
            await supabase
                .from('team_members')
                .update({ role: 'member' })
                .eq('team_id', teamId)
                .eq('role', 'leader');

            // Upsert new leader
            if (data.leader_id) {
                await supabase
                    .from('team_members')
                    .upsert({
                        team_id: teamId,
                        user_id: data.leader_id,
                        role: 'leader',
                    }, { onConflict: 'team_id,user_id' });
            }
        }
    },

    /**
     * Delete a team
     */
    async deleteTeam(teamId: string): Promise<void> {
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId);

        if (error) throw error;
    },

    /**
     * Add a member to a team
     */
    async addMember(teamId: string, userId: string, role: 'leader' | 'member' = 'member'): Promise<void> {
        const { error } = await supabase
            .from('team_members')
            .insert({ team_id: teamId, user_id: userId, role });

        if (error) {
            if (error.code === '23505') throw new Error('Este usuario ya es miembro de este equipo');
            throw error;
        }
    },

    /**
     * Remove a member from a team
     */
    async removeMember(teamId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    /**
     * Get all users not in a specific team (for the "add member" dropdown)
     */
    async getAvailableUsers(companyId: string, teamId: string): Promise<any[]> {
        // Get users already in the team
        const { data: existingMembers } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', teamId);

        const existingIds = (existingMembers || []).map(m => m.user_id);

        // Get all company users NOT in the team
        let query = supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, role')
            .eq('company_id', companyId);

        if (existingIds.length > 0) {
            // Filter out users who are already members
            query = query.not('id', 'in', `(${existingIds.join(',')})`);
        }

        const { data, error } = await query.order('full_name');
        if (error) throw error;
        return data || [];
    },

    /**
     * Get teams for a specific user
     */
    async getUserTeams(userId: string): Promise<Team[]> {
        const { data: memberships } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', userId);

        if (!memberships || memberships.length === 0) return [];

        const teamIds = memberships.map(m => m.team_id);

        const { data: teams, error } = await supabase
            .from('teams')
            .select('*')
            .in('id', teamIds);

        if (error) throw error;
        return teams || [];
    },
};
