import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2, Package, Globe, Download, FileText, CheckCircle2, User, PencilLine } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { calculateQuoteFinancials, parseModules, type CotizacionData } from '../utils/quoteUtils';
import { pdfService } from '../services/pdfService';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function PublicQuoteView() {
    const { id } = useParams<{ id: string }>();
    const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    useEffect(() => {
        fetchCotizacion();
    }, [id]);

    async function fetchCotizacion() {
        try {
            const { data, error } = await supabase
                .from('cotizaciones')
                .select(`
                    *,
                    company:companies(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setCotizacion({
                ...data,
                modulos_adicionales: parseModules(data.modulos_adicionales)
            } as CotizacionData);
        } catch (error: any) {
            console.error('Error fetching quote:', error);
            setError(error.message || 'Error desconocido');
            toast.error('No se pudo cargar la propuesta');
        } finally {
            setLoading(false);
        }
    }

    const handleAccept = async () => {
        if (!signerName.trim()) {
            toast.error('Por favor ingresa tu nombre para firmar');
            return;
        }

        setIsAccepting(true);
        try {
            const { error } = await supabase
                .from('cotizaciones')
                .update({
                    estado: 'aceptada',
                    descripcion_pago: `Firmada digitalmente por: ${signerName} el ${new Date().toLocaleString()}`
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('¡Propuesta Aceptada Exitosamente!');
            setShowSignatureModal(false);
            fetchCotizacion();
        } catch (error) {
            toast.error('Error al aceptar la propuesta');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!cotizacion) return;
        setIsGeneratingPDF(true);
        try {
            const pdfUrl = await pdfService.generateAndUploadQuotePDF(cotizacion);
            window.open(pdfUrl, '_blank');
        } catch (error) {
            toast.error('Error al descargar PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (!cotizacion) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-md">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Propuesta no encontrada</h1>
                <p className="text-slate-500 mt-2">El enlace puede haber expirado o es incorrecto.</p>
                {error && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl text-xs text-slate-400 font-mono break-all text-left">
                        Error Detail: {error}
                    </div>
                )}
            </div>
        </div>
    );

    const financials = calculateQuoteFinancials(cotizacion);

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Status Banner */}
                {cotizacion.estado === 'aceptada' && (
                    <div className="bg-green-500 text-white px-8 py-4 rounded-3xl flex items-center justify-between shadow-lg shadow-green-500/20 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6" />
                            <div>
                                <p className="font-black text-lg leading-none uppercase tracking-tight">¡Propuesta Aceptada!</p>
                                <p className="text-sm opacity-90 mt-1">{cotizacion.descripcion_pago}</p>
                            </div>
                        </div>
                        <CheckCircle2 className="w-8 h-8 opacity-20" />
                    </div>
                )}

                {/* Header Card */}
                <div className="bg-[#0f172a] rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                        <div className="space-y-6">
                            {cotizacion.company?.logo_url && (
                                <img src={cotizacion.company.logo_url} alt="Logo" className="h-16 object-contain" />
                            )}
                            <div>
                                <h1 className="text-4xl font-black tracking-tighter uppercase">{cotizacion.company?.name}</h1>
                                <p className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">Propuesta Comercial de Servicios</p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Propuesta</p>
                            <p className="text-2xl font-black tracking-widest">{cotizacion.id.slice(0, 8).toUpperCase()}</p>
                            <div className="h-px bg-white/10 my-3"></div>
                            <p className="text-[10px] font-medium text-slate-400">Fecha: {format(new Date(cotizacion.created_at), 'dd/MM/yyyy')}</p>
                        </div>
                    </div>
                </div>

                {/* Client & Plan Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Preparado para</p>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{cotizacion.nombre_cliente}</h2>
                        {cotizacion.empresa_cliente && (
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{cotizacion.empresa_cliente}</p>
                        )}
                    </div>

                    <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-lg shadow-indigo-600/20 space-y-2 text-center">
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Plan Seleccionado</p>
                        <h3 className="text-3xl font-black tracking-tight leading-none uppercase">{cotizacion.plan_nombre}</h3>
                        <p className="text-indigo-100 text-sm font-medium opacity-80 decoration-indigo-300">
                            {(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs Incluidos
                        </p>
                    </div>
                </div>

                {/* Main Investment Summary */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="p-8 md:p-12 space-y-12">
                        {/* Financial Boxes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Pago Inicial */}
                            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className="text-lg font-black text-orange-900 uppercase">PAGO INICIAL</h4>
                                    <Package className="w-5 h-5 text-orange-500" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Inversión Inicial + IVA</span>
                                        <span className="font-black text-slate-900">${financials.pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="bg-orange-100/50 rounded-xl px-4 py-3 flex justify-between items-center border border-orange-200">
                                        <span className="text-[10px] font-black text-orange-800 uppercase leading-none">Total Hoy</span>
                                        <span className="text-2xl font-black text-orange-600 tracking-tighter">${financials.pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Pago Recurrente */}
                            <div className={`${financials.isMonthly ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-2xl p-8 flex flex-col justify-between`}>
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className={`text-lg font-black ${financials.isMonthly ? 'text-blue-900' : 'text-green-900'} uppercase`}>
                                        {financials.isMonthly ? 'CUOTA MENSUAL' : 'RECURRENTE ANUAL'}
                                    </h4>
                                    <Globe className={`w-5 h-5 ${financials.isMonthly ? 'text-blue-500' : 'text-green-500'}`} />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Licencia + Módulos</span>
                                        <span className="font-black text-slate-900">
                                            ${(financials.isMonthly ? financials.cuotaMensual : financials.totalAnual).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className={`${financials.isMonthly ? 'bg-blue-100/50 border-blue-200' : 'bg-green-100/50 border-green-200'} rounded-xl px-4 py-3 flex justify-between items-center border`}>
                                        <span className={`text-[10px] font-black uppercase leading-none ${financials.isMonthly ? 'text-blue-800' : 'text-green-800'}`}>
                                            Recurrente
                                        </span>
                                        <span className={`text-2xl font-black tracking-tighter ${financials.isMonthly ? 'text-blue-600' : 'text-green-600'}`}>
                                            ${(financials.isMonthly ? financials.cuotaMensual : financials.totalAnual).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Terms and Conditions Preview */}
                        <div className="space-y-6 pt-12 border-t border-slate-100">
                            <div className="flex items-center gap-3">
                                <FileText className="w-6 h-6 text-slate-400" />
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Términos del Servicio</h3>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                                <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                    {(cotizacion.company?.terminos_condiciones || '').split('\n\n').filter((p: string) => p.trim()).map((para: string, idx: number) => (
                                        <p key={idx} className="flex gap-4">
                                            <span className="font-black text-blue-600 shrink-0">{idx + 1}.</span>
                                            <span>{para}</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="bg-slate-50 p-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <Button
                            variant="default"
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="w-full md:w-auto px-10 h-14 bg-white border border-slate-200 rounded-2xl text-slate-800 hover:bg-white hover:border-slate-400 font-black uppercase tracking-widest text-[11px] shadow-sm flex items-center justify-center gap-3"
                        >
                            <Download className="w-5 h-5" />
                            {isGeneratingPDF ? 'Generando...' : 'Descargar Propuesta PDF'}
                        </Button>

                        {cotizacion.estado !== 'aceptada' ? (
                            <Button
                                variant="default"
                                onClick={() => setShowSignatureModal(true)}
                                className="w-full md:w-auto px-12 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Aceptar Propuesta Oficial
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2 text-green-600 font-black uppercase tracking-widest text-xs bg-white px-8 py-4 rounded-2xl border-2 border-green-500/20">
                                <CheckCircle2 className="w-5 h-5" />
                                Propuesta Aceptada
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Signature Modal */}
            {showSignatureModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <PencilLine className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Firma Digital de Aceptación</h2>
                            <p className="text-sm text-slate-500">Para formalizar la propuesta, ingresa tu nombre completo como firma digital.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={signerName}
                                        onChange={(e) => setSignerName(e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full pl-12 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="default"
                                    onClick={handleAccept}
                                    disabled={isAccepting || !signerName.trim()}
                                    className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs"
                                >
                                    {isAccepting ? 'Confirmando...' : 'Confirmar y Firmar Propuesta'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowSignatureModal(false)}
                                    className="h-12 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
