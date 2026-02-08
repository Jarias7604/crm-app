// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRONTEND_URL = "https://crm-app-v2.vercel.app";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(
    SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
);

console.log(`[AI-Processor] Initialized with URL: ${SUPABASE_URL ? 'OK' : 'MISSING'}`);

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
        const { conversationId } = body;

        if (typeof conversationId !== 'string') {
            log(`Invalid conversationId type: ${typeof conversationId}`);
            return new Response(JSON.stringify({ error: "conversationId must be a string", logs }), { status: 400, headers: corsHeaders });
        }

        // ===========================================
        // 1. LOAD CONVERSATION + LEAD DATA
        // ===========================================
        log(`Starting session for Conv: ${conversationId}`);
        const { data: conv, error: convError } = await supabase.from('marketing_conversations')
            .select('*, lead:leads(*)')
            .eq('id', conversationId)
            .maybeSingle();

        if (convError) {
            log(`DB error loading conversation: ${JSON.stringify(convError)}`);
            throw convError;
        }
        if (!conv) {
            log(`Conv ${conversationId} not found`);
            return new Response(JSON.stringify({ error: "Conversation not found", logs }), { status: 404, headers: corsHeaders });
        }

        const companyId = conv.company_id;
        const lead = conv.lead;
        const chatId = conv.external_id;
        console.log(`[AI-Processor] Company: ${companyId}, Lead: ${lead?.id}, Chat: ${chatId}`);

        // ===========================================
        // 2. LOAD AI AGENT (with system_prompt from DB)
        // ===========================================
        const { data: agent } = await supabase.from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .maybeSingle();

        if (!agent) {
            console.warn(`[AI-Processor] No active agent found for Company: ${companyId}`);
            return new Response(JSON.stringify({ skipped: true, reason: "No active agent" }), { headers: corsHeaders });
        }
        log(`Using Agent: ${agent.name}`);

        // ===========================================
        // 3. LOAD PRICING DATA (Plans + Modules)
        // ===========================================
        const { data: pricingItems } = await supabase.from('pricing_items')
            .select('*')
            .or(`company_id.eq.${companyId},company_id.is.null`)
            .eq('activo', true)
            .order('orden', { ascending: true });

        const pricing = {
            planes: pricingItems?.filter((i: any) => i.tipo === 'plan') || [],
            modulos: pricingItems?.filter((i: any) => i.tipo === 'modulo') || [],
            servicios: pricingItems?.filter((i: any) => i.tipo === 'servicio') || []
        };
        log(`Loaded ${pricingItems?.length || 0} pricing items`);

        // ... (pricing info building remains the same) ...
        // Build pricing context for AI
        const planesInfo = pricing.planes.map((p: any) =>
            `• ${p.nombre}: $${p.precio_anual}/año (implementación: $${p.costo_unico || 0})`
        ).join('\n');

        const modulosInfo = pricing.modulos.map((m: any) =>
            `• ${m.nombre}: $${m.precio_anual}/año - ${m.descripcion || 'Módulo adicional'}`
        ).join('\n');

        const serviciosInfo = pricing.servicios.map((s: any) =>
            `• ${s.nombre}: $${s.precio_anual > 0 ? s.precio_anual + '/año' : (s.precio_por_dte > 0 ? s.precio_por_dte + ' por mensaje' : s.costo_unico + ' (pago único)')} - ${s.descripcion || 'Servicio adicional'}`
        ).join('\n');

        // ===========================================
        // 4. BUILD DYNAMIC CONTEXT (Lead + Pricing)
        // ===========================================
        const leadContext = `
=== INFORMACIÓN DEL LEAD (BASE DE DATOS) ===
Nombre: ${lead?.name || 'No registrado'}
Empresa: ${lead?.company_name || 'No registrada'}
Teléfono: ${lead?.phone || 'No registrado'}
Email: ${lead?.email || 'No registrado'}
Estado: ${lead?.status || 'nuevo'}
Volumen aproximado (registrado): ${lead?.metadata?.volume || 'No definido aún'}

=== PORTAFOLIO DE PRODUCTOS Y PRECIOS (CATÁLOGO REAL) ===

PLANES PRINCIPALES (Suscripción):
${planesInfo || 'No hay planes configurados'}

MÓDULOS ADICIONALES (Complementos):
${modulosInfo || 'No hay módulos configurados'}

SERVICIOS Y COSTOS VARIABLES:
${serviciosInfo || 'No hay servicios configurados'}

=== REGLAS DE INTELIGENCIA COMERCIAL ===

1. 🔍 MEMORIA DE CONVERSACIÓN: 
   - SIEMPRE revisa los mensajes previos. Si el cliente ya mencionó que usa "250 facturas", "5 sucursales", etc., NO se lo vuelvas a preguntar. Úsalo directamente para tus cálculos.

2. 🧮 CÁLCULOS DINÁMICOS EN EL CHAT:
   - Tienes permiso para mencionar precios unitarios y realizar cálculos para ayudar al cliente a entender su inversión.
   - Ej: "Como nos comentas que emites 250 facturas mensuales, el servicio de WhatsApp tendría un costo de sólo $7.50 mensuales ($0.03 x 250)."

3. ⚠️ GENERACIÓN DE COTIZACIÓN FORMAL:
   - Solo usa QUOTE_TRIGGER cuando el cliente confirme que desea una propuesta formal.
   - Incluye todos los módulos y servicios solicitados en la lista de 'items'.

✅ Link de cotización (solo al final si se solicita):
QUOTE_TRIGGER: { "plan_name": "NombreDelPlan", "dte_volume": NUMERO, "items": ["Modulo1", "Servicio1"] }
`;

        // Combine base system_prompt from DB + dynamic context
        const fullSystemPrompt = `${agent.system_prompt || 'Eres un asistente de ventas profesional.'}

${leadContext}`;

        // ===========================================
        // 5. GET OPENAI API KEY
        // ===========================================
        const { data: iconf } = await supabase.from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .maybeSingle();

        const apiKey = iconf?.settings?.apiKey;
        if (!apiKey) {
            log(`OpenAI API Key missing for Company: ${companyId}`);
            throw new Error("OpenAI API Key not found");
        }
        log(`Found OpenAI Key: ...${apiKey.slice(-5)}`);

        // ===========================================
        // 6. GET CONVERSATION HISTORY (Last 20 messages)
        // ===========================================
        const { data: history } = await supabase.from('marketing_messages')
            .select('content, direction, type, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(20);

        const lastMsg = history?.[0];
        log(`History count: ${history?.length || 0}. Last message direction: ${lastMsg?.direction}`);

        // Skip if last message was outbound (avoid double-response)
        if (lastMsg?.direction === 'outbound') {
            console.warn(`[AI-Processor] Skipping: last message was already outbound`);
            return new Response(JSON.stringify({ skipped: true, reason: "Last message was outbound" }), { headers: corsHeaders });
        }

        const previousMessages = (history || []).reverse().map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.type === 'image' ? '[Usuario envió una imagen]' :
                (msg.type === 'audio' && msg.metadata?.is_voice) || msg.type === 'voice' ? `[Nota de voz: ${msg.metadata?.transcription || 'Sin transcribir'}]` :
                    msg.type === 'audio' ? `[Audio: ${msg.metadata?.transcription || 'Sin transcribir'}]` :
                        msg.content
        }));

        // ===========================================
        // 7. HANDLE VOICE TRANSCRIPTION (Whisper)
        // ===========================================
        let userMessage = lastMsg?.content || "";
        if (lastMsg?.direction === 'inbound' && (lastMsg?.type === 'voice' || lastMsg?.type === 'audio')) {
            const fileId = lastMsg.metadata?.file_id;
            if (fileId && !lastMsg.metadata?.transcription) {
                log(`Audio detected. Transcribing file_id: ${fileId}`);
                console.log(`[Whisper] Audio detected. FileID: ${fileId}`);
                try {
                    // Get Telegram Bot Token
                    const { data: tgIntegration } = await supabase
                        .from('marketing_integrations')
                        .select('settings')
                        .eq('company_id', companyId)
                        .eq('provider', 'telegram')
                        .eq('is_active', true)
                        .maybeSingle();

                    const botToken = tgIntegration?.settings?.token;
                    if (botToken) {
                        // 1. Get file path from Telegram
                        const fileInfoResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
                        const fileInfo = await fileInfoResp.json();

                        if (fileInfo.ok && fileInfo.result.file_path) {
                            const filePath = fileInfo.result.file_path;
                            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

                            // 2. Download file
                            const audioResp = await fetch(fileUrl);
                            const audioBlob = await audioResp.blob();

                            // 3. Send to Whisper
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
                                log(`Transcription successful: ${whisperData.text}`);
                                userMessage = whisperData.text;

                                // Update message in DB with transcription
                                await supabase.from('marketing_messages')
                                    .update({
                                        content: `[Nota de voz]: ${whisperData.text}`,
                                        metadata: { ...lastMsg.metadata, transcription: whisperData.text }
                                    })
                                    .eq('id', lastMsg.id);

                                // Update history content for prompt
                                previousMessages[previousMessages.length - 1].content = `[Nota de voz]: ${whisperData.text}`;
                            }
                        }
                    }
                } catch (e) {
                    log(`Transcription error: ${e.message}`);
                }
            } else if (lastMsg.metadata?.transcription) {
                userMessage = lastMsg.metadata.transcription;
            }
        }

        // ===========================================
        // 8. CALL OPENAI (GPT-4)
        // ===========================================
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: fullSystemPrompt },
                    ...previousMessages
                ],
                temperature: 0.7,
            }),
        });
        const aiData = await response.json();
        let aiContent = aiData.choices?.[0]?.message?.content || "";

        if (!aiData.choices || aiData.choices.length === 0) {
            if (aiData.error?.code === 'insufficient_quota') {
                aiContent = "⚠️ El servicio de IA no está disponible temporalmente.";
            } else {
                throw new Error(aiData.error?.message || "OpenAI error");
            }
        }

        // ===========================================
        // 8. PROCESS QUOTE TRIGGER (if present)
        // ===========================================
        // Remove any hallucinated URLs
        let cleanText = aiContent.replace(/https?:\/\/crm-app[\w.-]*\/propuesta\/[\w-]+/g, '');

        if (cleanText.includes('QUOTE_TRIGGER:')) {
            let volume = 3000, planNameRequested = "", extraItems: string[] = [];
            const triggerIndex = cleanText.indexOf('QUOTE_TRIGGER:');
            const dataStr = cleanText.substring(triggerIndex + 'QUOTE_TRIGGER:'.length).trim();

            try {
                const firstBrace = dataStr.indexOf('{');
                const lastBrace = dataStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    const data = JSON.parse(dataStr.substring(firstBrace, lastBrace + 1));
                    volume = data.dte_volume || 3000;
                    planNameRequested = data.plan_name || "";
                    extraItems = data.items || [];
                }
            } catch (e) { console.error("JSON parse error:", e); }

            // Remove trigger from visible text
            cleanText = cleanText.replace(/QUOTE_TRIGGER:[\s\S]*/gi, '').trim();

            // Match plan from DB
            const planes = pricingItems?.filter((i: any) => i.tipo === 'plan') || [];
            const modulosYServicios = pricingItems?.filter((i: any) => i.tipo === 'modulo' || i.tipo === 'servicio') || [];

            let selectedPlan = planes.find((p: any) =>
                p.nombre.toLowerCase().includes(planNameRequested.toLowerCase()) ||
                planNameRequested.toLowerCase().includes(p.nombre.toLowerCase())
            ) || planes[0];

            if (!selectedPlan) {
                console.error("No plan found for quote");
            } else {
                let baseAnual = Number(selectedPlan.precio_anual || 0);
                let implementation = Number(selectedPlan.costo_unico || 0);
                let extrasTotal = 0;

                const dbExtras: any[] = [];
                for (const itemName of extraItems) {
                    const name = typeof itemName === 'string' ? itemName : (itemName as any).name;
                    const dbItem = modulosYServicios.find((m: any) =>
                        m.nombre.toLowerCase().includes(name.toLowerCase()) ||
                        name.toLowerCase().includes(m.nombre.toLowerCase())
                    );
                    if (dbItem) {
                        // Calculate cost based on type
                        let itemCost = Number(dbItem.precio_anual || 0);
                        if (dbItem.tipo === 'servicio' && dbItem.precio_por_dte > 0) {
                            // Variable cost per DTE/Message
                            itemCost = Number(dbItem.precio_por_dte) * volume;
                        } else if (dbItem.costo_unico > 0 && itemCost === 0) {
                            itemCost = Number(dbItem.costo_unico);
                        }

                        dbExtras.push({
                            nombre: dbItem.nombre,
                            costo: itemCost,
                            costo_anual: dbItem.tipo === 'modulo' ? itemCost : 0,
                            tipo: dbItem.tipo
                        });
                        extrasTotal += itemCost;
                    }
                }

                const subtotal = baseAnual + implementation + extrasTotal;
                const iva = subtotal * 0.13;
                const total = subtotal + iva;

                // Get creator ID
                let creatorId = agent.representative_id || null;
                if (!creatorId) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('company_id', companyId)
                        .limit(1);
                    if (profiles?.[0]) creatorId = profiles[0].id;
                }

                // Create quote in database
                const { data: quoteObj, error: quoteError } = await supabase
                    .from('cotizaciones')
                    .insert({
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
                        estado: 'borrador'
                    })
                    .select()
                    .single();

                if (quoteError) {
                    console.error("Quote creation error:", quoteError);
                }

                if (quoteObj) {
                    cleanText += `\n\n📊 ¡Listo! Aquí está tu cotización oficial:\n${FRONTEND_URL}/propuesta/${quoteObj.id}\n\nPuedes revisarla, firmarla electrónicamente y descargar el PDF. 📋`;
                }
            }
        }

        // ===========================================
        // 9. SAVE MESSAGE TO DATABASE
        // ===========================================
        const { data: savedMsg, error: insertError } = await supabase
            .from('marketing_messages')
            .insert({
                conversation_id: conversationId,
                content: cleanText,
                direction: 'outbound',
                type: 'text',
                status: 'pending',
                metadata: {
                    isAiGenerated: true,
                    processed_by: 'edge-function',
                    version: 'v39-final-fixed',
                    agentName: agent.name || 'AI',
                    leadId: lead?.id || null
                }
            })
            .select()
            .maybeSingle();

        if (insertError) {
            log(`Insert error: ${JSON.stringify(insertError)}`);
            throw insertError;
        }

        if (!savedMsg) {
            log(`Insert succeeded but returned no data. Check triggers.`);
            throw new Error("Message not saved (Blocked by database policy)");
        }

        // ===========================================
        // 10. SEND TO TELEGRAM (Atomic Transport)
        // ===========================================
        if (chatId) {
            const { data: tgIntegration } = await supabase
                .from('marketing_integrations')
                .select('settings')
                .eq('company_id', companyId)
                .eq('provider', 'telegram')
                .eq('is_active', true)
                .maybeSingle();

            const botToken = tgIntegration?.settings?.token;
            if (botToken) {
                try {
                    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: cleanText,
                            parse_mode: 'Markdown'
                        })
                    });
                    const tgResult = await tgResponse.json();

                    if (tgResult.ok) {
                        await supabase.from('marketing_messages')
                            .update({ status: 'delivered' })
                            .eq('id', savedMsg.id);
                        console.log(`✅ Message delivered to Telegram (chat: ${chatId})`);
                    } else {
                        console.error('Telegram API error:', tgResult);
                        // Retry without parse_mode if markdown fails
                        if (tgResult.description?.includes('parse')) {
                            const retryResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: chatId, text: cleanText })
                            });
                            const retryResult = await retryResponse.json();
                            if (retryResult.ok) {
                                await supabase.from('marketing_messages')
                                    .update({ status: 'delivered' })
                                    .eq('id', savedMsg.id);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Telegram send error:', e);
                }
            } else {
                console.error('No Telegram bot token found for company:', companyId);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            version: 'v40-stable',
            agent: agent.name,
            leadContext: !!lead
        }), { headers: corsHeaders });

    } catch (err: any) {
        console.error('FATAL ERROR in AI Processor:', err);
        return new Response(JSON.stringify({
            error: String(err),
            message: err.message,
            stack: err.stack,
            at: new Date().toISOString(),
            execution_logs: logs
        }), { status: 500, headers: corsHeaders });
    }
});
