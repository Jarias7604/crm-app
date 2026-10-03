import React, { useState, useEffect, useRef } from 'react';
import {
    Play,
    ChevronUp,
    ChevronDown,
    Plus,
    X,
    Eye,
    EyeOff,
    Save,
    Send,
    RefreshCw,
    Link as LinkIcon,
    ArrowLeft,
    Upload,
    Maximize2,
    Monitor,
    Smartphone,
    FileText,
    Check,
    HelpCircle,
    User,
    Sparkles,
    Users,
    Search,
    Mail,
    ChevronLeft,
    ChevronRight,
    Building2,
    MapPin
} from 'lucide-react';
import { storageService } from '../../services/storage';
import { useAuth } from '../../auth/AuthProvider';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';

export interface EmailBlock {
    id: string;
    type: 'header' | 'intro' | 'callout' | 'solution' | 'leadIn' | 'videoCard' | 'ctaButton' | 'closing' | 'signature';
    label: string;
    visible: boolean;
}

export function repairTemplateVariables(text: string | undefined, isChurch: boolean): string {
    if (!text) return text || '';
    let result = text;
    // Replace any legacy frozen church names with variable
    result = result.replace(/Iglesia\s+B[ií]blica\s+Gracia\s+Eterna(\s*\([^\)]*\))?/gi, isChurch ? '{{nombre_iglesia}}' : '{{nombre_empresa}}');
    result = result.replace(/Cl[ií]nica\s+Salud\s+Plus/gi, isChurch ? '{{nombre_iglesia}}' : '{{nombre_empresa}}');
    result = result.replace(/Nuestra\s+Empresa/gi, isChurch ? 'Iclesia' : '{{nombre_empresa}}');
    result = result.replace(/contacto@empresa\.com/gi, '');

    // Smart repair for callout: "¿Cuentan actualmente en ... con un proceso ágil"
    result = result.replace(/(¿Cuentan actualmente en\s+)(.+?)(\s+con un proceso ágil)/i, (match, p1, middle, p3) => {
        if (middle.includes('{{')) return match;
        return `${p1}${isChurch ? '{{nombre_iglesia}}' : '{{nombre_empresa}}'}${p3}`;
    });

    // Smart repair for subject: "Una pregunta para ..."
    result = result.replace(/(Una pregunta para\s+)(.+)/i, (match, p1, middle) => {
        if (middle.includes('{{')) return match;
        return `${p1}${isChurch ? '{{nombre_iglesia}}' : '{{nombre_empresa}}'}`;
    });

    return result;
}

export function getYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    let cleanUrl = url.trim();
    if (cleanUrl.includes('dvR5zR1x3os')) {
        cleanUrl = cleanUrl.replace('dvR5zR1x3os', 'dvRSzR1x3os');
    }
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = cleanUrl.match(regExp);
    if (match && match[1]) return match[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
    return null;
}

export interface ProspectingStudioState {
    campaignName?: string;
    subject?: string;
    senderIdentity?: string;
    greeting?: string;
    introText?: string;
    calloutText?: string;
    solutionText?: string;
    leadInText?: string;
    closingText?: string;
    signoffText?: string;
    youtubeUrl?: string;
    videoCaption?: string;
    thumbMode?: 'default' | 'youtube' | 'custom';
    customUploadedThumb?: string;
    buttonText?: string;
    buttonColor?: string;
    buttonLink?: string;
    hasLogo?: boolean;
    hasPhoto?: boolean;
    photoShape?: 'circle' | 'rounded' | 'square';
    avatarUrl?: string;
    sigName?: string;
    sigTitle?: string;
    sigPhone?: string;
    sigWebsite?: string;
    customHeaderLogo?: string;
    customSigLogo?: string;
    blocks?: EmailBlock[];
}

export function parseStudioStateFromHtml(html: string): Partial<ProspectingStudioState> | null {
    if (!html || typeof html !== 'string') return null;
    const state: Partial<ProspectingStudioState> = {};

    try {
        // 1. Callout text
        const calloutMatch = html.match(/<!-- Callout Box -->[\s\S]*?<p[^>]*style="[^"]*font-weight:\s*800[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (calloutMatch && calloutMatch[1]) {
            state.calloutText = calloutMatch[1].trim();
        }

        // 2. Intro text & greeting
        const introMatch = html.match(/<!-- Intro -->[\s\S]*?<p[^>]*font-weight:\s*bold[^"]*"[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
        if (introMatch) {
            if (introMatch[1]) state.greeting = introMatch[1].trim();
            if (introMatch[2]) state.introText = introMatch[2].trim();
        }

        // 3. Solution text
        const solutionMatch = html.match(/<!-- Solution Text -->\s*<p[^>]*>([\s\S]*?)<\/p>/i);
        if (solutionMatch && solutionMatch[1]) {
            state.solutionText = solutionMatch[1].trim();
        }

        // 4. Lead-in text
        const leadInMatch = html.match(/<!-- Lead-in -->\s*<p[^>]*>([\s\S]*?)<\/p>/i);
        if (leadInMatch && leadInMatch[1]) {
            state.leadInText = leadInMatch[1].trim();
        }

        // 5. Closing & Signoff
        const closingMatch = html.match(/<!-- Closing -->[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*font-weight:\s*bold[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (closingMatch) {
            if (closingMatch[1]) state.closingText = closingMatch[1].trim();
            if (closingMatch[2]) state.signoffText = closingMatch[2].trim();
        }

        // 6. Video URL
        const videoMatch = html.match(/<!-- Video Card[\s\S]*?<a\s+href="([^"]+)"/i);
        if (videoMatch && videoMatch[1]) {
            state.youtubeUrl = videoMatch[1].trim();
        }

        // 7. CTA Button
        const buttonMatch = html.match(/<!-- CTA Button -->[\s\S]*?<a\s+href="([^"]+)"[^>]*background-color:\s*([^;"]+)[^>]*>[\s\S]*?(?:&nbsp;|\s)*([^<&>]+)(?:&nbsp;|\s)*&gt;<\/a>/i);
        if (buttonMatch) {
            if (buttonMatch[1]) state.buttonLink = buttonMatch[1].trim();
            if (buttonMatch[2]) state.buttonColor = buttonMatch[2].trim();
            if (buttonMatch[3]) state.buttonText = buttonMatch[3].trim().replace(/^[▶►]\s*/, '');
        }
    } catch { /* ignore parse errors */ }

    return Object.keys(state).length > 0 ? state : null;
}


interface ProspectingEmailStudioProps {
    company?: any;
    campaignId?: string;
    initialSubject?: string;
    initialName?: string;
    initialContent?: string;
    initialStudioState?: ProspectingStudioState | null;
    onSaveDraft: (data: { name: string; subject: string; htmlContent: string; studioState: ProspectingStudioState }) => Promise<void>;
    onSendCampaign: (data: { name: string; subject: string; htmlContent: string; studioState: ProspectingStudioState }) => Promise<void>;
    reachCount?: number;
    previewLeads?: any[];
    onOpenAudienceModal?: () => void;
    onBack?: () => void;
    onSwitchToFreeEditor?: () => void;
}

export default function ProspectingEmailStudio({
    company,
    campaignId,
    initialSubject = 'Una pregunta para {{nombre_iglesia}}',
    initialName = 'Prospección - Iglesias',
    initialContent,
    initialStudioState,
    onSaveDraft,
    onSendCampaign,
    reachCount = 966,
    previewLeads = [],
    onOpenAudienceModal,
    onBack,
    onSwitchToFreeEditor
}: ProspectingEmailStudioProps) {
    const { profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const sigLogoInputRef = useRef<HTMLInputElement>(null);
    const subjectInputRef = useRef<HTMLInputElement>(null); // for scroll-to-end after variable insert
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingSigLogo, setIsUploadingSigLogo] = useState(false);

    // View device mode: 'desktop', 'mobile', or 'dual'
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'dual'>('desktop');
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    // Determine company context — wait for company to be loaded (CampaignBuilder ensures this)
    const isIclesia = Boolean(company?.name?.toLowerCase().includes('iclesia'));
    // NEVER fallback to a hardcoded string that could end up in compiled HTML.
    // If company is not loaded yet (should not happen due to CampaignBuilder gate), use a
    // recognizable variable so marketing-engine or the user can catch it.
    const companyName = company?.name?.trim() || '';
    // Guard: do not allow studio to render with empty company when company is expected
    const companyDisplayName = companyName || (isIclesia ? 'Iclesia' : '');

    // 1. Resolve stored draft from localStorage or initialStudioState or parsedFromHtml
    const companyDraftKey = company?.id ? `crm_prospecting_studio_new_${company.id}` : 'crm_prospecting_studio_new_default';
    const savedLocalDraft = (() => {
        try {
            // Clean up legacy unscoped key so it never bleeds into other tenants
            localStorage.removeItem('crm_prospecting_studio_new');
            const key = campaignId ? `crm_prospecting_studio_${campaignId}` : companyDraftKey;
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw) as Partial<ProspectingStudioState>;
        } catch { /* ignore */ }
        return null;
    })();

    const parsedFromHtml = initialContent ? parseStudioStateFromHtml(initialContent) : null;
    const effectiveInitial: Partial<ProspectingStudioState> = initialStudioState || parsedFromHtml || savedLocalDraft || {};
    const isHydratedRef = useRef(Boolean(initialStudioState || parsedFromHtml || savedLocalDraft));

    const defaultSenderName = (profile?.full_name && profile.full_name !== 'Platform Owner' && profile.full_name !== companyName)
        ? profile.full_name
        : (isIclesia ? 'Jimmy Arias' : (profile?.full_name || companyName));
    // Never use 'contacto@empresa.com' as a fallback — it is a forbidden placeholder string
    const defaultSenderEmail = company?.email || profile?.email || '';
    // True if the sender's name is the same as the company name (some admin accounts)
    const senderNameIsCompanyName = defaultSenderName === companyDisplayName;

    // Form Controls (Left Panel)
    const [campaignName, setCampaignName] = useState(() => effectiveInitial.campaignName || initialName || (company?.name ? `Prospección - ${company.name}` : 'Prospección - Comercial'));
    const [subject, setSubject] = useState(() => repairTemplateVariables(effectiveInitial.subject || initialSubject || (isIclesia ? 'Una pregunta para {{nombre_iglesia}}' : 'Una pregunta para {{nombre_empresa}}'), isIclesia));
    const [senderIdentity, setSenderIdentity] = useState(() => effectiveInitial.senderIdentity || `${defaultSenderName} <${defaultSenderEmail}>`);

    // Video Controls
    const [youtubeUrl, setYoutubeUrl] = useState(() => effectiveInitial.youtubeUrl || (isIclesia ? 'https://youtu.be/dvRSzR1x3os' : ''));
    const [videoCaption, setVideoCaption] = useState(() => effectiveInitial.videoCaption || `Vea en 45 segundos cómo funciona ${companyName}`);
    const [thumbMode, setThumbMode] = useState<'default' | 'youtube' | 'custom'>(() => effectiveInitial.thumbMode || 'default');
    const [customUploadedThumb, setCustomUploadedThumb] = useState<string>(() => effectiveInitial.customUploadedThumb || '');
    const [isUploadingThumb, setIsUploadingThumb] = useState(false);
    const videoThumbInputRef = useRef<HTMLInputElement>(null);

    const detectedYtId = getYouTubeVideoId(youtubeUrl);
    const defaultThumbImage = isIclesia
        ? '/images/marketing/jimmy-video-preview.png'
        : '/images/marketing/prospecting-video-preview.png';

    const effectiveVideoThumb = (thumbMode === 'custom' && customUploadedThumb && !customUploadedThumb.includes('unsplash.com'))
        ? customUploadedThumb
        : defaultThumbImage;

    // Button Controls
    const [buttonText, setButtonText] = useState(() => effectiveInitial.buttonText || (
        isIclesia
            ? 'Ver cómo funciona Iclesia'
            : companyDisplayName
                ? `Conocer más sobre ${companyDisplayName}`
                : 'Conocer más'
    ));
    const [buttonColor, setButtonColor] = useState(() => effectiveInitial.buttonColor || '#0066FF');
    const [buttonLink, setButtonLink] = useState(() => effectiveInitial.buttonLink || (isIclesia ? 'https://youtu.be/dvRSzR1x3os' : (company?.website || 'https://ariascrm.com')));

    // Signature Controls
    const [hasLogo, setHasLogo] = useState(() => typeof effectiveInitial.hasLogo === 'boolean' ? effectiveInitial.hasLogo : true);
    const [hasPhoto, setHasPhoto] = useState(() => typeof effectiveInitial.hasPhoto === 'boolean' ? effectiveInitial.hasPhoto : (isIclesia ? true : Boolean(profile?.avatar_url)));
    const [photoShape, setPhotoShape] = useState<'circle' | 'rounded' | 'square'>(() => effectiveInitial.photoShape || 'circle');
    const [avatarUrl, setAvatarUrl] = useState<string>(() => effectiveInitial.avatarUrl || profile?.avatar_url || (isIclesia ? '/images/marketing/jimmy-avatar.png' : ''));
    const [sigName, setSigName] = useState(() => effectiveInitial.sigName || ((profile?.full_name && profile.full_name !== 'Platform Owner') ? profile.full_name : (isIclesia ? 'Jimmy Arias' : companyName)));
    const [sigTitle, setSigTitle] = useState(() => effectiveInitial.sigTitle || (isIclesia ? 'Founder | Iclesia' : `${(profile as any)?.job_title || 'Asesor Comercial'} | ${companyName}`));
    const [sigPhone, setSigPhone] = useState(() => effectiveInitial.sigPhone || (isIclesia ? '703-945-9240' : (company?.phone || profile?.phone || '')));
    const [sigWebsite, setSigWebsite] = useState(() => effectiveInitial.sigWebsite || (isIclesia ? 'iclesia.ai' : (company?.website ? company.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '')));
    const [customHeaderLogo, setCustomHeaderLogo] = useState<string>(() => effectiveInitial.customHeaderLogo || '');
    const [customSigLogo, setCustomSigLogo] = useState<string>(() => effectiveInitial.customSigLogo || '');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Dynamic Text Content (Adapted for current tenant company / churches)
    const [greeting, setGreeting] = useState(() => effectiveInitial.greeting || 'Hola, bendiciones.');
    const [introText, setIntroText] = useState(() => repairTemplateVariables(effectiveInitial.introText, isIclesia) || (
        isIclesia
            ? 'Mi nombre es Jimmy Arias de Iclesia y quería hacerles una consulta:'
            : senderNameIsCompanyName
                // Avoid: "Mi nombre es ACME de ACME" — just say the company is writing
                ? (companyDisplayName ? `Les escribe ${companyDisplayName} y queríamos hacerles una consulta:` : 'Les escribimos y queríamos hacerles una consulta:')
                : companyDisplayName
                    ? `Mi nombre es ${defaultSenderName} de ${companyDisplayName} y quería hacerles una consulta:`
                    : `Mi nombre es ${defaultSenderName} y quería hacerles una consulta:`
    ));
    const [calloutText, setCalloutText] = useState(() => repairTemplateVariables(effectiveInitial.calloutText, isIclesia) || (isIclesia ? '¿Cuentan actualmente en {{nombre_iglesia}} con un proceso ágil para atender y dar seguimiento inmediato a cada visitante o miembro que solicita información?' : '¿Cuentan actualmente en {{nombre_empresa}} con un proceso ágil para atender y dar seguimiento inmediato a cada cliente que solicita información?'));
    const [solutionText, setSolutionText] = useState(() => repairTemplateVariables(effectiveInitial.solutionText, isIclesia) || (
        isIclesia
            ? 'En Iclesia ayudamos a congregaciones a automatizar el seguimiento de visitas, coordinar a los líderes de grupos y asegurar que ninguna persona se quede sin atención pastoral.'
            : companyDisplayName
                ? `En ${companyDisplayName} ayudamos a empresas a optimizar sus tiempos de respuesta, coordinar al equipo comercial y asegurar que ninguna oportunidad de venta se pierda.`
                : 'Ayudamos a empresas a optimizar sus tiempos de respuesta, coordinar al equipo comercial y asegurar que ninguna oportunidad de venta se pierda.'
    ));
    const [leadInText, setLeadInText] = useState(() => repairTemplateVariables(effectiveInitial.leadInText, isIclesia) || 'Les comparto un breve video de 45 segundos para mostrarles cómo funciona:');
    const [closingText, setClosingText] = useState(() => repairTemplateVariables(effectiveInitial.closingText, isIclesia) || (isIclesia ? 'Si esto es algo que desean mejorar en su congregación, pueden responder directamente a este correo. Con gusto coordinamos una breve conversación.' : 'Si esto es algo que desean mejorar en su empresa, pueden responder directamente a este correo. Con gusto coordinamos una breve conversación.'));
    const [signoffText, setSignoffText] = useState(() => effectiveInitial.signoffText || 'Atentamente,');

    // Logo Resolution: Custom uploaded in studio > Company profile logo > (Iclesia logo if Iclesia, else empty)
    const effectiveHeaderLogo = customHeaderLogo || company?.logo_url || (isIclesia ? '/images/marketing/iclesia-header-logo.png' : '');
    const effectiveSigLogo = customSigLogo || customHeaderLogo || company?.logo_url || (isIclesia ? '/images/marketing/iclesia-brand-logo.png' : '');

    // Active simulated lead index & Recipient modal controls
    const [leadIndex, setLeadIndex] = useState(0);

    // Reset leadIndex whenever previewLeads changes to prevent out-of-bounds or stale index
    useEffect(() => {
        setLeadIndex(0);
    }, [previewLeads]);

    const [showRecipientsModal, setShowRecipientsModal] = useState(false);
    const [recipientsSearch, setRecipientsSearch] = useState('');

    // Blocks list for in-canvas direct manipulation
    const [blocks, setBlocks] = useState<EmailBlock[]>(() => effectiveInitial.blocks || [
        { id: 'header', type: 'header', label: 'Logo y Encabezado', visible: true },
        { id: 'intro', type: 'intro', label: 'Saludo e Introducción', visible: true },
        { id: 'callout', type: 'callout', label: 'Pregunta Destacada', visible: true },
        { id: 'solution', type: 'solution', label: 'Texto de Solución', visible: true },
        { id: 'leadIn', type: 'leadIn', label: 'Texto antes de Video', visible: true },
        { id: 'videoCard', type: 'videoCard', label: 'Video Demostrativo', visible: true },
        { id: 'ctaButton', type: 'ctaButton', label: 'Botón de Acción (CTA)', visible: true },
        { id: 'closing', type: 'closing', label: 'Párrafo de Despedida', visible: true },
        { id: 'signature', type: 'signature', label: 'Firma Profesional', visible: true }
    ]);

    // 2. Hydrate from props whenever initialStudioState or initialContent changes
    useEffect(() => {
        const stateToLoad = initialStudioState || (initialContent ? parseStudioStateFromHtml(initialContent) : null);
        if (!stateToLoad) return;

        /**
         * Sanitize a loaded text field: replace broken placeholder strings saved
         * from previous sessions where company was null.
         * This ensures campaigns saved with 'Nuestra Empresa' are auto-corrected.
         */
        const sanitize = (text: string | undefined): string | undefined => {
            if (!text) return text;
            let s = text;
            // If company is now known, replace old broken fallbacks with real name
            if (companyDisplayName) {
                s = s.replace(/Nuestra Empresa/g, companyDisplayName)
                     .replace(/contacto@empresa\.com/g, defaultSenderEmail || '');
            }
            return repairTemplateVariables(s, isIclesia);
        };

        if (stateToLoad.campaignName) setCampaignName(stateToLoad.campaignName);
        if (stateToLoad.subject) setSubject(repairTemplateVariables(stateToLoad.subject, isIclesia));
        if (stateToLoad.senderIdentity) setSenderIdentity(stateToLoad.senderIdentity);
        if (stateToLoad.greeting) setGreeting(stateToLoad.greeting);
        if (stateToLoad.introText) setIntroText(repairTemplateVariables(sanitize(stateToLoad.introText) || stateToLoad.introText, isIclesia));
        if (stateToLoad.calloutText) setCalloutText(repairTemplateVariables(sanitize(stateToLoad.calloutText) || stateToLoad.calloutText, isIclesia));
        if (stateToLoad.solutionText) setSolutionText(repairTemplateVariables(sanitize(stateToLoad.solutionText) || stateToLoad.solutionText, isIclesia));
        if (stateToLoad.leadInText) setLeadInText(repairTemplateVariables(stateToLoad.leadInText, isIclesia));
        if (stateToLoad.closingText) setClosingText(repairTemplateVariables(stateToLoad.closingText, isIclesia));
        if (stateToLoad.signoffText) setSignoffText(stateToLoad.signoffText);
        if (stateToLoad.youtubeUrl) setYoutubeUrl(stateToLoad.youtubeUrl);
        if (stateToLoad.videoCaption) setVideoCaption(sanitize(stateToLoad.videoCaption) || stateToLoad.videoCaption);
        if (stateToLoad.thumbMode) setThumbMode(stateToLoad.thumbMode);
        if (stateToLoad.customUploadedThumb) setCustomUploadedThumb(stateToLoad.customUploadedThumb);
        if (stateToLoad.buttonText) setButtonText(sanitize(stateToLoad.buttonText) || stateToLoad.buttonText);
        if (stateToLoad.buttonColor) setButtonColor(stateToLoad.buttonColor);
        if (stateToLoad.buttonLink) setButtonLink(stateToLoad.buttonLink);
        if (typeof stateToLoad.hasLogo === 'boolean') setHasLogo(stateToLoad.hasLogo);
        if (typeof stateToLoad.hasPhoto === 'boolean') setHasPhoto(stateToLoad.hasPhoto);
        if (stateToLoad.photoShape) setPhotoShape(stateToLoad.photoShape);
        if (stateToLoad.avatarUrl) setAvatarUrl(stateToLoad.avatarUrl);
        if (stateToLoad.sigName) setSigName(stateToLoad.sigName);
        if (stateToLoad.sigTitle) setSigTitle(sanitize(stateToLoad.sigTitle) || stateToLoad.sigTitle);
        if (stateToLoad.sigPhone) setSigPhone(stateToLoad.sigPhone);
        if (stateToLoad.sigWebsite) setSigWebsite(stateToLoad.sigWebsite);
        if (stateToLoad.customHeaderLogo) setCustomHeaderLogo(stateToLoad.customHeaderLogo);
        if (stateToLoad.customSigLogo) setCustomSigLogo(stateToLoad.customSigLogo);
        if (stateToLoad.blocks && stateToLoad.blocks.length > 0) setBlocks(stateToLoad.blocks);

        isHydratedRef.current = true;
    }, [initialStudioState, initialContent]);

    // Keep initialName and initialSubject in sync if passed explicitly and not customized
    useEffect(() => {
        if (initialName && (!campaignName || campaignName === 'Prospección - Comercial')) {
            setCampaignName(initialName);
        }
    }, [initialName]);

    useEffect(() => {
        if (initialSubject && (!subject || subject === 'Una pregunta para {{nombre_empresa}}' || subject === 'Una pregunta para {{nombre_iglesia}}')) {
            setSubject(initialSubject);
        }
    }, [initialSubject]);

    // Handle Company Switching / Initialization (ONLY for brand new campaigns, NEVER overwrites custom copy)
    useEffect(() => {
        if (!company) return;
        // Never touch message copy if editing an existing campaign or already hydrated!
        if (campaignId || isHydratedRef.current || initialStudioState || initialContent) return;

        const compIsIclesia = Boolean(company.name?.toLowerCase().includes('iclesia'));
        const compName = company.name?.trim() || (compIsIclesia ? 'Iclesia' : 'Nuestra Empresa');
        const storageKey = `crm_user_signature_${company.id || 'default'}`;

        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.sigName) setSigName(parsed.sigName);
                if (parsed.sigTitle) setSigTitle(parsed.sigTitle);
                if (parsed.sigPhone) setSigPhone(parsed.sigPhone);
                if (parsed.sigWebsite) setSigWebsite(parsed.sigWebsite);
                if (parsed.avatarUrl !== undefined) setAvatarUrl(parsed.avatarUrl);
                if (parsed.photoShape) setPhotoShape(parsed.photoShape);
                if (typeof parsed.hasLogo === 'boolean') setHasLogo(parsed.hasLogo);
                if (typeof parsed.hasPhoto === 'boolean') setHasPhoto(parsed.hasPhoto);
                if (parsed.customHeaderLogo) setCustomHeaderLogo(parsed.customHeaderLogo);
                if (parsed.customSigLogo) setCustomSigLogo(parsed.customSigLogo);
                return;
            } catch { /* ignore */ }
        }

        // Apply clean company defaults for new campaigns
        if (compIsIclesia) {
            setSigName('Jimmy Arias');
            setSigTitle('Founder | Iclesia');
            setSigPhone('703-945-9240');
            setSigWebsite('iclesia.ai');
            setAvatarUrl('/images/marketing/jimmy-avatar.png');
            setSenderIdentity('Jimmy Arias <support@iclesia.ai>');
            setIntroText('Mi nombre es Jimmy Arias de Iclesia y quería hacerles una consulta:');
            setCalloutText('¿Cuentan actualmente en {{nombre_iglesia}} con un proceso ágil para atender y dar seguimiento inmediato a cada visitante o miembro que solicita información?');
            setSolutionText('En Iclesia ayudamos a congregaciones a automatizar el seguimiento de visitas, coordinar a los líderes de grupos y asegurar que ninguna persona se quede sin atención pastoral.');
            setButtonText('Conocer más sobre Iclesia');
            setCampaignName('Prospección - Iglesias');
            setSubject('Una pregunta para {{nombre_iglesia}}');
            setYoutubeUrl('https://youtu.be/dvRSzR1x3os');
            setCustomHeaderLogo('/images/marketing/iclesia-header-logo.png');
            setCustomSigLogo('/images/marketing/iclesia-brand-logo.png');
        } else {
            const senderName = (profile?.full_name && profile.full_name !== 'Platform Owner') ? profile.full_name : compName;
            const senderEmail = company.email || profile?.email || '';
            setSigName(senderName);
            setSigTitle(`${(profile as any)?.job_title || 'Asesor Comercial'} | ${compName}`);
            setSigPhone(company.phone || profile?.phone || '');
            setSigWebsite(company.website ? company.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '');
            setAvatarUrl(profile?.avatar_url || '');
            setSenderIdentity(`${senderName} <${senderEmail}>`);
            setIntroText(`Mi nombre es ${senderName} de ${compName} y quería hacerles una consulta:`);
            setCalloutText(`¿Cuentan actualmente en {{nombre_empresa}} con un proceso ágil para atender y dar seguimiento inmediato a cada cliente que solicita información?`);
            setSolutionText(`En ${compName} ayudamos a empresas a optimizar sus tiempos de respuesta, coordinar al equipo comercial y asegurar que ninguna oportunidad de venta se pierda.`);
            setButtonText(`Conocer más sobre ${compName}`);
            setButtonLink(company.website || 'https://ariascrm.com');
            setCampaignName(`Prospección - ${compName}`);
            setSubject('Una pregunta para {{nombre_empresa}}');
            setYoutubeUrl('');
            setCustomHeaderLogo(company.logo_url || '');
            setCustomSigLogo(company.logo_url || '');
        }
    }, [company?.id, company?.name, campaignId, initialStudioState, initialContent]);

    // Save signature changes per company
    const persistSignature = () => {
        try {
            const storageKey = `crm_user_signature_${company?.id || 'default'}`;
            localStorage.setItem(storageKey, JSON.stringify({
                sigName, sigTitle, sigPhone, sigWebsite, avatarUrl, photoShape, hasLogo, hasPhoto, customHeaderLogo, customSigLogo
            }));
        } catch { /* ignore */ }
    };

    useEffect(() => {
        persistSignature();
    }, [sigName, sigTitle, sigPhone, sigWebsite, avatarUrl, photoShape, hasLogo, hasPhoto, customHeaderLogo, customSigLogo]);

    // Simulated lead resolution
    const validLeadIndex = (previewLeads && previewLeads.length > 0)
        ? Math.min(Math.max(0, leadIndex), previewLeads.length - 1)
        : 0;

    const currentLead = (previewLeads && previewLeads.length > 0 && previewLeads[validLeadIndex])
        ? previewLeads[validLeadIndex]
        : {
            company_name: isIclesia ? 'Iglesia Gateway Community' : 'Clínica Salud Plus',
            name: isIclesia ? 'Jimmy Arias' : 'Dr. Roberto Mendoza',
            email: isIclesia ? 'jarias7604@gmail.com' : 'lead@ejemplo.com',
            city: 'Miami',
            industry: isIclesia ? 'Ministerio Cristiano' : 'Salud y Bienestar'
        };

    const leadRecipientName = currentLead.company_name || currentLead.name || (isIclesia ? 'Iglesia Destinataria' : 'Destinatario');
    const leadRecipientEmail = currentLead.email || currentLead.contact_email || '';

    // Blur handler for contentEditable: converts substituted lead name back to template variable
    const handleTextBlur = (
        e: React.FocusEvent<HTMLElement>,
        setter: (val: string) => void
    ) => {
        let text = e.currentTarget.innerText || '';
        const leadName = (currentLead.company_name && currentLead.company_name !== 'Individual')
            ? currentLead.company_name
            : (currentLead.name || '');

        if (leadName && text.includes(leadName)) {
            text = text.replace(leadName, isIclesia ? '{{nombre_iglesia}}' : '{{nombre_empresa}}');
        }
        setter(repairTemplateVariables(text, isIclesia));
    };

    // Replace variables (STRICTLY SAAS / BUSINESS VARIABLES)
    const substituteVariables = (text: string) => {
        if (!text) return '';
        const companyOrLeadName = (currentLead.company_name && currentLead.company_name !== 'Individual')
            ? currentLead.company_name
            : (currentLead.name || (isIclesia ? 'Su Iglesia' : 'Su Empresa'));
        const firstName = currentLead.name ? currentLead.name.split(' ')[0] : 'Estimado/a';
        const city = currentLead.city || 'su ciudad';
        const industry = currentLead.industry || currentLead.denomination || (isIclesia ? 'Ministerio Cristiano' : 'su rubro');

        return text
            .replace(/{{(nombre_empresa|company_name|empresa|nombre_iglesia|iglesia|congregacion)}}/gi, companyOrLeadName)
            .replace(/{{(first_name|nombre)}}/gi, firstName)
            .replace(/{{(ciudad|city)}}/gi, city)
            .replace(/{{(rubro|industria|denominacion|congregacion)}}/gi, industry);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // UNIVERSAL VARIABLE INSERTION — cursor-aware, works in any field
    // The user clicks anywhere in a text field → positions cursor → clicks a
    // variable button → the variable appears exactly where the cursor was.
    // ─────────────────────────────────────────────────────────────────────────

    // Track the last focused editable element and its setter
    const lastFocusedFieldRef = useRef<{
        type: 'input' | 'contenteditable';
        el: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null;
        setter?: (val: string) => void;
        label?: string;
    } | null>(null);

    /** Register a plain input/textarea as the active target for variable insertion */
    const trackInputFocus = (
        el: HTMLInputElement | HTMLTextAreaElement | null,
        setter: (val: string) => void,
        label: string
    ) => {
        if (!el) return;
        lastFocusedFieldRef.current = { type: 'input', el, setter, label };
    };

    /** Register a contentEditable element as the active target */
    const trackContentEditableFocus = (el: HTMLElement | null, label: string) => {
        if (!el) return;
        lastFocusedFieldRef.current = { type: 'contenteditable', el, label };
    };

    /** Insert variable at cursor position in whichever field the user last touched */
    const insertVariable = (variableTag: string) => {
        const target = lastFocusedFieldRef.current;

        // ── Case 1: contentEditable element (body text blocks) ──────────────
        if (target?.type === 'contenteditable' && target.el) {
            target.el.focus();
            // Use execCommand to insert at caret (works across all browsers for contentEditable)
            const inserted = document.execCommand('insertText', false, variableTag);
            if (!inserted) {
                // Fallback: append at end of element
                target.el.innerText = (target.el.innerText || '') + variableTag;
            }
            // Trigger onBlur manually to sync state
            target.el.dispatchEvent(new Event('blur', { bubbles: true }));
            toast.success(`✅ ${variableTag} insertado en "${target.label}"`, { duration: 2000 });
            return;
        }

        // ── Case 2: regular input / textarea ────────────────────────────────
        if (target?.type === 'input' && target.el && target.setter) {
            const inputEl = target.el as HTMLInputElement | HTMLTextAreaElement;
            inputEl.focus();
            const start = inputEl.selectionStart ?? inputEl.value.length;
            const end = inputEl.selectionEnd ?? inputEl.value.length;
            const before = inputEl.value.slice(0, start);
            const after = inputEl.value.slice(end);
            const newVal = `${before}${variableTag}${after}`;
            target.setter(newVal);
            // Restore cursor position after React re-render
            setTimeout(() => {
                const newPos = start + variableTag.length;
                inputEl.setSelectionRange(newPos, newPos);
                inputEl.focus();
                if (inputEl === subjectInputRef.current) {
                    inputEl.scrollLeft = inputEl.scrollWidth;
                }
            }, 20);
            toast.success(`✅ ${variableTag} insertado en "${target.label}"`, { duration: 2000 });
            return;
        }

        // ── Fallback: no field focused → append to subject ──────────────────
        if (subject.includes(variableTag)) {
            toast.error(`¿Ya está! ${variableTag} ya aparece en el asunto`, { duration: 2500 });
            setTimeout(() => {
                if (subjectInputRef.current) {
                    subjectInputRef.current.focus();
                    subjectInputRef.current.scrollLeft = subjectInputRef.current.scrollWidth;
                }
            }, 50);
            return;
        }
        setSubject(prev => `${prev} ${variableTag}`.trim());
        toast.success(`✅ ${variableTag} agregado al asunto`, { duration: 2000 });
        setTimeout(() => {
            if (subjectInputRef.current) {
                subjectInputRef.current.focus();
                subjectInputRef.current.scrollLeft = subjectInputRef.current.scrollWidth;
            }
        }, 50);
    };

    // Legacy alias — keeps existing "Insertar Variable en Asunto" buttons working,
    // but now they also respect cursor position if the subject field is focused.
    const insertVariableIntoSubject = (variableTag: string) => insertVariable(variableTag);

    // In-canvas block movement
    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= blocks.length) return;
        const newBlocks = [...blocks];
        const [moved] = newBlocks.splice(index, 1);
        newBlocks.splice(targetIndex, 0, moved);
        setBlocks(newBlocks);
        toast.success(`Bloque "${moved.label}" movido`, { duration: 1200 });
    };

    // Toggle block visibility
    const toggleBlockVisibility = (index: number) => {
        const newBlocks = [...blocks];
        newBlocks[index].visible = !newBlocks[index].visible;
        setBlocks(newBlocks);
        toast(newBlocks[index].visible ? 'Bloque visible' : 'Bloque oculto', { icon: newBlocks[index].visible ? '👁️' : '🚫' });
    };

    // Upload custom avatar
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingPhoto(true);
            const userId = profile?.id || 'user';
            const publicUrl = await storageService.uploadAvatar(userId, file);
            if (publicUrl) {
                setAvatarUrl(publicUrl);
                toast.success('Foto actualizada con éxito');
            }
        } catch (err: any) {
            console.error(err);
            const reader = new FileReader();
            reader.onload = () => {
                setAvatarUrl(reader.result as string);
                toast.success('Foto cargada');
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    /**
     * Composites the executive 16:9 crop and a high-resolution centered play button
     * badge directly into the image pixels using HTML5 Canvas.
     * Guarantees 100% bulletproof rendering across ALL email clients (Outlook Desktop, New Outlook, Gmail, Apple Mail)
     * with ZERO broken CSS overlays, ZERO white bars, and ZERO black bars.
     */
    const compositePlayBadgeOnImage = (imageSource: string | File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const targetW = 800;
                    const targetH = 450; // Exact 16:9
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Canvas 2D context not available'));
                        return;
                    }

                    // 1. Draw image with object-fit: cover (fill 16:9 canvas cleanly)
                    const scale = Math.max(targetW / img.width, targetH / img.height);
                    const x = (targetW / 2) - (img.width / 2) * scale;
                    const y = (targetH / 2) - (img.height / 2) * scale;
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                    // 2. Center coordinates
                    const cx = targetW / 2;
                    const cy = targetH / 2;
                    const radius = 54;

                    // 3. Drop shadow for the play button
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
                    ctx.shadowBlur = 20;
                    ctx.shadowOffsetY = 6;

                    // 4. Vibrant blue circle
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#0066FF';
                    ctx.fill();

                    // 5. Reset shadow before drawing triangle
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    // 6. Crisp centered white play triangle
                    ctx.beginPath();
                    const triH = 22;
                    const triW = 20;
                    ctx.moveTo(cx - triW * 0.5 + 3, cy - triH);
                    ctx.lineTo(cx + triW * 0.8 + 3, cy);
                    ctx.lineTo(cx - triW * 0.5 + 3, cy + triH);
                    ctx.closePath();
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fill();

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Failed to create blob from canvas'));
                    }, 'image/jpeg', 0.92);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image for compositing'));

            if (typeof imageSource === 'string') {
                img.src = imageSource;
            } else {
                const reader = new FileReader();
                reader.onload = () => { img.src = reader.result as string; };
                reader.readAsDataURL(imageSource);
            }
        });
    };

    // Upload custom video thumbnail — automatically composites the centered play button badge!
    const handleVideoThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingThumb(true);
            const userId = profile?.id || 'marketing';
            
            // Auto-composite play button badge into the image pixels
            let fileToUpload: File | Blob = file;
            try {
                const compositedBlob = await compositePlayBadgeOnImage(file);
                fileToUpload = new File([compositedBlob], `video_thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
            } catch (compErr) {
                console.warn('Could not composite play badge, uploading raw image:', compErr);
            }

            const publicUrl = await storageService.uploadAvatar(userId, fileToUpload as File);
            if (publicUrl) {
                setCustomUploadedThumb(publicUrl);
                setThumbMode('custom');
                toast.success('Portada con botón Play generada e integrada con éxito');
            }
        } catch (err: any) {
            console.error('Error uploading thumb:', err);
            toast.error('Error al subir la portada');
        } finally {
            setIsUploadingThumb(false);
        }
    };

    // Upload custom header logo (syncs to signature logo by default so user doesn't have to upload twice)
    const handleHeaderLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingLogo(true);
            const compId = company?.id || profile?.company_id || 'marketing';
            const publicUrl = await storageService.uploadAvatar(compId, file);
            if (publicUrl) {
                setCustomHeaderLogo(publicUrl);
                setCustomSigLogo(publicUrl);
                toast.success('Logo del correo y firma actualizados con éxito');
            }
        } catch (err: any) {
            console.error(err);
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                setCustomHeaderLogo(dataUrl);
                setCustomSigLogo(dataUrl);
                toast.success('Logo del correo cargado');
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    // Upload custom signature logo specifically
    const handleSigLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingSigLogo(true);
            const compId = company?.id || profile?.company_id || 'marketing';
            const publicUrl = await storageService.uploadAvatar(compId, file);
            if (publicUrl) {
                setCustomSigLogo(publicUrl);
                toast.success('Logo de la firma actualizado con éxito');
            }
        } catch (err: any) {
            console.error(err);
            const reader = new FileReader();
            reader.onload = () => {
                setCustomSigLogo(reader.result as string);
                toast.success('Logo de la firma cargado');
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploadingSigLogo(false);
        }
    };

    // Compile to ultra-clean, bulletproof Email HTML (Gmail, Apple Mail, Outlook compatible)
    const compileToEmailHtml = () => {
        const photoBorderRadius = photoShape === 'circle' ? '50%' : photoShape === 'rounded' ? '12px' : '0px';
        const cleanPhone = sigPhone.replace(/\D/g, '');
        const cleanWeb = sigWebsite.replace(/^https?:\/\//, '');

        let html = `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:#F8FAFC;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;">
    <tr>
      <td align="center">
        <!-- Main Email Container (600px Max Width) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:24px;border:1px solid #E2E8F0;box-shadow:0 10px 30px rgba(0,0,0,0.04);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 40px 32px;">
`;

        blocks.forEach((block) => {
            if (!block.visible) return;

            switch (block.type) {
                case 'header': {
                    const headerLogoImg = effectiveHeaderLogo
                        ? (effectiveHeaderLogo.startsWith('/') ? 'https://raw.githubusercontent.com/Jarias7604/crm-app/develop/public' + effectiveHeaderLogo : effectiveHeaderLogo)
                        : '';
                    html += `
              <!-- Header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    ${headerLogoImg
                        ? `<img src="${headerLogoImg}" alt="${companyName}" height="36" style="height:36px;max-height:42px;width:auto;display:block;border:0;object-fit:contain;" />`
                        : `<div style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#0F172A;letter-spacing:-0.5px;">${companyName}</div>`
                    }
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <a href="https://${cleanWeb}" target="_blank" style="font-size:12px;color:#94A3B8;text-decoration:none;font-weight:500;">Ver en el navegador</a>
                  </td>
                </tr>
              </table>
`;
                    break;
                }

                case 'intro':
                    html += `
              <!-- Intro -->
              <div style="margin-bottom:20px;">
                <p style="margin:0 0 10px 0;font-size:16px;font-weight:bold;color:#0F172A;line-height:1.4;">${greeting}</p>
                <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">${introText}</p>
              </div>
`;
                    break;

                case 'callout':
                    html += `
              <!-- Callout Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background-color:#EFF6FF;border:1px solid #DBEAFE;border-radius:18px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:top;width:36px;padding-right:14px;">
                          <div style="width:32px;height:32px;border-radius:50%;background-color:#0066FF;color:#FFFFFF;text-align:center;line-height:32px;font-size:16px;font-weight:bold;font-family:Arial,sans-serif;">?</div>
                        </td>
                        <td style="vertical-align:top;">
                          <p style="margin:0;font-size:15px;font-weight:800;color:#0F172A;line-height:1.5;">${calloutText}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
`;
                    break;

                case 'solution':
                    html += `
              <!-- Solution Text -->
              <p style="margin:0 0 18px 0;font-size:15px;color:#334155;line-height:1.65;">${solutionText}</p>
`;
                    break;

                case 'leadIn':
                    html += `
              <!-- Lead-in -->
              <p style="margin:0 0 16px 0;font-size:15px;font-weight:bold;color:#0F172A;line-height:1.5;">${leadInText}</p>
`;
                    break;

                case 'videoCard': {
                    const videoThumbImg = effectiveVideoThumb
                        ? (effectiveVideoThumb.startsWith('/')
                            ? 'https://raw.githubusercontent.com/Jarias7604/crm-app/develop/public' + effectiveVideoThumb
                            : effectiveVideoThumb)
                        : '';
                    html += `
              <!-- Video Card (Clean Linked 16:9 Thumbnail with Baked Play Button) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto 24px auto;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:380px;margin:0 auto;">
                      <tr>
                        <td align="center" style="line-height:0;font-size:0;">
                          <a href="${youtubeUrl}" target="_blank" style="display:block;text-decoration:none;outline:none;border:0;line-height:0;font-size:0;">
                            <img src="${videoThumbImg}" alt="Ver Video" width="380" style="display:block;width:100%;max-width:380px;height:auto;border-radius:18px;margin:0 auto;border:0;box-shadow:0 10px 28px rgba(0,0,0,0.15);" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
`;
                    break;
                }

                case 'ctaButton':
                    html += `
              <!-- CTA Button (Bulletproof VML for Outlook + Modern Pill for Webmail) -->
              <div style="margin:24px 0 28px 0;text-align:center;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${buttonLink || youtubeUrl}" style="height:52px;v-text-anchor:middle;width:380px;" arcsize="50%" fillcolor="${buttonColor}" stroke="f">
                  <w:anchorlock/>
                  <center style="color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:0.3px;">
                    &#9654;&nbsp;&nbsp;${buttonText}&nbsp;&nbsp;&gt;
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td align="center" bgcolor="${buttonColor}" style="border-radius:9999px;background-color:${buttonColor};box-shadow:0 8px 24px rgba(0,102,255,0.32);">
                      <a href="${buttonLink || youtubeUrl}" target="_blank" style="display:inline-block;padding:16px 38px;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;letter-spacing:0.3px;border-radius:9999px;mso-padding-alt:0;">
                        &#9654;&nbsp;&nbsp;${buttonText}&nbsp;&nbsp;&gt;
                      </a>
                    </td>
                  </tr>
                </table>
                <!--<![endif]-->
              </div>
`;
                    break;

                case 'closing':
                    html += `
              <!-- Closing -->
              <div style="margin:20px 0 26px 0;">
                <p style="margin:0 0 12px 0;font-size:14.5px;color:#334155;line-height:1.6;">${closingText}</p>
                <p style="margin:0;font-size:14.5px;font-weight:bold;color:#0F172A;">${signoffText}</p>
              </div>
`;
                    break;

                case 'signature':
                    html += `
              <!-- Signature -->
              <div style="padding-top:20px;border-top:1px solid #E2E8F0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${hasPhoto && avatarUrl ? `
                    <td style="vertical-align:middle;width:54px;padding-right:10px;">
                      <img src="${avatarUrl.startsWith('/') ? 'https://raw.githubusercontent.com/Jarias7604/crm-app/develop/public' + avatarUrl : avatarUrl}" alt="${sigName}" width="50" height="50" style="display:block;width:50px;height:50px;border-radius:${photoBorderRadius};object-fit:cover;border:1px solid #E2E8F0;" />
                    </td>
                    <td style="vertical-align:middle;width:1px;padding:0 12px 0 2px;">
                      <div style="width:1.5px;height:38px;background-color:#E2E8F0;font-size:1px;line-height:1px;">&nbsp;</div>
                    </td>
                    ` : ''}
                    <td style="vertical-align:middle;">
                      <div style="font-size:15px;font-weight:800;color:#0F172A;line-height:1.2;">${sigName}</div>
                      <div style="font-size:12px;font-weight:600;color:#64748B;margin-top:2px;">${sigTitle}</div>
                      <div style="font-size:12.5px;color:#334155;margin-top:4px;">
                        ${sigPhone ? `<a href="tel:${cleanPhone}" style="color:#334155;text-decoration:none;font-weight:500;">${sigPhone}</a>` : ''}
                        ${sigPhone && sigWebsite ? '&nbsp;•&nbsp;' : ''}
                        ${sigWebsite ? `<a href="https://${cleanWeb}" target="_blank" style="color:#0066FF;text-decoration:none;font-weight:bold;">${sigWebsite}</a>` : ''}
                      </div>
                    </td>
                    ${hasLogo ? `
                    <td align="right" style="vertical-align:middle;padding-left:14px;">
                      ${effectiveSigLogo
                          ? `<img src="${effectiveSigLogo.startsWith('/') ? 'https://raw.githubusercontent.com/Jarias7604/crm-app/develop/public' + effectiveSigLogo : effectiveSigLogo}" alt="${companyName}" height="32" style="height:32px;max-height:36px;width:auto;display:block;border:0;object-fit:contain;" />`
                          : `<div style="font-family:Arial,sans-serif;font-size:14px;font-weight:900;color:#0F172A;">${companyName}</div>`
                      }
                    </td>
                    ` : ''}
                  </tr>
                </table>
              </div>
`;
                    break;
            }
        });

        html += `
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
        return html;
    };

        // Template Presets
    const applyChurchTemplate = () => {
        setSubject('Una pregunta para {{nombre_iglesia}}');
        setCalloutText('¿Cuentan actualmente en {{nombre_iglesia}} con un proceso ágil para atender y dar seguimiento inmediato a cada visitante o miembro que solicita información?');
        setIntroText(`Mi nombre es ${sigName || 'Jimmy Arias'} de Iclesia y quería hacerles una consulta:`);
        setSolutionText('En Iclesia ayudamos a congregaciones a automatizar el seguimiento de visitas, coordinar a los líderes de grupos y asegurar que ninguna persona se quede sin atención pastoral.');
        setButtonText('Conocer más sobre Iclesia');
        setLeadInText('Les comparto un breve video de 45 segundos para mostrarles cómo funciona:');
        setClosingText('Si esto es algo que desean mejorar en su congregación, pueden responder directamente a este correo. Con gusto coordinamos una breve conversación.');
        setCampaignName('Prospección - Iglesias');
        toast.success('⛪ Plantilla para iglesias aplicada');
    };

    const applyBusinessTemplate = () => {
        setSubject('Una pregunta para {{nombre_empresa}}');
        setCalloutText('¿Cuentan actualmente en {{nombre_empresa}} con un proceso ágil para atender y dar seguimiento inmediato a cada cliente que solicita información?');
        setIntroText(`Mi nombre es ${defaultSenderName} de ${companyName} y quería hacerles una consulta:`);
        setSolutionText(`En ${companyName} ayudamos a empresas a optimizar sus tiempos de respuesta, coordinar al equipo comercial y asegurar que ninguna oportunidad de venta se pierda.`);
        setButtonText(`Conocer más sobre ${companyName}`);
        setLeadInText('Les comparto un breve video de 45 segundos para mostrarles cómo funciona:');
        setClosingText('Si esto es algo que desean mejorar en su empresa, pueden responder directamente a este correo. Con gusto coordinamos una breve conversación.');
        setCampaignName(`Prospección - ${companyName}`);
        toast.success('🏢 Plantilla para empresas aplicada');
    };

    const getCurrentStudioState = (): ProspectingStudioState => ({
        campaignName,
        subject,
        senderIdentity,
        greeting,
        introText,
        calloutText,
        solutionText,
        leadInText,
        closingText,
        signoffText,
        youtubeUrl,
        videoCaption,
        thumbMode,
        customUploadedThumb,
        buttonText,
        buttonColor,
        buttonLink,
        hasLogo,
        hasPhoto,
        photoShape,
        avatarUrl,
        sigName,
        sigTitle,
        sigPhone,
        sigWebsite,
        customHeaderLogo,
        customSigLogo,
        blocks
    });

    // Save Draft
    const handleTriggerSave = async () => {
        try {
            setIsSaving(true);
            const html = compileToEmailHtml();
            const studioState = getCurrentStudioState();
            try {
                const companyDraftKey = company?.id ? `crm_prospecting_studio_new_${company.id}` : 'crm_prospecting_studio_new_default';
                const key = campaignId ? `crm_prospecting_studio_${campaignId}` : companyDraftKey;
                localStorage.setItem(key, JSON.stringify(studioState));
            } catch { /* ignore */ }
            isHydratedRef.current = true;
            await onSaveDraft({
                name: campaignName,
                subject: subject,
                htmlContent: html,
                studioState
            });
        } finally {
            setIsSaving(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════════════════
    // PRE-SEND VALIDATION — 4-layer protection against sending broken emails
    // ══════════════════════════════════════════════════════════════════════════════

    const [showSendGateModal, setShowSendGateModal] = useState(false);
    const [sendGateIssues, setSendGateIssues] = useState<string[]>([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [hasTestedSend, setHasTestedSend] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Forbidden fallback strings that must NEVER appear in a sent email
    const FORBIDDEN_FALLBACKS = [
        { text: 'Nuestra Empresa', label: '"Nuestra Empresa" — el nombre real de tu empresa no se cargó correctamente' },
        { text: 'contacto@empresa.com', label: '"contacto@empresa.com" — email de contacto sin configurar' },
        { text: 'tu empresa', label: '"tu empresa" — texto de relleno sin sustituir' },
    ];

    /** Scans compiled HTML + subject for all critical issues before sending */
    const validateBeforeSend = (html: string, subjectLine: string): string[] => {
        const issues: string[] = [];

        // 1. Subject cannot be empty
        if (!subjectLine || !subjectLine.trim()) {
            issues.push('⛔ CRÍTICO: El asunto del correo está vacío.');
        }

        // 2. Scan for forbidden fallback text in body
        FORBIDDEN_FALLBACKS.forEach(({ text, label }) => {
            if (html.includes(text)) {
                issues.push(`⛔ CRÍTICO: El cuerpo contiene ${label}. Este texto llegaría así al destinatario.`);
            }
        });

        // 3. Check for broken/unfilled signature fields
        if (sigTitle.includes('Nuestra Empresa') || sigTitle.includes('undefined')) {
            issues.push('⛔ CRÍTICO: La firma contiene texto incorrecto en el cargo/empresa.');
        }

        return issues;
    };

    /** Send a real test copy of the email to the user's own address via Resend */
    const handleSendTestEmail = async () => {
        const testEmail = profile?.email;
        if (!testEmail) {
            toast.error('No se encontró tu email de perfil para el envío de prueba.');
            return;
        }
        try {
            setIsSendingTest(true);

            // Auto-bake centered play button badge into custom thumbnail if not already baked
            if (customUploadedThumb && !customUploadedThumb.includes('video-preview') && !customUploadedThumb.includes('video_thumb_')) {
                try {
                    const compositedBlob = await compositePlayBadgeOnImage(customUploadedThumb);
                    const fileToUpload = new File([compositedBlob], `video_thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const userId = profile?.id || 'marketing';
                    const publicUrl = await storageService.uploadAvatar(userId, fileToUpload);
                    if (publicUrl) {
                        setCustomUploadedThumb(publicUrl);
                    }
                } catch (e) {
                    console.warn('Auto composite on test send skipped:', e);
                }
            }

            const rawHtml = compileToEmailHtml();
            const studioState = getCurrentStudioState();
            // Save draft first
            await onSaveDraft({ name: campaignName, subject: subject, htmlContent: rawHtml, studioState });

            // Bulletproof: Resolve variables for the active lead so the test email matches the live preview 100%
            const resolvedSubject = substituteVariables(subject);
            const resolvedHtml = substituteVariables(rawHtml);

            // ACTUALLY dispatch the test email through marketing-engine
            const toastId = toast.loading(`Enviando correo de prueba a ${testEmail}...`);
            const result = await campaignService.sendTestEmail({
                campaignId: campaignId || undefined,
                testEmail,
                subject: resolvedSubject,
                htmlContent: resolvedHtml,
                companyId: company?.id || profile?.company_id,
                sampleLead: currentLead || undefined
            });

            toast.dismiss(toastId);
            toast.success(result?.message || `¡Correo de prueba enviado a ${testEmail}! Revisa tu bandeja de entrada o spam.`, { duration: 6000, icon: '📬' });
            setHasTestedSend(true);
        } catch (err: any) {
            console.error('Error enviando prueba:', err);
            toast.error(`Error al enviar prueba: ${err.message || 'Error desconocido'}`);
        } finally {
            setIsSendingTest(false);
        }
    };

    // Send Campaign — with full pre-send validation gate
    const handleTriggerSend = async () => {
        const html = compileToEmailHtml();
        const issues = validateBeforeSend(html, subject);

        // Block send if CRITICAL issues found (forbidden text or empty subject)
        const criticalIssues = issues.filter(i => i.startsWith('⛔'));
        if (criticalIssues.length > 0) {
            setSendGateIssues(issues);
            setShowSendGateModal(true);
            return; // HARD STOP — do not proceed
        }

        // If only warnings (unresolved vars, large audience), show gate with option to proceed
        if (issues.length > 0) {
            setSendGateIssues(issues);
            setShowSendGateModal(true);
            return;
        }

        // All checks pass — show final confirmation preview
        setShowPreviewModal(true);
    };

    const executeFinalSend = async () => {
        setShowPreviewModal(false);
        try {
            setIsSending(true);
            const html = compileToEmailHtml();
            const studioState = getCurrentStudioState();
            await onSendCampaign({
                name: campaignName,
                subject: subject,
                htmlContent: html,
                studioState
            });
        } finally {
            setIsSending(false);
        }
    };


    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Hidden file input for photo upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
            />

            {/* Hidden file input for custom video thumbnail */}
            <input
                ref={videoThumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleVideoThumbUpload}
            />

            {/* ── UNIFIED EXECUTIVE HEADER BAR ── */}
            <div className="bg-white px-6 py-3.5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                {/* Back button & Title */}
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition"
                            title="Regresar"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black text-gray-900 tracking-tight">Diseñador de Email</h1>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                Prospección SaaS
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium">Haz clic directamente en el correo para editar el texto</p>
                    </div>
                </div>

                {/* Device Selector, Lead Simulation & Actions */}
                <div className="flex items-center flex-wrap gap-2.5">
                    {/* View Switcher: Desktop / Mobile / Dual */}
                    <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('desktop')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'desktop' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Monitor className="w-3.5 h-3.5" /> Escritorio
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('mobile')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'mobile' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Smartphone className="w-3.5 h-3.5" /> Móvil
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('dual')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'dual' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Maximize2 className="w-3.5 h-3.5" /> Dual
                        </button>
                    </div>

                    {/* Simulated Lead Pill */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs font-semibold text-blue-900 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                        <span className="text-[11px] text-gray-500 font-bold">{isIclesia ? 'Iglesia:' : 'Empresa:'}</span>
                        <strong className="max-w-[170px] truncate text-blue-900" title={leadRecipientName}>
                            {leadRecipientName}
                        </strong>
                        {previewLeads && previewLeads.length > 1 && (
                            <div className="flex items-center gap-1 border-l border-blue-200 pl-2">
                                <span className="text-[10px] text-blue-700 font-black tracking-tight whitespace-nowrap">
                                    {validLeadIndex + 1} de {previewLeads.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setLeadIndex(prev => (prev - 1 + previewLeads.length) % previewLeads.length)}
                                    className="p-1 text-blue-700 hover:text-blue-950 hover:bg-blue-100 rounded-md transition"
                                    title="Ver anterior destinatario"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLeadIndex(prev => (prev + 1) % previewLeads.length)}
                                    className="p-1 text-blue-700 hover:text-blue-950 hover:bg-blue-100 rounded-md transition"
                                    title="Ver siguiente destinatario"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Template Quick Presets */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={applyChurchTemplate}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                            title="Cargar plantilla redactada para Iglesias / Congregaciones"
                        >
                            ⛪ Plantilla Iglesias
                        </button>
                        <button
                            type="button"
                            onClick={applyBusinessTemplate}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                            title="Cargar plantilla redactada para Empresas Comerciales"
                        >
                            🏢 Plantilla Empresas
                        </button>
                    </div>

                    {/* Quick Save Button in Top Bar */}
                    <button
                        type="button"
                        onClick={handleTriggerSave}
                        disabled={isSaving}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        title="Guardar borrador actual"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? 'Guardando...' : 'Guardar Borrador'}
                    </button>

                    {/* Quick Test Email Button in Top Bar */}
                    <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={isSendingTest}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        title={profile?.email ? `Enviar prueba real a ${profile.email}` : 'Enviar prueba a mi correo'}
                    >
                        <Mail className="w-3.5 h-3.5" />
                        {isSendingTest ? 'Enviando...' : 'Enviar Prueba'}
                    </button>

                    {/* Audience Button */}
                    {onOpenAudienceModal && (
                        <button
                            type="button"
                            onClick={onOpenAudienceModal}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                            <Eye className="w-3.5 h-3.5 text-blue-400" /> Audiencia ({reachCount})
                        </button>
                    )}

                    {/* Switch to free editor */}
                    {onSwitchToFreeEditor && (
                        <button
                            type="button"
                            onClick={onSwitchToFreeEditor}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                            title="Cambiar a editor HTML libre"
                        >
                            <FileText className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── MAIN WORKSPACE: COMPACT SIDEBAR (25-30%) + EXPANSIVE EMAIL CANVAS (70-75%) ── */}
            <div className="flex flex-col lg:flex-row items-start gap-6">

                {/* ── LEFT CONFIG PANEL: COMPACT, FRIENDLY, NO CONFUSING MODALS ── */}
                <div className="w-full lg:w-[320px] shrink-0 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4 text-left">
                    <div className="pb-2 border-b border-gray-100">
                        <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">Ajustes Principales</h2>
                        <p className="text-[11px] text-gray-400 font-medium">Configura los datos del mensaje</p>
                    </div>

                    {/* 1. Logo del Correo (Header Brand) */}
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                                Logo del Correo
                            </label>
                            <span className="text-[10px] text-gray-500 font-bold truncate max-w-[120px]" title={companyName}>
                                {companyName}
                            </span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-gray-200">
                            {effectiveHeaderLogo ? (
                                <img src={effectiveHeaderLogo} alt="Logo" className="h-7 max-h-7 max-w-[100px] object-contain" />
                            ) : (
                                <div className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                                    {companyName}
                                </div>
                            )}
                            <div className="flex-1 text-right flex items-center justify-end gap-1">
                                {customHeaderLogo && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCustomHeaderLogo('');
                                            setCustomSigLogo('');
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 bg-gray-100 rounded-lg transition"
                                        title="Restaurar logo predeterminado de la empresa"
                                    >
                                        Restaurar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={isUploadingLogo}
                                    className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                >
                                    {isUploadingLogo ? 'Subiendo...' : (effectiveHeaderLogo ? 'Cambiar Logo' : 'Subir Logo')}
                                </button>
                            </div>
                        </div>
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={handleHeaderLogoUpload}
                        />
                    </div>

                    {/* 2. Nombre Interno */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Nombre de Campaña
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            placeholder="Prospección - Visitas (Video)"
                        />
                    </div>

                    {/* 2. Asunto del Correo */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Asunto del Correo
                        </label>
                        <input
                            ref={subjectInputRef}
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            onFocus={(e) => trackInputFocus(e.currentTarget, setSubject, 'Asunto del Correo')}
                            placeholder="Una pregunta para {{nombre_empresa}}"
                        />
                    </div>

                    {/* 3. Variables de Empresa (STRICTLY SAAS / BUSINESS) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-gray-600">
                                Insertar Variable
                            </label>
                            <span className="text-[10px] text-blue-500 font-semibold">
                                Clic en un campo de texto, posiciona el cursor, luego presiona la variable
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { tag: isIclesia ? '{{nombre_iglesia}}' : '{{nombre_empresa}}', label: isIclesia ? 'Iglesia' : 'Empresa' },
                                { tag: '{{first_name}}', label: 'Contacto' },
                                { tag: '{{ciudad}}', label: 'Ciudad' },
                                { tag: '{{rubro}}', label: 'Rubro / Industria' }
                            ].map((v) => (
                                <button
                                    key={v.tag}
                                    type="button"
                                    onClick={() => insertVariableIntoSubject(v.tag)}
                                    className={`flex items-center justify-between px-2.5 py-1.5 border rounded-lg text-[11px] font-bold transition text-left group ${
                                        subject.includes(v.tag)
                                            ? 'bg-green-50 border-green-300 text-green-700 cursor-default'
                                            : 'bg-blue-50/70 hover:bg-blue-100 border-blue-200/60 text-blue-700'
                                    }`}
                                    title={subject.includes(v.tag) ? `${v.tag} ya está en el asunto` : `Añadir ${v.tag} al asunto`}
                                >
                                    <span className="truncate">{v.label}</span>
                                    {subject.includes(v.tag)
                                        ? <Check className="w-3 h-3 text-green-600 shrink-0 ml-1" />
                                        : <Plus className="w-3 h-3 text-blue-600 group-hover:scale-125 transition-transform shrink-0 ml-1" />
                                    }
                                </button>
                            ))}
                        </div>
                        {/* Live preview of what the subject looks like */}
                        {subject && (
                            <p className="text-[10px] text-gray-400 mt-1.5 truncate">
                                Vista previa: <span className="font-semibold text-gray-600">{subject}</span>
                            </p>
                        )}
                    </div>

                    {/* 4. Video de YouTube */}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                        <label className="block text-[11px] font-bold text-gray-600">
                            Enlace del Video (YouTube)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={youtubeUrl}
                                onChange={(e) => {
                                    setYoutubeUrl(e.target.value);
                                    setButtonLink(e.target.value);
                                }}
                                placeholder="https://youtu.be/..."
                            />
                            <LinkIcon className="w-3.5 h-3.5 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Selector de Portada: Predeterminada con Play vs Subir Propia */}
                        <div className="pt-1 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Portada:</span>
                            <div className="flex bg-gray-100 rounded-lg p-0.5 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setThumbMode('default');
                                        setCustomUploadedThumb('');
                                    }}
                                    className={`px-2 py-0.5 rounded font-bold transition ${thumbMode !== 'custom' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Con Botón Play
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setThumbMode('custom');
                                        videoThumbInputRef.current?.click();
                                    }}
                                    className={`px-2 py-0.5 rounded font-bold transition ${thumbMode === 'custom' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    {isUploadingThumb ? 'Subiendo...' : 'Subir Propia'}
                                </button>
                            </div>
                        </div>
                        {thumbMode !== 'custom' && (
                            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Portada oficial con botón Play integrada
                            </p>
                        )}
                        {thumbMode === 'custom' && customUploadedThumb && (
                            <p className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Portada personalizada activa (con Play)
                            </p>
                        )}
                    </div>

                    {/* 5. Botón de Acción (CTA) */}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                        <label className="block text-[11px] font-bold text-gray-600">
                            Texto del Botón de Acción
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={buttonText}
                            onChange={(e) => setButtonText(e.target.value)}
                            placeholder={isIclesia ? 'Ver cómo funciona Iclesia' : `Conocer más sobre ${companyName}`}
                        />
                        <div className="flex items-center gap-2 p-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                            <input
                                type="color"
                                value={buttonColor}
                                onChange={(e) => setButtonColor(e.target.value)}
                                className="w-6 h-6 rounded-lg border-0 cursor-pointer p-0"
                            />
                            <span className="text-xs font-bold text-gray-700">
                                {buttonColor === '#0066FF' ? 'Azul Corporativo' : buttonColor}
                            </span>
                        </div>
                    </div>

                    {/* 6. Firma y Foto */}
                    <div className="pt-2 border-t border-gray-100 space-y-2.5">
                        <label className="block text-[11px] font-bold text-gray-600">
                            Firma Personal
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                                <span className="text-xs font-bold text-gray-700">Con Logo</span>
                                <input
                                    type="checkbox"
                                    checked={hasLogo}
                                    onChange={(e) => setHasLogo(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                            </label>
                            <label className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                                <span className="text-xs font-bold text-gray-700">Con Foto</span>
                                <input
                                    type="checkbox"
                                    checked={hasPhoto}
                                    onChange={(e) => setHasPhoto(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                            </label>
                        </div>

                        {hasLogo && (
                            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Logo de la Firma:</span>
                                    {effectiveSigLogo ? (
                                        <img src={effectiveSigLogo} alt="Logo Firma" className="h-5 max-h-5 max-w-[80px] object-contain" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-gray-700">{companyName}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {customSigLogo && (
                                        <button
                                            type="button"
                                            onClick={() => setCustomSigLogo('')}
                                            className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 transition"
                                            title="Restaurar logo predeterminado de la firma"
                                        >
                                            Restaurar
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => sigLogoInputRef.current?.click()}
                                        disabled={isUploadingSigLogo}
                                        className="flex-1 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 flex items-center justify-center gap-1.5 transition"
                                    >
                                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                                        {isUploadingSigLogo ? 'Subiendo...' : (effectiveSigLogo ? 'Cambiar Logo de Firma' : 'Subir Logo de Firma')}
                                    </button>
                                </div>
                                <input
                                    ref={sigLogoInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="hidden"
                                    onChange={handleSigLogoUpload}
                                />
                            </div>
                        )}

                        {hasPhoto && (
                            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Forma:</span>
                                    <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 text-[10px]">
                                        <button
                                            type="button"
                                            onClick={() => setPhotoShape('circle')}
                                            className={`px-2 py-0.5 rounded font-bold ${photoShape === 'circle' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                                        >
                                            Círculo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPhotoShape('rounded')}
                                            className={`px-2 py-0.5 rounded font-bold ${photoShape === 'rounded' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                                        >
                                            Curvo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPhotoShape('square')}
                                            className={`px-2 py-0.5 rounded font-bold ${photoShape === 'square' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                                        >
                                            Cuadrado
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingPhoto}
                                    className="w-full py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 flex items-center justify-center gap-1.5 transition"
                                >
                                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                                    {isUploadingPhoto ? 'Subiendo...' : 'Cambiar Foto'}
                                </button>
                            </div>
                        )}

                        {/* Campos de Texto de la Firma */}
                        <div className="pt-2 border-t border-gray-200/60 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Nombre:</label>
                                    <input
                                        type="text"
                                        value={sigName}
                                        onChange={(e) => setSigName(e.target.value)}
                                        placeholder="Tu Nombre"
                                        className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Cargo / Rol:</label>
                                    <input
                                        type="text"
                                        value={sigTitle}
                                        onChange={(e) => setSigTitle(e.target.value)}
                                        placeholder="Cargo | Empresa"
                                        className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Teléfono:</label>
                                    <input
                                        type="text"
                                        value={sigPhone}
                                        onChange={(e) => setSigPhone(e.target.value)}
                                        placeholder="+1 555 000-0000"
                                        className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Sitio Web:</label>
                                    <input
                                        type="text"
                                        value={sigWebsite}
                                        onChange={(e) => setSigWebsite(e.target.value)}
                                        placeholder="miempresa.com"
                                        className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                        <button
                            type="button"
                            onClick={handleTriggerSave}
                            disabled={isSaving}
                            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {isSaving ? 'Guardando...' : 'Guardar Borrador'}
                        </button>
                        <button
                            type="button"
                            onClick={handleTriggerSend}
                            disabled={isSending}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            <Send className="w-3.5 h-3.5" />
                            {isSending ? 'Enviando...' : 'Enviar Campaña'}
                        </button>
                    </div>
                </div>

                {/* ── RIGHT STUDIO CANVAS: THE EMAIL IS THE HERO (EXPANSIVE WIDTH) ── */}
                <div className="flex-1 w-full min-w-0">
                    <div className={`w-full flex flex-wrap items-start ${viewMode === 'mobile' ? 'justify-center' : 'justify-start'} gap-6`}>

                        {/* ── DESKTOP VIEW (AUTHENTIC MACOS WINDOW) ── */}
                        {(viewMode === 'desktop' || viewMode === 'dual') && (
                            <div className={`w-full ${viewMode === 'dual' ? 'flex-1 min-w-[460px]' : 'w-full'} bg-white rounded-2xl shadow-xl border border-gray-200/90 overflow-hidden text-left animate-in fade-in duration-200`}>
                                
                                {/* Real macOS Window Header: 3 dots on left, subtle title in center */}
                                <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-gray-200/70 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                                    </div>
                                    <span className="text-[11px] font-semibold text-gray-400">
                                        Nuevo Mensaje
                                    </span>
                                    <div className="w-12" />
                                </div>

                                {/* Authentic Email Header Fields (Like Apple Mail / Superhuman) */}
                                <div className="px-6 py-3 bg-[#FCFDFD] border-b border-gray-100 text-xs space-y-1 text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-semibold w-12 shrink-0">De:</span>
                                        <span className="font-medium text-gray-800">{senderIdentity}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-gray-400 font-semibold w-12 shrink-0">Para:</span>
                                        <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                                            <span>{leadRecipientName}</span>
                                            {leadRecipientEmail ? (
                                                <span className="text-blue-950 font-normal">&lt;{leadRecipientEmail}&gt;</span>
                                            ) : (
                                                <span className="text-amber-700 text-[10px] font-bold bg-amber-100/80 px-1 rounded">(Sin correo registrado)</span>
                                            )}
                                        </span>
                                        {previewLeads && previewLeads.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowRecipientsModal(true)}
                                                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                title="Ver la lista completa de destinatarios que recibirán esta campaña"
                                            >
                                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                                + {previewLeads.length - 1} destinatarios más (Ver lista)
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-semibold w-12 shrink-0">Asunto:</span>
                                        <span className="font-bold text-gray-900">{substituteVariables(subject)}</span>
                                    </div>
                                </div>

                                {/* Email Content Canvas with INLINE DIRECT VISUAL CONTROLS */}
                                <div className="p-8 sm:p-10 space-y-5 text-gray-800 bg-white">
                                    {blocks.map((block, index) => {
                                        if (!block.visible) return null;

                                        return (
                                            <div
                                                key={block.id}
                                                onMouseEnter={() => setHoveredBlockId(block.id)}
                                                onMouseLeave={() => setHoveredBlockId(null)}
                                                className={`relative transition-all rounded-xl p-2 -mx-2 group ${hoveredBlockId === block.id ? 'bg-blue-50/30 ring-1 ring-blue-300' : ''}`}
                                            >
                                                {/* In-Canvas Floating Toolbar: Clearly shows WHICH BLOCK this is + reorder/hide controls */}
                                                {hoveredBlockId === block.id && (
                                                    <div className="absolute -top-3.5 right-2 z-20 flex items-center gap-1 bg-white border border-gray-200 shadow-md rounded-lg px-2 py-0.5 text-[10px] font-bold text-gray-700 animate-in fade-in duration-150">
                                                        <span className="text-blue-600 mr-1">{block.label}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                moveBlock(index, 'up');
                                                            }}
                                                            disabled={index === 0}
                                                            className="p-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-20"
                                                            title="Mover arriba"
                                                        >
                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                moveBlock(index, 'down');
                                                            }}
                                                            disabled={index === blocks.length - 1}
                                                            className="p-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-20"
                                                            title="Mover abajo"
                                                        >
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleBlockVisibility(index);
                                                            }}
                                                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded"
                                                            title="Ocultar bloque"
                                                        >
                                                            <EyeOff className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* BLOCK 1: HEADER */}
                                                {block.type === 'header' && (
                                                    <div className="flex items-center justify-between pb-2">
                                                        <div
                                                            onClick={() => logoInputRef.current?.click()}
                                                            className="cursor-pointer group relative flex items-center gap-2 p-1 -ml-1 rounded-xl hover:bg-blue-50/70 transition"
                                                            title="Haz clic para cambiar o subir el logo"
                                                        >
                                                            {effectiveHeaderLogo ? (
                                                                <img
                                                                    src={effectiveHeaderLogo}
                                                                    alt={companyName}
                                                                    className="h-8 max-h-9 w-auto object-contain"
                                                                />
                                                            ) : (
                                                                <div className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                                                                    {companyName}
                                                                </div>
                                                            )}
                                                            <span className="text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100/90 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                Cambiar Logo
                                                            </span>
                                                        </div>
                                                        <a href={`https://${sigWebsite}`} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-blue-600 font-medium">
                                                            Ver en el navegador
                                                        </a>
                                                    </div>
                                                )}

                                                {/* BLOCK 2: INTRO */}
                                                {block.type === 'intro' && (
                                                    <div className="space-y-1.5">
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onFocus={(e) => trackContentEditableFocus(e.currentTarget, 'Saludo')}
                                                            onBlur={(e) => handleTextBlur(e, setGreeting)}
                                                            className="text-base font-bold text-gray-900 outline-none hover:bg-blue-50/50 focus:bg-blue-50/70 rounded px-1 transition cursor-text"
                                                            title="Haz clic para editar saludo — luego presiona un botón de variable para insertar"
                                                        >
                                                            {substituteVariables(greeting)}
                                                        </p>
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onFocus={(e) => trackContentEditableFocus(e.currentTarget, 'Texto Intro')}
                                                            onBlur={(e) => handleTextBlur(e, setIntroText)}
                                                            className="text-sm font-medium text-gray-700 leading-relaxed outline-none hover:bg-blue-50/50 focus:bg-blue-50/70 rounded px-1 transition cursor-text"
                                                            title="Haz clic para editar texto — luego presiona un botón de variable para insertar"
                                                        >
                                                            {substituteVariables(introText)}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* BLOCK 3: CALLOUT BOX */}
                                                {block.type === 'callout' && (
                                                    <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
                                                        <div className="w-7 h-7 rounded-full bg-[#0066FF] text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 shadow-xs">
                                                            ?
                                                        </div>
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onFocus={(e) => trackContentEditableFocus(e.currentTarget, 'Pregunta Destacada')}
                                                            onBlur={(e) => handleTextBlur(e, setCalloutText)}
                                                            className="text-sm sm:text-[15px] font-extrabold text-[#0F172A] leading-snug outline-none hover:bg-blue-100/50 focus:bg-blue-100/70 rounded px-1 transition cursor-text"
                                                            title="Haz clic para editar pregunta — luego presiona un botón de variable para insertar"
                                                        >
                                                            {substituteVariables(calloutText)}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* BLOCK 4: SOLUTION */}
                                                {block.type === 'solution' && (
                                                    <p
                                                        contentEditable
                                                        suppressContentEditableWarning
                                                        onFocus={(e) => trackContentEditableFocus(e.currentTarget, 'Texto de Solución')}
                                                        onBlur={(e) => handleTextBlur(e, setSolutionText)}
                                                        className="text-sm font-medium text-gray-700 leading-relaxed outline-none hover:bg-blue-50/50 focus:bg-blue-50/70 rounded px-1 transition cursor-text"
                                                        title="Haz clic para editar texto de solución — luego presiona un botón de variable para insertar"
                                                    >
                                                        {substituteVariables(solutionText)}
                                                    </p>
                                                )}

                                                {/* BLOCK 5: LEAD-IN */}
                                                {block.type === 'leadIn' && (
                                                    <p
                                                        contentEditable
                                                        suppressContentEditableWarning
                                                        onFocus={(e) => trackContentEditableFocus(e.currentTarget, 'Texto Previo al Video')}
                                                        onBlur={(e) => handleTextBlur(e, setLeadInText)}
                                                        className="text-sm font-bold text-gray-900 outline-none hover:bg-blue-50/50 focus:bg-blue-50/70 rounded px-1 transition cursor-text"
                                                        title="Haz clic para editar texto previo al video"
                                                    >
                                                        {substituteVariables(leadInText)}
                                                    </p>
                                                )}

                                                {/* BLOCK 6: VIDEO CARD (Auto YouTube Thumbnail + Play Button) */}
                                                {block.type === 'videoCard' && (
                                                    <div className="w-full max-w-[380px] mx-auto aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/80 shadow-md group/vid relative cursor-pointer text-center">
                                                        <a href={youtubeUrl} target="_blank" rel="noreferrer" className="block w-full h-full relative">
                                                            <img
                                                                src={effectiveVideoThumb}
                                                                alt="Video"
                                                                onError={(e) => {
                                                                    if (detectedYtId && !e.currentTarget.src.includes('hqdefault.jpg')) {
                                                                        e.currentTarget.src = `https://img.youtube.com/vi/${detectedYtId}/hqdefault.jpg`;
                                                                    }
                                                                }}
                                                                className="w-full h-full object-cover group-hover/vid:scale-[1.02] transition-transform duration-300"
                                                            />
                                                            {/* Center Play Button Overlay — only shown if image does not already have it baked in */}
                                                            {!effectiveVideoThumb.includes('video-preview') && !effectiveVideoThumb.includes('video_thumb_') && (
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover/vid:bg-black/25 transition-colors">
                                                                    <div className="w-14 h-14 rounded-full bg-blue-600/95 hover:bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-black/40 group-hover/vid:scale-110 transition-transform">
                                                                        <Play className="w-6 h-6 fill-white ml-0.5" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </a>
                                                    </div>
                                                )}

                                                {/* BLOCK 7: CTA BUTTON */}
                                                {block.type === 'ctaButton' && (
                                                    <div className="text-center py-2">
                                                        <a
                                                            href={buttonLink || youtubeUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ backgroundColor: buttonColor }}
                                                            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-black text-sm tracking-wide shadow-lg shadow-blue-500/25 hover:opacity-95 transition-opacity"
                                                        >
                                                            <Play className="w-3.5 h-3.5 fill-current" />
                                                            <span>{buttonText} &gt;</span>
                                                        </a>
                                                    </div>
                                                )}

                                                {/* BLOCK 8: CLOSING */}
                                                {block.type === 'closing' && (
                                                    <div className="space-y-2">
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onBlur={(e) => handleTextBlur(e, setClosingText)}
                                                            className="text-sm font-medium text-gray-700 leading-relaxed outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                            title="Haz clic para editar despedida"
                                                        >
                                                            {substituteVariables(closingText)}
                                                        </p>
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onBlur={(e) => handleTextBlur(e, setSignoffText)}
                                                            className="text-sm font-bold text-gray-900 outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                            title="Haz clic para editar firma de despedida"
                                                        >
                                                            {signoffText}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* BLOCK 9: SIGNATURE */}
                                                {block.type === 'signature' && (
                                                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-3.5">
                                                            {hasPhoto && (
                                                                <>
                                                                    <img
                                                                        src={avatarUrl}
                                                                        alt={sigName}
                                                                        className={`w-12 h-12 object-cover border border-gray-200 shadow-xs shrink-0 ${photoShape === 'circle' ? 'rounded-full' : photoShape === 'rounded' ? 'rounded-xl' : 'rounded-none'}`}
                                                                    />
                                                                    {/* Subtle grey vertical divider line */}
                                                                    <div className="h-9 w-[1.5px] bg-gray-200/90 rounded-full shrink-0" />
                                                                </>
                                                            )}
                                                            <div className="text-left space-y-0.5">
                                                                <p
                                                                    contentEditable
                                                                    suppressContentEditableWarning
                                                                    onBlur={(e) => setSigName(e.currentTarget.innerText)}
                                                                    className="text-sm font-black text-gray-900 leading-tight outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                                    title="Haz clic para editar tu nombre"
                                                                >
                                                                    {sigName}
                                                                </p>
                                                                <p
                                                                    contentEditable
                                                                    suppressContentEditableWarning
                                                                    onBlur={(e) => setSigTitle(e.currentTarget.innerText)}
                                                                    className="text-xs font-semibold text-gray-500 outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                                    title="Haz clic para editar tu cargo"
                                                                >
                                                                    {sigTitle}
                                                                </p>
                                                                <p className="text-xs text-gray-600 font-medium flex items-center gap-1 flex-wrap">
                                                                    <span
                                                                        contentEditable
                                                                        suppressContentEditableWarning
                                                                        onBlur={(e) => setSigPhone(e.currentTarget.innerText)}
                                                                        className="outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                                        title="Haz clic para editar teléfono"
                                                                    >
                                                                        {sigPhone}
                                                                    </span>
                                                                    {sigPhone && sigWebsite && (
                                                                        <span className="text-gray-400">•</span>
                                                                    )}
                                                                    <span
                                                                        contentEditable
                                                                        suppressContentEditableWarning
                                                                        onBlur={(e) => setSigWebsite(e.currentTarget.innerText)}
                                                                        className="text-blue-600 font-bold hover:underline outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                                        title="Haz clic para editar sitio web"
                                                                    >
                                                                        {sigWebsite}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {hasLogo && (
                                                            <div
                                                                onClick={() => sigLogoInputRef.current?.click()}
                                                                className="cursor-pointer group relative flex items-center gap-1.5 p-1 -mr-1 rounded-xl hover:bg-blue-50/70 transition"
                                                                title="Haz clic para cambiar o subir el logo de la firma"
                                                            >
                                                                <span className="text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100/90 px-2 py-0.5 rounded-md">
                                                                    Cambiar Logo
                                                                </span>
                                                                {effectiveSigLogo ? (
                                                                    <img
                                                                        src={effectiveSigLogo}
                                                                        alt={companyName}
                                                                        className="h-8 max-h-9 w-auto object-contain"
                                                                    />
                                                                ) : (
                                                                    <div className="text-sm font-black text-gray-900 tracking-tight">
                                                                        {companyName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── MOBILE PREVIEW (iPhone Frame) ── */}
                        {(viewMode === 'mobile' || viewMode === 'dual') && (
                            <div className={`${viewMode === 'dual' ? 'w-[270px]' : 'w-[320px]'} shrink-0 bg-[#0F172A] rounded-[2.8rem] p-2.5 shadow-2xl border-4 border-gray-800 ring-1 ring-gray-700 relative animate-in fade-in duration-200`}>
                                {/* iPhone Dynamic Island */}
                                <div className="w-24 h-5 bg-black rounded-full mx-auto absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-900 mr-2" />
                                </div>

                                {/* Phone Screen Container */}
                                <div className="bg-white rounded-[2.3rem] overflow-hidden pt-8 pb-6 px-4 space-y-3.5 text-left text-xs max-h-[640px] overflow-y-auto custom-scrollbar">
                                    {/* Mobile Header */}
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                        {effectiveHeaderLogo ? (
                                            <img
                                                src={effectiveHeaderLogo}
                                                alt={companyName}
                                                className="h-6 max-h-7 w-auto object-contain"
                                            />
                                        ) : (
                                            <div className="text-xs font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                                                {companyName}
                                            </div>
                                        )}
                                    </div>

                                    <p className="font-bold text-gray-900 text-xs">{substituteVariables(greeting)}</p>
                                    <p className="text-gray-700 text-[11px] leading-relaxed">{substituteVariables(introText)}</p>

                                    {/* Mobile Callout */}
                                    <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3 flex items-start gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                            ?
                                        </div>
                                        <p className="font-extrabold text-[#0F172A] text-[11px] leading-snug">
                                            {substituteVariables(calloutText)}
                                        </p>
                                    </div>

                                    <p className="text-gray-700 text-[11px] leading-relaxed">
                                        {substituteVariables(solutionText)}
                                    </p>
                                    <p className="font-bold text-gray-900 text-[11px]">
                                        {substituteVariables(leadInText)}
                                    </p>

                                    {/* Mobile Video Card */}
                                    <div className="rounded-2xl overflow-hidden aspect-video bg-slate-900 border border-slate-800 shadow-sm relative group text-center">
                                        <a href={youtubeUrl} target="_blank" rel="noreferrer" className="block w-full h-full relative">
                                            <img
                                                src={effectiveVideoThumb}
                                                alt="Video Thumbnail"
                                                onError={(e) => {
                                                    if (detectedYtId && !e.currentTarget.src.includes('hqdefault.jpg')) {
                                                        e.currentTarget.src = `https://img.youtube.com/vi/${detectedYtId}/hqdefault.jpg`;
                                                    }
                                                }}
                                                className="w-full h-full object-cover"
                                            />
                                            {!effectiveVideoThumb.includes('video-preview') && !effectiveVideoThumb.includes('video_thumb_') && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                                                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                                                        <Play className="w-4 h-4 fill-white ml-0.5" />
                                                    </div>
                                                </div>
                                            )}
                                        </a>
                                    </div>

                                    {/* Mobile CTA Button */}
                                    <div className="text-center py-1">
                                        <a
                                            href={buttonLink || youtubeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ backgroundColor: buttonColor }}
                                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-white font-extrabold text-[11px] tracking-wide shadow-md"
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                            <span>{buttonText} &gt;</span>
                                        </a>
                                    </div>

                                    <p className="text-gray-700 text-[11px] leading-relaxed">{substituteVariables(closingText)}</p>
                                    <p className="font-bold text-gray-900 text-[11px]">{signoffText}</p>

                                    {/* Mobile Signature */}
                                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            {hasPhoto && (
                                                <>
                                                    <img
                                                        src={avatarUrl}
                                                        alt={sigName}
                                                        className={`w-9 h-9 object-cover border border-gray-200 shrink-0 ${photoShape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
                                                    />
                                                    <div className="h-7 w-[1.5px] bg-gray-200/90 rounded-full shrink-0" />
                                                </>
                                            )}
                                            <div>
                                                <p className="font-extrabold text-gray-900 text-[11px]">{sigName}</p>
                                                <p className="text-[9px] font-bold text-gray-500">{sigTitle}</p>
                                                <p className="text-[9px] text-gray-600">{sigPhone}</p>
                                                <a href={`https://${sigWebsite}`} target="_blank" rel="noreferrer" className="text-[9px] text-blue-600 font-bold">
                                                    {sigWebsite}
                                                </a>
                                            </div>
                                        </div>
                                        {hasLogo && (
                                            <div
                                                onClick={() => sigLogoInputRef.current?.click()}
                                                className="cursor-pointer hover:opacity-80 transition"
                                                title="Haz clic para cambiar el logo de la firma"
                                            >
                                                {effectiveSigLogo ? (
                                                    <img
                                                        src={effectiveSigLogo}
                                                        alt={companyName}
                                                        className="h-6 max-h-7 w-auto object-contain"
                                                    />
                                                ) : (
                                                    <div className="text-[10px] font-black text-gray-900 tracking-tight">
                                                        {companyName}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══ RECIPIENTS LIST MODAL — Allows inspecting all recipients and switching preview ══ */}
            {showRecipientsModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowRecipientsModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 flex items-center justify-between text-white flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">
                                        Destinatarios de la Campaña ({previewLeads.length})
                                    </h3>
                                    <p className="text-white/80 text-xs font-medium">
                                        {previewLeads.length === 1 ? '1 contacto seleccionado' : `${previewLeads.length} contactos recibirán este correo personalizado`}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRecipientsModal(false)}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Actions */}
                        <div className="p-4 bg-slate-50 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                            <div className="flex-1 relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar por iglesia, nombre o email..."
                                    value={recipientsSearch}
                                    onChange={(e) => setRecipientsSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            {onOpenAudienceModal && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRecipientsModal(false);
                                        onOpenAudienceModal();
                                    }}
                                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    Segmentar / Cambiar
                                </button>
                            )}
                        </div>

                        {/* Recipients List */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            {previewLeads.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-xs font-semibold">
                                    No hay destinatarios seleccionados. Abre el segmentador para incluir contactos.
                                </div>
                            ) : (
                                previewLeads
                                    .filter((l) => {
                                        if (!recipientsSearch.trim()) return true;
                                        const q = recipientsSearch.toLowerCase();
                                        return (
                                            (l.name || '').toLowerCase().includes(q) ||
                                            (l.company_name || '').toLowerCase().includes(q) ||
                                            (l.email || l.contact_email || '').toLowerCase().includes(q)
                                        );
                                    })
                                    .map((lead, idx) => {
                                        const originalIndex = previewLeads.indexOf(lead);
                                        const isCurrent = originalIndex === validLeadIndex;
                                        const leadEmail = lead.email || lead.contact_email;
                                        const churchOrComp = lead.company_name || (isIclesia ? 'Sin iglesia asignada' : 'Sin empresa');

                                        return (
                                            <div
                                                key={lead.id || idx}
                                                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                                    isCurrent
                                                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                                                        : 'bg-white hover:bg-gray-50 border-gray-200/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                                                        {(lead.name || 'C').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-xs text-gray-900 truncate">
                                                                {lead.name || 'Sin nombre'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                                                                {churchOrComp}
                                                            </span>
                                                            {lead.status && (
                                                                <span className="text-[9px] font-bold uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                                    {lead.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                                                            {leadEmail ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Mail className="w-3 h-3 text-gray-400" /> {leadEmail}
                                                                </span>
                                                            ) : (
                                                                <span className="text-red-500 font-semibold">(Sin correo electrónico)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2">
                                                    {isCurrent ? (
                                                        <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg shadow-xs">
                                                            En Vista Previa
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setLeadIndex(originalIndex);
                                                                setShowRecipientsModal(false);
                                                                toast.success(`Vista previa: ${churchOrComp}`, { duration: 2000, icon: '👁️' });
                                                            }}
                                                            className="px-2.5 py-1 bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 text-[10px] font-bold rounded-lg transition"
                                                        >
                                                            Previsualizar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                            <span>
                                Mostrando <strong>{previewLeads.length}</strong> {previewLeads.length === 1 ? 'destinatario' : 'destinatarios'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowRecipientsModal(false)}
                                className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition text-xs"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ SEND GATE MODAL — Blocks or warns before sending ══ */}
            {showSendGateModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${sendGateIssues.some(i => i.startsWith('⛔')) ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                {sendGateIssues.some(i => i.startsWith('⛔')) ? '🚫' : '⚠️'}
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900">
                                    {sendGateIssues.some(i => i.startsWith('⛔'))
                                        ? 'Envío BLOQUEADO — Problemas Críticos'
                                        : 'Advertencias Antes de Enviar'}
                                </h2>
                                <p className="text-sm text-gray-500">Revisa estos problemas antes de continuar</p>
                            </div>
                        </div>
                        <div className="space-y-3 mb-6">
                            {sendGateIssues.map((issue, i) => (
                                <div key={i} className={`rounded-xl p-3.5 text-sm leading-relaxed border ${issue.startsWith('⛔') ? 'bg-red-50 border-red-200 text-red-800' : issue.startsWith('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                    {issue}
                                </div>
                            ))}
                        </div>
                        {!sendGateIssues.some(i => i.startsWith('⛔')) && profile?.email && (
                            <button
                                onClick={handleSendTestEmail}
                                disabled={isSendingTest || hasTestedSend}
                                className="w-full mb-3 py-3 px-4 rounded-xl border-2 border-blue-600 text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSendingTest ? '⏳ Enviando prueba...' : hasTestedSend ? '✅ Prueba enviada a tu correo' : `📬 Enviar prueba a ${profile.email}`}
                            </button>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowSendGateModal(false); setSendGateIssues([]); }}
                                className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                            >
                                {sendGateIssues.some(i => i.startsWith('⛔')) ? '← Volver a Corregir' : 'Cancelar'}
                            </button>
                            {!sendGateIssues.some(i => i.startsWith('⛔')) && (
                                <button
                                    onClick={() => { setShowSendGateModal(false); setSendGateIssues([]); setShowPreviewModal(true); }}
                                    className="flex-1 py-3 px-4 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors"
                                >
                                    Entendido, continuar →
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ PRE-SEND PREVIEW MODAL — Final confirmation ══ */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-2xl">✉️</div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Confirmación Final</h2>
                                <p className="text-sm text-gray-500">Esto enviará emails reales e irreversibles</p>
                            </div>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 mb-1">ASUNTO QUE RECIBIRÁN:</p>
                                <p className="text-sm font-semibold text-gray-900 break-words">{subject}</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <p className="text-xs font-bold text-blue-600 mb-1">DESTINATARIOS:</p>
                                <p className="text-2xl font-black text-blue-700">{reachCount.toLocaleString()}</p>
                                <p className="text-xs text-blue-500">contactos seleccionados</p>
                            </div>
                            {hasTestedSend && (
                                <div className="bg-green-50 rounded-xl p-3 border border-green-200 flex items-center gap-2 text-green-700 text-sm font-semibold">
                                    <span>✅</span><span>Enviaste una prueba y validaste el email</span>
                                </div>
                            )}
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                                <strong>Seguridad:</strong> Si un lead no tiene datos para una variable, ese email será <strong>bloqueado automáticamente</strong>. Es mejor omitirlo que enviar con placeholders.
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowPreviewModal(false)} className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={executeFinalSend} disabled={isSending} className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSending ? '⏳ Enviando...' : `🚀 Enviar a ${reachCount.toLocaleString()} contactos`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
