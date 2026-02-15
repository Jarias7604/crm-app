import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Mail, CheckCircle, BarChart2, Play, Edit, Copy, Send, Smartphone, MessageSquare, Trash2 } from 'lucide-react';
import { campaignService, type Campaign } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';

export default function EmailCampaigns() {
    const CHANNEL_ICONS = {
        email: Mail,
        whatsapp: Smartphone,
        telegram: Send,
        sms: MessageSquare
    };

    const CHANNEL_COLORS = {
        email: 'amber',
        whatsapp: 'green',
        telegram: 'sky',
        sms: 'indigo'
    };

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            const data = await campaignService.getCampaigns();
            setCampaigns(data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar campañas');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSend = async (id: string) => {
        if (!confirm('¿Estás seguro de enviar esta campaña ahora?')) return;

        try {
            toast.loading('Enviando campaña...', { id: 'sending' });
            await campaignService.sendCampaign(id);
            toast.success('¡Campaña enviada con éxito!', { id: 'sending' });
            loadCampaigns();
        } catch (error) {
            toast.error('Error al enviar', { id: 'sending' });
        }
    };

    const handleDuplicate = async (campaign: Campaign) => {
        try {
            const newCampaign = {
                name: `${campaign.name} (copia)`,
                subject: campaign.subject,
                content: campaign.content,
                type: campaign.type,
                status: 'draft' as const,
                total_recipients: 0,
                company_id: campaign.company_id,
                audience_filters: campaign.audience_filters,
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
            };
            const data = await campaignService.createCampaign(newCampaign);
            toast.success('Campaña duplicada como borrador');
            navigate(`/marketing/campaign/${data.id}/edit`);
        } catch (error) {
            toast.error('Error al duplicar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta campaña? Esta acción no se puede deshacer.')) return;

        try {
            await campaignService.deleteCampaign(id);
            setCampaigns(prev => prev.filter(c => c.id !== id));
            toast.success('Campaña eliminada');
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link to="/marketing" className="text-gray-400 hover:text-blue-600 font-medium text-sm transition-colors">
                            ← Volver al Dashboard
                        </Link>
                    </div>
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Marketing Omnicanal</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-gray-500">Crea, gestiona y analiza tus campañas omnicanal.</p>
                        <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                                • {campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0)} TOTAL IMPACTOS
                            </span>
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                                • {campaigns.reduce((acc, c) => acc + (c.stats?.opened || 0), 0)} TOTAL APERTURAS
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                                • {campaigns.reduce((acc, c) => acc + (c.stats?.clicked || 0), 0)} TOTAL CLICKS
                            </span>
                        </div>
                    </div>
                </div>
                <Link to="/marketing/campaign/new" className="bg-indigo-600 hover:bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Crear Campaña
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Cargando campañas...</div>
            ) : (
                <div className="grid gap-4">
                    {campaigns.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-bold text-gray-901">No hay campañas aún</h3>
                            <p className="text-gray-500 mb-6">Comienza creando tu primera campaña de email.</p>
                            <Link to="/marketing/campaign/new" className="text-blue-600 font-bold hover:underline">
                                Crear ahora
                            </Link>
                        </div>
                    ) : (
                        campaigns.map((campaign) => (
                            <div key={campaign.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${campaign.status === 'completed' ? `bg-${CHANNEL_COLORS[campaign.type as keyof typeof CHANNEL_COLORS]}-100 text-${CHANNEL_COLORS[campaign.type as keyof typeof CHANNEL_COLORS]}-600` :
                                        campaign.status === 'sending' ? 'bg-blue-100 text-blue-600' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>
                                        {(() => {
                                            const Icon = CHANNEL_ICONS[campaign.type as keyof typeof CHANNEL_ICONS] || MessageSquare;
                                            return <Icon className="w-6 h-6" />;
                                        })()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{campaign.name}</h3>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${campaign.type === 'email' ? 'border-amber-200 text-amber-600 bg-amber-50' :
                                                campaign.type === 'whatsapp' ? 'border-green-200 text-green-600 bg-green-50' :
                                                    'border-sky-200 text-sky-600 bg-sky-50'
                                                }`}>
                                                {campaign.type}
                                            </span>
                                            {/* KPI Stats in header */}
                                            {campaign.status === 'completed' && campaign.type === 'email' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded text-[9px] font-black uppercase tracking-tighter">
                                                        • {campaign.stats.sent} IMPACTOS
                                                    </span>
                                                    <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[9px] font-black uppercase tracking-tighter">
                                                        • {campaign.stats.opened} APERTURAS
                                                    </span>
                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-tighter">
                                                        • {campaign.stats.clicked} CLICKS
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${campaign.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                campaign.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {campaign.status}
                                            </span>
                                            {campaign.status === 'completed' && (
                                                <span className="text-xs font-medium text-gray-400">
                                                    Finalizado • {new Date(campaign.sent_at || campaign.created_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => navigate(`/marketing/campaign/${campaign.id}/edit`)}
                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Editar"
                                    >
                                        <Edit className="w-5 h-5" />
                                    </button>

                                    {/* Enviar - solo para drafts */}
                                    {campaign.status === 'draft' && (
                                        <button
                                            onClick={() => handleQuickSend(campaign.id)}
                                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                                            title="Enviar Ahora"
                                        >
                                            <Play className="w-5 h-5" />
                                        </button>
                                    )}

                                    {/* Duplicar - para completed (reenviar como nueva) */}
                                    {campaign.status === 'completed' && (
                                        <button
                                            onClick={() => handleDuplicate(campaign)}
                                            className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
                                            title="Duplicar como nuevo borrador"
                                        >
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => navigate(`/marketing/campaign/${campaign.id}/edit`)}
                                        className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                                        title="Ver Reporte"
                                    >
                                        <BarChart2 className="w-5 h-5" />
                                    </button>

                                    <button
                                        onClick={() => handleDelete(campaign.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Eliminar Proyecto"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
