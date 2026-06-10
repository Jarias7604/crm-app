import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Search, Box, Layers, Zap, ArrowUpDown, Tag, DollarSign, Copy, Clock, Hash, RefreshCw, Repeat, ChevronDown, CheckCircle } from 'lucide-react';
import { pricingService } from '../services/pricing';
import type { PricingItem } from '../types/pricing';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { useItemTypes } from '../hooks/useItemTypes';
import { itemTypesService, pickColor } from '../services/itemTypes';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { useAriasTables } from '../hooks/useAriasTables';

const PRESET_COLORS = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F97316',
    '#EF4444', '#14B8A6', '#F59E0B', '#6366F1',
    '#EC4899', '#84CC16', '#0EA5E9', '#D946EF',
];

export default function CatalogoProductos() {
    const { profile } = useAuth();
    const { isAdmin } = usePermissions();

    const [items, setItems] = useState<PricingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeColor, setNewTypeColor] = useState(PRESET_COLORS[0]);
    const [savingType, setSavingType] = useState(false);
    const { types, getName, getColor, reload: reloadTypes } = useItemTypes();

    const [uiState, setUiState] = useState({
        frecuencia_cobro: 'unico' as 'unico' | 'recurrente',
        intervalo: 'mensual' as 'mensual' | 'anual',
        precio_base: 0,
        tiene_setup: false,
        setup_fee: 0,
        unidad_medida: ''
    });
    
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

    const handleQuickCreateType = async () => {
        if (!newTypeName.trim()) return toast.error('Escribe un nombre para la categoría');
        if (!profile?.company_id) return toast.error('Empresa no identificada');
        setSavingType(true);
        try {
            const created = await itemTypesService.create(
                { name: newTypeName.trim(), color: newTypeColor, icon: 'tag', is_active: true, sort_order: types.length + 1 },
                profile.company_id
            );
            await reloadTypes();
            setFormData(prev => ({ ...prev, tipo: created.slug }));
            setShowTypeModal(false);
            setNewTypeName('');
            setNewTypeColor(PRESET_COLORS[0]);
            toast.success(`✅ Categoría "${created.name}" creada y seleccionada`);
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setSavingType(false);
        }
    };

    const handleEdit = (item: PricingItem) => {
        setEditingId(item.id);
        setFormData(item);
        
        const isRecurring = item.precio_mensual > 0 || item.precio_anual > 0;
        const isAnnual = item.precio_anual > 0 && item.precio_mensual === 0;
        const hasSetup = isRecurring && item.costo_unico > 0;
        
        setUiState({
            frecuencia_cobro: isRecurring ? 'recurrente' : 'unico',
            intervalo: isAnnual ? 'anual' : 'mensual',
            precio_base: isRecurring ? (isAnnual ? item.precio_anual : item.precio_mensual) : item.costo_unico,
            tiene_setup: hasSetup,
            setup_fee: hasSetup ? item.costo_unico : 0,
            unidad_medida: item.metadata?.unidad_medida || '',
        });
        
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClone = async (item: PricingItem) => {
        if (!canEdit) return toast.error('No tienes permisos');
        if (!profile?.company_id) return toast.error('Empresa no identificada');
        try {
            const { id, created_at, updated_at, company_id, ...cloneData } = item as any;
            await pricingService.createPricingItem({
                ...cloneData,
                nombre: `${cloneData.nombre} (Personalizado)`,
                company_id: profile.company_id,
            } as any);
            toast.success('✅ Producto clonado. Ahora puedes editarlo para tu empresa.');
            loadItems();
        } catch (err: any) {
            toast.error(`Error al clonar: ${err.message}`);
        }
    };

    const handleSave = async () => {
        try {
            if (!canEdit) return toast.error('No tienes permisos');
            if (!formData.nombre?.trim()) return toast.error('El nombre es obligatorio');
            if (!profile?.company_id) return toast.error('Empresa no identificada');

            const { id, created_at, updated_at, ...baseData } = formData as any;
            
            // Transform UI State to DB structure
            let finalUpdate = { ...baseData };
            
            if (uiState.frecuencia_cobro === 'unico') {
                finalUpdate.costo_unico = uiState.precio_base;
                finalUpdate.precio_mensual = 0;
                finalUpdate.precio_anual = 0;
            } else {
                if (uiState.intervalo === 'mensual') {
                    finalUpdate.precio_mensual = uiState.precio_base;
                    finalUpdate.precio_anual = 0;
                } else {
                    finalUpdate.precio_anual = uiState.precio_base;
                    finalUpdate.precio_mensual = 0;
                }
                finalUpdate.costo_unico = uiState.tiene_setup ? uiState.setup_fee : 0;
            }
            
            // Guardar unidad de medida en metadata
            finalUpdate.metadata = {
                ...(finalUpdate.metadata || {}),
                unidad_medida: uiState.unidad_medida
            };

            if (editingId) {
                await pricingService.updatePricingItem(editingId, finalUpdate);
                toast.success('✅ Producto actualizado exitosamente');
            } else {
                await pricingService.createPricingItem({
                    ...finalUpdate,
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
        setUiState({
            frecuencia_cobro: 'unico',
            intervalo: 'mensual',
            precio_base: 0,
            tiene_setup: false,
            setup_fee: 0,
            unidad_medida: ''
        });
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
            {/* Super Header Compacto + Buscador */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center gap-4 sticky top-0 z-10">
                <div className="flex items-center gap-3 min-w-max">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Box className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 leading-tight">Catálogo</h1>
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Productos y Servicios</p>
                    </div>
                </div>

                <div className="flex-1 flex w-full items-center gap-2">
                    <div className="flex-1 flex items-center bg-gray-50 rounded-xl px-3 py-2 border border-gray-200/60 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                        <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, código o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-sm font-medium text-gray-700 placeholder:text-gray-400"
                        />
                    </div>
                    
                    <div className="hidden md:flex flex-wrap gap-1 p-1 bg-gray-50 rounded-xl border border-gray-200/60">
                        <button
                            onClick={() => setFilterTipo('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterTipo === 'all' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Todos ({items.length})
                        </button>
                        {types.map(t => {
                            const count = items.filter(i => i.tipo === t.slug).length;
                            return (
                                <button
                                    key={t.slug}
                                    onClick={() => setFilterTipo(t.slug)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5`}
                                    style={filterTipo === t.slug ? {
                                        backgroundColor: t.color,
                                        color: 'white',
                                        boxShadow: `0 2px 8px ${t.color}40`,
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

                {canEdit && (
                    <Button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="w-full lg:w-auto bg-[#0f172a] hover:bg-gray-800 text-white shadow-md rounded-xl px-5 py-2.5 transition-all"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        <span className="font-bold text-sm">Nuevo Producto</span>
                    </Button>
                )}
            </div>

            {/* Formulario Estilo Drawer (Panel Lateral) */}
            {showForm && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={resetForm} />

                    {/* Drawer Content */}
                    <div className="relative w-full max-w-[850px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-8 fade-in duration-300 border-l border-gray-200">
                        
                        {/* Drawer Header */}
                        <div className="bg-gradient-to-r from-[#f8fafc] to-white border-b border-gray-100 p-5 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                    {editingId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 leading-tight">
                                        {editingId ? 'Editar Producto' : 'Crear Nuevo Producto'}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium">Configura los detalles comerciales y de facturación</p>
                                </div>
                            </div>
                            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Columna Izquierda: Info General */}
                            <div className="lg:col-span-6 space-y-6">
                                <div className="space-y-6">
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
                                        <label className="text-sm font-bold text-gray-700 flex items-center justify-between">
                                            <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-gray-400" /> Tipo / Categoría</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowTypeModal(v => !v)}
                                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Nueva categoría
                                            </button>
                                        </label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                className={`w-full h-12 border ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white' : 'border-gray-200 bg-gray-50/50 hover:bg-white'} rounded-xl px-4 transition-all font-semibold text-gray-700 flex items-center justify-between shadow-sm`}
                                            >
                                                {(() => {
                                                    const selectedType = types.find(t => t.slug === formData.tipo);
                                                    return selectedType ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: selectedType.color }}></span>
                                                            <span>{selectedType.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-normal">Seleccionar categoría...</span>
                                                    );
                                                })()}
                                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isDropdownOpen && (
                                                <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-40 bg-white rounded-2xl border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="relative mb-2 px-2 pt-2">
                                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar categoría..."
                                                            value={categorySearch}
                                                            onChange={e => setCategorySearch(e.target.value)}
                                                            className="w-full h-9 pl-9 pr-4 text-sm font-medium bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="max-h-56 overflow-y-auto p-1 space-y-1 scrollbar-thin">
                                                        {types.filter(t => t.name.toLowerCase().includes(categorySearch.toLowerCase())).map(t => (
                                                            <button
                                                                key={t.slug}
                                                                type="button"
                                                                onClick={() => { setFormData({ ...formData, tipo: t.slug as any }); setIsDropdownOpen(false); setCategorySearch(''); }}
                                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${formData.tipo === t.slug ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: t.color }}></span>
                                                                    {t.name}
                                                                </div>
                                                                {formData.tipo === t.slug && <CheckCircle className="w-4 h-4 text-blue-600" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 border-t border-gray-100 mt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsDropdownOpen(false); setShowTypeModal(true); }}
                                                            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all"
                                                        >
                                                            <Plus className="w-4 h-4" /> Crear nueva categoría
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Mini-modal crear categoría */}
                                            {showTypeModal && (
                                                <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-2xl border border-indigo-100 shadow-2xl shadow-indigo-900/15 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-black text-gray-900">Nueva Categoría</p>
                                                        <button onClick={() => setShowTypeModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Nombre *</label>
                                                        <Input
                                                            value={newTypeName}
                                                            onChange={e => setNewTypeName(e.target.value)}
                                                            placeholder="Ej. Consultoría, Licencia, Activo..."
                                                            onKeyDown={e => e.key === 'Enter' && handleQuickCreateType()}
                                                            autoFocus
                                                            className="text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 mb-2">Color del badge</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {PRESET_COLORS.map(c => (
                                                                <button
                                                                    key={c}
                                                                    type="button"
                                                                    onClick={() => setNewTypeColor(c)}
                                                                    className="w-6 h-6 rounded-full transition-transform hover:scale-110 border-2"
                                                                    style={{
                                                                        backgroundColor: c,
                                                                        borderColor: newTypeColor === c ? '#1e293b' : 'transparent',
                                                                        boxShadow: newTypeColor === c ? '0 0 0 2px white, 0 0 0 3px #1e293b' : 'none',
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <span className="text-xs text-gray-400">Vista previa:</span>
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${newTypeColor}20`, color: newTypeColor }}>
                                                                {newTypeName || 'Mi Tipo'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={handleQuickCreateType}
                                                        disabled={savingType}
                                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl h-10"
                                                    >
                                                        {savingType ? 'Creando...' : '+ Crear y Seleccionar'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-gray-700">Descripción Comercial</label>
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y min-h-[120px] text-gray-700 bg-gray-50/50 hover:bg-gray-50 focus:bg-white font-medium shadow-inner shadow-gray-50/50"
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
                            <div className="lg:col-span-6 space-y-6">
                                {/* HubSpot Style Pricing Editor */}
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                                    <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                        <DollarSign className="w-4 h-4 text-green-500" /> Facturación
                                    </h4>
                                    
                                    <div className="space-y-6">
                                        {/* Frecuencia de Cobro */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-2 block">Frecuencia de Cobro</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setUiState({...uiState, frecuencia_cobro: 'unico'})}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${uiState.frecuencia_cobro === 'unico' ? 'border-indigo-500 bg-indigo-50 shadow-[0_4px_15px_-3px_rgba(99,102,241,0.2)]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <p className={`text-sm font-black ${uiState.frecuencia_cobro === 'unico' ? 'text-indigo-700' : 'text-gray-700'}`}>Pago Único</p>
                                                        {uiState.frecuencia_cobro === 'unico' && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">Se cobra una sola vez</p>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setUiState({...uiState, frecuencia_cobro: 'recurrente'})}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${uiState.frecuencia_cobro === 'recurrente' ? 'border-indigo-500 bg-indigo-50 shadow-[0_4px_15px_-3px_rgba(99,102,241,0.2)]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <p className={`text-sm font-black ${uiState.frecuencia_cobro === 'recurrente' ? 'text-indigo-700' : 'text-gray-700'}`}>Suscripción</p>
                                                        {uiState.frecuencia_cobro === 'recurrente' && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">Cobro recurrente</p>
                                                </button>
                                            </div>
                                        </div>

                                        {uiState.frecuencia_cobro === 'recurrente' && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <label className="text-xs font-bold text-gray-500 mb-2 block">Intervalo de Facturación</label>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => setUiState({...uiState, intervalo: 'mensual'})} className={`px-4 py-2 rounded-lg text-sm font-bold border ${uiState.intervalo === 'mensual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>Mensual</button>
                                                    <button type="button" onClick={() => setUiState({...uiState, intervalo: 'anual'})} className={`px-4 py-2 rounded-lg text-sm font-bold border ${uiState.intervalo === 'anual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>Anual</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Precio Unitario ($)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                    <Input type="number" value={uiState.precio_base} onChange={(e) => setUiState({ ...uiState, precio_base: Number(e.target.value) })} className="pl-8 text-lg font-black text-gray-900 bg-white shadow-sm" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Se cobra por (Opcional)</label>
                                                <Input type="text" value={uiState.unidad_medida} onChange={(e) => setUiState({ ...uiState, unidad_medida: e.target.value })} placeholder="Ej: Hora, Usuario, Paquete..." className="bg-white shadow-sm" />
                                            </div>
                                        </div>

                                        {uiState.frecuencia_cobro === 'recurrente' && (
                                            <div className="pt-4 border-t border-gray-200">
                                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                                    <input type="checkbox" checked={uiState.tiene_setup} onChange={(e) => setUiState({...uiState, tiene_setup: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-gray-300" />
                                                    <span className="text-sm font-bold text-gray-700">Agregar costo inicial (Setup Fee)</span>
                                                </label>
                                                {uiState.tiene_setup && (
                                                    <div className="relative w-full sm:w-1/2 animate-in fade-in slide-in-from-top-1">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                        <Input type="number" value={uiState.setup_fee} onChange={(e) => setUiState({ ...uiState, setup_fee: Number(e.target.value) })} className="pl-8 font-bold bg-white" placeholder="Costo único" />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-gray-200">
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">SKU / Código (Opcional)</label>
                                            <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="Ej. SKU-123" className="uppercase font-mono text-sm bg-white shadow-inner max-w-[50%]" />
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
                        
                        {/* Drawer Footer */}
                        <div className="bg-gray-50 p-5 flex justify-end gap-3 border-t border-gray-100 shrink-0">
                            <Button onClick={resetForm} variant="outline" className="px-6 rounded-xl font-bold bg-white">
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} className="bg-[#007BFF] hover:bg-blue-600 text-white px-8 rounded-xl shadow-lg shadow-blue-500/30">
                                <Save className="w-4 h-4 mr-2" />
                                <span className="font-bold">Guardar Producto</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}



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
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest">Modelo</th>
                                    <th className="py-4 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Precio</th>
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
                                        <td className="py-4 px-6">
                                            {(() => {
                                                const isRecurring = item.precio_mensual > 0 || item.precio_anual > 0;
                                                return isRecurring ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600">Suscripción</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600">Pago Único</span>
                                                );
                                            })()}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="text-right">
                                                {item.precio_anual > 0 && <p className="text-sm font-black text-gray-900">${item.precio_anual.toLocaleString()}<span className="text-xs font-normal text-gray-400"> {item.metadata?.unidad_medida ? `por ${item.metadata.unidad_medida}/año` : '/año'}</span></p>}
                                                {item.precio_mensual > 0 && <p className="text-sm font-bold text-gray-500">${item.precio_mensual.toLocaleString()}<span className="text-xs font-normal text-gray-400"> {item.metadata?.unidad_medida ? `por ${item.metadata.unidad_medida}/mes` : '/mes'}</span></p>}
                                                {item.costo_unico > 0 && item.precio_mensual === 0 && item.precio_anual === 0 && <p className="text-sm font-black text-gray-900">${item.costo_unico.toLocaleString()}<span className="text-xs font-normal text-gray-400"> {item.metadata?.unidad_medida ? `por ${item.metadata.unidad_medida}` : ''}</span></p>}
                                                {item.costo_unico > 0 && (item.precio_mensual > 0 || item.precio_anual > 0) && <p className="text-sm font-bold text-amber-600">+ ${item.costo_unico.toLocaleString()}<span className="text-xs font-normal text-amber-600/70"> setup</span></p>}
                                            </div>
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
                                        <td className="py-4 px-6">
                                            {canEdit && (
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleClone(item)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Clonar (Duplicar)">
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Archivar">
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
