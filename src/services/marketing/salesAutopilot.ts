/**
 * Sales Autopilot Engine — Motor de Ventas Autónomo
 * 
 * El corazón de "Arias AI Sales Agent". Lee datos reales del lead
 * (razón de pérdida, etapa, historial, valor) y ejecuta contramedidas
 * autónomas sin intervención humana.
 * 
 * CANALES DE EJECUCIÓN:
 *   → Telegram (mensaje directo al lead)
 *   → WhatsApp (mensaje con link de cotización móvil)
 *   → Email (propuesta formal con PDF adjunto)
 *   → Interno (cambio de etapa, reasignación, nota)
 * 
 * FILOSOFÍA:
 *   No sugerimos. Ejecutamos. El agente decide y actúa solo.
 *   Solo escala al humano cuando NO hay datos suficientes.
 */

import { supabase } from '../supabase';
import { logger } from '../../utils/logger';
import { massMessagingService } from './massMessagingService';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AutopilotChannel = 'telegram' | 'whatsapp' | 'email' | 'internal';
export type AutopilotActionType =
    | 'send_discount_offer'     // Precio muy alto → oferta con descuento
    | 'send_quote_link'         // Enviar link de cotización web/móvil
    | 'switch_channel'          // Cambiar canal de contacto
    | 'reactivate_lead'         // Lead inactivo → reactivar con nueva oferta
    | 'escalate_to_human'       // Caso complejo → asignar a agente senior
    | 'send_testimonial'        // Objeción de confianza → enviar casos de éxito
    | 'schedule_followup'       // Sin respuesta → programar nuevo intento
    | 'update_stage'            // Avanzar/retroceder etapa automáticamente
    | 'send_value_proposition'; // Lead frío → propuesta de valor personalizada

export interface AutopilotAction {
    type: AutopilotActionType;
    channel: AutopilotChannel;
    priority: 1 | 2 | 3;         // 1=inmediato, 2=hoy, 3=esta semana
    message: string;              // Mensaje personalizado para el lead
    internalNote: string;         // Nota interna para el agente (explica el razonamiento)
    discount?: number;            // % de descuento si aplica
    quoteLink?: string;           // Link de cotización si aplica
    reasoning: string;            // Por qué el motor tomó esta decisión
}

export interface AutopilotContext {
    lead: {
        id: string;
        name: string;
        company_name?: string;
        email?: string;
        phone?: string;
        status: string;
        value?: number;
        closing_amount?: number;
        source?: string;
        contact_count?: number;
        lost_reason_id?: string;
        lost_at_stage?: string;
        lost_notes?: string;
        next_action_notes?: string;
        last_follow_up_at?: string;
        first_follow_up_at?: string;
        created_at: string;
        ai_score?: number;
    };
    lossReason?: string;           // Texto de la razón de pérdida (resuelto del ID)
    daysSinceLastContact: number;
    daysSinceLost: number;
    daysSinceCreation: number;
}

// ─── Razones de pérdida → Estrategias de venta ──────────────────────────────

/**
 * Mapa de palabras clave en razones de pérdida → estrategia óptima.
 * Técnicas de ventas reales: objeción de precio, confianza, timing, competencia.
 */
const LOSS_REASON_PLAYBOOKS: Array<{
    keywords: string[];
    strategy: AutopilotActionType;
    channel: AutopilotChannel;
    discount?: number;
    waitDays: number;            // Esperar X días antes de ejecutar
    generateMessage: (ctx: AutopilotContext) => string;
    reasoning: string;
}> = [
    // ── OBJECIÓN DE PRECIO ───────────────────────────────────────────────────
    {
        keywords: ['precio', 'caro', 'costo', 'costoso', 'budget', 'presupuesto', 'expensive', 'alto', 'económico', 'barato'],
        strategy: 'send_discount_offer',
        channel: 'whatsapp',
        discount: 15,
        waitDays: 7,
        reasoning: 'Lead perdido por precio. Técnica: dar tiempo para que el dolor del problema crezca, luego ofrecer descuento limitado.',
        generateMessage: (ctx) => {
            const name = ctx.lead.name?.split(' ')[0] || 'estimado cliente';
            const discount = 15;
            const originalValue = ctx.lead.value || ctx.lead.closing_amount || 0;
            const discountedValue = originalValue > 0
                ? `$${Math.round(originalValue * (1 - discount / 100)).toLocaleString()}`
                : 'especial para ti';

            return `Hola ${name} 👋

Hace unos días conversamos sobre nuestros servicios para ${ctx.lead.company_name || 'tu empresa'}.

Entiendo que el presupuesto es importante, por eso quiero ofrecerte algo exclusivo:

🎯 *Oferta especial válida por 48 horas:*
✅ ${discount}% de descuento en tu implementación
✅ Soporte prioritario el primer mes gratis
✅ Capacitación incluida sin costo adicional
${originalValue > 0 ? `💰 Inversión ajustada: ${discountedValue}` : ''}

¿Te interesa que coordinemos una llamada rápida hoy?

👉 Ver cotización actualizada: {{quote_link}}`;
        },
    },

    // ── OBJECIÓN DE CONFIANZA / NO CONOCEN LA EMPRESA ───────────────────────
    {
        keywords: ['confianza', 'referencias', 'clientes', 'experiencia', 'garantía', 'seguro', 'riesgo', 'conocido', 'trust'],
        strategy: 'send_testimonial',
        channel: 'whatsapp',
        waitDays: 3,
        reasoning: 'Objeción de confianza. Técnica: prueba social — mostrar casos de éxito de empresas similares.',
        generateMessage: (ctx) => {
            const name = ctx.lead.name?.split(' ')[0] || 'estimado cliente';
            return `Hola ${name} 👋

Entiendo perfectamente tu preocupación — es una decisión importante para tu empresa.

Por eso quiero compartirte algunos casos reales de empresas como la tuya:

🏆 *Clientes que ya confían en nosotros:*
✅ Más de 150 empresas implementadas exitosamente
✅ 98% de satisfacción en implementaciones
✅ Soporte técnico 24/7 incluido

📋 *Nuestras garantías:*
• 30 días de prueba sin compromiso
• Migración de datos incluida
• Capacitación completa de tu equipo

¿Te gustaría hablar con uno de nuestros clientes actuales para que te cuente su experiencia?

👉 Ver demo en vivo: {{quote_link}}`;
        },
    },

    // ── OBJECIÓN DE TIEMPO / "AHORA NO" ─────────────────────────────────────
    {
        keywords: ['tiempo', 'ahora no', 'después', 'luego', 'más adelante', 'ocupado', 'momento', 'esperar', 'timing'],
        strategy: 'reactivate_lead',
        channel: 'email',
        waitDays: 30,
        reasoning: 'Lead en pausa por timing. Técnica: nurturing con valor — esperamos 30 días y reactivamos con contenido relevante.',
        generateMessage: (ctx) => {
            const name = ctx.lead.name?.split(' ')[0] || 'estimado cliente';
            return `Asunto: Actualización importante para ${ctx.lead.company_name || 'tu empresa'}

Hola ${name},

Hace un mes conversamos sobre automatizar los procesos de ${ctx.lead.company_name || 'tu empresa'}. Respeté que no era el momento ideal.

Hoy te escribo porque:

📌 *Novedades que pueden cambiar tu decisión:*
• Nuevo módulo de integración bancaria disponible
• Reducción del 20% en tiempo de implementación
• Nuevo plan de pagos flexibles (sin anticipo)

🎯 *¿Qué cambió para ti en este mes?*
Si tus necesidades evolucionaron, me encantaría retomar la conversación.

👉 Reservar 15 minutos: {{quote_link}}

Sin presiones. Solo me importa que encuentres la mejor solución.

Saludos,
El equipo de Arias Defense`;
        },
    },

    // ── OBJECIÓN DE COMPETENCIA ──────────────────────────────────────────────
    {
        keywords: ['competencia', 'otro', 'proveedor', 'competidor', 'alternativa', 'cotizando', 'comparando'],
        strategy: 'send_value_proposition',
        channel: 'whatsapp',
        waitDays: 5,
        reasoning: 'Comparando con competencia. Técnica: diferenciación — destacar ventajas únicas, no atacar al competidor.',
        generateMessage: (ctx) => {
            const name = ctx.lead.name?.split(' ')[0] || 'estimado cliente';
            return `Hola ${name} 👋

Entiendo que estás evaluando opciones — ¡es lo correcto para tu empresa!

Para ayudarte a comparar mejor, te comparto lo que nos diferencia:

⚡ *Por qué elegir Arias:*
✅ Implementación en 5 días (el mercado promedio: 30 días)
✅ Soporte local en español, respuesta en < 2 horas
✅ Sin contratos anuales forzosos
✅ Migración de datos incluida y gratuita
✅ Portal web + app móvil incluidos

💡 *Pregunta clave:* ¿Tu otra opción incluye soporte post-venta sin costo adicional?

¿Me permites 10 minutos para mostrarte la diferencia en vivo?

👉 Ver comparativa completa: {{quote_link}}`;
        },
    },

    // ── SIN RAZÓN ESPECÍFICA / SILENCIO ─────────────────────────────────────
    {
        keywords: ['no contestó', 'sin respuesta', 'ghosting', 'desapareció', 'inactivo', 'no responde'],
        strategy: 'switch_channel',
        channel: 'telegram',
        waitDays: 7,
        reasoning: 'Lead sin respuesta. Técnica: cambio de canal — si WhatsApp no funciona, intentar Telegram/Email.',
        generateMessage: (ctx) => {
            const name = ctx.lead.name?.split(' ')[0] || 'estimado cliente';
            return `Hola ${name}! 👋 

Te he intentado contactar por otros medios sin éxito. 

Solo quiero asegurarme de que recibiste nuestra propuesta y que puedo resolver cualquier duda que tengas.

¿Tienes 5 minutos esta semana?

👉 {{quote_link}}`;
        },
    },
];

// ─── Motor Principal de Decisión ─────────────────────────────────────────────

/**
 * analyzeAndDecide — El cerebro del Autopilot
 * 
 * Lee el contexto del lead y devuelve la mejor acción autónoma.
 * No ejecuta nada — solo decide. La ejecución está en execute().
 */
export function analyzeAndDecide(ctx: AutopilotContext): AutopilotAction | null {
    const { lead, lossReason, daysSinceLastContact, daysSinceLost } = ctx;

    // ── Caso 1: Lead perdido con razón conocida ──────────────────────────────
    if ((lead.status === 'Perdido' || lead.status === 'Erróneo') && lossReason) {
        const reasonLower = lossReason.toLowerCase();
        const lostNotesLower = (lead.lost_notes || '').toLowerCase();
        const combinedText = `${reasonLower} ${lostNotesLower}`;

        for (const playbook of LOSS_REASON_PLAYBOOKS) {
            const matched = playbook.keywords.some(kw => combinedText.includes(kw));
            if (matched && daysSinceLost >= playbook.waitDays) {
                const message = playbook.generateMessage(ctx);
                return {
                    type: playbook.strategy,
                    channel: playbook.channel,
                    priority: 1,
                    message,
                    discount: playbook.discount,
                    internalNote: `🤖 AI Autopilot: Detecté razón "${lossReason}". ${playbook.reasoning} Han pasado ${daysSinceLost} días desde la pérdida.`,
                    reasoning: playbook.reasoning,
                };
            }
        }
    }

    // ── Caso 2: Lead inactivo de alto valor (fue caliente, ahora frío) ───────
    const score = lead.ai_score || 0;
    if (score >= 50 && daysSinceLastContact >= 14 && lead.status !== 'Perdido') {
        return {
            type: 'reactivate_lead',
            channel: 'whatsapp',
            priority: 2,
            message: `Hola ${lead.name?.split(' ')[0] || ''} 👋 Han pasado algunos días desde nuestra última conversación. ¿Cómo va el proyecto de ${lead.company_name || 'tu empresa'}? Tengo algo especial que puede interesarte 👉 {{quote_link}}`,
            internalNote: `🤖 AI Autopilot: Lead de alto score (${score}) inactivo por ${daysSinceLastContact} días. Reactivación automática recomendada.`,
            reasoning: `Lead con score ${score}/100 sin contacto por ${daysSinceLastContact} días. Alto potencial de reactivación.`,
        };
    }

    // ── Caso 3: Demasiados intentos sin respuesta → cambiar canal ────────────
    if ((lead.contact_count || 0) >= 4 && daysSinceLastContact >= 7) {
        const currentChannel = lead.source?.toLowerCase().includes('telegram') ? 'telegram' : 'email';
        return {
            type: 'switch_channel',
            channel: currentChannel === 'telegram' ? 'email' : 'whatsapp',
            priority: 2,
            message: `Hola ${lead.name?.split(' ')[0] || ''}, te contacto por este medio ya que no he podido conectar contigo antes. ¿Tienes 5 minutos esta semana? 👉 {{quote_link}}`,
            internalNote: `🤖 AI Autopilot: ${lead.contact_count} intentos sin respuesta. Cambiando canal de contacto automáticamente.`,
            reasoning: `${lead.contact_count} intentos fallidos. El canal actual no está funcionando — probar canal alternativo.`,
        };
    }

    // ── Caso 4: Lead reciente sin seguimiento ────────────────────────────────
    if (ctx.daysSinceCreation <= 3 && (lead.contact_count || 0) === 0) {
        return {
            type: 'send_quote_link',
            channel: lead.phone ? 'whatsapp' : 'email',
            priority: 1,
            message: `Hola ${lead.name?.split(' ')[0] || ''} 👋 Bienvenido! Vi que te registraste hace poco. Soy tu asesor personal — ¿te gustaría ver cómo podemos ayudar a ${lead.company_name || 'tu empresa'}? 👉 {{quote_link}}`,
            internalNote: `🤖 AI Autopilot: Lead nuevo (${ctx.daysSinceCreation} días) sin primer contacto. Iniciando secuencia de bienvenida.`,
            reasoning: 'Lead nuevo sin contacto inicial. Los primeros 72 horas son críticos para la conversión.',
        };
    }

    // No hay acción recomendada
    return null;
}

// ─── Ejecución de Acciones ────────────────────────────────────────────────────

/**
 * executeAction — Envía el mensaje por el canal correcto
 * Usa el massMessagingService existente como motor de envío.
 */
export async function executeAction(
    action: AutopilotAction,
    lead: AutopilotContext['lead'],
    companyId: string,
    quoteLinkBase?: string
): Promise<{ success: boolean; channel: string; error?: string }> {
    // Reemplazar {{quote_link}} con el link real
    const quoteLink = quoteLinkBase
        ? `${quoteLinkBase}?lead=${lead.id}`
        : `https://crm-app-v2.vercel.app/cotizacion-publica?lead=${lead.id}`;

    const finalMessage = action.message.replace(/\{\{quote_link\}\}/g, quoteLink);

    try {
        // ── Registrar nota interna en el lead ────────────────────────────────
        await supabase.from('leads').update({
            next_action_notes: action.internalNote,
        }).eq('id', lead.id);

        // ── Enviar por canal correspondiente ─────────────────────────────────
        switch (action.channel) {
            case 'whatsapp':
            case 'telegram':
            case 'email': {
                // Usar el motor de campañas existente para envío individual
                await massMessagingService.personalizeContent(finalMessage, lead);

                // Registrar en message_queue
                const { error } = await supabase.from('message_queue').insert({
                    lead_id: lead.id,
                    company_id: companyId,
                    channel: action.channel,
                    content: finalMessage,
                    subject: action.type === 'send_discount_offer'
                        ? `Oferta especial para ${lead.company_name || lead.name}`
                        : `Seguimiento - ${lead.name}`,
                    scheduled_at: new Date().toISOString(),
                    metadata: {
                        autopilot: true,
                        action_type: action.type,
                        reasoning: action.reasoning,
                        discount: action.discount,
                    }
                });

                if (error) throw error;
                break;
            }

            case 'internal': {
                // Solo registrar nota — no enviar mensaje externo
                logger.info('[Autopilot] Internal action registered', { leadId: lead.id, action: action.type });
                break;
            }
        }

        // Register in activity log (fire-and-forget)
        void supabase.from('lead_activity').insert({
            lead_id: lead.id,
            company_id: companyId,
            activity_type: 'autopilot',
            description: `🤖 Autopilot: ${action.type} via ${action.channel}`,
            metadata: {
                action,
                message_preview: finalMessage.substring(0, 200),
            }
        });

        return { success: true, channel: action.channel };
    } catch (err: any) {
        logger.error('[Autopilot] Action execution failed', err, { leadId: lead.id, action: action.type });
        return { success: false, channel: action.channel, error: err.message };
    }
}

// ─── Pipeline de Proceso Completo ────────────────────────────────────────────

/**
 * runAutopilotForLead — Analiza UN lead y ejecuta la acción correcta
 * Punto de entrada principal del motor.
 */
export async function runAutopilotForLead(
    leadId: string,
    companyId: string,
    options: { execute?: boolean; quoteLinkBase?: string } = {}
): Promise<{ action: AutopilotAction | null; executed: boolean; result?: any }> {
    const { execute = false, quoteLinkBase } = options;

    // 1. Cargar datos del lead
    const { data: lead, error } = await supabase
        .from('leads')
        .select('id, name, company_name, email, phone, status, value, closing_amount, source, contact_count, lost_reason_id, lost_at_stage, lost_notes, next_action_notes, last_follow_up_at, first_follow_up_at, created_at, ai_score')
        .eq('id', leadId)
        .single();

    if (error || !lead) {
        logger.error('[Autopilot] Lead not found', error, { leadId });
        return { action: null, executed: false };
    }

    // 2. Resolver razón de pérdida (ID → texto)
    let lossReason: string | undefined;
    if (lead.lost_reason_id) {
        const { data: reason } = await supabase
            .from('loss_reasons')
            .select('reason')
            .eq('id', lead.lost_reason_id)
            .single();
        lossReason = reason?.reason;
    }

    // 3. Calcular métricas temporales
    const now = Date.now();
    const lastContact = lead.last_follow_up_at ? new Date(lead.last_follow_up_at).getTime() : new Date(lead.created_at).getTime();
    const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
    const daysSinceLost = lead.status === 'Perdido'
        ? Math.floor((now - lastContact) / (1000 * 60 * 60 * 24))
        : 0;
    const daysSinceCreation = Math.floor((now - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));

    // 4. Construir contexto
    const ctx: AutopilotContext = {
        lead: lead as any,
        lossReason,
        daysSinceLastContact,
        daysSinceLost,
        daysSinceCreation,
    };

    // 5. Decisión del motor
    const action = analyzeAndDecide(ctx);

    if (!action) {
        return { action: null, executed: false };
    }

    // 6. Ejecutar si se solicita
    if (execute) {
        const result = await executeAction(action, lead as any, companyId, quoteLinkBase);
        return { action, executed: true, result };
    }

    return { action, executed: false };
}

/**
 * runAutopilotBatch — Procesa todos los leads de una empresa
 * Ideal para pg_cron o ejecución diaria automática
 */
export async function runAutopilotBatch(
    companyId: string,
    options: { execute?: boolean; maxLeads?: number } = {}
): Promise<{ processed: number; actionsFound: number; executed: number }> {
    const { execute = false, maxLeads = 100 } = options;

    const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('company_id', companyId)
        .in('status', ['Perdido', 'En seguimiento', 'En Nutrición', 'Prospecto', 'Sin respuesta'])
        .limit(maxLeads);

    if (!leads || leads.length === 0) {
        return { processed: 0, actionsFound: 0, executed: 0 };
    }

    let actionsFound = 0;
    let executed = 0;

    for (const { id } of leads) {
        const result = await runAutopilotForLead(id, companyId, { execute });
        if (result.action) {
            actionsFound++;
            if (result.executed) executed++;
        }
    }

    logger.info('[Autopilot] Batch complete', {
        companyId,
        processed: leads.length,
        actionsFound,
        executed,
    });

    return { processed: leads.length, actionsFound, executed };
}
