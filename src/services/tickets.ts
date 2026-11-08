import { supabase } from './supabase';
import { isSupportTicket } from '../lib/whatsappScopes';

export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CompanyAgent {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url: string | null;
}

export interface TicketLead {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status?: string | null;
    es_cliente?: boolean | null;
    assigned_to?: string | null;
}

export interface TicketCategory {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    color: string;
    sla_hours: number;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    company_id: string;
    author_id: string | null;
    body: string;
    is_internal: boolean;
    created_at: string;
    updated_at: string;
    author?: {
        id: string;
        full_name: string;
        avatar_url: string | null;
    };
}

export interface ResolutionAttachment {
    url: string;
    name: string;
    type: string;
    size: number;
}

export interface Ticket {
    id: string;
    company_id: string;
    lead_id: string | null;
    category_id: string | null;
    assigned_to: string | null;
    title: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    metadata: Record<string, unknown>;
    due_date: string | null;
    last_status_change_at: string;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    parent_ticket_id?: string | null;

    // QA Checklist and Tracking hours
    estimated_hours?: number;
    actual_hours?: number;
    checklist?: { id: string; text: string; status: 'pending' | 'passed' | 'failed' }[];

    // Resolution Report fields (optional — filled when closing a ticket)
    findings?: string | null;
    root_cause?: string | null;
    solution?: string | null;

    // Joined data
    lead_name?: string | null;       // snapshot — always readable, even for restricted agents
    lead?: { name: string; email: string };
    category?: TicketCategory;
    assigned_profile?: { id: string; full_name: string; avatar_url: string | null };
}

export interface TicketStats {
    total: number;
    open: number;           // new + open combined
    pending: number;
    resolved: number;
    closed: number;
    urgent: number;
    aging: number;          // past 80% of SLA
    avgResolutionTimeHours: number;
    resolvedToday: number;
    createdToday: number;
    byStatus: { status: string; count: number }[];
    byPriority: { priority: string; count: number }[];
    byDay: { date: string; count: number }[];
}

export interface AiTimeAuditResult {
    workTypeKey: 'chat_reply' | 'implementation' | 'support_fix' | 'dev_improvement';
    workTypeLabel: string;
    expectedHours: number;
    maxReasonableHours: number;
    reportedHours: number;
    differenceHours: number;
    status: 'missing_time' | 'fair' | 'inflated' | 'fast';
    verdictLabel: string;
    explanation: string;
}

export function computeTicketAiTimeBenchmark(
    title: string,
    description?: string | null,
    categoryName?: string | null,
    estimatedHours?: number | null,
    actualHours?: number | null
): AiTimeAuditResult {
    const text = `${title || ''} ${description || ''} ${categoryName || ''}`.toLowerCase();
    const rep = Number(actualHours || 0);
    const est = Number(estimatedHours || 0);

    let workTypeKey: AiTimeAuditResult['workTypeKey'] = 'support_fix';
    let workTypeLabel = '🛠️ Solución de Falla / Soporte Técnico';
    let expectedHours = 0.5;
    let maxReasonableHours = 1.0;

    if (
        /^pregunta\s+frecuente/i.test(title || '') ||
        /peguntas?\s+frecuentes/i.test(categoryName || '') ||
        /consulta|duda|responder|whatsapp/i.test(text)
    ) {
        workTypeKey = 'chat_reply';
        workTypeLabel = '💬 Responder Texto / Consulta de Cliente';
        expectedHours = 0.2; // ~12 min
        maxReasonableHours = 0.45; // max ~27 min
    } else if (
        /^(go\s*live|capacitaci[oó]n|implementaci[oó]n)/i.test(title || '') ||
        /go\s*live|capacitaci[oó]n|entrenamiento|implementaci[oó]n/i.test(text)
    ) {
        workTypeKey = 'implementation';
        workTypeLabel = '🚀 Implementación / Go-Live / Capacitación';
        expectedHours = 1.5;
        maxReasonableHours = 2.5;
    } else if (
        /p4\b|mejoras?\s+y\s+ajustes|homologaci[oó]n|redise[ñn]o|ui\/ux|estilado|nuevo\s+m[oó]dulo/i.test(text)
    ) {
        workTypeKey = 'dev_improvement';
        workTypeLabel = '⚙️ Desarrollo / Mejora de Sistema (P4)';
        expectedHours = est > 0 && est <= 3 ? est : 1.5;
        maxReasonableHours = Math.max(expectedHours * 1.4, 2.2);
    } else if (/p1\b|p2\b|error\s+reportado|hacienda|dte|firmador|invalidaci/i.test(text)) {
        workTypeKey = 'support_fix';
        workTypeLabel = '🛠️ Solución de Error / Falla Crítica (P1/P2)';
        expectedHours = 0.8;
        maxReasonableHours = 1.5;
    } else {
        workTypeKey = 'support_fix';
        workTypeLabel = '🛠️ Soporte Técnico a Cliente (P3)';
        expectedHours = 0.5;
        maxReasonableHours = 1.0;
    }

    const differenceHours = +(rep - expectedHours).toFixed(2);

    if (rep <= 0) {
        return {
            workTypeKey,
            workTypeLabel,
            expectedHours,
            maxReasonableHours,
            reportedHours: 0,
            differenceHours: -expectedHours,
            status: 'missing_time',
            verdictLabel: '❌ Sin Tiempo (0h)',
            explanation: `No se registró tiempo invertido. IA estima ~${expectedHours}h para este tipo de trabajo.`,
        };
    }

    if (rep > maxReasonableHours) {
        const extra = +(rep - expectedHours).toFixed(2);
        return {
            workTypeKey,
            workTypeLabel,
            expectedHours,
            maxReasonableHours,
            reportedHours: rep,
            differenceHours,
            status: 'inflated',
            verdictLabel: `🚨 Tiempo Inflado (+${extra}h vs IA)`,
            explanation: `Reportó ${rep}h pero el estándar IA para "${workTypeLabel}" es ${expectedHours}h (máx ${maxReasonableHours}h). Exceso de +${extra}h requiere justificación.`,
        };
    }

    if (rep <= expectedHours * 0.7) {
        return {
            workTypeKey,
            workTypeLabel,
            expectedHours,
            maxReasonableHours,
            reportedHours: rep,
            differenceHours,
            status: 'fast',
            verdictLabel: '⚡ Rápido / Eficiente',
            explanation: `Resuelto en ${rep}h (por debajo del promedio IA de ${expectedHours}h).`,
        };
    }

    return {
        workTypeKey,
        workTypeLabel,
        expectedHours,
        maxReasonableHours,
        reportedHours: rep,
        differenceHours,
        status: 'fair',
        verdictLabel: '✅ Tiempo Correcto',
        explanation: `Reportó ${rep}h, alineado con el estándar IA de ${expectedHours}h.`,
    };
}

export const ticketService = {

    // ─── Agents ─────────────────────────────────────────────────────────────
    // Uses existing profiles table filtered by company_id — no new tables
    async getAgents(companyId: string): Promise<CompanyAgent[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, avatar_url')
            .eq('company_id', companyId)
            .eq('status', 'active')
            .order('full_name');

        if (error) {
            console.warn('[tickets] getAgents error:', error.message);
            // Fallback: load without status filter in case status column differs
            const { data: fallback } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, avatar_url')
                .eq('company_id', companyId)
                .order('full_name');
            return (fallback || []) as CompanyAgent[];
        }
        return (data || []) as CompanyAgent[];
    },

    // ─── Leads (for ticket association) ─────────────────────────────────────
    async getLeads(companyId: string): Promise<TicketLead[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('id, name, email, phone, status, es_cliente, assigned_to')
            .eq('company_id', companyId)
            .order('updated_at', { ascending: false })
            .limit(5000);
        if (error) throw error;
        return (data || []) as TicketLead[];
    },

    // ─── Categories ─────────────────────────────────────────────────────────
    async getCategories(companyId: string): Promise<TicketCategory[]> {
        const { data, error } = await supabase
            .from('ticket_categories')
            .select('*')
            .eq('company_id', companyId)
            .order('name');
        if (error) throw error;
        return (data || []) as TicketCategory[];
    },

    async createCategory(companyId: string, cat: Omit<TicketCategory, 'id' | 'company_id'>): Promise<TicketCategory> {
        const { data, error } = await supabase
            .from('ticket_categories')
            .insert({ ...cat, company_id: companyId })
            .select().single();
        if (error) throw error;
        return data as TicketCategory;
    },

    async updateCategory(id: string, updates: Partial<Omit<TicketCategory, 'id' | 'company_id'>>): Promise<TicketCategory> {
        const { data, error } = await supabase
            .from('ticket_categories')
            .update(updates)
            .eq('id', id)
            .select().single();
        if (error) throw error;
        return data as TicketCategory;
    },

    async deleteCategory(id: string): Promise<void> {
        const { error } = await supabase
            .from('ticket_categories')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ─── Tickets ────────────────────────────────────────────────────────────
    async getTickets(
        companyId: string,
        filters?: {
            status?: TicketStatus[];
            categoryId?: string;
            assignedTo?: string;
            // WhatsApp chats of leads / unknown numbers / team / spam are conversations,
            // not support tickets. Only the Support Chat screen asks for them.
            includeNonSupportWhatsapp?: boolean;
        }
    ): Promise<Ticket[]> {
        // NOTE: We avoid PostgREST relationship join syntax (lead:leads, profiles!fkey)
        // because those require a registered FK in the schema cache which may be absent
        // in the testing environment. Instead we use the lead_name snapshot + separate queries.
        let query = supabase
            .from('tickets')
            .select('*')
            .eq('company_id', companyId);

        if (filters?.status && filters.status.length > 0) {
            query = query.in('status', filters.status);
        }
        if (filters?.categoryId) {
            query = query.eq('category_id', filters.categoryId);
        }
        if (filters?.assignedTo) {
            query = query.eq('assigned_to', filters.assignedTo);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        const rows = (data || []) as Record<string, unknown>[];
        const visible = filters?.includeNonSupportWhatsapp
            ? rows
            : rows.filter((t) => isSupportTicket(t as { metadata?: Record<string, unknown> | null }));

        // Build lead object from the lead_name snapshot (always available, no RLS issues)
        return visible.map((t: Record<string, unknown>) => ({
            ...t,
            lead: t.lead_name ? { name: t.lead_name as string, email: null } : undefined,
        })) as Ticket[];
    },

    async createTicket(
        ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'last_status_change_at' | 'resolved_at'>
    ): Promise<Ticket> {
        const { data, error } = await supabase
            .from('tickets')
            .insert(ticket)
            .select()
            .single();

        if (error) throw error;
        return data as Ticket;
    },

    async deleteTicket(ticketId: string): Promise<void> {
        const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
        if (error) throw error;
    },

    async updateTicket(
        ticketId: string,
        updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigned_to' | 'title' | 'description' | 'category_id' | 'due_date' | 'lead_id' | 'findings' | 'root_cause' | 'solution' | 'created_by' | 'resolved_at' | 'parent_ticket_id' | 'estimated_hours' | 'actual_hours' | 'checklist'>> & { metadata?: Record<string, unknown> }
    ): Promise<Ticket> {
        if (updates.status && ['resolved', 'closed'].includes(updates.status)) {
            let findingsVal = updates.findings;
            let rootCauseVal = updates.root_cause;
            let solutionVal = updates.solution;
            let actualHoursVal = updates.actual_hours;

            if (
                findingsVal === undefined ||
                rootCauseVal === undefined ||
                solutionVal === undefined ||
                actualHoursVal === undefined
            ) {
                const { data: current } = await supabase
                    .from('tickets')
                    .select('findings, root_cause, solution, actual_hours')
                    .eq('id', ticketId)
                    .maybeSingle();
                if (current) {
                    if (findingsVal === undefined) findingsVal = current.findings;
                    if (rootCauseVal === undefined) rootCauseVal = current.root_cause;
                    if (solutionVal === undefined) solutionVal = current.solution;
                    if (actualHoursVal === undefined) actualHoursVal = current.actual_hours;
                }
            }

            if (Number(actualHoursVal || 0) <= 0) {
                throw new Error(
                    '⚠️ Nadie puede cerrar un ticket sin registrar el Tiempo Real Invertido (horas > 0) en la pestaña "Resolución".'
                );
            }

            if (
                String(findingsVal || '').trim().length < 5 ||
                String(rootCauseVal || '').trim().length < 5 ||
                String(solutionVal || '').trim().length < 5
            ) {
                throw new Error(
                    '⚠️ Es obligatorio completar Hallazgos, Causa Raíz y Solución Aplicada en la pestaña "Resolución" antes de cerrar o resolver un ticket.'
                );
            }
        }

        const payload: Record<string, unknown> = {
            ...updates,
            updated_at: new Date().toISOString(),
        };

        if (updates.status) {
            payload.last_status_change_at = new Date().toISOString();
            // Only auto-set resolved_at if not explicitly provided
            if (!('resolved_at' in updates)) {
                const isResolved = ['resolved', 'closed'].includes(updates.status);
                payload.resolved_at = isResolved ? new Date().toISOString() : null;
            }
        }

        const { data, error } = await supabase
            .from('tickets')
            .update(payload)
            .eq('id', ticketId)
            .select('*')
            .single();

        if (error) {
            if (String(error.message || '').includes('uq_wa_open_ticket_per_chat')) {
                throw new Error(
                    'Este chat de WhatsApp ya tiene un ticket abierto. Ciérralo primero o continúa en el ticket abierto.'
                );
            }
            throw error;
        }
        const t = data as Record<string, unknown>;
        return {
            ...t,
            lead: t.lead_name ? { name: t.lead_name as string, email: null } : undefined,
        } as Ticket;
    },

    // ─── Comments (Seguimientos) ─────────────────────────────────────────────
    async getComments(ticketId: string): Promise<TicketComment[]> {
        const { data, error } = await supabase
            .from('ticket_comments')
            .select(`
                *,
                author:profiles!ticket_comments_author_id_fkey(id, full_name, avatar_url)
            `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return (data || []) as TicketComment[];
    },

    async addComment(
        ticketId: string,
        companyId: string,
        authorId: string,
        body: string,
        isInternal = false
    ): Promise<TicketComment> {
        const { data, error } = await supabase
            .from('ticket_comments')
            .insert({
                ticket_id: ticketId,
                company_id: companyId,
                author_id: authorId,
                body,
                is_internal: isInternal,
            })
            .select(`
                *,
                author:profiles!ticket_comments_author_id_fkey(id, full_name, avatar_url)
            `)
            .single();

        if (error) throw error;
        return data as TicketComment;
    },

    // ─── Stats ──────────────────────────────────────────────────────────────
    async getStats(companyId: string): Promise<TicketStats> {
        const { data, error } = await supabase
            .from('tickets')
            .select('status, priority, created_at, resolved_at, last_status_change_at, category_id, metadata')
            .eq('company_id', companyId);

        if (error) throw error;

        // Lead / unclassified WhatsApp chats are not support tickets.
        const all = (data || []).filter((t: { metadata?: Record<string, unknown> | null }) => isSupportTicket(t));
        const todayStr = new Date().toISOString().split('T')[0];

        // Avg resolution time
        const resolvedTickets = all.filter((t: Record<string, unknown>) => t.resolved_at);
        let avgResolutionTimeHours = 0;
        if (resolvedTickets.length > 0) {
            const totalMs = resolvedTickets.reduce((acc: number, t: Record<string, unknown>) => {
                const diff = new Date(t.resolved_at as string).getTime() - new Date(t.created_at as string).getTime();
                return acc + diff;
            }, 0);
            avgResolutionTimeHours = Math.round((totalMs / (1000 * 60 * 60)) / resolvedTickets.length * 10) / 10;
        }

        // Last 7 days
        const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });
        const byDayMap: Record<string, number> = {};
        last7.forEach(d => { byDayMap[d] = 0; });
        all.forEach((t: Record<string, unknown>) => {
            const day = (t.created_at as string).split('T')[0];
            if (byDayMap[day] !== undefined) byDayMap[day]++;
        });
        const byDay = last7.map(date => ({ date, count: byDayMap[date] }));

        // By status / priority
        const statusCounts: Record<string, number> = {};
        const priorityCounts: Record<string, number> = {};
        all.forEach((t: Record<string, unknown>) => {
            const s = t.status as string;
            const p = t.priority as string;
            statusCounts[s] = (statusCounts[s] || 0) + 1;
            priorityCounts[p] = (priorityCounts[p] || 0) + 1;
        });

        return {
            total: all.length,
            open: all.filter((t: Record<string, unknown>) => ['new', 'open'].includes(t.status as string)).length,
            pending: all.filter((t: Record<string, unknown>) => t.status === 'pending').length,
            resolved: all.filter((t: Record<string, unknown>) => t.status === 'resolved').length,
            closed: all.filter((t: Record<string, unknown>) => t.status === 'closed').length,
            urgent: all.filter((t: Record<string, unknown>) => t.priority === 'urgent').length,
            aging: 0, // computed client-side with category SLA data
            avgResolutionTimeHours,
            resolvedToday: all.filter((t: Record<string, unknown>) =>
                t.resolved_at && (t.resolved_at as string).startsWith(todayStr)
            ).length,
            createdToday: all.filter((t: Record<string, unknown>) =>
                (t.created_at as string).startsWith(todayStr)
            ).length,
            byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
            byPriority: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
            byDay,
        };
    }
};
