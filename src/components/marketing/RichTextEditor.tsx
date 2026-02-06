import React, { useRef, useEffect, useState } from 'react';
import {
    Bold,
    Italic,
    Underline,
    Image,
    Video,
    Link as LinkIcon,
    Heading1,
    Heading2,
    Type,
    X,
    Loader2,
    MessageCircle,
    Phone
} from 'lucide-react';
import { campaignService } from '../../services/marketing/campaignService';
import toast from 'react-hot-toast';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
    const [showPhoneInput, setShowPhoneInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    // Sync with external value changes (e.g. templates)
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            // Only update if the editor is not the active element (prevents cursor jumps)
            // or if the value is being reset/cleared
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
            // Ensure we have a selection or place caret at end
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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validation
        if (type === 'image' && !file.type.startsWith('image/')) {
            toast.error('Por favor selecciona una imagen válida');
            return;
        }
        if (type === 'video' && !file.type.startsWith('video/')) {
            toast.error('Por favor selecciona un video válido');
            return;
        }

        // Size validation
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
        const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for videos

        if (type === 'image' && file.size > MAX_IMAGE_SIZE) {
            toast.error('La imagen es demasiado grande (máximo 5MB)');
            return;
        }
        if (type === 'video' && file.size > MAX_VIDEO_SIZE) {
            toast.error('El video es demasiado grande (máximo 50MB para carga directa)');
            return;
        }

        setIsUploading(true);
        try {
            const publicUrl = await campaignService.uploadMarketingAsset(file);

            if (type === 'image') {
                execCommand('insertImage', publicUrl);
                // Additional styling for images
                setTimeout(() => {
                    const images = editorRef.current?.querySelectorAll('img');
                    images?.forEach(img => {
                        if (img.src === publicUrl) {
                            img.style.maxWidth = '100%';
                            img.style.borderRadius = '1rem';
                            img.style.marginTop = '1rem';
                            img.style.marginBottom = '1rem';
                            img.style.display = 'block';
                        }
                    });
                }, 100);
            } else {
                // For videos, we insert a video tag if supported or just a link with icon
                const videoHtml = `
                    <div contenteditable="false" class="my-4">
                        <video controls class="w-full rounded-2xl shadow-lg border border-gray-100">
                            <source src="${publicUrl}" type="${file.type}">
                            Tu navegador no soporta el elemento de video.
                        </video>
                    </div><br/>
                `;
                execCommand('insertHTML', videoHtml);
            }

            // Manually trigger onChange after programmatic update
            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }

            toast.success('Archivo subido con éxito');
        } catch (error: any) {
            console.error(error);
            toast.error(`Error al subir: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsUploading(false);
            event.target.value = ''; // Reset input
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
        // Clean number, ensure format
        const cleanNumber = whatsappNumber.replace(/\D/g, '');
        let waUrl = `https://wa.me/${cleanNumber}`;

        if (whatsappMessage) {
            waUrl += `?text=${encodeURIComponent(whatsappMessage)}`;
        }

        // If selection exists, link it. If not, insert standard text.
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            execCommand('createLink', waUrl);
        } else {
            const btnHtml = `<a href="${waUrl}" style="display:inline-flex; align-items:center; color:#25D366; font-weight:bold; text-decoration:none;">WhatsApp: ${whatsappNumber}</a>`;
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
            const btnHtml = `<a href="${telUrl}" style="display:inline-flex; align-items:center; color:#0f172a; font-weight:bold; text-decoration:none;">Llamar: ${phoneNumber}</a>`;
            execCommand('insertHTML', btnHtml);
        }

        if (editorRef.current) onChange(editorRef.current.innerHTML);
        setPhoneNumber('');
        setShowPhoneInput(false);
    };

    return (
        <div className="flex flex-col flex-1 border border-gray-200 rounded-2xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all relative">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-100">
                <ToolbarButton onClick={() => execCommand('bold')} icon={Bold} title="Negrita" />
                <ToolbarButton onClick={() => execCommand('italic')} icon={Italic} title="Cursiva" />
                <ToolbarButton onClick={() => execCommand('underline')} icon={Underline} title="Subrayado" />

                <div className="w-px h-6 bg-gray-200 mx-1" />

                <ToolbarButton onClick={() => execCommand('formatBlock', 'H1')} icon={Heading1} title="Título 1" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'H2')} icon={Heading2} title="Título 2" />
                <ToolbarButton onClick={() => execCommand('formatBlock', 'P')} icon={Type} title="Texto Normal" />

                <div className="w-px h-6 bg-gray-200 mx-1" />

                <ToolbarButton onClick={() => setShowLinkInput(!showLinkInput)} icon={LinkIcon} title="Insertar Enlace" active={showLinkInput} />

                <ToolbarButton onClick={() => {
                    setShowWhatsAppInput(!showWhatsAppInput);
                    setShowPhoneInput(false);
                    setShowLinkInput(false);
                }}
                    icon={MessageCircle}
                    title="WhatsApp"
                    active={showWhatsAppInput}
                />

                <ToolbarButton onClick={() => {
                    setShowPhoneInput(!showPhoneInput);
                    setShowWhatsAppInput(false);
                    setShowLinkInput(false);
                }}
                    icon={Phone}
                    title="Llamada Telefónica"
                    active={showPhoneInput}
                />

                <label className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Subir Imagen">
                    <Image className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} disabled={isUploading} />
                    {isUploading && <Loader2 className="w-3 h-3 animate-spin absolute top-1 right-1 text-blue-500" />}
                </label>

                <label className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all cursor-pointer text-gray-500 relative group" title="Subir Video">
                    <Video className="w-4 h-4" />
                    <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} disabled={isUploading} />
                    {isUploading && <Loader2 className="w-3 h-3 animate-spin absolute top-1 right-1 text-blue-500" />}
                </label>

                <div className="flex-1" />

                <ToolbarButton
                    onClick={() => {
                        execCommand('removeFormat');
                        if (editorRef.current) onChange(editorRef.current.innerHTML);
                    }}
                    icon={X}
                    title="Limpiar Formato"
                />
            </div>

            {/* Link Input Overlay */}
            {showLinkInput && (
                <div className="p-2 bg-blue-50 border-b border-blue-100 flex gap-2 items-center animate-in slide-in-from-top-1">
                    <input
                        type="text"
                        placeholder="https://ejemplo.com"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addLink()}
                        autoFocus
                    />
                    <button onClick={addLink} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
                        Añadir
                    </button>
                    <button onClick={() => setShowLinkInput(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* WhatsApp Input Overlay */}
            {showWhatsAppInput && (
                <div className="p-3 bg-green-50 border-b border-green-100 flex flex-col gap-3 animate-in slide-in-from-top-1 shadow-lg z-10 w-full max-w-md absolute top-12 left-0 rounded-xl border">
                    <div className="flex justify-between items-center border-b border-green-200 pb-2 mb-1">
                        <span className="text-xs font-bold text-green-800 flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> Configurar Botón WhatsApp
                        </span>
                        <button onClick={() => setShowWhatsAppInput(false)} className="text-green-600 hover:text-green-800">
                            <X className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-green-700 tracking-wider mb-1 block">Número de Destino</label>
                            <input
                                type="text"
                                placeholder="Ej: 50377777777"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-green-200 outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-green-700 tracking-wider mb-1 block">Mensaje Automático</label>
                            <div className="relative">
                                <textarea
                                    placeholder="Hola, ví este contenido y me interesa..."
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-green-200 outline-none focus:ring-2 focus:ring-green-500/20 bg-white min-h-[80px] resize-none"
                                    value={whatsappMessage}
                                    onChange={(e) => setWhatsappMessage(e.target.value)}
                                />
                            </div>

                            {/* Toolbar Row moved below textarea */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => {
                                        if (!editorRef.current) return;
                                        const text = editorRef.current.innerText.trim();
                                        const firstImg = editorRef.current.querySelector('img')?.src;

                                        let finalMsg = text;
                                        if (firstImg) {
                                            finalMsg += `\n\nVer imagen: ${firstImg}`;
                                        }
                                        setWhatsappMessage(finalMsg.substring(0, 500));
                                        toast.success('Contenido importado del editor');
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                                    title="Copiar texto e imagen del editor"
                                >
                                    <Type className="w-3 h-3" /> Importar Texto
                                </button>
                                <label className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100 hover:bg-green-100 transition-colors cursor-pointer" title="Adjuntar Flyer/Video">
                                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                                    {isUploading ? 'Subiendo...' : 'Adjuntar Media'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*,video/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setIsUploading(true);
                                            try {
                                                const url = await campaignService.uploadMarketingAsset(file);
                                                const newMsg = whatsappMessage ? `${whatsappMessage}\n\nVer archivo: ${url}` : `Hola! Me interesa este archivo: ${url}`;
                                                setWhatsappMessage(newMsg);
                                                toast.success('Archivo adjuntado al mensaje');
                                            } catch (err) {
                                                toast.error('Error al subir archivo');
                                            } finally {
                                                setIsUploading(false);
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            <p className="text-[10px] text-green-600 mt-1">
                                * Se generará un enlace. WhatsApp mostrará la vista previa del archivo automáticamente.
                            </p>
                        </div>

                        <button
                            onClick={addWhatsAppLink}
                            disabled={!whatsappNumber}
                            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            Insertar Botón de WhatsApp
                        </button>
                    </div>
                </div>
            )}

            {/* Phone Input Overlay */}
            {showPhoneInput && (
                <div className="p-2 bg-indigo-50 border-b border-indigo-100 flex gap-2 items-center animate-in slide-in-from-top-1">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <input
                        type="text"
                        placeholder="Número de Teléfono (Ej: +503 2222-2222)"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPhoneLink()}
                        autoFocus
                    />
                    <button onClick={addPhoneLink} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all">
                        Añadir Llamada
                    </button>
                    <button onClick={() => setShowPhoneInput(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="flex-1 p-6 outline-none prose prose-sm max-w-none prose-slate min-h-[400px] overflow-y-auto bg-white"
                style={{
                    // Custom styles for contentEditable
                }}
            />

            {placeholder && !value && (
                <div className="absolute top-[8.5rem] left-8 text-gray-400 pointer-events-none text-sm italic">
                    {placeholder}
                </div>
            )}
        </div>
    );
}

function ToolbarButton({ onClick, icon: Icon, title, active = false }: any) {
    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                onClick();
            }}
            title={title}
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${active ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-white hover:text-blue-600'
                }`}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}
