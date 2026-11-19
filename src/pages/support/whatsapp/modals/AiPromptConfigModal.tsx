import React from 'react';
import {
  Sparkles,
  X,
  RefreshCw,
  MessageSquare,
  Mic,
  Wrench,
  Calculator,
  DollarSign,
  Package,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';
import type { SupportChannelType, SupportCircle } from '../types';
import {
  DEFAULT_RESOLVED_REPLY_TEMPLATE,
  DEFAULT_RESOLVED_TRIGGER_PHRASES,
  renderResolvedReplyTemplate,
} from '../helpers';

export interface AiPromptConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  openAiStatus: { checking: boolean; verified: boolean; model: string; error: string };
  onTestOpenAi: () => void;
  aiAutoReplyText: boolean;
  onChangeAiAutoReplyText: (val: boolean) => void;
  aiAutoReplyAudio: boolean;
  onChangeAiAutoReplyAudio: (val: boolean) => void;
  activePromptTab: SupportChannelType | 'ya_resolvimos';
  onChangeActivePromptTab: (tab: SupportChannelType | 'ya_resolvimos') => void;
  aiPrompts: Record<SupportChannelType, string>;
  onChangeAiPrompt: (tab: SupportChannelType, value: string) => void;
  autoReplyResolvedEnabled: boolean;
  onChangeAutoReplyResolvedEnabled: (val: boolean) => void;
  autoResolvedMarkLost: boolean;
  onChangeAutoResolvedMarkLost: (val: boolean) => void;
  resolvedReplyTemplate: string;
  onChangeResolvedReplyTemplate: (val: string) => void;
  resolvedTriggerPhrasesText: string;
  onChangeResolvedTriggerPhrasesText: (val: string) => void;
  parsedResolvedTriggerPhrases: string[];
  showTriggerPhrasesEditor: boolean;
  onToggleTriggerPhrasesEditor: () => void;
  pendingResolvedCircles: SupportCircle[];
  selectedPendingResolvedIds: string[];
  onToggleAllPendingResolved: () => void;
  onTogglePendingResolvedId: (circleId: string, checked: boolean) => void;
  sendingBatchResolved: boolean;
  batchResolvedProgress: { current: number; total: number };
  onSendBatchResolvedReplies: () => void;
  savingAiConfig: boolean;
  onSaveConfig: () => Promise<void>;
}

export const AiPromptConfigModal: React.FC<AiPromptConfigModalProps> = ({
  isOpen,
  onClose,
  openAiStatus,
  onTestOpenAi,
  aiAutoReplyText,
  onChangeAiAutoReplyText,
  aiAutoReplyAudio,
  onChangeAiAutoReplyAudio,
  activePromptTab,
  onChangeActivePromptTab,
  aiPrompts,
  onChangeAiPrompt,
  autoReplyResolvedEnabled,
  onChangeAutoReplyResolvedEnabled,
  autoResolvedMarkLost,
  onChangeAutoResolvedMarkLost,
  resolvedReplyTemplate,
  onChangeResolvedReplyTemplate,
  resolvedTriggerPhrasesText,
  onChangeResolvedTriggerPhrasesText,
  parsedResolvedTriggerPhrases,
  showTriggerPhrasesEditor,
  onToggleTriggerPhrasesEditor,
  pendingResolvedCircles,
  selectedPendingResolvedIds,
  onToggleAllPendingResolved,
  onTogglePendingResolvedId,
  sendingBatchResolved,
  batchResolvedProgress,
  onSendBatchResolvedReplies,
  savingAiConfig,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-black text-slate-900">IA por categoría (texto y notas de voz)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border ${
            openAiStatus.checking
              ? 'bg-slate-50 border-slate-200 text-slate-700'
              : openAiStatus.verified
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                openAiStatus.checking ? 'bg-amber-400 animate-pulse' : openAiStatus.verified ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>
              {openAiStatus.checking
                ? 'Verificando conexión con OpenAI...'
                : openAiStatus.verified
                ? `OpenAI conectado (${openAiStatus.model} + Whisper)`
                : `OpenAI error: ${openAiStatus.error || 'Sin conexión'}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onTestOpenAi}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-black text-slate-700 transition"
          >
            <RefreshCw className="w-3 h-3" />
            Probar
          </button>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Las notas de voz siempre se transcriben. Las respuestas automáticas están <strong>apagadas</strong> salvo que las actives aquí; nunca se
          responde a Equipo ni a Spam.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aiAutoReplyText}
              onChange={(e) => onChangeAiAutoReplyText(e.target.checked)}
              className="rounded border-slate-300 text-purple-600"
            />
            <MessageSquare className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="text-xs font-black text-slate-800">Responder mensajes de texto</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aiAutoReplyAudio}
              onChange={(e) => onChangeAiAutoReplyAudio(e.target.checked)}
              className="rounded border-slate-300 text-purple-600"
            />
            <Mic className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="text-xs font-black text-slate-800">Responder notas de voz</span>
          </label>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'soporte', label: 'Soporte técnico', icon: Wrench },
                { id: 'contabilidad', label: 'Contabilidad / IVA', icon: Calculator },
                { id: 'ventas', label: 'Ventas / Leads', icon: DollarSign },
                { id: 'otros', label: 'Otros', icon: Package },
              ] as { id: SupportChannelType; label: string; icon: React.ElementType }[]
            ).map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeActivePromptTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                    activePromptTab === tab.id ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onChangeActivePromptTab('ya_resolvimos')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                activePromptTab === 'ya_resolvimos'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Cierre "Ya resolvimos"</span>
              {pendingResolvedCircles.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activePromptTab === 'ya_resolvimos' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {pendingResolvedCircles.length}
                </span>
              )}
            </button>
          </div>

          {activePromptTab !== 'ya_resolvimos' ? (
            <textarea
              rows={5}
              value={aiPrompts[activePromptTab]}
              onChange={(e) => onChangeAiPrompt(activePromptTab, e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          ) : (
            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReplyResolvedEnabled}
                    onChange={(e) => onChangeAutoReplyResolvedEnabled(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      Responder automáticamente cuando un lead diga "Ya resolvimos"
                    </span>
                    <span className="text-[11px] text-slate-600 leading-snug block">
                      Funciona de forma independiente aunque la IA general esté apagada. Solo responde a cierres cortos sin preguntas ni solicitud de precios.
                    </span>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer pt-1 border-t border-emerald-200/60">
                  <input
                    type="checkbox"
                    checked={autoResolvedMarkLost}
                    onChange={(e) => onChangeAutoResolvedMarkLost(e.target.checked)}
                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Mover automáticamente el prospecto a "Perdido" al responder (limpia Interesados)
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800">Mensaje dinámico de cierre amable</label>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Variables: <code className="text-emerald-700 font-bold">{'{nombre}'}</code> y <code className="text-emerald-700 font-bold">{'{empresa}'}</code>
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={resolvedReplyTemplate}
                  onChange={(e) => onChangeResolvedReplyTemplate(e.target.value)}
                  placeholder={DEFAULT_RESOLVED_REPLY_TEMPLATE}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span className="truncate max-w-[360px]" title={renderResolvedReplyTemplate(resolvedReplyTemplate, 'Julio Hernández')}>
                    Ej: <strong className="text-slate-700">{renderResolvedReplyTemplate(resolvedReplyTemplate, 'Julio Hernández')}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={onToggleTriggerPhrasesEditor}
                    className="text-emerald-700 hover:text-emerald-800 font-bold shrink-0 underline"
                  >
                    {showTriggerPhrasesEditor ? 'Ocultar frases' : `Frases que activan (${parsedResolvedTriggerPhrases.length})`}
                  </button>
                </div>
              </div>

              {showTriggerPhrasesEditor && (
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700">
                      Frases clave separadas por coma (personalizable por empresa):
                    </span>
                    <button
                      type="button"
                      onClick={() => onChangeResolvedTriggerPhrasesText(DEFAULT_RESOLVED_TRIGGER_PHRASES.join(', '))}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                    >
                      Restaurar por defecto
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={resolvedTriggerPhrasesText}
                    onChange={(e) => onChangeResolvedTriggerPhrasesText(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] text-slate-700 bg-white focus:outline-none"
                  />
                </div>
              )}

              {pendingResolvedCircles.length > 0 ? (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-950">
                      Pendientes sin contestar en bandeja ({pendingResolvedCircles.length})
                    </span>
                    <button type="button" onClick={onToggleAllPendingResolved} className="text-[11px] font-bold text-amber-800 hover:underline">
                      {selectedPendingResolvedIds.length === pendingResolvedCircles.length ? 'Desmarcar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {pendingResolvedCircles.map((c) => {
                      const checked = selectedPendingResolvedIds.includes(c.circleId);
                      return (
                        <label
                          key={c.circleId}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-amber-200/60 cursor-pointer hover:bg-amber-50/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => onTogglePendingResolvedId(c.circleId, e.target.checked)}
                              className="rounded border-amber-300 text-emerald-600 shrink-0"
                            />
                            <span className="text-xs font-black text-slate-800 truncate max-w-[130px]">{c.clientName}</span>
                            <span className="text-[11px] text-slate-500 truncate">"{c.lastMessageText}"</span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-700 shrink-0">
                            {c.waitMinutes >= 60 ? `${Math.floor(c.waitMinutes / 60)}h` : `${c.waitMinutes}m`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={sendingBatchResolved || selectedPendingResolvedIds.length === 0}
                    onClick={onSendBatchResolvedReplies}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    {sendingBatchResolved ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          Respondiendo {batchResolvedProgress.current}/{batchResolvedProgress.total}...
                        </span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          Responder y cerrar {selectedPendingResolvedIds.length} pendiente
                          {selectedPendingResolvedIds.length === 1 ? '' : 's'} ahora
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>No hay chats pendientes con "Ya resolvimos" sin contestar en este momento.</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            disabled={savingAiConfig}
            onClick={onSaveConfig}
            className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {savingAiConfig ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};
