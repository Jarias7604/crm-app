import {
    Shield, Loader2, ChevronDown, ChevronRight, Plus, Trash2, Users, Info,
    Building, Target, MessageSquare, Megaphone, Calendar, LayoutDashboard,
    FileText, Layers, CreditCard, BarChart3, Headset, AlertTriangle, CheckCircle2,
    Settings2, Lock, Unlock
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import {
    permissionsService,
    type PermissionDefinition,
    type RolePermission,
    type CustomRole
} from '../../services/permissions';
import Switch from '../../components/ui/Switch';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

// ─── Category icon map ────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, any> = {
    'Configuración': Settings2,
    'Equipo':        Users,
    'Leads':         Target,
    'Seguimientos':  Info,
    'Calendario':    Calendar,
    'Dashboard':     LayoutDashboard,
    'Marketing':     Megaphone,
    'Mensajes':      MessageSquare,
    'Cotizaciones':  FileText,
    'Proyectos':     Layers,
    'Finanzas':      CreditCard,
    'Reportes BI':   BarChart3,
    'Soporte':       Headset,
    'Clientes':      Building,
};

// ─── Base-role labels ─────────────────────────────────────────────────────────
const BASE_ROLE_LABEL: Record<string, string> = {
    super_admin:   'Maestro',
    company_admin: 'Administrador',
    sales_agent:   'Colaborador',
    collaborator:  'Colaborador',
};

// ─── Role badge colors ────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, string> = {
    super_admin:   'bg-purple-100 text-purple-700 border-purple-200',
    company_admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    sales_agent:   'bg-sky-100 text-sky-700 border-sky-200',
    collaborator:  'bg-sky-100 text-sky-700 border-sky-200',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Permissions() {
    const { profile } = useAuth();

    const [definitions,     setDefinitions]     = useState<PermissionDefinition[]>([]);
    const [roles,           setRoles]           = useState<CustomRole[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
    const [roleCounts,      setRoleCounts]      = useState<Record<string, number>>({});
    const [allowedPerms,    setAllowedPerms]    = useState<string[]>([]);

    const [loading,         setLoading]         = useState(true);
    const [isSavingBulk,    setIsSavingBulk]    = useState(false);

    const [selectedRoleId,  setSelectedRoleId]  = useState<string | null>(null);
    const [pendingChanges,  setPendingChanges]  = useState<Record<string, boolean>>({});
    const [expandedCats,    setExpandedCats]    = useState<Set<string>>(new Set());

    // Role creation modal
    const [isCreateOpen,    setIsCreateOpen]    = useState(false);
    const [newRole,         setNewRole]         = useState({ name: '', base_role: 'sales_agent' as string });
    const [isCreatingRole,  setIsCreatingRole]  = useState(false);

    // Delete confirm
    const [deletingRole,    setDeletingRole]    = useState<CustomRole | null>(null);

    const isSuperAdmin  = profile?.role === 'super_admin';
    const isCompanyAdmin = profile?.role === 'company_admin';
    const canManage     = isSuperAdmin || isCompanyAdmin;

    // ─── Load all data ────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            setLoading(true);
            const [defs, rolesData, perms, allowed, counts] = await Promise.all([
                permissionsService.getDefinitions(),
                permissionsService.getRoles(profile.company_id),
                permissionsService.getRolePermissions(),
                permissionsService.getCompanyAllowedPermissions(profile.company_id),
                permissionsService.getRoleMemberCounts(profile.company_id),
            ]);

            const visible = rolesData.filter(r => isSuperAdmin || r.base_role !== 'super_admin');
            setRoles(visible);
            setRolePermissions(perms);
            setAllowedPerms(allowed);
            setRoleCounts(counts);
            setDefinitions(defs);

            // Auto-select first role on first load
            setSelectedRoleId(prev => {
                if (prev && visible.some(r => r.id === prev)) return prev;
                return visible[0]?.id ?? null;
            });
        } catch {
            toast.error('Error al cargar datos de permisos');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id, isSuperAdmin]);

    useEffect(() => {
        if (canManage) loadData();
    }, [canManage, loadData]);

    // ─── Permission helpers ───────────────────────────────────────────────────
    const isEnabled = (roleId: string, key: string): boolean => {
        const role = roles.find(r => r.id === roleId);
        // super_admin roles always have everything
        if (role?.base_role === 'super_admin') return true;

        const tid = `${roleId}|${key}`;
        if (pendingChanges[tid] !== undefined) return pendingChanges[tid];

        return rolePermissions.find(p => p.role_id === roleId && p.permission_key === key)?.is_enabled ?? false;
    };

    const handleToggle = (roleId: string, key: string) => {
        const tid = `${roleId}|${key}`;
        const current = isEnabled(roleId, key);
        setPendingChanges(prev => ({ ...prev, [tid]: !current }));
    };

    const pendingCount = Object.keys(pendingChanges).length;

    const handleSave = async () => {
        if (pendingCount === 0) return;
        const updates = Object.entries(pendingChanges).map(([tid, is_enabled]) => {
            const [role_id, permission_key] = tid.split('|');
            return { role_id, permission_key, is_enabled };
        });
        setIsSavingBulk(true);
        const tid = toast.loading('Guardando permisos...');
        try {
            await permissionsService.bulkUpdatePermissions(updates);
            toast.success('¡Permisos guardados!', { id: tid });
            setPendingChanges({});
            await loadData();
        } catch (e: any) {
            toast.error('Error al guardar: ' + (e?.message ?? ''), { id: tid });
        } finally {
            setIsSavingBulk(false);
        }
    };

    // ─── Role create ──────────────────────────────────────────────────────────
    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.company_id || !newRole.name.trim()) return;
        setIsCreatingRole(true);
        try {
            const created = await permissionsService.createRole({
                name: newRole.name.trim(),
                base_role: newRole.base_role as any,
                company_id: profile.company_id,
                is_system: false,
            });
            toast.success('Perfil de acceso creado');
            setIsCreateOpen(false);
            setNewRole({ name: '', base_role: 'sales_agent' });
            setSelectedRoleId(created.id);
            await loadData();
        } catch {
            toast.error('Error al crear el perfil de acceso');
        } finally {
            setIsCreatingRole(false);
        }
    };

    // ─── Role delete ──────────────────────────────────────────────────────────
    const handleDeleteRole = async (role: CustomRole) => {
        try {
            await permissionsService.deleteRole(role.id);
            toast.success('Perfil eliminado');
            setDeletingRole(null);
            setSelectedRoleId(roles.find(r => r.id !== role.id)?.id ?? null);
            await loadData();
        } catch {
            toast.error('Error al eliminar el perfil');
        }
    };

    // ─── Category expand ──────────────────────────────────────────────────────
    const toggleCat = (cat: string) => {
        setExpandedCats(prev => {
            const s = new Set(prev);
            s.has(cat) ? s.delete(cat) : s.add(cat);
            return s;
        });
    };

    // ─── Permission visibility (respect company license) ──────────────────────
    const isPermVisible = (def: PermissionDefinition): boolean => {
        if (isSuperAdmin) return true;
        if (def.is_system_only) return false;
        // Always show infra permissions
        if (['Equipo', 'Dashboard', 'Seguimientos'].includes(def.category)) return true;
        // Check company license
        if (allowedPerms.includes(def.permission_key)) return true;
        const base = def.permission_key.split(/[._]/)[0];
        if (allowedPerms.includes(base)) return true;
        // Special mappings
        if (def.permission_key.startsWith('mkt_') && allowedPerms.includes('marketing')) return true;
        if (def.permission_key.startsWith('cotizaciones.') && allowedPerms.includes('quotes')) return true;
        if ((def.permission_key.startsWith('clientes.') || def.permission_key === 'clientes') && allowedPerms.includes('leads')) return true;
        return false;
    };

    // ─── Derived state ────────────────────────────────────────────────────────
    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                    <Lock className="w-8 h-8 text-red-400" />
                </div>
                <p className="font-black text-gray-900 text-lg uppercase tracking-tight">Acceso Restringido</p>
                <p className="text-sm text-gray-400 font-medium">Solo administradores pueden gestionar permisos.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargando Perfiles de Acceso...</p>
            </div>
        );
    }

    const selectedRole = roles.find(r => r.id === selectedRoleId);
    const isSuperAdminRole = selectedRole?.base_role === 'super_admin';
    const isSystemRole = selectedRole?.is_system === true && selectedRole?.company_id !== profile?.company_id;

    // Grouped & filtered definitions
    const groupedDefs = definitions
        .filter(isPermVisible)
        .reduce((acc, def) => {
            if (!acc[def.category]) acc[def.category] = [];
            acc[def.category].push(def);
            return acc;
        }, {} as Record<string, PermissionDefinition[]>);

    const categories = Object.keys(groupedDefs).sort();

    // Enabled count for selected role
    const enabledCount = selectedRole
        ? definitions.filter(d => isEnabled(selectedRole.id, d.permission_key)).length
        : 0;

    return (
        <div className="w-full max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* ── Header ── */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-gray-100 pb-6 mb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#4449AA]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Roles y Permisos</h1>
                            <p className="text-[12px] text-gray-400 font-medium">
                                Fuente única de verdad — lo que configures aquí es lo que ve cada integrante.
                            </p>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="h-10 px-5 rounded-xl bg-[#4449AA] text-white hover:bg-[#383d8f] font-black text-[10px] uppercase tracking-widest shadow-md transition-all border-0 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Perfil de Acceso
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* ── LEFT: Role List ── */}
                <aside className="lg:col-span-3 space-y-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50">
                            <h2 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" />
                                Perfiles de Acceso ({roles.length})
                            </h2>
                        </div>

                        <div className="p-3 space-y-1 max-h-[65vh] overflow-y-auto custom-scrollbar">
                            {roles.map(role => {
                                const memberCount = roleCounts[role.id] || 0;
                                const isSelected = selectedRoleId === role.id;
                                const badgeClass = ROLE_BADGE[role.base_role] ?? ROLE_BADGE['sales_agent'];

                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => {
                                            setSelectedRoleId(role.id);
                                            setPendingChanges({});
                                        }}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group ${
                                            isSelected
                                                ? 'bg-[#4449AA] text-white shadow-lg'
                                                : 'hover:bg-gray-50 text-gray-700 border border-transparent hover:border-gray-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {role.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="text-left min-w-0">
                                                <p className={`font-bold text-[13px] leading-tight truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                    {role.name}
                                                </p>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-widest ${
                                                    isSelected ? 'bg-white/20 text-white border-white/20' : badgeClass
                                                }`}>
                                                    {BASE_ROLE_LABEL[role.base_role] ?? role.base_role}
                                                </span>
                                            </div>
                                        </div>
                                        {memberCount > 0 && (
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {memberCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Delete zone — only for non-system roles */}
                    {selectedRole && !isSystemRole && !isSuperAdminRole && (
                        <button
                            onClick={() => setDeletingRole(selectedRole)}
                            className="w-full flex items-center justify-center gap-2 p-3 text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar Perfil Seleccionado
                        </button>
                    )}
                </aside>

                {/* ── RIGHT: Permissions Matrix ── */}
                <main className="lg:col-span-9 space-y-4">

                    {!selectedRole ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-100 p-24 flex flex-col items-center text-center gap-4">
                            <Shield className="w-12 h-12 text-indigo-200" />
                            <p className="font-black text-gray-400 uppercase tracking-tight">Selecciona un perfil de acceso</p>
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-right-3 duration-300">

                            {/* Role header bar */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-xl text-[#4449AA]">
                                        {selectedRole.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{selectedRole.name}</h2>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${ROLE_BADGE[selectedRole.base_role] ?? ROLE_BADGE['sales_agent']}`}>
                                                {BASE_ROLE_LABEL[selectedRole.base_role] ?? selectedRole.base_role}
                                            </span>
                                            {!isSuperAdminRole && (
                                                <span className="text-[10px] text-gray-400 font-bold">
                                                    {enabledCount} permisos activos
                                                </span>
                                            )}
                                            {roleCounts[selectedRole.id] > 0 && (
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                    {roleCounts[selectedRole.id]} miembro{roleCounts[selectedRole.id] !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Enable / Disable all for this role (non-superadmin only) */}
                                {!isSuperAdminRole && !isSystemRole && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const all: Record<string, boolean> = {};
                                                definitions.filter(isPermVisible).forEach(d => {
                                                    all[`${selectedRole.id}|${d.permission_key}`] = true;
                                                });
                                                setPendingChanges(all);
                                            }}
                                            className="flex items-center gap-1.5 h-8 px-3 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-all"
                                        >
                                            <Unlock className="w-3 h-3" /> Todo ON
                                        </button>
                                        <button
                                            onClick={() => {
                                                const all: Record<string, boolean> = {};
                                                definitions.filter(isPermVisible).forEach(d => {
                                                    all[`${selectedRole.id}|${d.permission_key}`] = false;
                                                });
                                                setPendingChanges(all);
                                            }}
                                            className="flex items-center gap-1.5 h-8 px-3 text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-all"
                                        >
                                            <Lock className="w-3 h-3" /> Todo OFF
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Super Admin special message */}
                            {isSuperAdminRole ? (
                                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-12 text-center">
                                    <Shield className="w-10 h-10 text-purple-300 mx-auto mb-3" />
                                    <p className="font-black text-gray-900 text-lg uppercase tracking-tight mb-1">Acceso Total del Sistema</p>
                                    <p className="text-gray-400 text-sm font-medium max-w-xs mx-auto">
                                        Este perfil tiene acceso irrestricto. No se puede modificar por diseño de seguridad.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {categories.map(cat => {
                                        const perms = groupedDefs[cat];
                                        const isOpen = expandedCats.has(cat);
                                        const CatIcon = CATEGORY_ICONS[cat] ?? Building;
                                        const activeInCat = perms.filter(p => isEnabled(selectedRole.id, p.permission_key)).length;
                                        const hasPending = perms.some(p => pendingChanges[`${selectedRole.id}|${p.permission_key}`] !== undefined);

                                        return (
                                            <div
                                                key={cat}
                                                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${
                                                    isOpen ? 'border-indigo-100 ring-1 ring-indigo-50' : 'border-gray-100'
                                                }`}
                                            >
                                                {/* Category header */}
                                                <button
                                                    onClick={() => toggleCat(cat)}
                                                    className={`w-full px-6 py-4 flex items-center justify-between transition-all ${isOpen ? 'bg-indigo-50/40' : 'hover:bg-gray-50/50'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isOpen ? 'bg-white shadow-sm ring-1 ring-indigo-100' : 'bg-gray-50'}`}>
                                                            <CatIcon className={`w-5 h-5 ${isOpen ? 'text-[#4449AA]' : 'text-gray-400'}`} />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-black text-[15px] text-gray-900 uppercase tracking-tight">{cat}</h3>
                                                                {hasPending && (
                                                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Cambios pendientes" />
                                                                )}
                                                            </div>
                                                            <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">
                                                                {activeInCat} / {perms.length} habilitados
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                                        isOpen ? 'bg-[#4449AA] text-white' : 'bg-gray-50 text-gray-300 border border-gray-100'
                                                    }`}>
                                                        {isOpen
                                                            ? <ChevronDown className="w-4 h-4" />
                                                            : <ChevronRight className="w-4 h-4" />
                                                        }
                                                    </div>
                                                </button>

                                                {/* Permission rows */}
                                                {isOpen && (
                                                    <div className="px-6 pb-5 pt-1 space-y-0 animate-in slide-in-from-top-2 duration-200">
                                                        {perms.map((perm, idx) => {
                                                            const enabled = isEnabled(selectedRole.id, perm.permission_key);
                                                            const isPending = pendingChanges[`${selectedRole.id}|${perm.permission_key}`] !== undefined;

                                                            return (
                                                                <div
                                                                    key={perm.permission_key}
                                                                    className={`flex items-center justify-between py-3.5 px-3 rounded-xl transition-colors group ${
                                                                        idx !== perms.length - 1 ? 'border-b border-gray-50' : ''
                                                                    } ${isPending ? 'bg-amber-50/40' : 'hover:bg-gray-50/50'}`}
                                                                >
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                                                                            enabled ? 'bg-emerald-400' : 'bg-gray-200'
                                                                        }`} />
                                                                        <div className="min-w-0">
                                                                            <p className="font-bold text-sm text-gray-800 leading-tight">{perm.label}</p>
                                                                            <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest font-mono">
                                                                                {perm.permission_key}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                                                                            enabled ? 'text-emerald-500' : 'text-gray-300'
                                                                        }`}>
                                                                            {enabled ? 'Activo' : 'Off'}
                                                                        </span>
                                                                        <Switch
                                                                            checked={enabled}
                                                                            onChange={() => handleToggle(selectedRole.id, perm.permission_key)}
                                                                            size="sm"
                                                                            colorVariant="blue"
                                                                            disabled={isSystemRole}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* ── Floating Save Bar ── */}
            {pendingCount > 0 && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300">
                    <div className="bg-white rounded-2xl px-5 py-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <div>
                                <p className="text-[9px] font-black text-[#4449AA] uppercase tracking-widest">Cambios sin guardar</p>
                                <p className="text-[11px] text-gray-500 font-bold">{pendingCount} permiso{pendingCount !== 1 ? 's' : ''} modificado{pendingCount !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-gray-100" />
                        <button
                            onClick={() => setPendingChanges({})}
                            disabled={isSavingBulk}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50"
                        >
                            Descartar
                        </button>
                        <Button
                            onClick={handleSave}
                            disabled={isSavingBulk}
                            className="h-9 px-5 bg-[#4449AA] hover:bg-[#383d8f] text-white border-0 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2"
                        >
                            {isSavingBulk
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                                : <><CheckCircle2 className="w-3.5 h-3.5" /> Guardar Cambios</>
                            }
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Create Role Modal ── */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => { setIsCreateOpen(false); setNewRole({ name: '', base_role: 'sales_agent' }); }}
                title="Nuevo Perfil de Acceso"
                className="max-w-md"
            >
                <form onSubmit={handleCreateRole} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#4449AA] uppercase tracking-widest">Nombre del Perfil</label>
                        <Input
                            placeholder="Ej: Agente de Ventas, Coordinador..."
                            value={newRole.name}
                            onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
                            className="h-11 rounded-xl"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#4449AA] uppercase tracking-widest">Tipo Base</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'sales_agent', label: 'Colaborador', desc: 'Acceso por módulo', icon: Users },
                                { value: 'company_admin', label: 'Administrador', desc: 'Acceso amplio', icon: Shield },
                            ].map(opt => {
                                const Icon = opt.icon;
                                const active = newRole.base_role === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setNewRole(p => ({ ...p, base_role: opt.value }))}
                                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                            active ? 'border-[#4449AA] bg-indigo-50 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                    >
                                        <Icon className={`w-6 h-6 ${active ? 'text-[#4449AA]' : 'text-gray-300'}`} />
                                        <p className="font-black text-xs uppercase tracking-tight">{opt.label}</p>
                                        <p className="text-[9px] text-gray-400 font-bold">{opt.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <Button
                            type="submit"
                            disabled={isCreatingRole || !newRole.name.trim()}
                            className="flex-1 h-10 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white border-0 font-black text-[10px] uppercase tracking-widest"
                        >
                            {isCreatingRole ? 'Creando...' : 'Crear Perfil'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Delete Confirm Modal ── */}
            <Modal
                isOpen={!!deletingRole}
                onClose={() => setDeletingRole(null)}
                title="Eliminar Perfil de Acceso"
                className="max-w-sm"
            >
                <div className="p-6 space-y-5">
                    <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-sm text-gray-900 mb-1">
                                ¿Eliminar "{deletingRole?.name}"?
                            </p>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                {(roleCounts[deletingRole?.id ?? ''] ?? 0) > 0
                                    ? `Este perfil tiene ${roleCounts[deletingRole?.id ?? '']} miembro(s) asignado(s). Al eliminarlo, quedarán sin perfil de acceso hasta que se les asigne uno nuevo.`
                                    : 'Esta acción no se puede deshacer. Se eliminarán todos sus permisos configurados.'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDeletingRole(null)}
                            className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => deletingRole && handleDeleteRole(deletingRole)}
                            className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 transition-all"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
