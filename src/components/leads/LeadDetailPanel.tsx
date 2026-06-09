import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Calendar, CheckCircle, Plus, FileText, Send, Clock, Trash2, Shield, X, MapPin, Building, Globe, Copy, RefreshCw, MessageCircle, TrendingUp, DollarSign, Download, UploadCloud, Loader2, Target, MessageSquare, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../services/supabase';
import { leadsService } from '../../services/leads';
import { callActivityService, ACTION_TYPE_CONFIG, CALL_OUTCOME_CONFIG } from '../../services/callActivity';
import { logger } from '../../utils/logger';
import { PRIORITY_CONFIG, STATUS_CONFIG, SOURCE_CONFIG, ACTION_TYPES, SOURCE_OPTIONS } from '../../types';
import type { Lead, FollowUp, LeadStatus, LeadPriority } from '../../types';
import { type CallActivity } from '../../services/callActivity';
import { QuickActionLogger } from '../QuickCallLogger';
import toast from 'react-hot-toast';

import { Input } from '../ui/Input';
import { CustomDatePicker } from '../ui/CustomDatePicker';

interface LeadDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead;
    handleUpdateLead: (updates: Partial<Lead>) => Promise<void>;
    teamMembers: any[];
    profile: any;
    isAdmin: boolean;
    navigate: any;
    storageService: any;

    industries: any[];
    handleFileDownload: (e: any) => Promise<void>;
    handleFileDelete: (e: any) => Promise<void>;
    handleFileUpload: (e: any) => Promise<void>;
    isUploading: boolean;
    isCallLoggerOpen: boolean;
    setIsCallLoggerOpen: (val: boolean) => void;
    callStartedAt: number | null;
    setCallStartedAt: (val: number | null) => void;

    handleDeleteLead: (id: string, name: string) => void;

    StatusBadge: React.FC<{ status: any }>;
    PriorityBadge: React.FC<{ priority: any }>;
}

export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({
    isOpen,
    onClose,
    lead,
    
    teamMembers,
    profile,
    isAdmin,
    navigate,
    storageService,
    industries, handleFileDownload, handleFileDelete, handleFileUpload, isUploading, isCallLoggerOpen, setIsCallLoggerOpen, callStartedAt, setCallStartedAt, handleUpdateLead, handleDeleteLead, StatusBadge, PriorityBadge
}) => {
    const [followUps, setFollowUps] = useState<FollowUp[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [callActivities, setCallActivities] = useState<CallActivity[]>([]);

    const loadFollowUps = async (leadId: string) => {
        try {
            const [followUpsData, messagesData, activitiesData] = await Promise.all([
                leadsService.getFollowUps(leadId),
                leadsService.getLeadMessages(leadId),
                callActivityService.getLeadCalls(leadId),
            ]);
            setFollowUps(followUpsData || []);
            setMessages(messagesData || []);
            setCallActivities(activitiesData || []);
        } catch (error) {
            logger.error('Failed to load history', error, { action: 'loadFollowUps', leadId });
        }
    };

    useEffect(() => {
        if (isOpen && lead?.id) {
            loadFollowUps(lead.id);
        }
    }, [isOpen, lead?.id]);

    const [activeTab, setActiveTab] = useState<'activity' | 'info' | 'quotes'>('activity');
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    
    // Dialog states
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
    const [isDocGeneratorOpen, setIsDocGeneratorOpen] = useState(false);
    const [isFollowUpLoggerOpen, setIsFollowUpLoggerOpen] = useState(false);

    useEffect(() => {
        if (isOpen && lead) {
            loadDetails();
        }
    }, [isOpen, lead?.id]);

    const loadDetails = async () => {
        if (!lead) return;
        setIsLoadingDetails(true);
        try {
            const [followUpsData, messagesData, activitiesData] = await Promise.all([
                leadsService.getFollowUps(lead.id),
                leadsService.getLeadMessages(lead.id),
                callActivityService.getLeadCalls(lead.id),
            ]);
            setFollowUps(followUpsData || []);
            setMessages(messagesData || []);
            setCallActivities(activitiesData || []);
        } catch (error) {
            logger.error('Failed to load details', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    if (!isOpen || !lead) return null;

    const selectedLead = lead;
    const setIsDetailOpen = (val: boolean) => { if (!val) onClose(); };

            return (
                <div className="fixed inset-0 z-[9999]">
                    <div className="absolute inset-0 bg-black/40 lead-sheet-backdrop" onClick={() => setIsDetailOpen(false)} />
                    <div className="absolute inset-x-0 bottom-0 max-h-[93vh] rounded-t-[28px] sm:inset-y-0 sm:bottom-auto sm:left-auto sm:right-0 sm:max-h-full sm:w-[640px] sm:max-w-2xl sm:rounded-none bg-white/95 backdrop-blur-xl border-l border-white/50 shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden lead-sheet transition-all duration-500 ease-out">
                        {/* Mobile drag handle pill */}
                        <div className="flex justify-center pt-3 pb-0 flex-shrink-0 sm:hidden">
                            <div className="w-10 h-1 bg-gray-200 rounded-full" />
                        </div>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100/50 bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-sm flex justify-between items-center relative z-30">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/50 rounded-full -mr-20 -mt-20 opacity-50 blur-3xl pointer-events-none"></div>
                            <div className="relative z-10 flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-10 h-10 bg-[#4449AA] rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            defaultValue={selectedLead.name}
                                            onBlur={(e) => handleUpdateLead({ name: e.target.value })}
                                            className="block w-full text-2xl font-black text-gray-900 tracking-tight border-none hover:bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded px-2 -ml-2 transition-all bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            defaultValue={selectedLead.company_name || ''}
                                            placeholder="Empresa no especificada"
                                            onBlur={(e) => handleUpdateLead({ company_name: e.target.value })}
                                            className="block w-full text-[14px] font-bold text-gray-400/80 border-none hover:bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded px-2 -ml-2 transition-all bg-transparent"
                                        />
                                        <CustomDatePicker
                                            value={selectedLead.created_at || ''}
                                            onChange={(date) => {
                                                if (date) {
                                                    const newDate = new Date(`${date}T12:00:00Z`);
                                                    handleUpdateLead({ created_at: newDate.toISOString() });
                                                }
                                            }}
                                            variant="light"
                                            className="w-40"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                                    <div className="flex items-center gap-2 group bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm transition-all hover:border-blue-200">
                                        <Phone className="w-3.5 h-3.5 text-blue-500" />
                                        <input
                                            type="text"
                                            defaultValue={selectedLead.phone || ''}
                                            placeholder="Añadir teléfono"
                                            onBlur={(e) => handleUpdateLead({ phone: e.target.value })}
                                            className="text-xs text-gray-700 font-bold border-none bg-transparent p-0 focus:ring-0 w-28"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 group bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm transition-all hover:border-blue-200">
                                        <Mail className="w-3.5 h-3.5 text-blue-500" />
                                        <input
                                            type="text"
                                            defaultValue={selectedLead.email || ''}
                                            placeholder="Añadir email"
                                            onBlur={(e) => handleUpdateLead({ email: e.target.value })}
                                            className="text-xs text-gray-700 font-bold border-none bg-transparent p-0 focus:ring-0 w-40"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 relative z-10 ml-4">
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDeleteLead(selectedLead.id, selectedLead.name)}
                                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm hover:shadow-md"
                                        title="Eliminar Lead"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsDetailOpen(false)}
                                    className="p-2.5 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-xl transition-all border border-gray-200 shadow-sm active:scale-95"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-6">
                            {/* Quick Stats */}
                            <div className="flex gap-3 sm:gap-4 min-w-0">
                                <div className="flex-1 min-w-0 overflow-hidden bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-4 sm:p-5 rounded-2xl border border-emerald-100/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-center group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                                    <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tighter truncate">${(selectedLead.value || 0).toLocaleString()}</p>
                                    <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mt-2">Inversión</p>
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden bg-gradient-to-br from-orange-50/80 to-rose-50/50 p-4 sm:p-5 rounded-2xl border border-orange-100/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-center group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                                    <div className="flex justify-center scale-110 mb-1"><PriorityBadge priority={selectedLead.priority || 'medium'} /></div>
                                    <p className="text-[10px] font-black text-orange-800/40 uppercase tracking-widest mt-2">Temperatura</p>
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden bg-gradient-to-br from-indigo-50/80 to-blue-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-center group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                                    <div className="flex justify-center scale-110 mb-1"><StatusBadge status={selectedLead.status} /></div>
                                    <p className="text-[10px] font-black text-indigo-800/40 uppercase tracking-widest mt-2">Estado</p>
                                </div>
                            </div>

                            {/* Canales de Chat Unificados */}
                            <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm space-y-3">
                                <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Centro de Mensajería
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/marketing/chat', { state: { lead: selectedLead, channel: 'telegram' } });
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 bg-sky-50 text-sky-600 rounded-xl font-bold text-xs hover:bg-sky-100 transition-all border border-sky-100"
                                    >
                                        <Send className="w-4 h-4" /> Telegram Bot
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/marketing/chat', { state: { lead: selectedLead, channel: 'whatsapp' } });
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 bg-green-50 text-green-600 rounded-xl font-bold text-xs hover:bg-green-100 transition-all border border-green-100"
                                    >
                                        <Smartphone className="w-4 h-4" /> WhatsApp
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium text-center italic">
                                    Activa la comunicación omnicanal con este lead.
                                </p>
                            </div>

                            {/* Quick Action Logger */}
                            <div>
                                {!isCallLoggerOpen ? (
                                    <button
                                        onClick={() => setIsCallLoggerOpen(true)}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-dashed border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-100 font-black px-4 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] group"
                                    >
                                        <div className="w-7 h-7 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                            <Phone className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        Registrar Acción
                                    </button>
                                ) : (
                                    <QuickActionLogger
                                        lead={selectedLead}
                                        companyId={localStorage.getItem('simulated_company_id') || profile?.company_id || ''}
                                        teamMembers={teamMembers}
                                        callStartedAt={callStartedAt ?? undefined}
                                        onCallLogged={async (statusChanged, newStatus) => {
                                            if (statusChanged && newStatus) {
                                                await handleUpdateLead({ status: newStatus });
                                            }
                                            loadFollowUps(selectedLead.id);
                                        }}
                                        onClose={() => {
                                            setIsCallLoggerOpen(false);
                                            setCallStartedAt(null); // reset mobile call start
                                        }}
                                    />
                                )}
                            </div>

                            {/* Edit Status & Priority */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cambiar Estado</label>
                                    <div className="relative">
                                        <select
                                            value={selectedLead.status}
                                            onChange={(e) => handleUpdateLead({ status: e.target.value as LeadStatus })}
                                            className="block w-full rounded-xl border-gray-200 shadow-sm text-sm font-bold text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all pl-3 py-2.5"
                                        >
                                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                <option key={key} value={key}>
                                                    {config.icon} {config.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {(selectedLead.contact_count || 0) > 0 && (
                                        <div className={`flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black ${(selectedLead.contact_count || 0) >= 6 ? 'bg-red-50 text-red-600' :
                                            (selectedLead.contact_count || 0) >= 4 ? 'bg-amber-50 text-amber-600' :
                                                'bg-emerald-50 text-emerald-600'
                                            }`}>
                                            📞 {selectedLead.contact_count} intentos
                                        </div>
                                    )}
                                    {(selectedLead.engagement_score || 0) > 0 && (
                                        <div className={`flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black ${(selectedLead.engagement_score || 0) >= 10 ? 'bg-rose-50 text-rose-600' :
                                            (selectedLead.engagement_score || 0) >= 5 ? 'bg-orange-50 text-orange-600' :
                                                'bg-sky-50 text-sky-600'
                                            }`}>
                                            🔥 Engagement: {selectedLead.engagement_score} pts
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Temperatura</label>
                                    <div className="relative">
                                        <select
                                            value={selectedLead.priority || 'medium'}
                                            onChange={(e) => handleUpdateLead({ priority: e.target.value as LeadPriority })}
                                            className="block w-full rounded-xl border-gray-200 shadow-sm text-sm font-bold text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all pl-3 py-2.5"
                                        >
                                            <option value="very_high">🔥 Altísima (Hot)</option>
                                            <option value="high">⚡ Alta (Warm)</option>
                                            <option value="medium">🕑 Media</option>
                                            <option value="low">💤 Baja (Cold)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fuente del Lead</label>
                                    <div className="relative">
                                        <select
                                            value={selectedLead.source || ''}
                                            onChange={(e) => handleUpdateLead({ source: e.target.value || null })}
                                            className="block w-full rounded-xl border-gray-200 shadow-sm text-sm font-bold text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all pl-3 py-2.5"
                                        >
                                            <option value="">Sin especificar</option>
                                            {SOURCE_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.icon} {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rubro / Industria</label>
                                    <div className="relative">
                                        <select
                                            value={selectedLead.industry || ''}
                                            onChange={(e) => handleUpdateLead({ industry: e.target.value || null })}
                                            className="block w-full rounded-xl border-gray-200 shadow-sm text-sm font-bold text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all pl-3 py-2.5"
                                        >
                                            <option value="">Sin especificar</option>
                                            {industries.map(ind => (
                                                <option key={ind.id} value={ind.name}>
                                                    {ind.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                    <div className="flex-shrink-0">
                                        {(() => {
                                            const assignee = teamMembers.find(m => m.id === selectedLead.assigned_to);
                                            return assignee?.avatar_url ? (
                                                <img src={assignee.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm">
                                                    <User className="w-5 h-5 text-blue-400" />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                                            <Shield className="w-3 h-3" /> Dueño / Responsable Principal
                                        </label>
                                        <select
                                            value={selectedLead.assigned_to || ''}
                                            onChange={(e) => handleUpdateLead({ assigned_to: e.target.value || null })}
                                            className="block w-full rounded-md border-blue-200 shadow-sm text-sm bg-white focus:ring-blue-500 focus:border-blue-500 font-bold"
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
                            </div>

                            {/* Editable Values Section */}
                            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-green-600" /> Proyecciones Económicas
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-tight">Potencial ($)</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</div>
                                            <Input
                                                type="number"
                                                defaultValue={selectedLead.value || 0}
                                                onBlur={(e) => handleUpdateLead({ value: Number(e.target.value) })}
                                                className="pl-7 rounded-xl border-gray-100 bg-white font-black text-gray-900 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-tight">Cierre Real ($)</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</div>
                                            <Input
                                                type="number"
                                                defaultValue={selectedLead.closing_amount || 0}
                                                onBlur={(e) => handleUpdateLead({ closing_amount: Number(e.target.value) })}
                                                className="pl-7 rounded-xl border-gray-100 bg-white font-black text-green-600 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>
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


                            {/* ── Call Bot AI Results ───────────────────────────────────────── */}
                            {selectedLead.call_bot_data && Object.keys(selectedLead.call_bot_data as object).length > 0 && (() => {
                                const cbd = selectedLead.call_bot_data as Record<string, unknown>;
                                const calificado   = cbd.calificado as boolean | undefined;
                                const score        = cbd.score_calificacion as number | null | undefined;
                                const dtes         = cbd.dtes_por_mes as number | null | undefined;
                                const tieneSistema = cbd.tiene_sistema_dte as boolean | undefined;
                                const demoAgendada = cbd.demo_agendada as boolean | undefined;
                                const notas        = cbd.notas_llamada as string | undefined;
                                const llamadas     = cbd.llamadas_totales as number | undefined;
                                const ultimaLlamada = cbd.ultima_llamada as string | undefined;
                                return (
                                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-4 space-y-3">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-2">
                                                <span className="text-base">🤖</span> Resultado Call Bot AI
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                {llamadas !== undefined && llamadas > 0 && (
                                                    <span className="text-[9px] font-black text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full">
                                                        {llamadas} llamada{llamadas !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {ultimaLlamada && (
                                                    <span className="text-[9px] text-violet-400 font-medium">
                                                        {(() => { try { return format(new Date(ultimaLlamada), 'dd MMM HH:mm', { locale: es }); } catch { return ''; } })()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score + Calificación */}
                                        <div className="flex items-center gap-3">
                                            <div className={`flex-none px-3 py-1.5 rounded-xl text-xs font-black border ${calificado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {calificado ? '✅ Calificó' : '❌ No calificó'}
                                            </div>
                                            {score !== null && score !== undefined && (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-violet-100">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                            style={{ width: `${score}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-black text-violet-700 flex-none">{score}/100</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* DTE Data */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {dtes !== null && dtes !== undefined && (
                                                <div className="bg-white/70 rounded-xl p-2.5 border border-violet-100">
                                                    <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">DTE / mes</p>
                                                    <p className="text-lg font-black text-gray-900 mt-0.5">{dtes}<span className="text-xs text-gray-400 font-medium ml-1">docs</span></p>
                                                </div>
                                            )}
                                            <div className="bg-white/70 rounded-xl p-2.5 border border-violet-100">
                                                <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Sistema DTE</p>
                                                <p className={`text-sm font-black mt-0.5 ${tieneSistema ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {tieneSistema === undefined ? '—' : tieneSistema ? '⚠️ Ya tiene' : '✅ Sin sistema'}
                                                </p>
                                            </div>
                                            {demoAgendada !== undefined && (
                                                <div className={`bg-white/70 rounded-xl p-2.5 border ${demoAgendada ? 'border-purple-200' : 'border-violet-100'}`}>
                                                    <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Demo</p>
                                                    <p className={`text-sm font-black mt-0.5 ${demoAgendada ? 'text-purple-700' : 'text-gray-400'}`}>
                                                        {demoAgendada ? '📅 Agendada' : 'No agendada'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Notas de la llamada */}
                                        {notas && (
                                            <div className="bg-white/60 rounded-xl px-3 py-2.5 border border-violet-100">
                                                <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1">Notas de Sofía</p>
                                                <p className="text-xs text-gray-700 font-medium leading-relaxed">{notas}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Follow-up History - Always visible */}
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-500" /> Trazabilidad del Prospecto
                                    </h4>
                                    {(followUps.length + messages.length + callActivities.length > 0) && (
                                        <span className="text-[10px] font-black px-2.5 py-1 bg-indigo-50 text-indigo-500 rounded-full">
                                            {followUps.length + messages.length + callActivities.length} actividades
                                        </span>
                                    )}
                                </div>
                                {(followUps.length > 0 || messages.length > 0 || callActivities.length > 0) ? (
                                    <div className="relative pl-8 space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-indigo-100 before:via-gray-100 before:to-transparent">
                                        {[
                                            ...followUps.map(f => ({ ...f, _type: 'follow_up' as const })),
                                            ...messages.map(m => ({ ...m, _type: 'message' as const, date: m.created_at })),
                                            ...callActivities.map(a => ({ ...a, _type: 'call_activity' as const })),
                                        ].sort((a: any, b: any) => {
                                            const getDate = (x: any) => x._type === 'call_activity'
                                                ? new Date(x.call_date || x.created_at)
                                                : new Date(x.created_at || x.date);
                                            return getDate(b).getTime() - getDate(a).getTime();
                                        }).map((item: any) => {
                                            // --- Unified card logic ---
                                            const isActivity = item._type === 'call_activity';
                                            const isMessage = item._type === 'message';
                                            const isFollowUp = item._type === 'follow_up';

                                            // Resolve icon, label, colors for the card
                                            const actCfg = isActivity ? ACTION_TYPE_CONFIG[item.action_type as keyof typeof ACTION_TYPE_CONFIG] : null;
                                            const outCfg = isActivity ? CALL_OUTCOME_CONFIG[item.outcome as keyof typeof CALL_OUTCOME_CONFIG] : null;
                                            const followUpAction = isFollowUp ? ACTION_TYPES.find(t => t.value === item.action_type) : null;

                                            // Channel config for messages
                                            const channelCfg: Record<string, { icon: string; color: string; bg: string; border: string; label: string }> = {
                                                whatsapp: { icon: '💬', color: 'text-green-700', bg: 'bg-green-50', border: 'border-l-green-400', label: 'WhatsApp' },
                                                telegram: { icon: '✈️', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-l-sky-400', label: 'Telegram' },
                                                email: { icon: '📧', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-l-amber-400', label: 'Email' },
                                            };
                                            const msgCh = isMessage ? (channelCfg[item.channel] || { icon: '💬', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-l-gray-300', label: item.channel }) : null;

                                            // Dot color
                                            const dotBg = isActivity ? (actCfg?.bgColor || 'bg-gray-100') :
                                                isMessage ? (msgCh?.bg || 'bg-gray-100') :
                                                    'bg-indigo-50';
                                            const dotIcon = isActivity ? (actCfg?.icon || '📋') :
                                                isMessage ? (msgCh?.icon || '💬') :
                                                    (followUpAction?.icon || '📌');

                                            // Left border
                                            const borderColorMap: Record<string, string> = {
                                                call: 'border-l-blue-400', email: 'border-l-amber-400', whatsapp: 'border-l-green-400',
                                                telegram: 'border-l-sky-400', quote_sent: 'border-l-indigo-400', info_sent: 'border-l-purple-400', meeting: 'border-l-rose-400',
                                            };
                                            const leftBorder = isActivity ? (borderColorMap[item.action_type] || 'border-l-gray-300') :
                                                isMessage ? (msgCh?.border || 'border-l-gray-300') :
                                                    'border-l-indigo-300';

                                            // Type pill
                                            const typePill = isActivity ? { icon: actCfg?.icon, label: actCfg?.label || item.action_type, bg: actCfg?.bgColor || 'bg-gray-100', color: actCfg?.color || 'text-gray-600' } :
                                                isMessage ? { icon: msgCh?.icon, label: `${msgCh?.label} · ${item.direction === 'inbound' ? 'Recibido' : 'Enviado'}`, bg: msgCh?.bg || 'bg-gray-100', color: msgCh?.color || 'text-gray-600' } :
                                                    { icon: followUpAction?.icon || '📌', label: 'Seguimiento', bg: 'bg-indigo-50', color: 'text-indigo-700' };

                                            // Date
                                            const itemDate = (() => {
                                                try {
                                                    if (isActivity) return format(new Date(item.call_date || item.created_at), 'dd MMM, HH:mm', { locale: es });
                                                    if (isMessage) return format(new Date(item.created_at), 'dd MMM, HH:mm', { locale: es });
                                                    if (!item.date) return 'Sin fecha';
                                                    return format(new Date(`${item.date.split('T')[0]}T12:00:00`), 'dd MMM, yyyy', { locale: es });
                                                } catch { return 'Sin fecha'; }
                                            })();

                                            // Content / note
                                            const noteText = isActivity ? item.notes :
                                                isMessage ? (item.channel === 'email' && item.metadata?.campaign_id ? 'Email de campaña enviado' : item.content) :
                                                    item.notes;

                                            // Assignee
                                            const assignee = isFollowUp
                                                ? (item.assigned_profile?.full_name || item.assigned_profile?.email?.split('@')[0] || item.profiles?.full_name || item.profiles?.email?.split('@')[0] || null)
                                                : null;

                                            return (
                                                <div key={`${item._type}-${item.id}`} className="relative group">
                                                    {/* Timeline dot */}
                                                    <div className={`absolute -left-[30px] top-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm z-10 group-hover:scale-110 transition-transform ${dotBg}`}>
                                                        <span className="text-[10px] leading-none">{dotIcon}</span>
                                                    </div>
                                                    {/* Unified Card */}
                                                    <div className={`bg-white rounded-xl p-4 border border-gray-100 border-l-4 ${leftBorder} shadow-[0_1px_6px_rgba(0,0,0,0.04)] group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] group-hover:-translate-y-0.5 transition-all`}>
                                                        {/* Row 1: Type pill + Date */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${typePill.bg} ${typePill.color}`}>
                                                                {typePill.icon} {typePill.label}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-gray-400">{itemDate}</span>
                                                        </div>
                                                        {/* Row 2: Outcome badge (only call_activity) */}
                                                        {outCfg && (
                                                            <div className="mb-2">
                                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full ${outCfg.bgColor} ${outCfg.color}`}>
                                                                    {outCfg.icon} {outCfg.label}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Row 3: Campaign badge (only messages from campaigns) */}
                                                        {isMessage && item.metadata?.campaign_id && (
                                                            <div className="mb-2">
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 uppercase tracking-wider">
                                                                    <TrendingUp className="w-2.5 h-2.5" /> Campaña
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Row 4: Note / Content */}
                                                        {noteText && (
                                                            <p className="text-[13px] text-gray-600 leading-relaxed mt-1 whitespace-pre-wrap">
                                                                {noteText}
                                                            </p>
                                                        )}
                                                        {!noteText && isFollowUp && (
                                                            <p className="text-[13px] text-gray-300 italic mt-1">Sin comentarios</p>
                                                        )}
                                                        {/* Row 5: Footer — duration / assignee */}
                                                        {(assignee || (isActivity && item.duration_seconds > 0)) && (
                                                            <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center gap-3 flex-wrap">
                                                                {isActivity && item.duration_seconds > 0 && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                                        <Clock className="w-3 h-3" /> {Math.round(item.duration_seconds / 60)} min
                                                                    </span>
                                                                )}
                                                                {assignee && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                                        <User className="w-3 h-3" /> <span className="font-black text-indigo-600 uppercase tracking-wider">{assignee}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                        <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sin actividad registrada</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
};