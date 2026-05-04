import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../services/supabase';
import {
    Download, FileText, Calendar, Filter, Database, 
    ArrowLeft, PieChart, Users, CheckCircle, RefreshCw, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

type ExportType = 'leads_full' | 'pipeline_snapshot' | 'lost_reasons' | 'performance_agents';

export default function Reports() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [exportType, setExportType] = useState<ExportType>('leads_full');
    const [dateRange, setDateRange] = useState('30d');
    
    const generateCsv = (rows: any[][], filename: string) => {
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel UTF-8
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); 
        URL.revokeObjectURL(url);
    };

    const handleExport = async () => {
        if (!profile?.company_id) return;
        setLoading(true);

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
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header matching MarketingSettings */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3 relative z-10">
                    <div>
                        <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Exportación & Data Hub</h1>
                        <p className="text-sm text-gray-500">Descarga tu información en crudo para análisis avanzado.</p>
                    </div>
                </div>

                <div className="flex p-1 bg-gray-100 rounded-2xl relative z-10">
                    <button className="px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-white text-emerald-600 shadow-sm">
                        <Database className="w-3.5 h-3.5" /> CSV Exports
                    </button>
                    <button className="px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-gray-500 hover:text-gray-700 cursor-not-allowed opacity-50">
                        <PieChart className="w-3.5 h-3.5" /> BI Connect (Próximamente)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Export Configurator */}
                <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-6">
                        <Download className="w-6 h-6 text-emerald-500" />
                        Generador de Reportes
                    </h2>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">1. Tipo de Reporte</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ExportCard 
                                    icon={Users} title="Base de Leads" desc="Toda la información cruda." 
                                    active={exportType === 'leads_full'} onClick={() => setExportType('leads_full')} 
                                />
                                <ExportCard 
                                    icon={Layers} title="Pipeline Snapshot" desc="Agrupado por etapas." 
                                    active={exportType === 'pipeline_snapshot'} onClick={() => setExportType('pipeline_snapshot')} 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">2. Rango de Fechas (Creación)</label>
                            <div className="flex flex-wrap gap-2">
                                {['30d', '90d', '12m', 'all'].map(r => (
                                    <button 
                                        key={r} onClick={() => setDateRange(r)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${dateRange === r ? 'bg-[#0f172a] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        {r === '30d' ? 'Últimos 30 días' : r === '90d' ? 'Últimos 90 días' : r === '12m' ? 'Último Año' : 'Todo el Tiempo'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <button 
                                onClick={handleExport}
                                disabled={loading}
                                className="w-full bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                Generar y Descargar CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-gradient-to-br from-slate-900 to-[#0f172a] p-8 rounded-3xl shadow-xl text-white">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black mb-3 text-white">Notas de Exportación</h3>
                    <p className="text-slate-300 text-sm font-medium leading-relaxed mb-6">
                        Para análisis visual y KPIs en tiempo real, por favor dirígete al Dashboard principal. Esta sección está diseñada exclusivamente para exportación de datos crudos hacia Excel, Google Sheets o sistemas de BI externos.
                    </p>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-400"/> Formato CSV UTF-8 universal</li>
                        <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-400"/> Compatible con Excel automático</li>
                        <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-400"/> Límite de 50,000 filas por archivo</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

function ExportCard({ icon: Icon, title, desc, active, onClick }: any) {
    return (
        <div 
            onClick={onClick}
            className={`cursor-pointer p-5 rounded-2xl border transition-all ${active ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <h4 className={`font-black ${active ? 'text-emerald-900' : 'text-gray-900'}`}>{title}</h4>
            <p className={`text-xs mt-1 ${active ? 'text-emerald-700' : 'text-gray-500'}`}>{desc}</p>
        </div>
    );
}
