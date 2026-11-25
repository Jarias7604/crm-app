import React, { useState, useRef, memo, forwardRef, useImperativeHandle } from 'react';
import { Plus, Loader2, Zap, Pencil, StickyNote, Send, Paperclip, CornerUpLeft, X } from 'lucide-react';
import type { WaScope } from '../../../lib/whatsappScopes';
import type { QuickReplyTemplate } from './types';

export interface ChatComposerHandle {
  setDraft: (text: string, mode?: 'whatsapp' | 'internal') => void;
}

export interface ChatComposerProps {
  canSend: boolean;
  scope: WaScope;
  sendingMessage: boolean;
  uploadingFile: boolean;
  activeQuickReplies: QuickReplyTemplate[];
  replyingTo?: { id: string; senderName: string; text: string } | null;
  onCancelReply?: () => void;
  onSendWhatsApp: (text: string) => Promise<boolean>;
  onSaveInternalNote: (text: string) => Promise<boolean>;
  onUploadAttachment: (file: File, caption: string) => Promise<boolean>;
  onOpenNewQuickReply: () => void;
  onEditQuickReply: (q: QuickReplyTemplate) => void;
  onNavigateTickets: () => void;
}

export const ChatComposer = memo(
  forwardRef<ChatComposerHandle, ChatComposerProps>(
    (
      {
        canSend,
        scope,
        sendingMessage,
        uploadingFile,
        activeQuickReplies,
        replyingTo,
        onCancelReply,
        onSendWhatsApp,
        onSaveInternalNote,
        onUploadAttachment,
        onOpenNewQuickReply,
        onEditQuickReply,
        onNavigateTickets,
      },
      ref,
    ) => {
      const [messageInput, setMessageInput] = useState('');
      const [composerMode, setComposerMode] = useState<'whatsapp' | 'internal'>('whatsapp');
      const [showQuickRepliesPopover, setShowQuickRepliesPopover] = useState(false);
      const [showMobileAttachMenu, setShowMobileAttachMenu] = useState(false);
      const fileInputRef = useRef<HTMLInputElement>(null);
      const textareaRef = useRef<HTMLTextAreaElement>(null);

      useImperativeHandle(
        ref,
        () => ({
          setDraft: (text: string, mode?: 'whatsapp' | 'internal') => {
            if (mode) setComposerMode(mode);
            setMessageInput(text);
            requestAnimationFrame(() => textareaRef.current?.focus());
          },
        }),
        [],
      );

      const handleSubmit = async () => {
        const trimmed = messageInput.trim();
        if (!trimmed || sendingMessage) return;
        setMessageInput('');
        if (composerMode === 'internal') {
          const ok = await onSaveInternalNote(trimmed);
          if (ok) setComposerMode('whatsapp');
          else setMessageInput(trimmed);
        } else {
          const ok = await onSendWhatsApp(trimmed);
          if (!ok) setMessageInput(trimmed);
        }
      };

      const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const caption = messageInput.trim();
        const ok = await onUploadAttachment(file, caption);
        if (ok) setMessageInput('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      if (!canSend) {
        return (
          <div className="bg-white px-5 py-3 border-t border-slate-200/70 text-center text-[11px] font-semibold text-slate-400">
            {scope === 'spam' ? (
              'Este número está marcado como spam.'
            ) : (
              <>
                Este ticket no vino por WhatsApp.{' '}
                <button type="button" onClick={onNavigateTickets} className="text-indigo-600 font-bold underline">
                  Gestionarlo en Tickets
                </button>
              </>
            )}
          </div>
        );
      }

      return (
        <div
          className={`border-t transition-colors relative shrink-0 ${
            composerMode === 'internal' ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200/70'
          }`}
        >
          {/* Reply Context Preview Bar */}
          {replyingTo && composerMode === 'whatsapp' && (
            <div className="px-3 md:px-5 py-1.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 border-l-2 border-indigo-600 pl-2">
                <CornerUpLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-indigo-700 leading-tight truncate">
                    Respondiendo a {replyingTo.senderName}
                  </p>
                  <p className="text-[11.5px] text-slate-500 truncate">{replyingTo.text}</p>
                </div>
              </div>
              {onCancelReply && (
                <button
                  type="button"
                  onClick={onCancelReply}
                  title="Cancelar respuesta"
                  className="w-6 h-6 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="px-2.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-5 md:py-3 flex items-end gap-2 relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Mobile Single (+) Menu Button */}
            <button
              type="button"
              onClick={() => {
                setShowMobileAttachMenu((v) => !v);
                setShowQuickRepliesPopover(false);
              }}
              disabled={uploadingFile}
              title="Adjuntar, plantilla o nota"
              className={`md:hidden w-10 h-10 rounded-full border flex items-center justify-center transition shrink-0 disabled:opacity-50 ${
                showMobileAttachMenu
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 text-slate-600 border-slate-200/80'
              }`}
            >
              {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>

            {showMobileAttachMenu && (
              <div className="md:hidden absolute left-2.5 right-2.5 bottom-full mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-2.5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileAttachMenu(false);
                    setComposerMode('whatsapp');
                    fileInputRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 active:bg-indigo-50 text-slate-700"
                >
                  <Paperclip className="w-4 h-4 text-indigo-600" />
                  <span className="text-[11px] font-semibold">Archivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileAttachMenu(false);
                    setComposerMode('whatsapp');
                    setShowQuickRepliesPopover(true);
                  }}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 active:bg-indigo-50 text-slate-700"
                >
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span className="text-[11px] font-semibold">Plantilla</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileAttachMenu(false);
                    setComposerMode((m) => (m === 'whatsapp' ? 'internal' : 'whatsapp'));
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${
                    composerMode === 'internal'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  <StickyNote className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">
                    {composerMode === 'internal' ? 'Modo WA' : 'Nota CRM'}
                  </span>
                </button>
              </div>
            )}

            {/* Desktop Attach Button */}
            {composerMode === 'whatsapp' && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title="Enviar imagen, documento o archivo"
                className="hidden md:flex w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 hover:bg-slate-100 items-center justify-center transition shrink-0 disabled:opacity-50"
              >
                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            )}

            {/* Quick Replies Popover Wrapper (button visible on desktop; popover usable on mobile via +) */}
            {composerMode === 'whatsapp' && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuickRepliesPopover((v) => !v)}
                  title="Respuestas rápidas y plantillas"
                  className={`hidden md:inline-flex px-3.5 py-2.5 rounded-xl text-[13px] font-semibold items-center gap-1.5 border transition ${
                    showQuickRepliesPopover
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>Plantillas</span>
                </button>
                {showQuickRepliesPopover && (
                  <div className="fixed inset-x-3 bottom-[72px] md:inset-x-auto md:absolute md:left-0 md:bottom-full md:mb-2 md:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-2 space-y-1">
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {scope === 'lead' || scope === 'por_clasificar' ? 'Plantillas de Ventas' : 'Plantillas de Soporte'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickRepliesPopover(false);
                            onOpenNewQuickReply();
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          Nueva / Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickRepliesPopover(false)}
                          className="md:hidden p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                      {activeQuickReplies.map((q) => (
                        <div
                          key={q.id}
                          className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 transition flex items-start justify-between gap-2 group"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setMessageInput(q.text);
                              setShowQuickRepliesPopover(false);
                              requestAnimationFrame(() => textareaRef.current?.focus());
                            }}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="text-[13px] font-semibold text-slate-800">{q.label}</p>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{q.text}</p>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowQuickRepliesPopover(false);
                              onEditQuickReply(q);
                            }}
                            title="Editar esta plantilla"
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Desktop Internal Note Toggle */}
            <button
              type="button"
              onClick={() => setComposerMode((m) => (m === 'whatsapp' ? 'internal' : 'whatsapp'))}
              title={
                composerMode === 'internal'
                  ? 'Modo Nota Interna activo (el cliente NO recibe este mensaje). Clic para volver a WhatsApp.'
                  : 'Cambiar a Nota Interna para dejar instrucciones al equipo dentro del chat'
              }
              className={`hidden md:inline-flex px-3.5 py-2.5 rounded-xl text-[13px] font-semibold items-center gap-1.5 shrink-0 border transition ${
                composerMode === 'internal'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
              }`}
            >
              <StickyNote className="w-4 h-4" />
              <span>{composerMode === 'internal' ? 'Nota interna' : 'Nota'}</span>
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                composerMode === 'internal'
                  ? 'Nota interna para el equipo (no se envía a WhatsApp)…'
                  : 'Escribe un mensaje…'
              }
              className={`flex-1 resize-none max-h-28 md:max-h-32 px-3.5 md:px-4 py-2 md:py-2.5 rounded-2xl md:rounded-xl text-[16px] md:text-[14.5px] font-medium focus:outline-none focus:ring-2 transition ${
                composerMode === 'internal'
                  ? 'bg-white border-2 border-amber-300 text-amber-950 placeholder:text-amber-700/60 focus:ring-amber-500/20'
                  : 'bg-slate-100 md:bg-slate-50 border border-slate-200/80 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-500/20'
              }`}
            />
            <button
              type="button"
              disabled={!messageInput.trim() || sendingMessage}
              onClick={handleSubmit}
              className={`inline-flex items-center justify-center gap-1.5 w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-full md:rounded-xl disabled:opacity-40 text-white text-[13px] font-bold transition shrink-0 ${
                composerMode === 'internal' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {composerMode === 'internal' ? <StickyNote className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {composerMode === 'internal' && <span className="hidden sm:inline">Guardar nota</span>}
            </button>
          </div>
        </div>
      );
    },
  ),
);
ChatComposer.displayName = 'ChatComposer';
