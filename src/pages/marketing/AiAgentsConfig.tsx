import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Save, MessageSquare, Power, Settings2, Sparkles, Send, ArrowLeft } from 'lucide-react';
import { aiAgentService, type AiAgent } from '../../services/marketing/aiAgentService';
import toast from 'react-hot-toast';

export default function AiAgentsConfig() {
    const [agents, setAgents] = useState<AiAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AiAgent | null>(null);
    const [testMessage, setTestMessage] = useState('');
    const [botReply, setBotReply] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAgents();
    }, []);

    const loadAgents = async () => {
        try {
            const data = await aiAgentService.getAgents();
            setAgents(data);
            if (data.length > 0) setSelectedAgent(data[0]);
            else {
                // Create default if none exists
                const newAgent = await aiAgentService.createAgent({
                    name: 'Agente de Ventas Principal',
                    role_description: 'Asistente Experto en CRM',
                    tone: 'professional',
                    is_active: false,
                    active_channels: ['web_chat']
                });
                setAgents([newAgent]);
                setSelectedAgent(newAgent);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error cargando agentes');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedAgent) return;
        try {
            await aiAgentService.updateAgent(selectedAgent.id, selectedAgent);
            toast.success('Configuración del Agente guardada');
        } catch (error) {
            toast.error('Error al guardar');
        }
    };

    const handleTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testMessage || !selectedAgent) return;

        setIsTesting(true);
        setBotReply('');
        try {
            const reply = await aiAgentService.testBotResponse(testMessage, selectedAgent);
            setBotReply(reply);
        } catch (error) {
            toast.error('Error en prueba');
        } finally {
            setIsTesting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Cargando cerebros digitales...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketing" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight flex items-center gap-2">
                        <Bot className="w-8 h-8 text-blue-600" />
                        Configuración de Agentes AI
                    </h1>
                    <p className="text-gray-500">
                        Entrena a tus bots para que respondan como tus mejores vendedores.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="relative z-10 space-y-6">
                            <div className="flex justify-between items-start">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Settings2 className="w-5 h-5" />
                                    Personalidad del Bot
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${selectedAgent?.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                                        {selectedAgent?.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                    <button
                                        onClick={() => setSelectedAgent(prev => prev ? { ...prev, is_active: !prev.is_active } : null)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${selectedAgent?.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${selectedAgent?.is_active ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Agente</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={selectedAgent?.name || ''}
                                        onChange={e => setSelectedAgent(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Rol / Cargo</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={selectedAgent?.role_description || ''}
                                        onChange={e => setSelectedAgent(prev => prev ? { ...prev, role_description: e.target.value } : null)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tono de Comunicación</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['professional', 'friendly', 'aggressive'].map((tone) => (
                                        <button
                                            key={tone}
                                            onClick={() => setSelectedAgent(prev => prev ? { ...prev, tone: tone as any } : null)}
                                            className={`p-3 rounded-xl border font-medium capitalize transition-all ${selectedAgent?.tone === tone
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                                    : 'border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            {tone === 'aggressive' ? 'Persuasivo' : tone === 'friendly' ? 'Amigable' : 'Profesional'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Instrucciones del Sistema (System Prompt)</label>
                                <textarea
                                    className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                                    placeholder="Instruye a tu bot sobre cómo comportarse..."
                                    value={selectedAgent?.system_prompt || ''}
                                    onChange={e => setSelectedAgent(prev => prev ? { ...prev, system_prompt: e.target.value } : null)}
                                ></textarea>
                                <p className="text-xs text-gray-400 mt-1 text-right">Estas instrucciones guiarán todas las respuestas de la IA.</p>
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full py-4 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Guardar Configuración
                            </button>
                        </div>
                    </div>
                </div>

                {/* Testing Panel */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col">
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            Simulador de Chat
                        </h2>

                        <div className="flex-1 bg-gray-50 rounded-2xl p-4 mb-4 overflow-y-auto min-h-[300px] border border-gray-100 space-y-4">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm shadow-sm max-w-[80%]">
                                    <p className="font-bold text-gray-900 mb-1">{selectedAgent?.name}</p>
                                    Hola, soy tu asistente virtual. ¿En qué puedo ayudarte hoy para vender más?
                                </div>
                            </div>

                            {botReply && (
                                <>
                                    <div className="flex gap-3 flex-row-reverse">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-indigo-600">TÚ</span>
                                        </div>
                                        <div className="bg-indigo-600 p-3 rounded-2xl rounded-tr-none text-white text-sm shadow-sm max-w-[80%]">
                                            {testMessage}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm shadow-sm max-w-[80%]">
                                            <p className="font-bold text-gray-900 mb-1">{selectedAgent?.name}</p>
                                            {botReply}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <form onSubmit={handleTest} className="relative">
                            <input
                                type="text"
                                placeholder="Escribe un mensaje de prueba..."
                                className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={testMessage}
                                onChange={e => setTestMessage(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={isTesting || !testMessage}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {isTesting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
