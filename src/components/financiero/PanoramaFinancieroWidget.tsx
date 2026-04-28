import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { pagosService, type PanoramaFinanciero } from '../../services/pagos';

interface Props {
  companyId: string;
  startDate?: string;
  endDate?: string;
}

export function PanoramaFinancieroWidget({ companyId, startDate, endDate }: Props) {
  const [data, setData] = useState<PanoramaFinanciero[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    pagosService.getPanorama(companyId, startDate, endDate)
      .then(setData)
      .catch(() => {/* silencioso */})
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate]);

  const ventaTotal    = data.reduce((s, r) => s + Number(r.venta_total || 0), 0);
  const totalCobrado  = data.reduce((s, r) => s + Number(r.total_cobrado || 0), 0);
  const totalPendiente = data.reduce((s, r) => s + Number(r.total_pendiente || 0), 0);

  const kpis = [
    {
      label: 'Venta Acumulada',
      value: `$${ventaTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50/50',
      border: 'border-indigo-100/50',
    },
    {
      label: 'Total Cobrado',
      value: `$${totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/50',
      border: 'border-emerald-100/50',
    },
    {
      label: 'Saldo Pendiente',
      value: `$${totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50/50',
      border: 'border-amber-100/50',
    },
    {
      label: 'Cotizaciones Activas',
      value: data.length.toString(),
      icon: AlertCircle,
      color: 'text-purple-600',
      bg: 'bg-purple-50/50',
      border: 'border-purple-100/50',
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 p-4 relative z-10">
      {/* Header mini */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-50 to-white rounded-lg flex items-center justify-center shadow-sm border border-indigo-100/50">
          <DollarSign className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Control Financiero</h3>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className={`rounded-xl border ${k.border} ${k.bg} p-3 flex flex-col justify-center`}>
              <div className="flex items-center gap-2 mb-1.5">
                <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{k.label}</span>
              </div>
              <p className={`text-xl font-black tracking-tight ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
