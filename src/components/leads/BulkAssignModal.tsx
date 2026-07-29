import { useState, useMemo } from 'react';
import { Users, X, UserCheck, Shuffle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsService } from '../../services/leads';

interface TeamMember {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
}

interface BulkAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** All leads currently filtered/visible — used for % selection */
    filteredLeadIds: string[];
    /** Pre-selected lead IDs (from checkboxes). If empty, user picks % first. */
    preSelectedIds?: string[];
    teamMembers: TeamMember[];
    onSuccess: () => void;
}

const PERCENT_OPTIONS = [
    { label: '25%', value: 0.25 },
    { label: '40%', value: 0.40 },
    { label: '50%', value: 0.50 },
    { label: '75%', value: 0.75 },
    { label: '100%', value: 1.0 },
];

/** Fisher-Yates shuffle — truly random pick for fair distribution */
function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function BulkAssignModal({
    isOpen,
    onClose,
    filteredLeadIds,
    preSelectedIds = [],
    teamMembers,
    onSuccess,
}: BulkAssignModalProps) {
    const [selectedPercent, setSelectedPercent] = useState<number | null>(
        preSelectedIds.length > 0 ? null : 0.4
    );
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [agentSearch, setAgentSearch] = useState('');

    // Determine which IDs to assign based on selection mode
    const idsToAssign = useMemo(() => {
        // If pre-selected from checkboxes, use those
        if (preSelectedIds.length > 0 && selectedPercent === null) {
            return preSelectedIds;
        }
        // Otherwise compute based on % of visible leads
        if (selectedPercent !== null && filteredLeadIds.length > 0) {
            const count = Math.max(1, Math.ceil(filteredLeadIds.length * selectedPercent));
            return shuffleArray(filteredLeadIds).slice(0, count);
        }
        return preSelectedIds;
    }, [preSelectedIds, filteredLeadIds, selectedPercent]);

    const filteredTeam = useMemo(() => {
        if (!agentSearch.trim()) return teamMembers;
        const term = agentSearch.toLowerCase();
        return teamMembers.filter(m =>
            (m.full_name || '').toLowerCase().includes(term) ||
            m.email.toLowerCase().includes(term)
        );
    }, [teamMembers, agentSearch]);

    const selectedAgent = teamMembers.find(m => m.id === selectedAgentId);

    const handleAssign = async () => {
        if (!selectedAgentId) {
            toast.error('Selecciona un agente primero.');
            return;
        }
        if (idsToAssign.length === 0) {
            toast.error('No hay leads seleccionados.');
            return;
        }

        setIsAssigning(true);
        try {
            const count = await leadsService.bulkAssignLeads(idsToAssign, selectedAgentId);
            toast.success(`✅ ${count} leads asignados a ${selectedAgent?.full_name || selectedAgent?.email}`);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('[BulkAssign] error:', error);
            toast.error(`Error al asignar: ${error.message}`);
        } finally {
            setIsAssigning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Asignación Masiva</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {filteredLeadIds.length} leads visibles disponibles
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Step 1: Select % (only if no pre-selected checkboxes) */}
                    {preSelectedIds.length === 0 ? (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Shuffle className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">
                                    Paso 1 — ¿Cuántos leads asignar?
                                </h3>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {PERCENT_OPTIONS.map(opt => {
                                    const count = Math.ceil(filteredLeadIds.length * opt.value);
                                    const isActive = selectedPercent === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => setSelectedPercent(opt.value)}
                                            className={`flex-1 min-w-[70px] py-3 rounded-xl font-black text-sm transition-all border-2 ${
                                                isActive
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                    : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'
                                            }`}
                                        >
                                            <div className="text-lg">{opt.label}</div>
                                            <div className={`text-xs mt-0.5 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                {count} leads
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                            <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                            <p className="text-sm font-bold text-indigo-700">
                                {preSelectedIds.length} leads seleccionados manualmente con checkboxes
                            </p>
                        </div>
                    )}

                    {/* Preview count */}
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-500">Leads a asignar:</span>
                        <span className="text-2xl font-black text-indigo-600">{idsToAssign.length}</span>
                    </div>

                    {/* Step 2: Pick agent */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <UserCheck className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">
                                {preSelectedIds.length === 0 ? 'Paso 2' : 'Paso 1'} — ¿A quién asignar?
                            </h3>
                        </div>

                        {/* Agent search */}
                        <input
                            type="text"
                            placeholder="Buscar agente..."
                            value={agentSearch}
                            onChange={e => setAgentSearch(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-3"
                        />

                        {/* Agent list */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {filteredTeam.map(member => {
                                const isSelected = selectedAgentId === member.id;
                                const initials = (member.full_name || member.email)
                                    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => setSelectedAgentId(member.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border-2 text-left ${
                                            isSelected
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                            isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-gray-100'
                                        }`}>
                                            {member.avatar_url
                                                ? <img src={member.avatar_url} className="w-full h-full object-cover rounded-xl" />
                                                : initials
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-black text-sm truncate ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
                                                {member.full_name || 'Sin nombre'}
                                            </p>
                                            <p className="text-xs text-gray-400 font-medium truncate">{member.email}</p>
                                        </div>
                                        {isSelected && (
                                            <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                            {filteredTeam.length === 0 && (
                                <p className="text-center text-sm text-gray-400 font-bold py-4">No se encontraron agentes</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl border-2 border-gray-100 text-gray-600 font-black text-sm hover:bg-gray-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={isAssigning || !selectedAgentId || idsToAssign.length === 0}
                        className="flex-2 flex-[2] py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isAssigning ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <UserCheck className="w-5 h-5" />
                                Asignar {idsToAssign.length} leads
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
