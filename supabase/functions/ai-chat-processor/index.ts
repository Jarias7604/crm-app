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

        const enhancedSystemPrompt = `${systemPrompt}
        
        [INFORMACIÓN DE PRECIOS ACTUALIZADA]
        Usa estos datos REALES para calcular la cotización interna, pero NO los escribas en el chat.
        ${pricingContext}

        [INSTRUCCIÓN CRÍTICA DE FORMATO]
        - SI EL CLIENTE DA DATOS DE VOLUMEN (DTEs):
          1. Activa INMEDIATAMENTE el QUOTE_TRIGGER.
          2. Tu respuesta escrita debe ser únicamente un mensaje corto indicando que has generado la propuesta oficial.
          3. **PROHIBIDO** escribir precios, tablas o desgloses en el mensaje de texto.
          4. Di algo como: "Entendido. He preparado tu propuesta formal para {volumen} facturas. Puedes ver todos los detalles y precios en el PDF adjunto 👇".
        
        - Si el cliente pregunta precios explícitamente sin dar volumen: 
          Pregunta primero el volumen para poder generar el PDF oficial. Evita dar precios sueltos si es posible, dirige todo al PDF.
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

        // 3. Handle QUOTE_TRIGGER and Lead Management
        let cleanText = aiResponse;
        let quoteMetadata = {};

        if (aiResponse.includes('QUOTE_TRIGGER:')) {
            const parts = aiResponse.split('QUOTE_TRIGGER:');
            cleanText = parts[0].trim();
            try {
                const triggerData = JSON.parse(parts[1].trim());
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

                    await supabase.from('cotizaciones').insert({
                        company_id: companyId,
                        lead_id: convInfo.lead_id,
                        nombre_cliente: 'Lead Calificado (AI)',
                        volumen_dtes: triggerData.dte_volume,
                        plan_nombre: triggerData.plan_id || 'BASIC',
                        estado: 'borrador',
                        metadata: { is_ai_qualified: true }
                    });
                }
            } catch (e) {
                console.error("Error in lead management:", e);
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
