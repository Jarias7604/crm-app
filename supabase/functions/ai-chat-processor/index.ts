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
        const { data: agents } = await supabase.from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true })
            .limit(1);

        // FALLBACK: If no agent in DB, use the built-in killer prompt — bot NEVER fails silently
        const FALLBACK_PROMPT = `Eres Sofía, Consultora de Ventas Senior de Arias Defense, experta en sistemas de facturación electrónica ERP para El Salvador.

🎯 TU MISIÓN: Calificar al lead, conseguir su volumen de facturas (DTEs/mes), y enviarle la cotización formal DE INMEDIATO.

👤 PERSONALIDAD: Profesional, directa, amigable. Máximo 2-3 líneas por respuesta. Sin muros de texto.

⚙️ FLUJO OBLIGATORIO:

PASO 1 — Si NO sabes el volumen de DTEs del lead: pregunta solo eso.
PASO 2 — Cuando sepas el volumen: recomienda el plan y dispara QUOTE_TRIGGER en el MISMO mensaje.

TABLA DE PLANES:
• 1-50 DTEs/mes → Plan Básico
• 51-200 DTEs/mes → Plan Profesional
• 201-500 DTEs/mes → Plan Empresarial
• 501+ DTEs/mes → Plan Corporativo

CUANDO TENGAS EL VOLUMEN — responde así (OBLIGATORIO):
"¡Perfecto [nombre]! Con [X] facturas/mes te recomiendo el [Plan]. Aquí está tu propuesta:
QUOTE_TRIGGER: {"plan_name": "Empresarial", "dte_volume": 300, "items": []}"

REGLAS DE ORO:
1. ❌ NUNCA inventes descuentos o promociones que no estén en el historial de conversación.
2. ❌ NUNCA preguntes si quieren la cotización — envíala DIRECTO con QUOTE_TRIGGER.
3. ✅ Si en el historial ves un mensaje con un descuento (ej: '25% de descuento'), reconócelo y aplícalo.
4. ✅ Si piden módulos (CXC, Inventario, POS, Nómina), ponlos en items: ["CXC"].`;

        const agent = agents?.[0] || { 
            name: 'Sofía', 
            system_prompt: FALLBACK_PROMPT,
            representative_id: null 
        };
        log(`Using Agent: ${agent.name} (${agents?.[0] ? 'from DB' : 'FALLBACK built-in'})`)

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
=== DATOS DEL CLIENTE (CRM) ===
• Nombre: ${lead?.name || 'No registrado'}
• Empresa: ${lead?.company_name || 'No registrada'}
• Teléfono: ${lead?.phone || 'No registrado'}
• Email: ${lead?.email || 'No registrado'}
• Volumen Registrado: ${lead?.metadata?.volume || 'Aún no proporcionado'}

=== CATÁLOGO DE PRODUCTOS Y PRECIOS ===
Planes Principales:
${planesInfo || 'Sin planes'}

Módulos Adicionales:
${modulosInfo || 'Sin módulos'}

Servicios Variables:
${serviciosInfo || 'Sin servicios'}
${serviciosInfo || 'Sin servicios'}

=== INSTRUCCIONES CRÍTICAS ===
1. MEMORIA: Revisa el historial COMPLETO. Los mensajes del asesor (outbound) son parte del contexto — si ves un descuento o promoción enviada por el asesor, reconócela y aplícala en la cotización.
2. QUOTE_TRIGGER AUTOMÁTICO: En cuanto sepas el volumen de DTEs, dispara el QUOTE_TRIGGER EN ESA MISMA RESPUESTA. NO pidas permiso al cliente.
   Formato exacto: QUOTE_TRIGGER: {"plan_name": "Profesional", "dte_volume": 150, "items": ["CXC"]}
3. PRECIOS: Los precios exactos SOLO los muestra el sistema con el QUOTE_TRIGGER. Nunca escribas precios manualmente.
`;

        // Combine base system_prompt from DB + dynamic context
        const fullSystemPrompt = `${agent.system_prompt || 'Eres un asesor de ventas profesional.'}\n\n${leadContext}`;

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
        if (!apiKey) {
            log(`OpenAI API Key missing for Company: ${companyId}`);
            throw new Error("OpenAI API Key not found");
        }
        log(`Found OpenAI Key: ...${apiKey.slice(-5)}`);

        // ===========================================
        // 6. GET CONVERSATION HISTORY (Last 20 messages)
        // ===========================================
        const { data: history } = await supabase.from('marketing_messages')
            .select('content, direction, type, created_at, metadata')
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
                    // ── Send quote as a SEPARATE beautiful message ─────────────────────────
                    // The AI conversation text is clean (no link), quote comes as its own card
                    const quoteUrl = `${FRONTEND_URL}/propuesta/${quoteObj.id}`;
                    
                    // Format totals
                    const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    
                    const quoteCard = [
                        `📊 *Cotización #${quoteObj.id.slice(-6).toUpperCase()}*`,
                        ``,
                        `👤 *Cliente:* ${lead?.name || 'Cliente'}`,
                        `🏢 *Empresa:* ${lead?.company_name || 'No especificada'}`,
                        ``,
                        `📋 *Plan:* ${selectedPlan.nombre}`,
                        `📄 *Volumen:* ${volume.toLocaleString()} DTEs/mes`,
                        ``,
                        `💰 *Desglose:*`,
                        `• Plan anual: ${fmt(baseAnual)}`,
                        implementation > 0 ? `• Implementación: ${fmt(implementation)}` : null,
                        dbExtras.length > 0 ? dbExtras.map((e: any) => `• ${e.nombre}: ${fmt(e.costo)}`).join('\n') : null,
                        `• IVA (13%): ${fmt(iva)}`,
                        ``,
                        `💎 *TOTAL: ${fmt(total)}*`,
                        ``,
                        `👉 Ver cotización completa, firmar y descargar PDF:`,
                        quoteUrl,
                    ].filter(line => line !== null).join('\n');
                    
                    // Send the quote card as a second message (after the AI text)
                    // Store it in a variable to send after the main message is delivered
                    (conv as any).__quoteCard = quoteCard;
                    (conv as any).__quoteUrl = quoteUrl;
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

                        // ── Send quote card as SEPARATE message if generated ──────────────
                        const quoteCard = (conv as any).__quoteCard;
                        if (quoteCard) {
                            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chat_id: chatId,
                                    text: quoteCard,
                                    parse_mode: 'Markdown',
                                    disable_web_page_preview: false,
                                })
                            });
                            console.log(`📊 Quote card sent to Telegram (chat: ${chatId})`);
                        }
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
