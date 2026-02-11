import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../../services/admin';
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
    Info
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

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
    const [activeTab, setActiveTab] = useState<'info' | 'license'>('info');
    const [formData, setFormData] = useState({
        name: '',
        license_status: 'active' as LicenseStatus,
        rnc: '',
        telefono: '',
        email: '',
        direccion: '',
        max_users: 5,
        allowed_permissions: [] as string[]
    });
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<LicenseStatus | 'all'>('all');
    const location = useLocation();

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
                    rnc: companyToEdit.rnc || '',
                    telefono: companyToEdit.telefono || '',
                    email: companyToEdit.email || '',
                    direccion: companyToEdit.direccion || '',
                    max_users: companyToEdit.max_users || 5,
                    allowed_permissions: companyToEdit.allowed_permissions || []
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
                await adminService.updateCompany(editingCompanyId, formData);
                toast.success('Empresa actualizada correctamente');
            } else {
                await adminService.createCompany(formData);
                toast.success('Empresa registrada correctamente');
            }
            setIsModalOpen(false);
            resetForm();
            loadCompanies();
        } catch (error) {
            console.error('Failed to save company', error);
            toast.error('Error al guardar la empresa');
        }
    };

    const resetForm = () => {
        setEditingCompanyId(null);
        setActiveTab('info');
        setFormData({
            name: '',
            license_status: 'active',
            rnc: '',
            telefono: '',
            email: '',
            direccion: '',
            max_users: 5,
            allowed_permissions: []
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
                <table className="min-w-full divide-y divide-slate-100 text-left">
                    <thead className="bg-[#F8FAFC]">
                        <tr>
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Organización</th>
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Suscripción</th>
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Capacidad</th>
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Módulos / Licencia</th>
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
                                        onClick={() => {
                                            setEditingCompanyId(company.id);
                                            setFormData({
                                                name: company.name,
                                                license_status: company.license_status,
                                                rnc: company.rnc || '',
                                                telefono: company.telefono || '',
                                                email: company.email || '',
                                                direccion: company.direccion || '',
                                                max_users: company.max_users || 5,
                                                allowed_permissions: Array.isArray(company.allowed_permissions) ? company.allowed_permissions : []
                                            });
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
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-2 space-y-8 pb-4 scroll-smooth">
                            {activeTab === 'info' ? (
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
                                                    value={formData.rnc}
                                                    onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
                                                    placeholder="001-XXXXXXX-X"
                                                    className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Teléfono Corporativo</label>
                                                <Input
                                                    value={formData.telefono}
                                                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                                    placeholder="+503 XXXX-XXXX"
                                                    className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Centro de Contacto (Email)</label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="admon@ejemplo.com"
                                                className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
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
