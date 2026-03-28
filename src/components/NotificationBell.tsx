import { useRef, useEffect } from 'react';
import { Bell, BellRing, Check, CheckCheck, X, Calendar, Phone, Mail, Users, Monitor, GitBranch } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../services/notifications';
import { cn } from '../lib/utils';

// Icons per notification type
const ACTION_ICONS: Record<string, React.ReactNode> = {
  call:                  <Phone className="w-3.5 h-3.5" />,
  email:                 <Mail className="w-3.5 h-3.5" />,
  meeting:               <Users className="w-3.5 h-3.5" />,
  whatsapp:              <span className="text-[11px]">💬</span>,
  demo:                  <Monitor className="w-3.5 h-3.5" />,
  follow_up_reminder:    <Calendar className="w-3.5 h-3.5" />,
  stage_client_assigned: <GitBranch className="w-3.5 h-3.5" />,  // pipeline
};

// Bubble color per type — keeps pipeline (green) separated from leads (indigo)
const TYPE_COLOR: Record<string, string> = {
  stage_client_assigned: 'bg-emerald-500',   // green  — pipeline
};
const DEFAULT_UNREAD_COLOR = 'bg-indigo-500'; // indigo — leads/follow-ups

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function NotificationItem({
  notif,
  onClick,
  onMarkRead,
}: {
  notif: AppNotification;
  onClick: (n: AppNotification) => void;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-3 cursor-pointer transition-all duration-150 hover:bg-indigo-50/60',
        !notif.read && 'bg-indigo-50/40 border-l-2 border-indigo-500'
      )}
      onClick={() => onClick(notif)}
    >
      {/* Icon bubble — color depends on type */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white mt-0.5',
        notif.read ? 'bg-gray-300' : (TYPE_COLOR[notif.type] || DEFAULT_UNREAD_COLOR)
      )}>
        {ACTION_ICONS[notif.type] || <Calendar className="w-3.5 h-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[12.5px] leading-tight truncate',
          notif.read ? 'text-gray-500 font-normal' : 'text-gray-800 font-semibold'
        )}>
          {notif.title}
        </p>
        {notif.body && (
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>
        )}
        <p className="text-[10px] text-indigo-400 mt-1 font-medium">
          {timeAgo(notif.created_at)}
        </p>
      </div>

      {/* Mark read button */}
      {!notif.read && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-indigo-100 rounded-full"
          title="Marcar como leída"
        >
          <Check className="w-3 h-3 text-indigo-500" />
        </button>
      )}
    </div>
  );
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isOpen,
    setIsOpen,
    loading,
    permissionGranted,
    handleMarkRead,
    handleMarkAllRead,
    handleNotificationClick,
    requestPermission,
  } = useNotifications();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200',
          isOpen
            ? 'bg-indigo-100 text-indigo-600'
            : 'hover:bg-gray-100 text-gray-500 hover:text-indigo-600'
        )}
        title="Notificaciones"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 animate-[wiggle_0.6s_ease-in-out]" />
        ) : (
          <Bell className="w-5 h-5" />
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 animate-pulse shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <span className="text-[13px] font-bold text-gray-800">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="w-3 h-3" />
                  Todas leídas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Push permission banner */}
          {!permissionGranted && (
            <div className="mx-3 my-2 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-[11px] text-indigo-700 flex-1">
                Activa notificaciones para recibir alertas con sonido
              </p>
              <button
                onClick={requestPermission}
                className="text-[10px] bg-indigo-500 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-indigo-600 transition-all flex-shrink-0"
              >
                Activar
              </button>
            </div>
          )}

          {/* Notifications list */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-[12px] font-medium">Sin notificaciones</p>
                <p className="text-[10px] mt-1 text-gray-300">
                  Te avisaremos antes de cada seguimiento
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onClick={handleNotificationClick}
                  onMarkRead={handleMarkRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 text-center">
              <p className="text-[10px] text-gray-400">
                Mostrando las últimas {notifications.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
