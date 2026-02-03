import { useState, useEffect } from 'react';
import { messageQueueService, type QueueStats } from '../services/marketing/messageQueueService';
import { massMessagingService } from '../services/marketing/massMessagingService';

/**
 * Hook para monitorear stats de campaña en tiempo real
 */
export function useCampaignStats(campaignId: string | null, refreshInterval: number = 5000) {
    const [stats, setStats] = useState<QueueStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!campaignId) return;

        let isMounted = true;

        const fetchStats = async () => {
            try {
                setLoading(true);
                const data = await messageQueueService.getCampaignStats(campaignId);
                if (isMounted) {
                    setStats(data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // Fetch inicial
        fetchStats();

        // Refresh periódico
        const interval = setInterval(fetchStats, refreshInterval);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [campaignId, refreshInterval]);

    const progress = stats ? (stats.sent / stats.total) * 100 : 0;
    const isComplete = stats ? (stats.sent + stats.failed + stats.cancelled === stats.total) : false;

    return {
        stats,
        loading,
        error,
        progress,
        isComplete
    };
}

/**
 * Hook para programar campañas masivas
 */
export function useMassCampaign() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scheduleCampaign = async (
        campaignId: string,
        options: {
            scheduledAt?: Date;
            testMode?: boolean;
        } = {}
    ) => {
        try {
            setLoading(true);
            setError(null);

            const result = await massMessagingService.scheduleCampaign({
                campaignId,
                ...options
            });

            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const getPreview = async (campaignId: string) => {
        try {
            setLoading(true);
            setError(null);

            const preview = await massMessagingService.getCampaignPreview(campaignId);
            return preview;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const pauseCampaign = async (campaignId: string) => {
        try {
            setLoading(true);
            setError(null);

            await massMessagingService.pauseCampaign(campaignId);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        scheduleCampaign,
        getPreview,
        pauseCampaign,
        loading,
        error
    };
}

/**
 * Hook para gestión de cola de mensajes
 */
export function useMessageQueue() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const enqueueMessages = async (messages: any[]) => {
        try {
            setLoading(true);
            setError(null);

            const result = await messageQueueService.enqueue(messages);
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const cancelCampaign = async (campaignId: string) => {
        try {
            setLoading(true);
            setError(null);

            await messageQueueService.cancelCampaign(campaignId);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const retryFailed = async () => {
        try {
            setLoading(true);
            setError(null);

            await messageQueueService.retryFailed();
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        enqueueMessages,
        cancelCampaign,
        retryFailed,
        loading,
        error
    };
}

/**
 * Hook para filtrado y validación de leads
 */
export function useLeadFiltering(companyId: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getFilteredLeads = async (filters: any, limit?: number) => {
        try {
            setLoading(true);
            setError(null);

            const leads = await massMessagingService.getFilteredLeads(
                companyId,
                filters,
                limit
            );

            return leads;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const validateForChannel = (leads: any[], channel: string) => {
        return massMessagingService.validateLeadsForChannel(leads, channel);
    };

    return {
        getFilteredLeads,
        validateForChannel,
        loading,
        error
    };
}
