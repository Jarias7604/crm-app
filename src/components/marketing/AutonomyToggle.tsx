import React, { useState, useEffect } from 'react';
import { UserCheck, Zap, Bot, ShieldAlert, Eye } from 'lucide-react';
import { proactiveEngineService, type AutonomyLevel } from '../../services/marketing/proactiveEngine';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

interface Props {
    companyId: string;
}

export default function AutonomyToggle({ companyId }: Props) {
    const [level, setLevel] = useState<AutonomyLevel>('copilot');
    const [isLoading, setIsLoading] = useState(true);
    const { simulatedCompanyId, simulatedRole } = useAuth();
    // Block writes if ANY simulation is active (role OR company)
    const isSimulating = !!simulatedCompanyId || !!simulatedRole;

    useEffect(() => {
        if (companyId) {
            proactiveEngineService.getAutonomyLevel(companyId).then(l => {
                setLevel(l);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, [companyId]);

    const handleSelect = async (newLevel: AutonomyLevel) => {
        // Guard: cannot save in simulation mode — JWT is real user, company_id is simulated
        if (isSimulating) {
            toast.error('Sal del modo Simulación para cambiar esta configuración.', { icon: '🔒' });
            return;
        }
        setIsLoading(true);
        try {
            await proactiveEngineService.setAutonomyLevel(companyId, newLevel);
            setLevel(newLevel);
            toast.success(`Modo de Autonomía actualizado a ${newLevel.toUpperCase()}`);
        } catch (error: any) {
            console.error('Autonomy setting error:', error);
            toast.error(error.message || 'Error al guardar configuración');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="h-24 bg-gray-50 animate-pulse rounded-2xl w-full"></div>;
    }

    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-500" />
                        Control de Autonomía IA
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Configura qué tanta libertad tiene el motor autónomo.</p>
                </div>
            </div>

            {isSimulating && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <p className="text-[11px] font-bold text-amber-700">Modo solo lectura — Sal de Simulación para editar</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <button
                    onClick={() => handleSelect('copilot')}
                    className={`relative p-4 rounded-2xl text-left transition-all border-2 flex items-start gap-4 ${
                        level === 'copilot' 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-600/10' 
                        : 'border-gray-100 bg-white hover:border-indigo-200'
                    }`}
                >
                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${level === 'copilot' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' : 'bg-gray-100 text-gray-400'}`}>
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className={`text-sm font-bold ${level === 'copilot' ? 'text-indigo-900' : 'text-gray-700'}`}>1. Copiloto</h4>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
                            La IA analiza y propone acciones. Tú apruebas manualmente cada una.
                        </p>
                    </div>
                </button>

                <button
                    onClick={() => handleSelect('semi')}
                    className={`relative p-4 rounded-2xl text-left transition-all border-2 flex items-start gap-4 ${
                        level === 'semi' 
                        ? 'border-fuchsia-500 bg-fuchsia-50/50 shadow-md shadow-fuchsia-500/10' 
                        : 'border-gray-100 bg-white hover:border-fuchsia-200'
                    }`}
                >
                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${level === 'semi' ? 'bg-fuchsia-500 text-white shadow-sm shadow-fuchsia-500/30' : 'bg-gray-100 text-gray-400'}`}>
                        <Zap className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className={`text-sm font-bold ${level === 'semi' ? 'text-fuchsia-900' : 'text-gray-700'}`}>2. Semi-Autónomo</h4>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
                            La IA ejecuta tareas de bajo riesgo sola. Propone campañas complejas.
                        </p>
                    </div>
                </button>

                <button
                    onClick={() => handleSelect('autopilot')}
                    className={`relative p-4 rounded-2xl text-left transition-all border-2 overflow-hidden flex items-start gap-4 ${
                        level === 'autopilot' 
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-500/10' 
                        : 'border-gray-100 bg-white hover:border-emerald-200'
                    }`}
                >
                    {level === 'autopilot' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-transparent pointer-events-none"></div>
                    )}
                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${level === 'autopilot' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30' : 'bg-gray-100 text-gray-400'}`}>
                        <Bot className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className={`text-sm font-bold ${level === 'autopilot' ? 'text-emerald-900' : 'text-gray-700'}`}>3. Full Autopilot</h4>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
                            Nivel Dios. El CRM trabaja 24/7 solo enviando campañas. Tú solo revisas reportes.
                        </p>
                    </div>
                </button>
            </div>
        </div>
    );
}
