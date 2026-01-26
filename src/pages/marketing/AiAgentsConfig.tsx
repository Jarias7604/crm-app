
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Save, Settings2, Sparkles, ArrowLeft, Send, UserPlus, RefreshCw } from 'lucide-react';
import { aiAgentService, type AiAgent } from '../../services/marketing/aiAgentService';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

export default function AiAgentsConfig() {
    const [selectedAgent, setSelectedAgent] = useState<AiAgent | null>(null);
    const [testMessage, setTestMessage] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { profile } = useAuth();
    const [testHistory, setTestHistory] = useState<{ role: 'user' | 'bot', content: string }[]>([]);

    useEffect(() => {
        if (profile?.company_id) {
            loadAgents();
        }
    }, [profile?.company_id]);

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
                    system_prompt: 'Eres un consultor experto. Tu objetivo es ayudar al cliente a elegir el mejor plan de facturación electrónica.'
                });
                setSelectedAgent(newAgent);
            }
        } catch (error: any) {
            console.error('Error loading agents:', error);
            const errorMsg = error?.message || 'Error desconocido';
            toast.error(`Error de base de datos: ${errorMsg}. Usando valores temporales.`);

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

    const handleSimulateClient = () => {
        const phrases = [
            "Hola, ¿cuánto cuesta el plan básico?",
            "Tengo una empresa y emito como 500 facturas al mes, ¿qué me recomiendan?",
            "¿Tienen módulo de inventario?",
            "Quiero una cotización para 1000 DTEs por favor.",
            "Me interesa el POS, ¿cómo funciona?"
        ];
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        setTestHistory(prev => [...prev, { role: 'user', content: randomPhrase }]);
    };

    const handleAiResponse = async () => {
        if (!selectedAgent) return;
        const lastUserMsg = [...testHistory].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) {
            toast.error('Primero simula o escribe un mensaje del cliente');
            return;
        }

        setIsTesting(true);
        try {
            const reply = await aiAgentService.testBotResponse(lastUserMsg.content, selectedAgent);
            setTestHistory(prev => [...prev, { role: 'bot', content: reply }]);
        } catch (error) {
            toast.error('Error en respuesta de IA');
        } finally {
            setIsTesting(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Iniciando Cerebro Digital...</p>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-64px)] flex-col bg-white rounded-[3.5rem] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 relative animate-in fade-in duration-500">
            {/* Capa decorativa premium */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4449AA 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* Header Section - Fixed height */}
            <div className="flex items-center gap-4 shrink-0 px-6 pt-6 md:px-8 md:pt-8 relative z-10">
                <Link to="/marketing" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-[#0f172a] tracking-tight flex items-center gap-2">
                        <Bot className="w-7 h-7 text-blue-600" />
                        Configuración de Agentes AI
                    </h1>
                    <p className="text-xs text-gray-500 font-medium">
                        Entrena a tus bots para que respondan como tus mejores vendedores.
                    </p>
                </div>
            </div>

            {/* Main Content Area - Expands to fill remaining height */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 relative z-10 px-6 pb-6 md:px-8 md:pb-8">

                {/* 1. PERSONALITY COLUMN */}
                <div className="lg:col-span-2 flex flex-col bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl shadow-slate-200/50 min-h-0 overflow-hidden">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-blue-500" />
                            Personalidad del Bot
                        </h2>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                            <span className={`text-[9px] font-black tracking-widest ${selectedAgent?.is_active ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {selectedAgent?.is_active ? 'SISTEMA ACTIVO' : 'SISTEMA INACTIVO'}
                            </span>
                            <button
                                onClick={() => handleInputChange('is_active', !selectedAgent?.is_active)}
                                className={`w-10 h-5 rounded-full transition-all relative shadow-inner ${selectedAgent?.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all shadow-md ${selectedAgent?.is_active ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar pb-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre</label>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-slate-700 text-sm transition-all focus:bg-white shadow-inner"
                                    value={selectedAgent?.name || ''}
                                    onChange={e => handleInputChange('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rol / Cargo</label>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-slate-700 text-sm transition-all focus:bg-white shadow-inner"
                                    value={selectedAgent?.role_description || ''}
                                    onChange={e => handleInputChange('role_description', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tono</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['professional', 'friendly', 'aggressive'].map((tone) => (
                                    <button
                                        key={tone}
                                        onClick={() => handleInputChange('tone', tone)}
                                        className={`py-3 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all ${selectedAgent?.tone === tone
                                            ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-lg shadow-blue-500/10'
                                            : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {tone === 'aggressive' ? 'Persuasivo' : tone === 'friendly' ? 'Amigable' : 'Profesional'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Instrucciones del Sistema</label>
                            <textarea
                                className="w-full h-32 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-xs font-medium text-slate-600 focus:bg-white shadow-inner transition-all"
                                placeholder="Escribe aquí el cerebro de tu bot..."
                                value={selectedAgent?.system_prompt || ''}
                                onChange={e => handleInputChange('system_prompt', e.target.value)}
                            ></textarea>
                            <p className="text-[9px] text-slate-400 font-bold text-right pt-1 opacity-70 italic">Instrucciones fundamentales para la IA.</p>
                        </div>
                    </div>

                    {/* Fixed Save Button Section */}
                    <div className="pt-4 mt-auto border-t border-slate-50 shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl shadow-xl shadow-slate-900/10 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                            ) : (
                                <Save className="w-4 h-4 text-blue-400" />
                            )}
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>

                {/* 2. SIMULATOR COLUMN */}
                <div className="flex flex-col bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl shadow-slate-200/50 min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            Simulator
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={handleSimulateClient} className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition-all border border-orange-100"><UserPlus className="w-4 h-4" /></button>
                            <button onClick={() => setTestHistory([])} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-lg transition-all border border-slate-100"><RefreshCw className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Chat Area - Flexible height with scroll */}
                    <div className="flex-1 bg-slate-50/50 rounded-[24px] p-4 overflow-y-auto space-y-4 shadow-inner border border-slate-100/50 custom-scrollbar mb-4">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 shadow-sm"><Bot className="w-5 h-5 text-blue-600" /></div>
                            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 text-xs font-medium text-slate-700 shadow-sm max-w-[85%] leading-relaxed">
                                <p className="font-black text-[9px] text-blue-600 uppercase tracking-widest mb-1">{selectedAgent?.name}</p>
                                Hola, soy {selectedAgent?.name || 'tu asistente virtual'}. ¿En qué puedo ayudarte hoy?
                            </div>
                        </div>

                        {testHistory.map((msg, i) => (
                            <div key={i} className={`flex gap-3 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100' : 'bg-blue-100'}`}>
                                    {msg.role === 'user' ? <span className="text-[9px] font-black text-indigo-600 uppercase">Tú</span> : <Bot className="w-5 h-5 text-blue-600" />}
                                </div>
                                <div className={`p-3 rounded-2xl text-[12px] font-medium leading-relaxed shadow-sm max-w-[85%] ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none shadow-slate-900/10' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                                    {msg.role === 'bot' && <p className="font-black text-[9px] text-blue-600 uppercase tracking-widest mb-1">{selectedAgent?.name}</p>}
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Input Area - Shrink-wrapped to bottom */}
                    <form onSubmit={handleTest} className="relative shrink-0">
                        <input
                            type="text"
                            placeholder="Mensaje de prueba..."
                            className="w-full pl-4 pr-20 py-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-slate-700 text-sm transition-all focus:bg-white shadow-inner"
                            value={testMessage}
                            onChange={e => setTestMessage(e.target.value)}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <button type="button" onClick={handleAiResponse} disabled={isTesting} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Sparkles className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} /></button>
                            <button type="submit" disabled={isTesting || !testMessage} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all shadow-md"><Send className="w-4 h-4" /></button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
