// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { prompt, systemPrompt, conversationId, messages, companyId } = body;

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        let resolvedCompanyId = companyId;

        // 1. Get Conversation to find Company if conversationId is provided
        if (conversationId) {
            const { data: conv } = await supabase
                .from('marketing_conversations')
                .select('company_id')
                .eq('id', conversationId)
                .single();
            if (conv) {
                resolvedCompanyId = conv.company_id;
            }
        }

        // 2. Get OpenAI Key for this company (Multi-tenant Security) with system fallback
        let apiKey = null;
        if (resolvedCompanyId) {
            const { data: integration } = await supabase
                .from('company_integrations')
                .select('credentials')
                .eq('company_id', resolvedCompanyId)
                .eq('provider', 'openai')
                .eq('is_active', true)
                .maybeSingle();
            apiKey = integration?.credentials?.apiKey;
        }

        if (!apiKey) {
            apiKey = Deno.env.get('OPENAI_API_KEY');
        }

        if (!apiKey) {
            throw new Error("OpenAI API key not configured");
        }

        // 3. Determine messages payload
        let messagesPayload = [];
        if (messages && Array.isArray(messages)) {
            messagesPayload = messages;
        } else {
            messagesPayload = [
                { role: 'system', content: systemPrompt || 'Eres un asistente útil.' },
                { role: 'user', content: prompt || '' }
            ];
        }

        // 4. Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Premium model
                messages: messagesPayload,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API error: ${errText}`);
        }

        const aiData = await response.json();
        const aiMessage = aiData.choices?.[0]?.message?.content || '';

        // Return the correct output format depending on request source
        if (messages && companyId) {
            return new Response(JSON.stringify({ content: aiMessage }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ response: aiMessage }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

    } catch (err) {
        console.error('Error in ai-chat function:', err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
