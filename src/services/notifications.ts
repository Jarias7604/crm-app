import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface AppNotification {
  id: string;
  user_id: string;
  follow_up_id: string | null;
  lead_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  push_sent: boolean;
  scheduled_for: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Web Push — Service Worker registration & subscription
// ---------------------------------------------------------------------------

export const pushService = {
  async isSupported(): Promise<boolean> {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  },

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!(await pushService.isSupported())) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered:', reg.scope);
      return reg;
    } catch (err) {
      console.error('[SW] Registration failed:', err);
      return null;
    }
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  },

  async subscribe(): Promise<boolean> {
    try {
      const permission = await pushService.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] Permission denied');
        return false;
      }

      const reg = await pushService.register();
      if (!reg) return false;

      // We skip VAPID for now — in-app polling handles reminders
      // When VAPID_PUBLIC_KEY is ready, subscribe with pushManager.subscribe()
      console.log('[Push] Service Worker active, in-app notifications enabled');
      return true;
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      return false;
    }
  },

  // Play notification sound using Web Audio API (no extra file needed)
  playSound() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Pleasant two-tone chime
      const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(880, now, 0.4, 0.3);        // A5
      playTone(1046.5, now + 0.15, 0.5, 0.25); // C6
    } catch (err) {
      console.warn('[Sound] Could not play notification sound:', err);
    }
  },

  // Show a browser notification (fallback for when push isn't set up)
  async showLocalNotification(title: string, body: string, leadId?: string | null) {
    if (Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      reg.showNotification(title, {
        body: body || '',
        icon: '/vite.svg',
        tag: `followup-${Date.now()}`,
        data: { url: leadId ? `/leads` : '/leads', leadId: leadId || null },
        requireInteraction: true,
        vibrate: [200, 100, 200],
      } as any);
    } else {
      new Notification(title, { body: body || '' });
    }
  },
};

// ---------------------------------------------------------------------------
// In-App Notifications Service
// ---------------------------------------------------------------------------

export const notificationsService = {
  // Fetch unread count for badge
  async getUnreadCount(): Promise<number> {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);
    return count || 0;
  },

  // Fetch latest notifications (for dropdown)
  async getNotifications(limit = 20): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as AppNotification[];
  },

  // Mark one notification as read
  async markAsRead(id: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  },

  // Mark all as read
  async markAllAsRead(): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);
  },

  // Subscribe to realtime new notifications for current user
  subscribeToNew(
    userId: string,
    onNew: (notification: AppNotification) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as AppNotification;
          onNew(notif);
        }
      )
      .subscribe();

    return channel;
  },
};
