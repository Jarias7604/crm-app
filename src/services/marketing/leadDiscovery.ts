import { supabase } from '../../supabase';
import type { Lead } from '../../types';

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
    // Simula una búsqueda en tiempo real (Google Maps API Proxy)
    async searchBusiness(query: string, location: string): Promise<DiscoveredLead[]> {
        // En producción, esto llamaría a tu API Backend (Node/Python) que usa Google Places API
        // Por ahora, simulamos resultados realistas para la DEMO

        await new Promise(resolve => setTimeout(resolve, 1500)); // Fake latency

        const keywords = query.toLowerCase();
        const city = location;

        // Generar datos mock basados en la búsqueda
        return Array.from({ length: 8 }).map((_, i) => ({
            id: `temp_${Date.now()}_${i}`,
            business_name: `${capitalize(query)} ${['Elite', 'Premium', 'Solutions', 'Group', 'Services'][i % 5]}`,
            category: query,
            address: `${Math.floor(Math.random() * 900) + 10} Main St, ${city}`,
            phone: `+1 (555) ${Math.floor(Math.random() * 899) + 100}-${Math.floor(Math.random() * 8999) + 1000}`,
            website: `www.${query.replace(/\s/g, '')}${i}.com`,
            rating: 4 + (Math.random()),
            review_count: Math.floor(Math.random() * 500),
            source: 'google_maps',
            is_imported: false
        }));
    }

    async importLead(lead: DiscoveredLead, companyId: string): Promise<void> {
        // 1. Preparar objeto Lead
        const newLead = {
            first_name: lead.business_name, // Usamos nombre de negocio como nombre por ahora
            last_name: '(Business)',
            email: `contact@${lead.website?.replace('www.', '') || 'unknown.com'}`,
            phone: lead.phone,
            company: lead.business_name,
            source: 'Lead Hunter AI',
            status: 'new', // Estado inicial
            company_id: companyId,
            custom_fields: {
                address: lead.address,
                discovered_category: lead.category,
                discovered_rating: lead.rating
            }
        };

        // 2. Insertar en Supabase
        const { error } = await supabase
            .from('leads')
            .insert(newLead);

        if (error) throw error;

        // 3. (Opcional) Guardar en historial de búsquedas de marketing
    }
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const leadDiscoveryService = new LeadDiscoveryService();
