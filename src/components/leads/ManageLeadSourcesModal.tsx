import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Radio, Info, Search, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';
import { leadSourcesService, type LeadSource } from '../../services/leadSourcesService';
import toast from 'react-hot-toast';

interface ManageLeadSourcesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSourcesChanged?: () => void;
}

const COMMON_ICONS = ['📡', '📱', '💬', '📢', '🌐', '🤝', '🚗', '📞', '🎪', '📋', '🎯', '🤖', '📧'];

export function ManageLeadSourcesModal({ isOpen, onClose, onSourcesChanged }: ManageLeadSourcesModalProps) {
    const [sources, setSources] = useState<LeadSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('📡');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSources();
        }
    }, [isOpen]);

    const loadSources = async () => {
        setLoading(true);
        try {
            const data = await leadSourcesService.getAllSources();
            setSources(data || []);
        } catch {
            toast.error('Error al cargar orígenes');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('El nombre del origen es obligatorio');

        setSaving(true);
        try {
            await leadSourcesService.createSource({
                name: name.trim(),
                icon: selectedIcon,
            });
            setName('');
            toast.success('✅ Origen creado exitosamente');
            await loadSources();
            if (onSourcesChanged) onSourcesChanged();
        } catch (error: any) {
            toast.error(`Error al crear origen: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (source: LeadSource) => {
        try {
            await leadSourcesService.toggleActive(source.id, source.is_active);
            toast.success(source.is_active ? `"${source.name}" desactivado` : `"${source.name}" activado`);
            await loadSources();
            if (onSourcesChanged) onSourcesChanged();
        } catch {
            toast.error('Error al cambiar estado');
        }
    };

    const handleDelete = async (source: LeadSource) => {
        if (source.is_system) {
            toast.error('Los orígenes del sistema no se pueden eliminar. Puedes desactivarlo.');
            return;
        }
        if (!confirm(`¿Eliminar el origen "${source.name}"? Los prospectos existentes conservarán este dato.`)) return;

        try {
            await leadSourcesService.deleteSource(source.id);
            toast.success('🗑️ Origen eliminado');
            await loadSources();
            if (onSourcesChanged) onSourcesChanged();
        } catch (error: any) {
            toast.error(`Error al eliminar: ${error.message}`);
        }
    };

    const filteredSources = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return sources;
        return sources.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.slug.toLowerCase().includes(q) ||
            s.icon.includes(q)
        );
    }, [sources, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Box */}
            <div className="relative w-full max-w-[540px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 m-4">
                
                {/* Header */}
                <div className="h-16 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <Radio className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Gestionar Fuentes de Origen</h3>
                            <p className="text-[11px] text-white/80">Canales de captación para prospectos</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white cursor-pointer"
                    >
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Add Form */}
                    <form onSubmit={handleCreate} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3.5">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            Nuevo Origen de Lead
                        </h4>
                        
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre *</label>
                            <input
                                required
                                type="text"
                                placeholder="Ej: Meta Ads, TikTok, Agencia Partner..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-11 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-semibold text-gray-900 bg-white px-4 outline-none transition-all text-sm placeholder:text-gray-300"
                            />
                        </div>

                        {/* Preset Icon Selector */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ícono / Emoji</label>
                            <div className="flex items-center gap-1.5 flex-wrap bg-white p-2 rounded-xl border border-gray-200">
                                {COMMON_ICONS.map((ic) => (
                                    <button
                                        key={ic}
                                        type="button"
                                        onClick={() => setSelectedIcon(ic)}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-transform cursor-pointer ${
                                            selectedIcon === ic
                                                ? 'bg-indigo-600 text-white scale-110 shadow-sm'
                                                : 'hover:bg-slate-100 active:scale-95'
                                        }`}
                                    >
                                        {ic}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Agregar Origen'}
                        </button>
                    </form>

                    {/* Sources List with Search */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                Orígenes Disponibles ({filteredSources.length})
                            </h4>
                        </div>

                        {/* Buscador con lupa */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar origen con lupa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-xs font-semibold text-slate-800 bg-white placeholder:text-slate-400 outline-none"
                            />
                        </div>
                        
                        {loading ? (
                            <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando orígenes...</div>
                        ) : filteredSources.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-4">
                                <Info className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-xs font-bold text-slate-400">No se encontraron orígenes</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto border border-slate-200/60 rounded-2xl bg-white shadow-sm custom-scrollbar">
                                {filteredSources.map((source) => (
                                    <div key={source.id} className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">
                                                {source.icon}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                                                    {source.name}
                                                    {source.is_system && (
                                                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase">
                                                            Sistema
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-mono truncate">{source.slug}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(source)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                    source.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                                title={source.is_active ? 'Desactivar origen' : 'Activar origen'}
                                            >
                                                {source.is_active ? (
                                                    <ToggleRight className="w-4 h-4 text-emerald-600" />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4 text-slate-400" />
                                                )}
                                                <span>{source.is_active ? 'Activo' : 'Inactivo'}</span>
                                            </button>
                                            {!source.is_system && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(source)}
                                                    className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
                                                    title="Eliminar origen"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
