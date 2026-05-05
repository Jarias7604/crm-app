import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Generate HMAC-SHA256 signature for webhook payload verification.
 * Receivers can verify: X-Arias-Signature = HMAC-SHA256(secret, body)
 */
async function signPayload(secret: string, body: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { event_type, company_id, payload } = await req.json();

        if (!event_type || !company_id) {
            throw new Error('event_type and company_id are required');
        }

        // Fetch all active webhooks for this company that listen to this event
        const { data: webhooks, error: webhookError } = await supabase
            .from('company_webhooks')
            .select('*')
            .eq('company_id', company_id)
            .eq('is_active', true)
            .contains('events', [event_type]);

        if (webhookError) throw webhookError;
        if (!webhooks || webhooks.length === 0) {
            return new Response(JSON.stringify({ dispatched: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const eventPayload = {
            event: event_type,
            company_id,
            timestamp: new Date().toISOString(),
            data: payload ?? {}
        };
        const bodyStr = JSON.stringify(eventPayload);

        let dispatched = 0;
        let failed = 0;

        // Dispatch to all matching webhooks in parallel
        const deliveries = webhooks.map(async (webhook: any) => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'AriasCRM-Webhook/1.0',
                'X-Arias-Event': event_type,
                'X-Arias-Timestamp': eventPayload.timestamp,
            };

            // Sign with HMAC if secret is configured
            if (webhook.secret) {
                headers['X-Arias-Signature'] = await signPayload(webhook.secret, bodyStr);
            }

            let responseStatus = 0;
            let responseBody = '';
            let success = false;

            try {
                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: bodyStr,
                    signal: AbortSignal.timeout(10_000), // 10 second timeout
                });
                responseStatus = response.status;
                responseBody = await response.text().catch(() => '');
                success = response.ok;
            } catch (fetchErr) {
                responseBody = String(fetchErr);
                success = false;
            }

            // Log delivery result
            await supabase.from('webhook_delivery_logs').insert({
                webhook_id: webhook.id,
                company_id,
                event_type,
                payload: eventPayload,
                status: success ? 'success' : 'failed',
                response_status: responseStatus,
                response_body: responseBody.substring(0, 2000), // cap at 2KB
                delivered_at: success ? new Date().toISOString() : null,
            });

            // Update failure count & last_triggered_at on the webhook itself
            await supabase.from('company_webhooks').update({
                last_triggered_at: new Date().toISOString(),
                failure_count: success ? 0 : webhook.failure_count + 1,
                // Auto-disable after 10 consecutive failures
                is_active: success ? true : webhook.failure_count + 1 < 10,
            }).eq('id', webhook.id);

            if (success) dispatched++; else failed++;
        });

        await Promise.all(deliveries);

        return new Response(JSON.stringify({ dispatched, failed, total: webhooks.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
