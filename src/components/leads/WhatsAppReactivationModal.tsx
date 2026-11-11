import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Sparkles,
  Users,
  Play,
  Square,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Loader2,
  Search,
  CheckSquare,
  Square as SquareIcon,
  Video,
  FileText,
  Upload,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { leadsService } from '../../services/leads';
import type { Lead } from '../../types';

export interface ReactivationTouchInfo {
  touch: number;
  sentAt: string;
  hoursSinceSent: number;
  isReactivation?: boolean;
  replied?: boolean;
}

interface WhatsAppReactivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadsPool: Lead[];
  preSelectedLeadIds?: string[];
  initialInactivityFilter?: 'all' | 'never' | '15d' | '30d' | '60d' | '90d';
  mode?: 'initial' | 'resend';
  touchInfoByLeadId?: Record<string, ReactivationTouchInfo>;
  alreadyInCampaignLeadIds?: string[];
  companyId: string;
  currentUser: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  };
  defaultCampaignName?: string;
  onCompleted?: () => void;
  onGoToWhatsAppChat?: () => void;
}

interface ReactivationTemplate {
  id: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  tag: string;
  body: string;
  forResend?: boolean;
}

const DEFAULT_TEMPLATES: ReactivationTemplate[] = [
  {
    id: 'consultivo_corto',
    label: '1. Pregunta corta consultiva (Toque 1)',
    shortLabel: 'Pregunta consultiva',
    subtitle: 'Ideal para prospectos que pidieron información y nunca respondieron',
    tag: 'Recomendada · Toque 1',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Hace un tiempo nos solicitó información sobre nuestros servicios; ¿todavía están evaluando opciones en {empresa} o ya lo resolvieron por ahora?',
  },
  {
    id: 'toque2_flyer_video',
    label: 'Toque 2 · Valor Visual (Con Flyer o Video)',
    shortLabel: 'Valor Visual (Flyer/Video)',
    subtitle: 'Ideal para los que no respondieron al Toque 1 · Acompáñalo de un Flyer o Video corto',
    tag: 'Toque 2 · Flyer / Video',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Sé que a veces los mensajes se pasan por la operación del día; le comparto un resumen visual de cómo ayudamos a empresas como {empresa} con Facturación Electrónica y control administrativo. ¿Le gustaría que le envíe una cotización o agendamos 10 minutos?',
    forResend: true,
  },
  {
    id: 'toque2_seguimiento_breve',
    label: 'Toque 2 · Seguimiento breve (+48h)',
    shortLabel: 'Seguimiento breve',
    subtitle: 'Recordatorio corto y directo para quienes dejaron en visto el primer mensaje',
    tag: 'Toque 2 · Texto corto',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Le escribo brevemente para dar seguimiento a mi mensaje anterior; ¿pudieron evaluar el sistema en {empresa} o prefiere que le comparta primero los planes y precios por este medio?',
    forResend: true,
  },
  {
    id: 'seguimiento_propuesta',
    label: '2. Seguimiento de propuesta o cotización',
    shortLabel: 'Seguimiento propuesta',
    subtitle: 'Para prospectos calificados o en seguimiento que dejaron de contestar',
    tag: 'Seguimiento comercial',
    body: 'Hola {nombre}, le escribe Jimmy Arias de Arias Defense. Quería consultarle brevemente si tuvo oportunidad de revisar la información que conversamos o si le gustaría que ajustemos una propuesta a su necesidad actual.',
  },
  {
    id: 'nutricion_valor',
    label: 'En Nutrición · Seguimiento de valor',
    shortLabel: 'En Nutrición',
    subtitle: 'Para prospectos que pidieron retomar más adelante (próximo mes o próximo año)',
    tag: 'Nutrición',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Recordando que más adelante retomarán el proyecto en {empresa}, le comparto brevemente esta actualización para que la tengan a mano cuando inicien. Quedo atento a cualquier consulta.',
    forResend: true,
  },
  {
    id: 'clientes_upsell',
    label: 'Clientes · Nuevos Servicios / Módulos',
    shortLabel: 'Clientes (Nuevos servicios)',
    subtitle: 'Para ofrecer nuevos módulos, actualizaciones o servicios adicionales a clientes actuales',
    tag: 'Upsell Clientes',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Qué gusto saludarle y gracias por su confianza. Queríamos compartirle una novedad de nuevos módulos y servicios disponibles para {empresa}. ¿Le gustaría que le comente los beneficios para clientes actuales?',
    forResend: true,
  },
  {
    id: 'toque3_cierre_amable',
    label: 'Toque 3 · Cierre amable (Último toque)',
    shortLabel: 'Cierre amable',
    subtitle: 'Aplica psicología inversa para recuperar respuesta antes de pausar el seguimiento',
    tag: 'Toque 3 · Cierre',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Para no saturar su WhatsApp dejamos en pausa su solicitud por ahora; si más adelante retoman el proyecto en {empresa}, por aquí queda mi contacto directo. ¡Muchos éxitos!',
    forResend: true,
  },
  {
    id: 'beneficio_implementacion',
    label: '4. Beneficio especial de reactivación',
    shortLabel: 'Beneficio especial',
    subtitle: 'Para retomar negociaciones detenidas con una condición especial',
    tag: 'Promoción',
    body: 'Hola {nombre}, le saluda Jimmy Arias de Arias Defense. Esta semana habilitamos condiciones especiales para proyectos pendientes y pensé en comentarle por si aún lo tienen en planes. ¿Le gustaría que lo revisemos?',
  },
];

function normalizeWhatsAppPhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8 && /^[267]/.test(digits)) {
    return `503${digits}`;
  }
  return digits.length >= 8 ? digits : '';
}

function isBusinessStyleName(raw?: string | null): boolean {
  const clean = String(raw || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean) return true;
  if (/^(sin\s+nombre|contacto|cliente|prospecto|lead|soporte|admin|usuario|desconocido|\+?\d+)/i.test(clean)) {
    return true;
  }
  return /\b(inversiones|lotificaci[oó]n|lotificadora|comedor|constructora|corporaci[oó]n|corp\b|grupo|residencial|tienda|ferreter[ií]a|cl[ií]nica|hotel|restaurante|autolote|auto\s+lote|taller|farmacia|supermercado|distribuidora|importadora|servicios|soluciones|agencia|asociaci[oó]n|fundaci[oó]n|iglesia|colegio|escuela|academia|laboratorio|panader[ií]a|pasteler[ií]a|est[eé]tica|sal[oó]n|barber[ií]a|gym|gimnasio|transporte|transportes|log[ií]stica|inmobiliaria|bienes\s+ra[ií]ces|desarrollos|urbanica|bosque|villas|finca|hacienda|agro|veterinaria|[oó]ptica|dental|odontolog[ií]a|abogados|bufete|contadores|despacho|consultor[ií]a|ingenier[ií]a|arquitectura|proyectos|multitienda|variedades|bazar|librer[ií]a|papeler[ií]a|imprenta|sublimaci[oó]n|publicidad|marketing|tecnolog[ií]a|sistemas|repuestos|lubricantes|llantas|motos|lavander[ií]a|florister[ií]a|eventos|banquetes|catering|seguridad|vigilancia|mantenimiento|refrigeraci[oó]n|el[eé]ctrica|plomer[ií]a|vidrier[ií]a|estructuras|carpinter[ií]a|muebler[ií]a|muebles|textiles|confecciones|bordados|serigraf[ií]a|pl[aá]sticos|empaques|reciclaje|gasolinera|cooperativa|financiera|seguros|corredora|aduana|aduanal|naviera|carga|courier|encomiendas|turismo|viajes|tours|alquiler|bodega|bodegas|almac[eé]n|mayorista|av[ií]cola|granero|granja|beneficio|caf[eé]|cafeter[ií]a|pizzer[ií]a|taquer[ií]a|pupuser[ií]a|asados|mariscos|cevicher[ií]a|spa\b|plaza\b|mercado|sucursal|boutique|s\.a\.|de\s+c\.v\.)\b/i.test(
    clean
  );
}

function extractFirstName(fullName?: string | null): string {
  const clean = String(fullName || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean || isBusinessStyleName(clean)) return '';
  if (/[_@]/.test(clean)) return '';
  // Strip professional/courtesy prefixes so we never greet "Hola Lic," or "Hola Ing,"
  const withoutTitle = clean
    .replace(/^(lic(da|do)?|ing|arq|dr|dra|sr|sra|srta|don|doña|prof|abog|pastor|cnel|gral)\.?\s+/i, '')
    .trim();
  if (!withoutTitle) return '';
  const tokens = withoutTitle.split(/[\s,.-]+/).filter(Boolean);
  const first = tokens[0] || '';
  if (first.length < 2 || /\d/.test(first)) return '';
  // If single concatenated token (e.g. "marinaescobar" or "diegochicas"), skip personal name to avoid robotic greeting
  if (tokens.length === 1 && first.length > 10) return '';
  // Normalize ALL-CAPS or all-lowercase to Title Case ("MARIA" -> "Maria", "juan" -> "Juan")
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function getDaysInactive(lead: Lead): { days: number; neverContacted: boolean; label: string } {
  const cCount = Number(lead.contact_count || 0);
  const lastTouch = lead.last_follow_up_at || lead.created_at;
  const days = lastTouch
    ? Math.max(0, Math.floor((Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const neverContacted = cCount === 0 && !lead.last_follow_up_at;
  if (neverContacted) {
    return { days, neverContacted: true, label: `Sin contacto (${days}d)` };
  }
  return { days, neverContacted: false, label: `Hace ${days}d` };
}

export const WhatsAppReactivationModal: React.FC<WhatsAppReactivationModalProps> = ({
  isOpen,
  onClose,
  leadsPool,
  preSelectedLeadIds = [],
  initialInactivityFilter = 'all',
  mode = 'initial',
  touchInfoByLeadId = {},
  alreadyInCampaignLeadIds = [],
  companyId,
  currentUser,
  defaultCampaignName = 'Reactivación WhatsApp',
  onCompleted,
  onGoToWhatsAppChat,
}) => {
  const isResendMode = mode === 'resend';
  const initialTemplate = isResendMode
    ? DEFAULT_TEMPLATES.find((t) => t.id === 'toque2_flyer_video') || DEFAULT_TEMPLATES[0]
    : DEFAULT_TEMPLATES.find((t) => t.id === 'consultivo_corto') || DEFAULT_TEMPLATES[0];

  const [inactivityFilter, setInactivityFilter] = useState<'all' | 'never' | '15d' | '30d' | '60d' | '90d'>(
    initialInactivityFilter
  );
  const [resendTimingFilter, setResendTimingFilter] = useState<'ready48' | 'ready72' | 'under48' | 'all'>('ready48');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [batchLimit, setBatchLimit] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideAlreadyInCampaign, setHideAlreadyInCampaign] = useState<boolean>(true);
  const alreadyInCampaignSet = useMemo(() => new Set(alreadyInCampaignLeadIds), [alreadyInCampaignLeadIds]);

  const [campaignName, setCampaignName] = useState(
    isResendMode ? 'Reactivación · Toque 2' : defaultCampaignName
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplate.id);
  const [messageTemplate, setMessageTemplate] = useState<string>(initialTemplate.body);
  const [delaySeconds, setDelaySeconds] = useState<number>(10);

  // Media attachment state (Flyer Image, Video MP4, or PDF)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set());
  const [currentLeadName, setCurrentLeadName] = useState<string>('');
  const abortRef = useRef(false);

  useEffect(() => {
    setInactivityFilter(initialInactivityFilter);
  }, [initialInactivityFilter]);

  useEffect(() => {
    if (!isOpen) return;
    if (isResendMode) {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === 'toque2_flyer_video') || DEFAULT_TEMPLATES[0];
      setSelectedTemplateId(tpl.id);
      setMessageTemplate(tpl.body);
      setCampaignName('Reactivación · Toque 2');
    } else {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === 'consultivo_corto') || DEFAULT_TEMPLATES[0];
      setSelectedTemplateId(tpl.id);
      setMessageTemplate(tpl.body);
      setCampaignName(defaultCampaignName);
    }
  }, [isOpen, isResendMode, defaultCampaignName]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const handleSelectMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 45 * 1024 * 1024) {
      toast.error('El archivo supera el máximo permitido de 45 MB');
      return;
    }
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveMediaFile = () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const sellerDisplayName = useMemo(() => {
    const raw = (currentUser.full_name || '').trim();
    if (
      !raw ||
      /simulaci[oó]n|platform\s*owner|company_admin|super_admin|collaborator|^admin(istrador)?\b|^soporte\b|^usuario\b/i.test(
        raw
      )
    ) {
      return 'Jimmy Arias';
    }
    return raw;
  }, [currentUser.full_name]);

  const sellerSignature = useMemo(() => {
    if (/^jimmy\s+arias$/i.test(sellerDisplayName)) {
      return 'Jimmy Arias de Arias Defense';
    }
    return sellerDisplayName;
  }, [sellerDisplayName]);

  // Base pool: if user manually checked specific rows on the table, respect that pool; otherwise use all leads in view with valid phone
  const alreadyInCampaignPoolCount = useMemo(() => {
    if (isResendMode || alreadyInCampaignSet.size === 0) return 0;
    return leadsPool.filter((l) => alreadyInCampaignSet.has(l.id)).length;
  }, [isResendMode, alreadyInCampaignSet, leadsPool]);

  const baseLeadsWithPhone = useMemo(() => {
    const source =
      preSelectedLeadIds.length > 0 && preSelectedLeadIds.length < leadsPool.length
        ? leadsPool.filter((l) => preSelectedLeadIds.includes(l.id))
        : leadsPool;

    return source.filter((l) => {
      if (l.status === 'Erróneo') return false;
      if (!isResendMode && hideAlreadyInCampaign && alreadyInCampaignSet.has(l.id)) return false;
      const p = normalizeWhatsAppPhone(l.phone);
      return p.length >= 8;
    });
  }, [leadsPool, preSelectedLeadIds, isResendMode, hideAlreadyInCampaign, alreadyInCampaignSet]);

  const getLeadTouchInfo = (lead: Lead): ReactivationTouchInfo => {
    if (touchInfoByLeadId[lead.id]) return touchInfoByLeadId[lead.id];
    const lastTouch = lead.last_follow_up_at || lead.created_at || new Date().toISOString();
    const hours = Math.max(0, Math.floor((Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60)));
    return { touch: 1, sentAt: lastTouch, hoursSinceSent: hours, isReactivation: true, replied: false };
  };

  const isLeadMatchingStage = (lead: Lead, targetStage: string): boolean => {
    const tInfo = getLeadTouchInfo(lead);
    if (targetStage === 'all') {
      if (['Perdido', 'Erróneo', 'Cerrado', 'Cliente'].includes(lead.status)) return false;
      if (isResendMode && (tInfo.isReactivation === false || tInfo.replied)) return false;
      return true;
    }
    if (targetStage === 'Prospecto' || targetStage === 'Llamada fría') {
      if (lead.status !== targetStage) return false;
      if (isResendMode && (tInfo.isReactivation === false || tInfo.replied)) return false;
      return true;
    }
    if (targetStage === 'Cliente_Cerrado') {
      return lead.status === 'Cliente' || lead.status === 'Cerrado';
    }
    return lead.status === targetStage;
  };

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      Prospecto: 0,
      'Llamada fría': 0,
      'En Nutrición': 0,
      'Lead calificado': 0,
      'En seguimiento': 0,
      Negociación: 0,
      Cliente: 0,
      Cerrado: 0,
      Cliente_Cerrado: 0,
      Perdido: 0,
    };
    for (const l of baseLeadsWithPhone) {
      if (isLeadMatchingStage(l, 'all')) counts.all++;
      if (isLeadMatchingStage(l, 'Prospecto')) counts.Prospecto++;
      if (isLeadMatchingStage(l, 'Llamada fría')) counts['Llamada fría']++;
      if (isLeadMatchingStage(l, 'En Nutrición')) counts['En Nutrición']++;
      if (isLeadMatchingStage(l, 'Lead calificado')) counts['Lead calificado']++;
      if (isLeadMatchingStage(l, 'En seguimiento')) counts['En seguimiento']++;
      if (isLeadMatchingStage(l, 'Negociación')) counts.Negociación++;
      if (isLeadMatchingStage(l, 'Cliente')) counts.Cliente++;
      if (isLeadMatchingStage(l, 'Cerrado')) counts.Cerrado++;
      if (isLeadMatchingStage(l, 'Cliente_Cerrado')) counts.Cliente_Cerrado++;
      if (isLeadMatchingStage(l, 'Perdido')) counts.Perdido++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLeadsWithPhone, isResendMode, touchInfoByLeadId]);

  const resendCounts = useMemo(() => {
    let all = 0;
    let ready48 = 0;
    let ready72 = 0;
    let under48 = 0;
    let maxHoursUnder48 = 0;
    for (const l of baseLeadsWithPhone) {
      if (!isLeadMatchingStage(l, stageFilter)) continue;
      all++;
      const tInfo = getLeadTouchInfo(l);
      if (tInfo.hoursSinceSent >= 48) {
        ready48++;
        if (tInfo.hoursSinceSent >= 72) ready72++;
      } else {
        under48++;
        if (tInfo.hoursSinceSent > maxHoursUnder48) maxHoursUnder48 = tInfo.hoursSinceSent;
      }
    }
    const hoursUntilNextReady = under48 > 0 ? Math.max(1, 48 - maxHoursUnder48) : 0;
    return {
      all,
      ready48,
      ready72,
      under48,
      hoursUntilNextReady,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLeadsWithPhone, stageFilter, touchInfoByLeadId]);

  // If in resend mode and nobody has reached 48h yet, automatically show 'all' so the user sees why they're in cooldown
  useEffect(() => {
    if (isResendMode && isOpen) {
      if (stageFilter !== 'all' && stageFilter !== 'Prospecto' && stageFilter !== 'Llamada fría') {
        setResendTimingFilter('all');
      } else if (resendCounts.ready48 === 0 && resendCounts.all > 0) {
        setResendTimingFilter('all');
      } else {
        setResendTimingFilter('ready48');
      }
    }
  }, [isResendMode, isOpen, stageFilter, resendCounts.ready48, resendCounts.all]);

  // Filtered by inactivity/resend timing + stage + search
  const matchingLeads = useMemo(() => {
    return baseLeadsWithPhone.filter((l) => {
      if (!isLeadMatchingStage(l, stageFilter)) return false;

      if (isResendMode) {
        const tInfo = getLeadTouchInfo(l);
        if (resendTimingFilter === 'ready48' && tInfo.hoursSinceSent < 48) return false;
        if (resendTimingFilter === 'ready72' && tInfo.hoursSinceSent < 72) return false;
        if (resendTimingFilter === 'under48' && tInfo.hoursSinceSent >= 48) return false;
      } else {
        const info = getDaysInactive(l);
        if (inactivityFilter === 'never' && !info.neverContacted) return false;
        if (inactivityFilter === '15d' && info.days < 15) return false;
        if (inactivityFilter === '30d' && info.days < 30) return false;
        if (inactivityFilter === '60d' && info.days < 60) return false;
        if (inactivityFilter === '90d' && info.days < 90) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (l.name || '').toLowerCase().includes(q);
        const matchComp = (l.company_name || '').toLowerCase().includes(q);
        const matchPhone = (l.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchComp && !matchPhone) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLeadsWithPhone, isResendMode, resendTimingFilter, inactivityFilter, stageFilter, searchQuery, touchInfoByLeadId]);

  // Apply batch limit (e.g. 25, 50, 100, or all)
  const limitedLeads = useMemo(() => {
    if (batchLimit <= 0) return matchingLeads;
    return matchingLeads.slice(0, batchLimit);
  }, [matchingLeads, batchLimit]);

  // Final active leads to send (excluding unchecked rows)
  const activeBatchLeads = useMemo(
    () => limitedLeads.filter((l) => !excludedIds.has(l.id)),
    [limitedLeads, excludedIds]
  );

  // Counts per inactivity bucket for quick badges
  const bucketCounts = useMemo(() => {
    let all = 0;
    let never = 0;
    let d15 = 0;
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    for (const l of baseLeadsWithPhone) {
      if (!isLeadMatchingStage(l, stageFilter)) continue;
      all++;
      const info = getDaysInactive(l);
      if (info.neverContacted) never++;
      if (info.days >= 15) d15++;
      if (info.days >= 30) d30++;
      if (info.days >= 60) d60++;
      if (info.days >= 90) d90++;
    }
    return { all, never, d15, d30, d60, d90 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLeadsWithPhone, stageFilter]);

  const renderPersonalizedMessage = (lead: Lead, templateText: string): string => {
    const firstName = extractFirstName(lead.name);
    const rawCompany = (lead.company_name || '').replace(/\.+$/, '').trim();
    const rawName = (lead.name || '').replace(/\.+$/, '').trim();
    const isInvalidCompanyPlaceholder =
      !rawCompany ||
      rawCompany.length < 2 ||
      /^(individual|ninguna?|no\s+tiene|no\s+aplica|n\/?a|sin\s+empresa|particular|persona\s+natural|independiente|pendiente|por\s+definir|desconocid[oa]|cliente|prospecto|lead|null|undefined|-+|\.+|\+?\d[\d\s-]*)$/i.test(
        rawCompany
      );
    let company = 'su empresa';
    if (!isInvalidCompanyPlaceholder && rawCompany.toLowerCase() !== rawName.toLowerCase()) {
      company = rawCompany;
    } else if (isBusinessStyleName(rawName) && !/^(sin\s+nombre|contacto|cliente|prospecto|lead)/i.test(rawName)) {
      company = rawName;
    }
    let text = templateText
      .replace(/\{nombre\}/gi, firstName ? firstName : '')
      .replace(/\{empresa\}/gi, company)
      .replace(/\{vendedor\}/gi, sellerSignature)
      .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, sellerSignature)
      .replace(/Platform\s*Owner/gi, sellerSignature)
      .replace(/\b(company_admin|super_admin|collaborator)\b/gi, sellerSignature)
      .replace(/(de\s+Arias\s+Defense)\s+\1/gi, '$1');
    text = text.replace(/Hola\s+,/gi, 'Hola,').replace(/[ \t]{2,}/g, ' ').trim();
    return text;
  };

  const previewLead = useMemo(() => {
    if (previewLeadId) {
      const found = limitedLeads.find((l) => l.id === previewLeadId);
      if (found) return found;
    }
    return (
      activeBatchLeads[0] ||
      limitedLeads[0] ||
      ({
        id: 'sample',
        name: 'Carlos Mendoza',
        company_name: 'Comercial Mendoza',
      } as Lead)
    );
  }, [previewLeadId, activeBatchLeads, limitedLeads]);

  const previewText = useMemo(
    () => renderPersonalizedMessage(previewLead, messageTemplate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewLead, messageTemplate, sellerDisplayName]
  );

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: ReactivationTemplate) => {
    setSelectedTemplateId(tpl.id);
    setMessageTemplate(tpl.body);
  };

  const toggleLeadCheckbox = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (activeBatchLeads.length === limitedLeads.length) {
      // Deselect all visible
      setExcludedIds(new Set(limitedLeads.map((l) => l.id)));
    } else {
      setExcludedIds(new Set());
    }
  };

  const sendSingleLeadReactivation = async (
    lead: Lead,
    campaignTag: string,
    uploadedMedia?: { path: string; name: string; mime: string; size: number } | null
  ) => {
    const normalizedPhone = normalizeWhatsAppPhone(lead.phone);
    if (!normalizedPhone) throw new Error('Teléfono inválido');
    const l8 = normalizedPhone.slice(-8);
    const jid = `${normalizedPhone}@s.whatsapp.net`;
    const nowIso = new Date().toISOString();
    const personalizedText = renderPersonalizedMessage(lead, messageTemplate);

    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, metadata, lead_id, assigned_to')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .order('updated_at', { ascending: false })
      .limit(200);

    const existingTicket = (existingTickets || []).find((t: any) => {
      const m = t.metadata || {};
      if (m.merged_into || m.is_group) return false;
      if (lead.id && t.lead_id === lead.id) return true;
      const tPhone = String(m.whatsapp_phone || '').replace(/\D/g, '');
      return tPhone.length >= 8 && tPhone.slice(-8) === l8;
    });

    let ticketId: string;
    let nextTouchNumber = 1;

    if (existingTicket) {
      ticketId = existingTicket.id;
      const curMeta = (existingTicket.metadata || {}) as Record<string, any>;
      const prevTouch = Number(curMeta.wa_reactivation_touch || (curMeta.wa_reactivation ? 1 : 0));
      nextTouchNumber = prevTouch + 1;
      await supabase
        .from('tickets')
        .update({
          lead_id: lead.id,
          lead_name: lead.name,
          assigned_to: existingTicket.assigned_to || lead.assigned_to || currentUser.id,
          updated_at: nowIso,
          metadata: {
            ...curMeta,
            wa_scope: curMeta.wa_scope === 'soporte' ? 'soporte' : 'lead',
            whatsapp_phone: curMeta.whatsapp_phone || normalizedPhone,
            whatsapp_jid: curMeta.whatsapp_jid || jid,
            wa_reactivation: true,
            wa_reactivation_touch: nextTouchNumber,
            wa_reactivation_campaign: campaignTag,
            wa_reactivation_sent_at: nowIso,
            wa_reactivation_by: currentUser.id,
            wa_reactivation_by_name: sellerDisplayName,
            wa_attended_at: nowIso,
          },
        })
        .eq('id', ticketId);
    } else {
      const { data: createdTicket, error: createErr } = await supabase
        .from('tickets')
        .insert({
          company_id: companyId,
          title: `[WhatsApp · Lead] ${lead.name || `+${normalizedPhone}`}`,
          description: `Reactivación comercial por WhatsApp (${campaignTag})`,
          status: 'open',
          priority: 'medium',
          lead_id: lead.id,
          lead_name: lead.name,
          assigned_to: lead.assigned_to || currentUser.id,
          metadata: {
            source: 'whatsapp_evolution',
            wa_scope: 'lead',
            support_channel: 'ventas',
            ai_category: 'Ventas / Reactivación Lead',
            whatsapp_phone: normalizedPhone,
            whatsapp_jid: jid,
            evolution_instance: 'soporte',
            wa_reactivation: true,
            wa_reactivation_touch: 1,
            wa_reactivation_campaign: campaignTag,
            wa_reactivation_sent_at: nowIso,
            wa_reactivation_by: currentUser.id,
            wa_reactivation_by_name: sellerDisplayName,
            wa_attended_at: nowIso,
          },
        })
        .select('id')
        .single();

      if (createErr || !createdTicket?.id) {
        throw new Error(createErr?.message || 'No se pudo crear la conversación de WhatsApp');
      }
      ticketId = createdTicket.id;

      try {
        await supabase.from('whatsapp_contacts').upsert(
          {
            company_id: companyId,
            phone: normalizedPhone,
            display_name: lead.name,
            contact_type: 'lead',
            lead_id: lead.id,
            classified_by: currentUser.id,
            classified_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'company_id,phone' }
        );
      } catch {
        // non-blocking
      }
    }

    if (uploadedMedia) {
      const { data: sendRes, error: sendErr } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
        body: {
          action: 'send_media',
          ticket_id: ticketId,
          storage_path: uploadedMedia.path,
          file_name: uploadedMedia.name,
          mime: uploadedMedia.mime,
          size: uploadedMedia.size,
          caption: personalizedText,
        },
      });
      if (sendErr || (sendRes && sendRes.ok === false)) {
        throw new Error(sendErr?.message || sendRes?.error || 'Error al encolar archivo WhatsApp');
      }
    } else {
      const { data: sendRes, error: sendErr } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
        body: {
          action: 'send_reply',
          ticket_id: ticketId,
          message_text: personalizedText,
          response_minutes: 1,
        },
      });
      if (sendErr || (sendRes && sendRes.ok === false)) {
        throw new Error(sendErr?.message || sendRes?.error || 'Error al encolar mensaje WhatsApp');
      }
    }

    try {
      const mediaNote = uploadedMedia ? ` + Adjunto (${uploadedMedia.name})` : '';
      await leadsService.createFollowUp({
        lead_id: lead.id,
        action_type: 'whatsapp' as any,
        notes: `[${campaignTag} · Toque ${nextTouchNumber}]${mediaNote} Mensaje enviado por WhatsApp: "${personalizedText.slice(0, 180)}"`,
        date: nowIso,
      });
      await supabase
        .from('leads')
        .update({
          last_follow_up_at: nowIso,
          contact_count: Number(lead.contact_count || 0) + 1,
        })
        .eq('id', lead.id);
    } catch {
      // non-blocking
    }
  };

  const handleStartBatch = async () => {
    if (activeBatchLeads.length === 0 || !messageTemplate.trim()) return;
    setIsSending(true);
    setIsFinished(false);
    setSentCount(0);
    setFailedCount(0);
    abortRef.current = false;

    const cleanCampaignTag = campaignName.trim() || 'Reactivación WhatsApp';
    let ok = 0;
    let fail = 0;

    let uploadedMedia: { path: string; name: string; mime: string; size: number } | null = null;
    if (mediaFile) {
      try {
        setCurrentLeadName(`Subiendo archivo (${mediaFile.name})…`);
        const safeName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const path = `outgoing/${companyId}/campaigns/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('whatsapp-media')
          .upload(path, mediaFile, {
            contentType: mediaFile.type || 'application/octet-stream',
            upsert: false,
          });
        if (upErr) throw upErr;
        uploadedMedia = {
          path,
          name: mediaFile.name,
          mime: mediaFile.type || 'application/octet-stream',
          size: mediaFile.size,
        };
      } catch (err: any) {
        toast.error(err?.message || 'No se pudo subir el Flyer/Video adjunto');
        setIsSending(false);
        setCurrentLeadName('');
        return;
      }
    }

    for (let i = 0; i < activeBatchLeads.length; i++) {
      if (abortRef.current) break;
      const lead = activeBatchLeads[i];
      setCurrentLeadName(`${lead.name} (${lead.phone})`);

      try {
        await sendSingleLeadReactivation(lead, cleanCampaignTag, uploadedMedia);
        ok++;
        setSentCount(ok);
        setSentLeadIds((prev) => new Set(prev).add(lead.id));
      } catch (err) {
        console.warn('[WhatsAppReactivation] Error sending to lead:', lead.id, err);
        fail++;
        setFailedCount(fail);
      }

      if (i < activeBatchLeads.length - 1 && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    setIsSending(false);
    setIsFinished(true);
    setCurrentLeadName('');
    if (ok > 0) {
      toast.success(`Reactivación enviada a ${ok} prospecto${ok === 1 ? '' : 's'}`);
      onCompleted?.();
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    toast('Deteniendo cola de envío…');
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${variable}`);
  };

  const visibleTemplates = useMemo(() => {
    return DEFAULT_TEMPLATES;
  }, []);

  const handleChangeStageFilter = (nextStage: string) => {
    setStageFilter(nextStage);
    setExcludedIds(new Set());
    if (nextStage === 'En Nutrición') {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === 'nutricion_valor');
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        setMessageTemplate(tpl.body);
      }
      setCampaignName('Nutrición · Seguimiento');
    } else if (nextStage === 'Cliente' || nextStage === 'Cerrado' || nextStage === 'Cliente_Cerrado') {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === 'clientes_upsell');
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        setMessageTemplate(tpl.body);
      }
      setCampaignName('Clientes · Nuevos Servicios');
    } else if (nextStage === 'Lead calificado' || nextStage === 'En seguimiento' || nextStage === 'Negociación') {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === 'seguimiento_propuesta');
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        setMessageTemplate(tpl.body);
      }
      setCampaignName(`Seguimiento · ${nextStage}`);
    } else if (isResendMode) {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === 'toque2_flyer_video');
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        setMessageTemplate(tpl.body);
      }
      setCampaignName('Reactivación · Toque 2');
    }
  };

  const formatHoursElapsed = (hours: number): string => {
    if (hours < 1) return 'Hace <1h';
    if (hours < 24) return `Hace ${hours}h`;
    const d = Math.floor(hours / 24);
    return `Hace ${d}d`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[80] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_24px_60px_-15px_rgba(15,23,42,0.22)] max-w-5xl w-full overflow-hidden flex flex-col h-[86vh] max-h-[780px]">
        {/* ── HEADER: Minimalist SaaS Clean ── */}
        <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              {isResendMode ? <RefreshCw className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">
                  {isResendMode ? 'Reenvío y Campañas por Etapa' : 'Reactivación de Prospectos por WhatsApp'}
                </h3>
                {isResendMode ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                    {resendCounts.ready48 > 0
                      ? `${resendCounts.ready48} listos (+48h cumplidas)`
                      : `En espera (<48h · faltan ~${resendCounts.hoursUntilNextReady}h)`}
                  </span>
                ) : (
                  alreadyInCampaignPoolCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setHideAlreadyInCampaign((v) => !v)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                        hideAlreadyInCampaign
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/70'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                      title="Clic para alternar si se ocultan los prospectos que ya están en tu campaña de WhatsApp"
                    >
                      {hideAlreadyInCampaign
                        ? `Ocultando ${alreadyInCampaignPoolCount} ya en campaña WA`
                        : `Mostrando también ${alreadyInCampaignPoolCount} ya en campaña WA`}
                    </button>
                  )
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {isResendMode
                  ? 'Sigue los 3 pasos: 1. Elige etapa y destinatarios · 2. Ajusta el mensaje · 3. Adjunta Flyer o Video (opcional)'
                  : 'Sigue los 3 pasos: 1. Filtra destinatarios · 2. Elige plantilla · 3. Adjunta Flyer o Video (opcional)'}
              </p>
            </div>
          </div>

          {!isSending && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80 flex items-center justify-center transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── UNIFIED FILTER BAR ── */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {isResendMode ? (
            <div className="inline-flex items-center bg-slate-200/70 p-0.5 rounded-xl gap-0.5 flex-wrap">
              {(
                [
                  { id: 'ready48', label: `Listos +48h (${resendCounts.ready48})` },
                  { id: 'ready72', label: `+72h (${resendCounts.ready72})` },
                  { id: 'under48', label: `En espera <48h (${resendCounts.under48})` },
                  { id: 'all', label: `Todos (${resendCounts.all})` },
                ] as const
              ).map((opt) => {
                const active = resendTimingFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isSending}
                    onClick={() => {
                      setResendTimingFilter(opt.id);
                      setExcludedIds(new Set());
                    }}
                    className={`px-3 py-1 rounded-lg text-xs transition ${
                      active
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="inline-flex items-center bg-slate-200/70 p-0.5 rounded-xl gap-0.5 flex-wrap">
              {(
                [
                  { id: 'all', label: `Todos (${bucketCounts.all})` },
                  { id: 'never', label: `Sin contacto (${bucketCounts.never})` },
                  { id: '15d', label: `+15d (${bucketCounts.d15})` },
                  { id: '30d', label: `+30d (${bucketCounts.d30})` },
                  { id: '60d', label: `+60d (${bucketCounts.d60})` },
                ] as const
              ).map((opt) => {
                const active = inactivityFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isSending}
                    onClick={() => {
                      setInactivityFilter(opt.id);
                      setExcludedIds(new Set());
                      if (opt.id === 'never') setCampaignName('Reactivación Sin Contacto');
                      else if (opt.id !== 'all') setCampaignName(`Reactivación +${opt.id.replace('d', ' días')}`);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs transition ${
                      active
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <select
              disabled={isSending}
              value={stageFilter}
              onChange={(e) => handleChangeStageFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">
                {isResendMode
                  ? `Etapas activas · Sin responder (${stageCounts.all})`
                  : `Todas las etapas activas (${stageCounts.all})`}
              </option>
              <option value="Prospecto">Prospecto ({stageCounts.Prospecto})</option>
              <option value="Llamada fría">Llamada fría ({stageCounts['Llamada fría']})</option>
              <option value="En Nutrición">En Nutrición ({stageCounts['En Nutrición']})</option>
              <option value="Lead calificado">Lead calificado ({stageCounts['Lead calificado']})</option>
              <option value="En seguimiento">En seguimiento ({stageCounts['En seguimiento']})</option>
              <option value="Negociación">Negociación ({stageCounts.Negociación})</option>
              <option value="Cliente_Cerrado">Clientes / Cerrados ({stageCounts.Cliente_Cerrado})</option>
              <option value="Cliente">Solo estado: Cliente ({stageCounts.Cliente})</option>
              <option value="Cerrado">Solo estado: Cerrado ({stageCounts.Cerrado})</option>
              <option value="Perdido">Perdido ({stageCounts.Perdido})</option>
            </select>

            <select
              disabled={isSending}
              value={batchLimit}
              onChange={(e) => {
                setBatchLimit(Number(e.target.value));
                setExcludedIds(new Set());
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 text-xs font-semibold text-indigo-700 focus:outline-none"
            >
              <option value={20}>Lote: 20 prospectos</option>
              <option value={30}>Lote: 30 prospectos (Recomendado)</option>
              <option value={50}>Lote: 50 prospectos</option>
              <option value={100}>Lote: 100 prospectos</option>
              <option value={0}>Todos ({matchingLeads.length})</option>
            </select>
          </div>
        </div>

        {/* ── MAIN 2-COLUMN WORKSPACE ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
          {/* ── LEFT COLUMN (5 cols): STEP 1 · RECIPIENT LIST ── */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-white">
            <div className="p-3.5 border-b border-slate-100 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-[13px] font-bold text-slate-900">
                    Destinatarios ({activeBatchLeads.length})
                  </h4>
                </div>
                <button
                  type="button"
                  disabled={isSending || limitedLeads.length === 0}
                  onClick={toggleSelectAllVisible}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
                >
                  {activeBatchLeads.length === limitedLeads.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {limitedLeads.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <Users className="w-5 h-5 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No hay contactos en este filtro.</p>
                  <p className="text-[11px] text-slate-400">
                    Cambia la etapa o la pestaña de tiempo superior.
                  </p>
                </div>
              ) : (
                limitedLeads.map((lead, idx) => {
                  const isIncluded = !excludedIds.has(lead.id);
                  const isPreviewed = previewLead.id === lead.id;
                  const wasSent = sentLeadIds.has(lead.id);
                  const inactivity = getDaysInactive(lead);
                  const touchInfo = isResendMode ? getLeadTouchInfo(lead) : null;
                  const cleanPhone = normalizeWhatsAppPhone(lead.phone);
                  const hasDistinctCompany =
                    lead.company_name &&
                    lead.company_name !== 'Individual' &&
                    lead.company_name.trim().toLowerCase() !== (lead.name || '').trim().toLowerCase();

                  return (
                    <div
                      key={lead.id}
                      onClick={() => setPreviewLeadId(lead.id)}
                      className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                        isPreviewed
                          ? 'bg-indigo-50/60'
                          : isIncluded
                          ? 'bg-white hover:bg-slate-50/80'
                          : 'bg-slate-50/50 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLeadCheckbox(lead.id);
                          }}
                          className="shrink-0"
                        >
                          {isIncluded ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <SquareIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">{idx + 1}.</span>
                            <span className="text-[13px] font-medium text-slate-900 truncate">
                              {lead.name}
                            </span>
                            {wasSent && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                                Enviado
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            +{cleanPhone}
                            {hasDistinctCompany ? ` · ${lead.company_name}` : ''}
                            {lead.status ? ` · ${lead.status}` : ''}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70 text-[11px] font-medium shrink-0">
                        {touchInfo
                          ? `${formatHoursElapsed(touchInfo.hoursSinceSent)} · Toque ${touchInfo.touch + 1}`
                          : inactivity.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {matchingLeads.length > limitedLeads.length && (
              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200/70 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
                <span>
                  Mostrando <b>{limitedLeads.length}</b> de <b>{matchingLeads.length}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setBatchLimit(0)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Ver todos
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (7 cols): STEP 2 (MESSAGE) + STEP 3 (FLYER/VIDEO) + PREVIEW ── */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-[#F8F9FC] overflow-y-auto p-5 space-y-3.5">
            {/* STEP 2: MESSAGE & COMPACT TEMPLATES */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <h4 className="text-[13px] font-bold text-slate-900">Mensaje a enviar</h4>
                </div>
                <span className="text-[11px] text-slate-400">Elige una plantilla o escribe tu mensaje</span>
              </div>

              {/* Dedicated row of template pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {visibleTemplates.map((tpl) => {
                  const active = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`px-2.5 py-1 rounded-lg text-[11.5px] transition ${
                        active
                          ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600 font-medium'
                      }`}
                    >
                      {tpl.shortLabel}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={3}
                disabled={isSending}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Escribe el mensaje para tus prospectos..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-[13px] font-normal text-slate-800 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Variables:</span>
                  {(['{nombre}', '{empresa}'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={isSending}
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-[11px] font-medium transition"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400">
                  Se personaliza automáticamente para cada prospecto
                </span>
              </div>
            </div>

            {/* STEP 3: FLYER / VIDEO / PDF UPLOADER (100% VISIBLE AT A GLANCE) */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,application/pdf"
                onChange={handleSelectMediaFile}
                className="hidden"
              />

              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <h4 className="text-[13px] font-bold text-slate-900">
                    Flyer, Video corto o PDF
                  </h4>
                  <span className="text-[11px] text-slate-400 font-normal">(Opcional)</span>
                </div>
                {mediaFile && (
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleRemoveMediaFile}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar archivo</span>
                  </button>
                )}
              </div>

              {!mediaFile ? (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => mediaInputRef.current?.click()}
                  className="w-full px-4 py-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/70 flex items-center justify-between gap-3 transition text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700 transition">
                        Haz clic aquí para subir una imagen (Flyer), video MP4 o PDF
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        Se enviará adjunto junto con el mensaje del Paso 2 · Si no subes nada, se enviará solo texto
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-semibold text-indigo-600 shadow-2xs shrink-0">
                    Subir archivo
                  </span>
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {mediaPreviewUrl && mediaFile.type.startsWith('image/') ? (
                      <img
                        src={mediaPreviewUrl}
                        alt="Flyer"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        {mediaFile.type.startsWith('video/') ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{mediaFile.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para enviar con el mensaje
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => mediaInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>

            {/* LIVE WHATSAPP PREVIEW */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Vista previa en WhatsApp · <span className="text-indigo-600">{previewLead.name}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Clic en cualquier prospecto para previsualizar
                </span>
              </div>

              <div className="bg-[#EEF0FF]/70 border border-indigo-100 text-slate-800 rounded-xl px-3.5 py-2.5 text-[13px] font-normal leading-relaxed space-y-2">
                {mediaFile && mediaPreviewUrl && (
                  <div className="rounded-lg overflow-hidden bg-white border border-slate-200/80 p-1.5">
                    {mediaFile.type.startsWith('image/') ? (
                      <img
                        src={mediaPreviewUrl}
                        alt="Flyer preview"
                        className="max-h-36 rounded object-contain mx-auto"
                      />
                    ) : mediaFile.type.startsWith('video/') ? (
                      <video
                        src={mediaPreviewUrl}
                        controls
                        className="max-h-36 rounded mx-auto w-full"
                      />
                    ) : (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">{mediaFile.name}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{previewText}</p>
              </div>
            </div>

            {/* Live Progress Box when Sending or Finished */}
            {(isSending || isFinished) && (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="flex items-center gap-2">
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span>Enviando a: {currentLeadName}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>Envío completado</span>
                      </>
                    )}
                  </span>
                  <span className="text-indigo-700">
                    {sentCount} enviados · {failedCount > 0 ? `${failedCount} con error · ` : ''}de{' '}
                    {activeBatchLeads.length}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((sentCount + failedCount) / Math.max(1, activeBatchLeads.length)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-3 bg-white border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Pausa segura entre envíos:</span>
            </span>
            <select
              disabled={isSending}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value={8}>Cada 8s</option>
              <option value={10}>Cada 10s (Recomendado)</option>
              <option value={15}>Cada 15s</option>
            </select>
            <span className="text-slate-400">
              · Tiempo estimado: <b className="text-slate-600">~{Math.max(1, Math.ceil((activeBatchLeads.length * delaySeconds) / 60))} min</b>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {isSending ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Detener envío</span>
              </button>
            ) : isFinished ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  Cerrar
                </button>
                {onGoToWhatsAppChat && (
                  <button
                    type="button"
                    onClick={onGoToWhatsAppChat}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver respuestas en el Chat</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={activeBatchLeads.length === 0 || !messageTemplate.trim()}
                  onClick={handleStartBatch}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {isResendMode
                      ? `Reenviar a ${activeBatchLeads.length} prospectos`
                      : `Enviar a ${activeBatchLeads.length} prospectos`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
