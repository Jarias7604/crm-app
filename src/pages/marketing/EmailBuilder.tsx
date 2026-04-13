import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Users, FileText, Eye, X, Zap } from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import { STATUS_CONFIG, type LeadStatus } from '../../types';
import RichTextEditor from '../../components/marketing/RichTextEditor';
import { cn } from '../../lib/utils';

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
            campaignService.getCampaignById(campaignId).then(campaign => {
                setFormData({
                    name: campaign.name || '',
                    subject: campaign.subject || '',
                    content: campaign.content || '',
                    audience_filter: {
                        status: campaign.audience_filters?.status || [],
                        dateRange: campaign.audience_filters?.dateRange || 'all',
                        priority: campaign.audience_filters?.priority || 'all',
                        specificIds: campaign.audience_filters?.specificIds || [],
                        idType: campaign.audience_filters?.idType || 'id'
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

    const possibleStatuses = ["Prospecto", "Llamada fría", "En Nutrición", "Lead calificado", "En seguimiento", "Negociación", "Cerrado", "Cliente"];

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
                await campaignService.updateCampaign(campaignId, campaignData);
                savedId = campaignId;
            } else {
                const data = await campaignService.createCampaign(campaignData);
                savedId = data.id;
            }

            if (!isDraft) {
                toast.loading('Enviando campaña...', { id: 'sending' });
                const result = await campaignService.sendCampaign(savedId);
                const sent = result?.results?.success || 0;
                const failed = result?.results?.failed || 0;
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
        <div className="max-w-7xl mx-auto space-y-4 pb-12 animate-in fade-in duration-500">
            {/* Professional Compact Header */}
            <div className="flex items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <button
                    onClick={() => navigate('/marketing/email')}
                    className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white transition-all text-slate-400 hover:text-indigo-600 shadow-inner"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-widest">Email Builder</span>
                    </div>
                    <h1 className="text-xl font-black text-[#0f172a] tracking-tight">
                        {isEditMode ? 'Editar Campaña' : 'Nueva Campaña de Email'}
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-8 space-y-4">
                    {/* Details Card */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-5">
                        <h2 className="text-sm font-black flex items-center gap-2 text-slate-900 border-b border-slate-50 pb-4 uppercase tracking-tight">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            Configuración Base
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre Interno</label>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/5 focus:bg-white outline-none transition-all font-bold text-sm"
                                    placeholder="Ej: Promo Verano 2026"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Asunto del Correo</label>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/5 focus:bg-white outline-none transition-all font-bold text-sm"
                                    placeholder="¡No te pierdas esta oferta!"
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Editor Card */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-indigo-600" />
                                </div>
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Diseño Pro</h2>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">Rich Text Active</span>
                        </div>

                        <div className="flex-1 border border-slate-50 rounded-xl overflow-hidden p-1">
                            <RichTextEditor
                                value={formData.content}
                                onChange={value => setFormData({ ...formData, content: value })}
                                placeholder="Escribe tu mensaje profesionalmente..."
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-4 sticky top-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-5">
                        <h2 className="text-xs font-black flex items-center justify-between text-slate-900 uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                Audiencia
                            </div>
                        </h2>

                        {isDirectConnect ? (
                            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                <p className="text-[11px] font-bold text-indigo-900 mb-2">
                                    <span className="font-black">{formData.audience_filter?.specificIds?.length || 0}</span> prospectos seleccionados directamente.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsDirectConnect(false);
                                        setFormData(prev => ({
                                            ...prev,
                                            audience_filter: { ...prev.audience_filter, specificIds: [] }
                                        }));
                                    }}
                                    className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Usar filtros generales
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioridad</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                                        value={formData.audience_filter.priority || 'all'}
                                        onChange={e => setFormData({
                                            ...formData,
                                            audience_filter: { ...formData.audience_filter, priority: e.target.value }
                                        })}
                                    >
                                        <option value="all">Todas</option>
                                        <option value="high">Alta</option>
                                        <option value="medium">Media</option>
                                        <option value="low">Baja</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Estados</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {possibleStatuses.map(status => {
                                            const isSelected = formData.audience_filter.status.includes(status);
                                            const config = STATUS_CONFIG[status as LeadStatus] || STATUS_CONFIG['Prospecto'];
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => {
                                                        const current = formData.audience_filter?.status || [];
                                                        const newStatus = isSelected
                                                            ? current.filter(s => s !== status)
                                                            : [...current, status];
                                                        setFormData({
                                                            ...formData,
                                                            audience_filter: { ...formData.audience_filter, status: newStatus }
                                                        });
                                                    }}
                                                    className={cn(
                                                        "px-2 py-1 rounded-lg text-[10px] font-black transition-all border",
                                                        isSelected ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-100 text-slate-500 hover:border-indigo-100"
                                                    )}
                                                >
                                                    {status}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => handlePreviewAudience()}
                            disabled={loadingPreview}
                            className="w-full py-2.5 bg-slate-900 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            {loadingPreview ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                            Vista Previa de Audiencia
                        </button>
                    </div>

                    <div className="grid gap-2">
                        <button
                            onClick={() => handleSave(true)}
                            className="w-full py-3 bg-white border border-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            {isEditMode ? 'Actualizar Cambios' : 'Guardar Borrador'}
                        </button>
                        <button
                            onClick={() => handleSave(false)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-600/10 transition-all transform active:scale-[0.98]"
                        >
                            Enviar Campaña Ahora
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Audiencia Seleccionada</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Destinatarios Únicos: {previewLeads.length}</p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1 bg-white">
                            {previewLeads.map((lead: any) => (
                                <div key={lead.id} className="p-3.5 border-b border-slate-50 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-indigo-600">{lead.name?.charAt(0) || '?'}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 text-xs truncate uppercase">{lead.name || 'Sin nombre'}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{lead.email}</p>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{lead.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
