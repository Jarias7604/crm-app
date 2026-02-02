import { supabase } from '../supabase';

export interface AiAgent {
    id: string;
    company_id: string;
    name: string;
    role_description: string;
    tone: 'professional' | 'friendly' | 'aggressive' | 'empathetic';
    language: 'es' | 'en' | 'pt';
    is_active: boolean;
    active_channels: string[];
    system_prompt?: string;
    representative_id?: string | null;
}

export const aiAgentService = {
    async getAgents(companyId: string) {
        const { data, error } = await supabase
            .from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId);

        if (error) throw error;
        return data as AiAgent[];
    },

    async createAgent(agent: Partial<AiAgent>) {
        const { data, error } = await supabase
            .from('marketing_ai_agents')
            .insert(agent)
            .select()
            .single();

        if (error) throw error;
        return data as AiAgent;
    },

    async updateAgent(id: string, agent: Partial<AiAgent>) {
        const { error } = await supabase
            .from('marketing_ai_agents')
            .update(agent)
            .eq('id', id);

        if (error) throw error;
    },

    async testBotResponse(message: string, agent: AiAgent) {
        try {
            const { data, error } = await supabase.functions.invoke('ai-chat-processor', {
                body: {
                    message,
                    agent,
                    isTest: true
                }
            });

            if (error) throw error;
            return data.reply;
        } catch (error) {
            console.error('Error invoking function:', error);
            throw error;
        }
    },

    async processMessage(message: string, conversationId: string, companyId: string) {
        const { data: agentData } = await supabase
            .from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .single();

        if (!agentData) return { text: "Lo siento, el asistente no está disponible en este momento." };

        const { data, error } = await supabase.functions.invoke('ai-chat-processor', {
            body: {
                message,
                agent: agentData,
                conversationId,
                companyId
            }
        });

        if (error) throw error;

        const aiResponse = data.reply;
        let cleanText = aiResponse;

        // Extract potential JSON trigger
        if (aiResponse.includes('```json')) {
            try {
                const jsonStr = aiResponse.split('```json')[1].split('```')[0].trim();
                const trigger = JSON.parse(jsonStr);
                cleanText = aiResponse.split('```json')[0].trim();

                if (trigger.action === 'generate_quote') {
                    const { data: result } = await supabase.functions.invoke('ai-chat-processor', {
                        body: {
                            action: 'execute_quote',
                            params: trigger.params,
                            conversationId,
                            companyId
                        }
                    });

                    return {
                        text: cleanText,
                        quote: result.quote,
                        pdfUrl: result.pdfUrl
                    };
                }
            } catch (e) {
                console.error('Error parsing AI JSON trigger:', e);
            }

            return { text: cleanText };
        }

        return { text: aiResponse };
    },

    async getCompanyProfiles(companyId: string) {
        return await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('company_id', companyId);
    }
};
