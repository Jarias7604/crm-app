import { useState, useEffect } from 'react';
import { 
    Mail, 
    Plus, 
    Search, 
    Filter, 
    BarChart3, 
    CheckCircle2, 
    Clock, 
    ArrowLeft,
    Smartphone,
    Send,
    MessageSquare,
    Copy,
    Edit,
    Trash2,
    BarChart2,
    Play
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { campaignService, type Campaign } from '../../services/marketing/campaignService';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function EmailCampaigns() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const CHANNEL_ICONS: Record<string, any> = {
        email: Mail,
        whatsapp: Smartphone,
        telegram: Send,
        sms: MessageSquare
    };

    const CHANNEL_COLORS: Record<string, string> = {
        email: 'indigo',
        whatsapp: 'emerald',
        telegram: 'sky',
        sms: 'purple'
    };

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            setLoading(true);
            const data = await campaignService.getCampaigns();
            setCampaigns(data);
        } catch (error) {
            console.error('Error loading campaigns:', error);
            toast.error('No se pudieron cargar las campañas');
        } finally {
            setLoading(false);
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
            await campaignService.createCampaign(newCampaign);
            toast.success('Campaña duplicada como borrador');
            loadCampaigns();
        } catch (error) {
            toast.error('Error al duplicar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta campaña?')) return;
        try {
            await campaignService.deleteCampaign(id);
            setCampaigns(prev => prev.filter(c => c.id !== id));
            toast.success('Campaña eliminada');
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const filteredCampaigns = campaigns.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            {/* Header - Compact & Premium */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/marketing')}
                        className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white transition-all text-slate-400 hover:text-indigo-600 shadow-inner"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-widest">Omnichannel Hub</span>
                        </div>
                        <h1 className="text-xl font-black text-[#0f172a] tracking-tight">Marketing Omnicanal</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-4 mr-6 px-6 py-2 bg-slate-50/50 rounded-xl border border-slate-50">
                        <CompactStat label="Impactos" value={campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0)} />
                        <div className="w-px h-6 bg-slate-200"></div>
                        <CompactStat label="Aperturas" value={campaigns.reduce((acc, c) => acc + (c.stats?.opened || 0), 0)} color="text-orange-600" />
                        <div className="w-px h-6 bg-slate-200"></div>
                        <CompactStat label="Clicks" value={campaigns.reduce((acc, c) => acc + (c.stats?.clicked || 0), 0)} color="text-blue-600" />
                    </div>
                    <Link 
                        to="/marketing/campaign/new"
                        className="bg-indigo-600 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        CREAR CAMPAÑA
                    </Link>
                </div>
            </div>

            {/* Sub-Header / Search */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-8 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar campañas..."
                        className="w-full bg-white border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/5 outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="md:col-span-4 flex justify-end gap-2">
                    <button className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2">
                        <Filter className="w-3.5 h-3.5" /> Filtrar
                    </button>
                    <button className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5" /> Reportes
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {filteredCampaigns.length > 0 ? filteredCampaigns.map((campaign) => (
                    <div key={campaign.id} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all flex items-center group">
                        {/* Icon */}
                        <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                            campaign.status === 'completed' ? `bg-${CHANNEL_COLORS[campaign.type] || 'indigo'}-50 text-${CHANNEL_COLORS[campaign.type] || 'indigo'}-600` : 'bg-slate-50 text-slate-400'
                        )}>
                            {(() => {
                                const Icon = CHANNEL_ICONS[campaign.type] || Mail;
                                return <Icon className="w-5 h-5" />;
                            })()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 ml-4 min-w-0">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-slate-900 truncate tracking-tight text-sm uppercase">{campaign.name}</h3>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border",
                                    campaign.type === 'email' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                    campaign.type === 'whatsapp' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-sky-50 text-sky-600 border-sky-100'
                                )}>
                                    {campaign.type}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest flex items-center gap-1",
                                    campaign.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'
                                )}>
                                    {campaign.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    {campaign.status}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    • {new Date(campaign.sent_at || campaign.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Stats - Compact */}
                        <div className="hidden md:flex items-center gap-6 mr-6 transition-all group-hover:bg-slate-50 h-full px-4 rounded-xl">
                            <div className="text-center min-w-[50px]">
                                <p className="text-xs font-black text-slate-800">{campaign.stats?.sent || 0}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Impactos</p>
                            </div>
                            <div className="text-center min-w-[50px]">
                                <p className="text-xs font-black text-orange-600">{campaign.stats?.opened || 0}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Open</p>
                            </div>
                            <div className="text-center min-w-[50px]">
                                <p className="text-xs font-black text-blue-600">{campaign.stats?.clicked || 0}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Clicks</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => navigate(`/marketing/campaign/${campaign.id}/edit`)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                                title="Editar"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                            {campaign.status === 'completed' && (
                                <button 
                                    onClick={() => handleDuplicate(campaign)}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
                                >
                                    Clonar
                                </button>
                            )}
                            <button 
                                onClick={() => handleDelete(campaign.id)}
                                className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="bg-white border-2 border-dashed border-slate-100 rounded-2xl py-20 text-center">
                        <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin campañas hoy</h3>
                    </div>
                )}
            </div>
        </div>
    );
}

function CompactStat({ label, value, color = "text-slate-800" }: any) {
    return (
        <div className="text-center">
            <p className={cn("text-xs font-black", color)}>{value}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        </div>
    );
}
