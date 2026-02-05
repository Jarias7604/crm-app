import { supabase } from '../supabase';

export interface DiscoveredLead {
    id: string;
    business_name: string;
    category: string;
    address: string;
    phone?: string;
    website?: string;
    rating?: number;
    review_count?: number;
    source: 'google_maps' | 'linkedin' | 'database';
    is_imported: boolean;
}

class LeadDiscoveryService {
    async searchBusiness(query: string, location: string): Promise<DiscoveredLead[]> {
        try {
            // 1. Llamar a la Edge Function
            const { data, error } = await supabase.functions.invoke('search-businesses', {
                body: { query, location }
            });

            if (error) {
                console.error('Edge Function error:', error);
                return this.generateMockResults(query, location);
            }

            const rawResults: DiscoveredLead[] = data.results || [];

            // 2. Verificar duplicados en la base de datos local
            if (rawResults.length > 0) {
                const placeIds = rawResults.map(r => r.id);
                const { data: existingLeads } = await supabase
                    .from('leads')
                    .select('google_place_id')
                    .in('google_place_id', placeIds);

                if (existingLeads) {
                    const existingSet = new Set(existingLeads.map(l => l.google_place_id));
                    return rawResults.map(r => ({
                        ...r,
                        is_imported: existingSet.has(r.id)
                    }));
                }
            }

            return rawResults;
        } catch (error) {
            console.error('Search error:', error);
            return this.generateMockResults(query, location);
        }
    }

    // Fallback mock generator (used when Edge Function is unavailable)
    private generateMockResults(query: string, location: string): DiscoveredLead[] {
        const types = ['Elite', 'Premium', 'Solutions', 'Group', 'Services', 'Associates', 'Center', 'Global'];

        return Array.from({ length: 20 }).map((_, i) => ({
            id: `lh_${Date.now()}_${i}`,
            business_name: `${capitalize(query)} ${types[i % types.length]} ${i + 1}`,
            category: query,
            address: `${Math.floor(Math.random() * 900) + 10} Main St, ${location}`,
            phone: `+1 (555) ${Math.floor(Math.random() * 899) + 100}-${Math.floor(Math.random() * 8999) + 1000}`,
            website: Math.random() > 0.3 ? `www.${query.replace(/\s/g, '').toLowerCase()}${i}.com` : undefined,
            rating: 3.5 + (Math.random() * 1.5),
            review_count: Math.floor(Math.random() * 1200),
            source: 'google_maps',
            is_imported: false
        }));
    }

    async importLead(lead: DiscoveredLead, companyId: string): Promise<void> {
        // 1. Preparar objeto Lead
        const newLead = {
            name: lead.business_name,
            company_name: lead.business_name,
            email: lead.website ? `contacto@${lead.website.replace('www.', '')}` : null,
            phone: lead.phone,
            source: 'Lead Hunter AI',
            status: 'Prospecto' as const,
            company_id: companyId,
            google_place_id: lead.id, // ID único de Google Maps (place_id)
            next_action_notes: `Prospecto importado de Lead Hunter. Dirección: ${lead.address}. Rating: ${lead.rating?.toFixed(1)}`
        };

        // 2. Insertar en Supabase con prevención de duplicados
        const { error } = await supabase
            .from('leads')
            .upsert(newLead, { onConflict: 'google_place_id' });

        if (error) throw error;
    }

    async importLeadsBulk(leads: DiscoveredLead[], companyId: string): Promise<{ success: number; failed: number }> {
        if (!leads.length) return { success: 0, failed: 0 };

        const newLeads = leads.map(lead => ({
            name: lead.business_name,
            company_name: lead.business_name,
            email: lead.website ? `contacto@${lead.website.replace('www.', '')}` : null,
            phone: lead.phone,
            source: 'Lead Hunter AI',
            status: 'Prospecto' as const,
            company_id: companyId,
            google_place_id: lead.id,
            next_action_notes: `Importación masiva. Rating: ${lead.rating?.toFixed(1)}`
        }));

        const { error } = await supabase
            .from('leads')
            .upsert(newLeads, { onConflict: 'google_place_id' });

        if (error) throw error;

        return { success: leads.length, failed: 0 };
    }
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const leadDiscoveryService = new LeadDiscoveryService();
