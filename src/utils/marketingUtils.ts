/**
 * MARKETING UTILITIES
 * Funciones helper para el módulo de marketing
 */

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida formato de teléfono (internacional)
 */
export function isValidPhone(phone: string): boolean {
    if (!phone) return false;
    // Acepta formatos: +50612345678, 50612345678, etc.
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
}

/**
 * Formatea número de teléfono a formato internacional
 */
export function formatPhoneInternational(phone: string, defaultCountryCode: string = '+506'): string {
    if (!phone) return '';

    // Limpiar
    const cleaned = phone.replace(/[\s()-]/g, '');

    // Si ya tiene +, retornar
    if (cleaned.startsWith('+')) return cleaned;

    // Si no tiene código de país, agregar default
    return defaultCountryCode + cleaned;
}

/**
 * Detecta el canal preferido de un lead
 */
export function detectPreferredChannel(lead: any): 'email' | 'whatsapp' | 'telegram' | 'sms' | null {
    // Prioridad: WhatsApp > Email > Telegram > SMS
    if (lead.phone && isValidPhone(lead.phone)) {
        // Asumir WhatsApp si tiene teléfono
        return 'whatsapp';
    }
    if (lead.email && isValidEmail(lead.email)) {
        return 'email';
    }
    return null;
}

/**
 * Calcula mejor hora para enviar según timezone
 */
export function calculateOptimalSendTime(_timezone: string = 'America/Costa_Rica'): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 10:00 AM del día siguiente
    tomorrow.setHours(10, 0, 0, 0);

    return tomorrow;
}

/**
 * Estima duración de envío basado en cantidad y rate limit
 */
export function estimateSendDuration(
    messageCount: number,
    channel: 'whatsapp' | 'telegram' | 'email' | 'sms'
): {
    duration: number; // en segundos
    formattedDuration: string;
} {
    const rateLimits = {
        telegram: 30, // msg/seg
        whatsapp: 10,
        email: 50,
        sms: 10
    };

    const rateLimit = rateLimits[channel];
    const durationSeconds = Math.ceil(messageCount / rateLimit);

    // Formatear duración
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    let formatted = '';
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0) formatted += `${minutes}m `;
    if (seconds > 0 || formatted === '') formatted += `${seconds}s`;

    return {
        duration: durationSeconds,
        formattedDuration: formatted.trim()
    };
}

/**
 * Trunca texto para preview
 */
export function truncateText(text: string, maxLength: number = 100): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

/**
 * Sanitiza contenido para evitar inyección en templates
 */
export function sanitizeTemplateContent(content: string): string {
    if (!content) return '';

    // Remover scripts y tags peligrosos
    return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .trim();
}

/**
 * Extrae variables de un template
 */
export function extractTemplateVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }

    return variables;
}

/**
 * Valida que todas las variables requeridas están presentes en el lead
 */
export function validateTemplateVariables(
    template: string,
    lead: any
): { valid: boolean; missingVars: string[] } {
    const requiredVars = extractTemplateVariables(template);
    const missingVars: string[] = [];

    for (const varName of requiredVars) {
        if (!lead[varName] || lead[varName].trim() === '') {
            missingVars.push(varName);
        }
    }

    return {
        valid: missingVars.length === 0,
        missingVars
    };
}

/**
 * Calcula score de calidad del lead para priorización
 */
export function calculateLeadQuality(lead: any): number {
    let score = 0;

    // Email válido: +20
    if (lead.email && isValidEmail(lead.email)) score += 20;

    // Teléfono válido: +20
    if (lead.phone && isValidPhone(lead.phone)) score += 20;

    // Nombre completo: +10
    if (lead.name && lead.name.split(' ').length >= 2) score += 10;

    // Empresa: +15
    if (lead.company_name) score += 15;

    // Status progresado: +20
    if (lead.status === 'interesado') score += 20;
    if (lead.status === 'negociacion') score += 30;

    // Prioridad alta: +10
    if (lead.priority === 'alta') score += 10;

    // Lead value: +15
    if (lead.value && lead.value > 0) score += 15;

    return Math.min(score, 100); // Max 100
}

/**
 * Genera sugerencias de contenido según el contexto
 */
export function suggestContentForContext(
    leadStatus: string,
    leadValue: number,
    industry?: string
): string {
    if (leadStatus === 'nuevo') {
        return `Hola {{nombre}}, bienvenido a {{empresa}}! Nos especializamos en ${industry || 'soluciones empresariales'}. ¿En qué podemos ayudarte?`;
    }

    if (leadStatus === 'interesado' && leadValue > 5000) {
        return `{{nombre}}, veo que estás interesado en nuestra solución premium. Te he preparado una propuesta personalizada que se ajusta a tus necesidades...`;
    }

    if (leadStatus === 'negociacion') {
        return `Hola {{nombre}}, siguiendo nuestra conversación, aquí están los detalles finales de nuestro acuerdo...`;
    }

    // Default
    return `Hola {{nombre}}, gracias por tu interés en {{empresa}}. ¿Cómo podemos ayudarte hoy?`;
}

/**
 * Genera reporte de campaña
 */
export function generateCampaignReport(stats: any): {
    successRate: number;
    failureRate: number;
    openRate?: number;
    clickRate?: number;
    recommendations: string[];
} {
    const total = stats.total || 1;
    const successRate = ((stats.sent || 0) / total) * 100;
    const failureRate = ((stats.failed || 0) / total) * 100;

    const recommendations: string[] = [];

    // Análisis y recomendaciones
    if (successRate < 80) {
        recommendations.push('⚠️ Tasa de éxito baja. Revisar configuración de integraciones.');
    }

    if (failureRate > 20) {
        recommendations.push('❌ Alta tasa de fallos. Validar datos de contacto antes de enviar.');
    }

    if (stats.opened && stats.sent) {
        const openRate = (stats.opened / stats.sent) * 100;
        if (openRate < 20) {
            recommendations.push('📧 Baja tasa de apertura. Mejorar asuntos de emails.');
        }
    }

    if (successRate > 95) {
        recommendations.push('✅ Excelente tasa de entrega!');
    }

    return {
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        openRate: stats.opened ? Math.round(((stats.opened / stats.sent) * 100) * 100) / 100 : undefined,
        clickRate: stats.clicked ? Math.round(((stats.clicked / stats.sent) * 100) * 100) / 100 : undefined,
        recommendations
    };
}
