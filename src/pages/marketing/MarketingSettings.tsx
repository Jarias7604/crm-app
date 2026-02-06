import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Server, Shield, Cloud, MessageSquare, Bot, Globe, Smartphone, Send } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { integrationService, type MarketingIntegration } from '../../services/marketing/integrationService';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

type TabType = 'email' | 'whatsapp' | 'chat' | 'telegram';

export default function MarketingSettings() {
    const { profile } = useAuth();
    const location = useLocation();
    const [integrations, setIntegrations] = useState<MarketingIntegration[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('email');
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (location.state?.tab) {
            setActiveTab(location.state.tab);
        }
    }, [location.state]);

    useEffect(() => {
        if (profile?.company_id) {
            loadIntegrations();
        }
    }, [profile?.company_id]);

    const loadIntegrations = async () => {
        try {
            if (!profile?.company_id) return;
            const data = await integrationService.getIntegrations(profile.company_id);
            setIntegrations(data);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando configuraciones');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.company_id) {
            toast.error('Necesitas una empresa activa para configurar esto.');
            return;
        }

        setIsLoading(true);
        try {
            // New Schema: provider + credentials
            // Map internal UI keys to DB providers
            let dbProvider = selectedProvider;
            if (selectedProvider === 'meta') dbProvider = 'whatsapp';
            if (selectedProvider === 'gmmail') dbProvider = 'email'; // Typos or variations

            // Only allow supported backends
            if (dbProvider === 'twilio') {
                toast.error('La integración por Twilio está temporalmente deshabilitada. Use Meta Cloud API.');
                setIsLoading(false);
                return;
            }

            await integrationService.saveIntegration({
                company_id: profile.company_id,
                provider: dbProvider as any,
                name: selectedProvider?.toUpperCase() + ' Integration',
                credentials: formData,
                is_active: true
            });

            // AUTOMATIC CONFIGURATION FOR TELEGRAM
            if (dbProvider === 'telegram' && formData.token) {
                try {
                    toast.loading('Configurando Webhook en Telegram...', { id: 'tg-setup' });
                    const { error } = await supabase.functions.invoke('setup-telegram', {
                        body: {
                            botToken: formData.token,
                            companyId: profile.company_id
                        }
                    });
                    if (error) throw error;
                    toast.success('¡Bot conectado exitosamente con el sistema!', { id: 'tg-setup' });
                } catch (tgError: any) {
                    console.error('Telegram Setup Error:', tgError);
                    toast.error('Credenciales guardadas, pero falló la conexión automática con Telegram.', { id: 'tg-setup' });
                }
            }

            toast.success('¡Conexión guardada con éxito!');
            setSelectedProvider(null);
            loadIntegrations();
        } catch (error: any) {
            console.error(error);
            toast.error('Error al guardar: ' + (error.message || 'Error desconocido'));
        } finally {
            setIsLoading(false);
        }
    };

    const getActiveIntegrationForTab = (tab: TabType) => {
        // Map tab to providers
        const tabProviders: Record<string, string[]> = {
            'chat': ['openai'],
            'telegram': ['telegram'],
            'email': ['gmail', 'outlook', 'resend'],
            'whatsapp': ['twilio', 'meta']
        };

        const allowed = tabProviders[tab] || [];
        return integrations.find(i => allowed.includes(i.provider) && i.is_active);
    };

    const currentActive = getActiveIntegrationForTab(activeTab);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3 relative z-10">
                    <Link to="/marketing" className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-blue-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Configuración Hub</h1>
                        <p className="text-sm text-gray-500">Configura tus canales de comunicación y tokens de API.</p>
                    </div>
                </div>

                {/* Tabs Selector */}
                <div className="flex p-1 bg-gray-100 rounded-2xl relative z-10">
                    <button
                        onClick={() => { setActiveTab('email'); setSelectedProvider(null); }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Mail className="w-3.5 h-3.5" /> Email
                    </button>
                    <button
                        onClick={() => { setActiveTab('whatsapp'); setSelectedProvider(null); }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'whatsapp' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button
                        onClick={() => { setActiveTab('telegram'); setSelectedProvider(null); }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'telegram' ? 'bg-white text-sky-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Send className="w-3.5 h-3.5" /> Telegram
                    </button>
                    <button
                        onClick={() => { setActiveTab('chat'); setSelectedProvider(null); }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Bot className="w-3.5 h-3.5" /> AI Chat
                    </button>
                </div>
            </div>

            {/* Status Content */}
            {!selectedProvider && (
                <>
                    {currentActive ? (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-5 animate-in slide-in-from-top-4 duration-500">
                            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 border border-blue-100">
                                <CheckCircle className="w-7 h-7" />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-0.5">
                                    <h3 className="text-lg font-black text-blue-900 uppercase">{currentActive.provider}</h3>
                                    <span className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-black rounded-full uppercase tracking-tighter">Activo</span>
                                </div>
                                <p className="text-sm text-blue-700 font-medium">Este canal está correctamente configurado y listo para usar.</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedProvider(currentActive.provider);
                                        setFormData(currentActive.credentials);
                                    }}
                                    className="px-5 py-2.5 bg-white text-blue-600 text-sm font-bold rounded-xl hover:shadow-md transition-all border border-blue-200"
                                >
                                    Editar Configuración
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white border border-dashed border-gray-200 rounded-3xl p-10 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                {activeTab === 'email' && <Mail className="w-8 h-8 text-gray-300" />}
                                {activeTab === 'whatsapp' && <MessageSquare className="w-8 h-8 text-gray-300" />}
                                {activeTab === 'telegram' && <Send className="w-8 h-8 text-gray-300" />}
                                {activeTab === 'chat' && <Bot className="w-8 h-8 text-gray-300" />}
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-1">Canal no configurado</h3>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">Selecciona un proveedor abajo para comenzar a enviar mensajes por {activeTab}.</p>
                        </div>
                    )}

                    {/* Provider Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {activeTab === 'email' && (
                            <>
                                <ProviderButton
                                    icon={Mail} color="text-red-600 bg-red-50"
                                    title="Gmail / Workspace" desc="Para uso personal o PyMEs."
                                    onClick={() => setSelectedProvider('gmail')}
                                />
                                <ProviderButton
                                    icon={Server} color="text-gray-900 bg-gray-100"
                                    title="Resend / API" desc="Alto rendimiento y volumen."
                                    onClick={() => setSelectedProvider('resend')}
                                />
                                <ProviderButton
                                    icon={Cloud} color="text-blue-600 bg-blue-50"
                                    title="Outlook / Exchange" desc="Correo corporativo Microsoft."
                                    onClick={() => setSelectedProvider('outlook')}
                                />
                            </>
                        )}
                        {activeTab === 'whatsapp' && (
                            <>
                                <ProviderButton
                                    icon={Smartphone} color="text-green-600 bg-green-50"
                                    title="Twilio Messaging" desc="Robusto y escalable."
                                    onClick={() => setSelectedProvider('twilio')}
                                />
                                <ProviderButton
                                    icon={Globe} color="text-blue-600 bg-blue-50"
                                    title="Meta Cloud API" desc="Integración oficial directa."
                                    onClick={() => setSelectedProvider('meta')}
                                />
                            </>
                        )}
                        {activeTab === 'telegram' && (
                            <>
                                <ProviderButton
                                    icon={Send} color="text-sky-500 bg-sky-50"
                                    title="Telegram Bot API" desc="Mensajería rápida y gratuita."
                                    onClick={() => setSelectedProvider('telegram')}
                                />
                            </>
                        )}
                        {activeTab === 'chat' && (
                            <>
                                <ProviderButton
                                    icon={Bot} color="text-indigo-600 bg-indigo-50"
                                    title="OpenAI (GPT-4)" desc="El cerebro detrás de tus agentes."
                                    onClick={() => setSelectedProvider('openai')}
                                />
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Provider Forms */}
            {selectedProvider && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
                        <button onClick={() => setSelectedProvider(null)} className="text-sm font-bold text-gray-400 hover:text-gray-900 mb-8 flex items-center gap-2 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Volver a proveedores
                        </button>

                        <h2 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-3 capitalize">
                            Configurar {selectedProvider}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-6">
                            {(selectedProvider === 'gmail' || selectedProvider === 'outlook') && (
                                <>
                                    <InputBlock label="Correo Electrónico" type="email" value={formData.email} onChange={(v: string) => setFormData({ ...formData, email: v })} placeholder="ejemplo@email.com" />
                                    <InputBlock label="App Password" type="password" value={formData.apiKey} onChange={(v: string) => setFormData({ ...formData, apiKey: v })} placeholder="xxxx xxxx xxxx xxxx" hint="Usa una contraseña de aplicación generada." />
                                </>
                            )}

                            {selectedProvider === 'resend' && (
                                <>
                                    <InputBlock
                                        label="API Key"
                                        type="password"
                                        value={formData.apiKey}
                                        onChange={(v: string) => setFormData({ ...formData, apiKey: v })}
                                        placeholder="re_123456789..."
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 mt-4">
                                        <InputBlock
                                            label="Nombre del Remitente"
                                            type="text"
                                            value={formData.senderName}
                                            onChange={(v: string) => setFormData({ ...formData, senderName: v })}
                                            placeholder="Ej: Ventas Arias Defense"
                                            hint="El nombre que verán los clientes."
                                        />
                                        <InputBlock
                                            label="Email del Remitente"
                                            type="email"
                                            value={formData.senderEmail}
                                            onChange={(v: string) => setFormData({ ...formData, senderEmail: v })}
                                            placeholder="Ej: ventas@ariasdefense.com"
                                            hint="Debe estar verificado en Resend."
                                        />
                                    </div>
                                </>
                            )}

                            {selectedProvider === 'twilio' && (
                                <>
                                    <InputBlock label="Account SID" type="text" value={formData.accountSid} onChange={(v: string) => setFormData({ ...formData, accountSid: v })} placeholder="AC..." />
                                    <InputBlock label="Auth Token" type="password" value={formData.token} onChange={(v: string) => setFormData({ ...formData, token: v })} placeholder="Token..." />
                                </>
                            )}

                            {selectedProvider === 'meta' && (
                                <>
                                    <InputBlock label="Access Token" type="password" value={formData.token} onChange={(v: string) => setFormData({ ...formData, token: v })} placeholder="EAAB..." />
                                    <InputBlock label="Phone Number ID" type="text" value={formData.phoneNumberId} onChange={(v: string) => setFormData({ ...formData, phoneNumberId: v })} placeholder="12345..." />
                                </>
                            )}

                            {selectedProvider === 'telegram' && (
                                <InputBlock label="Bot Token" type="password" value={formData.token} onChange={(v: string) => setFormData({ ...formData, token: v })} placeholder="123456789:ABCDEF..." hint="Obtenlo hablando con @BotFather en Telegram." />
                            )}

                            {selectedProvider === 'openai' && (
                                <InputBlock label="OpenAI API Key" type="password" value={formData.apiKey} onChange={(v: string) => setFormData({ ...formData, apiKey: v })} placeholder="sk-..." />
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-[#0f172a] hover:bg-black text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Shield className="w-5 h-5" />}
                                Guardar y Activar
                            </button>
                        </form>
                    </div>

                    {/* Guide */}
                    <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                        <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
                            <Globe className="w-6 h-6 text-blue-500" />
                            ¿Dónde consigo esto?
                        </h3>
                        <div className="space-y-6 text-gray-600 font-medium">
                            {selectedProvider === 'twilio' ? (
                                <ul className="space-y-4 list-disc list-inside">
                                    <li>Crea una cuenta en <b>Twilio.com</b>.</li>
                                    <li>Encuentra tu <b>Account SID</b> en el Console Dashboard.</li>
                                    <li>Copia el <b>Auth Token</b> (haz clic en 'Show').</li>
                                </ul>
                            ) : selectedProvider === 'meta' ? (
                                <ul className="space-y-4 list-disc list-inside">
                                    <li>Ve a <b>developers.facebook.com</b>.</li>
                                    <li>Configura la app de WhatsApp.</li>
                                    <li>Genera un <b>Permanent Token</b> en los ajustes.</li>
                                </ul>
                            ) : selectedProvider === 'telegram' ? (
                                <ul className="space-y-4 list-disc list-inside">
                                    <li>Busca a <b>@BotFather</b> en Telegram.</li>
                                    <li>Envía el comando <code>/newbot</code>.</li>
                                    <li>Sigue los pasos y copia el <b>API Token</b>.</li>
                                    <li>Asegúrate de que el bot no esté en modo privado si quieres recibir mensajes.</li>
                                </ul>
                            ) : selectedProvider === 'openai' ? (
                                <ul className="space-y-4 list-disc list-inside">
                                    <li>Inicia sesión en <b>platform.openai.com</b>.</li>
                                    <li>Ve a la sección <b>API Keys</b>.</li>
                                    <li>Crea una nueva "Secret Key".</li>
                                </ul>
                            ) : (
                                <p>Sigue las instrucciones oficiales del proveedor para generar credenciales de acceso seguro API.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProviderButton({ icon: Icon, color, title, desc, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left group hover:scale-[1.02]"
        >
            <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <Icon className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight">{title}</h3>
            <p className="text-gray-500 mt-1 text-xs leading-relaxed font-medium">
                {desc}
            </p>
        </button>
    );
}

function InputBlock({ label, type, value, onChange, placeholder, hint }: any) {
    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
            <input
                type={type}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                placeholder={placeholder}
                required
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            />
            {hint && <p className="text-xs text-gray-400 mt-2 font-medium">{hint}</p>}
        </div>
    );
}
