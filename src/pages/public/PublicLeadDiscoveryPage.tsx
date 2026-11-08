import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Building2,
  User,
  Sparkles,
  Calendar,
  ArrowRight,
  Loader2,
  Check,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

interface DiscoveryContext {
  ticket_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  client_name: string;
  client_company: string;
  phone: string;
  provider_name: string;
  provider_logo?: string | null;
  seller_name: string;
  booking_slug?: string | null;
  existing_discovery?: Record<string, string>;
}

const Q1_OPTIONS = [
  'Facturación Electrónica (DTE)',
  'Control de Inventario y Bodegas',
  'Contabilidad e Impuestos (IVA)',
  'Punto de Venta (POS) / Caja',
  'Cuentas por Cobrar / Vendedores',
  'Sistema ERP Completo',
];

const Q2_OPTIONS = [
  'Pérdida de tiempo en procesos manuales',
  'Diferencias de inventario o mermas',
  'Atrasos en facturación o reportes contables',
  'Falta de control en sucursales o ventas',
];

const Q3_OPTIONS = [
  'Excel o control manual',
  'Facturador gratuito de Hacienda',
  'Otro sistema contable / ERP',
  'Empezando operación desde cero',
];

const Q4_OPTIONS = [
  'Solo yo (Propietario / Gerente)',
  'Con mi socio o Junta Directiva',
  'Con nuestro Contador / Financiero',
];

const Q5_OPTIONS = [
  'Inmediato (Esta semana)',
  'En el transcurso de este mes',
  'El próximo mes',
  'Evaluando opciones y presupuesto',
];

const Q6_OPTIONS = [
  '1 a 2 usuarios',
  '3 a 5 usuarios',
  '6 a 15 usuarios',
  'Más de 15 usuarios / Varias sucursales',
];

const Q7_OPTIONS = [
  'Agendar breve Demo de 15 min + Recibir Cotización',
  'Recibir Cotización PDF por WhatsApp primero',
];

export default function PublicLeadDiscoveryPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ctx, setCtx] = useState<DiscoveryContext | null>(null);

  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [q1, setQ1] = useState<string>('');
  const [q1Extra, setQ1Extra] = useState<string>('');
  const [q2, setQ2] = useState<string>('');
  const [q3, setQ3] = useState<string>('');
  const [q4, setQ4] = useState<string>('');
  const [q5, setQ5] = useState<string>('');
  const [q6, setQ6] = useState<string>('');
  const [q7, setQ7] = useState<string>(Q7_OPTIONS[0]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_public_lead_discovery', { p_id: id });
        if (!cancelled && !error && data) {
          const d = data as DiscoveryContext;
          setCtx(d);
          const cleanName =
            d.client_name && !/^(contacto|cliente|prospecto)\b/i.test(d.client_name) ? d.client_name : '';
          setClientName(cleanName || searchParams.get('name') || '');
          setCompanyName(
            d.client_company && d.client_company !== 'Individual'
              ? d.client_company
              : searchParams.get('company') || ''
          );
          if (d.existing_discovery) {
            if (d.existing_discovery.q1) setQ1(d.existing_discovery.q1);
            if (d.existing_discovery.q2) setQ2(d.existing_discovery.q2);
            if (d.existing_discovery.q3) setQ3(d.existing_discovery.q3);
            if (d.existing_discovery.q4) setQ4(d.existing_discovery.q4);
            if (d.existing_discovery.q5) setQ5(d.existing_discovery.q5);
            if (d.existing_discovery.q6) setQ6(d.existing_discovery.q6);
            if (d.existing_discovery.q7) setQ7(d.existing_discovery.q7);
          }
          setLoading(false);
          return;
        }
      } catch {
        // Fallback if RPC not yet applied
      }

      if (!cancelled) {
        setCtx({
          ticket_id: id,
          lead_id: id,
          company_id: null,
          client_name: searchParams.get('name') || '',
          client_company: searchParams.get('company') || '',
          phone: searchParams.get('phone') || '',
          provider_name: searchParams.get('provider') || 'Equipo Comercial',
          seller_name: searchParams.get('seller') || 'Jimmy Arias',
          booking_slug: searchParams.get('book') || null,
        });
        setClientName(searchParams.get('name') || '');
        setCompanyName(searchParams.get('company') || '');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  const toggleMultiQ1 = (item: string) => {
    const parts = q1
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.includes(item)) {
      setQ1(parts.filter((x) => x !== item).join(', '));
    } else {
      setQ1([...parts, item].join(', '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQ1 = [q1, q1Extra.trim()].filter(Boolean).join(' · ');
    if (!clientName.trim() || !finalQ1) {
      toast.error('Por favor ingresa tu nombre y selecciona qué necesidad buscas resolver.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_name: clientName.trim(),
        company_name: companyName.trim() || 'Individual',
        q1: finalQ1,
        q2: q2 || 'Por cuantificar en sesión',
        q3: q3 || 'No especificado',
        q4: q4 || 'Propietario / Directo',
        q5: q5 || 'Por definir',
        q6: q6 || '1 a 3 usuarios',
        q7: q7 || Q7_OPTIONS[0],
      };

      const { error } = await supabase.rpc('submit_public_lead_discovery', {
        p_id: id,
        p_payload: payload,
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success('¡Gracias! Recibimos tu información.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo enviar el diagnóstico, intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-600">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          <span>Cargando formulario…</span>
        </div>
      </div>
    );
  }

  const bookingUrl = ctx?.booking_slug ? `${window.location.origin}/book/${ctx.booking_slug}` : null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl max-w-lg w-full p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900">¡Diagnóstico recibido con éxito!</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Gracias, <b>{clientName}</b>. Tu asesor <b>{ctx?.seller_name || 'Jimmy Arias'}</b> ya recibió tus respuestas en WhatsApp para prepararte la propuesta exacta según tu necesidad.
            </p>
          </div>

          {bookingUrl && (
            <div className="bg-[#EEF0FF] border border-indigo-200 rounded-2xl p-4 space-y-3 text-left">
              <div className="flex items-start gap-2.5">
                <Calendar className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-indigo-950">
                    ¿Deseas dejar agendada una breve llamada o demostración de 15 minutos?
                  </p>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Así revisamos juntos tu cotización, te mostramos el sistema en vivo y resolvemos cualquier duda.
                  </p>
                </div>
              </div>
              <a
                href={bookingUrl}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs"
              >
                <Calendar className="w-4 h-4" />
                <span>Elegir día y hora para mi demostración</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <div className="pt-2 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Ya puedes regresar a tu conversación de WhatsApp.</span>
          </div>
        </div>
      </div>
    );
  }

  const selectedQ1Parts = q1
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F5F6FA] py-6 px-4 sm:px-6 flex justify-center">
      <div className="max-w-xl w-full space-y-4">
        {/* Header Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] border border-indigo-200/80 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Diagnóstico Rápido · 30 segundos
              </span>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                Información para tu Cotización a Medida
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
            Hola{clientName ? ` ${clientName}` : ''}, selecciona las opciones que mejor describen lo que buscas para que{' '}
            <b>{ctx?.seller_name || 'nuestro equipo'}</b> te envíe por WhatsApp los precios y detalles exactos para tu negocio.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tu nombre <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. Carlos Mendoza"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de tu empresa o negocio
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ej. Comercial Mendoza / Giro"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Question 1: Proceso prioritario */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">1. Necesidad principal</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                ¿Qué área o proceso buscas resolver primero? <span className="text-rose-500">*</span>
              </h3>
              <p className="text-[11px] text-slate-400">Puedes tocar una o varias opciones</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Q1_OPTIONS.map((opt) => {
                const active = selectedQ1Parts.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleMultiQ1(opt)}
                    className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition ${
                      active
                        ? 'bg-[#EEF0FF] border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-slate-50/70 border-slate-200/90 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt}</span>
                    {active && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={q1Extra}
              onChange={(e) => setQ1Extra(e.target.value)}
              placeholder="¿Algún otro detalle o requerimiento específico? (Opcional)"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Question 6 & Question 3: Tamaño y Sistema Actual */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">2. Alcance y Usuarios</span>
              <h3 className="text-sm font-bold text-slate-900">
                ¿Cuántos usuarios o cajas usarían el sistema aproximadamente?
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Q6_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setQ6(opt)}
                    className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold transition ${
                      q6 === opt
                        ? 'bg-[#EEF0FF] border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-slate-50/70 border-slate-200/90 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">3. Sistema Actual</span>
              <h3 className="text-sm font-bold text-slate-900">¿Cómo llevan este control hoy en día?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Q3_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setQ3(opt)}
                    className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold transition ${
                      q3 === opt
                        ? 'bg-[#EEF0FF] border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-slate-50/70 border-slate-200/90 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question 2, 4, 5: Impacto, Decisor y Plazo */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                4. Principal prioridad a mejorar
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                ¿Qué es lo que más les urge solucionar en la operación?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Q2_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setQ2(opt)}
                    className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold transition ${
                      q2 === opt
                        ? 'bg-[#EEF0FF] border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-slate-50/70 border-slate-200/90 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  5. ¿En qué plazo buscan implementarlo?
                </label>
                <select
                  value={q5}
                  onChange={(e) => setQ5(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value="">Seleccionar plazo…</option>
                  {Q5_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  6. ¿Quiénes aprueban la decisión?
                </label>
                <select
                  value={q4}
                  onChange={(e) => setQ4(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value="">Seleccionar…</option>
                  {Q4_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                7. ¿Cómo prefieres que te compartamos tu propuesta?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {Q7_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setQ7(opt)}
                    className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition ${
                      q7 === opt
                        ? 'bg-[#EEF0FF] border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-slate-50/70 border-slate-200/90 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt}</span>
                    {q7 === opt && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 transition"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando información…</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                <span>Enviar diagnóstico y solicitar mi cotización</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

