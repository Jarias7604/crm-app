// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(
    SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
);

console.log(`[AI-Processor v52-lead-brain] Initialized`);

// ─── Sentiment Detection v2 — Multi-factor weighted engine ───────────────────
function detectSentiment(text: string, historicalScore = 50): number {
    const t = text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
        .replace(/[!?¡¿]/g, ' $& ');                        // isolate punctuation

    // ── Positive signals (weighted) ──
    const strongPositive = [
        'quiero contratar','vamos adelante','cuando empezamos','lista para contratar',
        'me convencio','excelente propuesta','perfecto precio','de acuerdo con todo',
        'donde firmo','como pagamos','cuanto es la cuenta','aceptamos la propuesta'
    ];
    const mediumPositive = [
        'me interesa','muy bueno','que bien','genial','buenisimo','excelente',
        'perfecto','adelante','listo','claro que si','si quiero','me gusta',
        'suena bien','lo necesito','urge','lo quiero','vamos','ok suena bien',
        'si por favor','voy a consultar con','lo vemos','tengamos una llamada'
    ];
    const lightPositive = [
        'ok','si','bien','dale','interesante','cuanto cuesta','cuales son los planes',
        'como funciona','mandame informacion','enviame','me puedes decir','hola'
    ];

    // ── Negative signals (weighted) ──
    const strongNegative = [
        'no me interesa','no gracias','deje de escribirme','no voy a comprar',
        'ya tenemos proveedor','no lo necesitamos','no sirve para nosotros',
        'muy caro no podemos','fuera de presupuesto total','vamos a desistir'
    ];
    const mediumNegative = [
        'muy caro','caro','costoso','no tenemos presupuesto','no puedo',
        'lo pensare','lo dejamos para despues','despues lo vemos','no por ahora',
        'luego','mas adelante','no me alcanza','no lo veo viable','no convence',
        'prefiero otro','ya tengo','mejor lo pienso','voy a consultar precios'
    ];
    const lightNegative = [
        'no','quizas','tal vez','no se','a ver','poco dinero','limitado'
    ];

    // ── Urgency boost (context-sensitive) ──
    const urgency = [
        'hacienda','multa','notificacion','sancion','urgente','ya','hoy mismo',
        'pronto','rapido','inmediato','necesito ya','cuanto antes','esta semana',
        'lo necesito hoy','vencimiento','plazo'
    ];

    // ── Escalation / frustration ──
    const frustration = [
        'me tiene cansado','pesado','insistente','deje de molestar',
        'ya entendi','basta','para','no mas','harto'
    ];

    // ── Emoji signals ──
    const positiveEmoji = /[😀😃😄😁🤩😍🙌👍✅🎉🔥💪🚀]/u.test(text);
    const negativeEmoji = /[😡🤬😤😒👎❌🚫💸]/u.test(text).valueOf();

    let delta = 0;

    // Score accumulation
    if (strongPositive.some(p => t.includes(p)))  delta += 35;
    if (mediumPositive.some(p => t.includes(p)))   delta += 18;
    if (lightPositive.some(p => t.includes(p)))    delta += 7;

    if (strongNegative.some(n => t.includes(n)))   delta -= 35;
    if (mediumNegative.some(n => t.includes(n)))   delta -= 18;
    if (lightNegative.some(n => t.includes(n)))    delta -= 5;

    if (urgency.some(u => t.includes(u)))          delta += 12;
    if (frustration.some(f => t.includes(f)))      delta -= 25;

    if (positiveEmoji)  delta += 8;
    if (negativeEmoji)  delta -= 8;

    // Question mark = engaged (positive signal)
    if (t.includes('?') && delta >= 0) delta += 4;

    // Negation reversal: "no me interesa" vs "si me interesa"
    const hasNegation = /\b(no|nunca|jamas|tampoco)\b/.test(t);
    if (hasNegation && delta > 0) delta = -Math.abs(delta) * 0.6;

    // Message length bonus — longer = more engaged
    if (text.length > 80 && delta > 0)  delta += 5;
    if (text.length < 5)                delta -= 3;  // very short = disengaged

    // ── Smooth blend with historical score (70% history, 30% new signal) ──
    // Prevents wild swings from one message
    const newScore = historicalScore + (delta * 0.6);
    return Math.round(Math.max(5, Math.min(98, newScore)));
}

function detectStage(aiResponse: string, userMsg: string, currentStage: string): string {
    const combined = (aiResponse + ' ' + userMsg).toLowerCase();
    if (combined.includes('quote_trigger') || combined.includes('propuesta') || combined.includes('cotizacion')) return 'cotizado';
    if (combined.includes('demo') || combined.includes('reunion') || combined.includes('llamada')) return 'seguimiento';
    if (combined.includes('dtes') || combined.includes('facturas') || combined.includes('volumen')) return 'calificado';
    if (currentStage === 'nuevo') return 'calificado';
    return currentStage || 'calificado';
}

function detectNextAction(sentiment: number, stage: string, userMsg: string): string {
    const u = userMsg.toLowerCase();
    if (u.includes('demo') || u.includes('reunion') || u.includes('hablar')) return 'demo';
    if (stage === 'cotizado' && sentiment >= 70) return 'seguimiento';
    if (stage === 'cotizado' && sentiment < 35)  return 'escalar_humano';
    if (sentiment < 25)                          return 'escalar_humano';
    if (stage === 'calificado') return 'enviar_propuesta';
    return 'seguimiento';
}


// ─── Build rich catalog string from pricing_items ─────────────────────────────
function buildCatalogContext(pricingItems: any[]): string {
    const planes = pricingItems.filter(i => i.tipo === 'plan').sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
    const modulos = pricingItems.filter(i => i.tipo === 'modulo');
    const servicios = pricingItems.filter(i => i.tipo === 'servicio');

    const formatPlan = (p: any) => {
        const anual = Number(p.precio_anual || 0);
        const mensual = anual > 0 ? (anual / 12).toFixed(2) : '0';
        const impl = Number(p.costo_unico || 0);
        const contado = (anual * 0.80).toFixed(2);
        const minDte = p.min_dtes ?? 0;
        const maxDte = p.max_dtes ?? null;
        const rangoStr = maxDte ? `${minDte}–${maxDte} DTEs/año` : `desde ${minDte} DTEs/año`;
        return `📦 PLAN: ${p.nombre}
   Rango: ${rangoStr}
   💰 Pago anual normal: $${anual}
   ⭐ Pago único contado (20% OFF): $${contado} — AHORRA $${(anual * 0.20).toFixed(2)}
   💳 Financiado a 12 meses: $${mensual}/mes
   🔧 Implementación (1 vez): $${impl}
   📝 ${p.descripcion || ''}`;
    };

    const formatMod = (m: any) => {
        const anual = Number(m.precio_anual || 0);
        const contado = (anual * 0.80).toFixed(2);
        return `  • ${m.nombre}: $${anual}/año (contado: $${contado}) — ${m.descripcion || ''}`;
    };

    const formatSvc = (s: any) => {
        const precio = s.precio_anual > 0 ? `$${s.precio_anual}/año` : s.precio_por_dte > 0 ? `$${s.precio_por_dte} por DTE` : `$${s.costo_unico} (pago único)`;
        return `  • ${s.nombre}: ${precio} — ${s.descripcion || ''}`;
    };

    return `=== CATÁLOGO COMPLETO DE PLANES (lee esto para cotizar) ===
${planes.map(formatPlan).join('\n\n')}

=== MÓDULOS ADICIONALES (SIEMPRE ofrecerlos después de cotizar el plan) ===
${modulos.length ? modulos.map(formatMod).join('\n') : 'Sin módulos registrados'}

=== SERVICIOS ADICIONALES ===
${servicios.length ? servicios.map(formatSvc).join('\n') : 'Sin servicios registrados'}`;
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
        const { conversationId, isTest, message: testMessage, agent: testAgent, history: testHistory } = body;

        // ── SIMULATOR MODE ──────────────────────────────────────────────────
        if (isTest) {
            log('Running in SIMULATOR mode');
            const companyId = testAgent?.company_id || 'test';
            const { data: iconf } = await supabase.from('marketing_integrations')
                .select('settings').eq('company_id', companyId).eq('provider', 'openai').eq('is_active', true).maybeSingle();
            const apiKey = iconf?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY');
            if (!apiKey) return new Response(JSON.stringify({ error: 'OpenAI API Key no configurada', logs }), { status: 400, headers: corsHeaders });

            // Load catalog for simulator
            const { data: pricingItems } = await supabase.from('pricing_items')
                .select('*').or(`company_id.eq.${companyId},company_id.is.null`).eq('activo', true).order('orden', { ascending: true });

            const catalogCtx = buildCatalogContext(pricingItems || []);
            const demoUrl = testAgent?.demo_url;
            const demoSection = demoUrl
                ? `\n=== ENLACE PARA AGENDAR DEMO ===\nSi el cliente pide reunión o demo, comparte este link exacto: ${demoUrl}`
                : '';

            const systemPrompt = `=== INSTRUCCIONES MAESTRAS DEL AGENTE ===
${testAgent?.system_prompt || 'Eres un asesor de ventas profesional de facturación electrónica.'}
==========================================

${catalogCtx}
${demoSection}

=== OPCIONES DE PAGO (OBLIGATORIO SIEMPRE MENCIONAR) ===
- Siempre ofrece AMBAS opciones: pago único contado (20% descuento) Y financiado a 12 meses.
- Muestra cuánto ahorra el cliente eligiendo el contado.
- SIEMPRE ofrece módulos adicionales después de la cotización principal.
- Cuando el cliente diga su volumen, aproxima al rango del plan más cercano y recomienda ese plan.

=== REGLAS DE ORO — NUNCA VIOLAR ===
- SOLO texto. NUNCA mencionar PDF, propuesta formal, enlace, ni archivo.
- NUNCA pedir correo electrónico para enviar documentos.
- Cotiza SIEMPRE en el mismo mensaje de texto, con precios reales del catálogo.
- Si el cliente dice un volumen aproximado, tómalo tal cual y recomienda el plan correcto.
- Al final del mensaje (invisible para el cliente), incluye: QUOTE_TRIGGER: {"plan_name": "NOMBRE", "dte_volume": NUMERO, "items": []}`;

            // Build messages with history
            const historyMessages = (testHistory || []).map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...historyMessages,
                        { role: 'user', content: testMessage || 'Hola' }
                    ],
                    temperature: 0.2
                })
            });
            const aiData = await aiResp.json();
            let reply = aiData.choices?.[0]?.message?.content || 'Sin respuesta';
            reply = reply
                .replace(/QUOTE_TRIGGER:[\s\S]*/gi, '').trim()
                .replace(/UPDATE_LEAD:[\s\S]*?(\n|$)/gi, '').trim()
                .replace(/(?:generar[eé]|enviar[eé]|adjunt[oa]|te mando)[^.]*?(?:pdf|propuesta formal|documento|archivo)[^.]*/gi, '')
                .trim();
            return new Response(JSON.stringify({ reply, logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // ── END SIMULATOR MODE ──────────────────────────────────────────────

        if (typeof conversationId !== 'string') {
            return new Response(JSON.stringify({ error: "conversationId must be a string", logs }), { status: 400, headers: corsHeaders });
        }

        // ===========================================
        // 1. LOAD CONVERSATION + LEAD DATA
        // ===========================================
        log(`Starting for Conv: ${conversationId}`);
        const { data: conv, error: convError } = await supabase.from('marketing_conversations')
            .select('*, lead:leads(*)')
            .eq('id', conversationId)
            .maybeSingle();

        if (convError) throw convError;
        if (!conv) return new Response(JSON.stringify({ error: "Conversation not found", logs }), { status: 404, headers: corsHeaders });

        const companyId = conv.company_id;
        const lead = conv.lead;
        const chatId = conv.external_id;
        log(`Company: ${companyId}, Lead: ${lead?.id}, Chat: ${chatId}`);

        // Rate limiting
        const rl = checkRateLimit(companyId, 'ai');
        if (!rl.allowed) return rateLimitResponse(rl.resetAt);

        // ===========================================
        // 2. LOAD AI AGENT (company-specific)
        // ===========================================
        const { data: agents } = await supabase.from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true })
            .limit(1);

        const agent = agents?.[0] || {
            name: 'Sofía',
            system_prompt: 'Eres un asesor experto en facturación electrónica. Tu misión es calificar leads y cotizar por texto.',
            representative_id: null,
            demo_url: null
        };
        log(`Agent: ${agent.name} (${agents?.[0] ? 'from DB' : 'FALLBACK'})`);

        // ===========================================
        // 2B. LOAD LEAD BRAIN — Persistent Memory
        // ===========================================
        let leadMemory: any = null;
        if (lead?.id) {
            const { data: mem } = await supabase
                .from('lead_ai_memory')
                .select('*')
                .eq('lead_id', lead.id)
                .maybeSingle();
            leadMemory = mem;
            log(`Lead Brain: stage=${mem?.conversation_stage || 'nuevo'}, sentiment=${mem?.sentiment_score || 50}, facts=${JSON.stringify(mem?.known_facts || {})}`);
        }

        // Build memory context for system prompt
        const memorySection = leadMemory ? `
=== MEMORIA DEL CLIENTE (lo que ya sabes de conversaciones anteriores) ===
• Etapa actual: ${leadMemory.conversation_stage || 'nuevo'}
• Lo que sabes: ${JSON.stringify(leadMemory.known_facts || {}, null, 2)}
${leadMemory.last_objection ? `• Última objección: ${leadMemory.last_objection}` : ''}
${leadMemory.followup_count > 0 ? `• Seguimientos enviados: ${leadMemory.followup_count} (no menciones esto al cliente)` : ''}
• Siguiente acción recomendada: ${leadMemory.next_action || 'calificar'}
USA esta memoria para personalizar tu respuesta. NO preguntes lo que ya sabes.` : '';

        // ===========================================
        // 3. LOAD PRICING CATALOG (company-specific)
        // ===========================================
        const { data: pricingItems } = await supabase.from('pricing_items')
            .select('*')
            .or(`company_id.eq.${companyId},company_id.is.null`)
            .eq('activo', true)
            .order('orden', { ascending: true });

        log(`Loaded ${pricingItems?.length || 0} pricing items`);
        const catalogContext = buildCatalogContext(pricingItems || []);

        // ===========================================
        // 4. BUILD UNIFIED SYSTEM PROMPT
        // ===========================================
        const demoSection = agent.demo_url
            ? `\n=== ENLACE PARA AGENDAR DEMO ===\nCuando el cliente pida reunión, llamada o demo, comparte este link exacto: ${agent.demo_url}\n`
            : '';

        const leadSection = `=== DATOS DEL CLIENTE EN EL CRM ===
• Nombre: ${lead?.name || 'No registrado'}
• Empresa: ${lead?.company_name || 'No registrada'}
• Teléfono: ${lead?.phone || 'No registrado'}
• Email: ${lead?.email || 'No registrado'}`;

        // Technical-only rules — business logic lives entirely in agent.system_prompt (DB)
        const technicalRules = `=== REGLAS TÉCNICAS DEL SISTEMA (NO NEGOCIABLES) ===
1. NUNCA menciones PDF, propuesta formal, documento adjunto, ni links internos del CRM.
2. NUNCA pidas correo electrónico para enviar documentos.
3. Usa SIEMPRE los precios reales del catálogo inyectado arriba — nunca inventes precios.
4. Mensajes máximo 5-6 líneas. Nunca hagas listas largas en un solo mensaje.
5. Si el agente tiene enlace de demo configurado, úsalo cuando el cliente pida reunión o llamada.

=== PROTOCOLO DE TRIGGERS — NUNCA VISIBLES PARA EL CLIENTE ===
- Al cotizar formalmente, agrega AL FINAL del mensaje: QUOTE_TRIGGER: {"plan_name": "NOMBRE_PLAN", "dte_volume": NUMERO_ANUAL, "items": ["Módulo1"]}
- Al capturar datos del lead, agrega AL FINAL: UPDATE_LEAD: {"name": "Nombre", "company_name": "Empresa", "phone": "7000-0000", "email": "correo@empresa.com"}
- Estos códigos son invisibles para el cliente. NUNCA los menciones ni expliques.`;

        const fullSystemPrompt = `=== INSTRUCCIONES MAESTRAS DEL AGENTE (SIGUE ESTO EXACTAMENTE) ===
${agent.system_prompt || 'Eres un asesor de ventas profesional. Califica al lead antes de cotizar.'}
=====================================================================

${leadSection}
${memorySection}

${catalogContext}
${demoSection}
${technicalRules}`;

        // ===========================================
        // 5. GET OPENAI API KEY
        // ===========================================
        const { data: iconf } = await supabase.from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .maybeSingle();

        const apiKey = iconf?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OpenAI API Key not found");
        log(`OpenAI Key found: ...${apiKey.slice(-5)}`);

        // ===========================================
        // 6. GET CONVERSATION HISTORY (last 20 messages)
        // ===========================================
        const { data: history } = await supabase.from('marketing_messages')
            .select('content, direction, type, created_at, metadata')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(20);

        const lastMsg = history?.[0];
        log(`History: ${history?.length || 0} msgs. Last direction: ${lastMsg?.direction}`);

        if (lastMsg?.direction === 'outbound' && lastMsg?.status === 'delivered') {
            log('Skipping — last message was outbound+delivered');
            return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
        }

        const previousMessages = (history || []).reverse().map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: (msg.type === 'audio' || msg.type === 'voice')
                ? `[Nota de voz: ${msg.metadata?.transcription || 'sin transcribir'}]`
                : msg.type === 'image' ? '[El usuario envió una imagen]'
                : msg.content
        }));

        // ===========================================
        // 7. TRANSCRIBE VOICE (Whisper)
        // ===========================================
        let userMessage = lastMsg?.content || "";
        if (lastMsg?.direction === 'inbound' && (lastMsg?.type === 'voice' || lastMsg?.type === 'audio')) {
            const fileId = lastMsg.metadata?.file_id;
            if (fileId && !lastMsg.metadata?.transcription) {
                log(`Transcribing audio: ${fileId}`);
                try {
                    const { data: tgInt } = await supabase.from('marketing_integrations')
                        .select('settings').eq('company_id', companyId).eq('provider', 'telegram').eq('is_active', true).maybeSingle();
                    const botToken = tgInt?.settings?.token;
                    if (botToken) {
                        const fileInfoResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
                        const fileInfo = await fileInfoResp.json();
                        if (fileInfo.ok && fileInfo.result.file_path) {
                            const audioResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`);
                            const audioBlob = await audioResp.blob();
                            const formData = new FormData();
                            formData.append('file', audioBlob, 'audio.ogg');
                            formData.append('model', 'whisper-1');
                            const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${apiKey}` },
                                body: formData
                            });
                            const whisperData = await whisperResp.json();
                            if (whisperData.text) {
                                userMessage = whisperData.text;
                                log(`Transcription: ${userMessage}`);
                                await supabase.from('marketing_messages').update({
                                    content: `[Nota de voz]: ${whisperData.text}`,
                                    metadata: { ...lastMsg.metadata, transcription: whisperData.text }
                                }).eq('id', lastMsg.id);
                                previousMessages[previousMessages.length - 1].content = `[Nota de voz]: ${whisperData.text}`;
                            }
                        }
                    }
                } catch (e) { log(`Transcription error: ${e.message}`); }
            } else if (lastMsg.metadata?.transcription) {
                userMessage = lastMsg.metadata.transcription;
            }
        }

        // ===========================================
        // 8. CALL OPENAI GPT-4o
        // ===========================================
        const openAiMessages = [
            { role: 'system', content: fullSystemPrompt },
            ...previousMessages
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o', messages: openAiMessages, temperature: 0.15 }),
        });
        const aiData = await response.json();
        let aiContent = aiData.choices?.[0]?.message?.content || "";

        if (!aiData.choices?.length) {
            if (aiData.error?.code === 'insufficient_quota') {
                aiContent = "⚠️ El servicio de IA no está disponible temporalmente. Por favor intenta en unos minutos.";
            } else {
                throw new Error(aiData.error?.message || "OpenAI API error");
            }
        }

        // ===========================================
        // 9. CLEAN AI RESPONSE
        // ===========================================
        // Remove UPDATE_LEAD from visible text first (before QUOTE_TRIGGER removal)
        let cleanText = aiContent;

        // Parse UPDATE_LEAD
        if (cleanText.includes('UPDATE_LEAD:')) {
            const tIdx = cleanText.indexOf('UPDATE_LEAD:');
            const dStr = cleanText.substring(tIdx + 'UPDATE_LEAD:'.length).trim();
            try {
                const fb = dStr.indexOf('{'), lb = dStr.lastIndexOf('}');
                if (fb !== -1 && lb !== -1) {
                    const upd = JSON.parse(dStr.substring(fb, lb + 1));
                    if (lead?.id) {
                        const payload: any = {};
                        if (upd.name) payload.name = upd.name;
                        if (upd.company_name) payload.company_name = upd.company_name;
                        if (upd.phone) payload.phone = upd.phone;
                        if (upd.email) payload.email = upd.email; // ✅ 1B: capture email
                        if (Object.keys(payload).length > 0) {
                            await supabase.from('leads').update(payload).eq('id', lead.id);
                            log(`Lead updated:`, payload);
                        }
                    }
                }
            } catch (e) { console.error("UPDATE_LEAD parse error:", e); }
            cleanText = cleanText.replace(/UPDATE_LEAD:[\s\S]*?(?=QUOTE_TRIGGER:|$)/gi, '').trim();
        }

        // Parse QUOTE_TRIGGER
        if (cleanText.includes('QUOTE_TRIGGER:')) {
            let volume = 1200, planNameRequested = "", extraItems: string[] = [];
            const tIdx = cleanText.indexOf('QUOTE_TRIGGER:');
            const dStr = cleanText.substring(tIdx + 'QUOTE_TRIGGER:'.length).trim();
            try {
                const fb = dStr.indexOf('{'), lb = dStr.lastIndexOf('}');
                if (fb !== -1 && lb !== -1) {
                    const d = JSON.parse(dStr.substring(fb, lb + 1));
                    volume = d.dte_volume || 1200;
                    planNameRequested = d.plan_name || "";
                    extraItems = d.items || [];
                }
            } catch (e) { console.error("QUOTE_TRIGGER parse error:", e); }

            cleanText = cleanText.replace(/QUOTE_TRIGGER:[\s\S]*/gi, '').trim();

            const planes = pricingItems?.filter(i => i.tipo === 'plan') || [];
            const extras = pricingItems?.filter(i => i.tipo === 'modulo' || i.tipo === 'servicio') || [];

            let selectedPlan = planes.find(p =>
                p.nombre.toLowerCase().includes(planNameRequested.toLowerCase()) ||
                planNameRequested.toLowerCase().includes(p.nombre.toLowerCase())
            ) || planes[0];

            if (selectedPlan) {
                const baseAnual = Number(selectedPlan.precio_anual || 0);
                const implementation = Number(selectedPlan.costo_unico || 0);
                let extrasTotal = 0;
                const dbExtras: any[] = [];

                for (const itemName of extraItems) {
                    const name = typeof itemName === 'string' ? itemName : (itemName as any).name;
                    const dbItem = extras.find(m =>
                        m.nombre.toLowerCase().includes(name.toLowerCase()) ||
                        name.toLowerCase().includes(m.nombre.toLowerCase())
                    );
                    if (dbItem) {
                        let cost = Number(dbItem.precio_anual || 0);
                        if (dbItem.tipo === 'servicio' && dbItem.precio_por_dte > 0) cost = Number(dbItem.precio_por_dte) * volume;
                        else if (dbItem.costo_unico > 0 && cost === 0) cost = Number(dbItem.costo_unico);
                        dbExtras.push({ nombre: dbItem.nombre, costo: cost, tipo: dbItem.tipo });
                        extrasTotal += cost;
                    }
                }

                const subtotal = baseAnual + implementation + extrasTotal;
                const iva = subtotal * 0.13;
                const total = subtotal + iva;

                let creatorId = agent.representative_id || null;
                if (!creatorId) {
                    const { data: profiles } = await supabase.from('profiles').select('id').eq('company_id', companyId).limit(1);
                    if (profiles?.[0]) creatorId = profiles[0].id;
                }

                const { data: quoteObj, error: quoteError } = await supabase.from('cotizaciones').insert({
                    company_id: companyId,
                    lead_id: lead?.id,
                    created_by: creatorId,
                    nombre_cliente: lead?.name || 'Cliente',
                    volumen_dtes: volume,
                    plan_nombre: selectedPlan.nombre,
                    costo_plan_anual: baseAnual,
                    costo_implementacion: implementation,
                    modulos_adicionales: dbExtras,
                    subtotal_anual: subtotal,
                    total_anual: total,
                    iva_porcentaje: 13,
                    iva_monto: iva,
                    estado: 'enviada'
                }).select().single();

                if (quoteError) console.error("Quote insert error:", quoteError);
                if (quoteObj) {
                    log(`Quote ${quoteObj.id} saved to DB`);
                    // ✅ 1B: Save quote timestamp so auto-followup can track 48h expiry
                    await supabase.from('lead_ai_memory')
                        .update({
                            known_facts: supabase.rpc ? undefined : undefined, // trigger merge via upsert below
                        })
                        .eq('lead_id', lead?.id);
                    await supabase.rpc('upsert_lead_memory', {
                        p_lead_id:    lead?.id,
                        p_company_id: companyId,
                        p_facts: {
                            quote_created_at:  new Date().toISOString(),
                            quote_id:          quoteObj.id,
                            last_quoted_plan:  selectedPlan.nombre,
                            last_quoted_price: String(total.toFixed(2)),
                        },
                        p_stage: 'cotizado',
                    });
                    log(`✅ quote_created_at saved to Lead Brain`);
                }
            } // end if (selectedPlan)
        } // end if (cleanText.includes('QUOTE_TRIGGER:'))

        // Cleanup — remove internal CRM links and triggers, but KEEP external links (demo, calendly, etc.)
        cleanText = cleanText
            // Remove CRM-internal proposal/approval links only (never external links like calendly)
            .replace(/https?:\/\/crm-app[\w.-]*\/propuesta\/[\w-]+/g, '')
            .replace(/https?:\/\/[\w.-]*(?:crm-app|vercel\.app)[\w.-]*\/(propuesta|cotizacion|quote|aprobacion)\/[\w-]+/gi, '')
            // Remove "Ver y aprobar tu cotización" and similar approval link text
            .replace(/🔗?\s*\*?Ver y aprobar[^*\n]*/gi, '')
            .replace(/\*?Ver Cotizaci[oó]n Completa\*?/gi, '')
            .replace(/Ver y aprobar[^\n]*/gi, '')
            // Remove PDF/document/proposal mentions
            .replace(/(?:te (?:genero|mando|env[ií]o|adjunto)|adjunto|enviando)[^.]*?(?:pdf|propuesta formal|documento|archivo)[^.]*/gi, '')
            .replace(/(?:propuesta formal|cotizaci[oó]n formal)[^.]*\./gi, '')
            // Remove $XX.XX placeholders (AI following template literally)
            .replace(/\$XX\.XX/g, '')
            .replace(/\$XXX/g, '')
            // Remove triggers
            .replace(/QUOTE_TRIGGER:[\s\S]*/gi, '')
            .replace(/UPDATE_LEAD:[\s\S]*/gi, '')
            // Clean up extra blank lines
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // ===========================================
        // 10. SAVE MESSAGE TO DATABASE
        // ===========================================
        const { data: savedMsg, error: insertError } = await supabase.from('marketing_messages').insert({
            conversation_id: conversationId,
            content: cleanText,
            direction: 'outbound',
            type: 'text',
            status: 'pending',
            metadata: {
                isAiGenerated: true,
                processed_by: 'edge-function',
                version: 'v51-demo-fix',
                agentName: agent.name || 'AI',
                leadId: lead?.id || null
            }
        }).select().maybeSingle();

        if (insertError) {
            log(`Insert error (non-fatal): ${JSON.stringify(insertError)}`);
        } else if (lead?.id) {
            await supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', lead.id);
        }

        // ===========================================
        // 10B. UPDATE LEAD BRAIN — Persistent Memory
        // ===========================================
        if (lead?.id) {
            try {
                const historicalSentiment = leadMemory?.sentiment_score ?? 50;
                const sentiment = detectSentiment(userMessage, historicalSentiment);
                let newStage  = detectStage(cleanText, userMessage, leadMemory?.conversation_stage || 'nuevo');
                let nextAction = detectNextAction(sentiment, newStage, userMessage);

                // Extract new facts from the conversation (basic extraction)
                const newFacts: Record<string, any> = {};
                if (userMessage.match(/(\d+)\s*(dtes?|facturas?|documentos?)/i)) {
                    const match = userMessage.match(/(\d+)/);
                    if (match) newFacts.volumen_dtes = parseInt(match[1]);
                }
                if (userMessage.match(/(empresa|negocio|compañía)\s+(?:se llama|es|:)?\s+([\w\s]+)/i)) {
                    const match = userMessage.match(/(empresa|negocio|compañía)\s+(?:se llama|es|:)?\s+([\w\s]+)/i);
                    if (match?.[2]) newFacts.empresa_mencionada = match[2].trim();
                }

                // ── Detect price objection with context ──────────────────
                let objection: string | null = null;
                const msgLower = userMessage.toLowerCase();
                const priceObjectionKws = ['caro','costoso','muy caro','no tengo presupuesto','no puedo pagarlo',
                    'presupuesto limitado','fuera de mi presupuesto','precio alto','no me alcanza','precio elevado'];
                const hasPriceObjection = priceObjectionKws.some(k => msgLower.includes(k));

                if (hasPriceObjection) {
                    objection = 'precio';
                    // Capture the exact objection text (first 200 chars)
                    newFacts.price_objection_text  = userMessage.slice(0, 200);
                    newFacts.price_objection_at    = new Date().toISOString();
                    // Preserve last quoted plan/price from memory if available
                    if (leadMemory?.known_facts?.last_quoted_plan)  newFacts.last_quoted_plan  = leadMemory.known_facts.last_quoted_plan;
                    if (leadMemory?.known_facts?.last_quoted_price) newFacts.last_quoted_price = leadMemory.known_facts.last_quoted_price;
                } else if (msgLower.includes('consultar') || msgLower.includes('equipo')) {
                    objection = 'necesita_aprobacion';
                } else if (msgLower.includes('luego') || msgLower.includes('despues')) {
                    objection = 'no_es_prioridad';
                }

                // ── Detect quote trigger — save plan & price in memory ────
                if (cleanText?.includes('QUOTE_TRIGGER') || cleanText?.includes('Plan') || newStage === 'cotizado') {
                    const planMatch  = cleanText?.match(/Plan\s+([\w\s]+)/i);
                    const priceMatch = cleanText?.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
                    if (planMatch?.[1])  newFacts.last_quoted_plan  = planMatch[1].trim();
                    if (priceMatch?.[1]) newFacts.last_quoted_price = priceMatch[1].replace(',','');
                    // quote_created_at already saved in QUOTE_TRIGGER block above
                }

                // ✅ 1B: Detect demo scheduling — extract date and save to memory
                const demoKeywords = ['demo', 'reunión', 'reunion', 'llamada', 'cita', 'agendar', 'agendado', 'agendamos', 'calendly', 'citas'];
                const hasDemoContext = demoKeywords.some(k => (cleanText + ' ' + userMessage).toLowerCase().includes(k));
                if (hasDemoContext && !leadMemory?.known_facts?.demo_scheduled_at) {
                    // Try to extract a date/time from the AI response or user message
                    const combined = cleanText + ' ' + userMessage;
                    // Match patterns: "mañana", "el lunes", "el 15", "15 de mayo", "15/05"
                    const datePatterns = [
                        /\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/,          // 15/05 or 15/05/2026
                        /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
                        /\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i,
                        /\b(mañana|pasado mañana|hoy)\b/i,
                    ];
                    let demoDateStr: string | null = null;
                    for (const pat of datePatterns) {
                        const m = combined.match(pat);
                        if (m) { demoDateStr = m[0]; break; }
                    }
                    if (demoDateStr) {
                        // Store as text — auto-followup uses it for reminder logic
                        newFacts.demo_scheduled_at_text = demoDateStr;
                        // Store ISO if it's a simple date pattern
                        newFacts.demo_scheduled_at = new Date().toISOString(); // approximation — refined when Calendly integration is added
                        newFacts.demo_reminder_sent = false;
                        log(`✅ Demo scheduled detected: "${demoDateStr}" → saved to Lead Brain`);
                    } else {
                        // Demo mentioned but no specific date — flag it
                        newFacts.demo_in_progress = true;
                        log(`ℹ️ Demo context detected but no date extracted`);
                    }
                    // Update AI stage to reflect demo was scheduled
                    newStage = 'seguimiento';
                    nextAction = 'demo';
                }

                // ── Detect CLOSE signals — lead wants to buy ─────────────
                const systemCommands = ['/start', '/help', '/menu', '/info', '/stop', '/reset'];
                const isSystemCommand = systemCommands.some(cmd => userMessage.trim().toLowerCase().startsWith(cmd));

                const closeSignalKeywords = [
                    'quiero contratar','vamos adelante','cuando empezamos','acepto','de acuerdo',
                    'como pagamos','donde firmo','lista para contratar','cuanto es la cuenta',
                    'aceptamos','procesemos','adelante con eso','quiero el plan','voy con ustedes'
                ];
                const hasCloseKeyword = closeSignalKeywords.some(s => msgLower.includes(s));
                // Require explicit keyword — high sentiment alone is NOT enough to avoid false positives
                const isClosing = !isSystemCommand && hasCloseKeyword;

                if (isClosing && newStage !== 'cerrado') {
                    newStage   = 'negociacion';
                    nextAction = 'cierre_inminente';
                    newFacts.close_signal_at = new Date().toISOString();
                    newFacts.close_signal_msg = userMessage.slice(0, 150);

                    // 🚨 Notify assigned sales agent via Telegram
                    try {
                        const { data: leadInfo } = await supabase
                            .from('leads').select('assigned_to, name, phone').eq('id', lead.id).maybeSingle();

                        if (leadInfo?.assigned_to) {
                            const { data: agentProf } = await supabase
                                .from('profiles').select('full_name, telegram_chat_id').eq('id', leadInfo.assigned_to).maybeSingle();

                            if (agentProf?.telegram_chat_id) {
                                const { data: tgI } = await supabase.from('marketing_integrations')
                                    .select('settings').eq('company_id', companyId)
                                    .eq('provider','telegram').eq('is_active', true).maybeSingle();

                                if (tgI?.settings?.token) {
                                    const closeMsg = `🎉 LEAD LISTO PARA CERRAR!\n\n👤 Lead: ${leadInfo.name}\n📱 Tel: ${leadInfo.phone || 'N/A'}\n💬 Mensaje: "${userMessage.slice(0,100)}"\n\n✅ Este lead está listo para proceder. Contáctalo para:\n1. Confirmar el plan seleccionado\n2. Enviar factura / contrato\n3. Iniciar el onboarding\n\n⚡ Actúa ahora — el lead está caliente!`;
                                    await fetch(`https://api.telegram.org/bot${tgI.settings.token}/sendMessage`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ chat_id: agentProf.telegram_chat_id, text: closeMsg })
                                    });
                                    log(`🎉 Close alert sent to agent ${agentProf.full_name} for lead ${leadInfo.name}`);
                                }
                            }
                        }
                    } catch(closeNotifyErr: any) {
                        log(`Close notification error (non-fatal): ${closeNotifyErr.message}`);
                    }
                }

                await supabase.rpc('upsert_lead_memory', {
                    p_lead_id:     lead.id,
                    p_company_id:  companyId,
                    p_facts:       Object.keys(newFacts).length > 0 ? newFacts : null,
                    p_stage:       newStage,
                    p_objection:   objection,
                    p_sentiment:   sentiment,
                    p_next_action: nextAction
                });

                // ── Sync AI stage → CRM leads.status so both views match ──
                const stageToStatus: Record<string, string> = {
                    'nuevo':        'Prospecto',
                    'calificado':   'En seguimiento',
                    'cotizado':     'En seguimiento',
                    'seguimiento':  'En seguimiento',
                    'negociacion':  'En negociación',
                    'cerrado':      'Cliente',
                    'perdido':      'Perdido',
                };
                const leadCrmStatus = stageToStatus[newStage];
                if (leadCrmStatus) {
                    await supabase.from('leads').update({ status: leadCrmStatus }).eq('id', lead.id);
                    log(`CRM status synced: ${newStage} → ${leadCrmStatus}`);
                }

                log(`Lead Brain updated: stage=${newStage}, sentiment=${sentiment}, action=${nextAction}, objection=${objection}`);
            } catch(memErr: any) {
                log(`Lead Brain update error (non-fatal): ${memErr.message}`);
            }

        }

        // ===========================================
        // 11. SEND TO TELEGRAM
        // ===========================================
        if (chatId) {
            const { data: tgInt } = await supabase.from('marketing_integrations')
                .select('settings').eq('company_id', companyId).eq('provider', 'telegram').eq('is_active', true).maybeSingle();
            const botToken = tgInt?.settings?.token;

            if (botToken && cleanText?.trim().length > 0) {
                try {
                    const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId, text: cleanText, parse_mode: 'Markdown' })
                    });
                    const tgResult = await tgResp.json();
                    if (!tgResult.ok) {
                        // Retry without markdown
                        const r2 = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: chatId, text: cleanText })
                        });
                        const r2Result = await r2.json();
                        if (r2Result.ok && savedMsg?.id) {
                            await supabase.from('marketing_messages').update({ status: 'delivered' }).eq('id', savedMsg.id);
                        }
                    } else {
                        if (savedMsg?.id) await supabase.from('marketing_messages').update({ status: 'delivered' }).eq('id', savedMsg.id);
                        log(`✅ Message delivered to Telegram chat: ${chatId}`);
                    }
                } catch (e) { console.error('Telegram send error:', e); }
            } else if (!botToken) {
                console.error('No Telegram token for company:', companyId);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            version: 'v52-lead-brain',
            agent: agent.name,
            leadContext: !!lead,
            memoryUpdated: !!lead?.id
        }), { headers: corsHeaders });

    } catch (err: any) {
        console.error('FATAL ERROR:', err);
        return new Response(JSON.stringify({
            error: String(err),
            message: err.message,
            logs
        }), { status: 500, headers: corsHeaders });
    }
});
