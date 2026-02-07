import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, MapPin, Check, Star, Globe, Phone, Building2, LayoutGrid, CheckSquare, Square, Download, Filter, Zap } from 'lucide-react';
import { leadDiscoveryService, type DiscoveredLead } from '../../services/marketing/leadDiscovery';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

export default function LeadHunter() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isStartingCampaign, setIsStartingCampaign] = useState(false);
    const [results, setResults] = useState<DiscoveredLead[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        minRating: 0,
        hasPhone: false,
        hasWebsite: false
    });

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query || !location) {
            toast.error('Por favor ingresa qué buscas y dónde.');
            return;
        }

        setIsLoading(true);
        setSelectedIds(new Set());
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

    // Apply client-side filtering
    const filteredResults = useMemo(() => {
        return results.filter(lead => {
            if (lead.rating && lead.rating < filters.minRating) return false;
            if (filters.hasPhone && !lead.phone) return false;
            if (filters.hasWebsite && !lead.website) return false;
            return true;
        });
    }, [results, filters]);

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    const toggleSelectAll = () => {
        const availableToSelect = filteredResults.filter(r => !r.is_imported);
        if (selectedIds.size === availableToSelect.length && availableToSelect.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(availableToSelect.map(r => r.id)));
        }
    };

    const handleImportBulk = async (shouldRedirect = false) => {
        if (!profile?.company_id) {
            toast.error('No se pudo identificar tu empresa.');
            return;
        }

        const toImport = filteredResults.filter(r => selectedIds.has(r.id) && !r.is_imported);

        if (toImport.length === 0 && !shouldRedirect) return;

        if (shouldRedirect) setIsStartingCampaign(true);
        else setIsImporting(true);

        try {
            if (toImport.length > 0) {
                toast.loading(`Importando ${toImport.length} leads...`, { id: 'bulkImport' });
                const stats = await leadDiscoveryService.importLeadsBulk(toImport, profile.company_id);

                setResults(prev => prev.map(r =>
                    selectedIds.has(r.id) ? { ...r, is_imported: true } : r
                ));

                if (stats.failed > 0) {
                    toast.success(`✅ ${stats.success} importados, ${stats.failed} omitidos (duplicados)`, { id: 'bulkImport' });
                } else {
                    toast.success(`✅ ${stats.success} prospectos agregados.`, { id: 'bulkImport' });
                }
            }

            if (shouldRedirect) {
                navigate('/marketing/email/new', {
                    state: {
                        preSelectedLeads: Array.from(selectedIds),
                        campaignSource: 'lead-hunter'
                    }
                });
            } else {
                setSelectedIds(new Set());
            }
        } catch (error) {
            console.error(error);
            toast.error('Error durante el proceso.', { id: 'bulkImport' });
        } finally {
            setIsImporting(false);
            setIsStartingCampaign(false);
        }
    };

    const handleImportSingle = async (lead: DiscoveredLead) => {
        if (!profile?.company_id) {
            toast.error('Acceso denegado o empresa no configurada.');
            return;
        }

        try {
            await leadDiscoveryService.importLead(lead, profile.company_id);
            setResults(prev => prev.map(r =>
                r.id === lead.id ? { ...r, is_imported: true } : r
            ));
            toast.success(`✅ ${lead.business_name} agregado.`);
        } catch (error) {
            console.error(error);
            toast.error('Error al importar.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
                        <Search className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Link to="/marketing" className="text-gray-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-1">
                                ↞ Dashboard de Marketing
                            </Link>
                        </div>
                        <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Lead Hunter AI <span className="text-amber-500">PRO</span></h1>
                        <p className="text-gray-500 font-medium text-sm">Escaneo masivo de prospectos mediante Inteligencia Artificial.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-4 rounded-2xl border transition-all flex items-center gap-2 font-bold text-sm ${showFilters ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        <Filter className="w-5 h-5" />
                        Filtros Avanzados
                    </button>

                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-4 bg-[#0f172a] p-1.5 pl-6 rounded-2xl animate-in fade-in slide-in-from-right-4 duration-300">
                            <span className="text-white font-bold text-sm">{selectedIds.size} seleccionados</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleImportBulk(false)}
                                    disabled={isImporting || isStartingCampaign}
                                    className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 border border-white/10"
                                >
                                    <Download className="w-5 h-5 text-amber-500" /> Importar
                                </button>
                                <button
                                    onClick={() => handleImportBulk(true)}
                                    disabled={isImporting || isStartingCampaign}
                                    className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Zap className="w-5 h-5" /> Iniciar Campaña
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters Sub-Panel */}
            {showFilters && (
                <div className="bg-white p-6 rounded-[2rem] border border- amber-100 shadow-sm animate-in slide-in-from-top-4 duration-300 flex flex-wrap gap-8 items-center">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Calificación Mínima</label>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    onClick={() => setFilters({ ...filters, minRating: star })}
                                    className={`p-2 rounded-lg transition-colors ${filters.minRating >= star ? 'text-amber-500' : 'text-gray-200'}`}
                                >
                                    <Star className={`w-6 h-6 ${filters.minRating >= star ? 'fill-current' : ''}`} />
                                </button>
                            ))}
                            {filters.minRating > 0 && (
                                <button
                                    onClick={() => setFilters({ ...filters, minRating: 0 })}
                                    className="text-xs font-bold text-gray-400 hover:text-red-500 ml-2"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="h-12 w-px bg-gray-100 hidden md:block" />

                    <div className="flex gap-4">
                        <button
                            onClick={() => setFilters({ ...filters, hasPhone: !filters.hasPhone })}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${filters.hasPhone ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            <Phone className="w-4 h-4 inline mr-2" /> Solo con Teléfono
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, hasWebsite: !filters.hasWebsite })}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${filters.hasWebsite ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            <Globe className="w-4 h-4 inline mr-2" /> Solo con Web
                        </button>
                    </div>

                    <div className="flex-1 text-right">
                        <span className="text-sm font-bold text-gray-400 italic">
                            Filtrando {filteredResults.length} de {results.length} resultados
                        </span>
                    </div>
                </div>
            )}

            {/* Search Bar - Premium UI */}
            <div className="bg-[#0f172a] p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -ml-24 -mb-24" />

                <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4 relative z-10">
                    <div className="flex-1 relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-amber-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="¿Qué categoría buscas? (ej. Dentistas, Agencias, Cafés)"
                            className="w-full pl-16 pr-4 py-5 rounded-2xl bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:bg-white/15 focus:ring-4 focus:ring-amber-500/20 focus:outline-none transition-all font-bold"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-blue-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="¿En qué ciudad o zona?"
                            className="w-full pl-16 pr-4 py-5 rounded-2xl bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:bg-white/15 focus:ring-4 focus:ring-blue-500/20 focus:outline-none transition-all font-bold"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black px-12 py-5 rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-3 overflow-hidden"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Search className="w-6 h-6" />
                                <span className="tracking-tight uppercase">Cazar Prospectos</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Selection Toolbar */}
            {filteredResults.length > 0 && !isLoading && (
                <div className="flex justify-between items-center px-4">
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-bold text-sm transition-colors group"
                    >
                        {selectedIds.size === filteredResults.filter(r => !r.is_imported).length && selectedIds.size > 0 ? (
                            <CheckSquare className="w-5 h-5 text-amber-500" />
                        ) : (
                            <Square className="w-5 h-5 group-hover:text-amber-500" />
                        )}
                        Seleccionar todos los visibles
                    </button>
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
                        <LayoutGrid className="w-4 h-4" /> {filteredResults.length} de {results.length} Prospectos
                    </div>
                </div>
            )}

            {/* Results Grid - Enhanced */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredResults.map((lead) => {
                    const isSelected = selectedIds.has(lead.id);
                    return (
                        <div
                            key={lead.id}
                            onClick={() => !lead.is_imported && toggleSelection(lead.id)}
                            className={`bg-white rounded-[2rem] border p-1 transition-all relative group cursor-pointer ${lead.is_imported ? 'opacity-70 grayscale-[0.5]' :
                                isSelected ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xl' : 'border-gray-100 hover:border-amber-200 hover:shadow-lg'
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl transition-colors ${isSelected ? 'bg-amber-500 text-white' : 'bg-blue-50 text-blue-600'
                                        }`}>
                                        {lead.business_name.charAt(0)}
                                    </div>
                                    {!lead.is_imported && (
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200'
                                            }`}>
                                            {isSelected && <Check className="w-5 h-5" />}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1 mb-4">
                                    <h3 className="text-lg font-black text-gray-900 leading-[1.1] group-hover:text-amber-600 transition-colors line-clamp-2 min-h-[3rem]">{lead.business_name}</h3>
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                        <Star className="w-3 h-3 fill-current" /> {lead.rating?.toFixed(1)}
                                        <span className="text-gray-400 font-medium tracking-tight">({lead.review_count} reseñas)</span>
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm text-gray-500 mb-6 font-medium">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <span className="line-clamp-2 leading-tight">{lead.address}</span>
                                    </div>
                                    {lead.website && (
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-gray-400" />
                                            <span className="text-blue-600 truncate">{lead.website}</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!lead.is_imported) handleImportSingle(lead);
                                    }}
                                    disabled={lead.is_imported}
                                    className={`w-full py-4 rounded-2xl font-black transition-all border-2 text-sm uppercase tracking-widest ${lead.is_imported
                                        ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                                        : isSelected ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    {lead.is_imported ? 'Importado' : isSelected ? 'Seleccionado' : 'Importar Solo Este'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredResults.length === 0 && !isLoading && (
                <div className="text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-gray-50">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="w-12 h-12 text-gray-300" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                        {results.length > 0 ? 'Sin resultados con estos filtros' : '¿Qué negocios quieres cazar hoy?'}
                    </h2>
                    <p className="text-gray-400 font-medium max-w-xs mx-auto">
                        {results.length > 0
                            ? 'Intenta relajar los filtros para ver más prospectos.'
                            : 'Selecciona una categoría y ubicación para empezar a llenar tu CRM de prospectos.'}
                    </p>
                </div>
            )}
        </div>
    );
}
