import { useState } from 'react';
import { Search, MapPin, Plus, Check, Star, Globe, Phone, Building2 } from 'lucide-react';
import { leadDiscoveryService, type DiscoveredLead } from '../../services/marketing/leadDiscovery';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function LeadHunter() {
    const { profile } = useAuth();
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<DiscoveredLead[]>([]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query || !location) {
            toast.error('Por favor ingresa qué buscas y dónde.');
            return;
        }

        setIsLoading(true);
        try {
            const data = await leadDiscoveryService.searchBusiness(query, location);
            setResults(data);
            if (data.length > 0) {
                toast.success(`🎉 ¡Encontramos ${data.length} prospectos potenciales!`);
            } else {
                toast('No se encontraron resultados. Intenta otra búsqueda.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al realizar la búsqueda.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async (lead: DiscoveredLead) => {
        if (!profile?.company_id) {
            // Fallback para Super Admin probando sin company_id, o mostrar error
            // En un entorno real, el Super Admin debería elegir a qué empresa asignar, o asignar a su propia "demo company"
            if (profile?.role === 'super_admin') {
                toast.error('Como Super Admin, necesitas seleccionar una empresa destino (Feature Coming Soon).');
                return;
            }
            return;
        }

        try {
            await leadDiscoveryService.importLead(lead, profile.company_id);

            // Actualizar estado local visualmente
            setResults(prev => prev.map(r =>
                r.id === lead.id ? { ...r, is_imported: true } : r
            ));

            toast.success(`✅ ${lead.business_name} agregado a tus Leads`);
        } catch (error) {
            console.error(error);
            toast.error('Error al importar el lead. Puede que ya exista.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link to="/marketing" className="text-gray-400 hover:text-blue-600 font-medium text-sm transition-colors">
                            ← Volver al Dashboard
                        </Link>
                    </div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight flex items-center gap-2">
                        <Search className="w-8 h-8 text-amber-500" />
                        Lead Hunter AI
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Descubre nuevos clientes en Google Maps & Web y agrégalos a tu CRM en un clic.
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-gradient-to-r from-[#0f172a] to-[#334155] p-8 rounded-2xl shadow-lg">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="¿Qué buscas? (ej. Dentistas, Abogados, Restaurantes)"
                            className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-blue-500/30 focus:outline-none"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 relative">
                        <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="¿Dónde? (ej. Miami, FL o Ciudad de México)"
                            className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-blue-500/30 focus:outline-none"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 min-w-[150px]"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Search className="w-5 h-5" />
                                Buscar
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((lead) => (
                    <div key={lead.id} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xl">
                                {lead.business_name.charAt(0)}
                            </div>
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-xs font-bold">
                                {lead.rating?.toFixed(1)} <Star className="w-3 h-3 fill-current" />
                                <span className="text-gray-400 font-normal">({lead.review_count})</span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{lead.business_name}</h3>
                        <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {lead.category}
                        </p>

                        <div className="space-y-2 text-sm text-gray-600 mb-6">
                            <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{lead.address}</span>
                            </div>
                            {lead.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <span>{lead.phone}</span>
                                </div>
                            )}
                            {lead.website && (
                                <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-gray-400" />
                                    <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                        {lead.website}
                                    </a>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => handleImport(lead)}
                            disabled={lead.is_imported}
                            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${lead.is_imported
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : 'bg-[#0f172a] text-white hover:bg-[#1e293b] shadow-lg shadow-blue-900/10'
                                }`}
                        >
                            {lead.is_imported ? (
                                <>
                                    <Check className="w-5 h-5" /> Importado
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" /> Importar al CRM
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {results.length === 0 && !isLoading && (
                <div className="text-center py-20 text-gray-400">
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">Realiza una búsqueda para ver resultados aquí.</p>
                </div>
            )}
        </div>
    );
}
