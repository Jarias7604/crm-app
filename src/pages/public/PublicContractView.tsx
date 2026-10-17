import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { contractsService } from '../../services/contracts';
import { contractPdfService } from '../../services/contractPdfService';
import { SignaturePad } from '../../components/common/SignaturePad';
import type { Contract } from '../../types/contracts';
import { FileText, ShieldCheck, CheckCircle2, Download, Building2, User, Clock, AlertTriangle, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function PublicContractView() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for signing
  const [signerName, setSignerName] = useState('');
  const [signerId, setSignerId] = useState('');
  const [signerCargo, setSignerCargo] = useState('Representante Legal');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadContract();
  }, [id]);

  const loadContract = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contractsService.getPublicContract(id!);
      if (!data || !data.contract) {
        setError('El contrato solicitado no existe o el enlace es incorrecto.');
        return;
      }
      setContract(data.contract);
      setCompany(data.company);

      // Pre-fill signer name if not yet signed
      if (data.contract.datos_cliente?.nombre && !data.contract.firmado_digitalmente) {
        setSignerName(data.contract.datos_cliente.nombre);
      }
      if (data.contract.datos_cliente?.tax_id && !data.contract.firmado_digitalmente) {
        setSignerId(data.contract.datos_cliente.tax_id);
      }
    } catch (err: any) {
      console.error('Error loading contract:', err);
      setError('No se pudo cargar el contrato. Por favor intente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !id) return;

    if (!signerName.trim()) {
      toast.error('Por favor ingresa tu nombre completo');
      return;
    }
    if (!signerId.trim()) {
      toast.error('Por favor ingresa tu número de documento de identidad / NIT / RUT');
      return;
    }
    if (!signatureData) {
      toast.error('Por favor dibuja tu firma en el lienzo digital');
      return;
    }
    if (!agreedToTerms) {
      toast.error('Debes marcar la casilla de aceptación de términos');
      return;
    }

    setIsSigning(true);
    try {
      // Capturar IP tentativa vía servicio público o fallback
      let clientIp = '127.0.0.1';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        const ipJson = await ipRes.json();
        clientIp = ipJson.ip || clientIp;
      } catch {
        // Fallback silencioso
      }

      const res = await contractsService.signPublic(id, {
        signer_name: signerName.trim(),
        signer_identification: signerId.trim(),
        signer_cargo: signerCargo.trim(),
        signature_image: signatureData,
        signer_ip: clientIp,
        signer_user_agent: navigator.userAgent,
      });

      if (!res.success) {
        throw new Error(res.message || 'Error al firmar');
      }

      toast.success('🎉 ¡Contrato firmado exitosamente!');
      if (res.contract) {
        setContract(res.contract);
      } else {
        await loadContract();
      }
    } catch (err: any) {
      console.error('Error signing contract:', err);
      toast.error('Error al procesar la firma: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contract) return;
    setIsDownloading(true);
    try {
      await contractPdfService.downloadContractPDF(contract);
      toast.success('Descargando contrato en PDF');
    } catch {
      toast.error('Error al generar PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
          <FileText className="w-8 h-8" />
        </div>
        <p className="text-sm font-bold text-white tracking-wide">Cargando contrato seguro...</p>
        <p className="text-xs text-slate-400 mt-1">Verificando credenciales y firma electrónica</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Documento no disponible</h2>
          <p className="text-sm text-slate-500 leading-relaxed">{error || 'El contrato solicitado no fue encontrado.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const isFirmado = contract.status === 'firmado' || contract.firmado_digitalmente;
  const clienteNombre = contract.datos_cliente.nombre;
  const clienteEmpresa = contract.datos_cliente.empresa || clienteNombre;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-6 px-3 sm:px-6">
      
      {/* Container Document */}
      <div className="w-full max-w-4xl space-y-6">

        {/* Top Header Card */}
        <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-14 h-14 rounded-2xl object-contain bg-white/10 p-2 border border-white/20 shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                  <Building2 className="w-7 h-7" />
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                  {contract.datos_empresa.nombre}
                </p>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                  {contract.title}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Cliente: <strong className="text-white">{clienteEmpresa}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white/10 text-indigo-200 border border-white/15">
                {contract.contract_number}
              </span>
              <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm ${
                isFirmado 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {isFirmado ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Firmado Digitalmente</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pendiente de Firma</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Banner if already signed */}
        {isFirmado && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-emerald-950">Contrato Legalmente Vinculante y Firmado</h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Firmado por <strong>{contract.firmante_nombre || clienteNombre}</strong> ({contract.firmante_identificacion || 'ID Verificado'}) el{' '}
                  {contract.firmado_en ? format(new Date(contract.firmado_en), "d 'de' MMMM 'de' yyyy, h:mm a", { locale: es }) : 'fecha registrada'}.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Generando...' : 'Descargar Copia en PDF'}</span>
            </button>
          </div>
        )}

        {/* Paper Contract Document */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-12 space-y-8 text-slate-800">
          
          {/* Header of paper */}
          <div className="text-center border-b border-slate-200 pb-8 space-y-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
              CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Instrumento Jurídico Nº {contract.contract_number} • Fecha de Emisión: {contract.fecha_inicio}
            </p>
          </div>

          {/* Comparecientes */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs leading-relaxed text-slate-700">
            <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" /> Comparecientes y Partes Intervinientes
            </h3>
            <p>
              <strong>DE UNA PARTE:</strong> <strong>{contract.datos_empresa.nombre}</strong>, identificada con documento fiscal Nº {contract.datos_empresa.tax_id || 'N/A'}, representada en este acto por {contract.datos_empresa.representante || 'su representante legal autorizada'}, con domicilio en {contract.datos_empresa.direccion || 'domicilio registrado'}, en adelante denominada <strong>"EL PRESTADOR"</strong>.
            </p>
            <p>
              <strong>Y DE OTRA PARTE:</strong> <strong>{clienteEmpresa}</strong>, representada por <strong>{clienteNombre}</strong>, identificada con documento Nº {contract.datos_cliente.tax_id || 'N/A'}, con domicilio en {contract.datos_cliente.direccion || 'dirección registrada'}, en adelante denominada <strong>"EL CLIENTE"</strong>.
            </p>
            <p className="italic text-slate-500 text-[11px]">
              Ambas partes se reconocen plena capacidad legal y legitimación suficiente para suscribir el presente contrato al tenor de las siguientes:
            </p>
          </div>

          {/* Cláusulas */}
          <div className="space-y-6">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs border-b border-slate-100 pb-2">
              Cláusulas y Condiciones Generales
            </h3>

            {contract.clausulas?.map((clausula, idx) => (
              <div key={clausula.id || idx} className="space-y-1.5">
                <h4 className="text-xs font-black text-slate-900 tracking-wide flex items-center gap-2">
                  <span className="text-indigo-600">{clausula.numero}:</span>
                  <span>{clausula.titulo}</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed text-justify">
                  {clausula.contenido}
                </p>
              </div>
            ))}
          </div>

          {/* Economic Summary Highlight Card */}
          <div className="p-6 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100/80 space-y-4">
            <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
              Resumen de Condiciones Económicas y Vigencia
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Total</p>
                <p className="text-base font-black text-slate-900 mt-0.5">${contract.monto_total?.toLocaleString()} USD</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anticipo</p>
                <p className="text-base font-bold text-slate-800 mt-0.5">${contract.anticipo?.toLocaleString()} USD</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vigencia</p>
                <p className="text-base font-bold text-slate-800 mt-0.5">{contract.vigencia_meses} Meses</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jurisdicción</p>
                <p className="text-xs font-bold text-slate-700 mt-1 truncate">{contract.jurisdiccion || 'Domicilio Legal'}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 border-t border-indigo-100/60 pt-3">
              <strong>Forma de Pago Acordada:</strong> {contract.forma_pago || 'Según estipulaciones'}
            </p>
          </div>

          {/* Signatures Section */}
          <div className="pt-8 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
              
              {/* Prestador */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Por EL PRESTADOR</p>
                  <div className="h-16 flex items-center justify-center border-b border-slate-300 mb-3">
                    <span className="text-xs font-bold font-mono text-indigo-700">
                      {contract.datos_empresa.representante}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-slate-900">{contract.datos_empresa.representante}</p>
                  <p className="text-[11px] text-slate-500">{contract.datos_empresa.nombre}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Representante Legal</p>
                </div>
              </div>

              {/* Cliente */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Por EL CLIENTE</p>
                  <div className="h-16 flex items-center justify-center border-b border-slate-300 mb-3">
                    {isFirmado && contract.firma_imagen ? (
                      <img src={contract.firma_imagen} alt="Firma del Cliente" className="max-h-14 object-contain" />
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold italic">Pendiente de firma en formulario inferior</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-slate-900">{contract.firmante_nombre || clienteNombre}</p>
                  <p className="text-[11px] text-slate-500">{clienteEmpresa}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{contract.firmante_cargo || 'Representante Autorizado'}</p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Signing Interaction Section (If not yet signed) */}
        {!isFirmado ? (
          <div className="bg-white rounded-3xl shadow-2xl border border-indigo-200 p-6 sm:p-10 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Suscripción y Firma Digital del Contrato</h3>
                <p className="text-xs text-slate-500">Complete sus datos y dibuje su firma para formalizar el acuerdo</p>
              </div>
            </div>

            <form onSubmit={handleSign} className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Completo del Firmante <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Ej: Carlos Eduardo Mendoza"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Documento de Identidad / NIT / DNI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signerId}
                    onChange={(e) => setSignerId(e.target.value)}
                    placeholder="Ej: 0614-150985-001-9"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo o Representación
                  </label>
                  <input
                    type="text"
                    value={signerCargo}
                    onChange={(e) => setSignerCargo(e.target.value)}
                    placeholder="Ej: Gerente General / Propietario"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Touch Signature Pad */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Dibuje su Firma en el Lienzo <span className="text-red-500">*</span>
                  <span className="text-[11px] font-normal text-slate-400 ml-2">
                    (Use su dedo en la pantalla del móvil o el ratón en la computadora)
                  </span>
                </label>
                <SignaturePad
                  onSignatureChange={(data) => setSignatureData(data)}
                  height={190}
                />
              </div>

              {/* Consent Checkbox */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Certifico que he leído íntegramente las cláusulas, términos y condiciones del Contrato Nº <strong>{contract.contract_number}</strong>, aceptando que esta firma digital junto con mi registro de dirección IP y marca temporal posee plena validez jurídica y carácter vinculante.
                  </span>
                </label>
              </div>

              {/* Submit button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Conexión cifrada y trazabilidad segura</span>
                </div>

                <button
                  type="submit"
                  disabled={isSigning}
                  className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sellando y firmando digitalmente...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Firmar y Aceptar Contrato Definitivo</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        ) : (
          /* Footer if already signed */
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-slate-400">
              Este documento cuenta con certificación electrónica y resguardo en {contract.datos_empresa.nombre}.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
