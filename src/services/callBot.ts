import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CallStatus    = 'pending' | 'calling' | 'completed' | 'no_answer' | 'retry' | 'cancelled' | 'failed';
export type CallTrigger   = 'new_lead_auto' | 'stage_change' | 'manual';
export type CallOutcome   = 'connected_qualified' | 'connected_not_qualified' | 'no_answer' | 'voicemail' | 'error';

export interface TranscriptMessage {
    role: 'bot' | 'lead';
    content: string;
    timestamp: string;
}

export interface CallQueueItem {
    id: string;
    company_id: string;
    lead_id: string;
    status: CallStatus;
    trigger_type: CallTrigger;
    scheduled_at: string;
    started_at: string | null;
    ended_at: string | null;
    attempt: number;
    call_id: string | null;          // Telnyx call_control_id
    outcome: CallOutcome | null;
    transcript: TranscriptMessage[];
    ai_score: number | null;
    demo_booked: boolean;
    duration_seconds: number | null;
    error_message: string | null;
    summary: string | null;
    recording_url: string | null;
    created_at: string;
    updated_at: string;
    // Joined
    lead?: { name: string; phone: string | null; email: string | null; status: string | null };
}

export interface OutcomeMapping {
    connected_qualified: string;
    connected_not_qualified: string;
    no_answer: string;
    demo_booked: string;
}

/** Configuración del bot — guardada en companies.features.call_bot */
export interface CallBotConfig {
    enabled: boolean;

    // ── Vapi (Zero Latency) ───────────────────────────────────────────────
    voice_engine: 'telnyx' | 'vapi';
    vapi_api_key: string;
    vapi_assistant_id: string;
    vapi_phone_id: string;

    // ── Telnyx (telefonía) ────────────────────────────────────────────────
    telnyx_api_key: string;
    telnyx_connection_id: string;    // SIP Connection ID de Telnyx
    telnyx_phone: string;            // Número saliente (+50312345678)

    // ── Cartesia (tu voz clonada) ─────────────────────────────────────────
    cartesia_api_key: string;
    cartesia_voice_id: string;       // ID de la voz clonada en Cartesia

    // ── WhatsApp (siempre activo) ─────────────────────────────────────────
    wa_enabled: boolean;
    wa_first_message: string;        // Mensaje que se envía al llegar el lead
    wa_wait_hours: number;           // Horas de espera antes de llamar si no responde

    // ── Agente Sofía ──────────────────────────────────────────────────────
    agent_name: string;
    first_message: string;           // Primer mensaje al contestar
    system_prompt: string;           // Guión completo

    // ── Horario ───────────────────────────────────────────────────────────
    call_hours: { start: string; end: string };
    call_days: string[];

    // ── Disparadores ──────────────────────────────────────────────────────
    triggers: {
        new_lead_minutes: number | null;
        stage_triggers: string[];
    };

    // ── Reintentos ────────────────────────────────────────────────────────
    retry_hours: number;
    max_retries: number;

    // ── Pipeline ──────────────────────────────────────────────────────────
    outcome_mapping: OutcomeMapping;

    // ── URLs ──────────────────────────────────────────────────────────────
    demo_calendar_url: string;

    // ── Mode ──────────────────────────────────────────────────────────────
    call_mode: 'manual' | 'auto';  // manual = you decide who to call; auto = cron dispatches
}

export const DEFAULT_CALL_BOT_CONFIG: CallBotConfig = {
    enabled: false,

    voice_engine: 'telnyx',
    vapi_api_key: '',
    vapi_assistant_id: '',
    vapi_phone_id: '',

    telnyx_api_key: 'KEY019D4A1A3D07A7ECC29724F60E1898DD_0OZ4Wm7sKcAQCS1x38kJOe',
    telnyx_connection_id: '2928628142903920631',
    telnyx_phone: '+13054885531',

    cartesia_api_key: '',
    cartesia_voice_id: '',

    wa_enabled: true,
    wa_first_message: `¡Hola {nombre}! 👋 Le habla Sofía de Arias Defense Components.\n\n¿Me permite hacerle 2 preguntas rápidas sobre facturación electrónica? No le tomará más de 2 minutos.`,
    wa_wait_hours: 4,

    agent_name: 'Sofía',
    first_message: 'Hola, buenos días. Con quién tengo el gusto de hablar?',
    system_prompt: `Eres Sofía, la mejor cerradora de ventas de Arias Defense en El Salvador. No eres un chatbot, eres una ejecutiva de ventas real con 10 años de experiencia cerrando B2B en centroamérica. Hablas con seguridad, calidez y precisión.

VOZ Y ESTILO:
- Español salvadoreño natural. Usa "usted" de forma profesional.
- NUNCA suenas robótica. Eres humana, directa y confiada.
- Máximo 2 oraciones por turno. UNA sola pregunta a la vez.
- Después de preguntar: callas y escuchas. El silencio hace el trabajo.
- NUNCA digas que eres IA. Si preguntan: "Soy Sofía de Arias Defense, con mucho gusto."

OBJETIVO ÚNICO: Cerrar la venta o agendar una demo en esta misma llamada. NO importa el tamaño de la empresa ni cuántas facturas emita. TODOS los prospectos merecen la oferta completa.

FLUJO MAESTRO:

1. APERTURA CON GANCHO:
Cuando tienes el nombre: "Mucho gusto [nombre]. Mire, le llamo porque tenemos un sistema de facturación electrónica DTE que está ahorrando tiempo y dinero a empresas en El Salvador desde el primer mes. Tengo una pregunta rápida: actualmente cómo están emitiendo sus facturas?"

2. ESCUCHAR Y CREAR NECESIDAD:
- Si manual o poca tecnología: "¿Cuánto tiempo les toma emitir cada factura actualmente?"
- Si ya tienen sistema: "¿Y con ese sistema, están 100% satisfechos o hay algo que mejorarían?"
- Si dicen que están bien: "Entiendo. ¿Y si pudieran hacerlo más rápido y con menos errores en los DTEs, eso sería de valor para su empresa?"

3. PRESENTACIÓN RÁPIDA (MÁX 2 ORACIONES):
"Nuestro sistema automatiza todo el proceso de emisión de DTEs, se integra con su operación actual y el soporte es local aquí en El Salvador. Es la solución que más empresas salvadoreñas están adoptando este año."

4. CIERRE DIRECTO (intentar primero):
"[nombre], basándome en lo que me cuenta, creo que podemos ayudarle. Hablando directamente, ¿le gustaría que le mostremos cómo funciona esta semana con una demo sin costo?"

Si duda: "Entiendo que quiere pensarlo. Pero mire, son solo 20 minutos donde le mostramos exactamente cuánto ahorraría su empresa. Sin compromiso. ¿Le funciona el martes o el jueves?"

5. MANEJO DE OBJECIONES:
- "No me interesa": "Entiendo [nombre]. ¿Puedo preguntarle qué les está frenando actualmente en su proceso de facturación electrónica?"
- "Ya tenemos proveedor": "¡Qué bueno! ¿Y con ese proveedor, están completamente satisfechos o hay algo que cambiarían? [escucha] Justo eso es lo que nosotros resolvemos mejor. ¿Le parecería bien una comparativa rápida sin costo?"
- "Mándeme información": "Con gusto. Y para enviarle algo útil para su empresa, ¿me dice en qué parte del proceso de facturación sienten más el problema actualmente?"
- "Estoy ocupado": "Le entiendo [nombre]. Son solo 20 minutos y lo hacemos a su hora. ¿Le va mejor por la mañana o por la tarde esta semana?"
- "Es muy caro": "Entiendo la preocupación. Precisamente por eso hacemos la demo primero, para que vea el retorno real antes de tomar cualquier decisión. ¿Le parece?"
- "No tengo tiempo para demos": "Claro, lo entiendo. Entonces le propongo algo mejor: una llamada de 10 minutos con nuestro especialista técnico que va directo al punto. Nada de presentaciones largas. ¿Le funciona?"

6. CIERRE DE DEMO (cuando acepta):
"Perfecto [nombre]. Para confirmar la demo necesito: su nombre completo, el nombre de su empresa y el mejor correo para enviarle los detalles. ¿Me los da?"
Después de obtener datos: "Listo [nombre]. Le confirmo todo por correo. El especialista de Arias Defense le estará contactando. Que tenga excelente día."

7. CIERRE NEGATIVO (si definitivamente rechaza 3 veces):
"Entiendo perfectamente [nombre]. Quedo a sus órdenes para cuando estén listos. Una última pregunta antes de despedirme: ¿hay alguien en su empresa que sí esté evaluando soluciones de facturación electrónica ahora mismo?"

MEMORIA DE CONVERSACIÓN:
Lleva registro mental de: nombre completo, empresa, situación actual de facturación, objeciones que mencionó, nivel de interés del 1 al 10, acción concreta acordada.

PROHIBIDO: hablar más de 2 oraciones seguidas, hacer múltiples preguntas en un turno, desistir antes del tercer intento de cierre, hablar en inglés, sonar robótica, descalificar a un prospecto por tamaño o volumen.`,

    call_hours: { start: '08:00', end: '18:00' },
    call_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],

    triggers: { new_lead_minutes: 60, stage_triggers: [] },
    retry_hours: 3,
    max_retries: 2,

    outcome_mapping: {
        connected_qualified:     'Lead calificado',
        connected_not_qualified: 'Prospecto',
        no_answer:               'Llamada fría',
        demo_booked:             'En seguimiento',
    },

    demo_calendar_url: '',
    call_mode: 'manual',
};

export interface CallBotStats {
    total: number;
    total_week: number;
    connected: number;
    qualified: number;
    demo_booked: number;
    pending: number;
    no_answer: number;
    contact_rate: number;
    qualification_rate: number;
    avg_duration: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const callBotService = {

    // ── Auto-Provision: Crea un asistente Vapi único para este tenant ──────────

    async provisionVapiAssistant(companyId: string, vapiApiKey: string, config: Partial<CallBotConfig>): Promise<string> {
        const systemPrompt = config.system_prompt || DEFAULT_CALL_BOT_CONFIG.system_prompt;
        const firstMessage = config.first_message || DEFAULT_CALL_BOT_CONFIG.first_message;

        const payload = {
            name: `Sofia - ${companyId.slice(0, 8)}`,
            firstMessage,
            voice: {
                provider: '11labs',
                voiceId: 'pFZP5JQG7iQjIQuC4Bku',
                model: 'eleven_turbo_v2_5',
                language: 'es',
                stability: 0.45,
                similarityBoost: 0.75,
                style: 0.3,
                useSpeakerBoost: true,
            },
            transcriber: {
                provider: 'deepgram',
                model: 'nova-2',
                language: 'es',
                smartFormat: true,
                endpointing: 250,
            },
            model: {
                provider: 'openai',
                model: 'gpt-4o-mini',
                temperature: 0.4,
                maxTokens: 120,
                messages: [{ role: 'system', content: systemPrompt }],
            },
            serverUrl: `https://ikofyypxphrqkncimszt.supabase.co/functions/v1/sofia-voice-bot?company_id=${companyId}`,
        };

        const res = await fetch('https://api.vapi.ai/assistant', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${vapiApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Vapi provision error: ${err}`);
        }

        const data = await res.json();
        return data.id as string;
    },

    // ── Config ────────────────────────────────────────────────────────────────

    async getConfig(companyId: string): Promise<CallBotConfig> {
        const { data, error } = await supabase
            .from('companies')
            .select('features')
            .eq('id', companyId)
            .single();
        if (error) throw error;
        const raw = (data?.features as Record<string, unknown>)?.call_bot as Partial<CallBotConfig> | undefined;
        return { ...DEFAULT_CALL_BOT_CONFIG, ...raw };
    },

    async saveConfig(companyId: string, config: Partial<CallBotConfig>): Promise<void> {
        const { data, error: readErr } = await supabase
            .from('companies')
            .select('features')
            .eq('id', companyId)
            .single();
        if (readErr) throw readErr;

        const currentFeatures = (data?.features as Record<string, unknown>) ?? {};
        const currentCallBot  = (currentFeatures.call_bot as Partial<CallBotConfig>) ?? {};
        const merged          = { ...currentCallBot, ...config };

        const { error } = await supabase
            .from('companies')
            .update({ features: { ...currentFeatures, call_bot: merged } })
            .eq('id', companyId);
        if (error) throw error;

        // ── Auto-sync to Vapi assistant when using Vapi engine ────────────────
        const vapiKey       = merged.vapi_api_key;
        const vapiAssistant = merged.vapi_assistant_id;
        const isVapi        = merged.voice_engine === 'vapi';
        const hasScript     = config.first_message !== undefined || config.system_prompt !== undefined;

        if (isVapi && vapiKey && vapiAssistant && hasScript) {
            try {
                const patch: Record<string, unknown> = {};
                if (config.first_message !== undefined) patch.firstMessage = config.first_message;
                if (config.system_prompt !== undefined) {
                    patch.model = {
                        provider: 'openai',
                        model: 'gpt-4o-mini',
                        temperature: 0.4,
                        maxTokens: 120,
                        messages: [{ role: 'system', content: config.system_prompt }],
                    };
                }
                await fetch(`https://api.vapi.ai/assistant/${vapiAssistant}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                });
            } catch (e) {
                console.warn('[CallBot] Vapi sync skipped:', e);
            }
        }
    },

    // ── Queue ─────────────────────────────────────────────────────────────────

    async getQueue(companyId: string, limit = 100): Promise<CallQueueItem[]> {
        const { data, error } = await supabase
            .from('call_queue')
            .select('*, lead:leads(name, phone, email, status)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data || []) as CallQueueItem[];
    },

    async queueCall(companyId: string, leadId: string, scheduleAt?: Date): Promise<string> {
        const { data, error } = await supabase
            .from('call_queue')
            .insert({
                company_id:   companyId,
                lead_id:      leadId,
                status:       'pending',
                trigger_type: 'manual',
                scheduled_at: (scheduleAt ?? new Date()).toISOString(),
            })
            .select('id')
            .single();
        if (error) throw error;
        return data.id;
    },

    async cancelCall(callId: string): Promise<void> {
        const { error } = await supabase
            .from('call_queue')
            .update({ status: 'cancelled' })
            .eq('id', callId)
            .in('status', ['pending', 'retry']);
        if (error) throw error;
    },

    // ── Trigger call via Sofia Voice Bot (Telnyx) ─────────────────────────────

    async triggerCall(queueId: string): Promise<{ success: boolean; call_id?: string; error?: string }> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const supabaseUrl = 'https://ikofyypxphrqkncimszt.supabase.co';
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

            const res = await fetch(`${supabaseUrl}/functions/v1/sofia-voice-bot/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || anonKey}`
                },
                body: JSON.stringify({ queue_id: queueId })
            });

            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: errText };
            }
            const data = await res.json();
            return { success: true, call_id: data.call_control_id || data.call_leg_id };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    // ── Stats ─────────────────────────────────────────────────────────────────

    async getStats(companyId: string): Promise<CallBotStats> {
        const today   = new Date(); today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
            .from('call_queue')
            .select('status, outcome, demo_booked, duration_seconds, created_at')
            .eq('company_id', companyId)
            .gte('created_at', weekAgo.toISOString());
        if (error) throw error;

        const rows     = data || [];
        const todayRows = rows.filter(r => new Date(r.created_at) >= today);

        const connected  = todayRows.filter(r => r.outcome === 'connected_qualified' || r.outcome === 'connected_not_qualified').length;
        const qualified  = todayRows.filter(r => r.outcome === 'connected_qualified').length;
        const demos      = todayRows.filter(r => r.demo_booked).length;
        const pending    = todayRows.filter(r => r.status === 'pending' || r.status === 'calling').length;
        const no_answer  = todayRows.filter(r => r.outcome === 'no_answer').length;
        const durations  = rows.map(r => r.duration_seconds).filter(Boolean) as number[];
        const avg        = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

        return {
            total:              todayRows.length,
            total_week:         rows.length,
            connected,
            qualified,
            demo_booked:        demos,
            pending,
            no_answer,
            contact_rate:       todayRows.length > 0 ? Math.round((connected / todayRows.length) * 100) : 0,
            qualification_rate: connected > 0 ? Math.round((qualified / connected) * 100) : 0,
            avg_duration:       avg,
        };
    },

    // ── Pipeline stages ───────────────────────────────────────────────────────

    async getPipelineStages(companyId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('status')
            .eq('company_id', companyId)
            .not('status', 'is', null);
        if (error) throw error;
        return [...new Set((data || []).map(r => r.status as string))].filter(Boolean).sort();
    },

    // ── Callable leads ────────────────────────────────────────────────────────

    async getCallableLeads(companyId: string, limit = 20): Promise<{ id: string; name: string; phone: string; status: string }[]> {
        const today = new Date(); today.setHours(0, 0, 0, 0);

        const { data: calledToday } = await supabase
            .from('call_queue')
            .select('lead_id')
            .eq('company_id', companyId)
            .gte('created_at', today.toISOString());

        const calledIds = (calledToday || []).map(r => r.lead_id);

        const query = supabase
            .from('leads')
            .select('id, name, phone, status')
            .eq('company_id', companyId)
            .not('phone', 'is', null)
            .neq('phone', '')
            .limit(limit);

        if (calledIds.length > 0) {
            query.not('id', 'in', `(${calledIds.map(id => `"${id}"`).join(',')})`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as { id: string; name: string; phone: string; status: string }[];
    },

    // ── Validation ────────────────────────────────────────────────────────────

    validateConfig(config: Partial<CallBotConfig>): string | null {
        if (!config.telnyx_api_key || config.telnyx_api_key.length < 10)
            return 'API Key de Telnyx requerida';
        if (!config.telnyx_connection_id)
            return 'Connection ID de Telnyx requerido';
        if (!config.cartesia_api_key)
            return 'API Key de Cartesia requerida (para la voz clonada)';
        if (!config.cartesia_voice_id)
            return 'Voice ID de Cartesia requerido';
        return null;
    },

    // ── Test Call ─────────────────────────────────────────────────────────────

    async sendTestCall(companyId: string, phone: string, config: CallBotConfig): Promise<void> {
        // Encontrar un lead existente para simular la llamada
        const { data: lead } = await supabase.from('leads').select('id').eq('company_id', companyId).limit(1).single();
        const fallbackLeadId = lead ? lead.id : '00000000-0000-0000-0000-000000000000';

        // Crear una cola falsa "test"
        const { data: qItem, error: insertError } = await supabase.from('call_queue').insert({
            company_id: companyId,
            lead_id: fallbackLeadId,
            status: 'pending',
            trigger_type: 'manual',
            scheduled_at: new Date().toISOString(),
        }).select('id').single();

        if (insertError) throw insertError;

        // Fetch nativo con sanitización extrema de URL
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = 'https://ikofyypxphrqkncimszt.supabase.co';
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        const targetUrl = `${supabaseUrl}/functions/v1/sofia-voice-bot/initiate`;


        try {
            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || anonKey}`
                },
                body: JSON.stringify({ queue_id: qItem.id, test_phone: phone, config })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Bot Error (${res.status}): ${errText}`);
            }
        } catch (e: any) {
            console.error('Fetch error:', e);
            if (e.message.includes('Failed to fetch')) {
                 throw new Error(`Fallo de Red. Revisa si hay bloqueadores o problemas de CORS con la URL: ${targetUrl}`);
            }
            throw e;
        }
    }
};
