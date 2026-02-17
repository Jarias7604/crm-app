import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Users, Plus, Edit2, Trash2, UserPlus, UserMinus, Crown,
    Loader2, Search, X, ChevronRight, Palette, Smile, Building
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import { teamsService, type Team, type CreateTeamData, type TeamMember } from '../../services/teams';
import { teamService } from '../../services/team';
import type { Profile } from '../../types';

// === EMOJI PICKER OPTIONS ===
const TEAM_EMOJIS = ['👥', '🚀', '💼', '📊', '🎯', '⚡', '🔥', '💎', '🌟', '🏆', '📱', '🎨', '🛡️', '🔧', '📈', '🌐', '💡', '🎪', '👑', '🦾'];
const TEAM_COLORS = ['#4449AA', '#059669', '#DC2626', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#4F46E5', '#EA580C', '#16A34A', '#2563EB', '#9333EA'];

export default function Teams() {
    const { profile } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);
    const [allMembers, setAllMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedTeamDetail, setSelectedTeamDetail] = useState<Team | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Create/Edit Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [formData, setFormData] = useState<CreateTeamData>({ name: '', description: '', emoji: '👥', color: '#4449AA' });
    const [isSaving, setIsSaving] = useState(false);

    // Add Member Modal
    const [showAddMember, setShowAddMember] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [memberSearch, setMemberSearch] = useState('');

    const loadTeams = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [teamsData, membersData] = await Promise.all([
                teamsService.getTeams(profile.company_id),
                teamService.getTeamMembers(profile.company_id),
            ]);
            setTeams(teamsData);
            setAllMembers(membersData || []);
        } catch (err) {
            console.error('Error loading teams:', err);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => {
        loadTeams();
    }, [loadTeams]);

    const loadTeamDetail = async (teamId: string) => {
        setLoadingDetail(true);
        try {
            const detail = await teamsService.getTeamWithMembers(teamId);
            setSelectedTeamDetail(detail);
        } catch (err) {
            console.error('Error loading team detail:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleSelectTeam = (team: Team) => {
        setSelectedTeam(team);
        loadTeamDetail(team.id);
    };

    // === CREATE / EDIT ===
    const openCreateModal = () => {
        setEditingTeam(null);
        setFormData({ name: '', description: '', emoji: '👥', color: '#4449AA' });
        setShowCreateModal(true);
    };

    const openEditModal = (team: Team) => {
        setEditingTeam(team);
        setFormData({
            name: team.name,
            description: team.description || '',
            emoji: team.emoji,
            color: team.color,
            leader_id: team.leader_id || undefined,
        });
        setShowCreateModal(true);
    };

    const handleSaveTeam = async () => {
        console.log('[Teams] handleSaveTeam called, company_id:', profile?.company_id, 'formData:', formData);
        if (!profile?.company_id) {
            console.error('[Teams] No company_id found!');
            toast.error('Error: No se encontró la empresa');
            return;
        }
        if (!formData.name.trim()) { toast.error('El nombre es requerido'); return; }

        setIsSaving(true);
        try {
            if (editingTeam) {
                await teamsService.updateTeam(editingTeam.id, formData);
                toast.success('Equipo actualizado');
            } else {
                const result = await teamsService.createTeam(profile.company_id, formData);
                console.log('[Teams] Team created successfully:', result);
                toast.success('Equipo creado exitosamente');
            }
            setShowCreateModal(false);
            await loadTeams();
            if (selectedTeam) loadTeamDetail(selectedTeam.id);
        } catch (err: any) {
            console.error('[Teams] Error saving team:', err);
            toast.error(err.message || 'Error al guardar equipo');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTeam = async (team: Team) => {
        if (!confirm(`¿Eliminar equipo "${team.name}"? Los miembros NO serán eliminados del sistema.`)) return;
        try {
            await teamsService.deleteTeam(team.id);
            toast.success('Equipo eliminado');
            if (selectedTeam?.id === team.id) {
                setSelectedTeam(null);
                setSelectedTeamDetail(null);
            }
            loadTeams();
        } catch (err: any) {
            toast.error(err.message || 'Error al eliminar');
        }
    };

    // === MEMBER MANAGEMENT ===
    const openAddMember = async () => {
        if (!profile?.company_id || !selectedTeam) return;
        setMemberSearch('');
        try {
            const users = await teamsService.getAvailableUsers(profile.company_id, selectedTeam.id);
            setAvailableUsers(users);
            setShowAddMember(true);
        } catch (err) {
            toast.error('Error al cargar usuarios');
        }
    };

    const handleAddMember = async (userId: string) => {
        if (!selectedTeam) return;
        try {
            await teamsService.addMember(selectedTeam.id, userId);
            toast.success('Miembro agregado');
            setShowAddMember(false);
            loadTeamDetail(selectedTeam.id);
            loadTeams();
        } catch (err: any) {
            toast.error(err.message || 'Error al agregar');
        }
    };

    const handleRemoveMember = async (userId: string, userName: string) => {
        if (!selectedTeam) return;
        if (!confirm(`¿Remover a ${userName} del equipo?`)) return;
        try {
            await teamsService.removeMember(selectedTeam.id, userId);
            toast.success('Miembro removido');
            loadTeamDetail(selectedTeam.id);
            loadTeams();
        } catch (err: any) {
            toast.error(err.message || 'Error al remover');
        }
    };

    const handleSetLeader = async (userId: string) => {
        if (!selectedTeam) return;
        try {
            await teamsService.updateTeam(selectedTeam.id, { leader_id: userId });
            toast.success('Líder asignado');
            loadTeamDetail(selectedTeam.id);
            loadTeams();
        } catch (err: any) {
            toast.error(err.message || 'Error al asignar líder');
        }
    };

    const filteredAvailableUsers = availableUsers.filter(u => {
        if (!memberSearch.trim()) return true;
        const s = memberSearch.toLowerCase();
        return u.full_name?.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    });

    // === RENDER ===
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Cargando equipos...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight uppercase">
                            Equipos <span className="text-gray-900 font-black">& Departamentos</span>
                        </h1>
                        <p className="text-[13px] text-gray-400 font-medium">
                            Organiza tu equipo por áreas de trabajo
                        </p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-6 py-3 bg-[#4449AA] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:translate-y-[-1px] active:scale-95 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Crear Equipo
                </button>
            </header>

            {/* Main Layout: Teams Grid + Detail Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">

                {/* Left: Teams Grid */}
                <div className="lg:col-span-4 space-y-3">
                    {teams.length === 0 ? (
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <Users className="w-8 h-8 text-gray-200" />
                            </div>
                            <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-2">Sin equipos</p>
                            <p className="text-[11px] text-gray-400 mb-6">Crea tu primer equipo para organizar a tus colaboradores</p>
                            <button
                                onClick={openCreateModal}
                                className="px-5 py-2.5 bg-[#4449AA] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all"
                            >
                                + Crear Primer Equipo
                            </button>
                        </div>
                    ) : (
                        teams.map(team => (
                            <div
                                key={team.id}
                                onClick={() => handleSelectTeam(team)}
                                className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer transition-all group hover:shadow-md ${selectedTeam?.id === team.id
                                    ? 'border-[#4449AA]/30 shadow-[#4449AA]/10 ring-2 ring-[#4449AA]/10'
                                    : 'border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Team Badge */}
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: team.color + '15', borderColor: team.color + '30', borderWidth: 1 }}
                                    >
                                        {team.emoji}
                                    </div>

                                    {/* Team Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{team.name}</h3>
                                            {!team.is_active && (
                                                <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[7px] font-black uppercase rounded-md border border-red-100">Inactivo</span>
                                            )}
                                        </div>
                                        {team.description && (
                                            <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">{team.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                <Users className="w-3 h-3" />
                                                {team.member_count || 0} miembros
                                            </span>
                                            {team.leader && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                                    <Crown className="w-3 h-3" />
                                                    {team.leader.full_name || team.leader.email.split('@')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight className={`w-4 h-4 shrink-0 transition-all ${selectedTeam?.id === team.id ? 'text-[#4449AA]' : 'text-gray-200 group-hover:text-gray-400'
                                        }`} />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Right: Team Detail Panel */}
                <div className="lg:col-span-6">
                    {selectedTeam ? (
                        <div className="bg-white rounded-[2rem] border border-gray-100/50 shadow-[0_8px_40px_rgb(0,0,0,0.03)] overflow-hidden">
                            {/* Detail Header */}
                            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md"
                                            style={{ backgroundColor: selectedTeam.color + '15', borderColor: selectedTeam.color + '40', borderWidth: 2 }}
                                        >
                                            {selectedTeam.emoji}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">{selectedTeam.name}</h2>
                                            {selectedTeam.description && (
                                                <p className="text-[12px] text-gray-400 font-medium mt-0.5">{selectedTeam.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(selectedTeam)}
                                            className="p-2 rounded-xl text-gray-400 hover:text-[#4449AA] hover:bg-indigo-50 transition-all"
                                            title="Editar equipo"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTeam(selectedTeam)}
                                            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                            title="Eliminar equipo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Members Section */}
                            <div className="px-8 py-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                        Miembros ({selectedTeamDetail?.members?.length || 0})
                                    </h3>
                                    <button
                                        onClick={openAddMember}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Agregar
                                    </button>
                                </div>

                                {loadingDetail ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 text-[#4449AA] animate-spin" />
                                    </div>
                                ) : selectedTeamDetail?.members && selectedTeamDetail.members.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedTeamDetail.members.map((member: TeamMember) => (
                                            <div
                                                key={member.id}
                                                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                                        {member.profile?.avatar_url ? (
                                                            <img src={member.profile.avatar_url} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Users className="w-4 h-4 text-gray-300" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[12px] font-black text-gray-800 uppercase tracking-tight truncate">
                                                                {member.profile?.full_name || 'Sin nombre'}
                                                            </p>
                                                            {member.role === 'leader' && (
                                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[7px] font-black uppercase rounded-md border border-amber-100">
                                                                    <Crown className="w-2.5 h-2.5" />
                                                                    Líder
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 font-medium truncate">{member.profile?.email}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {member.role !== 'leader' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSetLeader(member.user_id); }}
                                                            className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-all"
                                                            title="Asignar como líder"
                                                        >
                                                            <Crown className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.user_id, member.profile?.full_name || member.profile?.email || ''); }}
                                                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                        title="Remover del equipo"
                                                    >
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center text-gray-300">
                                        <Users className="w-10 h-10 mb-3 opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Sin miembros</p>
                                        <p className="text-[10px] text-gray-400 mt-1">Agrega colaboradores a este equipo</p>
                                    </div>
                                )}
                            </div>

                            {/* Stats Footer */}
                            {selectedTeamDetail && (
                                <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 grid grid-cols-3 gap-4">
                                    <MiniStat label="Miembros" value={String(selectedTeamDetail.members?.length || 0)} />
                                    <MiniStat
                                        label="Líder"
                                        value={selectedTeamDetail.leader?.full_name?.split(' ')[0] || '—'}
                                    />
                                    <MiniStat
                                        label="Creado"
                                        value={new Date(selectedTeamDetail.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
                                <Building className="w-10 h-10 text-gray-200" />
                            </div>
                            <p className="text-[13px] font-black text-gray-400 uppercase tracking-widest mb-2">Selecciona un equipo</p>
                            <p className="text-[11px] text-gray-400 max-w-xs">
                                Haz click en cualquier equipo de la izquierda para ver sus miembros y gestionar su estructura
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* === CREATE/EDIT TEAM MODAL === */}
            {showCreateModal && createPortal(
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-black text-[#4449AA] uppercase tracking-tight">
                                {editingTeam ? 'Editar Equipo' : 'Crear Equipo'}
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-gray-300" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Emoji + Color Picker */}
                            <div className="flex items-start gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Smile className="w-3 h-3" /> Ícono
                                    </label>
                                    <div className="grid grid-cols-5 gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                        {TEAM_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={() => setFormData({ ...formData, emoji })}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-white hover:shadow-sm transition-all ${formData.emoji === emoji ? 'bg-white shadow-md ring-2 ring-[#4449AA]/30 scale-110' : ''
                                                    }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 flex-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Palette className="w-3 h-3" /> Color
                                    </label>
                                    <div className="grid grid-cols-6 gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                        {TEAM_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setFormData({ ...formData, color })}
                                                className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>

                                    {/* Preview */}
                                    <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                            style={{ backgroundColor: (formData.color || '#4449AA') + '15', borderColor: (formData.color || '#4449AA') + '30', borderWidth: 1 }}
                                        >
                                            {formData.emoji}
                                        </div>
                                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-wide">
                                            {formData.name || 'Vista previa'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Equipo*</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Ventas, Marketing, Soporte..."
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-[#4449AA]/30 focus:ring-4 focus:ring-[#4449AA]/5 outline-none font-bold text-sm transition-all"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe la función de este equipo..."
                                    rows={2}
                                    className="w-full p-4 rounded-xl bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-[#4449AA]/30 outline-none font-bold text-sm transition-all resize-none"
                                />
                            </div>

                            {/* Leader Select */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                    <Crown className="w-3 h-3 text-amber-500" /> Líder del Equipo
                                </label>
                                <select
                                    value={formData.leader_id || ''}
                                    onChange={e => setFormData({ ...formData, leader_id: e.target.value || undefined })}
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50/50 border border-gray-200 font-bold text-sm outline-none cursor-pointer appearance-none transition-all focus:border-[#4449AA]/30"
                                >
                                    <option value="">Sin líder asignado</option>
                                    {allMembers.map(m => (
                                        <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex gap-4 rounded-b-[2.5rem]">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 h-12 rounded-xl font-black text-[11px] text-gray-400 hover:text-gray-700 uppercase tracking-widest transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveTeam}
                                disabled={isSaving}
                                className="flex-[2] h-12 rounded-xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:translate-y-[-1px] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Guardando...' : (editingTeam ? 'Guardar Cambios' : 'Crear Equipo')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* === ADD MEMBER MODAL === */}
            {showAddMember && selectedTeam && createPortal(
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-[#4449AA] uppercase tracking-tight">Agregar Miembro</h2>
                                <p className="text-[11px] text-gray-400 font-medium mt-0.5">al equipo {selectedTeam.name}</p>
                            </div>
                            <button onClick={() => setShowAddMember(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-gray-300" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-8 py-4 border-b border-gray-50 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                <input
                                    type="text"
                                    placeholder="Buscar colaborador..."
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#4449AA]/30 outline-none text-sm font-bold placeholder:text-gray-300 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* User List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 px-4 py-2">
                            {filteredAvailableUsers.length === 0 ? (
                                <div className="py-12 text-center text-gray-300">
                                    <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">
                                        {availableUsers.length === 0 ? 'Todos los usuarios ya pertenecen a este equipo' : 'Sin coincidencias'}
                                    </p>
                                </div>
                            ) : (
                                filteredAvailableUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleAddMember(user.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/50 rounded-xl transition-all text-left group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <Users className="w-4 h-4 text-gray-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-black text-gray-800 uppercase tracking-tight truncate">
                                                {user.full_name || 'Sin nombre'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-medium truncate">{user.email}</p>
                                        </div>
                                        <UserPlus className="w-4 h-4 text-gray-200 group-hover:text-emerald-500 transition-colors shrink-0" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// === SUB-COMPONENTS ===
function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
            <p className="text-sm font-black text-gray-700 mt-0.5">{value}</p>
        </div>
    );
}
