// @ts-nocheck
// auto-followup v4 — Agente Autónomo Inteligente con GPT-4o
// Genera seguimientos 100% contextuales basados en la memoria del lead
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

const DEFAULT_SETTINGS = {
    first_followup_hours:  24,
    second_followup_hours: 96,
    third_followup_hours:  168,
    max_followups:         3,
    auto_escalate:         true,
    only_business_hours:   false,
    timezone:              'America/El_Salvador',
    pause_after_quote:     false,
    is_active:             true,
};

function isBusinessHours(tz: string): boolean {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', hour12: false, weekday: 'short'
    }).formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '12');
    const day  = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    return !['Sat', 'Sun'].includes(day) && hour >= 8 && hour < 18;
}

// ── GPT-4o Contextual Message Generator ──────────────────────────────────────
async function generateSmartFollowup(
    lead: any,
    memory: any,
    followupNum: number,
    recentMessages: string[],
    apiKey: string
): Promise<string> {
    const firstName = lead?.name?.split(' ')[0] || lead?.name || 'estimado cliente';
    const facts     = memory?.known_facts || {};
    const stage     = memory?.conversation_stage || 'nuevo';
    const sentiment = memory?.sentiment_score || 50;
    const objection = memory?.last_objection || '';
    const crmStatus = lead?.status || 'Prospecto'; // ✅ 1C: CRM pipeline stage

    // ── Build rich context for the AI ────────────────────────────────────────
    const now = new Date();

    // Demo date context
    let demoContext = '';
    if (facts.demo_scheduled_at) {
        const demoDate = new Date(facts.demo_scheduled_at);
        const hoursUntilDemo = (demoDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDemo > 0 && hoursUntilDemo <= 48) {
            demoContext = `CONTEXTO CRÍTICO: El lead tiene un DEMO AGENDADO en ${Math.round(hoursUntilDemo)} horas (${demoDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}). El mensaje DEBE ser un recordatorio del demo.`;
        } else if (hoursUntilDemo <= 0 && hoursUntilDemo >= -24) {
            demoContext = `CONTEXTO: El demo fue hace ${Math.abs(Math.round(hoursUntilDemo))} horas. Hacer seguimiento post-demo: preguntar cómo les fue, resolver dudas, avanzar a propuesta.`;
        }
    }

    // Quote expiry context
    let quoteContext = '';
    if (facts.quote_created_at && (stage === 'cotizado' || stage === 'seguimiento')) {
        const quoteDate = new Date(facts.quote_created_at);
        const quoteExpiry = new Date(quoteDate.getTime() + 48 * 60 * 60 * 1000);
        const hoursLeft = (quoteExpiry.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursLeft > 0 && hoursLeft <= 48) {
            quoteContext = `CONTEXTO URGENTE: La cotización del lead VENCE en ${Math.round(hoursLeft)} horas. El mensaje DEBE mencionar el vencimiento con urgencia. Plan cotizado: ${facts.last_quoted_plan || 'el plan seleccionado'}, precio: $${facts.last_quoted_price || 'cotizado'}.`;
        } else if (hoursLeft <= 0) {
            quoteContext = `CONTEXTO: La cotización venció. Ofrecer renovarla o agendar llamada para resolver dudas. Plan: ${facts.last_quoted_plan || 'el plan seleccionado'}.`;
        }
    }

    // CRM Stage guide (pipeline status → message strategy)
    const crmStageGuide: Record<string, string> = {
        'Prospecto':       'Lead reciente, primer contacto. Sé corto y breve. Presenta valor. NO cotices aún.',
        'Llamada fría':   'Intentamos contactarle antes. Retoma con empatía. Pregunta cuándo es buen momento.',
        'En Nutrición':   'Le hemos compartido información. Agrega valor nuevo. Empuja hacia calificación.',
        'Lead calificado': 'Ya sabemos su necesidad. Ofrece cotización personalizada o demo directamente.',
        'En seguimiento':  'Propuesta o contacto previo. Resuelve dudas. Genera urgencia o valor adicional.',
        'Negociación':    'URGENTE. Está casi listo. Mensaje de cierre. Próximos pasos concretos. Elimina fricción.',
        'Cerrado':         'Ya es cliente. NO enviar seguimiento.',
        'Cliente':         'Ya es cliente. NO enviar seguimiento.',
        'Perdido':         'Reactivación suave. Han pasado semanas. Nueva propuesta de valor o novedad.',
    };
    const crmGuide = crmStageGuide[crmStatus] || crmStageGuide['En seguimiento'];

    const systemPrompt = `Eres Sofía, una agente de ventas autónoma de Arias Defense, especialista en facturación electrónica.

DATOS DEL LEAD:
- Nombre: ${lead?.name || 'Sin nombre'}
- Primer nombre: ${firstName}
- Empresa: ${lead?.company_name || facts.empresa_mencionada || 'No registrada'}
- Etapa CRM (pipeline): ${crmStatus}
- Etapa AI (conversación): ${stage}
- Sentimiento (0-100): ${sentiment}
- Última objeción: ${objection || 'Ninguna'}
- Volumen DTEs: ${facts.volumen_dtes || 'No registrado'}
- Plan cotizado: ${facts.last_quoted_plan || 'No cotizado aún'}
- Precio cotizado: ${facts.last_quoted_price ? '$' + facts.last_quoted_price : 'No cotizado'}
- Seguimiento #: ${followupNum} de 3

NECESIDAD ESTRATÉGICA DE ESTE LEAD (basada en su etapa CRM):
${crmGuide}

NECESIDAD ESTRATÉGICA (basada en conversación AI):
Sentimiento ${sentiment}/100${sentiment < 40 ? ' — lead frío, no presiones' : sentiment > 70 ? ' — lead caliente, empuja al cierre' : ' — lead tibio, agrega valor'}

ÚLTIMAS CONVERSACIÓN (últimos 3 mensajes):
${recentMessages.slice(-3).join('\n')}

${demoContext}
${quoteContext}

REGLAS ABSOLUTAS:
1. Usa SIEMPRE el primer nombre real (${firstName}), NUNCA "Lead", "estimado" o genérico
2. Máximo 3 líneas. Mensaje corto, natural, conversacional
3. UNA sola llamada a la acción por mensaje
4. Si hay DEMO o COTIZACIÓN próxima a vencer, ESO es la prioridad #1
5. Varía el estilo entre seguimientos (no repitas la misma apertura)
6. NUNCA menciones PDF, documentos, ni links del CRM
7. Si la etapa CRM es 'Negociación', el mensaje debe ser de CIERRE, no de presentación
8. Si es seguimiento #${followupNum}:
   - #1: Tono amigable, casual. Retoma la conversación.
   - #2: Agrega valor o urgencia. Dato concreto o beneficio.
   - #3: Último intento. Honesto, sin presión. Deja la puerta abierta.

Genera SOLO el texto del mensaje, sin comillas, sin explicaciones.`;

    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.7,
                max_tokens: 200,
            })
        });
        const data = await resp.json();
        const msg = data.choices?.[0]?.message?.content?.trim();
        if (msg && msg.length > 5) return msg;
    } catch (e) {
        console.error('[auto-followup] GPT-4o error:', e);
    }

    // Fallback si GPT falla
    const fallbacks: Record<number, string> = {
        1: `Hola ${firstName} 👋 ¿Cómo va todo? Quería retomar nuestra conversación. ¿Tiene un momento?`,
        2: `Hola ${firstName}, solo quería asegurarme de que tenga toda la información que necesita. ¿Alguna duda que pueda resolver?`,
        3: `Hola ${firstName}, este es mi último mensaje para no molestarle. Si en algún momento quiere avanzar con la facturación electrónica, aquí estaré. 🤝`,
    };
    return fallbacks[followupNum] || fallbacks[1];
}

// ── Telegram Sender ──────────────────────────────────────────────────────────
async function sendTelegramMessage(chatId: string, message: string, token: string, log: (...a: any[]) => void): Promise<boolean> {
    try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
        });
        const result = await resp.json();
        if (result.ok) { log(`✅ Telegram sent to ${chatId}`); return true; }
        // Retry without markdown
        const r2 = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        const r2res = await r2.json();
        return r2res.ok;
    } catch (e: any) { log(`❌ Telegram error: ${e.message}`); return false; }
}

// ── WhatsApp Sender ──────────────────────────────────────────────────────────
async function sendWhatsAppMessage(phone: string, message: string, log: (...a: any[]) => void): Promise<boolean> {
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const waToken = Deno.env.get('WHATSAPP_TOKEN');
    if (!phoneNumberId || !waToken) {
        log(`⚠️ WhatsApp no configurado`); return false;
    }
    try {
        const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp', recipient_type: 'individual',
                to: phone.replace(/\D/g, ''), type: 'text',
                text: { preview_url: false, body: message },
            }),
        });
        const result = await resp.json();
        if (result?.messages?.[0]?.id) { log(`✅ WhatsApp sent`); return true; }
        log(`❌ WhatsApp API: ${JSON.stringify(result)}`); return false;
    } catch (e: any) { log(`❌ WhatsApp error: ${e.message}`); return false; }
}

// ── Slack Sender ─────────────────────────────────────────────────────────────
async function sendSlackMessage(webhookUrl: string, message: string, log: (...a: any[]) => void): Promise<boolean> {
    try {
        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
        });
        if (resp.ok) { log(`✅ Slack notification sent`); return true; }
        log(`❌ Slack error: ${resp.status} ${await resp.text()}`);
        return false;
    } catch (e: any) { log(`❌ Slack error: ${e.message}`); return false; }
}

// ── WhatsApp Escalation Sender ───────────────────────────────────────────────
async function sendWhatsAppEscalationMessage(
    phone: string,
    message: string,
    customToken: string | null,
    log: (...a: any[]) => void
): Promise<boolean> {
    const waToken = customToken || Deno.env.get('WHATSAPP_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!phoneNumberId || !waToken) {
        log(`⚠️ WhatsApp no configurado para escalación`); return false;
    }
    try {
        const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp', recipient_type: 'individual',
                to: phone.replace(/\D/g, ''), type: 'text',
                text: { preview_url: false, body: message },
            }),
        });
        const result = await resp.json();
        if (result?.messages?.[0]?.id) { log(`✅ WhatsApp escalation sent to ${phone}`); return true; }
        log(`❌ WhatsApp escalation API: ${JSON.stringify(result)}`); return false;
    } catch (e: any) { log(`❌ WhatsApp escalation error: ${e.message}`); return false; }
}

// ── DND Checker ──────────────────────────────────────────────────────────────
function isDndActive(settings: any): boolean {
    if (!settings.escalation_dnd_enabled) return false;
    try {
        const tz = settings.timezone || 'America/El_Salvador';
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false
        });
        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
        const currentMinutes = hour * 60 + minute;

        const [startH, startM] = (settings.escalation_dnd_start || '22:00').split(':').map(Number);
        const [endH, endM] = (settings.escalation_dnd_end || '07:00').split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (startMinutes > endMinutes) {
            return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        } else {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }
    } catch (e) {
        console.error('Error checking DND active:', e);
        return false;
    }
}

// ── FORCE SEND mode (unchanged logic) ───────────────────────────────────────
async function handleForceSend(body: any, log: (...a: any[]) => void): Promise<Response> {
    const { force_lead_id: forceLeadId, custom_message: customMessage } = body;
    log(`🎯 FORCE mode: lead ${forceLeadId}`);
    if (!customMessage?.trim()) {
        return new Response(JSON.stringify({ success: false, error: 'custom_message required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: conv } = await supabase.from('marketing_conversations')
        .select(`id, company_id, lead_id, channel, external_id, lead:leads(id, name, phone)`)
        .eq('lead_id', forceLeadId).eq('status', 'active').maybeSingle();

    if (!conv) return new Response(JSON.stringify({ success: false, error: 'No active conversation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await supabase.from('marketing_messages').insert({
        conversation_id: conv.id, content: customMessage,
        direction: 'outbound', type: 'text', status: 'pending',
        metadata: { isManualOffer: true, sent_by: 'force_lead_id' },
    });

    let delivered = false;
    if (conv.channel === 'whatsapp') {
        delivered = await sendWhatsAppMessage(conv.lead?.phone || '', customMessage, log);
    } else {
        const { data: tgInt } = await supabase.from('marketing_integrations')
            .select('settings').eq('company_id', conv.company_id)
            .eq('provider', 'telegram').eq('is_active', true).maybeSingle();
        if (conv.external_id && tgInt?.settings?.token)
            delivered = await sendTelegramMessage(conv.external_id, customMessage, tgInt.settings.token, log);
    }

    return new Response(JSON.stringify({ success: true, delivered }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
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
        if (body?.force_lead_id) return await handleForceSend(body, log);

        const targetCompanyId = body?.company_id || null;
        log(`[auto-followup v4] Starting. Target: ${targetCompanyId || 'ALL'}`);

        // Load active conversations
        let query = supabase.from('marketing_conversations')
            .select(`id, company_id, lead_id, channel, external_id, last_message_at,
                lead:leads(id, name, phone, company_name, status)`)
            .eq('status', 'active');
        if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
        const { data: conversations, error: convErr } = await query.limit(100);
        if (convErr) throw convErr;
        log(`Found ${conversations?.length || 0} active conversations`);

        // Cache settings & OpenAI keys per company
        const settingsCache: Record<string, any> = {};
        const apiKeyCache: Record<string, string | null> = {};

        const getSettings = async (companyId: string) => {
            if (settingsCache[companyId]) return settingsCache[companyId];
            const { data } = await supabase.from('ai_followup_settings')
                .select('*').eq('company_id', companyId).maybeSingle();
            settingsCache[companyId] = data ? { ...DEFAULT_SETTINGS, ...data } : { ...DEFAULT_SETTINGS, is_active: false };
            return settingsCache[companyId];
        };

        const getApiKey = async (companyId: string) => {
            if (apiKeyCache[companyId] !== undefined) return apiKeyCache[companyId];
            const { data } = await supabase.from('marketing_integrations')
                .select('settings').eq('company_id', companyId)
                .eq('provider', 'openai').eq('is_active', true).maybeSingle();
            apiKeyCache[companyId] = data?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY') || null;
            return apiKeyCache[companyId];
        };

        let followupsSent = 0, escalationsCreated = 0, skipped = 0;
        const now = new Date();

        for (const conv of (conversations || [])) {
            try {
                const settings = await getSettings(conv.company_id);
                if (!settings.is_active) { skipped++; continue; }

                if (settings.only_business_hours && !isBusinessHours(settings.timezone)) {
                    log(`Conv ${conv.id}: outside business hours`); skipped++; continue;
                }

                // Load last message
                const { data: lastMsgs } = await supabase.from('marketing_messages')
                    .select('direction, created_at, content')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false }).limit(5);

                const lastMsg = lastMsgs?.[0];
                const lastMsgAgeHours = lastMsg
                    ? (now.getTime() - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60)
                    : 999;

                // Skip if last message was recent outbound
                const isLastInbound = lastMsg?.direction === 'inbound';
                const isStale = lastMsgAgeHours > settings.first_followup_hours;
                if (!isLastInbound && !isStale) {
                    log(`Conv ${conv.id}: recent outbound, skipping`); skipped++; continue;
                }

                // Load memory
                const { data: memory } = await supabase.from('lead_ai_memory')
                    .select('*').eq('lead_id', conv.lead_id).maybeSingle();

                if (memory?.followup_paused) { log(`Conv ${conv.id}: paused`); skipped++; continue; }
                if (settings.pause_after_quote && memory?.conversation_stage === 'cotizado') { skipped++; continue; }

                // ✅ 1C: If an agent manually contacted this lead recently → Sofía stays out
                // Fetch last_follow_up_at separately to be resilient if column doesn't exist in prod
                try {
                    const { data: leadExtra } = await supabase
                        .from('leads').select('last_follow_up_at').eq('id', conv.lead_id).maybeSingle();
                    const agentLastContact = leadExtra?.last_follow_up_at;
                    if (agentLastContact) {
                        const hoursSinceAgentContact = (now.getTime() - new Date(agentLastContact).getTime()) / (1000 * 60 * 60);
                        const agentContactGraceHours = settings.first_followup_hours || 24;
                        if (hoursSinceAgentContact < agentContactGraceHours) {
                            log(`Conv ${conv.id}: agent made contact ${hoursSinceAgentContact.toFixed(1)}h ago — Sofía skipping`);
                            skipped++; continue;
                        }
                    }
                } catch(_guardErr) {
                    // Column might not exist in this environment — skip guard safely
                }

                const followupCount = memory?.followup_count || 0;

                // Escalate if max reached
                if (followupCount >= settings.max_followups) {
                    if (isDndActive(settings)) {
                        log(`Conv ${conv.id}: DND active (${settings.escalation_dnd_start} - ${settings.escalation_dnd_end}), delaying escalation notification.`);
                        skipped++;
                        continue;
                    }

                    if (settings.auto_escalate) {
                        log(`Conv ${conv.id}: escalating after ${followupCount} followups`);
                        
                        // 1. Update lead memory to set next action and pause auto follow-ups
                        await supabase.rpc('upsert_lead_memory', {
                            p_lead_id: conv.lead_id, p_company_id: conv.company_id,
                            p_next_action: 'escalar_humano', p_stage: 'seguimiento'
                        });
                        
                        await supabase.from('lead_ai_memory').update({
                            followup_paused: true
                        }).eq('lead_id', conv.lead_id);

                        // 2. Update lead status and notes in the CRM
                        await supabase.from('leads').update({
                            notes: `⚠️ IA escaló: sin respuesta tras ${settings.max_followups} seguimientos. Último contacto: ${new Date(conv.last_message_at).toLocaleDateString('es')}`,
                            status: 'En seguimiento', updated_at: now.toISOString()
                        }).eq('id', conv.lead_id);

                        // 3. Dispatch Multi-Channel Escalation Alerts
                        try {
                            const { data: leadData } = await supabase.from('leads')
                                .select('*').eq('id', conv.lead_id).maybeSingle();

                            if (leadData) {
                                // Fetch assigned agent profile
                                let agentProf = null;
                                if (leadData.assigned_to) {
                                    const { data } = await supabase.from('profiles')
                                        .select('full_name, telegram_chat_id').eq('id', leadData.assigned_to).maybeSingle();
                                    agentProf = data;
                                }

                                // Fetch Telegram integration bot token if needed
                                let tgToken = null;
                                if (settings.escalation_ch_agent_tg || settings.escalation_ch_group_tg) {
                                    const { data: tgInt } = await supabase.from('marketing_integrations')
                                        .select('settings').eq('company_id', conv.company_id)
                                        .eq('provider', 'telegram').eq('is_active', true).maybeSingle();
                                    tgToken = tgInt?.settings?.token || null;
                                }

                                const agentName = agentProf?.full_name || 'Agente no asignado';
                                const alertText = `🚨 *ESCALACIÓN DE LEAD*\n\n` +
                                    `👤 *Lead:* ${leadData.name || 'N/A'}\n` +
                                    `📱 *Teléfono:* ${leadData.phone || 'N/A'}\n` +
                                    `🏢 *Empresa:* ${leadData.company_name || 'N/A'}\n` +
                                    `💼 *Agente:* ${agentName}\n` +
                                    `🔁 *Intentos de IA:* ${followupCount}\n\n` +
                                    `Sofía agotó los seguimientos automáticos sin respuesta. El lead ha sido pausado de seguimientos de IA y requiere atención humana inmediata.`;

                                const leadDept = leadData.department || leadData.metadata?.department || null;

                                // A. Telegram Direct Agent Notification
                                if (settings.escalation_ch_agent_tg && tgToken) {
                                    let destinationChatId = agentProf?.telegram_chat_id;
                                    // Fallback to backup agent if direct agent doesn't have Telegram configured
                                    if (!destinationChatId && settings.escalation_backup_agent_id) {
                                        const { data: backupProf } = await supabase.from('profiles')
                                            .select('telegram_chat_id').eq('id', settings.escalation_backup_agent_id).maybeSingle();
                                        destinationChatId = backupProf?.telegram_chat_id;
                                    }
                                    if (destinationChatId) {
                                        await sendTelegramMessage(destinationChatId, alertText, tgToken, log);
                                    }
                                }

                                // B. Telegram Central Group Notification (or Department Routing)
                                if (settings.escalation_ch_group_tg && tgToken) {
                                    const deptChatId = leadDept ? settings.dept_routing?.[leadDept]?.telegram : null;
                                    const destGroupChatId = deptChatId || settings.escalation_telegram_chat_id;
                                    if (destGroupChatId) {
                                        await sendTelegramMessage(destGroupChatId, alertText, tgToken, log);
                                    }
                                }

                                // C. WhatsApp Notification
                                if (settings.escalation_ch_whatsapp) {
                                    const deptPhone = leadDept ? settings.dept_routing?.[leadDept]?.whatsapp : null;
                                    const destPhone = deptPhone || settings.escalation_whatsapp_number;
                                    if (destPhone) {
                                        await sendWhatsAppEscalationMessage(destPhone, alertText.replace(/\*/g, ''), settings.escalation_whatsapp_token, log);
                                    }
                                }

                                // D. Slack / Teams Notification
                                if (settings.escalation_ch_slack) {
                                    const deptSlackWebhook = leadDept ? settings.dept_routing?.[leadDept]?.slack : null;
                                    const destWebhook = deptSlackWebhook || settings.escalation_webhook_url;
                                    if (destWebhook) {
                                        await sendSlackMessage(destWebhook, alertText, log);
                                    }
                                }
                            }
                        } catch (e: any) {
                            log(`Escalation dispatch notify error: ${e.message}`);
                        }
                        
                        escalationsCreated++;
                    }
                    continue;
                }

                // Check timing
                if (memory?.last_followup_at) {
                    const hoursSinceLast = (now.getTime() - new Date(memory.last_followup_at).getTime()) / (1000 * 60 * 60);
                    const required = followupCount === 0 ? settings.first_followup_hours
                                   : followupCount === 1 ? settings.second_followup_hours
                                   : settings.third_followup_hours;
                    if (hoursSinceLast < required) {
                        log(`Conv ${conv.id}: ${hoursSinceLast.toFixed(1)}h elapsed, need ${required}h`);
                        skipped++; continue;
                    }
                }

                const nextNum = followupCount + 1;

                // ── DEMO URGENCY CHECK: override timing if demo is imminent ──
                const facts = memory?.known_facts || {};
                if (facts.demo_scheduled_at) {
                    const demoDate = new Date(facts.demo_scheduled_at);
                    const hoursUntilDemo = (demoDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                    // If demo is in < 24h and we haven't sent a reminder yet, force followup
                    if (hoursUntilDemo > 0 && hoursUntilDemo <= 24 && !facts.demo_reminder_sent) {
                        log(`Conv ${conv.id}: Demo in ${hoursUntilDemo.toFixed(0)}h — forcing reminder`);
                        await supabase.from('lead_ai_memory').update({
                            known_facts: { ...facts, demo_reminder_sent: true }
                        }).eq('lead_id', conv.lead_id);
                        // Continue to send followup (don't skip)
                    }
                }

                // Get OpenAI key for this company
                const apiKey = await getApiKey(conv.company_id);
                if (!apiKey) {
                    log(`Conv ${conv.id}: no OpenAI key, using fallback`);
                }

                // Build recent message history for context
                const recentMessages = (lastMsgs || []).reverse().map((m: any) =>
                    `${m.direction === 'inbound' ? '👤 Lead' : '🤖 Sofía'}: ${m.content.substring(0, 150)}`
                );

                // ── GENERATE SMART MESSAGE WITH GPT-4o ──────────────────────
                const followupText = apiKey
                    ? await generateSmartFollowup(conv.lead, memory, nextNum, recentMessages, apiKey)
                    : buildFallbackMessage(conv.lead, memory, nextNum);

                log(`Conv ${conv.id}: followup #${nextNum} generated for ${conv.lead?.name}`);

                // Save to DB
                await supabase.from('marketing_messages').insert({
                    conversation_id: conv.id, content: followupText,
                    direction: 'outbound', type: 'text', status: 'pending',
                    metadata: {
                        isAiGenerated: true, isAutoFollowup: true,
                        followupNumber: nextNum, processed_by: 'auto-followup-v4',
                        stage: memory?.conversation_stage || 'nuevo',
                    }
                });

                // ── DELIVER via channel ──────────────────────────────────────
                const channel = conv.channel || 'telegram';
                let messageSent = false;

                if (channel === 'whatsapp') {
                    messageSent = await sendWhatsAppMessage(conv.lead?.phone || '', followupText, log);
                } else {
                    const { data: tgInt } = await supabase.from('marketing_integrations')
                        .select('settings').eq('company_id', conv.company_id)
                        .eq('provider', 'telegram').eq('is_active', true).maybeSingle();
                    if (conv.external_id && tgInt?.settings?.token) {
                        messageSent = await sendTelegramMessage(conv.external_id, followupText, tgInt.settings.token, log);
                        if (messageSent) log(`✅ Followup #${nextNum} sent to ${conv.lead?.name} via Telegram`);
                    }
                }

                // ── UPDATE MEMORY ────────────────────────────────────────────
                await supabase.rpc('upsert_lead_memory', {
                    p_lead_id: conv.lead_id, p_company_id: conv.company_id,
                    p_next_action: nextNum >= settings.max_followups ? 'escalar_humano' : 'seguimiento',
                    p_stage: memory?.conversation_stage || 'seguimiento'
                });
                await supabase.from('lead_ai_memory')
                    .update({
                        followup_count: nextNum,
                        last_followup_at: now.toISOString(),
                        last_followup_msg: followupText,
                    })
                    .eq('lead_id', conv.lead_id);

                // Update conversation last_message
                await supabase.from('marketing_conversations').update({
                    last_message: followupText.substring(0, 100),
                    last_message_at: now.toISOString(),
                }).eq('id', conv.id);

                if (messageSent) followupsSent++;

            } catch (e: any) {
                log(`Error on conv ${conv.id}: ${e.message}`);
            }
        }

        log(`Done. Sent: ${followupsSent}, Escalated: ${escalationsCreated}, Skipped: ${skipped}`);
        return new Response(JSON.stringify({
            success: true, version: 'v4-gpt4o-intelligent',
            followups_sent: followupsSent,
            escalations: escalationsCreated,
            skipped, evaluated: conversations?.length || 0, logs
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('[auto-followup] FATAL:', err);
        return new Response(JSON.stringify({ error: String(err), logs }),
            { status: 500, headers: corsHeaders });
    }
});

// ── Fallback (sin OpenAI) ────────────────────────────────────────────────────
function buildFallbackMessage(lead: any, memory: any, num: number): string {
    const name = lead?.name?.split(' ')[0] || 'estimado cliente';
    const stage = memory?.conversation_stage || 'nuevo';
    const facts = memory?.known_facts || {};
    const plan  = facts.last_quoted_plan || 'el plan seleccionado';

    if (num === 1) {
        if (stage === 'cotizado') return `Hola ${name} 👋 Solo quería saber si tuvo oportunidad de revisar la propuesta del ${plan}. Quedo disponible para cualquier duda. 😊`;
        return `Hola ${name} 👋 ¿Cómo va todo? Quería retomar nuestra conversación. ¿Tiene un momento?`;
    }
    if (num === 2) {
        return `Hola ${name}! 📊 Quería compartirle que con el sistema podría automatizar toda su facturación y evitar multas de Hacienda. ¿Le gustaría que le explique cómo funcionaría para su negocio?`;
    }
    return `Hola ${name}, este es mi último mensaje para no molestarle. 🤝 Si en algún momento necesita asesoría en facturación electrónica, aquí estaremos. ¡Que le vaya muy bien!`;
}
