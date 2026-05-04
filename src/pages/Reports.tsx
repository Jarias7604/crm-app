import { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../services/supabase';
import {
    Download, FileText, Filter, Database,
    PieChart, Users, CheckCircle, RefreshCw, Layers,
    BarChart3, Activity, TrendingUp, TrendingDown, LayoutDashboard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDashboardStats } from '../hooks/useDashboard';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RechartsPie, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

type ExportType = 'leads_full' | 'pipeline_snapshot' | 'lost_reasons' | 'performance_agents';
type TabType = 'bi' | 'export';

const THEME = {
    primary: '#4F46E5',
    secondary: '#38bdf8',
    success: '#10B981',
    accent: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    slate: '#64748B'
};

const COLORS = [THEME.primary, THEME.secondary, THEME.success, THEME.accent, THEME.purple, THEME.danger];

export default function Reports() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('bi');
    
    // Export State
    const [loadingExport, setLoadingExport] = useState(false);
    const [exportType, setExportType] = useState<ExportType>('leads_full');
    const [dateRange, setDateRange] = useState('30d');

    // BI State
    const [biDateRange, setBiDateRange] = useState<'30d' | '90d' | 'this_year'>('30d');
    
    const startDate = useMemo(() => {
        const now = new Date();
        if (biDateRange === '30d') return subMonths(now, 1).toISOString();
        if (biDateRange === '90d') return subMonths(now, 3).toISOString();
        return new Date(now.getFullYear(), 0, 1).toISOString();
    }, [biDateRange]);

    const { data: dashboardData, isLoading: loadingBi } = useDashboardStats(
        profile?.company_id,
        startDate,
        new Date().toISOString()
    );

    const generateCsv = (rows: any[][], filename: string) => {
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExport = async () => {
        if (!profile?.company_id) return;
        setLoadingExport(true);

        try {
            const daysMap = { '30d': 30, '90d': 90, '12m': 365, 'all': 3650 };
            const days = daysMap[dateRange as keyof typeof daysMap] || 30;
            const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

            if (exportType === 'leads_full') {
                const { data } = await supabase.from('leads')
                    .select('*, profiles(full_name)')
                    .eq('company_id', profile.company_id)
                    .gte('created_at', sinceDate);

                if (!data || data.length === 0) { toast.error('No hay datos en este rango'); return; }

                const rows = [
                    ['ID', 'Nombre', 'Empresa', 'Email', 'Teléfono', 'Fuente', 'Estado', 'Prioridad', 'Valor', 'Asignado A', 'Creado el']
                ];
                data.forEach(l => {
                    rows.push([
                        l.id, l.name, l.company_name || '', l.email || '', l.phone || '',
                        l.source || '', l.status, l.priority, l.value || '0',
                        l.profiles?.full_name || 'Sin asignar', new Date(l.created_at).toLocaleDateString()
                    ]);
                });
                generateCsv(rows, 'Leads_Completos');
            }

            if (exportType === 'pipeline_snapshot') {
                const { data } = await supabase.from('leads')
                    .select('status, value')
                    .eq('company_id', profile.company_id)
                    .gte('created_at', sinceDate);

                if (!data) return;

                const agg: Record<string, { count: number, val: number }> = {};
                data.forEach(l => {
                    if (!agg[l.status]) agg[l.status] = { count: 0, val: 0 };
                    agg[l.status].count++;
                    agg[l.status].val += (l.value || 0);
                });

                const rows = [['Estado del Pipeline', 'Cantidad de Leads', 'Valor Estimado ($)']];
                Object.entries(agg).forEach(([status, stats]) => {
                    rows.push([status, stats.count.toString(), stats.val.toFixed(2)]);
                });
                generateCsv(rows, 'Pipeline_Snapshot');
            }

            toast.success('¡Exportación generada exitosamente!');
        } catch (error) {
            console.error(error);
            toast.error('Error generando el reporte');
        } finally {
            setLoadingExport(false);
        }
    };

    // Prepare BI Data
    const pipelineData = dashboardData?.byStatus?.map(s => ({
        name: s.status,
        leads: s.count,
        value: s.amount
    })) || [];

    const sourceData = dashboardData?.bySource?.map(s => ({
        name: s.source || 'Directo',
        value: s.count
    })) || [];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
                    <p className="font-bold text-gray-900 mb-1">{label || payload[0].name}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                            {entry.name}: {entry.name.toLowerCase().includes('valor') || entry.name.toLowerCase().includes('monto') 
                                ? `$${entry.value.toLocaleString()}` 
                                : entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Business Intelligence Hub</h1>
                        <p className="text-sm font-medium text-gray-500">Analiza tus métricas de conversión y exporta datos crudos.</p>
                    </div>
                </div>

                <div className="flex p-1 bg-gray-100/80 rounded-2xl relative z-10 border border-gray-200/50 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('bi')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'bi' 
                            ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        <PieChart className="w-4 h-4" /> Gráficos e Insights
                    </button>
                    <button 
                        onClick={() => setActiveTab('export')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'export' 
                            ? 'bg-white text-emerald-600 shadow-md ring-1 ring-black/5' 
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        <Database className="w-4 h-4" /> CSV Exports
                    </button>
                </div>
            </div>

            {/* TAB: BI Analytics */}
            {activeTab === 'bi' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    {/* BI Controls */}
                    <div className="flex justify-end mb-2">
                        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
                            {(['30d', '90d', 'this_year'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setBiDateRange(range)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        biDateRange === range ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    {range === '30d' ? 'Últimos 30 Días' : range === '90d' ? 'Últimos 90 Días' : 'Este Año'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loadingBi ? (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                            <p className="font-medium text-sm">Generando analíticas...</p>
                        </div>
                    ) : (
                        <>
                            {/* Top Metrics Row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Leads</p>
                                    <p className="text-3xl font-black text-gray-900">{dashboardData?.stats?.totalLeads || 0}</p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Valor Pipeline</p>
                                    <p className="text-3xl font-black text-gray-900">${(dashboardData?.stats?.totalPipeline || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ganados (Monto)</p>
                                    <p className="text-3xl font-black text-emerald-600">${(dashboardData?.stats?.totalWonAmount || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Win Rate</p>
                                    <p className="text-3xl font-black text-amber-500">{dashboardData?.stats?.conversionRate || 0}%</p>
                                </div>
                            </div>

                            {/* Charts Row 1 */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Pipeline Distribution */}
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Layers className="w-5 h-5 text-indigo-500" />
                                        <h3 className="text-lg font-black text-gray-900">Pipeline por Etapa</h3>
                                    </div>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="leads" name="Cant. Leads" fill={THEME.primary} radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Leads Source */}
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <PieChart className="w-5 h-5 text-emerald-500" />
                                        <h3 className="text-lg font-black text-gray-900">Origen de Prospectos</h3>
                                    </div>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsPie>
                                                <Pie
                                                    data={sourceData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={80}
                                                    outerRadius={110}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                >
                                                    {sourceData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }} />
                                            </RechartsPie>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* TAB: CSV Exports */}
            {activeTab === 'export' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start animate-in slide-in-from-bottom-4 duration-500">
                    {/* Export Configurator */}
                    <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-6">
                            <Download className="w-6 h-6 text-emerald-500" />
                            Generador de Reportes
                        </h2>

                        <div className="space-y-8">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">1. Tipo de Reporte</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <ExportCard
                                        icon={Users} title="Base de Leads" desc="Toda la información cruda exportable a Excel."
                                        active={exportType === 'leads_full'} onClick={() => setExportType('leads_full')}
                                    />
                                    <ExportCard
                                        icon={Layers} title="Pipeline Snapshot" desc="Agrupado por etapas y valorizaciones."
                                        active={exportType === 'pipeline_snapshot'} onClick={() => setExportType('pipeline_snapshot')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">2. Rango de Fechas (Creación)</label>
                                <div className="flex flex-wrap gap-2">
                                    {['30d', '90d', '12m', 'all'].map(r => (
                                        <button
                                            key={r} onClick={() => setDateRange(r)}
                                            className={`px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                                                dateRange === r 
                                                ? 'bg-[#0f172a] text-white shadow-md' 
                                                : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {r === '30d' ? 'Últimos 30 días' : r === '90d' ? 'Últimos 90 días' : r === '12m' ? 'Último Año' : 'Todo el Tiempo'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100">
                                <button
                                    onClick={handleExport}
                                    disabled={loadingExport}
                                    className="w-full bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loadingExport ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                    Generar y Descargar CSV
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-[#0f172a] p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10" />
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 relative z-10">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-black mb-3 text-white relative z-10">Notas de Exportación</h3>
                        <p className="text-slate-300 text-sm font-medium leading-relaxed mb-6 relative z-10">
                            Esta sección está diseñada exclusivamente para exportación de datos crudos hacia Excel, Google Sheets o sistemas de BI externos.
                        </p>
                        <ul className="space-y-3 relative z-10">
                            <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-400" /> Formato CSV UTF-8 universal</li>
                            <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-400" /> Compatible con Excel automático</li>
                            <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-400" /> Límite de 50,000 filas por archivo</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

function ExportCard({ icon: Icon, title, desc, active, onClick }: any) {
    return (
        <div
            onClick={onClick}
            className={`cursor-pointer p-5 rounded-2xl border transition-all ${
                active 
                ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500/20' 
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
            }`}>
                <Icon className="w-5 h-5" />
            </div>
            <h4 className={`font-black ${active ? 'text-emerald-900' : 'text-gray-900'}`}>{title}</h4>
            <p className={`text-xs mt-1 leading-relaxed ${active ? 'text-emerald-700' : 'text-gray-500'}`}>{desc}</p>
        </div>
    );
}
