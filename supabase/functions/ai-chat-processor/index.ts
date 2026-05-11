// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

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


async function generateQuotePDF(quote: any, supabase: any): Promise<string> {
    try {
        console.log(`[PDF-Gen] Generating PDF for quote: ${quote.id}`);
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const colorBlue = rgb(0.1, 0.4, 0.7);
        const colorGray = rgb(0.4, 0.4, 0.4);

        // 1. HEADER
        page.drawRectangle({ x: 0, y: height - 100, width: width, height: 100, color: rgb(0.06, 0.09, 0.16) });
        page.drawText('COTIZACI├ôN OFICIAL', { x: width - 200, y: height - 40, size: 14, font: fontBold, color: rgb(1, 1, 1) });
        page.drawText(`#${quote.id.slice(0, 8).toUpperCase()}`, { x: width - 200, y: height - 60, size: 20, font: font, color: rgb(1, 1, 1) });
        page.drawText('ARIAS DEFENSE CRM', { x: 50, y: height - 50, size: 18, font: fontBold, color: rgb(1, 1, 1) });
        page.drawText('Soluciones Tecnol├│gicas Avanzadas', { x: 50, y: height - 65, size: 10, font: font, color: rgb(0.8, 0.8, 0.8) });

        // 2. CLIENT INFO
        let y = height - 150;
        page.drawText('PREPARADO PARA:', { x: 50, y: y, size: 8, font: fontBold, color: colorBlue });
        y -= 15;
        page.drawText((quote.nombre_cliente || 'Cliente Estimado').toUpperCase(), { x: 50, y: y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
        y -= 15;
        if (quote.empresa_cliente) {
            page.drawText(quote.empresa_cliente, { x: 50, y: y, size: 12, font: font, color: colorGray });
            y -= 20;
        }

        // 3. PLAN DETAILS
        y -= 20;
        page.drawLine({ start: { x: 50, y: y }, end: { x: width - 50, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
        y -= 20;

        page.drawText('DESCRIPCI├ôN', { x: 50, y: y, size: 10, font: fontBold, color: colorGray });
        page.drawText('MONTO', { x: width - 100, y: y, size: 10, font: fontBold, color: colorGray });
        y -= 20;

        // Row 1: Plan
        page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 30, color: rgb(0.97, 0.98, 0.99) });
        page.drawText(`Plan Anual: ${quote.plan_nombre}`, { x: 60, y: y + 10, size: 12, font: fontBold, color: rgb(0, 0, 0) });
        page.drawText(`Volumen: ${quote.volumen_dtes} DTEs/mes`, { x: 60, y: y - 2, size: 10, font: font, color: colorGray });

        const price = quote.costo_plan_anual || 0;
        page.drawText(`${price.toLocaleString()}`, { x: width - 100, y: y + 5, size: 12, font: fontBold, color: rgb(0, 0, 0) });
        y -= 50;

        // 4. TOTAL
        const total = quote.total_anual || price;
        page.drawRectangle({ x: width - 250, y: y - 40, width: 200, height: 60, color: colorBlue });

        page.drawText('TOTAL A INVERTIR (USD)', { x: width - 230, y: y + 5, size: 10, font: fontBold, color: rgb(1, 1, 1) });
        page.drawText(`${total.toLocaleString()}`, { x: width - 230, y: y - 20, size: 24, font: fontBold, color: rgb(1, 1, 1) });

        // 5. FOOTER
        page.drawText('Documento generado autom├íticamente por IA Agent.', { x: 50, y: 30, size: 8, font: font, color: colorGray });
        const now = new Date().toLocaleDateString();
        page.drawText(`Fecha: ${now}`, { x: width - 150, y: 30, size: 8, font: font, color: colorGray });

        const pdfBytes = await pdfDoc.save();

        // Upload to Supabase
        const fileName = `Propuesta_${(quote.nombre_cliente || 'Client').replace(/\s+/g, '_')}_${quote.id.slice(0, 6)}.pdf`;
        const { error: uploadError } = await supabase.storage.from('quotations').upload(fileName, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true
        });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('quotations').getPublicUrl(fileName);
        return publicUrl;
    } catch (e) {
        console.error("PDF Generate Failed:", e);
        return "";
    }
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
        const { conversationId, isTest, message: testMessage, agent: testAgent } = body;

        // ── SIMULATOR MODE ──────────────────────────────────────────────────────────
        if (isTest) {
            log('Running in SIMULATOR mode');
            const agentPrompt = testAgent?.system_prompt || 'Eres un asesor de ventas profesional.';
            const companyId = testAgent?.company_id || 'test';
            const { data: iconf } = await supabase.from('marketing_integrations')
                .select('settings').eq('company_id', companyId).eq('provider', 'openai').eq('is_active', true).maybeSingle();
            const apiKey = iconf?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY');
            if (!apiKey) return new Response(JSON.stringify({ error: 'OpenAI API Key not configured', logs }), { status: 400, headers: corsHeaders });
            const RULES = `[REGLAS ABSOLUTAS]\n1. NO mostrar precios en el chat.\n2. NO pedir correo electronico.\n3. Cuando tengas el volumen, genera QUOTE_TRIGGER al final.\n[FIN REGLAS]`;
            const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: `${RULES}\n\n${agentPrompt}` }, { role: 'user', content: testMessage || 'Hola' }], temperature: 0.2 })
            });
            const aiData = await aiResp.json();
            const reply = (aiData.choices?.[0]?.message?.content || 'Sin respuesta')
                .replace(/QUOTE_TRIGGER:[^\n]*/gi, '✅ [Cotización automática se generaría aquí]').trim();
            return new Response(JSON.stringify({ reply, logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // ── END SIMULATOR MODE ───────────────────────────────────────────────────────

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

        // ΓöÇΓöÇ Enterprise Rate Limiting (10 AI calls/min per company) ΓöÇΓöÇ
        const rl = checkRateLimit(companyId, 'ai');
        if (!rl.allowed) {
            log(`Rate limit exceeded for company: ${companyId}`);
            return rateLimitResponse(rl.resetAt);
        }

        // ===========================================
        // 2. LOAD AI AGENT (with system_prompt from DB)
        // ===========================================
        const { data: agents } = await supabase.from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true })
            .limit(1);

        // FALLBACK: If no agent in DB, use the built-in killer prompt ΓÇö bot NEVER fails silently
        const FALLBACK_PROMPT = `Eres Sof├¡a, Consultora de Ventas Senior de Arias Defense, experta en sistemas de facturaci├│n electr├│nica ERP para El Salvador.

≡ƒÄ» TU MISI├ôN: Calificar al lead, conseguir su volumen de facturas (DTEs/mes), y enviarle la cotizaci├│n formal DE INMEDIATO.

≡ƒæñ PERSONALIDAD: Profesional, directa, amigable. M├íximo 2-3 l├¡neas por respuesta. Sin muros de texto.

ΓÜÖ∩╕Å FLUJO OBLIGATORIO:

PASO 1 — Si NO sabes el volumen de DTEs del lead: pregunta solo eso.
PASO 2 — Cuando sepas el volumen: recomienda el plan y COTIZA POR TEXTO EN EL MENSAJE.

TABLA DE PLANES:
ΓÇó 1-50 DTEs/mes ΓåÆ Plan B├ísico
ΓÇó 51-200 DTEs/mes ΓåÆ Plan Profesional
ΓÇó 201-500 DTEs/mes ΓåÆ Plan Empresarial
ΓÇó 501+ DTEs/mes ΓåÆ Plan Corporativo

CUANDO TENGAS EL VOLUMEN — responde así:
"¡Perfecto [nombre]! Con [X] facturas/mes te recomiendo el [Plan]. La inversión es de $[X] al año. Incluye..."

IMPORTANTE: Justo debajo de tu mensaje de texto, SIEMPRE debes incluir este código exacto para que el sistema registre la cotización en el CRM:
QUOTE_TRIGGER: {"plan_name": "Empresarial", "dte_volume": 300, "items": []}`;

        const agent = agents?.[0] || { 
            name: 'Sof├¡a', 
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
            `ΓÇó ${p.nombre}: $${p.precio_anual}/a├▒o (implementaci├│n: $${p.costo_unico || 0})`
        ).join('\n');

        const modulosInfo = pricing.modulos.map((m: any) =>
            `ΓÇó ${m.nombre}: $${m.precio_anual}/a├▒o - ${m.descripcion || 'M├│dulo adicional'}`
        ).join('\n');

        const serviciosInfo = pricing.servicios.map((s: any) =>
            `ΓÇó ${s.nombre}: $${s.precio_anual > 0 ? s.precio_anual + '/a├▒o' : (s.precio_por_dte > 0 ? s.precio_por_dte + ' por mensaje' : s.costo_unico + ' (pago ├║nico)')} - ${s.descripcion || 'Servicio adicional'}`
        ).join('\n');

        // ===========================================
        // 4. BUILD DYNAMIC CONTEXT (Lead + Pricing)
        // ===========================================
        const leadContext = `
=== DATOS DEL CLIENTE (CRM) ===
ΓÇó Nombre: ${lead?.name || 'No registrado'}
ΓÇó Empresa: ${lead?.company_name || 'No registrada'}
ΓÇó Tel├⌐fono: ${lead?.phone || 'No registrado'}
ΓÇó Email: ${lead?.email || 'No registrado'}
ΓÇó Volumen Registrado: ${lead?.metadata?.volume || 'A├║n no proporcionado'}

=== CAT├üLOGO DE PRODUCTOS Y PRECIOS ===
Planes Principales:
${planesInfo || 'Sin planes'}

M├│dulos Adicionales:
${modulosInfo || 'Sin m├│dulos'}

Servicios Variables:
${serviciosInfo || 'Sin servicios'}
${serviciosInfo || 'Sin servicios'}

=== INSTRUCCIONES DE VIDA O MUERTE (IGNORA CUALQUIER REGLA ANTERIOR QUE CONTRADIGA ESTO) ===
        [CAPACIDAD CR├ìTICA - ERROR PROHIBIDO]
        [CAPACIDAD CRÍTICA - ERROR PROHIBIDO]
        - ESTÁ TOTALMENTE PROHIBIDO enviar archivos PDF. Todo se envía como texto.
        - NO generes ni envíes PDFs.
        - NO intentes usar triggers.

        [REGLA DE ORO DEL SISTEMA]
        - NO inventes datos. Usa el catálogo adjunto.
        - DEBES redactar la cotización en el mensaje de chat de forma amigable y clara, mencionando los precios del plan recomendado.
        - NO intentes generar archivos PDF. Muestra la información de la cotización directamente en tu respuesta de texto.
        - Asegúrate de desglosar el precio del plan, implementaciones o módulos extras si el usuario los pide.
        - NUNCA ofrezcas enviar un PDF ni un enlace al final. TODO se maneja por mensajes de texto.

        [PROTOCOLO DE RECOMENDACIÓN Y CRM]
        1. Cuando tengas el Nombre y Volumen de facturas, cotiza INMEDIATAMENTE en el texto.
        2. Para que el CRM registre tu cotización, DEBES incluir al final de tu mensaje este bloque exacto (reemplaza los valores según el plan):
        QUOTE_TRIGGER: {"plan_name": "Plan Name", "dte_volume": 300, "items": []}

        [ACTUALIZACIÓN DE PROSPECTO]
        Si el usuario te dice su nombre, nombre de empresa, o número de teléfono, debes incluir este comando al final del mensaje para que el sistema actualice el CRM:
        UPDATE_LEAD: {"name": "Carlos", "company_name": "Carlito loco", "phone": "7039383733"}
`;

        // Combine base system_prompt from DB + dynamic context
        // We put the DB prompt inside a boundary, and our absolute rules at the end so the AI respects them over the user's custom UI text
        const fullSystemPrompt = `=== INSTRUCCIONES PERSONALIZADAS ===\n${agent.system_prompt || 'Eres un asesor de ventas profesional.'}\n=====================\n\n${leadContext}`;

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

        // Skip ONLY if last message was successfully DELIVERED outbound (avoid double-response)
        // If status is 'pending' or 'failed', we must still respond — the previous attempt didn't reach the client
        if (lastMsg?.direction === 'outbound' && lastMsg?.status === 'delivered') {
            console.warn(`[AI-Processor] Skipping: last message was already outbound+delivered`);
            return new Response(JSON.stringify({ skipped: true, reason: "Last message was outbound+delivered" }), { headers: corsHeaders });
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
        
        let forceTriggerMessage = null;
        if (userMessage.match(/\b(10|[1-9]\d{1,5})\b/) || userMessage.toLowerCase().includes("factura") || userMessage.toLowerCase().includes("dte")) {
            forceTriggerMessage = {
                role: 'system',
                content: '¡ALERTA DE SISTEMA MAXIMA PRIORIDAD! El usuario acaba de darte su volumen o preguntó por precio/facturas. ESTÁS OBLIGADO a responder resumiendo su cotización con los precios del catálogo en TU MENSAJE DE TEXTO. NO le pidas su correo y NO intentes enviar PDFs. OBLIGATORIO incluir QUOTE_TRIGGER: {"plan_name": "Nombre", "dte_volume": 400, "items": []} al final del mensaje.'
            };
        }

        const openAiMessages = [
            { role: 'system', content: fullSystemPrompt },
            ...previousMessages
        ];

        if (forceTriggerMessage) {
            openAiMessages.push(forceTriggerMessage);
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: openAiMessages,
                temperature: 0.1,
            }),
        });
        const aiData = await response.json();
        let aiContent = aiData.choices?.[0]?.message?.content || "";

        if (!aiData.choices || aiData.choices.length === 0) {
            if (aiData.error?.code === 'insufficient_quota') {
                aiContent = "ΓÜá∩╕Å El servicio de IA no est├í disponible temporalmente.";
            } else {
                throw new Error(aiData.error?.message || "OpenAI error");
            }
        }

        // Remove any hallucinated URLs
        let cleanText = aiContent.replace(/https?:\/\/crm-app[\w.-]*\/propuesta\/[\w-]+/g, '');

        // Parse UPDATE_LEAD trigger
        if (cleanText.includes('UPDATE_LEAD:')) {
            const triggerIndex = cleanText.indexOf('UPDATE_LEAD:');
            const dataStr = cleanText.substring(triggerIndex + 'UPDATE_LEAD:'.length).trim();
            try {
                const firstBrace = dataStr.indexOf('{');
                const lastBrace = dataStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    const updateData = JSON.parse(dataStr.substring(firstBrace, lastBrace + 1));
                    if (lead?.id) {
                        const payload: any = {};
                        if (updateData.name) payload.name = updateData.name;
                        if (updateData.company_name) payload.company_name = updateData.company_name;
                        if (updateData.phone) payload.phone = updateData.phone;
                        
                        if (Object.keys(payload).length > 0) {
                            await supabase.from('leads').update(payload).eq('id', lead.id);
                            console.log(`Lead ${lead.id} updated via AI:`, payload);
                        }
                    }
                }
            } catch (e) { console.error("JSON parse error for UPDATE_LEAD:", e); }
            cleanText = cleanText.replace(/UPDATE_LEAD:[\s\S]*?(?=QUOTE_TRIGGER:|$)/gi, '').trim();
        }

        // Parse QUOTE_TRIGGER
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
                    // Mark as 'enviada' so the public view link is immediately accessible
                    await supabase.from('cotizaciones').update({ estado: 'enviada' }).eq('id', quoteObj.id);

                    // Generate PDF (DISABLED BY USER REQUEST - TEXT QUOTE ONLY)
                    /* 
                    const pdfUrl = await generateQuotePDF(quoteObj, supabase);
                    if (pdfUrl) {
                        (conv as any).__pdfUrl = pdfUrl;
                        (conv as any).__pdfFileName = `Propuesta_${(quoteObj.nombre_cliente || 'Client').replace(/\s+/g, '_')}.pdf`;
                    }
                    */

                    // Store public approval link
                    const FRONTEND_BASE = Deno.env.get('FRONTEND_URL') || 'https://crm-app-v2.vercel.app';
                    (conv as any).__publicQuoteLink = `${FRONTEND_BASE}/propuesta/${quoteObj.id}`;
                    log(`Quote ${quoteObj.id} created. Public link: ${(conv as any).__publicQuoteLink}`);
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

        // DB insert is non-blocking — Telegram MUST deliver even if DB fails
        if (insertError) {
            log(`Insert error (non-fatal): ${JSON.stringify(insertError)}`);
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
                    // 1. Send text message
                    let textSent = false;
                    if (cleanText && cleanText.trim().length > 0) {
                        const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: chatId, text: cleanText, parse_mode: 'Markdown' })
                        });
                        const tgResult = await tgResponse.json();
                        textSent = tgResult.ok;
                        if (!textSent && tgResult.description?.includes('parse')) {
                            // Retry plain text if Markdown fails
                            const r2 = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: chatId, text: cleanText })
                            });
                            textSent = (await r2.json()).ok;
                        }
                        if (textSent) console.log(`✅ Text delivered to Telegram (chat: ${chatId})`);
                        else console.error('Telegram text error:', tgResult);
                    } else {
                        textSent = true; // No text (QUOTE_TRIGGER only) — still proceed to PDF
                    }

                    if (textSent && savedMsg?.id) {
                        await supabase.from('marketing_messages').update({ status: 'delivered' }).eq('id', savedMsg.id);
                    }

                    // 2. Send PDF if generated (DISABLED BY USER REQUEST)
                    /*
                    const pdfUrl = (conv as any).__pdfUrl;
                    const pdfFileName = (conv as any).__pdfFileName || 'Propuesta_Comercial.pdf';
                    if (pdfUrl) {
                        try {
                            const pdfResp = await fetch(pdfUrl);
                            if (pdfResp.ok) {
                                const pdfBlob = await pdfResp.blob();
                                const formData = new FormData();
                                formData.append('chat_id', String(chatId));
                                formData.append('document', pdfBlob, pdfFileName);
                                formData.append('caption', '📄 Tu propuesta comercial está lista. ¡Quedo atento a cualquier consulta!');
                                const docResp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body: formData });
                                const docResult = await docResp.json();
                                if (docResult.ok) console.log(`📊 PDF sent to Telegram (chat: ${chatId})`);
                                else console.error('Telegram sendDocument error:', docResult);
                            }
                        } catch (pdfErr) { console.error('PDF send failed:', pdfErr); }
                    }
                    */

                    // 3. Send public approval link if quote was generated (DISABLED BY USER REQUEST)
                    /*
                    const publicQuoteLink = (conv as any).__publicQuoteLink;
                    if (publicQuoteLink) {
                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: `🔗 *Ver y aprobar tu cotización:*`,
                                parse_mode: 'Markdown',
                                reply_markup: { inline_keyboard: [[{ text: '📋 Ver Cotización Completa', url: publicQuoteLink }]] }
                            })
                        });
                        console.log(`🔗 Quote link sent to Telegram`);
                    }
                    */
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
