import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { industriesService } from '../../services/industries';
import type { Industry } from '../../types';
import { Plus, Pencil, Trash2, Check, X, Building2, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Industries() {
    const { profile } = useAuth();
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    useEffect(() => {
        loadIndustries();
    }, []);

    const loadIndustries = async () => {
        setLoading(true);
        try {
            const data = await industriesService.getIndustries();
            setIndustries(data);
        } catch (error) {
            toast.error('Error al cargar rubros');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            const maxOrder = industries.length > 0
                ? Math.max(...industries.map(i => i.display_order))
                : 0;
            await industriesService.createIndustry(newName.trim(), maxOrder + 1);
            setNewName('');
            toast.success('Rubro creado');
            loadIndustries();
        } catch (error) {
            toast.error('Error al crear rubro');
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editingName.trim()) return;
        try {
            await industriesService.updateIndustry(id, { name: editingName.trim() });
            setEditingId(null);
            setEditingName('');
            toast.success('Rubro actualizado');
            loadIndustries();
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await industriesService.deleteIndustry(id);
            toast.success('Rubro eliminado');
            loadIndustries();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rubros / Industrias</h1>
                        <p className="text-sm text-slate-400 font-medium">Configura los sectores disponibles para clasificar prospectos</p>
                    </div>
                </div>
            </div>

            {/* Create Form */}
            {isAdmin && (
                <form onSubmit={handleCreate} className="mb-6">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Nuevo rubro (ej: Tecnología, Manufactura...)"
                                className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!newName.trim()}
                            className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : industries.length === 0 ? (
                    <div className="p-12 text-center">
                        <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-sm font-bold text-gray-400">No hay rubros configurados</p>
                        <p className="text-xs text-gray-300 mt-1">Agrega el primer rubro arriba</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {industries.map((industry, index) => (
                            <div
                                key={industry.id}
                                className="group flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-all"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <GripVertical className="w-4 h-4 text-gray-200 shrink-0" />
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-black text-indigo-600">{index + 1}</span>
                                    </div>
                                    {editingId === industry.id ? (
                                        <input
                                            autoFocus
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdate(industry.id);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            className="flex-1 h-9 rounded-lg border-2 border-indigo-400 focus:ring-4 focus:ring-indigo-50 font-semibold text-gray-800 bg-white px-3 outline-none text-sm"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-800 truncate">{industry.name}</span>
                                    )}
                                </div>

                                {isAdmin && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        {editingId === industry.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdate(industry.id)}
                                                    className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-all"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(industry.id);
                                                        setEditingName(industry.name);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(industry.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
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

            {/* Info */}
            <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest mt-6">
                {industries.length} rubro{industries.length !== 1 ? 's' : ''} configurado{industries.length !== 1 ? 's' : ''}
            </p>
        </div>
    );
}
