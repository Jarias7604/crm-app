import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { auditTrailService, type AuditEntry, DECISION_TYPE_CONFIG, AGENT_CONFIG } from '../../services/marketing/auditTrail';
import { ShieldCheck, Calendar, Filter, Brain, RefreshCw, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuditLogViewer() {
    const { profile } = useAuth();
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadEntries = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            const data = await auditTrailService.getEntries(profile.company_id, { limit: 100 });
            setEntries(data);
        } catch (e: any) {
            console.error(e);
            toast.error('Error al cargar el log de auditoría');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => { loadEntries(); }, [loadEntries]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Cargando Decision Log...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-slate-900/10 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        AI Decision Log (Audit Trail)
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">Registro inmutable de todas las decisiones autónomas tomadas por los agentes.</p>
                </div>
                <button onClick={loadEntries} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/10 text-white">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {entries.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="font-medium text-slate-500">Sin decisiones registradas</p>
                        <p className="text-xs mt-1">Aún no hay acciones autónomas registradas en la base de datos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-5 py-3">Fecha</th>
                                    <th className="px-5 py-3">Agente</th>
                                    <th className="px-5 py-3">Decisión</th>
                                    <th className="px-5 py-3">Lead</th>
                                    <th className="px-5 py-3">Razonamiento (Transparencia)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {entries.map((entry) => {
                                    const agent = AGENT_CONFIG[entry.agent_name] || { label: entry.agent_name, icon: '🤖', color: 'text-slate-600' };
                                    const decision = DECISION_TYPE_CONFIG[entry.decision_type] || { label: entry.decision_type, icon: '⚡', color: 'text-slate-600', bgColor: 'bg-slate-50' };
                                    
                                    return (
                                        <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(entry.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <span className={`flex items-center gap-1.5 text-[11px] font-black ${agent.color}`}>
                                                    <span className="text-sm">{agent.icon}</span> {agent.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border ${decision.bgColor} ${decision.color}`}>
                                                    {decision.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                {entry.lead ? (
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-xs">{entry.lead.name}</p>
                                                        <p className="text-[10px] text-slate-400">{entry.lead.company_name || 'Sin empresa'}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-bold">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 max-w-sm">
                                                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                                    {entry.reasoning}
                                                </p>
                                                {entry.confidence && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${entry.confidence >= 80 ? 'bg-emerald-500' : entry.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${entry.confidence}%` }} />
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Confianza: {entry.confidence}%</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
