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
    Sparkles
} from 'lucide-react';
import { storageService } from '../../services/storage';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

export interface EmailBlock {
    id: string;
    type: 'header' | 'intro' | 'callout' | 'solution' | 'leadIn' | 'videoCard' | 'ctaButton' | 'closing' | 'signature';
    label: string;
    visible: boolean;
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
    thumbMode?: 'youtube' | 'custom';
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
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingSigLogo, setIsUploadingSigLogo] = useState(false);

    // View device mode: 'desktop', 'mobile', or 'dual'
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'dual'>('desktop');
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    // Determine company context
    const isIclesia = Boolean(company?.name?.toLowerCase().includes('iclesia'));
    const companyName = company?.name || 'Nuestra Empresa';

    // 1. Resolve stored draft from localStorage or initialStudioState or parsedFromHtml
    const savedLocalDraft = (() => {
        try {
            const key = campaignId ? `crm_prospecting_studio_${campaignId}` : 'crm_prospecting_studio_new';
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw) as Partial<ProspectingStudioState>;
        } catch { /* ignore */ }
        return null;
    })();

    const parsedFromHtml = initialContent ? parseStudioStateFromHtml(initialContent) : null;
    const effectiveInitial: Partial<ProspectingStudioState> = initialStudioState || parsedFromHtml || savedLocalDraft || {};
    const isHydratedRef = useRef(Boolean(initialStudioState || parsedFromHtml || savedLocalDraft));

    const defaultSenderName = (profile?.full_name && profile.full_name !== 'Platform Owner') ? profile.full_name : (isIclesia ? 'Jimmy Arias' : companyName);
    const defaultSenderEmail = company?.email || profile?.email || 'contacto@empresa.com';

    // Form Controls (Left Panel)
    const [campaignName, setCampaignName] = useState(() => effectiveInitial.campaignName || initialName || (company?.name ? `Prospección - ${company.name}` : 'Prospección - Iglesias'));
    const [subject, setSubject] = useState(() => effectiveInitial.subject || initialSubject || 'Una pregunta para {{nombre_iglesia}}');
    const [senderIdentity, setSenderIdentity] = useState(() => effectiveInitial.senderIdentity || `${defaultSenderName} <${defaultSenderEmail}>`);

    // Video Controls
    const [youtubeUrl, setYoutubeUrl] = useState(() => effectiveInitial.youtubeUrl || 'https://youtu.be/dvRSzR1x3os');
    const [videoCaption, setVideoCaption] = useState(() => effectiveInitial.videoCaption || `Vea en 45 segundos cómo funciona ${companyName}`);
    const [thumbMode, setThumbMode] = useState<'youtube' | 'custom'>(() => effectiveInitial.thumbMode || 'youtube');
    const [customUploadedThumb, setCustomUploadedThumb] = useState<string>(() => effectiveInitial.customUploadedThumb || '');
    const [isUploadingThumb, setIsUploadingThumb] = useState(false);
    const videoThumbInputRef = useRef<HTMLInputElement>(null);

    const detectedYtId = getYouTubeVideoId(youtubeUrl);
    const effectiveVideoThumb = (thumbMode === 'custom' && customUploadedThumb)
        ? customUploadedThumb
        : (detectedYtId
            ? `https://img.youtube.com/vi/${detectedYtId}/maxresdefault.jpg`
            : '/images/marketing/jimmy-video-preview.png');

    // Button Controls
    const [buttonText, setButtonText] = useState(() => effectiveInitial.buttonText || (isIclesia ? 'Ver cómo funciona Iclesia' : `Conocer más sobre ${companyName}`));
    const [buttonColor, setButtonColor] = useState(() => effectiveInitial.buttonColor || '#0066FF');
    const [buttonLink, setButtonLink] = useState(() => effectiveInitial.buttonLink || 'https://youtu.be/dvRSzR1x3os');

    // Signature Controls
    const [hasLogo, setHasLogo] = useState(() => typeof effectiveInitial.hasLogo === 'boolean' ? effectiveInitial.hasLogo : true);
    const [hasPhoto, setHasPhoto] = useState(() => typeof effectiveInitial.hasPhoto === 'boolean' ? effectiveInitial.hasPhoto : true);
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
    const [greeting, setGreeting] = useState(() => effectiveInitial.greeting || 'Hola, cordial saludo.');
    const [introText, setIntroText] = useState(() => effectiveInitial.introText || (isIclesia ? 'Mi nombre es Jimmy Arias de Iclesia y quería hacerles una consulta:' : `Mi nombre es ${defaultSenderName} de ${companyName} y quería hacerles una consulta:`));
    const [calloutText, setCalloutText] = useState(() => effectiveInitial.calloutText || (isIclesia ? '¿Cuentan actualmente en {{nombre_iglesia}} con un proceso ágil para atender y dar seguimiento inmediato a cada visitante o miembro que solicita información?' : '¿Cuentan actualmente en {{nombre_empresa}} con un proceso ágil para atender y dar seguimiento inmediato a cada cliente que solicita información?'));
    const [solutionText, setSolutionText] = useState(() => effectiveInitial.solutionText || (isIclesia ? 'En Iclesia ayudamos a congregaciones a automatizar el seguimiento de visitas, coordinar a los líderes de grupos y asegurar que ninguna persona se quede sin atención pastoral.' : `En ${companyName} ayudamos a empresas a optimizar sus tiempos de respuesta, coordinar al equipo comercial y asegurar que ninguna oportunidad de venta se pierda.`));
    const [leadInText, setLeadInText] = useState(() => effectiveInitial.leadInText || 'Les comparto un breve video de 45 segundos para mostrarles cómo funciona:');
    const [closingText, setClosingText] = useState(() => effectiveInitial.closingText || (isIclesia ? 'Si esto es algo que desean mejorar en su congregación, pueden responder directamente a este correo. Con gusto coordinamos una breve conversación.' : 'Si esto es algo que desean mejorar en su empresa, pueden responder directamente a este correo. Con gusto coordinamos una breve conversación.'));
    const [signoffText, setSignoffText] = useState(() => effectiveInitial.signoffText || 'Atentamente,');

    // Logo Resolution: Custom uploaded in studio > Company profile logo > (Iclesia logo if Iclesia, else empty)
    const effectiveHeaderLogo = customHeaderLogo || company?.logo_url || (isIclesia ? '/images/marketing/iclesia-header-logo.png' : '');
    const effectiveSigLogo = customSigLogo || customHeaderLogo || company?.logo_url || (isIclesia ? '/images/marketing/iclesia-brand-logo.png' : '');

    // Active simulated lead index
    const [leadIndex, setLeadIndex] = useState(0);

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

        if (stateToLoad.campaignName) setCampaignName(stateToLoad.campaignName);
        if (stateToLoad.subject) setSubject(stateToLoad.subject);
        if (stateToLoad.senderIdentity) setSenderIdentity(stateToLoad.senderIdentity);
        if (stateToLoad.greeting) setGreeting(stateToLoad.greeting);
        if (stateToLoad.introText) setIntroText(stateToLoad.introText);
        if (stateToLoad.calloutText) setCalloutText(stateToLoad.calloutText);
        if (stateToLoad.solutionText) setSolutionText(stateToLoad.solutionText);
        if (stateToLoad.leadInText) setLeadInText(stateToLoad.leadInText);
        if (stateToLoad.closingText) setClosingText(stateToLoad.closingText);
        if (stateToLoad.signoffText) setSignoffText(stateToLoad.signoffText);
        if (stateToLoad.youtubeUrl) setYoutubeUrl(stateToLoad.youtubeUrl);
        if (stateToLoad.videoCaption) setVideoCaption(stateToLoad.videoCaption);
        if (stateToLoad.thumbMode) setThumbMode(stateToLoad.thumbMode);
        if (stateToLoad.customUploadedThumb) setCustomUploadedThumb(stateToLoad.customUploadedThumb);
        if (stateToLoad.buttonText) setButtonText(stateToLoad.buttonText);
        if (stateToLoad.buttonColor) setButtonColor(stateToLoad.buttonColor);
        if (stateToLoad.buttonLink) setButtonLink(stateToLoad.buttonLink);
        if (typeof stateToLoad.hasLogo === 'boolean') setHasLogo(stateToLoad.hasLogo);
        if (typeof stateToLoad.hasPhoto === 'boolean') setHasPhoto(stateToLoad.hasPhoto);
        if (stateToLoad.photoShape) setPhotoShape(stateToLoad.photoShape);
        if (stateToLoad.avatarUrl) setAvatarUrl(stateToLoad.avatarUrl);
        if (stateToLoad.sigName) setSigName(stateToLoad.sigName);
        if (stateToLoad.sigTitle) setSigTitle(stateToLoad.sigTitle);
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
            const senderEmail = company.email || profile?.email || 'contacto@empresa.com';
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
            setCampaignName(`Prospección - ${compName}`);
            setSubject('Una pregunta para {{nombre_empresa}}');
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
    const currentLead = (previewLeads && previewLeads.length > 0 && previewLeads[leadIndex]) ? previewLeads[leadIndex] : {
        company_name: 'Clínica Salud Plus',
        name: 'Dr. Roberto Mendoza',
        city: 'Miami',
        industry: 'Salud y Bienestar'
    };

    // Replace variables (STRICTLY SAAS / BUSINESS VARIABLES)
    const substituteVariables = (text: string) => {
        if (!text) return '';
        const companyOrLeadName = (currentLead.company_name && currentLead.company_name !== 'Individual')
            ? currentLead.company_name
            : (currentLead.name || 'Su Empresa');
        const firstName = currentLead.name ? currentLead.name.split(' ')[0] : 'Estimado/a';
        const city = currentLead.city || 'su ciudad';
        const industry = currentLead.industry || currentLead.denomination || 'su rubro';

        return text
            .replace(/{{(nombre_empresa|company_name|empresa|nombre_iglesia|iglesia|congregacion)}}/gi, companyOrLeadName)
            .replace(/{{(first_name|nombre)}}/gi, firstName)
            .replace(/{{(ciudad|city)}}/gi, city)
            .replace(/{{(rubro|industria|denominacion|congregacion)}}/gi, industry);
    };

    // Insert variable tag into subject
    const insertVariableIntoSubject = (variableTag: string) => {
        setSubject(prev => `${prev} ${variableTag}`);
        toast.success(`Variable ${variableTag} agregada`, { duration: 1500 });
    };

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

    // Upload custom video thumbnail
    const handleVideoThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingThumb(true);
            const userId = profile?.id || 'marketing';
            const publicUrl = await storageService.uploadAvatar(userId, file);
            if (publicUrl) {
                setCustomUploadedThumb(publicUrl);
                setThumbMode('custom');
                toast.success('Portada personalizada cargada');
            }
        } catch (err: any) {
            const reader = new FileReader();
            reader.onload = () => {
                setCustomUploadedThumb(reader.result as string);
                setThumbMode('custom');
                toast.success('Portada cargada');
            };
            reader.readAsDataURL(file);
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
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table, td { border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
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

                case 'videoCard':
                    html += `
              <!-- Video Card (Auto YouTube Thumbnail 16:9 + Oval Rounded Corners) -->
              <div style="margin:20px auto 24px auto;max-width:380px;border-radius:18px;overflow:hidden;background-color:#0F172A;box-shadow:0 10px 28px rgba(0,0,0,0.15);text-align:center;position:relative;">
                <a href="${youtubeUrl}" target="_blank" style="display:block;text-decoration:none;position:relative;line-height:0;font-size:0;">
                  <img src="${effectiveVideoThumb}" alt="Ver Video" width="380" style="display:block;width:100%;max-width:380px;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:18px;margin:0 auto;border:0;" />
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="position:absolute;top:0;left:0;width:100%;height:100%;">
                    <tr>
                      <td align="center" style="vertical-align:middle;">
                        <div style="width:58px;height:58px;border-radius:50%;background-color:#0066FF;color:#FFFFFF;line-height:58px;font-size:22px;text-align:center;margin:0 auto;box-shadow:0 6px 20px rgba(0,0,0,0.45);font-family:Arial,sans-serif;">▶</div>
                      </td>
                    </tr>
                  </table>
                </a>
              </div>
`;
                    break;

                case 'ctaButton':
                    html += `
              <!-- CTA Button -->
              <div style="margin:24px 0 28px 0;text-align:center;">
                <a href="${buttonLink || youtubeUrl}" target="_blank" style="display:inline-block;background-color:${buttonColor};color:#FFFFFF;padding:15px 38px;border-radius:9999px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;letter-spacing:0.3px;box-shadow:0 8px 20px rgba(0,102,255,0.3);text-align:center;">
                  ▶&nbsp;&nbsp;${buttonText}&nbsp;&nbsp;&gt;
                </a>
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
                const key = campaignId ? `crm_prospecting_studio_${campaignId}` : 'crm_prospecting_studio_new';
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

    // Send Campaign
    const handleTriggerSend = async () => {
        const confirmed = window.confirm(`¿Estás seguro de enviar esta campaña ahora a ${reachCount} destinatarios?`);
        if (!confirmed) return;
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

                    {/* Simulated Lead Pill (Business Name) */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs font-semibold text-blue-900">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-[11px] text-gray-500">Empresa:</span>
                        <strong className="max-w-[170px] truncate text-blue-900" title={currentLead.company_name}>
                            {currentLead.company_name}
                        </strong>
                        {previewLeads && previewLeads.length > 1 && (
                            <button
                                type="button"
                                onClick={() => setLeadIndex(prev => (prev + 1) % previewLeads.length)}
                                className="p-0.5 text-blue-600 hover:text-blue-900 rounded"
                                title="Probar con otro lead"
                            >
                                <RefreshCw className="w-3 h-3" />
                            </button>
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
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Una pregunta para {{nombre_empresa}}"
                        />
                    </div>

                    {/* 3. Variables de Empresa (STRICTLY SAAS / BUSINESS) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-gray-600">
                                Insertar Variable en Asunto
                            </label>
                            <span className="text-[10px] text-gray-400">Clic para añadir</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { tag: '{{nombre_empresa}}', label: 'Empresa' },
                                { tag: '{{first_name}}', label: 'Contacto' },
                                { tag: '{{ciudad}}', label: 'Ciudad' },
                                { tag: '{{rubro}}', label: 'Rubro / Industria' }
                            ].map((v) => (
                                <button
                                    key={v.tag}
                                    type="button"
                                    onClick={() => insertVariableIntoSubject(v.tag)}
                                    className="flex items-center justify-between px-2.5 py-1.5 bg-blue-50/70 hover:bg-blue-100 border border-blue-200/60 rounded-lg text-blue-700 text-[11px] font-bold transition text-left group"
                                    title={`Añadir ${v.tag} al asunto`}
                                >
                                    <span className="truncate">{v.label}</span>
                                    <Plus className="w-3 h-3 text-blue-600 group-hover:scale-125 transition-transform shrink-0 ml-1" />
                                </button>
                            ))}
                        </div>
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
                                placeholder="https://youtu.be/dvR5zR1x3os"
                            />
                            <LinkIcon className="w-3.5 h-3.5 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Selector de Portada: Automática de YouTube vs Subir Propia */}
                        <div className="pt-1 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Portada:</span>
                            <div className="flex bg-gray-100 rounded-lg p-0.5 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => setThumbMode('youtube')}
                                    className={`px-2 py-0.5 rounded font-bold transition ${thumbMode === 'youtube' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Auto YouTube
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
                        {thumbMode === 'youtube' && detectedYtId && (
                            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Portada real de YouTube sincronizada
                            </p>
                        )}
                        {thumbMode === 'custom' && customUploadedThumb && (
                            <p className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Portada personalizada activa
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
                            placeholder="Ver cómo funciona Iclesia"
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
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-semibold w-12 shrink-0">Para:</span>
                                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                            {currentLead.company_name} &lt;contacto@empresa.com&gt;
                                        </span>
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
                                                            onBlur={(e) => setGreeting(e.currentTarget.innerText)}
                                                            className="text-base font-bold text-gray-900 outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                            title="Haz clic para editar saludo"
                                                        >
                                                            {greeting}
                                                        </p>
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onBlur={(e) => setIntroText(e.currentTarget.innerText)}
                                                            className="text-sm font-medium text-gray-700 leading-relaxed outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                            title="Haz clic para editar texto"
                                                        >
                                                            {introText}
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
                                                            onBlur={(e) => setCalloutText(e.currentTarget.innerText)}
                                                            className="text-sm sm:text-[15px] font-extrabold text-[#0F172A] leading-snug outline-none hover:bg-blue-100/50 rounded px-1 transition"
                                                            title="Haz clic para editar pregunta destacada"
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
                                                        onBlur={(e) => setSolutionText(e.currentTarget.innerText)}
                                                        className="text-sm font-medium text-gray-700 leading-relaxed outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                        title="Haz clic para editar texto de solución"
                                                    >
                                                        {solutionText}
                                                    </p>
                                                )}

                                                {/* BLOCK 5: LEAD-IN */}
                                                {block.type === 'leadIn' && (
                                                    <p
                                                        contentEditable
                                                        suppressContentEditableWarning
                                                        onBlur={(e) => setLeadInText(e.currentTarget.innerText)}
                                                        className="text-sm font-bold text-gray-900 outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                        title="Haz clic para editar texto previo al video"
                                                    >
                                                        {leadInText}
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
                                                            {/* Center Play Button Overlay */}
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover/vid:bg-black/25 transition-colors">
                                                                <div className="w-14 h-14 rounded-full bg-blue-600/95 hover:bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-black/40 group-hover/vid:scale-110 transition-transform">
                                                                    <Play className="w-6 h-6 fill-white ml-0.5" />
                                                                </div>
                                                            </div>
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
                                                            onBlur={(e) => setClosingText(e.currentTarget.innerText)}
                                                            className="text-sm font-medium text-gray-700 leading-relaxed outline-none hover:bg-blue-50/50 rounded px-1 transition"
                                                            title="Haz clic para editar despedida"
                                                        >
                                                            {closingText}
                                                        </p>
                                                        <p
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onBlur={(e) => setSignoffText(e.currentTarget.innerText)}
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

                                    <p className="font-bold text-gray-900 text-xs">{greeting}</p>
                                    <p className="text-gray-700 text-[11px] leading-relaxed">{introText}</p>

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
                                        {solutionText}
                                    </p>
                                    <p className="font-bold text-gray-900 text-[11px]">
                                        {leadInText}
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
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                                                    <Play className="w-4 h-4 fill-white ml-0.5" />
                                                </div>
                                            </div>
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

                                    <p className="text-gray-700 text-[11px] leading-relaxed">{closingText}</p>
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
        </div>
    );
}
