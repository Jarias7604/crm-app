import { useMemo, useState } from 'react';
import { AlertCircle, TrendingUp, ArrowUpDown, Download } from 'lucide-react';
import type { ClienteCuenta } from '../../services/pagos';

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getAging(schedule: any[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let corriente = 0, d30 = 0, d60 = 0, d60plus = 0;
  schedule.filter(c => c.estado !== 'pagada').forEach(c => {
    const venc = new Date(c.fecha_vencimiento + 'T00:00:00');
    const rem  = Number(c.monto_total_cuota) - Number(c.monto_pagado || 0);
    const diff = Math.floor((today.getTime() - venc.getTime()) / 86400000);
    if (diff <= 0)        corriente += rem;
    else if (diff <= 30)  d30       += rem;
    else if (diff <= 60)  d60       += rem;
    else                  d60plus   += rem;
  });
  return { corriente, d30, d60, d60plus };
}

interface Row {
  nombre: string; plan: string; corriente: number;
  d30: number; d60: number; d60plus: number; total: number;
}

type SortKey = keyof Row;

interface Props { clientes: ClienteCuenta[]; onPagar: (c: ClienteCuenta) => void; }

export function AgingReport({ clientes, onPagar }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'd60plus', dir: -1 });

  const rows: Row[] = useMemo(() =>
    clientes.flatMap(cl =>
      cl.contratos.map(ct => {
        const ag = getAging(ct.schedule);
        return {
          _cl: cl, nombre: cl.nombre_cliente,
          plan: ct.plan_nombre || 'Contrato',
          corriente: ag.corriente, d30: ag.d30, d60: ag.d60, d60plus: ag.d60plus,
          total: ag.corriente + ag.d30 + ag.d60 + ag.d60plus,
        } as any;
      })
    ).filter(r => r.total > 0), [clientes]);

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => (a[sort.key] > b[sort.key] ? sort.dir : -sort.dir)),
    [rows, sort]
  );

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: -1 });

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({ corriente: acc.corriente + r.corriente, d30: acc.d30 + r.d30, d60: acc.d60 + r.d60, d60plus: acc.d60plus + r.d60plus, total: acc.total + r.total }),
    { corriente: 0, d30: 0, d60: 0, d60plus: 0, total: 0 }
  ), [rows]);

  const exportCSV = () => {
    const headers = 'Cliente,Contrato,Corriente,1-30 días,31-60 días,+60 días,Total';
    const csv = [headers, ...sorted.map(r =>
      `"${r.nombre}","${r.plan}",${r.corriente.toFixed(2)},${r.d30.toFixed(2)},${r.d60.toFixed(2)},${r.d60plus.toFixed(2)},${r.total.toFixed(2)}`
    )].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `aging_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th onClick={() => toggleSort(k)} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-indigo-600 whitespace-nowrap">
      <div className="flex items-center justify-end gap-1">{label}<ArrowUpDown className="w-3 h-3" /></div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Corriente', val: totals.corriente, color: 'emerald' },
          { label: '1–30 días', val: totals.d30,       color: 'amber' },
          { label: '31–60 días',val: totals.d60,       color: 'orange' },
          { label: '+60 días',  val: totals.d60plus,   color: 'rose' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-2xl p-4`}>
            <p className={`text-[10px] font-black uppercase tracking-widest text-${color}-600`}>{label}</p>
            <p className={`font-mono font-black text-xl mt-1 text-${color}-700`}>{fmt(val)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span className="font-black text-sm text-slate-800">Reporte de Antigüedad de Cartera</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{sorted.length} contratos</span>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Contrato</th>
                <Th k="corriente" label="Corriente" />
                <Th k="d30"       label="1-30 días" />
                <Th k="d60"       label="31-60 días" />
                <Th k="d60plus"   label="+60 días" />
                <Th k="total"     label="Total" />
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((r: any, i) => (
                <tr key={i} className={`hover:bg-slate-50 transition-colors ${r.d60plus > 0 ? 'bg-rose-50/30' : r.d60 > 0 ? 'bg-orange-50/20' : ''}`}>
                  <td className="px-4 py-3 font-bold text-slate-900">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{r.plan}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{r.corriente > 0 ? fmt(r.corriente) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700 font-bold">{r.d30 > 0 ? fmt(r.d30) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-700 font-bold">{r.d60 > 0 ? fmt(r.d60) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {r.d60plus > 0
                      ? <span className="flex items-center justify-end gap-1 font-mono font-black text-rose-700"><AlertCircle className="w-3.5 h-3.5" />{fmt(r.d60plus)}</span>
                      : <span className="text-slate-300 font-mono">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-slate-900">{fmt(r.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onPagar(r._cl)}
                      className="text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Cobrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-black text-slate-700 text-xs uppercase">TOTALES</td>
                <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">{fmt(totals.corriente)}</td>
                <td className="px-4 py-3 text-right font-mono font-black text-amber-700">{fmt(totals.d30)}</td>
                <td className="px-4 py-3 text-right font-mono font-black text-orange-700">{fmt(totals.d60)}</td>
                <td className="px-4 py-3 text-right font-mono font-black text-rose-700">{fmt(totals.d60plus)}</td>
                <td className="px-4 py-3 text-right font-mono font-black text-slate-900">{fmt(totals.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
