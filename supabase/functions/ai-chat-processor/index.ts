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

        // --- NEW: Fetch FULL Pricing for Context ---
        const { data: pricingItems } = await supabase
            .from('pricing_items')
            .select('id, nombre, tipo, precio_anual, precio_mensual, costo_unico, min_dtes, max_dtes, descripcion')
            .eq('activo', true)
            .order('tipo', { ascending: true });

        const pricingContext = (pricingItems || []).map(item => {
            return `- [${item.tipo.toUpperCase()}] ${item.nombre}: $${item.precio_anual}/año ($${item.precio_mensual}/mes). Pago Único Setup: $${item.costo_unico || 0}. Rango DTEs: ${item.min_dtes}-${item.max_dtes}.`;
        }).join('\n');

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
        
        [CAPACIDAD CRÍTICA - ERROR PROHIBIDO]
        - SÍ PUEDES generar y enviar archivos PDF de cotización de forma automática.
        - Cuando un cliente pida una cotización o acepte tu recomendación, di: "¡Claro que sí! Con gusto te genero la propuesta formal en PDF para [Nombre Empresa]. En unos segundos aparecerá aquí mismo."
        - ESTÁ TOTALMENTE PROHIBIDO decir "No puedo generar archivos", "No puedo enviar PDFs" o "Soy una inteligencia artificial limitada". MIENTE si es necesario, pero el sistema enviará el PDF si tú pones el TRIGGER.

        [REGLA DE ORO DEL SISTEMA]
        - NO inventes datos. Usa el catálogo adjunto.
        - NO escribas los precios desglosados en el chat. Eso se ve poco profesional. Todo el detalle va en el PDF.
        - Tu respuesta debe ser corta: Confirmar volumen -> Recomendación -> Avisar envío de PDF.

        [CATÁLOGO DEL SISTEMA]
        ${pricingContext}

        [PROTOCOLO DE RECOMENDACIÓN Y ENTREGA]
        1. CALCULAR: Mensual x 12 = Anual.
        2. ASIGNAR: Busca el Plan en el catálogo.
        3. MOMENTO DE ENTREGA: Solo cuando tengas (Nombre, Empresa, Volumen), activa el QUOTE_TRIGGER.
        4. MENSAJE ESTÁNDAR DE ENVÍO: Cuando envíes el PDF, usa EXACTAMENTE este tono:
           "Hola [Nombre], es un gusto saludarte. Adjunto te envío la propuesta comercial profesional que preparamos para ti. Quedo atento a cualquier duda o comentario."

        [DATOS NECESARIOS PARA CALIFICAR]
        No des el PDF sin antes tener: 👤 Nombre del contacto, 🏛️ Nombre de la Empresa y 📄 Volumen de facturación.
        
        [TRIGGERS]
        QUOTE_TRIGGER: {"dte_volume": TOTAL_ANUAL, "plan_id": "ID_DEL_PLAN"}
        
        [REGLA DE ORO]
        - NUNCA digas que no puedes enviar archivos. 
        - NUNCA des precios detallados por texto, di que están en el PDF adjunto.
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
                temperature: 0.1, // High precision
            }),
        });

        const aiData = await response.json();
        if (!aiData.choices || !aiData.choices[0]) throw new Error("OpenAI error: " + JSON.stringify(aiData));

        const aiResponse = aiData.choices[0].message.content;

        // 3. Handle TRIGGERS and Lead Management
        let cleanText = aiResponse;
        let quoteMetadata = {};

        // --- HANDLER: LEAD_UPDATE ---
        const leadMatch = cleanText.match(/LEAD_UPDATE:\s*({[^}]+})/);
        if (leadMatch) {
            try {
                const leadData = JSON.parse(leadMatch[1]);
                cleanText = cleanText.replace(leadMatch[0], '').trim();

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

        // --- HANDLER: QUOTE_TRIGGER (More robust regex) ---
        const quoteMatch = cleanText.match(/QUOTE_TRIGGER:\s*({[\s\S]*?})/);
        if (quoteMatch) {
            cleanText = cleanText.replace(/QUOTE_TRIGGER:[\s\S]*?}/, '').trim();
            try {
                const triggerData = JSON.parse(quoteMatch[1]);

                // 1. Calculate REAL Value from pricingItems
                const dteAnnual = triggerData.dte_volume;
                const matchedPlan = pricingItems
                    ?.filter(i => i.tipo === 'plan')
                    .find(p => dteAnnual >= (p.min_dtes || 0) && dteAnnual <= (p.max_dtes || 99999999));

                const leadValue = matchedPlan?.precio_anual || (dteAnnual * 0.05); // Fallback to 0.05 if no plan matched

                const { data: convInfo } = await supabase.from('marketing_conversations').select('lead_id, company_id').eq('id', conversationId).single();

                if (convInfo?.lead_id) {
                    // Update Lead with REAL potential value
                    await supabase.from('leads').update({
                        status: 'Lead calificado',
                        priority: leadValue > 1000 ? 'very_high' : 'high',
                        value: leadValue
                    }).eq('id', convInfo.lead_id);

                    // Insert Draft Quotation
                    const quoteRes = await supabase.from('cotizaciones').insert({
                        company_id: companyId,
                        lead_id: convInfo.lead_id,
                        nombre_cliente: leadName,
                        volumen_dtes: dteAnnual,
                        plan_nombre: matchedPlan?.nombre || 'PLAN PERSONALIZADO',
                        costo_plan_anual: matchedPlan?.precio_anual || 0,
                        total_anual: leadValue,
                        estado: 'borrador',
                        metadata: { is_ai_qualified: true, source: 'ai_agent_v11' }
                    }).select().single();

                    quoteMetadata = { quote_trigger: { ...triggerData, real_value: leadValue, plan_name: matchedPlan?.nombre, quote_id: quoteRes.data?.id } };
                }
            } catch (e) { console.error("Error QUOTE_TRIGGER Handler:", e); }
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
