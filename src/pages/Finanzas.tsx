import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, DollarSign, Plus, Trash2, FileText, CreditCard, ExternalLink, BarChart2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../services/supabase';
import { pagosService, gastosService, type Gasto, type Pago, type ClienteCuenta, type ContratoCuenta } from '../services/pagos';
import { Button } from '../components/ui/Button';
import { RecibirPagoModal } from '../components/finanzas/RecibirPagoModal';
import { CuentasPorCobrar } from '../components/finanzas/CuentasPorCobrar';
import { RegistrarIngresoModal } from '../components/finanzas/RegistrarIngresoModal';
import toast from 'react-hot-toast';

// ── Inline SVG Bar Chart ──────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; ingresos: number; gastos: number }[] }) {
  const max = Math.max(...data.flatMap(d => [d.ingresos, d.gastos]), 1);
  return (
    <div className="flex items-end justify-between gap-2 h-28 px-2">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 96 }}>
            <div title={`Ingresos $${d.ingresos.toFixed(0)}`}
              className="flex-1 bg-emerald-500 rounded-t transition-all duration-700"
              style={{ height: `${Math.max(2, (d.ingresos / max) * 96)}px` }} />
            <div title={`Gastos $${d.gastos.toFixed(0)}`}
              className="flex-1 bg-rose-400 rounded-t transition-all duration-700"
              style={{ height: `${Math.max(2, (d.gastos / max) * 96)}px` }} />
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Finanzas() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cuentas' | 'historial' | 'gastos' | 'resultados'>('dashboard');
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | 'all'>('6m');

  // Data states
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pagosRecibidos, setPagosRecibidos] = useState<Pago[]>([]);
  const [clientes, setClientes] = useState<ClienteCuenta[]>([]);
  const [cotizacionesMes, setCotizacionesMes] = useState<{mes: string; total: number}[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals — selectedContrato drives RecibirPagoModal
  const [selectedContrato, setSelectedContrato] = useState<ContratoCuenta | null>(null);
  const [isAddingIngreso, setIsAddingIngreso] = useState(false);

  // Gasto Form state
  const [isAddingGasto, setIsAddingGasto] = useState(false);
  const [newGasto, setNewGasto] = useState({ concepto: '', categoria: 'operativo', monto: '', fecha: new Date().toISOString().split('T')[0], notas: '' });
  const [gastoFile, setGastoFile] = useState<File | null>(null);
  const [uploadingGasto, setUploadingGasto] = useState(false);

  const loadData = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let gasData: Gasto[] = [];
      let clientesData: ClienteCuenta[] = [];

      try { gasData = await gastosService.getGastos(profile.company_id); } catch (e) { console.error('Error gastos:', e); }
      try { clientesData = await pagosService.getClientesCuentas(profile.company_id); } catch (e) { console.error('Error clientes:', e); }

      setGastos(gasData);
      setClientes(clientesData);

      // Payments history
      const { data: allPagos } = await supabase
        .from('pagos')
        .select('*, cotizaciones(nombre_cliente)')
        .eq('company_id', profile.company_id)
        .order('fecha_pago', { ascending: false });
      if (allPagos) setPagosRecibidos(allPagos as any);

      // Monthly contracts (last 6 months) for chart
      const sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth() - 5); sixAgo.setDate(1);
      const { data: cotsMes } = await supabase
        .from('cotizaciones')
        .select('created_at, total_anual')
        .eq('company_id', profile.company_id)
        .in('estado', ['aceptada', 'ganado', 'aprobada', 'pagado', 'activo'])
        .gte('created_at', sixAgo.toISOString());
      if (cotsMes) setCotizacionesMes(cotsMes.map(c => ({ mes: c.created_at.slice(0,7), total: Number(c.total_anual) })));

    } catch (error) {
      console.error('[Finanzas] loadData error:', error);
      toast.error('Error cargando datos financieros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.company_id]);

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    if (!newGasto.concepto || !newGasto.monto) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    
    setUploadingGasto(true);
    try {
      let comprobante_url: string | null = null;
      let comprobante_path: string | null = null;

      if (gastoFile) {
        toast.loading('Subiendo comprobante...', { id: 'upload-gasto' });
        const upload = await pagosService.uploadComprobante(profile.company_id, gastoFile);
        comprobante_url = upload.url;
        comprobante_path = upload.path;
        toast.dismiss('upload-gasto');
      }

      await gastosService.create({
        concepto: newGasto.concepto,
        categoria: newGasto.categoria,
        monto: Number(newGasto.monto),
        fecha: newGasto.fecha,
        notas: newGasto.notas,
        comprobante_url,
        comprobante_path
      });

      toast.success('Gasto registrado exitosamente');
      setIsAddingGasto(false);
      setNewGasto({ concepto: '', categoria: 'operativo', monto: '', fecha: new Date().toISOString().split('T')[0], notas: '' });
      setGastoFile(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar el gasto');
      toast.dismiss('upload-gasto');
    } finally {
      setUploadingGasto(false);
    }
  };

  const handleDeleteGasto = async (id: string) => {
    if (!window.confirm('¿Eliminar este gasto permanentemente?')) return;
    try {
      await gastosService.delete(id);
      toast.success('Gasto eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // Calculations
  const totalCobrado = clientes.reduce((s, c) => s + c.total_cobrado, 0);
  const totalVentas = clientes.reduce((s, c) => s + c.total_contratos, 0);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);
  const totalCuentasPorCobrar = clientes.reduce((s, c) => s + c.total_pendiente, 0);

  const utilidadNeta = totalVentas - totalGastos;
  const margen = totalVentas > 0 ? Math.round((utilidadNeta / totalVentas) * 100) : 0;

  // Build last-6-months chart data
  const chartData = useMemo(() => {
    const months: { label: string; key: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es', { month: 'short' });
      const ingresos = cotizacionesMes.filter(c => c.mes === key).reduce((s, c) => s + c.total, 0);
      const gastosMes = gastos.filter(g => g.fecha.startsWith(key)).reduce((s, g) => s + Number(g.monto), 0);
      months.push({ label, key, ingresos, gastos: gastosMes });
    }
    return months;
  }, [cotizacionesMes, gastos]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Módulo Financiero</h1>
          <p className="text-slate-500 mt-1">Control tipo QuickBooks para cash flow, cuentas por cobrar y resultados.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsAddingIngreso(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-0 font-bold tracking-wide">
            <Plus className="w-4 h-4 mr-2" /> Registrar Ingreso
          </Button>
          <Button onClick={() => setIsAddingGasto(true)} variant="outline" className="text-slate-700 bg-white shadow-sm font-bold tracking-wide border-slate-200 hover:bg-slate-50">
            <Plus className="w-4 h-4 mr-2 text-rose-500" /> Registrar Gasto
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-slate-200 p-1 w-full overflow-x-auto shadow-sm hide-scrollbar">
        <button onClick={() => setActiveTab('dashboard')} className={`flex-none px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
          <TrendingUp className="w-4 h-4" /> Dashboard
        </button>
        <button onClick={() => setActiveTab('cuentas')} className={`flex-none px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'cuentas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
          <Wallet className="w-4 h-4" /> Cuentas por Cobrar
        </button>
        <button onClick={() => setActiveTab('historial')} className={`flex-none px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'historial' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
          <DollarSign className="w-4 h-4" /> Pagos Recibidos
        </button>
        <button onClick={() => setActiveTab('gastos')} className={`flex-none px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'gastos' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
          <CreditCard className="w-4 h-4" /> Egresos / Gastos
        </button>
        <button onClick={() => setActiveTab('resultados')} className={`flex-none px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'resultados' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
          <FileText className="w-4 h-4" /> P&L Report
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-wider">Ventas Totales</span>
                  </div>
                  <p className="text-3xl font-black text-slate-800 mt-4">${totalVentas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Cotizaciones aceptadas</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-wider">Dinero Cobrado</span>
                  </div>
                  <p className="text-3xl font-black text-emerald-600 mt-4">${totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Ingreso real a bancos</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-wider">Cuentas por Cobrar</span>
                  </div>
                  <p className="text-3xl font-black text-amber-600 mt-4">${totalCuentasPorCobrar.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Dinero pendiente en la calle</p>
                </div>

                <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
                  <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-black text-slate-300 uppercase tracking-wider">Utilidad Neta</span>
                  </div>
                  <p className={`text-3xl font-black mt-4 relative z-10 ${utilidadNeta >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    ${utilidadNeta.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <span className={`text-xs font-bold mt-2 inline-block px-2 py-0.5 rounded-full ${utilidadNeta >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    Margen: {margen}%
                  </span>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-black text-slate-800">Tendencia Últimos 6 Meses</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Ventas</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Gastos</span>
                  </div>
                </div>
                <MiniBarChart data={chartData} />
                {chartData.every(d => d.ingresos === 0 && d.gastos === 0) && (
                  <p className="text-center text-xs text-slate-400 mt-2">Registra ventas o gastos para ver la tendencia aquí.</p>
                )}
              </div>
            </div>
          )}


          {/* TAB: CUENTAS POR COBRAR — Cliente → Contratos → Cuotas */}
          {activeTab === 'cuentas' && (
            <CuentasPorCobrar
              clientes={clientes}
              onRecibirPago={(contrato) => setSelectedContrato(contrato)}
            />
          )}

          {/* TAB: HISTORIAL DE PAGOS */}
          {activeTab === 'historial' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-emerald-50">
                <h3 className="text-lg font-black text-emerald-900">Historial de Ingresos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-black">
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Cliente / Cotización</th>
                      <th className="p-4">Método</th>
                      <th className="p-4 text-right">Monto</th>
                      <th className="p-4 text-center">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagosRecibidos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">No hay pagos registrados.</td>
                      </tr>
                    ) : (
                      pagosRecibidos.map((pago: any) => (
                        <tr key={pago.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-sm font-bold text-slate-600">{pago.fecha_pago}</td>
                          <td className="p-4">
                            <p className="font-bold text-slate-900">{pago.cotizaciones?.nombre_cliente || 'N/A'}</p>
                            <span className="text-xs font-medium text-slate-500 uppercase">{pago.tipo}</span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase tracking-wider">
                              {pago.metodo_pago || 'N/A'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-black text-emerald-600 text-base">
                            + ${Number(pago.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-center">
                            {pago.comprobante_url ? (
                              <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="Ver Recibo">
                                <FileText className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: GASTOS */}
          {activeTab === 'gastos' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-slate-800">Registrar Egreso</h3>
                  <Button variant={isAddingGasto ? "outline" : "default"} onClick={() => setIsAddingGasto(!isAddingGasto)} className={!isAddingGasto ? "bg-rose-600 hover:bg-rose-700" : ""}>
                    {isAddingGasto ? 'Cancelar' : <><Plus className="w-4 h-4 mr-2" /> Nuevo Egreso</>}
                  </Button>
                </div>
                
                {isAddingGasto && (
                  <form onSubmit={handleAddGasto} className="grid grid-cols-1 md:grid-cols-6 gap-4 pt-4 border-t border-slate-100">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Concepto / Proveedor</label>
                      <input type="text" required value={newGasto.concepto} onChange={e => setNewGasto({...newGasto, concepto: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                      <select value={newGasto.categoria} onChange={e => setNewGasto({...newGasto, categoria: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="operativo">Operativo</option>
                        <option value="marketing">Marketing</option>
                        <option value="nomina">Nómina</option>
                        <option value="software">Software/SaaS</option>
                        <option value="impuestos">Impuestos</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto ($)</label>
                      <input type="number" required min="0" step="0.01" value={newGasto.monto} onChange={e => setNewGasto({...newGasto, monto: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-rose-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Comprobante</label>
                      <input type="file" accept="image/*,.pdf" onChange={e => setGastoFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" disabled={uploadingGasto} className="w-full h-[38px] bg-rose-600 hover:bg-rose-700 text-white">
                        {uploadingGasto ? 'Subiendo...' : 'Guardar'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-rose-50">
                  <h3 className="text-lg font-black text-rose-900">Historial de Egresos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-black">
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Concepto</th>
                        <th className="p-4">Categoría</th>
                        <th className="p-4 text-center">Recibo</th>
                        <th className="p-4 text-right">Monto</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {gastos.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay egresos.</td></tr>
                      ) : (
                        gastos.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-sm font-bold text-slate-600">{row.fecha}</td>
                            <td className="p-4 font-bold text-slate-900">{row.concepto}</td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase tracking-wider">{row.categoria}</span>
                            </td>
                            <td className="p-4 text-center">
                              {row.comprobante_url ? (
                                <a href={row.comprobante_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Ver Comprobante">
                                  <ExternalLink className="w-4 h-4 inline-block" />
                                </a>
                              ) : <span className="text-slate-300 text-xs">-</span>}
                            </td>
                            <td className="p-4 text-right font-mono font-black text-rose-600 text-base">- ${Number(row.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-4 text-center">
                              <button onClick={() => handleDeleteGasto(row.id)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ESTADO DE RESULTADOS (P&L) */}
          {activeTab === 'resultados' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl mx-auto">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                <div>
                  <h3 className="text-xl font-black">Estado de Resultados (P&L)</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Reporte Acumulado</p>
                </div>
              </div>
              
              <div className="p-0">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-emerald-50/50">
                      <td className="p-5 pl-6 font-black text-emerald-800 uppercase tracking-wider text-sm">Ventas Cerradas (Ingresos)</td>
                      <td className="p-5 pr-6 text-right font-mono font-black text-emerald-600 text-xl">
                        ${totalVentas.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    
                    <tr>
                      <td colSpan={2} className="p-4 pl-6 bg-slate-50 border-y border-slate-200">
                        <span className="font-black text-slate-600 uppercase tracking-wider text-xs">Egresos Operativos</span>
                      </td>
                    </tr>
                    
                    {['operativo', 'marketing', 'nomina', 'software', 'impuestos', 'otro'].map(cat => {
                      const totalCat = gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0);
                      if (totalCat === 0) return null;
                      return (
                        <tr key={cat} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 pl-10 text-sm font-bold text-slate-600 capitalize flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                            {cat === 'nomina' ? 'Nómina' : cat}
                          </td>
                          <td className="p-3 pr-6 text-right font-mono font-bold text-rose-500">
                            - ${totalCat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="bg-rose-50/30">
                      <td className="p-4 pl-6 font-black text-rose-800 uppercase tracking-wider text-sm">Total Egresos</td>
                      <td className="p-4 pr-6 text-right font-mono font-black text-rose-600 text-lg border-t-2 border-rose-200">
                        - ${totalGastos.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    <tr className={utilidadNeta >= 0 ? "bg-indigo-600" : "bg-rose-600"}>
                      <td className="p-6 pl-6 font-black text-white uppercase tracking-widest text-lg">
                        Utilidad Neta
                        <span className="block text-xs font-normal text-white/70 mt-1 normal-case tracking-normal">
                          Margen de ganancia: {margen}%
                        </span>
                      </td>
                      <td className="p-6 pr-6 text-right font-mono font-black text-white text-3xl">
                        ${utilidadNeta.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Modals */}
      {selectedContrato && (
        <RecibirPagoModal
          cuenta={{
            cotizacion_id: selectedContrato.cotizacion_id,
            nombre_cliente: selectedContrato.nombre_cliente,
            plan_nombre: selectedContrato.plan_nombre,
            tipo_pago: selectedContrato.tipo_pago,
            venta_total: selectedContrato.total_contrato,
            anticipo_acordado: selectedContrato.anticipo,
            total_cuotas: selectedContrato.cuotas_pactadas,
            plazo_meses: selectedContrato.plazo_meses,
            total_cobrado: selectedContrato.total_cobrado,
            total_pendiente: selectedContrato.total_pendiente,
            cuotas_pagadas: selectedContrato.pagos_recibidos.length,
            cuotas_restantes: selectedContrato.cuotas_pactadas - selectedContrato.pagos_recibidos.length,
            valor_por_cuota: selectedContrato.cuotas_pactadas > 0 ? selectedContrato.total_contrato / selectedContrato.cuotas_pactadas : selectedContrato.total_contrato,
            ultimo_pago: selectedContrato.pagos_recibidos[0]?.fecha_pago ?? null,
            cotizacion_fecha: selectedContrato.fecha_contrato,
          }}
          onClose={() => setSelectedContrato(null)}
          onSuccess={() => { setSelectedContrato(null); loadData(); }}
        />
      )}

      {isAddingIngreso && profile?.company_id && (
        <RegistrarIngresoModal
          companyId={profile.company_id}
          onClose={() => setIsAddingIngreso(false)}
          onSuccess={() => {
            setIsAddingIngreso(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
