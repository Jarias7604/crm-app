import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helper: Fetch and merge events for ONE integration ---
async function fetchGoogleEvents(integration: any) {
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
            await supabase
                .from('calendar_integrations')
                .update({ is_active: false })
                .eq('id', integration.id);
            throw new Error(`Token expirado para ${integration.google_email}.`);
        }
    }

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 60);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    const allEvents: any[] = [];
    let calendarsToFetch: Array<{ id: string; summary: string; primary?: boolean }> = [];

    try {
        const calListResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const calListData = await calListResponse.json();

        if (!calListData.error && calListData.items) {
            calendarsToFetch = calListData.items.filter((cal: any) => cal.accessRole !== 'freeBusyReader');
        } else {
            calendarsToFetch = [{ id: 'primary', summary: 'Google Calendar', primary: true }];
        }
    } catch {
        calendarsToFetch = [{ id: 'primary', summary: 'Google Calendar', primary: true }];
    }

    const eventFetches = calendarsToFetch.map(async (cal) => {
        try {
            const url = [
                'https://www.googleapis.com/calendar/v3/calendars/',
                encodeURIComponent(cal.id),
                '/events?timeMin=', timeMin.toISOString(),
                '&timeMax=', timeMax.toISOString(),
                '&singleEvents=true&orderBy=startTime&maxResults=500'
            ].join('');

            const eventsResponse = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
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
        } catch {}
    });

    await Promise.all(eventFetches);

    // Update last synced
    await supabase.from('calendar_integrations').update({ last_synced_at: new Date().toISOString() }).eq('id', integration.id);

    return { events: allEvents, calendars_synced: calendarsToFetch.length };
}


serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, code, redirect_uri, user_id, company_id, integration_id, integration_sources } = body;

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
            if (tokens.error) throw new Error(tokens.error_description || tokens.error);

            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const googleProfile = await profileResponse.json();

            const { data, error } = await supabase
                .from('calendar_integrations')
                .upsert({
                    user_id,
                    company_id,
                    provider: 'google',
                    provider_account_id: googleProfile.id || googleProfile.email,
                    google_email: googleProfile.email,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    is_active: true,
                    last_synced_at: new Date().toISOString(),
                }, { onConflict: 'company_id,user_id,provider' })
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, integration: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ─── ACTION: fetch_events (Legacy, single integration) ───────────────────
        if (action === 'fetch_events') {
            const { data: integration, error: intError } = await supabase
                .from('calendar_integrations')
                .select('*')
                .eq('id', integration_id)
                .single();

            if (intError || !integration) throw new Error('Integration not found');

            const { events, calendars_synced } = await fetchGoogleEvents(integration);
            
            events.sort((a, b) => {
                const aStart = a.start?.dateTime || a.start?.date || '';
                const bStart = b.start?.dateTime || b.start?.date || '';
                return aStart.localeCompare(bStart);
            });

            return new Response(JSON.stringify({ success: true, events, total: events.length, calendars_synced }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ─── ACTION: fetch_events_multi ──────────────────────────────────────────
        if (action === 'fetch_events_multi') {
            if (!integration_sources || !Array.isArray(integration_sources)) {
                throw new Error('integration_sources array is required');
            }

            // integration_sources -> [{ integration_id, group_name, color, calendar_id }]
            const integrationIds = integration_sources.map((s: any) => s.integration_id).filter(Boolean);

            if (integrationIds.length === 0) {
                return new Response(JSON.stringify({ success: true, events: [], total: 0 }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: integrations, error: intError } = await supabase
                .from('calendar_integrations')
                .select('*')
                .in('id', integrationIds)
                .eq('is_active', true);

            if (intError) throw new Error('Failed to fetch integrations');

            const allEvents: any[] = [];
            
            // Run all integration fetches in parallel
            const fetchPromises = integrations.map(async (integration) => {
                try {
                    const sourceConfig = integration_sources.find((s: any) => s.integration_id === integration.id);
                    const { events } = await fetchGoogleEvents(integration);
                    
                    // Tag each event with the UI group metadata
                    const tagged = events.map(ev => ({
                        ...ev,
                        _groupName: sourceConfig?.group_name || 'Calendario',
                        _groupColor: sourceConfig?.color || '#4285F4',
                        _sourceCalendarId: sourceConfig?.calendar_id || 'personal'
                    }));
                    
                    allEvents.push(...tagged);
                } catch (e) {
                    console.error(`Failed to fetch for integration ${integration.id}:`, e);
                }
            });

            await Promise.all(fetchPromises);

            // Global sort
            allEvents.sort((a, b) => {
                const aStart = a.start?.dateTime || a.start?.date || '';
                const bStart = b.start?.dateTime || b.start?.date || '';
                return aStart.localeCompare(bStart);
            });

            return new Response(JSON.stringify({ success: true, events: allEvents, total: allEvents.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ─── ACTION: create_event (Google Meet Scheduler) ───────────────────────
        if (action === 'create_event') {
            const { integration_id, event } = body;

            if (!integration_id || !event) throw new Error('integration_id and event are required');

            // Fetch integration
            const { data: integration, error: intError } = await supabase
                .from('calendar_integrations')
                .select('*')
                .eq('id', integration_id)
                .eq('is_active', true)
                .single();

            if (intError || !integration) throw new Error('Google Calendar integration not found or inactive');

            // Refresh token if expired (same pattern as fetchGoogleEvents)
            let accessToken = integration.access_token;
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
                if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);
                accessToken = tokens.access_token;
                await supabase.from('calendar_integrations').update({
                    access_token: tokens.access_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                }).eq('id', integration.id);
            }

            // Build Google Calendar event body
            const timezone = event.timezone || 'America/El_Salvador';
            const eventBody: any = {
                summary: event.title,
                description: event.description || '',
                start: { dateTime: event.start, timeZone: timezone },
                end:   { dateTime: event.end,   timeZone: timezone },
                attendees: (event.attendees || []).map((email: string) => ({ email })),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email',  minutes: 24 * 60 }, // 24h before
                        { method: 'popup',  minutes: 30 },       // 30min before
                    ],
                },
            };

            // Attach Google Meet conference if requested
            const conferenceDataVersion = event.add_meet_link ? 1 : 0;
            if (event.add_meet_link) {
                eventBody.conferenceData = {
                    createRequest: {
                        requestId: crypto.randomUUID(),
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                };
            }

            // sendUpdates: 'all' sends email invites to all attendees automatically
            const sendUpdates = event.send_invites ? 'all' : 'none';

            const createResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=${conferenceDataVersion}&sendUpdates=${sendUpdates}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(eventBody),
                }
            );

            const createdEvent = await createResponse.json();

            // Log for debugging in Supabase Edge Function logs
            if (!createResponse.ok || createdEvent.error) {
                const errDetail = createdEvent.error
                    ? `[${createdEvent.error.code}] ${createdEvent.error.message}`
                    : `HTTP ${createResponse.status}`;
                console.error('Google Calendar API create_event failed:', errDetail);
                console.error('Response body:', JSON.stringify(createdEvent).substring(0, 800));
                // Return 200 with success:false so the Supabase client
                // can read the real error message (instead of generic "non-2xx")
                return new Response(JSON.stringify({
                    success: false,
                    error: `Google Calendar: ${errDetail}`,
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Extract Meet link from conference data
            const meetLink = createdEvent.conferenceData?.entryPoints
                ?.find((ep: any) => ep.entryPointType === 'video')?.uri || null;

            // Persist Meet link + event ID back to the CRM follow-up record
            if (event.follow_up_id && meetLink) {
                await supabase
                    .from('follow_ups')
                    .update({
                        google_event_id: createdEvent.id,
                        meet_link: meetLink,
                        calendar_html_link: createdEvent.htmlLink,
                    })
                    .eq('id', event.follow_up_id);
            }

            return new Response(JSON.stringify({
                success:         true,
                google_event_id: createdEvent.id,
                meet_link:       meetLink,
                html_link:       createdEvent.htmlLink,
                event:           createdEvent,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ─── ACTION: update_event ───────────────────────────────────────────────
        if (action === 'update_event') {
            const { integration_id, event_id, event } = body;

            if (!integration_id || !event_id || !event) throw new Error('integration_id, event_id and event are required');

            // Fetch integration
            const { data: integration, error: intError } = await supabase
                .from('calendar_integrations')
                .select('*')
                .eq('id', integration_id)
                .eq('is_active', true)
                .single();

            if (intError || !integration) throw new Error('Google Calendar integration not found or inactive');

            // Refresh token if expired
            let accessToken = integration.access_token;
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
                if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);
                accessToken = tokens.access_token;
                await supabase.from('calendar_integrations').update({
                    access_token: tokens.access_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                }).eq('id', integration.id);
            }

            // Build Google Calendar event update body
            const timezone = event.timezone || 'America/El_Salvador';
            const eventBody: any = {
                summary: event.title,
                description: event.description || '',
                start: { dateTime: event.start, timeZone: timezone },
                end:   { dateTime: event.end,   timeZone: timezone },
                attendees: (event.attendees || []).map((email: string) => ({ email })),
            };

            // sendUpdates: 'all' sends email updates automatically
            const sendUpdates = event.send_invites ? 'all' : 'none';

            const updateResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}?sendUpdates=${sendUpdates}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(eventBody),
                }
            );

            const updatedEvent = await updateResponse.json();

            if (!updateResponse.ok || updatedEvent.error) {
                const errDetail = updatedEvent.error
                    ? `[${updatedEvent.error.code}] ${updatedEvent.error.message}`
                    : `HTTP ${updateResponse.status}`;
                console.error('Google Calendar API update_event failed:', errDetail);
                return new Response(JSON.stringify({
                    success: false,
                    error: `Google Calendar Update: ${errDetail}`,
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // If we have a CRM follow_up linked to this google_event_id, update its notes/dates
            const { data: followUps } = await supabase
                .from('follow_ups')
                .select('id')
                .eq('google_event_id', event_id);
                
            if (followUps && followUps.length > 0) {
                const followUpIds = followUps.map(f => f.id);
                await supabase
                    .from('follow_ups')
                    .update({
                        date: event.start,
                        notes: event.description || '',
                    })
                    .in( 'id', followUpIds);
            }

            return new Response(JSON.stringify({
                success: true,
                event: updatedEvent,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error('Invalid action');

    } catch (error: any) {
        console.error('google-calendar-sync unhandled error:', error.message);
        // Return 200 with error details so frontend can display the real message
        return new Response(JSON.stringify({ success: false, error: error.message || 'Error desconocido' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
