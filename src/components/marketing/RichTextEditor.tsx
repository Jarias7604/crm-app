import React, { useRef, useEffect, useState } from 'react';
import {
    Bold,
    Italic,
    Underline,
    Image as ImageIcon,
    Video,
    FileText,
    Link as LinkIcon,
    Heading1,
    Heading2,
    Type,
    X,
    Loader2,
    MessageCircle,
    Phone,
    User as UserIcon,
    Zap,
    PenLine,
    Play,
    Building2,
    Sparkles,
    Upload,
    ExternalLink
} from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    channel?: 'email' | 'whatsapp' | 'telegram';
}

export default function RichTextEditor({ value, onChange, placeholder, channel = 'email' }: RichTextEditorProps) {
    const { profile } = useAuth();
    const editorRef = useRef<HTMLDivElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Modals state
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
    const [showPhoneInput, setShowPhoneInput] = useState(false);
    const [showVariables, setShowVariables] = useState(false);
    const [showCtaPro, setShowCtaPro] = useState(false);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    // Link state
    const [linkUrl, setLinkUrl] = useState('');
    const [linkText, setLinkText] = useState('');
    const [linkAsButton, setLinkAsButton] = useState(false);

    // WhatsApp & Phone state
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    // CTA Pro state
    const [ctaWhatsapp, setCtaWhatsapp] = useState('50379718911');
    const [ctaWhatsappMsg, setCtaWhatsappMsg] = useState('Hola, me interesa la información');
    const [ctaBookingUrl, setCtaBookingUrl] = useState('');
    const [ctaEmail, setCtaEmail] = useState('contacto@iclesia.ai');
    const [ctaCompanyName, setCtaCompanyName] = useState('Iclesia LLC');

    // Video modal state
    const [videoTab, setVideoTab] = useState<'youtube' | 'upload'>('youtube');
    const [youtubeUrl, setYoutubeUrl] = useState('https://youtu.be/dvR5zR1x3os');
    const [videoTitle, setVideoTitle] = useState('Ver cómo funciona Iclesia (Video 45 seg)');
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);

    // Signature state (persisted in localStorage)
    const [sigName, setSigName] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).name || '';
        } catch {}
        return profile?.full_name || 'Jimmy Arias';
    });
    const [sigTitle, setSigTitle] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).title || '';
        } catch {}
        return 'Fundador';
    });
    const [sigCompany, setSigCompany] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).company || '';
        } catch {}
        return 'Iclesia';
    });
    const [sigPhone, setSigPhone] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).phone || '';
        } catch {}
        return profile?.phone || '703 945 9240';
    });
    const [sigWebsite, setSigWebsite] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).website || '';
        } catch {}
        return 'iclesia.ai';
    });
    const [sigAvatar, setSigAvatar] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).avatar || '';
        } catch {}
        return profile?.avatar_url || '';
    });
    const [sigLogo, setSigLogo] = useState(() => {
        try {
            const saved = localStorage.getItem('crm_user_signature_v1');
            if (saved) return JSON.parse(saved).logo || '';
        } catch {}
        return '';
    });
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    // Sync with external value changes (e.g. templates)
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            if (document.activeElement !== editorRef.current || !value) {
                editorRef.current.innerHTML = value || '';
            }
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command: string, value: string | undefined = undefined) => {
        if (editorRef.current) {
            editorRef.current.focus();
            const selection = window.getSelection();
            if (selection && selection.rangeCount === 0) {
                const range = document.createRange();
                range.selectNodeContents(editorRef.current);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
        document.execCommand(command, false, value);
        if (editorRef.current) editorRef.current.focus();
    };

    const closeAllModals = () => {
        setShowLinkInput(false);
        setShowWhatsAppInput(false);
        setShowPhoneInput(false);
        setShowVariables(false);
        setShowCtaPro(false);
        setShowVideoModal(false);
        setShowSignatureModal(false);
    };

    // --- LINK LOGIC ---
    const openLinkModal = () => {
        const sel = window.getSelection();
        const selectedText = sel ? sel.toString().trim() : '';
        setLinkText(selectedText);
        setLinkUrl('');
        setLinkAsButton(false);
        closeAllModals();
        setShowLinkInput(true);
    };

    const insertCustomLink = () => {
        if (!linkUrl.trim()) {
            toast.error('Ingresa la URL del enlace');
            return;
        }
        const safeUrl = linkUrl.startsWith('http://') || linkUrl.startsWith('https://') || linkUrl.startsWith('mailto:') || linkUrl.startsWith('tel:')
            ? linkUrl.trim()
            : `https://${linkUrl.trim()}`;

        const text = linkText.trim() || safeUrl;

        if (linkAsButton) {
            const btnHtml = `<a href="${safeUrl}" target="_blank" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;margin:8px 0;text-align:center;">${text}</a>&nbsp;`;
            execCommand('insertHTML', btnHtml);
        } else {
            const linkHtml = `<a href="${safeUrl}" target="_blank" style="color:#4f46e5;font-weight:700;text-decoration:underline;">${text}</a>&nbsp;`;
            execCommand('insertHTML', linkHtml);
        }

        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setShowLinkInput(false);
        setLinkUrl('');
        setLinkText('');
        toast.success('Enlace insertado');
    };

    // --- YOUTUBE & VIDEO LOGIC ---
    const extractYouTubeId = (url: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const currentYtId = extractYouTubeId(youtubeUrl);

    const insertYouTubeVideo = () => {
        if (!youtubeUrl.trim()) {
            toast.error('Ingresa el enlace de YouTube');
            return;
        }
        const ytId = extractYouTubeId(youtubeUrl);
        if (!ytId) {
            toast.error('Enlace de YouTube no válido (debe ser youtube.com o youtu.be)');
            return;
        }

        const title = videoTitle.trim() || 'Ver video en YouTube';
        const cleanYtUrl = youtubeUrl.trim();

        const videoCardHtml = `
<div style="margin:24px auto;max-width:540px;width:100%;text-align:center;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:540px;width:100%;border-radius:16px;overflow:hidden;background-color:#0f172a;border:1px solid #334155;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);">
    <tr>
      <td align="center" style="padding:0;line-height:0;background-color:#000000;position:relative;">
        <a href="${cleanYtUrl}" target="_blank" style="display:block;text-decoration:none;">
          <img src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg" alt="${title}" width="540" style="display:block;width:100%;max-width:540px;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:16px 16px 0 0;border:0;" />
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 18px;background-color:#0f172a;text-align:left;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <a href="${cleanYtUrl}" target="_blank" style="text-decoration:none;display:block;">
                <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;line-height:1.3;">
                  ▶&nbsp;&nbsp;${title}
                </div>
                <div style="font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;margin-top:3px;">
                  Haz clic para ver el video completo en YouTube
                </div>
              </a>
            </td>
            <td align="right" style="vertical-align:middle;width:120px;padding-left:12px;">
              <a href="${cleanYtUrl}" target="_blank" style="display:inline-block;background-color:#ef4444;color:#ffffff;padding:9px 16px;border-radius:8px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;text-align:center;">
                VER VIDEO
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div><br/>`;

        execCommand('insertHTML', videoCardHtml);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setShowVideoModal(false);
        toast.success('🎬 Tarjeta de video insertada');
    };

    // --- SIGNATURE LOGIC ---
    const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Selecciona una imagen válida (PNG, JPG, WebP)');
            return;
        }
        setIsUploadingAvatar(true);
        try {
            const publicUrl = await campaignService.uploadMarketingAsset(file);
            setSigAvatar(publicUrl);
            toast.success('Foto de perfil subida');
        } catch (err: any) {
            toast.error('Error al subir la foto');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Selecciona una imagen válida');
            return;
        }
        setIsUploadingLogo(true);
        try {
            const publicUrl = await campaignService.uploadMarketingAsset(file);
            setSigLogo(publicUrl);
            toast.success('Logo subido');
        } catch (err: any) {
            toast.error('Error al subir el logo');
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const insertSignature = () => {
        if (!sigName.trim()) {
            toast.error('Ingresa al menos tu nombre');
            return;
        }

        // Save preferences
        try {
            localStorage.setItem('crm_user_signature_v1', JSON.stringify({
                name: sigName,
                title: sigTitle,
                company: sigCompany,
                phone: sigPhone,
                website: sigWebsite,
                avatar: sigAvatar,
                logo: sigLogo
            }));
        } catch {}

        const cleanPhone = sigPhone.replace(/\D/g, '');
        const cleanWeb = sigWebsite.replace(/^https?:\/\//, '');

        const signatureHtml = `
<div style="margin:28px 0 16px 0;padding-top:20px;border-top:2px solid #e2e8f0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      ${sigAvatar ? `
      <td style="vertical-align:middle;padding-right:16px;width:68px;">
        <img src="${sigAvatar}" alt="${sigName}" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #6366f1;" />
      </td>
      ` : ''}
      <td style="vertical-align:middle;${sigAvatar ? 'border-left:2px solid #e2e8f0;padding-left:16px;' : ''}">
        <div style="font-size:16px;font-weight:800;color:#0f172a;line-height:1.2;">${sigName}</div>
        <div style="font-size:12px;font-weight:700;color:#4f46e5;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">
          ${sigTitle}${sigCompany ? ` • ${sigCompany}` : ''}
        </div>
        <div style="font-size:13px;color:#475569;margin-top:6px;line-height:1.5;">
          ${sigPhone ? `<span>📞 <a href="tel:${cleanPhone}" style="color:#475569;text-decoration:none;font-weight:600;">${sigPhone}</a></span>` : ''}
          ${sigWebsite ? `<span style="margin-left:10px;">🌐 <a href="https://${cleanWeb}" target="_blank" style="color:#4f46e5;text-decoration:none;font-weight:700;">${cleanWeb}</a></span>` : ''}
        </div>
      </td>
    </tr>
    ${sigLogo ? `
    <tr>
      <td colspan="2" style="padding-top:14px;">
        <img src="${sigLogo}" alt="${sigCompany}" height="32" style="display:block;height:32px;width:auto;max-width:140px;object-fit:contain;" />
      </td>
    </tr>
    ` : ''}
  </table>
</div><br/>`;

        execCommand('insertHTML', signatureHtml);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setShowSignatureModal(false);
        toast.success('✍️ Firma profesional insertada');
    };

    // --- FILE UPLOADS (IMAGES, DOCS, DIRECT VIDEOS) ---
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (type === 'image' && !file.type.startsWith('image/')) {
            toast.error('Por favor selecciona una imagen válida');
            return;
        }
        if (type === 'video' && !file.type.startsWith('video/')) {
            toast.error('Por favor selecciona un video válido (MP4, WebM)');
            return;
        }

        const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
        const MAX_VIDEO_SIZE = 45 * 1024 * 1024; // 45MB
        const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25MB

        if (type === 'image' && file.size > MAX_IMAGE_SIZE) {
            toast.error('La imagen es demasiado grande (máximo 10MB)');
            return;
        }
        if (type === 'video' && file.size > MAX_VIDEO_SIZE) {
            toast.error('El video es demasiado grande para email (máximo 45MB). Recomendamos usar YouTube.');
            return;
        }
        if (type === 'document' && file.size > MAX_DOC_SIZE) {
            toast.error('El documento es demasiado grande (máximo 25MB)');
            return;
        }

        if (type === 'video') setIsUploadingVideo(true);
        else setIsUploading(true);

        try {
            const publicUrl = await campaignService.uploadMarketingAsset(file);

            if (type === 'image') {
                execCommand('insertImage', publicUrl);
                setTimeout(() => {
                    const images = editorRef.current?.querySelectorAll('img');
                    images?.forEach((img: any) => {
                        if (img.src === publicUrl) {
                            img.style.maxWidth = '100%';
                            img.style.borderRadius = '1rem';
                            img.style.marginTop = '1rem';
                            img.style.marginBottom = '1rem';
                            img.style.display = 'block';
                        }
                    });
                }, 100);
            } else if (type === 'video') {
                const videoHtml = `
<div style="margin:20px 0;padding:16px;background-color:#0f172a;border-radius:16px;color:#ffffff;text-align:center;">
  <video controls style="width:100%;max-width:540px;border-radius:12px;display:block;margin:0 auto;">
    <source src="${publicUrl}" type="${file.type}">
    Tu navegador no soporta reproducción directa de video.
  </video>
  <div style="margin-top:12px;">
    <a href="${publicUrl}" target="_blank" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:8px 18px;border-radius:8px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-decoration:none;">
      ▶ Abrir o Descargar Video (${(file.size / 1024 / 1024).toFixed(1)} MB)
    </a>
  </div>
</div><br/>`;
                execCommand('insertHTML', videoHtml);
                setShowVideoModal(false);
            } else {
                const docHtml = `
<div contenteditable="false" style="margin:16px 0;padding:14px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;display:flex;align-items:center;gap:12px;">
  <div style="width:40px;height:40px;background-color:#dbeafe;color:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:bold;">
    📄
  </div>
  <div style="flex:1;overflow:hidden;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</p>
    <p style="margin:2px 0 0 0;font-size:10px;color:#64748b;font-weight:bold;text-transform:uppercase;">${(file.size / 1024 / 1024).toFixed(2)} MB • Documento</p>
  </div>
  <a href="${publicUrl}" target="_blank" style="padding:8px 14px;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:8px;font-size:11px;font-weight:bold;text-decoration:none;color:#0f172a;">Ver Archivo</a>
</div><br/>`;
                execCommand('insertHTML', docHtml);
            }

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
            toast.success('Archivo subido');
        } catch (error: any) {
            console.error('File upload error:', error);
            toast.error('Error al subir archivo. Verifica el tamaño o conexión.');
        } finally {
            setIsUploading(false);
            setIsUploadingVideo(false);
            event.target.value = '';
        }
    };

    // --- WHATSAPP & PHONE INSERTION ---
    const addWhatsAppLink = () => {
        if (!whatsappNumber) return;
        const cleanNumber = whatsappNumber.replace(/\D/g, '');
        let waUrl = `https://wa.me/${cleanNumber}`;
        if (whatsappMessage) waUrl += `?text=${encodeURIComponent(whatsappMessage)}`;

        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            execCommand('createLink', waUrl);
        } else {
            const btnHtml = `<a href="${waUrl}" style="color:#25D366; font-weight:bold; text-decoration:none;">WhatsApp: ${whatsappNumber}</a>`;
            execCommand('insertHTML', btnHtml);
        }
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setWhatsappNumber('');
        setWhatsappMessage('');
        setShowWhatsAppInput(false);
    };

    const addPhoneLink = () => {
        if (!phoneNumber) return;
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const telUrl = `tel:${cleanNumber}`;
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            execCommand('createLink', telUrl);
        } else {
            const btnHtml = `<a href="${telUrl}" style="color:#0f172a; font-weight:bold; text-decoration:none;">Tel: ${phoneNumber}</a>`;
            execCommand('insertHTML', btnHtml);
        }
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setPhoneNumber('');
        setShowPhoneInput(false);
    };

    // --- CTA PRO BLOCK ---
    const insertCtaBlock = () => {
        const cleanWa = ctaWhatsapp.replace(/\D/g, '');
        const waUrl = `https://wa.me/${cleanWa}${ctaWhatsappMsg ? '?text=' + encodeURIComponent(ctaWhatsappMsg) : ''}`;
        const bookUrl = ctaBookingUrl || '#';
        const mailUrl = `mailto:${ctaEmail}?subject=Consulta%20sobre%20promoción`;

        const ctaHtml = `
<div style="margin:24px 0;padding:0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
    <tr><td style="padding:6px 0;">
      <a href="${waUrl}" target="_blank" style="display:block;background-color:#25D366;color:#ffffff;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.5px;">
        💬&nbsp;&nbsp;CHATEAR POR WHATSAPP
      </a>
    </td></tr>
    <tr><td style="padding:6px 0;">
      <a href="${bookUrl}" target="_blank" style="display:block;background-color:#4F46E5;color:#ffffff;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.5px;">
        📅&nbsp;&nbsp;AGENDAR REUNIÓN GRATUITA
      </a>
    </td></tr>
    <tr><td style="padding:6px 0;">
      <a href="${mailUrl}" style="display:block;background-color:#F1F5F9;color:#334155;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.5px;border:1px solid #E2E8F0;">
        📧&nbsp;&nbsp;RESPONDER A ESTE CORREO
      </a>
    </td></tr>
    <tr><td style="padding:16px 0 0 0;text-align:center;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#94A3B8;letter-spacing:0.5px;">🔒 Comunicación directa y personalizada</p>
      <p style="margin:4px 0 0 0;font-family:Arial,sans-serif;font-size:10px;color:#CBD5E1;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">${ctaCompanyName}</p>
    </td></tr>
  </table>
</div><br/>`;

        execCommand('insertHTML', ctaHtml);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setShowCtaPro(false);
        toast.success('Bloque CTA insertado');
    };

    return (
        <div className="flex flex-col flex-1 border border-gray-200 rounded-2xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all relative">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-100 rounded-t-2xl">
                <ToolbarButton onClick={() => execCommand('bold')} icon={Bold} title="Negrita" />
                <ToolbarButton onClick={() => execCommand('italic')} icon={Italic} title="Cursiva" />
                <ToolbarButton onClick={() => execCommand('underline')} icon={Underline} title="Subrayado" />
                <div className="w-px h-6 bg-gray-200 mx-1" />
                
                <ToolbarButton onClick={() => execCommand('formatBlock', 'H1')} icon={Heading1} title="Título 1" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'H2')} icon={Heading2} title="Título 2" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'P')} icon={Type} title="Párrafo normal" />
                <div className="w-px h-6 bg-gray-200 mx-1" />

                <ToolbarButton onClick={openLinkModal} icon={LinkIcon} title="Insertar Enlace con Texto" active={showLinkInput} />
                <ToolbarButton onClick={() => { closeAllModals(); setShowWhatsAppInput(!showWhatsAppInput); }} icon={MessageCircle} title="Botón WhatsApp" active={showWhatsAppInput} />
                <ToolbarButton onClick={() => { closeAllModals(); setShowPhoneInput(!showPhoneInput); }} icon={Phone} title="Número de Teléfono" active={showPhoneInput} />
                <ToolbarButton onClick={() => { closeAllModals(); setShowVariables(!showVariables); }} icon={UserIcon} title="Variables Dinámicas (Nombre, Iglesia, Saludo)" active={showVariables} />
                
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <ToolbarButton onClick={() => { closeAllModals(); setShowCtaPro(!showCtaPro); }} icon={Zap} title="CTA Pro — Bloque de Acción" active={showCtaPro} />
                <ToolbarButton onClick={() => { closeAllModals(); setShowSignatureModal(!showSignatureModal); }} icon={PenLine} title="Firma de Correo Profesional (Foto redonda, Cargo, Logo)" active={showSignatureModal} />
                
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <label className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Insertar Imagen">
                    <ImageIcon className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} disabled={isUploading} />
                    {isUploading && <Loader2 className="w-3 h-3 animate-spin absolute top-1 right-1 text-indigo-500" />}
                </label>
                <ToolbarButton onClick={() => { closeAllModals(); setShowVideoModal(!showVideoModal); }} icon={Video} title="Insertar Video (YouTube o Archivo)" active={showVideoModal} />
                <label className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Adjuntar Documento">
                    <FileText className="w-4 h-4" />
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => handleFileUpload(e, 'document')} disabled={isUploading} />
                </label>

                <div className="flex-1" />
                <ToolbarButton onClick={() => { execCommand('removeFormat'); if (editorRef.current) onChange(editorRef.current.innerHTML); }} icon={X} title="Limpiar Formato" />
            </div>

            {/* MODAL 1: LINK POPUP */}
            {showLinkInput && (
                <div className="p-4 bg-white border border-indigo-100 rounded-2xl shadow-xl m-2 space-y-3 z-30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                            <LinkIcon className="w-3.5 h-3.5 text-indigo-600" /> Insertar Enlace con Texto Personalizado
                        </span>
                        <button onClick={() => setShowLinkInput(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Texto a mostrar al usuario</label>
                            <input
                                type="text"
                                placeholder="Ej: Ver video de 45 segundos"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700"
                                value={linkText}
                                onChange={(e) => setLinkText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Dirección Web (URL)</label>
                            <input
                                type="text"
                                placeholder="https://youtu.be/... o https://iclesia.ai"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && insertCustomLink()}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600">
                            <input
                                type="checkbox"
                                checked={linkAsButton}
                                onChange={(e) => setLinkAsButton(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            Mostrar como Botón Destacado
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => setShowLinkInput(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                            <button onClick={insertCustomLink} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md">
                                Insertar Enlace
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: VIDEO POPUP (YOUTUBE & MP4) */}
            {showVideoModal && (
                <div className="p-5 bg-white border border-indigo-100 rounded-2xl shadow-2xl m-2 space-y-4 z-30 animate-in fade-in slide-in-from-top-2 max-w-xl">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                                <Play className="w-4 h-4 fill-current" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">Insertar Video Profesional</h4>
                                <p className="text-[10px] text-gray-400 font-medium">Compatible al 100% con Gmail, Outlook y móviles</p>
                            </div>
                        </div>
                        <button onClick={() => setShowVideoModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setVideoTab('youtube')}
                            className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${videoTab === 'youtube' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            YouTube (Recomendado Email)
                        </button>
                        <button
                            onClick={() => setVideoTab('upload')}
                            className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${videoTab === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            Subir Archivo de Video
                        </button>
                    </div>

                    {videoTab === 'youtube' ? (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Enlace de YouTube</label>
                                <input
                                    type="text"
                                    placeholder="https://youtu.be/dvR5zR1x3os o https://www.youtube.com/watch?v=..."
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-500 font-bold text-gray-700"
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Título / Texto del Video</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Ver cómo funciona Iclesia (Video 45 seg)"
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-500 font-bold text-gray-700"
                                    value={videoTitle}
                                    onChange={(e) => setVideoTitle(e.target.value)}
                                />
                            </div>

                            {/* Live Thumbnail Preview */}
                            {currentYtId && (
                                <div className="p-3 bg-gray-900 rounded-xl space-y-2 border border-gray-800">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vista Previa de la Tarjeta</p>
                                    <div className="relative rounded-lg overflow-hidden aspect-video bg-black flex items-center justify-center">
                                        <img
                                            src={`https://img.youtube.com/vi/${currentYtId}/maxresdefault.jpg`}
                                            alt="Preview"
                                            onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${currentYtId}/hqdefault.jpg`; }}
                                            className="w-full h-full object-cover opacity-90"
                                        />
                                        <div className="absolute w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl pl-0.5">
                                            <Play className="w-5 h-5 fill-current" />
                                        </div>
                                    </div>
                                    <p className="text-xs font-bold text-white truncate">▶ {videoTitle || 'Video'}</p>
                                </div>
                            )}

                            <button
                                onClick={insertYouTubeVideo}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4 fill-current" /> Insertar Tarjeta de Video YouTube
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-6 border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-2xl text-center space-y-2 bg-gray-50/50">
                                <Video className="w-8 h-8 text-indigo-500 mx-auto" />
                                <div>
                                    <p className="text-xs font-bold text-gray-700">Selecciona un video MP4 desde tu computadora</p>
                                    <p className="text-[10px] text-gray-400">Tamaño máximo recomendado: 45MB</p>
                                </div>
                                <label className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-md">
                                    {isUploadingVideo ? 'Subiendo video...' : 'Elegir archivo de video'}
                                    <input type="file" className="hidden" accept="video/mp4,video/webm" onChange={(e) => handleFileUpload(e, 'video')} disabled={isUploadingVideo} />
                                </label>
                                {isUploadingVideo && <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mx-auto mt-2" />}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 3: SIGNATURE POPUP */}
            {showSignatureModal && (
                <div className="p-5 bg-white border border-indigo-100 rounded-2xl shadow-2xl m-2 space-y-4 z-30 animate-in fade-in slide-in-from-top-2 max-w-xl">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <PenLine className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">Firma de Correo Profesional</h4>
                                <p className="text-[10px] text-gray-400 font-medium">Foto redonda, cargo, teléfono, iglesia y logo</p>
                            </div>
                        </div>
                        <button onClick={() => setShowSignatureModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Tu Nombre Completo</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                                value={sigName}
                                onChange={(e) => setSigName(e.target.value)}
                                placeholder="Jimmy Arias"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Cargo / Título</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                                value={sigTitle}
                                onChange={(e) => setSigTitle(e.target.value)}
                                placeholder="Fundador"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Iglesia / Empresa</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                                value={sigCompany}
                                onChange={(e) => setSigCompany(e.target.value)}
                                placeholder="Iclesia"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Teléfono / WhatsApp</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                                value={sigPhone}
                                onChange={(e) => setSigPhone(e.target.value)}
                                placeholder="703 945 9240"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Sitio Web / Link</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                                value={sigWebsite}
                                onChange={(e) => setSigWebsite(e.target.value)}
                                placeholder="iclesia.ai"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Foto Redonda (Avatar)</label>
                            <div className="flex gap-2 items-center">
                                <label className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-600 text-center cursor-pointer transition truncate">
                                    {isUploadingAvatar ? 'Subiendo...' : sigAvatar ? 'Cambiar Foto' : 'Subir Foto'}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleUploadAvatar} disabled={isUploadingAvatar} />
                                </label>
                                {sigAvatar && (
                                    <img src={sigAvatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-indigo-400" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">Logo Pequeño (Abajo)</label>
                        <div className="flex gap-2 items-center">
                            <label className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-600 cursor-pointer transition">
                                {isUploadingLogo ? 'Subiendo...' : sigLogo ? 'Cambiar Logo' : 'Subir Logo'}
                                <input type="file" className="hidden" accept="image/*" onChange={handleUploadLogo} disabled={isUploadingLogo} />
                            </label>
                            <input
                                type="text"
                                placeholder="O pega la URL del logo aquí..."
                                className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none font-medium"
                                value={sigLogo}
                                onChange={(e) => setSigLogo(e.target.value)}
                            />
                            {sigLogo && (
                                <img src={sigLogo} alt="Logo" className="h-6 max-w-[80px] object-contain border border-gray-200 rounded p-0.5 bg-white" />
                            )}
                        </div>
                    </div>

                    {/* Live Signature Preview */}
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vista Previa de tu Firma</p>
                        <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                            {sigAvatar ? (
                                <img src={sigAvatar} alt={sigName} className="w-14 h-14 rounded-full object-cover border-2 border-indigo-400 shadow-sm flex-shrink-0" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-lg flex-shrink-0">
                                    {(sigName || 'J').charAt(0)}
                                </div>
                            )}
                            <div className="border-l-2 border-gray-100 pl-4 space-y-0.5 text-left">
                                <p className="text-sm font-extrabold text-gray-900">{sigName || 'Tu Nombre'}</p>
                                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{sigTitle || 'Cargo'} • {sigCompany || 'Iglesia'}</p>
                                <p className="text-xs text-gray-500 font-medium">📞 {sigPhone} &nbsp;•&nbsp; 🌐 {sigWebsite}</p>
                                {sigLogo && (
                                    <div className="pt-2">
                                        <img src={sigLogo} alt={sigCompany} className="h-6 object-contain" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setShowSignatureModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                        <button
                            onClick={insertSignature}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                        >
                            <PenLine className="w-4 h-4" /> Insertar Firma en el Correo
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL 4: DYNAMIC VARIABLES */}
            {showVariables && (
                <div className="p-3 bg-purple-50/90 border-b border-purple-100 flex flex-wrap gap-2 items-center rounded-xl m-2 shadow-sm animate-in fade-in duration-200">
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1 mr-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Variables:
                    </span>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{first_name}}'); setShowVariables(false); }}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
                        title="Nombre del lead (Ej: Jimmy)"
                    >
                        Nombre
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{name}}'); setShowVariables(false); }}
                        className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-200 transition border border-purple-200"
                        title="Nombre completo del lead"
                    >
                        Nombre Completo
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{company_name}}'); setShowVariables(false); }}
                        className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-black hover:bg-emerald-700 transition shadow-sm flex items-center gap-1.5"
                        title="Inserta el nombre de la empresa o iglesia (Ej: Iglesia Bautista Gracia)"
                    >
                        <Building2 className="w-3.5 h-3.5" /> Empresa / Iglesia
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{greeting}}'); setShowVariables(false); }}
                        className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 transition border border-amber-200"
                        title="Saludo según la hora (Buenos días / Buenas tardes)"
                    >
                        Saludo Inteligente
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{phone}}'); setShowVariables(false); }}
                        className="bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-50 transition"
                        title="Teléfono del lead"
                    >
                        Teléfono
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => setShowVariables(false)} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* MODAL 5: WHATSAPP DIRECT */}
            {showWhatsAppInput && (
                <div className="p-3 bg-green-50 border-b border-green-100 flex flex-col gap-3 absolute top-12 left-0 z-20 w-80 rounded-xl border shadow-xl">
                    <div className="flex justify-between items-center border-b border-green-200 pb-2">
                        <span className="text-[10px] font-black uppercase text-green-800">Botón WhatsApp</span>
                        <button onClick={() => setShowWhatsAppInput(false)}><X className="w-3 h-3 text-green-600" /></button>
                    </div>
                    <input type="text" placeholder="Número (Ej: 503...)" className="w-full px-3 py-2 text-xs rounded-lg border border-green-200" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
                    <textarea placeholder="Mensaje..." className="w-full px-3 py-2 text-xs rounded-lg border border-green-200 min-h-[60px]" value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} />
                    <button onClick={addWhatsAppLink} className="w-full bg-green-600 text-white py-2 rounded-lg text-[10px] font-black uppercase">Insertar</button>
                </div>
            )}

            {/* MODAL 6: PHONE DIRECT */}
            {showPhoneInput && (
                <div className="p-2 bg-indigo-50 border-b border-indigo-100 flex gap-2 items-center">
                    <input type="text" placeholder="Teléfono..." className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-indigo-200 outline-none" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPhoneLink()} autoFocus />
                    <button onClick={addPhoneLink} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Añadir</button>
                    <button onClick={() => setShowPhoneInput(false)} className="p-1.5 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* MODAL 7: CTA PRO */}
            {showCtaPro && (
                <div className="p-4 bg-gradient-to-br from-indigo-50 to-white border-b border-indigo-100 absolute top-12 left-0 z-20 w-96 rounded-xl border shadow-2xl">
                    <div className="flex justify-between items-center border-b border-indigo-200 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-indigo-600" />
                            <span className="text-[11px] font-black uppercase text-indigo-800 tracking-widest">CTA Pro — Llamada a la Acción</span>
                        </div>
                        <button onClick={() => setShowCtaPro(false)}><X className="w-3.5 h-3.5 text-indigo-400" /></button>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">WhatsApp — Número</label>
                            <input type="text" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-green-400" value={ctaWhatsapp} onChange={(e) => setCtaWhatsapp(e.target.value)} placeholder="50379718911" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">WhatsApp — Mensaje Pre-llenado</label>
                            <input type="text" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-green-400" value={ctaWhatsappMsg} onChange={(e) => setCtaWhatsappMsg(e.target.value)} placeholder="Hola, me interesa..." />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">📅 URL de Agenda (Booking Page)</label>
                            <input type="text" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-indigo-400" value={ctaBookingUrl} onChange={(e) => setCtaBookingUrl(e.target.value)} placeholder="https://crm-app-v2.vercel.app/book/mi-agenda" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">📧 Email de Respuesta</label>
                            <input type="text" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none" value={ctaEmail} onChange={(e) => setCtaEmail(e.target.value)} placeholder="ventas@empresa.com" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">🏢 Nombre de Empresa (Footer)</label>
                            <input type="text" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none" value={ctaCompanyName} onChange={(e) => setCtaCompanyName(e.target.value)} />
                        </div>
                        <button onClick={insertCtaBlock} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2">
                            <Zap className="w-3.5 h-3.5" /> Insertar Bloque CTA
                        </button>
                    </div>
                </div>
            )}

            {/* Editable Content Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="flex-1 p-6 outline-none prose prose-sm max-w-none min-h-[400px] overflow-y-auto bg-white rounded-b-2xl"
            />

            {placeholder && !value && (
                <div className="absolute top-24 left-8 text-gray-400 pointer-events-none text-sm italic">
                    {placeholder}
                </div>
            )}
        </div>
    );
}

function ToolbarButton({ onClick, icon: Icon, title, active = false }: any) {
    return (
        <button
            onClick={(e) => { e.preventDefault(); onClick(); }}
            title={title}
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${active ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-gray-500 hover:bg-white hover:text-indigo-600'}`}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}
