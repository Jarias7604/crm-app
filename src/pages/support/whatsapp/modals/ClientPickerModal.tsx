import React from 'react';
import { Search, Users, Building2, X } from 'lucide-react';
import type { SupportCircle } from '../types';

export interface ClientPickerOption {
  key: string;
  label: string;
  sub: string;
  group_jid: string | null;
  client_id: string | null;
}

export interface ClientPickerModalProps {
  isOpen: boolean;
  activeCircle: SupportCircle | null;
  query: string;
  onQueryChange: (q: string) => void;
  options: ClientPickerOption[];
  classifying: boolean;
  onClassifyClient: (extra?: { client_id?: string; group_jid?: string }) => void;
  onClose: () => void;
}

export const ClientPickerModal: React.FC<ClientPickerModalProps> = ({
  isOpen,
  activeCircle,
  query,
  onQueryChange,
  options,
  classifying,
  onClassifyClient,
  onClose,
}) => {
  if (!isOpen || !activeCircle) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">¿De qué cliente es este número?</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-600">
          {activeCircle.pushName ? `"${activeCircle.pushName}" ` : ''}
          {activeCircle.phone ? `+${activeCircle.phone}` : ''} pasará a <strong>Soporte</strong>.
        </p>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar grupo o cliente…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
          />
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={classifying}
              onClick={() => onClassifyClient({ client_id: o.client_id || undefined, group_jid: o.group_jid || undefined })}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center gap-2"
            >
              {o.group_jid ? <Users className="w-4 h-4 text-indigo-500 shrink-0" /> : <Building2 className="w-4 h-4 text-slate-400 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{o.label}</p>
                <p className="text-[10px] text-slate-500 truncate">{o.sub}</p>
              </div>
            </button>
          ))}
          {options.length === 0 && <p className="p-4 text-center text-xs text-slate-400">Sin resultados</p>}
        </div>
        <button
          type="button"
          disabled={classifying}
          onClick={() => onClassifyClient()}
          className="w-full py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
        >
          Es cliente, pero no está en la lista
        </button>
      </div>
    </div>
  );
};
