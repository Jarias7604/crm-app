import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { teamService, type Invitation } from '../../services/team';
import type { Profile, CustomRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, Trash2, Edit2, Shield, Loader2, Camera, Calendar, X, MessageSquare, Megaphone, User, LayoutGrid, Lock } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthProvider';
import { storageService } from '../../services/storage';
import Switch from '../../components/ui/Switch';

type TabType = 'general' | 'security';

export default function Team() {
    const { profile: myProfile } = useAuth();
    const [members, setMembers] = useState<Profile[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [maxUsers, setMaxUsers] = useState(5);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [editingMember, setEditingMember] = useState<Profile | null>(null);
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
            const [membersData, invitationsData, limit, roles] = await Promise.all([
                teamService.getTeamMembers(myProfile.company_id),
                teamService.getInvitations(myProfile.company_id),
                teamService.getCompanyLimit(myProfile.company_id),
                teamService.getRoles(myProfile.company_id)
            ]);
            setMembers(membersData || []);
            setInvitations(invitationsData || []);
            setMaxUsers(limit);
            setCustomRoles(roles);

            if (!formData.customRoleId && roles.length > 0) {
                const defaultRole = roles.find(r => r.base_role === 'sales_agent') || roles[0];
                setFormData(prev => ({ ...prev, customRoleId: defaultRole.id }));
            }
        } catch (error) {
            console.error('Failed to load team data', error);
        } finally {
            setLoading(false);
        }
    };

    const isLimitReached = (members.length + invitations.length) >= maxUsers;

    const filteredMembers = members.filter(m =>
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

        setIsSaving(true);
        try {
            await teamService.updateMember(editingMember.id, {
                full_name: editingMember.full_name,
                phone: editingMember.phone,
                role: selectedRole?.base_role || editingMember.role,
                custom_role_id: editingMember.custom_role_id,
                permissions: editingMember.permissions,
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
        const name = customRole ? customRole.name : (member.role === 'super_admin' ? 'SUPER ADMIN' : (member.role === 'company_admin' ? 'ADMIN EMPRESA' : 'COLABORADOR'));

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

            {/* Simple Header - Compact */}
            <header className="space-y-0.5">
                <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight">Gestión de Equipo</h1>
                <p className="text-[13px] text-gray-400 font-medium font-inter">Administra los accesos y colaboradores de tu empresa.</p>
            </header>

            {/* Restored Quick Add Form - Scaled to 90% */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-base font-black text-gray-900 tracking-tight uppercase">Crear Nuevo Usuario</h2>
                </div>
                <form onSubmit={handleCreateMember} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest pl-1">Nombre Completo *</label>
                            <Input required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="h-11 rounded-lg bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-[13px]" placeholder="Ej: Juan Pérez" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest pl-1">Email (Usuario) *</label>
                            <Input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-lg bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-[13px]" placeholder="juan@empresa.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest pl-1">Contraseña *</label>
                            <div className="relative">
                                <Input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="h-11 rounded-lg bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-[13px]" placeholder="Contraseña inicial" />
                                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest pl-1">Teléfono (Opcional)</label>
                            <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="h-11 rounded-lg bg-gray-50/50 border-gray-100 focus:bg-white font-bold text-[13px]" placeholder="+503 ..." />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest pl-1">Rol Asignado</label>
                            <select
                                className="w-full h-11 rounded-lg border border-gray-100 bg-gray-50/50 px-3.5 font-bold text-[13px] text-gray-700 outline-none focus:bg-white focus:border-indigo-100 transition-all appearance-none cursor-pointer"
                                value={formData.customRoleId}
                                onChange={e => setFormData({ ...formData, customRoleId: e.target.value })}
                            >
                                {customRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-center md:justify-end">
                            <button
                                type="submit"
                                disabled={isCreating || isLimitReached}
                                className="h-11 px-8 rounded-lg bg-[#4449AA] text-white font-black text-[10px] uppercase tracking-widest shadow-md hover:translate-y-[-1px] active:scale-95 transition-all"
                            >
                                {isCreating ? 'Guardando...' : 'Crear Usuario'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Member List Section - Compact */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Miembros Activos</h3>
                        <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[9px] font-black border border-blue-100">
                            {members.length + invitations.length} / {maxUsers} Licencias
                        </span>
                    </div>
                    <div className="relative w-full md:w-72 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                        <input
                            type="text"
                            placeholder="Buscar Integrante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-10 pr-4 rounded-lg bg-gray-50/50 border border-transparent focus:bg-white focus:border-gray-100 outline-none transition-all font-bold text-[12px] placeholder:text-gray-300"
                        />
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {filteredMembers.map(member => (
                        <div key={member.id} className="px-6 py-4 hover:bg-gray-50/30 transition-all group flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="relative shrink-0">
                                    <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden border border-white shadow-sm">
                                        {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5 opacity-30" />}
                                    </div>
                                    {member.is_active !== false && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                                </div>
                                <div className="space-y-0.5">
                                    <p className="font-bold text-gray-900 text-sm leading-tight uppercase tracking-tight">{member.full_name || 'Sin Nombre'}</p>
                                    <div className="flex flex-col">
                                        <p className="text-[11px] text-gray-400 font-medium">{member.email}</p>
                                        {member.website && (
                                            <div className="flex items-center gap-1 text-indigo-500 font-bold text-[9px] uppercase tracking-wider">
                                                <LayoutGrid className="w-2.5 h-2.5" />
                                                {member.website}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <RoleBadge member={member} />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setEditingMember(member); setActiveTab('general'); }}
                                        className="p-2 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    {member.id !== myProfile?.id ? (
                                        <>
                                            <button
                                                onClick={() => { if (confirm('¿Eliminar usuario?')) teamService.deleteMember(member.id).then(loadData) }}
                                                className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <div className="pl-2">
                                                <Switch checked={member.is_active !== false} onChange={() => { }} size="sm" colorVariant="green" label="" />
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-4 py-1.5 bg-indigo-50/50 rounded-lg">TÚ</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Premium Tabbed Edit Modal - Master Design */}
            {editingMember && createPortal(
                <div className="fixed inset-0 min-h-screen w-screen bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                        <div className="px-12 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-2xl bg-white shadow-md overflow-hidden border-4 border-white">
                                        {editingMember.avatar_url ? <img src={editingMember.avatar_url} className="w-full h-full object-cover" /> : <User className="w-8 h-8 m-auto mt-6 text-gray-200" />}
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
                                                <Input type="date" value={editingMember.birth_date || ''} onChange={e => setEditingMember({ ...editingMember, birth_date: e.target.value })} className="h-14 rounded-xl shadow-inner bg-gray-50/50" />
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
                                                {customRoles.map(role => (
                                                    <option key={role.id} value={role.id}>{role.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <PermissionRow title="Gestión de Leads" icon={User} mainKey="leads" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            <PermissionRow title="Marketing Digital" icon={Megaphone} mainKey="marketing" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            <PermissionRow title="Comunicación (Chat)" icon={MessageSquare} mainKey="chat" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
                                            <PermissionRow title="Agenda Global" icon={Calendar} mainKey="calendar" permissions={editingMember.permissions} onChange={(p: any) => setEditingMember({ ...editingMember, permissions: p })} />
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
    const isCore = ['leads', 'quotes', 'calendar'].includes(mainKey);
    const currentVal = permissions[mainKey];
    const isChecked = currentVal === undefined ? isCore : currentVal === true;

    return (
        <div className={`p-4 rounded-xl border transition-all flex items-center justify-between ${isChecked ? 'bg-white border-blue-100 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
            <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isChecked ? 'bg-[#4449AA] text-white' : 'bg-white text-gray-300 border border-gray-100'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-0">
                    <p className={`font-black text-[13px] uppercase tracking-tight ${isChecked ? 'text-gray-900' : 'text-gray-400'}`}>{title}</p>
                    <p className="text-[9px] text-gray-400 font-medium">Módulo {isChecked ? 'Activo' : 'Restringido'}</p>
                </div>
            </div>
            <Switch checked={isChecked} onChange={() => onChange({ ...permissions, [mainKey]: !isChecked })} size="sm" colorVariant="blue" />
        </div>
    );
}
