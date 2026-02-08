import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Save, Send, ArrowLeft, Users, FileText, Eye, X, Zap, Mail, Smartphone, Info, ChevronLeft, ChevronRight, Smartphone as WhatsAppIcon, ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import RichTextEditor from '../../components/marketing/RichTextEditor';

export default function CampaignBuilder() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { id: campaignId } = useParams();
    const isEditMode = !!campaignId;
    const location = useLocation();

    const [selectedChannel, setSelectedChannel] = useState<'email' | 'whatsapp' | 'telegram'>('email');
    const [onlyConnected, setOnlyConnected] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        content: '',
        template_id: '' as string | null,
        audience_filter: {
            status: [] as string[],
            dateRange: 'all' as 'all' | 'new',
            priority: 'all' as string,
            specificIds: [] as string[],
            idType: 'id' as 'id' | 'google_place_id'
        }
    });

    const [isDirectConnect, setIsDirectConnect] = useState(false);

    useEffect(() => {
        if (campaignId) {
            campaignService.getCampaignById(campaignId).then(campaign => {
                setSelectedChannel(campaign.type as any);
                setFormData({
                    name: campaign.name || '',
                    subject: campaign.subject || '',
                    content: campaign.content || '',
                    template_id: (campaign as any).template_id || null,
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
                name: location.state.campaignSource === 'leads-bulk' ? `Campaña Grupal - ${new Date().toLocaleDateString()}` : prev.name,
                audience_filter: {
                    ...prev.audience_filter,
                    specificIds: leadIds,
                    idType: 'id'
                }
            }));
            setIsDirectConnect(true);
            handlePreviewAudience(leadIds, selectedChannel);
        }
    }, [campaignId, location.state]);

    const possibleStatuses = ["Prospecto", "Cerrado", "En seguimiento", "Cliente", "Negociación", "Lead calificado"];

    const [previewLeads, setPreviewLeads] = useState<any[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [showSimulator, setShowSimulator] = useState(false);
    const [currentLeadIndex, setCurrentLeadIndex] = useState(0);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Buenos días';
        if (hour >= 12 && hour < 19) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const renderPreviewContent = (content: string, lead: any) => {
        if (!content) return '';
        let rendered = content;

        // Dynamic Sample Data
        const nameFallback = lead?.name || 'Juan Pérez Santos';
        const firstNameFallback = (lead?.name || 'Juan').split(' ')[0];
        const phoneFallback = lead?.phone || '50377443322';
        const greeting = getGreeting();

        // Substitution Logic - Use groups to avoid partial matching if nested (though rare in curly braces)
        rendered = rendered.replace(/{{greeting}}/g, `<strong>${greeting}</strong>`);
        rendered = rendered.replace(/{{name}}/g, `<strong>${nameFallback}</strong>`);
        rendered = rendered.replace(/{{first_name}}/g, `<strong>${firstNameFallback}</strong>`);
        rendered = rendered.replace(/{{phone}}/g, `<strong>${phoneFallback}</strong>`);

        return rendered;
    };

    const handlePreviewAudience = async (specificIds?: string[], channel?: string) => {
        if (!profile?.company_id) {
            toast.error('No se encontró información de la empresa');
            return;
        }

        const targetIds = specificIds || formData.audience_filter.specificIds;
        const idType = formData.audience_filter.idType;
        const currentChannel = channel || selectedChannel;

        setLoadingPreview(true);
        try {
            const leads = await campaignService.getAudiencePreview({
                ...formData.audience_filter,
                specificIds: targetIds,
                idType: idType
            }, profile.company_id, currentChannel);
            setPreviewLeads(leads);
            setCurrentLeadIndex(0); // Reset Scroller
            if (leads.length === 0) toast('No se encontraron leads válidos para este canal.');
        } catch (error) {
            toast.error('Error al cargar audiencia');
        } finally {
            setLoadingPreview(false);
        }
    };

    const displayedLeads = (selectedChannel === 'telegram' && onlyConnected)
        ? previewLeads.filter(l => l.marketing_conversations?.[0]?.external_id)
        : previewLeads;

    const handleSave = async (isDraft: boolean) => {
        try {
            if (!formData.name) {
                toast.error('El nombre de la campaña es obligatorio');
                return;
            }

            if (selectedChannel === 'email' && !formData.subject) {
                toast.error('El asunto es obligatorio para Email');
                return;
            }

            const campaignData = {
                name: formData.name,
                subject: selectedChannel === 'email' ? formData.subject : undefined,
                content: formData.content,
                type: selectedChannel === 'telegram' ? 'social' : selectedChannel,
                status: 'draft' as 'draft',
                total_recipients: previewLeads.length || 0,
                company_id: profile?.company_id || undefined,
                audience_filters: formData.audience_filter,
                template_id: formData.template_id,
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
            };

            let savedId: string;

            if (isEditMode && campaignId) {
                await campaignService.updateCampaign(campaignId, campaignData as any);
                savedId = campaignId;
            } else {
                const data = await campaignService.createCampaign(campaignData as any);
                savedId = data.id;
            }

            if (!isDraft) {
                toast.loading('Ejecutando campaña...', { id: 'sending' });
                const result = await campaignService.sendCampaign(savedId);
                const sent = result?.results?.success || 0;
                const failed = result?.results?.failed || 0;
                toast.success(`¡Procesado! ${sent} enviados, ${failed} fallidos`, { id: 'sending' });
            } else {
                toast.success(isEditMode ? 'Campaña actualizada' : 'Borrador guardado');
            }

            navigate('/marketing/email');
        } catch (error) {
            console.error(error);
            toast.error('Error al procesar campaña');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <button
                    onClick={() => navigate('/marketing/email')}
                    className="p-3 bg-gray-50 hover:bg-white border border-gray-100 rounded-2xl transition-all text-gray-500 hover:text-[#4449AA] shadow-sm"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${selectedChannel === 'email' ? 'bg-amber-100 text-amber-600' :
                            selectedChannel === 'whatsapp' ? 'bg-green-100 text-green-600' :
                                'bg-sky-100 text-sky-600'
                            }`}>
                            {selectedChannel} Campaign
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">
                        {isEditMode ? 'Editar Campaña Unificada' : 'Nueva Campaña Omnicanal'}
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Main Config */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Canal Selector - Senior Experience */}
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                        <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-600" />
                            Selecciona el Canal de Comunicación
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { id: 'email', icon: Mail, label: 'Email', color: 'amber' },
                                { id: 'whatsapp', icon: WhatsAppIcon, label: 'WhatsApp', color: 'green' },
                                { id: 'telegram', icon: Send, label: 'Telegram', color: 'sky' }
                            ].map((channel) => (
                                <button
                                    key={channel.id}
                                    onClick={() => setSelectedChannel(channel.id as any)}
                                    className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all group ${selectedChannel === channel.id
                                        ? `border-${channel.color}-500 bg-${channel.color}-50 shadow-md`
                                        : 'border-gray-50 bg-white hover:border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`p-4 rounded-xl transition-colors ${selectedChannel === channel.id
                                        ? `bg-${channel.color}-500 text-white`
                                        : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                                        }`}>
                                        <channel.icon className="w-6 h-6" />
                                    </div>
                                    <span className={`text-sm font-black uppercase tracking-widest ${selectedChannel === channel.id ? `text-${channel.color}-700` : 'text-gray-500'
                                        }`}>
                                        {channel.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-4">
                            <FileText className="w-6 h-6 text-blue-500" />
                            Contenido del Mensaje
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre Interno</label>
                                <input
                                    type="text"
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#4449AA] outline-none transition-all font-bold text-gray-700"
                                    placeholder="Ej: Seguimiento Post-Evento"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {selectedChannel === 'email' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Asunto del Correo</label>
                                    <input
                                        type="text"
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-gray-700"
                                        placeholder="¡Hola! Tenemos algo para ti"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="min-h-[400px] flex flex-col relative">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Cuerpo del Mensaje</label>
                                <RichTextEditor
                                    value={formData.content}
                                    onChange={value => setFormData({ ...formData, content: value })}
                                    placeholder={
                                        selectedChannel === 'email' ? "Diseña tu email profesional..." :
                                            selectedChannel === 'telegram' ? "Escribe tu mensaje para Telegram... Soporta HTML (negritas, links)" :
                                                "Escribe tu mensaje para WhatsApp... Soporta Markdown (*negrita*, _cursiva_)"
                                    }
                                    channel={selectedChannel}
                                />
                                {selectedChannel !== 'email' && (
                                    <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex items-center gap-2 group transition-all hover:bg-white">
                                        <Zap className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <p className="text-[10px] font-medium text-indigo-700 italic">
                                            {selectedChannel === 'telegram'
                                                ? "Telegram: Las imágenes y videos se enviarán como archivos reales con tu texto como descripción."
                                                : "WhatsApp: Los archivos multimedia serán procesados por la API oficial de Meta y el texto se convertirá a Markdown."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audience & Final Actions */}
                <div className="lg:col-span-4 space-y-6 sticky top-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 space-y-6">
                        <h2 className="text-lg font-black flex items-center justify-between mb-2 text-gray-900">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#4449AA]" />
                                Audiencia
                            </div>
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                                {isDirectConnect ? 'Selección Directa' : 'Filtros Dinámicos'}
                            </span>
                        </h2>

                        {isDirectConnect && (
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                <p className="text-xs font-bold text-indigo-800 mb-3">
                                    Has seleccionado <span className="text-sm font-black">{formData.audience_filter?.specificIds?.length || 0}</span> prospectos manualmente.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsDirectConnect(false);
                                        setFormData(prev => ({
                                            ...prev,
                                            audience_filter: { ...prev.audience_filter, specificIds: [] }
                                        }));
                                    }}
                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Limpiar y usar filtros
                                </button>
                            </div>
                        )}

                        <div className={isDirectConnect ? 'opacity-40 pointer-events-none' : 'space-y-6'}>
                            {/* Priority */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Temperatura</label>
                                <select
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs uppercase"
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

                            {/* Status */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Estado</label>
                                <div className="flex flex-wrap gap-2">
                                    {possibleStatuses.map(status => {
                                        const isSelected = formData.audience_filter.status.includes(status);
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    const current = formData.audience_filter?.status || [];
                                                    const newStatus = isSelected ? current.filter(s => s !== status) : [...current, status];
                                                    setFormData({ ...formData, audience_filter: { ...formData.audience_filter, status: newStatus } });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${isSelected ? 'bg-indigo-600 text-white border-transparent shadow-md' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Connectivity Filter (Telegram Only) */}
                            {selectedChannel === 'telegram' && (
                                <div className="pt-2 animate-in slide-in-from-top-2">
                                    <button
                                        onClick={() => setOnlyConnected(!onlyConnected)}
                                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${onlyConnected
                                            ? 'bg-sky-50 border-sky-500 shadow-sm'
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${onlyConnected ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${onlyConnected ? 'text-sky-700' : 'text-gray-500'}`}>Solo Conectados</p>
                                                <p className="text-[10px] text-gray-400 font-medium leading-tight">Solo leads que ya han iniciado chat</p>
                                            </div>
                                        </div>
                                        <div className={`w-10 h-6 rounded-full transition-colors relative ${onlyConnected ? 'bg-sky-500' : 'bg-gray-200'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${onlyConnected ? 'right-1' : 'left-1'}`} />
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => handlePreviewAudience()}
                            disabled={loadingPreview}
                            className="w-full py-4 bg-[#0f172a] hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Eye className="w-4 h-4" /> Validar Audiencia ({displayedLeads.length})</>}
                        </button>
                    </div>

                    <div className="grid gap-3">
                        <button
                            onClick={() => {
                                if (displayedLeads.length === 0) handlePreviewAudience();
                                setShowSimulator(true);
                            }}
                            className="w-full py-4 bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-widest border border-indigo-100 rounded-2xl hover:bg-white transition-all shadow-sm flex justify-center items-center gap-2"
                        >
                            <Smartphone className="w-4 h-4" /> Simulador Visual
                        </button>
                        <button
                            onClick={() => handleSave(true)}
                            className="w-full py-4 text-gray-700 font-black text-[10px] uppercase tracking-widest bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex justify-center items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {isEditMode ? 'Guardar Cambios' : 'Guardar Borrador'}
                        </button>
                        <button
                            onClick={() => handleSave(false)}
                            className={`w-full py-5 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 transform active:scale-95 ${selectedChannel === 'email' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' :
                                selectedChannel === 'whatsapp' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' :
                                    'bg-sky-500 hover:bg-sky-600 shadow-sky-200'
                                }`}
                        >
                            <Send className="w-5 h-5" /> Enviar Campaña
                        </button>
                    </div>
                </div>
            </div>

            {/* Visual Simulator Modal */}
            {showSimulator && (
                <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-xl z-[60] flex items-center justify-center p-4">
                    <div className="w-full max-w-5xl flex flex-col h-[90vh] animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl text-white">
                                    <Eye className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Predictive Visual Simulator</h3>
                                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Vista previa realista para SaaS CRM</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSimulator(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/60">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden pb-8">
                            {/* Simulator Canvas */}
                            <div className="lg:col-span-7 bg-black/40 rounded-[3rem] border border-white/5 flex items-center justify-center p-6 relative overflow-hidden shadow-inner">
                                {selectedChannel === 'email' ? (
                                    // Email Simulator
                                    <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
                                        <div className="bg-gray-100 p-4 border-b flex items-center gap-3">
                                            <div className="flex gap-1.5">
                                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                                <div className="w-3 h-3 rounded-full bg-green-400" />
                                            </div>
                                            <div className="bg-white px-4 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 flex-1 border border-gray-200">
                                                {formData.subject || 'Sin Asunto'}
                                            </div>
                                        </div>
                                        <div className="p-8 h-[500px] overflow-y-auto">
                                            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-50">
                                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-400 text-sm">
                                                    {(profile?.full_name || 'A').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-900">{profile?.full_name || 'Empresa CRM'}</p>
                                                    <p className="text-[10px] text-gray-400">Para: {previewLeads[currentLeadIndex]?.name || 'Juan Pérez'}</p>
                                                </div>
                                            </div>
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: renderPreviewContent(formData.content, previewLeads[currentLeadIndex]) }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    // Phone Simulator (WhatsApp / Telegram)
                                    <div className="relative w-[340px] h-[680px] bg-[#1a1a1a] rounded-[3.5rem] border-[12px] border-[#222] shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden animate-in slide-in-from-bottom-8 duration-700 ring-4 ring-[#333]/30">
                                        {/* Phone Notch / Dynamic Island Style */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#222] rounded-b-3xl z-20 flex items-center justify-center">
                                            <div className="w-10 h-1 bg-white/5 rounded-full" />
                                        </div>

                                        {/* App Header */}
                                        <div className={`p-4 pt-10 h-24 flex items-center gap-3 border-b shadow-sm relative z-10 ${selectedChannel === 'whatsapp' ? 'bg-[#008069] border-[#005e4d]' : 'bg-[#24A1DE] border-[#1e88bb]'}`}>
                                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-white text-sm shadow-inner overflow-hidden border border-white/10">
                                                {(previewLeads[currentLeadIndex]?.name || 'J').charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-black text-sm leading-tight truncate">{previewLeads[currentLeadIndex]?.name || 'Juan Pérez'}</p>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                                    <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">en línea</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Browser / Chat Area */}
                                        <div className={`h-full flex flex-col p-4 pt-6 overflow-y-auto ${selectedChannel === 'whatsapp' ? 'bg-[#e5ddd5]' : 'bg-[#f0f2f5]'}`} style={{
                                            backgroundImage: selectedChannel === 'whatsapp' ? 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-9113-10996a603e51.png)' : 'none',
                                            backgroundSize: '400px',
                                            paddingBottom: '100px'
                                        }}>
                                            {/* Date bubble */}
                                            <div className="flex justify-center mb-6">
                                                <span className="bg-black/10 backdrop-blur-sm px-3 py-1 rounded-lg text-[9px] font-black text-black/40 uppercase tracking-widest text-center">Hoy</span>
                                            </div>

                                            <div className={`max-w-[90%] p-4 rounded-2xl shadow-md text-sm relative group animate-in slide-in-from-left-4 duration-500 ${selectedChannel === 'whatsapp'
                                                ? 'bg-[#dcf8c6] rounded-tl-none border border-[#c6e9a3] ml-1'
                                                : 'bg-white rounded-tl-none border border-gray-100 ml-1'
                                                }`}>
                                                {/* WhatsApp Tail */}
                                                <div className={`absolute top-0 -left-2 w-4 h-4 ${selectedChannel === 'whatsapp' ? 'text-[#dcf8c6]' : 'text-white'}`} style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}>
                                                    <div className="w-full h-full bg-current" />
                                                </div>

                                                <div
                                                    className="leading-relaxed text-gray-800 break-words whitespace-pre-wrap text-[13px] font-medium"
                                                    dangerouslySetInnerHTML={{ __html: renderPreviewContent(formData.content, previewLeads[currentLeadIndex]) }}
                                                />
                                                <div className="flex justify-end items-center gap-1 mt-2">
                                                    <span className="text-[9px] text-gray-400 font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {selectedChannel === 'whatsapp' && (
                                                        <div className="flex -space-x-1">
                                                            <span className="text-blue-500 text-[10px] font-black">✓</span>
                                                            <span className="text-blue-500 text-[10px] font-black">✓</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fake Input Area */}
                                        <div className="absolute bottom-6 left-0 right-0 p-4 bg-transparent flex items-center gap-2">
                                            <div className="flex-1 h-10 bg-white rounded-full shadow-lg border border-gray-100 px-4 flex items-center text-gray-300 text-xs">
                                                Escribe un mensaje...
                                            </div>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg text-white ${selectedChannel === 'whatsapp' ? 'bg-[#00a884]' : 'bg-[#24A1DE]'}`}>
                                                <Send className="w-4 h-4 fill-current" />
                                            </div>
                                        </div>

                                        <div className="absolute bottom-1 auto-mx left-1/2 -translate-x-1/2 w-24 h-1 bg-white/20 rounded-full" />
                                    </div>
                                )}
                            </div>

                            {/* Sidebar / Info */}
                            <div className="lg:col-span-5 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-[2rem] space-y-5">
                                    <h4 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                        <Info className="w-4 h-4 text-indigo-400" />
                                        Información del Test
                                    </h4>

                                    <div className="space-y-4">
                                        <div className="p-4 bg-white/10 rounded-2xl border-2 border-indigo-500/50 relative overflow-hidden group shadow-lg shadow-indigo-500/10">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Simulando Lead {currentLeadIndex + 1}/{previewLeads.length || 1}</p>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => setCurrentLeadIndex(prev => Math.max(0, prev - 1))}
                                                        className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                                                        disabled={currentLeadIndex === 0}
                                                    >
                                                        <ChevronLeft className="w-4 h-4 text-white" />
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentLeadIndex(prev => (prev + 1) % (previewLeads.length || 1))}
                                                        className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                                                        disabled={(previewLeads.length || 0) <= 1}
                                                    >
                                                        <ChevronRight className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg">
                                                    {(displayedLeads[currentLeadIndex]?.name || 'J').charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-white font-black text-base tracking-tight leading-none">{displayedLeads[currentLeadIndex]?.name || 'Juan Pérez Santos'}</p>
                                                        {selectedChannel === 'telegram' && (
                                                            displayedLeads[currentLeadIndex]?.marketing_conversations?.[0]?.external_id ? (
                                                                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                                                            ) : (
                                                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                                            )
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-indigo-300 text-[10px] font-bold tracking-wider">{displayedLeads[currentLeadIndex]?.phone || '50377443322'}</p>
                                                        {selectedChannel === 'telegram' && (
                                                            <a
                                                                href={`https://t.me/${(displayedLeads[currentLeadIndex]?.phone || '').replace(/\D/g, '').startsWith('503') ? '+' : ''}${(displayedLeads[currentLeadIndex]?.phone || '').replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 px-1.5 py-0.5 bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/30 rounded text-[8px] font-black text-sky-300 uppercase transition-all"
                                                            >
                                                                <ExternalLink className="w-2 h-2" /> Chat Directo
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pulse effect for simulation */}
                                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                                <span className="text-[7px] font-black text-green-400 uppercase tracking-widest">Live</span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <p className="text-white/40 text-[10px] font-black uppercase mb-3">Placeholders Activos</p>
                                            <div className="space-y-3">
                                                {['{{greeting}}', '{{first_name}}', '{{name}}', '{{phone}}'].map(tag => {
                                                    const isActive = formData.content.includes(tag);
                                                    if (!isActive) return null;

                                                    let displayValue = '...';
                                                    if (tag === '{{greeting}}') displayValue = getGreeting();
                                                    else if (tag === '{{first_name}}') displayValue = (displayedLeads[currentLeadIndex]?.name || 'Juan').split(' ')[0];
                                                    else if (tag === '{{name}}') displayValue = displayedLeads[currentLeadIndex]?.name || 'Juan Pérez';
                                                    else if (tag === '{{phone}}') displayValue = displayedLeads[currentLeadIndex]?.phone || '503...';

                                                    return (
                                                        <div key={tag} className="flex items-center justify-between group animate-in fade-in slide-in-from-right-2">
                                                            <code className="text-indigo-400 text-xs font-bold">{tag}</code>
                                                            <span className="text-white/60 text-[10px] font-medium">{displayValue}</span>
                                                        </div>
                                                    );
                                                })}
                                                {!['{{greeting}}', '{{first_name}}', '{{name}}', '{{phone}}'].some(t => formData.content.includes(t)) && (
                                                    <div className="space-y-3">
                                                        <p className="text-[10px] text-white/40 italic">No se detectaron variables en el texto. Para que el nombre cambie automáticamente por cada lead, debes insertarlas.</p>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    content: `{{greeting}} {{first_name}},<br><br>${prev.content}`
                                                                }));
                                                                toast.success('Saludo automático insertado al inicio');
                                                            }}
                                                            className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 rounded-xl text-[10px] font-black text-indigo-200 uppercase tracking-widest transition-all"
                                                        >
                                                            + Insertar Saludo Pro
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/30">
                                        <p className="text-indigo-200 text-xs font-medium italic">
                                            "Este simulador utiliza inteligencia predictiva para mostrar exactamente cómo se renderizará el contenido en dispositivos reales."
                                        </p>
                                    </div>

                                    {selectedChannel === 'telegram' && !displayedLeads[currentLeadIndex]?.marketing_conversations?.[0]?.external_id && (
                                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl animate-in fade-in zoom-in-95 duration-500">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ShieldAlert className="w-4 h-4 text-amber-400" />
                                                <p className="text-amber-200 text-[10px] font-black uppercase tracking-widest">Lead No Conectado</p>
                                            </div>
                                            <p className="text-amber-100/70 text-[10px] font-medium leading-relaxed mb-3">
                                                El bot no puede iniciar el chat. Envía este link por WhatsApp o Email para que el lead active el bot:
                                            </p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`https://t.me/TuBotCRM?start=join`);
                                                    toast.success('Link copiado al portapapeles');
                                                }}
                                                className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-[9px] font-black text-amber-200 uppercase tracking-widest transition-all overflow-hidden text-ellipsis whitespace-nowrap"
                                            >
                                                Copiar Link de Invitación
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setShowSimulator(false)}
                                        className="w-full py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg"
                                    >
                                        Seguir Editando
                                    </button>

                                    {displayedLeads.length > 1 && (
                                        <div className="pt-4 border-t border-white/10">
                                            <p className="text-white/40 text-[10px] font-black uppercase mb-3 text-center">Prevista de Audiencia ({displayedLeads.length})</p>
                                            <div className="space-y-2">
                                                {displayedLeads.slice(0, 3).map((lead, idx) => (
                                                    <div key={idx} className="p-2 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group/item">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white/60 text-[10px] font-bold">{lead.name.split(' ')[0]}</span>
                                                            {selectedChannel === 'telegram' && (
                                                                lead.marketing_conversations?.[0]?.external_id ? (
                                                                    <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />
                                                                ) : (
                                                                    <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                                                                )
                                                            )}
                                                        </div>
                                                        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-tighter">
                                                            {getGreeting().split(' ')[0]}...
                                                        </span>
                                                    </div>
                                                ))}
                                                {displayedLeads.length > 3 && (
                                                    <p className="text-center text-[8px] text-white/20 font-bold uppercase mt-1">Y {displayedLeads.length - 3} contactos más...</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const Loader2 = ({ className }: { className?: string }) => (
    <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
);
