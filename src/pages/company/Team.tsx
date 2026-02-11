import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { teamService, type Invitation } from '../../services/team';
import type { Profile, CustomRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, Trash2, Edit2, Shield, Loader2, Camera, Calendar, X, MessageSquare, Megaphone, User, Lock, FileText, Tag, Package, Layers, Building, CreditCard, XCircle } from 'lucide-react';
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

        const selectedRole = customRoles.find(r => r.id === formData.customRoleId);
        if (!selectedRole) {
            toast.error('Seleccione un rol válido');
            return;
        }

        setIsCreating(true);
        try {
            await teamService.createMember({
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phone: formData.phone,
                role: selectedRole.base_role,
                companyId: myProfile.company_id,
                customRoleId: selectedRole.id,
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
                <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-0 h-full">
                    <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-10 pt-12 space-y-6 h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                    <Plus className="w-4.5 h-4.5" />
                                </div>
                                <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">Nuevo Colaborador</h3>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
                        </div>

                        <form onSubmit={handleCreateMember} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Nombre Completo</label>
                                <Input required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-sm placeholder:text-gray-300 transition-all shadow-inner" placeholder="P. Ej: Jhon Doe" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Correo Electrónico</label>
                                <Input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-sm placeholder:text-gray-300 transition-all shadow-inner" placeholder="email@empresa.com" />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Contraseña</label>
                                    <div className="relative">
                                        <Input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-sm transition-all shadow-inner" placeholder="••••••••" />
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-200" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em] ml-1">Perfil de Acceso</label>
                                <div className="relative">
                                    <select
                                        className="w-full h-11 rounded-xl border border-gray-100 bg-gray-50/50 px-4 font-black text-[11px] uppercase text-gray-600 outline-none focus:bg-white focus:border-indigo-100 transition-all appearance-none cursor-pointer shadow-inner"
                                        value={formData.customRoleId}
                                        onChange={e => setFormData({ ...formData, customRoleId: e.target.value })}
                                    >
                                        {customRoles
                                            .filter(role => myProfile?.role === 'super_admin' || role.base_role !== 'super_admin')
                                            .map(role => (
                                                <option key={role.id} value={role.id}>{role.name}</option>
                                            ))}
                                    </select>
                                    <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating || isLimitReached}
                                className="w-full h-12 rounded-xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:translate-y-[-1px] active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:translate-y-0"
                            >
                                {isCreating ? 'Procesando...' : 'Vincular Miembro'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Active Members Directory */}
                <div className="lg:col-span-7 space-y-4">
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
                                                <p className="font-black text-gray-900 text-sm leading-tight uppercase tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                                                    {member.full_name || 'Sin Nombre'}
                                                </p>
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
                                            {(allowedPermissions.includes('leads') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Gestión de Leads" icon={User} mainKey="leads" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('quotes') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Cotizaciones" icon={FileText} mainKey="quotes" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('calendar') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Agenda Global" icon={Calendar} mainKey="calendar" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('marketing') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Marketing Hub" icon={Megaphone} mainKey="marketing" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('chat') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Mensajes (Chat)" icon={MessageSquare} mainKey="chat" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('branding') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Marca de Empresa" icon={Building} mainKey="branding" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('pricing') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Config. Precios" icon={Tag} mainKey="pricing" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('paquetes') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Gestión Paquetes" icon={Package} mainKey="paquetes" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('items') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Catálogo Items" icon={Layers} mainKey="items" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('financial_rules') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Reglas Financ." icon={CreditCard} mainKey="financial_rules" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                            {(allowedPermissions.includes('loss_reasons') || myProfile?.role === 'super_admin') && (
                                                <PermissionRow title="Motiv. Pérdida" icon={XCircle} mainKey="loss_reasons" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="px-12 py-8 bg-gray-50 border-t border-gray-100 flex gap-6">
                            <button
                                onClick={() => setEditingMember(null)}
                                className="flex-1 h-14 rounded-2xl font-black text-[11px] text-gray-400 hover:text-gray-900 transition-all uppercase tracking-widest"
                            >Cancelar</button>
                            <Button
                                form="edit-form-master"
                                type="submit"
                                disabled={isSaving}
                                className="flex-[2] h-14 rounded-2xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-widest shadow-2xl border-0 hover:translate-y-[-2px] transition-all"
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
