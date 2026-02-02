import { supabase } from '../supabase';
import { pricingService } from '../pricing';
import { aiQuoteService } from './aiQuoteService';

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
        const { data, error } = await supabase
            .from('marketing_ai_agents')
            .update(agent)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as AiAgent;
    },

    async testBotResponse(message: string, agent: AiAgent) {
        // Isolated simulation for testing in the Config UI
        const userText = message.toLowerCase();
        let simulatedReply = "";

        // Get Pricing context for the test
        const pricing = await pricingService.getPricingConfig();

        if (userText.includes('pos') || userText.includes('punto de venta')) {
            simulatedReply = "Sobre lo que preguntas del **POS**: Nuestro Punto de Venta se integra 100% con la facturación y el inventario. Te permite vender con código de barras y manejar caja chica. ¿Te gustaría que lo incluya en tu presupuesto?";
        } else if (userText.includes('inventario') || userText.includes('stock')) {
            simulatedReply = "Respecto al **inventario**: Contamos con control de existencias en tiempo real, alertas automáticas de reposición y manejo de múltiples bodegas. ¿Es esta una prioridad para tu empresa?";
        } else if (userText.includes('contabilidad') || userText.includes('contable')) {
            simulatedReply = "Sobre el módulo **contable**: Generamos automáticamente el libro de ventas y diario a partir de tus facturas. Es ideal para ahorrar tiempo con el contador. ¿Quieres ver el precio de este módulo?";
        } else if (userText.includes('whatsapp') || userText.includes('notificaciones')) {
            simulatedReply = "En cuanto a **WhatsApp**: Sí, podemos enviar automáticamente el PDF del DTE al número del cliente apenas emitas la factura. ¿Quieres que lo activemos en tu plan?";
        } else if (userText.includes('factura') || userText.includes('dte') || userText.includes('volumen') || userText.includes('emito') || /\d+/.test(userText)) {
            const isMonthly = userText.includes('mes') || userText.includes('mensual');
            let dtes = parseInt(userText.match(/\d+/)?.[0] || "500");
            const annualDtes = isMonthly ? dtes * 12 : dtes;

            const matchedPlan = pricing.planes.find(p => annualDtes >= (p.min_dtes || 0) && annualDtes <= (p.max_dtes || 99999999));
            const planName = matchedPlan?.nombre || "BASIC";

            const volumeDesc = isMonthly
                ? `**${dtes.toLocaleString()} documentos al mes** (${annualDtes.toLocaleString()} al año)`
                : `**${dtes.toLocaleString()} documentos**`;

            simulatedReply = `¡Excelente! Para un volumen de ${volumeDesc}, el **Plan ${planName}** es el indicado. Acabo de preparar una propuesta PDF profesional con los detalles.`;
        } else if (userText.includes('precio') || userText.includes('costo') || userText.includes('cuanto vale')) {
            simulatedReply = "Nuestros costos son flexibles según tu volumen. Para darte el precio exacto del plan, ¿podrías confirmarme cuántas facturas emites mensualmente aproximadamente?";
        } else {
            simulatedReply = `Hola, soy ${agent.name}. Estoy configurado con un tono ${agent.tone} para ayudarte con ${agent.role_description}. ¿Cuántas facturas emites al mes para darte un plan?`;
        }

        return simulatedReply;
    },

    async processMessage(conversationId: string, message: string, companyId: string) {
        try {
            console.log(`AI: Invoking Backend Processor for conv ${conversationId}`);

            // Invoke the Smart Edge Function
            // It handles: Memory, Pricing, Agent Personality, PDF Generation, and Sending.
            const { data, error } = await supabase.functions.invoke('ai-chat-processor', {
                body: { conversationId }
            });

            if (error) throw error;

            console.log("AI: Backend response:", data);

            // We return null so ChatHub doesn't insert a duplicate message.
            // The Backend inserts the message, and ChatHub's subscription will display it.
            return null;

        } catch (error) {
            console.error('AI Processing Error:', error);
            // Fallback text if backend fails
            return { text: 'Lo siento, estoy teniendo problemas de conexión. Por favor intenta más tarde.' };
        }
    },

    async _handleAiAction(aiResponse: string, conversationId: string, companyId: string) {
        if (aiResponse.includes('QUOTE_TRIGGER:')) {
            const parts = aiResponse.split('QUOTE_TRIGGER:');
            const cleanText = parts[0].trim();
            const jsonStr = parts[1].trim();

            try {
                const triggerData = JSON.parse(jsonStr);
                const { data: conv } = await supabase.from('marketing_conversations').select('lead_id').eq('id', conversationId).single();

                if (conv?.lead_id) {
                    const result = await aiQuoteService.processAiQuote({
                        ...triggerData,
                        lead_id: conv.lead_id,
                        conversation_id: conversationId,
                        company_id: companyId
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
    }
};
