import { useState, useEffect } from 'react';
import { brandingService } from '../../services/branding';
import { storageService } from '../../services/storage';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, Save, Upload, Globe, Image as ImageIcon, CheckCircle2, X, Maximize2, Square, FileText, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Company } from '../../types';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/cropImage';
import { createPortal } from 'react-dom';

export default function Branding() {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [tcPreview, setTcPreview] = useState(false);
    const [tcOpen, setTcOpen] = useState(false);
    const [logoDarkBg, setLogoDarkBg] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        website: '',
        address: '',
        phone: '',
        logo_url: '',
        terminos_condiciones: '',
        date_format: 'DD/MM/YYYY',
        time_format: '24h',
        timezone: 'America/El_Salvador'
    });

    // Cropping state
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [aspectRatio, setAspectRatio] = useState<number>(1); // Default to square

    useEffect(() => {
        loadBranding();
    }, []);

    const loadBranding = async () => {
        try {
            setLoading(true);
            const data = await brandingService.getMyCompany();
            setCompany(data);
            setFormData({
                name: data.name,
                website: data.website || '',
                address: data.address || '',
                phone: data.phone || '',
                logo_url: data.logo_url || '',
                terminos_condiciones: data.terminos_condiciones || '',
                date_format: data.date_format || 'DD/MM/YYYY',
                time_format: data.time_format || '24h',
                timezone: data.timezone || 'America/El_Salvador'
            });
        } catch (error) {
            console.error('Error loading branding:', error);
            toast.error('No se pudo cargar la configuración de marca');
        } finally {
            setLoading(false);
        }
    };

    const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageToCrop(reader.result as string);
        });
        reader.readAsDataURL(file);
    };

    const handleConfirmCrop = async () => {
        if (!imageToCrop || !croppedAreaPixels || !company) return;

        try {
            setUploading(true);
            const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
            if (!croppedImageBlob) throw new Error('Failed to crop image');

            // Convert blob to file
            const file = new File([croppedImageBlob], 'logo-cropped.png', { type: 'image/png' });

            const publicUrl = await storageService.uploadLogo(company.id, file);
            setFormData(prev => ({ ...prev, logo_url: publicUrl }));
            setImageToCrop(null); // Close modal
            toast.success('Logo recortado y subido correctamente');
        } catch (error) {
            console.error('Error cropping/uploading:', error);
            toast.error('Error al procesar la imagen');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            await brandingService.updateBranding({
                name: formData.name,
                website: formData.website,
                address: formData.address,
                phone: formData.phone,
                logo_url: formData.logo_url,
                terminos_condiciones: formData.terminos_condiciones,
                date_format: formData.date_format,
                time_format: formData.time_format,
                timezone: formData.timezone
            });
            toast.success('Configuración global actualizada');
        } catch (error: any) {
            console.error('Error saving branding:', error);
            toast.error(error.message || 'Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Marca Corporativa</h1>
                    <p className="text-gray-500 text-sm font-medium mt-0.5">Gestiona tu identidad visual y términos legales globales.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Section */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                    <form onSubmit={handleSubmit} className="bg-white p-7 rounded-2xl border border-gray-100 shadow-md space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/30 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

                        <div className="space-y-5 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Nombre Comercial</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        <Input
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="pl-8 h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm shadow-sm"
                                            placeholder="Tu Empresa S.A."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Sitio Web Oficial</label>
                                    <div className="relative group">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        <Input
                                            value={formData.website}
                                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            className="pl-8 h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm shadow-sm"
                                            placeholder="https://www.tusitio.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Teléfono Contacto</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">📞</div>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="pl-8 h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm shadow-sm"
                                            placeholder="+503 2200-0000"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Dirección Física</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">📍</div>
                                        <Input
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            className="pl-8 h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm shadow-sm"
                                            placeholder="Ciudad, País"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {/* T&C Accordion Header */}
                                <button
                                    type="button"
                                    onClick={() => setTcOpen(!tcOpen)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all duration-200 group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                            <FileText className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Términos y Condiciones Predeterminados</p>
                                            <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                {formData.terminos_condiciones
                                                    ? `${formData.terminos_condiciones.length} caracteres configurados`
                                                    : 'Sin configurar — haz clic para editar'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {formData.terminos_condiciones ? (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-wide border border-emerald-100">
                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                Configurado
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-wide border border-amber-100">Pendiente</span>
                                        )}
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${tcOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {/* T&C Expanded Editor */}
                                {tcOpen && (
                                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                                            <p className="text-[9px] text-slate-400 font-medium">Usa <code className="bg-blue-100 px-1 rounded text-blue-700 font-black">**texto**</code> para negrita</p>
                                            <div className="flex bg-white p-0.5 rounded-lg border border-slate-200">
                                                <button type="button" onClick={() => setTcPreview(false)} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all ${!tcPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Editar</button>
                                                <button type="button" onClick={() => setTcPreview(true)} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all ${tcPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Vista Previa</button>
                                            </div>
                                        </div>
                                        {!tcPreview ? (
                                            <textarea
                                                value={formData.terminos_condiciones}
                                                onChange={e => setFormData({ ...formData, terminos_condiciones: e.target.value })}
                                                className="w-full min-h-[160px] p-3 border-0 font-medium text-xs text-slate-600 bg-white leading-relaxed resize-none transition-all focus:outline-none focus:ring-0"
                                                placeholder="**Artículo 1: Objeto...**&#10;Este contrato establece los términos para el uso de...&#10;&#10;**Artículo 2: Pagos**..."
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="w-full min-h-[160px] p-3 overflow-y-auto space-y-2">
                                                {(formData.terminos_condiciones || '').split('\n\n').filter(p => p.trim()).map((para, idx) => (
                                                    <div key={idx} className="flex gap-2.5 items-start">
                                                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[8px] font-black mt-0.5">{idx + 1}</span>
                                                        <p className="text-xs text-slate-600 leading-relaxed font-medium flex-1">
                                                            {para.trim().split(/(\*\*.*?\*\*)/).map((part, i) =>
                                                                part.startsWith('**') && part.endsWith('**')
                                                                    ? <strong key={i} className="text-slate-900 font-black">{part.slice(2, -2)}</strong>
                                                                    : part
                                                            )}
                                                        </p>
                                                    </div>
                                                ))}
                                                {!formData.terminos_condiciones && (
                                                    <p className="text-slate-400 italic text-center py-10 text-xs">No hay contenido para mostrar.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Localization Section */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Configuración de Localización (Fechas y Horas)</label>
                                <div className="p-5 border border-slate-100 rounded-xl bg-indigo-50/30 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Formato de Fecha</label>
                                            <select value={formData.date_format} onChange={e => setFormData({ ...formData, date_format: e.target.value })} className="w-full h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm text-slate-700 bg-white shadow-sm transition-all outline-none px-3">
                                                <option value="DD/MM/YYYY">DD/MM/YYYY (Ej: 30/01/2026)</option>
                                                <option value="MM/DD/YYYY">MM/DD/YYYY (Ej: 01/30/2026)</option>
                                                <option value="YYYY-MM-DD">YYYY-MM-DD (Ej: 2026-01-30)</option>
                                                <option value="dd MMM, yyyy">30 Ene, 2026</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Formato de Hora</label>
                                            <select value={formData.time_format} onChange={e => setFormData({ ...formData, time_format: e.target.value })} className="w-full h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm text-slate-700 bg-white shadow-sm transition-all outline-none px-3">
                                                <option value="24h">24 Horas (Ej: 17:00)</option>
                                                <option value="12h">12 Horas (Ej: 05:00 PM)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Zona Horaria de Operación</label>
                                        <select value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} className="w-full h-11 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm text-slate-700 bg-white shadow-sm transition-all outline-none px-3">
                                            <option value="America/El_Salvador">El Salvador (CST)</option>
                                            <option value="America/Mexico_City">México (CST)</option>
                                            <option value="America/Bogota">Colombia (EST)</option>
                                            <option value="America/New_York">New York (EST)</option>
                                            <option value="Europe/Madrid">Madrid (CET)</option>
                                        </select>
                                        <p className="text-[9px] text-slate-400 font-medium ml-1 mt-0.5">* Afecta cómo se registran y muestran las fechas para todos los usuarios.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Logotipo Corporativo</label>
                                <div className="flex flex-col md:flex-row items-center gap-6 p-5 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:border-blue-400 transition-all duration-300">

                                    {/* Logo preview box with dark/light toggle */}
                                    <div className="flex flex-col items-center gap-2 shrink-0">
                                        <div className={`w-44 h-44 rounded-2xl shadow-lg border flex items-center justify-center overflow-hidden transition-colors duration-300 relative ${
                                            logoDarkBg ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-gray-100'
                                        }`}>
                                            {formData.logo_url ? (
                                                <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-4" />
                                            ) : (
                                                <ImageIcon className={`w-14 h-14 ${logoDarkBg ? 'text-slate-600' : 'text-gray-300'}`} />
                                            )}
                                        </div>
                                        {/* Dark/Light toggle */}
                                        <div className="flex bg-white rounded-xl border border-gray-200 shadow-sm p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setLogoDarkBg(false)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                                                    !logoDarkBg ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                            >
                                                ☀️ Claro
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLogoDarkBg(true)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                                                    logoDarkBg ? 'bg-[#0f172a] text-white' : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                            >
                                                🌙 Oscuro
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right side text & upload */}
                                    <div className="flex-1 space-y-4 md:pl-2">
                                        <div>
                                            <p className="text-base font-black text-[#0f172a] tracking-tight">Actualiza tu Identidad</p>
                                            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">Recomendamos PNG con fondo transparente.<br />El sistema permite recortar para un ajuste perfecto.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Formatos aceptados</p>
                                            <div className="flex gap-2">
                                                {['PNG', 'SVG', 'JPG', 'WEBP'].map(fmt => (
                                                    <span key={fmt} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-black border border-blue-100">{fmt}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="relative inline-block">
                                            <input type="file" accept="image/*" onChange={handleFileSelect} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                                            <Button type="button" variant="outline" disabled={uploading} className="rounded-xl border-gray-300 hover:border-blue-500 hover:text-blue-600 bg-white shadow-sm font-black text-xs h-10 px-6 relative z-10 transition-all">
                                                <Upload className="w-4 h-4 mr-2" />
                                                {uploading ? 'Cargando...' : 'Seleccionar Nuevo Logo'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 relative z-10">
                            <Button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm py-2.5">
                                {saving ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Guardando...</span>
                                    </div>
                                ) : (
                                    <><Save className="w-3.5 h-3.5" />Guardar Configuración</>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Preview Section */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                    <div className="sticky top-6 space-y-4">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Vista Previa Real</h3>
                            <div className="flex gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Live Preview</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100">
                            <div className="bg-[#0f172a] p-4 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                <div className="space-y-3 relative z-10">
                                    <div className="flex flex-col items-start gap-3">
                                        <div className="w-40 h-12 flex items-center justify-start overflow-hidden">
                                            {formData.logo_url ? (
                                                <img src={formData.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                                            ) : (
                                                <div className="flex items-center gap-1.5 px-2 text-white/40">
                                                    <Building2 className="w-4 h-4" />
                                                    <span className="text-xs font-black uppercase tracking-tighter">BRAND LOGO</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-black leading-none text-white uppercase tracking-tight">{formData.name || 'TU EMPRESA'}</p>
                                            <div className="flex flex-col text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1 space-y-0.5">
                                                {formData.phone && <span>TEL: {formData.phone}</span>}
                                                {formData.address && <span className="truncate max-w-[160px]">{formData.address}</span>}
                                                <span className="text-blue-400 font-extrabold">{formData.website.replace(/^https?:\/\//, '') || 'WWW.TUEMPRESA.COM'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-white/10 flex items-end justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-[7px] text-gray-500 font-black uppercase tracking-[0.3em]">Cotización No.</p>
                                            <p className="text-base font-light text-white tracking-widest">Q-827BF1</p>
                                        </div>
                                        <div className="bg-white p-1.5 rounded-lg shadow-xl">
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(formData.website || 'https://-')}`} alt="QR" className="w-7 h-7" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                {/* Cliente */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Cliente</p>
                                        <p className="text-xs font-bold text-slate-700">Empresa Ejemplo S.A.</p>
                                        <p className="text-[9px] text-gray-400">contacto@ejemplo.com</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Fecha</p>
                                        <p className="text-[9px] font-bold text-slate-600">30/06/2026</p>
                                    </div>
                                </div>
                                {/* Items */}
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 grid grid-cols-3 px-3 py-1.5">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider col-span-2">Descripción</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider text-right">Total</p>
                                    </div>
                                    {[
                                        { desc: 'Servicio de Seguridad A', total: '$1,200.00' },
                                        { desc: 'Instalación de Equipo B', total: '$850.00' },
                                        { desc: 'Mantenimiento Anual', total: '$480.00' },
                                    ].map((item, i) => (
                                        <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                                            <p className="text-[9px] text-slate-600 font-medium col-span-2">{item.desc}</p>
                                            <p className="text-[9px] font-bold text-slate-700 text-right">{item.total}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Totals */}
                                <div className="flex flex-col items-end gap-1 pt-1">
                                    <div className="flex gap-6 text-[9px] text-gray-400">
                                        <span>Subtotal</span><span className="font-bold text-slate-600">$2,530.00</span>
                                    </div>
                                    <div className="flex gap-6 text-[9px] text-gray-400">
                                        <span>IVA 13%</span><span className="font-bold text-slate-600">$328.90</span>
                                    </div>
                                    <div className="flex gap-4 text-[10px] font-black text-[#0f172a] border-t border-gray-200 pt-1 mt-0.5">
                                        <span>TOTAL</span><span>$2,858.90</span>
                                    </div>
                                </div>
                                {/* Footer */}
                                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                                    <p className="text-[8px] text-gray-400 italic">Válido por 30 días desde emisión.</p>
                                    <div className="h-6 w-20 bg-[#0f172a] rounded-lg flex items-center justify-center">
                                        <span className="text-[8px] text-white font-black">APROBADO</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-600/5 p-4 rounded-xl border border-blue-600/10 flex gap-3 relative overflow-hidden group">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-[#0f172a] uppercase tracking-wider">Despliegue Instantáneo</p>
                                <p className="text-[10px] text-gray-500 leading-relaxed font-medium">Tu nueva marca se propagará en todas las propuestas, PDFs y el panel de control.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cropping Modal */}
            {imageToCrop && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-10">
                    <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setImageToCrop(null)} />

                    <div className="relative bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
                        <div className="grid grid-cols-1 lg:grid-cols-12 h-content lg:h-[700px]">
                            {/* Left: Settings */}
                            <div className="lg:col-span-4 p-10 bg-gray-50 flex flex-col justify-between border-r border-gray-100">
                                <div className="space-y-10">
                                    <div>
                                        <h3 className="text-3xl font-black text-[#0f172a] tracking-tight">Editar Logo</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-3">Ajustes de proporción y zoom</p>
                                    </div>

                                    <div className="space-y-6">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Proporción de Corte</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setAspectRatio(1)}
                                                className={`flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all ${aspectRatio === 1 ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-lg shadow-blue-500/10' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}
                                            >
                                                <Square className="w-8 h-8" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Cuadrado</span>
                                            </button>
                                            <button
                                                onClick={() => setAspectRatio(3 / 1)}
                                                className={`flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all ${aspectRatio === 3 / 1 ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-lg shadow-blue-500/10' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}
                                            >
                                                <Maximize2 className="w-8 h-8" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Horizontal</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nivel de Zoom</label>
                                            <span className="text-xs font-black text-blue-600">{(zoom * 100).toFixed(0)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            value={zoom}
                                            min={1}
                                            max={3}
                                            step={0.1}
                                            onChange={(e) => setZoom(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 ring-4 ring-gray-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 pt-10">
                                    <Button
                                        onClick={handleConfirmCrop}
                                        disabled={uploading}
                                        className="w-full h-16 rounded-2xl bg-[#0f172a] hover:bg-black text-white font-black shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
                                    >
                                        {uploading ? (
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-5 h-5" />
                                                Confirmar Logo
                                            </>
                                        )}
                                    </Button>
                                    <button
                                        onClick={() => setImageToCrop(null)}
                                        className="w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        Descartar cambios
                                    </button>
                                </div>
                            </div>

                            {/* Right: Cropper */}
                            <div className="lg:col-span-8 relative bg-[#0a0a0a] overflow-hidden">
                                <button
                                    onClick={() => setImageToCrop(null)}
                                    className="absolute top-8 right-8 z-[10001] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                <Cropper
                                    image={imageToCrop}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={aspectRatio}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                    cropShape="rect"
                                    showGrid={true}
                                    style={{
                                        containerStyle: { background: '#0a0a0a' },
                                        cropAreaStyle: { border: '2px solid rgba(255,255,255,0.7)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.8)' }
                                    }}
                                />

                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[10001] bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10">
                                    <p className="text-[10px] text-white/70 font-black uppercase tracking-widest text-center">
                                        Arrastra el logotipo para centrarlo correctamente
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
