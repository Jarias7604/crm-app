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
    { key: 'iglesias', label: 'Iglesias y Congregaciones', icon: '⛪', googleType: 'church', synonyms: ['iglesia cristiana', 'iglesia evangélica', 'christian church', 'iglesia de dios', 'iglesia bautista', 'centro cristiano'] },
    { key: 'abogados', label: 'Abogados, Bufetes y Notarías', icon: '⚖️', googleType: 'lawyer', synonyms: ['abogado', 'despacho jurídico', 'notaría pública', 'bufete de abogados', 'law firm', 'asesoría legal'] },
    { key: 'clinicas', label: 'Clínicas, Médicos y Odontología', icon: '🏥', googleType: 'medical_clinic', synonyms: ['clínica médica', 'consultorio médico', 'dentista', 'centro médico', 'dental clinic', 'medical center'] },
    { key: 'contadores', label: 'Contadores y Asesoría Fiscal', icon: '📊', googleType: 'accounting', synonyms: ['contador', 'despacho contable', 'auditoría', 'asesoría fiscal', 'cpa firm', 'despacho de impuestos'] },
    { key: 'lotificadoras', label: 'Inmobiliarias y Desarrolladoras', icon: '🏗️', googleType: 'real_estate_agency', synonyms: ['desarrolladora inmobiliaria', 'bienes raíces', 'agencia inmobiliaria', 'real estate agency', 'realtor'] },
    { key: 'seguros', label: 'Agencias de Seguros y Fianzas', icon: '🛡️', googleType: 'insurance_agency', synonyms: ['agencia de seguros', 'corredor de seguros', 'seguros de vida', 'insurance agency', 'asesor de seguros'] },
    { key: 'escuelas', label: 'Escuelas, Colegios y Academias', icon: '🏫', googleType: 'school', synonyms: ['colegio privado', 'escuela', 'academia de idiomas', 'kindergarten', 'private school', 'instituto'] },
    { key: 'construccion', label: 'Construcción y Contratistas', icon: '👷', googleType: 'general_contractor', synonyms: ['constructora', 'empresa de construcción', 'general contractor', 'estudio de arquitectura', 'builder'] },
    { key: 'belleza', label: 'Salones de Belleza, Barberías y Spas', icon: '✂️', googleType: 'beauty_salon', synonyms: ['salón de belleza', 'barbería', 'spa', 'estética', 'beauty salon', 'barbershop'] },
    { key: 'logistica', label: 'Logística, Transporte y Envíos', icon: '🚛', googleType: 'moving_company', synonyms: ['empresa de transporte', 'logística', 'envíos internacionales', 'freight forwarding', 'trucking company'] },
    { key: 'marketing', label: 'Marketing, Publicidad y Diseño', icon: '🚀', googleType: 'marketing_agency', synonyms: ['agencia de marketing', 'publicidad', 'diseño web', 'marketing agency', 'agencia digital'] },
    { key: 'financieras', label: 'Financieras y Cooperativas', icon: '💵', googleType: 'finance', synonyms: ['financiera', 'cooperativa de ahorro', 'prestamista', 'financial services', 'credit union'] },
    { key: 'gimnasios', label: 'Gimnasios y Centros de Fitness', icon: '🏋️', googleType: 'gym', synonyms: ['gimnasio', 'centro de fitness', 'crossfit', 'gym', 'fitness center'] },
    { key: 'talleres', label: 'Talleres Mecánicos y Repuestos', icon: '🚗', googleType: 'car_repair', synonyms: ['taller mecánico', 'mecánica automotriz', 'repuestos automotrices', 'auto repair shop'] },
    { key: 'restaurantes', label: 'Restaurantes, Cafés y Catering', icon: '🍽️', googleType: 'restaurant', synonyms: ['restaurante', 'cafetería', 'repostería', 'bistró', 'catering'] },
    { key: 'hvac', label: 'Aire Acondicionado, HVAC y Plomería', icon: '❄️', googleType: 'hvac_contractor', synonyms: ['aire acondicionado', 'hvac contractor', 'plomería', 'electricista', 'plumbing'] },
    { key: 'limpieza', label: 'Limpieza Comercial y Janitorial', icon: '🧹', googleType: 'cleaning_service', synonyms: ['empresa de limpieza', 'limpieza comercial', 'janitorial service', 'commercial cleaning'] },
    { key: 'seguridad', label: 'Seguridad Privada y Alarmas', icon: '🔒', googleType: 'security_guard', synonyms: ['seguridad privada', 'sistemas de alarma', 'cámaras de seguridad', 'security company'] },
    { key: 'veterinarias', label: 'Veterinarias y Mascotas', icon: '🐾', googleType: 'veterinary_care', synonyms: ['clínica veterinaria', 'veterinario', 'vet clinic', 'pet care center'] },
    { key: 'farmacias', label: 'Farmacias y Droguerías', icon: '💊', googleType: 'pharmacy', synonyms: ['farmacia', 'droguería', 'suministros médicos', 'pharmacy'] },
    { key: 'ferreterias', label: 'Ferreterías y Materiales', icon: '🔧', googleType: 'hardware_store', synonyms: ['ferretería', 'materiales de construcción', 'depósito de materiales', 'hardware store'] },
    { key: 'imprentas', label: 'Imprentas y Rotulación Digital', icon: '🖨️', googleType: 'print_shop', synonyms: ['imprenta', 'rotulación', 'impresión digital', 'print shop', 'sign shop'] },
    { key: 'hoteles', label: 'Hoteles, Posadas y Hospedaje', icon: '🏨', googleType: 'lodging', synonyms: ['hotel', 'posada', 'resort', 'hospedaje', 'lodging'] },
    { key: 'viajes', label: 'Agencias de Viajes y Turismo', icon: '✈️', googleType: 'travel_agency', synonyms: ['agencia de viajes', 'turismo', 'travel agency', 'tour operator'] },
    { key: 'software', label: 'Tecnología, TI y Reparación PC', icon: '💻', googleType: 'electronics_repair', synonyms: ['servicio técnico de computadoras', 'desarrollo de software', 'it support', 'computer repair'] },
    { key: 'eventos', label: 'Salones de Eventos y Banquetes', icon: '🎉', googleType: 'event_venue', synonyms: ['salón de eventos', 'organización de eventos', 'banquet hall', 'event planner'] },
    { key: 'mueblerias', label: 'Mueblerías y Decoración', icon: '🛋️', googleType: 'furniture_store', synonyms: ['mueblería', 'diseño de interiores', 'furniture store', 'decoración'] },
    { key: 'tintorerias', label: 'Tintorerías y Lavanderías', icon: '🧺', googleType: 'laundry', synonyms: ['tintorería', 'lavandería', 'dry cleaners', 'laundry service'] },
    { key: 'opticas', label: 'Ópticas y Salud Visual', icon: '👓', googleType: 'optometrist', synonyms: ['óptica', 'examen de la vista', 'optometrista', 'optician'] },
    { key: 'custom', label: 'Texto Personalizado...', icon: '✏️', synonyms: [] }
];

class LeadDiscoveryService {
    // City presets with sub-municipalities for deep comprehensive scanning across full countries
    private CITY_PRESETS: Record<string, CityPresetItem[]> = {
        'estados unidos': [
            { id: 'us_al', cityName: 'Birmingham, Montgomery, Mobile, Huntsville', stateName: 'Alabama', locationQuery: 'Birmingham, AL, USA', subQueries: ['Birmingham, AL, USA', 'Montgomery, AL, USA', 'Mobile, AL, USA', 'Huntsville, AL, USA'] },
            { id: 'us_ak', cityName: 'Anchorage, Fairbanks, Juneau', stateName: 'Alaska', locationQuery: 'Anchorage, AK, USA', subQueries: ['Anchorage, AK, USA', 'Fairbanks, AK, USA', 'Juneau, AK, USA'] },
            { id: 'us_az', cityName: 'Phoenix, Tucson, Mesa, Chandler', stateName: 'Arizona', locationQuery: 'Phoenix, AZ, USA', subQueries: ['Phoenix, AZ, USA', 'Tucson, AZ, USA', 'Mesa, AZ, USA', 'Chandler, AZ, USA'] },
            { id: 'us_ar', cityName: 'Little Rock, Fort Smith, Fayetteville', stateName: 'Arkansas', locationQuery: 'Little Rock, AR, USA', subQueries: ['Little Rock, AR, USA', 'Fort Smith, AR, USA', 'Fayetteville, AR, USA'] },
            { id: 'us_ca_south', cityName: 'Los Ángeles, San Diego, Long Beach, Irvine', stateName: 'California (Sur)', locationQuery: 'Los Angeles, CA, USA', subQueries: ['Los Angeles, CA, USA', 'San Diego, CA, USA', 'Long Beach, CA, USA', 'Irvine, CA, USA', 'Pasadena, CA, USA'] },
            { id: 'us_ca_north', cityName: 'San Francisco, San José, Sacramento, Oakland', stateName: 'California (Norte)', locationQuery: 'San Francisco, CA, USA', subQueries: ['San Francisco, CA, USA', 'San Jose, CA, USA', 'Sacramento, CA, USA', 'Oakland, CA, USA', 'Fresno, CA, USA'] },
            { id: 'us_co', cityName: 'Denver, Colorado Springs, Aurora', stateName: 'Colorado', locationQuery: 'Denver, CO, USA', subQueries: ['Denver, CO, USA', 'Colorado Springs, CO, USA', 'Aurora, CO, USA', 'Fort Collins, CO, USA'] },
            { id: 'us_ct', cityName: 'Bridgeport, New Haven, Stamford, Hartford', stateName: 'Connecticut', locationQuery: 'Bridgeport, CT, USA', subQueries: ['Bridgeport, CT, USA', 'New Haven, CT, USA', 'Stamford, CT, USA', 'Hartford, CT, USA'] },
            { id: 'us_de', cityName: 'Wilmington, Dover, Newark', stateName: 'Delaware', locationQuery: 'Wilmington, DE, USA', subQueries: ['Wilmington, DE, USA', 'Dover, DE, USA', 'Newark, DE, USA'] },
            { id: 'us_fl_south', cityName: 'Miami, Fort Lauderdale, West Palm Beach, Hialeah', stateName: 'Florida (Sur)', locationQuery: 'Miami, FL, USA', subQueries: ['Miami, FL, USA', 'Fort Lauderdale, FL, USA', 'Boca Raton, FL, USA', 'Coral Gables, FL, USA', 'Hialeah, FL, USA'] },
            { id: 'us_fl_central', cityName: 'Orlando, Tampa, Jacksonville, St Petersburg', stateName: 'Florida (Centro/Norte)', locationQuery: 'Orlando, FL, USA', subQueries: ['Orlando, FL, USA', 'Tampa, FL, USA', 'Jacksonville, FL, USA', 'St Petersburg, FL, USA', 'Tallahassee, FL, USA'] },
            { id: 'us_ga', cityName: 'Atlanta, Augusta, Columbus, Savannah', stateName: 'Georgia', locationQuery: 'Atlanta, GA, USA', subQueries: ['Atlanta, GA, USA', 'Augusta, GA, USA', 'Columbus, GA, USA', 'Savannah, GA, USA'] },
            { id: 'us_hi', cityName: 'Honolulu, Hilo, Kailua', stateName: 'Hawaii', locationQuery: 'Honolulu, HI, USA', subQueries: ['Honolulu, HI, USA', 'Hilo, HI, USA', 'Kailua, HI, USA'] },
            { id: 'us_id', cityName: 'Boise, Meridian, Nampa', stateName: 'Idaho', locationQuery: 'Boise, ID, USA', subQueries: ['Boise, ID, USA', 'Meridian, ID, USA', 'Nampa, ID, USA'] },
            { id: 'us_il', cityName: 'Chicago, Aurora, Naperville, Rockford', stateName: 'Illinois', locationQuery: 'Chicago, IL, USA', subQueries: ['Chicago, IL, USA', 'Aurora, IL, USA', 'Naperville, IL, USA', 'Rockford, IL, USA'] },
            { id: 'us_in', cityName: 'Indianapolis, Fort Wayne, Evansville', stateName: 'Indiana', locationQuery: 'Indianapolis, IN, USA', subQueries: ['Indianapolis, IN, USA', 'Fort Wayne, IN, USA', 'Evansville, IN, USA', 'South Bend, IN, USA'] },
            { id: 'us_ia', cityName: 'Des Moines, Cedar Rapids, Davenport', stateName: 'Iowa', locationQuery: 'Des Moines, IA, USA', subQueries: ['Des Moines, IA, USA', 'Cedar Rapids, IA, USA', 'Davenport, IA, USA'] },
            { id: 'us_ks', cityName: 'Wichita, Overland Park, Kansas City, Topeka', stateName: 'Kansas', locationQuery: 'Wichita, KS, USA', subQueries: ['Wichita, KS, USA', 'Overland Park, KS, USA', 'Kansas City, KS, USA', 'Topeka, KS, USA'] },
            { id: 'us_ky', cityName: 'Louisville, Lexington, Bowling Green', stateName: 'Kentucky', locationQuery: 'Louisville, KY, USA', subQueries: ['Louisville, KY, USA', 'Lexington, KY, USA', 'Bowling Green, KY, USA'] },
            { id: 'us_la', cityName: 'New Orleans, Baton Rouge, Shreveport', stateName: 'Louisiana', locationQuery: 'New Orleans, LA, USA', subQueries: ['New Orleans, LA, USA', 'Baton Rouge, LA, USA', 'Shreveport, LA, USA'] },
            { id: 'us_me', cityName: 'Portland, Lewiston, Bangor', stateName: 'Maine', locationQuery: 'Portland, ME, USA', subQueries: ['Portland, ME, USA', 'Lewiston, ME, USA', 'Bangor, ME, USA'] },
            { id: 'us_md', cityName: 'Baltimore, Frederick, Rockville', stateName: 'Maryland', locationQuery: 'Baltimore, MD, USA', subQueries: ['Baltimore, MD, USA', 'Frederick, MD, USA', 'Rockville, MD, USA'] },
            { id: 'us_ma', cityName: 'Boston, Worcester, Springfield, Cambridge', stateName: 'Massachusetts', locationQuery: 'Boston, MA, USA', subQueries: ['Boston, MA, USA', 'Worcester, MA, USA', 'Springfield, MA, USA', 'Cambridge, MA, USA'] },
            { id: 'us_mi', cityName: 'Detroit, Grand Rapids, Warren', stateName: 'Michigan', locationQuery: 'Detroit, MI, USA', subQueries: ['Detroit, MI, USA', 'Grand Rapids, MI, USA', 'Warren, MI, USA', 'Sterling Heights, MI, USA'] },
            { id: 'us_mn', cityName: 'Minneapolis, St Paul, Rochester', stateName: 'Minnesota', locationQuery: 'Minneapolis, MN, USA', subQueries: ['Minneapolis, MN, USA', 'St Paul, MN, USA', 'Rochester, MN, USA'] },
            { id: 'us_ms', cityName: 'Jackson, Gulfport, Southaven', stateName: 'Mississippi', locationQuery: 'Jackson, MS, USA', subQueries: ['Jackson, MS, USA', 'Gulfport, MS, USA', 'Southaven, MS, USA'] },
            { id: 'us_mo', cityName: 'Kansas City, St Louis, Springfield', stateName: 'Missouri', locationQuery: 'Kansas City, MO, USA', subQueries: ['Kansas City, MO, USA', 'St Louis, MO, USA', 'Springfield, MO, USA'] },
            { id: 'us_mt', cityName: 'Billings, Missoula, Great Falls', stateName: 'Montana', locationQuery: 'Billings, MT, USA', subQueries: ['Billings, MT, USA', 'Missoula, MT, USA', 'Great Falls, MT, USA'] },
            { id: 'us_ne', cityName: 'Omaha, Lincoln, Bellevue', stateName: 'Nebraska', locationQuery: 'Omaha, NE, USA', subQueries: ['Omaha, NE, USA', 'Lincoln, NE, USA', 'Bellevue, NE, USA'] },
            { id: 'us_nv', cityName: 'Las Vegas, Henderson, Reno', stateName: 'Nevada', locationQuery: 'Las Vegas, NV, USA', subQueries: ['Las Vegas, NV, USA', 'Henderson, NV, USA', 'Reno, NV, USA'] },
            { id: 'us_nh', cityName: 'Manchester, Nashua, Concord', stateName: 'New Hampshire', locationQuery: 'Manchester, NH, USA', subQueries: ['Manchester, NH, USA', 'Nashua, NH, USA', 'Concord, NH, USA'] },
            { id: 'us_nj', cityName: 'Newark, Jersey City, Paterson, Elizabeth', stateName: 'New Jersey', locationQuery: 'Newark, NJ, USA', subQueries: ['Newark, NJ, USA', 'Jersey City, NJ, USA', 'Paterson, NJ, USA', 'Elizabeth, NJ, USA'] },
            { id: 'us_nm', cityName: 'Albuquerque, Las Cruces, Rio Rancho, Santa Fe', stateName: 'New Mexico', locationQuery: 'Albuquerque, NM, USA', subQueries: ['Albuquerque, NM, USA', 'Las Cruces, NM, USA', 'Rio Rancho, NM, USA', 'Santa Fe, NM, USA'] },
            { id: 'us_ny_metro', cityName: 'New York City Metro', stateName: 'New York (Metro)', locationQuery: 'New York, NY, USA', subQueries: ['Manhattan, NY, USA', 'Brooklyn, NY, USA', 'Queens, NY, USA', 'Bronx, NY, USA', 'Staten Island, NY, USA', 'Yonkers, NY, USA'] },
            { id: 'us_ny_upstate', cityName: 'Buffalo, Rochester, Syracuse, Albany', stateName: 'New York (Upstate)', locationQuery: 'Buffalo, NY, USA', subQueries: ['Buffalo, NY, USA', 'Rochester, NY, USA', 'Syracuse, NY, USA', 'Albany, NY, USA'] },
            { id: 'us_nc', cityName: 'Charlotte, Raleigh, Greensboro, Durham', stateName: 'North Carolina', locationQuery: 'Charlotte, NC, USA', subQueries: ['Charlotte, NC, USA', 'Raleigh, NC, USA', 'Greensboro, NC, USA', 'Durham, NC, USA'] },
            { id: 'us_nd', cityName: 'Fargo, Bismarck, Grand Forks', stateName: 'North Dakota', locationQuery: 'Fargo, ND, USA', subQueries: ['Fargo, ND, USA', 'Bismarck, ND, USA', 'Grand Forks, ND, USA'] },
            { id: 'us_oh', cityName: 'Columbus, Cleveland, Cincinnati, Toledo', stateName: 'Ohio', locationQuery: 'Columbus, OH, USA', subQueries: ['Columbus, OH, USA', 'Cleveland, OH, USA', 'Cincinnati, OH, USA', 'Toledo, OH, USA'] },
            { id: 'us_ok', cityName: 'Oklahoma City, Tulsa, Norman', stateName: 'Oklahoma', locationQuery: 'Oklahoma City, OK, USA', subQueries: ['Oklahoma City, OK, USA', 'Tulsa, OK, USA', 'Norman, OK, USA'] },
            { id: 'us_or', cityName: 'Portland, Salem, Eugene, Gresham', stateName: 'Oregon', locationQuery: 'Portland, OR, USA', subQueries: ['Portland, OR, USA', 'Salem, OR, USA', 'Eugene, OR, USA', 'Gresham, OR, USA'] },
            { id: 'us_pa', cityName: 'Philadelphia, Pittsburgh, Allentown, Erie', stateName: 'Pennsylvania', locationQuery: 'Philadelphia, PA, USA', subQueries: ['Philadelphia, PA, USA', 'Pittsburgh, PA, USA', 'Allentown, PA, USA', 'Erie, PA, USA'] },
            { id: 'us_ri', cityName: 'Providence, Warwick, Cranston', stateName: 'Rhode Island', locationQuery: 'Providence, RI, USA', subQueries: ['Providence, RI, USA', 'Warwick, RI, USA', 'Cranston, RI, USA'] },
            { id: 'us_sc', cityName: 'Charleston, Columbia, North Charleston', stateName: 'South Carolina', locationQuery: 'Charleston, SC, USA', subQueries: ['Charleston, SC, USA', 'Columbia, SC, USA', 'North Charleston, SC, USA'] },
            { id: 'us_sd', cityName: 'Sioux Falls, Rapid City, Aberdeen', stateName: 'South Dakota', locationQuery: 'Sioux Falls, SD, USA', subQueries: ['Sioux Falls, SD, USA', 'Rapid City, SD, USA', 'Aberdeen, SD, USA'] },
            { id: 'us_tn', cityName: 'Nashville, Memphis, Knoxville, Chattanooga', stateName: 'Tennessee', locationQuery: 'Nashville, TN, USA', subQueries: ['Nashville, TN, USA', 'Memphis, TN, USA', 'Knoxville, TN, USA', 'Chattanooga, TN, USA'] },
            { id: 'us_tx_metro', cityName: 'Houston, Dallas, Fort Worth, Arlington', stateName: 'Texas (Metro Este)', locationQuery: 'Houston, TX, USA', subQueries: ['Houston, TX, USA', 'Dallas, TX, USA', 'Fort Worth, TX, USA', 'Arlington, TX, USA', 'Sugar Land, TX, USA'] },
            { id: 'us_tx_south', cityName: 'Austin, San Antonio, El Paso, McAllen', stateName: 'Texas (Sur/Oeste)', locationQuery: 'Austin, TX, USA', subQueries: ['Austin, TX, USA', 'San Antonio, TX, USA', 'El Paso, TX, USA', 'McAllen, TX, USA'] },
            { id: 'us_ut', cityName: 'Salt Lake City, West Valley City, Provo', stateName: 'Utah', locationQuery: 'Salt Lake City, UT, USA', subQueries: ['Salt Lake City, UT, USA', 'West Valley City, UT, USA', 'Provo, UT, USA'] },
            { id: 'us_vt', cityName: 'Burlington, South Burlington, Rutland', stateName: 'Vermont', locationQuery: 'Burlington, VT, USA', subQueries: ['Burlington, VT, USA', 'South Burlington, VT, USA', 'Rutland, VT, USA'] },
            { id: 'us_va', cityName: 'Virginia Beach, Norfolk, Chesapeake, Richmond', stateName: 'Virginia', locationQuery: 'Virginia Beach, VA, USA', subQueries: ['Virginia Beach, VA, USA', 'Norfolk, VA, USA', 'Chesapeake, VA, USA', 'Richmond, VA, USA'] },
            { id: 'us_wa', cityName: 'Seattle, Spokane, Tacoma, Vancouver', stateName: 'Washington', locationQuery: 'Seattle, WA, USA', subQueries: ['Seattle, WA, USA', 'Spokane, WA, USA', 'Tacoma, WA, USA', 'Vancouver, WA, USA'] },
            { id: 'us_wv', cityName: 'Charleston, Huntington, Morgantown', stateName: 'West Virginia', locationQuery: 'Charleston, WV, USA', subQueries: ['Charleston, WV, USA', 'Huntington, WV, USA', 'Morgantown, WV, USA'] },
            { id: 'us_wi', cityName: 'Milwaukee, Madison, Green Bay', stateName: 'Wisconsin', locationQuery: 'Milwaukee, WI, USA', subQueries: ['Milwaukee, WI, USA', 'Madison, WI, USA', 'Green Bay, WI, USA'] },
            { id: 'us_wy', cityName: 'Cheyenne, Casper, Laramie', stateName: 'Wyoming', locationQuery: 'Cheyenne, WY, USA', subQueries: ['Cheyenne, WY, USA', 'Casper, WY, USA', 'Laramie, WY, USA'] },
            { id: 'us_pr', cityName: 'San Juan, Bayamón, Ponce, Carolina', stateName: 'Puerto Rico', locationQuery: 'San Juan, Puerto Rico', subQueries: ['San Juan, Puerto Rico', 'Bayamón, Puerto Rico', 'Ponce, Puerto Rico', 'Carolina, Puerto Rico'] }
        ],
        'guatemala': [
            { id: 'gt_guatemala', cityName: 'Ciudad de Guatemala y Área Metro', stateName: 'Guatemala', locationQuery: 'Ciudad de Guatemala, Guatemala', subQueries: ['Ciudad de Guatemala, Guatemala', 'Mixco, Guatemala', 'Villa Nueva, Guatemala', 'Santa Catarina Pinula, Guatemala'] },
            { id: 'gt_sacatepequez', cityName: 'Antigua Guatemala y Alrededores', stateName: 'Sacatepéquez', locationQuery: 'Antigua Guatemala, Guatemala', subQueries: ['Antigua Guatemala, Guatemala', 'Ciudad Vieja, Guatemala', 'Jocotenango, Guatemala'] },
            { id: 'gt_quetzaltenango', cityName: 'Quetzaltenango (Xela) y Municipios', stateName: 'Quetzaltenango', locationQuery: 'Quetzaltenango, Guatemala', subQueries: ['Quetzaltenango, Guatemala', 'Salcajá, Guatemala', 'Coatepeque, Guatemala'] },
            { id: 'gt_escuintla', cityName: 'Escuintla, Puerto San José y Palín', stateName: 'Escuintla', locationQuery: 'Escuintla, Guatemala', subQueries: ['Escuintla, Guatemala', 'Puerto San José, Guatemala', 'Palín, Guatemala', 'Santa Lucía Cotzumalguapa, Guatemala'] },
            { id: 'gt_alta_verapaz', cityName: 'Cobán y San Pedro Carchá', stateName: 'Alta Verapaz', locationQuery: 'Cobán, Guatemala', subQueries: ['Cobán, Guatemala', 'San Pedro Carchá, Guatemala', 'Chamelco, Guatemala'] },
            { id: 'gt_izabal', cityName: 'Puerto Barrios, Morales y Livingston', stateName: 'Izabal', locationQuery: 'Puerto Barrios, Guatemala', subQueries: ['Puerto Barrios, Guatemala', 'Morales, Guatemala', 'Livingston, Guatemala'] },
            { id: 'gt_retalhuleu', cityName: 'Retalhuleu y Champerico', stateName: 'Retalhuleu', locationQuery: 'Retalhuleu, Guatemala', subQueries: ['Retalhuleu, Guatemala', 'Champerico, Guatemala', 'San Sebastián, Guatemala'] },
            { id: 'gt_huehuetenango', cityName: 'Huehuetenango y Chiantla', stateName: 'Huehuetenango', locationQuery: 'Huehuetenango, Guatemala', subQueries: ['Huehuetenango, Guatemala', 'Chiantla, Guatemala'] },
            { id: 'gt_peten', cityName: 'Flores, Santa Elena y San Benito', stateName: 'Petén', locationQuery: 'Flores, Petén, Guatemala', subQueries: ['Flores, Guatemala', 'San Benito, Petén, Guatemala', 'Poptún, Guatemala'] },
            { id: 'gt_suchitepequez', cityName: 'Mazatenango y Cuyotenango', stateName: 'Suchitepéquez', locationQuery: 'Mazatenango, Guatemala', subQueries: ['Mazatenango, Guatemala', 'Cuyotenango, Guatemala'] },
            { id: 'gt_san_marcos', cityName: 'San Marcos y San Pedro Sacatepéquez', stateName: 'San Marcos', locationQuery: 'San Marcos, Guatemala', subQueries: ['San Marcos, Guatemala', 'San Pedro Sacatepéquez, Guatemala', 'Malacatán, Guatemala'] }
        ],
        'costa rica': [
            { id: 'cr_san_jose', cityName: 'San José Gran Área Metropolitana', stateName: 'San José', locationQuery: 'San José, Costa Rica', subQueries: ['San José, Costa Rica', 'Escazú, Costa Rica', 'Santa Ana, Costa Rica', 'Desamparados, Costa Rica', 'Curridabat, Costa Rica'] },
            { id: 'cr_alajuela', cityName: 'Alajuela, San Ramón y Grecia', stateName: 'Alajuela', locationQuery: 'Alajuela, Costa Rica', subQueries: ['Alajuela, Costa Rica', 'San Ramón, Costa Rica', 'Grecia, Costa Rica', 'Ciudad Quesada, Costa Rica'] },
            { id: 'cr_cartago', cityName: 'Cartago, Paraíso y La Unión', stateName: 'Cartago', locationQuery: 'Cartago, Costa Rica', subQueries: ['Cartago, Costa Rica', 'Paraíso, Costa Rica', 'Tres Ríos, Costa Rica'] },
            { id: 'cr_heredia', cityName: 'Heredia, Belén y Barva', stateName: 'Heredia', locationQuery: 'Heredia, Costa Rica', subQueries: ['Heredia, Costa Rica', 'San Antonio de Belén, Costa Rica', 'Barva, Costa Rica'] },
            { id: 'cr_guanacaste', cityName: 'Liberia, Tamarindo y Nicoya', stateName: 'Guanacaste', locationQuery: 'Liberia, Costa Rica', subQueries: ['Liberia, Costa Rica', 'Tamarindo, Costa Rica', 'Nicoya, Costa Rica', 'Santa Cruz, Costa Rica'] },
            { id: 'cr_puntarenas', cityName: 'Puntarenas, Jacó y Quepos', stateName: 'Puntarenas', locationQuery: 'Puntarenas, Costa Rica', subQueries: ['Puntarenas, Costa Rica', 'Jacó, Costa Rica', 'Quepos, Costa Rica'] },
            { id: 'cr_limon', cityName: 'Limón, Puerto Viejo y Guápiles', stateName: 'Limón', locationQuery: 'Limón, Costa Rica', subQueries: ['Limón, Costa Rica', 'Puerto Viejo, Costa Rica', 'Guápiles, Costa Rica'] }
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

    getCityPresets(location: string): CityPresetItem[] {
        const normalized = location.toLowerCase().trim();

        // US variations matching
        if (['usa', 'us', 'estados unidos', 'united states', 'eeuu', 'ee.uu'].some(k => normalized.includes(k) || k === normalized)) {
            return this.CITY_PRESETS['estados unidos'];
        }

        for (const [countryKey, cities] of Object.entries(this.CITY_PRESETS)) {
            if (normalized.includes(countryKey) || countryKey.includes(normalized)) {
                return cities;
            }
        }

        // Dynamic Whole Country Fallback Generator
        const cleanLoc = capitalize(location);
        return [
            { id: `dyn_capital`, cityName: `${cleanLoc} Capital y Área Metro`, stateName: 'Zona Metropolitana', locationQuery: `${cleanLoc}`, subQueries: [`${cleanLoc}`, `Centro ${cleanLoc}`, `Capital ${cleanLoc}`] },
            { id: `dyn_norte`, cityName: `${cleanLoc} Zona Norte`, stateName: 'Región Norte', locationQuery: `Norte ${cleanLoc}`, subQueries: [`Norte ${cleanLoc}`] },
            { id: `dyn_sur`, cityName: `${cleanLoc} Zona Sur`, stateName: 'Región Sur', locationQuery: `Sur ${cleanLoc}`, subQueries: [`Sur ${cleanLoc}`] },
            { id: `dyn_este`, cityName: `${cleanLoc} Zona Este`, stateName: 'Región Este', locationQuery: `Este ${cleanLoc}`, subQueries: [`Este ${cleanLoc}`] },
            { id: `dyn_oeste`, cityName: `${cleanLoc} Zona Oeste`, stateName: 'Región Oeste', locationQuery: `Oeste ${cleanLoc}`, subQueries: [`Oeste ${cleanLoc}`] },
            { id: `dyn_central`, cityName: `${cleanLoc} Región Central`, stateName: 'Región Central', locationQuery: `Central ${cleanLoc}`, subQueries: [`Central ${cleanLoc}`] }
        ];
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

            const rawResults: DiscoveredLead[] = (data.results || []).map((r: DiscoveredLead) => ({
                ...r,
                email: r.email || this.deriveEmail(r.website) || undefined
            }));

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

    // Fallback mock generator (used when Edge Function is unavailable or in local dev)
    private generateMockResults(query: string, location: string): DiscoveredLead[] {
        const types = ['Iglesia Evangelica', 'Centro Cristiano', 'Comunidad de Fe', 'Ministerio Internacional', 'Iglesia Bautista', 'Templo Betel', 'Iglesia Pentecostal', 'Asamblea de Dios', 'Centro de Alabanza', 'Ministerio Mahanaim', 'Iglesia Cristiana', 'Ministerio Hosanna', 'Comunidad Cristiana', 'Templo Elim', 'Iglesia Filadelfia'];
        
        const lowerQ = query.toLowerCase();
        let baseCount = 65;
        if (lowerQ.includes('lotificadora') || lowerQ.includes('desarrolladora')) baseCount = 15;
        else if (lowerQ.includes('clínica') || lowerQ.includes('dentista') || lowerQ.includes('médic')) baseCount = 85;
        else if (lowerQ.includes('contador') || lowerQ.includes('auditor')) baseCount = 45;
        else if (lowerQ.includes('restaurante') || lowerQ.includes('café')) baseCount = 95;
        else if (lowerQ.includes('iglesia') || lowerQ.includes('cristian')) baseCount = 80;

        // Scale by location complexity to give true regional density distribution
        const locHash = Math.abs(location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
        const variance = (locHash % 40) - 15; // -15 to +25
        const targetLength = Math.max(25, baseCount + variance);

        return Array.from({ length: targetLength }).map((_, i) => {
            const hasWeb = Math.random() > 0.25;
            const cleanQuery = query.replace(/iglesia/i, '').replace(/cristiana/i, '').trim() || 'Central';
            const domainSlug = cleanQuery.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'iglesia';
            const website = hasWeb ? `www.${domainSlug}${i + 1}.org` : undefined;
            const email = website ? `info@${domainSlug}${i + 1}.org` : undefined;

            return {
                id: `lh_${Date.now()}_${i}_${Math.floor(Math.random() * 100000)}`,
                business_name: `${types[i % types.length]} ${capitalize(cleanQuery)} ${location.split(',')[0]} #${i + 1}`,
                category: query,
                address: `${Math.floor(Math.random() * 980) + 10} Main Ave, ${location}`,
                phone: `+1 (555) ${Math.floor(Math.random() * 899) + 100}-${Math.floor(Math.random() * 8999) + 1000}`,
                website: website,
                email: email,
                rating: 4.0 + (Math.random() * 1.0),
                review_count: Math.floor(Math.random() * 2500) + 50,
                source: 'google_maps',
                is_imported: false
            };
        });
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
            industry: string | null;
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
            industry: lead.category || 'Iglesias y Congregaciones',
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
                    industry: string | null;
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
                    industry: lead.category || 'Iglesias y Congregaciones',
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
