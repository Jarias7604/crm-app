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
    User as UserIcon
} from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    channel?: 'email' | 'whatsapp' | 'telegram';
}

export default function RichTextEditor({ value, onChange, placeholder, channel = 'email' }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
    const [showPhoneInput, setShowPhoneInput] = useState(false);
    const [showVariables, setShowVariables] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (type === 'image' && !file.type.startsWith('image/')) {
            toast.error('Por favor selecciona una imagen válida');
            return;
        }
        if (type === 'video' && !file.type.startsWith('video/')) {
            toast.error('Por favor selecciona un video válido');
            return;
        }

        const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
        const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
        const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25MB

        if (type === 'image' && file.size > MAX_IMAGE_SIZE) {
            toast.error('La imagen es demasiado grande (máximo 10MB)');
            return;
        }
        if (type === 'video' && file.size > MAX_VIDEO_SIZE) {
            toast.error('El video es demasiado grande (máximo 100MB)');
            return;
        }
        if (type === 'document' && file.size > MAX_DOC_SIZE) {
            toast.error('El documento es demasiado grande (máximo 25MB)');
            return;
        }

        setIsUploading(true);
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
                    <div contenteditable="false" class="my-4">
                        <video controls class="w-full rounded-2xl shadow-lg border border-gray-100">
                            <source src="${publicUrl}" type="${file.type}">
                            Tu navegador no soporta el elemento de video.
                        </video>
                        <p class="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">Video: ${file.name}</p>
                    </div><br/>
                `;
                execCommand('insertHTML', videoHtml);
            } else {
                const docHtml = `
                    <div contenteditable="false" class="my-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <p class="text-xs font-black text-gray-900 truncate">${file.name}</p>
                            <p class="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">${(file.size / 1024 / 1024).toFixed(2)} MB • Doc</p>
                        </div>
                        <a href="${publicUrl}" target="_blank" class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase hover:bg-gray-50 shadow-sm">Ver</a>
                    </div><br/>
                `;
                execCommand('insertHTML', docHtml);
            }

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
            toast.success('Archivo subido');
        } catch (error: any) {
            toast.error('Error al subir archivo');
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    const addLink = () => {
        if (!linkUrl) return;
        execCommand('createLink', linkUrl);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setLinkUrl('');
        setShowLinkInput(false);
    };

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

    return (
        <div className="flex flex-col flex-1 border border-gray-200 rounded-2xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all relative">
            <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-100">
                <ToolbarButton onClick={() => execCommand('bold')} icon={Bold} title="Negrita" />
                <ToolbarButton onClick={() => execCommand('italic')} icon={Italic} title="Cursiva" />
                <ToolbarButton onClick={() => execCommand('underline')} icon={Underline} title="Subrayado" />
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'H1')} icon={Heading1} title="H1" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'H2')} icon={Heading2} title="H2" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'P')} icon={Type} title="Texto" />
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <ToolbarButton onClick={() => setShowLinkInput(!showLinkInput)} icon={LinkIcon} title="Enlace" active={showLinkInput} />
                <ToolbarButton onClick={() => { setShowWhatsAppInput(!showWhatsAppInput); setShowPhoneInput(false); setShowLinkInput(false); setShowVariables(false); }} icon={MessageCircle} title="WhatsApp" active={showWhatsAppInput} />
                <ToolbarButton onClick={() => { setShowPhoneInput(!showPhoneInput); setShowWhatsAppInput(false); setShowLinkInput(false); setShowVariables(false); }} icon={Phone} title="Llamada" active={showPhoneInput} />
                <ToolbarButton onClick={() => { setShowVariables(!showVariables); setShowPhoneInput(false); setShowWhatsAppInput(false); setShowLinkInput(false); }} icon={UserIcon} title="Personalización" active={showVariables} />
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <label className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Imagen">
                    <ImageIcon className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} disabled={isUploading} />
                    {isUploading && <Loader2 className="w-3 h-3 animate-spin absolute top-1 right-1 text-blue-500" />}
                </label>
                <label className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Video">
                    <Video className="w-4 h-4" />
                    <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} disabled={isUploading} />
                    {isUploading && <Loader2 className="w-3 h-3 animate-spin absolute top-1 right-1 text-blue-500" />}
                </label>
                <label className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Doc">
                    <FileText className="w-4 h-4" />
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => handleFileUpload(e, 'document')} disabled={isUploading} />
                    {isUploading && <Loader2 className="w-3 h-3 animate-spin absolute top-1 right-1 text-blue-500" />}
                </label>

                <div className="flex-1" />
                <ToolbarButton onClick={() => { execCommand('removeFormat'); if (editorRef.current) onChange(editorRef.current.innerHTML); }} icon={X} title="Limpiar" />
            </div>

            {showLinkInput && (
                <div className="p-2 bg-blue-50 border-b border-blue-100 flex gap-2 items-center">
                    <input type="text" placeholder="https://..." className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-blue-200 outline-none" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} autoFocus />
                    <button onClick={addLink} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Añadir</button>
                    <button onClick={() => setShowLinkInput(false)} className="p-1.5 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
            )}

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

            {showPhoneInput && (
                <div className="p-2 bg-indigo-50 border-b border-indigo-100 flex gap-2 items-center">
                    <input type="text" placeholder="Teléfono..." className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-indigo-200 outline-none" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPhoneLink()} autoFocus />
                    <button onClick={addPhoneLink} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Añadir</button>
                    <button onClick={() => setShowPhoneInput(false)} className="p-1.5 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
            )}

            {showVariables && (
                <div className="p-2 bg-purple-50 border-b border-purple-100 flex gap-2 items-center">
                    <span className="text-[10px] font-black uppercase text-purple-600 ml-2">Variables:</span>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{name}}'); setShowVariables(false); }}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
                    >
                        Nombre Completo
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{first_name}}'); setShowVariables(false); }}
                        className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors"
                    >
                        Nombre
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{greeting}}'); setShowVariables(false); }}
                        className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors border border-amber-200"
                    >
                        Saludo (SaaS Smart)
                    </button>
                    <button
                        onClick={() => { execCommand('insertHTML', '{{phone}}'); setShowVariables(false); }}
                        className="bg-white border border-purple-200 text-purple-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-50 transition-colors"
                    >
                        Teléfono
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => setShowVariables(false)} className="p-1.5 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="flex-1 p-6 outline-none prose prose-sm max-w-none min-h-[400px] overflow-y-auto bg-white"
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
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${active ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-white hover:text-blue-600'}`}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}
