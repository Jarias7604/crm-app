import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { pricingService } from '../../services/pricing';
import type { FinancingPlan, PaymentSettings } from '../../types/pricing';
import { Plus, Trash2, Edit2, Save, X, Percent, Loader2, Info, Settings as SettingsIcon, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Switch from '../../components/ui/Switch';
import toast from 'react-hot-toast';

export default function FinancialRules() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'financing' | 'settings'>('financing');

    // Data States
    const [plans, setPlans] = useState<FinancingPlan[]>([]);
    const [settings, setSettings] = useState<PaymentSettings | null>(null);

    // Edit States
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [editingPlan, setEditingPlan] = useState<FinancingPlan | null>(null);
    const [isCreatingPlan, setIsCreatingPlan] = useState(false);

    // New Plan Form
    const [newPlan, setNewPlan] = useState<Partial<FinancingPlan>>({
        titulo: '',
        meses: 12,
        interes_porcentaje: 0,
        tipo_ajuste: 'none',
        descripcion: '',
        es_popular: false,
        activo: true,
        orden: 10
    });

    useEffect(() => {
        if (profile?.company_id) {
            loadData();
        }
    }, [profile?.company_id]);

    const loadData = async () => {
        if (!profile?.company_id) return;
        try {
            setLoading(true);
            const [plansData, settingsData] = await Promise.all([
                pricingService.getFinancingPlans(profile.company_id),
                pricingService.getPaymentSettings(profile.company_id)
            ]);
            setPlans(plansData);
            setSettings(settingsData);
        } catch (error) {
            console.error('Error loading pricing data:', error);
            toast.error('Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS FOR SETTINGS ---
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings || !profile?.company_id) return;

        try {
            await pricingService.updatePaymentSettings(profile.company_id, settings);
            toast.success('Configuración global actualizada');
            setIsEditingSettings(false);
        } catch (error) {
            toast.error('Error al guardar configuración');
        }
    };

    // --- HANDLERS FOR PLANS ---
    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.company_id || !newPlan.titulo) return;

        try {
            await pricingService.createFinancingPlan({
                ...newPlan as any,
                company_id: profile.company_id
            });
            toast.success('Plan de financiamiento creado');
            setIsCreatingPlan(false);
            setNewPlan({ titulo: '', meses: 12, interes_porcentaje: 0, descripcion: '', es_popular: false, activo: true, orden: 10 });
            loadData();
        } catch (error) {
            toast.error('Error al crear plan');
        }
    };

    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;

        try {
            // Sanitizar payload: Remover campos de sistema inmutables o problemáticos para updates
            const { id, created_at, updated_at, company_id, ...updates } = editingPlan as any;

            await pricingService.updateFinancingPlan(editingPlan.id, updates);
            toast.success('Plan actualizado');
            setEditingPlan(null);
            loadData();
        } catch (error: any) {
            console.error('Error updating plan:', error);
            const msg = error?.message || 'Error desconocido';
            toast.error(`Error al actualizar plan: ${msg}`);
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este plan?')) return;
        try {
            await pricingService.deleteFinancingPlan(id);
            toast.success('Plan eliminado');
            loadData();
        } catch (error) {
            toast.error('Error al eliminar plan');
        }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(plans);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Actualizar UI optimísticamente
        setPlans(items);

        // Actualizar Orden en Backend
        try {
            const updates = items.map((item, index) => ({
                id: item.id,
                orden: index
            }));
            await pricingService.updateFinancingPlansOrder(updates);
            toast.success('Orden actualizado');
        } catch (error) {
            toast.error('Error al guardar el orden');
            loadData(); // Revertir en caso de error
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-4">Cargando Motor Financiero...</p>
        </div>
    );

    return (
        <div className="w-full max-w-[1200px] mx-auto pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-gray-100 pb-8 mb-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Motor de Precios</h1>
                    <p className="text-sm text-gray-500 font-medium">Configura los intereses, descuentos y planes de pago de tu cotizador.</p>
                </div>

                <div className="flex bg-gray-100/50 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('financing')}
                        className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'financing'
                            ? 'bg-white text-[#4449AA] shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Planes & Financiamiento
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'settings'
                            ? 'bg-white text-[#4449AA] shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Variables Globales
                    </button>
                </div>
            </header>

            {/* CONTENT */}
            {activeTab === 'financing' ? (
                <div className="space-y-6">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Info className="w-4 h-4" />
                            <span>Estos planes aparecerán automáticamente en el paso 4 del cotizador.</span>
                        </div>
                        <Button
                            onClick={() => setIsCreatingPlan(true)}
                            className="bg-[#4449AA] text-white hover:bg-[#35398d] font-black text-[10px] uppercase tracking-widest px-6 h-10 shadow-lg shadow-indigo-200"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Plan
                        </Button>
                    </div>

                    {/* NEW PLAN FORM */}
                    {isCreatingPlan && (
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 mb-8 animate-in slide-in-from-top-4">
                            <h3 className="text-sm font-black text-[#4449AA] uppercase tracking-widest mb-4">Crear Nuevo Plan de Financiamiento</h3>
                            <form onSubmit={handleCreatePlan} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                {/* Título y Descripción */}
                                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Título (Ej: Plan Anual)</label>
                                        <Input required value={newPlan.titulo} onChange={e => setNewPlan({ ...newPlan, titulo: e.target.value })} className="bg-white" placeholder="Título corto" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Descripción (Subtítulo)</label>
                                        <Input value={newPlan.descripcion || ''} onChange={e => setNewPlan({ ...newPlan, descripcion: e.target.value })} className="bg-white" placeholder="Ej: Ahorra 20% pagando todo" />
                                    </div>
                                </div>

                                {/* Duración y Cuotas */}
                                <div className="md:col-span-4 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Duración (Meses)</label>
                                        <div className="relative">
                                            <Input type="number" min="1" required value={newPlan.meses} onChange={e => setNewPlan({ ...newPlan, meses: parseInt(e.target.value) })} className="bg-white" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">Meses</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Pagos (Cuotas)</label>
                                        <div className="relative">
                                            <Input type="number" min="1" required value={newPlan.cuotas || newPlan.meses} onChange={e => setNewPlan({ ...newPlan, cuotas: parseInt(e.target.value) })} className="bg-white" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">#</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Configuración Financiera (Tipo y Tasa) */}
                                <div className="md:col-span-12 bg-white rounded-xl p-4 border border-gray-100">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                                        {/* Selector de Tipo */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo de Ajuste</label>
                                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPlan({ ...newPlan, tipo_ajuste: 'discount' })}
                                                    className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${newPlan.tipo_ajuste === 'discount' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    📉 Descuento
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPlan({ ...newPlan, tipo_ajuste: 'none', interes_porcentaje: 0 })}
                                                    className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${newPlan.tipo_ajuste === 'none' ? 'bg-gray-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    ➖ Neutro
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPlan({ ...newPlan, tipo_ajuste: 'recharge' })}
                                                    className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${newPlan.tipo_ajuste === 'recharge' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    📈 Recargo
                                                </button>
                                            </div>
                                        </div>

                                        {/* Input de Valor % */}
                                        <div className="space-y-1">
                                            <label className={`text-[10px] font-bold uppercase transition-colors ${newPlan.tipo_ajuste === 'discount' ? 'text-green-600' : newPlan.tipo_ajuste === 'recharge' ? 'text-blue-600' : 'text-gray-300'}`}>
                                                {newPlan.tipo_ajuste === 'discount' ? 'Porcentaje de Descuento' : newPlan.tipo_ajuste === 'recharge' ? 'Porcentaje de Recargo' : 'Sin Ajuste'}
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    disabled={!newPlan.tipo_ajuste || newPlan.tipo_ajuste === 'none'}
                                                    value={newPlan.interes_porcentaje}
                                                    onChange={e => setNewPlan({ ...newPlan, interes_porcentaje: parseFloat(e.target.value) })}
                                                    className={`pl-8 font-bold ${newPlan.tipo_ajuste === 'discount' ? 'text-green-600 border-green-200 bg-green-50/30' : newPlan.tipo_ajuste === 'recharge' ? 'text-blue-600 border-blue-200 bg-blue-50/30' : 'bg-gray-50 text-gray-400'}`}
                                                />
                                                <Percent className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${newPlan.tipo_ajuste === 'discount' ? 'text-green-500' : newPlan.tipo_ajuste === 'recharge' ? 'text-blue-500' : 'text-gray-300'}`} />
                                            </div>
                                        </div>

                                        {/* Botones */}
                                        <div className="flex gap-2 justify-end">
                                            <Button type="button" onClick={() => setIsCreatingPlan(false)} className="bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 h-10 px-6">Cancelar</Button>
                                            <Button type="submit" className="bg-[#4449AA] text-white h-10 px-8 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all">Crear Plan</Button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* PLAN LIST */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="financing-plans" direction="horizontal">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                >
                                    {plans.map((plan, index) => (
                                        <Draggable key={plan.id} draggableId={plan.id} index={index}>
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`group relative bg-white border rounded-2xl p-4 transition-all hover:shadow-lg ${plan.activo ? 'border-gray-200' : 'border-gray-100 opacity-60 bg-gray-50'}`}
                                                >
                                                    {editingPlan?.id === plan.id ? (
                                                        <form onSubmit={handleUpdatePlan} className="space-y-3">
                                                            {/* HEADER EDIT */}
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black uppercase text-indigo-500">Editando Plan</span>
                                                                <button type="button" onClick={() => setEditingPlan(null)}><X className="w-4 h-4 text-gray-400" /></button>
                                                            </div>

                                                            <div className="space-y-2.5">
                                                                <div>
                                                                    <label className="text-[9px] font-bold text-gray-400 block mb-0.5">TÍTULO</label>
                                                                    <Input value={editingPlan.titulo} onChange={e => setEditingPlan({ ...editingPlan, titulo: e.target.value })} className="h-8 text-xs font-bold text-gray-800" />
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <label className="text-[9px] font-bold text-gray-400 block mb-0.5">DURACIÓN</label>
                                                                            <Input type="number" value={editingPlan.meses} onChange={e => setEditingPlan({ ...editingPlan, meses: parseInt(e.target.value) })} className="h-8 text-xs font-bold text-gray-800" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[9px] font-bold text-gray-400 block mb-0.5">CUOTAS</label>
                                                                            <Input type="number" value={editingPlan.cuotas || editingPlan.meses} onChange={e => setEditingPlan({ ...editingPlan, cuotas: parseInt(e.target.value) })} className="h-8 text-xs font-bold text-gray-800" />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Selector Mini Compacto */}
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">TIPO AJUSTE</label>
                                                                        <select
                                                                            value={editingPlan.tipo_ajuste || (editingPlan.interes_porcentaje > 0 ? 'recharge' : 'none')}
                                                                            onChange={(e) => {
                                                                                const newType = e.target.value as any;
                                                                                setEditingPlan({
                                                                                    ...editingPlan,
                                                                                    tipo_ajuste: newType,
                                                                                    interes_porcentaje: newType === 'none' ? 0 : editingPlan.interes_porcentaje
                                                                                });
                                                                            }}
                                                                            className="w-full text-xs border border-gray-200 rounded-md p-1 h-8 bg-gray-50 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                        >
                                                                            <option value="discount">📉 Descuento</option>
                                                                            <option value="none">➖ Neutro</option>
                                                                            <option value="recharge">📈 Recargo</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">VALOR %</label>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            value={editingPlan.interes_porcentaje}
                                                                            disabled={editingPlan.tipo_ajuste === 'none'}
                                                                            onChange={e => setEditingPlan({ ...editingPlan, interes_porcentaje: parseFloat(e.target.value) })}
                                                                            className="h-8 text-xs"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <label className="text-[9px] font-bold text-gray-400 block mb-0.5">DESCRIPCIÓN</label>
                                                                    <Input value={editingPlan.descripcion || ''} onChange={e => setEditingPlan({ ...editingPlan, descripcion: e.target.value })} className="h-8 text-xs" />
                                                                </div>

                                                                <div className="pt-2 flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-[10px] font-bold text-gray-500">Popular</label>
                                                                        <Switch checked={editingPlan.es_popular} onChange={() => setEditingPlan({ ...editingPlan, es_popular: !editingPlan.es_popular })} size="sm" />
                                                                    </div>
                                                                    <Button type="submit" size="sm" className="bg-indigo-600 text-white text-[10px] uppercase font-bold h-7 px-3 rounded-lg">Guardar</Button>
                                                                </div>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            {/* DRAG HANDLE - Positioned specifically to not overlap */}
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 cursor-move transition-opacity p-2 text-gray-300 hover:text-gray-500 z-10"
                                                            >
                                                                <GripVertical className="w-5 h-5 rotate-90" />
                                                            </div>

                                                            {/* CARD DISPLAY COMPACT */}
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${plan.tipo_ajuste === 'discount' ? 'bg-green-100 text-green-600' :
                                                                    plan.tipo_ajuste === 'recharge' ? 'bg-blue-100 text-blue-600' :
                                                                        'bg-gray-100 text-gray-400'
                                                                    }`}>
                                                                    {plan.tipo_ajuste === 'discount' ? '📉' :
                                                                        plan.tipo_ajuste === 'recharge' ? '📈' :
                                                                            '🔄'}
                                                                </div>
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                                    <button onClick={() => setEditingPlan(plan)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                    <button onClick={() => handleDeletePlan(plan.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1 mb-4">
                                                                <h3 className="text-base font-black text-gray-900 leading-tight">{plan.titulo}</h3>
                                                                <p className="text-[11px] text-gray-500 font-medium line-clamp-2 min-h-[2.2em]">{plan.descripcion}</p>
                                                            </div>

                                                            <div className="flex items-center gap-4 py-3 border-t border-gray-100 bg-gray-50/50 -mx-4 -mb-4 px-4 rounded-b-2xl">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Duración</span>
                                                                    <span className="text-xs font-bold text-gray-900">{plan.meses} Meses</span>
                                                                    <span className="text-[9px] text-gray-400 font-medium">
                                                                        ({plan.cuotas || plan.meses} pagos)
                                                                    </span>
                                                                </div>
                                                                <div className="w-px h-6 bg-gray-200"></div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Impacto</span>
                                                                    <span className={`text-xs font-black ${plan.tipo_ajuste === 'discount' ? 'text-green-600' :
                                                                        plan.tipo_ajuste === 'recharge' ? 'text-blue-600' :
                                                                            'text-gray-400'
                                                                        }`}>
                                                                        {plan.tipo_ajuste === 'discount' ? `-${plan.interes_porcentaje}% OFF` :
                                                                            plan.tipo_ajuste === 'recharge' ? `+${plan.interes_porcentaje}% Interest` :
                                                                                '0% Interest'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {plan.es_popular && (
                                                                <div className="absolute top-3 right-3">
                                                                    <span className="bg-yellow-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest shadow-sm">
                                                                        Popular
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                </div>
            ) : (
                /* SETTINGS TAB */
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-50 bg-gradient-to-br from-white to-gray-50/50">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                                    <SettingsIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Variables del Sistema</h3>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Afectan a todas las cotizaciones nuevas</p>
                                </div>
                            </div>
                        </div>

                        {settings && (
                            <form onSubmit={handleSaveSettings} className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Impuesto (IVA/TAX)</label>
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                disabled={!isEditingSettings}
                                                value={settings.iva_defecto}
                                                onChange={e => setSettings({ ...settings, iva_defecto: parseFloat(e.target.value) })}
                                                className="h-12 pl-12 font-bold text-lg bg-gray-50/50 group-hover:bg-white transition-colors border-gray-200"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded text-gray-500 font-bold text-xs">%</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Desc. Pago Único</label>
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                disabled={!isEditingSettings}
                                                value={settings.recargo_financiamiento_base} // Usamos este campo como base del descuento visual
                                                onChange={e => setSettings({ ...settings, recargo_financiamiento_base: parseFloat(e.target.value) })}
                                                className="h-12 pl-12 font-bold text-lg bg-gray-50/50 group-hover:bg-white transition-colors border-gray-200 text-green-600"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1 bg-green-100 rounded text-green-600 font-bold text-xs">OFF</div>
                                        </div>
                                        <p className="text-[10px] text-gray-400 pl-1">Descuento aplicado al elegir "1 Solo Pago".</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Etiqueta "Mejor Precio"</label>
                                    <Input
                                        disabled={!isEditingSettings}
                                        value={settings.nota_mejor_precio || ''}
                                        onChange={e => setSettings({ ...settings, nota_mejor_precio: e.target.value })}
                                        className="h-12 font-medium bg-gray-50/50"
                                        placeholder="Ej: MEJOR OFERTA"
                                    />
                                    <p className="text-[10px] text-gray-400 pl-1">Texto que aparece en el badge verde del plan anual.</p>
                                </div>

                                <div className="pt-6 flex gap-4 border-t border-gray-50">
                                    {!isEditingSettings ? (
                                        <Button
                                            type="button"
                                            onClick={() => setIsEditingSettings(true)}
                                            className="w-full h-12 bg-[#4449AA] text-white hover:bg-[#35398d] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100"
                                        >
                                            <Edit2 className="w-4 h-4 mr-2" /> Habilitar Edición
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                type="button"
                                                onClick={() => { setIsEditingSettings(false); loadData(); }}
                                                className="flex-1 h-12 bg-white border border-gray-200 text-gray-500 font-black text-xs uppercase tracking-widest"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="submit"
                                                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-green-100"
                                            >
                                                <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
