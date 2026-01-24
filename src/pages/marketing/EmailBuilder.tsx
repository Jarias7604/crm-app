import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, Send, ArrowLeft, Users, FileText, Eye, X } from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/AuthProvider';
import { STATUS_CONFIG, type LeadStatus } from '../../types';
import { Building2 } from 'lucide-react';

export default function EmailBuilder() {
    const { profile } = useAuth();
    const navigate = useNavigate();


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
                                disabled={loadingPreview}
                                className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                            >
                                <Eye className="w-4 h-4" />
                                {loadingPreview ? 'Cargando...' : 'Ver Lista'}
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
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200 border border-gray-100">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-blue-600" />
                                        Vista Previa de Destinatarios
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Se enviará a <span className="font-bold text-gray-900">{previewLeads.length}</span> contactos seleccionados.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                                >
                                    <X className="w-6 h-6 text-gray-400 group-hover:text-gray-900" />
                                </button>
                            </div>

                            <div className="p-0 overflow-y-auto flex-1 bg-white">
                                {previewLeads.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {previewLeads.map((lead: any) => {
                                            const statusConfig = STATUS_CONFIG[lead.status as LeadStatus] || STATUS_CONFIG['Prospecto'];
                                            return (
                                                <div key={lead.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4 group">
                                                    {/* Avatar / Initial */}
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm border-2 border-white shadow-sm ring-1 ring-gray-100">
                                                        {lead.name?.charAt(0).toUpperCase() || '?'}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <h4 className="font-bold text-gray-900 truncate">{lead.name || 'Sin nombre'}</h4>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusConfig.bgColor} ${statusConfig.color} border-transparent bg-opacity-50`}>
                                                                {statusConfig.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-gray-400">@</span>
                                                                {lead.email}
                                                            </div>
                                                            {lead.company_name && (
                                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                                                    <Building2 className="w-3 h-3" />
                                                                    {lead.company_name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-right text-xs text-gray-400">
                                                        <p>Creado</p>
                                                        <p className="font-medium text-gray-600">
                                                            {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[300px] text-center p-8">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <Users className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900 mb-1">No se encontraron destinatarios</h4>
                                        <p className="text-gray-500 max-w-xs mx-auto">
                                            Intenta ajustar los filtros de estado o fecha para encontrar contactos con correo válido.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-500">
                                    * Solo se muestran los primeros 50 resultados para vista previa.
                                </span>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all text-sm"
                                >
                                    Cerrar Vista Previa
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
