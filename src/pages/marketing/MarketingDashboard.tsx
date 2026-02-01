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

            {/* Stats Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart Area Placeholder */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 min-h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Rendimiento de Campañas</h3>
                        <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-xs font-medium text-gray-600">
                            <option>Últimos 30 días</option>
                            <option>Este trimestre</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-center h-[200px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <div className="text-center text-gray-400">
                            <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">Gráfico de Opens/Clicks vs Tiempo</p>
                        </div>
                    </div>
                </div>

                {/* Right Side Stats */}
                <div className="space-y-4">
                    <StatCard
                        title="Total Enviados"
                        value="12,543"
                        trend="+12%"
                        trendUp={true}
                    />
                    <StatCard
                        title="Tasa de Apertura"
                        value="45.2%"
                        trend="+5.4%"
                        trendUp={true}
                    />
                    <StatCard
                        title="Leads Generados"
                        value="892"
                        trend="+23%"
                        trendUp={true}
                    />

                    <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 rounded-2xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-1">Lead Hunter AI</h3>
                            <p className="text-gray-400 text-sm mb-4">Descubre 500+ prospectos nuevos esta semana.</p>
                            <Link to="/marketing/lead-hunter" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-lg text-sm font-semibold w-full transition-colors flex items-center justify-center gap-2">
                                <Search className="w-4 h-4" />
                                Iniciar Búsqueda
                            </Link>
                        </div>
                        <Search className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
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
