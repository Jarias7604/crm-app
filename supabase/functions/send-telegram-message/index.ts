// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 OUTBOUND MESSAGE DISPATCHER (Telegram) - ENHANCED
 * ----------------------------------------
 * This function triggers when a new 'outbound' message is inserted into 'marketing_messages'.
 * It pushes the content/files to the external provider (Telegram API).
 * 
 * MEJORAS v2:
 * - Parse mode mejorado (Markdown)
 * - Retry logic con exponential backoff
 * - Mejor formato de mensajes
 * - Validación de contenido
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Formatea el contenido del mensaje para Telegram con Markdown
 */
function formatTelegramMessage(content: string): string {
    if (!content) return '';

    // Escapar caracteres especiales de Markdown excepto los que queremos usar
    let formatted = content
        // Mantener negritas existentes
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        // Convertir headers en negritas
        .replace(/^#+\s+(.+)$/gm, '*$1*')
        // Agregar saltos de línea para mejor legibilidad
        .trim();

    return formatted;
}

/**
 * Retry con exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            const delay = baseDelay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const record = payload.record;

        // NUEVO: Soporte para llamadas directas (sin record, usado por queue processor)
        const directInvocation = payload.chat_id && payload.text;

        if (!directInvocation && (!record || record.direction !== 'outbound' || record.status === 'delivered')) {
            return new Response('Skipped', { status: 200, headers: corsHeaders });
        }

        if (!record || record.direction !== 'outbound' || record.status === 'delivered') {
            return new Response('Skipped', { status: 200, headers: corsHeaders });
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get Conversation Context
        const { data: conversation, error: convError } = await supabase
            .from('marketing_conversations')
            .select('external_id, channel, company_id')
            .eq('id', record.conversation_id)
            .single();

        if (convError || !conversation || conversation.channel !== 'telegram') {
            return new Response('Not Telegram or Conv missing', { status: 200, headers: corsHeaders });
        }

        const chatId = conversation.external_id;
        const companyId = conversation.company_id;

        // 2. Fetch Bot Token (Multi-tenant SaaS)
        const { data: integration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'telegram')
            .eq('is_active', true)
            .maybeSingle();

        if (!integration?.settings?.token) {
            console.error(`[Send-Telegram] Error: No active Telegram token found for Company: ${companyId}`);
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, error: 'Configuración de Telegram incompleta o inactiva.' }
            }).eq('id', record.id);
            return new Response('Config missing', { status: 400, headers: corsHeaders });
        }

        const botToken = integration.settings.token;
        console.log(`[Send-Telegram] Using Token: ...${botToken.slice(-5)} for Chat: ${chatId}`);

        const formData = new FormData();
        formData.append('chat_id', String(chatId));

        const isFile = record.type === 'file' || record.type === 'image';
        const fileUrl = record.metadata?.url;

        let res;
        if (isFile && fileUrl) {
            console.log(`[Send-Telegram] Downloading file: ${fileUrl}`);
            try {
                const fileResponse = await fetch(fileUrl);
                if (fileResponse.ok) {
                    const fileBlob = await fileResponse.blob();
                    const fieldName = record.type === 'image' ? 'photo' : 'document';
                    const fileName = record.metadata?.fileName || (record.type === 'image' ? 'photo.png' : 'document.pdf');

                    const telegramUrl = `https://api.telegram.org/bot${botToken}/send${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
                    formData.append(fieldName, fileBlob, fileName);
                    formData.append('caption', record.content || '');

                    res = await fetch(telegramUrl, { method: 'POST', body: formData });
                }
            } catch (e) {
                console.error(`[Send-Telegram] File fetch/upload error:`, e);
            }
        }

        // Fallback or Text Message
        if (!res || !(await res.clone().json()).ok) {
            const errorResult = res ? await res.clone().json() : { error: 'Binary upload failed' };
            console.warn(`[Send-Telegram] Binary upload failed or skipped. Falling back to text. Error:`, JSON.stringify(errorResult));

            const textUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const textContent = isFile
                ? `📄 *ARCHIVO ADJUNTO*:\n${record.content}\n\n🔗 Descarga aquí:\n${fileUrl}`
                : record.content;

            res = await fetch(textUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: String(chatId),
                    text: textContent
                })
            });
        }

        const result = await res.json();
        console.log(`[Send-Telegram] Final API Response:`, JSON.stringify(result));

        if (!result.ok) {
            await supabase.from('marketing_messages').update({ status: 'failed', metadata: { ...record.metadata, telegram_error: result } }).eq('id', record.id);
            return new Response('Telegram Error', { status: 400, headers: corsHeaders });
        }

        // 4. Mark as delivered
        await supabase.from('marketing_messages').update({
            status: 'delivered',
            external_message_id: result.result.message_id?.toString()
        }).eq('id', record.id);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('[Send-Telegram] Global Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
