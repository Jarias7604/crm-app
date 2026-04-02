import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { clientStageCommentsService } from '../../services/clients';
import type { ClientStageComment } from '../../types/clients';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

interface Props {
  clientId: string;
  stageId: string;
  stageName: string;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  if (diffDay < 7) return `hace ${diffDay}d`;
  return date.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
}

function getInitials(name: string | null | undefined, email: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0].toUpperCase();
}

export default function StageComments({ clientId, stageId, stageName }: Props) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<ClientStageComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    clientStageCommentsService
      .list(clientId, stageId)
      .then(setComments)
      .catch(() => toast.error('Error cargando comentarios'))
      .finally(() => setLoading(false));
  }, [clientId, stageId, open]);

  // Scroll al final cuando hay nuevos comentarios
  useEffect(() => {
    if (listRef.current && comments.length > 0) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!text.trim() || !profile?.id || !profile?.company_id) return;
    setSending(true);
    try {
      const newComment = await clientStageCommentsService.add(
        clientId,
        stageId,
        profile.company_id,
        profile.id,
        text.trim()
      );
      setComments(prev => [...prev, newComment]);
      setText('');
      textareaRef.current?.focus();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeleting(commentId);
    try {
      await clientStageCommentsService.remove(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      toast.error('Error al eliminar comentario');
    } finally {
      setDeleting(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canDelete = (comment: ClientStageComment) =>
    comment.created_by === profile?.id ||
    (profile?.role as any) === 'admin' ||
    (profile?.role as any) === 'super_admin';

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#4449AA] transition-colors w-full"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Comentarios de etapa</span>
        {comments.length > 0 && !open && (
          <span className="ml-1 bg-[#4449AA] text-white rounded-full px-1.5 py-0.5 text-[10px]">
            {comments.length}
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          {open ? '▲ cerrar' : '▼ ver'}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Lista de comentarios */}
          <div
            ref={listRef}
            className="max-h-48 overflow-y-auto space-y-2 pr-1"
          >
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-3">
                Sin comentarios aún. Sé el primero en comentar.
              </p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-2 group">
                  {/* Avatar */}
                  {c.author?.avatar_url ? (
                    <img
                      src={c.author.avatar_url}
                      alt={c.author.full_name || ''}
                      className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5 object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#4449AA] text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                      {getInitials(c.author?.full_name, c.author?.email || '?')}
                    </div>
                  )}

                  {/* Burbuja */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-gray-700 truncate">
                        {c.author?.full_name || c.author?.email || 'Usuario'}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatTime(c.created_at)}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-2.5 py-1.5 flex-1 whitespace-pre-wrap break-words">
                        {c.comment}
                      </p>
                      {canDelete(c) && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting === c.id}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                        >
                          {deleting === c.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input de nuevo comentario */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Comentar en "${stageName}"... (Ctrl+Enter para enviar)`}
              rows={2}
              className="flex-1 text-xs resize-none rounded-lg border border-gray-200 px-2.5 py-2 
                         focus:outline-none focus:ring-2 focus:ring-[#4449AA]/30 focus:border-[#4449AA]
                         placeholder:text-gray-300 text-gray-700 leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#4449AA] text-white text-xs font-semibold
                         hover:bg-[#3338a0] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              {sending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
            </button>
          </div>
          <p className="text-[10px] text-gray-300">Ctrl+Enter para enviar rápido</p>
        </div>
      )}
    </div>
  );
}
