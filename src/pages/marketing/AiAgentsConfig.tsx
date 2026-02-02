import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Save, Settings2, Sparkles, ArrowLeft, Send, UserPlus, RefreshCw, Maximize2, X, Camera } from 'lucide-react';
import { aiAgentService, type AiAgent } from '../../services/marketing/aiAgentService';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

export default function AiAgentsConfig() {
    const [selectedAgent, setSelectedAgent] = useState<AiAgent | null>(null);
    const [testMessage, setTestMessage] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRepMenuOpen, setIsRepMenuOpen] = useState(false);
    const { profile } = useAuth();
    const [testHistory, setTestHistory] = useState<{ role: 'user' | 'bot', content: string }[]>([]);
    const [profilesList, setProfilesList] = useState<any[]>([]);

    useEffect(() => {
        if (profile?.company_id) {
            loadAgents();
            loadProfiles();
        }
    }, [profile?.company_id]);

    const loadProfiles = async () => {
        try {
            const { data, error } = await aiAgentService.getCompanyProfiles(profile!.company_id);
            if (error) throw error;
            setProfilesList(data || []);
        } catch (error) {
            console.error('Error loading profiles:', error);
        }
    };

    const loadAgents = async () => {
        try {
            setLoading(true);
            const data = await aiAgentService.getAgents(profile!.company_id);

            if (data && data.length > 0) {
                const agent = data[0];
                setSelectedAgent({
                    ...agent,
                    name: agent.name || 'Asistente IA',
                    role_description: agent.role_description || 'Consultor experto',
                    system_prompt: agent.system_prompt || '',
                    tone: agent.tone || 'professional'
                });
            } else {
                const newAgent = await aiAgentService.createAgent({
                    company_id: profile!.company_id,
                    name: 'Asistente IA',
                    role_description: 'Consultor experto en facturación electrónica',
                    tone: 'professional',
                    language: 'es',
                    is_active: true,
                    active_channels: ['telegram', 'whatsapp', 'web'],
                    system_prompt: 'Eres un consultor experto. Tu objetivo es calificar al lead. DEBES recopilar: 1. Nombre 2. Teléfono 3. Email 4. ¿Recibió notificación de Hacienda? 5. Volumen de facturas.'
                });
                setSelectedAgent(newAgent);
            }
        } catch (error: any) {
            console.error('Error loading agents:', error);
            const errorMsg = error?.message || 'Error desconocido';
            if (errorMsg.includes('marketing_ai_agents')) {
                toast.error('⚠️ La tabla de Agentes AI no está configurada.');
            } else {
                toast.error(`Error: ${errorMsg}`);
            }
            setSelectedAgent({
                id: 'temp',
                company_id: profile!.company_id,
                name: 'Asistente IA',
                role_description: 'Consultor Experto',
                tone: 'professional',
                language: 'es',
                is_active: false,
                active_channels: [],
                system_prompt: ''
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedAgent || selectedAgent.id === 'temp') return;
        try {
            setIsSaving(true);
            await aiAgentService.updateAgent(selectedAgent.id, selectedAgent);
            toast.success('Configuración guardada correctamente');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Error al guardar los cambios');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field: keyof AiAgent, value: any) => {
        if (!selectedAgent) return;
        setSelectedAgent({
            ...selectedAgent,
            [field]: value
        });
    };

    const handleTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testMessage.trim() || !selectedAgent) return;
        const userMsg = testMessage;
        setTestMessage('');
        setTestHistory(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsTesting(true);
        try {
            const reply = await aiAgentService.testBotResponse(userMsg, selectedAgent);
            setTestHistory(prev => [...prev, { role: 'bot', content: reply }]);
        } catch (error) {
            toast.error('Error en prueba de IA');
        } finally {
            setIsTesting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando cerebro...</div>;

    const currentRep = profilesList.find(p => p.id === selectedAgent?.representative_id);

    return (
        <div className="flex h-[calc(100vh-64px)] flex-col bg-white rounded-[3.5rem] shadow-2xl border border-white/60 overflow-hidden relative font-sans">
            <div className="flex items-center gap-4 p-8 relative z-10">
                <Link to="/marketing" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"><ArrowLeft className="w-5 h-5" /></Link>
                <div>
                    <h1 className="text-2xl font-black text-[#0f172a] flex items-center gap-2"><Bot className="w-7 h-7 text-blue-600" />Configuración Agente AI</h1>
                    <p className="text-xs text-gray-500 font-medium">Entrena a tu bot de ventas.</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 px-8 pb-8 overflow-hidden">
                <div className="lg:col-span-2 flex flex-col bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-6 relative z-30">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Settings2 className="w-5 h-5 text-blue-500" />Personalidad</h2>

                            {/* Representative Selector Compact - Enhanced with Big Avatar */}
                            <div className="relative group/rep">
                                <button
                                    onClick={() => setIsRepMenuOpen(!isRepMenuOpen)}
                                    className="flex items-center gap-2 px-1.5 py-1 pr-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-full transition-all group shadow-sm active:scale-95"
                                    title="Configurar Representante"
                                >
                                    {currentRep?.avatar_url ? (
                                        <div className="relative">
                                            <img src={currentRep.avatar_url} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-md group-hover:border-blue-200 transition-colors" />
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-md"><UserPlus className="w-4 h-4 text-blue-600" /></div>
                                    )}
                                    <div className="flex flex-col items-start -space-y-0.5">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Asesor Humano</span>
                                        <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate max-w-[120px]">
                                            {currentRep?.full_name || 'Asignar Compañero'}
                                        </span>
                                    </div>
                                </button>

                                {isRepMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-20" onClick={() => setIsRepMenuOpen(false)}></div>
                                        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 z-40 py-3 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-5 py-2 border-b border-slate-50 mb-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Sparkles className="w-3 h-3 text-amber-500" /> ¿Quién enviará las propuestas?
                                                </p>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto custom-scrollbar px-2">
                                                <button
                                                    onClick={() => { handleInputChange('representative_id', null); setIsRepMenuOpen(false); }}
                                                    className={`w-full px-4 py-3 rounded-2xl text-left text-[11px] font-bold transition-all flex items-center gap-4 ${!selectedAgent?.representative_id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0"><X className="w-4 h-4" /></div>
                                                    Sin Representante
                                                </button>
                                                {profilesList.map(p => (
                                                    <div key={p.id} className="relative group/user mb-1">
                                                        <button
                                                            onClick={() => { handleInputChange('representative_id', p.id); setIsRepMenuOpen(false); }}
                                                            className={`w-full px-4 py-3 rounded-2xl text-left text-[11px] font-bold transition-all flex items-center gap-4 ${selectedAgent?.representative_id === p.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                                        >
                                                            <div className="relative shrink-0">
                                                                {p.avatar_url ? (
                                                                    <img src={p.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md group-hover/user:scale-110 transition-transform" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-xs text-indigo-600 border-2 border-white shadow-sm">
                                                                        {p.full_name?.charAt(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="truncate text-sm">{p.full_name}</span>
                                                                <span className="text-[9px] font-medium text-slate-400 truncate opacity-80">{p.email}</span>
                                                            </div>
                                                        </button>

                                                        <Link
                                                            to="/configuracion/equipo"
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white border border-slate-100 rounded-xl opacity-0 group-hover/user:opacity-100 transition-all hover:bg-blue-50 hover:text-blue-600 shadow-sm"
                                                            title="Editar perfil y foto"
                                                        >
                                                            <Camera className="w-4 h-4" />
                                                        </Link>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="px-4 pt-2 mt-2 border-t border-slate-50">
                                                <Link to="/configuracion/equipo" className="flex items-center justify-center gap-2 py-2 text-[10px] font-black text-blue-500 hover:bg-blue-50 rounded-xl transition-all uppercase tracking-widest">
                                                    <UserPlus className="w-3.5 h-3.5" /> Administrar Equipo
                                                </Link>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <button onClick={() => handleInputChange('is_active', !selectedAgent?.is_active)} className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all ${selectedAgent?.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {selectedAgent?.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-slate-700 text-sm transition-all focus:bg-white shadow-inner" value={selectedAgent?.name || ''} onChange={e => handleInputChange('name', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cargo / Rol</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-slate-700 text-sm transition-all focus:bg-white shadow-inner" value={selectedAgent?.role_description || ''} onChange={e => handleInputChange('role_description', e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tono de Voz</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['professional', 'friendly', 'aggressive'].map(tone => (
                                    <button key={tone} onClick={() => handleInputChange('tone', tone)}
                                        className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${selectedAgent?.tone === tone ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md shadow-blue-500/10' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-100'}`}>
                                        {tone === 'aggressive' ? 'Persuasivo' : tone === 'friendly' ? 'Amigable' : 'Profesional'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center pl-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cerebro / Instrucciones</label>
                                <button onClick={() => setIsExpanded(true)} className="p-1.5 text-blue-500 hover:bg-slate-100 rounded-lg transition-colors group">
                                    <Maximize2 className="w-4 h-4 group-active:scale-90 transition-transform" />
                                </button>
                            </div>
                            <textarea className="w-full h-40 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-xs font-medium text-slate-600 focus:bg-white shadow-inner transition-all leading-relaxed" value={selectedAgent?.system_prompt || ''} onChange={e => handleInputChange('system_prompt', e.target.value)} placeholder="Instrucciones para la IA..." />
                            <p className="text-[9px] text-slate-400 font-bold pl-1 italic">Este cerebro tiene más espacio ahora para facilitar la lectura.</p>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-50">
                        <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50">
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-blue-400" /> : <Save className="w-4 h-4 text-blue-400" />}
                            {isSaving ? 'Guardando...' : 'Guardar Cambios Maestros'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl overflow-hidden">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-amber-500" />Simulador</h2>
                    <div className="flex-1 bg-slate-50 rounded-[2rem] p-4 overflow-y-auto space-y-4 mb-4 shadow-inner border border-slate-100/50 custom-scrollbar">
                        <div className="flex gap-2">
                            <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 shadow-sm"><Bot className="w-45 h-4 text-blue-600" /></div>
                            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 text-[11px] font-medium text-slate-600 shadow-sm max-w-[85%] leading-relaxed">
                                <p className="font-black text-[9px] text-blue-500 uppercase tracking-widest mb-1">{selectedAgent?.name}</p>
                                ¡Hola! Soy {selectedAgent?.name || 'tu asistente virtual'}. ¿Cuántas facturas emites al mes para darte un plan?
                            </div>
                        </div>
                        {testHistory.map((msg, i) => (
                            <div key={i} className={`flex gap-3 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-blue-100'}`}>
                                    {msg.role === 'user' ? <span className="text-[10px] font-black">TÚ</span> : <Bot className="w-5 h-5 text-blue-600" />}
                                </div>
                                <div className={`p-3 rounded-2xl text-[12px] font-medium leading-relaxed shadow-sm max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/10' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                                    {msg.role === 'bot' && <p className="font-black text-[9px] text-blue-600 uppercase tracking-widest mb-1">{selectedAgent?.name}</p>}
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleTest} className="relative">
                        <input type="text" placeholder="Escribe al bot..." className="w-full pl-4 pr-14 py-4 bg-slate-50 border-none rounded-xl font-bold text-sm shadow-inner outline-none focus:bg-white transition-all" value={testMessage} onChange={e => setTestMessage(e.target.value)} />
                        <button type="submit" disabled={!testMessage.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900 text-white rounded-lg hover:bg-blue-600 shadow-md transition-all active:scale-90 disabled:opacity-30"><Send className="w-4 h-4" /></button>
                    </form>
                </div>
            </div>

            {isExpanded && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-xl flex items-center gap-2 text-slate-800"><Bot className="w-7 h-7 text-blue-600" />Cerebro Digital: Instrucciones Maestras</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Define el comportamiento y conocimiento de tu agente</p>
                            </div>
                            <button onClick={() => setIsExpanded(false)} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all active:scale-95"><X className="w-7 h-7" /></button>
                        </div>
                        <textarea className="flex-1 p-10 text-base font-semibold text-slate-700 leading-relaxed resize-none outline-none custom-scrollbar" value={selectedAgent?.system_prompt || ''} onChange={e => handleInputChange('system_prompt', e.target.value)} autoFocus placeholder="Escribe aquí las reglas de negocio, tono y objetivos del bot..." />
                        <div className="p-6 border-t flex justify-between items-center bg-white shadow-inner">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Sincronización automátia activa</span>
                            <button onClick={() => setIsExpanded(false)} className="px-10 py-4 bg-slate-900 hover:bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95">Listo, aplicar Instrucciones</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
