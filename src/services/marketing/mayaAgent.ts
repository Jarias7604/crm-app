import { supabase } from '../supabase';
import { auditTrailService } from './auditTrail';
import toast from 'react-hot-toast';

export interface CampaignContentRequest {
    topic: string;
    tone: string;
    audience: string;
    channel: 'email' | 'whatsapp' | 'telegram';
}

export interface CampaignContentResult {
    subject?: string;
    body: string;
}

export const mayaAgent = {
    /**
     * Generate highly persuasive copy for a campaign
     */
    async generateCampaignContent(companyId: string, request: CampaignContentRequest): Promise<CampaignContentResult> {
        const { data, error } = await supabase.functions.invoke('maya-agent', {
            body: {
                companyId,
                action: 'generate_campaign',
                payload: request
            }
        });

        if (error) {
            console.error('Maya Error:', error);
            // Fallback mock to ensure the UI never breaks during demo/development
            toast.error('Usando versión Demo: Configura OpenAI en Integraciones para usar la IA real.');
            return {
                subject: request.topic.length > 20 ? request.topic.substring(0, 20) + '...' : request.topic,
                body: `**¡Hola!**\n\nNotamos tu interés en **${request.topic}**. Como experto en este rubro, quería asegurarme de que no te pierdas esta oportunidad exclusiva.\n\n*Por favor, avísame si tienes un momento para conversar.*\n\nSaludos,\nEl equipo.`
            };
        }

        // Log the decision
        auditTrailService.logDecision({
            companyId,
            agentName: 'maya',
            decisionType: 'content_generated',
            reasoning: `Maya generó copy para campaña sobre "${request.topic}" usando tono ${request.tone} para el canal ${request.channel}.`,
            contextSnapshot: request,
            confidence: 95
        });

        return data as CampaignContentResult;
    },

    /**
     * Enhance an existing text block to be more professional
     */
    async enhanceTemplate(companyId: string, text: string, goal?: string): Promise<string> {
        const { data, error } = await supabase.functions.invoke('maya-agent', {
            body: {
                companyId,
                action: 'enhance_template',
                payload: { text, goal }
            }
        });

        if (error) {
            console.error('Maya Enhance Error:', error);
            throw new Error(error.message || 'Error al mejorar el texto');
        }

        auditTrailService.logDecision({
            companyId,
            agentName: 'maya',
            decisionType: 'content_generated',
            reasoning: `Maya mejoró un template de texto. Objetivo: ${goal || 'General'}`,
            contextSnapshot: { originalLength: text.length },
            confidence: 90
        });

        return data.enhancedText;
    }
};
