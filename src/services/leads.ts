import { supabase } from './supabase';
import type { Lead, FollowUp } from '../types';
import { logger } from '../utils/logger';
import { calculateLeadScore, persistLeadScore } from './leadScoringService';
import { safeSelect } from './safeQuery';

export const leadsService = {
    // Get leads with lightweight payload (optimized for List/Kanban views)
    // PROTECTED by safeSelect — if ANY column is missing, auto-fallback to SELECT *
    async getLeads(page = 1, pageSize = 1000) {
        const fields = 'id, name, company_name, email, phone, status, priority, value, assigned_to, created_at, source, next_followup_date, industry, document_path, internal_won_date, contact_count, closing_amount, address, lost_reason_id, lost_at_stage, lost_notes, next_action_notes';
        
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const result = await safeSelect<Lead>({
            table: 'leads',
            fields,
            count: true,
            orderBy: 'created_at',
            orderAsc: false,
            rangeFrom: from,
            rangeTo: to,
        });

        return { data: result.data, count: result.count };
    },

    // Cursor-based Pagination for ultra-fast performance on millions of rows
    // PROTECTED by safeSelect
    async getLeadsCursor(limit = 50, cursor?: string) {
        const fields = 'id, name, company_name, email, phone, status, priority, value, assigned_to, created_at, source, next_followup_date, industry, document_path, internal_won_date, contact_count, closing_amount, address, lost_reason_id, lost_at_stage, lost_notes, next_action_notes, last_follow_up_at, first_follow_up_at';

        const filters = cursor
            ? [{ column: 'created_at', op: 'lt' as const, value: cursor }]
            : undefined;

        const result = await safeSelect<Lead>({
            table: 'leads',
            fields,
            orderBy: 'created_at',
            orderAsc: false,
            limit,
            filters,
        });
            
        const nextCursor = result.data.length === limit ? result.data[result.data.length - 1].created_at : undefined;
            
        return { data: result.data, nextCursor };
    },

    // Global search leveraging pg_trgm indices (Cmd+K Omni-Search)
    async searchLeads(query: string, limit = 10) {
        if (!query || query.trim().length < 2) return [];
        
        const searchTerm = `%${query.trim()}%`;
        const fields = 'id, name, company_name, email, phone, status, priority, value';
        
        const { data, error } = await supabase
            .from('leads')
            .select(fields)
            .or(`name.ilike.${searchTerm},company_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
            .limit(limit);

        if (error) {
            logger.error('Error in searchLeads', error, { query });
            return [];
        }
        return data as Lead[];
    },

    // AI Analytics: Fast aggregation for Omni-Buscador insights
    async getLeadsAnalyticsSummary() {
        try {
            const now = new Date();
            const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            
            // Get all Won (Ganado/Cerrado) leads for the last two months
            // Using a single query to minimize latency
            const { data, error } = await supabase
                .from('leads')
                .select('id, created_at, status, value')
                .gte('created_at', firstDayLastMonth);

            if (error) throw error;

            const leads = data || [];
            
            // Note: Adjust the exact status name if 'Ganado' is different in your DB
            const wonStatuses = ['Ganado', 'Cerrado', 'Cerrado Ganado', 'Venta'];
            
            let wonThisMonth = 0;
            let valueThisMonth = 0;
            let wonLastMonth = 0;
            let valueLastMonth = 0;

            leads.forEach(lead => {
                const isWon = wonStatuses.some(s => lead.status?.toLowerCase().includes(s.toLowerCase()));
                if (!isWon) return;

                if (lead.created_at >= firstDayThisMonth) {
                    wonThisMonth++;
                    valueThisMonth += (lead.value || 0);
                } else {
                    wonLastMonth++;
                    valueLastMonth += (lead.value || 0);
                }
            });

            // Calculate growth
            const growthPercentage = wonLastMonth === 0 
                ? (wonThisMonth > 0 ? 100 : 0) 
                : Math.round(((wonThisMonth - wonLastMonth) / wonLastMonth) * 100);
                
            const valueGrowth = valueLastMonth === 0
                ? (valueThisMonth > 0 ? 100 : 0)
                : Math.round(((valueThisMonth - valueLastMonth) / valueLastMonth) * 100);

            let aiMessage = '';
            if (growthPercentage > 0) {
                aiMessage = `¡Excelente ritmo! Has cerrado **${wonThisMonth} leads** este mes, lo que representa un crecimiento del **${growthPercentage}%** respecto al mes pasado. La facturación proyectada es de **$${valueThisMonth.toLocaleString()}**. ¡Sigue así!`;
            } else if (growthPercentage < 0) {
                aiMessage = `Actualmente has cerrado **${wonThisMonth} leads** este mes, un **${Math.abs(growthPercentage)}% menos** que el mes pasado (${wonLastMonth} leads). Es un buen momento para reactivar seguimientos pendientes y acelerar el pipeline.`;
            } else {
                aiMessage = `Mantienes el mismo ritmo del mes pasado con **${wonThisMonth} leads** cerrados. Con un empuje final en los próximos días podrías superar tu meta histórica.`;
            }

            return {
                wonThisMonth,
                wonLastMonth,
                growthPercentage,
                valueThisMonth,
                valueGrowth,
                aiMessage,
                type: 'leads'
            };
        } catch (err) {
            logger.error('Error in getLeadsAnalyticsSummary', err);
            return null;
        }
    },

    // AI Analytics: Consultant for Follow-Ups
    async getFollowUpsAnalyticsSummary() {
        try {
            const now = new Date();
            // Start of today
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            // End of today
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
            // Start of week
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

            // 1. Get Overdue (pending and date < todayStart)
            const { count: overdueCount } = await supabase
                .from('follow_ups')
                .select('*', { count: 'exact', head: true })
                .eq('completed', false)
                .lt('date', todayStart);

            // 2. Get Pending Today (pending and date >= todayStart and date <= todayEnd)
            const { count: todayCount } = await supabase
                .from('follow_ups')
                .select('*', { count: 'exact', head: true })
                .eq('completed', false)
                .gte('date', todayStart)
                .lte('date', todayEnd);

            // 3. Get Completed This Week
            const { count: completedWeekCount } = await supabase
                .from('follow_ups')
                .select('*', { count: 'exact', head: true })
                .eq('completed', true)
                .gte('date', weekStart);

            const overdue = overdueCount || 0;
            const today = todayCount || 0;
            const completed = completedWeekCount || 0;

            let aiMessage = '';
            let aiColor = '';

            if (overdue > 10) {
                aiColor = 'red';
                aiMessage = `**¡Alerta Roja!** Tienes **${overdue} seguimientos vencidos**. Tu equipo de ventas está perdiendo el control del pipeline. Te recomiendo tener una reunión urgente y asignar estos leads o marcarlos como perdidos. ¡El dinero se enfría!`;
            } else if (overdue > 0) {
                aiColor = 'amber';
                aiMessage = `**Precaución**: Hay **${overdue} seguimientos atrasados**. Aún estás a tiempo de rescatarlos. Además, tienes **${today} tareas** para hoy. Encomienda al equipo a limpiar los vencidos antes del mediodía.`;
            } else if (today > 0) {
                aiColor = 'emerald';
                aiMessage = `**Excelente control del pipeline**. Cero seguimientos vencidos. Tienes **${today} tareas** programadas para hoy y tu equipo ha completado **${completed} seguimientos** esta semana. ¡El ritmo de contacto es perfecto!`;
            } else {
                aiColor = 'blue';
                aiMessage = `Tu agenda está completamente limpia. **No hay seguimientos vencidos ni pendientes para hoy**. (Se han completado ${completed} esta semana). Es un buen momento para que tu equipo haga prospección en frío o asigne nuevos leads.`;
            }

            return {
                overdue,
                today,
                completed,
                aiMessage,
                aiColor,
                type: 'followups'
            };
        } catch (err) {
            logger.error('Error in getFollowUpsAnalyticsSummary', err);
            return null;
        }
    },

    // Get full details for a specific lead (called when opening the panel)
    async getLeadById(id: string) {
        const { data, error } = await supabase
            .from('leads')
            .select(`
                *,
                cotizaciones ( id, numero, total, status, created_at )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Lead;
    },

    // Get lead statistics for Dashboard - Optimized selection
    async getLeadStats(startDate?: string, endDate?: string) {
        try {
            // First, get leads created in range
            let createdQuery = supabase.from('leads').select('id, value, created_at');
            if (startDate) createdQuery = createdQuery.gte('created_at', startDate);
            if (endDate) createdQuery = createdQuery.lte('created_at', endDate);

            const { data: createdLeads, error: createdError } = await createdQuery;
            if (createdError) throw createdError;

            // Second, get leads WON in range (using internal_won_date)
            let wonQuery = supabase.from('leads').select('id, status, value, closing_amount, internal_won_date')
                .or('status.eq.Cerrado,status.eq.Cliente');

            if (startDate) wonQuery = wonQuery.gte('internal_won_date', startDate);
            if (endDate) wonQuery = wonQuery.lte('internal_won_date', endDate);

            const { data: wonLeads, error: wonError } = await wonQuery;
            if (wonError) throw wonError;

            const totalLeads = createdLeads?.length || 0;
            const wonDealsCount = wonLeads?.length || 0;
            const totalWonAmount = wonLeads?.reduce((sum, l) => sum + (l.closing_amount || l.value || 0), 0) || 0;

            return {
                totalLeads,
                totalPipeline: createdLeads?.reduce((sum, l) => sum + (l.value || 0), 0) || 0,
                wonDeals: wonDealsCount,
                totalWonAmount,
                conversionRate: totalLeads > 0 ? Math.round((wonDealsCount / totalLeads) * 100) : 0,
            };
        } catch (err) {
            logger.error('Error in getLeadStats', err);
            throw err;
        }
    },

    // Get leads grouped by status for funnel chart
    async getLeadsByStatus(startDate?: string, endDate?: string) {
        let query = supabase
            .from('leads')
            .select('status, created_at');

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        const { data, error } = await query;

        if (error) throw error;

        const counts: Record<string, number> = {};
        data?.forEach(lead => {
            const status = lead.status || 'Prospecto';
            counts[status] = (counts[status] || 0) + 1;
        });

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },

    // Get leads grouped by source for pie chart
    async getLeadsBySource(startDate?: string, endDate?: string) {
        let query = supabase
            .from('leads')
            .select('source, created_at');

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        const { data, error } = await query;

        if (error) throw error;

        const counts: Record<string, number> = {};
        data?.forEach(lead => {
            const source = lead.source || 'Directo';
            counts[source] = (counts[source] || 0) + 1;
        });

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },

    // Get leads grouped by priority for charts
    async getLeadsByPriority(startDate?: string, endDate?: string) {
        let query = supabase
            .from('leads')
            .select('priority, created_at');

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        const { data, error } = await query;

        if (error) throw error;

        const counts: Record<string, number> = {};
        data?.forEach(lead => {
            const priority = lead.priority || 'medium';
            counts[priority] = (counts[priority] || 0) + 1;
        });

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },

    // Get top opportunities (highest value leads)
    async getTopOpportunities(limit = 5, startDate?: string, endDate?: string) {
        let query = supabase
            .from('leads')
            .select('id, name, company_name, status, value, created_at, source')
            .order('value', { ascending: false })
            .limit(limit);

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    // Create a new lead with self-healing profile
    async createLead(lead: Partial<Lead>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        // Self-healing for missing profile
        if (!profile) {
            let { data: company } = await supabase.from('companies').select('id').limit(1).single();

            if (!company) {
                const { data: newCompany, error: companyError } = await supabase
                    .from('companies')
                    .insert({ name: 'Mi Empresa CRM', license_status: 'active' })
                    .select('id')
                    .single();
                if (companyError) throw new Error(`Failed to create company: ${companyError.message}`);
                company = newCompany;
            }

            const { data: newProfile, error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    role: 'super_admin',
                    company_id: company?.id,
                    status: 'active'
                })
                .select('company_id')
                .single();

            if (profileError) throw new Error(`Failed to create profile: ${profileError.message} `);
            profile = newProfile;
        }

        if (!profile?.company_id) {
            throw new Error('Usuario sin empresa asignada.');
        }

        const { data, error } = await supabase
            .from('leads')
            .insert({
                ...lead,
                company_id: profile.company_id,
                assigned_to: lead.assigned_to || user.id, // Auto-assign to creator if not specified
                priority: lead.priority || 'medium',
                value: lead.value || 0
            })
            .select()
            .single();

        if (error) throw error;

        // Fire-and-forget: dispatch lead.created webhook to all configured endpoints
        // No await — never blocks the UI or throws on webhook failures
        supabase.functions.invoke('dispatch-webhooks', {
            body: {
                event_type: 'lead.created',
                company_id: profile.company_id,
                payload: { id: data.id, name: data.name, status: data.status, value: data.value }
            }
        }).catch(() => {/* webhook errors are silently ignored */});

        // AI Lead Scoring — fire-and-forget, never blocks UI
        const score = calculateLeadScore(data as Partial<Lead>);
        persistLeadScore(data.id, score.total).catch(() => {});

        return data as Lead;
    },


    // Import multiple leads with duplicate detection
    async importLeads(leads: Partial<Lead>[]) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();

            if (!profile?.company_id) {
                throw new Error('Usuario sin empresa asignada.');
            }

            // List of valid database columns for the leads table
            const VALID_COLUMNS = [
                'name', 'company_name', 'email', 'phone', 'source',
                'status', 'priority', 'value', 'closing_amount',
                'next_followup_date', 'next_followup_assignee', 'next_action_notes',
                'company_id', 'assigned_to', 'created_at', 'address'
            ];

            const leadsToInsert = leads.map(lead => {
                const cleanedLead: any = {
                    company_id: profile.company_id,
                    assigned_to: lead.assigned_to || user.id,
                    priority: lead.priority || 'medium',
                    status: lead.status || 'Prospecto',
                    value: lead.value || 0
                };

                // Only include fields that exist in the database and have a value
                Object.keys(lead).forEach(key => {
                    if (VALID_COLUMNS.includes(key) && (lead as any)[key] !== undefined) {
                        cleanedLead[key] = (lead as any)[key];
                    }
                });

                // Convert empty strings to null for email and phone
                if (cleanedLead.email === '') cleanedLead.email = null;
                if (cleanedLead.phone === '') cleanedLead.phone = null;

                return cleanedLead;
            });

            logger.debug('Attempting to import leads', { count: leadsToInsert.length });

            // Insert leads one by one to handle duplicates gracefully
            const results = {
                inserted: [] as Lead[],
                skipped: [] as Array<{ lead: any; reason: string }>,
                errors: [] as Array<{ lead: any; error: any }>
            };

            for (const lead of leadsToInsert) {
                try {
                    const { data, error } = await supabase
                        .from('leads')
                        .insert(lead)
                        .select()
                        .single();

                    if (error) {
                        // Check if it's a unique constraint violation (duplicate)
                        if (error.code === '23505') {
                            const isDuplicateEmail = error.message.includes('leads_company_email_unique');
                            const isDuplicatePhone = error.message.includes('leads_company_phone_unique');

                            let reason = 'Duplicate';
                            if (isDuplicateEmail && isDuplicatePhone) {
                                reason = `Duplicate email (${lead.email}) and phone (${lead.phone})`;
                            } else if (isDuplicateEmail) {
                                reason = `Duplicate email (${lead.email})`;
                            } else if (isDuplicatePhone) {
                                reason = `Duplicate phone (${lead.phone})`;
                            }

                            results.skipped.push({ lead, reason });
                            logger.warn('Skipped duplicate lead', { reason, lead: lead.name });
                        } else {
                            // Other database error
                            results.errors.push({ lead, error });
                            logger.error('Failed to insert lead', error, { lead: lead.name });
                        }
                    } else {
                        results.inserted.push(data);
                    }
                } catch (err) {
                    results.errors.push({ lead, error: err });
                    logger.error('Exception during lead insert', err, { lead: lead.name });
                }
            }

            logger.info('Import completed', {
                inserted: results.inserted.length,
                skipped: results.skipped.length,
                errors: results.errors.length
            });

            // Return full results object
            return results;
        } catch (error: any) {
            logger.error('Lead import service failed', error, { action: 'importLeads' });
            throw error;
        }
    },

    // Update an existing lead
    async updateLead(id: string, updates: Partial<Lead>) {
        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Dispatch lead.won webhook when a deal is closed
        const wonStatuses = ['Cerrado', 'Cliente', 'Ganado'];
        const isNowWon = updates.status && wonStatuses.some(s => updates.status!.toLowerCase().includes(s.toLowerCase()));
        if (isNowWon && data?.company_id) {
            supabase.functions.invoke('dispatch-webhooks', {
                body: {
                    event_type: 'lead.won',
                    company_id: data.company_id,
                    payload: { id: data.id, name: data.name, status: data.status, value: data.closing_amount || data.value }
                }
            }).catch(() => {});
        }

        // AI Lead Scoring — recalculate on every update
        const score = calculateLeadScore(data as Partial<Lead>);
        persistLeadScore(data.id, score.total).catch(() => {});

        return data as Lead;
    },

    // Delete a lead
    async deleteLead(id: string) {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Get follow-ups for a lead
    async getFollowUps(leadId: string) {
        const { data, error } = await supabase
            .from('follow_ups')
            .select('*')
            .eq('lead_id', leadId)
            .order('date', { ascending: false });

        if (error) throw error;
        return data as FollowUp[];
    },

    // Create a new follow-up (with assigned_to support)
    // Auto-marks previous follow-ups for the same lead as completed
    async createFollowUp(followUp: Partial<FollowUp>, assignedTo?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('follow_ups')
            .insert({
                ...followUp,
                user_id: user?.id,
                assigned_to: assignedTo || null,
                action_type: followUp.action_type || 'call'
            })
            .select('*')
            .single();

        if (error) throw error;

        // Auto-complete previous PAST follow-ups for this lead
        // Do not auto-complete FUTURE meetings/calls (e.g. scheduled for next week)
        if (followUp.lead_id) {
            const nowIso = new Date().toISOString();
            await supabase
                .from('follow_ups')
                .update({ 
                    completed: true, 
                    completed_at: nowIso,
                    completed_by: user?.id 
                })
                .eq('lead_id', followUp.lead_id)
                .eq('completed', false)
                .lte('date', nowIso)
                .neq('id', data.id);

            // Update lead with the new follow up date and assignee
            await supabase
                .from('leads')
                .update({
                    next_followup_date: followUp.date,
                    next_followup_assignee: assignedTo || null
                })
                .eq('id', followUp.lead_id);
        }

        return data as FollowUp;
    },

    // Get team members for assignee dropdown
    async getTeamMembers() {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user?.id)
            .single();

        if (!profile) return [];

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, full_name, avatar_url')
            .eq('company_id', profile.company_id);

        if (error) throw error;
        return data;
    },

    // Get follow-ups for Calendar view — windowed date range query
    // Uses idx_follow_ups_company_id_date index for fast lookup
    // Only loads events for the visible months (not all 1,100+ records)
    async getCalendarFollowUps(startDate?: string, endDate?: string, assignedTo?: string) {
        // Default: 1 month back + 2 months forward from today
        const defaultStart = new Date();
        defaultStart.setMonth(defaultStart.getMonth() - 1);
        defaultStart.setDate(1);

        const defaultEnd = new Date();
        defaultEnd.setMonth(defaultEnd.getMonth() + 2);
        defaultEnd.setDate(0); // Last day of month+1

        const from = startDate ?? defaultStart.toISOString();
        const to   = endDate   ?? defaultEnd.toISOString();

        let query = supabase
            .from('follow_ups')
            .select(`
                id, date, notes, action_type, assigned_to,
                completed, completed_at,
                lead:leads(id, name, company_name, phone, email, status),
                assigned_profile:assigned_to(id, full_name, avatar_url)
            `)
            .gte('date', from)
            .lte('date', to)
            .order('date', { ascending: false })
            .limit(5000);

        if (assignedTo) {
            query = query.eq('assigned_to', assignedTo);
        }

        const { data, error } = await query;

        if (error) throw error;
        return (data || []) as unknown as Array<{
            id: string;
            date: string;
            notes: string | null;
            action_type: string;
            assigned_to: string | null;
            completed: boolean;
            completed_at: string | null;
            lead: {
                id: string;
                name: string;
                company_name: string | null;
                phone: string | null;
                email: string | null;
                status: string;
            } | null;
            assigned_profile: {
                id: string;
                full_name: string | null;
                avatar_url: string | null;
            } | null;
        }>;
    },

    // Mark a follow-up as completed (quick action from Calendar)
    async markFollowUpCompleted(followUpId: string, completed: boolean) {
        const { data: { user } } = await supabase.auth.getUser();
        const updates: any = {
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: completed ? user?.id : null,
        };
        const { error } = await supabase
            .from('follow_ups')
            .update(updates)
            .eq('id', followUpId);
        if (error) throw error;
    },

    // Get chat messages for a lead
    async getLeadMessages(leadId: string) {
        // 1. Get conversations for this lead
        const { data: conversations } = await supabase
            .from('marketing_conversations')
            .select('id, channel')
            .eq('lead_id', leadId);

        if (!conversations || conversations.length === 0) return [];

        const conversationIds = conversations.map(c => c.id);

        // 2. Get messages
        const { data: messages, error } = await supabase
            .from('marketing_messages')
            .select('*')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Error fetching messages', error, { action: 'getLeadMessages', leadId });
            return [];
        }

        // Enrich with channel info
        return messages.map(msg => ({
            ...msg,
            channel: conversations.find(c => c.id === msg.conversation_id)?.channel || 'unknown'
        }));
    }
};

