import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { 
  Package, Plus, Pencil, Check, X, Users, Target, Cpu, 
  Sparkles, Shield, Eye, EyeOff, LayoutGrid, List, Info, GripVertical
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function PlanManager() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Fetch plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['saas_plans_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_plans')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Save plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async (plan: any) => {
      if (plan.id) {
        // Update
        const { error } = await supabase
          .from('saas_plans')
          .update(plan)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('saas_plans')
          .insert([plan]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas_plans_admin'] });
      queryClient.invalidateQueries({ queryKey: ['saas_plans_public'] });
      toast.success('Plan guardado exitosamente');
      setIsModalOpen(false);
      setEditingPlan(null);
    },
    onError: (error: any) => {
      toast.error('Error al guardar el plan: ' + error.message);
    }
  });

  const handleEdit = (plan: any) => {
    setEditingPlan({ ...plan });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingPlan({
      slug: '',
      name: '',
      description: '',
      price_monthly: 0,
      price_annual: 0,
      max_users: 1,
      max_leads: 100,
      max_ai_tokens: 1000,
      features: ['Característica 1'],
      is_active: true,
      sort_order: plans.length + 1
    });
    setIsModalOpen(true);
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...editingPlan.features];
    newFeatures[index] = value;
    setEditingPlan({ ...editingPlan, features: newFeatures });
  };

  const addFeature = () => {
    setEditingPlan({ ...editingPlan, features: [...editingPlan.features, ''] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = editingPlan.features.filter((_: any, i: number) => i !== index);
    setEditingPlan({ ...editingPlan, features: newFeatures });
  };

  // Get accent styles based on plan tier slug
  const getTierStyles = (slug: string) => {
    const lower = slug?.toLowerCase() || '';
    if (lower.includes('starter')) {
      return {
        border: 'border-t-[6px] border-t-indigo-500',
        text: 'text-indigo-600',
        bg: 'bg-indigo-50',
        badge: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
        gradient: 'from-indigo-500/20 to-indigo-600/5'
      };
    }
    if (lower.includes('pro')) {
      return {
        border: 'border-t-[6px] border-t-purple-500',
        text: 'text-purple-600',
        bg: 'bg-purple-50',
        badge: 'bg-purple-500/10 text-purple-700 border-purple-200',
        gradient: 'from-purple-500/20 to-purple-600/5'
      };
    }
    return {
      border: 'border-t-[6px] border-t-emerald-500',
      text: 'text-emerald-600',
      bg: 'bg-emerald-50',
      badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      gradient: 'from-emerald-500/20 to-emerald-600/5'
    };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Premium Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Package className="w-5.5 h-5.5" />
            </div>
            SaaS Plan Manager
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xl font-medium leading-relaxed">
            Administra los planes de suscripción, límites operativos de IA, capacidades de usuarios y características mostradas en la Landing Page pública.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200/60 flex items-center shadow-inner">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Vista de Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Vista de Tabla"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4.5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/15 transition-all duration-200 flex items-center gap-2 text-sm ml-auto md:ml-0">
            <Plus className="w-4 h-4" />
            Crear Plan
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-400 text-xs font-semibold mt-4">Obteniendo planes desde Supabase...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8">
          <Info className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-800">No se encontraron planes</h3>
          <p className="text-slate-500 text-xs mt-1">Comienza creando un plan de suscripción para la plataforma.</p>
          <Button onClick={handleAddNew} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Agregar Primer Plan
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        /* PREMIUM CARDS PREVIEW GRID */
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {plans.map((plan: any) => {
            const styles = getTierStyles(plan.slug);
            return (
              <div 
                key={plan.id}
                className={`bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_15px_30px_-6px_rgba(99,102,241,0.06)] hover:border-slate-300 transition-all duration-300 relative overflow-hidden group ${styles.border}`}
              >
                {/* Background soft gradient blur */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -mr-8 -mt-8 pointer-events-none transition-all group-hover:opacity-25 bg-gradient-to-tr ${styles.gradient}`} />
                
                {/* Card Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Tier {plan.sort_order}
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      {plan.name}
                      <span className="text-xs text-slate-400 font-medium">({plan.slug})</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Status indicator */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      plan.is_active 
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {plan.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {plan.is_active ? 'Activo' : 'Oculto'}
                    </span>
                    
                    <button 
                      onClick={() => handleEdit(plan)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl border border-slate-200/60 transition-all shadow-sm"
                      title="Editar Plan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Content & Pricing */}
                <div className="p-6 space-y-6 relative z-10">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 tracking-tight">${plan.price_monthly}</span>
                      <span className="text-slate-400 text-xs font-semibold">/mes</span>
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold mt-1">
                      Facturación anual: ${plan.price_annual}/año
                    </p>
                    {plan.description && (
                      <p className="text-slate-500 text-xs mt-3 leading-relaxed italic">
                        "{plan.description}"
                      </p>
                    )}
                  </div>

                  {/* Limits and Capabilities Card */}
                  <div className="bg-slate-50/80 border border-slate-200/50 rounded-2xl p-4 space-y-3.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Límites Operativos
                    </h4>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <Users className="w-4 h-4 mx-auto text-indigo-500 mb-1" />
                        <span className="text-[10px] text-slate-500 font-bold block">Asesores</span>
                        <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                          {plan.max_users >= 100 ? 'Ilimitados' : plan.max_users}
                        </span>
                      </div>

                      <div className="text-center p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <Target className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                        <span className="text-[10px] text-slate-500 font-bold block">Contactos</span>
                        <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                          {plan.max_leads >= 999999 ? 'Ilimitados' : plan.max_leads.toLocaleString()}
                        </span>
                      </div>

                      <div className="text-center p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <Cpu className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                        <span className="text-[10px] text-slate-500 font-bold block">Tokens IA</span>
                        <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                          {plan.max_ai_tokens >= 999999 ? 'Ilimitados' : (plan.max_ai_tokens / 1000) + 'K'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Included Features */}
                  <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Features Incluidos ({plan.features?.length || 0})
                    </h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-600 max-h-40 overflow-y-auto pr-1">
                      {plan.features?.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TRADITIONAL COMPACT TABLE VIEW */
        <div className="bg-white rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200/60 text-xs font-black text-slate-500 uppercase tracking-widest">
                  <th className="p-5">Orden</th>
                  <th className="p-5">Plan / Slug</th>
                  <th className="p-5">Precio Mensual / Anual</th>
                  <th className="p-5">Límites Clave</th>
                  <th className="p-5">Estado</th>
                  <th className="p-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {plans.map((plan: any) => (
                  <tr key={plan.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="p-5 font-black text-slate-400">#{plan.sort_order}</td>
                    <td className="p-5">
                      <div className="font-extrabold text-slate-900">{plan.name}</div>
                      <div className="text-xs text-slate-400 font-bold">{plan.slug}</div>
                    </td>
                    <td className="p-5">
                      <div className="font-bold">${plan.price_monthly}/mes</div>
                      <div className="text-xs text-slate-400 font-medium">${plan.price_annual}/año</div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-500" /> {plan.max_users} Usr</span>
                        <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-emerald-500" /> {plan.max_leads.toLocaleString()} Leads</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        plan.is_active 
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {plan.is_active ? 'Activo' : 'Oculto'}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/50">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  {editingPlan.id ? 'Editar Plan de Suscripción' : 'Crear Nuevo Plan'}
                </h3>
                <p className="text-slate-400 text-xs mt-1">Configura las características y límites para este nivel de servicio.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors border border-slate-200/30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Plan</label>
                  <input 
                    type="text" 
                    value={editingPlan.name} 
                    onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} 
                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-semibold p-2.5" 
                    placeholder="ej. Pro Accelerated"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Slug único (identificador)</label>
                  <input 
                    type="text" 
                    value={editingPlan.slug} 
                    onChange={e => setEditingPlan({...editingPlan, slug: e.target.value})} 
                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-semibold p-2.5" 
                    placeholder="ej. pro-accelerated"
                    disabled={!!editingPlan.id} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descripción pública corta</label>
                <input 
                  type="text" 
                  value={editingPlan.description || ''} 
                  onChange={e => setEditingPlan({...editingPlan, description: e.target.value})} 
                  className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-semibold p-2.5" 
                  placeholder="ej. Ideal para medianas empresas en proceso de aceleración."
                />
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-4 p-5 bg-gradient-to-tr from-slate-50 to-slate-100/55 rounded-2xl border border-slate-200/50">
                <div>
                  <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1.5">Precio Mensual ($ USD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-bold">$</span>
                    <input 
                      type="number" 
                      value={editingPlan.price_monthly} 
                      onChange={e => {
                        const monthlyVal = Number(e.target.value);
                        const calculatedAnnual = Math.round((monthlyVal * 12) * 0.8);
                        setEditingPlan({
                          ...editingPlan,
                          price_monthly: monthlyVal,
                          price_annual: calculatedAnnual
                        });
                      }} 
                      className="w-full rounded-xl border-slate-200 pl-8 focus:border-indigo-500 focus:ring-indigo-500 text-sm font-black p-2.5" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1.5">Precio Anual Total ($ USD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-bold">$</span>
                    <input 
                      type="number" 
                      value={editingPlan.price_annual} 
                      onChange={e => setEditingPlan({...editingPlan, price_annual: Number(e.target.value)})} 
                      className="w-full rounded-xl border-slate-200 pl-8 focus:border-indigo-500 focus:ring-indigo-500 text-sm font-black p-2.5" 
                    />
                  </div>
                </div>
                <div className="col-span-2 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    El precio anual se calcula automáticamente aplicando un <strong>20% de descuento</strong> (ahorro de ${editingPlan.price_monthly * 2.4} USD al año). Si lo deseas, puedes editar el monto anual de forma manual.
                  </span>
                </div>
              </div>

              {/* Limits and Tokens */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Límites Operacionales</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Max Asesores</label>
                    <input 
                      type="number" 
                      value={editingPlan.max_users} 
                      onChange={e => setEditingPlan({...editingPlan, max_users: Number(e.target.value)})} 
                      className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-bold p-2.5" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Max Leads</label>
                    <input 
                      type="number" 
                      value={editingPlan.max_leads} 
                      onChange={e => setEditingPlan({...editingPlan, max_leads: Number(e.target.value)})} 
                      className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-bold p-2.5" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> Max AI Tokens</label>
                    <input 
                      type="number" 
                      value={editingPlan.max_ai_tokens} 
                      onChange={e => setEditingPlan({...editingPlan, max_ai_tokens: Number(e.target.value)})} 
                      className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-bold p-2.5" 
                    />
                  </div>
                </div>
              </div>

              {/* Features Array */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Features del Plan</label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addFeature} 
                    className="py-1.5 h-auto text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Agregar feature
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {editingPlan.features?.map((feat: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="cursor-grab text-slate-400 p-2 hover:text-slate-600">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <input 
                        type="text" 
                        value={feat} 
                        onChange={e => handleFeatureChange(idx, e.target.value)}
                        className="flex-1 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 text-xs font-medium p-2"
                        placeholder="ej. Acceso a Webhooks & API"
                      />
                      <button 
                        onClick={() => removeFeature(idx)} 
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100 shadow-sm"
                        title="Eliminar Feature"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visibilidad & Orden */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.is_active} 
                    onChange={e => setEditingPlan({...editingPlan, is_active: e.target.checked})}
                    className="rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 h-5 w-5 transition-all"
                  />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-slate-900 transition-colors">
                    Plan Activo (Visible en Landing)
                  </span>
                </label>
                
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posición en la Landing:</span>
                  <input 
                    type="number" 
                    value={editingPlan.sort_order} 
                    onChange={e => setEditingPlan({...editingPlan, sort_order: Number(e.target.value)})} 
                    className="w-16 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 text-sm font-black p-2 text-center" 
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-100 px-4.5 py-2.5 text-sm"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => savePlanMutation.mutate(editingPlan)} 
                disabled={savePlanMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-5 py-2.5 text-sm shadow-md shadow-indigo-600/10"
              >
                {savePlanMutation.isPending ? 'Guardando...' : 'Guardar Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
