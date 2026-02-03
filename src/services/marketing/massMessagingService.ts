
import { supabase } from '../supabase';
import { messageQueueService, type QueueMessage } from './messageQueueService';

export interface CampaignScheduleOptions {
    campaignId: string;
    scheduledAt?: Date;
    testMode?: boolean; // Si true, solo envía a 1 lead para testing
}

export const massMessagingService = {
    /**
     * Programa envío masivo de campaña
     */
    async scheduleCampaign(options: CampaignScheduleOptions): Promise<{ success: boolean; totalQueued: number; testRecipient?: string }> {
        const { campaignId, scheduledAt, testMode = false } = options;

        // 1. Obtener campaña
        const { data: campaign, error: campaignError } = await supabase
            .from('marketing_campaigns')
            .select('*, company_id, type, content, subject, audience_filters')
            .eq('id', campaignId)
            .single();

        if (campaignError || !campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }

        // 2. Obtener leads según filtros
        const leads = await this.getFilteredLeads(
            campaign.company_id,
            campaign.audience_filters,
            testMode ? 1 : undefined
        );

        if (leads.length === 0) {
            throw new Error('No leads match the campaign filters');
        }

        // 3. Crear mensajes en cola
        const messages: QueueMessage[] = leads.map(lead => ({
            campaign_id: campaignId,
            lead_id: lead.id,
            company_id: campaign.company_id,
            channel: campaign.type as any,
            content: this.personalizeContent(campaign.content, lead),
            subject: campaign.subject ? this.personalizeContent(campaign.subject, lead) : undefined,
            scheduled_at: scheduledAt || new Date(),
            metadata: {
                lead_name: lead.name,
                lead_email: lead.email,
                lead_phone: lead.phone
            }
        }));

        // 4. Insertar en batch (eficiente)
        await messageQueueService.enqueue(messages);

        // 5. Actualizar stats de campaña
        await supabase
            .from('marketing_campaigns')
            .update({
                status: scheduledAt ? 'scheduled' : 'sending',
                total_recipients: leads.length,
                scheduled_at: scheduledAt || null
            })
            .eq('id', campaignId);

        return {
            success: true,
            totalQueued: leads.length,
            testRecipient: testMode ? leads[0]?.name : undefined
        };
    },

    /**
     * Personaliza contenido con variables dinámicas
     */
    personalizeContent(template: string, lead: any): string {
        if (!template) return '';

        return template
            .replace(/\{\{nombre\}\}/gi, lead.name || 'Estimado cliente')
            .replace(/\{\{empresa\}\}/gi, lead.company_name || 'su empresa')
            .replace(/\{\{email\}\}/gi, lead.email || '')
            .replace(/\{\{telefono\}\}/gi, lead.phone || '')
            .replace(/\{\{ciudad\}\}/gi, lead.city || '')
            .replace(/\{\{pais\}\}/gi, lead.country || '');
    },

    /**
     * Filtra leads según criterios JSONB dinámicos
     */
    async getFilteredLeads(
        companyId: string,
        filters: any = {},
        limit?: number
    ): Promise<any[]> {
        let query = supabase
            .from('leads')
            .select('id, name, email, phone, company_name, city, country, status, priority, tags, company_id')
            .eq('company_id', companyId);

        // Aplicar filtros dinámicamente
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }

        if (filters.priority) {
            if (Array.isArray(filters.priority)) {
                query = query.in('priority', filters.priority);
            } else {
                query = query.eq('priority', filters.priority);
            }
        }

        if (filters.city) {
            query = query.eq('city', filters.city);
        }

        if (filters.country) {
            query = query.eq('country', filters.country);
        }

        // Filtro de tags (asumiendo que tags es JSONB array)
        if (filters.tags && Array.isArray(filters.tags)) {
            // Nota: dependiendo de cómo esté implementado tags,
            // puede requerir una query diferente
            // Ejemplo: query = query.contains('tags', filters.tags);
        }

        // Solo leads con email/phone según el canal
        if (filters.hasEmail) {
            query = query.not('email', 'is', null);
        }

        if (filters.hasPhone) {
            query = query.not('phone', 'is', null);
        }

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error filtering leads:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Validar que los leads tienen la info necesaria para el canal
     */
    validateLeadsForChannel(leads: any[], channel: string): { valid: any[]; invalid: any[] } {
        const valid: any[] = [];
        const invalid: any[] = [];

        for (const lead of leads) {
            let isValid = false;

            switch (channel) {
                case 'email':
                    isValid = !!lead.email && lead.email.includes('@');
                    break;
                case 'whatsapp':
                case 'telegram':
                case 'sms':
                    isValid = !!lead.phone;
                    break;
                default:
                    isValid = true;
            }

            if (isValid) {
                valid.push(lead);
            } else {
                invalid.push(lead);
            }
        }

        return { valid, invalid };
    },

    /**
     * Obtener preview de la campaña (primeros 5 leads)
     */
    async getCampaignPreview(campaignId: string): Promise<any[]> {
        const { data: campaign } = await supabase
            .from('marketing_campaigns')
            .select('company_id, type, content, subject, audience_filters')
            .eq('id', campaignId)
            .single();

        if (!campaign) return [];

        const leads = await this.getFilteredLeads(
            campaign.company_id,
            campaign.audience_filters,
            5
        );

        return leads.map(lead => ({
            ...lead,
            personalizedContent: this.personalizeContent(campaign.content, lead),
            personalizedSubject: campaign.subject ? this.personalizeContent(campaign.subject, lead) : null
        }));
    },

    /**
     * Pausar envío de campaña activa
     */
    async pauseCampaign(campaignId: string): Promise<void> {
        // Cancelar mensajes pendientes
        await messageQueueService.cancelCampaign(campaignId);

        // Actualizar estado
        await supabase
            .from('marketing_campaigns')
            .update({ status: 'archived' })
            .eq('id', campaignId);
    }
};
