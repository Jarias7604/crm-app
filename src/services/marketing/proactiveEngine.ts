import { supabase } from '../supabase';

export type AutonomyLevel = 'copilot' | 'semi' | 'autopilot';

export interface AiTask {
    id: string;
    company_id: string;
    agent_name: 'oracle' | 'maya' | 'sofia' | 'atlas';
    task_type: string;
    title: string;
    description: string;
    payload: any;
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'autopilot';
    confidence: number;
    impact_estimate?: string;
    created_at: string;
}

export const proactiveEngineService = {
    /**
     * Get the current autonomy setting for the company
     */
    async getAutonomyLevel(companyId: string): Promise<AutonomyLevel> {
        const { data, error } = await supabase
            .from('ai_autonomy_settings')
            .select('autonomy_level')
            .eq('company_id', companyId)
            .single();

        if (error) {
            // Default to copilot if not set
            if (error.code === 'PGRST116') return 'copilot';
            console.error('Error fetching autonomy level:', error);
            return 'copilot';
        }

        return data.autonomy_level as AutonomyLevel;
    },

    /**
     * Update the autonomy setting for the company
     */
    async setAutonomyLevel(companyId: string, level: AutonomyLevel): Promise<void> {
        const { error } = await supabase
            .from('ai_autonomy_settings')
            .upsert({ company_id: companyId, autonomy_level: level });

        if (error) throw error;
    },

    /**
     * Fetch pending AI tasks from the queue
     */
    async getPendingTasks(companyId: string): Promise<AiTask[]> {
        const { data, error } = await supabase
            .from('ai_tasks')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'pending')
            .order('confidence', { ascending: false });

        if (error) throw error;
        return data as AiTask[];
    },

    /**
     * Approve or reject a task
     */
    async resolveTask(taskId: string, status: 'approved' | 'rejected'): Promise<void> {
        const { error } = await supabase
            .from('ai_tasks')
            .update({ status, executed_at: status === 'approved' ? new Date().toISOString() : null })
            .eq('id', taskId);

        if (error) throw error;
    }
};
