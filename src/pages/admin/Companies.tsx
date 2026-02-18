import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { supabase } from '../../services/supabase';
import type { Company, LicenseStatus } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
    Plus,
    Building,
    Shield,
    User,
    FileText,
    Calendar,
    Megaphone,
    MessageSquare,
    Tag,
    Package,
    Layers,
    CreditCard,
    XCircle,
    Search,
    Settings,
    CheckCircle2,
    Users,
    Info,
    Lock,
    Mail,
    KeyRound,
    Pencil,
    ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAriasTables } from '../../hooks/useAriasTables';

const MODULES_CONFIG = [
    { key: 'leads', label: 'Leads (CRM)', icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'quotes', label: 'Cotizaciones', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'calendar', label: 'Agenda Global', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'marketing', label: 'Marketing Hub', icon: Megaphone, color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'chat', label: 'Chat Omnicanal', icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
    { key: 'branding', label: 'Marca de Empresa', icon: Building, color: 'text-slate-600', bg: 'bg-slate-50' },
    { key: 'pricing', label: 'Config. CRM', icon: Tag, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { key: 'paquetes', label: 'Paquetes / CRM', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
    { key: 'items', label: 'Catálogo CRM', icon: Layers, color: 'text-sky-600', bg: 'bg-sky-50' },
    { key: 'financial_rules', label: 'Reglas Financ.', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'loss_reasons', label: 'Motivos de Pérdida', icon: XCircle, color: 'text-slate-600', bg: 'bg-slate-50' },
];

export default function Companies() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'license' | 'admin'>('info');
    const [formData, setFormData] = useState({
        name: '',
        license_status: 'active' as LicenseStatus,
        tax_id: '',
        phone: '',
        address: '',
        max_users: 5,
        allowed_permissions: [] as string[],
        admin_email: '',
        admin_password: '',
        admin_full_name: ''
    });
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
    const [companyMembers, setCompanyMembers] = useState<{ id: string; email: string; full_name: string; role: string; created_at: string }[]>([]);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [memberEditData, setMemberEditData] = useState({ full_name: '', email: '', phone: '', role: '', address: '', new_password: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<LicenseStatus | 'all'>('all');
    const location = useLocation();
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const { tableRef: companiesTableRef, wrapperRef: companiesWrapperRef } = useAriasTables();

    // Handle incoming filters from Dashboard
    useEffect(() => {
        if (location.state?.status) {
            setStatusFilter(location.state.status);
            // Clear location state but keep other possible states if needed, 
            // though here we just want to avoid re-triggering on history changes
            window.history.replaceState({}, document.title);
        }

        if (location.state?.editCompanyId && companies.length > 0) {
            const companyToEdit = companies.find(c => c.id === location.state.editCompanyId);
            if (companyToEdit) {
                setEditingCompanyId(companyToEdit.id);
                setFormData({
                    name: companyToEdit.name,
                    license_status: companyToEdit.license_status,
                    tax_id: companyToEdit.tax_id || '',
                    phone: companyToEdit.phone || '',
                    address: companyToEdit.address || '',
                    max_users: companyToEdit.max_users || 5,
                    allowed_permissions: companyToEdit.allowed_permissions || [],
                    admin_email: '',
                    admin_password: '',
                    admin_full_name: ''
                });
                setIsModalOpen(true);
            }
            // Clear state after handling
            window.history.replaceState({}, document.title);
        }
    }, [location.state, companies]);

    useEffect(() => {
        loadCompanies();
    }, []);

    const loadCompanies = async () => {
        try {
            const data = await adminService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error('Failed to load companies', error);
        } finally {
            // setLoading(false); // Removed unused loading state
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCompanyId) {
                const { admin_email, admin_password, admin_full_name, ...companyData } = formData;
                await adminService.updateCompany(editingCompanyId, companyData);

                // If editing an existing member, update their profile directly
                if (editingMemberId) {
                    const profileUpdates: any = {};
                    if (memberEditData.full_name) profileUpdates.full_name = memberEditData.full_name;
                    if (memberEditData.email) profileUpdates.email = memberEditData.email;
                    if (memberEditData.phone) profileUpdates.phone = memberEditData.phone;
                    if (memberEditData.role) profileUpdates.role = memberEditData.role;
                    if (memberEditData.address) profileUpdates.address = memberEditData.address;

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update(profileUpdates)
                        .eq('id', editingMemberId);
                    if (profileError) throw profileError;

                    // Update local state
                    setCompanyMembers(prev => prev.map(m =>
                        m.id === editingMemberId ? { ...m, ...profileUpdates } : m
                    ));
                    toast.success('🎉 Empresa y usuario actualizados correctamente');
                } else if (admin_email && admin_password) {
                    // Adding a new admin to the company
                    if (admin_password.length < 6) {
                        toast.error('La contraseña debe tener al menos 6 caracteres');
                        setActiveTab('admin');
                        return;
                    }
                    await adminService.addCompanyAdmin({
                        email: admin_email,
                        password: admin_password,
                        full_name: admin_full_name || null,
                        company_id: editingCompanyId
                    });
                    toast.success('🎉 Empresa actualizada y administrador creado');
                } else {
                    toast.success('Empresa actualizada correctamente');
                }
            } else {
                // Validate admin fields for new company
                if (!formData.admin_email || !formData.admin_password) {
                    toast.error('Configura el administrador inicial de la empresa');
                    setActiveTab('admin');
                    return;
                }
                if (formData.admin_password.length < 6) {
                    toast.error('La contraseña debe tener al menos 6 caracteres');
                    setActiveTab('admin');
                    return;
                }
                await adminService.provisionNewTenant({
                    company_name: formData.name,
                    company_license_status: formData.license_status,
                    company_tax_id: formData.tax_id || null,
                    company_phone: formData.phone || null,
                    company_address: formData.address || null,
                    company_max_users: formData.max_users,
                    company_allowed_permissions: formData.allowed_permissions,
                    admin_email: formData.admin_email,
                    admin_password: formData.admin_password,
                    admin_full_name: formData.admin_full_name || null
                });
                toast.success('🎉 Empresa y administrador creados correctamente');
            }
            setIsModalOpen(false);
            resetForm();
            loadCompanies();
        } catch (error: any) {
            console.error('Failed to save company', error);
            const msg = error.message || '';
            if (msg.includes('users_email_partial_key') || msg.includes('email') && msg.includes('unique')) {
                toast.error('⚠️ Ese email ya está registrado en el sistema. Usa un email diferente.');
                setActiveTab('admin');
            } else {
                toast.error('Error: ' + (msg || 'Error al guardar la empresa'));
            }
        }
    };

    const resetForm = () => {
        setEditingCompanyId(null);
        setEditingMemberId(null);
        setActiveTab('info');
        setFormData({
            name: '',
            license_status: 'active',
            tax_id: '',
            phone: '',
            address: '',
            max_users: 5,
            allowed_permissions: [],
            admin_email: '',
            admin_password: '',
            admin_full_name: ''
        });
    };

    const toggleModule = (moduleKey: string) => {
        setFormData(prev => {
            const current = prev.allowed_permissions || [];
            const exists = current.includes(moduleKey);
            return {
                ...prev,
                allowed_permissions: exists
                    ? current.filter(k => k !== moduleKey)
                    : [...current, moduleKey]
            };
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'expired': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'trial': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'manual_hold': return 'bg-amber-100 text-amber-800 border-amber-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const filteredCompanies = companies.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || c.license_status === statusFilter;
        return matchesSearch && matchesStatus;
    }).sort((a: any, b: any) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-500">
            {/* Header section with Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex gap-6 items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
                        <Shield className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">SaaS Command Center</h1>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                <Building className="w-3.5 h-3.5" /> {companies.length} Organizaciones
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sistema Operativo
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-11 pr-4 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-sm"
                        />
                    </div>
                    <Button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-[#4449AA] hover:bg-[#3b3f94] text-white font-black px-8 rounded-2xl shadow-2xl shadow-indigo-100 h-12 border-0"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Registrar
                    </Button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white shadow-2xl shadow-slate-200/60 rounded-[2.5rem] overflow-hidden border border-slate-200/50">
                <div ref={companiesWrapperRef} className="arias-table-wrapper">
                    <div ref={companiesTableRef} className="arias-table">
                        <table className="min-w-full divide-y divide-slate-100 text-left">
                            <thead className="bg-[#F8FAFC]">
                                <tr>
                                    {[
                                        { key: 'name', label: 'Organización' },
                                        { key: 'license_status', label: 'Suscripción' },
                                        { key: 'max_users', label: 'Capacidad' },
                                        { key: 'allowed_permissions', label: 'Módulos / Licencia' },
                                    ].map(col => (
                                        <th key={col.key} className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            <div
                                                className="cursor-pointer hover:text-[#4449AA] transition-colors group inline-flex items-center gap-1"
                                                onClick={() => setSortConfig({ key: col.key, direction: sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                                            >
                                                {col.label}
                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === col.key ? 'text-[#4449AA]' : 'text-gray-300 group-hover:text-[#4449AA]'} transition-all`} />
                                            </div>
                                        </th>
                                    ))}
                                    <th className="relative px-8 py-6 text-right font-black text-slate-400 text-[11px] uppercase tracking-[0.2em]">Gestionar</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-50">
                                {filteredCompanies.map((company: any) => (
                                    <tr key={company.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <div className="flex items-center gap-5">
                                                <div className="flex-shrink-0 h-14 w-14 bg-indigo-50 rounded-[1.25rem] flex items-center justify-center text-[#4449AA] border border-indigo-100/50 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3 shadow-indigo-50">
                                                    <Building className="h-6 w-6" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="text-lg font-black text-slate-900 leading-none mb-1.5">{company.name}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">ID: {company.id.slice(0, 8)}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                        <span className="text-[10px] text-slate-400 font-bold">Desde {format(new Date(company.created_at), 'MM/yyyy')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <span className={`px-4 py-1.5 inline-flex text-[10px] font-black uppercase tracking-[0.1em] rounded-full border shadow-sm ${getStatusColor(company.license_status)}`}>
                                                {company.license_status === 'active' ? '● Activa' : company.license_status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                    <span className="text-xs font-black text-slate-700">{company.user_count || 0} de {company.max_users || 5}</span>
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase italic">Usuarios</span>
                                                </div>
                                                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                                    <div
                                                        className={`h-full transition-all duration-700 ${(company.user_count || 0) >= (company.max_users || 5) ? 'bg-rose-500' : 'bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]'
                                                            }`}
                                                        style={{ width: `${Math.min(100, ((company.user_count || 0) / (company.max_users || 5)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                                                {((company.allowed_permissions as string[]) || []).map(p => {
                                                    const config = MODULES_CONFIG.find(m => m.key === p);
                                                    return (
                                                        <div
                                                            key={p}
                                                            title={config?.label || p}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm transition-transform hover:scale-110 ${config ? 'bg-white border-slate-200' : 'bg-slate-50 border-transparent'
                                                                }`}
                                                        >
                                                            {config ? (
                                                                <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                                                            ) : (
                                                                <span className="text-[8px] font-black text-slate-300">{p.slice(0, 2)}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {((company.allowed_permissions as string[]) || []).length === 0 && (
                                                    <span className="text-[10px] font-bold text-slate-300 italic uppercase">Sin Licencia</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap text-right">
                                            <button
                                                onClick={async () => {
                                                    setEditingCompanyId(company.id);
                                                    setFormData({
                                                        name: company.name,
                                                        license_status: company.license_status,
                                                        tax_id: company.tax_id || '',
                                                        phone: company.phone || '',
                                                        address: company.address || '',
                                                        max_users: company.max_users || 5,
                                                        allowed_permissions: Array.isArray(company.allowed_permissions) ? company.allowed_permissions : [],
                                                        admin_email: '',
                                                        admin_password: '',
                                                        admin_full_name: ''
                                                    });
                                                    // Load existing members for this company
                                                    const { data: members } = await supabase
                                                        .from('profiles')
                                                        .select('id, email, full_name, role, phone, address, created_at')
                                                        .eq('company_id', company.id)
                                                        .order('created_at', { ascending: true });
                                                    setCompanyMembers(members || []);
                                                    setActiveTab('info');
                                                    setIsModalOpen(true);
                                                }}
                                                className="h-12 px-5 group/btn inline-flex items-center justify-center gap-2 bg-slate-50 text-slate-400 hover:text-[#4449AA] hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100 font-black text-[11px] uppercase tracking-widest"
                                            >
                                                <Settings className="h-4.5 w-4.5 group-hover/btn:rotate-90 transition-transform duration-500" />
                                                <span>Editar</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Redesigned Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCompanyId ? 'Administración Comercial & Licencias' : 'Alta de Nueva Empresa'}
                className="max-w-5xl"
            >
                <div className="flex flex-col h-full max-h-[85vh] -mx-1">
                    {/* Tabs Header - Premium Design */}
                    <div className="flex items-center gap-2 bg-slate-100/50 p-2 rounded-2xl mb-8">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === 'info'
                                ? 'bg-white text-[#4449AA] shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 translate-y-[-1px]'
                                : 'text-slate-400 hover:bg-white/80'
                                }`}
                        >
                            <Info className={`w-4 h-4 ${activeTab === 'info' ? 'text-indigo-600' : 'text-slate-300'}`} />
                            Perfil Corporativo
                        </button>
                        <button
                            onClick={() => setActiveTab('license')}
                            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === 'license'
                                ? 'bg-[#4449AA] text-white shadow-2xl shadow-indigo-200 translate-y-[-1px]'
                                : 'text-slate-400 hover:bg-white/80'
                                }`}
                        >
                            <Shield className={`w-4 h-4 ${activeTab === 'license' ? 'text-white' : 'text-slate-300'}`} />
                            Licencia de Módulos
                        </button>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === 'admin'
                                ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-200 translate-y-[-1px]'
                                : 'text-slate-400 hover:bg-white/80'
                                }`}
                        >
                            <KeyRound className={`w-4 h-4 ${activeTab === 'admin' ? 'text-white' : 'text-slate-300'}`} />
                            {editingCompanyId ? 'Agregar Admin' : 'Admin Inicial'}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-2 space-y-8 pb-4 scroll-smooth">
                            {activeTab === 'info' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                                        <div className="col-span-2">
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Building className="w-3.5 h-3.5" /> Nombre Legal
                                                </label>
                                                <span className="text-[9px] font-bold text-rose-400 uppercase">* Requerido</span>
                                            </div>
                                            <Input
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="Ej: Arias Defense Logistics"
                                                className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white transition-all shadow-sm text-lg"
                                            />
                                        </div>

                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Plan de Suscripción</label>
                                                <select
                                                    value={formData.license_status}
                                                    onChange={(e) => setFormData({ ...formData, license_status: e.target.value as LicenseStatus })}
                                                    className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-black text-sm transition-all focus:bg-white text-slate-700 shadow-sm appearance-none cursor-pointer"
                                                >
                                                    <option value="active">🟢 ACTIVA (Full Service)</option>
                                                    <option value="trial">🔵 PRUEBA (Limitada)</option>
                                                    <option value="expired">🔴 EXPIRADA (Bloqueada)</option>
                                                    <option value="manual_hold">🟠 RETENIDO (Revisión)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Cuota de Usuarios</label>
                                                <div className="relative">
                                                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300" />
                                                    <Input
                                                        type="number"
                                                        required
                                                        min={1}
                                                        value={formData.max_users}
                                                        onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                                                        className="h-14 pl-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Tax ID / RNC</label>
                                                <Input
                                                    value={formData.tax_id}
                                                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                                    placeholder="001-XXXXXXX-X"
                                                    className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Teléfono Corporativo</label>
                                                <Input
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    placeholder="+503 XXXX-XXXX"
                                                    className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Dirección</label>
                                            <Input
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="Dirección de la empresa"
                                                className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'license' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100 ring-1 ring-white/10 group">
                                        <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                                                    <XCircle className="w-6 h-6 text-gray-300" />
                                                </div>
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] opacity-90">Configuración de Acceso Maestro</h4>
                                            </div>
                                            <p className="text-[13px] font-bold text-indigo-100 leading-relaxed max-w-lg">
                                                Selecciona los módulos autorizados para esta licencia. Los módulos bloqueados no serán visibles para ningún usuario, incluyendo administradores locales.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {MODULES_CONFIG.map((module) => {
                                            const isActive = formData.allowed_permissions?.includes(module.key);
                                            return (
                                                <button
                                                    key={module.key}
                                                    type="button"
                                                    onClick={() => toggleModule(module.key)}
                                                    className={`p-5 rounded-[2rem] border-2 flex items-center gap-5 transition-all duration-300 text-left group/mod ${isActive
                                                        ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-50 translate-y-[-4px]'
                                                        : 'bg-slate-50/50 border-slate-100 grayscale hover:grayscale-0 hover:bg-white hover:border-slate-200'
                                                        }`}
                                                >
                                                    <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg transition-all duration-500 border-2 ${isActive ? `${module.bg} ${module.color} border-indigo-100 scale-110` : 'bg-white text-slate-300 border-slate-100 group-hover/mod:scale-105'
                                                        }`}>
                                                        <module.icon className="w-7 h-7" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[13px] font-black uppercase tracking-tight truncate ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                                                            {module.label}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-600' : 'text-slate-300 italic'}`}>
                                                                {isActive ? 'Activo' : 'Desactivado'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'admin' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* User selector - only when editing existing company */}
                                    {editingCompanyId && companyMembers.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-slate-400" />
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleccionar Usuario ({companyMembers.length})</h4>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingMemberId(null);
                                                        setFormData(prev => ({ ...prev, admin_full_name: '', admin_email: '', admin_password: '' }));
                                                        setMemberEditData({ full_name: '', email: '', phone: '', role: 'company_admin', address: '', new_password: '' });
                                                    }}
                                                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${!editingMemberId
                                                        ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200'
                                                        : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'
                                                        }`}
                                                >
                                                    + Nuevo Admin
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {companyMembers.map(member => (
                                                    <button
                                                        key={member.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingMemberId(member.id);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                admin_full_name: member.full_name || '',
                                                                admin_email: member.email || '',
                                                                admin_password: ''
                                                            }));
                                                            setMemberEditData({
                                                                full_name: member.full_name || '',
                                                                email: member.email || '',
                                                                phone: (member as any).phone || '',
                                                                role: member.role,
                                                                address: (member as any).address || '',
                                                                new_password: ''
                                                            });
                                                        }}
                                                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all duration-200 ${editingMemberId === member.id
                                                            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100 shadow-md'
                                                            : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm'
                                                            }`}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                            <span className="text-[11px] font-black text-indigo-600">{(member.full_name || member.email || '?')[0].toUpperCase()}</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[12px] font-bold text-slate-800 truncate">{member.full_name || 'Sin nombre'}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                                                        </div>
                                                        {editingMemberId === member.id && <Pencil className="w-3 h-3 text-indigo-400" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Title banner */}
                                    <div className={`${editingMemberId ? 'bg-indigo-600' : 'bg-emerald-600'} rounded-3xl p-6 text-white relative overflow-hidden shadow-2xl ${editingMemberId ? 'shadow-indigo-100' : 'shadow-emerald-100'} ring-1 ring-white/10 group`}>
                                        <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                                        <div className="relative z-10 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                                {editingMemberId ? <Pencil className="w-5 h-5 text-white" /> : <KeyRound className="w-5 h-5 text-white" />}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-[0.15em] opacity-90">
                                                    {editingMemberId
                                                        ? 'Editando Usuario Existente'
                                                        : editingCompanyId
                                                            ? 'Agregar Nuevo Administrador'
                                                            : 'Administrador Inicial'}
                                                </h4>
                                                <p className="text-[11px] font-bold opacity-70 mt-0.5">
                                                    {editingMemberId
                                                        ? 'Modifica los datos y presiona Guardar abajo.'
                                                        : editingCompanyId
                                                            ? 'Deja vacío si no deseas agregar un nuevo admin.'
                                                            : 'Configura las credenciales del primer administrador.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Unified form fields */}
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                                        <div className="col-span-2">
                                            <div className="flex items-center mb-2 px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5" /> Nombre Completo
                                                </label>
                                            </div>
                                            <Input
                                                value={editingMemberId ? memberEditData.full_name : formData.admin_full_name}
                                                onChange={(e) => {
                                                    if (editingMemberId) {
                                                        setMemberEditData(prev => ({ ...prev, full_name: e.target.value }));
                                                    } else {
                                                        setFormData({ ...formData, admin_full_name: e.target.value });
                                                    }
                                                }}
                                                placeholder="Ej: Juan Pérez"
                                                className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white transition-all shadow-sm text-lg"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Mail className="w-3.5 h-3.5" /> Email de Acceso
                                                </label>
                                                {!editingMemberId && !editingCompanyId && <span className="text-[9px] font-bold text-rose-400 uppercase">* Requerido</span>}
                                            </div>
                                            <Input
                                                type="email"
                                                value={editingMemberId ? memberEditData.email : formData.admin_email}
                                                onChange={(e) => {
                                                    if (editingMemberId) {
                                                        setMemberEditData(prev => ({ ...prev, email: e.target.value }));
                                                    } else {
                                                        setFormData({ ...formData, admin_email: e.target.value });
                                                    }
                                                }}
                                                placeholder="admin@empresa.com"
                                                className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white shadow-sm"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Lock className="w-3.5 h-3.5" /> {editingMemberId ? 'Nueva Contraseña' : 'Contraseña'}
                                                </label>
                                                {!editingMemberId && !editingCompanyId && <span className="text-[9px] font-bold text-rose-400 uppercase">* Requerido</span>}
                                            </div>
                                            <Input
                                                type="password"
                                                value={editingMemberId ? memberEditData.new_password : formData.admin_password}
                                                onChange={(e) => {
                                                    if (editingMemberId) {
                                                        setMemberEditData(prev => ({ ...prev, new_password: e.target.value }));
                                                    } else {
                                                        setFormData({ ...formData, admin_password: e.target.value });
                                                    }
                                                }}
                                                placeholder={editingMemberId ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                                                className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white shadow-sm"
                                            />
                                        </div>

                                        {/* Extra fields visible when editing an existing user */}
                                        {editingMemberId && (
                                            <>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Teléfono</label>
                                                    <Input
                                                        value={memberEditData.phone}
                                                        onChange={(e) => setMemberEditData(prev => ({ ...prev, phone: e.target.value }))}
                                                        placeholder="+1 809-000-0000"
                                                        className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Rol</label>
                                                    <select
                                                        value={memberEditData.role}
                                                        onChange={(e) => setMemberEditData(prev => ({ ...prev, role: e.target.value }))}
                                                        className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-black text-sm transition-all focus:bg-white text-slate-700 shadow-sm appearance-none cursor-pointer"
                                                    >
                                                        <option value="company_admin">Admin</option>
                                                        <option value="sales_rep">Vendedor</option>
                                                        <option value="viewer">Visor (Solo lectura)</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Dirección</label>
                                                    <Input
                                                        value={memberEditData.address}
                                                        onChange={(e) => setMemberEditData(prev => ({ ...prev, address: e.target.value }))}
                                                        placeholder="Dirección del usuario"
                                                        className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {!editingMemberId && (
                                        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex items-start gap-3">
                                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[12px] text-amber-700 font-bold leading-relaxed">
                                                {editingCompanyId
                                                    ? <>Deja los campos vacíos si no necesitas agregar un nuevo admin. Los usuarios existentes no serán afectados.</>
                                                    : <>El administrador recibirá el rol <span className="font-black">Company Admin</span> y tendrá acceso completo a todos los módulos habilitados.</>
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-6 pt-10 mt-6 border-t border-slate-100 shrink-0">
                            <button
                                type="button"
                                className="flex-1 h-14 rounded-2xl text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Cancelar
                            </button>
                            <Button
                                type="submit"
                                className="flex-[2] h-14 rounded-[1.5rem] bg-[#4449AA] hover:bg-[#3b3f94] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-indigo-200 border-0 hover:translate-y-[-2px] transition-all"
                            >
                                {editingCompanyId ? "Guardar Configuración Plan" : "Confirmar Alta de Empresa"}
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
}
