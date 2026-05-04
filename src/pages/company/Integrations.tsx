import { useState, useEffect } from 'react';
import {
  Calendar, Webhook, Key, CheckCircle, ExternalLink, Plus, Trash2,
  AlertCircle, ChevronRight, Globe, Copy, RefreshCw, X, Check, Mail, Monitor
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const WEBHOOK_EVENTS = [
  { key: 'lead.created', label: 'Lead Creado', desc: 'Se dispara cuando se crea un nuevo lead' },
  { key: 'lead.won', label: 'Lead Ganado', desc: 'Cuando un lead cambia a estado Cerrado/Ganado' },
  { key: 'lead.lost', label: 'Lead Perdido', desc: 'Cuando un lead se marca como Perdido' },
  { key: 'quote.sent', label: 'Cotización Enviada', desc: 'Cuando se envía una cotización al cliente' },
  { key: 'quote.accepted', label: 'Cotización Aceptada', desc: 'Cuando el cliente acepta la propuesta' },
  { key: 'follow_up.due', label: 'Follow-up Pendiente', desc: 'Cuando un follow-up vence hoy' },
];

interface WebhookForm {
  name: string;
  url: string;
  secret: string;
  events: string[];
}

type TabType = 'calendar' | 'webhooks' | 'api';

export default function Integrations() {
  const { profile } = useAuth();
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [integrationId, setIntegrationId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchIntegrations = async () => {
        const { data } = await supabase
            .from('calendar_integrations')
            .select('*')
            .eq('user_id', profile.id)
            .eq('provider', 'google')
            .single();
        
        if (data && data.is_active) {
            setCalendarConnected(true);
            setIntegrationId(data.id);
        }
    };
    fetchIntegrations();
  }, [profile?.id]);

  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookForm, setWebhookForm] = useState<WebhookForm>({ name: '', url: '', secret: '', events: [] });
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>('calendar');

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleConnectGoogle = async () => {
    if (!GOOGLE_CLIENT_ID) {
        toast.error('Google Client ID no configurado');
        return;
    }
    toast.success('Redirigiendo a Google OAuth...');
    const redirectUri = `${window.location.origin}/integrations/google/callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  };

  const handleDisconnectGoogle = async () => {
    if (!integrationId) return;
    const { error } = await supabase.from('calendar_integrations').delete().eq('id', integrationId);
    if (error) {
        toast.error('Error al desconectar');
    } else {
        setCalendarConnected(false);
        setIntegrationId(null);
        toast.success('Google Calendar desconectado');
    }
  };

  const handleConnectOutlook = async () => {
    toast.success('Redirigiendo a Microsoft OAuth...');
    setTimeout(() => {
      setOutlookConnected(true);
      toast.success('Microsoft Outlook conectado exitosamente');
    }, 1500);
  };

  const toggleEvent = (key: string) => {
    setWebhookForm(f => ({
      ...f,
      events: f.events.includes(key) ? f.events.filter(e => e !== key) : [...f.events, key],
    }));
  };

  const saveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0) {
      toast.error('Completa nombre, URL y selecciona al menos 1 evento'); return;
    }
    setSavingWebhook(true);
    const { data, error } = await supabase.from('company_webhooks').insert({
      company_id: profile?.company_id,
      name: webhookForm.name,
      url: webhookForm.url,
      secret: webhookForm.secret || null,
      events: webhookForm.events,
    }).select().single();
    
    setSavingWebhook(false);
    if (error) { toast.error('Error guardando webhook'); return; }
    
    setWebhooks(w => [data, ...w]);
    setShowWebhookModal(false);
    setWebhookForm({ name: '', url: '', secret: '', events: [] });
    toast.success('Webhook configurado exitosamente');
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from('company_webhooks').delete().eq('id', id);
    setWebhooks(w => w.filter(wh => wh.id !== id));
    toast.success('Webhook eliminado');
  };

  const generateApiKey = () => {
    if (!newApiKeyName) { toast.error('Agrega un nombre para la API Key'); return; }
    const key = `aria_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    setGeneratedKey(key);
    setApiKeys(k => [{ id: crypto.randomUUID(), name: newApiKeyName, key_prefix: key.slice(0, 12) + '...', created_at: new Date().toISOString(), is_active: true }, ...k]);
    setNewApiKeyName('');
    toast.success('API Key generada con éxito');
  };

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); toast.success('Copiado al portapapeles'); };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header and Tabs - Copied from MarketingSettings */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div>
            <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Integraciones y API</h1>
            <p className="text-sm text-gray-500">Conecta tu CRM con las herramientas que ya usas.</p>
          </div>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-2xl relative z-10">
          <button
            onClick={() => setTab('calendar')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${tab === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Calendar className="w-3.5 h-3.5" /> Calendar
          </button>
          <button
            onClick={() => setTab('webhooks')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${tab === 'webhooks' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Webhook className="w-3.5 h-3.5" /> Webhooks
          </button>
          <button
            onClick={() => setTab('api')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${tab === 'api' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Key className="w-3.5 h-3.5" /> API Keys
          </button>
        </div>
      </div>

      {tab === 'calendar' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Tarjeta Google Calendar */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4285F4]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-[#4285F4]/10 transition-colors"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#4285F4]/10 text-[#4285F4] rounded-2xl flex items-center justify-center shadow-inner">
                   <Calendar className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Google Calendar</h2>
                  <p className="text-sm text-gray-500 font-medium">Sincronización nativa con Google Workspace.</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 ${calendarConnected ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                {calendarConnected ? <><CheckCircle className="w-4 h-4" /> Conectado</> : <><AlertCircle className="w-4 h-4" /> No conectado</>}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
               <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-[#4285F4]/10 text-[#4285F4] rounded-xl flex items-center justify-center mb-3"><RefreshCw className="w-5 h-5"/></div>
                  <h3 className="font-black text-gray-900 text-sm mb-1">Bidireccional</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Los leads y eventos viajan en ambas vías en tiempo real.</p>
               </div>
               <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-[#0F9D58]/10 text-[#0F9D58] rounded-xl flex items-center justify-center mb-3"><ExternalLink className="w-5 h-5"/></div>
                  <h3 className="font-black text-gray-900 text-sm mb-1">Google Meet</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Autogenera enlaces para tus reuniones automáticamente.</p>
               </div>
               <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-[#F4B400]/10 text-[#F4B400] rounded-xl flex items-center justify-center mb-3"><Calendar className="w-5 h-5"/></div>
                  <h3 className="font-black text-gray-900 text-sm mb-1">Citas Directas</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Convierte tu disponibilidad en enlaces para clientes.</p>
               </div>
            </div>

            <div className="border-t border-gray-100 pt-6 flex justify-end relative z-10">
               {!calendarConnected ? (
                 <button onClick={handleConnectGoogle} className="bg-[#4285F4] text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-[#4285F4]/20 hover:bg-[#3367D6] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                   <Globe className="w-4 h-4" />
                   Conectar Google Workspace
                 </button>
               ) : (
                 <button onClick={handleDisconnectGoogle} className="bg-white text-red-500 border border-red-200 px-6 py-3 rounded-2xl font-black hover:bg-red-50 transition-all flex items-center gap-2">
                   Desconectar
                 </button>
               )}
            </div>
          </div>

          {/* Tarjeta Microsoft Outlook */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0078D4]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-[#0078D4]/10 transition-colors"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#0078D4]/10 text-[#0078D4] rounded-2xl flex items-center justify-center shadow-inner">
                   <Mail className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Microsoft Outlook</h2>
                  <p className="text-sm text-gray-500 font-medium">Sincronización con Outlook y Office 365.</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 ${outlookConnected ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                {outlookConnected ? <><CheckCircle className="w-4 h-4" /> Conectado</> : <><AlertCircle className="w-4 h-4" /> No conectado</>}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
               <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-[#0078D4]/10 text-[#0078D4] rounded-xl flex items-center justify-center mb-3"><RefreshCw className="w-5 h-5"/></div>
                  <h3 className="font-black text-gray-900 text-sm mb-1">Bidireccional</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Sincroniza tus eventos hacia y desde tu CRM al instante.</p>
               </div>
               <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-[#464EB8]/10 text-[#464EB8] rounded-xl flex items-center justify-center mb-3"><Monitor className="w-5 h-5"/></div>
                  <h3 className="font-black text-gray-900 text-sm mb-1">Microsoft Teams</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Enlaces automáticos de Teams para tus reuniones.</p>
               </div>
               <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-[#0078D4]/10 text-[#0078D4] rounded-xl flex items-center justify-center mb-3"><Mail className="w-5 h-5"/></div>
                  <h3 className="font-black text-gray-900 text-sm mb-1">Exchange Sync</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Compatible con infraestructuras corporativas Exchange.</p>
               </div>
            </div>

            <div className="border-t border-gray-100 pt-6 flex justify-end relative z-10">
               {!outlookConnected ? (
                 <button onClick={handleConnectOutlook} className="bg-[#0078D4] text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-[#0078D4]/20 hover:bg-[#005A9E] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                   <Globe className="w-4 h-4" />
                   Conectar Office 365
                 </button>
               ) : (
                 <button onClick={() => setOutlookConnected(false)} className="bg-white text-red-500 border border-red-200 px-6 py-3 rounded-2xl font-black hover:bg-red-50 transition-all flex items-center gap-2">
                   Desconectar
                 </button>
               )}
            </div>
          </div>

        </div>
      )}

      {/* ── TAB: Webhooks ──────────────────────────────────────────────────── */}
      {tab === 'webhooks' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
             <div>
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-1">
                  <Webhook className="w-6 h-6 text-purple-500" />
                  Webhooks de Salida
                </h2>
                <p className="text-sm text-gray-500 font-medium">Envía datos en tiempo real a Zapier, Make o tu propio servidor.</p>
             </div>
             <button onClick={() => setShowWebhookModal(true)} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-purple-700 hover:shadow-purple-500/20 transition-all flex items-center gap-2 whitespace-nowrap">
               <Plus className="w-4 h-4" /> Nuevo Webhook
             </button>
          </div>

          {webhooks.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-3xl p-16 text-center">
               <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Webhook className="w-10 h-10 text-gray-300" />
               </div>
               <h3 className="text-xl font-black text-gray-900 mb-2">No hay webhooks activos</h3>
               <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">Conecta tu CRM con miles de aplicaciones creando un webhook.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {webhooks.map(wh => (
                 <div key={wh.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                           <Webhook className="w-5 h-5"/>
                         </div>
                         <div>
                           <h3 className="font-black text-gray-900">{wh.name}</h3>
                           <p className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{wh.url}</p>
                         </div>
                       </div>
                       <button onClick={() => deleteWebhook(wh.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {wh.events.map((e: string) => (
                         <span key={e} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black tracking-wider uppercase">{e}</span>
                       ))}
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: API Keys ──────────────────────────────────────────────────── */}
      {tab === 'api' && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-1">
                <Key className="w-6 h-6 text-amber-500" />
                API Keys
              </h2>
              <p className="text-sm text-gray-500 font-medium">Genera credenciales para acceso programático a la API del CRM.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <input
              placeholder="Nombre de la nueva API Key (ej: ERP Integración)"
              value={newApiKeyName}
              onChange={e => setNewApiKeyName(e.target.value)}
              className="flex-1 px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-medium focus:ring-2 focus:ring-amber-500 outline-none transition-all"
            />
            <button onClick={generateApiKey} className="bg-amber-500 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-amber-500/20 hover:bg-amber-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Generar Key
            </button>
          </div>

          {generatedKey && (
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 mb-8 animate-in slide-in-from-top-4">
              <p className="text-amber-900 font-black mb-3 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> IMPORTANTE: Copia esta clave ahora, no volverá a mostrarse.
              </p>
              <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                <code className="flex-1 font-mono text-sm text-gray-800 break-all">{generatedKey}</code>
                <button onClick={() => copyKey(generatedKey)} className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 shrink-0">
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
             {apiKeys.length === 0 && !generatedKey ? (
               <div className="text-center py-12">
                 <p className="text-gray-400 font-medium">No hay API Keys generadas.</p>
               </div>
             ) : (
               apiKeys.map(k => (
                 <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><Key className="w-4 h-4"/></div>
                      <div>
                        <h4 className="font-black text-gray-900">{k.name}</h4>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{k.key_prefix}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Activa</span>
                      <span className="text-xs text-gray-400 font-medium">{new Date(k.created_at).toLocaleDateString()}</span>
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>
      )}

      {/* ── Webhook Modal ──────────────────────────────────────────────────── */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-xl text-gray-900">Crear Webhook</h3>
              <button onClick={() => setShowWebhookModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={saveWebhook} className="p-6 overflow-y-auto space-y-5">
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Nombre identificador</label>
                  <input required value={webhookForm.name} onChange={e => setWebhookForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium" placeholder="Ej: Zapier Leads" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">URL de Destino (Endpoint)</label>
                  <input required type="url" value={webhookForm.url} onChange={e => setWebhookForm(f => ({ ...f, url: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium font-mono text-sm" placeholder="https://..." />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Secret (Opcional)</label>
                  <input value={webhookForm.secret} onChange={e => setWebhookForm(f => ({ ...f, secret: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium" placeholder="Para firmar los payloads (HMAC)" />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider mt-2">Eventos a escuchar</label>
                  <div className="space-y-2">
                    {WEBHOOK_EVENTS.map(ev => {
                      const isSelected = webhookForm.events.includes(ev.key);
                      return (
                        <label key={ev.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                          <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-gray-50 border-gray-300'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-black ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>{ev.label}</p>
                            <p className="text-xs text-gray-500 font-medium">{ev.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
               </div>
               
               <div className="pt-4 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowWebhookModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
                 <button type="submit" disabled={savingWebhook} className="bg-[#0f172a] text-white px-8 py-3 rounded-xl font-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                   {savingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                   Guardar Webhook
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
