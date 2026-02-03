
import { supabase } from '../supabase';

export interface QueueMessage {
    id?: string;
    campaign_id: string;
    lead_id: string;
    company_id: string;
    channel: 'whatsapp' | 'telegram' | 'email' | 'sms';
    content: string;
    subject?: string;
    scheduled_at?: Date;
    metadata?: Record<string, any>;
}

export interface QueueStats {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled: number;
}

export const messageQueueService = {
    /**
     * Agregar mensajes a la cola (batch insert para eficiencia)
     */
    async enqueue(messages: QueueMessage[]): Promise<any[]> {
        const { data, error } = await supabase
            .from('marketing_message_queue')
            .insert(messages)
            .select();

        if (error) {
            console.error('Error enqueueing messages:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Agregar un solo mensaje
     */
    async enqueueOne(message: QueueMessage): Promise<any> {
        const result = await this.enqueue([message]);
        return result[0];
    },

    /**
     * Obtener stats de la cola para una campaña
     */
    async getCampaignStats(campaignId: string): Promise<QueueStats> {
        const { data, error } = await supabase
            .rpc('get_campaign_queue_stats', { p_campaign_id: campaignId });

        if (error) {
            console.error('Error getting campaign stats:', error);
            throw error;
        }

        return data[0] || {
            total: 0,
            pending: 0,
            sending: 0,
            sent: 0,
            failed: 0,
            cancelled: 0
        };
    },

    /**
     * Obtener mensajes pendientes (para procesamiento manual si es necesario)
     */
    async getPendingMessages(limit: number = 100): Promise<any[]> {
        const { data, error } = await supabase
            .from('marketing_message_queue')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('Error getting pending messages:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Cancelar mensajes pendientes de una campaña
     */
    async cancelCampaign(campaignId: string): Promise<void> {
        const { error } = await supabase
            .from('marketing_message_queue')
            .update({ status: 'cancelled' })
            .eq('campaign_id', campaignId)
            .in('status', ['pending', 'sending']);

        if (error) {
            console.error('Error cancelling campaign:', error);
            throw error;
        }
    },

    /**
     * Marcar mensaje como enviado
     */
    async markAsSent(messageId: string, metadata?: Record<string, any>): Promise<void> {
        const updates: any = {
            status: 'sent',
            sent_at: new Date().toISOString()
        };

        if (metadata) {
            updates.metadata = metadata;
        }

        const { error } = await supabase
            .from('marketing_message_queue')
            .update(updates)
            .eq('id', messageId);

        if (error) {
            console.error('Error marking message as sent:', error);
            throw error;
        }
    },

    /**
     * Marcar mensaje como fallido
     */
    async markAsFailed(messageId: string, errorMsg: string): Promise<void> {
        const { error } = await supabase
            .from('marketing_message_queue')
            .update({
                status: 'failed',
                error: errorMsg
            })
            .eq('id', messageId);

        if (error) {
            console.error('Error marking message as failed:', error);
            throw error;
        }
    },

    /**
     * Reintentar mensajes fallidos automáticamente
     */
    async retryFailed(): Promise<void> {
        const { error } = await supabase.rpc('auto_retry_failed_messages');

        if (error) {
            console.error('Error retrying failed messages:', error);
            throw error;
        }
    },

    /**
     * Limpiar mensajes antiguos (más de 30 días)
     */
    async cleanupOld(daysOld: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const { error } = await supabase
            .from('marketing_message_queue')
            .delete()
            .in('status', ['sent', 'cancelled'])
            .lt('created_at', cutoffDate.toISOString());

        if (error) {
            console.error('Error cleaning up old messages:', error);
            throw error;
        }
    }
};
