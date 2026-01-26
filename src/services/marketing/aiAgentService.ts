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
            const dtes = parseInt(userText.match(/\d+/)?.[0] || "500");
            const planName = pricing.planes.find(p => dtes >= (p.min_dtes || 0) && dtes <= (p.max_dtes || 999999))?.nombre || "BASIC";
            simulatedReply = `¡Excelente! Para un volumen de **${dtes.toLocaleString()} documentos**, el **Plan ${planName}** es el indicado. Acabo de preparar una propuesta PDF profesional con los detalles.`;
        } else if (userText.includes('precio') || userText.includes('costo') || userText.includes('cuanto vale')) {
            simulatedReply = "Nuestros costos son flexibles según tu volumen. Para darte el precio exacto del plan, ¿podrías confirmarme cuántas facturas emites mensualmente aproximadamente?";
        } else {
            simulatedReply = `Hola, soy ${agent.name}. Estoy configurado con un tono ${agent.tone} para ayudarte con ${agent.role_description}. ¿Cuántas facturas emites al mes para darte un plan?`;
        }

        return simulatedReply;
    },

    async processMessage(conversationId: string, message: string, companyId: string) {
        try {
            console.log(`AI: Processing message for conv ${conversationId} (Company: ${companyId})`);

            // 1. Get Agent for this company
            let { data: agent } = await supabase
                .from('marketing_ai_agents')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .maybeSingle();

            // FALLBACK: Auto-create agent if none exists (for testing/first run)
            if (!agent) {
                console.log("AI: No agent found, creating default 'Consultor Comercial'...");
                const { data: newAgent, error: createError } = await supabase
                    .from('marketing_ai_agents')
                    .insert({
                        company_id: companyId,
                        name: 'Asistente IA',
                        role_description: 'Consultor experto en facturación electrónica',
                        tone: 'professional',
                        language: 'es',
                        is_active: true,
                        active_channels: ['telegram', 'whatsapp', 'web']
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error("AI: Error creating fallback agent:", createError);
                    // Use a mock object if DB insert fails (e.g. unique constraint or RLS)
                    agent = { company_id: companyId, tone: 'professional', role_description: 'Consultor', language: 'es' } as any;
                } else {
                    agent = newAgent;
                }
            }

            // 2. Build Context (Last Inbound Message)
            const { data: history } = await supabase
                .from('marketing_messages')
                .select('content, direction')
                .eq('conversation_id', conversationId)
                .order('sent_at', { ascending: false })
                .limit(10);

            // If message is empty (auto-trigger), find the last message from the CLIENT (inbound)
            const lastInbound = history?.find(m => m.direction === 'inbound')?.content || "";
            const userText = (message || lastInbound || "").toLowerCase();

            if (!userText) {
                console.log("AI: No user message found to respond to.");
                return null;
            }

            console.log(`AI: Analyzing user text: "${userText}"`);

            // 3. Get Real Pricing Data to inject in Prompt
            const pricing = await pricingService.getPricingConfig();

            // 4. Get Lead info from conversation for personalized context
            const { data: convData } = await supabase
                .from('marketing_conversations')
                .select(`
                    id, 
                    channel, 
                    lead:leads(name, company_name, email, phone)
                `)
                .eq('id', conversationId)
                .single();

            const lead = convData?.lead as any;
            const context = {
                agent_name: agent?.name || 'Asistente',
                agent_role: agent?.role_description || 'Consultor',
                lead_name: lead?.name || 'Cliente',
                lead_company: lead?.company_name || 'Individual',
                pricing: {
                    planes: pricing.planes.map(p => ({ id: p.id, nombre: p.nombre, min_dte: p.min_dtes, max_dte: p.max_dtes, precio_anual: p.precio_anual })),
                    modulos: pricing.modulos.map(m => ({ id: m.id, nombre: m.nombre, precio_anual: m.precio_anual }))
                }
            };

            const systemPrompt = `
                Eres ${context.agent_name}, ${context.agent_role}. 
                Te diriges a ${context.lead_name} de la empresa ${context.lead_company}.
                
                CONOCIMIENTO DE PRECIOS:
                - Planes: ${JSON.stringify(context.pricing.planes)}
                - Módulos opcionales: ${JSON.stringify(context.pricing.modulos)}

                REGLA DE COTIZACIÓN AUTOMÁTICA:
                Si el cliente menciona su volumen de facturación o acepta una propuesta, responde amablemente y AL FINAL de tu respuesta texto incluye SIEMPRE este formato: 
                QUOTE_TRIGGER: { "dte_volume": NUMERO, "plan_id": "ID_DEL_PLAN", "modules": ["ID1", "ID2"] }
                Usa el ID del plan que mejor se ajuste al volumen.
            `;

            // 4. TRY REAL AI (Edge Function)
            try {
                const { data, error } = await supabase.functions.invoke('ai-chat', {
                    body: {
                        prompt: userText,
                        systemPrompt: systemPrompt,
                        conversationId
                    }
                });

                if (!error && data?.response) {
                    return this._handleAiAction(data.response, conversationId, companyId);
                }
            } catch (e) {
                // Silently fallback to simulation
            }

            // 5. ENHANCED LOCAL SIMULATION FALLBACK (Dynamic keyword engine)
            console.log(`AI: Simulating response for keyword-rich text: "${userText}"`);
            let simulatedReply = "";
            let triggerJson = "";

            // Dynamic logic search
            if (userText.includes('pos') || userText.includes('punto de venta')) {
                simulatedReply = "Sobre lo que preguntas del **POS**: Nuestro Punto de Venta se integra 100% con la facturación y el inventario. Te permite vender con código de barras y manejar caja chica. ¿Te gustaría que lo incluya en tu presupuesto?";
            } else if (userText.includes('inventario') || userText.includes('stock')) {
                simulatedReply = "Respecto al **inventario**: Contamos con control de existencias en tiempo real, alertas automáticas de reposición y manejo de múltiples bodegas. ¿Es esta una prioridad para tu empresa?";
            } else if (userText.includes('contabilidad') || userText.includes('contable')) {
                simulatedReply = "Sobre el módulo **contable**: Generamos automáticamente el libro de ventas y diario a partir de tus facturas. Es ideal para ahorrar tiempo con el contador. ¿Quieres ver el precio de este módulo?";
            } else if (userText.includes('whatsapp') || userText.includes('notificaciones')) {
                simulatedReply = "En cuanto a **WhatsApp**: Sí, podemos enviar automáticamente el PDF del DTE al número del cliente apenas emitas la factura. ¿Quieres que lo activemos en tu plan?";
            } else if (userText.includes('factura') || userText.includes('dte') || userText.includes('volumen') || userText.includes('emito') || /\d+/.test(userText)) {
                const dtes = parseInt(userText.match(/\d+/)?.[0] || "500");
                const matchedPlan = pricing.planes.find(p => dtes >= (p.min_dtes || 0) && dtes <= (p.max_dtes || 999999));
                const planName = matchedPlan?.nombre || "BASIC";

                simulatedReply = `¡Excelente, ${context.lead_name}! Para un volumen de **${dtes.toLocaleString()} documentos**, el **Plan ${planName}** es el indicado para ${context.lead_company}. Acabo de preparar una propuesta PDF profesional con los detalles. ¿Necesitas que agregue algún módulo como Inventario o POS?`;
                triggerJson = `QUOTE_TRIGGER: { "dte_volume": ${dtes}, "plan_id": "${matchedPlan?.id || ''}", "include_imp": true }`;
            } else if (userText.includes('precio') || userText.includes('costo') || userText.includes('cuanto vale')) {
                simulatedReply = "Nuestros costos son flexibles según tu volumen. Para darte el precio exacto del plan, ¿podrías confirmarme cuántas facturas emites mensualmente aproximadamente?";
            } else if (userText.includes('demo') || userText.includes('probar')) {
                simulatedReply = "¡Con gusto! Podemos agendar una demo guiada. Mientras tanto, ¿me dices tu volumen de facturación para enviarte una propuesta preliminar?";
            } else if (userText.includes('gracias') || userText.includes('bueno') || userText.includes('ok')) {
                simulatedReply = "¡A la orden! Quedo pendiente de cualquier otra duda sobre los módulos o el proceso de certificación.";
            } else if (userText.includes('hola') || userText.includes('buenos dias') || userText.includes('buenas tardes')) {
                simulatedReply = `¡Hola! Soy tu asistente comercial. Estoy aquí para asesorarte en tu paso a la facturación electrónica. ¿Cuántas facturas o documentos emites al mes aproximadamente?`;
            } else {
                simulatedReply = `Entiendo. Para poder asesorarte mejor sobre facturación electrónica y nuestros módulos (POS, Inventario, Contratación), ¿me podrías decir cuántas facturas emites al mes?`;
            }

            console.log("AI: Simulation generated dynamic response.");
            return this._handleAiAction(`${simulatedReply}\n\n${triggerJson}`, conversationId, companyId);

        } catch (error) {
            console.error('AI Processing Error:', error);
            return { text: 'He recibido tu mensaje. Un consultor humano revisará tu caso para darte una respuesta comercial detallada pronto.' };
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
