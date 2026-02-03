// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 10; // Procesar 10 mensajes por invocación
const RATE_LIMITS = {
    telegram: 30, // 30 msg/segundo (Telegram permite hasta 30)
    whatsapp: 10, // 10 msg/segundo (depende del proveedor)
    email: 50,    // 50 emails/segundo
    sms: 10       // 10 sms/segundo
};

interface QueueMessage {
    id: string;
    campaign_id: string;
    lead_id: string;
    company_id: string;
    channel: 'telegram' | 'whatsapp' | 'email' | 'sms';
    content: string;
    subject?: string;
    metadata: any;
    retry_count: number;
}

Deno.serve(async (req) => {
    try {
        console.log('🚀 Processing message queue...');

        // 1. Obtener mensajes pendientes
        const { data: messages, error: fetchError } = await supabase
            .from('marketing_message_queue')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_at', new Date().toISOString())
            .order('created_at', { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchError) {
            console.error('Error fetching messages:', fetchError);
            throw fetchError;
        }

        if (!messages || messages.length === 0) {
            console.log('✅ No pending messages');
            return new Response(
                JSON.stringify({ processed: 0, message: 'No pending messages' }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        console.log(`📨 Found ${messages.length} pending messages`);

        // 2. Agrupar por canal para rate limiting
        const grouped = messages.reduce((acc: Record<string, QueueMessage[]>, msg: any) => {
            acc[msg.channel] = acc[msg.channel] || [];
            acc[msg.channel].push(msg);
            return acc;
        }, {});

        // 3. Procesar cada canal con rate limiting
        const results = [];

        for (const [channel, msgs] of Object.entries(grouped)) {
            console.log(`📡 Processing ${msgs.length} ${channel} messages`);

            for (const msg of msgs) {
                try {
                    // Marcar como enviando
                    await updateMessageStatus(msg.id, 'sending');

                    // Enviar según canal
                    await sendMessage(channel, msg);

                    // Marcar como enviado
                    await updateMessageStatus(msg.id, 'sent', {
                        sent_at: new Date().toISOString()
                    });

                    // Actualizar stats de campaña
                    await updateCampaignStats(msg.campaign_id, 'sent');

                    results.push({
                        id: msg.id,
                        channel,
                        status: 'sent',
                        lead_id: msg.lead_id
                    });

                    console.log(`✅ Sent ${channel} message to lead ${msg.lead_id}`);

                    // Rate limiting delay
                    const rateLimit = RATE_LIMITS[channel as keyof typeof RATE_LIMITS] || 10;
                    const delayMs = 1000 / rateLimit;
                    await sleep(delayMs);

                } catch (error) {
                    console.error(`❌ Failed to send ${channel} message:`, error);

                    // Determinar si reintentar o marcar como fallido permanente
                    const shouldRetry = msg.retry_count < 3;

                    await updateMessageStatus(msg.id, shouldRetry ? 'pending' : 'failed', {
                        error: error.message,
                        retry_count: msg.retry_count + 1
                    });

                    results.push({
                        id: msg.id,
                        channel,
                        status: shouldRetry ? 'retry' : 'failed',
                        error: error.message
                    });
                }
            }
        }

        console.log(`✅ Processed ${results.length} messages`);

        return new Response(
            JSON.stringify({
                processed: results.length,
                results,
                breakdown: {
                    sent: results.filter(r => r.status === 'sent').length,
                    failed: results.filter(r => r.status === 'failed').length,
                    retry: results.filter(r => r.status === 'retry').length
                }
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('❌ Queue processor error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
});

async function sendMessage(channel: string, message: QueueMessage) {
    // Obtener info del lead
    const { data: lead } = await supabase
        .from('leads')
        .select('phone, email, name')
        .eq('id', message.lead_id)
        .single();

    if (!lead) {
        throw new Error(`Lead not found: ${message.lead_id}`);
    }

    switch (channel) {
        case 'telegram':
            await sendTelegram(lead, message);
            break;

        case 'whatsapp':
            await sendWhatsApp(lead, message);
            break;

        case 'email':
            await sendEmail(lead, message);
            break;

        case 'sms':
            await sendSMS(lead, message);
            break;

        default:
            throw new Error(`Unsupported channel: ${channel}`);
    }
}

async function sendTelegram(lead: any, message: QueueMessage) {
    const { error } = await supabase.functions.invoke('send-telegram-message', {
        body: {
            chat_id: lead.phone, // Asumiendo que phone contiene telegram chat_id
            text: message.content,
            parse_mode: 'Markdown'
        }
    });

    if (error) throw error;
}

async function sendWhatsApp(lead: any, message: QueueMessage) {
    const { error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
            to: lead.phone,
            message: message.content
        }
    });

    if (error) throw error;
}

async function sendEmail(lead: any, message: QueueMessage) {
    if (!lead.email) {
        throw new Error('Lead has no email');
    }

    // Obtener configuración SMTP de la empresa
    const { data: integration } = await supabase
        .from('marketing_integrations')
        .select('settings')
        .eq('company_id', message.company_id)
        .eq('provider', 'smtp')
        .eq('is_active', true)
        .single();

    if (!integration) {
        throw new Error('No SMTP configuration found for company');
    }

    // TODO: Implementar envío real de email con SMTP
    // Por ahora, solo loggear
    console.log(`📧 Would send email to ${lead.email}:`, {
        subject: message.subject || 'Notificación',
        content: message.content
    });

    // Temporalmente marcar como enviado para testing
    // await sendEmailViaSMTP(lead.email, message.subject, message.content, integration.settings);
}

async function sendSMS(lead: any, message: QueueMessage) {
    if (!lead.phone) {
        throw new Error('Lead has no phone');
    }

    // TODO: Implementar con Twilio u otro proveedor
    console.log(`📱 Would send SMS to ${lead.phone}:`, message.content);
}

async function updateMessageStatus(
    messageId: string,
    status: string,
    updates: any = {}
) {
    const { error } = await supabase
        .from('marketing_message_queue')
        .update({ status, ...updates })
        .eq('id', messageId);

    if (error) {
        console.error('Error updating message status:', error);
        throw error;
    }
}

async function updateCampaignStats(campaignId: string, event: 'sent' | 'delivered' | 'opened' | 'clicked') {
    // Obtener stats actuales
    const { data: campaign } = await supabase
        .from('marketing_campaigns')
        .select('stats')
        .eq('id', campaignId)
        .single();

    if (!campaign) return;

    const stats = campaign.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
    stats[event] = (stats[event] || 0) + 1;

    // Actualizar
    await supabase
        .from('marketing_campaigns')
        .update({ stats })
        .eq('id', campaignId);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
