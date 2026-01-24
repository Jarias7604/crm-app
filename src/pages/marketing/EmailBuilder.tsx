import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, Send, ArrowLeft, Users, FileText, Eye, X } from 'lucide-react';
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
        audience_filter: { status: [] as string[], dateRange: 'all' as 'all' | 'new' }
    });

    const possibleStatuses = ["Prospecto", "Cerrado", "En seguimiento", "Cliente", "Negociación", "Lead calificado"];

    const [previewLeads, setPreviewLeads] = useState<any[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const handlePreviewAudience = async () => {
        if (!profile?.company_id) {
            toast.error('No se encontró información de la empresa');
            return;
        }

        setLoadingPreview(true);
        try {
            const leads = await campaignService.getAudiencePreview(formData.audience_filter, profile.company_id);
            setPreviewLeads(leads);
            setShowPreview(true);
            if (leads.length === 0) toast('No se encontraron leads para este filtro.');
        } catch (error) {
            toast.error('Error al cargar audiencia');
        } finally {
            setLoadingPreview(false);
        }
    };

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
                type: 'email' as 'email',
                status: 'draft' as 'draft',

                total_recipients: Math.floor(Math.random() * 500) + 50,
                company_id: profile?.company_id || undefined, // Handle company context
                audience_filters: formData.audience_filter,
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
                        <h2 className="text-lg font-bold flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-green-500" />
                                Audiencia
                            </div>
                            <button
                                onClick={handlePreviewAudience}
                                className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <Eye className="w-4 h-4" /> Ver Lista
                            </button>
                        </h2>

                        <div className="space-y-3">
                            <div className="p-4 border border-gray-200 rounded-xl space-y-3">
                                <p className="font-bold text-sm text-gray-900">Filtrar por Estados (Selección Multiple)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {possibleStatuses.map(status => (
                                        <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
                                            <input
                                                type="checkbox"
                                                checked={formData.audience_filter.status.includes(status)}
                                                onChange={(e) => {
                                                    const current = formData.audience_filter.status;
                                                    const newStatus = e.target.checked
                                                        ? [...current, status]
                                                        : current.filter(s => s !== status);
                                                    setFormData({
                                                        ...formData,
                                                        audience_filter: { ...formData.audience_filter, status: newStatus }
                                                    });
                                                }}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{status}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${formData.audience_filter.dateRange === 'new' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                    type="checkbox"
                                    checked={formData.audience_filter.dateRange === 'new'}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        audience_filter: { ...formData.audience_filter, dateRange: e.target.checked ? 'new' : 'all' }
                                    })}
                                    className="text-blue-600 rounded"
                                />
                                <div>
                                    <p className="font-bold text-sm text-gray-900">Solo Clientes Nuevos</p>
                                    <p className="text-xs text-gray-500">Registrados últimos 30 días</p>
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
            </div >

            {/* Preview Modal */}
            {
                showPreview && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Vista Previa de Destinatarios</h3>
                                    <p className="text-sm text-gray-500">Mostrando primeros 50 resultados.</p>
                                </div>
                                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-0 overflow-y-auto flex-1">
                                {previewLeads.length > 0 ? (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                                            <tr>
                                                <th className="p-4">Nombre</th>
                                                <th className="p-4">Email</th>
                                                <th className="p-4">Registrado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {previewLeads.map((lead: any) => (
                                                <tr key={lead.id} className="hover:bg-gray-50">
                                                    <td className="p-4 font-medium text-gray-900">
                                                        {lead.first_name} {lead.last_name}
                                                        {!lead.first_name && !lead.last_name && <span className="text-gray-400 italic">Sin nombre</span>}
                                                    </td>
                                                    <td className="p-4 text-gray-600">{lead.email}</td>
                                                    <td className="p-4 text-gray-400 text-xs text-right">
                                                        {new Date(lead.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-10 text-center text-gray-500">
                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No se encontraron destinatarios con email válido para este filtro.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl text-right">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
