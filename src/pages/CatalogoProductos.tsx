import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Save, X, Search, Filter, Box, Layers, Zap, MoreVertical, ArrowUpDown, Tag, DollarSign, Check } from 'lucide-react';
import { pricingService } from '../services/pricing';
import type { PricingItem } from '../types/pricing';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { useItemTypes } from '../hooks/useItemTypes';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { useAriasTables } from '../hooks/useAriasTables';

export default function CatalogoProductos() {
    const { profile } = useAuth();
    const { isAdmin } = usePermissions();
    const { types, getName, getColor } = useItemTypes();
    const [items, setItems] = useState<PricingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    
    // Filters
    const [filterTipo, setFilterTipo] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'tipo', direction: 'asc' });

    const { tableRef, wrapperRef } = useAriasTables();
    const canEdit = isAdmin();

    // Default form data
    const [formData, setFormData] = useState<Partial<PricingItem>>({
        tipo: types[0]?.slug ?? 'modulo',
        nombre: '',
        codigo: '',
        precio_anual: 0,
        precio_mensual: 0,
        costo_unico: 0,
        activo: true,
        descripcion: '',
        min_dtes: 0,
        max_dtes: 0
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
            toast.error('Error al cargar el catálogo');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: PricingItem) => {
        setEditingId(item.id);
        setFormData(item);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        try {
            if (!canEdit) return toast.error('No tienes permisos');
            if (!formData.nombre?.trim()) return toast.error('El nombre es obligatorio');
            if (!profile?.company_id) return toast.error('Empresa no identificada');

            const { id, created_at, updated_at, ...updateData } = formData as any;

            if (editingId) {
                await pricingService.updatePricingItem(editingId, updateData);
                toast.success('✅ Producto actualizado exitosamente');
            } else {
                await pricingService.createPricingItem({
                    ...updateData,
                    company_id: profile.company_id,
                } as any);
                toast.success('✅ Producto creado exitosamente');
            }
            resetForm();
            loadItems();
        } catch (error: any) {
            toast.error(`❌ Error al guardar: ${error.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canEdit) return toast.error('No tienes permisos');
        if (!confirm('¿Archivar este producto? Dejará de estar disponible para nuevas cotizaciones.')) return;

        try {
            await pricingService.deletePricingItem(id); // Using soft delete approach from service
            toast.success('Producto archivado');
            loadItems();
        } catch (error) {
            toast.error('Error al archivar');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setShowForm(false);
        setFormData({
            tipo: types[0]?.slug ?? 'modulo',
            nombre: '',
            codigo: '',
            precio_anual: 0,
            precio_mensual: 0,
            costo_unico: 0,
            activo: true,
            descripcion: '',
            min_dtes: 0,
            max_dtes: 0
        });
    };

    // Derived Data
    const filteredItems = items
        .filter(item => filterTipo === 'all' || item.tipo === filterTipo)
        .filter(item => 
            searchTerm === '' || 
            item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (item.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const valA = (a as any)[sortConfig.key] ?? '';
            const valB = (b as any)[sortConfig.key] ?? '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    // Premium UI Render
    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            {/* Header premium */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-[24px] border border-gray-100 shadow-sm relative overflow-hidden">
                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Box className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Catálogo de Productos</h1>
                    </div>
                    <p className="text-gray-500 font-medium ml-14">Gestión unificada de planes, servicios y módulos para cotizaciones.</p>
                </div>
                
                {canEdit && !showForm && (
                    <Button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="mt-6 md:mt-0 bg-[#0f172a] hover:bg-gray-800 text-white shadow-xl shadow-gray-900/20 rounded-xl px-6 py-2.5 relative z-10 transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        <span className="font-bold">Nuevo Producto</span>
                    </Button>
                )}
            </div>

            {/* Formulario Inline (Estilo Slide-down Premium) */}
            {showForm && (
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-xl shadow-blue-900/5 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-gradient-to-r from-[#f8fafc] to-white border-b border-gray-100 p-6 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                {editingId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">
                                    {editingId ? 'Editar Producto' : 'Crear Nuevo Producto'}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">Configura los detalles comerciales y de facturación</p>
                            </div>
                        </div>
                        <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Columna Izquierda: Info General */}
                            <div className="lg:col-span-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-gray-400" /> Nombre del Producto <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={formData.nombre}
                                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                            placeholder="Ej. Sistema ERP Pro, Licencia Mensual..."
                                            className="h-12 text-lg font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-gray-400" /> Tipo / Categoría
                                        </label>
                                        <select
                                            value={formData.tipo}
                                            onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                                            className="w-full h-12 border border-gray-200 rounded-xl px-4 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold text-gray-700"
                                        >
                                            {types.map(t => (
                                                <option key={t.slug} value={t.slug}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-gray-700">Descripción Comercial</label>
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-gray-600 bg-gray-50/50 focus:bg-white"
                                        rows={3}
                                        placeholder="Descripción visible en las cotizaciones para el cliente final..."
                                    />
                                </div>
                                
                                {formData.tipo === 'plan' && (
                                    <div className="bg-amber-50 rounded-xl border border-amber-100 p-5">
                                        <h4 className="text-sm font-bold text-amber-800 mb-4 flex items-center gap-2">
                                            <Zap className="w-4 h-4" /> Configuración de Volumen (Rango DTEs)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-amber-700 mb-1 block">Volumen Mínimo</label>
                                                <Input type="number" value={formData.min_dtes} onChange={e => setFormData({...formData, min_dtes: Number(e.target.value)})} className="bg-white border-amber-200" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-amber-700 mb-1 block">Volumen Máximo</label>
                                                <Input type="number" value={formData.max_dtes} onChange={e => setFormData({...formData, max_dtes: Number(e.target.value)})} className="bg-white border-amber-200" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Columna Derecha: Pricing & Settings */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                    <h4 className="text-sm font-black text-gray-900 mb-5 flex items-center gap-2 uppercase tracking-wider">
                                        <DollarSign className="w-4 h-4 text-green-500" /> Modelos de Precio
                                    </h4>
                                    
                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Precio de Lista Anual ($)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                <Input type="number" value={formData.precio_anual} onChange={(e) => setFormData({ ...formData, precio_anual: Number(e.target.value) })} className="pl-8 text-lg font-black text-gray-900 bg-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Precio Mensual ($)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                <Input type="number" value={formData.precio_mensual} onChange={(e) => setFormData({ ...formData, precio_mensual: Number(e.target.value) })} className="pl-8 text-lg font-black text-gray-900 bg-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Costo Único / Implementación ($)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                <Input type="number" value={formData.costo_unico} onChange={(e) => setFormData({ ...formData, costo_unico: Number(e.target.value) })} className="pl-8 font-bold bg-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">SKU / Código Interno (Opcional)</label>
                                            <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="Ej. SKU-123" className="uppercase font-mono text-sm bg-white" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">Estado del Producto</p>
                                        <p className="text-xs text-gray-500">Disponible para cotizar</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                        <Button onClick={resetForm} variant="outline" className="px-6 rounded-xl font-bold bg-white">
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} className="bg-[#007BFF] hover:bg-blue-600 text-white px-8 rounded-xl shadow-lg shadow-blue-500/30">
                            <Save className="w-4 h-4 mr-2" />
                            <span className="font-bold">Guardar Producto</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* Filtros y Buscador Premium */}
            <div className="bg-white rounded-[20px] p-2 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-2">
                <div className="flex-1 flex items-center bg-gray-50 rounded-[16px] px-4 py-2 border border-gray-200/60 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, código o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent border-none outline-none px-3 text-sm font-medium text-gray-700 placeholder:text-gray-400"
                    />
                </div>
                
                <div className="flex flex-wrap gap-1 md:w-auto p-1 bg-gray-50 rounded-[16px] border border-gray-200/60 overflow-hidden">
                    <button
                        onClick={() => setFilterTipo('all')}
                        className={`px-4 py-2 rounded-[12px] text-xs font-bold transition-all ${filterTipo === 'all' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos ({items.length})
                    </button>
                    {types.map(t => {
                        const count = items.filter(i => i.tipo === t.slug).length;
                        return (
                            <button
                                key={t.slug}
                                onClick={() => setFilterTipo(t.slug)}
                                className={`px-4 py-2 rounded-[12px] text-xs font-bold transition-all flex items-center gap-1.5`}
                                style={filterTipo === t.slug ? {
                                    backgroundColor: t.color,
                                    color: 'white',
                                    boxShadow: `0 4px 12px ${t.color}40`,
                                } : {
                                    color: t.color,
                                    opacity: 0.8
                                }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {t.name} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabla Principal */}
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No se encontraron productos</h3>
                        <p className="text-gray-500 text-sm mt-1">Ajusta tus filtros o crea un nuevo ítem en el catálogo.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-700" onClick={() => setSortConfig({ key: 'nombre', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                                        <div className="flex items-center gap-1">Producto <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Anual</th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Mensual</th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Único</th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 mt-0.5">
                                                    <Box className="w-4 h-4 text-gray-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">{item.nombre}</p>
                                                        {item.codigo && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono font-bold tracking-wider">{item.codigo}</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-sm" title={item.descripcion}>{item.descripcion || <span className="italic opacity-50">Sin descripción</span>}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span 
                                                className="px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide"
                                                style={{ backgroundColor: `${getColor(item.tipo)}15`, color: getColor(item.tipo) }}
                                            >
                                                {getName(item.tipo)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <span className="text-sm font-black text-gray-900">${(item.precio_anual || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <span className="text-sm font-bold text-gray-500">${(item.precio_mensual || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <span className="text-sm font-bold text-gray-400">${(item.costo_unico || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex justify-center">
                                                {item.activo ? (
                                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Activo" />
                                                ) : (
                                                    <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" title="Inactivo" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {canEdit && (
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
