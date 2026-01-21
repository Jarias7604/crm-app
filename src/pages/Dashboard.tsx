import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { BadgeDollarSign, TrendingUp, Users, Target, Building, Calendar, CheckCircle, ChevronDown, Search, Edit2 } from 'lucide-react';
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
    // Process data to get specific funnel layers
    // We expect data to be sorted by status flow
    const getLayerValue = (name: string) => data.find(d => d.name === name)?.value || 0;

    // In this simplified dashboard, we'll map status names to 3 main layers
    const layers = [
        { label: 'Leads Totales', value: data.reduce((sum, d) => sum + d.value, 0), color: '#007BFF' },
        { label: 'En Seguimiento', value: getLayerValue('Nuevo lead') + getLayerValue('Contactado') + getLayerValue('En seguimiento'), color: '#3b82f6' },
        { label: 'Potenciales', value: getLayerValue('En negociación') + getLayerValue('Propuesta enviada'), color: '#60a5fa' },
        { label: 'Ventas Ganadas', value: getLayerValue('Ganado'), color: '#3DCC91' }
    ].filter(l => l.value > 0 || l.label === 'Ventas Ganadas');

    if (layers.length === 0) return <div className="text-gray-400 text-center py-10">No hay datos suficientes</div>;


    return (
        <div className="flex flex-col items-center justify-center w-full py-4">
            <div className="relative w-full max-w-md space-y-2">
                {layers.map((layer, index) => {
                    const maxWidthPercent = 100 - (index * 15);

                    return (
                        <div key={layer.label} className="relative group flex flex-col items-center">
                            {/* Shape */}
                            <div
                                className="h-16 flex items-center justify-center text-white font-bold text-lg shadow-lg relative transition-all duration-300 group-hover:scale-[1.02]"
                                style={{
                                    width: `${maxWidthPercent}%`,
                                    backgroundColor: layer.color,
                                    clipPath: `polygon(0 0, 100% 0, ${100 - 5}% 100%, 5% 100%)`,
                                    zIndex: layers.length - index
                                }}
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-xs opacity-80 uppercase tracking-wider">{layer.label}</span>
                                    <span className="text-xl">{layer.value.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Conversion Arrow */}
                            {index < layers.length - 1 && (
                                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold -my-1 z-0">
                                    <TrendingUp className="w-3 h-3 text-blue-400" />
                                    <span>{Math.round((layers[index + 1].value / layer.value) * 100) || 0}% CONVERSIÓN</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function Dashboard() {
    const { t } = useTranslation();
    const { profile } = useAuth();

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('this_month');

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

    useEffect(() => {
        if (profile?.role === 'super_admin') {
            loadSuperAdminData();
        } else {
            loadCRMData();
        }
    }, [profile, selectedDateRange]);

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
        } catch (error: any) {
            console.error('Update company failed', error);
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

            setFunnelData(statusData.map((item: any) => ({
                name: STATUS_CONFIG[item.name as keyof typeof STATUS_CONFIG]?.label || item.name,
                value: item.value
            })));

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
            <div className="space-y-8 pb-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-extrabold text-[#4449AA]">{t('dashboard.superAdmin.title')}</h2>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    {[
                        { name: t('dashboard.superAdmin.totalCompanies'), value: adminStats.totalCompanies, icon: Building, color: 'text-[#007BFF]', bg: 'bg-blue-50' },
                        { name: t('dashboard.superAdmin.activeTrials'), value: adminStats.activeTrials, icon: Calendar, color: 'text-[#FFA500]', bg: 'bg-orange-50' },
                        { name: t('dashboard.superAdmin.activeLicenses'), value: adminStats.activeLicenses, icon: CheckCircle, color: 'text-[#3DCC91]', bg: 'bg-green-50' },
                    ].map((item) => (
                        <div key={item.name} className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm border border-gray-50 hover:shadow-lg transition-all duration-300">
                            <div className={`p-4 rounded-2xl ${item.bg} w-fit mb-4 transition-transform group-hover:scale-110`}>
                                <item.icon className={`h-8 w-8 ${item.color}`} />
                            </div>
                            <dt className="text-sm font-bold text-gray-400 uppercase tracking-widest">{item.name}</dt>
                            <dd className="mt-1 text-4xl font-extrabold text-[#4449AA]">{item.value}</dd>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Growth Chart */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50">
                        <h3 className="text-xl font-bold text-[#4449AA] mb-6">{t('dashboard.superAdmin.companyGrowthTitle')}</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={companyTrend}>
                                    <defs>
                                        <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#007BFF" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#007BFF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F7FA" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#007BFF" strokeWidth={4} fill="url(#colorAdmin)" dot={{ fill: '#007BFF', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Companies */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-[#4449AA]">{t('dashboard.superAdmin.recentCompaniesTitle')}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-[#F5F7FA]">
                                    <tr>
                                        <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.superAdmin.columnName')}</th>
                                        <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                                        <th className="px-8 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentCompanies.map((comp) => (
                                        <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="text-sm font-bold text-[#4449AA]">{comp.name}</div>
                                                <div className="text-xs text-gray-400">{comp.user_count || 0} usuarios</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${comp.license_status === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                                    }`}>
                                                    {comp.license_status || 'trial'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button onClick={() => handleEditCompany(comp)} className="text-[#007BFF] hover:bg-blue-50 p-2 rounded-xl transition-all">
                                                    <Edit2 className="w-4 h-4" />
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
        <div className="space-y-8 pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-[#4449AA] leading-tight">{t('dashboard.crm.title')}</h2>
                    <p className="text-gray-400 font-medium">Resumen integral de ventas y prospección</p>
                </div>
                <FilterDropdown />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { name: t('dashboard.crm.totalPipeline'), value: `$${stats.totalPipeline.toLocaleString()}`, icon: BadgeDollarSign, color: 'text-[#007BFF]', bg: 'bg-blue-50' },
                    { name: t('dashboard.crm.totalLeads'), value: stats.totalLeads, icon: Users, color: 'text-[#4449AA]', bg: 'bg-slate-100' },
                    { name: t('dashboard.crm.wonDeals'), value: stats.wonDeals, icon: Target, color: 'text-[#3DCC91]', bg: 'bg-green-50' },
                    { name: t('dashboard.crm.conversionRate'), value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-[#FFA500]', bg: 'bg-orange-50' },
                ].map((item) => (
                    <div key={item.name} className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm border border-gray-50 hover:shadow-xl transition-all duration-300">
                        <div className={`p-4 rounded-2xl ${item.bg} w-fit mb-4 transition-transform group-hover:scale-110`}>
                            <item.icon className={`h-8 w-8 ${item.color}`} />
                        </div>
                        <dt className="text-sm font-bold text-gray-400 uppercase tracking-widest">{item.name}</dt>
                        <dd className="mt-1 text-3xl font-extrabold text-[#4449AA]">{item.value}</dd>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Funnel Infographic (Spans more columns) */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-50 lg:col-span-12 xl:col-span-8 flex flex-col">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-bold text-[#4449AA]">{t('dashboard.crm.funnelTitle')}</h3>
                        <div className="bg-[#F5F7FA] px-4 py-1 rounded-full text-[10px] font-bold text-gray-400 tracking-wider">KPI: VISUAL FUNNEL</div>
                    </div>
                    <div className="flex-grow flex items-center justify-center">
                        <FunnelInfographic data={funnelData} />
                    </div>
                </div>

                {/* Sources Pie (Smaller, on the side) */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-50 lg:col-span-12 xl:col-span-4">
                    <h3 className="text-xl font-bold text-[#4449AA] mb-8">{t('dashboard.crm.sourcesTitle')}</h3>
                    <div className="flex flex-col items-center">
                        <div className="h-64 w-full relative">
                            {sourceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                                            {sourceData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-300 font-bold">SIN DATOS</div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full mt-8">
                            {sourceData.slice(0, 4).map((entry, index) => (
                                <div key={entry.name} className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase truncate">{entry.name}</span>
                                    </div>
                                    <span className="text-lg font-extrabold text-[#4449AA] ml-4">{entry.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Priority Chart (Full Width) */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-50 lg:col-span-12">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-[#4449AA] flex items-center gap-2">
                                <Target className="w-6 h-6 text-[#FFA500]" />
                                Priorización Estratégica
                            </h3>
                            <p className="text-sm text-gray-400 font-medium">Haz clic en una categoría para gestionar los leads</p>
                        </div>
                    </div>
                    <div className="h-72">
                        {priorityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F7FA" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <Tooltip
                                        cursor={{ fill: '#F5F7FA' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        radius={[8, 8, 8, 8]}
                                        barSize={45}
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
                            <div className="h-full flex items-center justify-center text-gray-300 font-bold uppercase tracking-widest">Esperando actividad de leads</div>
                        )}
                    </div>
                </div>

                {/* Top Opportunities Table (Full Width) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden lg:col-span-12">
                    <div className="p-8 border-b border-gray-50">
                        <h3 className="text-xl font-bold text-[#4449AA]">{t('dashboard.crm.topOppTitle')}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-[#F5F7FA]">
                                <tr>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.crm.columnName')}</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.crm.columnValue')}</th>
                                    <th className="px-8 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.crm.columnStatus')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topOpportunities.length > 0 ? topOpportunities.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="text-sm font-bold text-[#4449AA]">{lead.name}</div>
                                            {lead.company_name && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{lead.company_name}</div>}
                                        </td>
                                        <td className="px-8 py-6 text-xs text-[#94a3b8] font-bold">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
                                        <td className="px-8 py-6 text-lg font-extrabold text-[#3DCC91] font-mono">${(lead.value || 0).toLocaleString()}</td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="px-4 py-1.5 text-[10px] font-extrabold uppercase rounded-full bg-blue-50 text-[#007BFF]">
                                                {STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.label || lead.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-16 text-center text-gray-400 font-bold uppercase tracking-widest">
                                            Sin oportunidades activas
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

