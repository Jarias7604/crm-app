import {
    MessageSquare,
    Search,
    TrendingUp,
    Zap,
    Settings,
    Bot,
    ExternalLink,
    Users,
    DollarSign,
    Target,
    Sparkles,
    BarChart3,
    ArrowRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { marketingStatsService, type MarketingStats, type HeatmapLead, type ActiveCampaign } from '../../services/marketing/marketingStats';
import { cn } from '../../lib/utils';

export default function MarketingDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MarketingStats | null>(null);
    const [heatmapLeads, setHeatmapLeads] = useState<HeatmapLead[]>([]);
    const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [s, h, a] = await Promise.all([
                    marketingStatsService.getOverviewStats(),
                    marketingStatsService.getHeatmapLeads(),
                    marketingStatsService.getActiveCampaign()
                ]);
                setStats(s);
                setHeatmapLeads(h);
                setActiveCampaign(a);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleLeadRedirect = (leadId: string) => {
        navigate('/leads', { state: { leadId } });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shadow-inner">
                        <BarChart3 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-[#0f172a] tracking-tight text-indigo-900 group">Marketing Hub</h1>
                        <p className="text-slate-500 text-[11px] font-medium">Gestión clara y profesional de campañas.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link to="/marketing/settings" className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2 shadow-sm">
                        <Settings className="w-3.5 h-3.5" />
                        Ajustes
                    </Link>
                    <Link to="/marketing/campaign/new" className="bg-indigo-600 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/10 transition-all flex items-center gap-2">
                        <PlusIcon className="w-3.5 h-3.5" />
                        Nueva Campaña
                    </Link>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <QuickAction to="/marketing/email" icon={Zap} label="Campañas" desc="Omnicanal" color="text-indigo-600" bg="bg-indigo-50" />
                <QuickAction to="/marketing/flyers" icon={Sparkles} label="Studio" desc="Imagen IA" color="text-pink-600" bg="bg-pink-50" tag="Pro" />
                <QuickAction to="/marketing/ai-agents" icon={Bot} label="Agentes" desc="Chat IA" color="text-blue-600" bg="bg-blue-50" />
                <QuickAction to="/marketing/lead-hunter" icon={Search} label="Lead Hunter" desc="Descubrimiento" color="text-amber-600" bg="bg-amber-50" />
                <QuickAction to="/marketing/settings" icon={MessageSquare} label="Canales" desc="Configurar" color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <CompactStatCard title="Oportunidades" value={stats?.opportunities || 0} trend={stats?.opportunityTrend || "+0"} icon={Users} desc="Leads de valor" />
                        <CompactStatCard title="Pipeline Value" value={`$${(stats?.pipelineValue || 0).toLocaleString()}`} trend={stats?.pipelineTrend || "+0%"} icon={DollarSign} desc="Proyectado" />
                        <CompactStatCard title="Conversión" value={`${stats?.conversionRate || 0}%`} trend={stats?.conversionTrend || "+0%"} icon={Target} desc="Efectividad" />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[460px]">
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
                            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-indigo-500" />
                                KPIs DE INTERACCIÓN
                            </h3>
                            <Link to="/marketing/email" className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-widest transition-colors">
                                Ver Todo <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3">Prospecto</th>
                                        <th className="px-5 py-3">Impactos</th>
                                        <th className="px-5 py-3">Engagement</th>
                                        <th className="px-5 py-3 text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {heatmapLeads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-5 py-3">
                                                <button onClick={() => handleLeadRedirect(lead.id)} className="text-left group">
                                                    <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{lead.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{lead.email}</p>
                                                </button>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-[11px] font-black text-slate-600">{lead.sent} Envíos</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge value={`${lead.opens} AP`} color="text-orange-600 bg-orange-50 border-orange-100" />
                                                    <Badge value={`${lead.clicks} CL`} color="text-indigo-600 bg-indigo-50 border-indigo-100" />
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="inline-flex items-center gap-3">
                                                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (lead.engagementScore / 20) * 100)}%` }}></div>
                                                    </div>
                                                    <span className="text-[11px] font-black text-indigo-600 min-w-[20px]">{lead.engagementScore}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                    {/* Active Campaign Card - Premium Indigo Soft */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-600/10 transition-colors"></div>
                        <div className="relative z-10">
                            {activeCampaign ? (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">En Ejecución</span>
                                    </div>
                                    <h3 className="text-base font-black text-slate-900 mb-1 truncate uppercase tracking-tight">{activeCampaign.name}</h3>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-3">
                                        <span>{activeCampaign.sent}/{activeCampaign.total} Enviados</span>
                                        <span className="text-indigo-600">{activeCampaign.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-5 border border-white">
                                        <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${activeCampaign.progress}%` }}></div>
                                    </div>
                                    <Link to={`/marketing/email`} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
                                        Gestionar Envíos
                                    </Link>
                                </>
                            ) : (
                                <div className="py-6 text-center">
                                    <Zap className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Pausa de Campaña</p>
                                    <Link to="/marketing/campaign/new" className="mt-4 inline-block text-[10px] font-black text-indigo-600 hover:text-indigo-700 tracking-widest border-b-2 border-indigo-100 hover:border-indigo-600 transition-all">
                                        LANZAR AHORA +
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                                <Bot className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Inteligencia CRM</h3>
                                <p className="text-[9px] text-slate-400 font-medium">Recomendaciones de ROI</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                             {heatmapLeads.slice(0, 3).map((l, i) => (
                                <div key={i} className="bg-slate-50/50 p-3 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all cursor-pointer group">
                                    <p className="text-[11px] font-bold text-slate-800 leading-tight group-hover:text-indigo-900 transition-colors">{l.name} espera comunicación.</p>
                                    <p className="text-[9px] text-slate-400 mt-1 font-medium italic">Alta tasa de apertura detectada.</p>
                                </div>
                             ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CompactStatCard({ title, value, trend, trendUp, icon: Icon, desc }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-100 transition-all">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
                    <p className="text-xl font-black text-indigo-950 mt-1 tracking-tight">{value}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                    <Icon className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{desc}</span>
                <span className={cn("text-[10px] font-black", trend.includes('+') ? 'text-emerald-500' : 'text-slate-400')}>{trend}</span>
            </div>
        </div>
    );
}

function QuickAction({ to, icon: Icon, label, desc, color, bg, tag }: any) {
    return (
        <Link to={to} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden">
            <div className={cn("w-9 h-9 flex items-center justify-center rounded-lg mb-2.5 transition-transform group-hover:scale-110", bg, color)}>
                <Icon className="w-5 h-5" />
            </div>
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{label}</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{desc}</p>
            {tag && <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-md uppercase">{tag}</span>}
        </Link>
    );
}

function Badge({ value, color }: any) {
    return <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border", color)}>{value}</span>;
}

function PlusIcon(props: any) {
    return <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
}
