import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, Mail, Phone, MessageSquare, Settings2,
  ChevronRight, ChevronDown, Save, RefreshCw, Check,
  Clock, Users, Send, ToggleLeft, ToggleRight, Edit3, X
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EmailStep {
  enabled: boolean;
  delay_days: number;
  subject: string;
  body: string;
}
interface NurtureConfig {
  wizard_done: boolean;
  product: string;
  tone: 'formal' | 'professional' | 'direct';
  whatsapp: string;
  channels: { email: boolean; agent_task: boolean };
  steps: { s1: EmailStep; s2: EmailStep; s3: EmailStep; rescue: EmailStep };
}

const DEFAULT_CONFIG: NurtureConfig = {
  wizard_done: false,
  product: '',
  tone: 'professional',
  whatsapp: '50371978911',
  channels: { email: true, agent_task: true },
  steps: {
    s1: { enabled: true, delay_days: 0, subject: 'Bienvenido a Arias Defense Components', body: 'Hola {nombre},\n\nNos comunicamos para presentarle nuestra solución de Facturación Electrónica DTE y ERP empresarial...' },
    s2: { enabled: true, delay_days: 3, subject: '¿Recibió nuestra información, {nombre}?', body: 'Hola {nombre},\n\nQueremos asegurarnos de que recibió la información que le enviamos y resolver cualquier duda...' },
    s3: { enabled: true, delay_days: 7, subject: 'Oferta especial para {empresa} — válida 48h', body: 'Hola {nombre},\n\nEste es nuestro último mensaje. Por las próximas 48 horas tenemos una oferta especial para usted...' },
    rescue: { enabled: true, delay_days: 2, subject: 'Su cotización está por vencer, {nombre}', body: 'Hola {nombre},\n\nSu cotización de Facturación Electrónica DTE está próxima a vencer. Confirme ahora para asegurar estas condiciones...' },
  },
};

// ── Wizard steps ──────────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 'product', label: 'Producto', question: '¿Cuál es tu producto o servicio principal?', placeholder: 'Ej: Facturación Electrónica DTE, ERP empresarial' },
  { id: 'tone', label: 'Tono', question: '¿Qué tono de comunicación prefieres?' },
  { id: 'whatsapp', label: 'CTA', question: '¿Cuál es tu número de WhatsApp para el botón de contacto?', placeholder: 'Ej: 50371978911' },
  { id: 'channels', label: 'Canales', question: '¿Qué hacer con leads sin email?' },
];

const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal ejecutivo', desc: 'Estimado Sr./Sra. — corporativo' },
  { value: 'professional', label: 'Profesional amigable', desc: 'Hola [nombre] — balance ideal' },
  { value: 'direct', label: 'Directo', desc: '[nombre], — conciso y claro' },
];

// ── Step Card (sequence editor) ───────────────────────────────────────────────
function StepCard({ label, badge, step, onChange }: { label: string; badge: string; step: EmailStep; onChange: (s: EmailStep) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border transition-all ${step.enabled ? 'border-slate-100 shadow-sm' : 'border-dashed border-slate-200 opacity-60'}`}>
      <div className="flex items-center gap-4 p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">{badge}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-slate-800 truncate">{step.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onChange({ ...step, enabled: !step.enabled })} className="text-slate-400 hover:text-blue-600 transition-colors">
            {step.enabled ? <ToggleRight className="w-5 h-5 text-blue-600" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Asunto</label>
            <input value={step.subject} onChange={e => onChange({ ...step, subject: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-blue-300 font-medium text-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Cuerpo <span className="normal-case font-normal text-slate-300">· variables: {'{nombre}'} {'{empresa}'}</span></label>
            <textarea rows={5} value={step.body} onChange={e => onChange({ ...step, body: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-blue-300 font-medium text-slate-700 resize-none" />
          </div>
          {label !== 'Rescate Cotización' && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Días de espera</label>
              <input type="number" min={0} max={30} value={step.delay_days} onChange={e => onChange({ ...step, delay_days: +e.target.value })}
                className="w-16 px-2 py-1 text-sm bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-slate-800 focus:outline-none focus:border-blue-300" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesEngineConfig() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<NurtureConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [stats, setStats] = useState({ queue: 0, sent: 0, next: '02:00' });

  useEffect(() => {
    if (!profile?.company_id) return;
    (async () => {
      const { data } = await supabase.from('ai_followup_settings')
        .select('nurture_config').eq('company_id', profile.company_id).maybeSingle();
      if (data?.nurture_config && Object.keys(data.nurture_config).length > 0) {
        setConfig({ ...DEFAULT_CONFIG, ...data.nurture_config });
      }
      // Stats: leads in queue
      const { count: queue } = await supabase.from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .not('email', 'is', null)
        .not('status', 'in', '("cerrado","perdido")');
      setStats(s => ({ ...s, queue: queue || 0 }));
      setLoading(false);
    })();
  }, [profile?.company_id]);

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      await supabase.from('ai_followup_settings')
        .upsert({ company_id: profile.company_id, nurture_config: { ...config, wizard_done: true } }, { onConflict: 'company_id' });
      setConfig(c => ({ ...c, wizard_done: true }));
      toast.success('Motor de ventas configurado');
    } catch { toast.error('Error al guardar'); }
    setSaving(false);
  };

  const generateFromWizard = () => {
    const name = config.tone === 'formal' ? 'Estimado/a {nombre}' : config.tone === 'direct' ? '{nombre},' : 'Hola {nombre}';
    const wa = `https://wa.me/${config.whatsapp}?text=Hola%2C+quiero+información`;
    setConfig(c => ({
      ...c,
      wizard_done: true,
      steps: {
        s1: { enabled: true, delay_days: 0, subject: `${name.split(' ')[0] === 'Estimado/a' ? '{nombre}' : ''} Conozca ${config.product || 'nuestra solución'}`, body: `${name},\n\nNos comunicamos desde Arias Defense Components para presentarle ${config.product || 'nuestra plataforma'}.\n\nResponda este mensaje o visítenos: ${wa}` },
        s2: { enabled: true, delay_days: 3, subject: `¿Recibió nuestra información, {nombre}?`, body: `${name},\n\nHace unos días le enviamos información sobre ${config.product || 'nuestra solución'}. Queremos asegurarnos de que la recibió.\n\nContacte: ${wa}` },
        s3: { enabled: true, delay_days: 7, subject: `Oferta especial para {empresa} — 48h`, body: `${name},\n\nEste es nuestro último mensaje. Por 48 horas tenemos implementación gratuita para su empresa.\n\nReclamar: ${wa}` },
        rescue: { enabled: true, delay_days: 2, subject: `Su cotización vence pronto, {nombre}`, body: `${name},\n\nSu cotización de ${config.product || 'nuestro servicio'} está por vencer. Confirme ahora.\n\n${wa}` },
      },
    }));
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
    </div>
  );

  const showWizard = !config.wizard_done;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 p-6 font-sans">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/marketing/cockpit" className="p-2 hover:bg-white rounded-xl transition-colors text-slate-500 shadow-sm border border-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Motor de Ventas Autónomo
            </h1>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Secuencias de email · Rescate de cotizaciones · Leads huérfanos</p>
          </div>
        </div>
        {!showWizard && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Motor
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Leads en Cola', value: stats.queue, icon: Users, color: 'text-blue-600' },
          { label: 'Próximo Ciclo', value: stats.next, icon: Clock, color: 'text-violet-600' },
          { label: 'Estado', value: config.wizard_done ? 'Activo' : 'Sin configurar', icon: config.wizard_done ? Check : Settings2, color: config.wizard_done ? 'text-emerald-600' : 'text-amber-600' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0`}>
              <m.icon className={`w-5 h-5 ${m.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.label}</p>
              <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Wizard */}
      {showWizard && (
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <div className="flex gap-2 mb-6">
                {WIZARD_STEPS.map((s, i) => (
                  <div key={s.id} className={`flex-1 h-1 rounded-full transition-all ${i <= wizardStep ? 'bg-blue-600' : 'bg-slate-100'}`} />
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Paso {wizardStep + 1} de {WIZARD_STEPS.length} · {WIZARD_STEPS[wizardStep].label}
              </p>
              <h2 className="text-lg font-black text-slate-900">{WIZARD_STEPS[wizardStep].question}</h2>
            </div>
            <div className="p-6">
              {wizardStep === 0 && (
                <input value={config.product} onChange={e => setConfig(c => ({ ...c, product: e.target.value }))}
                  placeholder={WIZARD_STEPS[0].placeholder}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-300" />
              )}
              {wizardStep === 1 && (
                <div className="space-y-2">
                  {TONE_OPTIONS.map(t => (
                    <button key={t.value} onClick={() => setConfig(c => ({ ...c, tone: t.value as any }))}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${config.tone === t.value ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-900">{t.label}</p>
                        <p className="text-[11px] text-slate-400">{t.desc}</p>
                      </div>
                      {config.tone === t.value && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  <input value={config.whatsapp} onChange={e => setConfig(c => ({ ...c, whatsapp: e.target.value }))}
                    placeholder={WIZARD_STEPS[2].placeholder}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-300" />
                  <p className="text-[11px] text-slate-400">Solo dígitos, con código de país. Ej: 50371978911</p>
                </div>
              )}
              {wizardStep === 3 && (
                <div className="space-y-2">
                  {[
                    { key: 'agent_task', label: 'Crear tarea al agente asignado', desc: 'El agente recibe una alerta para contactar manualmente' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setConfig(c => ({ ...c, channels: { ...c.channels, [opt.key]: !c.channels[opt.key as keyof typeof c.channels] } }))}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${config.channels[opt.key as keyof typeof config.channels] ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-900">{opt.label}</p>
                        <p className="text-[11px] text-slate-400">{opt.desc}</p>
                      </div>
                      {config.channels[opt.key as keyof typeof config.channels]
                        ? <ToggleRight className="w-5 h-5 text-blue-600 shrink-0" />
                        : <ToggleLeft className="w-5 h-5 text-slate-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-between">
              <button onClick={() => setWizardStep(s => Math.max(0, s - 1))} disabled={wizardStep === 0}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-0 transition-colors">
                Anterior
              </button>
              {wizardStep < WIZARD_STEPS.length - 1 ? (
                <button onClick={() => setWizardStep(s => s + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={generateFromWizard}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                  <Zap className="w-4 h-4" /> Generar Motor
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setConfig(c => ({ ...c, wizard_done: true }))} className="mt-4 w-full text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
            Saltar y configurar manualmente
          </button>
        </div>
      )}

      {/* Sequence Editor */}
      {!showWizard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Channels */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Canales Activos</h3>
              <div className="space-y-3">
                {[
                  { icon: Mail, label: 'Email', key: 'email', active: true, badge: 'Activo' },
                  { icon: Phone, label: 'Call Bot', key: 'call', active: false, badge: 'Próximamente' },
                  { icon: MessageSquare, label: 'WhatsApp Outbound', key: 'wa', active: false, badge: 'Próximamente' },
                ].map(ch => (
                  <div key={ch.key} className={`flex items-center justify-between p-3 rounded-xl border ${ch.active ? 'border-blue-100 bg-blue-50' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <ch.icon className={`w-4 h-4 ${ch.active ? 'text-blue-600' : 'text-slate-300'}`} />
                      <span className={`text-sm font-bold ${ch.active ? 'text-slate-800' : 'text-slate-400'}`}>{ch.label}</span>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${ch.active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{ch.badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Sin Email</h3>
              <div className="space-y-2">
                <button onClick={() => setConfig(c => ({ ...c, channels: { ...c.channels, agent_task: !c.channels.agent_task } }))}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${config.channels.agent_task ? 'border-blue-200 bg-blue-50' : 'border-slate-100'}`}>
                  <span className="text-sm font-bold text-slate-800">Tarea al agente</span>
                  {config.channels.agent_task ? <ToggleRight className="w-5 h-5 text-blue-600" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                </button>
              </div>
            </div>

            <button onClick={() => setConfig(c => ({ ...c, wizard_done: false })); setWizardStep(0)}
              className="w-full py-2.5 text-[11px] font-black text-slate-400 hover:text-blue-600 border border-slate-100 rounded-xl hover:border-blue-200 transition-all bg-white flex items-center justify-center gap-2">
              <Settings2 className="w-3.5 h-3.5" /> Reconfigurar Wizard
            </button>
          </div>

          {/* Right: Sequence */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secuencia de Correos</h3>
              <span className="text-[10px] text-slate-300 font-medium">Variables: {'{nombre}'} {'{empresa}'}</span>
            </div>
            {(['s1', 's2', 's3'] as const).map((key, i) => (
              <StepCard key={key}
                label={`Correo ${i + 1}`}
                badge={`Día ${config.steps[key].delay_days}`}
                step={config.steps[key]}
                onChange={s => setConfig(c => ({ ...c, steps: { ...c.steps, [key]: s } }))} />
            ))}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Cotización sin respuesta</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <StepCard label="Rescate Cotización" badge="+48h"
              step={config.steps.rescue}
              onChange={s => setConfig(c => ({ ...c, steps: { ...c.steps, rescue: s } }))} />
          </div>
        </div>
      )}
    </div>
  );
}
