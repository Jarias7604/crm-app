import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Building2, Info, Search, Sparkles } from 'lucide-react';
import { industriesService } from '../../services/industries';
import type { Industry } from '../../types';
import toast from 'react-hot-toast';

interface ManageIndustriesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onIndustriesChanged?: () => void;
}

export function ManageIndustriesModal({ isOpen, onClose, onIndustriesChanged }: ManageIndustriesModalProps) {
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadIndustries();
        }
    }, [isOpen]);

    const loadIndustries = async () => {
        setLoading(true);
        try {
            const data = await industriesService.getAllIndustries();
            setIndustries(data || []);
        } catch {
            toast.error('Error al cargar rubros');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('El nombre del rubro es obligatorio');

        setSaving(true);
        try {
            const maxOrder = industries.length > 0
                ? Math.max(...industries.map(i => i.display_order))
                : 0;
            await industriesService.createIndustry(name.trim(), maxOrder + 1);
            setName('');
            toast.success('✅ Rubro creado exitosamente');
            await loadIndustries();
            if (onIndustriesChanged) onIndustriesChanged();
        } catch (error: any) {
            toast.error(`Error al crear rubro: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (industry: Industry) => {
        if (!confirm(`¿Eliminar el rubro "${industry.name}"? Los prospectos asociados conservarán este valor.`)) return;

        try {
            await industriesService.deleteIndustry(industry.id);
            toast.success('🗑️ Rubro eliminado');
            await loadIndustries();
            if (onIndustriesChanged) onIndustriesChanged();
        } catch (error: any) {
            toast.error(`Error al eliminar: ${error.message}`);
        }
    };

    const filteredIndustries = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return industries;
        return industries.filter(i => i.name.toLowerCase().includes(q));
    }, [industries, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Box */}
            <div className="relative w-full max-w-[520px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 m-4">
                
                {/* Header */}
                <div className="h-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Gestionar Rubros / Industrias</h3>
                            <p className="text-[11px] text-white/80">Sectores comerciales para clasificar prospectos</p>
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
                            Nuevo Rubro / Industria
                        </h4>
                        
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre del Rubro *</label>
                            <input
                                required
                                type="text"
                                placeholder="Ej: Laboratorio Clínico, Restaurante, Ferretería..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-11 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-semibold text-gray-900 bg-white px-4 outline-none transition-all text-sm placeholder:text-gray-300"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Agregar Rubro'}
                        </button>
                    </form>

                    {/* Industries List with Search */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                Rubros Registrados ({filteredIndustries.length})
                            </h4>
                        </div>

                        {/* Buscador con lupa */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar rubro por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-xs font-semibold text-slate-800 bg-white placeholder:text-slate-400 outline-none"
                            />
                        </div>
                        
                        {loading ? (
                            <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando rubros...</div>
                        ) : filteredIndustries.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-4">
                                <Info className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-xs font-bold text-slate-400">No se encontraron rubros</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto border border-slate-200/60 rounded-2xl bg-white shadow-sm custom-scrollbar">
                                {filteredIndustries.map((ind) => (
                                    <div key={ind.id} className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                🏢
                                            </span>
                                            <p className="text-sm font-bold text-slate-800 truncate">
                                                {ind.name}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(ind)}
                                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
                                            title="Eliminar rubro"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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
