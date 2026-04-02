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
}

export const DEFAULT_CALL_BOT_CONFIG: CallBotConfig = {
    enabled: false,

    telnyx_api_key: 'KEY019D4A1A3D07A7ECC29724F60E1898DD_0OZ4Wm7sKcAQCS1x38kJOe',
    telnyx_connection_id: '2928628142903920631',
    telnyx_phone: '+13054885531',

    cartesia_api_key: '',
    cartesia_voice_id: '',

    wa_enabled: true,
    wa_first_message: `¡Hola {nombre}! 👋 Le habla Sofía de Arias Defense Components.\n\n¿Me permite hacerle 2 preguntas rápidas sobre facturación electrónica? No le tomará más de 2 minutos.`,
    wa_wait_hours: 4,

    agent_name: 'Sofía',
    first_message: 'Buenas, ¿con quién tengo el gusto? Le habla Sofía de Arias Defense.',
    system_prompt: `Sos Sofia, ejecutiva de cuentas de Arias Defense Components en El Salvador.

REGLAS ABSOLUTAS:
- Hablas ÚNICAMENTE en español centroamericano de El Salvador. Usas "vos" y "usted".
- NUNCA digas que sos IA. Sos Sofía, una persona real.
- NUNCA menciones precios, tarifas ni costos.
- Máximo 2 oraciones cortas y naturales por turno.
- Si preguntan si sos robot: "No, soy Sofía de Arias Defense, con mucho gusto le ayudo."
- Expresiones naturales: "claro que sí", "con mucho gusto", "perfecto", "de una vez".

MISIÓN: Calificar si la empresa necesita Facturación Electrónica DTE de El Salvador.

FLUJO:
1. Preguntar nombre del interlocutor
2. Explicar brevemente: llamás sobre facturación electrónica DTE para empresas en El Salvador
3. Preguntar cuántas facturas o DTE emiten al mes aproximadamente
4. Preguntar si ya tienen sistema de facturación electrónica
5. Si >50 DTE/mes: ofrecer demostración gratuita de 20 minutos
6. Si <50 DTE/mes: agradecer amablemente y cerrar`,

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
            let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://ikofyypxphrqkncimszt.supabase.co').trim();
            if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
            
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

    async sendTestCall(companyId: string, phone: string): Promise<void> {
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
        
        let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://ikofyypxphrqkncimszt.supabase.co').trim();
        if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
        
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

        const targetUrl = `${supabaseUrl}/functions/v1/sofia-voice-bot/initiate`;
        console.log('Enviando petición a:', targetUrl);

        try {
            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || anonKey}`
                },
                body: JSON.stringify({ queue_id: qItem.id, test_phone: phone })
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
