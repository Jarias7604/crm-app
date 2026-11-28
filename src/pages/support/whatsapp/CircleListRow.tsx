import { useState, useEffect, memo } from 'react';
import { Users, Clock, Eye, Check, CheckCheck, Bot, Calendar, UserCheck, AlertTriangle } from 'lucide-react';
import type { SupportCircle } from './types';
import {
  initials,
  formatWaitDuration,
  listTimeLabel,
  extractShortAgentName,
  classifyLeadStageGroup,
} from './helpers';

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
  const ticketMeta = ((circle.activeTicket?.metadata || {}) as Record<string, any>);
  const qualifierStatus = String(ticketMeta.ai_qualifier_status || '');
  const isQualifierActive = ticketMeta.ai_qualifier_active === true;
  const leadGroup = circle.scope === 'lead' ? classifyLeadStageGroup(circle.leadStatus) : null;
  const ownerShort = extractShortAgentName(
    circle.leadOwnerName || (circle.assignedTechName && circle.assignedTechName !== 'Sin asignar' ? circle.assignedTechName : ''),
  );
  const shortType =
    circle.scope === 'soporte'
      ? circle.isGroup
        ? 'Grupo'
        : 'Cliente'
      : circle.scope === 'por_clasificar'
      ? 'Por tomar'
      : circle.scope === 'lead'
      ? leadGroup === 'renovaciones'
        ? 'Cliente · Renov.'
        : leadGroup === 'nuevos'
        ? circle.freshLeadLabel || (circle.isFreshLead ? 'Nuevo · Hoy' : 'Nuevo')
        : circle.leadStatus || 'En proceso'
      : circle.scope === 'interno'
      ? 'Equipo'
      : 'Spam';

  return (
    <button
      type="button"
      onClick={() => onSelect(circle)}
      className={`w-full text-left px-4 py-4 md:px-3.5 md:py-2.5 flex items-start md:items-center gap-3.5 md:gap-2.5 transition relative border-l-[3px] ${
        isSelected
          ? 'bg-indigo-50/80 border-l-indigo-600'
          : unread
          ? 'bg-[#F5F7FF] hover:bg-indigo-50/60 border-l-indigo-500'
          : 'bg-white hover:bg-slate-50/80 border-l-transparent'
      }`}
    >
      <div className="relative shrink-0 mt-0.5 md:mt-0">
        <div
          className={`w-12 h-12 md:w-9.5 md:h-9.5 rounded-full flex items-center justify-center text-[16px] md:text-[13px] ${
            unread
              ? 'bg-indigo-100 text-indigo-700 font-bold ring-1 ring-indigo-200/80'
              : isSelected
              ? 'bg-indigo-100 text-indigo-700 font-semibold'
              : 'bg-slate-100 text-slate-500 font-semibold'
          }`}
        >
          {circle.isGroup ? <Users className="w-5.5 h-5.5 md:w-4 md:h-4" /> : initials(circle.clientName)}
        </div>
        {unread && <span className="w-3 h-3 md:w-2.5 md:h-2.5 rounded-full bg-indigo-600 border-2 border-white absolute -top-0.5 -right-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 md:gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`text-[17px] md:text-[14px] leading-snug truncate ${unread ? 'font-bold text-slate-950' : 'font-medium md:font-normal text-slate-600'}`}>
              {circle.clientName}
            </span>
            <span
              className={`hidden md:inline text-[12px] shrink-0 ${
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
                className="hidden md:inline text-[11px] font-normal text-slate-400 shrink-0"
              >
                {circle.reactivationReplied ? '· React.' : `· Toque ${circle.reactivationTouch || 1}`}
              </span>
            )}
            {circle.scope === 'lead' && qualifierStatus === 'handed_off' && (
              <span
                title="El lead pidió hablar con un asesor humano"
                className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold leading-none shrink-0"
              >
                <UserCheck className="w-2.5 h-2.5" />
                Asesor
              </span>
            )}
            {circle.scope === 'lead' && isQualifierActive && qualifierStatus !== 'handed_off' && (
              <span
                title="Calificador Comercial IA activo en este chat"
                aria-label="Calificador Comercial IA activo"
                className="hidden md:inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 leading-none shrink-0"
              >
                <Bot className="w-3 h-3" />
              </span>
            )}
            {circle.scope === 'lead' && qualifierStatus === 'demo_booked' && (
              <span
                title="Demo agendada automáticamente por IA"
                className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold leading-none shrink-0"
              >
                <Calendar className="w-2.5 h-2.5" />
                Demo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(circle.failedOutboxCount || 0) > 0 && (
              <span
                title={`${circle.failedOutboxCount} mensaje(s) sin enviar — pulsa para reenviar`}
                className="hidden md:inline-flex px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10.5px] font-bold items-center gap-0.5"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                No enviado
              </span>
            )}
            {isOverdue && (
              <span
                title={`Esperando respuesta hace ${formatWaitDuration(circle.waitMinutes)}`}
                className="hidden md:inline-flex px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 text-[11.5px] font-semibold items-center gap-0.5"
              >
                <Clock className="w-3 h-3" />
                {formatWaitDuration(circle.waitMinutes)}
              </span>
            )}
            <span className={`text-[13.5px] md:text-[12px] ${unread ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
              {listTimeLabel(circle.lastMessageAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5 md:mt-0.5">
          <p className={`text-[15px] md:text-[13px] leading-snug truncate ${unread ? 'text-slate-800 font-semibold' : 'text-slate-400 font-normal'}`}>
            {circle.lastMessageSender}: {circle.lastMessageText}
          </p>
          {circle.teamStatus === 'unopened' ? (
            <span
              title="Nadie del equipo ha abierto este mensaje"
              className="px-2.5 md:px-1.5 py-1 md:py-0.5 rounded-full bg-indigo-600 text-white text-[12px] md:text-[10px] font-bold leading-none shrink-0"
            >
              Sin abrir
            </span>
          ) : circle.teamStatus === 'seen_waiting' && circle.seenByOtherNames.length > 0 ? (
            <span
              title={
                circle.seenByOtherNames.length === 1 && circle.seenByOtherNames[0] === 'WhatsApp'
                  ? 'Visto en WhatsApp (celular/Web) · Sin responder aún'
                  : `Visto por ${circle.seenByOtherNames.join(', ')} · Sin responder aún`
              }
              className="px-2.5 md:px-1.5 py-1 md:py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[12px] md:text-[10px] font-semibold leading-none shrink-0 inline-flex items-center gap-0.5"
            >
              <Eye className="w-3 h-3 md:w-2.5 md:h-2.5" />
              {circle.seenByOtherNames[0]}
              {circle.seenByOtherNames.length > 1 ? ` +${circle.seenByOtherNames.length - 1}` : ''}
            </span>
          ) : circle.teamStatus === 'seen_waiting' ? (
            <span
              title="Ya abierto por ti · Pendiente de responder"
              className="px-2.5 md:px-1.5 py-1 md:py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 text-[12px] md:text-[10px] font-semibold leading-none shrink-0"
            >
              Sin responder
            </span>
          ) : circle.teamStatus === 'replied' ? (
            <span
              title={`Última respuesta enviada por ${circle.repliedByShortName || 'Equipo'}`}
              className="text-[12.5px] md:text-[10.5px] font-medium text-emerald-700 leading-none shrink-0 inline-flex items-center gap-0.5"
            >
              <CheckCheck className="w-4 h-4 md:w-3 md:h-3 text-emerald-600" />
              {circle.repliedByShortName || 'Equipo'}
            </span>
          ) : circle.teamStatus === 'attended' ? (
            <span
              title={`Marcado como atendido${circle.attendedByShortName ? ` por ${circle.attendedByShortName}` : ''}`}
              className="text-[12.5px] md:text-[10.5px] font-medium text-slate-500 leading-none shrink-0 inline-flex items-center gap-0.5"
            >
              <Check className="w-4 h-4 md:w-3 md:h-3 text-slate-400" />
              {circle.attendedByShortName ? `Atendido · ${circle.attendedByShortName}` : 'Atendido'}
            </span>
          ) : unread ? (
            <span
              title="Recordatorio personal (marcado como no leído)"
              className="px-2.5 md:px-1.5 py-1 md:py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[12px] md:text-[10px] font-semibold leading-none shrink-0"
            >
              Recordatorio
            </span>
          ) : null}
        </div>
        <div className="md:hidden mt-2 flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-md text-[12px] font-semibold leading-none ${
              circle.scope === 'lead' && leadGroup === 'nuevos' && shortType === 'Nuevo · Hoy'
                ? 'bg-sky-50 text-sky-700 border border-sky-200/70'
                : circle.scope === 'lead' && leadGroup === 'nuevos' && shortType === 'Nuevo · Ayer'
                ? 'bg-slate-100 text-slate-700 border border-slate-200/80'
                : circle.scope === 'lead' && leadGroup === 'renovaciones'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {shortType}
          </span>
          {circle.scope === 'lead' &&
            leadGroup !== 'perdidos' &&
            leadGroup !== 'erroneos' &&
            (ownerShort ? (
              <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-200/70 text-[12px] font-medium leading-none">
                {ownerShort}
              </span>
            ) : leadGroup === 'nuevos' || leadGroup === 'en_proceso' ? (
              <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200/70 text-[12px] font-medium leading-none">
                Sin asignar
              </span>
            ) : null)}
          {circle.isReactivation && (
            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[12px] font-medium leading-none">
              {circle.reactivationReplied ? 'React.' : `Toque ${circle.reactivationTouch || 1}`}
            </span>
          )}
          {circle.scope === 'lead' && qualifierStatus === 'handed_off' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[12px] font-bold leading-none">
              <UserCheck className="w-3.5 h-3.5" />
              Asesor
            </span>
          )}
          {circle.scope === 'lead' && isQualifierActive && qualifierStatus !== 'handed_off' && (
            <span
              title="Calificador Comercial IA activo en este chat"
              aria-label="Calificador Comercial IA activo"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 leading-none shrink-0"
            >
              <Bot className="w-3.5 h-3.5" />
            </span>
          )}
          {circle.scope === 'lead' && qualifierStatus === 'demo_booked' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12px] font-bold leading-none">
              <Calendar className="w-3.5 h-3.5" />
              Demo
            </span>
          )}
          {isOverdue && (
            <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200 text-[12px] font-semibold leading-none">
              <Clock className="w-3.5 h-3.5" />
              {formatWaitDuration(circle.waitMinutes)}
            </span>
          )}
          {(circle.failedOutboxCount || 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[12px] font-bold leading-none">
              <AlertTriangle className="w-3.5 h-3.5" />
              No enviado
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
CircleListRow.displayName = 'CircleListRow';
