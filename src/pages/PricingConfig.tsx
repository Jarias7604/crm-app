import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, DollarSign, Package, Settings } from 'lucide-react';
import { pricingService } from '../services/pricing';
import type { PricingItem } from '../types/pricing';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

export default function PricingConfig() {
    const [items, setItems] = useState<PricingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [filterTipo, setFilterTipo] = useState<string>('all');

    const [formData, setFormData] = useState<Partial<PricingItem>>({
        tipo: 'modulo',
        nombre: '',
        descripcion: '',
        codigo: '',
        precio_anual: 0,
        precio_mensual: 0,
        costo_unico: 0,
        min_dtes: 0,
        max_dtes: 0,
        precio_por_dte: 0,
        precio_base_dte: 0,
        formula_calculo: 'fijo',
        margen_ganancia: 0,
        mostrar_en_wizard: true,
        grupo: '',
        activo: true,
        predeterminado: false,
        orden: 0,
        metadata: {}
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
            toast.error('Error al cargar configuración de precios');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: PricingItem) => {
        setEditingId(item.id);
        setFormData(item);
        setShowNewForm(false);
    };

    const handleSave = async () => {
        try {
            if (editingId) {
                await pricingService.updatePricingItem(editingId, formData);
                toast.success('✅ Ítem actualizado');
            } else {
                await pricingService.createPricingItem(formData as any);
                toast.success('✅ Ítem creado');
            }
            resetForm();
            loadItems();
        } catch (error: any) {
            toast.error('Error al guardar');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Desactivar este ítem?')) return;

        try {
            await pricingService.deletePricingItem(id);
            toast.success('Ítem desactivado');
            loadItems();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setShowNewForm(false);
        setFormData({
            tipo: 'modulo',
            nombre: '',
            descripcion: '',
            codigo: '',
            precio_anual: 0,
            precio_mensual: 0,
            costo_unico: 0,
            min_dtes: 0,
            max_dtes: 0,
            precio_por_dte: 0,
            precio_base_dte: 0,
            formula_calculo: 'fijo',
            margen_ganancia: 0,
            mostrar_en_wizard: true,
            grupo: '',
            activo: true,
            predeterminado: false,
            orden: 0,
            metadata: {}
        });
    };

    const getTipoIcon = (tipo: string) => {
        switch (tipo) {
            case 'plan': return <Package className="w-5 h-5 text-blue-500" />;
            case 'modulo': return <Settings className="w-5 h-5 text-purple-500" />;
            case 'servicio': return <DollarSign className="w-5 h-5 text-green-500" />;
            default: return <DollarSign className="w-5 h-5 text-gray-500" />;
        }
    };

    const getTipoBadge = (tipo: string) => {
        const badges = {
            plan: 'bg-blue-100 text-blue-700',
            modulo: 'bg-purple-100 text-purple-700',
            servicio: 'bg-green-100 text-green-700',
            implementacion: 'bg-orange-100 text-orange-700'
        };
        return badges[tipo as keyof typeof badges] || 'bg-gray-100 text-gray-700';
    };

    const filteredItems = filterTipo === 'all'
        ? items
        : items.filter(i => i.tipo === filterTipo);

    if (loading) {
        return <div className="flex items-center justify-center h-96">Cargando...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Gestión Precios</h1>
                    <p className="text-gray-500 mt-1 font-medium">Configuración maestra de precios, planes y servicios base.</p>
                </div>
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
            </div>

            {/* Filtros */}
            <div className="flex gap-2">
                {['all', 'plan', 'modulo', 'servicio', 'implementacion'].map(tipo => (
                    <button
                        key={tipo}
                        onClick={() => setFilterTipo(tipo)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterTipo === tipo
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {tipo === 'all' ? 'Todos' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </button>
                ))}
            </div>

            {/* Formulario de Edición/Creación */}
            {(showNewForm || editingId) && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-[#4449AA]">
                            {editingId ? '✏️ Editar Ítem' : '➕ Nuevo Ítem'}
                        </h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo *</label>
                            <select
                                value={formData.tipo}
                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5"
                            >
                                <option value="plan">Plan</option>
                                <option value="modulo">Módulo</option>
                                <option value="servicio">Servicio</option>
                                <option value="implementacion">Implementación</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre *</label>
                            <Input
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: POS, BASIC, WhatsApp"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Código</label>
                            <Input
                                value={formData.codigo || ''}
                                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                placeholder="MOD_POS"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción</label>
                            <textarea
                                value={formData.descripcion || ''}
                                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5"
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Precio Anual ($)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.precio_anual}
                                onChange={(e) => setFormData({ ...formData, precio_anual: Number(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Precio Mensual ($)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.precio_mensual}
                                onChange={(e) => setFormData({ ...formData, precio_mensual: Number(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Costo Único ($)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.costo_unico}
                                onChange={(e) => setFormData({ ...formData, costo_unico: Number(e.target.value) })}
                            />
                        </div>

                        {formData.tipo === 'plan' && (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Min DTEs</label>
                                    <Input
                                        type="number"
                                        value={formData.min_dtes || 0}
                                        onChange={(e) => setFormData({ ...formData, min_dtes: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Max DTEs</label>
                                    <Input
                                        type="number"
                                        value={formData.max_dtes || 0}
                                        onChange={(e) => setFormData({ ...formData, max_dtes: Number(e.target.value) })}
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Precio por DTE ($)</label>
                            <Input
                                type="number"
                                step="0.0001"
                                value={formData.precio_por_dte}
                                onChange={(e) => setFormData({ ...formData, precio_por_dte: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-500 mt-1">Para servicios como WhatsApp</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">💡 Precio Base DTE ($)</label>
                            <Input
                                type="number"
                                step="0.0001"
                                value={formData.precio_base_dte || 0}
                                onChange={(e) => setFormData({ ...formData, precio_base_dte: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-500 mt-1">Costo base por cada DTE</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">📐 Fórmula de Cálculo</label>
                            <select
                                value={formData.formula_calculo || 'fijo'}
                                onChange={(e) => setFormData({ ...formData, formula_calculo: e.target.value as any })}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5"
                            >
                                <option value="fijo">Fijo (precio estándar)</option>
                                <option value="por_dte">Por DTE (se multiplica por DTEs)</option>
                                <option value="por_cantidad">Por Cantidad (se multiplica por unidades)</option>
                                <option value="personalizado">Personalizado</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Cómo se calcula el precio</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">💰 Margen de Ganancia (%)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.margen_ganancia || 0}
                                onChange={(e) => setFormData({ ...formData, margen_ganancia: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-500 mt-1">Porcentaje adicional sobre precio base</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">🏷️ Grupo/Categoría</label>
                            <Input
                                value={formData.grupo || ''}
                                onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                                placeholder="planes_principales, modulos_adicionales..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Organización en la UI</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Orden</label>
                            <Input
                                type="number"
                                value={formData.orden}
                                onChange={(e) => setFormData({ ...formData, orden: Number(e.target.value) })}
                            />
                        </div>

                        <div className="md:col-span-3 flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.activo}
                                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-gray-700">Activo</span>
                            </label>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.predeterminado}
                                    onChange={(e) => setFormData({ ...formData, predeterminado: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-gray-700">Predeterminado</span>
                            </label>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.mostrar_en_wizard !== false}
                                    onChange={(e) => setFormData({ ...formData, mostrar_en_wizard: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-gray-700">Mostrar en Wizard</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
                            <Save className="w-4 h-4 mr-2" />
                            Guardar
                        </Button>
                        <Button onClick={resetForm} variant="outline">
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}

            {/* Tabla de Ítems */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[#F5F7FA]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Precio Anual</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Precio Mensual</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Costo Único</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        No hay ítems configurados
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getTipoIcon(item.tipo)}
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getTipoBadge(item.tipo)}`}>
                                                    {item.tipo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-[#4449AA]">{item.nombre}</p>
                                            {item.descripcion && (
                                                <p className="text-xs text-gray-500 mt-1">{item.descripcion}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono text-gray-600">{item.codigo || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-semibold text-gray-700">
                                                ${item.precio_anual.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-semibold text-gray-700">
                                                ${item.precio_mensual.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-semibold text-gray-700">
                                                ${item.costo_unico.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {item.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
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
                                            </div>
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
