import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useLocation } from 'react-router-dom';
import { industriesService } from '../../services/industries';
import { leadSourcesService, type LeadSource } from '../../services/leadSourcesService';
import type { Industry } from '../../types';
import { Plus, Pencil, Trash2, Check, X, Building2, GripVertical, Search, Radio, Sparkles, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface IndustriesProps {
    defaultTab?: 'industries' | 'sources';
}

const COMMON_SOURCE_ICONS = ['📡', '📱', '🌐', '📣', '👥', '🏢', '📧', '🎯', '🤝', '🤖'];

export default function Industries({ defaultTab = 'industries' }: IndustriesProps) {
    const { profile } = useAuth();
    const location = useLocation();

    // Determinar tab inicial por prop o query param ?tab=sources
    const initialTab = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const queryTab = params.get('tab');
        if (queryTab === 'sources' || queryTab === 'origenes') return 'sources';
        if (queryTab === 'industries' || queryTab === 'rubros') return 'industries';
        return defaultTab;
    }, [location.search, defaultTab]);

    const [activeTab, setActiveTab] = useState<'industries' | 'sources'>(initialTab);

    // ── Estado Rubros / Industrias ──
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [loadingIndustries, setLoadingIndustries] = useState(true);
    const [industrySearch, setIndustrySearch] = useState('');
    const [newIndustryName, setNewIndustryName] = useState('');
    const [editingIndustryId, setEditingIndustryId] = useState<string | null>(null);
    const [editingIndustryName, setEditingIndustryName] = useState('');

    // ── Estado Orígenes de Leads ──
    const [sources, setSources] = useState<LeadSource[]>([]);
    const [loadingSources, setLoadingSources] = useState(true);
    const [sourceSearch, setSourceSearch] = useState('');
    const [newSourceName, setNewSourceName] = useState('');
    const [newSourceIcon, setNewSourceIcon] = useState('📡');
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [editingSourceName, setEditingSourceName] = useState('');
    const [editingSourceIcon, setEditingSourceIcon] = useState('');

    useEffect(() => {
        loadIndustries();
        loadSources();
    }, []);

    const loadIndustries = async () => {
        setLoadingIndustries(true);
        try {
            const data = await industriesService.getIndustries();
            setIndustries(data || []);
        } catch {
            toast.error('Error al cargar rubros');
        } finally {
            setLoadingIndustries(false);
        }
    };

    const loadSources = async () => {
        setLoadingSources(true);
        try {
            const data = await leadSourcesService.getAllSources();
            setSources(data || []);
        } catch {
            toast.error('Error al cargar orígenes de prospectos');
        } finally {
            setLoadingSources(false);
        }
    };

    // ── Handlers Rubros ──
    const handleCreateIndustry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIndustryName.trim()) return;
        try {
            const maxOrder = industries.length > 0
                ? Math.max(...industries.map(i => i.display_order))
                : 0;
            await industriesService.createIndustry(newIndustryName.trim(), maxOrder + 1);
            setNewIndustryName('');
            toast.success('Rubro creado exitosamente');
            loadIndustries();
        } catch {
            toast.error('Error al crear rubro');
        }
    };

    const handleUpdateIndustry = async (id: string) => {
        if (!editingIndustryName.trim()) return;
        try {
            await industriesService.updateIndustry(id, { name: editingIndustryName.trim() });
            setEditingIndustryId(null);
            setEditingIndustryName('');
            toast.success('Rubro actualizado');
            loadIndustries();
        } catch {
            toast.error('Error al actualizar');
        }
    };

    const handleDeleteIndustry = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este rubro?')) return;
        try {
            await industriesService.deleteIndustry(id);
            toast.success('Rubro eliminado');
            loadIndustries();
        } catch {
            toast.error('Error al eliminar rubro');
        }
    };

    // ── Handlers Orígenes ──
    const handleCreateSource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSourceName.trim()) return;
        try {
            await leadSourcesService.createSource({
                name: newSourceName.trim(),
                icon: newSourceIcon || '📡',
            });
            setNewSourceName('');
            setNewSourceIcon('📡');
            toast.success('Origen de prospectos creado');
            loadSources();
        } catch {
            toast.error('Error al crear origen de prospectos');
        }
    };

    const handleUpdateSource = async (id: string) => {
        if (!editingSourceName.trim()) return;
        try {
            await leadSourcesService.updateSource(id, {
                name: editingSourceName.trim(),
                icon: editingSourceIcon || '📡',
            });
            setEditingSourceId(null);
            setEditingSourceName('');
            toast.success('Origen actualizado');
            loadSources();
        } catch {
            toast.error('Error al actualizar origen');
        }
    };

    const handleToggleSourceActive = async (source: LeadSource) => {
        try {
            await leadSourcesService.toggleActive(source.id, source.is_active);
            toast.success(source.is_active ? `Origen "${source.name}" desactivado` : `Origen "${source.name}" activado`);
            setSources(prev => prev.map(s => s.id === source.id ? { ...s, is_active: !s.is_active } : s));
        } catch {
            toast.error('Error al cambiar estado del origen');
        }
    };

    const handleDeleteSource = async (source: LeadSource) => {
        if (source.is_system) {
            toast.error('Los orígenes del sistema no se pueden eliminar. Puedes desactivarlo si no lo usas.');
            return;
        }
        if (!confirm(`¿Eliminar el origen "${source.name}"? Los prospectos existentes conservarán su valor.`)) return;
        try {
            await leadSourcesService.deleteSource(source.id);
            toast.success('Origen eliminado');
            loadSources();
        } catch {
            toast.error('Error al eliminar origen');
        }
    };

    // ── Filtrado con Lupa ──
    const filteredIndustries = useMemo(() => {
        const q = industrySearch.toLowerCase().trim();
        if (!q) return industries;
        return industries.filter(i => i.name.toLowerCase().includes(q));
    }, [industries, industrySearch]);

    const filteredSources = useMemo(() => {
        const q = sourceSearch.toLowerCase().trim();
        if (!q) return sources;
        return sources.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.slug.toLowerCase().includes(q) ||
            s.icon.includes(q)
        );
    }, [sources, sourceSearch]);

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 animate-in fade-in duration-500 space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                        {activeTab === 'industries' ? <Building2 className="w-6 h-6" /> : <Radio className="w-6 h-6" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            {activeTab === 'industries' ? 'Rubros / Industrias' : 'Orígenes de Prospectos'}
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">
                            {activeTab === 'industries'
                                ? 'Configura los sectores para segmentar prospectos y clientes'
                                : 'Canales y fuentes de captación para atribuir leads y medir conversiones'}
                        </p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-center">
                    <button
                        type="button"
                        onClick={() => setActiveTab('industries')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            activeTab === 'industries'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Rubros</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                            {industries.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('sources')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            activeTab === 'sources'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Orígenes (Fuentes)</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                            {sources.length}
                        </span>
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 1: RUBROS / INDUSTRIAS                             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'industries' && (
                <div className="space-y-4">
                    {/* Barra de Filtro con Lupa + Formulario Crear */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Buscador con Lupa */}
                        <div className="sm:col-span-5 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={industrySearch}
                                onChange={(e) => setIndustrySearch(e.target.value)}
                                placeholder="Buscar rubro por nombre..."
                                className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                            />
                            {industrySearch && (
                                <button
                                    onClick={() => setIndustrySearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Create Form */}
                        {isAdmin && (
                            <form onSubmit={handleCreateIndustry} className="sm:col-span-7 flex gap-2">
                                <input
                                    value={newIndustryName}
                                    onChange={(e) => setNewIndustryName(e.target.value)}
                                    placeholder="Nuevo rubro (ej: Fintech, Retail, Salud...)"
                                    className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                                />
                                <button
                                    type="submit"
                                    disabled={!newIndustryName.trim()}
                                    className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Agregar</span>
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Conteo filtrado */}
                    {industrySearch && (
                        <div className="text-xs text-slate-500 font-medium flex items-center justify-between px-1">
                            <span>Mostrando <strong>{filteredIndustries.length}</strong> de {industries.length} rubros</span>
                            <button onClick={() => setIndustrySearch('')} className="text-indigo-600 hover:underline">Limpiar búsqueda</button>
                        </div>
                    )}

                    {/* Lista de Rubros */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                        {loadingIndustries ? (
                            <div className="p-12 flex items-center justify-center">
                                <div className="w-7 h-7 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                        ) : filteredIndustries.length === 0 ? (
                            <div className="p-12 text-center">
                                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-xs font-bold text-slate-500">
                                    {industrySearch ? 'No se encontraron rubros con esa búsqueda' : 'No hay rubros configurados'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredIndustries.map((industry, index) => (
                                    <div
                                        key={industry.id}
                                        className="group flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-all"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                                            <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                            <span className="w-6 text-[11px] font-mono font-bold text-slate-400 shrink-0">
                                                #{index + 1}
                                            </span>
                                            {editingIndustryId === industry.id ? (
                                                <input
                                                    autoFocus
                                                    value={editingIndustryName}
                                                    onChange={(e) => setEditingIndustryName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateIndustry(industry.id);
                                                        if (e.key === 'Escape') setEditingIndustryId(null);
                                                    }}
                                                    className="flex-1 h-8 rounded-lg border-2 border-indigo-500 font-bold text-slate-800 bg-white px-2.5 outline-none text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs font-bold text-slate-800 truncate">{industry.name}</span>
                                            )}
                                        </div>

                                        {isAdmin && (
                                            <div className="flex items-center gap-1">
                                                {editingIndustryId === industry.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateIndustry(industry.id)}
                                                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-all cursor-pointer"
                                                            title="Guardar"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingIndustryId(null)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 transition-all cursor-pointer"
                                                            title="Cancelar"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setEditingIndustryId(industry.id);
                                                                setEditingIndustryName(industry.name);
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                                                            title="Editar nombre"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteIndustry(industry.id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                                            title="Eliminar rubro"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 2: ORÍGENES DE LEADS (lead_sources)                 */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'sources' && (
                <div className="space-y-4">
                    {/* Barra de Filtro con Lupa + Formulario Crear */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Buscador con Lupa */}
                        <div className="sm:col-span-5 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={sourceSearch}
                                onChange={(e) => setSourceSearch(e.target.value)}
                                placeholder="Buscar origen por nombre o slug..."
                                className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                            />
                            {sourceSearch && (
                                <button
                                    onClick={() => setSourceSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Create Form */}
                        {isAdmin && (
                            <form onSubmit={handleCreateSource} className="sm:col-span-7 flex gap-2">
                                <div className="relative w-14 shrink-0">
                                    <input
                                        type="text"
                                        maxLength={4}
                                        value={newSourceIcon}
                                        onChange={(e) => setNewSourceIcon(e.target.value)}
                                        title="Emoji o icono del origen"
                                        className="w-full h-11 rounded-xl border border-slate-200 bg-white text-center text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                                    />
                                </div>
                                <input
                                    value={newSourceName}
                                    onChange={(e) => setNewSourceName(e.target.value)}
                                    placeholder="Nuevo canal (ej: TikTok Ads, Recomendaciones...)"
                                    className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                                />
                                <button
                                    type="submit"
                                    disabled={!newSourceName.trim()}
                                    className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Agregar</span>
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Presets rápidos de iconos para orígenes */}
                    {isAdmin && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 overflow-x-auto">
                            <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                                Iconos sugeridos:
                            </span>
                            {COMMON_SOURCE_ICONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setNewSourceIcon(emoji)}
                                    className={`px-2 py-1 text-sm rounded-lg hover:bg-white transition-all cursor-pointer ${
                                        newSourceIcon === emoji ? 'bg-white shadow-xs border border-indigo-200' : ''
                                    }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Conteo filtrado */}
                    {sourceSearch && (
                        <div className="text-xs text-slate-500 font-medium flex items-center justify-between px-1">
                            <span>Mostrando <strong>{filteredSources.length}</strong> de {sources.length} orígenes</span>
                            <button onClick={() => setSourceSearch('')} className="text-indigo-600 hover:underline">Limpiar búsqueda</button>
                        </div>
                    )}

                    {/* Tabla de Orígenes */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                        {loadingSources ? (
                            <div className="p-12 flex items-center justify-center">
                                <div className="w-7 h-7 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                        ) : filteredSources.length === 0 ? (
                            <div className="p-12 text-center">
                                <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-xs font-bold text-slate-500">
                                    {sourceSearch ? 'No se encontraron orígenes con esa búsqueda' : 'No hay orígenes configurados'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredSources.map((source) => (
                                    <div
                                        key={source.id}
                                        className={`group flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-all ${
                                            !source.is_active ? 'opacity-50 bg-slate-50/30' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-sm shrink-0 border border-slate-200/70 shadow-2xs">
                                                {editingSourceId === source.id ? (
                                                    <input
                                                        value={editingSourceIcon}
                                                        onChange={(e) => setEditingSourceIcon(e.target.value)}
                                                        className="w-full text-center bg-white rounded font-bold"
                                                    />
                                                ) : (
                                                    source.icon || '📋'
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                {editingSourceId === source.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editingSourceName}
                                                        onChange={(e) => setEditingSourceName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateSource(source.id);
                                                            if (e.key === 'Escape') setEditingSourceId(null);
                                                        }}
                                                        className="w-full h-8 rounded-lg border-2 border-indigo-500 font-bold text-slate-800 bg-white px-2.5 outline-none text-xs"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-800 truncate">
                                                            {source.name}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                                            {source.slug}
                                                        </span>
                                                        {source.is_system && (
                                                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                Sistema
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isAdmin && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Switch Activo / Inactivo */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSourceActive(source)}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                                                        source.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                    title={source.is_active ? 'Desactivar origen' : 'Activar origen'}
                                                >
                                                    {source.is_active ? (
                                                        <>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span>Activo</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                            <span>Inactivo</span>
                                                        </>
                                                    )}
                                                </button>

                                                {editingSourceId === source.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateSource(source.id)}
                                                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-all cursor-pointer"
                                                            title="Guardar"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingSourceId(null)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 transition-all cursor-pointer"
                                                            title="Cancelar"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setEditingSourceId(source.id);
                                                                setEditingSourceName(source.name);
                                                                setEditingSourceIcon(source.icon || '📋');
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                                                            title="Editar origen"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        {!source.is_system ? (
                                                            <button
                                                                onClick={() => handleDeleteSource(source)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                                                title="Eliminar origen"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        ) : (
                                                            <span
                                                                className="p-1.5 text-slate-200 cursor-not-allowed"
                                                                title="Origen protegido del sistema"
                                                            >
                                                                <Shield className="w-3.5 h-3.5" />
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
