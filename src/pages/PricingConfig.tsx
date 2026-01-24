import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, DollarSign, Package, Settings } from 'lucide-react';
import { pricingService } from '../services/pricing';
import type { PricingItem } from '../types/pricing';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

export default function PricingConfig() {
    const { profile } = useAuth();
    const { hasPermission } = usePermissions();
    const [items, setItems] = useState<PricingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [filterTipo, setFilterTipo] = useState<string>('all');

    const canEdit = hasPermission('cotizaciones.edit_prices');

    const [formData, setFormData] = useState<Partial<PricingItem>>({
        tipo: 'modulo',
        nombre: '',
        codigo: '',
        precio_anual: 0,
        precio_mensual: 0,
        costo_unico: 0,
        activo: true,
        descripcion: ''
    });

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            setLoading(true);
            const data = await pricingService.getAllPricingItems(true);
            setItems(data);
        } catch (error) {
            console.error('Error loading pricing items:', error);
            toast.error('Error al cargar la configuración de precios');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: PricingItem) => {
        setEditingId(item.id);
        setFormData(item);
        setShowNewForm(false);
        // Desplazar al formulario para que el usuario lo vea
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        try {
            if (!canEdit) {
                toast.error('No tienes permisos para realizar esta acción');
                return;
            }

            // Sanitizar datos: eliminar campos de sistema
            const { id, created_at, updated_at, ...updateData } = formData as any;

            if (editingId) {
                await pricingService.updatePricingItem(editingId, updateData);
                toast.success('✅ Ítem actualizado');
            } else {
                await pricingService.createPricingItem(updateData as any);
                toast.success('✅ Ítem creado');
            }
            resetForm();
            loadItems();
        } catch (error: any) {
            console.error('Error saving pricing item:', error);
            const errorMsg = error.message || 'Error desconocido';
            toast.error(`❌ Error al guardar: ${errorMsg}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canEdit) {
            toast.error('No tienes permisos para realizar esta acción');
            return;
        }
        if (!confirm('¿Desactivar este ítem?')) return;

        try {
            await pricingService.deletePricingItem(id);
            toast.success('Ítem desactivado');
            loadItems();
        } catch (error) {
            toast.error('Error al desactivar');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setShowNewForm(false);
        setFormData({
            tipo: 'modulo',
            nombre: '',
            codigo: '',
            precio_anual: 0,
            precio_mensual: 0,
            costo_unico: 0,
            activo: true,
            descripcion: ''
        });
    };

    const getTipoIcon = (tipo: string) => {
        switch (tipo) {
            case 'modulo': return <Package className="w-4 h-4 text-purple-600" />;
            case 'servicio': return <Settings className="w-4 h-4 text-green-600" />;
            case 'plan': return <DollarSign className="w-4 h-4 text-blue-600" />;
            case 'implementacion': return <Settings className="w-4 h-4 text-orange-600" />;
            default: return <Settings className="w-4 h-4 text-gray-600" />;
        }
    };

    const getTipoBadge = (tipo: string) => {
        switch (tipo) {
            case 'modulo': return 'bg-purple-100 text-purple-700';
            case 'servicio': return 'bg-green-100 text-green-700';
            case 'plan': return 'bg-blue-100 text-blue-700';
            case 'implementacion': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const filteredItems = items.filter(item => {
        if (filterTipo === 'all') return true;
        return item.tipo === filterTipo;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Gestión Precios</h1>
                    <p className="text-gray-500 mt-1 font-medium">Configuración maestra de precios, planes y servicios base.</p>
                </div>
                {canEdit && (
                    <Button
                        onClick={() => {
                            resetForm();
                            setShowNewForm(true);
                        }}
                        className="bg-[#007BFF] hover:bg-blue-600 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Ítem
                    </Button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex gap-2">
                    {['all', 'plan', 'modulo', 'servicio', 'implementacion'].map((tipo) => (
                        <button
                            key={tipo}
                            onClick={() => setFilterTipo(tipo)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${filterTipo === tipo
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {tipo === 'all' ? 'Todos' : tipo === 'implementacion' ? 'Implem.' : tipo + 's'}
                        </button>
                    ))}
                </div>
            </div>

            {(showNewForm || editingId) && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-[#4449AA]">
                            {editingId ? '✏️ Editar Ítem' : '➕ Nuevo Ítem'}
                        </h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Ítem</label>
                            <select
                                value={formData.tipo}
                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="plan">Plan</option>
                                <option value="modulo">Módulo</option>
                                <option value="servicio">Servicio</option>
                                <option value="implementacion">Implementación</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
                            <Input
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: Starter, E-commerce, etc."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Código</label>
                            <Input
                                value={formData.codigo}
                                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                placeholder="COD-001"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Precio Anual ($)</label>
                            <Input
                                type="number"
                                value={formData.precio_anual}
                                onChange={(e) => setFormData({ ...formData, precio_anual: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Precio Mensual ($)</label>
                            <Input
                                type="number"
                                value={formData.precio_mensual}
                                onChange={(e) => setFormData({ ...formData, precio_mensual: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Costo Único ($)</label>
                            <Input
                                type="number"
                                value={formData.costo_unico}
                                onChange={(e) => setFormData({ ...formData, costo_unico: Number(e.target.value) })}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción</label>
                            <textarea
                                value={formData.descripcion}
                                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                rows={2}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.activo}
                                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-semibold text-gray-700">Ítem Activo</span>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-8">
                        <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]">
                            <Save className="w-4 h-4 mr-2" />
                            Guardar
                        </Button>
                        <Button onClick={resetForm} variant="outline" className="min-w-[120px]">
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[#F5F7FA]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Anual</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Mensual</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Único</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        No hay ítems configurados para este tipo
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {getTipoIcon(item.tipo)}
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getTipoBadge(item.tipo)}`}>
                                                    {item.tipo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-extrabold text-[#4449AA]">{item.nombre}</p>
                                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{item.codigo || 'SIN CÓDIGO'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-gray-900">${(item.precio_anual || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-bold text-gray-600">${(item.precio_mensual || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-bold text-gray-600">${(item.costo_unico || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${item.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {item.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {canEdit && (
                                                <div className="flex items-center justify-end gap-2">
                                                    {profile?.role === 'super_admin' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(item)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Desactivar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            disabled
                                                            className="p-2 text-gray-300 cursor-not-allowed"
                                                            title="Solo el administrador del sistema puede editar estos precios base"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
