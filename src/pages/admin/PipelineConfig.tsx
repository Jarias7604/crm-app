import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Save, Settings2, FileText, Loader2, Pencil, X,
  ShieldCheck, ArrowUpRight, UserCircle2, CheckCircle2
} from 'lucide-react';
import { pipelineStagesService, stageDocTypesService, clientPortalService } from '../../services/clients';
import type { ClientPipelineStage, ClientStageDocumentType } from '../../types/clients';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface TeamMember { id: string; full_name: string | null; email: string; }

interface StageForm {
  nombre: string;
  descripcion: string;
  color: string;
  es_final: boolean;
  assigned_to: string | null;
}

const COLOR_OPTIONS = [
  '#4449AA', '#6366f1', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#0ea5e9', '#8b5cf6', '#64748b'
];

// iOS-style toggle
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
        checked ? 'translate-x-6' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

export default function PipelineConfig() {
  const [stages, setStages] = useState<ClientPipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Panel de edición — cuál etapa está en modo edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StageForm>({ nombre: '', descripcion: '', color: '#4449AA', es_final: false, assigned_to: null });

  // Panel de documentos
  const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
  const [docTypes, setDocTypes] = useState<Record<string, ClientStageDocumentType[]>>({});
  const [newDocInputs, setNewDocInputs] = useState<Record<string, { nombre: string; descripcion: string; requerido: boolean }>>({});

  // Edición inline de doc types
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocForm, setEditDocForm] = useState<{ nombre: string; descripcion: string; requerido: boolean }>({ nombre: '', descripcion: '', requerido: true });

  // Términos y empresa
  const [termsText, setTermsText] = useState('');
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Drag & drop
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Ref para auto-focus del input de nombre al abrir edición
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────
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

  // Focus automático cuando se abre el panel de edición
  useEffect(() => {
    if (editingId && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  // ── Abrir panel de edición ────────────────────────────────────
  const openEdit = (stage: ClientPipelineStage) => {
    setExpandedDocs(null); // cerrar docs si estaban abiertos
    setEditingId(stage.id);
    setEditForm({
      nombre: stage.nombre,
      descripcion: stage.descripcion || '',
      color: stage.color,
      es_final: stage.es_final,
      assigned_to: stage.assigned_to ?? null,
    });
  };

  const cancelEdit = () => setEditingId(null);

  // ── Guardar edición ───────────────────────────────────────────
  const handleSaveEdit = async (stageId: string) => {
    const trimmedName = editForm.nombre.trim();
    if (!trimmedName) { toast.error('El nombre no puede estar vacío'); nameInputRef.current?.focus(); return; }
    setSaving(true);
    try {
      await pipelineStagesService.update(stageId, {
        nombre: trimmedName,
        descripcion: editForm.descripcion.trim() || '',
        color: editForm.color,
        es_final: editForm.es_final,
        assigned_to: editForm.assigned_to || null,
      });
      toast.success(`✅ "${trimmedName}" guardado`);
      setEditingId(null);
      await load();
    } catch { toast.error('Error al guardar — intenta de nuevo'); }
    finally { setSaving(false); }
  };

  // ── Toggle activo ─────────────────────────────────────────────
  const handleToggleActive = async (stage: ClientPipelineStage) => {
    try {
      await pipelineStagesService.update(stage.id, { activo: !stage.activo });
      toast.success(stage.activo ? 'Etapa desactivada' : 'Etapa activada');
      await load();
    } catch { toast.error('Error al cambiar estado'); }
  };

  // ── Eliminar etapa ────────────────────────────────────────────
  const handleDeleteStage = async (stage: ClientPipelineStage) => {
    if (!confirm(`¿Eliminar la etapa "${stage.nombre}"?\n\nEsta acción es permanente. Los clientes que estén en esta etapa quedarán sin etapa asignada.`)) return;
    try {
      const { error } = await (supabase as any).from('client_pipeline_stages').delete().eq('id', stage.id);
      if (error) throw error;
      toast.success(`🗑️ "${stage.nombre}" eliminada`);
      setEditingId(null);
      await load();
    } catch { toast.error('Error al eliminar — puede tener clientes activos asignados'); }
  };

  // ── Nueva etapa ───────────────────────────────────────────────
  const handleAddStage = async () => {
    if (!companyId) { toast.error('Cargando empresa, intenta de nuevo'); return; }
    const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.orden)) : 0;
    try {
      const newStage = await pipelineStagesService.create({
        company_id: companyId,
        nombre: 'Nueva Etapa',
        descripcion: '',
        icono: 'star',
        color: '#4449AA',
        orden: maxOrder + 1,
        es_final: false,
        assigned_to: null,
      });
      await load();
      // Abrir automáticamente el panel de edición para la nueva etapa
      openEdit({ ...newStage, nombre: 'Nueva Etapa', descripcion: '', color: '#4449AA', es_final: false, assigned_to: null } as ClientPipelineStage);
      toast.success('Etapa creada — ponle un nombre');
    } catch { toast.error('Error al crear etapa'); }
  };

  // ── Drag & Drop ───────────────────────────────────────────────
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

  // ── Doc types ─────────────────────────────────────────────────
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

  const openEditDoc = (dt: ClientStageDocumentType) => {
    setEditingDocId(dt.id);
    setEditDocForm({ nombre: dt.nombre, descripcion: dt.descripcion || '', requerido: dt.requerido });
  };

  const handleUpdateDocType = async (docId: string) => {
    if (!editDocForm.nombre.trim()) { toast.error('Nombre requerido'); return; }
    try {
      await stageDocTypesService.update(docId, {
        nombre: editDocForm.nombre.trim(),
        descripcion: editDocForm.descripcion.trim(),
        requerido: editDocForm.requerido,
      });
      toast.success('✅ Documento actualizado');
      setEditingDocId(null);
      await load();
    } catch { toast.error('Error al actualizar'); }
  };

  const sorted = [...stages].sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Header ──────────────────────────────────────────── */}
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

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><GripVertical className="w-3.5 h-3.5" /> Arrastra para reordenar</span>
        <span className="flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Click ✏️ para editar nombre, color y responsable</span>
        <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Ver documentos</span>
      </div>

      {/* ── Stages list ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#4449AA]" />
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((stage, idx) => {
            const isEditing = editingId === stage.id;
            const isDocExpanded = expandedDocs === stage.id;
            const stageDocs = docTypes[stage.id] || [];
            const newDoc = newDocInputs[stage.id] || { nombre: '', descripcion: '', requerido: true };
            const isDragTarget = dragOver === stage.id;
            const assignedProfile = (stage as any).assigned_profile as TeamMember | null;

            return (
              <div
                key={stage.id}
                draggable={!isEditing}
                onDragStart={() => !isEditing && onDragStart(stage.id)}
                onDragOver={e => onDragOver(e, stage.id)}
                onDrop={() => onDrop(stage.id)}
                onDragEnd={onDragEnd}
                className={`bg-white rounded-2xl border transition-all ${
                  isDragTarget
                    ? 'border-[#4449AA] border-2 shadow-md shadow-[#4449AA]/10 scale-[1.01]'
                    : isEditing
                    ? 'border-[#4449AA] border-2 shadow-lg shadow-[#4449AA]/10'
                    : stage.activo
                    ? 'border-gray-100 hover:border-gray-200'
                    : 'border-dashed border-gray-200 opacity-50'
                }`}
              >
                {/* ── Fila principal (SOLO LECTURA) ──────────── */}
                <div className="flex items-center gap-3 px-5 py-3.5">

                  {/* Drag handle */}
                  <div className={`text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 ${isEditing ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}>
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Order badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm"
                    style={{ background: isEditing ? editForm.color : stage.color }}
                  >
                    {idx + 1}
                  </div>

                  {/* Stage name — texto, no input */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isEditing ? 'text-[#4449AA]' : 'text-gray-900'}`}>
                      {isEditing ? editForm.nombre || 'Sin nombre' : stage.nombre}
                    </p>
                    {/* Responsable badge */}
                    {assignedProfile && !isEditing && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <UserCircle2 className="w-3 h-3" />
                        {assignedProfile.full_name || assignedProfile.email}
                      </p>
                    )}
                  </div>

                  {/* Final badge */}
                  {stage.es_final && (
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Final
                    </span>
                  )}

                  {/* Edit button */}
                  <button
                    onClick={() => isEditing ? cancelEdit() : openEdit(stage)}
                    title={isEditing ? 'Cancelar edición' : 'Editar etapa'}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                      isEditing
                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-[#4449AA]/10 hover:text-[#4449AA] border border-gray-100'
                    }`}
                  >
                    {isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    {isEditing ? 'Cancelar' : 'Editar'}
                  </button>

                  {/* Active toggle */}
                  <Toggle checked={stage.activo} onChange={() => handleToggleActive(stage)} />

                  {/* Docs button */}
                  <button
                    onClick={() => setExpandedDocs(isDocExpanded ? null : stage.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-bold transition-all flex-shrink-0 border border-gray-100"
                  >
                    <FileText className="w-3 h-3" />
                    {stageDocs.length}
                    {isDocExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                </div>

                {/* ── Panel de EDICIÓN (expandible) ─────────── */}
                {isEditing && (
                  <div className="border-t border-[#4449AA]/10 bg-gradient-to-b from-[#4449AA]/[0.02] to-transparent px-5 py-5 space-y-4">

                    <p className="text-[11px] font-black text-[#4449AA] uppercase tracking-widest">Editando etapa</p>

                    {/* Nombre */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre de la etapa *</label>
                      <input
                        ref={nameInputRef}
                        value={editForm.nombre}
                        onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(stage.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        placeholder="Ej: Documentos, Capacitación..."
                        className="w-full text-sm font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#4449AA] bg-white transition-colors"
                        maxLength={60}
                      />
                      <p className="text-[10px] text-gray-400">{editForm.nombre.length}/60 · Enter para guardar · Esc para cancelar</p>
                    </div>

                    {/* Descripción */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Descripción (opcional)</label>
                      <input
                        value={editForm.descripcion}
                        onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                        placeholder="Qué hace el cliente en esta etapa..."
                        className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#4449AA] bg-white transition-colors"
                        maxLength={120}
                      />
                    </div>

                    {/* Color + Final + Responsable en fila */}
                    <div className="grid grid-cols-3 gap-4">

                      {/* Color */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Color</label>
                        <div className="flex flex-wrap gap-2.5">
                          {COLOR_OPTIONS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditForm(f => ({ ...f, color: c }))}
                              className={`w-7 h-7 rounded-full transition-all ${editForm.color === c ? 'ring-3 ring-offset-2 ring-gray-500 scale-110' : 'hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-gray-300'}`}
                              style={{ background: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Responsable */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Responsable</label>
                        <select
                          value={editForm.assigned_to ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value || null }))}
                          className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[#4449AA] text-gray-700 cursor-pointer"
                        >
                          <option value="">Sin responsable</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                          ))}
                        </select>
                      </div>

                      {/* Etapa final */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Etapa final</label>
                        <button
                          type="button"
                          onClick={() => setEditForm(f => ({ ...f, es_final: !f.es_final }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all w-full ${
                            editForm.es_final
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          <CheckCircle2 className={`w-4 h-4 ${editForm.es_final ? 'text-emerald-500' : 'text-gray-300'}`} />
                          {editForm.es_final ? 'Sí, es final' : 'No es final'}
                        </button>
                      </div>
                    </div>

                    {/* Botones guardar / cancelar */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveEdit(stage.id)}
                          disabled={saving || !editForm.nombre.trim()}
                          className="flex items-center gap-2 px-5 py-2.5 bg-[#4449AA] text-white rounded-xl text-sm font-bold hover:bg-[#3338a0] disabled:opacity-60 transition-all shadow-sm"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Guardar cambios
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                      {/* Zona de peligro */}
                      <button
                        onClick={() => handleDeleteStage(stage)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                        title="Eliminar esta etapa permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar etapa
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Panel de documentos ────────────────────── */}
                {isDocExpanded && !isEditing && (
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

                    <div className="space-y-1.5">
                      {stageDocs.map(dt => {
                        const isEditingDoc = editingDocId === dt.id;
                        return (
                          <div key={dt.id} className={`rounded-xl border transition-all ${
                            isEditingDoc
                              ? 'bg-blue-50/60 border-[#4449AA]/20 p-3'
                              : 'flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 border-transparent group'
                          }`}>
                            {isEditingDoc ? (
                              /* ── Modo edición inline ── */
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    value={editDocForm.nombre}
                                    onChange={e => setEditDocForm(f => ({ ...f, nombre: e.target.value }))}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleUpdateDocType(dt.id);
                                      if (e.key === 'Escape') setEditingDocId(null);
                                    }}
                                    placeholder="Nombre del documento"
                                    className="flex-1 text-xs font-semibold border-2 border-[#4449AA]/30 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#4449AA] bg-white transition-colors"
                                  />
                                  <input
                                    value={editDocForm.descripcion}
                                    onChange={e => setEditDocForm(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Descripción (opcional)"
                                    className="w-36 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#4449AA] bg-white"
                                  />
                                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer flex-shrink-0 select-none">
                                    <input
                                      type="checkbox"
                                      checked={editDocForm.requerido}
                                      onChange={e => setEditDocForm(f => ({ ...f, requerido: e.target.checked }))}
                                      className="accent-[#4449AA]"
                                    />
                                    Req.
                                  </label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleUpdateDocType(dt.id)}
                                    className="flex items-center gap-1 px-3 py-1 bg-[#4449AA] text-white rounded-lg text-xs font-bold hover:bg-[#3338a0] transition-all"
                                  >
                                    <Save className="w-3 h-3" /> Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingDocId(null)}
                                    className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Modo lectura ── */
                              <>
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
                                  onClick={() => openEditDoc(dt)}
                                  className="p-0.5 text-gray-300 hover:text-[#4449AA] transition-colors opacity-0 group-hover:opacity-100"
                                  title="Editar documento"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocType(dt.id)}
                                  className="p-0.5 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Eliminar documento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Agregar doc */}
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

      {/* ── Términos y Condiciones ───────────────────────────── */}
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
          <strong>Cómo editar:</strong> Haz click en <strong>✏️ Editar</strong> en cualquier etapa para cambiar el nombre, descripción, color, responsable o si es la etapa final.
          El panel de edición se abre debajo — el cursor va directo al nombre. Presiona <strong>Enter</strong> para guardar o <strong>Esc</strong> para cancelar.
        </p>
      </div>
    </div>
  );
}
