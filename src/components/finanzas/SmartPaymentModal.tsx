import { useState, useMemo } from 'react';
import { X, AlertCircle, Clock, DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
import { pagosService, type ContratoCuenta, type MetodoPago } from '../../services/pagos';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  contrato: ContratoCuenta;
  leadId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'otro',          label: 'Otro' },
];

const fmt = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const daysSince = (dateStr: string) =>
  Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000);

// ── Component ────────────────────────────────────────────────────────────────
export function SmartPaymentModal({ contrato, leadId, onClose, onSuccess }: Props) {
  const pending = contrato.schedule.filter(c => c.estado !== 'pagada');

  // Auto-select todas las vencidas al abrir
  const [selected, setSelected] = useState<Set<string>>(
    new Set(pending.filter(c => c.estado === 'vencida').map(c => c.id))
  );
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia');
  const [fecha, setFecha]   = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas]   = useState('');
  const [saving, setSaving] = useState(false);

  // Montos parciales por cuota (si el usuario quiere pagar menos del saldo)
  const [partials, setPartials] = useState<Record<string, string>>({});

  const toggle = (id: string) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const selectAll  = () => setSelected(new Set(pending.map(c => c.id)));
  const clearAll   = () => setSelected(new Set());

  const getAmount = (cuota: any): number => {
    const partial = partials[cuota.id];
    const remaining = Number(cuota.monto_total_cuota) - Number(cuota.monto_pagado || 0);
    if (partial !== undefined) {
      const v = parseFloat(partial);
      return isNaN(v) ? 0 : Math.min(v, remaining);
    }
    return remaining;
  };

  const total = useMemo(() =>
    pending.filter(c => selected.has(c.id)).reduce((s, c) => s + getAmount(c), 0),
    [selected, partials, pending]
  );

  const handleSubmit = async () => {
    if (selected.size === 0) { toast.error('Selecciona al menos una cuota'); return; }
    const items = pending.filter(c => selected.has(c.id));
    setSaving(true);
    try {
      // Un registro de pago por cuota — el trigger DB sincroniza el estado
      await Promise.all(items.map(cuota =>
        pagosService.create({
          cotizacion_id:     contrato.cotizacion_id,
          cuota_esperada_id: cuota.id,
          lead_id:           leadId ?? (contrato as any).lead_id ?? null,
          monto:             getAmount(cuota),
          fecha_pago:        fecha,
          tipo:              'cuota',
          numero_cuota:      cuota.numero_cuota,
          metodo_pago:       metodo,
          notas:             notas || null,
        })
      ));
      toast.success(`✅ ${items.length} cuota${items.length > 1 ? 's' : ''} registrada${items.length > 1 ? 's' : ''}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Error registrando pagos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              Registrar Pago
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">
              {contrato.plan_nombre}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* ── Cuota Selector ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Cuotas Pendientes ({pending.length})
            </p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[10px] font-black text-indigo-600 hover:underline">
                Todas
              </button>
              <span className="text-slate-200">|</span>
              <button onClick={clearAll} className="text-[10px] font-black text-slate-400 hover:underline">
                Limpiar
              </button>
            </div>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
              <p className="font-bold">¡Contrato al día!</p>
              <p className="text-xs mt-1">No hay cuotas pendientes</p>
            </div>
          ) : (
            pending.map(cuota => {
              const isSelected = selected.has(cuota.id);
              const remaining  = Number(cuota.monto_total_cuota) - Number(cuota.monto_pagado || 0);
              const overdueDays = cuota.estado === 'vencida' ? daysSince(cuota.fecha_vencimiento) : 0;
              const isFuture    = new Date(cuota.fecha_vencimiento + 'T00:00:00') > new Date();

              const rowBg = isSelected
                ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                : cuota.estado === 'vencida'
                  ? 'bg-rose-50 border-rose-200 hover:border-rose-300'
                  : cuota.estado === 'parcial'
                    ? 'bg-violet-50 border-violet-200 hover:border-violet-300'
                    : isFuture
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      : 'bg-amber-50 border-amber-200 hover:border-amber-300';

              return (
                <div
                  key={cuota.id}
                  onClick={() => toggle(cuota.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rowBg}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(cuota.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded text-indigo-600 border-gray-300 cursor-pointer shrink-0"
                  />

                  {/* Número cuota */}
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                    {cuota.numero_cuota}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-700">{cuota.fecha_vencimiento}</span>
                      {overdueDays > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full">
                          <AlertCircle className="w-2.5 h-2.5" /> {overdueDays}d vencida
                        </span>
                      )}
                      {isFuture && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          Adelantado
                        </span>
                      )}
                      {cuota.estado === 'parcial' && (
                        <span className="text-[10px] font-black text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">
                          Parcial abonado {fmt(Number(cuota.monto_pagado))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monto */}
                  <div className="text-right shrink-0" onClick={e => e.stopPropagation()}>
                    {isSelected ? (
                      <input
                        type="number"
                        value={partials[cuota.id] ?? remaining.toFixed(2)}
                        onChange={e => setPartials(p => ({ ...p, [cuota.id]: e.target.value }))}
                        min="0.01"
                        max={remaining}
                        step="0.01"
                        className="w-24 text-right font-mono font-black text-sm border border-indigo-300 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    ) : (
                      <span className="font-mono font-black text-sm text-slate-700">{fmt(remaining)}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Payment Config ── */}
        <div className="p-4 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/50 space-y-3 rounded-b-2xl">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Método de Pago</label>
              <select
                value={metodo}
                onChange={e => setMetodo(e.target.value as MetodoPago)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition"
              >
                {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Fecha de Pago</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Transferencia banco #123456"
              className="w-full mt-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Total + Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                {selected.size} cuota{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
              </p>
              <p className="font-mono font-black text-2xl text-indigo-700 leading-none mt-0.5">{fmt(total)}</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving || selected.size === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                : <><DollarSign className="w-4 h-4" /> Registrar {selected.size > 1 ? `${selected.size} Pagos` : 'Pago'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
