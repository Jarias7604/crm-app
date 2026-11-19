import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { QuickReplyTemplate } from '../types';

export interface QuickReplyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReplies: QuickReplyTemplate[];
  onSaveQuickReplies: (next: QuickReplyTemplate[]) => void;
  initialScope: 'soporte' | 'ventas';
  initialEditingReply: QuickReplyTemplate | null;
}

export const QuickReplyManagerModal: React.FC<QuickReplyManagerModalProps> = ({
  isOpen,
  onClose,
  quickReplies,
  onSaveQuickReplies,
  initialScope,
  initialEditingReply,
}) => {
  const [scope, setScope] = useState<'soporte' | 'ventas'>(initialScope);
  const [editingQrId, setEditingQrId] = useState<string | null>(initialEditingReply?.id || null);
  const [label, setLabel] = useState(initialEditingReply?.label || '');
  const [text, setText] = useState(initialEditingReply?.text || '');

  useEffect(() => {
    if (!isOpen) return;
    if (initialEditingReply) {
      setScope(initialEditingReply.scope);
      setEditingQrId(initialEditingReply.id);
      setLabel(initialEditingReply.label);
      setText(initialEditingReply.text);
    } else {
      setScope(initialScope);
      setEditingQrId(null);
      setLabel('');
      setText('');
    }
  }, [isOpen, initialScope, initialEditingReply]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Plantillas de Respuesta Rápida</h3>
            <p className="text-xs text-slate-500">Adapta las respuestas en 1 clic al giro de tu empresa (Ventas y Soporte).</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('ventas')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
              scope === 'ventas' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ventas / Leads
          </button>
          <button
            type="button"
            onClick={() => setScope('soporte')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
              scope === 'soporte' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Soporte / Clientes
          </button>
        </div>

        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase text-slate-500">
              {editingQrId ? 'Editar plantilla' : `Nueva plantilla (${scope === 'ventas' ? 'Ventas' : 'Soporte'})`}
            </p>
            {editingQrId && (
              <button
                type="button"
                onClick={() => {
                  setEditingQrId(null);
                  setLabel('');
                  setText('');
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
              >
                Cancelar edición
              </button>
            )}
          </div>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Título corto del botón (ej. Enviar Catálogo, Pedir Requisitos)"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
          />
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto completo que se escribirá en el chat al hacer clic..."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
          />
          <button
            type="button"
            disabled={!label.trim() || !text.trim()}
            onClick={() => {
              if (editingQrId) {
                const updated = quickReplies.map((q) =>
                  q.id === editingQrId ? { ...q, scope, label: label.trim(), text: text.trim() } : q,
                );
                onSaveQuickReplies(updated);
                setEditingQrId(null);
                setLabel('');
                setText('');
                toast.success('Plantilla actualizada');
              } else {
                const item: QuickReplyTemplate = {
                  id: `custom-${Date.now()}`,
                  scope,
                  label: label.trim(),
                  text: text.trim(),
                };
                onSaveQuickReplies([...quickReplies, item]);
                setLabel('');
                setText('');
                toast.success('Plantilla agregada');
              }
            }}
            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition"
          >
            {editingQrId ? 'Guardar cambios' : 'Guardar plantilla'}
          </button>
        </div>

        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          {quickReplies
            .filter((q) => q.scope === scope)
            .map((q) => {
              const isEditingThis = editingQrId === q.id;
              return (
                <div
                  key={q.id}
                  className={`px-3.5 py-2.5 flex items-start justify-between gap-2 ${isEditingThis ? 'bg-indigo-50/70' : ''}`}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900">{q.label}</span>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQrId(q.id);
                        setScope(q.scope);
                        setLabel(q.label);
                        setText(q.text);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingQrId === q.id) {
                          setEditingQrId(null);
                          setLabel('');
                          setText('');
                        }
                        onSaveQuickReplies(quickReplies.filter((x) => x.id !== q.id));
                        toast.success('Plantilla eliminada');
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
