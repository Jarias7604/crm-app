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
        const { action, payload, companyId } = await req.json();

        if (!action || !companyId) {
            throw new Error("Missing action or companyId");
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Fetch OpenAI Key
        const { data: integration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .single();

        const apiKey = integration?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
            throw new Error("OpenAI API Key not found. Please configure it in the marketing integrations.");
        }

        let systemPrompt = "";
        let userPrompt = "";

        if (action === "generate_campaign") {
            const { topic, tone, audience, channel } = payload;
            systemPrompt = `You are 'Maya', an elite Content Generation AI for Arias Defense CRM.
Your objective is to generate highly persuasive, high-conversion copy for marketing campaigns.
You must output ONLY valid JSON matching this schema:
{
  "subject": "String (Only if email, else empty)",
  "body": "String (The actual message text, use markdown, emojis allowed but keep it professional, use standard variables like {{name}} if needed)"
}

Guidelines:
- Tone: ${tone || 'Professional'}
- Audience: ${audience || 'General leads'}
- Channel: ${channel || 'Email'}
- Keep it concise, focused on action, and psychologically compelling.`;
            userPrompt = `Write a campaign message about: ${topic}`;
        } else if (action === "enhance_template") {
            const { text, goal } = payload;
            systemPrompt = `You are 'Maya', an elite Copywriter AI.
Improve the given text to make it more persuasive and professional.
Output ONLY JSON:
{
  "enhancedText": "The improved version"
}`;
            userPrompt = `Original text: ${text}\nGoal: ${goal || 'Make it sound better'}`;
        } else {
            throw new Error(`Unknown action: ${action}`);
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OpenAI Error: ${errBody}`);
        }

        const aiData = await response.json();
        const resultJson = JSON.parse(aiData.choices[0].message.content);

        return new Response(JSON.stringify(resultJson), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error("Maya Agent Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
