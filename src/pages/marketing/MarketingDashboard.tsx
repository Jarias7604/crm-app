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
    Target
} from 'lucide-react';
// import { useTranslation } from 'react-i18next'; // Removed unused
// import { useAuth } from '../../auth/AuthProvider'; // Removed unused
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Marketing Hub</h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Gestiona campañas omnicanal, automatizaciones y descubre nuevos clientes con IA.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link to="/marketing/settings" className="bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Configurar Envíos
                    </Link>
                    <Link to="/marketing/campaign/new" className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Nueva Campaña
                    </Link>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link to="/marketing/email">
                    <ActionCard
                        icon={Zap}
                        color="bg-purple-100 text-purple-600"
                        title="Gestión de Campañas"
                        desc="Email, WhatsApp & Telegram"
                    />
                </Link>
                <Link to="/marketing/settings" state={{ tab: 'whatsapp' }}>
                    <ActionCard
                        icon={MessageSquare}
                        color="bg-green-100 text-green-600"
                        title="WhatsApp & Chat"
                        desc="Configura canales y responde"
                    />
                </Link>
                <Link to="/marketing/ai-agents">
                    <ActionCard
                        icon={Bot}
                        color="bg-blue-100 text-blue-600"
                        title="Agentes AI"
                        desc="Configurar bots de venta"
                    />
                </Link>
                <Link to="/marketing/lead-hunter">
                    <ActionCard
                        icon={Search}
                        color="bg-amber-100 text-amber-600"
                        title="Lead Hunter"
                        desc="Descubrir clientes nuevos"
                        isNew={true}
                    />
                </Link>
            </div>

            {/* Stats Overview & Interest Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Interest Heatmap Area */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-orange-500" />
                                Mapa de Calor de Interés
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Leads con mayor interacción en tiempo real.</p>
                        </div>
                        <Link to="/marketing/email" className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                            Ver todos
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {/* Heatmap List */}
                        <div className="overflow-hidden rounded-2xl border border-gray-100">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                                    <tr>
                                        <th className="px-6 py-4">Prospecto</th>
                                        <th className="px-6 py-4">Envíos</th>
                                        <th className="px-6 py-4">Aperturas</th>
                                        <th className="px-6 py-4">Clicks</th>
                                        <th className="px-6 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-medium text-sm">
                                    {heatmapLeads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleLeadRedirect(lead.id)}
                                                    className="text-left group/name flex items-center gap-3"
                                                >
                                                    <div className={cn(
                                                        "w-2 h-2 rounded-full",
                                                        lead.clicks > 0 ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "bg-gray-300"
                                                    )}></div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 group-hover/name:text-blue-600 transition-colors uppercase tracking-tight">{lead.name}</div>
                                                        <div className="text-[10px] text-gray-400">{lead.email}</div>
                                                    </div>
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-bold">{lead.sent}</td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-lg font-black text-[10px]",
                                                    lead.opens > 0 ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-400"
                                                )}>
                                                    {lead.opens} APERTURAS
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-lg font-black text-[10px]",
                                                    lead.clicks > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-400"
                                                )}>
                                                    {lead.clicks} CLICKS
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleLeadRedirect(lead.id)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-all active:scale-90"
                                                    title="Ver perfil del Lead"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-gray-400 italic text-center">Los datos se actualizan automáticamente al detectar aperturas.</p>
                    </div>
                </div>

                {/* AI Insights & Active Campaign */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Performance KPIs Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            onClick={() => navigate('/leads', { state: { leadIds: stats?.opportunityLeadIds } })}
                            className="block transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <StatCard
                                title="Oportunidades"
                                value={String(stats?.opportunities || 0)}
                                trend={stats?.opportunityTrend || "+0"}
                                trendUp={true}
                                icon={Users}
                                desc="Leads con cotizaciones"
                            />
                        </div>
                        <div
                            onClick={() => navigate('/cotizaciones')}
                            className="block transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <StatCard
                                title="Pipeline Value"
                                value={`$${stats?.pipelineValue.toLocaleString() || "0"}`}
                                trend={stats?.pipelineTrend || "+0%"}
                                trendUp={true}
                                icon={DollarSign}
                                desc="Valor proyectado"
                            />
                        </div>
                        <div
                            onClick={() => navigate('/leads', { state: { leadIds: stats?.convertedLeadIds } })}
                            className="block transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <StatCard
                                title="Tasa de Conversión"
                                value={`${stats?.conversionRate || 0}%`}
                                trend={stats?.conversionTrend || "+0%"}
                                trendUp={true}
                                icon={Target}
                                desc="Efectividad de Marketing"
                            />
                        </div>
                    </div>

                    <AIInsightsPanel heatmapLeads={heatmapLeads} />

                    {/* Active Campaign Card */}
                    <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-slate-200">
                        {activeCampaign ? (
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Campaña Activa</span>
                                </div>
                                <h3 className="text-lg font-bold mb-1 truncate">{activeCampaign.name}</h3>
                                <div className="flex justify-between text-xs text-gray-400 mb-4">
                                    <span>{activeCampaign.sent}/{activeCampaign.total} enviados</span>
                                    <span>{activeCampaign.progress}%</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-6">
                                    <div
                                        className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(96,165,250,0.5)] transition-all duration-1000"
                                        style={{ width: `${activeCampaign.progress}%` }}
                                    ></div>
                                </div>
                                <Link to={`/marketing/campaign/${activeCampaign.id}/edit`} className="bg-white text-slate-900 px-4 py-2.5 rounded-xl text-sm font-black w-full transition-all flex items-center justify-center gap-2 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98]">
                                    Ver Reporte
                                </Link>
                            </div>
                        ) : (
                            <div className="relative z-10 py-8 text-center">
                                <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3 opacity-20" />
                                <p className="text-sm text-gray-500 font-bold">Sin campañas activas hoy</p>
                                <Link to="/marketing/campaign/new" className="mt-4 inline-block text-blue-400 text-xs font-black uppercase tracking-widest hover:text-blue-300">
                                    Crear una ahora +
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActionCard({ icon: Icon, color, title, desc, isNew = false }: any) {
    return (
        <div className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-left group relative overflow-hidden">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{title}</h3>
            <p className="text-xs text-gray-500 font-medium">{desc}</p>
            {isNew && (
                <span className="absolute top-4 right-4 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    New
                </span>
            )}
        </div>
    );
}

function StatCard({ title, value, trend, trendUp, icon: Icon, desc }: any) {
    return (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{title}</p>
                    <h4 className="text-2xl font-black text-[#0f172a] mt-1">{value}</h4>
                </div>
                {Icon && (
                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 font-medium">{desc}</p>
                <span className={`flex items-center text-[11px] font-black ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                    {trend}
                    <TrendingUp className={`w-3 h-3 ml-1 ${!trendUp && 'rotate-180'}`} />
                </span>
            </div>
        </div>
    );
}

function AIInsightsPanel({ heatmapLeads }: { heatmapLeads: HeatmapLead[] }) {
    // Generate simple insights based on data
    const hotLeads = heatmapLeads.filter(l => l.clicks > 0).slice(0, 3);

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Bot className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">IA Sugiere...</h3>
            </div>

            <div className="space-y-3">
                {hotLeads.length > 0 ? hotLeads.map((lead, i) => (
                    <div key={i} className="flex gap-3 items-start p-3 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                        <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">
                                {lead.name} tiene alta intención de compra ({lead.clicks} clicks).
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1 font-medium">Recomendación: Enviar oferta personalizada.</p>
                        </div>
                    </div>
                )) : (
                    <p className="text-xs text-gray-500 italic">No hay suficientes datos para sugerencias hoy.</p>
                )}
            </div>
        </div>
    );
}
