import React, { useState, useEffect } from 'react';
import { X, DollarSign, Search, Loader2, Sparkles, Building2, UserCircle, Calendar, CreditCard, AlignLeft } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { pagosService } from '../../services/pagos';
import toast from 'react-hot-toast';

export function RegistrarIngresoModal({ 
  companyId, 
  onClose, 
  onSuccess 
}: { 
  companyId: string; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('transferencia');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    async function fetchLeads() {
      // Expanded search to include other common "closed" statuses just in case
      const { data } = await supabase
        .from('leads')
        .select('id, name, company_name, value, closing_amount')
        .eq('company_id', companyId)
        .in('status', ['Cliente', 'won', 'ganado', 'client', 'Cerrado', 'closed']);
      setLeads(data || []);
      setLoadingLeads(false);
    }
    fetchLeads();
  }, [companyId]);

  const filteredLeads = leads.filter(l => 
    l.name?.toLowerCase().includes(search.toLowerCase()) || 
    l.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return toast.error('Selecciona un cliente');
    if (!monto || Number(monto) <= 0) return toast.error('Monto inválido');

    setSaving(true);
    try {
      let cotizacionId = null;
      const { data: cots } = await supabase
        .from('cotizaciones')
        .select('id')
        .eq('lead_id', selectedLead.id)
        .in('estado', ['ganado', 'aceptada', 'aprobada'])
        .limit(1);

      if (cots && cots.length > 0) {
        cotizacionId = cots[0].id;
      } else {
        const autoMonto = selectedLead.closing_amount || selectedLead.value || Number(monto);
        const { data: newCot, error: cotErr } = await supabase
          .from('cotizaciones')
          .insert({
            company_id: companyId,
            lead_id: selectedLead.id,
            nombre_cliente: selectedLead.name || 'Sin Nombre',
            empresa_cliente: selectedLead.company_name,
            plan_nombre: 'Cotización Base (Auto-generada)',
            total_anual: autoMonto,
            subtotal_anual: autoMonto,
            estado: 'ganado',
            tipo_pago: 'contado',
            notas: 'Generada automáticamente al registrar ingreso manual.'
          })
          .select('id')
          .single();
        
        if (cotErr) throw cotErr;
        cotizacionId = newCot.id;
      }

      await pagosService.create({
        cotizacion_id: cotizacionId,
        lead_id: selectedLead.id,
        monto: Number(monto),
        fecha_pago: fecha,
        tipo: 'abono',
        metodo_pago: metodo,
        notas: notas || null,
      });

      toast.success('Ingreso registrado con éxito', { icon: '💰' });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al registrar ingreso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Dynamic blurred backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      {/* Modal content */}
      <div className="relative bg-white/95 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
        
        {/* Header with gradient */}
        <div className="relative p-6 border-b border-slate-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Registrar Ingreso</h2>
                <p className="text-[11px] font-black text-emerald-600/80 uppercase tracking-widest mt-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Quick-Entry
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto hide-scrollbar bg-slate-50/50">
          {!selectedLead ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-black uppercase tracking-widest text-slate-500">1. Selecciona el Cliente</p>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{leads.length} Disponibles</span>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nombre o empresa..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-bold shadow-sm"
                />
              </div>

              <div className="border border-slate-200 rounded-2xl h-[300px] overflow-y-auto divide-y divide-slate-100 bg-white shadow-inner">
                {loadingLeads ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-xs font-bold uppercase tracking-wider">Cargando base...</p>
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-6 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-2 shadow-sm border border-slate-100">
                      <UserCircle className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-base font-black text-slate-700">No hay clientes aquí</p>
                    <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">Convierte a un prospecto en "Cliente" desde tu tablero principal para que aparezca en esta lista.</p>
                  </div>
                ) : (
                  filteredLeads.map(l => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedLead(l)}
                      className="w-full text-left p-4 hover:bg-emerald-50 flex items-center gap-4 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors border border-slate-200 group-hover:border-emerald-200 shadow-sm">
                        {l.name ? l.name.substring(0,2).toUpperCase() : 'SN'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[15px] text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{l.name || 'Sin Nombre'}</p>
                        <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-0.5 truncate uppercase tracking-wide">
                          <Building2 className="w-3 h-3" /> {l.company_name || 'Particular'}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white shadow-sm border border-emerald-100 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">
                          Cobrar
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Selected Client Card */}
              <div className="flex items-center justify-between bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="relative flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-700 border border-slate-600 flex items-center justify-center shadow-inner text-emerald-400 font-black">
                    {selectedLead.name ? selectedLead.name.substring(0,2).toUpperCase() : 'SN'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Asignando Pago A</p>
                    <p className="font-black text-white text-lg leading-none">{selectedLead.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1.5 flex items-center gap-1 uppercase tracking-wider">
                      <Building2 className="w-3 h-3" /> {selectedLead.company_name || 'Particular'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedLead(null)} className="relative text-xs text-slate-300 font-bold hover:text-white hover:bg-slate-700 px-3 py-2 rounded-xl transition-all border border-slate-600 hover:border-slate-500">
                  Cambiar
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500" />
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Monto Ingresado</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="number"
                    step="0.01"
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                    className="w-full pl-14 pr-4 py-4 font-mono font-black text-4xl text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300"
                    placeholder="0.00"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Grid Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Fecha</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={fecha}
                      onChange={e => setFecha(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Método</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={metodo}
                      onChange={e => setMetodo(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none capitalize appearance-none shadow-sm"
                    >
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Concepto / Notas</label>
                <div className="relative">
                  <AlignLeft className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-none shadow-sm"
                    placeholder="Opcional: detalle del abono..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="w-1/3 py-4 text-sm font-black text-slate-500 uppercase tracking-wider bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-4 text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl shadow-xl shadow-emerald-500/25 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 border border-emerald-400/50">
                  {saving ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> Registrar Pago</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
