import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, MapPin, Check, Star, Globe, Phone, Mail, Building2, LayoutGrid, CheckSquare, Square, Download, Filter, Zap, Users, X, ArrowRight, Layers, Sparkles, ChevronDown, ShieldCheck } from 'lucide-react';
import { leadDiscoveryService, OFFICIAL_CATEGORIES, type DiscoveredLead, type RegionalDensity } from '../../services/marketing/leadDiscovery';
import { leadsService } from '../../services/leads';
import { useAuth } from '../../auth/AuthProvider';
import { BulkAssignModal } from '../../components/leads/BulkAssignModal';
import toast from 'react-hot-toast';

// Lead Hunter AI Component - Multi-City Density Scanner Integrated
export default function LeadHunter() {
    const navigate = useNavigate();
    const { profile, simulatedCompanyId } = useAuth();
    // SIMULATION GUARD: always use the active company, not the JWT tenant
    const activeCompanyId = simulatedCompanyId || profile?.company_id;
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('El Salvador');
    const [selectedCategory, setSelectedCategory] = useState('custom');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const [isDeepScan, setIsDeepScan] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isStartingCampaign, setIsStartingCampaign] = useState(false);
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [results, setResults] = useState<DiscoveredLead[]>([]);

    // Density Scanner State
    const [isDensityScanning, setIsDensityScanning] = useState(false);
    const [isDensityModalOpen, setIsDensityModalOpen] = useState(false);
    const [densityResults, setDensityResults] = useState<RegionalDensity[]>([]);
    const [selectedDensityCityIds, setSelectedDensityCityIds] = useState<Set<string>>(new Set());
    const [densitySearchFilter, setDensitySearchFilter] = useState('');
    const [audienceFilter, setAudienceFilter] = useState<'hispanic' | 'anglo' | 'all'>('hispanic');

    useEffect(() => {
        leadsService.getTeamMembers().then(data => setTeamMembers(data || [])).catch(() => {});

        const handleClickOutside = (e: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        minRating: 0,
        hasPhone: false,
        hasWebsite: false,
        hasEmail: false
    });

    // Handle category change
    const handleCategorySelect = (catKey: string) => {
        setSelectedCategory(catKey);
        setIsCategoryDropdownOpen(false);
        const cat = OFFICIAL_CATEGORIES.find(c => c.key === catKey);
        if (cat && cat.key !== 'custom') {
            setQuery(cat.synonyms[0] || cat.label);
        }
    };

    const getEffectiveQuery = (rawQuery: string) => {
        if (!rawQuery) return rawQuery;
        const lower = rawQuery.toLowerCase();
        const isUS = location.toUpperCase().includes('USA') || location.toUpperCase().includes('ESTADOS UNIDOS');

        if (audienceFilter === 'hispanic' && isUS) {
            if (!lower.includes('hispana') && !lower.includes('español') && !lower.includes('latina') && !lower.includes('spanish')) {
                return `${rawQuery} hispana`;
            }
        } else if (audienceFilter === 'anglo' && isUS) {
            let translated = rawQuery
                .replace(/iglesia cristiana/i, 'Christian Church')
                .replace(/iglesia/i, 'Church')
                .replace(/abogado/i, 'Law Firm')
                .replace(/contador/i, 'CPA Accounting')
                .replace(/dentista/i, 'Dental Clinic')
                .replace(/clínica/i, 'Medical Clinic')
                .replace(/taller/i, 'Auto Repair');
            if (!translated.toLowerCase().includes('english') && !translated.toLowerCase().includes('church') && !translated.toLowerCase().includes('firm') && !translated.toLowerCase().includes('clinic')) {
                translated = `${translated} English`;
            }
            return translated;
        }
        return rawQuery;
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDeepScan) {
            handleScanDensity();
            return;
        }

        if (!query || !location) {
            toast.error('Por favor ingresa qué buscas y dónde.');
            return;
        }

        setIsLoading(true);
        setSelectedIds(new Set());
        try {
            const effectiveQuery = getEffectiveQuery(query);
            const data = await leadDiscoveryService.searchBusiness(effectiveQuery, location);
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

    // Handle Density Scan across multiple cities
    const handleScanDensity = async () => {
        if (!query || !location) {
            toast.error('Por favor ingresa qué buscas y un país o región (ej. Estados Unidos).');
            return;
        }

        setIsDensityScanning(true);
        try {
            const effectiveQuery = getEffectiveQuery(query);
            toast.loading(isDeepScan ? `🔍 Escaneando Profundo: "${effectiveQuery}" en ${location}...` : 'Escaneando densidad por zonas...', { id: 'densityScan' });
            const density = await leadDiscoveryService.scanDensityByRegion(effectiveQuery, location, {
                deepScan: isDeepScan,
                categoryKey: selectedCategory !== 'custom' ? selectedCategory : undefined
            });
            setDensityResults(density);

            // Pre-select non-empty cities
            const validIds = new Set(density.filter(d => d.count > 0).map(d => d.id));
            setSelectedDensityCityIds(validIds);

            const totalFound = density.reduce((sum, item) => sum + item.count, 0);
            if (totalFound > 0) {
                toast.success(`🎉 ¡Escaneo completado! ${totalFound} prospectos detectados por zonas.`, { id: 'densityScan' });
                setIsDensityModalOpen(true);
            } else {
                toast('No se detectaron prospectos en las ciudades de la región.', { id: 'densityScan' });
            }
        } catch (error) {
            console.error('Density scan error:', error);
            toast.error('Error al escanear la densidad de prospectos.', { id: 'densityScan' });
        } finally {
            setIsDensityScanning(false);
        }
    };

    const toggleDensityCity = (id: string) => {
        const newSet = new Set(selectedDensityCityIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDensityCityIds(newSet);
    };

    const toggleAllDensityCities = () => {
        if (selectedDensityCityIds.size === densityResults.length) {
            setSelectedDensityCityIds(new Set());
        } else {
            setSelectedDensityCityIds(new Set(densityResults.map(d => d.id)));
        }
    };

    const handleLoadLeadsFromDensity = () => {
        const selectedCities = densityResults.filter(d => selectedDensityCityIds.has(d.id));
        const aggregatedLeads: DiscoveredLead[] = [];
        selectedCities.forEach(c => aggregatedLeads.push(...c.leads));

        if (aggregatedLeads.length === 0) {
            toast.error('Selecciona al menos una ciudad con prospectos.');
            return;
        }

        setIsDensityModalOpen(false);
        setResults(aggregatedLeads);
        setSelectedIds(new Set());
        toast.success(`📋 ${aggregatedLeads.length} prospectos cargados. Selecciona los que deseas importar a tu CRM.`);
    };

    // Apply client-side filtering
    const filteredResults = useMemo(() => {
        return results.filter(lead => {
            if (lead.rating && lead.rating < filters.minRating) return false;
            if (filters.hasPhone && !lead.phone) return false;
            if (filters.hasWebsite && !lead.website) return false;
            if (filters.hasEmail && !lead.email) return false;
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
        if (!activeCompanyId) {
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
                const stats = await leadDiscoveryService.importLeadsBulk(toImport, activeCompanyId);

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
        if (!activeCompanyId) {
            toast.error('Acceso denegado o empresa no configurada.');
            return;
        }

        try {
            await leadDiscoveryService.importLead(lead, activeCompanyId);
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
        <div className="space-y-4">
            {/* Sleek Minimalist Enterprise Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1 pb-1">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <Link to="/marketing" className="text-slate-400 hover:text-indigo-600 font-extrabold text-sm uppercase tracking-wider transition-colors flex items-center gap-1">
                            Marketing
                        </Link>
                        <span className="text-slate-300 font-bold text-sm">/</span>
                        <span className="text-slate-900 font-black text-xl tracking-tight">Lead Hunter</span>
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">PRO</span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium">Búsqueda masiva y escaneo regional de prospectos en tiempo real con Inteligencia Artificial.</p>
                </div>

                {/* Bulk selection & action group */}
                <div className="flex items-center gap-3">
                    {filteredResults.length > 0 && !isLoading && (
                        <button
                            onClick={() => setIsBulkAssignOpen(true)}
                            className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 transition-all flex items-center gap-2 font-bold text-xs shadow-xs"
                        >
                            <Users className="w-4 h-4" />
                            <span>Asignar Leads</span>
                        </button>
                    )}

                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-3 bg-[#0f172a] p-1.5 pl-4 rounded-xl animate-in fade-in slide-in-from-right-4 duration-300">
                            <span className="text-white font-bold text-xs">{selectedIds.size} sel.</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleImportBulk(false)}
                                    disabled={isImporting || isStartingCampaign}
                                    className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 border border-white/10"
                                >
                                    <Download className="w-3.5 h-3.5 text-amber-500" /> Importar
                                </button>
                                <button
                                    onClick={() => handleImportBulk(true)}
                                    disabled={isImporting || isStartingCampaign}
                                    className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white font-black px-4 py-1.5 rounded-lg text-xs shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Zap className="w-3.5 h-3.5" /> Campaña
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters Sub-Panel */}
            {showFilters && (
                <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm animate-in slide-in-from-top-4 duration-300 flex flex-wrap gap-6 items-center">
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Calificación Mínima</label>
                        <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    onClick={() => setFilters({ ...filters, minRating: star })}
                                    className={`p-1.5 rounded-lg transition-colors ${filters.minRating >= star ? 'text-amber-500' : 'text-slate-200'}`}
                                >
                                    <Star className={`w-5 h-5 ${filters.minRating >= star ? 'fill-current' : ''}`} />
                                </button>
                            ))}
                            {filters.minRating > 0 && (
                                <button
                                    onClick={() => setFilters({ ...filters, minRating: 0 })}
                                    className="text-xs font-bold text-slate-400 hover:text-red-500 ml-2"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="h-10 w-px bg-slate-100 hidden md:block" />

                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilters({ ...filters, hasPhone: !filters.hasPhone })}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${filters.hasPhone ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            <Phone className="w-3.5 h-3.5 inline mr-1.5" /> Solo con Teléfono
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, hasWebsite: !filters.hasWebsite })}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${filters.hasWebsite ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            <Globe className="w-3.5 h-3.5 inline mr-1.5" /> Solo con Web
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, hasEmail: !filters.hasEmail })}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${filters.hasEmail ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            <Mail className="w-3.5 h-3.5 inline mr-1.5" /> Solo con Email
                        </button>
                    </div>

                    <div className="flex-1 text-right">
                        <span className="text-xs font-bold text-slate-400 italic">
                            Filtrando {filteredResults.length} de {results.length} resultados
                        </span>
                    </div>
                </div>
            )}

            {/* Search Bar - Symmetrical Unified Inputs with Floating Micro-Labels */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    
                    {/* 1. Rubro / Categoría Selector (Unified Floating Card) */}
                    <div ref={categoryDropdownRef} className="md:col-span-3 relative">
                        <button
                            type="button"
                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                            className={`w-full h-[54px] bg-slate-50/80 hover:bg-slate-100/80 rounded-xl px-3.5 py-2 border transition-all flex items-center justify-between gap-2.5 text-left group ${
                                isCategoryDropdownOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10 shadow-xs' : 'border-slate-200/80'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <Sparkles className={`w-4 h-4 shrink-0 transition-all ${isCategoryDropdownOpen ? 'text-indigo-600 scale-110' : 'text-amber-500 group-hover:scale-110'}`} />
                                <div className="min-w-0 flex-1">
                                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1 cursor-pointer">
                                        Rubro u Oficio
                                    </label>
                                    <span className="text-slate-900 font-bold text-xs sm:text-sm truncate block leading-none">
                                        {(() => {
                                            const activeCat = OFFICIAL_CATEGORIES.find(c => c.key === selectedCategory);
                                            if (!activeCat) return 'Seleccionar Rubro...';
                                            return `${activeCat.icon} ${activeCat.label}`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                        </button>

                        {/* Modern Floating Menu (Wider & Cleaner) */}
                        {isCategoryDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 w-[340px] sm:w-[380px] md:w-[400px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 max-h-84 overflow-y-auto">
                                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                                    <span>Rubros Oficiales (Google)</span>
                                    <span className="text-indigo-600 font-semibold">{OFFICIAL_CATEGORIES.length} rubros disponibles</span>
                                </div>
                                {OFFICIAL_CATEGORIES.map((cat) => {
                                    const isSelected = cat.key === selectedCategory;
                                    return (
                                        <button
                                            key={cat.key}
                                            type="button"
                                            onClick={() => handleCategorySelect(cat.key)}
                                            className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                                                isSelected
                                                    ? 'bg-amber-500/10 border border-amber-500/30 text-slate-900 font-bold shadow-xs'
                                                    : 'hover:bg-slate-100/70 text-slate-700 font-semibold border border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className="text-lg shrink-0">{cat.icon}</span>
                                                <div className="truncate">
                                                    <span className="block text-xs font-bold truncate leading-tight text-slate-900">{cat.label}</span>
                                                    {cat.synonyms.length > 0 && (
                                                        <span className="block text-[10px] text-slate-400 font-normal truncate mt-0.5">
                                                            Incluye: {cat.synonyms.slice(0, 3).join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 ml-2">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 2. Término Específico (Unified Floating Card) */}
                    <div className="md:col-span-3 h-[54px] bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 rounded-xl px-3.5 py-2 border border-slate-200/80 flex items-center gap-2.5 transition-all group">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0 group-focus-within:text-indigo-600 transition-colors" />
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1">
                                Término de Búsqueda
                            </label>
                            <input
                                type="text"
                                placeholder="ej. Iglesias cristianas, Dentistas, Cafés"
                                className="w-full bg-transparent text-slate-900 font-bold text-xs sm:text-sm focus:outline-none placeholder-slate-400 leading-none truncate"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    if (selectedCategory !== 'custom') setSelectedCategory('custom');
                                }}
                            />
                        </div>
                    </div>

                    {/* 3. País / Región (Unified Floating Card) */}
                    <div className="md:col-span-3 h-[54px] bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 rounded-xl px-3.5 py-2 border border-slate-200/80 flex items-center gap-2.5 transition-all group">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 group-focus-within:text-indigo-600 transition-colors" />
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1">
                                País o Región
                            </label>
                            <input
                                type="text"
                                placeholder="ej. El Salvador, Estados Unidos, México"
                                className="w-full bg-transparent text-slate-900 font-bold text-xs sm:text-sm focus:outline-none placeholder-slate-400 leading-none truncate"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 4. Botón Único de Acción Principal + Filtros */}
                    <div className="md:col-span-3 h-[54px] flex gap-2">
                        <button
                            type="submit"
                            disabled={isDensityScanning || isLoading}
                            className="flex-1 h-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isDensityScanning || isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                                    <span>{isDeepScan ? 'Escanear Zonas' : 'Cazar Leads'}</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-[48px] h-full rounded-xl border font-bold text-xs transition-all flex items-center justify-center shrink-0 ${
                                showFilters 
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm' 
                                    : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/80 text-slate-500 hover:text-slate-800'
                            }`}
                            title="Filtros Avanzados (Teléfono, Email, Rating)"
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </form>

                {/* Sub-bar for Deep Scan Mode Control */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Modo de Captura:</span>
                        <button
                            type="button"
                            onClick={() => setIsDeepScan(!isDeepScan)}
                            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-2 border text-xs font-bold ${
                                isDeepScan
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 shadow-2xs'
                                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/60'
                            }`}
                        >
                            {isDeepScan ? (
                                <>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>Escaneo Profundo 100% (Multi-Sinónimos + Sub-Zonas)</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Escaneo Estándar</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Audience Demographic Filter Pills */}
                    <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase px-1.5">Audiencia:</span>
                        <button
                            type="button"
                            onClick={() => setAudienceFilter('hispanic')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                audienceFilter === 'hispanic'
                                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/80 font-black'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>🇲🇽 🇪🇸 Hispana / Español</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAudienceFilter('anglo')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                audienceFilter === 'anglo'
                                    ? 'bg-white text-blue-700 shadow-xs border border-blue-200/80 font-black'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>🇺🇸 Anglo / English</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAudienceFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                audienceFilter === 'all'
                                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>🌐 Todas</span>
                        </button>
                    </div>

                    {/* Senior Glassmorphic Badge replacing plain green checkmark */}
                    <div className="hidden lg:flex items-center">
                        {isDeepScan ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] font-extrabold backdrop-blur-md animate-in fade-in duration-200">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Cobertura 100% Nacional • Todos los Municipios + Sinónimos</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold">
                                <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Búsqueda directa por ciudad específica</span>
                            </div>
                        )}
                    </div>
                </div>
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

                                <div className="space-y-2 text-sm text-gray-500 mb-6 font-medium">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <span className="line-clamp-2 leading-tight">{lead.address}</span>
                                    </div>
                                    {lead.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-green-500" />
                                            <span className="text-gray-700 font-semibold">{lead.phone}</span>
                                        </div>
                                    )}
                                    {lead.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-blue-500" />
                                            <span className="text-blue-600 truncate text-xs">{lead.email}</span>
                                        </div>
                                    )}
                                    {lead.website && (
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-500 truncate text-xs">{lead.website}</span>
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

            {/* ── BULK ASSIGN MODAL (Lead Hunter) ──────────────────────── */}
            {isBulkAssignOpen && (
                <BulkAssignModal
                    isOpen={isBulkAssignOpen}
                    onClose={() => setIsBulkAssignOpen(false)}
                    filteredLeadIds={filteredResults
                        .filter(r => r.is_imported)
                        .map(r => r.id)
                        .concat(
                            // Also include all visible results (they may already be in DB)
                            filteredResults.filter(r => !r.is_imported).map(r => r.id)
                        )
                    }
                    preSelectedIds={Array.from(selectedIds)}
                    teamMembers={teamMembers}
                    onSuccess={() => {
                        setSelectedIds(new Set());
                        toast.success('Leads asignados — ve a /leads para verlos.');
                    }}
                />
            )}

            {/* ── DENSITY SCANNER MODAL (Human-Designed & Clean) ──────────────────────── */}
            {isDensityModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        
                        {/* Header Panel */}
                        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Ciudades y Regiones con más prospectos encontrados</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Selecciona las zonas que deseas importar a tu lista de leads.</p>
                            </div>
                            <button
                                onClick={() => setIsDensityModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Quick Actions Bar */}
                        <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Filtrar ciudad o estado..."
                                    value={densitySearchFilter}
                                    onChange={(e) => setDensitySearchFilter(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <span className="text-xs font-medium text-slate-600">
                                    {densityResults.filter(d => d.count > 0).length} zonas en {location}
                                </span>
                                <button
                                    onClick={toggleAllDensityCities}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0"
                                >
                                    {selectedDensityCityIds.size === densityResults.length ? 'Deseleccionar todas' : `Seleccionar todas (${densityResults.length})`}
                                </button>
                            </div>
                        </div>

                        {/* Friendly City List with Filter & Descending Sort */}
                        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto bg-slate-50/40">
                            {[...densityResults]
                                .filter(item => {
                                    if (!densitySearchFilter) return true;
                                    const term = densitySearchFilter.toLowerCase();
                                    return item.cityName.toLowerCase().includes(term) || item.stateName.toLowerCase().includes(term);
                                })
                                .sort((a, b) => b.count - a.count)
                                .map((item) => {
                                    const isChecked = selectedDensityCityIds.has(item.id);
                                    return (
                                        <label
                                            key={item.id}
                                            onClick={() => toggleDensityCity(item.id)}
                                            className={`p-3.5 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                                                isChecked
                                                    ? 'bg-slate-50 border-2 border-indigo-500 shadow-sm'
                                                    : 'bg-white border border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                />
                                                <span className="text-sm font-bold text-slate-800">{item.cityName}</span>
                                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-600">
                                                    {item.stateName}
                                                </span>
                                            </div>
                                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                                item.count > 0
                                                    ? 'text-amber-700 bg-amber-50 border-amber-200/60'
                                                    : 'text-slate-400 bg-slate-100 border-slate-200'
                                            }`}>
                                                {item.count.toLocaleString()} prospectos
                                            </span>
                                        </label>
                                    );
                                })}
                        </div>

                        {/* Footer with friendly CTA */}
                        <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <span className="text-sm font-bold text-slate-900 block">
                                    Total: {densityResults
                                        .filter(d => selectedDensityCityIds.has(d.id))
                                        .reduce((sum, item) => sum + item.count, 0).toLocaleString()} prospectos seleccionados
                                </span>
                                <span className="text-xs text-slate-400 font-medium">Se ignorarán duplicados automáticamente</span>
                            </div>

                            <button
                                onClick={handleLoadLeadsFromDensity}
                                className="w-full sm:w-auto py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Cargar {densityResults
                                    .filter(d => selectedDensityCityIds.has(d.id))
                                    .reduce((sum, item) => sum + item.count, 0).toLocaleString()} Prospectos</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
