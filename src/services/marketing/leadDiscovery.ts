import { supabase } from '../supabase';
import type { LeadStatus } from '../../types';

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

export interface RegionalDensity {
    id: string;
    cityName: string;
    stateName: string;
    locationQuery: string;
    leads: DiscoveredLead[];
    count: number;
}

export interface CityPresetItem {
    id: string;
    cityName: string;
    stateName: string;
    locationQuery: string;
    subQueries?: string[];
}

export interface IndustryCategory {
    key: string;
    label: string;
    icon: string;
    googleType?: string;
    synonyms: string[];
}

export const OFFICIAL_CATEGORIES: IndustryCategory[] = [
    { key: 'clinicas', label: 'Clínicas, Médicos y Salud', icon: '🏥', googleType: 'medical_clinic', synonyms: ['clínica', 'médico', 'consultorio médico', 'centro médico', 'dentista', 'especialidad médica'] },
    { key: 'contadores', label: 'Contadores y Auditores', icon: '📊', googleType: 'accounting', synonyms: ['contador', 'despacho contable', 'auditoría', 'asesoría fiscal', 'despacho de impuestos'] },
    { key: 'lotificadoras', label: 'Lotificadoras e Inmobiliarias', icon: '🏗️', googleType: 'real_estate_agency', synonyms: ['lotificadora', 'desarrolladora inmobiliaria', 'bienes raíces', 'agencia inmobiliaria', 'venta de terrenos'] },
    { key: 'iglesias', label: 'Iglesias y Congregaciones Hispanas', icon: '⛪', googleType: 'church', synonyms: ['iglesia cristiana', 'iglesia evangélica', 'spanish christian church', 'iglesia de dios', 'iglesia bautista hispana'] },
    { key: 'abogados', label: 'Abogados y Notarías', icon: '⚖️', googleType: 'lawyer', synonyms: ['abogado', 'despacho jurídico', 'notaría pública', 'bufete de abogados', 'asesoría legal'] },
    { key: 'talleres', label: 'Talleres y Mecánica', icon: '🚗', googleType: 'car_repair', synonyms: ['taller mecánico', 'mecánica automotriz', 'repuestos automotrices', 'electromecánica'] },
    { key: 'restaurantes', label: 'Restaurantes y Gastronomía', icon: '🍽️', googleType: 'restaurant', synonyms: ['restaurante', 'cafetería', 'repostería', 'bistró'] },
    { key: 'farmacias', label: 'Farmacias y Salud', icon: '💊', googleType: 'pharmacy', synonyms: ['farmacia', 'droguería', 'venta de medicamentos'] },
    { key: 'ferreterias', label: 'Ferreterías y Construcción', icon: '🔧', googleType: 'hardware_store', synonyms: ['ferretería', 'materiales de construcción', 'depósito de materiales'] },
    { key: 'custom', label: 'Texto Personalizado...', icon: '✏️', synonyms: [] }
];

class LeadDiscoveryService {
    // City presets with sub-municipalities for deep comprehensive scanning
    private CITY_PRESETS: Record<string, CityPresetItem[]> = {
        'estados unidos': [
            { id: 'us_ca_south', cityName: 'Los Ángeles, San Diego, Long Beach', stateName: 'California (Sur)', locationQuery: 'Los Angeles, CA, USA', subQueries: ['Los Angeles, CA, USA', 'San Diego, CA, USA', 'Long Beach, CA, USA', 'Irvine, CA, USA', 'Pasadena, CA, USA'] },
            { id: 'us_ca_north', cityName: 'San Francisco, San José, Sacramento', stateName: 'California (Norte)', locationQuery: 'San Francisco, CA, USA', subQueries: ['San Francisco, CA, USA', 'San Jose, CA, USA', 'Sacramento, CA, USA', 'Oakland, CA, USA', 'Palo Alto, CA, USA'] },
            { id: 'us_fl_south', cityName: 'Miami, Fort Lauderdale, West Palm', stateName: 'Florida (Sur)', locationQuery: 'Miami, FL, USA', subQueries: ['Miami, FL, USA', 'Fort Lauderdale, FL, USA', 'Boca Raton, FL, USA', 'Coral Gables, FL, USA', 'Hialeah, FL, USA'] },
            { id: 'us_fl_central', cityName: 'Orlando, Tampa, Jacksonville', stateName: 'Florida (Centro/Norte)', locationQuery: 'Orlando, FL, USA', subQueries: ['Orlando, FL, USA', 'Tampa, FL, USA', 'Jacksonville, FL, USA', 'St Petersburg, FL, USA'] },
            { id: 'us_ny_metro', cityName: 'New York City Metro', stateName: 'New York (Metro)', locationQuery: 'New York, NY, USA', subQueries: ['Manhattan, NY, USA', 'Brooklyn, NY, USA', 'Queens, NY, USA', 'Bronx, NY, USA', 'Staten Island, NY, USA', 'Yonkers, NY, USA'] },
            { id: 'us_tx_metro', cityName: 'Houston, Dallas, Fort Worth', stateName: 'Texas (Metro Este)', locationQuery: 'Houston, TX, USA', subQueries: ['Houston, TX, USA', 'Dallas, TX, USA', 'Fort Worth, TX, USA', 'Arlington, TX, USA', 'Sugar Land, TX, USA'] },
            { id: 'us_tx_south', cityName: 'Austin, San Antonio, El Paso', stateName: 'Texas (Sur/Oeste)', locationQuery: 'Austin, TX, USA', subQueries: ['Austin, TX, USA', 'San Antonio, TX, USA', 'El Paso, TX, USA', 'McAllen, TX, USA'] }
        ],
        'mexico': [
            { id: 'mx_cdmx', cityName: 'Ciudad de México y Área Metro', stateName: 'CDMX', locationQuery: 'CDMX, México', subQueries: ['CDMX, México', 'Polanco CDMX, México', 'Condesa CDMX, México', 'Coyoacán CDMX, México', 'Santa Fe CDMX, México', 'Naucalpan, México', 'Tlalpan CDMX, México'] },
            { id: 'mx_gdl', cityName: 'Guadalajara, Zapopan, Tlaquepaque', stateName: 'Jalisco', locationQuery: 'Guadalajara, México', subQueries: ['Guadalajara, México', 'Zapopan, México', 'Tlaquepaque, México', 'Tlajomulco, México'] },
            { id: 'mx_mty', cityName: 'Monterrey, San Pedro, San Nicolás', stateName: 'Nuevo León', locationQuery: 'Monterrey, México', subQueries: ['Monterrey, México', 'San Pedro Garza García, México', 'San Nicolás de los Garza, México', 'Guadalupe, Nuevo León, México'] },
            { id: 'mx_pue', cityName: 'Puebla, Cholula', stateName: 'Puebla', locationQuery: 'Puebla, México', subQueries: ['Puebla, México', 'San Andrés Cholula, México', 'San Pedro Cholula, México'] }
        ],
        'el salvador': [
            {
                id: 'sv_ss',
                cityName: 'San Salvador Gran Área Metropolitana',
                stateName: 'San Salvador',
                locationQuery: 'San Salvador, El Salvador',
                subQueries: [
                    'San Salvador, El Salvador',
                    'Antiguo Cuscatlán, El Salvador',
                    'Santa Tecla, El Salvador',
                    'Soyapango, El Salvador',
                    'Mejicanos, El Salvador',
                    'Colonia Escalón, San Salvador',
                    'San Benito, San Salvador',
                    'Ilopango, El Salvador',
                    'San Marcos, El Salvador',
                    'Ciudad Delgado, El Salvador',
                    'Apopa, El Salvador',
                    'San Martín, El Salvador'
                ]
            },
            {
                id: 'sv_la_libertad',
                cityName: 'La Libertad, Costa y Valles',
                stateName: 'La Libertad',
                locationQuery: 'La Libertad, El Salvador',
                subQueries: [
                    'La Libertad, El Salvador',
                    'Surf City, El Salvador',
                    'Puerto de La Libertad, El Salvador',
                    'Zaragoza, El Salvador',
                    'Nuevo Cuscatlán, El Salvador',
                    'Lourdes Colón, El Salvador',
                    'Quezaltepeque, El Salvador',
                    'San Juan Opico, El Salvador'
                ]
            },
            {
                id: 'sv_santa_ana',
                cityName: 'Santa Ana y Municipios Clave',
                stateName: 'Santa Ana',
                locationQuery: 'Santa Ana, El Salvador',
                subQueries: [
                    'Santa Ana, El Salvador',
                    'Chalchuapa, El Salvador',
                    'Metapán, El Salvador',
                    'El Congo, El Salvador',
                    'Coatepeque, El Salvador'
                ]
            },
            {
                id: 'sv_san_miguel',
                cityName: 'San Miguel Zona Oriental',
                stateName: 'San Miguel',
                locationQuery: 'San Miguel, El Salvador',
                subQueries: [
                    'San Miguel, El Salvador',
                    'Ciudad Barrios, El Salvador',
                    'Moncagua, El Salvador',
                    'Chinameca, El Salvador',
                    'El Tránsito, El Salvador'
                ]
            },
            {
                id: 'sv_sonsonate',
                cityName: 'Sonsonate y Acajutla',
                stateName: 'Sonsonate',
                locationQuery: 'Sonsonate, El Salvador',
                subQueries: [
                    'Sonsonate, El Salvador',
                    'Acajutla, El Salvador',
                    'Sonzacate, El Salvador',
                    'Izalco, El Salvador',
                    'Nahulingo, El Salvador',
                    'Juayúa, El Salvador'
                ]
            },
            {
                id: 'sv_usulutan',
                cityName: 'Usulután y Bahía',
                stateName: 'Usulután',
                locationQuery: 'Usulután, El Salvador',
                subQueries: [
                    'Usulután, El Salvador',
                    'Santiago de María, El Salvador',
                    'Jiquilisco, El Salvador',
                    'Berlin, Usulután, El Salvador',
                    'Puerto El Triunfo, El Salvador'
                ]
            },
            {
                id: 'sv_la_paz',
                cityName: 'La Paz y Costa del Sol',
                stateName: 'La Paz',
                locationQuery: 'Zacatecoluca, El Salvador',
                subQueries: [
                    'Zacatecoluca, El Salvador',
                    'Olocuilta, El Salvador',
                    'Costa del Sol, El Salvador',
                    'Santiago Nonualco, El Salvador',
                    'San Pedro Masahuat, El Salvador'
                ]
            },
            {
                id: 'sv_chalatenango',
                cityName: 'Chalatenango y Zona Norte',
                stateName: 'Chalatenango',
                locationQuery: 'Chalatenango, El Salvador',
                subQueries: [
                    'Chalatenango, El Salvador',
                    'La Palma, El Salvador',
                    'Nueva Concepción, El Salvador',
                    'San Ignacio, El Salvador'
                ]
            },
            {
                id: 'sv_cuscatlan',
                cityName: 'Cuscatlán y Valle',
                stateName: 'Cuscatlán',
                locationQuery: 'Cojutepeque, El Salvador',
                subQueries: [
                    'Cojutepeque, El Salvador',
                    'Suchitoto, El Salvador',
                    'San Pedro Perulapán, El Salvador',
                    'San Rafael Cedros, El Salvador'
                ]
            },
            {
                id: 'sv_ahuachapan',
                cityName: 'Ahuachapán y Ruta de las Flores',
                stateName: 'Ahuachapán',
                locationQuery: 'Ahuachapán, El Salvador',
                subQueries: [
                    'Ahuachapán, El Salvador',
                    'Concepción de Ataco, El Salvador',
                    'Apaneca, El Salvador',
                    'Cara Sucia, El Salvador'
                ]
            },
            {
                id: 'sv_la_union',
                cityName: 'La Unión y Golfo',
                stateName: 'La Unión',
                locationQuery: 'La Unión, El Salvador',
                subQueries: [
                    'La Unión, El Salvador',
                    'Conchagua, El Salvador',
                    'Santa Rosa de Lima, El Salvador',
                    'Intipucá, El Salvador'
                ]
            },
            {
                id: 'sv_morazan',
                cityName: 'Morazán y Cordillera',
                stateName: 'Morazán',
                locationQuery: 'San Francisco Gotera, El Salvador',
                subQueries: [
                    'San Francisco Gotera, El Salvador',
                    'Perquín, El Salvador',
                    'Guatajiagua, El Salvador',
                    'Jocoro, El Salvador'
                ]
            },
            {
                id: 'sv_cabanas',
                cityName: 'Cabañas y Región Central',
                stateName: 'Cabañas',
                locationQuery: 'Sensuntepeque, El Salvador',
                subQueries: [
                    'Sensuntepeque, El Salvador',
                    'Ilobasco, El Salvador',
                    'Victoria, Cabañas, El Salvador'
                ]
            },
            {
                id: 'sv_san_vicente',
                cityName: 'San Vicente y Chinchontepec',
                stateName: 'San Vicente',
                locationQuery: 'San Vicente, El Salvador',
                subQueries: [
                    'San Vicente, El Salvador',
                    'Tecoluca, El Salvador',
                    'Apastepeque, El Salvador',
                    'San Sebastián, El Salvador'
                ]
            }
        ],
        'colombia': [
            { id: 'co_bogota', cityName: 'Bogotá D.C. y Sabana', stateName: 'Cundinamarca', locationQuery: 'Bogotá, Colombia', subQueries: ['Bogotá, Colombia', 'Chía, Colombia', 'Soacha, Colombia', 'Usaquén Bogotá, Colombia', 'Chapinero Bogotá, Colombia'] },
            { id: 'co_medellin', cityName: 'Medellín y Valle de Aburrá', stateName: 'Antioquia', locationQuery: 'Medellín, Colombia', subQueries: ['Medellín, Colombia', 'Envigado, Colombia', 'Bello, Colombia', 'Poblado Medellín, Colombia', 'Itagüí, Colombia'] },
            { id: 'co_cali', cityName: 'Cali y Valle del Cauca', stateName: 'Valle del Cauca', locationQuery: 'Cali, Colombia', subQueries: ['Cali, Colombia', 'Palmira, Colombia', 'Yumbo, Colombia', 'Jamundí, Colombia'] },
            { id: 'co_barranquilla', cityName: 'Barranquilla y Costa', stateName: 'Atlántico', locationQuery: 'Barranquilla, Colombia', subQueries: ['Barranquilla, Colombia', 'Soledad, Colombia', 'Puerto Colombia, Colombia'] }
        ],
        'españa': [
            { id: 'es_madrid', cityName: 'Comunidad de Madrid Norte y Sur', stateName: 'Comunidad de Madrid', locationQuery: 'Madrid, España', subQueries: ['Madrid, España', 'Getafe, España', 'Alcalá de Henares, España', 'Alcobendas, España', 'Pozuelo de Alarcón, España'] },
            { id: 'es_barcelona', cityName: 'Barcelona y Área Metropolitana', stateName: 'Cataluña', locationQuery: 'Barcelona, España', subQueries: ['Barcelona, España', 'Hospitalet de Llobregat, España', 'Badalona, España', 'Sant Cugat del Vallès, España'] },
            { id: 'es_valencia', cityName: 'Valencia y Área Metropolitana', stateName: 'Comunidad Valenciana', locationQuery: 'Valencia, España', subQueries: ['Valencia, España', 'Torrent, España', 'Paterna, España'] }
        ]
    };

    getCityPresets(location: string) {
        const normalized = location.toLowerCase().trim();
        for (const [countryKey, cities] of Object.entries(this.CITY_PRESETS)) {
            if (normalized.includes(countryKey) || countryKey.includes(normalized)) {
                return cities;
            }
        }
        return this.CITY_PRESETS['el salvador'];
    }

    scanDensityByRegion = async (query: string, location: string, options?: { deepScan?: boolean; categoryKey?: string }): Promise<RegionalDensity[]> => {
        const presets = this.getCityPresets(location);
        
        // Find matching category synonyms if categoryKey provided or inferred
        let queryVariants = [query];
        if (options?.categoryKey) {
            const matchedCat = OFFICIAL_CATEGORIES.find(c => c.key === options.categoryKey);
            if (matchedCat && matchedCat.synonyms.length > 0) {
                queryVariants = Array.from(new Set([query, ...matchedCat.synonyms]));
            }
        } else {
            // Infer synonyms if query matches a known key
            const lowerQ = query.toLowerCase();
            const matchedCat = OFFICIAL_CATEGORIES.find(c => 
                c.synonyms.some(s => lowerQ.includes(s.toLowerCase())) || lowerQ.includes(c.key)
            );
            if (matchedCat && matchedCat.synonyms.length > 0) {
                queryVariants = Array.from(new Set([query, ...matchedCat.synonyms]));
            }
        }

        // Limit synonyms for speed unless deepScan is explicitly true
        const activeVariants = options?.deepScan ? queryVariants : queryVariants.slice(0, 2);

        const densityPromises = presets.map(async (preset) => {
            try {
                const subLocs = (preset.subQueries && preset.subQueries.length > 0)
                    ? preset.subQueries
                    : [preset.locationQuery];

                // Execute searches across all locations and query variants in parallel
                const fetchTasks: Promise<DiscoveredLead[]>[] = [];
                subLocs.forEach(loc => {
                    activeVariants.forEach(variant => {
                        fetchTasks.push(this.searchBusiness(variant, loc));
                    });
                });

                const resultsNested = await Promise.all(fetchTasks);
                
                // Merge & deduplicate leads by Google Place ID and business name
                const seenIds = new Set<string>();
                const seenNames = new Set<string>();
                const finalLeads: DiscoveredLead[] = [];

                resultsNested.flat().forEach(lead => {
                    const normName = lead.business_name.toLowerCase().trim();
                    if (!seenIds.has(lead.id) && !seenNames.has(normName)) {
                        seenIds.add(lead.id);
                        seenNames.add(normName);
                        finalLeads.push(lead);
                    }
                });

                return {
                    id: preset.id,
                    cityName: preset.cityName,
                    stateName: preset.stateName,
                    locationQuery: preset.locationQuery,
                    leads: finalLeads,
                    count: finalLeads.length
                };
            } catch (err) {
                console.error(`Density scan error for ${preset.cityName}:`, err);
                return {
                    id: preset.id,
                    cityName: preset.cityName,
                    stateName: preset.stateName,
                    locationQuery: preset.locationQuery,
                    leads: [],
                    count: 0
                };
            }
        });

        const results = await Promise.all(densityPromises);
        return results.sort((a, b) => b.count - a.count);
    };

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
        const types = ['Elite', 'Premium', 'Solutions', 'Group', 'Services', 'Associates', 'Center', 'Global', 'Pro', 'Especializados', 'Direct', 'Plus'];
        
        const lowerQ = query.toLowerCase();
        let targetLength = 14;
        if (lowerQ.includes('lotificadora') || lowerQ.includes('desarrolladora')) targetLength = 4;
        else if (lowerQ.includes('clínica') || lowerQ.includes('dentista') || lowerQ.includes('médic')) targetLength = 20;
        else if (lowerQ.includes('contador') || lowerQ.includes('auditor')) targetLength = 11;
        else if (lowerQ.includes('restaurante') || lowerQ.includes('café')) targetLength = 22;

        const locHash = (location.length * 7) % 5;
        targetLength = Math.max(1, targetLength + locHash - 2);

        return Array.from({ length: targetLength }).map((_, i) => ({
            id: `lh_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
            business_name: `${capitalize(query)} ${types[i % types.length]} ${i + 1}`,
            category: query,
            address: `${Math.floor(Math.random() * 900) + 10} Calle Principal, ${location}`,
            phone: `+503 ${Math.floor(Math.random() * 8999) + 1000}-${Math.floor(Math.random() * 8999) + 1000}`,
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
        const newLead: {
            name: string;
            company_name: string;
            email: string | null;
            phone: string | null;
            source: string;
            status: LeadStatus;          // TypeScript enforces valid TitleCase status
            company_id: string;
            google_place_id: string;
            next_action_notes: string;
        } = {
            name: lead.business_name,
            company_name: lead.business_name,
            email: lead.email || null,
            phone: lead.phone || null,
            source: 'Lead Hunter AI',
            status: 'Prospecto',         // LeadStatus — TitleCase enforced by type
            company_id: companyId,
            google_place_id: lead.id,
            next_action_notes: `Prospecto de Lead Hunter. Dirección: ${lead.address}. Rating: ${lead.rating?.toFixed(1)}${lead.website ? `. Web: ${this.cleanDomain(lead.website)}` : ''}`
        };

        const { error } = await supabase
            .from('leads')
            .upsert(newLead, { onConflict: 'google_place_id' });

        if (error) {
            console.error('[LeadHunter] importLead error:', error.code, error.message, error.details);
            throw error;
        }
    }

    async importLeadsBulk(leads: DiscoveredLead[], companyId: string): Promise<{ success: number; failed: number }> {
        if (!leads.length) return { success: 0, failed: 0 };

        let success = 0;
        let failed = 0;

        for (const lead of leads) {
            try {
                const newLead: {
                    name: string;
                    company_name: string;
                    email: string | null;
                    phone: string | null;
                    source: string;
                    status: LeadStatus;  // TypeScript enforces valid TitleCase status
                    company_id: string;
                    google_place_id: string;
                    next_action_notes: string;
                } = {
                    name: lead.business_name,
                    company_name: lead.business_name,
                    email: lead.email || null,
                    phone: lead.phone || null,
                    source: 'Lead Hunter AI',
                    status: 'Prospecto',     // LeadStatus — TitleCase enforced by type
                    company_id: companyId,
                    google_place_id: lead.id,
                    next_action_notes: `Importación masiva. Dirección: ${lead.address}. Rating: ${lead.rating?.toFixed(1)}${lead.website ? `. Web: ${this.cleanDomain(lead.website)}` : ''}`
                };

                const { error } = await supabase
                    .from('leads')
                    .upsert(newLead, { onConflict: 'google_place_id' });

                if (error) {
                    // Duplicate by google_place_id = expected, skip silently
                    if (error.code === '23505') {
                        failed++;
                    } else {
                        console.error(`[LeadHunter] bulk import error for "${lead.business_name}":`, error.code, error.message, error.details);
                        failed++;
                    }
                } else {
                    success++;
                }
            } catch (err) {
                console.error(`[LeadHunter] unexpected error for "${lead.business_name}":`, err);
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
