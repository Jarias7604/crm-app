import React, { useState, useEffect } from 'react';
import { X, DollarSign, Search, Loader2 } from 'lucide-react';
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
      const { data } = await supabase
        .from('leads')
        .select('id, name, company_name, value, closing_amount')
        .eq('company_id', companyId)
        .in('status', ['Cliente', 'won', 'ganado', 'client', 'Cerrado']);
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
      // 1. Check if lead has an active quote
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
        // 2. Auto-generate base quote if missing
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

      // 3. Insert payment
      await pagosService.create({
        cotizacion_id: cotizacionId,
        lead_id: selectedLead.id,
        monto: Number(monto),
        fecha_pago: fecha,
        tipo: 'abono',
        metodo_pago: metodo,
        notas: notas || null,
      });

      toast.success('Ingreso registrado exitosamente');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al registrar ingreso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800">Registrar Nuevo Ingreso</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!selectedLead ? (
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-700">Paso 1: Selecciona el Cliente</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="border rounded-xl h-64 overflow-y-auto divide-y">
                {loadingLeads ? (
                  <div className="p-4 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">No se encontraron clientes.</div>
                ) : (
                  filteredLeads.map(l => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedLead(l)}
                      className="w-full text-left p-3 hover:bg-slate-50 flex justify-between items-center transition-colors"
                    >
                      <span className="font-bold text-sm text-slate-700">{l.name}</span>
                      <span className="text-xs text-slate-400">{l.company_name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <div>
                  <p className="text-xs font-black text-indigo-400 uppercase">Cliente Seleccionado</p>
                  <p className="font-bold text-indigo-900">{selectedLead.name}</p>
                </div>
                <button type="button" onClick={() => setSelectedLead(null)} className="text-xs text-indigo-600 font-bold underline">Cambiar</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Monto a Registrar ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 font-mono font-black text-lg bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Método</label>
                  <select
                    value={metodo}
                    onChange={e => setMetodo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm capitalize"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Notas (Opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  rows={2}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 flex justify-center items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Guardando...' : 'Confirmar Ingreso'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
