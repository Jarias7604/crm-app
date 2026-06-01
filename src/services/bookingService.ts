import { supabase } from './supabase';

export interface BookingLink {
    id: string;
    company_id: string;
    user_id: string;
    slug: string;
    display_name: string;
    title: string;
    description?: string;
    avatar_url?: string;
    duration_minutes: number;
    buffer_minutes: number;
    max_per_day: number;
    availability: { day: number; start: string; end: string }[];
    timezone: string;
    is_active: boolean;
    color: string;
    location?: string;
    created_at: string;
    updated_at: string;
}

export interface BookingAppointment {
    id: string;
    booking_link_id: string;
    company_id: string;
    user_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone?: string;
    guest_company?: string;
    notes?: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    timezone: string;
    status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
    lead_id?: string;
    meeting_url?: string;
    created_at: string;
}

export const bookingService = {
    // === BOOKING LINKS ===

    /** Get the first booking link (backward compat) */
    async getMyBookingLink(): Promise<BookingLink | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data } = await supabase
            .from('booking_links')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        return data;
    },

    /** Get ALL booking links for the current user */
    async getMyBookingLinks(): Promise<BookingLink[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase
            .from('booking_links')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
        return data || [];
    },

    /** Delete a booking link by ID */
    async deleteBookingLink(id: string): Promise<void> {
        const { error } = await supabase
            .from('booking_links')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    /** Duplicate a booking link with a new slug */
    async duplicateBookingLink(source: BookingLink, newSlug: string): Promise<BookingLink> {
        const { id: _id, created_at: _ca, updated_at: _ua, slug: _slug, ...rest } = source;
        return this.upsertBookingLink({ ...rest, slug: newSlug, title: `${source.title} (copia)`, is_active: false });
    },

    async upsertBookingLink(link: Partial<BookingLink>): Promise<BookingLink> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, full_name, avatar_url')
            .eq('id', user.id)
            .single();

        let avatarUrl = profile?.avatar_url || link.avatar_url;
        let displayName = link.display_name || profile?.full_name || 'Agent';

        // ⚡ SPECIAL PLATFORM OWNER SYNC:
        // If the logged-in user is the Super Admin (jarias7604@gmail.com),
        // pull the avatar and professional name from the main corporate account (jarias@ariasdefense.com).
        if (user.email === 'jarias7604@gmail.com') {
            const { data: corporateProfile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('email', 'jarias@ariasdefense.com')
                .maybeSingle();

            if (corporateProfile?.avatar_url) {
                avatarUrl = corporateProfile.avatar_url;
            }
            if (corporateProfile?.full_name) {
                displayName = corporateProfile.full_name;
            }
        }

        const payload = {
            ...link,
            user_id: user.id,
            company_id: profile?.company_id,
            display_name: displayName,
            avatar_url: avatarUrl,
        };

        if (link.id) {
            const { data, error } = await supabase
                .from('booking_links')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', link.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('booking_links')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // === PUBLIC — no auth needed ===

    async getPublicBookingLink(slug: string): Promise<(BookingLink & { company_name?: string; company_logo?: string }) | null> {
        const { data } = await supabase
            .from('booking_links')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();
        if (!data) return null;

        // Fetch company branding for the public page
        const { data: company } = await supabase
            .from('companies')
            .select('name, logo_url')
            .eq('id', data.company_id)
            .maybeSingle();

        // ⚡ SPECIAL DYNAMIC AVATAR & DISPLAY NAME SYNC:
        // Query the profile of the link owner to make sure we show their current avatar & full name.
        let avatarUrl = data.avatar_url;
        let displayName = data.display_name;

        const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name, avatar_url')
            .eq('id', data.user_id)
            .maybeSingle();

        if (profile) {
            avatarUrl = profile.avatar_url || avatarUrl;
            displayName = profile.full_name || displayName;

            // Platform owner sync fallback
            if (profile.email === 'jarias7604@gmail.com') {
                const { data: corporateProfile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('email', 'jarias@ariasdefense.com')
                    .maybeSingle();

                if (corporateProfile) {
                    avatarUrl = corporateProfile.avatar_url || avatarUrl;
                    displayName = corporateProfile.full_name || displayName;
                }
            }
        }

        return {
            ...data,
            avatar_url: avatarUrl || undefined,
            display_name: displayName,
            company_name: company?.name || undefined,
            company_logo: company?.logo_url || undefined,
        };
    },

    /** Get booked slots for a given date (to block them out) */
    async getBookedSlots(bookingLinkId: string, date: string): Promise<{ start: string; end: string }[]> {
        const dayStart = `${date}T00:00:00.000Z`;
        const dayEnd   = `${date}T23:59:59.999Z`;
        const { data } = await supabase
            .from('booking_appointments')
            .select('start_time, end_time')
            .eq('booking_link_id', bookingLinkId)
            .eq('status', 'confirmed')
            .gte('start_time', dayStart)
            .lte('start_time', dayEnd);
        return (data || []).map(d => ({ start: d.start_time, end: d.end_time }));
    },

    /** Create a new public booking */
    async createAppointment(appointment: {
        booking_link_id: string;
        company_id: string;
        user_id: string;
        guest_name: string;
        guest_email: string;
        guest_phone?: string;
        guest_company?: string;
        notes?: string;
        start_time: string;
        end_time: string;
        duration_minutes: number;
        timezone: string;
    }): Promise<BookingAppointment> {
        // Sanitize Email: remove accidental trailing commas, periods, semicolons, spaces
        let emailLower = appointment.guest_email.trim().toLowerCase();
        emailLower = emailLower.replace(/[,;.\s]+$/, '').replace(/^[,;.\s]+/, '');

        // Sanitize Phone: remove accidental punctuation/spaces at ends
        let phoneCleaned = (appointment.guest_phone || '').trim();
        phoneCleaned = phoneCleaned.replace(/[,;.\s]+$/, '').replace(/^[,;.\s]+/, '');

        // 1. Check if lead already exists by email
        let leadId = '';
        
        const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('company_id', appointment.company_id)
            .eq('email', emailLower)
            .maybeSingle();

        if (existingLead) {
            leadId = existingLead.id;
        } else {
            // Create a new Lead
            const { data: newLead, error: newLeadError } = await supabase
                .from('leads')
                .insert({
                    company_id: appointment.company_id,
                    name: appointment.guest_name,
                    email: emailLower,
                    phone: phoneCleaned || null,
                    company_name: appointment.guest_company || null,
                    assigned_to: appointment.user_id,
                    source: 'Agendador Web',
                    status: 'Prospecto'
                })
                .select('id')
                .single();

            if (newLeadError) throw newLeadError;
            leadId = newLead.id;
        }

        // 2. Insert the appointment associated with the lead_id
        const { data: apptData, error: apptError } = await supabase
            .from('booking_appointments')
            .insert({
                ...appointment,
                guest_email: emailLower,
                guest_phone: phoneCleaned || null,
                lead_id: leadId,
                status: 'confirmed'
            })
            .select()
            .single();

        if (apptError) throw apptError;

        // 3. Create a matching FollowUp in the follow_ups table (this places it on the CRM Calendar)
        const { data: followUp, error: followUpError } = await supabase
            .from('follow_ups')
            .insert({
                lead_id: leadId,
                company_id: appointment.company_id,
                user_id: appointment.user_id,
                assigned_to: appointment.user_id,
                date: appointment.start_time,
                notes: appointment.notes || `Reunión agendada vía web por ${appointment.guest_name}`,
                action_type: 'meeting',
                completed: false
            })
            .select()
            .single();

        if (followUpError) {
            console.error('Error creating CRM follow_up:', followUpError);
        }

        // 4. Try to sync with Google Calendar if integrated
        const { data: googleIntegration } = await supabase
            .from('calendar_integrations')
            .select('id, google_email')
            .eq('user_id', appointment.user_id)
            .eq('provider', 'google')
            .eq('is_active', true)
            .maybeSingle();

        if (googleIntegration && followUp) {
            try {
                // Call google-calendar-sync edge function exactly like GoogleMeetScheduler does
                await supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        action: 'create_event',
                        integration_id: googleIntegration.id,
                        event: {
                            title: `Reunión: ${appointment.guest_name}`,
                            description: appointment.notes || 'Reunión agendada vía web.',
                            start: appointment.start_time,
                            end: appointment.end_time,
                            attendees: [emailLower],
                            add_meet_link: true,
                            send_invites: true,
                            follow_up_id: followUp.id,
                            timezone: 'America/El_Salvador',
                        },
                    },
                });
            } catch (err) {
                console.error('Error calling google-calendar-sync:', err);
            }
        } else {
            // Fallback: Send a professional Resend email through marketing queue
            try {
                const formattedDate = new Date(appointment.start_time).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'America/El_Salvador'
                });
                const formattedTime = new Date(appointment.start_time).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/El_Salvador'
                });

                // Generate Google Calendar Link for the email confirmation
                const startDt = new Date(appointment.start_time);
                const endDt = new Date(startDt.getTime() + appointment.duration_minutes * 60000);
                const formatUTC = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const emailGCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Cita Agendada: ' + appointment.guest_name)}&dates=${formatUTC(startDt)}/${formatUTC(endDt)}&details=${encodeURIComponent(appointment.notes || 'Reunión agendada vía web.')}&location=${encodeURIComponent('Videollamada')}`;

                const htmlContent = `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff;">
                        <h2 style="color: #10B981; font-weight: 800; margin-bottom: 20px; font-size: 24px;">¡Reunión Confirmada!</h2>
                        <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">Hola <strong>${appointment.guest_name}</strong>,</p>
                        <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">Tu reunión ha sido agendada con éxito en nuestra plataforma. A continuación encontrarás los detalles:</p>
                        
                        <div style="background-color: #F9FAFB; padding: 24px; border-radius: 12px; margin: 25px 0; border: 1px solid #F3F4F6;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #9CA3AF; font-size: 11px; font-weight: bold; text-transform: uppercase; width: 120px; letter-spacing: 0.05em;">Fecha</td>
                                    <td style="padding: 8px 0; color: #1F2937; font-size: 14px; font-weight: 600; text-transform: capitalize;">${formattedDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #9CA3AF; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Hora</td>
                                    <td style="padding: 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">${formattedTime} (CST / El Salvador)</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #9CA3AF; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Duración</td>
                                    <td style="padding: 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">${appointment.duration_minutes} minutos</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #9CA3AF; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Ubicación</td>
                                    <td style="padding: 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">Videollamada (Enlace enviado por el agente)</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${emailGCalUrl}" target="_blank" style="background-color: #4285F4; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 12px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.25);">
                                📅 Agregar a Google Calendar
                            </a>
                        </div>
                        
                        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
                            El agente se pondrá en contacto contigo para compartirte el enlace de acceso minutos antes de la sesión.
                        </p>
                        
                        <p style="color: #9CA3AF; font-size: 11px; margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 15px; text-align: center;">
                            Este es un mensaje automático de confirmación enviado por Arias CRM.
                        </p>
                    </div>
                `;

                await supabase
                    .from('marketing_message_queue')
                    .insert({
                        company_id: appointment.company_id,
                        lead_id: leadId,
                        channel: 'email',
                        subject: 'Confirmación de tu cita - Arias Defense',
                        content: htmlContent,
                        status: 'pending',
                        scheduled_at: new Date().toISOString()
                    });

                // Trigger queue immediately
                supabase.functions.invoke('process-message-queue');
            } catch (err) {
                console.error('Error scheduling backup confirmation email:', err);
            }
        }

        return apptData;
    },

    // === AGENT — view their appointments ===

    async getMyAppointments(from?: string): Promise<BookingAppointment[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        let query = supabase
            .from('booking_appointments')
            .select('*')
            .eq('user_id', user.id)
            .order('start_time', { ascending: true });
        if (from) query = query.gte('start_time', from);
        const { data } = await query;
        return data || [];
    },

    async updateAppointmentStatus(id: string, status: BookingAppointment['status']): Promise<void> {
        const { error } = await supabase
            .from('booking_appointments')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    /** Generate available time slots for a given date */
    generateSlots(
        availability: { day: number; start: string; end: string }[],
        bookedSlots: { start: string; end: string }[],
        date: string,
        durationMinutes: number,
        bufferMinutes: number,
        maxPerDay?: number,
    ): string[] {
        // If we've reached the maximum appointments for the day, show no slots
        if (maxPerDay && bookedSlots.length >= maxPerDay) {
            return [];
        }

        const d = new Date(date + 'T00:00:00');
        const dayOfWeek = d.getDay(); // 0=Sun...6=Sat
        const avail = availability.find(a => a.day === dayOfWeek);
        if (!avail) return [];

        const [startH, startM] = avail.start.split(':').map(Number);
        const [endH, endM]     = avail.end.split(':').map(Number);

        const slots: string[] = [];
        let cursor = new Date(date + 'T00:00:00');
        cursor.setHours(startH, startM, 0, 0);
        const dayEnd = new Date(date + 'T00:00:00');
        dayEnd.setHours(endH, endM, 0, 0);

        const now = new Date();

        while (cursor < dayEnd) {
            const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
            if (slotEnd > dayEnd) break;

            // Skip past slots (current time + 10 minute buffer to avoid booking in the immediate past)
            if (cursor.getTime() <= now.getTime() + 10 * 60 * 1000) {
                cursor = new Date(cursor.getTime() + (durationMinutes + bufferMinutes) * 60000);
                continue;
            }

            // Check collision with booked slots
            const isBooked = bookedSlots.some(b => {
                const bs = new Date(b.start).getTime();
                const be = new Date(b.end).getTime();
                const cs = cursor.getTime();
                const ce = slotEnd.getTime();
                return cs < be && ce > bs;
            });

            if (!isBooked) {
                slots.push(cursor.toISOString());
            }

            cursor = new Date(cursor.getTime() + (durationMinutes + bufferMinutes) * 60000);
        }

        // Limit the slots offered to the user's expected maxPerDay to keep the UI clean and exclusive
        if (maxPerDay && slots.length > maxPerDay) {
            return slots.slice(0, maxPerDay);
        }

        return slots;
    },

    slugify(name: string): string {
        return name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },
};
