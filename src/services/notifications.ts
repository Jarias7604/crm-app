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
        return false;
      }

      const reg = await pushService.register();
      if (!reg) return false;

      // We skip VAPID for now — in-app polling handles reminders
      // When VAPID_PUBLIC_KEY is ready, subscribe with pushManager.subscribe()
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
  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    return count || 0;
  },

  // Fetch latest notifications (for dropdown) — solo las del usuario actual
  async getNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as AppNotification[];
  },

  // Mark one notification as read
  async markAsRead(id: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  },

  // Mark all as read — solo las del usuario actual
  async markAllAsRead(userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
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

  async notifyAdminsOfClientReversion(
    companyId: string,
    leadId: string,
    clientName: string,
    agentEmail: string,
    action: 'reverted' | 'deleted',
    newStatusLabel?: string
  ): Promise<void> {
    try {
      // 1. Obtener perfiles de administradores (super_admin, admin)
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('company_id', companyId)
        .in('role', ['super_admin', 'admin']);

      if (adminsError) throw adminsError;
      if (!admins || admins.length === 0) return;

      const dateStr = new Date().toLocaleString('es-ES', { timeZone: 'America/El_Salvador' });
      const title = `⚠️ Alerta: Onboarding ${action === 'reverted' ? 'Revertido' : 'Eliminado'}`;
      const body = `El agente ${agentEmail} ha ${action === 'reverted' ? 'revertido' : 'eliminado'} el onboarding de "${clientName}" ${action === 'reverted' ? `a la etapa: ${newStatusLabel}` : ''} el ${dateStr}.`;

      // 2. Insertar notificación en tiempo real (In-app) para cada administrador
      const notificationsToInsert = admins.map(admin => ({
        user_id: admin.id,
        type: 'alert',
        title,
        body,
        read: false,
        scheduled_for: new Date().toISOString()
      }));

      await supabase.from('notifications').insert(notificationsToInsert);

      // 3. Insertar correo en la cola de mensajería (marketing_message_queue)
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-top: 0;">⚠️ ALERTA DE SEGURIDAD</h2>
          <p style="font-size: 16px; line-height: 1.5;">Se ha realizado un cambio crítico en el proceso de clientes:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f9fafb;">
              <td style="padding: 10px; font-weight: bold; width: 180px;">Cliente:</td>
              <td style="padding: 10px;">${clientName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">Acción:</td>
              <td style="padding: 10px; color: #b91c1c; font-weight: bold;">Onboarding ${action === 'reverted' ? 'Revertido' : 'Eliminado'}</td>
            </tr>
            ${action === 'reverted' ? `
            <tr style="background-color: #f9fafb;">
              <td style="padding: 10px; font-weight: bold;">Nuevo Estado:</td>
              <td style="padding: 10px; font-weight: bold; color: #2563eb;">${newStatusLabel}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px; font-weight: bold;">Realizado por:</td>
              <td style="padding: 10px;">${agentEmail}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="padding: 10px; font-weight: bold;">Fecha y Hora:</td>
              <td style="padding: 10px;">${dateStr}</td>
            </tr>
          </table>
          <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
            Este es un correo automático de seguridad generado por Arias CRM Professional.
          </p>
        </div>
      `;

      // Enviar correos a todos los administradores insertando en la cola
      const emailsToQueue = admins.map(admin => {
        if (!admin.email) return null;
        return {
          company_id: companyId,
          lead_id: leadId,
          channel: 'email',
          subject: `⚠️ ALERTA CRM: Onboarding ${action === 'reverted' ? 'Revertido' : 'Eliminado'} - ${clientName}`,
          content: emailHtml,
          status: 'pending',
          scheduled_at: new Date().toISOString(),
          retry_count: 0
        };
      }).filter(Boolean);

      if (emailsToQueue.length > 0) {
        const { error: queueError } = await supabase
          .from('marketing_message_queue')
          .insert(emailsToQueue);

        if (queueError) throw queueError;

        // Desencadenar el procesador de cola en segundo plano (fire-and-forget)
        supabase.functions.invoke('process-message-queue').catch(err => {
          console.warn('[Queue] Fail to trigger process-message-queue:', err);
        });
      }

    } catch (error) {
      console.error('[Notification] Error sending admin alert:', error);
    }
  },
};
