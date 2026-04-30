import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Loader2, Trash2, DollarSign, CreditCard, Calendar, CheckCircle2, Calculator, ArrowRight } from 'lucide-react';
import { pagosService, planPagoService, type Pago, type TipoPago, type MetodoPago, type PlanPago, type CuotaEsperada } from '../../services/pagos';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface Props {
  leadId: string;
  canManage: boolean;
}

const TIPO_LABELS: Record<TipoPago, string> = {
  anticipo: 'Anticipo',
  cuota: 'Cuota',
  mensualidad: 'Mensualidad',
  otro: 'Otro',
};

const TIPO_COLORS: Record<TipoPago, string> = {
  anticipo: 'bg-amber-100 text-amber-700',
  cuota: 'bg-blue-100 text-blue-700',
  mensualidad: 'bg-purple-100 text-purple-700',
  otro: 'bg-gray-100 text-gray-600',
};

const METODO_LABELS: Record<MetodoPago, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

const EMPTY_FORM = {
  monto: '',
  fecha_pago: new Date().toISOString().split('T')[0],
  tipo: 'cuota' as TipoPago,
  numero_cuota: '',
  metodo_pago: 'transferencia' as MetodoPago,
  notas: '',
};
const EMPTY_CUOTA_CTX = { id: null as string | null, num: null as number | null };

export default function PagosPanel({ leadId, canManage }: Props) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [selectedCotizacion, setSelectedCotizacion] = useState<string>('');
  
  // Amortization States
  const [planes, setPlanes] = useState<PlanPago[]>([]);
  const [cuotasEsperadas, setCuotasEsperadas] = useState<CuotaEsperada[]>([]);
  const [showAmortizationBuilder, setShowAmortizationBuilder] = useState(false);
  const [amortizationConfig, setAmortizationConfig] = useState({
    plazo_meses: 12,
    tasa_interes_anual: 0,
    sistema_amortizacion: 'flat' as 'flat' | 'frances',
    fecha_inicio: new Date().toISOString().split('T')[0],
    monto_anticipo: 0
  });

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [leadData, setLeadData] = useState<any>(null);
  const [cuotaCtx, setCuotaCtx] = useState(EMPTY_CUOTA_CTX);

  const load = useCallback(async () => {
    if (!leadId) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Cargar datos básicos del lead
      const { data: lead } = await supabase
        .from('leads')
        .select('name, value, closing_amount, company_name, email, company_id')
        .eq('id', leadId)
        .single();
      setLeadData(lead);

      // 2. Cargar cotizaciones del lead
      const { data: cotsData } = await supabase
        .from('cotizaciones')
        .select('id, plan_nombre, total_anual, estado, tipo_pago, cuotas, monto_anticipo')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      const cots = cotsData || [];
      setCotizaciones(cots);

      // Seleccionar la aceptada por defecto
      const aceptada = cots.find((c: any) => c.estado === 'aceptada' || c.estado === 'aprobada' || c.estado === 'ganado');
      const defaultCot = aceptada?.id || cots[0]?.id || '';
      setSelectedCotizacion(prev => prev || defaultCot);

      // Cargar planes de pago y pagos
      const [pagosData, planesData] = await Promise.all([
        pagosService.getByLead(leadId),
        planPagoService.getPlanesByLead(leadId)
      ]);
      setPagos(pagosData);
      setPlanes(planesData);
      
      if (planesData.length > 0) {
        const cuotasData = await planPagoService.getCuotasByPlan(planesData[0].id);
        setCuotasEsperadas(cuotasData);
      }
    } catch {
      console.error('Error cargando pagos, lead_id:', leadId);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const cotActual = cotizaciones.find(c => c.id === selectedCotizacion);
  const planActual = planes.find(p => p.cotizacion_id === selectedCotizacion) || planes[0];
  const pagosDeCot = pagos.filter(p => p.cotizacion_id === selectedCotizacion);
  const totalCobrado = pagosDeCot.reduce((s, p) => s + p.monto, 0);
  const totalPendiente = (cotActual?.total_anual || 0) - totalCobrado;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCotizacion) { toast.error('Selecciona una cotización'); return; }
    if (!form.monto || Number(form.monto) <= 0) { toast.error('Monto inválido'); return; }
    setSaving(true);
    try {
      await pagosService.create({
        cotizacion_id: selectedCotizacion,
        cuota_esperada_id: cuotaCtx.id || null,
        lead_id: leadId,
        monto: Number(form.monto),
        fecha_pago: form.fecha_pago,
        tipo: cuotaCtx.id ? 'cuota' : form.tipo,
        numero_cuota: cuotaCtx.num ?? (form.numero_cuota ? Number(form.numero_cuota) : null),
        metodo_pago: form.metodo_pago,
        notas: form.notas || null,
      });
      const label = cuotaCtx.num ? `Cuota #${cuotaCtx.num} registrada` : 'Pago registrado';
      toast.success(`✅ ${label}`);
      setForm(EMPTY_FORM);
      setCuotaCtx(EMPTY_CUOTA_CTX);
      setShowForm(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pagoId: string) => {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      await pagosService.delete(pagoId);
      toast.success('Pago eliminado');
      await load();
    } catch {
      toast.error('Error al eliminar pago');
    }
  };

  const handleQuickQuote = async () => {
    if (!leadData) return;
    setSaving(true);
    try {
      const amount = leadData.closing_amount || leadData.value || 0;
      const { error } = await supabase.from('cotizaciones').insert({
        company_id: leadData.company_id,
        lead_id: leadId,
        nombre_cliente: leadData.name || 'Sin Nombre',
        empresa_cliente: leadData.company_name,
        email_cliente: leadData.email,
        plan_nombre: 'Cotización Base (Auto-generada)',
        total_anual: amount,
        subtotal_anual: amount,
        estado: 'ganado',
        tipo_pago: 'contado',
        notas: 'Generada automáticamente desde el panel de pagos para iniciar cobranza.'
      });
      if (error) throw error;
      toast.success('Cotización base creada');
      await load();
    } catch (e: any) {
      toast.error('Error al generar cotización: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2].map(i => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!leadId || cotizaciones.length === 0) {
    const suggestedAmount = leadData ? (leadData.closing_amount || leadData.value || 0) : 0;
    
    return (
      <div className="text-center py-8 px-4">
        <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-200" />
        <p className="text-sm font-black text-gray-400 mb-1">Sin cotización asociada</p>
        <p className="text-[10px] text-gray-400 leading-relaxed max-w-[220px] mx-auto mb-4">
          Para registrar pagos o amortizaciones, necesitas una cotización ganada base.
        </p>
        {canManage && leadData && (
          <button
            onClick={handleQuickQuote}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 mx-auto bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Auto-Generar Cotización por ${suggestedAmount.toLocaleString()}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de cotización */}
      {cotizaciones.length > 1 && (
        <select
          value={selectedCotizacion}
          onChange={e => setSelectedCotizacion(e.target.value)}
          className="w-full text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {cotizaciones.map(c => (
            <option key={c.id} value={c.id}>
              {c.plan_nombre} — ${Number(c.total_anual).toLocaleString()} ({c.estado})
            </option>
          ))}
        </select>
      )}

      {/* KPI Cards financieras */}
      {cotActual && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Venta Total</p>
            <p className="text-sm font-black text-indigo-700 mt-0.5">
              ${Number(cotActual.total_anual).toLocaleString()}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Cobrado</p>
            <p className="text-sm font-black text-emerald-700 mt-0.5">
              ${totalCobrado.toLocaleString()}
            </p>
          </div>
          <div className={`rounded-xl p-3 text-center ${totalPendiente > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${totalPendiente > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
              Pendiente
            </p>
            <p className={`text-sm font-black mt-0.5 ${totalPendiente > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
              ${Math.max(0, totalPendiente).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      {cotActual && cotActual.total_anual > 0 && (
        <div>
          <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase mb-1">
            <span>Progreso de cobro</span>
            <span>{Math.min(100, Math.round((totalCobrado / cotActual.total_anual) * 100))}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (totalCobrado / cotActual.total_anual) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ENGINE DE AMORTIZACIÓN */}
      {!planActual && (cotActual?.estado === 'ganado' || cotActual?.estado === 'aceptada' || cotActual?.estado === 'aprobada') && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-sm font-black text-indigo-900 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-600" />
                Motor de Financiamiento
              </h4>
              <p className="text-[10px] text-indigo-600/80 mt-0.5">Esta cotización fue ganada. Genera el plan de pagos (Cuentas por Cobrar) para este cliente.</p>
            </div>
          </div>

          {showAmortizationBuilder ? (
            <div className="space-y-3 bg-white p-3 rounded-lg border border-indigo-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase">Sistema de Pago</label>
                  <select
                    value={amortizationConfig.sistema_amortizacion}
                    onChange={e => setAmortizationConfig(c => ({...c, sistema_amortizacion: e.target.value as 'flat'|'frances'}))}
                    className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5"
                  >
                    <option value="flat">Mensualidad Fija (0% Int.)</option>
                    <option value="frances">Sistema Francés (Con Interés)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase">Meses (Plazo)</label>
                  <input
                    type="number" min="1" max="72"
                    value={amortizationConfig.plazo_meses}
                    onChange={e => setAmortizationConfig(c => ({...c, plazo_meses: Number(e.target.value)}))}
                    className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5"
                  />
                </div>
              </div>

              {amortizationConfig.sistema_amortizacion === 'frances' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase">Tasa Interés Anual (%)</label>
                    <input
                      type="number" min="0" step="0.1"
                      value={amortizationConfig.tasa_interes_anual}
                      onChange={e => setAmortizationConfig(c => ({...c, tasa_interes_anual: Number(e.target.value)}))}
                      className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={amortizationConfig.fecha_inicio}
                    onChange={e => setAmortizationConfig(c => ({...c, fecha_inicio: e.target.value}))}
                    className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase">Anticipo Recibido ($)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={amortizationConfig.monto_anticipo}
                    onChange={e => setAmortizationConfig(c => ({...c, monto_anticipo: Number(e.target.value)}))}
                    className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setShowAmortizationBuilder(false)}
                  className="flex-1 py-1.5 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await planPagoService.generarPlanAmortizacion({
                        lead_id: leadId,
                        cotizacion_id: selectedCotizacion,
                        monto_total: cotActual.total_anual,
                        monto_anticipo: amortizationConfig.monto_anticipo,
                        saldo_a_financiar: cotActual.total_anual - amortizationConfig.monto_anticipo,
                        plazo_meses: amortizationConfig.plazo_meses,
                        tasa_interes_anual: amortizationConfig.tasa_interes_anual,
                        sistema_amortizacion: amortizationConfig.sistema_amortizacion,
                        fecha_inicio: amortizationConfig.fecha_inicio
                      });
                      toast.success('Motor Financiero: Tabla de Amortización Generada');
                      await load();
                    } catch (e: any) {
                      toast.error('Error generando plan: ' + e.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex-1 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center justify-center gap-1"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />} Generar Contrato
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAmortizationBuilder(true)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-colors flex justify-center items-center gap-1"
            >
              Generar Plan de Pagos
            </button>
          )}
        </div>
      )}

      {/* CUADRO DE AMORTIZACIÓN (SI EXISTE EL PLAN) */}
      {planActual && cuotasEsperadas.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-white flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-800 uppercase">Cuadro de Amortización</h4>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
              {planActual.sistema_amortizacion} • {planActual.plazo_meses} Meses
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                <tr>
                  <th className="py-2 px-3 font-bold text-slate-500 uppercase">N°</th>
                  <th className="py-2 px-3 font-bold text-slate-500 uppercase">Vencimiento</th>
                  <th className="py-2 px-3 font-bold text-slate-500 uppercase text-right">Cuota ($)</th>
                  <th className="py-2 px-3 font-bold text-slate-500 uppercase text-center">Estado</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {cuotasEsperadas.map(cuota => (
                  <tr key={cuota.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-black text-slate-400">{cuota.numero_cuota}</td>
                    <td className="py-2 px-3 font-semibold text-slate-700">
                      {new Date(cuota.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 text-right">
                      ${cuota.monto_total_cuota.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        cuota.estado === 'pagada' ? 'bg-emerald-100 text-emerald-700' :
                        cuota.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {cuota.estado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {cuota.estado !== 'pagada' && canManage && (
                        <button
                          onClick={() => {
                            setCuotaCtx({ id: cuota.id, num: cuota.numero_cuota });
                            setForm(f => ({
                              ...f,
                              monto: String(cuota.monto_total_cuota - (cuota.monto_pagado || 0)),
                              tipo: 'cuota',
                              numero_cuota: String(cuota.numero_cuota),
                              fecha_pago: new Date().toISOString().split('T')[0],
                            }));
                            setShowForm(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-black text-[10px] bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          Abonar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de pagos (Abonos libres) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Historial de Recibos ({pagosDeCot.length})
          </p>
          {canManage && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Abono Extra / Manual
            </button>
          )}
        </div>

        {/* Form nuevo pago */}
        {showForm && canManage && (
          <form onSubmit={handleSubmit} className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
            <p className="text-xs font-black text-indigo-700">Registrar nuevo pago</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase">Monto ($)</label>
                <input
                  type="number" min="0.01" step="0.01" required
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  placeholder="0.00"
                  className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase">Fecha</label>
                <input
                  type="date" required
                  value={form.fecha_pago}
                  onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))}
                  className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoPago }))}
                  className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                >
                  {(Object.keys(TIPO_LABELS) as TipoPago[]).map(t => (
                    <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase">Método</label>
                <select
                  value={form.metodo_pago}
                  onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPago }))}
                  className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                >
                  {(Object.keys(METODO_LABELS) as MetodoPago[]).map(m => (
                    <option key={m} value={m}>{METODO_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            </div>

            {(form.tipo === 'cuota' || form.tipo === 'mensualidad') && (
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase">N° Cuota</label>
                <input
                  type="number" min="1"
                  value={form.numero_cuota}
                  onChange={e => setForm(f => ({ ...f, numero_cuota: e.target.value }))}
                  placeholder="Ej: 1"
                  className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            )}

            <div>
              <label className="text-[9px] font-black text-gray-500 uppercase">Notas (opcional)</label>
              <input
                type="text"
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Ej: Pago confirmado por banco"
                className="w-full mt-0.5 text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setCuotaCtx(EMPTY_CUOTA_CTX); }}
                className="flex-1 py-2 text-xs font-black text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </form>
        )}

        {/* Historial */}
        {pagosDeCot.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <CreditCard className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
            <p className="text-xs font-semibold">Sin pagos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pagosDeCot.map(pago => (
              <div key={pago.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-all group">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${TIPO_COLORS[pago.tipo]}`}>
                      {TIPO_LABELS[pago.tipo]}{pago.numero_cuota ? ` #${pago.numero_cuota}` : ''}
                    </span>
                    {pago.metodo_pago && (
                      <span className="text-[9px] font-bold text-gray-400">{METODO_LABELS[pago.metodo_pago]}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-black text-gray-900">${pago.monto.toLocaleString()}</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-gray-400 font-medium">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(pago.fecha_pago + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {pago.notas && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{pago.notas}</p>}
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(pago.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
