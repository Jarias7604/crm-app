import React from 'react';
import { X } from 'lucide-react';

export interface BridgeStatusModalProps {
  isOpen: boolean;
  bridgeStatus: Record<string, any> | null;
  onClose: () => void;
}

export const BridgeStatusModal: React.FC<BridgeStatusModalProps> = ({ isOpen, bridgeStatus, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
            const rows: [string, React.ReactNode][] = [
              [
                'Servidor Evolution (puente)',
                <span className={pollOk ? 'text-emerald-700' : 'text-rose-700'}>
                  {pollOk ? 'Conectado' : 'Sin señal'} · {ago(bridgeStatus.bridge_last_poll)}
                </span>,
              ],
              ['Último envío confirmado', ago(bridgeStatus.bridge_last_ack)],
              ['Mensajes en cola', String(bridgeStatus.outbox_pending)],
              ['Envíos con error (24h)', String(bridgeStatus.outbox_errors_24h)],
              ['Archivos descargándose', String(bridgeStatus.media_pending)],
              ['Archivos con error', String(bridgeStatus.media_failed)],
              ['Grupos sincronizados', `${bridgeStatus.groups_count} · ${ago(bridgeStatus.groups_synced_at)}`],
              ['Clave Evolution configurada', bridgeStatus.evolution_key_configured ? 'Sí' : 'No'],
            ];
            return (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3.5 py-2 text-xs">
                    <span className="text-slate-500 font-medium">{k}</span>
                    <span className="font-bold text-slate-800">{v}</span>
                  </div>
                ))}
                {bridgeStatus.bridge_last_error && (
                  <p className="px-3.5 py-2 text-[11px] text-rose-700 break-all">Último error: {bridgeStatus.bridge_last_error}</p>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
