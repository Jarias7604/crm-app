// @ts-nocheck
// agent-orchestrator v1 — Motor de Autonomía 24/7
// Conecta Oracle (scoring) + Atlas (calidad) + Maya (contenido) + ai_tasks (cola)
// Se ejecuta cada hora vía cron o manualmente desde el Cockpit
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false } }
);

// ── VERIFIED COLUMNS from production leads table ──────────────────────────────
const LEAD_FIELDS = 'id, name, company_name, email, phone, status, priority, value, assigned_to, created_at, source, next_followup_date, contact_count';

// ── ORACLE: Score a lead for urgency/priority ─────────────────────────────────
function oracleScore(lead: any, daysSinceContact: number): number {
    let score = 50;

    // High value = higher priority
    const value = Number(lead.value) || 0;
    if (value > 5000) score += 20;
    else if (value > 1000) score += 10;
    else if (value > 0) score += 5;

    // Status urgency
    const urgentStatuses = ['Negociación', 'Lead calificado', 'En seguimiento'];
    const lowStatuses = ['Cerrado', 'Cliente', 'Perdido'];
    if (urgentStatuses.some(s => lead.status?.includes(s))) score += 15;
    if (lowStatuses.some(s => lead.status?.includes(s))) return 0; // skip

    // Days without contact = urgency
    if (daysSinceContact > 14) score += 20;
    else if (daysSinceContact > 7) score += 10;
    else if (daysSinceContact > 3) score += 5;
    else score -= 10; // recently contacted, lower priority

    // Has phone = can reach
    if (lead.phone) score += 10;
    if (lead.email) score += 5;

    // Priority flag
    if (lead.priority === 'high') score += 10;
    if (lead.priority === 'low') score -= 10;

    return Math.min(100, Math.max(0, score));
}

// ── ATLAS: Data quality check ─────────────────────────────────────────────────
function atlasCheck(lead: any): { ok: boolean; issue?: string } {
    if (!lead.name?.trim()) return { ok: false, issue: 'Sin nombre' };
    if (!lead.phone?.trim() && !lead.email?.trim()) return { ok: false, issue: 'Sin teléfono ni email' };
    return { ok: true };
}

// ── MAYA: Generate follow-up message ─────────────────────────────────────────
async function mayaGenerate(lead: any, apiKey: string | null): Promise<string> {
    const firstName = lead.name?.split(' ')[0] || 'estimado cliente';

    if (apiKey) {
        try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'system',
                        content: `Eres Sofía, agente de ventas autónoma de Arias Defense (facturación electrónica El Salvador).
Escribe un mensaje de seguimiento de WhatsApp para este lead:
- Nombre: ${lead.name}
- Empresa: ${lead.company_name || 'No registrada'}
- Estado CRM: ${lead.status || 'Prospecto'}
- Valor estimado: $${lead.value || 0}
- Días sin contacto: estimado

REGLAS: Máximo 3 líneas. Natural y humano. Una sola llamada a la acción. Usa solo el primer nombre (${firstName}). Sin saludos genéricos.

Responde SOLO el texto del mensaje, sin comillas.`
                    }],
                    temperature: 0.7,
                    max_tokens: 150,
                })
            });
            const data = await resp.json();
            const msg = data.choices?.[0]?.message?.content?.trim();
            if (msg && msg.length > 10) return msg;
        } catch (e) {
            console.error('[orchestrator] Maya GPT error:', e);
        }
    }

    // Fallback contextual
    const status = lead.status || 'Prospecto';
    if (status.includes('Negociación')) {
        return `Hola ${firstName} 👋 ¿Tuvo oportunidad de revisar nuestra propuesta? Estoy disponible para resolver cualquier duda y ayudarle a dar el siguiente paso. 😊`;
    }
    if (status.includes('calificado') || status.includes('seguimiento')) {
        return `Hola ${firstName}! Quería hacer un seguimiento rápido. ¿Le gustaría que coordinemos una llamada esta semana para revisar cómo podemos ayudarle con su facturación electrónica?`;
    }
    return `Hola ${firstName} 👋 ¿Cómo va todo? Quería retomar nuestra conversación sobre sus necesidades de facturación. ¿Tiene un momento?`;
}

// ── COMPANY PROCESSOR ─────────────────────────────────────────────────────────
async function processCompany(companyId: string, log: (...args: any[]) => void) {
    // ── STEP 1: Get autonomy level ────────────────────────────────────────
    const { data: autonomyRow } = await supabase
        .from('ai_autonomy_settings')
        .select('autonomy_level')
        .eq('company_id', companyId)
        .maybeSingle();

    const autonomyLevel = autonomyRow?.autonomy_level || 'copilot';

    // ── STEP 2: Get OpenAI key for this company ───────────────────────────
    const { data: openaiInt } = await supabase
        .from('marketing_integrations')
        .select('settings')
        .eq('company_id', companyId)
        .eq('provider', 'openai')
        .eq('is_active', true)
        .maybeSingle();

    const apiKey = openaiInt?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY') || null;

    // ── STEP 3: Oracle — fetch leads and score them ───────────────────────
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(LEAD_FIELDS)
        .eq('company_id', companyId)
        .not('status', 'in', '("Cerrado","Cliente","Perdido")')
        .order('created_at', { ascending: false })
        .limit(200);

    if (leadsError) {
        log(`Leads error for ${companyId}: ${leadsError.message}`);
        return { company_id: companyId, error: leadsError.message };
    }

    const now = new Date();
    const scored = (leads || [])
        .map(lead => {
            const lastContact = lead.next_followup_date
                ? new Date(lead.next_followup_date)
                : new Date(lead.created_at);
            const daysSince = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
            const score = oracleScore(lead, daysSince);
            const atlas = atlasCheck(lead);
            return { lead, score, daysSince: Math.round(daysSince), atlas };
        })
        .filter(item => item.score >= 40 && item.atlas.ok) // Only actionable leads
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Top 10 priority leads

    // ── STEP 4: Check existing pending tasks to avoid duplicates ──────────
    const { data: existingTasks } = await supabase
        .from('ai_tasks')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .eq('task_type', 'send_followup');

    const existingCount = existingTasks?.length || 0;
    if (existingCount >= 20) {
        return {
            company_id: companyId,
            success: true,
            message: `Queue has ${existingCount} pending tasks. No new tasks created.`,
            autonomy_level: autonomyLevel,
            skipped: true
        };
    }

    // ── STEP 5: Maya + Task Queue ─────────────────────────────────────────
    let tasksCreated = 0;
    let tasksAutoExecuted = 0;

    for (const { lead, score, daysSince, atlas } of scored) {
        try {
            // Generate message with Maya
            const message = await mayaGenerate(lead, apiKey);

            // Determine task status based on autonomy level
            let taskStatus: string;
            if (autonomyLevel === 'autopilot') {
                taskStatus = 'autopilot';
            } else if (autonomyLevel === 'semi' && score < 75) {
                taskStatus = 'autopilot';
            } else {
                taskStatus = 'pending';
            }

            // Insert task into ai_tasks queue
            const { error: taskErr } = await supabase
                .from('ai_tasks')
                .insert({
                    company_id: companyId,
                    agent_name: 'sofia',
                    task_type: 'send_followup',
                    title: `Seguimiento a ${lead.name}`,
                    description: `Oracle score: ${score}/100 · ${daysSince} días sin contacto · ${lead.status || 'Prospecto'} · ${lead.company_name || 'Sin empresa'}`,
                    payload: {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        lead_phone: lead.phone,
                        lead_email: lead.email,
                        message,
                        oracle_score: score,
                        days_since_contact: daysSince,
                        channel: lead.phone ? 'whatsapp' : 'email',
                    },
                    status: taskStatus,
                    confidence: score,
                    impact_estimate: lead.value ? `$${Number(lead.value).toLocaleString()} en pipeline` : 'Sin valor asignado',
                    executed_at: taskStatus === 'autopilot' ? now.toISOString() : null,
                });

            if (taskErr) continue;

            tasksCreated++;
            if (taskStatus === 'autopilot') {
                tasksAutoExecuted++;
            }
        } catch (e: any) {
            log(`Error processing lead ${lead.id}: ${e.message}`);
        }
    }

    // ── STEP 6: Summary ───────────────────────────────────────────────────
    return {
        company_id: companyId,
        success: true,
        autonomy_level: autonomyLevel,
        leads_evaluated: leads?.length || 0,
        leads_selected: scored.length,
        tasks_created: tasksCreated,
        tasks_auto_executed: tasksAutoExecuted,
        tasks_pending_approval: tasksCreated - tasksAutoExecuted,
        message: autonomyLevel === 'autopilot'
            ? `✅ Full Autopilot: ${tasksAutoExecuted} mensajes ejecutados automáticamente`
            : autonomyLevel === 'semi'
            ? `⚡ Semi-Auto: ${tasksAutoExecuted} auto-ejecutados, ${tasksCreated - tasksAutoExecuted} esperando aprobación`
            : `🤝 Copiloto: ${tasksCreated} tareas listas para tu aprobación en el Cockpit`
    };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
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
        let companyIds: string[] = [];

        if (body?.company_id) {
            companyIds = [body.company_id];
        } else {
            // Global run for all active companies (Cron Mode)
            const { data: companies } = await supabase
                .from('ai_autonomy_settings')
                .select('company_id');
            if (companies) {
                companyIds = companies.map(c => c.company_id);
            }
        }

        if (companyIds.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'No companies to process' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        log(`[agent-orchestrator v1] Starting for ${companyIds.length} companies`);

        const results = [];
        let totalTasks = 0;
        let totalEvaluated = 0;

        for (const companyId of companyIds) {
            try {
                const result = await processCompany(companyId, log);
                results.push(result);
                if (result.tasks_created) totalTasks += result.tasks_created;
                if (result.leads_evaluated) totalEvaluated += result.leads_evaluated;
            } catch (err: any) {
                log(`Failed company ${companyId}: ${err.message}`);
                results.push({ company_id: companyId, error: err.message });
            }
        }

        const finalSummary = {
            success: true,
            message: `✅ Orchestrator finished: ${totalTasks} tareas generadas · ${totalEvaluated} leads evaluados`,
            tasks_created: totalTasks,
            leads_evaluated: totalEvaluated,
            results,
            logs
        };

        // If a specific company was requested (Cockpit UI trigger), return its specific message format
        if (body?.company_id && results.length === 1 && !results[0].error) {
            return new Response(JSON.stringify({
                ...finalSummary,
                ...results[0], // Override with the specific company result for the UI
                logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify(finalSummary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[agent-orchestrator] FATAL:', err);
        return new Response(JSON.stringify({ error: String(err), logs }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
