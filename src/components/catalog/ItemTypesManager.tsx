import { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Lock, Tag } from 'lucide-react';
import { itemTypesService, pickColor, type CatalogItemType } from '../../services/itemTypes';
import { useItemTypes } from '../../hooks/useItemTypes';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../hooks/usePermissions';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';

interface ItemTypesManagerProps {
    /** Callback so parent pages can reload after changes */
    onChanged?: () => void;
}

const PRESET_COLORS = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F97316',
    '#EF4444', '#14B8A6', '#F59E0B', '#6366F1',
    '#EC4899', '#84CC16', '#0EA5E9', '#D946EF',
];

export function ItemTypesManager({ onChanged }: ItemTypesManagerProps) {
    const { profile } = useAuth();
    const { isAdmin } = usePermissions();
    const { systemTypes, companyTypes, loading, reload } = useItemTypes({ includeInactive: true });

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const canManage = isAdmin();
    if (!canManage) return null;

    const handleOpenNew = () => {
        setEditingId(null);
        setFormName('');
        const nextColor = pickColor(companyTypes.length);
        setFormColor(nextColor);
        setShowForm(true);
    };

    const handleOpenEdit = (type: CatalogItemType) => {
        setEditingId(type.id);
        setFormName(type.name);
        setFormColor(type.color);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormName('');
    };

    const handleSave = async () => {
        const name = formName.trim();
        if (!name) { toast.error('El nombre es obligatorio'); return; }
        if (!profile?.company_id) return;

        setSaving(true);
        try {
            if (editingId) {
                await itemTypesService.update(editingId, { name, color: formColor });
                toast.success('✅ Tipo actualizado');
            } else {
                await itemTypesService.create({ name, color: formColor, icon: 'tag', is_active: true, sort_order: companyTypes.length + 1 }, profile.company_id);
                toast.success('✅ Tipo creado');
            }
            await reload();
            onChanged?.();
            handleCancel();
        } catch (err: any) {
            toast.error(`Error: ${err.message || 'No se pudo guardar'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (type: CatalogItemType) => {
        if (!confirm(`¿Desactivar el tipo "${type.name}"? Los ítems existentes de este tipo no se verán afectados.`)) return;
        try {
            await itemTypesService.deactivate(type.id);
            toast.success('Tipo desactivado');
            await reload();
            onChanged?.();
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        }
    };

    const handleReactivate = async (type: CatalogItemType) => {
        try {
            await itemTypesService.reactivate(type.id);
            toast.success('Tipo reactivado');
            await reload();
            onChanged?.();
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Tag className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">Tipos de Ítem</h3>
                        <p className="text-xs text-gray-500">Personaliza las categorías para tu empresa</p>
                    </div>
                </div>
                <Button
                    onClick={handleOpenNew}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 h-auto"
                >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nuevo Tipo
                </Button>
            </div>

            <div className="p-4 space-y-4">
                {/* System Types — only visible when super_admin sees them */}
                {systemTypes.length > 0 && (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Tipos del Sistema (No editables)
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {systemTypes.map(t => (
                            <span
                                key={t.id}
                                className="px-3 py-1 rounded-full text-xs font-bold border"
                                style={{
                                    backgroundColor: `${t.color}15`,
                                    color: t.color,
                                    borderColor: `${t.color}30`,
                                }}
                            >
                                {t.name}
                            </span>
                        ))}
                    </div>
                </div>
                )}

                {/* Company Custom Types */}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                        Tipos de tu Empresa
                    </p>
                    {loading ? (
                        <div className="text-xs text-gray-400 py-2">Cargando...</div>
                    ) : companyTypes.length === 0 ? (
                        <div className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">
                            No has creado tipos personalizados aún.
                            <br />
                            <span className="font-semibold text-indigo-500 cursor-pointer" onClick={handleOpenNew}>+ Crear mi primer tipo</span>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {companyTypes.map(t => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/50 group hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: t.color }}
                                        />
                                        <span className={`text-sm font-semibold ${t.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                                            {t.name}
                                        </span>
                                        {!t.is_active && (
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">inactivo</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenEdit(t)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        {t.is_active ? (
                                            <button
                                                onClick={() => handleDelete(t)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Desactivar"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleReactivate(t)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-xs font-bold"
                                                title="Reactivar"
                                            >
                                                ↺
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inline Form */}
                {showForm && (
                    <div className="border-2 border-indigo-200 rounded-xl p-4 bg-indigo-50/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-indigo-700">
                                {editingId ? 'Editar tipo' : 'Nuevo tipo personalizado'}
                            </p>
                            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Nombre del tipo *</label>
                            <Input
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="Ej: Carro Sedán, Diseño Gráfico, Consultoría..."
                                className="text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">Color del badge</label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setFormColor(c)}
                                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: formColor === c ? '#1e293b' : 'transparent',
                                            boxShadow: formColor === c ? '0 0 0 2px white, 0 0 0 3px #1e293b' : 'none',
                                        }}
                                        title={c}
                                    />
                                ))}
                            </div>
                            {/* Preview */}
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-gray-500">Vista previa:</span>
                                <span
                                    className="px-3 py-1 rounded-full text-xs font-bold border"
                                    style={{
                                        backgroundColor: `${formColor}15`,
                                        color: formColor,
                                        borderColor: `${formColor}30`,
                                    }}
                                >
                                    {formName || 'Mi Tipo'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 h-8"
                            >
                                <Save className="w-3.5 h-3.5 mr-1" />
                                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Tipo'}
                            </Button>
                            <Button onClick={handleCancel} variant="outline" className="text-xs px-4 h-8">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
