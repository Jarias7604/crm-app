// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { conversationId, prompt, systemPrompt, companyId } = await req.json();

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get OpenAI Key
        const { data: integration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'openai')
            .single();

        const apiKey = integration?.settings?.apiKey;
        if (!apiKey) throw new Error("OpenAI API Key not found");

        // 2. Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            }),
        });

        const aiData = await response.json();
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

                console.log('[ai-chat-processor] Qualifying lead...');

                const { data: convInfo } = await supabase
                    .from('marketing_conversations')
                    .select('lead_id')
                    .eq('id', conversationId)
                    .single();

                if (convInfo?.lead_id) {
                    // Update Lead Status to 'Lead calificado'
                    await supabase
                        .from('leads')
                        .update({
                            status: 'Lead calificado',
                            priority: 'high',
                            value: (triggerData.dte_volume || 0) * 0.05
                        })
                        .eq('id', convInfo.lead_id);

                    // Register preliminary quote
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
                metadata: { ...quoteMetadata, isAiGenerated: true, processed_by: 'ai-processor-v3' }
            });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('AI-CHAT-PROCESSOR Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
