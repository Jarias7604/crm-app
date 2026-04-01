import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CallStatus = 'pending' | 'calling' | 'completed' | 'no_answer' | 'retry' | 'cancelled' | 'failed';
export type CallTriggerType = 'new_lead_auto' | 'stage_change' | 'manual';
export type CallOutcomeType = 'connected_qualified' | 'connected_not_qualified' | 'no_answer' | 'voicemail' | 'error';

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
    trigger_type: CallTriggerType;
    scheduled_at: string;
    started_at: string | null;
    ended_at: string | null;
    attempt: number;
    twilio_call_sid: string | null;
    vapi_call_id: string | null;
    outcome: CallOutcomeType | null;
    transcript: TranscriptMessage[];
    ai_score: number | null;
    demo_booked: boolean;
    link_sent: boolean;
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
    connected_qualified: string;   // lead status to set
    connected_not_qualified: string;
    no_answer: string;
    demo_booked: string;
}

export interface CallBotConfig {
    enabled: boolean;
    provider: 'vapi' | 'twilio';
    // Vapi
    vapi_api_key: string;
    vapi_assistant_id: string;
    vapi_phone_number_id: string;
    vapi_phone_number: string;   // display only
    // Agent
    agent_name: string;
    agent_voice: string;
    // Legacy Twilio
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_phone_number: string;
    // Schedule
    call_hours: { start: string; end: string };
    call_days: string[];
    // Triggers
    triggers: {
        new_lead_minutes: number | null;
        stage_triggers: string[];
    };
    // Retries
    retry_hours: number;
    max_retries: number;
    // Pipeline outcome mapping
    outcome_mapping: OutcomeMapping;
    // Extra
    registration_url: string;
    demo_calendar_url: string;
    system_prompt: string;
    first_message: string;
}

export const DEFAULT_CALL_BOT_CONFIG: CallBotConfig = {
    enabled: false,
    provider: 'vapi',
    vapi_api_key: '',
    vapi_assistant_id: '',
    vapi_phone_number_id: '',
    vapi_phone_number: '',
    agent_name: 'Sofía',
    agent_voice: 'nova',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    call_hours: { start: '08:00', end: '18:00' },
    call_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    triggers: { new_lead_minutes: 59, stage_triggers: [] },
    retry_hours: 3,
    max_retries: 2,
    outcome_mapping: {
        connected_qualified: 'Lead calificado',
        connected_not_qualified: 'Prospecto',
        no_answer: 'Llamada fría',
        demo_booked: 'En seguimiento',
    },
    registration_url: '',
    demo_calendar_url: '',
    system_prompt: 'Eres Sofia, ejecutiva de cuentas de Arias Defense en El Salvador.\n\nREGLAS ABSOLUTAS:\n- Habla UNICAMENTE en espanol centroamericano. NUNCA uses ingles.\n- NUNCA menciones precios, tarifas, costos ni montos de dinero.\n- NUNCA digas que eres una IA, robot o asistente virtual.\n- Maximo 1-2 oraciones cortas y naturales por turno.\n\nTU MISION: Calificar si la empresa necesita el sistema de Facturacion Electronica DTE. Necesitas saber: (1) cuantos DTE o facturas emiten al mes, (2) si ya tienen sistema de facturacion electronica. Si emiten mas de 50 DTE/mes, ofrece una demostracion gratuita de 20 minutos.',
    first_message: 'Buenas, con quien tengo el gusto? Soy Sofia de Arias Defense.',
};

export interface CallBotStats {
    total_today: number;
    total_week: number;
    connected: number;
    qualified: number;
    demos_booked: number;
    pending: number;
    no_answer: number;
    contact_rate: number;
    qualification_rate: number;
    avg_duration: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const callBotService = {

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
        const currentCallBot = (currentFeatures.call_bot as Partial<CallBotConfig>) ?? {};
        const merged = { ...currentCallBot, ...config };

        const { error } = await supabase
            .from('companies')
            .update({ features: { ...currentFeatures, call_bot: merged } })
            .eq('id', companyId);
        if (error) throw error;
    },

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

    async getStats(companyId: string): Promise<CallBotStats> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
            .from('call_queue')
            .select('status, outcome, demo_booked, duration_seconds, created_at')
            .eq('company_id', companyId)
            .gte('created_at', weekAgo.toISOString());

        if (error) throw error;
        const rows = data || [];
        const todayRows = rows.filter(r => new Date(r.created_at) >= today);

        const connected = todayRows.filter(r =>
            r.outcome === 'connected_qualified' || r.outcome === 'connected_not_qualified'
        ).length;
        const qualified = todayRows.filter(r => r.outcome === 'connected_qualified').length;
        const demos = todayRows.filter(r => r.demo_booked).length;
        const pending = todayRows.filter(r => r.status === 'pending' || r.status === 'calling').length;
        const no_answer = todayRows.filter(r => r.outcome === 'no_answer').length;
        const durations = rows.map(r => r.duration_seconds).filter(Boolean) as number[];
        const avg_duration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

        return {
            total_today: todayRows.length,
            total_week: rows.length,
            connected,
            qualified,
            demos_booked: demos,
            pending,
            no_answer,
            contact_rate: todayRows.length > 0 ? Math.round((connected / todayRows.length) * 100) : 0,
            qualification_rate: connected > 0 ? Math.round((qualified / connected) * 100) : 0,
            avg_duration,
        };
    },

    // Manually trigger a Vapi call for a queue item
    async triggerVapiCall(queueId: string): Promise<{ success: boolean; call_id?: string; error?: string }> {
        const { data, error } = await supabase.functions.invoke('vapi-call-handler', {
            body: { queue_id: queueId },
            headers: { 'x-function-path': '/outbound' },
        });
        if (error) return { success: false, error: error.message };
        return data as { success: boolean; call_id?: string };
    },

    // Queue a manual call immediately
    async queueCall(companyId: string, leadId: string, scheduleAt?: Date): Promise<string> {
        const { data, error } = await supabase.from('call_queue').insert({
            company_id: companyId,
            lead_id: leadId,
            status: 'pending',
            trigger_type: 'manual',
            scheduled_at: (scheduleAt ?? new Date()).toISOString(),
        }).select('id').single();
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

    // Fetch available lead statuses for pipeline mapping
    async getLeadStatuses(companyId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('status')
            .eq('company_id', companyId)
            .not('status', 'is', null);
        if (error) throw error;
        const unique = [...new Set((data || []).map(r => r.status as string))].filter(Boolean);
        return unique.sort();
    },

    // Get leads callable (have phone, not yet called today)
    async getCallableLeads(companyId: string, limit = 20): Promise<{ id: string; name: string; phone: string; status: string }[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

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

    validateVapiConfig(config: Partial<CallBotConfig>): string | null {
        if (!config.vapi_api_key || config.vapi_api_key.length < 10)
            return 'API Key de Vapi requerida';
        if (!config.vapi_assistant_id)
            return 'Selecciona un asistente de Vapi';
        if (!config.vapi_phone_number_id)
            return 'Selecciona un número de teléfono de Vapi';
        return null;
    },

    // Fetch assistants and phone numbers from Vapi API
    async fetchVapiAssets(apiKey: string): Promise<{
        assistants: { id: string; name: string }[];
        phoneNumbers: { id: string; number: string; name: string }[];
    }> {
        const [assRes, phoneRes] = await Promise.all([
            supabase.functions.invoke('vapi-proxy', { body: { apiKey, endpoint: '/assistant' } }),
            supabase.functions.invoke('vapi-proxy', { body: { apiKey, endpoint: '/phone-number' } }),
        ]);

        return {
            assistants: (assRes.data as { id: string; name: string }[]) || [],
            phoneNumbers: (phoneRes.data as { id: string; number: string; name: string }[]) || [],
        };
    },
};
