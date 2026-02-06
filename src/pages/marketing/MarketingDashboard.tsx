import {
    Mail,
    MessageSquare,
    Search,
    TrendingUp,
    Zap,
    Settings,
    Bot
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { Link } from 'react-router-dom';

export default function MarketingDashboard() {
    const { profile } = useAuth();
    console.log(profile); // Keep usage to avoid lint error if strictly needed, or just let it recognize variable is used.

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
                    <Link to="/marketing/email/new" className="bg-gradient-to-r from-orange-500 to-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Nueva Campaña
                    </Link>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link to="/marketing/email">
                    <ActionCard
                        icon={Mail}
                        color="bg-purple-100 text-purple-600"
                        title="Email Marketing"
                        desc="Newsletters y secuencias"
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
                        <button className="text-blue-600 text-sm font-bold hover:underline">Ver todos</button>
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
                                    {/* Real data would map from lead_marketing_stats view here */}
                                    <tr className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">Farmacia San Rafael</div>
                                            <div className="text-[10px] text-gray-400">sanrafael@email.com</div>
                                        </td>
                                        <td className="px-6 py-4">12</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg font-black text-[10px]">8 APERTURAS</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-black text-[10px]">3 CLICKS</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                                                <Zap className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                    <tr className="hover:bg-gray-50/50 transition-colors opacity-60">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">Hospital Central</div>
                                            <div className="text-[10px] text-gray-400">adm@hospcentral.com</div>
                                        </td>
                                        <td className="px-6 py-4">5</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-gray-50 text-gray-500 px-2 py-1 rounded-lg font-black text-[10px]">3 APERTURAS</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-gray-50 text-gray-500 px-2 py-1 rounded-lg font-black text-[10px]">0 CLICKS</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                                                <Zap className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-gray-400 italic text-center">Los datos se actualizan automáticamente al detectar aperturas.</p>
                    </div>
                </div>

                {/* Tracking Summaries */}
                <div className="space-y-4">
                    <StatCard
                        title="Impactos Totales"
                        value="12.5k"
                        trend="+12%"
                        trendUp={true}
                    />
                    <StatCard
                        title="Interés Promedio"
                        value="38%"
                        trend="+5.4%"
                        trendUp={true}
                    />

                    {/* Active Campaign Card */}
                    <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-slate-200">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Campaña Activa</span>
                            </div>
                            <h3 className="text-lg font-bold mb-1">Promo Farmacias Oriente</h3>
                            <div className="flex justify-between text-xs text-gray-400 mb-4">
                                <span>Progreso: 85%</span>
                                <span>142/168 enviados</span>
                            </div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-6">
                                <div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full w-[85%] rounded-full shadow-[0_0_8px_rgba(96,165,250,0.5)]"></div>
                            </div>
                            <Link to="/marketing/email" className="bg-white text-slate-900 px-4 py-2.5 rounded-xl text-sm font-black w-full transition-all flex items-center justify-center gap-2 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98]">
                                Ver Reporte Completo
                            </Link>
                        </div>
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

function StatCard({ title, value, trend, trendUp }: any) {
    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{title}</p>
            <div className="flex items-end justify-between mt-1">
                <h4 className="text-2xl font-black text-gray-900">{value}</h4>
                <span className={`flex items-center text-xs font-bold ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                    {trend}
                    <TrendingUp className={`w-3 h-3 ml-1 ${!trendUp && 'rotate-180'}`} />
                </span>
            </div>
        </div>
    );
}
