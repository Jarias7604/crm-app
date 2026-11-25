import React from 'react';
import { X, RefreshCw, QrCode, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface BridgeStatusModalProps {
  isOpen: boolean;
  bridgeStatus: Record<string, any> | null;
  onClose: () => void;
  onRefresh?: () => void;
  onReconnect?: () => Promise<void> | void;
  reconnecting?: boolean;
  isAdmin?: boolean;
}

export const BridgeStatusModal: React.FC<BridgeStatusModalProps> = ({
  isOpen,
  bridgeStatus,
  onClose,
  onRefresh,
  onReconnect,
  reconnecting = false,
  isAdmin = false,
}) => {
  if (!isOpen) return null;

  const waState = String(bridgeStatus?.evo_connection_state || '').toLowerCase();
  const isOpenState = waState === 'open';
  const isConnectingState = waState === 'connecting';
  const qrBase64 = typeof bridgeStatus?.evo_qr_base64 === 'string' && bridgeStatus.evo_qr_base64.trim()
    ? bridgeStatus.evo_qr_base64.trim()
    : null;
  const qrSrc = qrBase64
    ? qrBase64.startsWith('data:')
      ? qrBase64
      : `data:image/png;base64,${qrBase64}`
    : null;

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">Estado de la conexión WhatsApp</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!bridgeStatus ? (
          <p className="text-xs text-slate-500">Consultando…</p>
        ) : bridgeStatus.ok === false ? (
          <p className="text-xs text-rose-700">{bridgeStatus.error}</p>
        ) : (
          (() => {
            const ago = (iso?: string | null) => {
              if (!iso) return 'nunca';
              const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
              if (s < 90) return `hace ${s}s`;
              if (s < 5400) return `hace ${Math.round(s / 60)} min`;
              return new Date(iso).toLocaleString('es-SV');
            };
            const pollOk = bridgeStatus.bridge_last_poll && Date.now() - new Date(bridgeStatus.bridge_last_poll).getTime() < 2 * 60 * 1000;
            const isUnauthorized401 = Number(bridgeStatus.evo_disconnection_reason) === 401;
            const waBadge = isOpenState ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                Conectada · Enviando y recibiendo
              </span>
            ) : isUnauthorized401 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3" />
                Desconectada · Requiere QR (401)
              </span>
            ) : isConnectingState ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Reconectando…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3" />
                Desconectada{bridgeStatus.evo_disconnection_reason != null ? ` (Cód. ${bridgeStatus.evo_disconnection_reason})` : ' (Connection Closed)'}
              </span>
            );
            const rows: [string, React.ReactNode][] = [
              ['Sesión WhatsApp (+503 7971-8911)', waBadge],
              [
                'Servidor Evolution (puente)',
                <span className={pollOk ? 'text-emerald-700' : 'text-rose-700'}>
                  {pollOk ? 'En línea' : 'Sin señal'} · {ago(bridgeStatus.bridge_last_poll)}
                </span>,
              ],
              ['Último mensaje recibido', ago(bridgeStatus.last_webhook_in)],
              ['Último envío confirmado', ago(bridgeStatus.bridge_last_ack)],
              ['Mensajes en cola', String(bridgeStatus.outbox_pending)],
              ['Envíos con error (24h)', String(bridgeStatus.outbox_errors_24h)],
              ['Archivos descargándose', String(bridgeStatus.media_pending)],
              ['Archivos con error', String(bridgeStatus.media_failed)],
              ['Grupos sincronizados', `${bridgeStatus.groups_count} · ${ago(bridgeStatus.groups_synced_at)}`],
              ['Clave Evolution configurada', bridgeStatus.evolution_key_configured ? 'Sí' : 'No'],
            ];
            return (
              <>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs">
                      <span className="text-slate-500 font-medium">{k}</span>
                      <span className="font-bold text-slate-800 text-right">{v}</span>
                    </div>
                  ))}
                  {bridgeStatus.bridge_last_error && (
                    <p className="px-3.5 py-2 text-[11px] text-rose-700 break-all">Último error: {bridgeStatus.bridge_last_error}</p>
                  )}
                </div>

                {!isOpenState && !qrSrc && (
                  <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 leading-snug">
                    La sesión de WhatsApp en el servidor está desconectada
                    {isUnauthorized401 ? ' (dispositivo desvinculado en el celular, cód. 401)' : ''}. Pulsa{' '}
                    <strong>Reconectar / Generar QR</strong> abajo para restablecer la conexión o mostrar un código QR fresco.
                  </div>
                )}

                {!isOpenState && qrSrc && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <QrCode className="w-4 h-4 text-indigo-600" />
                      <span>Escanea este código QR para vincular WhatsApp</span>
                    </div>
                    <img
                      src={qrSrc}
                      alt="Código QR WhatsApp"
                      className="w-56 h-56 mx-auto rounded-xl border border-slate-200 bg-white p-2 object-contain"
                    />
                    {bridgeStatus.evo_pairing_code && (
                      <p className="text-xs font-mono font-bold text-indigo-700">
                        Código de vinculación: {bridgeStatus.evo_pairing_code}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-600 leading-snug">
                      En el teléfono <strong>+503 7971-8911</strong> abre{' '}
                      <strong>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong>.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  {onRefresh && (
                    <button
                      type="button"
                      onClick={onRefresh}
                      disabled={reconnecting}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 transition disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                      <span>Actualizar estado</span>
                    </button>
                  )}
                  {isAdmin && onReconnect && (
                    <button
                      type="button"
                      onClick={onReconnect}
                      disabled={reconnecting}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                      <span>{reconnecting ? 'Reconectando…' : 'Reconectar / Generar QR'}</span>
                    </button>
                  )}
                </div>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
};
