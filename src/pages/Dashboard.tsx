import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { BadgeDollarSign, TrendingUp, Users, Target, Building, Calendar, CheckCircle, ChevronDown, Edit2 } from 'lucide-react';
import { adminService } from '../services/admin';
import { useEffect, useState, useRef } from 'react';
import {
    startOfToday, endOfToday,
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    subMonths,
    startOfYear, endOfYear
} from 'date-fns';
import { useAuth } from '../auth/AuthProvider';
import { leadsService } from '../services/leads';
import { STATUS_CONFIG, PRIORITY_CONFIG, DATE_RANGE_OPTIONS, type DateRange } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';

const THEME = {
    primary: '#007BFF',   // Azul Eléctrico
    background: '#FFFFFF', // Blanco Nieve
    surface: '#F5F7FA',    // Gris Ultra-Claro
    text: '#4449AA',       // Gris Carbón
    accent: '#FFA500',     // Naranja Coral
    success: '#3DCC91',     // Verde Menta
    neutral: '#94a3b8'
};

const PIE_COLORS = [THEME.primary, THEME.success, THEME.accent, '#8b5cf6', '#64748b', '#E2E8F0'];

const FunnelInfographic = ({ data }: { data: any[] }) => {
    // 10-STAGE COMPLETE EXCLUSIVE FUNNEL
    // Logic: Exact status match per layer, strictly following user requested order.

    // Helper calculate EXACT count
    const count = (status: string) => {
        const item = data.find(d => d.key === status);
        return item ? item.value : 0;
    };

    // Data Extraction based on Order
    const prospectos = count('Prospecto');
    const calificados = count('Lead calificado');
    const sinRespuesta = count('Sin respuesta');
    const frios = count('Lead frío');
    const contactados = count('Contactado');
    const cotizaciones = count('Cotización enviada');
    const negociaciones = count('Seguimiento / Negociación');
    const cerrados = count('Cerrado');
    const clientes = count('Cliente');
    const perdidos = count('Perdido');

    // Total active for percentage/context (excluding lost)
    const totalLeads = data.reduce((sum, d) => sum + d.value, 0);

    const layers = [
        { label: 'Prospecto', value: prospectos, color: '#3b82f6' },                     // Blue 500
        { label: 'Lead Calificado', value: calificados, color: '#6366f1' },              // Indigo 500
        { label: 'Sin Respuesta', value: sinRespuesta, color: '#94a3b8' },               // Slate 400
        { label: 'Lead Frío', value: frios, color: '#64748b' },                          // Slate 500
        { label: 'Contactado', value: contactados, color: '#8b5cf6' },                   // Violet 500
        { label: 'Cotización Enviada', value: cotizaciones, color: '#eab308' },          // Yellow 500
        { label: 'Negociación', value: negociaciones, color: '#f97316' },                // Orange 500
        { label: 'Cerrado', value: cerrados, color: '#10b981' },                         // Emerald 500
        { label: 'Cliente', value: clientes, color: '#059669' },                         // Emerald 600
        { label: 'Perdido', value: perdidos, color: '#ef4444' }                          // Red 500
    ];

    console.log('🔍 Funnel 10-Layers:', layers);

    if (data.length === 0) return <div className="text-gray-400 text-center py-10">No hay datos suficientes</div>;

    return (
        <div className="flex flex-col items-center justify-center w-full py-4">
            <div className="relative w-full max-w-md space-y-1.5">
                {layers.filter(l => l.value > 0).map((layer, index, filteredLayers) => {
                    // Tapering logic: Adjust based on filtered count
                    const maxWidthPercent = 100 - (index * (40 / Math.max(filteredLayers.length, 1)));

                    return (
                        <div key={layer.label} className="relative group flex flex-col items-center">
                            {/* Shape with custom clipPath */}
                            <div
                                className="h-9 flex items-center justify-center text-white font-bold text-xs shadow-sm relative transition-all duration-300 group-hover:scale-[1.02]"
                                style={{
                                    width: `${maxWidthPercent}%`,
                                    backgroundColor: layer.color,
                                    // Gentle trapezoid
                                    clipPath: `polygon(2% 0, 98% 0, 95% 100%, 5% 100%)`,
                                    zIndex: 20 - index
                                }}
                            >
                                <div className="flex flex-row items-center gap-2 px-2 truncate w-full justify-center">
                                    <span className="text-[10px] opacity-90 uppercase tracking-widest truncate">{layer.label}</span>
                                    <span className="text-sm bg-black/10 px-1.5 rounded">{layer.value}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="text-center mt-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total: {totalLeads}</span>
                </div>
            </div>
        </div>
    );
};




export default function Dashboard() {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const location = useLocation();

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('this_month');
    const [refreshKey, setRefreshKey] = useState(Date.now());

    // Real data states
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalPipeline: 0,
        wonDeals: 0,
        conversionRate: 0,
    });
    const [funnelData, setFunnelData] = useState<any[]>([]);
    const [sourceData, setSourceData] = useState<any[]>([]);
    const [priorityData, setPriorityData] = useState<any[]>([]);
    const [topOpportunities, setTopOpportunities] = useState<any[]>([]);

    const navigate = useNavigate();

    // Super Admin states
    const [adminStats, setAdminStats] = useState({
        totalCompanies: 0,
        activeTrials: 0,
        activeLicenses: 0
    });
    const [recentCompanies, setRecentCompanies] = useState<any[]>([]);
    const [companyTrend, setCompanyTrend] = useState<any[]>([]);
    const [editingCompany, setEditingCompany] = useState<any>(null);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

    // Refresh data when navigating to Dashboard or when filters change
    useEffect(() => {
        // Update refresh key to force data reload
        setRefreshKey(Date.now());
    }, [location.pathname]);

    useEffect(() => {
        if (profile?.role === 'super_admin') {
            loadSuperAdminData();
        } else if (profile) {
            loadCRMData();
        }
    }, [profile, selectedDateRange, refreshKey]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadSuperAdminData = async () => {
        try {
            const companies = await adminService.getCompanies();
            const totalCompanies = companies.length;
            const activeTrials = companies.filter(c => c.license_status === 'trial').length || 0;
            const activeLicenses = companies.filter(c => c.license_status === 'active').length || 0;

            setAdminStats({ totalCompanies, activeTrials, activeLicenses });
            setRecentCompanies(companies.slice(0, 8));

            setCompanyTrend([
                { name: 'Ene', value: Math.max(1, totalCompanies - 5) },
                { name: 'Feb', value: Math.max(1, totalCompanies - 4) },
                { name: 'Mar', value: Math.max(1, totalCompanies - 3) },
                { name: 'Abr', value: Math.max(1, totalCompanies - 2) },
                { name: 'May', value: Math.max(1, totalCompanies - 1) },
                { name: 'Jun', value: totalCompanies },
            ]);
        } catch (error) {
            console.error('Failed to load admin data', error);
        }
    };

    const handleEditCompany = (company: any) => {
        setEditingCompany({ ...company });
        setIsCompanyModalOpen(true);
    };

    const handleUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCompany) return;
        setIsUpdatingCompany(true);
        try {
            await adminService.updateCompany(editingCompany.id, {
                name: editingCompany.name,
                license_status: editingCompany.license_status,
                max_users: editingCompany.max_users
            });
            setIsCompanyModalOpen(false);
            loadSuperAdminData();
            toast.success('Configuración de empresa actualizada');
        } catch (error: any) {
            console.error('Update company failed', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsUpdatingCompany(false);
        }
    };

    const loadCRMData = async () => {
        try {
            const now = new Date();
            let startDate: string | undefined;
            let endDate: string | undefined;

            switch (selectedDateRange) {
                case 'today':
                    startDate = startOfToday().toISOString().split('.')[0] + 'Z';
                    endDate = endOfToday().toISOString().split('.')[0] + 'Z';
                    break;
                case 'this_week':
                    startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('.')[0] + 'Z';
                    endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString().split('.')[0] + 'Z';
                    break;
                case 'this_month':
                    startDate = startOfMonth(now).toISOString().split('.')[0] + 'Z';
                    endDate = endOfMonth(now).toISOString().split('.')[0] + 'Z';
                    break;
                case 'last_3_months':
                    startDate = startOfMonth(subMonths(now, 2)).toISOString().split('.')[0] + 'Z';
                    endDate = endOfMonth(now).toISOString().split('.')[0] + 'Z';
                    break;
                case 'last_6_months':
                    startDate = startOfMonth(subMonths(now, 5)).toISOString().split('.')[0] + 'Z';
                    endDate = endOfMonth(now).toISOString().split('.')[0] + 'Z';
                    break;
                case 'this_year':
                    startDate = startOfYear(now).toISOString().split('.')[0] + 'Z';
                    endDate = endOfYear(now).toISOString().split('.')[0] + 'Z';
                    break;
            }

            const [realStats, statusData, sources, topOpps, priorities] = await Promise.all([
                leadsService.getLeadStats(startDate, endDate),
                leadsService.getLeadsByStatus(startDate, endDate),
                leadsService.getLeadsBySource(startDate, endDate),
                leadsService.getTopOpportunities(4, startDate, endDate),
                leadsService.getLeadsByPriority(startDate, endDate)
            ]);

            setStats({
                totalLeads: realStats.totalLeads,
                totalPipeline: realStats.totalPipeline,
                wonDeals: realStats.wonDeals,
                conversionRate: realStats.conversionRate,
            });

            const mappedFunnelData = statusData.map((item: any) => {
                const config = STATUS_CONFIG[item.name as keyof typeof STATUS_CONFIG];
                return {
                    key: item.name,
                    name: config?.label || item.name,
                    value: item.value
                };
            });

            console.log('📊 Dashboard: Raw status data from DB:', statusData);
            console.log('📊 Dashboard: Mapped funnel data:', mappedFunnelData);

            setFunnelData(mappedFunnelData);

            const total = sources.reduce((sum, s) => sum + s.value, 0);
            setSourceData(sources.map(s => ({
                name: s.name,
                value: total > 0 ? Math.round((s.value / total) * 100) : 0
            })));

            setTopOpportunities(topOpps || []);

            setPriorityData(priorities.map(p => ({
                name: (PRIORITY_CONFIG as any)[p.name]?.label || p.name,
                value: p.value,
                key: p.name
            })).sort((a, b) => {
                const order = ['very_high', 'high', 'medium', 'low'];
                return order.indexOf(a.key) - order.indexOf(b.key);
            }));

        } catch (error) {
            console.error('Failed to load CRM data', error);
        }
    };

    const FilterDropdown = () => (
        <div className="relative" ref={filterRef}>
            <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center space-x-2 bg-white border border-gray-100 text-[#4449AA] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm"
            >
                <Calendar className="h-4 w-4 text-[#007BFF]" />
                <span>{DATE_RANGE_OPTIONS[selectedDateRange].label}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
                <div className="absolute left-0 sm:right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setSelectedDateRange(key);
                                setIsFilterOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${selectedDateRange === key
                                ? 'bg-blue-50 text-[#007BFF] font-bold'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {option.label}
                            {selectedDateRange === key && <CheckCircle className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    // SUPER ADMIN VIEW
    if (profile?.role === 'super_admin') {
        return (
            <div className="space-y-6 pb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-extrabold text-[#4449AA]">{t('dashboard.superAdmin.title')}</h2>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        { name: t('dashboard.superAdmin.totalCompanies'), value: adminStats.totalCompanies, icon: Building, color: 'text-[#007BFF]', bg: 'bg-blue-50' },
                        { name: t('dashboard.superAdmin.activeTrials'), value: adminStats.activeTrials, icon: Calendar, color: 'text-[#FFA500]', bg: 'bg-orange-50' },
                        { name: t('dashboard.superAdmin.activeLicenses'), value: adminStats.activeLicenses, icon: CheckCircle, color: 'text-[#3DCC91]', bg: 'bg-green-50' },
                    ].map((item) => (
                        <div key={item.name} className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-gray-50 hover:shadow-md transition-all duration-300">
                            <div className={`p-3 rounded-xl ${item.bg} w-fit mb-3 transition-transform group-hover:scale-110`}>
                                <item.icon className={`h-6 w-6 ${item.color}`} />
                            </div>
                            <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.name}</dt>
                            <dd className="mt-1 text-2xl font-extrabold text-[#4449AA]">{item.value}</dd>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Growth Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50">
                        <h3 className="text-lg font-bold text-[#4449AA] mb-4">{t('dashboard.superAdmin.companyGrowthTitle')}</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={companyTrend}>
                                    <defs>
                                        <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#007BFF" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#007BFF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F7FA" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#007BFF" strokeWidth={3} fill="url(#colorAdmin)" dot={{ fill: '#007BFF', strokeWidth: 1, r: 3 }} activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Companies */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-[#4449AA]">{t('dashboard.superAdmin.recentCompaniesTitle')}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-[#F5F7FA]">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.superAdmin.columnName')}</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentCompanies.map((comp) => (
                                        <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-bold text-[#4449AA]">{comp.name}</div>
                                                <div className="text-[9px] text-gray-400">{comp.user_count || 0} usuarios</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${comp.license_status === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                                    }`}>
                                                    {comp.license_status || 'trial'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleEditCompany(comp)} className="text-[#007BFF] hover:bg-blue-50 p-1.5 rounded-lg transition-all">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <Modal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} title="Configuración de Empresa">
                    {editingCompany && (
                        <form onSubmit={handleUpdateCompany} className="p-2 space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Nombre Jurídico</label>
                                <Input required value={editingCompany.name} onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} className="rounded-xl border-gray-100 focus:border-[#007BFF]" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Licencia</label>
                                    <select className="w-full bg-[#F5F7FA] border-none rounded-xl p-3 text-sm font-semibold text-[#4449AA]" value={editingCompany.license_status} onChange={e => setEditingCompany({ ...editingCompany, license_status: e.target.value })}>
                                        <option value="trial">PRUEBA</option>
                                        <option value="active">ACTIVA</option>
                                        <option value="suspended">SUSPENDIDA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Usuarios Máx.</label>
                                    <Input type="number" value={editingCompany.max_users || 5} onChange={e => setEditingCompany({ ...editingCompany, max_users: Number(e.target.value) })} className="rounded-xl border-gray-100" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsCompanyModalOpen(false)}>Descartar</Button>
                                <Button type="submit" disabled={isUpdatingCompany} className="bg-[#007BFF] text-white rounded-xl px-8">
                                    {isUpdatingCompany ? 'Aplicando...' : 'Confirmar Cambios'}
                                </Button>
                            </div>
                        </form>
                    )}
                </Modal>
            </div>
        );
    }

    // CRM DASHBOARD VIEW
    return (
        <div className="space-y-5 pb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#4449AA] leading-tight">{t('dashboard.crm.title')}</h2>
                    <p className="text-xs text-gray-400 font-medium italic">Ventas y prospección en tiempo real</p>
                </div>
                <FilterDropdown />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { name: t('dashboard.crm.totalPipeline'), value: `$${stats.totalPipeline.toLocaleString()}`, icon: BadgeDollarSign, color: 'text-[#007BFF]', bg: 'bg-blue-50' },
                    { name: t('dashboard.crm.totalLeads'), value: stats.totalLeads, icon: Users, color: 'text-[#4449AA]', bg: 'bg-slate-100' },
                    { name: t('dashboard.crm.wonDeals'), value: stats.wonDeals, icon: Target, color: 'text-[#3DCC91]', bg: 'bg-green-50' },
                    { name: t('dashboard.crm.conversionRate'), value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-[#FFA500]', bg: 'bg-orange-50' },
                ].map((item) => (
                    <div key={item.name} className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-gray-50 hover:shadow-md transition-all duration-300">
                        <div className={`p-3 rounded-xl ${item.bg} w-fit mb-3 transition-transform group-hover:scale-110`}>
                            <item.icon className={`h-6 w-6 ${item.color}`} />
                        </div>
                        <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.name}</dt>
                        <dd className="mt-1 text-2xl font-extrabold text-[#4449AA]">{item.value}</dd>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Funnel Infographic */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 lg:col-span-12 xl:col-span-8 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-[#4449AA]">{t('dashboard.crm.funnelTitle')}</h3>
                        <div className="bg-[#F5F7FA] px-3 py-0.5 rounded-full text-[9px] font-bold text-gray-400 tracking-wider">VISUAL KPI</div>
                    </div>
                    <div className="flex-grow flex items-center justify-center">
                        <FunnelInfographic data={funnelData} />
                    </div>
                </div>

                {/* Sources Pie */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 lg:col-span-12 xl:col-span-4">
                    <h3 className="text-lg font-bold text-[#4449AA] mb-4">{t('dashboard.crm.sourcesTitle')}</h3>
                    <div className="flex flex-col items-center">
                        <div className="h-52 w-full relative">
                            {sourceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={70} paddingAngle={8} dataKey="value" stroke="none">
                                            {sourceData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-300 font-bold text-[10px]">SIN DATOS</div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 w-full mt-4">
                            {sourceData.slice(0, 4).map((entry, index) => (
                                <div key={entry.name} className="flex flex-col">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                        <span className="text-[9px] font-bold text-gray-400 uppercase truncate">{entry.name}</span>
                                    </div>
                                    <span className="text-base font-extrabold text-[#4449AA] ml-3">{entry.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Priority Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 lg:col-span-12">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-[#4449AA] flex items-center gap-2">
                            <Target className="w-5 h-5 text-[#FFA500]" />
                            Priorización Estratégica
                        </h3>
                    </div>
                    <div className="h-56">
                        {priorityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F7FA" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip
                                        cursor={{ fill: '#F5F7FA' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        radius={[6, 6, 6, 6]}
                                        barSize={32}
                                    >
                                        {priorityData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                onClick={() => navigate('/leads', { state: { priority: entry.key } })}
                                                fill={
                                                    entry.key === 'very_high' ? '#3DCC91' :
                                                        entry.key === 'high' ? '#007BFF' :
                                                            entry.key === 'medium' ? '#FFA500' : '#E2E8F0'
                                                }
                                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-300 font-bold text-[9px] uppercase tracking-widest">Sin actividad</div>
                        )}
                    </div>
                </div>

                {/* Top Opportunities Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden lg:col-span-12">
                    <div className="p-6 border-b border-gray-50">
                        <h3 className="text-lg font-bold text-[#4449AA]">{t('dashboard.crm.topOppTitle')}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-[#F5F7FA]">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.crm.columnName')}</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.crm.columnValue')}</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.crm.columnStatus')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topOpportunities.length > 0 ? topOpportunities.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="text-xs font-bold text-[#4449AA]">{lead.name}</div>
                                            {lead.company_name && <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{lead.company_name}</div>}
                                        </td>
                                        <td className="px-6 py-3.5 text-[10px] text-[#94a3b8] font-bold">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-3.5 text-base font-extrabold text-[#3DCC91] font-mono">${(lead.value || 0).toLocaleString()}</td>
                                        <td className="px-6 py-3.5 text-right">
                                            <span className="px-3 py-1 text-[9px] font-extrabold uppercase rounded-full bg-blue-50 text-[#007BFF]">
                                                {STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.label || lead.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                                            Sin oportunidades
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

