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

console.log(`[AI-Processor v50-clean] Initialized`);

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

        const absoluteRules = `=== REGLAS ABSOLUTAS DEL SISTEMA — NUNCA VIOLAR ===
1. SOLO cotizar por texto en el mensaje. NUNCA mencionar PDF, propuesta formal, documento adjunto, ni enlace de aprobación.
2. NUNCA pedir correo para enviar documentos.
3. Cotizar SIEMPRE con los precios reales del catálogo de arriba.
4. SIEMPRE ofrecer las dos opciones de pago: contado (20% OFF) y financiado a 12 meses.
5. SIEMPRE mostrar cuánto ahorra el cliente eligiendo el pago único.
6. SIEMPRE ofrecer módulos adicionales después de presentar el plan principal.
7. Si el cliente da un volumen aproximado de facturas, tómalo y recomienda el plan cuyo rango cubre ese volumen.
8. Mensajes cortos y conversacionales. Máximo 5-8 líneas.

=== PROTOCOLO DE TRIGGERS (invisible para el cliente) ===
- Cuando cotices, incluye AL FINAL: QUOTE_TRIGGER: {"plan_name": "NOMBRE_PLAN", "dte_volume": NUMERO_ANUAL, "items": ["Módulo1", "Módulo2"]}
- Cuando el cliente dé su nombre/empresa/teléfono: UPDATE_LEAD: {"name": "Nombre", "company_name": "Empresa", "phone": "5555-0000"}
- Estos códigos NUNCA aparecen en el texto que ve el cliente.`;

        const fullSystemPrompt = `=== INSTRUCCIONES MAESTRAS DEL AGENTE (tu guía principal) ===
${agent.system_prompt || 'Eres un asesor de ventas profesional.'}
==========================================

${leadSection}

${catalogContext}
${demoSection}
=== OPCIONES DE PAGO — SIEMPRE PRESENTAR AMBAS ===
- Pago único contado: precio anual con 20% de descuento. Muestra cuánto ahorra.
- Financiado a 12 meses: divide el precio anual entre 12.
- SIEMPRE ofrece módulos adicionales después de la cotización principal.

${absoluteRules}`;

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
                if (quoteObj) log(`Quote ${quoteObj.id} saved to DB`);
            }
        }

        // Remove any remaining hallucinated CRM links or PDF mentions from visible text
        cleanText = cleanText
            .replace(/https?:\/\/crm-app[\w.-]*\/propuesta\/[\w-]+/g, '')
            .replace(/(?:te (?:genero|genero|mando|env[ií]o|adjunto)|adjunto|enviando)[^.]*?(?:pdf|propuesta formal|documento|archivo)[^.]*/gi, '')
            .replace(/QUOTE_TRIGGER:[\s\S]*/gi, '')
            .replace(/UPDATE_LEAD:[\s\S]*/gi, '')
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
                version: 'v50-clean',
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
            version: 'v50-clean',
            agent: agent.name,
            leadContext: !!lead
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
