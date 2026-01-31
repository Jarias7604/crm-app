import { Shield, Loader2, ChevronDown, Plus, Trash2, Settings2, Users, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { permissionsService, type PermissionDefinition, type RolePermission, type CustomRole } from '../../services/permissions';
import Switch from '../../components/ui/Switch';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

export default function Permissions() {
    const { profile } = useAuth();
    const [definitions, setDefinitions] = useState<PermissionDefinition[]>([]);
    const [roles, setRoles] = useState<CustomRole[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
    const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Marketing', 'Mensajes', 'Leads']));

    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', base_role: 'sales_agent' as any });
    const [isCreatingRole, setIsCreatingRole] = useState(false);

    const isSuperAdmin = profile?.role === 'super_admin';
    const isCompanyAdmin = profile?.role === 'company_admin';
    const canManage = isSuperAdmin || isCompanyAdmin;

    useEffect(() => {
        if (canManage) {
            loadData();
        }
    }, [canManage]);

    const loadData = async () => {
        if (!profile?.company_id) return;
        try {
            setLoading(true);
            const [defs, rolesData, perms, allowed, counts] = await Promise.all([
                permissionsService.getDefinitions(),
                permissionsService.getRoles(profile.company_id),
                permissionsService.getRolePermissions(),
                permissionsService.getCompanyAllowedPermissions(profile.company_id),
                permissionsService.getRoleMemberCounts(profile.company_id)
            ]);

            const visibleRoles = rolesData.filter(r => isSuperAdmin || r.base_role !== 'super_admin');
            setRoles(visibleRoles);

            if (!selectedRoleId && visibleRoles.length > 0) {
                setSelectedRoleId(visibleRoles[0].id);
            }

            const visibleDefs = isSuperAdmin
                ? defs
                : defs.filter(d => !d.is_system_only && allowed.includes(d.permission_key));

            setDefinitions(visibleDefs);
            setRolePermissions(perms);
            setRoleCounts(counts);
        } catch (error) {
            console.error('Error loading permissions:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (roleId: string, key: string, currentStatus: boolean) => {
        const toggleId = `${roleId}-${key}`;
        try {
            setSaving(toggleId);
            await permissionsService.updatePermission(roleId, key, !currentStatus);

            setRolePermissions(prev => {
                const existing = prev.find(p => p.role_id === roleId && p.permission_key === key);
                if (existing) {
                    return prev.map(p => p.role_id === roleId && p.permission_key === key ? { ...p, is_enabled: !currentStatus } : p);
                } else {
                    return [...prev, { id: 'temp-' + Date.now(), role_id: roleId, permission_key: key, is_enabled: !currentStatus }];
                }
            });
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al actualizar');
        } finally {
            setSaving(null);
        }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.company_id || !newRole.name) return;

        setIsCreatingRole(true);
        try {
            const role = await permissionsService.createRole({
                name: newRole.name,
                base_role: newRole.base_role,
                company_id: profile.company_id,
                is_system: false
            });
            toast.success('Rol creado');
            setIsRoleModalOpen(false);
            setNewRole({ name: '', base_role: 'sales_agent' });
            setSelectedRoleId(role.id);
            loadData();
        } catch (error) {
            toast.error('Error al crear el rol');
        } finally {
            setIsCreatingRole(false);
        }
    };

    const handleDeleteRole = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar rol "${name}"?`)) return;
        try {
            await permissionsService.deleteRole(id);
            toast.success('Rol eliminado');
            if (selectedRoleId === id) setSelectedRoleId(roles[0]?.id || null);
            loadData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const isEnabled = (roleId: string, key: string) => {
        const role = roles.find(r => r.id === roleId);
        if (role?.base_role === 'super_admin') return true;
        return rolePermissions.find(p => p.role_id === roleId && p.permission_key === key)?.is_enabled ?? false;
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) newSet.delete(category);
            else newSet.add(category);
            return newSet;
        });
    };

    const getCategoryIcon = (category: string) => {
        const icons: Record<string, string> = {
            'Configuración': '⚙️', 'Equipo': '👥', 'Leads': '🎯', 'Seguimientos': '📋',
            'Calendario': '📅', 'Dashboard': '📊', 'Marketing': '📣', 'Mensajes': '💬'
        };
        return icons[category] || '📌';
    };

    if (!canManage) return <div className="p-8 text-center text-red-500 font-bold">Acceso restringido.</div>;
    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Configurando Seguridad...</p>
        </div>
    );

    const selectedRole = roles.find(r => r.id === selectedRoleId);
    const groupedDefinitions = definitions.reduce((acc, def) => {
        if (!acc[def.category]) acc[def.category] = [];
        acc[def.category].push(def);
        return acc;
    }, {} as Record<string, PermissionDefinition[]>);

    const categories = Object.keys(groupedDefinitions).sort();

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-8 animate-in fade-in duration-500">
            {/* Header Style - Matched with Team - Compact */}
            <header className="flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-gray-50 pb-6">
                <div className="space-y-0.5">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Matriz de Seguridad</h1>
                    <p className="text-[13px] text-gray-400 font-medium font-inter">Define la libertad y control de cada integrante de tu equipo.</p>
                </div>
                <Button
                    onClick={() => setIsRoleModalOpen(true)}
                    className="h-11 px-6 rounded-lg bg-[#4449AA] text-white hover:bg-[#383d8f] font-black text-[10px] uppercase tracking-widest shadow-md transition-all border-0"
                >
                    <Plus className="w-4 h-4 mr-2" /> Crear Nuevo Rol
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Role List Sidebar - Compact */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Perfiles de Rol
                            </h3>
                        </div>

                        <div className="space-y-2 custom-scrollbar max-h-[60vh] overflow-y-auto pr-1">
                            {roles.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${selectedRoleId === role.id
                                        ? 'bg-[#4449AA] text-white shadow-lg translate-x-1'
                                        : 'bg-white hover:bg-gray-50 text-gray-600 hover:translate-x-1 border border-transparent hover:border-gray-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs transition-transform ${selectedRoleId === role.id ? 'bg-white/20' : 'bg-gray-50 text-gray-400'
                                            }`}>
                                            {role.name.charAt(0)}
                                        </div>
                                        <div className="text-left relative">
                                            <p className={`font-bold text-[13px] transition-all leading-tight ${selectedRoleId === role.id ? 'text-white' : 'text-gray-900'}`}>
                                                {role.name}
                                            </p>
                                            <p className={`text-[8px] uppercase tracking-widest font-black opacity-60`}>
                                                {role.base_role === 'company_admin' ? 'Empresa' : (role.base_role === 'super_admin' ? 'Maestro' : 'Colaborador')}
                                            </p>
                                            {/* Badge de Conteo */}
                                            {(roleCounts[role.id] || 0) > 0 && (
                                                <div className={`absolute -top-1 -right-4 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black transition-all ${selectedRoleId === role.id ? 'bg-white text-indigo-600' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                    }`}>
                                                    {roleCounts[role.id]}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {selectedRoleId === role.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                                </button>
                            ))}
                        </div>

                        {selectedRole && (!selectedRole.is_system || selectedRole.company_id === profile.company_id) && (
                            <div className="mt-4 pt-4 border-t border-gray-50">
                                <button
                                    onClick={() => handleDeleteRole(selectedRole.id, selectedRole.name)}
                                    className="w-full flex items-center justify-center gap-2 p-2.5 text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar Rol
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Permissions Matrix - Compact */}
                <div className="lg:col-span-9 space-y-6">
                    {selectedRole ? (
                        <div className="animate-in slide-in-from-right-4 duration-500">
                            {/* Role Banner Context - Compact */}
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
                                <div className="relative z-10">
                                    <h2 className="text-2xl font-black text-gray-900 mb-1 uppercase tracking-tight">{selectedRole.name}</h2>
                                    <div className="flex items-center gap-3">
                                        <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-indigo-100">Editor Activo</span>
                                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Base: <span className="text-gray-900 font-black">{selectedRole.base_role === 'company_admin' ? 'Total' : 'Colaborador'}</span></p>
                                    </div>
                                </div>
                                <div className="relative z-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#4449AA] bg-white px-6 py-3 rounded-xl border border-gray-100 shadow-md">
                                    <Settings2 className="w-4 h-4" /> Configuración Maestro
                                </div>
                            </div>

                            {selectedRole.base_role === 'super_admin' ? (
                                <div className="p-16 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100 text-center">
                                    <Shield className="w-12 h-12 text-indigo-600/20 mx-auto mb-4" />
                                    <h3 className="text-gray-900 font-black text-xl mb-3 uppercase tracking-tight">Acceso Total del Sistema</h3>
                                    <p className="text-gray-400 font-bold max-w-sm mx-auto leading-relaxed text-[13px] uppercase tracking-widest">
                                        Este perfil posee privilegios globales permanentes. No requiere configuración individual.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {categories.map(category => {
                                        const isExpanded = expandedCategories.has(category);
                                        const permissions = groupedDefinitions[category];
                                        return (
                                            <div key={category} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-50/50' : ''}`}>
                                                <button
                                                    onClick={() => toggleCategory(category)}
                                                    className={`w-full px-8 py-5 flex items-center justify-between transition-all ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50/50'}`}
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">
                                                            {getCategoryIcon(category)}
                                                        </div>
                                                        <div className="text-left">
                                                            <h3 className="font-black text-lg text-gray-900 uppercase tracking-tight">{category}</h3>
                                                            <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold">{permissions.length} módulos maestros</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-[#4449AA] text-white rotate-180 shadow-md' : 'bg-white border border-gray-100 text-gray-300'}`}>
                                                        <ChevronDown className="w-5 h-5" />
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="px-8 pb-8 space-y-1 animate-in slide-in-from-top-2 duration-300">
                                                        {permissions.map(perm => (
                                                            <div key={perm.permission_key} className="py-4 flex items-center justify-between group border-b border-gray-50 last:border-0 hover:bg-gray-50/20 px-4 rounded-xl transition-colors">
                                                                <div className="space-y-0.5">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <p className="font-black text-sm text-gray-800 transition-colors uppercase tracking-tight">{perm.label}</p>
                                                                        <Info className="w-3.5 h-3.5 text-gray-300 cursor-help" />
                                                                    </div>
                                                                    <p className="text-[9px] text-gray-300 font-bold uppercase tracking-[0.2em]">{perm.permission_key.split('.').pop()}</p>
                                                                </div>
                                                                <div className="flex items-center gap-5">
                                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isEnabled(selectedRole.id, perm.permission_key) ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                                        {isEnabled(selectedRole.id, perm.permission_key) ? 'Habilitado' : 'Restringido'}
                                                                    </span>
                                                                    <Switch
                                                                        checked={isEnabled(selectedRole.id, perm.permission_key)}
                                                                        onChange={() => handleToggle(selectedRole.id, perm.permission_key, isEnabled(selectedRole.id, perm.permission_key))}
                                                                        disabled={saving === `${selectedRole.id}-${perm.permission_key}`}
                                                                        size="sm"
                                                                        colorVariant="blue"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-24 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                            <Shield className="w-16 h-16 text-indigo-600/10 mb-6" />
                            <h3 className="text-gray-400 font-black text-xl mb-3 uppercase tracking-tight">Acceso No Seleccionado</h3>
                            <p className="text-gray-300 font-bold uppercase tracking-widest text-[9px] max-w-xs">Elige un perfil maestro en el panel lateral.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Role Creation Modal - RESTORED PREMIUM DESIGN */}
            <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title="Arquitectura de Nuevo Rol" className="max-w-xl rounded-[3rem] p-0 overflow-hidden shadow-3xl">
                <div className="bg-white p-12 space-y-10">
                    <form onSubmit={handleCreateRole} className="space-y-10">
                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-[#4449AA] uppercase tracking-[0.3em] pl-1">Identidad Institucional</label>
                            <Input
                                placeholder="Ej: Dirección de Marketing Digital"
                                value={newRole.name}
                                onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                className="h-16 rounded-2xl border-gray-100 bg-gray-50/50 shadow-inner text-lg font-bold placeholder:text-gray-300 focus:bg-white"
                                required
                            />
                        </div>
                        <div className="space-y-6">
                            <label className="text-[11px] font-black text-[#4449AA] uppercase tracking-[0.3em] pl-1">Arquetipo de Visibilidad (Base)</label>
                            <div className="grid grid-cols-2 gap-6">
                                <button
                                    type="button"
                                    onClick={() => setNewRole({ ...newRole, base_role: 'sales_agent' })}
                                    className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${newRole.base_role === 'sales_agent' ? 'border-[#4449AA] bg-indigo-50 shadow-xl scale-[1.02]' : 'border-gray-50 bg-gray-50/30'
                                        }`}
                                >
                                    <Users className={`w-10 h-10 ${newRole.base_role === 'sales_agent' ? 'text-[#4449AA]' : 'text-gray-300'}`} />
                                    <div className="text-center">
                                        <p className="font-black text-xs uppercase tracking-widest mb-1">Colaborador</p>
                                        <p className="text-[10px] text-gray-400 font-bold leading-tight">Visibilidad<br />Restringida</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewRole({ ...newRole, base_role: 'company_admin' })}
                                    className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${newRole.base_role === 'company_admin' ? 'border-[#4449AA] bg-indigo-50 shadow-xl scale-[1.02]' : 'border-gray-50 bg-gray-50/30'
                                        }`}
                                >
                                    <Shield className={`w-10 h-10 ${newRole.base_role === 'company_admin' ? 'text-[#4449AA]' : 'text-gray-300'}`} />
                                    <div className="text-center">
                                        <p className="font-black text-xs uppercase tracking-widest mb-1">Administrador</p>
                                        <p className="text-[10px] text-gray-400 font-bold leading-tight">Visibilidad<br />Empresarial</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6">
                            <button
                                type="button"
                                onClick={() => setIsRoleModalOpen(false)}
                                className="h-16 rounded-2xl font-black text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-900 bg-gray-50 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <Button
                                type="submit"
                                disabled={isCreatingRole || !newRole.name}
                                className="h-16 rounded-2xl bg-[#4449AA] hover:bg-[#383d8f] text-white shadow-2xl transition-all border-0 font-black text-xs uppercase tracking-widest"
                            >
                                {isCreatingRole ? 'Sincronizando...' : 'Finalizar Creación'}
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
}
