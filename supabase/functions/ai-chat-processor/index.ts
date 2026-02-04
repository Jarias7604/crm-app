// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRONTEND_URL = "https://crm-app-v2.vercel.app";

/**
 * V39: CONSULTATIVE AI AGENT - Database-Driven Intelligence
 * 
 * Key Features:
 * - Uses system_prompt from database (not hardcoded)
 * - Injects lead context (name, company, phone, status)
 * - Injects pricing data dynamically
 * - Enforces qualification before quoting
 * - Atomic transport: saves + sends to Telegram in one flow
 */

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { conversationId } = await req.json();
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // ===========================================
        // 1. LOAD CONVERSATION + LEAD DATA
        // ===========================================
        const { data: conv } = await supabase.from('marketing_conversations')
            .select('*, lead:leads(*)')
            .eq('id', conversationId)
            .single();

        if (!conv) throw new Error("Conversation not found");

        const companyId = conv.company_id;
        const lead = conv.lead;
        const chatId = conv.external_id;

        // ===========================================
        // 2. LOAD AI AGENT (with system_prompt from DB)
        // ===========================================
        const { data: agent } = await supabase.from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .maybeSingle();

        if (!agent) {
            return new Response(JSON.stringify({ skipped: true, reason: "No active agent" }), { headers: corsHeaders });
        }

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

        // Build pricing context for AI
        const planesInfo = pricing.planes.map((p: any) =>
            `• ${p.nombre}: $${p.precio_anual}/año (implementación: $${p.costo_unico || 0})`
        ).join('\n');

        const modulosInfo = pricing.modulos.map((m: any) =>
            `• ${m.nombre}: $${m.precio_anual}/año - ${m.descripcion || 'Módulo adicional'}`
        ).join('\n');

        // ===========================================
        // 4. BUILD DYNAMIC CONTEXT (Lead + Pricing)
        // ===========================================
        const leadContext = `
=== INFORMACIÓN DEL LEAD EN BASE DE DATOS ===
Nombre: ${lead?.name || 'No registrado'}
Empresa: ${lead?.company_name || 'No registrada'}
Teléfono: ${lead?.phone || 'No registrado'}
Email: ${lead?.email || 'No registrado'}
Estado actual: ${lead?.status || 'nuevo'}
Prioridad: ${lead?.priority || 'normal'}
Valor estimado: ${lead?.value ? `$${lead.value}` : 'No estimado'}
Notas de seguimiento: ${lead?.next_action_notes || 'Sin notas'}
Fuente: ${lead?.source || 'telegram'}

=== PRODUCTOS Y PRECIOS DISPONIBLES ===

PLANES DISPONIBLES:
${planesInfo || 'No hay planes configurados'}

MÓDULOS ADICIONALES:
${modulosInfo || 'No hay módulos configurados'}

=== REGLAS CRÍTICAS DE COTIZACIÓN ===

⚠️ ANTES de generar cualquier cotización DEBES tener esta información:
1. Nombre del contacto ✓ o preguntarlo
2. Nombre de la empresa (si es para empresa)
3. Volumen aproximado de facturas mensuales/anuales
4. Confirmación de que quiere una cotización formal

❌ NUNCA generes una cotización si no tienes al menos el nombre y el volumen.
❌ NUNCA inventes URLs de cotización - el sistema las genera automáticamente.

✅ Cuando tengas toda la información y el cliente CONFIRME que quiere cotización, incluye al FINAL de tu mensaje:
QUOTE_TRIGGER: { "plan_name": "NombreDelPlan", "dte_volume": NUMERO, "items": ["Modulo1", "Modulo2"] }

Ejemplo: Si el cliente quiere el Plan Business con 500 DTEs y el módulo Inventario:
QUOTE_TRIGGER: { "plan_name": "Business", "dte_volume": 500, "items": ["Inventario"] }
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
        if (!apiKey) throw new Error("OpenAI API Key not found");

        // ===========================================
        // 6. GET CONVERSATION HISTORY (Last 20 messages)
        // ===========================================
        const { data: history } = await supabase.from('marketing_messages')
            .select('content, direction, type, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(20);

        const previousMessages = (history || []).reverse().map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.type === 'image' ? '[Usuario envió una imagen]' : msg.content
        }));

        // Skip if last message was outbound (avoid double-response)
        const lastMsg = history?.[0];
        if (lastMsg?.direction === 'outbound') {
            return new Response(JSON.stringify({ skipped: true, reason: "Last message was outbound" }), { headers: corsHeaders });
        }

        // ===========================================
        // 7. CALL OPENAI
        // ===========================================
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: fullSystemPrompt }, ...previousMessages],
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
            const modulos = pricingItems?.filter((i: any) => i.tipo === 'modulo') || [];

            let selectedPlan = planes.find((p: any) =>
                p.nombre.toLowerCase().includes(planNameRequested.toLowerCase())
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
                    const dbMod = modulos.find((m: any) =>
                        m.nombre.toLowerCase().includes(name.toLowerCase())
                    );
                    if (dbMod) {
                        dbExtras.push({
                            nombre: dbMod.nombre,
                            costo: dbMod.precio_anual,
                            costo_anual: dbMod.precio_anual
                        });
                        extrasTotal += Number(dbMod.precio_anual || 0);
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
                    version: 'v39-database-driven',
                    agentName: agent.name,
                    leadId: lead?.id
                }
            })
            .select()
            .single();

        if (insertError) throw insertError;

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
                .single();

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
            version: 'v39',
            agent: agent.name,
            leadContext: !!lead
        }), { headers: corsHeaders });

    } catch (err: any) {
        console.error('FATAL:', err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
