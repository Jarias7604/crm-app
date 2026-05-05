import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Package, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function PlanManager() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    onError: (error) => {
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            SaaS Plans Manager
          </h1>
          <p className="text-slate-500 mt-1">Gestiona los paquetes y precios que se muestran en la Landing Page.</p>
        </div>
        <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Plan
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
              <th className="p-4 font-semibold">Plan / Slug</th>
              <th className="p-4 font-semibold">Precio (Mes/Año)</th>
              <th className="p-4 font-semibold">Límites (Usr/Lds/AI)</th>
              <th className="p-4 font-semibold">Estado</th>
              <th className="p-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Cargando planes...</td></tr>
            ) : (
              plans.map(plan => (
                <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{plan.name}</div>
                    <div className="text-xs text-slate-500">{plan.slug}</div>
                  </td>
                  <td className="p-4 text-sm">
                    <div>${plan.price_monthly} /mo</div>
                    <div className="text-slate-500">${plan.price_annual} /yr</div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    <div>{plan.max_users} Users</div>
                    <div>{plan.max_leads.toLocaleString()} Leads</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {plan.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {plan.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingPlan.id ? 'Editar Plan' : 'Nuevo Plan'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Plan</label>
                  <input type="text" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (ej. pro, starter)</label>
                  <input type="text" value={editingPlan.slug} onChange={e => setEditingPlan({...editingPlan, slug: e.target.value})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" disabled={!!editingPlan.id} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción corta</label>
                <input type="text" value={editingPlan.description} onChange={e => setEditingPlan({...editingPlan, description: e.target.value})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Mensual ($)</label>
                  <input type="number" value={editingPlan.price_monthly} onChange={e => setEditingPlan({...editingPlan, price_monthly: Number(e.target.value)})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Anual ($)</label>
                  <input type="number" value={editingPlan.price_annual} onChange={e => setEditingPlan({...editingPlan, price_annual: Number(e.target.value)})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Usuarios</label>
                  <input type="number" value={editingPlan.max_users} onChange={e => setEditingPlan({...editingPlan, max_users: Number(e.target.value)})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Leads</label>
                  <input type="number" value={editingPlan.max_leads} onChange={e => setEditingPlan({...editingPlan, max_leads: Number(e.target.value)})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max AI Tokens</label>
                  <input type="number" value={editingPlan.max_ai_tokens} onChange={e => setEditingPlan({...editingPlan, max_ai_tokens: Number(e.target.value)})} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
              </div>

              {/* Features Array */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Características (Features)</label>
                  <Button variant="outline" size="sm" onClick={addFeature} className="py-1 h-auto text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingPlan.features.map((feat: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={feat} 
                        onChange={e => handleFeatureChange(idx, e.target.value)}
                        className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <button onClick={() => removeFeature(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.is_active} 
                    onChange={e => setEditingPlan({...editingPlan, is_active: e.target.checked})}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Plan Activo (Visible en Landing)</span>
                </label>
                
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm font-medium text-slate-700">Orden:</span>
                  <input type="number" value={editingPlan.sort_order} onChange={e => setEditingPlan({...editingPlan, sort_order: Number(e.target.value)})} className="w-20 rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button 
                onClick={() => savePlanMutation.mutate(editingPlan)} 
                disabled={savePlanMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savePlanMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
