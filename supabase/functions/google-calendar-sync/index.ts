import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { action, code, redirect_uri, user_id, company_id, integration_id } = await req.json();

        // ─── ACTION: exchange_code ───────────────────────────────────────────────
        if (action === 'exchange_code') {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: GOOGLE_CLIENT_ID!,
                    client_secret: GOOGLE_CLIENT_SECRET!,
                    redirect_uri,
                    grant_type: 'authorization_code',
                })
            });

            const tokens = await tokenResponse.json();
            if (tokens.error) {
                throw new Error(tokens.error_description || tokens.error);
            }

            // Get Google account email
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const googleProfile = await profileResponse.json();

            // Store integration — field names match calendar_integrations schema exactly
            // UNIQUE constraint: (company_id, user_id, provider)
            const { data, error } = await supabase
                .from('calendar_integrations')
                .upsert({
                    user_id,
                    company_id,
                    provider: 'google',
                    google_email: googleProfile.email,       // ← correct field name
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    is_active: true,
                    last_synced_at: new Date().toISOString(),
                }, { onConflict: 'company_id,user_id,provider' })  // ← matches UNIQUE constraint
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, integration: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ─── ACTION: fetch_events ────────────────────────────────────────────────
        if (action === 'fetch_events') {
            const { data: integration, error: intError } = await supabase
                .from('calendar_integrations')
                .select('*')
                .eq('id', integration_id)
                .single();

            if (intError || !integration) throw new Error('Integration not found');

            let accessToken = integration.access_token;

            // Refresh token if expired (or within 60s of expiring)
            const expiresAt = new Date(integration.token_expires_at);
            const isExpired = expiresAt.getTime() - Date.now() < 60_000;

            if (isExpired) {
                const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: GOOGLE_CLIENT_ID!,
                        client_secret: GOOGLE_CLIENT_SECRET!,
                        refresh_token: integration.refresh_token,
                        grant_type: 'refresh_token',
                    })
                });

                const tokens = await refreshResponse.json();
                if (!tokens.error) {
                    accessToken = tokens.access_token;
                    await supabase
                        .from('calendar_integrations')
                        .update({
                            access_token: tokens.access_token,
                            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                            last_synced_at: new Date().toISOString(),
                        })
                        .eq('id', integration.id);
                } else {
                    // Refresh failed — mark integration inactive so UI prompts reconnection
                    await supabase
                        .from('calendar_integrations')
                        .update({ is_active: false })
                        .eq('id', integration.id);
                    throw new Error('Token expirado. Por favor reconecta Google Calendar.');
                }
            }

            // ── Step 1: Fetch all calendars the user has access to ──────────────
            const calListResponse = await fetch(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const calListData = await calListResponse.json();

            if (calListData.error) {
                throw new Error(calListData.error.message || 'No se pudo obtener la lista de calendarios');
            }

            const calendars = (calListData.items || []) as Array<{
                id: string;
                summary: string;
                primary?: boolean;
                selected?: boolean;
                accessRole?: string;
            }>;

            // ── Step 2: Fetch events from ALL accessible calendars ──────────────
            // Range: 60 days back to 90 days forward (wider than UI window for buffer)
            const timeMin = new Date();
            timeMin.setDate(timeMin.getDate() - 60);
            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + 90);

            const allEvents: any[] = [];

            const eventFetches = calendars
                .filter(cal => cal.accessRole !== 'freeBusyReader') // skip read-only busy calendars
                .map(async (cal) => {
                    try {
                        const url = [
                            'https://www.googleapis.com/calendar/v3/calendars/',
                            encodeURIComponent(cal.id),
                            '/events?timeMin=', timeMin.toISOString(),
                            '&timeMax=', timeMax.toISOString(),
                            '&singleEvents=true&orderBy=startTime&maxResults=500'
                        ].join('');

                        const eventsResponse = await fetch(url, {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        });
                        const eventsData = await eventsResponse.json();

                        if (!eventsData.error && eventsData.items) {
                            const tagged = eventsData.items.map((ev: any) => ({
                                ...ev,
                                _calendarId: cal.id,
                                _calendarName: cal.summary,
                                _isPrimary: cal.primary === true,
                            }));
                            allEvents.push(...tagged);
                        }
                    } catch {
                        // Skip calendars that fail silently (access revoked, etc.)
                    }
                });

            await Promise.all(eventFetches);

            // Sort all events by start time
            allEvents.sort((a, b) => {
                const aStart = a.start?.dateTime || a.start?.date || '';
                const bStart = b.start?.dateTime || b.start?.date || '';
                return aStart.localeCompare(bStart);
            });

            // Update last_synced_at timestamp
            await supabase
                .from('calendar_integrations')
                .update({ last_synced_at: new Date().toISOString() })
                .eq('id', integration.id);

            return new Response(JSON.stringify({ success: true, events: allEvents, total: allEvents.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error('Invalid action');
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
