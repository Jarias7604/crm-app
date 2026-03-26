import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Save, Settings2, FileText, Loader2, ToggleLeft, ToggleRight, ShieldCheck
} from 'lucide-react';
import { pipelineStagesService, stageDocTypesService, clientPortalService } from '../../services/clients';
import type { ClientPipelineStage, ClientStageDocumentType } from '../../types/clients';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const COLOR_OPTIONS = [
  '#4449AA', '#6366f1', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#0ea5e9', '#8b5cf6'
];

export default function PipelineConfig() {
  const [stages, setStages] = useState<ClientPipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [docTypes, setDocTypes] = useState<Record<string, ClientStageDocumentType[]>>({});
  const [editingStage, setEditingStage] = useState<Record<string, Partial<ClientPipelineStage>>>({});
  const [newDocInputs, setNewDocInputs] = useState<Record<string, { nombre: string; descripcion: string; requerido: boolean }>>({});
  const [termsText, setTermsText] = useState('');
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pipelineStagesService.getAll(true);
      setStages(s);
      // Load doc types for each stage
      const dtMap: Record<string, ClientStageDocumentType[]> = {};
      await Promise.all(s.map(async st => {
        dtMap[st.id] = await stageDocTypesService.getByStage(st.id);
      }));
      setDocTypes(dtMap);
    } catch { toast.error('Error al cargar etapas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { 
    load();
    // Load current user's company and terms
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      if (!profile) return;
      setCompanyId(profile.company_id);
      const { data: comp } = await supabase.from('companies').select('portal_terms_text').eq('id', profile.company_id).single();
      if (comp?.portal_terms_text) setTermsText(comp.portal_terms_text);
    });
  }, [load]);

  const handleSaveStage = async (stage: ClientPipelineStage) => {
    const edits = editingStage[stage.id] || {};
    setSaving(true);
    try {
      await pipelineStagesService.update(stage.id, edits);
      toast.success(`✅ "${edits.nombre || stage.nombre}" actualizado`);
      setEditingStage(prev => { const n = { ...prev }; delete n[stage.id]; return n; });
      await load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const sorted = [...stages].sort((a, b) => a.orden - b.orden);
    const current = sorted[idx];
    const prev = sorted[idx - 1];
    await pipelineStagesService.updateOrder([
      { id: current.id, orden: prev.orden },
      { id: prev.id, orden: current.orden },
    ]);
    await load();
  };

  const handleMoveDown = async (idx: number) => {
    const sorted = [...stages].sort((a, b) => a.orden - b.orden);
    if (idx === sorted.length - 1) return;
    const current = sorted[idx];
    const next = sorted[idx + 1];
    await pipelineStagesService.updateOrder([
      { id: current.id, orden: next.orden },
      { id: next.id, orden: current.orden },
    ]);
    await load();
  };

  const handleAddStage = async () => {
    const maxOrder = Math.max(0, ...stages.map(s => s.orden));
    try {
      await pipelineStagesService.create({
        nombre: 'Nueva Etapa',
        descripcion: '',
        icono: 'star',
        color: '#4449AA',
        orden: maxOrder + 1,
        es_final: false,
      });
      toast.success('Etapa creada');
      await load();
    } catch { toast.error('Error al crear etapa'); }
  };

  const handleToggleActive = async (stage: ClientPipelineStage) => {
    await pipelineStagesService.update(stage.id, { activo: !stage.activo });
    toast.success(stage.activo ? 'Etapa desactivada' : 'Etapa activada');
    await load();
  };

  const handleAddDocType = async (stageId: string) => {
    const input = newDocInputs[stageId];
    if (!input?.nombre?.trim()) { toast.error('Nombre requerido'); return; }
    const existing = docTypes[stageId] || [];
    try {
      await stageDocTypesService.create({
        stage_id: stageId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion || '',
        requerido: input.requerido,
        orden: existing.length + 1,
      });
      toast.success('Tipo de documento agregado');
      setNewDocInputs(prev => ({ ...prev, [stageId]: { nombre: '', descripcion: '', requerido: true } }));
      await load();
    } catch { toast.error('Error al agregar tipo'); }
  };

  const handleDeleteDocType = async (docId: string) => {
    if (!confirm('¿Eliminar este tipo de documento?')) return;
    try {
      await stageDocTypesService.delete(docId);
      toast.success('Tipo eliminado');
      await load();
    } catch { toast.error('Error al eliminar'); }
  };

  const sorted = [...stages].sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Pipeline</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">Configura las etapas del proceso de onboarding de clientes</p>
        </div>
        <button
          onClick={handleAddStage}
          className="flex items-center gap-2 px-4 py-2 bg-[#4449AA] text-white rounded-xl text-sm font-bold hover:bg-[#3338a0] transition-all"
        >
          <Plus className="w-4 h-4" /> Nueva Etapa
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#4449AA]" />
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((stage, idx) => {
            const edits = editingStage[stage.id] || {};
            const hasEdits = Object.keys(edits).length > 0;
            const isExpanded = expandedStage === stage.id;
            const stageDocs = docTypes[stage.id] || [];
            const newDoc = newDocInputs[stage.id] || { nombre: '', descripcion: '', requerido: true };
            const displayName = edits.nombre ?? stage.nombre;
            const displayColor = edits.color ?? stage.color;

            return (
              <div key={stage.id} className={`bg-white rounded-2xl border transition-all ${
                stage.activo ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'
              }`}>
                {/* Stage row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Order arrows */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button onClick={() => handleMoveUp(idx)} className="p-0.5 text-gray-300 hover:text-gray-600">
                      <ChevronRight className="w-3 h-3 -rotate-90" />
                    </button>
                    <button onClick={() => handleMoveDown(idx)} className="p-0.5 text-gray-300 hover:text-gray-600">
                      <ChevronRight className="w-3 h-3 rotate-90" />
                    </button>
                  </div>

                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                  {/* Order badge */}
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                    style={{ background: displayColor }}>
                    {idx + 1}
                  </div>

                  {/* Name input */}
                  <input
                    value={displayName}
                    onChange={e => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], nombre: e.target.value } }))}
                    className="flex-1 text-sm font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#4449AA] focus:outline-none py-0.5 transition-all"
                    placeholder="Nombre de la etapa"
                  />

                  {/* Color picker */}
                  <div className="flex gap-1 flex-shrink-0">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} onClick={() => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], color: c } }))}
                        className={`w-4 h-4 rounded-full transition-all ${displayColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                        style={{ background: c }} />
                    ))}
                  </div>

                  {/* Final stage toggle */}
                  <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Final</span>
                    <input type="checkbox"
                      checked={edits.es_final ?? stage.es_final}
                      onChange={e => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], es_final: e.target.checked } }))}
                      className="w-3.5 h-3.5 rounded accent-[#4449AA]" />
                  </label>

                  {/* Save btn */}
                  {hasEdits && (
                    <button onClick={() => handleSaveStage(stage)} disabled={saving}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#4449AA] text-white rounded-lg text-xs font-bold hover:bg-[#3338a0] disabled:opacity-60">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Guardar
                    </button>
                  )}

                  {/* Toggle active */}
                  <button onClick={() => handleToggleActive(stage)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                    {stage.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  {/* Expand doc types */}
                  <button onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 text-xs font-bold transition-all flex-shrink-0">
                    <FileText className="w-3 h-3" />
                    {stageDocs.length}
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                </div>

                {/* Doc types section */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-2">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Settings2 className="w-3 h-3" /> Tipos de documentos requeridos
                    </p>

                    {stageDocs.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Sin tipos configurados — agrega los documentos que el cliente debe subir.</p>
                    )}

                    {stageDocs.map(dt => (
                      <div key={dt.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dt.requerido ? 'bg-red-400' : 'bg-gray-300'}`} />
                        <span className="text-xs font-semibold text-gray-700 flex-1">{dt.nombre}</span>
                        {dt.descripcion && <span className="text-xs text-gray-400 truncate max-w-[200px]">{dt.descripcion}</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dt.requerido ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                          {dt.requerido ? 'Requerido' : 'Opcional'}
                        </span>
                        <button onClick={() => handleDeleteDocType(dt.id)}
                          className="p-0.5 text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add new doc type */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        value={newDoc.nombre}
                        onChange={e => setNewDocInputs(prev => ({ ...prev, [stage.id]: { ...newDoc, nombre: e.target.value } }))}
                        placeholder="Ej: Contrato firmado, DUI..."
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4449AA]/30 focus:border-[#4449AA]"
                        onKeyDown={e => e.key === 'Enter' && handleAddDocType(stage.id)}
                      />
                      <input
                        value={newDoc.descripcion}
                        onChange={e => setNewDocInputs(prev => ({ ...prev, [stage.id]: { ...newDoc, descripcion: e.target.value } }))}
                        placeholder="Descripción (opcional)"
                        className="w-40 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4449AA]/30"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer flex-shrink-0">
                        <input type="checkbox"
                          checked={newDoc.requerido}
                          onChange={e => setNewDocInputs(prev => ({ ...prev, [stage.id]: { ...newDoc, requerido: e.target.checked } }))}
                          className="accent-[#4449AA]" />
                        Req.
                      </label>
                      <button onClick={() => handleAddDocType(stage.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-[#4449AA] text-white rounded-lg text-xs font-bold hover:bg-[#3338a0] flex-shrink-0">
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Editor de Términos y Condiciones ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setTermsExpanded(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-[#4449AA]" />
          <span className="text-sm font-black text-gray-900 flex-1">Términos y Condiciones del Portal</span>
          <span className="text-xs text-gray-400 mr-2">Editable — se muestra al cliente antes de subir</span>
          {termsExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {termsExpanded && (
          <div className="border-t border-gray-50 p-5 space-y-3">
            <p className="text-xs text-gray-400">
              Este texto aparece en el portal del cliente. Admite formato básico: <code className="bg-gray-100 px-1 rounded">## Título</code>, <code className="bg-gray-100 px-1 rounded">### Subtítulo</code>, <code className="bg-gray-100 px-1 rounded">**negrita**</code>, <code className="bg-gray-100 px-1 rounded">- lista</code>.
            </p>
            <textarea
              value={termsText}
              onChange={e => setTermsText(e.target.value)}
              rows={14}
              className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA] resize-y"
              placeholder="Escribe los términos y condiciones aquí..."
            />
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (!companyId) return;
                  setSavingTerms(true);
                  try {
                    await clientPortalService.updatePortalTerms(companyId, termsText);
                    toast.success('✅ Términos guardados — se actualizan en todos los portales');
                  } catch { toast.error('Error al guardar términos'); }
                  finally { setSavingTerms(false); }
                }}
                disabled={savingTerms || !companyId}
                className="flex items-center gap-2 px-4 py-2 bg-[#4449AA] text-white rounded-xl text-sm font-bold hover:bg-[#3338a0] disabled:opacity-60 transition-all"
              >
                {savingTerms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Términos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs text-blue-700 font-semibold">
          💡 <strong>Etapa Final:</strong> Marca la última etapa como "Final" — al completar sus documentos el cliente se promueve automáticamente a <strong>Cliente Activo</strong>.
          El orden se cambia con las flechas ↑↓. Los cambios de nombre/color requieren guardar.
        </p>
      </div>
    </div>
  );
}
