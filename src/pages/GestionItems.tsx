import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Search, Copy } from 'lucide-react';
import { cotizadorService, type CotizadorItem } from '../services/cotizador';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function GestionItems() {
    const { profile } = useAuth();
    const { hasPermission } = usePermissions();
    const [items, setItems] = useState<CotizadorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState<string>('all');

    const [formData, setFormData] = useState<Partial<CotizadorItem>>({
        tipo: 'modulo',
        nombre: '',
        codigo: '',
        pago_unico: 0,
        precio_anual: 0,
        precio_mensual: 0,
        precio_por_dte: 0,
        incluye_en_paquete: false,
        activo: true,
        orden: 0,
        descripcion: '',
        metadata: {}
    });

    const canEdit = hasPermission('cotizaciones.edit_prices');

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            setLoading(true);
            const data = await cotizadorService.getAllItems(true);
            setItems(data);
        } catch (error) {
            console.error('Error loading items:', error);
            toast.error('Error al cargar items');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: CotizadorItem) => {
        setEditingId(item.id);
        setFormData(item);
        setShowNewForm(false);
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
                await cotizadorService.updateItem(editingId, updateData);
                toast.success('✅ Item actualizado');
            } else {
                if (profile?.role === 'company_admin') {
                    updateData.company_id = profile.company_id;
                }
                await cotizadorService.createItem(updateData);
                toast.success('✅ Item creado');
            }
            resetForm();
            loadItems();
        } catch (error: any) {
            console.error('Error saving item:', error);
            const errorMsg = error.message || 'Error desconocido';
            toast.error(`❌ Error al guardar: ${errorMsg}`);
        }
    };

    const handleClone = async (item: CotizadorItem) => {
        try {
            if (!canEdit) {
                toast.error('No tienes permisos para realizar esta acción');
                return;
            }

            const { id, created_at, updated_at, company_id, ...cloneData } = item as any;

            // Forzar el company_id del usuario actual
            cloneData.company_id = profile?.company_id;
            cloneData.nombre = `${cloneData.nombre} (Copia)`;

            await cotizadorService.createItem(cloneData);
            toast.success('✅ Item clonado exitosamente. Ahora puedes editar tu copia.');
            loadItems();
        } catch (error: any) {
            console.error('Error cloning item:', error);
            toast.error('Error al clonar el item.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!canEdit) {
            toast.error('No tienes permisos para realizar esta acción');
            return;
        }

        if (!confirm('¿Desactivar este item?')) return;

        try {
            await cotizadorService.deleteItem(id);
            toast.success('Item desactivado');
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
            codigo: '',
            pago_unico: 0,
            precio_anual: 0,
            precio_mensual: 0,
            precio_por_dte: 0,
            incluye_en_paquete: false,
            activo: true,
            orden: 0,
            descripcion: '',
            metadata: {}
        });
    };

    const getTipoBadge = (tipo: string) => {
        switch (tipo) {
            case 'modulo':
                return 'bg-purple-100 text-purple-700';
            case 'servicio':
                return 'bg-green-100 text-green-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const itemsFiltrados = items.filter(item => {
        const matchSearch = searchTerm === '' ||
            item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.codigo && item.codigo.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchFilter = filterTipo === 'all' || item.tipo === filterTipo;

        return matchSearch && matchFilter;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando items...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Gestión Item</h1>
                    <p className="text-gray-500 mt-1 font-medium">Configura módulos adicionales, servicios y addons del sistema.</p>
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
                        Agregar Item
                    </Button>
                )}
            </div>

            {/* Filtros y Búsqueda */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Buscar por nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterTipo('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterTipo === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterTipo('modulo')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterTipo === 'modulo'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Módulos
                        </button>
                        <button
                            onClick={() => setFilterTipo('servicio')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterTipo === 'servicio'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Servicios
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal para Nuevo Item Solamente */}
            <Modal
                isOpen={showNewForm}
                onClose={resetForm}
                title="➕ Nuevo Item"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Tipo *</label>
                        <select
                            value={formData.tipo}
                            onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 shadow-sm"
                        >
                            <option value="modulo">Módulo</option>
                            <option value="servicio">Servicio</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nombre *</label>
                        <Input
                            value={formData.nombre || ''}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                            placeholder="POS, WhatsApp, etc."
                            required
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

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Precio Anual ($)</label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.precio_anual || ''}
                            onChange={(e) => setFormData({ ...formData, precio_anual: Number(e.target.value) })}
                            placeholder="75.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Precio Mensual ($)</label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.precio_mensual || ''}
                            onChange={(e) => setFormData({ ...formData, precio_mensual: Number(e.target.value) })}
                            placeholder="7.50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Pago Único ($)</label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.pago_unico || ''}
                            onChange={(e) => setFormData({ ...formData, pago_unico: Number(e.target.value) })}
                            placeholder="25.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Precio por DTE ($)
                        </label>
                        <Input
                            type="number"
                            step="0.0001"
                            value={formData.precio_por_dte || ''}
                            onChange={(e) => setFormData({ ...formData, precio_por_dte: Number(e.target.value) })}
                            placeholder="0.03"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Orden</label>
                        <Input
                            type="number"
                            value={formData.orden || 0}
                            onChange={(e) => setFormData({ ...formData, orden: Number(e.target.value) })}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Descripción</label>
                        <textarea
                            value={formData.descripcion || ''}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 shadow-sm"
                            rows={2}
                            placeholder="Descripción del item..."
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.activo !== false}
                                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">Activo</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.incluye_en_paquete === true}
                                onChange={(e) => setFormData({ ...formData, incluye_en_paquete: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">Incluido en paquete</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <Button onClick={resetForm} variant="outline">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        Crear Item
                    </Button>
                </div>
            </Modal>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[#F5F7FA]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Nombre</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Precio Anual</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Precio Mensual</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Pago Único</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Precio/DTE</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase">Estado</th>
                                {canEdit && (
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Acciones</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {itemsFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 8 : 7} className="px-6 py-12 text-center text-gray-400">
                                        No hay items que coincidan con tu búsqueda
                                    </td>
                                </tr>
                            ) : (
                                itemsFiltrados.map((item) => (
                                    editingId === item.id ? (
                                        <tr key={item.id} className="bg-blue-50/50 ring-2 ring-blue-500 ring-inset">
                                            <td className="px-6 py-4">
                                                <select
                                                    value={formData.tipo}
                                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                                                    className={`w-full border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold ${getTipoBadge(formData.tipo || 'modulo')}`}
                                                >
                                                    <option value="modulo">Módulo</option>
                                                    <option value="servicio">Servicio</option>
                                                    <option value="otro">Otro</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formData.nombre}
                                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                                    className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold text-[#4449AA]"
                                                    placeholder="Nombre..."
                                                />
                                                <input
                                                    type="text"
                                                    value={formData.codigo}
                                                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                                    className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1 text-xs font-mono"
                                                    placeholder="Código..."
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.precio_anual}
                                                    onChange={(e) => setFormData({ ...formData, precio_anual: Number(e.target.value) })}
                                                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.precio_mensual}
                                                    onChange={(e) => setFormData({ ...formData, precio_mensual: Number(e.target.value) })}
                                                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.pago_unico}
                                                    onChange={(e) => setFormData({ ...formData, pago_unico: Number(e.target.value) })}
                                                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    value={formData.precio_por_dte}
                                                    onChange={(e) => setFormData({ ...formData, precio_por_dte: Number(e.target.value) })}
                                                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs text-green-600 text-right"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.activo}
                                                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={handleSave}
                                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg shadow-sm bg-white"
                                                        title="Guardar"
                                                    >
                                                        <Save className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={resetForm}
                                                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg bg-white"
                                                        title="Cancelar"
                                                    >
                                                        <Plus className="w-5 h-5 transform rotate-45" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getTipoBadge(item.tipo)}`}>
                                                    {item.tipo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-sm font-bold text-[#4449AA]">{item.nombre}</p>
                                                    {item.codigo && (
                                                        <p className="text-xs text-gray-500 font-mono">{item.codigo}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-semibold text-gray-700">
                                                    {item.precio_anual > 0 ? `$${item.precio_anual.toFixed(2)}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-semibold text-gray-700">
                                                    {item.precio_mensual > 0 ? `$${item.precio_mensual.toFixed(2)}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-semibold text-gray-700">
                                                    {item.pago_unico > 0 ? `$${item.pago_unico.toFixed(2)}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-semibold text-green-600">
                                                    {item.precio_por_dte > 0 ? `$${item.precio_por_dte.toFixed(4)}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-bold ${item.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}
                                                >
                                                    {item.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            {canEdit && (
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {profile?.role === 'super_admin' || item.company_id !== null ? (
                                                            <button
                                                                onClick={() => handleEdit(item)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    disabled
                                                                    className="p-2 text-gray-300 cursor-not-allowed"
                                                                    title="No tienes permisos para editar items globales"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleClone(item)}
                                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                    title="Clonar para mi empresa"
                                                                >
                                                                    <Copy className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {(profile?.role === 'super_admin' || item.company_id !== null) && (
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Desactivar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Items</p>
                    <p className="text-2xl font-extrabold text-[#4449AA] mt-1">{items.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Módulos</p>
                    <p className="text-2xl font-extrabold text-purple-600 mt-1">
                        {items.filter(i => i.tipo === 'modulo').length}
                    </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Servicios</p>
                    <p className="text-2xl font-extrabold text-green-600 mt-1">
                        {items.filter(i => i.tipo === 'servicio').length}
                    </p>
                </div>
            </div>
        </div>
    );
}
