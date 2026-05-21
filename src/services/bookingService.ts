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

    async getMyBookingLink(): Promise<BookingLink | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data } = await supabase
            .from('booking_links')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        return data;
    },

    async upsertBookingLink(link: Partial<BookingLink>): Promise<BookingLink> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, full_name, avatar_url')
            .eq('id', user.id)
            .single();

        const payload = {
            ...link,
            user_id: user.id,
            company_id: profile?.company_id,
            display_name: link.display_name || profile?.full_name || 'Agent',
            avatar_url: link.avatar_url || profile?.avatar_url,
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

    async getPublicBookingLink(slug: string): Promise<BookingLink | null> {
        const { data } = await supabase
            .from('booking_links')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();
        return data;
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
        const { data, error } = await supabase
            .from('booking_appointments')
            .insert({ ...appointment, status: 'confirmed' })
            .select()
            .single();
        if (error) throw error;
        return data;
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
    ): string[] {
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

            // Skip past slots
            if (cursor <= now) {
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

        return slots;
    },

    slugify(name: string): string {
        return name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },
};
