import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Save, Settings2, FileText, Loader2,
  ShieldCheck, CheckSquare, Square, ArrowUpRight, UserCircle2
} from 'lucide-react';
import { pipelineStagesService, stageDocTypesService, clientPortalService } from '../../services/clients';
import type { ClientPipelineStage, ClientStageDocumentType } from '../../types/clients';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface TeamMember { id: string; full_name: string | null; email: string; }

const COLOR_OPTIONS = [
  '#4449AA', '#6366f1', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#0ea5e9', '#8b5cf6', '#64748b'
];

// iOS-style professional toggle
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // ── Drag & Drop ──────────────────────────────────────────────
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pipelineStagesService.getAll(true);
      setStages(s);
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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      if (!profile) return;
      setCompanyId(profile.company_id);
      const [compRes, teamRes] = await Promise.all([
        supabase.from('companies').select('portal_terms_text').eq('id', profile.company_id).single(),
        supabase.from('profiles').select('id, full_name, email').eq('company_id', profile.company_id).order('full_name'),
      ]);
      if (compRes.data?.portal_terms_text) setTermsText(compRes.data.portal_terms_text);
      if (teamRes.data) setTeamMembers(teamRes.data as TeamMember[]);
    });
  }, [load]);

  // ── Drag & Drop handlers ─────────────────────────────────────
  const onDragStart = (id: string) => { dragId.current = id; };
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragId.current !== id) setDragOver(id);
  };
  const onDrop = async (targetId: string) => {
    const srcId = dragId.current;
    setDragOver(null);
    dragId.current = null;
    if (!srcId || srcId === targetId) return;

    const sorted = [...stages].sort((a, b) => a.orden - b.orden);
    const srcIdx = sorted.findIndex(s => s.id === srcId);
    const tgtIdx = sorted.findIndex(s => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    const updates = reordered.map((s, i) => ({ id: s.id, orden: i + 1 }));

    // Optimistic update
    setStages(reordered.map((s, i) => ({ ...s, orden: i + 1 })));
    try {
      await pipelineStagesService.updateOrder(updates);
      toast.success('Orden actualizado');
    } catch {
      toast.error('Error al reordenar');
      await load();
    }
  };
  const onDragEnd = () => { setDragOver(null); dragId.current = null; };

  // ── Stage CRUD ───────────────────────────────────────────────
  const handleSaveStage = async (stage: ClientPipelineStage) => {
    const edits = editingStage[stage.id] || {};
    if (!Object.keys(edits).length) return;
    setSaving(true);
    try {
      await pipelineStagesService.update(stage.id, edits);
      toast.success(`✅ "${edits.nombre ?? stage.nombre}" actualizado`);
      setEditingStage(prev => { const n = { ...prev }; delete n[stage.id]; return n; });
      await load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleAddStage = async () => {
    if (!companyId) { toast.error('Cargando empresa, intenta de nuevo'); return; }
    const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.orden)) : 0;
    try {
      await pipelineStagesService.create({
        company_id: companyId,
        nombre: 'Nueva Etapa',
        descripcion: '',
        icono: 'star',
        color: '#4449AA',
        orden: maxOrder + 1,
        es_final: false,
        assigned_to: null,
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

  // ── Doc types CRUD ───────────────────────────────────────────
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
      toast.success('Documento agregado');
      setNewDocInputs(prev => ({ ...prev, [stageId]: { nombre: '', descripcion: '', requerido: true } }));
      await load();
    } catch { toast.error('Error al agregar'); }
  };

  const handleDeleteDocType = async (docId: string) => {
    if (!confirm('¿Eliminar este tipo de documento?')) return;
    try {
      await stageDocTypesService.delete(docId);
      toast.success('Documento eliminado');
      await load();
    } catch { toast.error('Error al eliminar'); }
  };

  const sorted = [...stages].sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Pipeline</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">
            Configura las etapas del onboarding · Arrastra para reordenar
          </p>
        </div>
        <button
          onClick={handleAddStage}
          className="flex items-center gap-2 px-4 py-2 bg-[#4449AA] text-white rounded-xl text-sm font-bold hover:bg-[#3338a0] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nueva Etapa
        </button>
      </div>

      {/* ── Legend ────────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><GripVertical className="w-3.5 h-3.5" /> Arrasta para reordenar</span>
        <span className="flex items-center gap-1.5"><Toggle checked={true} onChange={() => {}} /> Activa / Desactiva etapa</span>
        <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Ver tipos de documentos</span>
      </div>

      {/* ── Stages list ───────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#4449AA]" />
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((stage, idx) => {
            const edits = editingStage[stage.id] || {};
            const hasEdits = Object.keys(edits).length > 0;
            const isExpanded = expandedStage === stage.id;
            const stageDocs = docTypes[stage.id] || [];
            const newDoc = newDocInputs[stage.id] || { nombre: '', descripcion: '', requerido: true };
            const displayName = edits.nombre ?? stage.nombre;
            const displayColor = edits.color ?? stage.color;
            const isDragTarget = dragOver === stage.id;

            return (
              <div
                key={stage.id}
                draggable
                onDragStart={() => onDragStart(stage.id)}
                onDragOver={e => onDragOver(e, stage.id)}
                onDrop={() => onDrop(stage.id)}
                onDragEnd={onDragEnd}
                className={`bg-white rounded-2xl border transition-all ${
                  isDragTarget
                    ? 'border-[#4449AA] border-2 shadow-md shadow-[#4449AA]/10 scale-[1.01]'
                    : stage.activo
                    ? 'border-gray-100 hover:border-gray-200'
                    : 'border-dashed border-gray-200 opacity-50'
                }`}
              >
                {/* ── Stage header row ───────────────────── */}
                <div className="flex items-center gap-3 px-6 py-4">

                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Order badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm"
                    style={{ background: displayColor }}
                  >
                    {idx + 1}
                  </div>

                  {/* Name inline editor */}
                  <input
                    value={displayName}
                    onChange={e => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], nombre: e.target.value } }))}
                    className="flex-1 min-w-0 text-sm font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#4449AA] focus:outline-none py-0.5 transition-all"
                    placeholder="Nombre de la etapa"
                    onKeyDown={e => e.key === 'Enter' && handleSaveStage(stage)}
                  />

                  {/* Color swatches */}
                  <div className="flex gap-2.5 flex-shrink-0">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], color: c } }))}
                        className={`w-5 h-5 rounded-full transition-all ${displayColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-125' : 'hover:scale-110'}`}
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>

                  {/* Assignee dropdown */}
                  <div className="relative flex-shrink-0">
                    <select
                      value={edits.assigned_to ?? stage.assigned_to ?? ''}
                      onChange={async e => {
                        const val = e.target.value || null;
                        try {
                          await pipelineStagesService.update(stage.id, { assigned_to: val });
                          toast.success(val ? '👤 Responsable asignado' : 'Responsable eliminado');
                          await load();
                        } catch { toast.error('Error al asignar'); }
                      }}
                      className="text-xs border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA] text-gray-700 appearance-none cursor-pointer hover:border-gray-300 transition-colors"
                      title="Responsable de esta etapa"
                    >
                      <option value="">Sin responsable</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                      ))}
                    </select>
                    <UserCircle2 className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Final stage */}
                  <label className="flex items-center gap-1 cursor-pointer flex-shrink-0 select-none group">
                    <span className="text-[10px] font-bold text-gray-400 uppercase group-hover:text-gray-600 transition-colors">Final</span>
                    {(edits.es_final ?? stage.es_final)
                      ? <CheckSquare className="w-4 h-4 text-[#4449AA]" onClick={() => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], es_final: false } }))} />
                      : <Square className="w-4 h-4 text-gray-300" onClick={() => setEditingStage(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], es_final: true } }))} />
                    }
                  </label>

                  {/* Save button (only if edits) */}
                  {hasEdits && (
                    <button
                      onClick={() => handleSaveStage(stage)}
                      disabled={saving}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#4449AA] text-white rounded-lg text-xs font-bold hover:bg-[#3338a0] disabled:opacity-60 transition-all flex-shrink-0"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Guardar
                    </button>
                  )}

                  {/* Active toggle */}
                  <Toggle
                    checked={stage.activo}
                    onChange={() => handleToggleActive(stage)}
                  />

                  {/* Expand doc types */}
                  <button
                    onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-bold transition-all flex-shrink-0 border border-gray-100"
                  >
                    <FileText className="w-3 h-3" />
                    {stageDocs.length}
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                </div>

                {/* ── Doc types panel ────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pt-3 pb-4 space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Settings2 className="w-3 h-3 text-gray-400" />
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                        Documentos requeridos al cliente
                      </p>
                    </div>

                    {stageDocs.length === 0 && (
                      <p className="text-xs text-gray-400 italic py-1">
                        Sin documentos configurados — agrega los que el cliente debe subir.
                      </p>
                    )}

                    {/* Doc list */}
                    <div className="space-y-1.5">
                      {stageDocs.map(dt => (
                        <div key={dt.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 group">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dt.requerido ? 'bg-red-400' : 'bg-gray-300'}`} />
                          <span className="text-xs font-semibold text-gray-800 flex-1">{dt.nombre}</span>
                          {dt.descripcion && (
                            <span className="text-xs text-gray-400 truncate max-w-[160px]">{dt.descripcion}</span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            dt.requerido ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {dt.requerido ? 'Req.' : 'Opt.'}
                          </span>
                          <button
                            onClick={() => handleDeleteDocType(dt.id)}
                            className="p-0.5 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add doc type */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
                      <input
                        value={newDoc.nombre}
                        onChange={e => setNewDocInputs(prev => ({ ...prev, [stage.id]: { ...newDoc, nombre: e.target.value } }))}
                        placeholder="Ej: Contrato firmado, DUI..."
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA] bg-white"
                        onKeyDown={e => e.key === 'Enter' && handleAddDocType(stage.id)}
                      />
                      <input
                        value={newDoc.descripcion}
                        onChange={e => setNewDocInputs(prev => ({ ...prev, [stage.id]: { ...newDoc, descripcion: e.target.value } }))}
                        placeholder="Descripción (opcional)"
                        className="w-36 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 bg-white"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer flex-shrink-0 select-none">
                        <input
                          type="checkbox"
                          checked={newDoc.requerido}
                          onChange={e => setNewDocInputs(prev => ({ ...prev, [stage.id]: { ...newDoc, requerido: e.target.checked } }))}
                          className="accent-[#4449AA]"
                        />
                        Req.
                      </label>
                      <button
                        onClick={() => handleAddDocType(stage.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-[#4449AA] text-white rounded-lg text-xs font-bold hover:bg-[#3338a0] flex-shrink-0 transition-all"
                      >
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

      {/* ── Terms & Conditions ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setTermsExpanded(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-[#4449AA] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">Términos y Condiciones del Portal</p>
            <p className="text-xs text-gray-400">Se muestra al cliente antes de subir documentos</p>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-gray-300" />
          {termsExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {termsExpanded && (
          <div className="border-t border-gray-50 p-5 space-y-3">
            <p className="text-xs text-gray-400">
              Admite formato básico: <code className="bg-gray-100 px-1 rounded">## Título</code>, <code className="bg-gray-100 px-1 rounded">**negrita**</code>, <code className="bg-gray-100 px-1 rounded">- lista</code>
            </p>
            <textarea
              value={termsText}
              onChange={e => setTermsText(e.target.value)}
              rows={14}
              className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA] resize-y bg-gray-50"
              placeholder="Escribe los términos y condiciones aquí..."
            />
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (!companyId) return;
                  setSavingTerms(true);
                  try {
                    await clientPortalService.updatePortalTerms(companyId, termsText);
                    toast.success('✅ Términos guardados');
                  } catch { toast.error('Error al guardar'); }
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

      {/* ── Tip ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <span className="text-base">💡</span>
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Etapa Final:</strong> Marca la última etapa como "Final" — cuando el cliente sube todos sus documentos, el sistema lo promueve automáticamente a <strong>Cliente Activo</strong>.
          Arrastra las etapas para cambiar el orden. Los cambios de nombre y color requieren presionar <strong>Guardar</strong>.
        </p>
      </div>
    </div>
  );
}
