import { useState, useEffect } from 'react';
import { brandingService } from '../../services/branding';
import { storageService } from '../../services/storage';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, Save, Upload, Globe, Image as ImageIcon, CheckCircle2, X, Maximize2, Square } from 'lucide-react';
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
    const [formData, setFormData] = useState({
        name: '',
        website: '',
        address: '',
        phone: '',
        logo_url: ''
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
                logo_url: data.logo_url || ''
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
                logo_url: formData.logo_url
            });
            toast.success('Cambios de marca guardados con éxito');
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
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-[#0f172a] tracking-tight">Marca Corporativa</h1>
                    <p className="text-gray-500 font-medium">Gestiona tu identidad visual para cotizaciones y comunicaciones oficiales.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Form Section */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-200/40 space-y-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/30 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

                        <div className="space-y-8 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Nombre Comercial</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        <Input
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="pl-12 h-14 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-lg shadow-sm"
                                            placeholder="Tu Empresa S.A."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Sitio Web Oficial</label>
                                    <div className="relative group">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        <Input
                                            value={formData.website}
                                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            className="pl-12 h-14 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-lg shadow-sm"
                                            placeholder="https://www.tusitio.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Teléfono Contacto</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 font-bold">📞</div>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="pl-12 h-14 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-lg shadow-sm"
                                            placeholder="+503 2200-0000"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Dirección Física</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 font-bold">📍</div>
                                        <Input
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            className="pl-12 h-14 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-lg shadow-sm"
                                            placeholder="Ciudad, País"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-xs font-black text-blue-600 uppercase tracking-widest px-1">Logotipo Corporativo</label>
                                <div className="flex flex-col md:flex-row items-center gap-10 p-10 border-2 border-dashed border-gray-200 rounded-[2.5rem] bg-gray-50/50 group hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-300">
                                    <div className="w-48 h-48 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-500 relative">
                                        {formData.logo_url ? (
                                            <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-4" />
                                        ) : (
                                            <ImageIcon className="w-16 h-16 text-gray-300" />
                                        )}
                                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    </div>
                                    <div className="flex-1 space-y-6 text-center md:text-left">
                                        <div>
                                            <p className="text-2xl font-black text-[#0f172a] tracking-tight">Actualiza tu Identidad</p>
                                            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                                                Recomendamos un archivo PNG con fondo transparente. <br />
                                                El sistema permite recortar para un ajuste perfecto.
                                            </p>
                                        </div>
                                        <div className="relative inline-block">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                disabled={uploading}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                            />
                                            <Button type="button" variant="outline" disabled={uploading} className="rounded-2xl border-gray-300 hover:border-blue-500 hover:text-blue-600 bg-white shadow-sm font-black text-xs h-14 px-8 relative z-10 transition-all group-active:scale-95">
                                                <Upload className="w-5 h-5 mr-3" />
                                                {uploading ? 'Cargando...' : 'Seleccionar Nuevo Logo'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-gray-100 relative z-10">
                            <Button type="submit" disabled={saving} className="w-full h-18 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white font-black shadow-2xl shadow-blue-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-4 text-xl py-6">
                                {saving ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Guardando Cambios...</span>
                                    </div>
                                ) : (
                                    <>
                                        <Save className="w-6 h-6" />
                                        Guardar Perfil de Marca
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Preview Section */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-8">
                    <div className="sticky top-10 space-y-8">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Vista Previa Real</h3>
                            <div className="flex gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Live Preview</span>
                            </div>
                        </div>

                        {/* Actual Quotation Header Preview */}
                        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 transition-all hover:shadow-blue-500/10">
                            {/* Header Black Bar */}
                            <div className="bg-[#0f172a] p-8 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>

                                <div className="space-y-6 relative z-10">
                                    <div className="flex flex-col items-start gap-5">
                                        <div className="w-64 h-20 flex items-center justify-start overflow-hidden group/logo">
                                            {formData.logo_url ? (
                                                <img src={formData.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 text-white/40">
                                                    <Building2 className="w-6 h-6" />
                                                    <span className="text-sm font-black uppercase tracking-tighter">BRAND LOGO</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xl font-black leading-none text-white uppercase tracking-tight">
                                                {formData.name || 'TU EMPRESA'}
                                            </p>
                                            <div className="flex flex-col text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-2 space-y-1">
                                                {formData.phone && <span className="flex items-center gap-2">TEL: {formData.phone}</span>}
                                                {formData.address && <span className="truncate max-w-[200px]">{formData.address}</span>}
                                                <span className="text-blue-400 font-extrabold">{formData.website.replace(/^https?:\/\//, '') || 'WWW.TUEMPRESA.COM'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/10 flex items-end justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.3em]">Cotización No.</p>
                                            <p className="text-2xl font-light text-white tracking-widest">Q-827BF1</p>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(formData.website || 'https://ariassdefense.com')}`}
                                                alt="QR"
                                                className="w-10 h-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sample Content */}
                            <div className="p-8 space-y-4">
                                <div className="h-4 w-3/4 bg-gray-100 rounded-full"></div>
                                <div className="h-4 w-1/2 bg-gray-100 rounded-full"></div>
                                <div className="pt-4 grid grid-cols-2 gap-4">
                                    <div className="h-20 bg-gray-50 rounded-2xl border border-gray-100"></div>
                                    <div className="h-20 bg-gray-50 rounded-2xl border border-gray-100"></div>
                                </div>
                                <div className="mt-4 pt-6 border-t border-gray-50 flex justify-between items-center">
                                    <div className="h-12 w-12 rounded-xl bg-blue-100/50"></div>
                                    <div className="h-10 w-32 bg-[#0f172a] rounded-xl flex items-center justify-center">
                                        <div className="h-2 w-16 bg-white/20 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-600/10 flex gap-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-blue-600/10 transition-colors"></div>
                            <CheckCircle2 className="w-8 h-8 text-blue-600 shrink-0" />
                            <div className="space-y-2 relative z-10">
                                <p className="text-sm font-black text-[#0f172a] uppercase tracking-wider">Despliegue Instantáneo</p>
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                                    Tu nueva marca se propagará automáticamente en todas las propuestas, PDFs comerciales y el panel de control.
                                </p>
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
