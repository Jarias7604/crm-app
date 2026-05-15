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
     * Get the current autonomy setting for the company.
     * Returns 'copilot' as safe default on any error (including schema cache miss).
     */
    async getAutonomyLevel(companyId: string): Promise<AutonomyLevel> {
        try {
            const { data, error } = await supabase
                .rpc('get_autonomy_level', { p_company_id: companyId });

            if (error) {
                console.error('getAutonomyLevel rpc error:', error);
                return 'copilot';
            }
            return (data as AutonomyLevel) || 'copilot';
        } catch {
            return 'copilot';
        }
    },

    /**
     * Update the autonomy setting for the company.
     * Throws a user-friendly message on failure.
     */
    async setAutonomyLevel(companyId: string, level: AutonomyLevel): Promise<void> {
        try {
            const { error } = await supabase
                .rpc('set_autonomy_level', { p_company_id: companyId, p_level: level });

            if (error) {
                console.error('setAutonomyLevel rpc error:', error);
                throw new Error('No se pudo guardar. Verifica tu conexión e intenta de nuevo.');
            }
        } catch (err: any) {
            throw new Error(err.message || 'Error al guardar configuración');
        }
    },

    /**
     * Fetch pending AI tasks from the queue.
     * Returns empty array on any error (schema cache, RLS, etc.)
     */
    async getPendingTasks(companyId: string): Promise<AiTask[]> {
        try {
            const { data, error } = await supabase
                .from('ai_tasks')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'pending')
                .order('confidence', { ascending: false });

            if (error) {
                console.error('getPendingTasks error:', error);
                return [];
            }
            return data as AiTask[];
        } catch {
            return [];
        }
    },

    /**
     * Approve or reject a task
     */
    async resolveTask(taskId: string, status: 'approved' | 'rejected'): Promise<void> {
        try {
            const { error } = await supabase
                .from('ai_tasks')
                .update({ status, executed_at: status === 'approved' ? new Date().toISOString() : null })
                .eq('id', taskId);

            if (error) throw new Error(error.message);
        } catch (err: any) {
            throw new Error(err.message || 'Error al procesar tarea');
        }
    }
};
