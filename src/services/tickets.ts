import { supabase } from './supabase';

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

    // Joined data
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
            .select('id, name, email, phone')
            .eq('company_id', companyId)
            .order('name');
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
        filters?: { status?: TicketStatus[]; categoryId?: string; assignedTo?: string }
    ): Promise<Ticket[]> {
        let query = supabase
            .from('tickets')
            .select(`
                *,
                lead:leads(name, email),
                category:ticket_categories(*),
                assigned_profile:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)
            `)
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
        return (data || []) as Ticket[];
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
        updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigned_to' | 'title' | 'description' | 'category_id' | 'due_date' | 'lead_id'>>
    ): Promise<Ticket> {
        const payload: Record<string, unknown> = {
            ...updates,
            updated_at: new Date().toISOString(),
        };

        if (updates.status) {
            payload.last_status_change_at = new Date().toISOString();
            const isResolved = ['resolved', 'closed'].includes(updates.status);
            payload.resolved_at = isResolved ? new Date().toISOString() : null;
        }

        const { data, error } = await supabase
            .from('tickets')
            .update(payload)
            .eq('id', ticketId)
            .select(`
                *,
                lead:leads(name, email),
                category:ticket_categories(*),
                assigned_profile:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)
            `)
            .single();

        if (error) throw error;
        return data as Ticket;
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
            .select('status, priority, created_at, resolved_at, last_status_change_at, category_id')
            .eq('company_id', companyId);

        if (error) throw error;

        const all = data || [];
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
