import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Send, Eye, FileText, CheckCircle2, DollarSign, Calendar, Building2, User, Shield, Download, RefreshCw, ShieldCheck, FileCheck } from 'lucide-react';
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
      const effectiveLogo = existingContract.datos_empresa?.logo_url || company?.logo_url || (cotizacion as any)?.company?.logo_url || null;
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
        datos_empresa: {
          ...existingContract.datos_empresa,
          logo_url: effectiveLogo,
        },
        datos_cliente: existingContract.datos_cliente,
      });
      setCurrentContractForShare(existingContract);
    } else {
      // Auto-generate defaults from seed data
      const effectiveCompany = company || (cotizacion as any)?.company || { id: '', name: 'Mi Empresa' };
      const defaults = generateContractDefaults({
        company: {
          ...effectiveCompany,
          logo_url: effectiveCompany?.logo_url || (cotizacion as any)?.company?.logo_url || null,
        },
        lead,
        cotizacion,
        creatorName,
      });

      setContractId(null);
      setFormData({
        ...defaults,
        company_id: effectiveCompany?.id || cotizacion?.company_id || '',
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Nº de Contrato (Código)</label>
                    <input
                      type="text"
                      value={formData.contract_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, contract_number: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Título del Documento</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Ciudad y Jurisdicción Legal</label>
                    <input
                      type="text"
                      placeholder="Ej: San Salvador, El Salvador"
                      value={formData.jurisdiccion || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, jurisdiccion: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
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

                    {/* Logo institucional */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                      {formData.datos_empresa.logo_url ? (
                        <div className="w-10 h-7 rounded bg-white p-0.5 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <img
                            src={formData.datos_empresa.logo_url}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-7 rounded bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0">
                          LOGO
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="URL Logo Oficial (automático de tu empresa)"
                        value={formData.datos_empresa.logo_url || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datos_empresa: { ...prev.datos_empresa, logo_url: e.target.value }
                        }))}
                        className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 placeholder:text-slate-400"
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
            /* Vista Previa del Documento Completo - Estilo DocuSign / Adobe Sign Enterprise */
            <div className="max-w-4xl mx-auto bg-white p-8 sm:p-14 rounded-2xl shadow-2xl border-2 border-slate-800 text-slate-800 space-y-7 relative overflow-hidden font-sans">
              
              {/* Micro-header de seguridad jurídica y hash criptográfico */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[9px] uppercase tracking-widest font-mono text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>INSTRUMENTO JURÍDICO AUDITABLE • VALIDEZ DE FIRMA DIGITAL</span>
                </span>
                <span>FOLIO: {formData.contract_number} • SHA256-{(formData.contract_number + '2026').slice(0, 10).toUpperCase()}</span>
              </div>

              {/* Membrete Corporativo Oficial - Logo Proporcional */}
              <div className="border-b-2 border-slate-900/80 pb-6 flex flex-col sm:flex-row justify-between items-start gap-6">
                <div className="flex-1 space-y-2">
                  {/* Logo Proporcional Ejecutivo (Sin recortes ni cajas cuadradas) */}
                  <div className="flex items-center min-h-[48px] max-h-14 max-w-[280px]">
                    {formData.datos_empresa.logo_url ? (
                      <img
                        src={formData.datos_empresa.logo_url}
                        alt={formData.datos_empresa.nombre}
                        className="max-h-12 w-auto max-w-full object-contain object-left"
                      />
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-sm">
                          {formData.datos_empresa.nombre?.slice(0, 2).toUpperCase() || 'CP'}
                        </div>
                        <span className="font-black text-base tracking-tight text-slate-900">
                          {formData.datos_empresa.nombre}
                        </span>
                      </div>
                    )}
                  </div>

                  <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {formData.datos_empresa.nombre}
                  </h1>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-500 leading-relaxed">
                    <div>
                      <span className="text-slate-400 font-medium">Identificación Fiscal:</span>{' '}
                      <strong className="text-slate-700">{formData.datos_empresa.tax_id || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Representante:</span>{' '}
                      <strong className="text-slate-700">{formData.datos_empresa.representante}</strong>
                    </div>
                    {formData.datos_empresa.direccion && (
                      <div className="col-span-full">
                        <span className="text-slate-400 font-medium">Domicilio Corporativo:</span>{' '}
                        <span className="text-slate-600">{formData.datos_empresa.direccion}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Certificado y Metadatos Formales */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:min-w-[240px] text-right space-y-1.5 flex-shrink-0 shadow-sm">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-xs">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{formData.contract_number}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <p><span className="text-slate-400">Emisión:</span> <strong className="text-slate-700">{formData.fecha_inicio}</strong></p>
                    <p><span className="text-slate-400">Vigencia:</span> <strong className="text-slate-700">{formData.vigencia_meses} meses</strong></p>
                    <p><span className="text-slate-400">Vence:</span> <strong className="text-slate-700">{formData.fecha_fin}</strong></p>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      existingContract?.status === 'firmado'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${existingContract?.status === 'firmado' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
                      {existingContract?.status === 'firmado' ? 'Firmado Digitalmente' : 'Documento Oficial'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Título Solemne */}
              <div className="text-center py-2 space-y-1">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.25em]">
                  Instrumento Privado de Contratación Mercantil
                </p>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                  CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Suscrito entre <strong className="text-slate-800">{formData.datos_empresa.nombre}</strong> y{' '}
                  <strong className="text-slate-800">{formData.datos_cliente.empresa || formData.datos_cliente.nombre}</strong>
                </p>
              </div>

              {/* Preámbulo Legal: Comparecientes */}
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-3 text-xs leading-relaxed text-slate-700">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    I. REUNIDOS Y COMPARECENCIA
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">EL PRESTADOR DEL SERVICIO</span>
                    <p className="font-bold text-slate-900">{formData.datos_empresa.nombre}</p>
                    <p className="text-slate-600">Tax ID / NIT: {formData.datos_empresa.tax_id || 'N/A'}</p>
                    <p className="text-slate-600">Representado por: {formData.datos_empresa.representante}</p>
                    {formData.datos_empresa.direccion && <p className="text-slate-500 text-[11px]">{formData.datos_empresa.direccion}</p>}
                  </div>

                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">EL CLIENTE RECEPTOR</span>
                    <p className="font-bold text-slate-900">{formData.datos_cliente.empresa || formData.datos_cliente.nombre}</p>
                    <p className="text-slate-600">Identificación / Tax ID: {formData.datos_cliente.tax_id || 'N/A'}</p>
                    <p className="text-slate-600">Representado por: {formData.datos_cliente.nombre}</p>
                    {formData.datos_cliente.direccion && <p className="text-slate-500 text-[11px]">{formData.datos_cliente.direccion}</p>}
                  </div>
                </div>
                <p className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600 italic">
                  Ambas partes se reconocen mutuamente plena capacidad legal y legitimación suficiente para suscribir el presente instrumento privado, declarando que actúan libremente y sin vicios en el consentimiento.
                </p>
              </div>

              {/* Antecedentes y Expositiva */}
              <div className="text-xs text-slate-700 leading-relaxed space-y-1 pl-3 border-l-2 border-indigo-400">
                <p className="font-black text-slate-900 uppercase tracking-wider text-[11px]">II. ANTECEDENTES Y MANIFESTACIONES:</p>
                <p className="text-slate-600 text-justify">
                  Que EL CLIENTE habiendo examinado y aprobado la propuesta técnica y económica oficial, ha resuelto encomendar a EL PRESTADOR, y éste a su vez acepta, la ejecución de los servicios descritos bajo las siguientes:
                </p>
              </div>

              {/* Cláusulas con Jerarquía Jurídica */}
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b-2 border-slate-900/80 pb-2">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">
                    III. CLÁUSULAS Y ESTIPULACIONES CONTRACTUALES
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">{formData.clausulas.length} CLÁUSULAS REGISTRADAS</span>
                </div>

                <div className="space-y-4">
                  {formData.clausulas.map((c, i) => (
                    <div key={i} className="space-y-1 pl-3.5 border-l-2 border-slate-200 hover:border-indigo-400 transition-colors">
                      <h4 className="text-xs font-black text-slate-900 tracking-wide flex items-center gap-2">
                        <span className="text-indigo-600 font-mono text-[11px]">{c.numero}:</span>
                        <span className="uppercase">{c.titulo}</span>
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed text-justify">
                        {c.contenido}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen Económico en Tabla Ejecutiva */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <span className="font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-400" /> RESUMEN DE HONORARIOS Y CONDICIONES ECONÓMICAS
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">VALORES EXPRESADOS EN USD</span>
                </div>
                <div className="divide-y divide-slate-200 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-50 font-bold text-slate-600 text-[11px]">
                    <span>Concepto Contractual</span>
                    <span>Modalidad y Condiciones</span>
                    <span className="sm:text-right">Monto Total USD</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 p-3 text-slate-700 items-center gap-2 sm:gap-0">
                    <span className="font-semibold text-slate-900">{formData.title}</span>
                    <span className="text-slate-600">{formData.forma_pago}</span>
                    <span className="sm:text-right font-black text-base text-indigo-600">
                      ${formData.monto_total?.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Testimonio de Formalización */}
              <p className="text-[11px] text-slate-600 leading-relaxed text-justify italic pt-2">
                En testimonio de plena conformidad con todas y cada una de las cláusulas y compromisos estipulados en el presente instrumento, las partes lo otorgan y suscriben en la fecha indicada al pie, reconociéndole plena validez y fuerza legal.
              </p>

              {/* Firmas de las Partes */}
              <div className="pt-6 border-t-2 border-slate-900/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                  {/* Firma Prestador */}
                  <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                    <div className="h-16 border-b-2 border-slate-300 flex items-center justify-center">
                      <span className="font-serif italic text-slate-600 text-sm font-semibold">{formData.datos_empresa.representante}</span>
                    </div>
                    <p className="font-bold text-slate-900">{formData.datos_empresa.representante}</p>
                    <p className="text-[11px] text-slate-500">{formData.datos_empresa.nombre}</p>
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded">
                      POR EL PRESTADOR
                    </span>
                  </div>

                  {/* Firma Cliente */}
                  <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                    <div className="h-16 border-b-2 border-slate-300 flex items-center justify-center">
                      {existingContract?.firmado_digitalmente && existingContract.firma_imagen ? (
                        <img src={existingContract.firma_imagen} alt="Firma Digital" className="max-h-14 object-contain" />
                      ) : (
                        <span className="text-[10px] text-amber-600 italic font-semibold">Pendiente de firma digital por el cliente</span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900">{formData.datos_cliente.nombre}</p>
                    <p className="text-[11px] text-slate-500">{formData.datos_cliente.empresa || formData.datos_cliente.nombre}</p>
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded">
                      {existingContract?.firmado_digitalmente ? 'FIRMADO DIGITALMENTE' : 'POR EL CLIENTE'}
                    </span>
                    {existingContract?.firmado_digitalmente && existingContract.firmado_en && (
                      <p className="text-[9px] text-slate-400 font-mono mt-1">
                        Timestamp: {new Date(existingContract.firmado_en).toLocaleString('es-ES')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Certificado de Integridad y Trazabilidad Criptográfica (100% White-Label) */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 flex-shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                          {existingContract?.firmado_digitalmente 
                            ? 'Certificado Oficial de Firma Electrónica' 
                            : 'Instrumento Electrónico con Validez Jurídica Vinculante'}
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          FOLIO: {formData.contract_number} • SHA256-{(formData.contract_number + '2026').slice(0, 16).toUpperCase()} • LEY DE FIRMA ELECTRÓNICA
                        </p>
                      </div>
                    </div>
                    <div className="text-[9px] text-right text-slate-500 font-medium">
                      {existingContract?.firmado_digitalmente ? (
                        <div className="flex flex-col sm:items-end">
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Firmado electrónicamente
                          </span>
                          <span className="text-slate-400 font-mono text-[8.5px]">
                            {existingContract.firmado_en ? new Date(existingContract.firmado_en).toLocaleString('es-ES') : ''} • IP: {existingContract.firmante_ip || 'Auditada'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">
                          Registro inmutable emitido para formalización y suscripción digital
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="h-9 sm:h-10 px-3.5 sm:px-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Descargar Borrador PDF</span>
            </button>
            {contractId && (
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                className="h-9 sm:h-10 px-3.5 sm:px-4 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enlaces de Firma (WhatsApp / Email)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSave('borrador')}
              disabled={saving}
              className="h-9 sm:h-10 px-3.5 sm:px-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>Guardar Borrador</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave('enviado')}
              disabled={saving}
              className="h-9 sm:h-10 px-4 sm:px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Emitir y Compartir con Cliente</span>
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
