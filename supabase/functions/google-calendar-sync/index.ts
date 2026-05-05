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

        if (action === 'exchange_code') {
            // Exchange authorization code for tokens
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

            // Get user profile info from Google
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const profile = await profileResponse.json();

            // Store integration record in DB
            const { data, error } = await supabase
                .from('calendar_integrations')
                .upsert({
                    user_id,
                    company_id,
                    provider: 'google',
                    provider_account_id: profile.id,
                    provider_email: profile.email,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    is_active: true
                }, { onConflict: 'user_id,provider' })
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, integration: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (action === 'fetch_events') {
            // Get integration record from DB to retrieve stored tokens
            const { data: integration, error: intError } = await supabase
                .from('calendar_integrations')
                .select('*')
                .eq('id', integration_id)
                .single();

            if (intError || !integration) throw new Error('Integration not found');

            let accessToken = integration.access_token;

            // Refresh token if expired
            if (new Date(integration.token_expires_at) < new Date()) {
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
                            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                        })
                        .eq('id', integration.id);
                } else {
                    // Token refresh failed — mark integration as inactive
                    await supabase
                        .from('calendar_integrations')
                        .update({ is_active: false })
                        .eq('id', integration.id);
                    throw new Error('Token refresh failed. Please reconnect Google Calendar.');
                }
            }

            // Define date range: 30 days back to 90 days forward from today
            const timeMin = new Date();
            timeMin.setDate(timeMin.getDate() - 30);

            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + 90);

            const timeMinISO = timeMin.toISOString();
            const timeMaxISO = timeMax.toISOString();

            // Step 1: Fetch all user's calendars from calendarList
            const calListResponse = await fetch(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const calListData = await calListResponse.json();

            if (calListData.error) {
                throw new Error(calListData.error.message || 'Failed to fetch calendar list');
            }

            const calendars = (calListData.items || []) as Array<{
                id: string;
                summary: string;
                primary?: boolean;
                selected?: boolean;
                accessRole?: string;
            }>;

            // Step 2: Fetch events from ALL calendars the user has access to (not just primary)
            const allEvents: any[] = [];

            const eventFetches = calendars
                .filter(cal => cal.accessRole === 'owner' || cal.accessRole === 'writer' || cal.selected !== false)
                .map(async (cal) => {
                    try {
                        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMinISO}&timeMax=${timeMaxISO}&singleEvents=true&orderBy=startTime&maxResults=500`;
                        const eventsResponse = await fetch(url, {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        });
                        const eventsData = await eventsResponse.json();
                        if (!eventsData.error && eventsData.items) {
                            // Tag each event with its source calendar name
                            const taggedEvents = eventsData.items.map((ev: any) => ({
                                ...ev,
                                _calendarId: cal.id,
                                _calendarName: cal.summary,
                                _isPrimary: cal.primary === true,
                            }));
                            allEvents.push(...taggedEvents);
                        }
                    } catch {
                        // Silently skip calendars that fail (e.g., access revoked)
                    }
                });

            await Promise.all(eventFetches);

            // Sort combined events by start time
            allEvents.sort((a, b) => {
                const aStart = a.start?.dateTime || a.start?.date || '';
                const bStart = b.start?.dateTime || b.start?.date || '';
                return aStart.localeCompare(bStart);
            });

            return new Response(JSON.stringify({ success: true, events: allEvents }), {
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
