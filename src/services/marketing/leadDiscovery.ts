import { supabase } from '../supabase';

export interface DiscoveredLead {
    id: string;
    business_name: string;
    category: string;
    address: string;
    phone?: string;
    website?: string;
    email?: string;
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

    // Extract clean domain from website URL
    cleanDomain(website: string): string {
        try {
            let domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '');
            domain = domain.split('/')[0]; // Remove paths
            domain = domain.split('?')[0]; // Remove query strings
            return domain;
        } catch {
            return website;
        }
    }

    // Derive email from website domain (excluding social media)
    deriveEmail(website?: string): string | null {
        if (!website) return null;
        const excluded = ['facebook.com', 'google.com', 'yelp.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'youtube.com', 'linkedin.com', 'tripadvisor.com', 'maps.google'];
        if (excluded.some(d => website.toLowerCase().includes(d))) return null;
        const domain = this.cleanDomain(website);
        if (!domain || !domain.includes('.')) return null;
        return `info@${domain}`;
    }

    async importLead(lead: DiscoveredLead, companyId: string): Promise<void> {
        const newLead = {
            name: lead.business_name,
            company_name: lead.business_name,
            email: lead.email || null,
            phone: lead.phone || null,
            source: 'Lead Hunter AI',
            status: 'Prospecto' as const,
            company_id: companyId,
            google_place_id: lead.id,
            next_action_notes: `Prospecto de Lead Hunter. Dirección: ${lead.address}. Rating: ${lead.rating?.toFixed(1)}${lead.website ? `. Web: ${this.cleanDomain(lead.website)}` : ''}`
        };

        // 2. Insertar en Supabase con prevención de duplicados
        const { error } = await supabase
            .from('leads')
            .upsert(newLead, { onConflict: 'google_place_id' });

        if (error) throw error;
    }

    async importLeadsBulk(leads: DiscoveredLead[], companyId: string): Promise<{ success: number; failed: number }> {
        if (!leads.length) return { success: 0, failed: 0 };

        let success = 0;
        let failed = 0;

        for (const lead of leads) {
            try {
                const newLead = {
                    name: lead.business_name,
                    company_name: lead.business_name,
                    email: lead.email || null,
                    phone: lead.phone || null,
                    source: 'Lead Hunter AI',
                    status: 'Prospecto' as const,
                    company_id: companyId,
                    google_place_id: lead.id,
                    next_action_notes: `Importación masiva. Dirección: ${lead.address}. Rating: ${lead.rating?.toFixed(1)}${lead.website ? `. Web: ${this.cleanDomain(lead.website)}` : ''}`
                };

                const { error } = await supabase
                    .from('leads')
                    .upsert(newLead, { onConflict: 'google_place_id' });

                if (error) {
                    // If duplicate email/phone, skip silently
                    if (error.code === '23505') {
                        failed++;
                    } else {
                        console.error(`Error importing ${lead.business_name}:`, error);
                        failed++;
                    }
                } else {
                    success++;
                }
            } catch (err) {
                failed++;
            }
        }

        return { success, failed };
    }
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const leadDiscoveryService = new LeadDiscoveryService();
