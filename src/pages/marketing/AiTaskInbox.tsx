import React, { useState, useEffect } from 'react';
import { Bot, Check, X, Clock, Zap, Target, Sparkles, ArrowRight, CircleDot, Activity } from 'lucide-react';
import { proactiveEngineService, type AiTask } from '../../services/marketing/proactiveEngine';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface Props {
    companyId: string;
}

interface RecentActivity {
    id: string;
    title: string;
    agent_name: string;
    status: string;
    created_at: string;
}

export default function AiTaskInbox({ companyId }: Props) {
    const [tasks, setTasks] = useState<AiTask[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, auto: 0, approved: 0 });

    const loadTasks = async () => {
        if (!companyId) return;
        setIsLoading(true);
        try {
            const data = await proactiveEngineService.getPendingTasks(companyId);
            setTasks(data);

            // Load recent activity (last 5 completed tasks)
            const { data: recent } = await supabase
                .from('ai_tasks')
                .select('id, title, agent_name, status, created_at')
                .eq('company_id', companyId)
                .eq('agent_name', 'sofia')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recent) setRecentActivity(recent);

            // Load stats
            const { data: allTasks } = await supabase
                .from('ai_tasks')
                .select('status')
                .eq('company_id', companyId)
                .eq('agent_name', 'sofia');

            if (allTasks) {
                setStats({
                    pending: allTasks.filter(t => t.status === 'pending').length,
                    auto: allTasks.filter(t => t.status === 'autopilot').length,
                    approved: allTasks.filter(t => t.status === 'approved').length,
                });
            }
        } catch (error) {
            console.error('Failed to load tasks', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, [companyId]);

    const handleResolve = async (taskId: string, status: 'approved' | 'rejected') => {
        try {
            await proactiveEngineService.resolveTask(taskId, status);
            toast.success(status === 'approved' ? '🚀 Tarea aprobada y en ejecución' : 'Descartada');
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (error) {
            toast.error('Error al procesar tarea');
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'autopilot': return { label: 'Auto-ejecutado', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-400' };
            case 'approved': return { label: 'Aprobado', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-400' };
            case 'rejected': return { label: 'Descartado', color: 'text-gray-400', bg: 'bg-gray-50', dot: 'bg-gray-300' };
            default: return { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400' };
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const mins = Math.floor((Date.now() - d.getTime()) / 60000);
        if (mins < 1) return 'Ahora mismo';
        if (mins < 60) return `Hace ${mins}m`;
        const hrs = Math.floor(mins / 60);
        return `Hace ${hrs}h`;
    };

    if (isLoading) {
        return <div className="h-64 bg-gradient-to-br from-indigo-50 to-slate-50 animate-pulse rounded-3xl w-full" />;
    }

    // ── EMPTY STATE (premium) ──────────────────────────────────────────────────
    if (tasks.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Bot className="w-4 h-4 text-indigo-500" />
                            Bandeja de Aprobación AI
                        </h3>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">Propuestas generadas automáticamente</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Todo al día</span>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 divide-x divide-gray-50 border-b border-gray-50">
                    <div className="px-5 py-4 text-center">
                        <div className="text-xl font-black text-gray-900">{stats.pending}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Pendientes</div>
                    </div>
                    <div className="px-5 py-4 text-center">
                        <div className="text-xl font-black text-emerald-600">{stats.auto}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Auto-ejec.</div>
                    </div>
                    <div className="px-5 py-4 text-center">
                        <div className="text-xl font-black text-blue-600">{stats.approved}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Aprobadas</div>
                    </div>
                </div>

                {/* Empty state body */}
                <div className="px-6 py-5">
                    <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-indigo-50/70 to-transparent rounded-2xl border border-indigo-100/50 mb-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-indigo-900">Sofía está monitoreando tus leads</p>
                            <p className="text-xs text-indigo-600/70 font-medium mt-0.5 leading-relaxed">
                                En modo Copiloto, cuando identifique leads que necesiten seguimiento, aparecerán aquí para tu aprobación. En Autopilot, se ejecutan solos.
                            </p>
                        </div>
                    </div>

                    {/* Recent activity feed */}
                    {recentActivity.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Activity className="w-3 h-3" /> Actividad reciente
                            </p>
                            <div className="space-y-2">
                                {recentActivity.map(act => {
                                    const cfg = getStatusConfig(act.status);
                                    return (
                                        <div key={act.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                                            <p className="text-xs font-medium text-gray-700 flex-1 truncate">{act.title}</p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color} shrink-0`}>
                                                {cfg.label}
                                            </span>
                                            <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                                                {formatTime(act.created_at)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {recentActivity.length === 0 && (
                        <div className="text-center py-4">
                            <CircleDot className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                            <p className="text-xs text-gray-400 font-medium">
                                Aún no hay actividad. Presiona <strong className="text-gray-600">Ejecutar Seguimientos</strong> para iniciar el motor.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── TASKS LIST ────────────────────────────────────────────────────────────
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-500" />
                        Bandeja de Aprobación AI
                        <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">{tasks.length}</span>
                    </h3>
                    <p className="text-xs text-indigo-600/70 font-medium mt-1">Propuestas generadas automáticamente</p>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-300" />
            </div>

            <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                {tasks.map(task => (
                    <div key={task.id} className="p-6 hover:bg-gray-50/70 transition-colors">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1">
                                        {task.agent_name === 'maya' ? <Target className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                        Agente {task.agent_name}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> hace 2 min
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 mb-1 truncate">{task.title}</h4>
                                <p className="text-xs text-gray-500 font-medium leading-relaxed mb-3">{task.description}</p>
                                {task.impact_estimate && (
                                    <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-[11px] font-bold inline-block border border-emerald-100">
                                        💡 Impacto: {task.impact_estimate}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                                <button
                                    onClick={() => handleResolve(task.id, 'approved')}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 justify-center"
                                >
                                    <Check className="w-4 h-4" /> Aprobar
                                </button>
                                <button
                                    onClick={() => handleResolve(task.id, 'rejected')}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 justify-center"
                                >
                                    <X className="w-4 h-4" /> Descartar
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
