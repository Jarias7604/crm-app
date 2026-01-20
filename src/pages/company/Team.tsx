import { useEffect, useState } from 'react';
import { teamService, type Invitation } from '../../services/team';
import type { Profile, Role } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, Mail, User, Shield } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

export default function Team() {
    const { profile: myProfile } = useAuth();
    const isAdmin = myProfile?.role === 'super_admin' || myProfile?.role === 'company_admin';
    const [members, setMembers] = useState<Profile[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [maxUsers, setMaxUsers] = useState(5);
    const [loading, setLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);

    // Form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<Role>('sales_agent');

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

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!myProfile?.company_id || !myProfile?.id) return;
        if (isLimitReached) {
            alert('Has alcanzado el límite de usuarios permitidos por tu licencia.');
            return;
        }
        setIsInviting(true);
        try {
            await teamService.inviteMember(inviteEmail, inviteRole, myProfile.company_id, myProfile.id);
            setInviteEmail('');
            alert(`✅ Invitación enviada a ${inviteEmail}`);
            loadData();
        } catch (error: any) {
            alert(`❌ Error al invitar: ${error.message}`);
        } finally {
            setIsInviting(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('¿Estás seguro de cancelar esta invitación?')) return;
        try {
            await teamService.revokeInvitation(id);
            loadData();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };

    const handleMemberDelete = async (id: string, email: string) => {
        if (id === myProfile?.id) {
            alert('No puedes eliminarte a ti mismo.');
            return;
        }
        if (!confirm(`¿Estás seguro de eliminar a ${email} del equipo? Perderá el acceso de inmediato.`)) return;
        try {
            await teamService.deleteMember(id);
            alert('✅ Miembro eliminado correctamente');
            loadData();
        } catch (error: any) {
            console.error('Delete failed:', error);
            alert(`❌ Error al eliminar: ${error.message}`);
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

            {/* Invite Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Invitar Colaborador
                </h2>
                <form onSubmit={handleInvite} className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-[250px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email del Colaborador</label>
                        <Input
                            type="email"
                            required
                            placeholder="ejemplo@empresa.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rol Asignado</label>
                        <select
                            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            value={inviteRole}
                            onChange={e => setInviteRole(e.target.value as Role)}
                        >
                            <option value="sales_agent">Agente de Ventas (Solo ve sus leads)</option>
                            <option value="company_admin">Admin de Empresa (Ve todo)</option>
                        </select>
                    </div>
                    <Button type="submit" disabled={isInviting} className="mb-[2px]">
                        {isInviting ? 'Enviando...' : 'Enviar Invitación'}
                    </Button>
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

            {/* Active Members */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                <User className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{member.email}</div>
                                            <div className="text-xs text-gray-500">Unido el {new Date(member.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <RoleBadge role={member.role} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                        {isAdmin && member.id !== myProfile?.id && (
                                            <button
                                                onClick={() => handleMemberDelete(member.id, member.email)}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                title="Eliminar Miembro"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {member.id === myProfile?.id ? (
                                            <span className="text-blue-600 text-xs font-bold px-2 py-1 bg-blue-50 rounded">Tú</span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">Activo</span>
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
