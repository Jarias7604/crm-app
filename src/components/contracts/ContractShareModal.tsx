import React, { useState } from 'react';
import { X, Copy, Check, MessageSquare, Mail, ExternalLink, ShieldCheck, Download } from 'lucide-react';
import type { Contract } from '../../types/contracts';
import { contractPdfService } from '../../services/contractPdfService';
import toast from 'react-hot-toast';

interface ContractShareModalProps {
  contract: Contract;
  isOpen: boolean;
  onClose: () => void;
}

export const ContractShareModal: React.FC<ContractShareModalProps> = ({
  contract,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const contractUrl = `${window.location.origin}/contrato/${contract.id}`;
  const clienteNombre = contract.datos_cliente.nombre || 'Estimado cliente';
  const clienteEmpresa = contract.datos_cliente.empresa || clienteNombre;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contractUrl);
      setCopied(true);
      toast.success('¡Enlace del contrato copiado!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const handleWhatsApp = () => {
    const text = `Hola ${clienteNombre}! 👋\n\nTe saluda el equipo de *${contract.datos_empresa.nombre}*.\n\nTe compartimos el *Contrato de Prestación de Servicios* Nº *${contract.contract_number}* correspondiente a *${clienteEmpresa}*.\n\nPuedes revisarlo y firmarlo digitalmente desde tu móvil aquí:\n${contractUrl}\n\nQuedamos a tu entera disposición.`;
    const cleanPhone = contract.datos_cliente.telefono ? contract.datos_cliente.telefono.replace(/\D/g, '') : '';
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleEmail = () => {
    const subject = `Contrato de Prestación de Servicios Nº ${contract.contract_number} — ${contract.datos_empresa.nombre}`;
    const body = `Estimado(a) ${clienteNombre},\n\nLe saludamos cordialmente de ${contract.datos_empresa.nombre}.\n\nAdjuntamos el enlace para la revisión y suscripción electrónica del Contrato de Servicios Nº ${contract.contract_number} para ${clienteEmpresa}.\n\nPuede acceder y firmar digitalmente desde su teléfono móvil o computadora en el siguiente enlace seguro:\n${contractUrl}\n\nAtentamente,\n${contract.datos_empresa.representante || contract.datos_empresa.nombre}`;
    const mailtoUrl = `mailto:${contract.datos_cliente.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await contractPdfService.downloadContractPDF(contract);
      toast.success('PDF descargado');
    } catch {
      toast.error('Error al generar PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Enviar Contrato para Firma</h3>
            <p className="text-xs text-slate-500">{contract.contract_number} • {clienteEmpresa}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-500 font-medium">Estado actual: </span>
            <span className={`font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded-md ${
              contract.status === 'firmado'
                ? 'bg-emerald-100 text-emerald-700'
                : contract.status === 'enviado'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {contract.status === 'firmado' ? '✅ Firmado' : contract.status === 'enviado' ? '📤 Enviado' : '📝 Borrador'}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-700">
            ${contract.monto_total?.toLocaleString()} USD
          </div>
        </div>

        {/* Link box */}
        <div className="space-y-2 mb-6">
          <label className="text-xs font-bold text-slate-700">Enlace seguro de firma digital:</label>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <input
              type="text"
              readOnly
              value={contractUrl}
              className="bg-transparent border-none text-xs text-slate-600 flex-1 outline-none font-mono"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Quick Send Options */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2.5 p-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 fill-white" />
            <span>Enviar por WhatsApp</span>
          </button>
          <button
            onClick={handleEmail}
            className="flex items-center justify-center gap-2.5 p-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-2xl shadow-lg shadow-slate-900/10 transition-all active:scale-95 cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Enviar por Correo</span>
          </button>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => window.open(contractUrl, '_blank')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir vista del cliente
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> {downloading ? 'Descargando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};
