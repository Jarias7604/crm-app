import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Save, Send, ArrowLeft, Users, FileText, Eye, X, Zap, Building2 } from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import { STATUS_CONFIG, type LeadStatus } from '../../types';
import RichTextEditor from '../../components/marketing/RichTextEditor';

export default function EmailBuilder() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { id: campaignId } = useParams();
    const isEditMode = !!campaignId;


    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        content: '',
        audience_filter: {
            status: [] as string[],
            dateRange: 'all' as 'all' | 'new',
            priority: 'all' as string,
            specificIds: [] as string[],
            idType: 'id' as 'id' | 'google_place_id'
        }
    });

    const [isDirectConnect, setIsDirectConnect] = useState(false);
    const location = useLocation();

    useEffect(() => {
        if (campaignId) {
            // Edit mode: load existing campaign
            campaignService.getCampaignById(campaignId).then(campaign => {
                setFormData({
                    name: campaign.name || '',
                    subject: campaign.subject || '',
                    content: campaign.content || '',
                    audience_filter: campaign.audience_filters || {
                        status: [],
                        dateRange: 'all',
                        priority: 'all',
                        specificIds: [],
                        idType: 'id'
                    }
                });
            }).catch(err => {
                console.error(err);
                toast.error('Error al cargar la campaña');
                navigate('/marketing/email');
            });
        } else if (location.state?.preSelectedLeads) {
            const leadIds = location.state.preSelectedLeads;
            setFormData(prev => ({
                ...prev,
                name: location.state.campaignSource === 'lead-hunter' ? `Campaña Lead Hunter - ${new Date().toLocaleDateString()}` : prev.name,
                audience_filter: {
                    ...prev.audience_filter,
                    specificIds: leadIds,
                    idType: location.state.campaignSource === 'lead-hunter' ? 'google_place_id' : 'id'
                }
            }));
            setIsDirectConnect(true);
            handlePreviewAudience(leadIds);
        }
    }, [campaignId, location.state]);

    const possibleStatuses = ["Prospecto", "Cerrado", "En seguimiento", "Cliente", "Negociación", "Lead calificado"];

    const [previewLeads, setPreviewLeads] = useState<any[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const handlePreviewAudience = async (specificIds?: string[]) => {
        if (!profile?.company_id) {
            toast.error('No se encontró información de la empresa');
            return;
        }

        const targetIds = specificIds || formData.audience_filter.specificIds;
        const idType = formData.audience_filter.idType;

        setLoadingPreview(true);
        try {
            const leads = await campaignService.getAudiencePreview({
                ...formData.audience_filter,
                specificIds: targetIds,
                idType: idType
            }, profile.company_id);
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

            const campaignData = {
                name: formData.name,
                subject: formData.subject,
                content: formData.content,
                type: 'email' as 'email',
                status: 'draft' as 'draft',
                total_recipients: Math.floor(Math.random() * 500) + 50,
                company_id: profile?.company_id || undefined,
                audience_filters: formData.audience_filter,
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
            };

            let savedId: string;

            if (isEditMode && campaignId) {
                // Update existing campaign
                await campaignService.updateCampaign(campaignId, campaignData);
                savedId = campaignId;
            } else {
                // Create new campaign
                const data = await campaignService.createCampaign(campaignData);
                savedId = data.id;
            }

            if (!isDraft) {
                toast.loading('Enviando campaña...', { id: 'sending' });
                const result = await campaignService.sendCampaign(savedId);
                console.log('📧 CAMPAIGN RESULT:', JSON.stringify(result, null, 2));
                const sent = result?.results?.success || 0;
                const failed = result?.results?.failed || 0;
                if (result?.debug) console.log('🔍 DEBUG:', result.debug.join('\n'));
                toast.success(`¡Campaña enviada! ${sent} enviados, ${failed} fallidos`, { id: 'sending' });
            } else {
                toast.success(isEditMode ? 'Campaña actualizada' : 'Borrador guardado');
            }

            navigate('/marketing/email');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar campaña');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <button
                    onClick={() => navigate('/marketing/email')}
                    className="p-3 bg-gray-50 hover:bg-white border border-gray-100 rounded-2xl transition-all text-gray-500 hover:text-blue-600 shadow-sm"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">{isEditMode ? 'Editar Campaña' : 'Nueva Campaña de Email'}</h1>
                    <p className="text-gray-500 text-sm font-medium">{isEditMode ? 'Modifica y actualiza tu campaña.' : 'Configura y diseña tu correo para maximizar conversiones.'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Configuration Panel - Takes up 8 cols (2/3) */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-4">
                            <FileText className="w-6 h-6 text-blue-500" />
                            Detalles del Envío
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de Campaña (Interno)</label>
                                <input
                                    type="text"
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                    placeholder="Ej: Promo Verano 2026"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Asunto del Correo</label>
                                <input
                                    type="text"
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                    placeholder="¡No te pierdas esta oferta!"
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm grow flex flex-col min-h-[600px]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h2 className="text-xl font-black text-gray-900">Diseño del Mensaje</h2>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">Soporta HTML Pro</span>
                        </div>

                        <RichTextEditor
                            value={formData.content}
                            onChange={value => setFormData({ ...formData, content: value })}
                            placeholder="Escribe tu mensaje aquí profesionalmente..."
                        />

                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-gray-400 italic">Consejo: Usa el formato enriquecido para destacar tu propuesta.</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Settings - Takes up 4 cols (1/3) */}
                <div className="lg:col-span-4 space-y-6 sticky top-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 space-y-6">
                        <h2 className="text-lg font-black flex items-center justify-between mb-2 text-gray-900">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" />
                                Audiencia Objetivo
                            </div>
                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                                {isDirectConnect ? 'Selección Directa' : formData.audience_filter.status.length > 0 ? `${formData.audience_filter.status.length} filtros` : 'Todos'}
                            </span>
                        </h2>

                        {isDirectConnect && (
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <p className="text-sm font-medium text-blue-800 mb-3">
                                    Has seleccionado <span className="font-black">{formData.audience_filter.specificIds.length}</span> prospectos específicos desde Lead Hunter.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsDirectConnect(false);
                                        setFormData(prev => ({
                                            ...prev,
                                            audience_filter: { ...prev.audience_filter, specificIds: [] }
                                        }));
                                    }}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Limpiar y usar filtros generales
                                </button>
                            </div>
                        )}

                        <div className={isDirectConnect ? 'opacity-40 pointer-events-none' : 'space-y-6'}>
                            {/* Priority Filter */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                    Prioridad de Leads
                                </label>
                                <select
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                                    value={formData.audience_filter.priority || 'all'}
                                    onChange={e => setFormData({
                                        ...formData,
                                        audience_filter: { ...formData.audience_filter, priority: e.target.value }
                                    })}
                                >
                                    <option value="all">Todas las prioridades</option>
                                    <option value="high">Alta Prioridad</option>
                                    <option value="medium">Prioridad Media</option>
                                    <option value="low">Baja Prioridad</option>
                                </select>
                            </div>

                            {/* Status Filter - Chips Design */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                    Filtrar por Estado
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {possibleStatuses.map(status => {
                                        const isSelected = formData.audience_filter.status.includes(status);
                                        const config = STATUS_CONFIG[status as LeadStatus] || STATUS_CONFIG['Prospecto'];

                                        return (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    const current = formData.audience_filter.status;
                                                    const newStatus = isSelected
                                                        ? current.filter(s => s !== status)
                                                        : [...current, status];
                                                    setFormData({
                                                        ...formData,
                                                        audience_filter: { ...formData.audience_filter, status: newStatus }
                                                    });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected
                                                    ? `${config.bgColor} ${config.color} border-transparent ring-2 ring-offset-1 ring-${config.color.split('-')[1]}-400`
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {isSelected && <span className="mr-1">✓</span>}
                                                {status}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Date Filter - Modern Toggle Card */}
                            <div
                                onClick={() => setFormData({
                                    ...formData,
                                    audience_filter: { ...formData.audience_filter, dateRange: formData.audience_filter.dateRange === 'new' ? 'all' : 'new' }
                                })}
                                className={`group p-4 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden ${formData.audience_filter.dateRange === 'new'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-100 bg-white hover:border-blue-200'
                                    }`}
                            >
                                <div className="flex justify-between items-center relative z-10">
                                    <div>
                                        <p className={`font-bold text-sm ${formData.audience_filter.dateRange === 'new' ? 'text-blue-900' : 'text-gray-900'}`}>Solo Clientes Recientes</p>
                                        <p className={`text-xs mt-0.5 ${formData.audience_filter.dateRange === 'new' ? 'text-blue-600' : 'text-gray-500'}`}>Registrados en los últimos 30 días</p>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${formData.audience_filter.dateRange === 'new' ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.audience_filter.dateRange === 'new' ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Button */}
                        <button
                            onClick={() => handlePreviewAudience()}
                            disabled={loadingPreview}
                            className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                        >
                            {loadingPreview ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Ver Vista Previa de Audiencia
                                </>
                            )}
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="grid gap-3">
                        <button
                            onClick={() => handleSave(true)}
                            className="w-full py-4 text-gray-700 font-bold bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors flex justify-center items-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            {isEditMode ? 'Guardar Cambios' : 'Guardar Borrador'}
                        </button>
                        <button
                            onClick={() => handleSave(false)}
                            className="w-full py-4 text-white font-bold bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl hover:shadow-xl hover:shadow-blue-500/20 transition-all flex justify-center items-center gap-2 transform active:scale-[0.98]"
                        >
                            <Send className="w-5 h-5" />
                            Enviar Campaña Ahora
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
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
            )}
        </div>
    );
}
