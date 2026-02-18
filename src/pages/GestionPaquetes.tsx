import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Search, Settings, Copy, ArrowUpDown } from 'lucide-react';
import { cotizadorService, type CotizadorPaquete } from '../services/cotizador';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { useAriasTables } from '../hooks/useAriasTables';

export default function GestionPaquetes() {
    const { profile } = useAuth();
    const { hasPermission } = usePermissions();
    const [paquetes, setPaquetes] = useState<CotizadorPaquete[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPaquete, setFilterPaquete] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const { tableRef: paqTableRef, wrapperRef: paqWrapperRef } = useAriasTables();

    const [formData, setFormData] = useState<Partial<CotizadorPaquete>>({
        paquete: 'STARTER',
        cantidad_dtes: 0,
        costo_implementacion: 0,
        costo_paquete_anual: 0,
        costo_paquete_mensual: 0,
        activo: true,
        orden: 0,
        descripcion: '',
        metadata: {}
    });

    // Permisos
    const canEdit = hasPermission('cotizaciones.edit_prices');

    useEffect(() => {
        loadPaquetes();
    }, []);

    const loadPaquetes = async () => {
        try {
            setLoading(true);
            const data = await cotizadorService.getAllPaquetes(true);
            setPaquetes(data);
        } catch (error) {
            console.error('Error loading paquetes:', error);
            toast.error('Error al cargar paquetes');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (paquete: CotizadorPaquete) => {
        setEditingId(paquete.id);
        setFormData(paquete);
        setShowNewForm(false);
    };

    const handleSave = async () => {
        try {
            if (!canEdit) {
                toast.error('No tienes permisos para realizar esta acción');
                return;
            }

            // Sanitizar datos: eliminar campos de sistema que no deben enviarse en el update
            const { id, created_at, updated_at, ...updateData } = formData as any;

            console.log('[GestionPaquetes] formData:', formData);
            console.log('[GestionPaquetes] updateData (lo que se envía):', updateData);
            console.log('[GestionPaquetes] descripcion en updateData:', updateData.descripcion);

            if (editingId) {
                console.log('[GestionPaquetes] Actualizando paquete ID:', editingId);
                await cotizadorService.updatePaquete(editingId, updateData);
                toast.success('✅ Paquete actualizado');
            } else {
                // Si es Company Admin, asignar company_id
                if (profile?.role === 'company_admin') {
                    updateData.company_id = profile.company_id;
                }
                await cotizadorService.createPaquete(updateData);
                toast.success('✅ Paquete creado');
            }
            resetForm();
            loadPaquetes();
        } catch (error: any) {
            console.error('Error saving package:', error);
            const errorMsg = error.message || 'Error desconocido';
            toast.error(`❌ Error al guardar: ${errorMsg}`);
        }
    };

    const handleClone = async (paquete: CotizadorPaquete) => {
        try {
            if (!canEdit) {
                toast.error('No tienes permisos para realizar esta acción');
                return;
            }

            const { id, created_at, updated_at, company_id, ...cloneData } = paquete as any;

            // Forzar el company_id del usuario actual
            cloneData.company_id = profile?.company_id;
            cloneData.paquete = `${cloneData.paquete} (Copia)`;

            await cotizadorService.createPaquete(cloneData);
            toast.success('✅ Paquete clonado exitosamente. Ahora puedes editar tu copia.');
            loadPaquetes();
        } catch (error: any) {
            console.error('Error cloning package:', error);
            toast.error('Error al clonar el paquete. Es posible que ya exista una copia con la misma cantidad de DTEs.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!canEdit) {
            toast.error('No tienes permisos para realizar esta acción');
            return;
        }

        if (!confirm('¿Desactivar este paquete?')) return;

        try {
            await cotizadorService.deletePaquete(id);
            toast.success('Paquete desactivado');
            loadPaquetes();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setShowNewForm(false);
        setFormData({
            paquete: 'STARTER',
            cantidad_dtes: 0,
            costo_implementacion: 0,
            costo_paquete_anual: 0,
            costo_paquete_mensual: 0,
            activo: true,
            orden: 0,
            descripcion: '',
            metadata: {}
        });
    };

    // Obtener lista única de nombres de paquetes
    const nombresPaquetes = Array.from(new Set(paquetes.map(p => p.paquete))).sort();

    // Filtrar paquetes
    const paquetesFiltrados = paquetes.filter(paq => {
        const matchSearch = searchTerm === '' ||
            paq.paquete.toLowerCase().includes(searchTerm.toLowerCase()) ||
            paq.cantidad_dtes.toString().includes(searchTerm);

        const matchFilter = filterPaquete === 'all' || paq.paquete === filterPaquete;

        return matchSearch && matchFilter;
    }).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const valA = (a as any)[key] ?? '';
        const valB = (b as any)[key] ?? '';
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando paquetes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Gestión Paquete</h1>
                    <p className="text-gray-500 mt-1 font-medium">Administra los paquetes comerciales y sus límites de DTEs.</p>
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
                        Agregar Paquete
                    </Button>
                )}
            </div>

            {/* Filtros y Búsqueda */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Búsqueda */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Buscar por nombre o cantidad de DTEs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Filtro por tipo de paquete */}
                    <div className="md:w-64">
                        <select
                            value={filterPaquete}
                            onChange={(e) => setFilterPaquete(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">Todos los paquetes</option>
                            {nombresPaquetes.map(nombre => (
                                <option key={nombre} value={nombre}>{nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>


            {/* Modal para Nuevo Paquete Solamente */}
            <Modal
                isOpen={showNewForm}
                onClose={resetForm}
                title="➕ Nuevo Paquete"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Nombre del Paquete *
                        </label>
                        <select
                            value={formData.paquete}
                            onChange={(e) => setFormData({ ...formData, paquete: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 shadow-sm"
                        >
                            <option value="BASIC">BASIC</option>
                            <option value="BASIC PLUS">BASIC PLUS</option>
                            <option value="STARTER">STARTER</option>
                            <option value="ESSENTIAL">ESSENTIAL</option>
                            <option value="PRO">PRO</option>
                            <option value="ENTERPRISE">ENTERPRISE</option>
                            <option value="ILIMITADO">ILIMITADO</option>
                            <option value="CUSTOM">CUSTOM</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Cantidad de DTEs *
                        </label>
                        <Input
                            type="number"
                            value={formData.cantidad_dtes || ''}
                            onChange={(e) => setFormData({ ...formData, cantidad_dtes: Number(e.target.value) })}
                            placeholder="Ej: 2200"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Costo Implementación ($)
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.costo_implementacion || ''}
                            onChange={(e) => setFormData({ ...formData, costo_implementacion: Number(e.target.value) })}
                            placeholder="100.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Costo Paquete Anual ($) *
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.costo_paquete_anual || ''}
                            onChange={(e) => setFormData({ ...formData, costo_paquete_anual: Number(e.target.value) })}
                            placeholder="295.00"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Costo Paquete Mensual ($) *
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.costo_paquete_mensual || ''}
                            onChange={(e) => setFormData({ ...formData, costo_paquete_mensual: Number(e.target.value) })}
                            placeholder="29.50"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Orden
                        </label>
                        <Input
                            type="number"
                            value={formData.orden || 0}
                            onChange={(e) => setFormData({ ...formData, orden: Number(e.target.value) })}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Descripción
                        </label>
                        <textarea
                            value={formData.descripcion || ''}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 shadow-sm"
                            rows={2}
                            placeholder="Descripción opcional del paquete..."
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.activo !== false}
                                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">Activo</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <Button onClick={resetForm} variant="outline">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Crear Paquete
                    </Button>
                </div>
            </Modal>

            {/* Tabla de Paquetes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div ref={paqWrapperRef} className="arias-table-wrapper">
                    <div ref={paqTableRef} className="arias-table">
                        <table className="min-w-full">
                            <thead className="bg-[#F5F7FA]">
                                <tr>
                                    {[
                                        { key: 'paquete', label: 'Paquete', align: 'text-left' },
                                        { key: 'cantidad_dtes', label: 'Cantidad DTEs', align: 'text-left' },
                                        { key: 'costo_anual', label: 'Costo Anual', align: 'text-right' },
                                        { key: 'costo_mensual', label: 'Costo Mensual', align: 'text-right' },
                                        { key: 'costo_implementacion', label: 'Implementación', align: 'text-right' },
                                        { key: 'activo', label: 'Estado', align: 'text-center' },
                                    ].map(col => (
                                        <th key={col.key} className={`px-6 py-3 ${col.align} text-xs font-bold text-gray-400 uppercase`}>
                                            <div
                                                className="cursor-pointer hover:text-[#4449AA] transition-colors group inline-flex items-center gap-1"
                                                onClick={() => setSortConfig({ key: col.key, direction: sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                                            >
                                                {col.label}
                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === col.key ? 'text-[#4449AA]' : 'text-gray-300 group-hover:text-[#4449AA]'} transition-all`} />
                                            </div>
                                        </th>
                                    ))}
                                    {canEdit && (
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paquetesFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={canEdit ? 7 : 6} className="px-6 py-12 text-center text-gray-400">
                                            No hay paquetes que coincidan con tu búsqueda
                                        </td>
                                    </tr>
                                ) : (
                                    paquetesFiltrados.map((paquete) =>
                                        editingId === paquete.id ? (
                                            <tr key={paquete.id} className="bg-blue-50/50 ring-2 ring-blue-500 ring-inset">
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={formData.paquete}
                                                        onChange={(e) => setFormData({ ...formData, paquete: e.target.value })}
                                                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold text-[#4449AA]"
                                                    >
                                                        <option value="BASIC">BASIC</option>
                                                        <option value="BASIC PLUS">BASIC PLUS</option>
                                                        <option value="STARTER">STARTER</option>
                                                        <option value="ESSENTIAL">ESSENTIAL</option>
                                                        <option value="PRO">PRO</option>
                                                        <option value="ENTERPRISE">ENTERPRISE</option>
                                                        <option value="ILIMITADO">ILIMITADO</option>
                                                        <option value="CUSTOM">CUSTOM</option>
                                                    </select>
                                                    <textarea
                                                        value={formData.descripcion || ''}
                                                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                                        className="w-full mt-2 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                                                        placeholder="Descripción..."
                                                        rows={2}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        value={formData.cantidad_dtes}
                                                        onChange={(e) => setFormData({ ...formData, cantidad_dtes: Number(e.target.value) })}
                                                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm font-semibold"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.costo_paquete_anual}
                                                        onChange={(e) => setFormData({ ...formData, costo_paquete_anual: Number(e.target.value) })}
                                                        className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold text-green-600 text-right"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.costo_paquete_mensual}
                                                        onChange={(e) => setFormData({ ...formData, costo_paquete_mensual: Number(e.target.value) })}
                                                        className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm font-semibold text-gray-700 text-right"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.costo_implementacion}
                                                        onChange={(e) => setFormData({ ...formData, costo_implementacion: Number(e.target.value) })}
                                                        className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm font-semibold text-gray-700 text-right"
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
                                            <tr key={paquete.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Settings className="w-5 h-5 text-blue-500" />
                                                        <div>
                                                            <p className="text-sm font-bold text-[#4449AA]">
                                                                {paquete.paquete}
                                                            </p>
                                                            {paquete.company_id && (
                                                                <span className="text-xs text-purple-600 font-semibold">
                                                                    Custom
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        {paquete.cantidad_dtes.toLocaleString()} DTEs
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-bold text-green-600">
                                                        ${paquete.costo_paquete_anual.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        ${paquete.costo_paquete_mensual.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        ${paquete.costo_implementacion.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-bold ${paquete.activo
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }`}
                                                    >
                                                        {paquete.activo ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                {canEdit && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {profile?.role === 'super_admin' || paquete.company_id !== null ? (
                                                                <button
                                                                    onClick={() => handleEdit(paquete)}
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
                                                                        title="No puedes editar paquetes globales"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleClone(paquete)}
                                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                        title="Clonar para mi empresa"
                                                                    >
                                                                        <Copy className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {(profile?.role === 'super_admin' || paquete.company_id !== null) && (
                                                                <button
                                                                    onClick={() => handleDelete(paquete.id)}
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
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Paquetes</p>
                    <p className="text-2xl font-extrabold text-[#4449AA] mt-1">
                        {paquetes.length}
                    </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Activos</p>
                    <p className="text-2xl font-extrabold text-green-600 mt-1">
                        {paquetes.filter(p => p.activo).length}
                    </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Tipos únicos</p>
                    <p className="text-2xl font-extrabold text-purple-600 mt-1">
                        {nombresPaquetes.length}
                    </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Rango DTEs</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">
                        {Math.min(...paquetes.map(p => p.cantidad_dtes)).toLocaleString()} - {' '}
                        {Math.max(...paquetes.map(p => p.cantidad_dtes)).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
