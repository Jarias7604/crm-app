import { useState, useEffect, memo } from 'react';
import { Users, Clock } from 'lucide-react';
import type { SupportCircle } from './types';
import { initials, formatWaitDuration, listTimeLabel } from './helpers';

export const ActiveSessionTimer = memo<{ startedAt: number }>(({ startedAt }) => {
  const [sec, setSec] = useState(() => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
  useEffect(() => {
    setSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = window.setInterval(() => {
      setSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return (
    <>
      {Math.floor(sec / 60)}m {sec % 60 < 10 ? '0' : ''}
      {sec % 60}s
    </>
  );
});
ActiveSessionTimer.displayName = 'ActiveSessionTimer';

export interface CircleListRowProps {
  circle: SupportCircle;
  isSelected: boolean;
  unread: boolean;
  onSelect: (circle: SupportCircle) => void;
}

export const CircleListRow = memo<CircleListRowProps>(({ circle, isSelected, unread, onSelect }) => {
  const isOverdue = circle.unreadOrWaitingReply && circle.waitMinutes >= 15 && circle.waitMinutes <= 24 * 60;
  const shortType =
    circle.scope === 'soporte'
      ? circle.isGroup
        ? 'Grupo'
        : 'Cliente'
      : circle.scope === 'por_clasificar'
      ? 'Por tomar'
      : circle.scope === 'lead'
      ? circle.leadStatus && circle.leadStatus !== 'Prospecto'
        ? circle.leadStatus
        : 'Lead'
      : circle.scope === 'interno'
      ? 'Equipo'
      : 'Spam';

  return (
    <button
      type="button"
      onClick={() => onSelect(circle)}
      className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 transition relative border-l-[3px] ${
        isSelected
          ? 'bg-indigo-50/80 border-l-indigo-600'
          : unread
          ? 'bg-[#F5F7FF] hover:bg-indigo-50/60 border-l-indigo-500'
          : 'bg-white hover:bg-slate-50/80 border-l-transparent'
      }`}
    >
      <div className="relative shrink-0">
        <div
          className={`w-9.5 h-9.5 rounded-full flex items-center justify-center text-[13px] ${
            unread
              ? 'bg-indigo-100 text-indigo-700 font-bold ring-1 ring-indigo-200/80'
              : isSelected
              ? 'bg-indigo-100 text-indigo-700 font-semibold'
              : 'bg-slate-100 text-slate-500 font-semibold'
          }`}
        >
          {circle.isGroup ? <Users className="w-4 h-4" /> : initials(circle.clientName)}
        </div>
        {unread && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white absolute -top-0.5 -right-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[14px] truncate ${unread ? 'font-bold text-slate-950' : 'font-normal text-slate-700'}`}>
              {circle.clientName}
            </span>
            <span
              className={`text-[12px] shrink-0 ${
                circle.leadStatus === 'Perdido' || circle.leadStatus === 'Erróneo'
                  ? 'text-slate-500 font-normal'
                  : 'text-slate-400 font-normal'
              }`}
            >
              · {shortType}
            </span>
            {circle.isReactivation && (
              <span
                title={circle.reactivationCampaign || 'Campaña de reactivación WhatsApp'}
                className={`text-[11px] font-medium shrink-0 ${
                  circle.reactivationReplied
                    ? 'px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80'
                    : 'text-slate-400'
                }`}
              >
                {circle.reactivationReplied ? 'Respondió' : `· Toque ${circle.reactivationTouch || 1}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOverdue && (
              <span
                title={`Esperando respuesta hace ${formatWaitDuration(circle.waitMinutes)}`}
                className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 text-[11.5px] font-semibold inline-flex items-center gap-0.5"
              >
                <Clock className="w-3 h-3" />
                {formatWaitDuration(circle.waitMinutes)}
              </span>
            )}
            <span className={`text-[12px] ${unread ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
              {listTimeLabel(circle.lastMessageAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[13px] truncate ${unread ? 'text-slate-800 font-semibold' : 'text-slate-400 font-normal'}`}>
            {circle.lastMessageSender}: {circle.lastMessageText}
          </p>
          {unread && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10.5px] font-bold leading-none shrink-0">
              Nuevo
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
CircleListRow.displayName = 'CircleListRow';
