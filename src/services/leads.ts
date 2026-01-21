import { supabase } from './supabase';
import type { Lead, FollowUp } from '../types';

export const leadsService = {
    // Get all leads for the company - Optimized for performance
    async getLeads(page = 1, pageSize = 50) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error loading leads:', error);
            throw error;
        }
        return { data, count };
    },

    // Get lead statistics for Dashboard - Optimized selection
    async getLeadStats(startDate?: string, endDate?: string) {
        let query = supabase
            .from('leads')
            .select('status, value, created_at');

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        const { data: leads, error } = await query;

        if (error) throw error;

        const totalLeads = leads?.length || 0;
        const wonDeals = leads?.filter(l => l.status?.includes('Cliente')).length || 0;

        return {
            totalLeads,
            totalPipeline: leads?.reduce((sum, l) => sum + (l.value || 0), 0) || 0,
            wonDeals,
            lostDeals: leads?.filter(l => l.status === 'Lead perdido').length || 0,
            conversionRate: totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0,
        };
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
            const status = lead.status || 'Nuevo lead';
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
            .select('id, name, company_name, status, value, created_at')
            .not('status', 'in', '("Lead perdido","Lead erróneo")')
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
                priority: lead.priority || 'medium',
                value: lead.value || 0
            })
            .select()
            .single();

        if (error) throw error;
        return data as Lead;
    },

    // Import multiple leads
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
                'company_id', 'assigned_to'
            ];

            const leadsToInsert = leads.map(lead => {
                const cleanedLead: any = {
                    company_id: profile.company_id,
                    priority: lead.priority || 'medium',
                    status: lead.status || 'Nuevo lead',
                    value: lead.value || 0
                };

                // Only include fields that exist in the database and have a value
                Object.keys(lead).forEach(key => {
                    if (VALID_COLUMNS.includes(key) && (lead as any)[key] !== undefined) {
                        cleanedLead[key] = (lead as any)[key];
                    }
                });

                return cleanedLead;
            });

            console.log(`Attempting to import ${leadsToInsert.length} leads...`);

            const { data, error } = await supabase
                .from('leads')
                .insert(leadsToInsert)
                .select();

            if (error) {
                console.error('Supabase insert error details:', error);
                throw error;
            }

            console.log('Successfully imported leads:', data?.length);
            return data as Lead[];
        } catch (error: any) {
            console.error('Lead import service failed:', error);
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
            .select('*, profiles(email)')
            .eq('lead_id', leadId)
            .order('date', { ascending: false });

        if (error) throw error;
        return data as FollowUp[];
    },

    // Create a new follow-up
    async createFollowUp(followUp: Partial<FollowUp>) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('follow_ups')
            .insert({
                ...followUp,
                user_id: user?.id,
                action_type: followUp.action_type || 'call'
            })
            .select('*, profiles(email)')
            .single();

        if (error) throw error;
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
            .select('id, email, role, full_name')
            .eq('company_id', profile.company_id);

        if (error) throw error;
        return data;
    }
};
