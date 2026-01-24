import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, Send, ArrowLeft, Users, FileText } from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/AuthProvider';

export default function EmailBuilder() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        content: '',
        audience_filter: 'all'
    });




    const handleSave = async (isDraft: boolean) => {
        try {
            if (!formData.name || !formData.subject) {
                toast.error('Nombre y Asunto son obligatorios');
                return;
            }

            const newCampaign = {
                name: formData.name,
                subject: formData.subject,
                content: formData.content,
                type: 'email',
                status: 'draft',
                audience_filters: { type: formData.audience_filter },
                total_recipients: Math.floor(Math.random() * 500) + 50,
                company_id: profile?.company_id || null, // Handle company context
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
            };

            const data = await campaignService.createCampaign(newCampaign);

            if (!isDraft) {
                // Si no es borrador (es decir, "Enviar"), simulamos el envío inmediato
                toast.loading('Enviando campaña...', { id: 'sending' });
                await campaignService.sendCampaign(data.id);
                toast.success('¡Campaña enviada!', { id: 'sending' });
            } else {
                toast.success('Borrador guardado');
            }

            navigate('/marketing/email');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar campaña');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketing/email" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Nueva Campaña de Email</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            Detalles del Envío
                        </h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Campaña (Interno)</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ej: Promo Verano 2026"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto del Correo</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="¡No te pierdas esta oferta!"
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grow flex flex-col">
                        <h2 className="text-lg font-bold mb-4">Contenido del Correo</h2>
                        <textarea
                            className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50 font-mono text-sm"
                            placeholder="Escribe tu mensaje aquí... (Soporta HTML básico)"
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                        ></textarea>
                    </div>
                </div>

                {/* Sidebar Settings */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-green-500" />
                            Audiencia
                        </h2>

                        <div className="space-y-3">
                            <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${formData.audience_filter === 'all' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                    type="radio"
                                    name="audience"
                                    checked={formData.audience_filter === 'all'}
                                    onChange={() => setFormData({ ...formData, audience_filter: 'all' })}
                                    className="text-blue-600"
                                />
                                <div>
                                    <p className="font-bold text-sm text-gray-900">Todos los Leads</p>
                                    <p className="text-xs text-gray-500">Envío masivo general</p>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${formData.audience_filter === 'new' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                    type="radio"
                                    name="audience"
                                    checked={formData.audience_filter === 'new'}
                                    onChange={() => setFormData({ ...formData, audience_filter: 'new' })}
                                    className="text-blue-600"
                                />
                                <div>
                                    <p className="font-bold text-sm text-gray-900">Solo Clientes Nuevos</p>
                                    <p className="text-xs text-gray-500">Registrados últimos 30 días</p>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${formData.audience_filter === 'vip' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                    type="radio"
                                    name="audience"
                                    checked={formData.audience_filter === 'vip'}
                                    onChange={() => setFormData({ ...formData, audience_filter: 'vip' })}
                                    className="text-blue-600"
                                />
                                <div>
                                    <p className="font-bold text-sm text-gray-900">Lista VIP / Calientes</p>
                                    <p className="text-xs text-gray-500">Leads con alta probabilidad</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <button
                            onClick={() => handleSave(true)}
                            className="w-full py-4 text-gray-700 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex justify-center items-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            Guardar Borrador
                        </button>
                        <button
                            onClick={() => handleSave(false)}
                            className="w-full py-4 text-white font-bold bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:shadow-lg transition-all flex justify-center items-center gap-2"
                        >
                            <Send className="w-5 h-5" />
                            Enviar Campaña
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
