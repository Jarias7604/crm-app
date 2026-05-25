import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Mail,
    Eye,
    MousePointerClick,
    Send,
    Users,
    Percent,
    RefreshCw,
    Download,
    CheckCircle2,
    Clock,
    XCircle,
    Smartphone,
    MessageSquare
} from 'lucide-react';
import { campaignService, type Campaign } from '../../services/marketing/campaignService';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'opened' | 'not_opened';

interface Recipient {
    id: string;
    name: string;
    email: string;
    phone: string;
    companyName: string;
    leadStatus: string;
    interactionStatus: string;
    sentAt: string;
    lastActivity: string;
}

export default function CampaignReport() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [c, r] = await Promise.all([
                campaignService.getCampaignById(id!),
                campaignService.getCampaignRecipients(id!)
            ]);
            setCampaign(c);
            setRecipients(r);
        } catch (err) {
            console.error('Error loading campaign report:', err);
            toast.error('Error al cargar el reporte');
        } finally {
            setLoading(false);
        }
    };

    // Computed stats
    const totalSent = recipients.length;
    const totalOpened = recipients.filter(r => ['opened', 'read', 'clicked'].includes(r.interactionStatus)).length;
    const totalClicked = recipients.filter(r => r.interactionStatus === 'clicked').length;
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

    // Filter + search
    const filteredRecipients = recipients.filter(r => {
        const isOpened = ['opened', 'read', 'clicked'].includes(r.interactionStatus);
        if (filter === 'opened' && !isOpened) return false;
        if (filter === 'not_opened' && isOpened) return false;

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
        }
        return true;
    });

    const handleExportCSV = () => {
        const rows = filteredRecipients.map(r => ({
            Nombre: r.name,
            Email: r.email,
            Telefono: r.phone,
            Estado: r.interactionStatus === 'opened' || r.interactionStatus === 'read' ? 'Abierto' :
                    r.interactionStatus === 'clicked' ? 'Clic' : 'Enviado',
            UltimaActividad: r.lastActivity ? new Date(r.lastActivity).toLocaleString() : '-'
        }));

        const csv = [
            Object.keys(rows[0] || {}).join(','),
            ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${campaign?.name || 'campaign'}_report.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado');
    };

    const handleResendToUnopened = () => {
        const unopenedIds = recipients
            .filter(r => !['opened', 'read', 'clicked'].includes(r.interactionStatus))
            .map(r => r.id);

        if (unopenedIds.length === 0) {
            toast('Todos ya abrieron esta campaña 🎉');
            return;
        }

        // Navigate to campaign builder pre-filled with these specific IDs
        navigate('/marketing/campaign/new', {
            state: {
                prefillIds: unopenedIds,
                prefillSubject: `[RE] ${campaign?.subject || campaign?.name || ''}`,
                prefillContent: campaign?.content || ''
            }
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'opened':
            case 'read':
                return <Eye className="w-3.5 h-3.5 text-amber-500" />;
            case 'clicked':
                return <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />;
            case 'failed':
                return <XCircle className="w-3.5 h-3.5 text-red-400" />;
            default:
                return <Send className="w-3.5 h-3.5 text-slate-400" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'opened':
            case 'read':
                return 'Abierto';
            case 'clicked':
                return 'Clic';
            case 'delivered':
                return 'Entregado';
            case 'failed':
                return 'Fallido';
            default:
                return 'Enviado';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'opened':
            case 'read':
                return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'clicked':
                return 'text-blue-600 bg-blue-50 border-blue-100';
            case 'failed':
                return 'text-red-500 bg-red-50 border-red-100';
            default:
                return 'text-slate-500 bg-slate-50 border-slate-100';
        }
    };

    const CHANNEL_ICONS: Record<string, any> = {
        email: Mail,
        whatsapp: Smartphone,
        telegram: Send,
        sms: MessageSquare
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="text-center py-20">
                <p className="text-slate-400">Campaña no encontrada</p>
                <Link to="/marketing/email" className="text-indigo-600 text-sm mt-2 inline-block">← Volver</Link>
            </div>
        );
    }

    const ChannelIcon = CHANNEL_ICONS[campaign.type] || Mail;

    return (
        <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/marketing/email')}
                            className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white transition-all text-slate-400 hover:text-indigo-600 shadow-inner"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <ChannelIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">{campaign.name}</h1>
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border bg-amber-50 text-amber-600 border-amber-100">
                                        {campaign.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest flex items-center gap-1",
                                        campaign.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'
                                    )}>
                                        {campaign.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {campaign.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        • {new Date(campaign.sent_at || campaign.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white transition-all text-slate-400 hover:text-indigo-600"
                        title="Refrescar"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Enviados" value={totalSent} icon={Send} color="text-slate-600" bg="bg-slate-50" />
                <StatCard label="Abiertos" value={totalOpened} icon={Eye} color="text-amber-600" bg="bg-amber-50" />
                <StatCard label="Clicks" value={totalClicked} icon={MousePointerClick} color="text-blue-600" bg="bg-blue-50" />
                <StatCard label="Tasa Apertura" value={`${openRate}%`} icon={Percent} color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            {/* Filter + Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" count={totalSent} />
                    <FilterButton active={filter === 'opened'} onClick={() => setFilter('opened')} label="Abiertos" count={totalOpened} color="text-amber-600" />
                    <FilterButton active={filter === 'not_opened'} onClick={() => setFilter('not_opened')} label="No Abiertos" count={totalSent - totalOpened} color="text-slate-500" />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-3 pr-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Recipients Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-5 py-3">Prospecto</th>
                                <th className="px-5 py-3 hidden md:table-cell">Email</th>
                                <th className="px-5 py-3">Estado</th>
                                <th className="px-5 py-3 hidden lg:table-cell text-right">Última Actividad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRecipients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-16 text-center">
                                        <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">
                                            {filter === 'opened' ? 'Nadie ha abierto esta campaña aún' :
                                             filter === 'not_opened' ? 'Todos los destinatarios abrieron esta campaña 🎉' :
                                             'Sin destinatarios'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecipients.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => navigate('/leads', { state: { leadId: r.id } })}
                                                className="text-left"
                                            >
                                                <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                                    {r.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium md:hidden truncate max-w-[180px]">
                                                    {r.email}
                                                </p>
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 hidden md:table-cell">
                                            <span className="text-[11px] text-slate-500 font-medium truncate block max-w-[220px]">
                                                {r.email}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                                getStatusColor(r.interactionStatus)
                                            )}>
                                                {getStatusIcon(r.interactionStatus)}
                                                {getStatusLabel(r.interactionStatus)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 hidden lg:table-cell text-right">
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {r.lastActivity ? new Date(r.lastActivity).toLocaleString() : '-'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
                {totalSent - totalOpened > 0 && (
                    <button
                        onClick={handleResendToUnopened}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-enviar a {totalSent - totalOpened} que NO abrieron
                    </button>
                )}
                <button
                    onClick={handleExportCSV}
                    className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                </button>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-100 transition-all">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className={cn("text-2xl font-black mt-1 tracking-tight", color)}>{value}</p>
                </div>
                <div className={cn("p-2 rounded-lg", bg)}>
                    <Icon className={cn("w-4 h-4", color)} />
                </div>
            </div>
        </div>
    );
}

function FilterButton({ active, onClick, label, count, color = 'text-slate-600' }: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
    color?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border",
                active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20'
                    : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
            )}
        >
            {label}
            <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[8px] font-black min-w-[20px] text-center",
                active ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'
            )}>
                {count}
            </span>
        </button>
    );
}
