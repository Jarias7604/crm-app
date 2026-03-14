import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  notificationsService,
  pushService,
  type AppNotification,
} from '../services/notifications';

const POLL_INTERVAL_MS = 60_000; // Check every 60 seconds

export function useNotifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const channelRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotifIdRef = useRef<string | null>(null);

  const userId = profile?.id;

  // Request push permission + register SW on mount
  useEffect(() => {
    pushService.register().then(() => {
      if (Notification.permission === 'granted') {
        setPermissionGranted(true);
      }
    });
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const [notifs, count] = await Promise.all([
        notificationsService.getNotifications(20),
        notificationsService.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      console.error('[Notifications] Load error:', err);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    loadNotifications();
  }, [userId, loadNotifications]);

  // Polling fallback — checks every 60s for new notifications
  useEffect(() => {
    if (!userId) return;
    pollRef.current = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, loadNotifications]);

  // Realtime subscription — instant updates via Supabase
  useEffect(() => {
    if (!userId) return;

    channelRef.current = notificationsService.subscribeToNew(
      userId,
      async (newNotif) => {
        // Avoid duplicate sound/notification for same notif
        if (lastNotifIdRef.current === newNotif.id) return;
        lastNotifIdRef.current = newNotif.id;

        // Play sound
        pushService.playSound();

        // Show browser notification
        await pushService.showLocalNotification(
          newNotif.title,
          newNotif.body || '',
          newNotif.lead_id
        );

        // Update state
        setNotifications((prev) => [newNotif, ...prev.slice(0, 19)]);
        setUnreadCount((prev) => prev + 1);
      }
    );

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [userId]);

  const handleMarkRead = useCallback(async (id: string) => {
    await notificationsService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setLoading(true);
    await notificationsService.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setLoading(false);
  }, []);

  const handleNotificationClick = useCallback(
    async (notif: AppNotification) => {
      await handleMarkRead(notif.id);
      setIsOpen(false);
      if (notif.lead_id) {
        navigate(`/leads?highlight=${notif.lead_id}`);
      }
    },
    [handleMarkRead, navigate]
  );

  const requestPermission = useCallback(async () => {
    const granted = await pushService.subscribe();
    setPermissionGranted(granted);
    return granted;
  }, []);

  return {
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
    reload: loadNotifications,
  };
}
