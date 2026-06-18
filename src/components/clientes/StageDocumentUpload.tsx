import { useState, useRef, useEffect } from 'react';
import { Upload, File, Trash2, Download, CheckCircle2, Circle, Loader2, X, Save, Pencil } from 'lucide-react';
import { clientDocumentsService } from '../../services/clients';
import type { Client, ClientPipelineStage, ClientDocument, ClientStageDocumentType } from '../../types/clients';
import { useAuth } from '../../auth/AuthProvider';
import StageComments from './StageComments';
import toast from 'react-hot-toast';

interface Props {
  stage: ClientPipelineStage & { document_types: ClientStageDocumentType[] };
  client: Client;
  documents: ClientDocument[];
  onDocumentUploaded: () => void;
  readOnly?: boolean;
}

export default function StageDocumentUpload({ stage, client, documents, onDocumentUploaded, readOnly = false }: Props) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [savingText, setSavingText] = useState<Record<string, boolean>>({});
  const [editingTexts, setEditingTexts] = useState<Record<string, boolean>>({});

  const stageDocs = documents.filter(d => d.stage_id === stage.id);

  const docsByType = stage.document_types.reduce<Record<string, ClientDocument[]>>((acc, dt) => {
    acc[dt.id] = stageDocs.filter(d => d.doc_type_id === dt.id);
    return acc;
  }, {});

  // Sync text fields with documents from DB
  useEffect(() => {
    const vals: Record<string, string> = {};
    stage.document_types.forEach(dt => {
      const doc = stageDocs.find(d => d.doc_type_id === dt.id);
      vals[dt.id] = doc?.valor_texto || '';
    });
    setTextValues(vals);
  }, [documents, stage.document_types, stage.id]);

  const handleUpload = async (file: File, docTypeId: string) => {
    if (!profile?.company_id) return;
    setUploading(docTypeId);
    const doc = stageDocs.find(d => d.doc_type_id === docTypeId);
    try {
      await clientDocumentsService.upload(
        client.id,
        profile.company_id,
        stage.id,
        docTypeId,
        file,
        false,
        doc?.id
      );
      toast.success('✅ Documento subido');
      onDocumentUploaded();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleSaveText = async (docTypeId: string, value: string) => {
    if (!profile?.company_id) return;
    setSavingText(prev => ({ ...prev, [docTypeId]: true }));
    const doc = stageDocs.find(d => d.doc_type_id === docTypeId);
    try {
      await clientDocumentsService.saveTextResponse(
        client.id,
        profile.company_id,
        stage.id,
        docTypeId,
        value,
        doc?.id,
        false
      );
      toast.success('✅ Respuesta guardada');
      setEditingTexts(prev => ({ ...prev, [docTypeId]: false }));
      onDocumentUploaded();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSavingText(prev => ({ ...prev, [docTypeId]: false }));
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      if (!doc.file_path) {
        toast.error('No hay archivo disponible para descargar');
        return;
      }
      const url = await clientDocumentsService.getSignedUrl(doc.file_path);
      window.open(url, '_blank');
    } catch {
      toast.error('No se pudo descargar el archivo');
    }
  };

  const handleDelete = async (doc: ClientDocument) => {
    try {
      if (!doc.file_path) {
        toast.error('No hay archivo disponible para eliminar');
        return;
      }
      await clientDocumentsService.delete(doc.id, doc.file_path);
      toast.success('🗑️ Documento eliminado');
      onDocumentUploaded();
    } catch (err: any) {
      console.error('Error al eliminar documento:', err);
      toast.error(`Error al eliminar: ${err?.message || 'intenta de nuevo'}`);
    }
  };

  return (
    <div className="space-y-4">
      {stage.document_types.length === 0 && (
        <p className="text-sm text-gray-400 italic">Sin tipos de documentos configurados para esta etapa.</p>
      )}

      {stage.document_types.map(dt => {
        const uploaded = docsByType[dt.id] || [];
        const reqDoc = dt.requiere_documento ?? true;
        const reqTxt = dt.requiere_texto ?? false;
        const existingDoc = uploaded[0];
        const hasDoc = !!existingDoc?.file_path;
        const hasTxt = !!existingDoc?.valor_texto && existingDoc.valor_texto.trim() !== '';

        const isFilled = 
          reqDoc && reqTxt ? (hasDoc && hasTxt) :
          reqDoc ? hasDoc :
          reqTxt ? hasTxt : false;

        return (
          <div key={dt.id} className={`rounded-xl border p-3 transition-all ${
            isFilled ? 'border-emerald-200 bg-emerald-50/50' : dt.requerido ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50/50'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {isFilled
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                }
                <div>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 flex-wrap">
                    {dt.nombre}
                    {dt.requerido && <span className="text-red-400 text-xs">*</span>}
                    {reqTxt && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                        {reqDoc ? 'Archivo + Texto' : 'Solo Texto'}
                      </span>
                    )}
                  </p>
                  {dt.descripcion && <p className="text-xs text-gray-400 mt-0.5">{dt.descripcion}</p>}
                </div>
              </div>

              {!readOnly && reqDoc && (
                <div>
                  <input
                    ref={el => { fileRefs.current[dt.id] = el; }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, dt.id); e.target.value = ''; }}
                  />
                  <button
                    onClick={() => fileRefs.current[dt.id]?.click()}
                    disabled={uploading === dt.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#4449AA] text-white hover:bg-[#3338a0] disabled:opacity-60 transition-all"
                  >
                    {uploading === dt.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Upload className="w-3.5 h-3.5" />
                    }
                    Subir
                  </button>
                </div>
              )}
            </div>

            {/* Input de texto si es requerido */}
            {reqTxt && (
              <div className="mt-2.5 pl-6 space-y-2">
                {hasTxt && !editingTexts[dt.id] ? (
                  /* Modo Lectura / Guardado */
                  <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 mt-1">
                    <div className="flex-1 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed py-0.5">
                      {existingDoc?.valor_texto}
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => setEditingTexts(prev => ({ ...prev, [dt.id]: true }))}
                        className="p-1 rounded-lg text-gray-400 hover:text-[#4449AA] hover:bg-gray-200 transition-all flex-shrink-0"
                        title="Editar respuesta"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  /* Modo Edición */
                  <div className="flex items-end gap-2">
                    <textarea
                      disabled={readOnly}
                      value={textValues[dt.id] || ''}
                      onChange={e => setTextValues(prev => ({ ...prev, [dt.id]: e.target.value }))}
                      placeholder="Escribe el dato o texto solicitado aquí..."
                      rows={2}
                      className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 bg-white resize-none"
                    />
                    {!readOnly && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleSaveText(dt.id, textValues[dt.id] || '')}
                          disabled={savingText[dt.id] || (textValues[dt.id] || '').trim() === (existingDoc?.valor_texto || '')}
                          title="Guardar respuesta"
                          className="p-2 rounded-xl bg-[#4449AA] text-white hover:bg-[#3338a0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {savingText[dt.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {hasTxt && (
                          <button
                            onClick={() => {
                              setEditingTexts(prev => ({ ...prev, [dt.id]: false }));
                              setTextValues(prev => ({ ...prev, [dt.id]: existingDoc?.valor_texto || '' }));
                            }}
                            title="Cancelar"
                            className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {hasTxt && !editingTexts[dt.id] && (
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    ✓ Respuesta guardada
                  </p>
                )}
              </div>
            )}

            {/* Uploaded files */}
            {reqDoc && uploaded.filter(doc => doc.file_path).length > 0 && (
              <div className="mt-2 space-y-1.5 pl-6">
                {uploaded.filter(doc => doc.file_path).map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-gray-100">
                    <File className="w-3.5 h-3.5 text-[#4449AA] flex-shrink-0" />
                    <span className="text-xs text-gray-700 font-medium truncate flex-1">{doc.nombre}</span>
                    {doc.file_size && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {(doc.file_size / 1024).toFixed(0)} KB
                      </span>
                    )}
                    <button onClick={() => handleDownload(doc)} className="p-0.5 text-gray-400 hover:text-[#4449AA]">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {!readOnly && (
                      <button onClick={() => handleDelete(doc)} className="p-0.5 text-gray-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Docs generales (sin tipo definido) */}
      {stageDocs.filter(d => !d.doc_type_id).map(doc => (
        <div key={doc.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
          <File className="w-4 h-4 text-[#4449AA]" />
          <span className="text-xs text-gray-700 font-medium truncate flex-1">{doc.nombre}</span>
          <button onClick={() => handleDownload(doc)} className="p-1 text-gray-400 hover:text-[#4449AA]">
            <Download className="w-3.5 h-3.5" />
          </button>
          {!readOnly && (
            <button onClick={() => handleDelete(doc)} className="p-1 text-gray-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* SECCIÓN DE COMENTARIOS DE ETAPA */}
      <StageComments 
        clientId={client.id} 
        stageId={stage.id} 
        stageName={stage.nombre} 
      />
    </div>
  );
}
