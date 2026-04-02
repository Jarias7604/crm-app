import { useState, useRef } from 'react';
import { Upload, File, Trash2, Download, CheckCircle2, Circle, Loader2, X } from 'lucide-react';
import { clientDocumentsService } from '../../services/clients';
import type { Client, ClientPipelineStage, ClientDocument, ClientStageDocumentType } from '../../types/clients';
import { useAuth } from '../../auth/AuthProvider';
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

  const stageDocs = documents.filter(d => d.stage_id === stage.id);

  const docsByType = stage.document_types.reduce<Record<string, ClientDocument[]>>((acc, dt) => {
    acc[dt.id] = stageDocs.filter(d => d.doc_type_id === dt.id);
    return acc;
  }, {});

  const handleUpload = async (file: File, docTypeId: string) => {
    if (!profile?.company_id) return;
    setUploading(docTypeId);
    try {
      await clientDocumentsService.upload(
        client.id,
        profile.company_id,
        stage.id,
        docTypeId,
        file,
        false
      );
      toast.success('✅ Documento subido');
      onDocumentUploaded();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      const url = await clientDocumentsService.getSignedUrl(doc.file_path);
      window.open(url, '_blank');
    } catch {
      toast.error('No se pudo descargar el archivo');
    }
  };

  const handleDelete = async (doc: ClientDocument) => {
    try {
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
        const isFilled = uploaded.length > 0;

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
                  <p className="text-sm font-semibold text-gray-800">{dt.nombre}
                    {dt.requerido && <span className="ml-1 text-red-400 text-xs">*</span>}
                  </p>
                  {dt.descripcion && <p className="text-xs text-gray-400 mt-0.5">{dt.descripcion}</p>}
                </div>
              </div>

              {!readOnly && (
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
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Upload className="w-3 h-3" />
                    }
                    Subir
                  </button>
                </div>
              )}
            </div>

            {/* Uploaded files */}
            {uploaded.length > 0 && (
              <div className="mt-2 space-y-1.5 pl-6">
                {uploaded.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-gray-100">
                    <File className="w-3.5 h-3.5 text-[#4449AA] flex-shrink-0" />
                    <span className="text-xs text-gray-700 font-medium truncate flex-1">{doc.nombre}</span>
                    {doc.file_size && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {(doc.file_size / 1024).toFixed(0)} KB
                      </span>
                    )}
                    <button onClick={() => handleDownload(doc)} className="p-0.5 text-gray-400 hover:text-[#4449AA]">
                      <Download className="w-3 h-3" />
                    </button>
                    {!readOnly && (
                      <button onClick={() => handleDelete(doc)} className="p-0.5 text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
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
        <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-white">
          <File className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-600 flex-1 truncate">{doc.nombre}</span>
          <button onClick={() => handleDownload(doc)} className="text-gray-400 hover:text-[#4449AA]">
            <Download className="w-3.5 h-3.5" />
          </button>
          {!readOnly && (
            <button onClick={() => handleDelete(doc)} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
