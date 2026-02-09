import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { lossReasonsService } from '../../services/lossReasons';
import { lossStatisticsService, type LossStatistic } from '../../services/lossStatistics';
import type { LossReason } from '../../types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Pencil, Trash2, Save, X, Download, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react';
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from 'recharts';
import toast from 'react-hot-toast';

export default function LossReasons() {
    const { } = useAuth();
    const navigate = useNavigate();
    const [reasons, setReasons] = useState<LossReason[]>([]);
    const [statistics, setStatistics] = useState<LossStatistic[]>([]);
    const [stageStatistics, setStageStatistics] = useState<{ stage_name: string; loss_count: number; percentage: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newReasonText, setNewReasonText] = useState('');
    const [showStats, setShowStats] = useState(true);

    useEffect(() => {
        loadReasons();
        loadStatistics();
    }, []);

    const loadReasons = async () => {
        try {
            setLoading(true);
            const data = await lossReasonsService.getLossReasons();
            setReasons(data);
        } catch (error: any) {
            // Service handles errors gracefully, just log
            console.error('Error loading reasons:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStatistics = async () => {
        try {
            setLoading(true);
            const [statsData, stageData] = await Promise.all([
                lossStatisticsService.getLossStatistics(),
                lossStatisticsService.getLossStageStatistics()
            ]);
            setStatistics(statsData);
            setStageStatistics(stageData);
        } catch (error: any) {
            console.error('Error loading statistics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newReasonText.trim()) {
            toast.error('Ingresa un motivo válido');
            return;
        }

        try {
            const nextOrder = Math.max(...reasons.map(r => r.display_order), 0) + 1;
            await lossReasonsService.createLossReason(newReasonText.trim(), nextOrder);
            toast.success('Motivo creado exitosamente');
            setNewReasonText('');
            setIsAdding(false);
            loadReasons();
        } catch (error: any) {
            toast.error('Error al crear motivo');
            console.error(error);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editText.trim()) {
            toast.error('El motivo no puede estar vacío');
            return;
        }

        try {
            await lossReasonsService.updateLossReason(id, { reason: editText.trim() });
            toast.success('Motivo actualizado');
            setEditingId(null);
            setEditText('');
            loadReasons();
            loadStatistics(); // Refresh stats
        } catch (error: any) {
            toast.error('Error al actualizar motivo');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de desactivar este motivo? No se eliminará del historial.')) {
            return;
        }

        try {
            await lossReasonsService.deleteLossReason(id);
            toast.success('Motivo desactivado');
            loadReasons();
        } catch (error: any) {
            toast.error('Error al desactivar motivo');
            console.error(error);
        }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(reasons);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        const updates = items.map((item, index) => ({
            id: item.id,
            display_order: index + 1
        }));

        setReasons(items);

        try {
            await lossReasonsService.reorderLossReasons(updates);
            toast.success('Orden actualizado');
        } catch (error: any) {
            toast.error('Error al reordenar');
            loadReasons();
        }
    };

    const handleExport = () => {
        if (statistics.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }
        lossStatisticsService.downloadCSV(statistics);
        toast.success('Archivo descargado exitosamente');
    };

    const handleBarClick = (data: any) => {
        if (data && data.reason_id) {
            navigate('/leads', {
                state: {
                    lostReasonId: data.reason_id,
                    status: 'Perdido'
                }
            });
        }
    };

    const totalLost = (statistics || []).reduce((sum, stat) => sum + (Number(stat.loss_count) || 0), 0);
    const topReason = statistics.length > 0 ? statistics[0] : null;
    const paretoThreshold = statistics.find(s => (s.cumulative_percentage || 0) >= 80);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-sm font-medium text-gray-500">Cargando motivos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50">
            <div className="max-w-[1600px] mx-auto p-8">
                {/* Header */}
                <div className="mb-10 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <BarChart3 className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Loss Reasons</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-white bg-slate-900 px-2 py-0.5 rounded-full uppercase tracking-widest">Analytics</span>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Optimización de Pipeline mediante Pareto
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${showStats
                                ? 'bg-white text-slate-600 border border-slate-200 shadow-sm'
                                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
                                }`}
                        >
                            {showStats ? 'Ocultar' : 'Ver'} Insights
                        </button>
                    </div>
                </div>

                {/* Statistics Section */}
                {/* Statistics Section - Optimized Grid */}
                {showStats && (
                    <div className="mb-12">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                            {/* Main Display: Chart + KPIs (3/4 of width) */}
                            <div className="lg:col-span-3 space-y-8">
                                {/* KPI Cards Compact - High Density */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 shrink-0">
                                            <TrendingDown className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Perdidos</p>
                                            <p className="text-2xl font-black text-slate-900 tracking-tighter">{totalLost}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                                            <BarChart3 className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Motivo Crítico</p>
                                            <p className="text-base font-black text-slate-900 tracking-tight truncate">{topReason?.reason_name || 'Sin datos'}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Foco Pareto</p>
                                            <p className="text-xl font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">
                                                {paretoThreshold ? statistics.findIndex(s => s === paretoThreshold) + 1 : 0} Motivos
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Charts Container - Side by Side Grid (Balanced Proportions) */}
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    {/* Pareto Chart Area - Wider for more reasons */}
                                    {statistics.length > 0 ? (
                                        <div className="xl:col-span-2 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                                            <div className="mb-4 flex justify-between items-center">
                                                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase tracking-wider">Distribución (Pareto)</h3>
                                                <span className="text-[9px] font-bold text-slate-400 border border-slate-100 px-2.5 py-1 rounded-full uppercase tracking-tighter">80/20 Analysis</span>
                                            </div>
                                            <div className="h-[280px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={statistics} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis
                                                            dataKey="reason_name"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            angle={-25}
                                                            textAnchor="end"
                                                            height={50}
                                                            tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                                        />
                                                        <YAxis
                                                            yAxisId="left"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                                                        />
                                                        <YAxis
                                                            yAxisId="right"
                                                            orientation="right"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            domain={[0, 100]}
                                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                                                        />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                                            contentStyle={{
                                                                borderRadius: '20px',
                                                                border: 'none',
                                                                boxShadow: '0 20px 50px -12px rgba(0,0,0,0.11)',
                                                                padding: '12px',
                                                                fontWeight: 800,
                                                                fontSize: '11px'
                                                            }}
                                                        />
                                                        <Bar
                                                            yAxisId="left"
                                                            dataKey="loss_count"
                                                            onClick={handleBarClick}
                                                            cursor="pointer"
                                                            radius={[4, 4, 0, 0]}
                                                            barSize={18}
                                                        >
                                                            {statistics.map((_, index) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={[
                                                                        '#6366f1', // Indigo
                                                                        '#8b5cf6', // Violet
                                                                        '#ec4899', // Pink
                                                                        '#f43f5e', // Rose
                                                                        '#f59e0b', // Amber
                                                                        '#10b981', // Emerald
                                                                        '#06b6d4', // Cyan
                                                                        '#3b82f6'  // Blue
                                                                    ][index % 8]}
                                                                />
                                                            ))}
                                                        </Bar>
                                                        <Line
                                                            yAxisId="right"
                                                            type="monotone"
                                                            dataKey="cumulative_percentage"
                                                            stroke="#f59e0b"
                                                            strokeWidth={2.5}
                                                            dot={{ fill: '#f59e0b', r: 3, stroke: '#fff', strokeWidth: 1.5 }}
                                                        />
                                                        <ReferenceLine yAxisId="right" y={80} stroke="#cbd5e1" strokeDasharray="6 6" strokeWidth={1} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="xl:col-span-2 bg-white rounded-[2rem] border border-slate-100 p-12 text-center shadow-sm h-[348px] flex flex-col justify-center">
                                            <BarChart3 className="w-12 h-12 mx-auto text-slate-100 mb-4" />
                                            <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Esperando Datos...</p>
                                        </div>
                                    )}

                                    {/* Stage Analysis Chart Area - More compact */}
                                    {stageStatistics.length > 0 ? (
                                        <div className="xl:col-span-1 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                                            <div className="mb-4 flex justify-between items-center">
                                                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase tracking-wider">Fuga por Etapa</h3>
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full uppercase tracking-tighter">Drop-off Points</span>
                                            </div>
                                            <div className="h-[280px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart layout="vertical" data={stageStatistics} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                        <XAxis type="number" hide />
                                                        <YAxis
                                                            dataKey="stage_name"
                                                            type="category"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fontSize: 11, fontWeight: 900, fill: '#334155' }}
                                                            width={90}
                                                        />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }}
                                                            contentStyle={{
                                                                borderRadius: '20px',
                                                                border: 'none',
                                                                boxShadow: '0 20px 50px -12px rgba(0,0,0,0.11)',
                                                                padding: '12px',
                                                                fontWeight: 800,
                                                                fontSize: '11px'
                                                            }}
                                                        />
                                                        <Bar
                                                            dataKey="loss_count"
                                                            radius={[0, 8, 8, 0]}
                                                            barSize={16}
                                                        >
                                                            {stageStatistics.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : '#cbd5e1'} />
                                                            ))}
                                                        </Bar>
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="xl:col-span-1 bg-white rounded-[2rem] border border-slate-100 p-12 text-center shadow-sm h-[348px] flex flex-col justify-center">
                                            <TrendingDown className="w-12 h-12 mx-auto text-slate-100 mb-4" />
                                            <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Esperando Datos...</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sidebar: Insights + Actions (1/4 of width) */}
                            <div className="lg:col-span-1 space-y-6">
                                {/* Rule 80/20 Mini-Card */}
                                <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200 flex flex-col justify-between h-full">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                            </div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ley de Pareto</p>
                                        </div>
                                        <h4 className="text-sm font-black mb-3 leading-tight tracking-tight">El 80% de pérdida ocurre por el 20% de causas.</h4>
                                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                            Prioriza los <span className="text-amber-400 font-bold">{paretoThreshold ? statistics.findIndex(s => s === paretoThreshold) + 1 : 0} motivos principales</span> para proteger tu pipeline.
                                        </p>
                                    </div>

                                    <div className="pt-6 mt-6 border-t border-white/10 space-y-3">
                                        <button
                                            onClick={handleExport}
                                            disabled={statistics.length === 0}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-indigo-900/20"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Exportar Dashboard
                                        </button>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Formato .CSV compatible</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Management Section - Dashboard Style */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm mt-10">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Motivos</h2>
                            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">Configuración de Pipeline</p>
                        </div>
                        {!isAdding && (
                            <button
                                onClick={() => setIsAdding(true)}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-lg shadow-indigo-100"
                            >
                                <Plus className="w-4 h-4" />
                                Nuevo Motivo
                            </button>
                        )}
                    </div>

                    {/* Add New Form */}
                    {isAdding && (
                        <form onSubmit={handleCreate} className="bg-white/60 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200/60 p-5 ring-4 ring-slate-50">
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={newReasonText}
                                    onChange={(e) => setNewReasonText(e.target.value)}
                                    placeholder="Ej: Presupuesto Insuficiente"
                                    className="flex-1 px-5 py-3 rounded-2xl border-none bg-slate-100/50 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        className="px-6 py-3 bg-white text-emerald-600 border border-emerald-100 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-sm"
                                    >
                                        <Save className="w-4 h-4" />
                                        Guardar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAdding(false);
                                            setNewReasonText('');
                                        }}
                                        className="px-4 py-3 bg-white text-slate-400 border border-slate-100 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Reasons List */}
                    <div className="bg-transparent space-y-3">
                        {reasons.length === 0 ? (
                            <div className="p-16 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                <BarChart3 className="w-16 h-16 mx-auto text-slate-100 mb-6" />
                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                    No hay motivos configurados
                                </p>
                                <p className="text-xs text-slate-300 mt-2 font-medium">
                                    Agrega tu primer motivo para empezar el análisis
                                </p>
                            </div>
                        ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable droppableId="reasons">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {reasons.map((reason, index) => (
                                                <Draggable key={reason.id} draggableId={reason.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`bg-white rounded-[1.5rem] border border-slate-100/80 transition-all shadow-sm hover:shadow-md ${snapshot.isDragging ? 'ring-2 ring-indigo-500/20 rotate-1 scale-[1.02] shadow-xl z-50' : ''
                                                                }`}
                                                        >
                                                            {editingId === reason.id ? (
                                                                // Edit Mode
                                                                <div className="p-4 flex gap-4 items-center">
                                                                    <div {...provided.dragHandleProps} className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center cursor-move text-indigo-500">
                                                                        <GripVertical className="w-5 h-5" />
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={editText}
                                                                        onChange={(e) => setEditText(e.target.value)}
                                                                        className="flex-1 px-4 py-3 rounded-xl border-none bg-indigo-50/50 text-sm font-bold tracking-tight text-slate-700 focus:ring-2 focus:ring-indigo-500"
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleUpdate(reason.id)}
                                                                            className="w-10 h-10 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center shadow-lg shadow-emerald-100"
                                                                        >
                                                                            <Save className="w-5 h-5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingId(null);
                                                                                setEditText('');
                                                                            }}
                                                                            className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center"
                                                                        >
                                                                            <X className="w-5 h-5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                // View Mode
                                                                <div className="p-4 flex gap-4 items-center group transition-all">
                                                                    <div {...provided.dragHandleProps} className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50 cursor-move transition-all">
                                                                        <GripVertical className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="flex-1 flex items-center justify-between">
                                                                        <div>
                                                                            <p className="text-base font-black text-slate-800 tracking-tight">{reason.reason}</p>
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Identificador: {reason.id.slice(0, 8)}</p>
                                                                        </div>
                                                                        <div className="text-right mr-4">
                                                                            <span className="text-xs font-black text-slate-300 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest">
                                                                                Pos #{(reason.display_order < 10 ? '0' : '') + reason.display_order}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingId(reason.id);
                                                                                setEditText(reason.reason);
                                                                            }}
                                                                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                                                                        >
                                                                            <Pencil className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(reason.id)}
                                                                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
