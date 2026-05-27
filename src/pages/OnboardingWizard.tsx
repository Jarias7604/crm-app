import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Building2, CreditCard, Palette, PartyPopper, ChevronRight, ArrowRight, Shield, Users, Bot, Webhook, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { storageService } from '../services/storage';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  slug: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  maxUsers: number;
  features: string[];
  color: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    priceAnnual: 290,
    maxUsers: 5,
    color: 'bg-blue-500',
    features: ['Leads & Pipeline ilimitados', 'Cotizaciones PDF profesionales', 'Calendario de follow-ups', 'Reportes básicos', 'Soporte por email'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    priceAnnual: 990,
    maxUsers: 20,
    color: 'bg-purple-600',
    highlight: true,
    features: ['Todo en Starter', 'Marketing Hub completo', 'AI Consultant (/ai)', 'Bandeja omnicanal', 'Google Calendar Sync', 'Webhooks & API REST', 'Reportes avanzados', 'Soporte prioritario'],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 299,
    priceAnnual: 2990,
    maxUsers: 100,
    color: 'bg-slate-900',
    features: ['Todo en Pro', 'AI Autonomous Agent', 'Digital Sales Room', 'Revenue Intelligence', 'SSO & 2FA avanzado', 'Audit Log completo', 'SLA 99.9%', 'Soporte dedicado'],
  },
];

const STEPS = [
  { id: 1, label: 'Empresa', icon: Building2 },
  { id: 2, label: 'Plan', icon: Zap },
  { id: 3, label: 'Pago', icon: CreditCard },
  { id: 4, label: 'Diseño', icon: Palette },
  { id: 5, label: '¡Listo!', icon: PartyPopper },
];



function Step2Plan({ selectedPlan, onSelect, billingCycle, onCycleChange, onNext }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-center">
         <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
           Elige tu plan estratégico
         </h2>
         <p className="text-slate-500 text-sm font-medium">
           Comienza gratis por 14 días. Sin tarjeta requerida.
         </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Mensual</span>
        <button
          onClick={() => onCycleChange(billingCycle === 'monthly' ? 'annual' : 'monthly')}
          className={`w-14 h-8 rounded-full transition-colors relative ${billingCycle === 'annual' ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
          <span className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${billingCycle === 'annual' ? 'left-7' : 'left-1'}`} />
        </button>
        <span className={`text-sm font-bold flex items-center gap-2 ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>
          Anual <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">-17%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLANS.map(plan => {
           const isSelected = selectedPlan === plan.slug;
           return (
             <div
               key={plan.slug}
               onClick={() => onSelect(plan.slug)}
               className={`relative p-8 rounded-[2rem] border-2 transition-all cursor-pointer bg-white ${
                 isSelected ? 'border-indigo-600 shadow-xl shadow-indigo-600/10 scale-105 z-10' : 'border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md'
               }`}
             >
               {plan.highlight && (
                 <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
                   ⭐ Más Popular
                 </div>
               )}
               <div className="flex items-center gap-3 mb-6">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${plan.color}`}>
                   <Zap size={18} />
                 </div>
                 <span className="text-slate-900 font-black text-xl">{plan.name}</span>
               </div>
               <div className="mb-8">
                 <span className="text-4xl font-black text-slate-900">
                   ${billingCycle === 'annual' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly}
                 </span>
                 <span className="text-slate-500 font-medium">/mes</span>
               </div>
               <div className="space-y-4 mb-8">
                 {plan.features.map(f => (
                   <div key={f} className="flex items-start gap-3">
                     <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                     <span className="text-slate-600 text-sm font-medium leading-snug">{f}</span>
                   </div>
                 ))}
               </div>
               <div className={`w-full py-3 rounded-xl font-bold text-sm text-center transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500 group-hover:bg-slate-100'}`}>
                 {isSelected ? 'Plan Seleccionado' : 'Seleccionar'}
               </div>
             </div>
           );
        })}
      </div>

      <div className="mt-12 flex justify-center">
        <button className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2" onClick={onNext} disabled={!selectedPlan}>
          Continuar con {PLANS.find(p => p.slug === selectedPlan)?.name ?? 'Plan'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function Step3Payment({ onNext, isSaving }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
      <div className="mb-8 text-center">
         <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
           Información de Pago
         </h2>
         <p className="text-slate-500 text-sm font-medium">
           Tu pago es procesado de forma 100% segura por Stripe.
         </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-8 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl">
          <Shield size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Cifrado SSL de 256 bits</span>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Número de tarjeta</label>
            <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder="1234 5678 9012 3456" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Vencimiento</label>
              <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder="MM / AA" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">CVC</label>
              <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder="123" />
            </div>
          </div>
        </div>

        <p className="text-slate-400 text-xs mt-6 font-medium text-center">
          * En producción, este formulario usa Stripe Elements para máxima seguridad PCI.
        </p>
      </div>

      <button 
        disabled={isSaving}
        className="w-full bg-[#0f172a] text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50" 
        onClick={onNext}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Procesando activación...
          </>
        ) : (
          <>
            <CreditCard size={18} />
            Activar suscripción ahora
          </>
        )}
      </button>
      <p className="text-center text-slate-400 text-xs font-bold mt-4 uppercase tracking-wider">
        Sin contratos. Cancela en cualquier momento.
      </p>
    </div>
  );
}

function Step4Branding({ data, onChange, onNext, isSaving }: any) {
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange({ ...data, logoFile: file, logoPreview: URL.createObjectURL(file) });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
      <div className="mb-8 text-center">
         <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Personaliza tu CRM</h2>
         <p className="text-slate-500 text-sm font-medium">Haz que el CRM se sienta tuyo desde el primer día.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 text-center">Logo de tu empresa</label>
          <label className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors group block">
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            {data.logoPreview ? (
              <img src={data.logoPreview} className="w-20 h-20 object-contain rounded-xl mx-auto" />
            ) : (
              <>
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Palette className="w-8 h-8 text-indigo-400" />
                </div>
                <p className="text-slate-600 text-sm font-bold mb-1">Arrastra tu logo o <span className="text-indigo-600">examina</span></p>
                <p className="text-slate-400 text-xs font-medium">PNG, SVG o JPG — Máx 2MB</p>
              </>
            )}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Color de marca</label>
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
              <input type="color" value={data.primaryColor ?? '#4F46E5'} onChange={e => onChange({ ...data, primaryColor: e.target.value })} className="w-10 h-10 border-0 rounded-xl cursor-pointer p-0 bg-transparent" />
              <input className="flex-1 bg-transparent border-0 outline-none text-sm font-mono text-slate-700 uppercase" value={data.primaryColor ?? '#4F46E5'} onChange={e => onChange({ ...data, primaryColor: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nombre Corto</label>
            <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder="Ej: TechCRM" value={data.shortName ?? ''} onChange={e => onChange({ ...data, shortName: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex gap-4">
        <button className="flex-1 bg-white text-slate-600 border border-slate-200 px-6 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all" onClick={onNext} disabled={isSaving}>Saltar</button>
        <button className="flex-[2] bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2" onClick={onNext} disabled={isSaving}>
          {isSaving ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : <>Guardar y continuar <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}

function Step1Company({ data, onChange, onNext, isSaving }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-center">
         <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Bienvenido a Arias CRM</h2>
         <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto">Configuremos tu entorno de trabajo. Empezaremos por los datos de tu empresa.</p>
      </div>
      <div className="space-y-5 max-w-md mx-auto">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nombre de la empresa *</label>
          <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder="Ej: TechSolutions SRL" value={data.companyName} onChange={e => onChange({ ...data, companyName: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Industria</label>
          <select className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900 appearance-none" value={data.industry} onChange={e => onChange({ ...data, industry: e.target.value })}>
            <option value="">Selecciona tu industria</option>
            <option>Tecnología</option><option>Defensa y Seguridad</option><option>Salud</option>
            <option>Educación</option><option>Retail / Comercio</option><option>Manufactura</option>
            <option>Iglesia / Ministerio</option><option>Servicios Profesionales</option><option>Otro</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">País</label>
            <select className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900 appearance-none" value={data.country} onChange={e => onChange({ ...data, country: e.target.value })}>
              <option>El Salvador</option><option>Guatemala</option><option>Honduras</option>
              <option>Costa Rica</option><option>Panamá</option><option>México</option><option>Colombia</option><option>Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Equipo</label>
            <select className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900 appearance-none" value={data.teamSize} onChange={e => onChange({ ...data, teamSize: e.target.value })}>
              <option>1-5 personas</option><option>6-20 personas</option><option>21-50 personas</option><option>50+ personas</option>
            </select>
          </div>
        </div>
        <button onClick={onNext} disabled={!data.companyName || isSaving} className="w-full bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6">
          {isSaving ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : <>Continuar <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}

function Step5Done({ companyName, onGoToDashboard }: { companyName: string; onGoToDashboard: () => void }) {
  return (
    <div className="animate-in zoom-in-95 duration-500 text-center max-w-2xl mx-auto">
      <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/30 -rotate-6">
        <PartyPopper className="w-12 h-12 text-white" />
      </div>
      
      <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
        ¡{companyName || 'Tu empresa'} está lista!
      </h2>
      <p className="text-slate-500 text-lg font-medium max-w-md mx-auto mb-12">
        Tu CRM ha sido configurado exitosamente. Tu equipo puede empezar a trabajar hoy mismo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 text-left">
        {[
          { icon: Users, label: 'Invita a tu equipo', desc: 'Agrega a tus primeros usuarios', href: '/company/team' },
          { icon: Bot, label: 'Configura tu AI', desc: 'Personaliza el agente IA', href: '/marketing/ai-agents' },
          { icon: Webhook, label: 'Conecta tus apps', desc: 'Sincroniza el Calendario', href: '/company/integrations' },
        ].map(item => (
          <a
            key={item.label}
            href={item.href}
            className="group block p-6 bg-white border border-slate-200 rounded-3xl hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-600/10 transition-all hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-600 transition-all">
               <item.icon className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <h4 className="font-black text-slate-900 mb-1">{item.label}</h4>
            <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
          </a>
        ))}
      </div>

      <button
        onClick={onGoToDashboard}
        className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-slate-900/20 hover:scale-105 transition-transform"
      >
        Ir a mi Dashboard <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OnboardingWizard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [companyData, setCompanyData] = useState({
    companyName: '', industry: '', country: 'El Salvador', teamSize: '1-5 personas',
    primaryColor: '#4F46E5', shortName: '', logoFile: null as File | null, logoPreview: '',
  });

  // Step 1: save basic company info to DB
  const handleStep1Next = async () => {
    if (!profile?.company_id || !companyData.companyName) { setStep(2); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: companyData.companyName })
        .eq('id', profile.company_id);
      if (error) throw error;
    } catch {
      toast.error('No se pudo guardar el nombre. Continúa y edítalo después.');
    } finally {
      setIsSaving(false);
      setStep(2);
    }
  };

  // Step 3: save real subscription based on selected plan and cycle
  const handleStep3Next = async () => {
    if (!profile?.company_id) { setStep(4); return; }
    setIsSaving(true);
    try {
      // 1. Fetch the selected plan details to get plan id
      const { data: planData, error: planError } = await supabase
        .from('saas_plans')
        .select('id, name')
        .eq('slug', selectedPlan)
        .single();
      if (planError) throw planError;

      // 2. Determine dates
      const now = new Date();
      const periodEnd = new Date();
      if (billingCycle === 'annual') {
        periodEnd.setFullYear(now.getFullYear() + 1);
      } else {
        periodEnd.setMonth(now.getMonth() + 1);
      }

      // 3. Upsert into company_subscriptions
      const { error: subError } = await supabase
        .from('company_subscriptions')
        .upsert({
          company_id: profile.company_id,
          plan_id: planData.id,
          status: 'active',
          billing_cycle: billingCycle,
          trial_ends_at: null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_customer_id: 'cus_simulated_' + profile.company_id.substring(0, 8),
          stripe_subscription_id: 'sub_simulated_' + profile.company_id.substring(0, 8),
          updated_at: now.toISOString(),
        }, { onConflict: 'company_id' });

      if (subError) throw subError;

      toast.success(`🎉 ¡Plan ${planData.name} activado con éxito!`);
      
      // Notify components to update subscription cache
      window.dispatchEvent(new CustomEvent('company-subscription-updated'));
    } catch (err: any) {
      console.error('[OnboardingWizard] Error updating subscription:', err);
      toast.error('Error al activar el plan. Reintentando...');
    } finally {
      setIsSaving(false);
      setStep(4);
    }
  };

  // Step 4: save branding (logo + color) to DB
  // Logo upload is fully non-blocking — if storage fails or no file selected,
  // the wizard still advances to Step 5 silently. User can upload logo later.
  const handleStep4Next = async () => {
    if (!profile?.company_id) { setStep(5); return; }

    // Only attempt upload if user actually selected a file
    if (companyData.logoFile) {
      setIsSaving(true);
      try {
        const logoUrl = await storageService.uploadLogo(profile.company_id, companyData.logoFile);
        await supabase
          .from('companies')
          .update({ logo_url: logoUrl })
          .eq('id', profile.company_id);
        toast.success('✅ Logo guardado correctamente.');
        // Notify Sidebar to reload company branding immediately
        window.dispatchEvent(new CustomEvent('company-branding-updated'));
      } catch {
        // Silent fail — storage policy may not be configured yet.
        // User can upload logo from Company → Branding later.
        console.warn('[Onboarding] Logo upload skipped — configure storage policy in Supabase Dashboard → Storage → avatars → New policy (Allow uploads for authenticated users).');
      } finally {
        setIsSaving(false);
      }
    }

    setStep(5);
  };

  const StepHeader = () => (
    <div className="w-full bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-[14px] flex items-center justify-center shadow-md">
          <Zap size={20} className="text-white" />
        </div>
        <span className="text-xl font-black text-slate-900 tracking-tight">Arias CRM</span>
      </div>
      <div className="hidden sm:flex items-center gap-8">
        {STEPS.map((s, i) => {
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-100 text-slate-400'
              }`}>
                {isDone ? <Check size={14} /> : s.id}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-indigo-900' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200 ml-5" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      <StepHeader />
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className={`w-full transition-all duration-500 ${step === 2 || step === 5 ? 'max-w-5xl' : 'max-w-xl'}`}>
          {step === 1 && <Step1Company data={companyData} onChange={setCompanyData} onNext={handleStep1Next} isSaving={isSaving} />}
          {step === 2 && <Step2Plan selectedPlan={selectedPlan} onSelect={setSelectedPlan} billingCycle={billingCycle} onCycleChange={setBillingCycle} onNext={() => setStep(3)} />}
          {step === 3 && <Step3Payment onNext={handleStep3Next} isSaving={isSaving} />}
          {step === 4 && <Step4Branding data={companyData} onChange={setCompanyData} onNext={handleStep4Next} isSaving={isSaving} />}
          {step === 5 && <Step5Done companyName={companyData.companyName} onGoToDashboard={() => navigate('/dashboard')} />}
        </div>
      </div>
      <div className="py-6 text-center">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">© 2026 Arias Defense · Nivel Empresarial</p>
      </div>
    </div>
  );
}
