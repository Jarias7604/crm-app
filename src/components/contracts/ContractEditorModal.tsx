import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Send, Eye, FileText, CheckCircle2, DollarSign, Calendar, Building2, User, Shield, Download, RefreshCw } from 'lucide-react';
import type { Contract, ContractClause, CreateContractInput } from '../../types/contracts';
import { contractsService } from '../../services/contracts';
import { generateContractDefaults } from '../../utils/contractDefaults';
import { contractPdfService } from '../../services/contractPdfService';
import { ContractShareModal } from './ContractShareModal';
import toast from 'react-hot-toast';

interface ContractEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingContract?: Contract | null;
  cotizacion?: any | null;
  lead?: any | null;
  company: any;
  creatorName?: string;
  onSaved?: (contract: Contract) => void;
}

export const ContractEditorModal: React.FC<ContractEditorModalProps> = ({
  isOpen,
  onClose,
  existingContract,
  cotizacion,
  lead,
  company,
  creatorName,
  onSaved,
}) => {
  const [formData, setFormData] = useState<CreateContractInput>({
    company_id: '',
    contract_number: '',
    title: '',
    objeto: '',
    clausulas: [],
    monto_total: 0,
    forma_pago: '',
    anticipo: 0,
    cuotas: 1,
    valor_cuota: 0,
    vigencia_meses: 12,
    fecha_inicio: '',
    fecha_fin: '',
    jurisdiccion: '',
    datos_empresa: { nombre: '' },
    datos_cliente: { nombre: '' },
  });

  const [contractId, setContractId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [saving, setSaving] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [currentContractForShare, setCurrentContractForShare] = useState<Contract | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (existingContract) {
      setContractId(existingContract.id);
      setFormData({
        company_id: existingContract.company_id,
        lead_id: existingContract.lead_id,
        client_id: existingContract.client_id,
        cotizacion_id: existingContract.cotizacion_id,
        contract_number: existingContract.contract_number,
        title: existingContract.title,
        status: existingContract.status,
        objeto: existingContract.objeto,
        clausulas: existingContract.clausulas || [],
        monto_total: existingContract.monto_total,
        forma_pago: existingContract.forma_pago,
        anticipo: existingContract.anticipo,
        cuotas: existingContract.cuotas,
        valor_cuota: existingContract.valor_cuota,
        vigencia_meses: existingContract.vigencia_meses,
        fecha_inicio: existingContract.fecha_inicio,
        fecha_fin: existingContract.fecha_fin,
        jurisdiccion: existingContract.jurisdiccion,
        datos_empresa: existingContract.datos_empresa,
        datos_cliente: existingContract.datos_cliente,
      });
      setCurrentContractForShare(existingContract);
    } else {
      // Auto-generate defaults from seed data
      const defaults = generateContractDefaults({
        company: company || { id: '', name: 'Mi Empresa' },
        lead,
        cotizacion,
        creatorName,
      });

      setContractId(null);
      setFormData({
        ...defaults,
        company_id: company?.id || cotizacion?.company_id || '',
        lead_id: lead?.id || cotizacion?.lead_id || null,
        client_id: null,
        cotizacion_id: cotizacion?.id || null,
        status: 'borrador',
      });
      setCurrentContractForShare(null);
    }
  }, [isOpen, existingContract, cotizacion, lead, company]);

  if (!isOpen) return null;

  const handleClauseChange = (idx: number, field: 'titulo' | 'contenido', val: string) => {
    setFormData(prev => {
      const nextClausulas = [...prev.clausulas];
      nextClausulas[idx] = { ...nextClausulas[idx], [field]: val };
      return { ...prev, clausulas: nextClausulas };
    });
  };

  const handleAddClause = () => {
    setFormData(prev => {
      const numMap = ['DÉCIMA PRIMERA', 'DÉCIMA SEGUNDA', 'DÉCIMA TERCERA', 'DÉCIMA CUARTA', 'DÉCIMA QUINTA'];
      const extraIndex = Math.max(0, prev.clausulas.length - 10);
      const numero = numMap[extraIndex] || `CLÁUSULA ${prev.clausulas.length + 1}`;

      const newClause: ContractClause = {
        id: `extra-${Date.now()}`,
        numero,
        titulo: 'ACUERDO ESPECIAL O CONDICIÓN PARTICULAR',
        contenido: 'Escriba aquí los términos y condiciones particulares acordados entre las partes...',
        es_personalizada: true,
      };

      return {
        ...prev,
        clausulas: [...prev.clausulas, newClause],
      };
    });
  };

  const handleRemoveClause = (idx: number) => {
    if (!window.confirm('¿Deseas eliminar esta cláusula del contrato?')) return;
    setFormData(prev => ({
      ...prev,
      clausulas: prev.clausulas.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (targetStatus: 'borrador' | 'enviado' = 'borrador') => {
    if (!formData.title?.trim() || !formData.contract_number?.trim()) {
      toast.error('Por favor complete el título y número de contrato');
      return;
    }

    setSaving(true);
    try {
      let saved: Contract;
      if (contractId) {
        saved = await contractsService.update(contractId, {
          ...formData,
          status: targetStatus,
        });
        toast.success(targetStatus === 'enviado' ? '¡Contrato emitido y listo para enviar!' : 'Borrador guardado');
      } else {
        saved = await contractsService.create({
          ...formData,
          status: targetStatus,
        });
        setContractId(saved.id);
        toast.success(targetStatus === 'enviado' ? '¡Contrato creado y emitido!' : 'Borrador creado');
      }

      setCurrentContractForShare(saved);
      if (onSaved) onSaved(saved);

      if (targetStatus === 'enviado') {
        setIsShareOpen(true);
      }
    } catch (error: any) {
      console.error('Error saving contract:', error);
      toast.error('Error al guardar contrato: ' + (error?.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    const tempContract: Contract = {
      ...(formData as any),
      id: contractId || 'temp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      firmado_digitalmente: existingContract?.firmado_digitalmente || false,
      firmado_en: existingContract?.firmado_en || null,
      firmante_nombre: existingContract?.firmante_nombre || null,
      firmante_identificacion: existingContract?.firmante_identificacion || null,
      firmante_cargo: existingContract?.firmante_cargo || null,
      firma_imagen: existingContract?.firma_imagen || null,
      firmante_ip: existingContract?.firmante_ip || null,
      firmante_user_agent: existingContract?.firmante_user_agent || null,
      pdf_url: null,
    };

    try {
      await contractPdfService.downloadContractPDF(tempContract);
      toast.success('PDF descargado');
    } catch {
      toast.error('Error al generar PDF');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-md animate-fade-in overflow-hidden">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Editor de Contrato de Servicios</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-indigo-200 border border-white/10">
                  {formData.contract_number}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cliente: <strong className="text-slate-200">{formData.datos_cliente.empresa || formData.datos_cliente.nombre}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'editor' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Editar Cláusulas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Vista Previa
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {activeTab === 'editor' ? (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* Card 1: Identificación y Objeto */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Shield className="w-4 h-4 text-indigo-600" /> Información General y Partes
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Título del Contrato</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Nº de Contrato (Código)</label>
                    <input
                      type="text"
                      value={formData.contract_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, contract_number: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Datos del Prestador (Tu Empresa)
                    </div>
                    <input
                      type="text"
                      placeholder="Razón Social"
                      value={formData.datos_empresa.nombre}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        datos_empresa: { ...prev.datos_empresa, nombre: e.target.value }
                      }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="NIT / Tax ID"
                        value={formData.datos_empresa.tax_id || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datos_empresa: { ...prev.datos_empresa, tax_id: e.target.value }
                        }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Representante"
                        value={formData.datos_empresa.representante || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datos_empresa: { ...prev.datos_empresa, representante: e.target.value }
                        }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <User className="w-3.5 h-3.5 text-indigo-600" /> Datos del Cliente (Lead)
                    </div>
                    <input
                      type="text"
                      placeholder="Empresa o Razón Social Cliente"
                      value={formData.datos_cliente.empresa || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        datos_cliente: { ...prev.datos_cliente, empresa: e.target.value }
                      }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Contacto / Representante"
                        value={formData.datos_cliente.nombre || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datos_cliente: { ...prev.datos_cliente, nombre: e.target.value }
                        }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="NIT / Cédula / DNI"
                        value={formData.datos_cliente.tax_id || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datos_cliente: { ...prev.datos_cliente, tax_id: e.target.value }
                        }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Objeto Resumido del Contrato</label>
                  <textarea
                    rows={2}
                    value={formData.objeto}
                    onChange={(e) => setFormData(prev => ({ ...prev, objeto: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Card 2: Condiciones Económicas y Fechas */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Condiciones Económicas y Vigencia
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Valor Total ($ USD)</label>
                    <input
                      type="number"
                      value={formData.monto_total}
                      onChange={(e) => setFormData(prev => ({ ...prev, monto_total: Number(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Anticipo ($ USD)</label>
                    <input
                      type="number"
                      value={formData.anticipo}
                      onChange={(e) => setFormData(prev => ({ ...prev, anticipo: Number(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Nº de Cuotas</label>
                    <input
                      type="number"
                      value={formData.cuotas}
                      onChange={(e) => setFormData(prev => ({ ...prev, cuotas: Number(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Vigencia (Meses)</label>
                    <input
                      type="number"
                      value={formData.vigencia_meses}
                      onChange={(e) => setFormData(prev => ({ ...prev, vigencia_meses: Number(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Detalle de la Forma de Pago</label>
                    <input
                      type="text"
                      value={formData.forma_pago}
                      onChange={(e) => setFormData(prev => ({ ...prev, forma_pago: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Jurisdicción / Ciudad y País</label>
                    <input
                      type="text"
                      value={formData.jurisdiccion}
                      onChange={(e) => setFormData(prev => ({ ...prev, jurisdiccion: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Cláusulas Editables */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" /> Cláusulas del Contrato ({formData.clausulas.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddClause}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Cláusula Extra
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.clausulas.map((clausula, idx) => (
                    <div
                      key={clausula.id || idx}
                      className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 mr-3">
                          <span className="text-[11px] font-black text-indigo-600 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                            {clausula.numero}
                          </span>
                          <input
                            type="text"
                            value={clausula.titulo}
                            onChange={(e) => handleClauseChange(idx, 'titulo', e.target.value)}
                            className="text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 flex-1"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveClause(idx)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar cláusula"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={clausula.contenido}
                        onChange={(e) => handleClauseChange(idx, 'contenido', e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* Vista Previa del Documento Completo */
            <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-slate-200 text-slate-800 space-y-6">
              <div className="border-b border-slate-200 pb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{formData.datos_empresa.nombre}</h1>
                  <p className="text-xs text-slate-500 mt-1">Identificación: {formData.datos_empresa.tax_id || 'N/A'}</p>
                  <p className="text-xs text-slate-500">Representante: {formData.datos_empresa.representante}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                    {formData.contract_number}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">{formData.fecha_inicio}</p>
                </div>
              </div>

              <div className="text-center py-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">{(formData.title || '').toUpperCase()}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Instrumento Legal de Prestación de Servicios</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-700 leading-relaxed space-y-2 border border-slate-100">
                <p className="font-bold text-slate-900">COMPARECIENTES:</p>
                <p>
                  De una parte, <strong>{formData.datos_empresa.nombre}</strong> (EL PRESTADOR), y de otra parte <strong>{formData.datos_cliente.empresa || formData.datos_cliente.nombre}</strong> (EL CLIENTE), representada por {formData.datos_cliente.nombre}, convienen suscribir el presente contrato al tenor de las siguientes estipulaciones:
                </p>
              </div>

              <div className="space-y-4">
                {formData.clausulas.map((c, i) => (
                  <div key={i} className="space-y-1">
                    <h4 className="text-xs font-black text-slate-900 tracking-wide">
                      {c.numero}: {c.titulo}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed text-justify">
                      {c.contenido}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs space-y-1">
                <p className="font-bold text-indigo-950">RESUMEN ECONÓMICO:</p>
                <p className="text-indigo-900">• Monto Total: ${formData.monto_total?.toLocaleString()} USD</p>
                <p className="text-indigo-900">• Condiciones de Pago: {formData.forma_pago}</p>
                <p className="text-indigo-900">• Vigencia: {formData.vigencia_meses} meses</p>
              </div>

              <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="h-14 border-b border-slate-300 mb-2"></div>
                  <p className="font-bold text-slate-900">{formData.datos_empresa.representante}</p>
                  <p className="text-[11px] text-slate-500">{formData.datos_empresa.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">EL PRESTADOR</p>
                </div>
                <div>
                  <div className="h-14 border-b border-slate-300 mb-2 flex items-center justify-center">
                    {existingContract?.firmado_digitalmente && existingContract.firma_imagen ? (
                      <img src={existingContract.firma_imagen} alt="Firma" className="max-h-12 object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Pendiente de firma digital</span>
                    )}
                  </div>
                  <p className="font-bold text-slate-900">{formData.datos_cliente.nombre}</p>
                  <p className="text-[11px] text-slate-500">{formData.datos_cliente.empresa || formData.datos_cliente.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">EL CLIENTE</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" /> Descargar Borrador PDF
            </button>
            {contractId && (
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Enlaces de Firma (WhatsApp / Email)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave('borrador')}
              disabled={saving}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-600" /> Guardar Borrador
            </button>

            <button
              type="button"
              onClick={() => handleSave('enviado')}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Emitir y Compartir con Cliente
            </button>
          </div>
        </div>

      </div>

      {/* Share Modal */}
      {currentContractForShare && (
        <ContractShareModal
          contract={currentContractForShare}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
};
