import { supabase } from '../supabase';

export interface AiAgent {
    id: string;
    name: string;
    role_description: string;
    tone: 'professional' | 'friendly' | 'aggressive' | 'empathetic';
    language: 'es' | 'en' | 'pt';
    is_active: boolean;
    active_channels: string[];
    system_prompt?: string;
}

export const aiAgentService = {
    async getAgents() {
        const { data, error } = await supabase
            .from('marketing_ai_agents')
            .select('*');

        if (error) throw error;
        return data as AiAgent[];
    },

    async updateAgent(id: string, updates: Partial<AiAgent>) {
        const { error } = await supabase
            .from('marketing_ai_agents')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async createAgent(agent: Partial<AiAgent>) {
        const { data, error } = await supabase
            .from('marketing_ai_agents')
            .insert(agent)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Mock testing the bot
    async testBotResponse(message: string, agent: AiAgent): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simple mock logic based on tone
        if (agent.tone === 'friendly') {
            return `¡Hola! 👋 Gracias por escribirnos. Claro que sí, ${generateMockAnswer(message)}`;
        } else if (agent.tone === 'aggressive') {
            return `Si quieres resultados, toma acción ahora. ${generateMockAnswer(message)}`;
        } else {
            return `Estimado cliente, gracias por su consulta. Le informo que ${generateMockAnswer(message)}`;
        }
    }
};

function generateMockAnswer(msg: string) {
    if (msg.toLowerCase().includes('precio')) return 'nuestros precios comienzan desde $50/mes con planes a medida.';
    if (msg.toLowerCase().includes('demo')) return 'podemos agendar una demo mañana mismo. ¿Le queda bien a las 10 AM?';
    return 'un asesor especializado revisará su caso en breve.';
}
