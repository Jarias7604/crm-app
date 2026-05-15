import React, { useState, useEffect } from 'react';
import { Bot, Check, X, Clock, Zap, Target } from 'lucide-react';
import { proactiveEngineService, type AiTask } from '../../services/marketing/proactiveEngine';
import toast from 'react-hot-toast';

interface Props {
    companyId: string;
}

export default function AiTaskInbox({ companyId }: Props) {
    const [tasks, setTasks] = useState<AiTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadTasks = async () => {
        if (!companyId) return;
        setIsLoading(true);
        try {
            const data = await proactiveEngineService.getPendingTasks(companyId);
            setTasks(data);
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

    if (isLoading) {
        return <div className="h-48 bg-gray-50 animate-pulse rounded-3xl w-full"></div>;
    }

    if (tasks.length === 0) {
        return (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Bandeja Vacía</h3>
                <p className="text-xs text-gray-500 font-medium mt-2">La IA no tiene propuestas pendientes de aprobación.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-500" />
                        Bandeja de Aprobación AI
                        <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">{tasks.length}</span>
                    </h3>
                    <p className="text-xs text-indigo-600/70 font-medium mt-1">Propuestas generadas automáticamente</p>
                </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {tasks.map(task => (
                    <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1">
                                        {task.agent_name === 'maya' ? <Target className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                        Agente {task.agent_name}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        hace 2 min
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 mb-1">{task.title}</h4>
                                <p className="text-xs text-gray-600 font-medium leading-relaxed mb-3">
                                    {task.description}
                                </p>
                                
                                {task.impact_estimate && (
                                    <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-[11px] font-bold inline-block border border-emerald-100">
                                        💡 Impacto: {task.impact_estimate}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
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
