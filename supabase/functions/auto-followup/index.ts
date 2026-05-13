// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false } }
);

console.log('[auto-followup v2-dynamic] Initialized');

// ── Default settings (safe fallback if ai_followup_settings table has no row) ─
const DEFAULT_SETTINGS = {
    first_followup_hours:  24,
    second_followup_hours: 72,
    third_followup_hours:  168,
    max_followups:         3,
    auto_escalate:         true,
    only_business_hours:   false,
    timezone:              'America/El_Salvador',
    pause_after_quote:     false,
    followup_1_template:   null,
    followup_2_template:   null,
    followup_3_template:   null,
    is_active:             true,
};

// ── Business hours check ───────────────────────────────────────────────────
function isBusinessHours(tz: string): boolean {
    const now = new Date();
    const local = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric', hour12: false,
        weekday: 'short'
    }).formatToParts(now);
    const hour = parseInt(local.find(p => p.type === 'hour')?.value || '12');
    const day  = local.find(p => p.type === 'weekday')?.value || 'Mon';
    return !['Sat', 'Sun'].includes(day) && hour >= 8 && hour < 18;
}

// ── Build followup message (custom template or smart built-in) ────────────
function buildFollowupMessage(memory: any, lead: any, followupNum: number, settings: typeof DEFAULT_SETTINGS): string {
    const name      = lead?.name?.split(' ')[0] || 'estimado cliente';
    const stage     = memory?.conversation_stage || 'nuevo';
    const objection = memory?.last_objection || '';
    const sentiment = memory?.sentiment_score || 50;
    const facts     = memory?.known_facts || {};
    const empresa   = lead?.company_name || facts?.empresa_mencionada || 'su empresa';
    const plan      = facts?.plan_sugerido || 'el plan que le recomendé';

    // Use custom template if admin configured one
    const templateMap: Record<number, string | null> = {
        1: settings.followup_1_template,
        2: settings.followup_2_template,
        3: settings.followup_3_template,
    };
    const tpl = templateMap[followupNum] || null;
    if (tpl) {
        return tpl
            .replace(/{nombre}/gi, name)
            .replace(/{empresa}/gi, empresa)
            .replace(/{plan}/gi, plan);
    }

    // Smart built-in messages
    if (followupNum === 1) {
        if (stage === 'cotizado') return `Hola ${name} 👋 Solo quería confirmar si tuvo oportunidad de revisar la propuesta. Quedo disponible para cualquier duda — estoy aquí para que la decisión sea más sencilla. 😊`;
        if (objection.includes('caro') || sentiment < 40) return `Hola ${name}! Estuve pensando en su situación y quería comentarle que tenemos un plan de cuotas a 12 meses que hace la inversión mucho más cómoda. ¿Le cuento los detalles?`;
        return `Hola ${name} 👋 ¿Cómo está? Quería retomar nuestra conversación sobre la facturación electrónica. ¿Tiene 2 minutos?`;
    }
    if (followupNum === 2) {
        const dtes = facts?.volumen_dtes ? `${facts.volumen_dtes} documentos anuales` : 'su volumen de facturación';
        return `Hola ${name}! 📊 Para ${dtes}, el sistema se paga solo en el primer trimestre con los ahorros en tiempo y multas evitadas. Tenemos los últimos 2 cupos disponibles esta semana. ¿Le gustaría asegurar el suyo?`;
    }
    return `Hola ${name}, este es mi último mensaje para no molestarle. 🤝 Si en algún momento necesita asesoría en facturación electrónica, aquí estaremos. ¿Hay algo que le haya impedido avanzar?`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const logs: string[] = [];
    const log = (...args: any[]) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        logs.push(`[${new Date().toISOString()}] ${msg}`);
        console.log(msg);
    };

    try {
        const body = await req.json().catch(() => ({}));
        const targetCompanyId = body?.company_id || null;
        log(`Starting auto-followup v2-dynamic. Target: ${targetCompanyId || 'ALL'}`);

        let query = supabase
            .from('marketing_conversations')
            .select(`id, company_id, lead_id, channel, external_id,
                lead:leads(id, name, phone, company_name, status),
                last_message_at`)
            .eq('status', 'active');

        if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
        const { data: conversations, error: convErr } = await query.limit(100);
        if (convErr) throw convErr;
        log(`Found ${conversations?.length || 0} open conversations`);

        // Cache settings per company to avoid redundant DB calls
        const settingsCache: Record<string, typeof DEFAULT_SETTINGS> = {};
        const getSettings = async (companyId: string) => {
            if (settingsCache[companyId]) return settingsCache[companyId];
            const { data } = await supabase
                .from('ai_followup_settings')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .maybeSingle();
            settingsCache[companyId] = data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
            return settingsCache[companyId];
        };

        let followupsSent = 0, escalationsCreated = 0, skipped = 0;
        const now = new Date();

        for (const conv of (conversations || [])) {
            try {
                const settings = await getSettings(conv.company_id);

                if (settings.only_business_hours && !isBusinessHours(settings.timezone)) {
                    log(`Conv ${conv.id}: outside business hours`); skipped++; continue;
                }

                const { data: lastMsgs } = await supabase
                    .from('marketing_messages')
                    .select('direction, created_at')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                const lastMsg = lastMsgs?.[0];
                const lastMsgAgeHours = lastMsg
                    ? (now.getTime() - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60)
                    : 999;

                const isLastInbound = lastMsg?.direction === 'inbound';
                const isStale = lastMsgAgeHours > settings.first_followup_hours;
                if (!isLastInbound && !isStale) { log(`Conv ${conv.id}: recent outbound, skipping`); skipped++; continue; }

                const { data: memory } = await supabase
                    .from('lead_ai_memory').select('*').eq('lead_id', conv.lead_id).maybeSingle();

                if (memory?.followup_paused) { log(`Conv ${conv.id}: paused`); skipped++; continue; }
                if (settings.pause_after_quote && memory?.conversation_stage === 'cotizado') { skipped++; continue; }

                const followupCount = memory?.followup_count || 0;

                if (followupCount >= settings.max_followups) {
                    if (settings.auto_escalate) {
                        log(`Conv ${conv.id}: max followups reached, escalating`);
                        await supabase.rpc('upsert_lead_memory', {
                            p_lead_id: conv.lead_id, p_company_id: conv.company_id,
                            p_next_action: 'escalar_humano', p_stage: 'seguimiento'
                        });
                        await supabase.from('leads').update({
                            notes: `⚠️ IA ESCALÓ: Sin respuesta tras ${settings.max_followups} seguimientos. Requiere contacto humano. Última interacción: ${new Date(conv.last_message_at).toLocaleDateString('es')}`,
                            status: 'En seguimiento', updated_at: new Date().toISOString()
                        }).eq('id', conv.lead_id);
                        escalationsCreated++;
                    }
                    continue;
                }

                // Check timing between followups using dynamic hours from settings
                if (memory?.last_followup_at) {
                    const hoursSinceLast = (now.getTime() - new Date(memory.last_followup_at).getTime()) / (1000 * 60 * 60);
                    const required = followupCount === 0 ? settings.first_followup_hours
                                   : followupCount === 1 ? settings.second_followup_hours
                                   : settings.third_followup_hours;
                    if (hoursSinceLast < required) {
                        log(`Conv ${conv.id}: ${hoursSinceLast.toFixed(1)}h elapsed, need ${required}h`); skipped++; continue;
                    }
                }

                const nextNum = followupCount + 1;
                const followupText = buildFollowupMessage(memory, conv.lead, nextNum, settings);

                const { data: integration } = await supabase
                    .from('marketing_integrations').select('settings, provider')
                    .eq('company_id', conv.company_id)
                    .eq('provider', conv.channel === 'whatsapp' ? 'whatsapp' : 'telegram')
                    .eq('is_active', true).maybeSingle();

                await supabase.from('marketing_messages').insert({
                    conversation_id: conv.id, content: followupText,
                    direction: 'outbound', type: 'text', status: 'pending',
                    metadata: { isAiGenerated: true, isAutoFollowup: true, followupNumber: nextNum, processed_by: 'auto-followup-v2' }
                });

                if (conv.channel === 'telegram' && conv.external_id && integration?.settings?.token) {
                    const tgResp = await fetch(`https://api.telegram.org/bot${integration.settings.token}/sendMessage`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: conv.external_id, text: followupText, parse_mode: 'Markdown' })
                    });
                    const tgResult = await tgResp.json();
                    if (tgResult.ok) log(`✅ Followup #${nextNum} sent to ${conv.lead?.name}`);
                }

                await supabase.rpc('upsert_lead_memory', {
                    p_lead_id: conv.lead_id, p_company_id: conv.company_id,
                    p_next_action: nextNum >= settings.max_followups ? 'escalar_humano' : 'seguimiento',
                    p_stage: 'seguimiento'
                });
                await supabase.from('lead_ai_memory')
                    .update({ followup_count: nextNum, last_followup_at: now.toISOString(), last_followup_msg: followupText })
                    .eq('lead_id', conv.lead_id);

                followupsSent++;
            } catch (e) { log(`Error on conv ${conv.id}: ${e.message}`); }
        }

        log(`Done. Sent: ${followupsSent}, Escalated: ${escalationsCreated}, Skipped: ${skipped}`);
        return new Response(JSON.stringify({
            success: true, version: 'v2-dynamic',
            followups_sent: followupsSent, escalations: escalationsCreated,
            skipped, evaluated: conversations?.length || 0, logs
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('FATAL:', err);
        return new Response(JSON.stringify({ error: String(err), logs }), { status: 500, headers: corsHeaders });
    }
});
