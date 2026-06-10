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
        const { prompt, companyId, performanceContext } = await req.json();

        if (!prompt || !companyId) {
            throw new Error("Missing prompt or companyId");
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch OpenAI Key
        const { data: integration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .single();

        const apiKey = integration?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
            throw new Error("OpenAI API Key no encontrada. Faltaba en los secretos, pero ya ha sido configurada.");
        }

        // 2. Gather LIVE CRM Context
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Get Overdue, Today's and Tomorrow's Follow-ups
        const { data: followUpsData } = await supabase
            .from('follow_ups')
            .select(`
                id, 
                date, 
                lead_id,
                leads!inner(id, name, email, phone, status, value)
            `)
            .eq('company_id', companyId)
            .eq('completed', false)
            .lte('date', new Date(todayStart.getTime() + 48 * 60 * 60 * 1000).toISOString())
            .order('date', { ascending: true })
            .limit(50);

        // Auto-Search: Find leads that might be mentioned in the user's prompt
        const words = prompt.replace(/[^\w\s]/gi, '').split(/\s+/).filter((w: string) => w.length > 3);
        let mentionedLeads: any[] = [];
        if (words.length > 0) {
            const searchConditions = words.map((w: string) => `name.ilike.%${w}%`).join(',');
            const { data: searchResults } = await supabase
                .from('leads')
                .select('id, name, email, phone, status, value')
                .eq('company_id', companyId)
                .or(searchConditions)
                .limit(5);
            
            if (searchResults) mentionedLeads = searchResults;
        }

        // Get Today's Activity (Calls)
        const { count: callsToday } = await supabase
            .from('call_activities')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .gte('call_date', todayStart.toISOString());

        const pendingLeads = followUpsData?.map(f => ({
            followup_id: f.id,
            lead_id: (f.leads as any).id,
            name: (f.leads as any).name,
            email: (f.leads as any).email,
            phone: (f.leads as any).phone,
            status: (f.leads as any).status,
            value: (f.leads as any).value
        })) || [];

        const contextData = {
            today: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            calls_made_today: callsToday || 0,
            pending_followups_count: pendingLeads.length,
            pending_leads: pendingLeads,
            specifically_mentioned_leads: mentionedLeads,
            performance_data: performanceContext || null,
        };

        // 3. Build System Prompt with Function Calling / Structured Output rules
        const systemPrompt = `
You are 'Sofía', an elite Autonomous CRM Operations Agent (Nivel DIOS) for Arias Defense CRM.
Your job is to read the live CRM context provided and answer the user's operational question concisely in Spanish.
You have the power to recommend and prepare automated actions (like sending emails or WhatsApps).

LIVE CRM CONTEXT:
${JSON.stringify(contextData, null, 2)}

INSTRUCTIONS:
1. Always analyze the user's request. If they ask "how many follow ups do I have", tell them based on the context.
2. If the user asks to send a message (e.g. "send an email to all of them" or "mandales un texto"), you MUST prepare a 'suggestedAction'.
3. If they don't explicitly ask to send a message but they have pending leads, proactively RECOMMEND sending a message (e.g., "Te recomiendo enviarles un correo de seguimiento. ¿Quieres que prepare el borrador?").
4. ALWAYS return a strictly valid JSON object matching this schema:
{
  "message": "Tu respuesta conversacional en formato Markdown. Sé muy breve, directo y profesional.",
  "suggestedAction": {
     "type": "none" | "send_email" | "send_whatsapp" | "send_telegram",
     "targetLeadIds": ["lead_id_1", "lead_id_2"],
     "draftSubject": "string (only if email)",
     "draftBody": "string (the actual message text to send)"
  }
}
Do NOT wrap the JSON in markdown blocks (no \`\`\`json). Output pure raw JSON only.
`;

        // 4. Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Extremely fast and cheap
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OpenAI Error: ${errBody}`);
        }

        const aiData = await response.json();
        const aiMessageStr = aiData.choices[0].message.content;
        
        let resultJson;
        try {
            resultJson = JSON.parse(aiMessageStr);
        } catch (e) {
            throw new Error("Invalid JSON from AI: " + aiMessageStr);
        }

        return new Response(JSON.stringify(resultJson), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error("Dashboard AI Agent Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
