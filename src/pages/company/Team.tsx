import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { teamService, type Invitation } from '../../services/team';
import type { Profile, Role } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, Mail, User, Shield, Phone, Lock, Edit2, Globe, Camera, Loader2, X, Megaphone, MessageSquare, FileText, Calendar } from 'lucide-react';
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
                role: editingMember.role,
                permissions: editingMember.permissions
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

    const PermissionCard = ({ title, icon: Icon, mainKey, desc, subFeatures = [], permissions = {}, onChange, isPremium = false }: any) => {
        const isCore = ['leads', 'quotes', 'calendar'].includes(mainKey);
        // If undefined: Core defaults to TRUE. Premium defaults to FALSE.
        const currentVal = permissions[mainKey];
        const isChecked = currentVal === undefined ? isCore : currentVal === true;

        return (
            <div className={`border rounded-xl p-5 transition-all ${isChecked ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${isChecked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className={`font-bold text-sm ${isChecked ? 'text-gray-900' : 'text-gray-500'}`}>{title}</h4>
                            <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                    </div>
                    <Switch
                        checked={isChecked}
                        onChange={() => {
                            const newVal = !isChecked;
                            onChange({ ...permissions, [mainKey]: newVal });
                        }}
                        size="sm"
                    />
                </div>

                {/* Sub Features */}
                {subFeatures.length > 0 && (
                    <div className={`space-y-3 pl-11 pt-2 border-t border-dashed ${isChecked ? 'border-blue-200/50' : 'border-gray-100 opacity-50 pointer-events-none'}`}>
                        {subFeatures.map((sub: any) => (
                            <label key={sub.key} className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={permissions[sub.key] === true}
                                        onChange={(e) => onChange({ ...permissions, [sub.key]: e.target.checked })}
                                        className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors select-none">{sub.label}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
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
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                        {/* Header - Wide & Clean */}
                        <div className="px-8 py-6 flex justify-between items-center bg-white border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Configuración de Usuario</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">{editingMember.email}</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleCancelEdit} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Scrollable Body - Grid Layout */}
                        <div className="flex-1 overflow-y-auto bg-gray-50/50 custom-scrollbar">
                            <form id="edit-profile-form" onSubmit={handleSaveEdit} className="p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                                    {/* Left Column: Profile Identity (4 Cols) */}
                                    <div className="lg:col-span-4 space-y-6">
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                            {/* Avatar Box */}
                                            <div className="flex flex-col items-center mb-6">
                                                <div className="relative group cursor-pointer">
                                                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-gray-100">
                                                        {editingMember.avatar_url ? (
                                                            <img src={editingMember.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                <User className="w-12 h-12" />
                                                            </div>
                                                        )}
                                                        {isUploading && (
                                                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                                            </div>
                                                        )}
                                                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer">
                                                            <Camera className="w-8 h-8" />
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
                                                        </label>
                                                    </div>
                                                </div>
                                                <h3 className="mt-4 text-lg font-bold text-gray-900 text-center">{editingMember.full_name || 'Sin Nombre'}</h3>
                                                <p className="text-sm text-gray-500 text-center">{editingMember.role === 'company_admin' ? 'Administrador' : 'Agente Ventas'}</p>
                                            </div>

                                            {/* Core Fields */}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                                                    <Input value={editingMember.full_name || ''} onChange={e => setEditingMember({ ...editingMember, full_name: e.target.value })} className="bg-gray-50" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Teléfono</label>
                                                    <div className="relative">
                                                        <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                                        <Input value={editingMember.phone || ''} onChange={e => setEditingMember({ ...editingMember, phone: e.target.value })} className="pl-9 bg-gray-50" placeholder="+503..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Sitio Web / Link</label>
                                                    <div className="relative">
                                                        <Globe className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                                        <Input value={editingMember.website || ''} onChange={e => setEditingMember({ ...editingMember, website: e.target.value })} className="pl-9 bg-gray-50" placeholder="https://..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Rol</label>
                                                    <select
                                                        className="w-full rounded-lg border-gray-200 bg-gray-50 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                                                        value={editingMember.role}
                                                        onChange={e => setEditingMember({ ...editingMember, role: e.target.value as Role })}
                                                        disabled={editingMember.id === myProfile?.id}
                                                    >
                                                        <option value="sales_agent">Agente de Ventas</option>
                                                        <option value="company_admin">Admin de Empresa</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Permission Matrix (8 Cols) */}
                                    <div className="lg:col-span-8 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">Matriz de Acceso</h3>
                                                <p className="text-sm text-gray-500">Define qué módulos y acciones específicas puede realizar este usuario.</p>
                                            </div>
                                            {editingMember.role === 'company_admin' && (
                                                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                                                    <Shield className="w-4 h-4" />
                                                    Acceso Total (Admin)
                                                </div>
                                            )}
                                        </div>

                                        {(editingMember.role === 'company_admin' || editingMember.role === 'super_admin') ? (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center">
                                                <Shield className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                                                <h4 className="text-blue-900 font-bold text-lg">Modo Administrador Activo</h4>
                                                <p className="text-blue-700 mt-2 max-w-md mx-auto">Este usuario tiene control total sobre todos los módulos activos de la empresa. Para limitar su acceso, cambia su rol a "Agente de Ventas".</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                {/* Leads Module */}
                                                <PermissionCard
                                                    title="CRM & Leads"
                                                    icon={User}
                                                    mainKey="leads"
                                                    desc="Gestión de contactos y pipeline"
                                                    subFeatures={[
                                                        { key: 'leads_delete', label: 'Eliminar Leads' },
                                                        { key: 'leads_export', label: 'Exportar Data' }
                                                    ]}
                                                    permissions={editingMember.permissions}
                                                    onChange={(newPerms) => setEditingMember({ ...editingMember, permissions: newPerms })}
                                                />

                                                {/* Quotes Module */}
                                                <PermissionCard
                                                    title="Cotizaciones"
                                                    icon={FileText}
                                                    mainKey="quotes"
                                                    desc="Creación y envío de presupuestos"
                                                    subFeatures={[
                                                        { key: 'quotes_approve', label: 'Aprobar Descuentos' },
                                                        { key: 'quotes_delete', label: 'Eliminar Cotizaciones' }
                                                    ]}
                                                    permissions={editingMember.permissions}
                                                    onChange={(newPerms) => setEditingMember({ ...editingMember, permissions: newPerms })}
                                                />

                                                {/* Calendar Module */}
                                                <PermissionCard
                                                    title="Agenda & Citas"
                                                    icon={Calendar}
                                                    mainKey="calendar"
                                                    desc="Calendario de actividades"
                                                    subFeatures={[]} // No sub-features yet
                                                    permissions={editingMember.permissions}
                                                    onChange={(newPerms) => setEditingMember({ ...editingMember, permissions: newPerms })}
                                                />

                                                {/* Marketing Module */}
                                                <PermissionCard
                                                    title="Marketing Hub"
                                                    icon={Megaphone}
                                                    mainKey="marketing"
                                                    desc="Campañas y Automatización"
                                                    isPremium
                                                    subFeatures={[
                                                        { key: 'marketing_publish', label: 'Publicar Campañas' }
                                                    ]}
                                                    permissions={editingMember.permissions}
                                                    onChange={(newPerms) => setEditingMember({ ...editingMember, permissions: newPerms })}
                                                />

                                                {/* Chat Module */}
                                                <PermissionCard
                                                    title="Mensajería"
                                                    icon={MessageSquare}
                                                    mainKey="chat"
                                                    desc="Chat unificado y WhatsApp"
                                                    isPremium
                                                    subFeatures={[
                                                        { key: 'chat_history', label: 'Ver Historial Completo' }
                                                    ]}
                                                    permissions={editingMember.permissions}
                                                    onChange={(newPerms) => setEditingMember({ ...editingMember, permissions: newPerms })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

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
                                            <div className="flex gap-3 mt-1 flex-wrap">
                                                {member.phone && <span className="text-xs text-blue-600 flex items-center bg-blue-50 px-1.5 py-0.5 rounded"><Phone className="w-3 h-3 mr-1" /> {member.phone}</span>}
                                                {member.website && <span className="text-xs text-purple-600 flex items-center bg-purple-50 px-1.5 py-0.5 rounded"><Globe className="w-3 h-3 mr-1" /> Web</span>}

                                                {/* Permission Indicators */}
                                                {(member.role === 'company_admin' || member.role === 'super_admin' || member.permissions?.marketing) && (
                                                    <span className="text-xs text-indigo-600 flex items-center bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100" title="Acceso a Marketing">
                                                        <Megaphone className="w-3 h-3 mr-1" /> Marketing
                                                    </span>
                                                )}
                                                {(member.role === 'company_admin' || member.role === 'super_admin' || member.permissions?.chat) && (
                                                    <span className="text-xs text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Acceso a Chat">
                                                        <MessageSquare className="w-3 h-3 mr-1" /> Chat
                                                    </span>
                                                )}
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
