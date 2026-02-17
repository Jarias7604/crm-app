import { supabase } from './supabase';

export interface PerformanceGoal {
    id: string;
    company_id: string;
    user_id: string | null;
    team_id: string | null;
    goal_leads: number;
    goal_value: number;
    created_at: string;
    updated_at: string;
}

export const performanceGoalsService = {
    /**
     * Get all goals for a company
     */
    async getGoals(companyId: string): Promise<PerformanceGoal[]> {
        const { data, error } = await supabase
            .from('performance_goals')
            .select('*')
            .eq('company_id', companyId);

        if (error) {
            console.error('Error fetching performance goals:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Save user goals (upsert: update if exists, insert if not)
     */
    async saveUserGoals(
        companyId: string,
        userGoals: { user_id: string; goal_leads: number; goal_value: number }[]
    ): Promise<void> {
        for (const goal of userGoals) {
            // Skip if both are 0 — delete existing goal
            if (goal.goal_leads === 0 && goal.goal_value === 0) {
                await supabase
                    .from('performance_goals')
                    .delete()
                    .eq('company_id', companyId)
                    .eq('user_id', goal.user_id)
                    .is('team_id', null);
                continue;
            }

            const { data: existing } = await supabase
                .from('performance_goals')
                .select('id')
                .eq('company_id', companyId)
                .eq('user_id', goal.user_id)
                .is('team_id', null)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('performance_goals')
                    .update({
                        goal_leads: goal.goal_leads,
                        goal_value: goal.goal_value,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('performance_goals').insert({
                    company_id: companyId,
                    user_id: goal.user_id,
                    team_id: null,
                    goal_leads: goal.goal_leads,
                    goal_value: goal.goal_value,
                });
            }
        }
    },

    /**
     * Save team goals (upsert)
     */
    async saveTeamGoals(
        companyId: string,
        teamGoals: { team_id: string; goal_leads: number; goal_value: number }[]
    ): Promise<void> {
        for (const goal of teamGoals) {
            if (goal.goal_leads === 0 && goal.goal_value === 0) {
                await supabase
                    .from('performance_goals')
                    .delete()
                    .eq('company_id', companyId)
                    .eq('team_id', goal.team_id)
                    .is('user_id', null);
                continue;
            }

            const { data: existing } = await supabase
                .from('performance_goals')
                .select('id')
                .eq('company_id', companyId)
                .eq('team_id', goal.team_id)
                .is('user_id', null)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('performance_goals')
                    .update({
                        goal_leads: goal.goal_leads,
                        goal_value: goal.goal_value,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('performance_goals').insert({
                    company_id: companyId,
                    user_id: null,
                    team_id: goal.team_id,
                    goal_leads: goal.goal_leads,
                    goal_value: goal.goal_value,
                });
            }
        }
    },
};
