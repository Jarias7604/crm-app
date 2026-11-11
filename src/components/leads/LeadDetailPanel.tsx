import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Calendar, CheckCircle, Plus, FileText, Send, Clock, Trash2, Shield, X, MapPin, Building, Globe, Copy, RefreshCw, MessageCircle, TrendingUp, DollarSign, Download, UploadCloud, Loader2, Target, MessageSquare, Smartphone, Activity, QrCode, Box, ShieldCheck, ExternalLink, Flame, Sparkles, ChevronLeft, Video } from 'lucide-react';
import { LiveDemoHUDModal, parseAriasAnswersFromNotes } from './LiveDemoHUDModal';
import { GeminiAuditModal } from './GeminiAuditModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { leadProductsService } from '../../services/leadProducts';
import { ManageProductsModal } from './ManageProductsModal';
import { ManageLeadSourcesModal } from './ManageLeadSourcesModal';
import { ManageIndustriesModal } from './ManageIndustriesModal';
import type { LeadProduct } from '../../types';
import { supabase } from '../../services/supabase';
import { leadsService, isAutoWhatsAppCampaignFollowUp } from '../../services/leads';
import { callActivityService, ACTION_TYPE_CONFIG, CALL_OUTCOME_CONFIG } from '../../services/callActivity';
import { logger } from '../../utils/logger';
import { PRIORITY_CONFIG, STATUS_CONFIG, SOURCE_CONFIG, ACTION_TYPES } from '../../types';
import { useLeadSources } from '../../hooks/useLeadSources';
import type { Lead, FollowUp, LeadStatus, LeadPriority } from '../../types';
import { salesAuditService } from '../../services/salesAuditService';
import type { SalesCallAudit } from '../../types/salesExcellence';
import { type CallActivity } from '../../services/callActivity';
import { contractsService } from '../../services/contracts';
import type { Contract } from '../../types/contracts';
import { cotizacionesService } from '../../services/cotizaciones';
import type { Cotizacion } from '../../types/cotizaciones';
import { ContractEditorModal } from '../contracts/ContractEditorModal';
import { ContractShareModal } from '../contracts/ContractShareModal';
import { contractPdfService } from '../../services/contractPdfService';
import { QuickActionLogger } from '../QuickCallLogger';
import GoogleMeetScheduler from '../GoogleMeetScheduler';
import { SectionErrorBoundary } from '../ui/SectionErrorBoundary';
import { LeadWhatsappThread } from './LeadWhatsappThread';
import toast from 'react-hot-toast';

import { Input } from '../ui/Input';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { CustomSelect } from '../ui/CustomSelect';
import { EnterpriseCard, EnterpriseCardHeader, EnterpriseCardContent, EnterpriseField } from '../ui/EnterpriseCard';

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
    onIndustriesChanged?: () => void;
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
    products: LeadProduct[];
    loadProducts: () => Promise<void>;
}

export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({
    isOpen,
    onClose,
    lead,
    products,
    loadProducts,
    teamMembers,
    profile,
    isAdmin,
    navigate,
    storageService,
    industries, onIndustriesChanged, handleFileDownload, handleFileDelete, handleFileUpload, isUploading, isCallLoggerOpen, setIsCallLoggerOpen, callStartedAt, setCallStartedAt, handleUpdateLead, handleDeleteLead, StatusBadge, PriorityBadge
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

    const [activeTab, setActiveTab] = useState<'info' | 'sales' | 'quotes' | 'activity'>('info');
    const [timelineFilter, setTimelineFilter] = useState<'all' | 'calls' | 'messages' | 'followups'>('all');
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);
    const [isManageIndustriesOpen, setIsManageIndustriesOpen] = useState(false);

    // Dynamic lead sources from DB
    const { options: sourceOptions, reload: reloadSources } = useLeadSources();

    // Dialog states
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
    const [isDocGeneratorOpen, setIsDocGeneratorOpen] = useState(false);
    const [isFollowUpLoggerOpen, setIsFollowUpLoggerOpen] = useState(false);
    const [isMeetSchedulerOpen, setIsMeetSchedulerOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [customMessage, setCustomMessage] = useState('');
    const [leadContracts, setLeadContracts] = useState<Contract[]>([]);
    const [selectedContractForEdit, setSelectedContractForEdit] = useState<Contract | null>(null);
    const [isContractEditorOpen, setIsContractEditorOpen] = useState(false);
    const [contractForShare, setContractForShare] = useState<Contract | null>(null);
    const [isContractShareOpen, setIsContractShareOpen] = useState(false);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    // Cotizaciones del Lead y Restricción de Contratos sin Cotización
    const [leadCotizaciones, setLeadCotizaciones] = useState<Cotizacion[]>([]);
    const [selectedCotizacionForContract, setSelectedCotizacionForContract] = useState<Cotizacion | null>(null);
    const [isQuotePickerOpen, setIsQuotePickerOpen] = useState(false);
    const [isNoQuoteWarningOpen, setIsNoQuoteWarningOpen] = useState(false);

    // ARIAS Sales Excellence & Gemini HUD
    const [isDemoHUDOpen, setIsDemoHUDOpen] = useState(false);
    const [isGeminiAuditOpen, setIsGeminiAuditOpen] = useState(false);
    const [leadAudit, setLeadAudit] = useState<SalesCallAudit | null>(null);

    const loadLeadAudit = async (leadId?: string, leadName?: string) => {
        if (!leadId) return;
        try {
            const audits = await salesAuditService.getAuditsByLead(leadId, leadName);
            if (audits && audits.length > 0) {
                setLeadAudit(audits[0]);
            } else {
                setLeadAudit(null);
            }
        } catch {
            setLeadAudit(null);
        }
    };

    useEffect(() => {
        if (lead?.id) {
            loadLeadAudit(lead.id, lead.name);
        }
    }, [lead?.id, lead?.name]);

    useEffect(() => {
        const handleAuditUpdate = () => {
            if (lead?.id) {
                loadLeadAudit(lead.id, lead.name);
            }
        };
        window.addEventListener('sales_audit_updated', handleAuditUpdate);
        return () => window.removeEventListener('sales_audit_updated', handleAuditUpdate);
    }, [lead?.id, lead?.name]);

    const handleInitiateContractCreation = () => {
        if (leadCotizaciones.length === 0) {
            setIsNoQuoteWarningOpen(true);
            return;
        }

        if (leadCotizaciones.length === 1) {
            setSelectedCotizacionForContract(leadCotizaciones[0]);
            setSelectedContractForEdit(null);
            setIsContractEditorOpen(true);
            return;
        }

        // Multiple quotes -> open quote selector modal
        setIsQuotePickerOpen(true);
    };

    const handleSelectQuoteForContract = (cot: Cotizacion) => {
        setSelectedCotizacionForContract(cot);
        setIsQuotePickerOpen(false);
        setSelectedContractForEdit(null);
        setIsContractEditorOpen(true);
    };

    const getWhatsAppLink = (phone: string) => {
        if (!phone) return '';
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 8) {
            cleanPhone = '503' + cleanPhone;
        }
        let url = `https://wa.me/${cleanPhone}`;
        if (customMessage.trim()) {
            url += `?text=${encodeURIComponent(customMessage.trim())}`;
        }
        return url;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Enlace copiado al portapapeles');
    };

    const handleOpenQr = () => {
        if (!lead?.phone) {
            toast.error('Por favor, ingresa un número de teléfono para el lead.');
            return;
        }
        setIsQrModalOpen(true);
    };

    useEffect(() => {
        if (isOpen && lead) {
            loadDetails();
        }
    }, [isOpen, lead?.id]);

    const loadDetails = async () => {
        if (!lead) return;
        setIsLoadingDetails(true);
        try {
            const [followUpsData, messagesData, activitiesData, contractsData, cotizacionesData] = await Promise.all([
                leadsService.getFollowUps(lead.id),
                leadsService.getLeadMessages(lead.id),
                callActivityService.getLeadCalls(lead.id),
                contractsService.getByLead(lead.id).catch(() => []),
                cotizacionesService.getCotizacionesByLead(lead.id).catch(() => []),
            ]);
            setFollowUps(followUpsData || []);
            setMessages(messagesData || []);
            setCallActivities(activitiesData || []);
            setLeadContracts(contractsData || []);
            setLeadCotizaciones(cotizacionesData || []);

            // Cargar info de empresa si no está
            if (lead.company_id) {
                const { data: comp } = await supabase
                    .from('companies')
                    .select('id, name, logo_url, website, address, phone, tax_id')
                    .eq('id', lead.company_id)
                    .maybeSingle();
                if (comp) setCompanyInfo(comp);
            }
        } catch (error) {
            logger.error('Failed to load details', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    if (!isOpen || !lead) return null;

    const selectedLead = lead;
    const setIsDetailOpen = (val: boolean) => { if (!val) onClose(); };

    // Extraer respuestas de las 7 preguntas obligatorias (Método ARIAS) desde seguimientos y notas del lead
    const ariasDiscoveryAnswers = (() => {
        const combinedSources = [
            ...followUps.map((f) => f?.notes || ''),
            selectedLead.next_action_notes || '',
            ...callActivities.map((a) => a?.notes || ''),
        ]
            .filter(Boolean)
            .join('\n\n');
        return parseAriasAnswersFromNotes(combinedSources);
    })();
    const ariasAnsweredCount = Object.keys(ariasDiscoveryAnswers).length;

    // ── Cálculo del NEXT TRIGGER (Próxima Reunión / Próximo Seguimiento Agendado) ──
    const nextTrigger = (() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

        const parseFollowUpDate = (raw?: string | null): Date | null => {
            if (!raw) return null;
            const d = new Date(raw.includes('T') ? raw : `${raw}T09:00:00`);
            return isNaN(d.getTime()) ? null : d;
        };

        const sortedFollowUps = [...followUps]
            .filter(f => f && f.date && !isAutoWhatsAppCampaignFollowUp(f.notes))
            .sort((a, b) => {
                const da = parseFollowUpDate(a.date)?.getTime() || 0;
                const db = parseFollowUpDate(b.date)?.getTime() || 0;
                return da - db;
            });

        // 1. Buscar el seguimiento futuro o de hoy más próximo
        const upcomingFu = sortedFollowUps.find(f => {
            const dt = parseFollowUpDate(f.date);
            return dt && dt.getTime() >= startOfToday && !(f as any).completed;
        });

        // 2. Si no hay futuro en followUps, verificar si selectedLead.next_followup_date es un agendamiento manual válido
        const rawLeadNext = String(selectedLead.next_followup_date || '');
        const isAutoCampaignTimestamp = rawLeadNext.includes('T') && !/T\d{2}:\d{2}:00(\.000)?Z?$/.test(rawLeadNext);
        const leadNextDt = isAutoCampaignTimestamp ? null : parseFollowUpDate(selectedLead.next_followup_date);
        const latestScheduledFu = sortedFollowUps.length > 0 ? sortedFollowUps[sortedFollowUps.length - 1] : null;
        const targetFu: any = upcomingFu || latestScheduledFu;

        let targetDate: Date | null = upcomingFu
            ? parseFollowUpDate(upcomingFu.date)
            : (leadNextDt && (!latestScheduledFu || leadNextDt.getTime() >= (parseFollowUpDate(latestScheduledFu.date)?.getTime() || 0))
                ? leadNextDt
                : parseFollowUpDate(latestScheduledFu?.date));

        const rawDateStr = upcomingFu?.date || (targetDate === leadNextDt ? selectedLead.next_followup_date : latestScheduledFu?.date) || '';
        const hasExplicitTime = typeof rawDateStr === 'string' && rawDateStr.includes('T') && !rawDateStr.endsWith('T00:00:00') && !rawDateStr.endsWith('T12:00:00');

        let statusType: 'upcoming' | 'today' | 'overdue' | 'none' = 'none';
        let statusBadge = 'Sin Próximo Seguimiento Agendado';
        let relativeLabel = '';

        if (targetDate) {
            const ts = targetDate.getTime();
            const diffDays = Math.round((ts - startOfToday) / (24 * 60 * 60 * 1000));
            if (ts >= startOfToday && ts <= endOfToday) {
                statusType = 'today';
                statusBadge = 'PROGRAMADO PARA HOY';
                relativeLabel = 'Hoy';
            } else if (ts > endOfToday) {
                statusType = 'upcoming';
                statusBadge = 'PRÓXIMA CITA / SEGUIMIENTO AGENDADO';
                relativeLabel = diffDays === 1 ? 'Mañana' : `En ${diffDays} días`;
            } else {
                statusType = 'overdue';
                statusBadge = 'SEGUIMIENTO VENCIDO · REQUIERE REAGENDAR';
                const overdueDays = Math.max(1, Math.abs(diffDays));
                relativeLabel = overdueDays === 1 ? 'Ayer' : `Hace ${overdueDays} días`;
            }
        }

        const formattedDate = targetDate
            ? format(targetDate, "EEE dd 'de' MMM, yyyy", { locale: es })
            : 'No agendado';
        const formattedTime = targetDate && hasExplicitTime
            ? format(targetDate, 'hh:mm a', { locale: es })
            : null;

        const rawActionType = targetFu?.action_type || 'call';
        const combinedNotes = String(targetFu?.notes || selectedLead.next_action_notes || callActivities[0]?.notes || '').trim();
        const isMeetingNote = /reuni[oó]n|demo|meet|zoom|presentaci[oó]n|entrega/i.test(combinedNotes);
        const actionLabel =
            rawActionType === 'meeting' || isMeetingNote
                ? '🎥 Reunión / Compromiso Agendado'
                : rawActionType === 'whatsapp'
                    ? '💬 Seguimiento por WhatsApp'
                    : rawActionType === 'email'
                        ? '✉️ Seguimiento por Correo'
                        : '📞 Llamada de Seguimiento';

        const assigneeId = targetFu?.assigned_to || selectedLead.next_followup_assignee || selectedLead.assigned_to;
        const memberMatch = Array.isArray(teamMembers) ? teamMembers.find(m => m?.id === assigneeId) : null;
        const assigneeName =
            targetFu?.assigned_profile?.full_name ||
            targetFu?.profiles?.full_name ||
            memberMatch?.full_name ||
            (typeof memberMatch?.email === 'string' ? memberMatch.email.split('@')[0] : null) ||
            null;

        const meetUrl = targetFu?.meet_link || targetFu?.calendar_html_link || null;

        return {
            hasTrigger: !!targetDate,
            statusType,
            statusBadge,
            relativeLabel,
            formattedDate,
            formattedTime,
            actionLabel,
            notes: combinedNotes || 'Sin nota de acuerdo registrada para el próximo contacto.',
            assigneeName,
            meetUrl
        };
    })();

    return (
        <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
            <div className="absolute inset-0 bg-black/40 lead-sheet-backdrop" onClick={() => setIsDetailOpen(false)} />
            <div className="relative z-10 w-full sm:w-[680px] md:w-[720px] lg:w-[750px] sm:max-w-[85vw] h-full bg-[#F8FAFC] shadow-[-16px_0_48px_rgba(15,23,42,0.12)] flex flex-col overflow-hidden lead-sheet transition-all duration-300 ease-out border-l border-slate-200/80">
                {/* Header Enterprise Compacto & Cómodo (Bajo perfil, máximo espacio vertical para el teclado y datos) */}
                <div className="bg-white border-b border-slate-200 relative z-30 px-2.5 sm:px-6 py-2 sm:py-2.5 shadow-2xs space-y-1.5 shrink-0">
                    {/* Fila 1: Breadcrumb + Acciones Rápidas */}
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => setIsDetailOpen(false)}
                            className="text-slate-600 hover:text-blue-600 font-bold text-xs cursor-pointer hover:underline flex items-center gap-1 py-1 px-1.5 -ml-1 rounded-lg hover:bg-slate-100 transition-all shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4 text-blue-600" />
                            <span>Prospectos</span>
                        </button>

                        {/* Acciones de Cabecera (Separadas, cómodas y accesibles sin amontonamiento) */}
                        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                            {/* Botón WhatsApp directo (si tiene teléfono) */}
                            {selectedLead.phone && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const link = getWhatsAppLink(selectedLead.phone || '');
                                        if (link) window.open(link, '_blank');
                                    }}
                                    className="h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
                                    title="Abrir WhatsApp"
                                >
                                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                </button>
                            )}

                            {/* Botón Registrar Acción / Seguimiento */}
                            <button
                                type="button"
                                onClick={() => setIsCallLoggerOpen(!isCallLoggerOpen)}
                                className={`h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg font-bold text-xs tracking-wide transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${isCallLoggerOpen
                                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                                    }`}
                                title={isCallLoggerOpen ? 'Cerrar registro de seguimiento' : 'Registrar nuevo seguimiento'}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isCallLoggerOpen ? 'Cerrar' : 'Seguimiento'}</span>
                            </button>

                            {/* Botón QR */}
                            <button
                                type="button"
                                onClick={handleOpenQr}
                                className="h-8 sm:h-8.5 w-8 sm:w-8.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="Código QR WhatsApp"
                            >
                                <QrCode className="w-4 h-4" />
                            </button>

                            {/* Botón Eliminar Lead (Admin) */}
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteLead(selectedLead.id, selectedLead.name)}
                                    className="h-8 sm:h-8.5 w-8 sm:w-8.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                                    title="Eliminar Lead"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}

                            {/* Botón Cerrar */}
                            <button
                                type="button"
                                onClick={() => setIsDetailOpen(false)}
                                className="h-8 sm:h-8.5 w-8 sm:w-8.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="Cerrar panel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Fila 2: Nombre del Lead + Empresa */}
                    <div className="flex items-center gap-2 pt-0.5 min-w-0">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-center text-blue-600 shadow-2xs">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 flex items-baseline gap-2">
                            <input
                                type="text"
                                defaultValue={selectedLead.name}
                                onBlur={(e) => handleUpdateLead({ name: e.target.value })}
                                className="font-bold text-slate-900 text-sm sm:text-base border-none hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-600 rounded px-1 -ml-1 transition-all bg-transparent placeholder-slate-400 truncate flex-1 min-w-[120px]"
                                placeholder="Nombre del Lead"
                            />
                            <input
                                type="text"
                                defaultValue={selectedLead.company_name || ''}
                                placeholder="Empresa no especificada"
                                onBlur={(e) => handleUpdateLead({ company_name: e.target.value })}
                                className="text-xs font-medium text-slate-500 border-none hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-600 rounded px-1 transition-all bg-transparent placeholder-slate-400 truncate hidden sm:block max-w-[200px]"
                            />
                        </div>
                    </div>

                    {/* Fila 3: Barra de Next Trigger (Próximo Seguimiento / Próxima Reunión) siempre visible */}
                    <div
                        onClick={() => setActiveTab('activity')}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${nextTrigger.statusType === 'upcoming'
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70'
                                : nextTrigger.statusType === 'today'
                                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100/70'
                                    : nextTrigger.statusType === 'overdue'
                                        ? 'bg-rose-50/80 border-rose-200 text-rose-900 hover:bg-rose-100/70'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        title="Clic para ver el detalle del Próximo Seguimiento (Next Trigger)"
                    >
                        <div className="flex items-center gap-2 min-w-0 truncate">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${nextTrigger.statusType === 'upcoming'
                                    ? 'bg-emerald-600 text-white'
                                    : nextTrigger.statusType === 'today'
                                        ? 'bg-amber-500 text-slate-950'
                                        : nextTrigger.statusType === 'overdue'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-slate-300 text-slate-800'
                                }`}>
                                ⚡ Next Trigger
                            </span>
                            {nextTrigger.hasTrigger ? (
                                <span className="font-bold truncate text-[11px]">
                                    📅 {nextTrigger.formattedDate}{nextTrigger.formattedTime ? ` · ${nextTrigger.formattedTime}` : ''} ({nextTrigger.relativeLabel}) — <span className="font-medium opacity-90">{nextTrigger.actionLabel}</span>
                                </span>
                            ) : (
                                <span className="font-semibold text-[11px] text-slate-500 truncate">
                                    Sin próxima reunión o seguimiento agendado
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsCallLoggerOpen(true);
                            }}
                            className="shrink-0 px-2 py-0.5 rounded bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-black text-[10px] uppercase tracking-wider shadow-2xs cursor-pointer"
                        >
                            {nextTrigger.hasTrigger ? 'Reprogramar' : '+ Agendar'}
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs (Estilo Enterprise Limpio y Organizado — Sin fatiga visual) */}
                <div className="bg-white border-b border-slate-200 relative z-20 shrink-0 px-2.5 sm:px-6">
                    <div className="flex items-center gap-2.5 sm:gap-8 text-xs overflow-x-auto no-scrollbar scroll-smooth">
                        <button
                            type="button"
                            onClick={() => setActiveTab('info')}
                            className={`flex items-center gap-1.5 py-2 sm:py-2.5 border-b-2 font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'info'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
                                }`}
                        >
                            <User className={`w-3.5 h-3.5 ${activeTab === 'info' ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>Ficha Lead</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('sales')}
                            className={`flex items-center gap-1.5 py-2 sm:py-2.5 border-b-2 font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'sales'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
                                }`}
                        >
                            <Flame className={`w-3.5 h-3.5 ${activeTab === 'sales' ? 'text-rose-600' : 'text-slate-400'}`} />
                            <span>Método Arias</span>
                            {ariasAnsweredCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                    {ariasAnsweredCount}/7
                                </span>
                            )}
                            {leadAudit && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5 shrink-0" title="Auditado" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('quotes')}
                            className={`flex items-center gap-1.5 py-2 sm:py-2.5 border-b-2 font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'quotes'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
                                }`}
                        >
                            <FileText className={`w-3.5 h-3.5 ${activeTab === 'quotes' ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>Cotizaciones</span>
                            {(leadCotizaciones.length + leadContracts.length) > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                    {leadCotizaciones.length + leadContracts.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('activity')}
                            className={`flex items-center gap-1.5 py-2 sm:py-2.5 border-b-2 font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'activity'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
                                }`}
                        >
                            <Clock className={`w-3.5 h-3.5 ${activeTab === 'activity' ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>Seguimientos</span>
                            {(followUps.length + messages.length + callActivities.length) > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                    {followUps.length + messages.length + callActivities.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content Scrollable Container — Aprovechamiento total de esquinas */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 sm:p-6 pb-28 space-y-3 sm:space-y-6">
                    {/* ── TAB 1: FICHA & NEGOCIO ── */}
                    {activeTab === 'info' && (
                        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
                            {/* 2-Column Responsive Layout for Details (Al grano, directo al formulario como en Item Master) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                {/* Left Column: Parámetros del Lead */}
                                <EnterpriseCard>
                                    {/* Sub-header Strip Estructurado (Estilo Enterprise Limpio) */}
                                    <EnterpriseCardHeader
                                        title="Parámetros Comerciales"
                                        icon={<Target className="w-3.5 h-3.5" />}
                                    />

                                    <EnterpriseCardContent>
                                        <EnterpriseField label="Estado del Embudo">
                                            <CustomSelect
                                                value={selectedLead.status}
                                                onChange={(val) => handleUpdateLead({ status: val as LeadStatus })}
                                                options={Object.entries(STATUS_CONFIG).map(([key, config]) => ({ value: key, label: config.label, icon: config.icon }))}
                                            />
                                        </EnterpriseField>

                                        <EnterpriseField
                                            label="Temperatura / Prioridad"
                                            actionBadge={
                                                (selectedLead.engagement_score || 0) > 0 ? (
                                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                                        Engagement: {selectedLead.engagement_score} pts
                                                    </span>
                                                ) : undefined
                                            }
                                        >
                                            <CustomSelect
                                                value={selectedLead.priority || 'medium'}
                                                onChange={(val) => handleUpdateLead({ priority: val as LeadPriority })}
                                                options={[
                                                    { value: 'very_high', label: 'Altísima (Hot)' },
                                                    { value: 'high', label: 'Alta (Warm)' },
                                                    { value: 'medium', label: 'Media' },
                                                    { value: 'low', label: 'Baja (Cold)' },
                                                ]}
                                            />
                                        </EnterpriseField>

                                        {/* Inversión Potencial ($) y Cierre Real ($) — Compacto, simple, al grano como en Item Master */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <EnterpriseField label="Inversión Potencial">
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">$</span>
                                                    <Input
                                                        type="number"
                                                        defaultValue={selectedLead.value || 0}
                                                        onBlur={(e) => handleUpdateLead({ value: Number(e.target.value) })}
                                                        className="h-8.5 pl-6 rounded-md border-slate-300 bg-white font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs shadow-2xs"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </EnterpriseField>

                                            <EnterpriseField label="Cierre Real">
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">$</span>
                                                    <Input
                                                        type="number"
                                                        defaultValue={selectedLead.closing_amount || 0}
                                                        onBlur={(e) => handleUpdateLead({ closing_amount: Number(e.target.value) })}
                                                        className="h-8.5 pl-6 rounded-md border-slate-300 bg-white font-bold text-emerald-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs shadow-2xs"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </EnterpriseField>
                                        </div>

                                        <EnterpriseField
                                            label="Fuente de Origen"
                                            actionText="Gestionar"
                                            onActionClick={() => setIsManageSourcesOpen(true)}
                                        >
                                            <CustomSelect
                                                value={selectedLead.source || ''}
                                                onChange={(val) => handleUpdateLead({ source: val || null })}
                                                options={(() => {
                                                    const list = [
                                                        { value: '', label: 'Sin especificar' },
                                                        ...sourceOptions.map(opt => ({ value: opt.value, label: opt.label }))
                                                    ];
                                                    if (selectedLead.source && !list.some(o => o.value === selectedLead.source || (typeof o.label === 'string' && o.label.toLowerCase() === selectedLead.source?.toLowerCase()))) {
                                                        list.push({ value: selectedLead.source, label: selectedLead.source });
                                                    }
                                                    return list;
                                                })()}
                                                placeholder="Sin especificar"
                                                searchable={true}
                                            />
                                        </EnterpriseField>

                                        <EnterpriseField
                                            label="Rubro / Industria"
                                            actionText="Gestionar"
                                            onActionClick={() => setIsManageIndustriesOpen(true)}
                                        >
                                            <CustomSelect
                                                value={selectedLead.industry || ''}
                                                onChange={(val) => handleUpdateLead({ industry: val || null })}
                                                options={(() => {
                                                    const list = [
                                                        { value: '', label: 'Sin especificar' },
                                                        ...industries.map(ind => ({ value: ind.name, label: ind.name }))
                                                    ];
                                                    if (selectedLead.industry && !list.some(o => o.value === selectedLead.industry || (typeof o.label === 'string' && o.label.toLowerCase() === selectedLead.industry?.toLowerCase()))) {
                                                        list.push({ value: selectedLead.industry, label: selectedLead.industry });
                                                    }
                                                    return list;
                                                })()}
                                                placeholder="Sin especificar"
                                                searchable={true}
                                            />
                                        </EnterpriseField>

                                        <EnterpriseField
                                            label="Producto de Interés"
                                            actionText="Gestionar"
                                            onActionClick={() => setIsManageModalOpen(true)}
                                        >
                                            <CustomSelect
                                                value={selectedLead.interested_product_id || ''}
                                                onChange={(val) => handleUpdateLead({ interested_product_id: val || null })}
                                                options={[
                                                    { value: '', label: 'Sin especificar' },
                                                    ...products.map(p => ({ value: p.id, label: p.name }))
                                                ]}
                                                placeholder="Sin especificar"
                                            />
                                        </EnterpriseField>

                                        {/* Propietario del Lead (Diseño Plano y Limpio) */}
                                        <EnterpriseField
                                            label="Asignado A"
                                            icon={<Shield className="w-3 h-3 text-blue-600" />}
                                        >
                                            <CustomSelect
                                                value={selectedLead.assigned_to || ''}
                                                onChange={(val) => handleUpdateLead({ assigned_to: val || null })}
                                                options={[
                                                    { value: '', label: 'Sin asignar' },
                                                    ...teamMembers.map(m => {
                                                        const emailPrefix = typeof m.email === 'string' && m.email.includes('@') ? m.email.split('@')[0] : (m.email || '');
                                                        const label = m.full_name
                                                            ? (emailPrefix ? `${m.full_name} (${emailPrefix})` : m.full_name)
                                                            : (m.email || 'Miembro');
                                                        return { value: m.id, label };
                                                    })
                                                ]}
                                                placeholder="Sin asignar"
                                            />
                                        </EnterpriseField>
                                    </EnterpriseCardContent>
                                </EnterpriseCard>

                                {/* Right Column: Contacto Directo & Documentos */}
                                <div className="space-y-4 sm:space-y-6">
                                    {/* Contacto & Canales Directos */}
                                    <EnterpriseCard>
                                        <EnterpriseCardHeader
                                            title="Contacto & Canales Directos"
                                            icon={<Phone className="w-3.5 h-3.5" />}
                                        />

                                        <EnterpriseCardContent>
                                            {/* Teléfono */}
                                            <EnterpriseField
                                                label="Teléfono Principal"
                                                actionBadge={
                                                    selectedLead.phone ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <a
                                                                href={`tel:${selectedLead.phone}`}
                                                                className="text-[10px] font-bold text-blue-600 hover:underline"
                                                            >
                                                                Llamar
                                                            </a>
                                                            <span className="text-slate-300">•</span>
                                                            <a
                                                                href={getWhatsAppLink(selectedLead.phone)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-[10px] font-bold text-emerald-600 hover:underline"
                                                            >
                                                                WhatsApp
                                                            </a>
                                                        </div>
                                                    ) : undefined
                                                }
                                            >
                                                <div className="relative">
                                                    <Phone className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                    <Input
                                                        type="text"
                                                        defaultValue={selectedLead.phone || ''}
                                                        placeholder="Añadir número de teléfono"
                                                        onBlur={(e) => handleUpdateLead({ phone: e.target.value })}
                                                        className="h-8.5 pl-8 rounded-md border-slate-300 bg-white font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs shadow-2xs"
                                                    />
                                                </div>
                                            </EnterpriseField>

                                            {/* Email */}
                                            <EnterpriseField
                                                label="Correo Electrónico"
                                                actionBadge={
                                                    selectedLead.email ? (
                                                        <a
                                                            href={`mailto:${selectedLead.email}`}
                                                            className="text-[10px] font-bold text-blue-600 hover:underline"
                                                        >
                                                            Enviar correo
                                                        </a>
                                                    ) : undefined
                                                }
                                            >
                                                <div className="relative">
                                                    <Mail className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                    <Input
                                                        type="email"
                                                        defaultValue={selectedLead.email || ''}
                                                        placeholder="Añadir email"
                                                        onBlur={(e) => handleUpdateLead({ email: e.target.value })}
                                                        className="h-8.5 pl-8 rounded-md border-slate-300 bg-white font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs shadow-2xs"
                                                    />
                                                </div>
                                            </EnterpriseField>

                                            {/* Fecha de Registro */}
                                            <EnterpriseField label="Fecha de Registro">
                                                <CustomDatePicker
                                                    value={selectedLead.created_at || ''}
                                                    onChange={(date) => {
                                                        if (date) {
                                                            const newDate = new Date(`${date}T12:00:00Z`);
                                                            handleUpdateLead({ created_at: newDate.toISOString() });
                                                        }
                                                    }}
                                                    variant="light"
                                                    className="w-full [&>div]:!h-8.5 [&>div]:!rounded-md [&>div]:!border-slate-300 [&>div]:!bg-white [&>div]:!shadow-2xs [&>div]:!text-xs"
                                                />
                                            </EnterpriseField>

                                            {/* Mensajería Rápida */}
                                            <div className="pt-2 border-t border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                                                    Mensajería Rápida
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate('/marketing/chat', { state: { lead: selectedLead, channel: 'telegram' } });
                                                        }}
                                                        className="flex items-center justify-center gap-1.5 h-8 px-2.5 bg-sky-50/80 hover:bg-sky-100 text-sky-700 rounded-md font-bold text-xs transition-all border border-sky-200/60 shadow-2xs cursor-pointer active:scale-95"
                                                    >
                                                        <Send className="w-3 h-3 text-sky-500" /> Telegram Bot
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate('/marketing/chat', { state: { lead: selectedLead, channel: 'whatsapp' } });
                                                        }}
                                                        className="flex items-center justify-center gap-1.5 h-8 px-2.5 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 rounded-md font-bold text-xs transition-all border border-emerald-200/60 shadow-2xs cursor-pointer active:scale-95"
                                                    >
                                                        <Smartphone className="w-3 h-3 text-emerald-600" /> WhatsApp
                                                    </button>
                                                </div>
                                            </div>
                                        </EnterpriseCardContent>
                                    </EnterpriseCard>

                                    {/* Documentos Adjuntos */}
                                    <EnterpriseCard>
                                        {/* Header Strip Documentos */}
                                        <EnterpriseCardHeader
                                            title="Documento Adjunto"
                                            icon={<FileText className="w-3.5 h-3.5" />}
                                        />

                                        <EnterpriseCardContent className="p-4 space-y-3">
                                            {selectedLead.document_path ? (
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="bg-white p-2 rounded-md border border-slate-200 text-blue-600 shadow-2xs">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 truncate">
                                                                {selectedLead.document_path.startsWith('cotizacion:') ? 'Propuesta Comercial (CRM).pdf' : 'Documento del Lead.pdf'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 uppercase">
                                                                {selectedLead.document_path.startsWith('cotizacion:') ? 'Cotización CRM' : 'PDF Adjunto'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={handleFileDownload}
                                                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all border border-transparent hover:border-slate-200 cursor-pointer"
                                                            title="Descargar PDF"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleFileDelete}
                                                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                                            title="Eliminar PDF"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative border-2 border-dashed border-slate-200 rounded-lg p-5 transition-all hover:border-blue-400 hover:bg-blue-50/20 group text-center">
                                                    <input
                                                        type="file"
                                                        accept=".pdf"
                                                        onChange={handleFileUpload}
                                                        disabled={isUploading}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                            {isUploading ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin" /> : <UploadCloud className="w-5 h-5 text-slate-500" />}
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-700">Subir Documento PDF</p>
                                                        <p className="text-[10px] text-slate-400">Click o arrastra para adjuntar propuesta, contrato, etc.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </EnterpriseCardContent>
                                    </EnterpriseCard>

                                    {/* Call Bot AI Results (si existen) */}
                                    {selectedLead.call_bot_data && Object.keys(selectedLead.call_bot_data as object).length > 0 && (() => {
                                        const cbd = selectedLead.call_bot_data as Record<string, unknown>;
                                        const calificado = cbd.calificado as boolean | undefined;
                                        const score = cbd.score_calificacion as number | null | undefined;
                                        const dtes = cbd.dtes_por_mes as number | null | undefined;
                                        const tieneSistema = cbd.tiene_sistema_dte as boolean | undefined;
                                        const demoAgendada = cbd.demo_agendada as boolean | undefined;
                                        const notas = cbd.notas_llamada as string | undefined;
                                        return (
                                            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Resultado Call Bot AI
                                                    </h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${calificado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                        {calificado ? 'Calificado' : 'No calificado'}
                                                    </span>
                                                </div>
                                                {score !== null && score !== undefined && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${score}%` }} />
                                                        </div>
                                                        <span className="text-xs font-black text-slate-700">{score}/100</span>
                                                    </div>
                                                )}
                                                {notas && (
                                                    <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed font-medium">
                                                        {notas}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB 2: VENTAS & MÉTODO ARIAS ── */}
                    {activeTab === 'sales' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {/* Hero Card: Arias Sales Excellence */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
                                            <Flame className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-slate-900 tracking-tight">
                                                    Arias Sales Excellence
                                                </h3>
                                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Método Oficial
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">
                                                Metodología oficial de ventas consultivas, guion de 7 preguntas y auditoría inteligente con Gemini AI.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setIsDemoHUDOpen(true)}
                                        className={`p-5 rounded-2xl transition-all text-left group cursor-pointer border shadow-xs flex flex-col justify-between ${ariasAnsweredCount > 0
                                                ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-300'
                                                : 'bg-slate-50 hover:bg-rose-50/40 border-slate-200 hover:border-rose-300'
                                            }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <div className={`w-8 h-8 rounded-xl bg-white border flex items-center justify-center shadow-2xs ${ariasAnsweredCount > 0 ? 'border-emerald-200 text-emerald-600' : 'border-rose-200 text-rose-600'
                                                    }`}>
                                                    <Target className="w-4 h-4" />
                                                </div>
                                                {ariasAnsweredCount > 0 && (
                                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        {ariasAnsweredCount}/7 Completado
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 group-hover:text-rose-700 transition-colors mb-1">
                                                Guion Demo HUD
                                            </h4>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                {ariasAnsweredCount > 0
                                                    ? `El prospecto ya respondió ${ariasAnsweredCount} de las 7 preguntas obligatorias. Haz clic para revisar o editar en el copiloto.`
                                                    : 'Abre el copiloto en vivo con las 7 preguntas obligatorias de dolor, decisor y objeciones de prueba.'}
                                            </p>
                                        </div>
                                        <div className={`pt-4 flex items-center gap-1.5 text-xs font-bold ${ariasAnsweredCount > 0 ? 'text-emerald-700' : 'text-rose-600'
                                            }`}>
                                            <span>{ariasAnsweredCount > 0 ? `Ver Respuestas (${ariasAnsweredCount}/7) en Guion` : 'Iniciar Guion en Vivo'}</span>
                                            <span>➔</span>
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setIsGeminiAuditOpen(true)}
                                        className={`p-5 rounded-2xl transition-all text-left group cursor-pointer border shadow-xs flex flex-col justify-between ${leadAudit
                                                ? 'bg-indigo-50/60 hover:bg-indigo-50 border-indigo-300'
                                                : 'bg-slate-50 hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-300'
                                            }`}
                                    >
                                        <div>
                                            <div className="w-8 h-8 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors mb-1">
                                                Auditar Demo con Gemini
                                            </h4>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                {leadAudit ? 'Revisar rúbrica de 100 puntos y plan de coaching 1:1 generado.' : 'Pega las notas de Google Meet para auditar automáticamente contra la rúbrica oficial.'}
                                            </p>
                                        </div>
                                        <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                                            <span>{leadAudit ? 'Ver Resultados de Auditoría' : 'Auditar Ahora (100 Pts)'}</span>
                                            <span>➔</span>
                                        </div>
                                    </div>
                                </div>

                                {ariasAnsweredCount > 0 && (
                                    <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/90 space-y-3">
                                        <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span className="text-xs font-black text-slate-900">
                                                    Diagnóstico Completado ({ariasAnsweredCount} de 7 preguntas obligatorias)
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsDemoHUDOpen(true)}
                                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition cursor-pointer"
                                            >
                                                Abrir en Guion ➔
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                            {[
                                                { k: 'q1', label: '1. Diagnóstico / Dolor' },
                                                { k: 'q2', label: '2. Impacto / Situación actual' },
                                                { k: 'q3', label: '3. Sistema o método actual' },
                                                { k: 'q4', label: '4. Quién aprueba la compra' },
                                                { k: 'q5', label: '5. Plazo de implementación' },
                                                { k: 'q6', label: '6. Alcance / Usuarios' },
                                                { k: 'q7', label: '7. Siguiente paso preferido' },
                                            ].map((item) => {
                                                const val = ariasDiscoveryAnswers[item.k];
                                                if (!val) return null;
                                                return (
                                                    <div key={item.k} className="p-2.5 rounded-xl bg-white border border-emerald-100/90">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                            {item.label}
                                                        </p>
                                                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                                                            {val}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Banner de Auditoría */}
                                {leadAudit ? (
                                    <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                                                {leadAudit.total_score}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-900">
                                                        Auditoría Oficial: {leadAudit.total_score}/100 pts
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${leadAudit.total_score >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            leadAudit.total_score >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}>
                                                        {leadAudit.total_score >= 85 ? 'Sólido' : leadAudit.total_score >= 70 ? 'Coaching' : 'Intervención'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500">
                                                    {leadAudit.google_doc_url ? 'Google Doc Vinculado' : 'Notas registradas en CRM'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsGeminiAuditOpen(true)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                                        >
                                            Revisar Rúbrica
                                        </button>
                                    </div>
                                ) : (
                                    <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                                        <span className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            Pega el enlace de Google Docs o el resumen de Gemini Meet
                                        </span>
                                        <span className="text-emerald-700 font-bold">100% Automático</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── TAB 3: COTIZACIONES & CONTRATOS ── */}
                    {activeTab === 'quotes' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {/* Section 1: Cotizaciones & Propuestas */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                                <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                                            Cotizaciones & Propuestas ({leadCotizaciones.length})
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/cotizaciones/nueva-pro', { state: { lead: selectedLead } });
                                        }}
                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs border border-blue-200"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Nueva Cotización
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">

                                    {leadCotizaciones.length > 0 ? (
                                        <div className="space-y-2.5">
                                            {leadCotizaciones.map((cot) => {
                                                const total = cot.total_anual || cot.total_mensual || 0;
                                                return (
                                                    <div
                                                        key={cot.id}
                                                        className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-emerald-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                                    >
                                                        <div className="space-y-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-100">
                                                                    COT-{cot.id.slice(0, 6).toUpperCase()}
                                                                </span>
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cot.estado === 'aceptada'
                                                                        ? 'bg-emerald-100 text-emerald-800'
                                                                        : cot.estado === 'enviada'
                                                                            ? 'bg-blue-100 text-blue-800'
                                                                            : 'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                    {cot.estado === 'aceptada' ? 'Aceptada' : cot.estado === 'enviada' ? 'Enviada' : 'Borrador'}
                                                                </span>
                                                                {cot.volumen_dtes ? (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                        {cot.volumen_dtes.toLocaleString()} DTs
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-800 truncate">{cot.plan_nombre || 'Propuesta Comercial'}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                Monto: <strong className="text-emerald-700">${total.toLocaleString()} USD</strong>
                                                                {cot.created_at && ` • ${format(new Date(cot.created_at), 'dd MMM yyyy', { locale: es })}`}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <a
                                                                href={`/cotizaciones/${cot.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <ExternalLink className="w-3 h-3" /> Ver
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectQuoteForContract(cot)}
                                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                                                title="Formalizar esta cotización en un contrato oficial"
                                                            >
                                                                <ShieldCheck className="w-3.5 h-3.5" /> Crear Contrato
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                                            <p className="text-xs text-slate-500 font-medium">Este prospecto aún no tiene cotizaciones generadas.</p>
                                            <button
                                                type="button"
                                                onClick={() => navigate('/cotizaciones/nueva-pro', { state: { lead: selectedLead } })}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Cotizar con Cotizador Pro
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 2: Contratos de Servicios */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                                <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                                            Contratos de Servicios ({leadContracts.length})
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleInitiateContractCreation}
                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-blue-200 shadow-2xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Nuevo Contrato
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">

                                    {leadContracts.length > 0 ? (
                                        <div className="space-y-3">
                                            {leadContracts.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-indigo-200 transition-all space-y-2.5 shadow-2xs"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs">
                                                                    {c.contract_number}
                                                                </span>
                                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${c.status === 'firmado'
                                                                        ? 'bg-emerald-100 text-emerald-800'
                                                                        : c.status === 'enviado'
                                                                            ? 'bg-blue-100 text-blue-800'
                                                                            : 'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                    {c.status === 'firmado' ? 'Firmado' : c.status === 'enviado' ? 'Enviado' : 'Borrador'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">{c.title}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                Monto: ${c.monto_total?.toLocaleString()} USD • {c.vigencia_meses} meses
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                                                        <a
                                                            href={`/contrato/${c.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-[11px]"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> Ver Enlace
                                                        </a>

                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setContractForShare(c);
                                                                    setIsContractShareOpen(true);
                                                                }}
                                                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Compartir enlace / WhatsApp"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        await contractPdfService.downloadContractPDF(c);
                                                                        toast.success('PDF descargado');
                                                                    } catch {
                                                                        toast.error('Error al generar PDF');
                                                                    }
                                                                }}
                                                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                                                title="Descargar PDF"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedContractForEdit(c);
                                                                    setIsContractEditorOpen(true);
                                                                }}
                                                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px] border border-slate-200 shadow-2xs cursor-pointer"
                                                            >
                                                                Editar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <p className="text-xs text-slate-500">No hay contratos generados para este prospecto.</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedContractForEdit(null);
                                                    setIsContractEditorOpen(true);
                                                }}
                                                className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                                            >
                                                + Crear Contrato de Servicios
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB 4: TRAZABILIDAD & ACTIVIDAD ── */}
                    {activeTab === 'activity' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            {/* ── Conversación del lead en el WhatsApp de Soporte (si existe) ── */}
                            <LeadWhatsappThread leadId={lead.id} navigate={navigate} />

                            {/* ── TARJETA DESTACADA: NEXT TRIGGER (PRÓXIMA REUNIÓN / PRÓXIMO SEGUIMIENTO) ── */}
                            <div className={`rounded-xl p-4 border shadow-2xs space-y-2.5 ${nextTrigger.statusType === 'upcoming'
                                    ? 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 border-emerald-300'
                                    : nextTrigger.statusType === 'today'
                                        ? 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60 border-amber-300'
                                        : nextTrigger.statusType === 'overdue'
                                            ? 'bg-gradient-to-br from-rose-50/90 via-white to-amber-50/40 border-rose-300'
                                            : 'bg-white border-slate-200'
                                }`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${nextTrigger.statusType === 'upcoming'
                                                ? 'bg-emerald-600 text-white'
                                                : nextTrigger.statusType === 'today'
                                                    ? 'bg-amber-500 text-slate-950'
                                                    : nextTrigger.statusType === 'overdue'
                                                        ? 'bg-rose-600 text-white'
                                                        : 'bg-slate-200 text-slate-700'
                                            }`}>
                                            <Calendar className="w-3 h-3" />
                                            <span>⚡ NEXT TRIGGER · {nextTrigger.statusBadge}</span>
                                        </span>
                                        {nextTrigger.relativeLabel && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${nextTrigger.statusType === 'upcoming'
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    : nextTrigger.statusType === 'today'
                                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                        : 'bg-rose-100 text-rose-800 border-rose-200'
                                                }`}>
                                                {nextTrigger.relativeLabel}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {nextTrigger.meetUrl && (
                                            <a
                                                href={nextTrigger.meetUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                <span>Abrir Reunión Meet</span>
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setIsCallLoggerOpen(true)}
                                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                        >
                                            <Calendar className="w-3 h-3" />
                                            <span>{nextTrigger.hasTrigger ? 'Reprogramar / Agendar' : '+ Agendar Próxima Reunión'}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                    <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200/80 space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                            Cuándo es el Próximo Seguimiento / Reunión
                                        </span>
                                        <strong className="text-xs sm:text-sm font-black text-slate-900 block capitalize">
                                            📅 {nextTrigger.formattedDate}
                                            {nextTrigger.formattedTime ? ` · ⏰ ${nextTrigger.formattedTime}` : ''}
                                        </strong>
                                        <span className="text-[11px] font-bold text-indigo-700 block">
                                            {nextTrigger.actionLabel}
                                            {nextTrigger.assigneeName ? ` · 👤 ${nextTrigger.assigneeName}` : ''}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200/80 space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                            Objetivo / Acuerdo para el Próximo Contacto
                                        </span>
                                        <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                                            {nextTrigger.notes}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Filter Chips & Counter Header */}
                            <div className="bg-white rounded-lg p-3.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                            Línea de Tiempo ({followUps.length + messages.length + callActivities.length})
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsCallLoggerOpen(true)}
                                        className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Nuevo</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setTimelineFilter('all')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${timelineFilter === 'all'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimelineFilter('calls')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${timelineFilter === 'calls'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Llamadas ({callActivities.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimelineFilter('messages')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${timelineFilter === 'messages'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Mensajes ({messages.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimelineFilter('followups')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${timelineFilter === 'followups'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Seguimientos ({followUps.length})
                                    </button>
                                </div>
                            </div>

                            {/* Timeline Stream */}
                            {(() => {
                                const allItems = [
                                    ...followUps.map(f => ({ ...f, _type: 'follow_up' as const })),
                                    ...messages.map(m => ({ ...m, _type: 'message' as const, date: m.created_at })),
                                    ...callActivities.map(a => ({ ...a, _type: 'call_activity' as const })),
                                ].sort((a: any, b: any) => {
                                    const getDate = (x: any) => x._type === 'call_activity'
                                        ? new Date(x.call_date || x.created_at)
                                        : new Date(x.created_at || x.date);
                                    return getDate(b).getTime() - getDate(a).getTime();
                                });

                                const filteredItems = allItems.filter(item => {
                                    if (timelineFilter === 'calls') return item._type === 'call_activity';
                                    if (timelineFilter === 'messages') return item._type === 'message';
                                    if (timelineFilter === 'followups') return item._type === 'follow_up';
                                    return true;
                                });

                                if (filteredItems.length === 0) {
                                    return (
                                        <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                                            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Sin actividad registrada en este filtro
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="relative pl-7 space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                        {filteredItems.map((item: any) => {
                                            const isActivity = item._type === 'call_activity';
                                            const isMessage = item._type === 'message';
                                            const isFollowUp = item._type === 'follow_up';

                                            const actCfg = isActivity ? ACTION_TYPE_CONFIG[item.action_type as keyof typeof ACTION_TYPE_CONFIG] : null;
                                            const outCfg = isActivity ? CALL_OUTCOME_CONFIG[item.outcome as keyof typeof CALL_OUTCOME_CONFIG] : null;
                                            const followUpAction = isFollowUp ? ACTION_TYPES.find(t => t.value === item.action_type) : null;

                                            const channelCfg: Record<string, { label: string; color: string; bg: string }> = {
                                                whatsapp: { label: 'WhatsApp', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                                                telegram: { label: 'Telegram', color: 'text-sky-700', bg: 'bg-sky-50' },
                                                email: { label: 'Email', color: 'text-amber-700', bg: 'bg-amber-50' },
                                            };
                                            const msgCh = isMessage ? (channelCfg[item.channel] || { label: item.channel, color: 'text-slate-700', bg: 'bg-slate-50' }) : null;

                                            const dotBg = isActivity ? 'bg-blue-600' : isMessage ? 'bg-emerald-600' : 'bg-indigo-600';

                                            const itemDate = (() => {
                                                try {
                                                    if (isActivity) return format(new Date(item.call_date || item.created_at), 'dd MMM, HH:mm', { locale: es });
                                                    if (isMessage) return format(new Date(item.created_at), 'dd MMM, HH:mm', { locale: es });
                                                    if (!item.date) return 'Sin fecha';
                                                    const rawD = String(item.date);
                                                    const hasTime = rawD.includes('T') && !rawD.endsWith('T00:00:00') && !rawD.endsWith('T12:00:00');
                                                    const dt = new Date(rawD.includes('T') ? rawD : `${rawD}T12:00:00`);
                                                    return hasTime
                                                        ? `Agendado: ${format(dt, 'dd MMM yyyy · hh:mm a', { locale: es })}`
                                                        : `Agendado: ${format(dt, 'dd MMM, yyyy', { locale: es })}`;
                                                } catch { return 'Sin fecha'; }
                                            })();

                                            const noteText = isActivity ? item.notes :
                                                isMessage ? (item.channel === 'email' && item.metadata?.campaign_id ? 'Email de campaña enviado' : item.content) :
                                                    item.notes;

                                            const assignee = isFollowUp
                                                ? (item.assigned_profile?.full_name || (typeof item.assigned_profile?.email === 'string' ? item.assigned_profile.email.split('@')[0] : null) || item.profiles?.full_name || (typeof item.profiles?.email === 'string' ? item.profiles.email.split('@')[0] : null) || null)
                                                : null;

                                            return (
                                                <div key={`${item._type}-${item.id}`} className="relative group">
                                                    {/* Timeline dot */}
                                                    <div className={`absolute -left-[28px] top-2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs z-10 ${dotBg}`} />

                                                    <div className={`bg-white rounded-xl p-4 border shadow-2xs hover:shadow-xs transition-all space-y-2 ${isFollowUp ? 'border-indigo-200/90 bg-indigo-50/15' : 'border-slate-200/80'}`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isFollowUp
                                                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                                                        : 'bg-slate-100 text-slate-700'
                                                                    }`}>
                                                                    {isActivity
                                                                        ? (actCfg?.label || item.action_type)
                                                                        : isMessage
                                                                            ? `${msgCh?.label} · ${item.direction === 'inbound' ? 'Recibido' : 'Enviado'}`
                                                                            : `📅 Seguimiento Agendado · ${followUpAction?.label || 'Llamada'}`}
                                                                </span>
                                                                {outCfg && (
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${outCfg.bgColor} ${outCfg.color}`}>
                                                                        {outCfg.label}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className={`text-[10px] font-bold ${isFollowUp ? 'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100' : 'text-slate-400'}`}>
                                                                {itemDate}
                                                            </span>
                                                        </div>

                                                        {noteText && (
                                                            <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                                                                {noteText}
                                                            </p>
                                                        )}

                                                        {(assignee || (isActivity && item.duration_seconds > 0)) && (
                                                            <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                                                {isActivity && item.duration_seconds > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" /> {Math.round(item.duration_seconds / 60)} min
                                                                    </span>
                                                                )}
                                                                {assignee && (
                                                                    <span className="flex items-center gap-1">
                                                                        <User className="w-3 h-3" /> <span className="text-indigo-600 font-bold">{assignee}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* ── BARRA FIJA INFERIOR DE ACCIÓN (ZONA DEL PULGAR - CRÍTICO EN MÓVIL) ── */}
                <div className="bg-white border-t border-slate-200/90 px-2.5 sm:px-6 py-2 sm:py-2.5 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] relative z-30 shrink-0 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                        {selectedLead.phone && (
                            <a
                                href={`tel:${selectedLead.phone}`}
                                className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 border border-slate-200 shadow-2xs"
                                title="Llamar por teléfono"
                            >
                                <Phone className="w-4 h-4 text-slate-700" />
                                <span className="hidden sm:inline">Llamar</span>
                            </a>
                        )}
                        {selectedLead.phone && (
                            <button
                                type="button"
                                onClick={() => {
                                    const link = getWhatsAppLink(selectedLead.phone || '');
                                    if (link) window.open(link, '_blank');
                                }}
                                className="h-10 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 border border-emerald-200 shadow-2xs cursor-pointer"
                                title="Abrir WhatsApp"
                            >
                                <Smartphone className="w-4 h-4 text-emerald-600" />
                                <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsMeetSchedulerOpen(true)}
                            className="h-10 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 border border-violet-200 shadow-2xs cursor-pointer"
                            title="Agendar Demo / Reunión en Google Meet"
                        >
                            <Video className="w-4 h-4 text-violet-600" />
                            <span className="hidden sm:inline">Google Meet</span>
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsCallLoggerOpen(true)}
                        className="flex-1 h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Registrar Seguimiento</span>
                    </button>
                </div>
            </div>

            {/* ── MODAL / BOTTOM SHEET: REGISTRADOR RÁPIDO DE ACCIONES & SEGUIMIENTO ── */}
            {isCallLoggerOpen && (
                <div className="fixed inset-0 z-[10000] flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in p-0 sm:p-4 sm:items-center sm:justify-center">
                    <div
                        className="fixed inset-0 bg-transparent"
                        onClick={() => {
                            setIsCallLoggerOpen(false);
                            setCallStartedAt(null);
                        }}
                    />
                    <div className="relative max-w-lg w-full z-10 animate-in slide-in-from-bottom-5 duration-200">
                        <SectionErrorBoundary fallbackTitle="Error al mostrar el registrador de acciones">
                            <QuickActionLogger
                                lead={selectedLead}
                                companyId={localStorage.getItem('simulated_company_id') || profile?.company_id || ''}
                                teamMembers={Array.isArray(teamMembers) ? teamMembers : []}
                                callStartedAt={callStartedAt ?? undefined}
                                onCallLogged={async (statusChanged, newStatus) => {
                                    if (statusChanged && newStatus) {
                                        await handleUpdateLead({ status: newStatus });
                                    }
                                    loadDetails();
                                }}
                                onClose={() => {
                                    setIsCallLoggerOpen(false);
                                    setCallStartedAt(null);
                                }}
                            />
                        </SectionErrorBoundary>
                    </div>
                </div>
            )}

            {/* WhatsApp QR Modal overlay */}
            {isQrModalOpen && selectedLead.phone && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
                        onClick={() => setIsQrModalOpen(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-100 border border-slate-100 flex flex-col items-center p-6 text-center animate-in fade-in zoom-in-95 duration-200 z-[10001]">
                        {/* Close button */}
                        <button
                            onClick={() => setIsQrModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Header / Icon */}
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 mt-2">
                            <QrCode className="w-6 h-6 text-emerald-600" />
                        </div>

                        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-1">
                            WhatsApp Express QR
                        </h3>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                            {selectedLead.name}
                        </p>

                        {/* Pre-filled message input */}
                        <div className="w-full text-left mb-4 px-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                Mensaje Inicial (Opcional)
                            </label>
                            <textarea
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                placeholder="Escribe el mensaje que se enviará automáticamente..."
                                rows={2}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none resize-none placeholder-slate-400 font-medium"
                            />
                        </div>

                        {/* QR Code Wrapper */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 mb-4 shadow-inner relative">
                            <div className="bg-white p-3 rounded-xl shadow-sm">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getWhatsAppLink(selectedLead.phone || ''))}`}
                                    alt="WhatsApp QR Code"
                                    className="w-48 h-48 block rounded-lg select-none pointer-events-none"
                                />
                            </div>
                        </div>

                        <p className="text-[13px] text-slate-500 leading-relaxed px-4 mb-6">
                            Escanea este código QR con la cámara de tu teléfono para iniciar un chat en WhatsApp con <span className="font-extrabold text-slate-800">{selectedLead.phone}</span> sin guardarlo en tus contactos.
                        </p>

                        {/* Actions */}
                        <div className="w-full space-y-2">
                            <a
                                href={getWhatsAppLink(selectedLead.phone || '')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#20ba56] text-white rounded-xl font-black text-[12px] uppercase tracking-widest shadow-md transition-all active:scale-[0.98] border border-[#22c760]"
                            >
                                <Smartphone className="w-4 h-4" /> Abrir Chat Directo
                            </a>

                            <button
                                onClick={() => copyToClipboard(getWhatsAppLink(selectedLead.phone || ''))}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-655 rounded-xl font-bold text-[12px] transition-all border border-slate-200"
                            >
                                <Copy className="w-4 h-4" /> Copiar Enlace wa.me
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ManageProductsModal
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                onProductsChanged={loadProducts}
            />
            <ManageLeadSourcesModal
                isOpen={isManageSourcesOpen}
                onClose={() => setIsManageSourcesOpen(false)}
                onSourcesChanged={reloadSources}
            />
            <ManageIndustriesModal
                isOpen={isManageIndustriesOpen}
                onClose={() => setIsManageIndustriesOpen(false)}
                onIndustriesChanged={onIndustriesChanged}
            />

            {/* Modal de Advertencia: No hay cotizaciones para el contrato */}
            {isNoQuoteWarningOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-base font-black text-slate-900">Cotización Previa Requerida</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Siguiendo el flujo comercial de la empresa, todo contrato debe derivar de una cotización oficial para garantizar la consistencia de precios, paquetes de DTs y condiciones aprobadas.
                            </p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center gap-2.5">
                            <span className="text-lg">💡</span>
                            <span>Genera primero la cotización formal con el Cotizador Pro para este prospecto.</span>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsNoQuoteWarningOpen(false)}
                                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Entendido
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNoQuoteWarningOpen(false);
                                    navigate('/cotizaciones/nueva-pro', { state: { lead: selectedLead } });
                                }}
                                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Crear Cotización
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Selector de Cotización Base para Contrato */}
            {isQuotePickerOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900">Seleccionar Cotización Base</h3>
                                <p className="text-xs text-slate-500">¿Sobre cuál propuesta deseas generar el contrato?</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsQuotePickerOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                            {leadCotizaciones.map((cot) => {
                                const total = cot.total_anual || cot.total_mensual || 0;
                                return (
                                    <div
                                        key={cot.id}
                                        onClick={() => handleSelectQuoteForContract(cot)}
                                        className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all cursor-pointer group flex items-center justify-between gap-3"
                                    >
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">
                                                    COT-{cot.id.slice(0, 6).toUpperCase()}
                                                </span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cot.estado === 'aceptada'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : cot.estado === 'enviada'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {cot.estado}
                                                </span>
                                            </div>
                                            <p className="text-xs font-black text-slate-800 group-hover:text-indigo-900 truncate">
                                                {cot.plan_nombre || 'Servicios Profesionales'}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                Monto: <strong className="text-emerald-700">${total.toLocaleString()} USD</strong>
                                                {cot.volumen_dtes ? ` • ${cot.volumen_dtes.toLocaleString()} DTs` : ''}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectQuoteForContract(cot);
                                            }}
                                            className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-xs"
                                        >
                                            Seleccionar ➔
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsQuotePickerOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contract Modals */}
            {isContractEditorOpen && (
                <ContractEditorModal
                    isOpen={isContractEditorOpen}
                    onClose={() => {
                        setIsContractEditorOpen(false);
                        setSelectedContractForEdit(null);
                        setSelectedCotizacionForContract(null);
                    }}
                    existingContract={selectedContractForEdit}
                    cotizacion={selectedCotizacionForContract}
                    lead={selectedLead}
                    company={companyInfo || { id: selectedLead.company_id, name: 'Mi Empresa' }}
                    creatorName={profile?.full_name}
                    onSaved={(saved) => {
                        setLeadContracts(prev => {
                            const exists = prev.some(c => c.id === saved.id);
                            if (exists) return prev.map(c => c.id === saved.id ? saved : c);
                            return [saved, ...prev];
                        });
                    }}
                />
            )}

            {contractForShare && isContractShareOpen && (
                <ContractShareModal
                    contract={contractForShare}
                    isOpen={isContractShareOpen}
                    onClose={() => {
                        setIsContractShareOpen(false);
                        setContractForShare(null);
                    }}
                />
            )}

            {/* Live Demo HUD Modal */}
            <LiveDemoHUDModal
                isOpen={isDemoHUDOpen}
                onClose={() => setIsDemoHUDOpen(false)}
                leadName={selectedLead.name}
                leadCompany={selectedLead.company_name}
                initialAnswers={ariasDiscoveryAnswers}
                onApplyFindings={async (notes) => {
                    const currentNotes = selectedLead.next_action_notes ? `${selectedLead.next_action_notes}\n\n` : '';
                    await handleUpdateLead({ next_action_notes: `${currentNotes}${notes}` });
                    await supabase.from('follow_ups').insert({
                        lead_id: selectedLead.id,
                        date: new Date().toISOString().split('T')[0],
                        notes,
                        action_type: 'call',
                        completed: true,
                    });
                    loadDetails();
                }}
            />

            {/* Google Meet Scheduler Modal directly from Lead/Client */}
            {isMeetSchedulerOpen && (
                <GoogleMeetScheduler
                    onClose={() => {
                        setIsMeetSchedulerOpen(false);
                        loadDetails();
                    }}
                    initialLeadId={selectedLead.id}
                    initialLeadName={selectedLead.company_name || selectedLead.name}
                    initialLeadEmail={selectedLead.email || null}
                />
            )}

            {/* Gemini Audit Modal */}
            <GeminiAuditModal
                isOpen={isGeminiAuditOpen}
                onClose={() => setIsGeminiAuditOpen(false)}
                lead={selectedLead}
                profile={profile}
                onLeadUpdated={handleUpdateLead}
            />
        </div>
    );
};