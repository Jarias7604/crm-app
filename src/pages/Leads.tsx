import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { leadsService } from '../services/leads';
import type { Lead, LeadStatus, LeadPriority, FollowUp } from '../types';
import { PRIORITY_CONFIG, STATUS_CONFIG, ACTION_TYPES, SOURCE_CONFIG, SOURCE_OPTIONS } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, User, Phone, Mail, DollarSign, Clock, ChevronRight, X, TrendingUp, LayoutGrid, List, Download, Upload, Loader2, FileText, UploadCloud, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { csvHelper } from '../utils/csvHelper';
import { storageService } from '../services/storage';
import { useAuth } from '../auth/AuthProvider';
import { useMemo } from 'react';

export default function Leads() {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [followUps, setFollowUps] = useState<FollowUp[]>([]);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        status: 'Nuevo lead' as LeadStatus,
        priority: 'medium' as LeadPriority,
        value: 0,
        closing_amount: 0,
        source: '',
        next_followup_date: '',
        next_followup_assignee: '',
        next_action_notes: '',
        assigned_to: '', // Permanent owner
    });

    // State for Next Follow Up section (manual save)
    // State for Next Follow Up section (manual save)
    const [nextFollowUpData, setNextFollowUpData] = useState({
        date: '',
        assignee: '',
        notes: ''
    });
    const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isImporting, setIsImporting] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [filteredLeadId, setFilteredLeadId] = useState<string | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const location = useLocation();

    // Handle incoming state from Dashboard or Calendar
    useEffect(() => {
        if (location.state) {
            const state = location.state as any;
            if (state.priority) {
                setPriorityFilter(state.priority);
            }
            // If a specific lead ID is passed, we wait for leads to load then open it
            if (state.leadId && leads.length > 0) {
                const targetLead = leads.find(l => l.id === state.leadId);
                if (targetLead) {
                    setSelectedLead(targetLead);
                    setFilteredLeadId(state.leadId); // Filter list to show only this lead
                    setIsDetailOpen(true);

                    // Clear state to prevent reopening on reload (optional but good practice)
                    window.history.replaceState({}, document.title);
                }
            }
        }
    }, [location, leads]); // Added leads dependence to run when leads are loaded

    // Force grid view on mobile initially, but allow changes
    useEffect(() => {
        if (window.innerWidth < 768) {
            setViewMode('grid');
        }
    }, []);

    // Update local state when lead is selected
    useEffect(() => {
        if (selectedLead) {
            let dateStr = '';
            if (selectedLead.next_followup_date) {
                // Safely extract YYYY-MM-DD
                try {
                    dateStr = selectedLead.next_followup_date.split('T')[0];
                } catch (e) {
                    console.error('Date parsing error', e);
                    dateStr = '';
                }
            }

            setNextFollowUpData({
                date: dateStr,
                assignee: selectedLead.next_followup_assignee || '',
                notes: selectedLead.next_action_notes || ''
            });
        }
    }, [selectedLead]);

    // Function to manually save Next Follow Up data
    const handleSaveNextFollowUp = async () => {
        if (!selectedLead) return;
        setIsSavingFollowUp(true);
        try {
            // Ensure date is null if empty
            const dateToSave = nextFollowUpData.date ? nextFollowUpData.date : null;

            // 1. Update the Lead with the NEXT follow up info
            await leadsService.updateLead(selectedLead.id, {
                next_followup_date: dateToSave,
                next_followup_assignee: nextFollowUpData.assignee || null,
                next_action_notes: nextFollowUpData.notes
            });

            // 2. Create a HISTORY entry for this action
            // We log this as a "Planificación" or just a general update
            await leadsService.createFollowUp({
                lead_id: selectedLead.id,
                notes: `Programado: ${nextFollowUpData.notes || 'Seguimiento general'}`,
                date: new Date().toISOString().split('T')[0], // Logged today
                action_type: 'other' // Could be dynamic, but 'other' is safe for now
            });

            // Force reload to ensure UI is in sync
            const result = await leadsService.getLeads();
            const updatedLeads = result.data || [];
            setLeads(updatedLeads);

            // Update selected lead to reflect changes
            const updatedSelected = updatedLeads.find(l => l.id === selectedLead.id);
            if (updatedSelected) {
                setSelectedLead(updatedSelected);
            }

            // Reload history
            await loadFollowUps(selectedLead.id);

            // Reset form
            setNextFollowUpData({ date: '', assignee: '', notes: '' });

            alert('✅ Próximo seguimiento actualizado y registrado en historial');
        } catch (error: any) {
            console.error('Save failed:', error);
            alert(`❌ Error al guardar: ${error.message}`);
        } finally {
            setIsSavingFollowUp(false);
        }
    };

    useEffect(() => {
        loadLeads();
        loadTeamMembers();
    }, []);

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            if (filteredLeadId) return lead.id === filteredLeadId;
            if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false;
            return true;
        });
    }, [leads, priorityFilter, filteredLeadId]);

    const handleDeleteLead = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el lead "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await leadsService.deleteLead(id);
            alert('✅ Lead eliminado correctamente');
            if (selectedLead?.id === id) setIsDetailOpen(false);
            loadLeads();
        } catch (error: any) {
            console.error('Delete failed:', error);
            alert(`❌ Error al eliminar: ${error.message}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLead || !profile?.company_id) return;

        if (file.type !== 'application/pdf') {
            alert('Solo se permiten archivos PDF');
            return;
        }

        setIsUploading(true);
        try {
            const path = await storageService.uploadLeadDocument(profile.company_id, selectedLead.id, file);
            await leadsService.updateLead(selectedLead.id, { document_path: path });
            setSelectedLead({ ...selectedLead, document_path: path });
            setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, document_path: path } : l));
            alert('✅ PDF cargado correctamente');
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert('❌ Error al subir el archivo: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileDownload = async () => {
        if (!selectedLead?.document_path) return;
        try {
            const url = await storageService.getDownloadUrl(selectedLead.document_path);
            window.open(url, '_blank');
        } catch (error: any) {
            alert('❌ Error al descargar: ' + error.message);
        }
    };

    const handleFileDelete = async () => {
        if (!selectedLead?.document_path) return;
        if (!confirm('¿Estás seguro de eliminar este documento?')) return;

        try {
            await storageService.deleteFile(selectedLead.document_path);
            await leadsService.updateLead(selectedLead.id, { document_path: null });
            setSelectedLead({ ...selectedLead, document_path: null });
            setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, document_path: null } : l));
            alert('✅ Documento eliminado');
        } catch (error: any) {
            alert('❌ Error al eliminar: ' + error.message);
        }
    };

    const loadLeads = async () => {
        try {
            setLoading(true);
            const { data } = await leadsService.getLeads();
            setLeads(data || []);
        } catch (error) {
            console.error('Failed to load leads', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        csvHelper.generateTemplate();
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsImporting(true);
            const data = await csvHelper.parse(file);

            if (data.length === 0) {
                alert('El archivo CSV está vacío.');
                return;
            }

            if (confirm(`¿Estás seguro de que quieres importar ${data.length} leads?`)) {
                await leadsService.importLeads(data);
                alert('✅ Leads importados correctamente');
                loadLeads(); // Refresh list
            }
        } catch (error: any) {
            console.error('Import failed:', error);
            alert(`❌ Error al importar: ${error.message}`);
        } finally {
            setIsImporting(false);
            // Reset input
            e.target.value = '';
        }
    };


    const loadTeamMembers = async () => {
        try {
            const data = await leadsService.getTeamMembers();
            setTeamMembers(data || []);
        } catch (error) {
            console.error('Failed to load team', error);
        }
    };

    const loadFollowUps = async (leadId: string) => {
        try {
            const data = await leadsService.getFollowUps(leadId);
            setFollowUps(data || []);
        } catch (error) {
            console.error('Failed to load follow-ups', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Clean data - convert empty strings to null for UUID fields
            const cleanData = {
                ...formData,
                next_followup_assignee: formData.next_followup_assignee || null,
                next_followup_date: formData.next_followup_date || null,
            };
            await leadsService.createLead(cleanData);
            setIsModalOpen(false);
            resetForm();
            loadLeads();
        } catch (error: any) {
            console.error('Failed to create lead', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleUpdateLead = async (updates: Partial<Lead>) => {
        if (!selectedLead) return;
        try {
            // Clean data - convert empty strings to null for optional fields
            const cleanUpdates = { ...updates };
            if ('next_followup_assignee' in cleanUpdates && !cleanUpdates.next_followup_assignee) {
                cleanUpdates.next_followup_assignee = null;
            }
            if ('next_followup_date' in cleanUpdates && !cleanUpdates.next_followup_date) {
                cleanUpdates.next_followup_date = null;
            }
            if ('assigned_to' in cleanUpdates && !cleanUpdates.assigned_to) {
                cleanUpdates.assigned_to = null;
            }

            const updatedLead = await leadsService.updateLead(selectedLead.id, cleanUpdates);
            setSelectedLead({ ...selectedLead, ...updatedLead });
            loadLeads();
            // Visual feedback - brief color change could be added
            console.log('Lead updated successfully:', cleanUpdates);
        } catch (error: any) {
            console.error('Update failed:', error);
            alert(`Error al guardar: ${error.message}`);
        }
    };

    // handleAddFollowUp removed - simplified UI

    const openLeadDetail = (lead: Lead) => {
        setSelectedLead(lead);
        setIsDetailOpen(true);
        loadFollowUps(lead.id);
    };

    const resetForm = () => {
        setFormData({
            name: '', company_name: '', email: '', phone: '',
            status: 'Nuevo lead', priority: 'medium', value: 0, closing_amount: 0, source: '',
            next_followup_date: '', next_followup_assignee: '', next_action_notes: '',
            assigned_to: ''
        });
    };

    const PriorityBadge = ({ priority }: { priority: LeadPriority }) => {
        const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
        return (
            <span className={`inline-block w-[100px] text-center px-2 py-0.5 text-xs font-bold rounded ${config.color} ${config.textColor}`}>
                {config.label}
            </span>
        );
    };

    const StatusBadge = ({ status }: { status: LeadStatus }) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG['Nuevo lead'];
        return (
            <span className={`inline-block w-[140px] text-center px-2 py-0.5 text-xs font-medium rounded-full ${config.bgColor} ${config.color}`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Leads</h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                        <p className="text-sm text-gray-500">
                            {leads.length} leads · ${leads.reduce((sum, l) => sum + (l.value || 0), 0).toLocaleString()} en pipeline
                        </p>
                        <div className="hidden sm:block w-px h-4 bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filtrar:</span>
                            <select
                                value={priorityFilter}
                                onChange={(e) => {
                                    setPriorityFilter(e.target.value);
                                    setFilteredLeadId(null); // Clear specific lead filter
                                }}
                                className="text-xs border-gray-300 rounded-md py-1 pr-8 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">Todas las Prioridades</option>
                                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vista Cuadrícula"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vista Lista"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                        <Button
                            variant="outline"
                            className="hidden sm:flex items-center gap-2 h-9"
                            onClick={handleDownloadTemplate}
                            title="Descargar Plantilla CSV"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden lg:inline">Plantilla</span>
                        </Button>

                        <div className="relative flex-1 sm:flex-none">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleImportCSV}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isImporting}
                            />
                            <Button
                                variant="outline"
                                className="flex items-center gap-2 h-9 w-full sm:w-auto justify-center"
                                disabled={isImporting}
                            >
                                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                <span className="inline">Importar</span>
                            </Button>
                        </div>
                    </div>

                    <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none justify-center">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo
                    </Button>
                </div>
            </div>

            {/* Lead Cards */}
            {/* Content View */}
            {viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredLeads.map((lead) => (
                        <div
                            key={lead.id}
                            onClick={() => openLeadDetail(lead)}
                            className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <PriorityBadge priority={lead.priority || 'medium'} />
                                        <StatusBadge status={lead.status} />
                                        {lead.source && SOURCE_CONFIG[lead.source] && (
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SOURCE_CONFIG[lead.source].bgColor} ${SOURCE_CONFIG[lead.source].color}`}>
                                                {SOURCE_CONFIG[lead.source].icon} {SOURCE_CONFIG[lead.source].label}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900">{lead.name}</h3>
                                {lead.company_name && (
                                    <p className="text-sm text-gray-500 font-medium">{lead.company_name}</p>
                                )}

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className="flex items-center text-blue-600">
                                        <DollarSign className="w-4 h-4 mr-1" />
                                        <span className="text-sm">Pot: <b>${(lead.value || 0).toLocaleString()}</b></span>
                                    </div>
                                    {(lead.closing_amount || 0) > 0 && (
                                        <div className="flex items-center text-green-600">
                                            <TrendingUp className="w-4 h-4 mr-1" />
                                            <span className="text-sm">Cierre: <b>${(lead.closing_amount || 0).toLocaleString()}</b></span>
                                        </div>
                                    )}
                                    {lead.next_followup_date && (
                                        <div className="flex items-center text-xs text-blue-600 col-span-2 font-medium">
                                            <Clock className="w-3.5 h-3.5 mr-1" />
                                            Seguimiento: {(() => {
                                                try {
                                                    const dateStr = lead.next_followup_date.split('T')[0];
                                                    const dateObj = new Date(dateStr + 'T12:00:00');
                                                    if (isNaN(dateObj.getTime())) return 'Fecha inválida';
                                                    return format(dateObj, 'EEEE dd MMM yyyy', { locale: es });
                                                } catch (e) {
                                                    return 'Error fecha';
                                                }
                                            })()}
                                        </div>
                                    )}
                                    {lead.assigned_to && (
                                        <div className="flex items-center text-xs text-blue-700 col-span-2 font-semibold">
                                            <User className="w-3.5 h-3.5 mr-1" />
                                            Asignado: {teamMembers.find(m => m.id === lead.assigned_to)?.full_name ||
                                                teamMembers.find(m => m.id === lead.assigned_to)?.email.split('@')[0]}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 text-xs text-gray-400">
                                    {lead.email && <span className="flex items-center"><Mail className="w-3 h-3 mr-1" />{lead.email}</span>}
                                    {lead.phone && <span className="flex items-center"><Phone className="w-3 h-3 mr-1" />{lead.phone}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre / Empresa</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuente</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredLeads.map((lead) => (
                                    <tr key={lead.id} onClick={() => openLeadDetail(lead)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{lead.name}</span>
                                                <div className="flex flex-col text-xs text-gray-500 mb-2">
                                                    {lead.company_name && <span className="font-medium text-gray-700">{lead.company_name}</span>}
                                                    {lead.phone && <span className="text-blue-600 font-bold">📞 {lead.phone}</span>}
                                                    {lead.email && <span className="truncate">{lead.email}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge status={lead.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <PriorityBadge priority={lead.priority} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {lead.source && SOURCE_CONFIG[lead.source] ? (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                    <span>{SOURCE_CONFIG[lead.source].icon}</span>
                                                    <span>{SOURCE_CONFIG[lead.source].label}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="font-medium text-gray-900">${(lead.value || 0).toLocaleString()}</div>
                                            {(lead.closing_amount || 0) > 0 && <div className="text-xs text-green-600 font-medium">Cierre: ${lead.closing_amount.toLocaleString()}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {lead.assigned_to ? (
                                                <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                                    <User className="w-3.5 h-3.5" />
                                                    {teamMembers.find(m => m.id === lead.assigned_to)?.full_name ||
                                                        teamMembers.find(m => m.id === lead.assigned_to)?.email.split('@')[0]}
                                                </div>
                                            ) : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {lead.created_at ? (() => {
                                                try {
                                                    const dateObj = new Date(lead.created_at);
                                                    if (isNaN(dateObj.getTime())) return '-';
                                                    return format(dateObj, 'dd MMM yyyy', { locale: es });
                                                } catch (e) {
                                                    return '-';
                                                }
                                            })() : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteLead(lead.id, lead.name);
                                                        }}
                                                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                        title="Eliminar Lead"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button className="text-blue-600 hover:text-blue-900 transition-colors p-1">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {leads.length === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                    <User className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No hay leads</h3>
                    <p className="mt-1 text-sm text-gray-500">Comienza creando un nuevo lead.</p>
                </div>
            )}

            {leads.length > 0 && filteredLeads.length === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                    <TrendingUp className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No hay leads con esta prioridad</h3>
                    <p className="mt-1 text-sm text-gray-500">Intenta cambiar el filtro de prioridad.</p>
                </div>
            )}

            {/* Create Lead Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Lead">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nombre Contacto *</label>
                            <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Empresa</label>
                            <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Valor Potencial ($)</label>
                            <Input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fuente</label>
                            <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                <option value="">Seleccionar...</option>
                                {SOURCE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Prioridad</label>
                            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as LeadPriority })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                <option value="very_high">🔴 Altísima</option>
                                <option value="high">🟠 Alta</option>
                                <option value="medium">🟡 Media</option>
                                <option value="low">⚪ Baja</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Estado</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                <option value="Nuevo lead">Nuevo lead</option>
                                <option value="Potencial – En seguimiento">En seguimiento</option>
                                <option value="Cliente 2025">Cliente 2025</option>
                                <option value="Cliente 2026">Cliente 2026</option>
                                <option value="Lead perdido">Perdido</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                                <TrendingUp className="w-4 h-4 text-green-600" /> Monto de Cierre ($)
                            </label>
                            <Input type="number" value={formData.closing_amount} onChange={(e) => setFormData({ ...formData, closing_amount: Number(e.target.value) })} placeholder="0 si aún no cerró" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Próximo Seguimiento</label>
                            <Input type="date" value={formData.next_followup_date} onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 font-bold text-blue-600">Responsable Principal *</label>
                            <select required value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-blue-50">
                                <option value="">Seleccionar responsable...</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.full_name ? `${m.full_name} (${m.email.split('@')[0]})` : m.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 italic">Seguimiento por</label>
                            <select value={formData.next_followup_assignee} onChange={(e) => setFormData({ ...formData, next_followup_assignee: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                <option value="">Igual al responsable</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.full_name ? `${m.full_name} (${m.email.split('@')[0]})` : m.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Notas próxima acción</label>
                            <textarea value={formData.next_action_notes} onChange={(e) => setFormData({ ...formData, next_action_notes: e.target.value })} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Crear Lead</Button>
                    </div>
                </form>
            </Modal>

            {/* Lead Detail Slide-Over */}
            {isDetailOpen && selectedLead && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setIsDetailOpen(false)} />
                    <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl flex flex-col">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                {/* Editable Name */}
                                <input
                                    type="text"
                                    defaultValue={selectedLead.name}
                                    onBlur={(e) => handleUpdateLead({ name: e.target.value })}
                                    className="block w-full text-lg font-bold text-gray-900 border-none hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 transition-all bg-transparent"
                                />
                                <div className="space-y-1 mt-1">
                                    {/* Editable Company */}
                                    <input
                                        type="text"
                                        defaultValue={selectedLead.company_name || ''}
                                        placeholder="Agregar Empresa..."
                                        onBlur={(e) => handleUpdateLead({ company_name: e.target.value })}
                                        className="block w-full text-sm font-medium text-gray-500 border-none hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 transition-all bg-transparent"
                                    />
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        <div className="flex items-center gap-1 group">
                                            <Phone className="w-3 h-3 text-gray-400" />
                                            <input
                                                type="text"
                                                defaultValue={selectedLead.phone || ''}
                                                placeholder="Agregar teléfono..."
                                                onBlur={(e) => handleUpdateLead({ phone: e.target.value })}
                                                className="text-xs text-blue-600 font-bold border-none hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 rounded px-1 -ml-1 w-32 bg-transparent"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 group">
                                            <Mail className="w-3 h-3 text-gray-400" />
                                            <input
                                                type="text"
                                                defaultValue={selectedLead.email || ''}
                                                placeholder="Agregar email..."
                                                onBlur={(e) => handleUpdateLead({ email: e.target.value })}
                                                className="text-xs text-gray-500 hover:text-blue-600 border-none hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 rounded px-1 -ml-1 w-48 bg-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDeleteLead(selectedLead.id, selectedLead.name)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all mr-1"
                                        title="Eliminar Lead"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Quick Stats */}
                            <div className="flex gap-4">
                                <div className="flex-1 bg-green-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-600">${(selectedLead.value || 0).toLocaleString()}</p>
                                    <p className="text-xs text-green-700">Valor</p>
                                </div>
                                <div className="flex-1 bg-gray-50 p-4 rounded-lg text-center">
                                    <PriorityBadge priority={selectedLead.priority || 'medium'} />
                                    <p className="text-xs text-gray-500 mt-1">Prioridad</p>
                                </div>
                                <div className="flex-1 bg-gray-50 p-4 rounded-lg text-center">
                                    <StatusBadge status={selectedLead.status} />
                                    <p className="text-xs text-gray-500 mt-1">Estado</p>
                                </div>
                            </div>

                            {/* Edit Status & Priority */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Cambiar Estado</label>
                                    <select value={selectedLead.status} onChange={(e) => handleUpdateLead({ status: e.target.value as LeadStatus })} className="block w-full rounded-md border-gray-300 shadow-sm text-sm">
                                        <option value="Nuevo lead">Nuevo lead</option>
                                        <option value="Potencial – En seguimiento">En seguimiento</option>
                                        <option value="Cliente 2025">Cliente 2025</option>
                                        <option value="Cliente 2026">Cliente 2026</option>
                                        <option value="Lead perdido">Perdido</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Cambiar Prioridad</label>
                                    <select value={selectedLead.priority || 'medium'} onChange={(e) => handleUpdateLead({ priority: e.target.value as LeadPriority })} className="block w-full rounded-md border-gray-300 shadow-sm text-sm">
                                        <option value="very_high">🔴 Altísima</option>
                                        <option value="high">🟠 Alta</option>
                                        <option value="medium">🟡 Media</option>
                                        <option value="low">⚪ Baja</option>
                                    </select>
                                </div>
                                <div className="col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                                    <label className="block text-xs font-bold text-blue-700 mb-1">👤 Responsable Principal</label>
                                    <select
                                        value={selectedLead.assigned_to || ''}
                                        onChange={(e) => handleUpdateLead({ assigned_to: e.target.value || null })}
                                        className="block w-full rounded-md border-blue-200 shadow-sm text-sm bg-white"
                                    >
                                        <option value="">Sin asignar</option>
                                        {teamMembers.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.full_name ? `${m.full_name} (${m.email.split('@')[0]})` : m.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Editable Values Section */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">💰 Valores</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Valor Potencial ($)</label>
                                        <Input
                                            type="number"
                                            defaultValue={selectedLead.value || 0}
                                            onBlur={(e) => handleUpdateLead({ value: Number(e.target.value) })}
                                            className="text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Monto de Cierre ($)</label>
                                        <Input
                                            type="number"
                                            defaultValue={selectedLead.closing_amount || 0}
                                            onBlur={(e) => handleUpdateLead({ closing_amount: Number(e.target.value) })}
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Next Follow-up Edit Section */}
                            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <h4 className="text-sm font-semibold text-blue-700">📅 Próximo Seguimiento</h4>
                                        {nextFollowUpData.date && (
                                            <p className="text-[10px] text-blue-500 font-bold capitalize">
                                                {(() => {
                                                    try {
                                                        const safeDate = nextFollowUpData.date + 'T12:00:00';
                                                        const dateObj = new Date(safeDate);
                                                        if (isNaN(dateObj.getTime())) return 'Fecha inválida';
                                                        return format(dateObj, 'EEEE dd MMMM', { locale: es });
                                                    } catch (e) {
                                                        return 'Error fecha';
                                                    }
                                                })()}
                                            </p>
                                        )}
                                    </div>
                                    {isSavingFollowUp && <span className="text-xs text-blue-500 animate-pulse">Guardando...</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-blue-600 mb-1">Fecha</label>
                                        <Input
                                            type="date"
                                            value={nextFollowUpData.date}
                                            onChange={(e) => setNextFollowUpData({ ...nextFollowUpData, date: e.target.value })}
                                            className="text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-blue-600 mb-1">Asignar a</label>
                                        <select
                                            value={nextFollowUpData.assignee}
                                            onChange={(e) => setNextFollowUpData({ ...nextFollowUpData, assignee: e.target.value })}
                                            className="block w-full rounded-md border-gray-300 shadow-sm text-sm"
                                        >
                                            <option value="">Sin asignar</option>
                                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-blue-600 mb-1">Notas próxima acción</label>
                                    <textarea
                                        value={nextFollowUpData.notes}
                                        onChange={(e) => setNextFollowUpData({ ...nextFollowUpData, notes: e.target.value })}
                                        rows={2}
                                        placeholder="¿Qué se debe hacer en el próximo contacto?"
                                        className="w-full rounded-md border-gray-300 shadow-sm text-sm"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button
                                        onClick={handleSaveNextFollowUp}
                                        disabled={isSavingFollowUp}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        Guardar Cambios
                                    </Button>
                                </div>
                            </div>

                            {/* Documents Section */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    Documentos Adjuntos (PDF)
                                </h4>

                                {selectedLead.document_path ? (
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="bg-white p-2 rounded border border-blue-200">
                                                <FileText className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-blue-900 truncate">Documento del Lead.pdf</p>
                                                <p className="text-[10px] text-blue-600 uppercase">PDF Adjunto</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleFileDownload}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all"
                                                title="Descargar PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={handleFileDelete}
                                                className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all"
                                                title="Eliminar PDF"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-8 transition-all hover:border-blue-400 hover:bg-blue-50 group text-center">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                                                {isUploading ? (
                                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                                ) : (
                                                    <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-blue-600" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-700">Subir Documento PDF</p>
                                                <p className="text-xs text-gray-500">Click o arrastra para adjuntar propuesta, contrato, etc.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Follow-up History - Always visible */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="font-medium text-gray-900 mb-3">📋 Historial de Seguimientos</h3>
                                {followUps.length > 0 ? (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {followUps.map((fu) => (
                                            <div key={fu.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                                                <div className="text-lg">
                                                    {ACTION_TYPES.find(t => t.value === fu.action_type)?.icon || '📝'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-800 truncate">{fu.notes || 'Sin notas'}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {(() => {
                                                            try {
                                                                if (!fu.date) return 'Sin fecha';
                                                                // Ensure date string is safe for parsing
                                                                const safeDate = fu.date.includes('T') ? fu.date : `${fu.date}T12:00:00`;
                                                                const dateObj = new Date(safeDate);
                                                                if (isNaN(dateObj.getTime())) return 'Fecha inválida';
                                                                return format(dateObj, 'dd/MM/yyyy');
                                                            } catch (e) {
                                                                return 'Error fecha';
                                                            }
                                                        })()} · {fu.profiles?.email?.split('@')[0] || 'Usuario'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                                        No hay seguimientos aún
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
