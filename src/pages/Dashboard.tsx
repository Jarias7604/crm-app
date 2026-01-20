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

const COLORS = {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    slate: '#64748b'
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.yellow, COLORS.purple, COLORS.red, COLORS.slate];

export default function Dashboard() {
    const { t } = useTranslation();
    const { profile } = useAuth();

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('this_month');
    // const [loading, setLoading] = useState(true); // typescript error fix: unused variable

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

    // Close filter when clicking outside
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
        // setLoading(false);
        try {
            const companies = await adminService.getCompanies();
            const totalCompanies = companies.length;
            const activeTrials = companies.filter(c => c.license_status === 'trial').length || 0;
            const activeLicenses = companies.filter(c => c.license_status === 'active').length || 0;

            setAdminStats({ totalCompanies, activeTrials, activeLicenses });
            setRecentCompanies(companies.slice(0, 8)); // Show more for super admin

            // Mock trend data
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
        } finally {
            // setLoading(false);
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
            alert('✅ Empresa actualizada correctamente');
        } catch (error: any) {
            alert(`❌ Error: ${error.message}`);
        } finally {
            setIsUpdatingCompany(false);
        }
    };

    const loadCRMData = async () => {
        // // setLoading(false);
        try {
            // Calculate date range
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

            console.log('Dashboard loading data for range:', selectedDateRange, { startDate, endDate });

            // Fetch all data in parallel for speed
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
        } finally {
            // // setLoading(false);
        }
    };

    const FilterDropdown = () => (
        <div className="relative" ref={filterRef}>
            <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center space-x-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all shadow-sm"
            >
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{DATE_RANGE_OPTIONS[selectedDateRange].label}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setSelectedDateRange(key);
                                setIsFilterOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${selectedDateRange === key
                                ? 'bg-blue-50 text-blue-700 font-semibold'
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
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">{t('dashboard.superAdmin.title')}</h2>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    {[
                        { name: t('dashboard.superAdmin.totalCompanies'), value: adminStats.totalCompanies, icon: Building, color: 'bg-blue-600' },
                        { name: t('dashboard.superAdmin.activeTrials'), value: adminStats.activeTrials, icon: Calendar, color: 'bg-yellow-500' },
                        { name: t('dashboard.superAdmin.activeLicenses'), value: adminStats.activeLicenses, icon: CheckCircle, color: 'bg-green-600' },
                    ].map((item) => (
                        <div key={item.name} className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <dt>
                                <div className={`absolute rounded-lg p-3 ${item.color}`}>
                                    <item.icon className="h-6 w-6 text-white" />
                                </div>
                                <p className="ml-16 text-sm font-medium text-gray-500">{item.name}</p>
                            </dt>
                            <dd className="ml-16 text-2xl font-bold text-gray-900">{item.value}</dd>
                        </div>
                    ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('dashboard.superAdmin.companyGrowthTitle')}</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={companyTrend}>
                                    <defs>
                                        <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#colorAdmin)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">{t('dashboard.superAdmin.recentCompaniesTitle')}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.superAdmin.columnName')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miembros</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.superAdmin.columnStatus')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {recentCompanies.length > 0 ? recentCompanies.map((comp) => (
                                        <tr key={comp.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{comp.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {comp.user_count || 0} / {comp.max_users || 5}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${comp.license_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {comp.license_status || 'trial'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleEditCompany(comp)}
                                                    className="text-blue-600 hover:text-blue-900 p-1"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-12 text-center">
                                                <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                                                <p className="text-sm text-gray-500">No hay empresas registradas.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Edit Company Modal */}
                <Modal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} title="Editar Empresa">
                    {editingCompany && (
                        <form onSubmit={handleUpdateCompany} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                                <Input
                                    required
                                    value={editingCompany.name}
                                    onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Estado de Licencia</label>
                                    <select
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm"
                                        value={editingCompany.license_status}
                                        onChange={e => setEditingCompany({ ...editingCompany, license_status: e.target.value })}
                                    >
                                        <option value="trial">Prueba (Trial)</option>
                                        <option value="active">Activa</option>
                                        <option value="suspended">Suspendida</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Límite de Usuarios</label>
                                    <Input
                                        type="number"
                                        value={editingCompany.max_users || 5}
                                        onChange={e => setEditingCompany({ ...editingCompany, max_users: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsCompanyModalOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isUpdatingCompany}>
                                    {isUpdatingCompany ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                            </div>
                        </form>
                    )}
                </Modal>
            </div>
        );
    }

    // CRM DASHBOARD
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">{t('dashboard.crm.title')}</h2>
                <FilterDropdown />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { name: t('dashboard.crm.totalPipeline'), value: `$${stats.totalPipeline.toLocaleString()}`, icon: BadgeDollarSign, color: 'bg-blue-600' },
                    { name: t('dashboard.crm.totalLeads'), value: stats.totalLeads, icon: Users, color: 'bg-indigo-600' },
                    { name: t('dashboard.crm.wonDeals'), value: stats.wonDeals, icon: Target, color: 'bg-green-600' },
                    { name: t('dashboard.crm.conversionRate'), value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'bg-purple-600' },
                ].map((item) => (
                    <div key={item.name} className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <dt>
                            <div className={`absolute rounded-lg p-3 ${item.color}`}>
                                <item.icon className="h-6 w-6 text-white" />
                            </div>
                            <p className="ml-16 text-sm font-medium text-gray-500">{item.name}</p>
                        </dt>
                        <dd className="ml-16 text-2xl font-bold text-gray-900">{item.value}</dd>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Funnel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">{t('dashboard.crm.funnelTitle')}</h3>
                    <div className="h-80">
                        {funnelData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnelData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill={COLORS.blue} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <p>No hay datos de leads</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sources Pie */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">{t('dashboard.crm.sourcesTitle')}</h3>
                    <div className="flex flex-col md:flex-row items-center justify-center">
                        <div className="h-64 w-64 relative">
                            {sourceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {sourceData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <p>Sin datos</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 md:mt-0 md:ml-6 space-y-2">
                            {sourceData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                    <span className="text-sm text-gray-600">{entry.name}</span>
                                    <span className="text-sm font-bold text-gray-800">{entry.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Leads by Priority - Action Directa */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-red-500" />
                    Priorización Directa
                </h3>
                <p className="text-sm text-gray-500 mb-6">Acción inmediata: Haz clic en una prioridad para ver y llamar a los leads.</p>
                <div className="h-64">
                    {priorityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                    onClick={(data) => {
                                        if (data && data.key) {
                                            console.log('Bar clicked directly:', data.key);
                                            navigate('/leads', { state: { priority: data.key } });
                                        }
                                    }}
                                >
                                    {priorityData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            onClick={(e) => {
                                                e?.stopPropagation(); // Prevent double trigger if Bar also fires
                                                console.log('Cell clicked:', entry.key);
                                                navigate('/leads', { state: { priority: entry.key } });
                                            }}
                                            fill={
                                                entry.key === 'very_high' ? '#ef4444' :
                                                    entry.key === 'high' ? '#f97316' :
                                                        entry.key === 'medium' ? '#facc15' : '#94a3b8'
                                            }
                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            <p>No hay datos de prioridad aún</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Opportunities */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">{t('dashboard.crm.topOppTitle')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.crm.columnName')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.crm.columnValue')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.crm.columnStatus')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {topOpportunities.length > 0 ? topOpportunities.map((lead) => (
                                <tr key={lead.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                                        {lead.company_name && <div className="text-xs text-gray-500">{lead.company_name}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
                                    <td className="px-6 py-4 text-sm font-mono text-green-600">${(lead.value || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.label || lead.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                        No hay oportunidades. Crea tu primer lead.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
