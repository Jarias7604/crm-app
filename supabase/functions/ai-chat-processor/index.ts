// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const { conversationId, prompt, systemPrompt, companyId } = payload;

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        if (!companyId) throw new Error("Missing companyId in payload");

        // 1. Get OpenAI Key
        const { data: integration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .maybeSingle();

        const apiKey = integration?.settings?.apiKey;
        if (!apiKey) throw new Error(`OpenAI API Key not found for company ${companyId}`);

        // --- NEW: Fetch Pricing for Context ---
        const { data: pricingItems } = await supabase
            .from('pricing_items')
            .select('nombre, tipo, precio_anual, min_dtes, max_dtes, descripcion')
            .eq('activo', true);

        const pricingContext = JSON.stringify(pricingItems || []);

        // --- NEW: Fetch Conversation & Lead Context ---
        const { data: conversationData } = await supabase
            .from('marketing_conversations')
            .select('lead:leads(name)')
            .eq('id', conversationId)
            .single();

        const leadName = conversationData?.lead?.name || 'Cliente';

        // --- NEW: Fetch Conversation History for Context ---
        const { data: historyData } = await supabase
            .from('marketing_messages')
            .select('content, direction')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(10);

        const history = (historyData || []).reverse().map(msg => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.content
        }));

        if (history.length > 0 && history[history.length - 1].role === 'user' && history[history.length - 1].content === prompt) {
            history.pop();
        }

        // --- NEW: Detect Phone Conflict ---
        let phoneConflict = "";
        const phoneMatch = prompt.match(/\b\d{4}[-\s]?\d{4}\b|\b\d{8,12}\b/);
        if (phoneMatch) {
            const detectedPhone = phoneMatch[0].replace(/[-\s]/g, '');
            const { data: existingLead } = await supabase
                .from('leads')
                .select('id, name')
                .eq('company_id', companyId)
                .eq('phone', detectedPhone)
                .maybeSingle();

            const { data: currentConv } = await supabase.from('marketing_conversations').select('lead_id').eq('id', conversationId).single();

            if (existingLead && existingLead.id !== currentConv?.lead_id) {
                phoneConflict = `
                [CONFLICTO DE IDENTIDAD DETECTADO]
                - El usuario ha proporcionado el teléfono: ${detectedPhone}
                - Este número ya pertenece en tu CRM a: "${existingLead.name}".
                - ACCIÓN: Antes de guardar, pregunta amablemente: "¿Ese número es tuyo o es de la persona [Nombre del anterior]?", o algo similar para confirmar si es la misma persona con un nombre diferente o alguien más.
                `;
            }
        }

        const enhancedSystemPrompt = `${systemPrompt}
        
        [CONTEXTO DEL CLIENTE]
        Estás hablando con: ${leadName}. Dirígete a él por su nombre cuando sea natural.
        ${phoneConflict}

        [INFORMACIÓN DE PRECIOS ACTUALIZADA]
        Usa estos datos REALES para calcular la cotización interna, pero NO los escribas en el chat.
        ${pricingContext}

        [PROTOCOLO DE CAPTURA DE DATOS (PRIORIDAD ALTA)]
        Tu objetivo PRINCIPAL es calificar al lead recopilando esta información:
        1. 👤 Nombre completo (si no lo tienes)
        2. 📱 Teléfono (vital para ventas)
        3. 📧 Email (para enviar cotización)
        4. 🏛️ ¿Recibió notificación de Hacienda? (SI/NO - Crítico para urgencia)
        5. 📄 Volumen de facturas (DTEs) mensuales.

        [TRIGGERS DE ACCIÓN - IMPORTANTE]
        Si el usuario te da CUALQUIERA de estos datos, DEBES incluirlos al inicio de tu respuesta en formato JSON estricto.
        
        Si detectas datos de contacto o estado de hacienda (Y NO HAY CONFLICTO DE IDENTIDAD):
        LEAD_UPDATE: {"name": "...", "email": "...", "phone": "...", "hacienda_status": "Recibió Notificación/No recibió"}
        (Envía solo los campos que detectes nuevos o corregidos).

        Si detectas intención de cotizar o volumen de facturas:
        QUOTE_TRIGGER: {"dte_volume": 100, "plan_id": "BASIC"}

        [INSTRUCCIÓN CRÍTICA DE FORMATO]
        - Si hay un [CONFLICTO DE IDENTIDAD], PRIORIZA resolver la duda antes de lanzar un LEAD_UPDATE.
        - Primero pon los TRIGGERS (LEAD_UPDATE o QUOTE_TRIGGER) si aplican.
        - Luego tu respuesta conversacional amable.
        - Eres un vendedor experto: si falta un dato, pídelo con naturalidad, no como un robot.
        - EJEMPLO: "LEAD_UPDATE: {"phone": "8888-8888"}\n\n¡Gracias! He guardado tu número. Cuéntame, ¿cuántas facturas emites al mes?"
        `;

        const messages = [
            { role: 'system', content: enhancedSystemPrompt },
            ...history,
            { role: 'user', content: prompt }
        ];

        // 2. Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                temperature: 0.3,
            }),
        });

        const aiData = await response.json();
        if (!aiData.choices || !aiData.choices[0]) throw new Error("OpenAI error: " + JSON.stringify(aiData));

        const aiResponse = aiData.choices[0].message.content;

        // 3. Handle TRIGGERS and Lead Management
        let cleanText = aiResponse;
        let quoteMetadata = {};

        // --- HANDLER: LEAD_UPDATE ---
        if (cleanText.includes('LEAD_UPDATE:')) {
            const parts = cleanText.split('LEAD_UPDATE:');
            // Check order to find where the JSON part is. Usually it's expected at start or before text.
            // We use regex to extract the JSON object safer
            const match = cleanText.match(/LEAD_UPDATE:\s*({[^}]+})/);
            if (match) {
                try {
                    const leadData = JSON.parse(match[1]);
                    cleanText = cleanText.replace(match[0], '').trim();

                    const updatePayload: any = {};
                    if (leadData.name) updatePayload.name = leadData.name;
                    if (leadData.email) updatePayload.email = leadData.email;
                    if (leadData.phone) updatePayload.phone = leadData.phone;
                    if (leadData.hacienda_status) {
                        updatePayload.next_action_notes = `Estado Hacienda: ${leadData.hacienda_status}`;
                        if (leadData.hacienda_status.toLowerCase().includes('si') || leadData.hacienda_status.toLowerCase().includes('recibió')) {
                            updatePayload.priority = 'very_high'; // Urgencia Hacienda
                        }
                    }

                    const { data: convInfo } = await supabase.from('marketing_conversations').select('lead_id').eq('id', conversationId).single();
                    if (convInfo?.lead_id && Object.keys(updatePayload).length > 0) {
                        await supabase.from('leads').update(updatePayload).eq('id', convInfo.lead_id);
                    }
                } catch (e) {
                    console.error("Error parsing LEAD_UPDATE:", e);
                }
            }
        }

        // --- HANDLER: QUOTE_TRIGGER ---
        if (cleanText.includes('QUOTE_TRIGGER:')) {
            const parts = cleanText.split('QUOTE_TRIGGER:');
            // We assume trigger is separated from text clearly
            const match = cleanText.match(/QUOTE_TRIGGER:\s*({[^}]+})/);
            if (match) {
                cleanText = cleanText.replace(match[0], '').trim();
                try {
                    const triggerData = JSON.parse(match[1]);
                    quoteMetadata = { quote_trigger: triggerData };

                    const { data: convInfo } = await supabase
                        .from('marketing_conversations')
                        .select('lead_id')
                        .eq('id', conversationId)
                        .single();

                    if (convInfo?.lead_id) {
                        await supabase
                            .from('leads')
                            .update({
                                status: 'Lead calificado',
                                priority: 'high',
                                value: (triggerData.dte_volume || 0) * 0.05
                            })
                            .eq('id', convInfo.lead_id);

                        // Upsert quotation draft
                        await supabase.from('cotizaciones').insert({
                            company_id: companyId,
                            lead_id: convInfo.lead_id,
                            nombre_cliente: leadName || 'Cliente Autogenerado',
                            volumen_dtes: triggerData.dte_volume,
                            plan_nombre: triggerData.plan_id || 'BASIC',
                            estado: 'borrador',
                            metadata: { is_ai_qualified: true, source: 'ai_agent' }
                        });
                    }
                } catch (e) {
                    console.error("Error in lead management:", e);
                }
            }
        }

        // 4. Insert response
        const { error: insertError } = await supabase
            .from('marketing_messages')
            .insert({
                conversation_id: conversationId,
                content: cleanText,
                direction: 'outbound',
                type: 'text',
                status: 'pending',
                metadata: { ...quoteMetadata, isAiGenerated: true, processed_by: 'ai-processor-v7' }
            });

        if (insertError) throw insertError;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('AI-CHAT-PROCESSOR Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
