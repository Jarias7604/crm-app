import { useEffect, useState, useRef } from 'react';
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
    Users,
    Info,
    KeyRound,
    Pencil,
    Loader2,
    X,
    Trash2,
    CheckCircle2,
    Copy,
    Lock,
    Mail,
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
    { key: 'items', label: 'CatÃ¡logo CRM', icon: Layers, color: 'text-sky-600', bg: 'bg-sky-50' },
    { key: 'financial_rules', label: 'Reglas Financ.', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'loss_reasons', label: 'Motivos de PÃ©rdida', icon: XCircle, color: 'text-slate-600', bg: 'bg-slate-50' },
    { key: 'proyectos', label: 'GestiÃ³n de Proyectos', icon: Layers, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { key: 'finanzas', label: 'Finanzas', icon: CreditCard, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    { key: 'tickets', label: 'Service Hub', icon: Megaphone, color: 'text-orange-600', bg: 'bg-orange-50' },
    { key: 'reports', label: 'Reportes BI', icon: FileText, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
    { key: 'view_financials', label: 'Montos Financieros', icon: CreditCard, color: 'text-rose-700', bg: 'bg-rose-100' },
];

const PLAN_DEFAULT_MODULES: Record<string, string[]> = {
    trial:       ['leads', 'quotes', 'calendar', 'loss_reasons'],
    active:      ['leads', 'quotes', 'calendar', 'marketing', 'chat', 'loss_reasons', 'pricing', 'paquetes', 'items', 'proyectos', 'finanzas', 'tickets', 'reports', 'view_financials'],
    manual_hold: ['leads', 'quotes', 'calendar', 'loss_reasons', 'proyectos', 'tickets'],
    expired:     [],
    suspended:   [],
};

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
        allowed_permissions: PLAN_DEFAULT_MODULES['active'] as string[],
        admin_email: '',
        admin_password: '',
        admin_full_name: ''
    });
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
    const [companyMembers, setCompanyMembers] = useState<{ id: string; email: string; full_name: string; role: string; created_at: string }[]>([]);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [memberEditData, setMemberEditData] = useState({ full_name: '', email: '', phone: '', role: '', address: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<LicenseStatus | 'all'>('all');
    const location = useLocation();

    const [showPasswordPanel, setShowPasswordPanel] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [isSendingEmailLink, setIsSendingEmailLink] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ company: Company; typedName: string; loading: boolean } | null>(null);
    const { tableRef: companiesTableRef, wrapperRef: companiesWrapperRef } = useAriasTables();

    const DEFAULT_COL_WIDTHS: Record<string, number> = {
        name: 260, license_status: 140, max_users: 160, allowed_permissions: 260,
    };
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        try { const s = localStorage.getItem('companies_col_widths'); return s ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(s) } : { ...DEFAULT_COL_WIDTHS }; }
        catch { return { ...DEFAULT_COL_WIDTHS }; }
    });
    const resizingCol = useRef<string | null>(null);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);
    const handleColResizeStart = (e: React.MouseEvent, colId: string) => {
        e.preventDefault(); e.stopPropagation();
        const th = (e.currentTarget as HTMLElement).closest('th');
        const w = th ? th.getBoundingClientRect().width : (columnWidths[colId] ?? DEFAULT_COL_WIDTHS[colId] ?? 160);
        resizingCol.current = colId; resizeStartX.current = e.clientX; resizeStartWidth.current = w;
        document.body.classList.add('arias-table-resizing');
        const onMove = (ev: MouseEvent) => { if (!resizingCol.current) return; setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: Math.max(80, resizeStartWidth.current + ev.clientX - resizeStartX.current) })); };
        const onUp = () => { document.body.classList.remove('arias-table-resizing'); if (resizingCol.current) { setColumnWidths(prev => { localStorage.setItem('companies_col_widths', JSON.stringify(prev)); return prev; }); resizingCol.current = null; } window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };

    useEffect(() => {
        if (location.state?.status) {
            setStatusFilter(location.state.status);
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
            window.history.replaceState({}, document.title);
        }
    }, [location.state, companies]);

    useEffect(() => { loadCompanies(); }, []);

    const loadCompanies = async () => {
        try {
            const data = await adminService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error('Failed to load companies', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCompanyId) {
                const { admin_email, admin_password, admin_full_name, ...companyData } = formData;
                await adminService.updateCompany(editingCompanyId, companyData);

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

                    setCompanyMembers(prev => prev.map(m =>
                        m.id === editingMemberId ? { ...m, ...profileUpdates } : m
                    ));
                    toast.success('ðŸŽ‰ Empresa y usuario actualizados correctamente');
                } else if (admin_email && admin_password) {
                    if (admin_password.length < 6) {
                        toast.error('La contraseÃ±a debe tener al menos 6 caracteres');
                        setActiveTab('admin');
                        return;
                    }
                    await adminService.addCompanyAdmin({
                        email: admin_email,
                        password: admin_password,
                        full_name: admin_full_name || null,
                        company_id: editingCompanyId
                    });
                    toast.success('ðŸŽ‰ Empresa actualizada y administrador creado');
                } else {
                    toast.success('Empresa actualizada correctamente');
                }
            } else {
                if (!formData.admin_email || !formData.admin_password) {
                    toast.error('Configura el administrador inicial de la empresa');
                    setActiveTab('admin');
                    return;
                }
                if (formData.admin_password.length < 6) {
                    toast.error('La contraseÃ±a debe tener al menos 6 caracteres');
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
                toast.success('ðŸŽ‰ Empresa y administrador creados correctamente');
            }
            setIsModalOpen(false);
            resetForm();
            loadCompanies();
        } catch (error: any) {
            console.error('Failed to save company', error);
            const msg = error.message || '';
            if (msg.includes('users_email_partial_key') || msg.includes('email') && msg.includes('unique')) {
                toast.error('âš ï¸ Ese email ya estÃ¡ registrado en el sistema. Usa un email diferente.');
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
        setShowPasswordPanel(false);
        setNewPassword('');
        setFormData({
            name: '',
            license_status: 'active',
            tax_id: '',
            phone: '',
            address: '',
            max_users: 5,
            allowed_permissions: PLAN_DEFAULT_MODULES['active'],
            admin_email: '',
            admin_password: '',
            admin_full_name: ''
        });
    };

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
        return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    const handleOpenPasswordPanel = () => {
        setNewPassword(generatePassword());
        setShowPasswordPanel(true);
    };

    const handleSendEmailLink = async () => {
        if (!editingMemberId) return;
        const member = companyMembers.find(m => m.id === editingMemberId);
        setIsSendingEmailLink(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesiÃ³n activa. Por favor cierra sesiÃ³n y vuelve a entrar.');
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ target_user_id: editingMemberId, mode: 'email_link' })
                }
            );
            const result = await response.json();
            if (!response.ok || result.error) throw new Error(result.error || 'Error desconocido');
            toast.success(`ðŸ“§ Enlace enviado al correo de ${member?.full_name?.split(' ')[0] || 'usuario'}.`, { duration: 8000 });
            setShowPasswordPanel(false);
        } catch (error: any) {
            toast.error(`âŒ ${error.message}`, { duration: 10000 });
        } finally {
            setIsSendingEmailLink(false);
        }
    };

    const handleSaveNewPassword = async () => {
        if (!editingMemberId || !newPassword || newPassword.length < 6) {
            toast.error('La contraseÃ±a debe tener al menos 6 caracteres.');
            return;
        }
        const member = companyMembers.find(m => m.id === editingMemberId);
        setIsResettingPassword(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesiÃ³n activa. Por favor cierra sesiÃ³n y vuelve a entrar.');
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ target_user_id: editingMemberId, new_password: newPassword, mode: 'direct' })
                }
            );
            const result = await response.json();
            if (!response.ok || result.error) throw new Error(result.error || 'Error desconocido');
            toast.success(`âœ… Â¡${member?.full_name?.split(' ')[0] || 'Usuario'} ya puede ingresar con la nueva contraseÃ±a!`, { duration: 6000 });
            setShowPasswordPanel(false);
            setNewPassword('');
        } catch (error: any) {
            toast.error(`âŒ ${error.message}`, { duration: 10000 });
        } finally {
            setIsResettingPassword(false);
        }
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
            case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'expired': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'trial': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'manual_hold': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setDeleteConfirm(prev => prev ? { ...prev, loading: true } : null);
        try {
            await adminService.deleteCompany(deleteConfirm.company.id);
            toast.success(`Empresa "${deleteConfirm.company.name}" eliminada`);
            setDeleteConfirm(null);
            loadCompanies();
        } catch (error: any) {
            toast.error('Error al eliminar: ' + (error.message || 'Error desconocido'));
            setDeleteConfirm(prev => prev ? { ...prev, loading: false } : null);
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
        <div className="space-y-5 max-w-[1600px] mx-auto p-6">

            {/* â”€â”€ Header â”€â”€ */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Empresas</h1>
                    <p className="text-sm text-slate-400 mt-0.5">{companies.length} organizaciones registradas</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-60">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as LicenseStatus | 'all')}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="trial">Prueba</option>
                        <option value="expired">Expirados</option>
                        <option value="manual_hold">Retenidos</option>
                    </select>
                    <Button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-[#4449AA] hover:bg-[#3b3f94] text-white font-bold px-5 rounded-xl h-10 border-0 text-sm"
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Nueva empresa
                    </Button>
                </div>
            </div>

            {/* â”€â”€ Table â”€â”€ */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div ref={companiesWrapperRef} className="arias-table-wrapper">
                    <div ref={companiesTableRef} className="arias-table">
                        <table className="divide-y divide-slate-100 text-left" style={{ tableLayout: 'fixed', width: Object.keys(DEFAULT_COL_WIDTHS).reduce((s, k) => s + (columnWidths[k] ?? DEFAULT_COL_WIDTHS[k]), 160) }}>
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        { key: 'name', label: 'OrganizaciÃ³n' },
                                        { key: 'license_status', label: 'SuscripciÃ³n' },
                                        { key: 'max_users', label: 'Usuarios' },
                                        { key: 'allowed_permissions', label: 'MÃ³dulos' },
                                    ].map(col => (
                                        <th key={col.key} style={{ width: columnWidths[col.key] ?? DEFAULT_COL_WIDTHS[col.key] ?? 160, minWidth: 80, position: 'relative' }} className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <div
                                                className="cursor-pointer hover:text-slate-700 inline-flex items-center gap-1"
                                                onClick={() => setSortConfig({ key: col.key, direction: sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                                            >
                                                {col.label}
                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === col.key ? 'text-[#4449AA]' : 'text-slate-300'}`} />
                                            </div>
                                            <div onMouseDown={(e) => handleColResizeStart(e, col.key)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'col-resize', zIndex: 10, userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ width: 1, height: '50%', background: 'rgba(203,213,225,0.5)', borderRadius: 2 }} />
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ width: 160, minWidth: 130 }} className="px-5 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredCompanies.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-16 text-center text-sm text-slate-400">
                                            No hay empresas registradas
                                        </td>
                                    </tr>
                                )}
                                {filteredCompanies.map((company: any) => (
                                    <tr key={company.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-4 overflow-hidden" style={{ maxWidth: columnWidths['name'] ?? 260 }}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex-shrink-0 w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-[#4449AA] border border-indigo-100">
                                                    <Building className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-slate-900 truncate" title={company.name}>{company.name}</div>
                                                    <div className="text-[11px] text-slate-400 truncate">Desde {format(new Date(company.created_at), 'MM/yyyy')}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 inline-flex text-[10px] font-bold uppercase tracking-wide rounded-full border ${getStatusColor(company.license_status)}`}>
                                                {company.license_status === 'active' ? 'Activa' : company.license_status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-700">{company.user_count || 0}/{company.max_users || 5}</span>
                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${(company.user_count || 0) >= (company.max_users || 5) ? 'bg-rose-400' : 'bg-[#4449AA]'}`}
                                                        style={{ width: `${Math.min(100, ((company.user_count || 0) / (company.max_users || 5)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                {((company.allowed_permissions as string[]) || []).map(p => {
                                                    const config = MODULES_CONFIG.find(m => m.key === p);
                                                    return (
                                                        <div
                                                            key={p}
                                                            title={config?.label || p}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center bg-white border border-slate-200"
                                                        >
                                                            {config ? (
                                                                <config.icon className={`w-3 h-3 ${config.color}`} />
                                                            ) : (
                                                                <span className="text-[8px] font-bold text-slate-400">{p.slice(0, 2)}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {((company.allowed_permissions as string[]) || []).length === 0 && (
                                                    <span className="text-[11px] text-slate-300 italic">Sin mÃ³dulos</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1">
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
                                                        const { data: members } = await supabase
                                                            .from('profiles')
                                                            .select('id, email, full_name, role, phone, address, created_at')
                                                            .eq('company_id', company.id)
                                                            .in('role', ['company_admin', 'super_admin'])
                                                            .eq('status', 'active')
                                                            .order('created_at', { ascending: true });
                                                        setCompanyMembers(members || []);
                                                        setActiveTab('info');
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="h-8 px-3 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-[#4449AA] rounded-lg transition-colors text-[11px] font-bold"
                                                >
                                                    <Settings className="w-3.5 h-3.5" />
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteConfirm({ company, typedName: '', loading: false })}
                                                    className="h-8 w-8 inline-flex items-center justify-center bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                                                    title="Eliminar empresa"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* â”€â”€ Modal â”€â”€ */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCompanyId ? 'Editar Empresa' : 'Nueva Empresa'}
                className="max-w-4xl"
            >
                {/* Split layout */}
                <div className="flex -mx-6 -mb-6 -mt-2 min-h-[500px] overflow-hidden rounded-b-2xl">

                    {/* â”€â”€ Left Panel â”€â”€ */}
                    <div className="w-[200px] flex-shrink-0 bg-gradient-to-b from-[#4449AA] to-[#2d3178] flex flex-col items-center justify-between py-7 px-4 relative overflow-hidden">
                        <div className="absolute top-[-30px] right-[-30px] w-28 h-28 rounded-full bg-white/5" />
                        <div className="absolute bottom-[-20px] left-[-15px] w-24 h-24 rounded-full bg-white/5" />
                        <div className="relative z-10 flex flex-col items-center gap-4 w-full">
                            {/* Illustration */}
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl">
                                <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                                    <rect x="4" y="14" width="40" height="30" rx="3" fill="white" fillOpacity="0.15"/>
                                    <rect x="10" y="5" width="28" height="15" rx="2" fill="white" fillOpacity="0.25"/>
                                    <rect x="16" y="22" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
                                    <rect x="26" y="22" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
                                    <rect x="16" y="32" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
                                    <rect x="26" y="32" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
                                    <rect x="20" y="36" width="8" height="8" rx="1" fill="white" fillOpacity="0.9"/>
                                    <circle cx="24" cy="10" r="3" fill="white" fillOpacity="0.7"/>
                                </svg>
                            </div>
                            {/* Name + Status */}
                            <div className="text-center">
                                <p className="text-white font-black text-sm leading-tight break-words max-w-[160px] text-center">
                                    {formData.name || (editingCompanyId ? 'Empresa' : 'Nueva empresa')}
                                </p>
                                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                    formData.license_status === 'active' ? 'bg-emerald-400/20 text-emerald-200' :
                                    formData.license_status === 'trial' ? 'bg-blue-400/20 text-blue-200' :
                                    formData.license_status === 'expired' ? 'bg-rose-400/20 text-rose-200' :
                                    'bg-amber-400/20 text-amber-200'
                                }`}>
                                    {formData.license_status === 'active' ? 'â— Activa' :
                                     formData.license_status === 'trial' ? 'â— Prueba' :
                                     formData.license_status === 'expired' ? 'â— Expirada' : 'â— Retenida'}
                                </span>
                            </div>
                            {/* Stats */}
                            {editingCompanyId && (
                                <div className="w-full space-y-1.5">
                                    <div className="bg-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
                                        <span className="text-white/50 text-[10px] font-bold uppercase">MÃ³dulos</span>
                                        <span className="text-white font-black text-sm">{formData.allowed_permissions?.length || 0}</span>
                                    </div>
                                    <div className="bg-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
                                        <span className="text-white/50 text-[10px] font-bold uppercase">Usuarios</span>
                                        <span className="text-white font-black text-sm">{formData.max_users}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Nav tabs on left */}
                        <div className="relative z-10 w-full space-y-1">
                            {[
                                { key: 'info', label: 'Perfil', icon: Info },
                                { key: 'license', label: 'Licencias', icon: Shield },
                                { key: 'admin', label: 'Admin', icon: KeyRound },
                            ].map(tab => (
                                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as any)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-xs font-bold ${
                                        activeTab === tab.key ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                                    }`}>
                                    <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                    {tab.label}
                                    {activeTab === tab.key && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* â”€â”€ Right Panel: Form â”€â”€ */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                                {/* Section header */}
                                <div>
                                    <h2 className="text-sm font-black text-slate-900">
                                        {activeTab === 'info' ? 'InformaciÃ³n de la empresa' :
                                         activeTab === 'license' ? 'ConfiguraciÃ³n de mÃ³dulos' :
                                         editingCompanyId ? 'GestiÃ³n de administrador' : 'Administrador inicial'}
                                    </h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        {activeTab === 'info' ? 'Datos generales y plan' :
                                         activeTab === 'license' ? 'MÃ³dulos desactivados no son visibles para nadie' :
                                         editingCompanyId ? 'Edita o agrega administradores' : 'Primer acceso a esta empresa'}
                                    </p>
                                </div>

                                {/* â”€â”€ Tab: Info â”€â”€ */}
                                {activeTab === 'info' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de la empresa *</label>
                                            <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Arias Defense Logistics" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Plan de suscripciÃ³n</label>
                                                <select value={formData.license_status} onChange={(e) => { const s = e.target.value as LicenseStatus; setFormData(prev => ({ ...prev, license_status: s, ...(!editingCompanyId && { allowed_permissions: PLAN_DEFAULT_MODULES[s] ?? [] }) })); }} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                                                    <option value="active">ðŸŸ¢ Activa</option>
                                                    <option value="trial">ðŸ”µ Prueba</option>
                                                    <option value="expired">ðŸ”´ Expirada</option>
                                                    <option value="manual_hold">ðŸŸ  Retenida</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">MÃ¡x. usuarios</label>
                                                <Input type="number" required min={1} value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })} className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Tax ID / RNC</label>
                                                <Input value={formData.tax_id} onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })} placeholder="001-XXXXXXX-X" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">TelÃ©fono</label>
                                                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+503 XXXX-XXXX" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">DirecciÃ³n</label>
                                            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="DirecciÃ³n de la empresa" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                        </div>
                                    </div>
                                )}

                                {/* â”€â”€ Tab: Licencias â”€â”€ */}
                                {activeTab === 'license' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] text-slate-400">Activa o desactiva los mÃ³dulos de esta empresa</p>
                                            <span className="text-[11px] font-bold text-[#4449AA] bg-indigo-50 px-2 py-0.5 rounded-full">{formData.allowed_permissions?.length || 0}/{MODULES_CONFIG.length}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {MODULES_CONFIG.map((module) => {
                                                const isActive = formData.allowed_permissions?.includes(module.key);
                                                return (
                                                    <button key={module.key} type="button" onClick={() => toggleModule(module.key)}
                                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 ${
                                                            isActive ? 'bg-white border-[#4449AA]/20 shadow-sm ring-1 ring-[#4449AA]/10' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200'
                                                        }`}>
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isActive ? `${module.bg}` : 'bg-white border border-slate-200'
                                                        }`}>
                                                            <module.icon className={`w-3.5 h-3.5 ${isActive ? module.color : 'text-slate-300'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[11px] font-bold truncate ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>{module.label}</p>
                                                            <p className={`text-[10px] font-semibold ${isActive ? 'text-[#4449AA]' : 'text-slate-300'}`}>{isActive ? 'Activo' : 'Inactivo'}</p>
                                                        </div>
                                                        <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                                                            isActive ? 'bg-[#4449AA]' : 'border-2 border-slate-200 bg-white'
                                                        }`}>
                                                            {isActive && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* â”€â”€ Tab: Admin â”€â”€ */}
                                {activeTab === 'admin' && (
                                    <div className="space-y-4">
                                        {editingCompanyId && companyMembers.length > 0 && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-2">Administradores ({companyMembers.length})</label>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    <button type="button" onClick={() => { setEditingMemberId(null); setShowPasswordPanel(false); setNewPassword(''); setFormData(prev => ({ ...prev, admin_full_name: '', admin_email: '', admin_password: '' })); setMemberEditData({ full_name: '', email: '', phone: '', role: 'company_admin', address: '' }); }}
                                                        className={`h-7 px-3 rounded-full text-[11px] font-bold border transition-all ${ !editingMemberId ? 'bg-[#4449AA] text-white border-[#4449AA]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300' }`}>
                                                        + Nuevo admin
                                                    </button>
                                                    {companyMembers.map(member => (
                                                        <button key={member.id} type="button" onClick={() => { setEditingMemberId(member.id); setShowPasswordPanel(false); setFormData(prev => ({ ...prev, admin_full_name: member.full_name || '', admin_email: member.email || '', admin_password: '' })); setMemberEditData({ full_name: member.full_name || '', email: member.email || '', phone: '', role: member.role || 'company_admin', address: '' }); }}
                                                            className={`h-7 px-3 rounded-full text-[11px] font-bold border transition-all ${ editingMemberId === member.id ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300' }`}>
                                                            {member.full_name?.split(' ')[0] || member.email}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {editingMemberId ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Nombre completo</label>
                                                        <Input value={memberEditData.full_name} onChange={e => setMemberEditData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Nombre" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                                                        <Input type="email" value={memberEditData.email} onChange={e => setMemberEditData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@empresa.com" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">TelÃ©fono</label>
                                                        <Input value={memberEditData.phone} onChange={e => setMemberEditData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+503 XXXX-XXXX" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Rol</label>
                                                        <select value={memberEditData.role} onChange={e => setMemberEditData(prev => ({ ...prev, role: e.target.value }))} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100">
                                                            <option value="company_admin">Admin de Empresa</option>
                                                            <option value="super_admin">Super Admin</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {!showPasswordPanel ? (
                                                    <button type="button" onClick={handleOpenPasswordPanel} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#4449AA] transition-colors px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200">
                                                        <Lock className="w-3.5 h-3.5" /> Restablecer contraseÃ±a
                                                    </button>
                                                ) : (
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-bold text-slate-600">Nueva contraseÃ±a</p>
                                                            <button type="button" onClick={() => setShowPasswordPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                                                            <button type="button" onClick={() => setNewPassword(generatePassword())} className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">Generar</button>
                                                            <button type="button" onClick={() => { navigator.clipboard.writeText(newPassword); toast.success('Copiado'); }} className="h-9 w-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"><Copy className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button type="button" onClick={handleSaveNewPassword} disabled={isResettingPassword} className="flex-1 h-9 bg-[#4449AA] text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                                                                {isResettingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Guardar contraseÃ±a
                                                            </button>
                                                            <button type="button" onClick={handleSendEmailLink} disabled={isSendingEmailLink} className="flex-1 h-9 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-slate-50">
                                                                {isSendingEmailLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Enviar por email
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {!editingCompanyId && (
                                                    <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700">
                                                        <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <span>Se crearÃ¡ el primer administrador para esta empresa.</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nombre completo</label>
                                                    <Input value={formData.admin_full_name} onChange={e => setFormData({ ...formData, admin_full_name: e.target.value })} placeholder="Nombre del administrador" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Email *</label>
                                                    <Input type="email" required={!editingCompanyId} value={formData.admin_email} onChange={e => setFormData({ ...formData, admin_email: e.target.value })} placeholder="admin@empresa.com" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-xs font-bold text-slate-500">ContraseÃ±a {!editingCompanyId && '*'}</label>
                                                        <button type="button" onClick={() => { const pwd = generatePassword(); setFormData(prev => ({ ...prev, admin_password: pwd })); navigator.clipboard.writeText(pwd); toast.success('ðŸ”‘ Generada y copiada'); }} className="flex items-center gap-1 text-[11px] font-bold text-[#4449AA] hover:text-[#3b3f94] transition-colors">
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                            Auto-generar
                                                        </button>
                                                    </div>
                                                    <div className="relative">
                                                        <Input type="text" required={!editingCompanyId} value={formData.admin_password} onChange={e => setFormData({ ...formData, admin_password: e.target.value })} placeholder="MÃ­nimo 6 caracteres" className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl pr-10 font-mono" />
                                                        {formData.admin_password && (
                                                            <button type="button" onClick={() => { navigator.clipboard.writeText(formData.admin_password); toast.success('Copiado'); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white">
                                <button type="button" className="h-10 px-5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <Button type="submit" className="h-10 px-6 rounded-xl bg-[#4449AA] hover:bg-[#3b3f94] text-white font-bold text-sm border-0">
                                    {editingCompanyId ? 'Guardar cambios' : 'Crear empresa'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>

            </Modal>

            {/* â”€â”€ Delete Confirmation â”€â”€ */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Eliminar empresa</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Esta acciÃ³n es <strong className="text-rose-600">irreversible</strong>. Escribe el nombre exacto para confirmar.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nombre a confirmar</p>
                            <p className="font-bold text-slate-900 text-sm">{deleteConfirm.company.name}</p>
                        </div>

                        <input
                            type="text"
                            autoFocus
                            value={deleteConfirm.typedName}
                            onChange={e => setDeleteConfirm(prev => prev ? { ...prev, typedName: e.target.value } : null)}
                            onKeyDown={e => { if (e.key === 'Enter' && deleteConfirm.typedName === deleteConfirm.company.name) confirmDelete(); }}
                            placeholder="Escribe el nombre aquÃ­..."
                            className="w-full h-10 px-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-rose-400 transition-colors"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleteConfirm.loading}
                                className="flex-1 h-10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleteConfirm.typedName !== deleteConfirm.company.name || deleteConfirm.loading}
                                className="flex-[2] h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                                {deleteConfirm.loading ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Eliminando...</>
                                ) : (
                                    <><Trash2 className="w-3.5 h-3.5" /> Eliminar permanentemente</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
