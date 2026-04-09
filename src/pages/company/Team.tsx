import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { teamService, type Invitation } from '../../services/team';
import type { Profile, CustomRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, Trash2, Edit2, Shield, Loader2, Camera, Calendar, X, MessageSquare, Megaphone, User, Users, Lock, FileText, Tag, Package, Layers, Building, CreditCard, XCircle, KeyRound, Copy, History, AlertCircle, Send } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthProvider';
import { storageService } from '../../services/storage';
import { supabase } from '../../services/supabase';
import Switch from '../../components/ui/Switch';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';


type TabType = 'general' | 'security';

export default function Team() {
    const { profile: myProfile } = useAuth();
    const [members, setMembers] = useState<Profile[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [maxUsers, setMaxUsers] = useState(5);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [allowedPermissions, setAllowedPermissions] = useState<string[]>([]);

    // Modal States
    const [editingMember, setEditingMember] = useState<Profile | null>(null);
    const [baselinePermissions, setBaselinePermissions] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<TabType>('general');

    // Status States
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [isSendingEmailLink, setIsSendingEmailLink] = useState(false);
    const [showPasswordPanel, setShowPasswordPanel] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [passwordResetLog, setPasswordResetLog] = useState<any[]>([]);
    const [isLoadingLog, setIsLoadingLog] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state for new members (Inline)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        customRoleId: '',
        birthDate: '',
        address: ''
    });

    // New member password panel helper
    const handleNewMemberAutoGenerate = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
        const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        setFormData(prev => ({ ...prev, password: pwd }));
    };

    useEffect(() => {
        if (myProfile?.company_id) {
            loadData();
        }
    }, [myProfile?.company_id]);

    const loadData = async () => {
        if (!myProfile?.company_id) return;
        try {
            const [membersData, invitationsData, limit, roles, allowed] = await Promise.all([
                teamService.getTeamMembers(myProfile.company_id),
                teamService.getInvitations(myProfile.company_id),
                teamService.getCompanyLimit(myProfile.company_id),
                teamService.getRoles(myProfile.company_id),
                teamService.getCompanyPermissions(myProfile.company_id)
            ]);
            setMembers(membersData || []);
            setInvitations(invitationsData || []);
            setMaxUsers(limit);
            setCustomRoles(roles);
            setAllowedPermissions(allowed);

            if (!formData.customRoleId && roles.length > 0) {
                const defaultRole = roles.find(r => r.base_role === 'collaborator') || roles[0];
                setFormData(prev => ({ ...prev, customRoleId: defaultRole.id }));
            }
        } catch (error) {
            console.error('Failed to load team data', error);
        } finally {
            setLoading(false);
        }
    };

    const isLimitReached = (members.length + invitations.length) >= maxUsers;

    const filteredMembers = members.filter(m => {
        // Si no soy super_admin, ocultar a los super_admins de la lista
        if (myProfile?.role !== 'super_admin' && m.role === 'super_admin') return false;

        const matchesSearch = m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.email.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    const handleCreateMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!myProfile?.company_id) return;
        if (isLimitReached) {
            toast.error('Límite de usuarios alcanzado');
            return;
        }

        // Graceful fallback: if no custom roles, use 'sales_agent' as base role (valid app_role enum)
        const selectedRole = customRoles.find(r => r.id === formData.customRoleId);
        const baseRole = selectedRole?.base_role || 'sales_agent';
        const customRoleId = selectedRole?.id || null;

        setIsCreating(true);
        try {
            await teamService.createMember({
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phone: formData.phone,
                role: baseRole,
                companyId: myProfile.company_id,
                customRoleId: customRoleId,
                birthDate: formData.birthDate,
                address: formData.address
            });

            setFormData(prev => ({
                ...prev,
                email: '', password: '', fullName: '', phone: '',
                birthDate: '', address: ''
            }));
            toast.success('Miembro creado correctamente');
            loadData();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingMember) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Máximo 2MB');
            return;
        }

        setIsUploading(true);
        try {
            const publicUrl = await storageService.uploadAvatar(editingMember.id, file);
            setEditingMember({ ...editingMember, avatar_url: publicUrl });
            toast.success('Foto actualizada');
        } catch (error: any) {
            toast.error('Error al subir');
        } finally {
            setTimeout(() => setIsUploading(false), 1000);
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;

        const selectedRole = customRoles.find(r => r.id === editingMember.custom_role_id);

        // DIRECT PERMISSION SAVING: Save exactly what is shown in the UI
        const currentPerms = editingMember.permissions || {};
        const finalPersistedPerms: Record<string, boolean> = {};

        // Iterate over ALL possible permissions and save their CURRENT UI state
        for (const key of allowedPermissions) {
            finalPersistedPerms[key] = !!currentPerms[key];
        }

        setIsSaving(true);
        try {
            await teamService.updateMember(editingMember.id, {
                full_name: editingMember.full_name,
                phone: editingMember.phone,
                role: selectedRole?.base_role || editingMember.role,
                custom_role_id: editingMember.custom_role_id,
                permissions: finalPersistedPerms,
                birth_date: editingMember.birth_date,
                address: editingMember.address,
                avatar_url: editingMember.avatar_url
            });

            toast.success('Cambios guardados');
            setEditingMember(null);
            loadData();
        } catch (error: any) {
            toast.error('Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
        return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    const handleOpenPasswordPanel = () => {
        setNewPassword(generatePassword());
        setShowPasswordPanel(true);
    };

    const loadPasswordResetLog = async (userId: string) => {
        setIsLoadingLog(true);
        try {
            const { data, error } = await supabase
                .from('password_reset_log')
                .select('*')
                .eq('target_user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);
            if (!error) setPasswordResetLog(data || []);
        } catch (e) {
            setPasswordResetLog([]);
        } finally {
            setIsLoadingLog(false);
        }
    };

    const callResetFunction = async (body: object) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No hay sesión activa');
        const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify(body)
            }
        );
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error || 'Error desconocido');
        return result;
    };

    // Opción A: Enviar link de reset por email (recomendado si tiene correo)
    const handleSendEmailLink = async () => {
        if (!editingMember) return;
        setIsSendingEmailLink(true);
        try {
            await callResetFunction({ target_user_id: editingMember.id, mode: 'email_link' });
            toast.success(`📧 Enlace enviado al correo de ${editingMember.full_name?.split(' ')[0]}. El usuario puede crear su propia contraseña.`, { duration: 8000 });
            setShowPasswordPanel(false);
            loadPasswordResetLog(editingMember.id);
        } catch (error: any) {
            toast.error(`❌ ${error.message}`, { duration: 10000 });
        } finally {
            setIsSendingEmailLink(false);
        }
    };

    // Opción B: Establecer contraseña directamente (para usuarios sin correo)
    const handleSaveNewPassword = async () => {
        if (!editingMember || !newPassword || newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        setIsResettingPassword(true);
        try {
            await callResetFunction({ target_user_id: editingMember.id, new_password: newPassword, mode: 'direct' });
            toast.success(`✅ ¡${editingMember.full_name?.split(' ')[0]} ya puede ingresar con la nueva contraseña!`, { duration: 6000 });
            setShowPasswordPanel(false);
            setNewPassword('');
            loadPasswordResetLog(editingMember.id);
        } catch (error: any) {
            toast.error(`❌ ${error.message}`, { duration: 10000 });
        } finally {
            setIsResettingPassword(false);
        }
    };

    const RoleBadge = ({ member }: { member: Profile }) => {
        const customRole = customRoles.find(r => r.id === member.custom_role_id);
        const name = customRole ? customRole.name : (member.role === 'super_admin' ? 'SUPER ADMIN' : (member.role === 'company_admin' ? 'ADMINISTRADOR' : 'AGENTE DE VENTAS'));

        const style = member.role === 'super_admin' ? 'bg-purple-50 text-purple-600 border-purple-100' :
            (member.role === 'company_admin' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100');

        return (
            <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase font-black tracking-widest border ${style}`}>
                {name}
            </span>
        );
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Cargando...</p>
        </div>
    );

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-8 animate-in fade-in duration-500">

            {/* Page Header - Unified Standard */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Building className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight uppercase">Equipo <span className="text-gray-900 font-black">Premium</span></h1>
                        <p className="text-[13px] text-gray-400 font-medium">Gestión integral de colaboradores y accesos</p>
                    </div>
                </div>
            </header>

            {/* High Density Grid - Senior Fit (3:7 ratio) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">

                {/* Left Column: Admin Control Panel (Sticky Sidebar) */}
                <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-0">
                    <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                        {/* Fixed Header */}
                        <div className="px-10 pt-10 pb-4 border-b border-gray-50 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                    <Plus className="w-4.5 h-4.5" />
                                </div>
                                <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">Nuevo Colaborador</h3>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
                        </div>
                        </div>

                        {/* Scrollable Form Body */}
                        <div className="flex-1 overflow-y-auto px-10 py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        <form onSubmit={handleCreateMember} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Nombre Completo</label>
                                <Input required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-sm placeholder:text-gray-300 transition-all shadow-inner" placeholder="P. Ej: Jhon Doe" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Correo Electrónico</label>
                                <Input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-sm placeholder:text-gray-300 transition-all shadow-inner" placeholder="email@empresa.com" />
                            </div>

                            {/* PERFIL DE ACCESO */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Perfil de Acceso</label>
                                <div className="relative">
                                    <select
                                        className="w-full h-11 rounded-xl border border-gray-100 bg-gray-50/50 px-4 font-black text-[11px] uppercase text-gray-600 outline-none focus:bg-white focus:border-indigo-100 transition-all appearance-none cursor-pointer shadow-inner"
                                        value={formData.customRoleId}
                                        onChange={e => setFormData({ ...formData, customRoleId: e.target.value })}
                                    >
                                        {customRoles.length === 0 ? (
                                            <option value="collaborator">Colaborador (Predeterminado)</option>
                                        ) : (
                                            customRoles
                                                .filter(role => myProfile?.role === 'super_admin' || role.base_role !== 'super_admin')
                                                .map(role => (
                                                    <option key={role.id} value={role.id}>{role.name}</option>
                                                ))
                                        )}
                                    </select>
                                    <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>

                            {/* CONTRASEÑA PREMIUM — Auto-generar o Email Link */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Contraseña de Acceso</label>
                                <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
                                    {/* Opción A: Email */}
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[9px] font-black shrink-0">A</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">Enviar por correo <span className="text-green-600">(Recomendado)</span></p>
                                            <p className="text-[9px] text-gray-400 mt-0.5">El colaborador recibirá un link para crear su propia contraseña.</p>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!formData.email || formData.email.length < 3) {
                                                        toast.error('Ingresa el correo electrónico primero');
                                                        return;
                                                    }
                                                    // Create user first, then send email link via edge function
                                                    setIsCreating(true);
                                                    try {
                                                        const tempPwd = generatePassword();
                                                        const selectedRole = customRoles.find(r => r.id === formData.customRoleId);
                                                        const createdMember = await teamService.createMember({
                                                            email: formData.email,
                                                            password: tempPwd,
                                                            fullName: formData.fullName,
                                                            phone: formData.phone,
                                                            role: selectedRole?.base_role || 'sales_agent',
                                                            companyId: myProfile!.company_id!,
                                                            customRoleId: selectedRole?.id || formData.customRoleId,
                                                            birthDate: formData.birthDate,
                                                            address: formData.address
                                                        });
                                                        // Send email reset link
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        if (session && createdMember?.id) {
                                                            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
                                                                body: JSON.stringify({ target_user_id: createdMember.id, mode: 'email_link' })
                                                            });
                                                        }
                                                        setFormData(prev => ({ ...prev, email: '', password: '', fullName: '', phone: '', birthDate: '', address: '' }));
                                                        toast.success(`📧 Colaborador creado. Link de acceso enviado a ${formData.email}`, { duration: 8000 });
                                                        loadData();
                                                    } catch (err: any) {
                                                        toast.error(`Error: ${err.message}`);
                                                    } finally {
                                                        setIsCreating(false);
                                                    }
                                                }}
                                                disabled={isCreating || isLimitReached}
                                                className="mt-2 px-4 py-1.5 rounded-lg bg-green-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-green-700 transition-all disabled:opacity-50"
                                            >
                                                {isCreating ? 'Creando...' : '📧 Crear y Enviar Link'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-amber-100 pt-3">
                                        <div className="flex items-start gap-3">
                                            <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[9px] font-black shrink-0">B</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">Contraseña Manual</p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">Para usuarios sin correo. Comparte la contraseña de forma segura.</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <input
                                                        type="text"
                                                        value={formData.password}
                                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                        placeholder="Contraseña..."
                                                        className="flex-1 h-8 rounded-lg border border-amber-200 bg-white px-3 text-[11px] font-bold text-gray-700 outline-none focus:border-indigo-300 min-w-0"
                                                    />
                                                    <button type="button" onClick={handleNewMemberAutoGenerate}
                                                        className="h-8 px-2.5 rounded-lg border border-amber-200 bg-white text-[9px] font-black text-amber-700 uppercase tracking-wide hover:bg-amber-50 transition-all shrink-0 flex items-center gap-1">
                                                        <KeyRound className="w-3 h-3" /> Auto
                                                    </button>
                                                    <button type="button" onClick={() => { navigator.clipboard.writeText(formData.password); toast.success('Copiada'); }}
                                                        className="h-8 px-2.5 rounded-lg border border-amber-200 bg-white text-[9px] font-black text-amber-700 uppercase tracking-wide hover:bg-amber-50 transition-all shrink-0 flex items-center gap-1" disabled={!formData.password}>
                                                        <Copy className="w-3 h-3" /> Copiar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating || isLimitReached || !formData.password}
                                className="w-full h-12 rounded-xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:translate-y-[-1px] active:scale-95 transition-all mt-2 disabled:opacity-50 disabled:translate-y-0"
                            >
                                {isCreating ? 'Procesando...' : '🔑 Vincular con Contraseña B'}
                            </button>
                        </form>
                        </div>
                    </div>
                </div>

                {/* Right Column: Active Members Directory */}
                <div className="lg:col-span-6 space-y-4">
                    <div className="h-full">
                        <div className="bg-white rounded-[3.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.03)] border border-gray-100/50 overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">

                            {/* Master Sticky Header - Controls + Context */}
                            <div className="bg-white/90 backdrop-blur-xl border-b border-gray-50 z-20 shrink-0 pt-12 pb-2">
                                {/* Top Level: Capacity + Title */}
                                <div className="px-10 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex flex-col">
                                        <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">Directorio de Usuarios</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[13px] text-gray-900 font-extrabold leading-none">Miembros activos</span>
                                        </div>
                                    </div>

                                    {/* Minimalist Integrated Capacity */}
                                    <div className="flex items-center gap-4 bg-gray-50/50 px-4 py-2 rounded-2xl border border-gray-100 shrink-0">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center justify-between gap-8">
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">LICENCIAS</span>
                                                <span className="text-[9px] font-black text-indigo-600">{members.length + invitations.length} / {maxUsers}</span>
                                            </div>
                                            <div className="w-24 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)] transition-all duration-1000"
                                                    style={{ width: `${Math.min(((members.length + invitations.length) / maxUsers) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Level: Filter Bar */}
                                <div className="px-10 pb-4">
                                    <div className="relative group w-full">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="FILTRAR..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full h-11 pl-12 pr-4 rounded-2xl bg-gray-50/50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-black text-[11px] uppercase tracking-widest placeholder:text-gray-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Internal Scrollable List */}
                            <div className="overflow-y-auto overflow-x-hidden divide-y divide-gray-50/80 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent flex-1 pb-10">
                                {filteredMembers.map(member => (
                                    <div key={member.id} className="px-10 py-4 hover:bg-gray-50/60 transition-all group flex items-center justify-between border-l-4 border-l-transparent hover:border-l-indigo-500">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-gray-400 overflow-hidden border border-gray-100 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                                    {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5 opacity-10" />}
                                                </div>
                                                {member.is_active !== false && (
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-0 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-gray-900 text-sm leading-tight uppercase tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                                                        {member.full_name || 'Sin Nombre'}
                                                    </p>
                                                    {member.telegram_chat_id && (
                                                        <span className="flex flex-shrink-0 items-center gap-1 px-1.5 py-0.5 rounded pl-1 bg-sky-50 text-sky-600 border border-sky-100/50" title="Bot de Telegram conectado">
                                                            <Send className="w-2.5 h-2.5" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest">Activo</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-400 font-bold tracking-tight lowercase truncate opacity-70 leading-normal">{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 shrink-0 ml-4">
                                            <RoleBadge member={member} />
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={async () => {
                                                        // Get merged permissions (role + user overrides) for display
                                                        const { data: mergedPerms } = await supabase.rpc('get_user_permissions', { user_id: member.id });
                                                        const perms = mergedPerms || {};

                                                        // Get ROLE-ONLY baseline permissions (without user overrides)
                                                        const selectedRole = customRoles.find(r => r.id === member.custom_role_id);
                                                        let roleOnlyPerms: Record<string, boolean> = {};

                                                        if (selectedRole) {
                                                            const { data: rolePerms } = await supabase.rpc('get_role_permissions', { role_id: selectedRole.id });
                                                            roleOnlyPerms = rolePerms || {};
                                                        }

                                                        setBaselinePermissions(roleOnlyPerms);
                                                        setEditingMember({ ...member, permissions: perms });
                                                        setActiveTab('general');
                                                        setShowPasswordPanel(false);
                                                        setPasswordResetLog([]);
                                                        loadPasswordResetLog(member.id);
                                                    }}
                                                    className="p-1.5 rounded-xl text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                {member.id !== myProfile?.id ? (
                                                    <button
                                                        onClick={() => { if (confirm('¿Eliminar usuario?')) teamService.deleteMember(member.id).then(loadData) }}
                                                        className="p-1.5 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.25em] px-2.5 py-1 bg-indigo-50/50 rounded-lg border border-indigo-100/50 shadow-sm ml-2">TÚ</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredMembers.length === 0 && (
                                    <div className="py-20 flex flex-col items-center justify-center text-gray-300 animate-in fade-in zoom-in duration-300">
                                        <Search className="w-12 h-12 mb-4 opacity-10" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin coincidencias</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Tabbed Edit Modal - Master Design */}
            {editingMember && createPortal(
                <div className="fixed inset-0 min-h-screen w-screen bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-5xl w-full flex flex-col animate-in zoom-in-95 duration-200">

                        <div className="px-12 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-2xl bg-white shadow-md overflow-hidden border-4 border-white relative">
                                        {editingMember.avatar_url ? <img src={editingMember.avatar_url} className="w-full h-full object-cover" /> : <User className="w-8 h-8 m-auto mt-6 text-gray-200" />}
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all animate-in fade-in">
                                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#4449AA] text-white rounded-lg flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 transition-transform"
                                    >
                                        <Camera className="w-3 h-3" />
                                    </button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-[#4449AA] leading-tight uppercase tracking-tight">{editingMember.full_name || 'Editar Perfil'}</h2>
                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em]">{editingMember.email}</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
                                    <button
                                        onClick={() => setActiveTab('general')}
                                        className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-[#4449AA] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                    >General</button>
                                    <button
                                        onClick={() => setActiveTab('security')}
                                        className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'bg-[#4449AA] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                    >Accesos</button>
                                </div>
                                <button onClick={() => setEditingMember(null)} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-300" /></button>
                            </div>
                        </div>

                        <div className="p-12 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <form id="edit-form-master" onSubmit={handleSaveEdit}>
                                {activeTab === 'general' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in duration-300">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Nombre Completo</label>
                                                <Input value={editingMember.full_name || ''} onChange={e => setEditingMember({ ...editingMember, full_name: e.target.value })} className="h-14 rounded-xl shadow-inner bg-gray-50/50 font-bold" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Número de Contacto</label>
                                                <Input value={editingMember.phone || ''} onChange={e => setEditingMember({ ...editingMember, phone: e.target.value })} className="h-14 rounded-xl shadow-inner bg-gray-50/50 font-bold" />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Fecha de Nacimiento</label>
                                                <CustomDatePicker
                                                    value={editingMember.birth_date || ''}
                                                    onChange={date => setEditingMember({ ...editingMember, birth_date: date })}
                                                    variant="light"
                                                    className="w-full"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Dirección Física</label>
                                                <textarea
                                                    value={editingMember.address || ''}
                                                    onChange={e => setEditingMember({ ...editingMember, address: e.target.value })}
                                                    className="w-full p-4 rounded-xl bg-gray-50/50 border border-gray-100 focus:bg-white focus:border-indigo-100 outline-none min-h-[100px] font-bold text-sm transition-all shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-in fade-in duration-300">
                                        <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Shield className="w-5 h-5 text-indigo-600" />
                                                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Configuración de Nivel de Acceso</label>
                                            </div>
                                            <select
                                                className="w-full h-14 rounded-2xl border-white bg-white px-5 font-bold text-sm text-gray-900 shadow-sm outline-none"
                                                value={editingMember.custom_role_id || ''}
                                                onChange={e => setEditingMember({ ...editingMember, custom_role_id: e.target.value })}
                                                disabled={editingMember.id === myProfile?.id}
                                            >
                                                {customRoles
                                                    .filter(role => myProfile?.role === 'super_admin' || role.base_role !== 'super_admin')
                                                    .map(role => (
                                                        <option key={role.id} value={role.id}>{role.name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {allowedPermissions.map(key => {
                                                // Icon and Title mapping for a premium and consistent UI
                                                const meta: Record<string, { title: string, icon: any }> = {
                                                    leads: { title: "Gestión de Leads", icon: Users },
                                                    quotes: { title: "Cotizaciones", icon: FileText },
                                                    calendar: { title: "Agenda Global", icon: Calendar },
                                                    marketing: { title: "Marketing Hub", icon: Megaphone },
                                                    chat: { title: "Mensajes (Chat)", icon: MessageSquare },
                                                    branding: { title: "Marca de Empresa", icon: Building },
                                                    pricing: { title: "Config. Precios", icon: Tag },
                                                    paquetes: { title: "Gestión Paquetes", icon: Package },
                                                    items: { title: "Catálogo Items", icon: Layers },
                                                    financial_rules: { title: "Reglas Financ.", icon: CreditCard },
                                                    loss_reasons: { title: "Motiv. Pérdida", icon: XCircle }
                                                };

                                                const item = meta[key] || { title: key.charAt(0).toUpperCase() + key.slice(1), icon: Shield };

                                                return (
                                                    <PermissionRow
                                                        key={key}
                                                        title={item.title}
                                                        icon={item.icon}
                                                        mainKey={key}
                                                        permissions={editingMember.permissions}
                                                        onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Password Reset History */}
                                        <div className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                                <History className="w-4 h-4 text-gray-400" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Historial de Cambios de Contraseña</span>
                                            </div>
                                            {isLoadingLog ? (
                                                <div className="py-6 flex justify-center">
                                                    <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                                                </div>
                                            ) : passwordResetLog.length === 0 ? (
                                                <div className="py-6 flex flex-col items-center gap-2 text-gray-300">
                                                    <AlertCircle className="w-5 h-5" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin registros previos</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-50">
                                                    {passwordResetLog.map((log: any) => (
                                                        <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4">
                                                            <div className="flex flex-col gap-0.5">
                                                                <p className="text-[11px] font-black text-gray-700">
                                                                    Cambiado por: <span className="text-indigo-600">{log.performed_by_email}</span>
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 font-medium">
                                                                    Rol: {log.performed_by_role === 'super_admin' ? 'Super Admin' : 'Administrador'}
                                                                    {log.ip_address && log.ip_address !== 'unknown' ? ` · IP: ${log.ip_address}` : ''}
                                                                </p>
                                                            </div>
                                                            <span className="text-[9px] font-black text-gray-300 shrink-0">
                                                                {new Date(log.created_at).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </form>

                            {/* Password Reset Panel - slides in below the form */}
                            {showPasswordPanel && (
                                <div className="mt-6 border border-orange-200 bg-orange-50/50 rounded-2xl p-6 animate-in slide-in-from-bottom-2 duration-200 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                                            <KeyRound className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-gray-900 uppercase tracking-tight">Restablecer Acceso</p>
                                            <p className="text-[10px] text-gray-400 font-medium">Elige el método según si el colaborador tiene correo electrónico</p>
                                        </div>
                                        <button onClick={() => { setShowPasswordPanel(false); setNewPassword(''); }} className="ml-auto p-1.5 hover:bg-orange-100 rounded-lg transition-colors">
                                            <X className="w-4 h-4 text-gray-400" />
                                        </button>
                                    </div>

                                    {/* OPCIÓN A: Email link */}
                                    <div className="bg-white rounded-xl border border-green-100 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-[11px] font-black text-green-700 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                                    <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[9px] font-black">A</span>
                                                    Enviar enlace por correo <span className="text-[9px] text-green-500 font-bold normal-case tracking-normal">(Recomendado)</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400">El colaborador recibe un email y crea su propia contraseña. Más seguro — nadie más la conoce.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendEmailLink}
                                                disabled={isSendingEmailLink}
                                                className="h-10 px-5 rounded-xl bg-green-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
                                            >
                                                {isSendingEmailLink ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                Enviar Link
                                            </button>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-orange-100" />
                                        <span className="text-[9px] font-black text-orange-300 uppercase tracking-widest">o si no tiene correo</span>
                                        <div className="flex-1 h-px bg-orange-100" />
                                    </div>

                                    {/* OPCIÓN B: Direct */}
                                    <div className="bg-white rounded-xl border border-orange-100 p-4 space-y-3">
                                        <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[9px] font-black">B</span>
                                            Establecer contraseña manualmente
                                        </p>
                                        <p className="text-[10px] text-gray-400">Para colaboradores sin correo electrónico. Comparte la contraseña de forma segura (en persona o por WhatsApp).</p>
                                        <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Mínimo 6 caracteres..."
                                                className="w-full h-12 px-4 rounded-xl bg-white border border-orange-200 font-mono font-bold text-sm text-indigo-700 tracking-widest outline-none focus:border-orange-400 transition-all"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setNewPassword(generatePassword())}
                                            title="Generar nueva contraseña"
                                            className="h-12 px-4 rounded-xl border border-orange-200 bg-white text-orange-500 hover:bg-orange-100 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest shrink-0"
                                        >
                                            <KeyRound className="w-3.5 h-3.5" />
                                            Auto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText(newPassword); toast.success('¡Copiado al portapapeles!'); }}
                                            title="Copiar contraseña"
                                            className="h-12 px-4 rounded-xl border border-orange-200 bg-white text-gray-500 hover:bg-orange-100 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest shrink-0"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copiar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveNewPassword}
                                            disabled={isResettingPassword || newPassword.length < 6}
                                            className="h-12 px-5 rounded-xl bg-[#4449AA] text-white font-black text-[10px] uppercase tracking-widest hover:translate-y-[-1px] transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
                                        >
                                            {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            {isResettingPassword ? 'Guardando...' : 'Guardar'}
                                        </button>
                                        </div>
                                        <p className="text-[10px] text-orange-400 font-medium mt-3">⚠️ Comparte esta contraseña con {editingMember.full_name?.split(' ')[0]} para que pueda ingresar.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-12 py-8 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-3">
                            <button
                                onClick={() => { setEditingMember(null); setShowPasswordPanel(false); setNewPassword(''); }}
                                className="h-14 px-6 rounded-2xl font-black text-[11px] text-gray-400 hover:text-gray-900 transition-all uppercase tracking-widest"
                            >Cancelar</button>
                            <button
                                type="button"
                                onClick={handleOpenPasswordPanel}
                                className="h-14 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-orange-200 text-orange-500 hover:bg-orange-50 transition-all flex items-center gap-2"
                            >
                                <KeyRound className="w-4 h-4" />
                                Cambiar Contraseña
                            </button>
                            <Button
                                form="edit-form-master"
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 h-14 rounded-2xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-widest shadow-2xl border-0 hover:translate-y-[-2px] transition-all"
                            >
                                {isSaving ? 'Actualizando...' : 'Guardar Cambios permanentemente'}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function PermissionRow({ title, icon: Icon, mainKey, permissions = {}, onChange }: any) {
    // Ensure permissions is an object to avoid crashes if null is passed
    const safePermissions = permissions || {};
    const isChecked = safePermissions[mainKey] === true;


    return (
        <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${isChecked ? 'bg-white border-blue-100 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-colors ${isChecked ? 'bg-[#4449AA] text-white' : 'bg-white text-gray-300 border border-gray-100'}`}>
                    <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-0 min-w-0 overflow-hidden">
                    <p className={`font-black text-[11px] uppercase tracking-tight truncate ${isChecked ? 'text-gray-900' : 'text-gray-400'}`}>{title}</p>
                    <p className="text-[8px] text-gray-400 font-medium truncate">Módulo {isChecked ? 'Activo' : 'Restringido'}</p>
                </div>
            </div>
            <div className="shrink-0 ml-2">
                <Switch checked={isChecked} onChange={() => onChange({ ...permissions, [mainKey]: !isChecked })} size="sm" colorVariant="blue" />
            </div>
        </div>
    );
}
