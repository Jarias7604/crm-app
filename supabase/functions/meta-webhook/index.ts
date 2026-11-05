// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 META WEBHOOK HANDLER — WhatsApp Messages + Lead Ads (Facebook/Instagram)
 * ---------------------------------------------------------------------------
 * POST body.object === 'page'                      → Meta Lead Ads → creates CRM lead
 * POST body.object === 'whatsapp_business_account' → WhatsApp messages → AI chat processor
 * GET                                              → Meta webhook verification
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   META_PAGE_ACCESS_TOKEN  (for fetching Lead Ads field data from Graph API)
 */

const SUPABASE_URL            = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── LEAD ADS PROCESSOR ──────────────────────────────────────────────────────
async function processLeadAd(entry: any, companyId: string, platform: 'facebook' | 'instagram') {
    try {
        const changes = entry.changes || [];
        for (const change of changes) {
            if (change.field !== 'leadgen') continue;

            const leadgenId = change.value?.leadgen_id;
            const formId    = change.value?.form_id;
            if (!leadgenId) continue;

            // Fetch full lead data from Meta Graph API
            const metaToken = Deno.env.get('META_PAGE_ACCESS_TOKEN');
            if (!metaToken) {
                console.error('META_PAGE_ACCESS_TOKEN not set — cannot fetch lead details');
                continue;
            }

            const graphRes = await fetch(
                `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,created_time,ad_name,campaign_name,form_id&access_token=${metaToken}`
            );
            const leadData = await graphRes.json();

            if (leadData.error) {
                console.error('Meta Graph API error:', leadData.error);
                continue;
            }

            // Parse field_data [] → flat key/value map
            const fields: Record<string, string> = {};
            for (const field of (leadData.field_data || [])) {
                fields[field.name?.toLowerCase()] = field.values?.[0] || '';
            }

            const name    = fields['full_name']
                         || fields['name']
                         || `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim()
                         || 'Lead desde Meta Ads';
            const email   = fields['email'] || '';
            const phone   = fields['phone_number'] || fields['phone'] || '';
            const company = fields['company_name'] || fields['company'] || '';
            const source  = platform === 'instagram' ? 'Instagram Ads' : 'Facebook Ads';

            // Build notes with ad context + any extra fields
            const extraFields = Object.entries(fields)
                .filter(([k]) => !['full_name','name','first_name','last_name','email','phone_number','phone','company_name','company'].includes(k))
                .map(([k, v]) => `${k}: ${v}`);

            const notes = [
                leadData.ad_name       ? `📢 Anuncio: ${leadData.ad_name}`      : '',
                leadData.campaign_name ? `📣 Campaña: ${leadData.campaign_name}` : '',
                `🆔 Lead Form ID: ${formId || 'n/a'}`,
                ...extraFields,
            ].filter(Boolean).join('\n');

            // Insert lead into CRM
            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .insert({
                    name,
                    email:        email   || null,
                    phone:        phone   || null,
                    company_name: company || null,
                    source,
                    status:       'Prospecto',
                    company_id:   companyId,
                    notes:        notes   || null,
                    created_at:   new Date().toISOString(),
                })
                .select('id')
                .single();

            if (leadError) {
                console.error(`Error creating lead from ${source}:`, leadError);
            } else {
                console.log(`✅ Lead created from ${source}: ${name} (ID: ${lead?.id})`);

                // Traceability note in lead_notes
                await supabase.from('lead_notes').insert({
                    lead_id:    lead?.id,
                    company_id: companyId,
                    content:    `Lead capturado automáticamente desde ${source}.\n${notes}`,
                    created_at: new Date().toISOString(),
                });
            }
        }
    } catch (err) {
        console.error('processLeadAd error:', err);
    }
}

// ─── SUPPORT WHATSAPP AUTO-TICKET ENGINE (50379718911 & Evolution API `arias`) ─
function classifySupportIssue(text: string): {
    category: string;
    isSupportIssue: boolean;
    priority: 'low' | 'medium' | 'high' | 'urgent';
} {
    const lower = (text || '').toLowerCase();
    const urgentKeywords = ['urgente', 'caido', 'caído', 'no funciona nada', 'bloqueado', 'no podemos facturar', 'produccion', 'producción', 'error critico', 'error crítico'];
    const supportKeywords = [
        'error', 'problema', 'falla', 'fallando', 'no deja', 'no puedo', 'no carga',
        'no sale', 'no aparece', 'ayuda', 'soporte', 'bug', 'lento', 'traba',
        'factura', 'dte', 'hacienda', 'invalidacion', 'invalidación', 'correo',
        'whatsapp', 'mensaje', 'reporte', 'planilla', 'calculo', 'cálculo',
        'permiso', 'acceso', 'contraseña', 'login', 'sincroniza', 'base de datos',
        'cobro', 'pago', 'impresora', 'ticket', 'pendiente', 'arreglar', 'revisar'
    ];
    const isUrgent = urgentKeywords.some((k) => lower.includes(k));
    const isSupportIssue = true;

    let category = 'Soporte General / Consulta';
    if (/dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia/i.test(lower)) {
        category = 'Facturación Electrónica / DTE / Hacienda';
    } else if (/whatsapp|mensaje|cola|api|envio|envío|notificaci/i.test(lower)) {
        category = 'WhatsApp / Mensajería / API';
    } else if (/login|acceso|usuario|permiso|contrase|rol|sesion|sesión/i.test(lower)) {
        category = 'Accesos / Usuarios / Permisos';
    } else if (/reporte|excel|pdf|descarga|filtro|estadistica|dashboard/i.test(lower)) {
        category = 'Reportes / Exportación / Datos';
    } else if (/calculo|cálculo|monto|iva|total|descuento|planilla|pago|cobro/i.test(lower)) {
        category = 'Cálculos / Finanzas / Pagos';
    } else if (/lento|carga|caido|caído|servidor|base de datos|sql|sincroni/i.test(lower)) {
        category = 'Infraestructura / Base de Datos / Lentitud';
    }

    return {
        category,
        isSupportIssue,
        priority: isUrgent ? 'urgent' : 'high',
    };
}

async function processSupportWhatsAppMessage(params: {
    companyId: string | null;
    remoteJid: string;
    cleanPhone: string;
    pushName: string;
    messageText: string;
    fromMe: boolean;
    isGroup: boolean;
    instanceName: string;
}) {
    const { remoteJid, cleanPhone, pushName, messageText, fromMe, isGroup, instanceName } = params;
    if (!messageText || messageText.trim().length < 1) return { ok: true, ignored: true };

    let companyId = params.companyId;
    if (!companyId) {
        const { data: recentTicket } = await supabase
            .from('tickets')
            .select('company_id')
            .not('company_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        companyId = recentTicket?.company_id || null;
    }
    if (!companyId) {
        const { data: comp } = await supabase
            .from('companies')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
        companyId = comp?.id || null;
    }
    if (!companyId) return { ok: false, error: 'No companyId' };

    let matchedLead: { id: string; name: string; phone: string | null } | null = null;
    if (cleanPhone && cleanPhone.length >= 7) {
        const last8 = cleanPhone.slice(-8);
        const { data: leadsByPhone } = await supabase
            .from('leads')
            .select('id, name, phone')
            .eq('company_id', companyId)
            .ilike('phone', `%${last8}%`)
            .limit(1);
        if (leadsByPhone && leadsByPhone.length > 0) matchedLead = leadsByPhone[0];
    }

    if (!matchedLead && pushName && pushName !== 'Cliente WhatsApp') {
        const { data: leadsByName } = await supabase
            .from('leads')
            .select('id, name, phone')
            .eq('company_id', companyId)
            .ilike('name', `%${pushName.trim()}%`)
            .limit(1);
        if (leadsByName && leadsByName.length > 0) matchedLead = leadsByName[0];
    }

    const clientDisplayName = matchedLead?.name || pushName || `WhatsApp +${cleanPhone}`;
    const classification = classifySupportIssue(messageText);

    // Check if an open/pending ticket already exists for this client or WhatsApp JID
    const { data: existingTickets } = await supabase
        .from('tickets')
        .select('id, title, status, metadata, lead_id')
        .eq('company_id', companyId)
        .in('status', ['new', 'open', 'pending'])
        .order('created_at', { ascending: false })
        .limit(50);

    const openForSameClient = (existingTickets || []).find((t: any) => {
        const meta = t.metadata || {};
        if (remoteJid && meta.whatsapp_jid === remoteJid) return true;
        if (cleanPhone && meta.whatsapp_phone === cleanPhone) return true;
        if (matchedLead?.id && t.lead_id === matchedLead.id) return true;
        return false;
    });

    const isResolutionReply =
        fromMe &&
        /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(messageText);

    if (openForSameClient) {
        await supabase.from('ticket_comments').insert({
            ticket_id: openForSameClient.id,
            company_id: companyId,
            body: `[WhatsApp ${fromMe ? 'Equipo Soporte (50379718911)' : clientDisplayName}]: ${messageText}`,
            is_internal: false,
        });

        if (isResolutionReply) {
            await supabase
                .from('tickets')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString(),
                    last_status_change_at: new Date().toISOString(),
                    solution: messageText,
                })
                .eq('id', openForSameClient.id);
        }
        return { ok: true, action: isResolutionReply ? 'ticket_resolved' : 'comment_added', ticket_id: openForSameClient.id };
    }

    if (!fromMe && classification.isSupportIssue) {
        const shortTitle = messageText.length > 85 ? `${messageText.slice(0, 82).trim()}...` : messageText.trim();
        const { data: createdTicket } = await supabase
            .from('tickets')
            .insert({
                company_id: companyId,
                lead_id: matchedLead?.id || null,
                lead_name: clientDisplayName,
                title: `[WhatsApp] ${clientDisplayName}: ${shortTitle}`,
                description: messageText,
                status: 'open',
                priority: classification.priority,
                metadata: {
                    source: 'whatsapp_evolution',
                    support_phone: '50379718911',
                    evolution_instance: instanceName,
                    whatsapp_jid: remoteJid,
                    whatsapp_phone: cleanPhone,
                    whatsapp_push_name: pushName,
                    is_group: isGroup,
                    ai_category: classification.category,
                },
            })
            .select('id')
            .single();

        return { ok: true, action: 'ticket_created', ticket_id: createdTicket?.id };
    }

    return { ok: true, ignored: true };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req) => {
    try {
        const url = new URL(req.url);

        // ── GET: Meta webhook verification ──────────────────────────────────
        if (req.method === 'GET') {
            const mode      = url.searchParams.get('hub.mode');
            const token     = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            if (mode === 'subscribe' && token === 'crm_secure_verify') {
                console.log('Meta Webhook Verified ✅');
                return new Response(challenge, { status: 200 });
            }
            return new Response('Forbidden', { status: 403 });
        }

        // ── POST: Incoming events ────────────────────────────────────────────
        if (req.method === 'POST') {
            const body = await req.json();

            // A0. EVOLUTION API WEBHOOK (Instancia `arias` / Número 50379718911) ──
            if (body.event || body.instance || body.instanceName || body.data?.key?.remoteJid) {
                const eventType = String(body.event || body.type || 'messages.upsert').toLowerCase();
                if (!eventType.includes('message')) {
                    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
                }
                const evoData = body.data || body;
                const key = evoData?.key || {};
                const remoteJid = key?.remoteJid || evoData?.remoteJid || '';
                const fromMe = Boolean(key?.fromMe ?? evoData?.fromMe ?? false);
                const participant = key?.participant || evoData?.participant || '';
                const pushName = evoData?.pushName || body?.sender || 'Cliente WhatsApp';
                const msgObj = evoData?.message || {};
                const messageText =
                    msgObj?.conversation ||
                    msgObj?.extendedTextMessage?.text ||
                    msgObj?.imageMessage?.caption ||
                    msgObj?.videoMessage?.caption ||
                    msgObj?.documentMessage?.caption ||
                    evoData?.body ||
                    evoData?.text ||
                    '';
                const isGroup = remoteJid.endsWith('@g.us');
                const cleanPhone = (isGroup ? participant : remoteJid)
                    .replace(/@s\.whatsapp\.net|@g\.us|@c\.us/g, '')
                    .replace(/\D/g, '');

                const res = await processSupportWhatsAppMessage({
                    companyId: url.searchParams.get('company_id'),
                    remoteJid,
                    cleanPhone,
                    pushName,
                    messageText,
                    fromMe,
                    isGroup,
                    instanceName: body.instance || body.instanceName || 'arias',
                });
                return new Response(JSON.stringify(res), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // A. META LEAD ADS ─ Facebook Ads / Instagram Ads ─────────────────
            if (body.object === 'page') {
                const companyId = url.searchParams.get('company_id');
                if (!companyId) {
                    console.error('Lead Ads webhook: missing ?company_id= in URL');
                    return new Response('OK', { status: 200 });
                }

                for (const entry of (body.entry || [])) {
                    const isInstagram = (entry.changes || []).some(
                        (c: any) => c.field === 'leadgen' && c.value?.platform === 'instagram'
                    );
                    await processLeadAd(entry, companyId, isInstagram ? 'instagram' : 'facebook');
                }
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            // B. WHATSAPP MESSAGES ─────────────────────────────────────────────
            if (body.object === 'whatsapp_business_account') {
                if (!body.entry || body.entry.length === 0) return new Response('OK', { status: 200 });

                for (const entry of body.entry) {
                    for (const change of (entry.changes || [])) {

                        // B0. DELIVERY STATUS UPDATES ─────────────────────────────
                        // Meta sends { statuses: [{ id, status: sent|delivered|read|failed, errors }] }
                        // Without this the CRM marks everything "delivered" optimistically and
                        // never learns a message actually failed (24h window, blocked, etc.).
                        if (Array.isArray(change.value?.statuses)) {
                            for (const st of change.value.statuses) {
                                if (!st?.id) continue;
                                // Don't downgrade a message that's already further along
                                const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };
                                const { data: existing } = await supabase
                                    .from('marketing_messages')
                                    .select('id, status, metadata')
                                    .eq('external_message_id', st.id)
                                    .maybeSingle();
                                if (!existing) continue;
                                if (st.status !== 'failed' && (rank[st.status] ?? 0) <= (rank[existing.status] ?? 0)) continue;

                                const patch: any = { status: st.status };
                                if (st.status === 'failed') {
                                    const err = st.errors?.[0] || {};
                                    patch.metadata = {
                                        ...(existing.metadata || {}),
                                        meta_error: err,
                                        actionable_error: err.code === 131047
                                            ? 'VENTANA 24H EXPIRADA: el cliente no ha escrito en más de 24 horas. Usa una plantilla aprobada.'
                                            : (err.title || err.message || 'Meta no pudo entregar el mensaje'),
                                        is_24h_expired: err.code === 131047,
                                    };
                                }
                                await supabase.from('marketing_messages').update(patch).eq('id', existing.id);
                            }
                            continue;
                        }

                        if (!change.value?.messages) continue;

                        const metadataObj   = change.value?.metadata || {};
                        const phoneNumberId = metadataObj.phone_number_id;
                        const displayPhone  = metadataObj.display_phone_number ? metadataObj.display_phone_number.replace(/\D/g, '') : null;

                        // 🎧 SUPPORT PHONE ROUTER (+503 7971 8911 / 516453938224335):
                        // Route messages on 50379718911 directly to Support Tickets & AI QA (never to Sales Leads)
                        if (phoneNumberId === '516453938224335' || (displayPhone && displayPhone.includes('79718911'))) {
                            for (const msg of change.value.messages) {
                                const contact = change.value.contacts?.find((c: any) => c.wa_id === msg.from);
                                const senderName = contact?.profile?.name || msg.from;
                                const textBody = msg.type === 'text' ? (msg.text?.body || '') : `[Adjunto ${msg.type}]`;
                                await processSupportWhatsAppMessage({
                                    companyId: url.searchParams.get('company_id'),
                                    remoteJid: `${msg.from}@s.whatsapp.net`,
                                    cleanPhone: (msg.from || '').replace(/\D/g, ''),
                                    pushName: senderName,
                                    messageText: textBody,
                                    fromMe: false,
                                    isGroup: false,
                                    instanceName: 'arias-50379718911',
                                });
                            }
                            continue;
                        }

                        // Block rogue test IDs from creating sales leads
                        const BLOCKED_PHONE_NUMBER_IDS = ['564050433468481'];
                        if (BLOCKED_PHONE_NUMBER_IDS.includes(phoneNumberId)) {
                            console.warn(`[SECURITY FILTER] Dropping message to blocked phone number: ${displayPhone || phoneNumberId}`);
                            continue;
                        }

                        // Resolve company
                        let companyId: string | null = url.searchParams.get('company_id');

                        if (companyId) {
                            const { data: integ } = await supabase
                                .from('marketing_integrations')
                                .select('company_id')
                                .eq('company_id', companyId)
                                .eq('provider', 'whatsapp')
                                .eq('is_active', true)
                                .maybeSingle();
                            if (!integ) companyId = null;
                        }

                        if (!companyId && phoneNumberId) {
                            const { data: byPhone } = await supabase
                                .from('marketing_integrations')
                                .select('company_id')
                                .eq('provider', 'whatsapp')
                                .eq('is_active', true)
                                .filter('settings->>phoneNumberId', 'eq', phoneNumberId)
                                .maybeSingle();
                            if (byPhone) companyId = byPhone.company_id;
                        }

                        if (!companyId && displayPhone) {
                            const { data: byDisplayPhone } = await supabase
                                .from('marketing_integrations')
                                .select('company_id')
                                .eq('provider', 'whatsapp')
                                .eq('is_active', true)
                                .or(`settings->>phone.ilike.%${displayPhone}%,settings->>phoneNumber.ilike.%${displayPhone}%`)
                                .maybeSingle();
                            if (byDisplayPhone) companyId = byDisplayPhone.company_id;
                        }

                        // Strict rejection if phone number is not actively registered to a company
                        if (!companyId) {
                            console.warn(`[SECURITY] Ignored WhatsApp message for unauthorized/unmapped PhoneID: ${phoneNumberId} / Phone: ${displayPhone}`);
                            continue;
                        }

                        for (const msg of change.value.messages) {
                            // Block known spam/flirt numbers like Oscar (+50368273898)
                            const BLACKLISTED_SENDERS = ['50368273898'];
                            if (BLACKLISTED_SENDERS.includes(msg.from)) {
                                console.warn(`[SECURITY] Dropping message from blacklisted sender: ${msg.from}`);
                                continue;
                            }

                            const contact    = change.value.contacts?.find((c: any) => c.wa_id === msg.from);
                            const senderName = contact?.profile?.name || msg.from;
                            const chatId     = msg.from;

                            let content  = '';
                            const formattedPhone = chatId ? (chatId.startsWith('+') ? chatId : `+${chatId.replace(/\D/g, '')}`) : null;
                            const metadata: any = { 
                                whatsapp_id: msg.id, 
                                phone_number_id: phoneNumberId, 
                                raw_data: msg,
                                phone: formattedPhone,
                                chat_id: chatId,
                                from_user_id: msg.from_user_id || null // Meta BSUID support
                            };

                            // Capture Meta Click-to-WhatsApp Ads referral data
                            if (msg.referral) {
                                metadata.referral     = msg.referral;
                                metadata.source       = 'Facebook Ads';
                                metadata.source_slug  = 'facebook_ads';   // matches lead_sources.slug
                                metadata.ad_id        = msg.referral.source_id;
                                metadata.ad_headline  = msg.referral.headline;
                                metadata.is_ad_click  = true;

                                // Auto-detect product from ad headline (e.g. "Anuncio ERP Empresarial" → 'ERP')
                                const headline = (msg.referral.headline || '').toUpperCase();
                                if (headline.includes('ERP'))       metadata.ad_product = 'ERP';
                                else if (headline.includes('CRM'))  metadata.ad_product = 'CRM';
                                else if (headline.includes('SIPLE')) metadata.ad_product = 'SIPLE';
                            }

                            if (msg.type === 'text') {
                                content = msg.text.body || '';
                                if (content.includes('facebook.com') || content.includes('fb.me') || content.includes('instagram.com')) {
                                    metadata.is_social_link = true;
                                    metadata.source      = 'Facebook Ads';
                                    metadata.source_slug = 'facebook_ads';
                                }
                            } else if (msg.type === 'audio' || msg.type === 'voice') {
                                content = '[Nota de voz recibida]';
                                const audioObj = msg.audio || msg.voice || {};
                                metadata.file_id = audioObj.id;
                                metadata.mime_type = audioObj.mime_type || 'audio/ogg';
                                metadata.type = 'audio';
                                metadata.voice = audioObj.voice || msg.type === 'voice';
                            } else if (msg.type === 'image') {
                                content = '[Imagen recibida]';
                                metadata.file_id = msg.image?.id;
                                metadata.mime_type = msg.image?.mime_type;
                                metadata.type = 'image';
                            } else if (msg.type === 'document') {
                                content = `[Documento: ${msg.document?.filename || 'Archivo'}]`;
                                metadata.file_id = msg.document?.id;
                                metadata.fileName = msg.document?.filename;
                                metadata.mime_type = msg.document?.mime_type;
                                metadata.type = 'document';
                            } else {
                                content = `[Mensaje tipo ${msg.type}]`;
                            }

                            // ─── SHIELD GATE v4: STRICT POSITIVE WHITELIST FOR NEW LEADS ───────────
                            
                            // Check if this sender phone is ALREADY an existing lead in CRM for this company
                            const cleanPhone = chatId.replace(/\D/g, '');
                            const phoneWithPlus = `+${cleanPhone}`;
                            const phoneWithoutPlus = cleanPhone;

                            const { data: existingLead } = await supabase
                                .from('leads')
                                .select('id, name, status')
                                .eq('company_id', companyId)
                                .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
                                .limit(1)
                                .maybeSingle();

                            const isExistingLead = !!existingLead;

                            // 1. Check Meta Official Paid Ad Referral
                            const isMetaPaidAd = !!(msg.referral && (msg.referral.source_id || msg.referral.headline || msg.referral.source_type === 'ad'));

                            // 2. Check Explicit Business Intent Keywords (Strict list for sales/software)
                            const STRICT_BUSINESS_INTENT_RE = /\b(factura|facturación|facturaciones|dte|dtes|erp|crm|siple|sistema|software|cotizad|cotiza|cotizacion|cotización|cotizar|demo|demostracion|demostración|precio|precios|costo|costos|plan|planes|paquete|paquetes|comprar|contratar|prueba|hacienda)\b/i;
                            const hasStrictBusinessIntent = msg.type === 'text' && STRICT_BUSINESS_INTENT_RE.test(content);

                            // 3. Known Junk / Social Links / Personal Spam Patterns
                            const JUNK_SPAM_RE = /(facebook\.com\/share|fb\.me|tiktok|vm\.tiktok|instagram\.com\/reel|#chapina|chapinahermosa|delmylopez|pedro ropero|doña|don\s|señora|señor|refrí|refri|nevera|clinica|clínica|doctor|doctores|medico|médico|hospital|boda|misa|iglesia|cumpleaños|te quiero|te amo|amor|dinero prestado|deuda|cobrar|cobro)\b/i;
                            const isJunkOrSocialLink = JUNK_SPAM_RE.test(content);

                            // Allowed Country check: El Salvador (+503) or USA (+1 with 11 digits)
                            const isElSalvador = cleanPhone.startsWith('503') && cleanPhone.length === 11;
                            const isUSA = cleanPhone.startsWith('1') && cleanPhone.length === 11;
                            const isAllowedCountry = isElSalvador || isUSA;

                            // ── WHITELIST DECISION GATE ──────────────────────────────────────────
                            // IF sender is NOT an existing lead:
                            //   ALLOW ONLY IF: (isMetaPaidAd OR hasStrictBusinessIntent) AND NOT isJunkOrSocialLink AND isAllowedCountry
                            // IF sender IS an existing lead:
                            //   ALLOW if NOT explicit viral spam / out of country junk
                            
                            let allowMessage = false;

                            if (isExistingLead) {
                                // Existing CRM contacts can send messages unless it's viral link spam
                                allowMessage = !isJunkOrSocialLink;
                            } else {
                                // NEW CONTACTS MUST PROVE THEY ARE A REAL PROSPECT (Paid Ad or Strict Business Keyword)
                                const isQualifiedProspect = (isMetaPaidAd || hasStrictBusinessIntent);
                                allowMessage = isQualifiedProspect && !isJunkOrSocialLink && isAllowedCountry;
                            }

                            if (!allowMessage) {
                                console.warn(`🚨 [JUNK SHIELD v4] REJECTED message from ${chatId} (${senderName}). ExistingLead=${isExistingLead} MetaPaidAd=${isMetaPaidAd} StrictBusinessIntent=${hasStrictBusinessIntent} JunkLink=${isJunkOrSocialLink} Country=${isAllowedCountry}. Content snippet: "${content.substring(0, 80)}"`);
                                continue; // Drop message: DO NOT create lead, DO NOT log conversation, DO NOT trigger AI
                            }

                            console.log(`✅ [JUNK SHIELD v4] PASSED message from ${chatId} (${senderName}). ExistingLead=${isExistingLead} MetaPaidAd=${isMetaPaidAd} StrictBusinessIntent=${hasStrictBusinessIntent}`);



                            const { data: convId, error } = await supabase.rpc('process_incoming_marketing_message', {
                                p_company_id:  companyId,
                                p_channel:     'whatsapp',
                                p_external_id: chatId,
                                p_sender_name: senderName,
                                p_content:     content,
                                p_metadata:    metadata,
                            });

                            if (error) {
                                console.error('RPC Error saving WhatsApp msg:', error);
                            } else {
                                // ── Recovery Intelligence ─────────────────────────────
                                // Busca el lead directamente por teléfono.
                                // Más robusto: no depende de marketing_conversations.lead_id.
                                try {
                                    const BACKGROUND_STATUSES = ['Llamada fría', 'En Nutrición'];
                                    // chatId = msg.from = "15713709774" (sin +)
                                    // leads pueden guardar "+15713709774" o "15713709774"
                                    // Usamos filter() con ilike en vez de .or() para evitar encoding issues con %
                                    const phoneWithPlus    = `+${chatId}`;
                                    const phoneWithoutPlus = chatId;

                                    let matchedLead: any = null;

                                    // Intento 1: con prefijo +
                                    const { data: lead1 } = await supabase
                                        .from('leads')
                                        .select('id, status, reengaged_at')
                                        .eq('company_id', companyId)
                                        .eq('phone', phoneWithPlus)
                                        .in('status', BACKGROUND_STATUSES)
                                        .is('reengaged_at', null)
                                        .limit(1)
                                        .maybeSingle();

                                    if (lead1) {
                                        matchedLead = lead1;
                                    } else {
                                        // Intento 2: sin prefijo +
                                        const { data: lead2 } = await supabase
                                            .from('leads')
                                            .select('id, status, reengaged_at')
                                            .eq('company_id', companyId)
                                            .eq('phone', phoneWithoutPlus)
                                            .in('status', BACKGROUND_STATUSES)
                                            .is('reengaged_at', null)
                                            .limit(1)
                                            .maybeSingle();
                                        if (lead2) matchedLead = lead2;
                                    }


                                    if (matchedLead) {
                                        const now = new Date().toISOString();
                                        const originalStatus = matchedLead.status;

                                        // 1. Mover al pipeline activo + registrar atribución
                                        await supabase.from('leads').update({
                                            status:         'En seguimiento',
                                            reengaged_from:  originalStatus,
                                            reengaged_via:   'whatsapp',
                                            reengaged_at:    now,
                                        }).eq('id', matchedLead.id);

                                        // 2. Log en historial de actividades
                                        await supabase.from('call_activities').insert({
                                            lead_id:     matchedLead.id,
                                            company_id:  companyId,
                                            action_type: 'whatsapp',
                                            notes:       `♻️ Lead re-enganchado automáticamente desde pool de campañas (${originalStatus}) — respondió por WhatsApp`,
                                            created_at:  now,
                                        });

                                        console.log(`✅ Recovery Intelligence: Lead ${matchedLead.id} (${chatId}) re-engaged from "${originalStatus}"`);
                                    }
                                } catch (reengageErr) {
                                    console.error('Recovery Intelligence error (non-fatal):', reengageErr);
                                }
                                // ─────────────────────────────────────────────────────

                                if (convId) {
                                    const aiPromise = supabase.functions.invoke('ai-chat-processor', { body: { conversationId: convId } });
                                    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(aiPromise);
                                }
                            }
                        }
                    }
                }
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            return new Response('Unknown object type', { status: 404 });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error('Meta Webhook Error:', err);
        return new Response('Internal Error', { status: 500 });
    }
});
