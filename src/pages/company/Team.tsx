import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { teamService, type Invitation } from '../../services/team';
import type { Profile, Role } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, Mail, User, Shield, Phone, Lock, Edit2, Globe, Camera, Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { storageService } from '../../services/storage';
import { useAuth } from '../../auth/AuthProvider';
import Switch from '../../components/ui/Switch';

export default function Team() {
    const { profile: myProfile } = useAuth();
    const isAdmin = myProfile?.role === 'super_admin' || myProfile?.role === 'company_admin';
    const [members, setMembers] = useState<Profile[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [maxUsers, setMaxUsers] = useState(5);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Edit state
    const [editingMember, setEditingMember] = useState<Profile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingMember) return;

        // Size validation (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('La imagen debe pesar menos de 2MB');
            return;
        }

        setIsUploading(true);
        try {
            console.log('Starting avatar upload for user:', editingMember.id);
            const publicUrl = await storageService.uploadAvatar(editingMember.id, file);
            console.log('Upload successful, URL received:', publicUrl);

            setEditingMember({ ...editingMember, avatar_url: publicUrl });
            toast.success('Foto cargada correctamente');
        } catch (error: any) {
            console.error('Upload failed with detail:', error);
            toast.error(`Error al subir imagen: ${error.message || 'Error de conexión'}`);
        } finally {
            setIsUploading(false);
        }
    };

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'sales_agent' as Role
    });

    useEffect(() => {
        if (myProfile?.company_id) {
            loadData();
        }
    }, [myProfile?.company_id]);

    const loadData = async () => {
        if (!myProfile?.company_id) return;
        try {
            const [membersData, invitationsData, limit] = await Promise.all([
                teamService.getTeamMembers(myProfile.company_id),
                teamService.getInvitations(myProfile.company_id),
                teamService.getCompanyLimit(myProfile.company_id)
            ]);
            setMembers(membersData || []);
            setInvitations(invitationsData || []);
            setMaxUsers(limit);
        } catch (error) {
            console.error('Failed to load team data', error);
        } finally {
            setLoading(false);
        }
    };

    const isLimitReached = (members.length + invitations.length) >= maxUsers;

    const handleCreateMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!myProfile?.company_id) return;

        if (isLimitReached) {
            toast.error('Has alcanzado el límite de usuarios permitidos por tu licencia.');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setIsCreating(true);
        try {
            await teamService.createMember({
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phone: formData.phone,
                role: formData.role,
                companyId: myProfile.company_id
            });

            setFormData({
                email: '',
                password: '',
                fullName: '',
                phone: '',
                role: 'sales_agent'
            });

            toast.success('Usuario creado correctamente');
            loadData();
        } catch (error: any) {
            console.error(error);
            toast.error(`Error al crear usuario: ${error.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean | undefined) => {
        // Default to true if undefined
        const newStatus = !(currentStatus ?? true);
        try {
            // Optimistic update
            setMembers(members.map(m => m.id === id ? { ...m, is_active: newStatus } : m));
            await teamService.toggleMemberStatus(id, newStatus);
            toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado');
        } catch (error: any) {
            console.error('Toggle failed:', error);
            toast.error(`Error: ${error.message}`);
            loadData(); // Revert on error
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('¿Estás seguro de cancelar esta invitación?')) return;
        try {
            await teamService.revokeInvitation(id);
            toast.success('Invitación cancelada');
            loadData();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        }
    };

    const handleMemberDelete = async (id: string, email: string) => {
        if (id === myProfile?.id) {
            toast.error('No puedes eliminarte a ti mismo.');
            return;
        }
        if (!confirm(`¿Estás seguro de eliminar a ${email} del equipo? Perderá el acceso de inmediato.`)) return;
        try {
            await teamService.deleteMember(id);
            toast.success('Miembro eliminado');
            loadData();
        } catch (error: any) {
            console.error('Delete failed:', error);
            toast.error(`Error al eliminar: ${error.message}`);
        }
    };

    const handleEditMember = (member: Profile) => {
        setEditingMember(member);
    };

    const handleCancelEdit = () => {
        setEditingMember(null);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;

        setIsSaving(true);
        console.log('Attempting to save member:', editingMember);

        try {
            await teamService.updateMember(editingMember.id, {
                full_name: editingMember.full_name || null,
                phone: editingMember.phone || null,
                avatar_url: editingMember.avatar_url || null,
                website: editingMember.website || null,
                role: editingMember.role
            });

            toast.success('Perfil actualizado correctamente');
            setEditingMember(null);
            loadData();
        } catch (error: any) {
            console.error('Core Profile Update failed:', error);
            toast.error(`Error al guardar: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const RoleBadge = ({ role }: { role: string }) => {
        const styles = {
            super_admin: 'bg-purple-100 text-purple-800',
            company_admin: 'bg-blue-100 text-blue-800',
            sales_agent: 'bg-green-100 text-green-800'
        };
        const labels = {
            super_admin: 'Super Admin',
            company_admin: 'Admin Empresa',
            sales_agent: 'Agente Ventas'
        };
        return (
            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-black tracking-wider ${styles[role as keyof typeof styles] || 'bg-gray-100'}`}>
                {labels[role as keyof typeof labels] || role}
            </span>
        );
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando equipo...</div>;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Equipo</h1>
                <p className="text-gray-500">Administra los accesos y colaboradores de tu empresa.</p>
            </div>

            {/* Create User Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Crear Nuevo Usuario
                </h2>
                <form onSubmit={handleCreateMember} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                            <Input
                                required
                                placeholder="Ej: Juan Pérez"
                                value={formData.fullName}
                                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email (Usuario) *</label>
                            <Input
                                type="email"
                                required
                                placeholder="juan@empresa.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                            <div className="relative">
                                <Input
                                    type="text" // Visible by default for admin convenience on creation
                                    required
                                    placeholder="Contraseña inicial"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                                <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (Opcional)</label>
                            <Input
                                placeholder="+503 ..."
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol Asignado</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                            >
                                <option value="sales_agent">Agente de Ventas (Solo ve sus leads)</option>
                                <option value="company_admin">Admin de Empresa (Ve todo)</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" disabled={isCreating} className="w-full">
                                {isCreating ? 'Creando...' : 'Crear Usuario'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100">
                    <h3 className="text-sm font-semibold text-yellow-800 mb-3 uppercase tracking-wider">Invitaciones Pendientes</h3>
                    <div className="bg-white rounded-lg overflow-hidden border border-yellow-200">
                        {invitations.map(inv => (
                            <div key={inv.id} className="flex justify-between items-center p-4 border-b last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-yellow-100 p-2 rounded-full">
                                        <Mail className="w-4 h-4 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{inv.email}</p>
                                        <p className="text-xs text-gray-500">Invitado el {new Date(inv.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <RoleBadge role={inv.role} />
                                    <button
                                        onClick={() => handleRevoke(inv.id)}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Trash2 className="w-4 h-4" /> Cancelar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Edit Member Modal - Ultimate Professional Wide Version with Portal */}
            {editingMember && createPortal(
                <div className="fixed inset-0 min-h-screen w-screen bg-black/70 backdrop-blur-[12px] flex items-center justify-center z-[9999] p-4 md:p-12 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] max-w-2xl w-full max-h-[94vh] flex flex-col border border-white/20 animate-in zoom-in-95 duration-300 overflow-hidden">

                        {/* Header - Refined & Wide Spacing */}
                        <div className="px-10 py-9 flex justify-between items-center shrink-0 bg-white border-b border-gray-50">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-none">Editar Perfil</h2>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{editingMember.email}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleCancelEdit}
                                type="button"
                                className="p-3 hover:bg-gray-50 rounded-[1.5rem] transition-all text-gray-400 hover:text-gray-900 group border border-transparent hover:border-gray-100"
                            >
                                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                            </button>
                        </div>

                        {/* Scrollable Body - Balanced & Spacious */}
                        <div className="flex-1 overflow-y-auto px-10 pb-10 pt-6 custom-scrollbar scroll-smooth">
                            <form id="edit-profile-form" onSubmit={handleSaveEdit} className="space-y-10">
                                {/* Avatar Section - Premium Centered */}
                                <div className="flex flex-col items-center py-6">
                                    <div className="relative group">
                                        <div className="w-44 h-44 rounded-[3.5rem] border-[8px] border-white overflow-hidden shadow-2xl bg-gray-50 flex items-center justify-center relative ring-1 ring-gray-100/50">
                                            {isUploading ? (
                                                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-20">
                                                    <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
                                                </div>
                                            ) : null}

                                            {editingMember.avatar_url ? (
                                                <img
                                                    src={editingMember.avatar_url}
                                                    alt=""
                                                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center">
                                                    <User className="w-20 h-20 text-gray-200" />
                                                </div>
                                            )}

                                            <label className="absolute inset-0 bg-[#4449AA]/85 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-500 cursor-pointer backdrop-blur-[6px] z-10">
                                                <div className="bg-white/20 p-4 rounded-2xl mb-2 backdrop-blur-md hover:scale-110 transition-transform shadow-xl">
                                                    <Camera className="w-8 h-8" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] font-sans">Cambiar Imagen</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleAvatarUpload}
                                                    disabled={isUploading}
                                                />
                                            </label>
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 w-12 h-12 rounded-[1.5rem] border-[6px] border-white shadow-2xl flex items-center justify-center z-20">
                                            <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-[0_0_15px_rgba(255,255,255,1)]"></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] mt-10">Profile Specification</p>
                                </div>

                                <div className="space-y-8">
                                    {/* Name Input */}
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] ml-4">Identidad</label>
                                        <div className="relative group/field px-1">
                                            <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
                                                <User className="w-5 h-5 text-gray-300 group-focus-within/field:text-[#4449AA] transition-colors" />
                                            </div>
                                            <Input
                                                required
                                                value={editingMember.full_name || ''}
                                                onChange={e => setEditingMember({ ...editingMember, full_name: e.target.value })}
                                                placeholder="Nombre Completo"
                                                className="h-16 pl-16 bg-gray-50/50 border-gray-100 focus:bg-white rounded-[1.5rem] border-2 focus:border-[#4449AA] focus:ring-8 focus:ring-[#4449AA]/5 transition-all text-base font-bold tracking-tight shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
                                        {/* Contact */}
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] ml-4">Contacto</label>
                                            <div className="relative group/field">
                                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                                    <Phone className="w-5 h-5 text-gray-300 group-focus-within/field:text-[#4449AA] transition-colors" />
                                                </div>
                                                <Input
                                                    value={editingMember.phone || ''}
                                                    onChange={e => setEditingMember({ ...editingMember, phone: e.target.value })}
                                                    placeholder="Teléfono"
                                                    className="h-16 pl-16 bg-gray-50/50 border-gray-100 focus:bg-white rounded-[1.5rem] border-2 focus:border-[#4449AA] focus:ring-8 focus:ring-[#4449AA]/5 transition-all text-base font-bold tracking-tight shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Digital */}
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] ml-4">Digital</label>
                                            <div className="relative group/field">
                                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                                    <Globe className="w-5 h-5 text-gray-300 group-focus-within/field:text-[#4449AA] transition-colors" />
                                                </div>
                                                <Input
                                                    value={editingMember.website || ''}
                                                    onChange={e => setEditingMember({ ...editingMember, website: e.target.value })}
                                                    placeholder="Sitio Web"
                                                    className="h-16 pl-16 bg-gray-50/50 border-gray-100 focus:bg-white rounded-[1.5rem] border-2 focus:border-[#4449AA] focus:ring-8 focus:ring-[#4449AA]/5 transition-all text-sm font-bold tracking-tight shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Permissions */}
                                    <div className="space-y-3 px-1">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] ml-4">Rol & Autoridad</label>
                                        <div className="relative group/field">
                                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none z-10">
                                                <Shield className="w-5 h-5 text-gray-300 group-focus-within/field:text-[#4449AA] transition-colors" />
                                            </div>
                                            <select
                                                className={`w-full rounded-[1.5rem] border-2 border-gray-100 bg-gray-50/50 h-16 pl-16 pr-12 text-sm font-bold focus:border-[#4449AA] focus:ring-8 focus:ring-[#4449AA]/5 focus:bg-white transition-all outline-none appearance-none shadow-sm ${editingMember.id === myProfile?.id ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                                value={editingMember.role}
                                                onChange={e => setEditingMember({ ...editingMember, role: e.target.value as Role })}
                                                disabled={editingMember.id === myProfile?.id}
                                            >
                                                <option value="sales_agent">Agente de Ventas CRM</option>
                                                <option value="company_admin">Administrador de Empresa</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-7 flex items-center pointer-events-none text-gray-300">
                                                <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-gray-300 rotate-45 mb-1.5"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer - Wide & Solid */}
                        <div className="px-10 py-10 bg-gray-50 border-t border-gray-100 shrink-0">
                            <div className="flex gap-6">
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 h-16 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.4em] text-gray-400 hover:text-gray-900 border-2 border-gray-200 hover:border-gray-300 transition-all bg-white hover:shadow-xl active:scale-95"
                                >
                                    Descartar
                                </button>
                                <Button
                                    form="edit-profile-form"
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] h-16 rounded-[1.5rem] bg-[#4449AA] hover:bg-[#383d8f] text-white shadow-[0_15px_30px_-10px_rgba(68,73,170,0.6)] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 border-0"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span className="font-black text-xs uppercase tracking-[0.2em]">Guardando Cambios...</span>
                                        </>
                                    ) : (
                                        <span className="font-black text-xs uppercase tracking-[0.2em]">Confirmar Actualización</span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* Active Members */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="font-semibold text-gray-800">Miembros Activos</h2>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${isLimitReached ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {members.length + invitations.length} / {maxUsers} Licencias
                        </span>
                    </div>
                </div>
                {isLimitReached && (
                    <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700 text-sm">
                        <Shield className="w-4 h-4" />
                        Has alcanzado el límite de usuarios. Contacta al soporte para ampliar tu licencia.
                    </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                        {members.map(member => (
                            <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            {member.avatar_url ? (
                                                <img src={member.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-gray-100 shadow-sm" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                    <User className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{member.full_name || 'Sin nombre'}</div>
                                            <div className="text-xs text-gray-500">{member.email}</div>
                                            <div className="flex gap-3 mt-0.5">
                                                {member.phone && <span className="text-xs text-blue-600 flex items-center"><Phone className="w-3 h-3 mr-1" /> {member.phone}</span>}
                                                {member.website && <span className="text-xs text-purple-600 flex items-center"><Globe className="w-3 h-3 mr-1" /> {member.website.replace(/^https?:\/\//, '')}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <RoleBadge role={member.role} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2 items-center">
                                        {(isAdmin || member.id === myProfile?.id) && (
                                            <button
                                                onClick={() => handleEditMember(member)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                title="Editar Miembros"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        )}

                                        {isAdmin && member.id !== myProfile?.id && (
                                            <button
                                                onClick={() => handleMemberDelete(member.id, member.email)}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                title="Eliminar Miembro"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}

                                        {member.id === myProfile?.id && (
                                            <span className="text-blue-600 text-[10px] font-black px-2 py-1 bg-blue-50 rounded uppercase tracking-wider">Tú</span>
                                        )}

                                        {isAdmin && member.id !== myProfile?.id && (
                                            <div className="ml-2" title={member.is_active !== false ? "Desactivar usuario" : "Activar usuario"}>
                                                <Switch
                                                    checked={member.is_active !== false}
                                                    onChange={() => handleToggleStatus(member.id, member.is_active)}
                                                    size="sm"
                                                    colorVariant="green"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
