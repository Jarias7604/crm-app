import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { companyCalendarsService, CompanyCalendar } from '../../services/companyCalendars';
import toast from 'react-hot-toast';
import { Calendar, Plus, Trash2, Users, Check, X, Shield, Settings2 } from 'lucide-react';

export default function SharedCalendarsManager() {
  const { profile } = useAuth();
  const [calendars, setCalendars] = useState<CompanyCalendar[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState<CompanyCalendar | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    color: '#4285F4',
    integration_id: ''
  });

  const loadData = async () => {
    if (!profile?.company_id) return;
    try {
      const [cals, intsRes, usersRes] = await Promise.all([
        companyCalendarsService.getAll(profile.company_id),
        supabase.from('calendar_integrations').select('id, google_email, provider').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('profiles').select('id, full_name, email, role, avatar_url').eq('company_id', profile.company_id).eq('is_active', true)
      ]);
      
      setCalendars(cals);
      setIntegrations(intsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error loading shared calendars:', error);
      toast.error('Error cargando calendarios compartidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.company_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.integration_id) return toast.error('Completa los campos requeridos');
    
    try {
      await companyCalendarsService.create({
        company_id: profile!.company_id!,
        name: formData.name,
        color: formData.color,
        created_by: profile!.id
      });
      // Need to set integration_id too (the service create method needs to be updated to accept integration_id, wait, I'll pass it)
      // Actually my service create method in companyCalendarsService.ts didn't have integration_id in the type signature, but supabase insert accepts it.
      await supabase.from('company_calendars').update({ integration_id: formData.integration_id }).eq('company_id', profile!.company_id).eq('name', formData.name);
      
      toast.success('Calendario creado exitosamente');
      setShowCreateModal(false);
      setFormData({ name: '', color: '#4285F4', integration_id: '' });
      loadData();
    } catch (error) {
      toast.error('Error creando calendario');
    }
  };

  const handleToggleAccess = async (calendarId: string, userId: string, hasAccess: boolean) => {
    try {
      if (hasAccess) {
        await companyCalendarsService.revokeAccess(calendarId, userId);
      } else {
        await companyCalendarsService.grantAccess(calendarId, userId, profile!.id);
      }
      // Optimistic update
      loadData();
    } catch (error) {
      toast.error('Error actualizando acceso');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este calendario compartido?')) return;
    try {
      await companyCalendarsService.archive(id);
      toast.success('Calendario eliminado');
      loadData();
    } catch (error) {
      toast.error('Error eliminando calendario');
    }
  };

  if (loading) return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>;

  return (
    <div className="mt-8 border-t border-gray-100 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Calendarios de Equipo
          </h3>
          <p className="text-sm text-gray-500 mt-1">Crea calendarios compartidos y asigna quién puede verlos.</p>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Calendario
        </button>
      </div>

      {calendars.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-900">No hay calendarios compartidos</p>
          <p className="text-xs text-gray-500 mt-1">Crea uno para organizar a tu equipo (Ej: "Ventas", "Instalaciones")</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calendars.map(cal => (
            <div key={cal.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: cal.color }}></div>
              <div className="flex justify-between items-start mb-4 pl-2">
                <div>
                  <h4 className="font-black text-gray-900 text-base">{cal.name}</h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {cal.integration?.google_email || 'Sin conexión'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAccessModal(cal)} className="p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors" title="Gestionar Accesos">
                    <Shield className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cal.id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pl-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                  <span>Accesos ({cal.accesses?.length || 0})</span>
                  <button onClick={() => setShowAccessModal(cal)} className="text-indigo-600 hover:underline">Gestionar</button>
                </div>
                <div className="flex -space-x-2 overflow-hidden">
                  {cal.accesses?.slice(0, 5).map(acc => (
                    <div key={acc.user_id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600" title={acc.profile?.full_name}>
                      {acc.profile?.avatar_url ? (
                        <img src={acc.profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        acc.profile?.full_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                  ))}
                  {(cal.accesses?.length || 0) > 5 && (
                    <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-500">
                      +{(cal.accesses?.length || 0) - 5}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-xl text-gray-900">Nuevo Calendario</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Nombre del Grupo</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder="Ej: Equipo Comercial" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Color Identificador</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 bg-transparent" />
                  <span className="font-mono text-sm text-gray-500">{formData.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Cuenta de Google Fuente</label>
                <select required value={formData.integration_id} onChange={e => setFormData({...formData, integration_id: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium">
                  <option value="">Selecciona una cuenta conectada...</option>
                  {integrations.map(int => (
                    <option key={int.id} value={int.id}>{int.google_email}</option>
                  ))}
                </select>
                {integrations.length === 0 && (
                  <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3"/> Primero debes conectar una cuenta de Google Calendar arriba.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button type="submit" disabled={integrations.length === 0} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  Crear Calendario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCESS MODAL */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-black text-xl text-gray-900">Accesos</h3>
                <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: showAccessModal.color }}></span>
                  {showAccessModal.name}
                </p>
              </div>
              <button onClick={() => setShowAccessModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-gray-50/30">
              <div className="space-y-2">
                {users.map(user => {
                  const hasAccess = showAccessModal.accesses?.some(a => a.user_id === user.id);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                          {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" /> : user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleToggleAccess(showAccessModal.id, user.id, !!hasAccess)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${hasAccess ? 'bg-indigo-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasAccess ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
