import { supabase } from '../supabase';

export type AutonomyLevel = 'copilot' | 'semi' | 'autopilot';

export interface AiTask {
    id: string;
    company_id: string;
    agent_name: 'oracle' | 'maya' | 'sofia' | 'atlas';
    task_type: string;
    title: string;
    description: string;
    payload: unknown;
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'autopilot';
    confidence: number;
    impact_estimate?: string;
    created_at: string;
}

export const proactiveEngineService = {
    /**
     * Get the current autonomy setting for the company.
     * Uses direct table query — no RPC needed.
     * Returns 'copilot' as safe default on any error (table may not exist yet).
     */
    async getAutonomyLevel(companyId: string): Promise<AutonomyLevel> {
        try {
            const { data, error } = await supabase
                .from('ai_autonomy_settings')
                .select('autonomy_level')
                .eq('company_id', companyId)
                .maybeSingle();

            if (error) {
                // Table may not exist yet — silent fallback
                console.warn('[ProactiveEngine] getAutonomyLevel fallback to copilot:', error.message);
                return 'copilot';
            }
            return (data?.autonomy_level as AutonomyLevel) || 'copilot';
        } catch {
            return 'copilot';
        }
    },

    /**
     * Save the autonomy level using upsert — no RPC needed.
     * Falls back silently if the table doesn't exist yet (shows warning toast via caller).
     */
    async setAutonomyLevel(companyId: string, level: AutonomyLevel, updatedBy?: string): Promise<void> {
        const { error } = await supabase
            .from('ai_autonomy_settings')
            .upsert(
                {
                    company_id: companyId,
                    autonomy_level: level,
                    updated_at: new Date().toISOString(),
                    updated_by: updatedBy || null,
                },
                { onConflict: 'company_id' }
            );

        if (error) {
            console.error('[ProactiveEngine] setAutonomyLevel error:', error);
            throw new Error(
                error.message.includes('relation') || error.message.includes('does not exist')
                    ? 'Tabla no encontrada. Por favor aplica la migración SQL en Supabase primero.'
                    : error.message || 'Error al guardar configuración de autonomía'
            );
        }
    },

    /**
     * Fetch pending AI tasks from the queue.
     * Returns empty array on any error (schema cache, RLS, table missing, etc.)
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
                console.warn('[ProactiveEngine] getPendingTasks fallback:', error.message);
                return [];
            }
            return (data as AiTask[]) || [];
        } catch {
            return [];
        }
    },

    /**
     * Approve or reject a task using direct table update — no RPC needed.
     */
    async resolveTask(taskId: string, status: 'approved' | 'rejected'): Promise<void> {
        const { error } = await supabase
            .from('ai_tasks')
            .update({
                status,
                executed_at: status === 'approved' ? new Date().toISOString() : null,
            })
            .eq('id', taskId);

        if (error) {
            throw new Error(error.message || 'Error al procesar tarea');
        }
    },
};
