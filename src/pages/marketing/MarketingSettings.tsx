
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Server, Shield, Cloud, CreditCard } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { integrationService, type EmailIntegration } from '../../services/marketing/integrationService';
import toast from 'react-hot-toast';

export default function MarketingSettings() {
    const { profile } = useAuth();
    const [integrations, setIntegrations] = useState<EmailIntegration[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});

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

        try {
            await integrationService.saveIntegration({
                company_id: profile.company_id,
                provider: selectedProvider as any,
                name: selectedProvider === 'resend' ? 'Resend Pro' : 'Gmail Personal',
                settings: formData,
                is_active: true
            });

            toast.success('¡Conexión guardada con éxito!');
            setSelectedProvider(null);
            loadIntegrations();
        } catch (error) {
            toast.error('Error al guardar conexión');
        }
    };

    const activeIntegration = integrations.find(i => i.is_active);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link to="/marketing" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Configuración de Envíos</h1>
                    <p className="text-gray-500">Conecta tu proveedor de correo para enviar campañas reales.</p>
                </div>
            </div>

            {/* Active Integration Status */}
            {activeIntegration && !selectedProvider && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-green-900">Conectado exitosamente con {activeIntegration.provider.toUpperCase()}</h3>
                        <p className="text-green-700 text-sm">Tu sistema está listo para enviar correos.</p>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedProvider(activeIntegration.provider);
                            setFormData(activeIntegration.settings);
                        }}
                        className="ml-auto text-green-700 font-bold hover:underline"
                    >
                        Configurar
                    </button>
                </div>
            )}

            {!selectedProvider ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Gmail Card */}
                    <button
                        onClick={() => setSelectedProvider('gmail')}
                        className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all text-left group hover:border-red-100 relative overflow-hidden"
                    >
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 text-red-600 group-hover:scale-110 transition-transform">
                            <Mail className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Gmail / Google Workspace</h3>
                        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                            Ideal para pequeños negocios. Conecta tu cuenta de Gmail directamente.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-red-600 uppercase tracking-wider">
                            <Shield className="w-4 h-4" /> Recomendado PyMEs
                        </div>
                    </button>

                    {/* Resend Card */}
                    <button
                        onClick={() => setSelectedProvider('resend')}
                        className="bg-[#000] p-8 rounded-3xl border border-gray-900 shadow-sm hover:shadow-lg transition-all text-left group relative overflow-hidden text-white"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Cloud className="w-32 h-32 rotate-12" />
                        </div>
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                            <Server className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Resend / SendGrid</h3>
                        <p className="text-gray-400 mt-2 text-sm leading-relaxed">
                            Para alto volumen y campañas profesionales. Requiere API Key.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider bg-white/20 w-fit px-2 py-1 rounded">
                            <CreditCard className="w-4 h-4" /> Uso Profesional
                        </div>
                    </button>

                    {/* Outlook Card */}
                    <button
                        onClick={() => setSelectedProvider('outlook')}
                        className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all text-left group hover:border-blue-100"
                    >
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                            <Mail className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Outlook / Exchange</h3>
                        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                            Conecta tu correo corporativo de Microsoft.
                        </p>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Setup Form */}
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg">
                        <button onClick={() => setSelectedProvider(null)} className="text-sm font-bold text-gray-400 hover:text-gray-900 mb-6 flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> Elegir otro proveedor
                        </button>

                        <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                            Configurar {selectedProvider === 'gmail' ? 'Gmail' : selectedProvider === 'resend' ? 'Resend' : 'Outlook'}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-6">
                            {selectedProvider !== 'resend' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Tu Correo Electrónico</label>
                                        <input
                                            type="email"
                                            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="ejemplo@gmail.com"
                                            required
                                            value={formData.email || ''}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña de Aplicación (App Password)</label>
                                        <input
                                            type="password"
                                            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="xxxx xxxx xxxx xxxx"
                                            required
                                            value={formData.apiKey || ''}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            No uses tu contraseña normal. Mira la guía a la derecha 👉
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">API Key</label>
                                    <input
                                        type="password"
                                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="re_123456789..."
                                        required
                                        value={formData.apiKey || ''}
                                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all"
                            >
                                Guardar y Probar Conexión
                            </button>
                        </form>
                    </div>

                    {/* Step-by-Step Guide */}
                    <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                        <h3 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            Guía de Conexión Segura
                        </h3>

                        <div className="space-y-6">
                            {selectedProvider === 'gmail' && (
                                <ol className="list-decimal list-inside space-y-4 text-blue-800 font-medium">
                                    <li>Ve a tu cuenta de Google : <a href="https://myaccount.google.com/security" target="_blank" className="underline">Seguridad</a>.</li>
                                    <li>Activa la <strong>Verificación en 2 pasos</strong> si no la tienes.</li>
                                    <li>Busca la opción <strong>"Contraseñas de aplicaciones"</strong>.</li>
                                    <li>Crea una nueva llamada "CRM".</li>
                                    <li>Copia el código de 16 letras que te dan.</li>
                                    <li>Pégalo en el campo de la izquierda.</li>
                                </ol>
                            )}
                            {selectedProvider === 'resend' && (
                                <ol className="list-decimal list-inside space-y-4 text-blue-800 font-medium">
                                    <li>Crea una cuenta en <a href="https://resend.com" target="_blank" className="underline">Resend.com</a>.</li>
                                    <li>Verifica tu dominio.</li>
                                    <li>Ve a <strong>API Keys</strong> y crea una nueva.</li>
                                    <li>Copia la clave que empieza con <code>re_</code>.</li>
                                    <li>Pégala aquí.</li>
                                </ol>
                            )}
                            {selectedProvider === 'outlook' && (
                                <div className="p-4 bg-white/50 rounded-xl">
                                    Similar a Gmail, necesitas habilitar el acceso SMTP en tu configuración de Office 365.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
