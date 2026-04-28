import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Calendar, FileText, Search, CreditCard } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { pagosService, gastosService, type PanoramaFinanciero, type Gasto } from '../services/pagos';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function Finanzas() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'cuentas' | 'gastos' | 'utilidad' | 'resultados'>('utilidad');
  
  // Data states
  const [panorama, setPanorama] = useState<PanoramaFinanciero[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  // Gasto Form state
  const [isAddingGasto, setIsAddingGasto] = useState(false);
  const [newGasto, setNewGasto] = useState({ concepto: '', categoria: 'operativo', monto: '', fecha: new Date().toISOString().split('T')[0] });

  const loadData = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [panoData, gasData] = await Promise.all([
        pagosService.getPanorama(profile.company_id),
        gastosService.getGastos(profile.company_id)
      ]);
      setPanorama(panoData);
      setGastos(gasData);
    } catch (error) {
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
    if (!newGasto.concepto || !newGasto.monto) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      await gastosService.create({
        concepto: newGasto.concepto,
        categoria: newGasto.categoria,
        monto: Number(newGasto.monto),
        fecha: newGasto.fecha
      });
      toast.success('Gasto registrado exitosamente');
      setIsAddingGasto(false);
      setNewGasto({ concepto: '', categoria: 'operativo', monto: '', fecha: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (error) {
      toast.error('Error al registrar el gasto');
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

  // Calculations for Utilidad
  const totalCobrado = panorama.reduce((s, r) => s + Number(r.total_cobrado || 0), 0);
  const totalVentas = panorama.reduce((s, r) => s + Number(r.venta_total || 0), 0);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);
  
  // Utilidad basada en VENTAS TOTALES (ya que es SaaS y los tratos están cerrados)
  const utilidadNeta = totalVentas - totalGastos;
  const margen = totalVentas > 0 ? Math.round((utilidadNeta / totalVentas) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Control Financiero (Cash Flow)</h1>
          <p className="text-slate-500 mt-1">Supervisa ingresos, gastos y utilidad de tu empresa.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-slate-200 p-1 w-full md:w-max shadow-sm">
        <button
          onClick={() => setActiveTab('utilidad')}
          className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'utilidad' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Flujo de Efectivo
        </button>
        <button
          onClick={() => setActiveTab('cuentas')}
          className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'cuentas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Wallet className="w-4 h-4" /> Cuentas por Cobrar
        </button>
        <button
          onClick={() => setActiveTab('gastos')}
          className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'gastos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4" /> Registro de Gastos
        </button>
        <button
          onClick={() => setActiveTab('resultados')}
          className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'resultados' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" /> Estado de Resultados
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="mt-6">
          
          {/* TAB: FLUJO DE EFECTIVO */}
          {activeTab === 'utilidad' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-wider">Ingresos Brutos</span>
                  </div>
                  <p className="text-3xl font-black text-emerald-600 mt-4">${totalVentas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Ventas cerradas</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-rose-600" />
                    </div>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-wider">Gastos Operativos</span>
                  </div>
                  <p className="text-3xl font-black text-rose-600 mt-4">${totalGastos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Salidas de dinero</p>
                </div>

                <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
                  <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-black text-slate-300 uppercase tracking-wider">Utilidad Neta</span>
                  </div>
                  <p className={`text-4xl font-black mt-4 relative z-10 ${utilidadNeta >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    ${utilidadNeta.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-2 mt-2 relative z-10">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${utilidadNeta >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      Margen: {margen}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CUENTAS POR COBRAR */}
          {activeTab === 'cuentas' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800">Desglose de Cotizaciones</h3>
                <span className="text-sm font-bold text-slate-500">{panorama.length} cuentas activas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-black">
                      <th className="p-4">Cliente / Cotización</th>
                      <th className="p-4">Venta Total</th>
                      <th className="p-4">Cobrado</th>
                      <th className="p-4">Pendiente</th>
                      <th className="p-4">Progreso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {panorama.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">No hay cotizaciones registradas.</td>
                      </tr>
                    ) : (
                      panorama.map(row => {
                        const isMensual = row.tipo_pago?.toLowerCase() === 'mensual' || row.tipo_pago?.toLowerCase() === 'recurrente' || (row.total_cuotas || 0) > 0;
                        const pct = Number(row.venta_total) > 0 ? Math.round((Number(row.total_cobrado) / Number(row.venta_total)) * 100) : 0;
                        
                        return (
                          <tr key={row.cotizacion_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-slate-900">{row.nombre_cliente}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500 truncate max-w-[150px]">{row.plan_nombre}</span>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  isMensual ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {isMensual ? 'MENSUAL' : 'ÚNICO'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="font-mono font-bold text-slate-700">${Number(row.venta_total).toLocaleString()}</p>
                              {isMensual && row.valor_por_cuota > 0 && (
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
                                  ${Number(row.valor_por_cuota).toLocaleString()} / mes
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <p className="font-mono font-bold text-emerald-600">${Number(row.total_cobrado).toLocaleString()}</p>
                              {isMensual && (row.total_cuotas || 0) > 0 && (
                                <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-wide">
                                  {row.cuotas_pagadas || 0} de {row.total_cuotas || 0} Pagos
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <p className="font-mono font-bold text-amber-600">${Number(row.total_pendiente).toLocaleString()}</p>
                              {isMensual && row.cuotas_restantes > 0 && (
                                <p className="text-[10px] font-bold text-amber-500 mt-1 uppercase tracking-wide">
                                  {row.cuotas_restantes} Pagos Rest.
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-xs font-black">
                                  <span className={pct === 100 ? 'text-emerald-600' : 'text-slate-500'}>{pct}% Pagado</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-28">
                                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: GASTOS */}
          {activeTab === 'gastos' && (
            <div className="space-y-6">
              {/* Add Gasto Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-slate-800">Registrar Nuevo Gasto</h3>
                  <Button variant={isAddingGasto ? "outline" : "default"} onClick={() => setIsAddingGasto(!isAddingGasto)}>
                    {isAddingGasto ? 'Cancelar' : <><Plus className="w-4 h-4 mr-2" /> Nuevo Gasto</>}
                  </Button>
                </div>
                
                {isAddingGasto && (
                  <form onSubmit={handleAddGasto} className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Concepto</label>
                      <input type="text" required placeholder="Ej. Pago de oficina, Publicidad Facebook..." value={newGasto.concepto} onChange={e => setNewGasto({...newGasto, concepto: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                      <select value={newGasto.categoria} onChange={e => setNewGasto({...newGasto, categoria: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="operativo">Operativo</option>
                        <option value="marketing">Marketing</option>
                        <option value="nomina">Nómina</option>
                        <option value="software">Software/SaaS</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto ($)</label>
                      <input type="number" required min="0" step="0.01" placeholder="0.00" value={newGasto.monto} onChange={e => setNewGasto({...newGasto, monto: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="default" className="w-full h-[38px]">
                        Guardar
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Gastos List */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-black text-slate-800">Historial de Gastos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-black">
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Concepto</th>
                        <th className="p-4">Categoría</th>
                        <th className="p-4 text-right">Monto</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {gastos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">No hay gastos registrados.</td>
                        </tr>
                      ) : (
                        gastos.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-sm font-medium text-slate-600">{row.fecha}</td>
                            <td className="p-4 font-bold text-slate-900">{row.concepto}</td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase tracking-wider">
                                {row.categoria}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono font-black text-rose-600">${Number(row.monto).toLocaleString()}</td>
                            <td className="p-4 text-center">
                              <button onClick={() => handleDeleteGasto(row.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50">
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
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Estado de Resultados (P&L)</h3>
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">Acumulado Histórico</p>
                </div>
              </div>
              
              <div className="p-0">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {/* INGRESOS */}
                    <tr className="bg-emerald-50/50">
                      <td className="p-4 pl-6 font-black text-emerald-800 uppercase tracking-wider text-sm">Ingresos Brutos (Ventas Cerradas)</td>
                      <td className="p-4 pr-6 text-right font-mono font-black text-emerald-600 text-lg">
                        ${totalVentas.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    
                    {/* COSTOS / GASTOS POR CATEGORÍA */}
                    <tr>
                      <td colSpan={2} className="p-4 pl-6 bg-slate-50 border-y border-slate-200">
                        <span className="font-black text-slate-600 uppercase tracking-wider text-xs">Desglose de Gastos Operativos</span>
                      </td>
                    </tr>
                    
                    {['operativo', 'marketing', 'nomina', 'software', 'otro'].map(cat => {
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
                      <td className="p-4 pl-6 font-black text-rose-800 uppercase tracking-wider text-sm">Total Gastos Operativos</td>
                      <td className="p-4 pr-6 text-right font-mono font-black text-rose-600 text-lg border-t-2 border-rose-200">
                        - ${totalGastos.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* UTILIDAD NETA */}
                    <tr className={utilidadNeta >= 0 ? "bg-indigo-600" : "bg-rose-600"}>
                      <td className="p-5 pl-6 font-black text-white uppercase tracking-widest text-base">
                        Utilidad Neta (Beneficio)
                        <span className="block text-xs font-normal text-white/70 mt-0.5 normal-case tracking-normal">
                          Margen Neto: {margen}%
                        </span>
                      </td>
                      <td className="p-5 pr-6 text-right font-mono font-black text-white text-2xl">
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
    </div>
  );
}
