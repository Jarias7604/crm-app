import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, User, FileText, DollarSign,
  Calendar, CheckCircle2, Clock, AlertCircle, CircleDot,
  Search, Filter, ExternalLink, Building2, Receipt
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { ClienteCuenta, ContratoCuenta } from '../../services/pagos';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const pct = (a: number, b: number) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
const initials = (name: string) => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const cuotaCfg: Record<string, { label: string; cls: string }> = {
  pagada:   { label: 'Pagada',   cls: 'bg-emerald-100 text-emerald-700' },
  pendiente:{ label: 'Pendiente',cls: 'bg-amber-100 text-amber-700' },
  vencida:  { label: 'Vencida', cls: 'bg-rose-100 text-rose-700' },
  parcial:  { label: 'Parcial',  cls: 'bg-indigo-100 text-indigo-700' },
};

type Filter = 'all' | 'pendiente' | 'vencida' | 'saldado';

// ─── Client Status ────────────────────────────────────────────────────────────
function clientStatus(c: ClienteCuenta): { label: string; color: string; ring: string; dot: string } {
  const vencida = c.contratos.some(ct => ct.schedule.some(q => q.estado === 'vencida'));
  if (vencida)             return { label: 'En mora',  color: 'text-rose-600',    ring: 'ring-rose-300',    dot: 'bg-rose-500' };
  if (c.total_pendiente <= 0) return { label: 'Saldado',  color: 'text-emerald-600', ring: 'ring-emerald-300', dot: 'bg-emerald-500' };
  return                          { label: 'Pendiente', color: 'text-amber-600',   ring: 'ring-amber-300',   dot: 'bg-amber-400' };
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function ClienteDetail({ cliente, onRecibirPago }: { cliente: ClienteCuenta; onRecibirPago: (c: ContratoCuenta) => void }) {
  const [openContratos, setOpenContratos] = useState<Set<string>>(new Set([cliente.contratos[0]?.cotizacion_id]));
  const st = clientStatus(cliente);

  const toggle = (id: string) => setOpenContratos(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Client Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg">
            {initials(cliente.nombre_cliente)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-900">{cliente.nombre_cliente}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${st.color} bg-white border`}>{st.label}</span>
              <span className="text-xs text-slate-400">{cliente.contratos.length} contrato{cliente.contratos.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[10px] font-black uppercase text-slate-400">Total</p>
            <p className="font-mono font-black text-slate-700 mt-0.5">{fmt(cliente.total_contratos)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 text-center">
            <p className="text-[10px] font-black uppercase text-emerald-600">Cobrado</p>
            <p className="font-mono font-black text-emerald-700 mt-0.5">{fmt(cliente.total_cobrado)}</p>
          </div>
          <div className={`rounded-xl border p-3 text-center ${cliente.total_pendiente <= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] font-black uppercase ${cliente.total_pendiente <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>Por Cobrar</p>
            <p className={`font-mono font-black mt-0.5 ${cliente.total_pendiente <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{fmt(cliente.total_pendiente)}</p>
          </div>
        </div>
      </div>

      {/* Contracts */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cliente.contratos.map(ct => {
          const open = openContratos.has(ct.cotizacion_id);
          const p = pct(ct.total_cobrado, ct.total_contrato);
          const saldado = ct.total_pendiente <= 0;
          const vencidas = ct.schedule.filter(q => q.estado === 'vencida').length;

          return (
            <div key={ct.cotizacion_id} className={`border rounded-xl overflow-hidden ${vencidas > 0 ? 'border-rose-200' : saldado ? 'border-emerald-200' : 'border-slate-200'}`}>
              {/* Contract header */}
              <div
                onClick={() => toggle(ct.cotizacion_id)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${open ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{ct.plan_nombre}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${saldado ? 'bg-emerald-500' : vencidas > 0 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">{p}%</span>
                    {vencidas > 0 && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">⚠ {vencidas} vencida{vencidas > 1 ? 's' : ''}</span>}
                    {saldado && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ Saldado</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono font-black text-sm ${saldado ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(ct.total_pendiente)}</p>
                  <p className="text-[10px] text-slate-400">pendiente</p>
                </div>
                {!saldado && (
                  <Button
                    size="sm"
                    className="h-8 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                    onClick={e => { e.stopPropagation(); onRecibirPago(ct); }}
                  >
                    <DollarSign className="w-3 h-3 mr-1" /> Pago
                  </Button>
                )}
                {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              </div>

              {/* Contract detail */}
              {open && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-3">

                  {/* Amortization schedule */}
                  {ct.schedule.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Cronograma de Cuotas</p>
                      <div className="space-y-1">
                        {ct.schedule.map((q: any) => {
                          const cfg = cuotaCfg[q.estado] || cuotaCfg['pendiente'];
                          return (
                            <div key={q.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black shrink-0">{q.numero_cuota}</span>
                              <span className="text-slate-500 w-24 shrink-0">{q.fecha_vencimiento}</span>
                              <span className="font-mono font-bold text-slate-700">{fmt(Number(q.monto_total_cuota))}</span>
                              {Number(q.monto_pagado) > 0 && <span className="text-emerald-600 font-mono">→ cobrado {fmt(Number(q.monto_pagado))}</span>}
                              <span className={`ml-auto px-2 py-0.5 rounded-full font-black text-[10px] uppercase ${cfg.cls}`}>{cfg.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payments received */}
                  {ct.pagos_recibidos.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Pagos Registrados</p>
                      <div className="space-y-1">
                        {[...ct.pagos_recibidos].sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()).map((p: any) => (
                          <div key={p.id} className="flex items-center gap-3 text-xs bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-slate-600 font-bold w-24 shrink-0">{p.fecha_pago}</span>
                            <span className="text-slate-500 capitalize">{p.tipo}{p.numero_cuota ? ` #${p.numero_cuota}` : ''}</span>
                            <span className="ml-auto font-mono font-black text-emerald-700">+{fmt(Number(p.monto))}</span>
                            <span className="px-1.5 py-0.5 bg-white text-slate-500 rounded text-[9px] font-black uppercase border">{p.metodo_pago || 'N/A'}</span>
                            {p.comprobante_url && (
                              <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100" title="Ver recibo">
                                <Receipt className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ct.schedule.length === 0 && ct.pagos_recibidos.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">Sin movimientos registrados aún.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
interface Props {
  clientes: ClienteCuenta[];
  onRecibirPago: (c: ContratoCuenta) => void;
}

export function CuentasPorCobrar({ clientes, onRecibirPago }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<ClienteCuenta | null>(clientes[0] ?? null);

  // Update selected when data loads
  React.useEffect(() => {
    if (clientes.length > 0 && !selected) setSelected(clientes[0]);
  }, [clientes]);

  const filtered = useMemo(() => {
    let list = clientes;
    if (search) list = list.filter(c => c.nombre_cliente.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'pendiente') list = list.filter(c => c.total_pendiente > 0);
    if (filter === 'vencida')   list = list.filter(c => c.contratos.some(ct => ct.schedule.some(q => q.estado === 'vencida')));
    if (filter === 'saldado')   list = list.filter(c => c.total_pendiente <= 0);
    return list;
  }, [clientes, search, filter]);

  const totals = useMemo(() => ({
    cobrado: clientes.reduce((s, c) => s + c.total_cobrado, 0),
    pendiente: clientes.reduce((s, c) => s + c.total_pendiente, 0),
    mora: clientes.filter(c => c.contratos.some(ct => ct.schedule.some(q => q.estado === 'vencida'))).length,
  }), [clientes]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',      label: `Todos (${clientes.length})` },
    { key: 'pendiente',label: 'Pendientes' },
    { key: 'vencida',  label: `En mora${totals.mora > 0 ? ` (${totals.mora})` : ''}` },
    { key: 'saldado',  label: 'Saldados' },
  ];

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>

      {/* ── LEFT PANEL: Client List ── */}
      <div className="w-80 shrink-0 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Summary */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Por Cobrar Total</p>
          <p className="text-2xl font-black mt-0.5">{fmt(totals.pendiente)}</p>
          <p className="text-xs text-indigo-300 mt-1">{clientes.length} clientes · cobrado {fmt(totals.cobrado)}</p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 p-3 border-b border-slate-100 overflow-x-auto hide-scrollbar">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-full transition-all ${
                filter === f.key
                  ? 'bg-indigo-600 text-white'
                  : f.key === 'vencida' && totals.mora > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold">Sin resultados</p>
            </div>
          ) : (
            filtered.map(c => {
              const st = clientStatus(c);
              const p = pct(c.total_cobrado, c.total_contratos);
              const isSelected = selected?.nombre_cliente === c.nombre_cliente;

              return (
                <button
                  key={c.nombre_cliente}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-4 py-3 transition-all ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-600' : 'hover:bg-slate-50 border-l-2 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 ${
                      st.label === 'En mora' ? 'bg-rose-500' : st.label === 'Saldado' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}>
                      {initials(c.nombre_cliente)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{c.nombre_cliente}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        <span className={`text-[10px] font-bold ${st.color}`}>{st.label}</span>
                        <span className="text-[10px] text-slate-400">· {c.contratos.length} ctto{c.contratos.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono font-black text-xs ${c.total_pendiente > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {c.total_pendiente > 0 ? fmt(c.total_pendiente) : '✓'}
                      </p>
                      <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${p >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Client Detail ── */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {selected ? (
          <ClienteDetail
            key={selected.nombre_cliente}
            cliente={selected}
            onRecibirPago={onRecibirPago}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Building2 className="w-12 h-12 opacity-20" />
            <p className="font-bold">Selecciona un cliente para ver su cuenta</p>
          </div>
        )}
      </div>
    </div>
  );
}
