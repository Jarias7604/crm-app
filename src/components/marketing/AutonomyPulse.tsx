import React, { useEffect, useState } from 'react';
import { Activity, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface Props {
    companyId: string;
}

export default function AutonomyPulse({ companyId }: Props) {
    const [stats, setStats] = useState({
        lastRun: 'Desconocido',
        lastRunDate: null as Date | null,
        tasksToday: 0,
        autoExecutedToday: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!companyId) return;

        const loadStats = async () => {
            try {
                // Get the latest task created by Sofia
                const { data: latest } = await supabase
                    .from('ai_tasks')
                    .select('created_at')
                    .eq('company_id', companyId)
                    .eq('agent_name', 'sofia')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                // Get today's stats
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const { data: todayTasks } = await supabase
                    .from('ai_tasks')
                    .select('status')
                    .eq('company_id', companyId)
                    .eq('agent_name', 'sofia')
                    .gte('created_at', startOfDay.toISOString());

                const total = todayTasks?.length || 0;
                const auto = todayTasks?.filter(t => t.status === 'autopilot' || t.status === 'completed').length || 0;

                let lastRunText = 'Esperando primer ciclo...';
                let lastRunDate = null;
                
                if (latest) {
                    lastRunDate = new Date(latest.created_at);
                    const minutesAgo = Math.floor((Date.now() - lastRunDate.getTime()) / 60000);
                    if (minutesAgo < 1) lastRunText = 'Hace unos segundos';
                    else if (minutesAgo < 60) lastRunText = `Hace ${minutesAgo} minutos`;
                    else {
                        const hours = Math.floor(minutesAgo / 60);
                        lastRunText = `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
                    }
                }

                setStats({
                    lastRun: lastRunText,
                    lastRunDate,
                    tasksToday: total,
                    autoExecutedToday: auto
                });
            } catch (error) {
                console.error("Error loading pulse stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadStats();
        // Refresh every minute
        const interval = setInterval(loadStats, 60000);
        return () => clearInterval(interval);
    }, [companyId]);

    if (isLoading) {
        return <div className="h-24 bg-gray-50 animate-pulse rounded-2xl w-full"></div>;
    }

    // Determine health status based on last run
    const isHealthy = stats.lastRunDate && (Date.now() - stats.lastRunDate.getTime()) < 1000 * 60 * 120; // 2 hours

    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-50 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-5 relative">
                <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        Motor 24/7
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </div>
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Online & Monitoreando</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 relative">
                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Último Ciclo</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{stats.lastRun}</p>
                </div>

                <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Acciones Hoy</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-emerald-700 leading-none">{stats.tasksToday}</span>
                        <span className="text-xs font-medium text-emerald-600/70 mb-0.5">tareas gen.</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-medium text-gray-500">
                <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                    Auto-ejecutadas: <strong className="text-gray-900">{stats.autoExecutedToday}</strong>
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Powered by Cron</span>
            </div>
        </div>
    );
}
