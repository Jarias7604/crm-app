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

        // 1. Get OpenAI Key for this company
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

        // 3. Handle QUOTE_TRIGGER and Message Insertion
        let cleanText = aiResponse;
        let quoteMetadata = {};

        if (aiResponse.includes('QUOTE_TRIGGER:')) {
            const parts = aiResponse.split('QUOTE_TRIGGER:');
            cleanText = parts[0].trim();
            try {
                const triggerData = JSON.parse(parts[1].trim());
                // In a full implementation, we would call the quotation service here.
                // For speed and reliability in this fix, we mark it in metadata 
                // so the UI or another trigger can handle the PDF generation.
                quoteMetadata = { quote_trigger: triggerData };
            } catch (e) {
                console.error("Error parsing quote trigger:", e);
            }
        }

        // 4. Insert the response message into the DB
        // This will automatically trigger 'tr_on_outbound_message_delivery' to send to Telegram
        const { error: insertError } = await supabase
            .from('marketing_messages')
            .insert({
                conversation_id: conversationId,
                content: cleanText,
                direction: 'outbound',
                type: 'text',
                status: 'pending',
                metadata: {
                    ...quoteMetadata,
                    isAiGenerated: true,
                    processed_by: 'ai-processor-v1'
                }
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
