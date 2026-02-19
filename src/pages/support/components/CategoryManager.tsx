import { useState } from 'react';
import { X, Plus, Edit2, Trash2, Save, RefreshCw, Tag } from 'lucide-react';
import { ticketService, type TicketCategory } from '../../../services/tickets';
import toast from 'react-hot-toast';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#6B7280'];

interface Props {
    categories: TicketCategory[];
    companyId: string;
    onClose: () => void;
    onChanged: (cats: TicketCategory[]) => void;
}

export function CategoryManager({ categories, companyId, onClose, onChanged }: Props) {
    const [cats, setCats] = useState<TicketCategory[]>(categories);
    const [editing, setEditing] = useState<string | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', color: '#6366F1', sla_hours: 24 });

    function startNew() {
        setIsNew(true); setEditing(null);
        setForm({ name: '', description: '', color: COLORS[cats.length % COLORS.length], sla_hours: 24 });
    }

    function startEdit(c: TicketCategory) {
        setIsNew(false); setEditing(c.id);
        setForm({ name: c.name, description: c.description || '', color: c.color, sla_hours: c.sla_hours });
    }

    async function saveNew() {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const created = await ticketService.createCategory(companyId, { name: form.name.trim(), description: form.description || null, color: form.color, sla_hours: form.sla_hours });
            const next = [...cats, created];
            setCats(next); onChanged(next); setIsNew(false);
            toast.success('Categoría creada');
        } catch { toast.error('Error al crear'); }
        finally { setSaving(false); }
    }

    async function saveEdit() {
        if (!editing || !form.name.trim()) return;
        setSaving(true);
        try {
            const updated = await ticketService.updateCategory(editing, { name: form.name.trim(), description: form.description || null, color: form.color, sla_hours: form.sla_hours });
            const next = cats.map(c => c.id === editing ? updated : c);
            setCats(next); onChanged(next); setEditing(null);
            toast.success('Categoría actualizada');
        } catch { toast.error('Error al actualizar'); }
        finally { setSaving(false); }
    }

    async function del(id: string) {
        if (!confirm('¿Eliminar esta categoría?')) return;
        try {
            await ticketService.deleteCategory(id);
            const next = cats.filter(c => c.id !== id);
            setCats(next); onChanged(next);
            toast.success('Categoría eliminada');
        } catch { toast.error('No se pudo eliminar (puede tener tickets asignados)'); }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200"><Tag className="w-5 h-5 text-white" /></div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900">Gestionar Categorías</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">IT · Comercial · Facturación · etc.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-xl text-gray-400"><X className="w-5 h-5" /></button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cats.map(c => (
                        <div key={c.id}>
                            {editing === c.id ? (
                                <CategoryForm form={form} setForm={setForm} saving={saving} onSave={saveEdit} onCancel={() => setEditing(null)} />
                            ) : (
                                <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all group">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-gray-900">{c.name}</p>
                                        <p className="text-[10px] text-gray-400">SLA: {c.sla_hours}h · {c.description || 'Sin descripción'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => startEdit(c)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => del(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {cats.length === 0 && !isNew && (
                        <div className="text-center py-10">
                            <Tag className="w-10 h-10 text-gray-100 mx-auto mb-3" />
                            <p className="text-sm font-bold text-gray-300">Sin categorías todavía</p>
                            <p className="text-[10px] text-gray-200 uppercase font-black mt-1">Crea tu primera categoría</p>
                        </div>
                    )}

                    {isNew && (
                        <div className="border-2 border-indigo-200 border-dashed rounded-2xl p-4">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Nueva Categoría</p>
                            <CategoryForm form={form} setForm={setForm} saving={saving} onSave={saveNew} onCancel={() => setIsNew(false)} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isNew && (
                    <div className="px-4 py-4 border-t border-gray-100 bg-gray-50/60">
                        <button onClick={startNew} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 text-indigo-600 font-bold py-2.5 rounded-2xl hover:bg-indigo-50 transition-all text-sm">
                            <Plus className="w-4 h-4" />Nueva Categoría
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function CategoryForm({ form, setForm, saving, onSave, onCancel }: {
    form: { name: string; description: string; color: string; sla_hours: number };
    setForm: (f: any) => void;
    saving: boolean;
    onSave: () => void;
    onCancel: () => void;
}) {
    const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#6B7280'];
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nombre *</label>
                    <input className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-400/30" placeholder="Ej: IT, Comercial..." value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">SLA (horas)</label>
                    <input type="number" min={1} className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-400/30" value={form.sla_hours} onChange={e => setForm((p: any) => ({ ...p, sla_hours: parseInt(e.target.value) || 24 }))} />
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Descripción</label>
                <input className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-400/30" placeholder="Descripción corta..." value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Color</label>
                <div className="flex gap-1.5 flex-wrap">
                    {COLORS.map(col => (
                        <button key={col} onClick={() => setForm((p: any) => ({ ...p, color: col }))} className={`w-6 h-6 rounded-full transition-all ${form.color === col ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} style={{ backgroundColor: col }} />
                    ))}
                </div>
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={onCancel} className="flex-1 py-2 text-xs font-black text-gray-400 hover:text-gray-600 bg-gray-100 rounded-xl transition-all">Cancelar</button>
                <button onClick={onSave} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50 transition-all">
                    {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                </button>
            </div>
        </div>
    );
}
