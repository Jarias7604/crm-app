-- ================================================================
-- BOOKING SYSTEM — Meeting Scheduler (Calendly-like)
-- Migration: 20260521000000
-- ================================================================

-- 1. Booking Links (one per agent, or per team)
CREATE TABLE IF NOT EXISTS public.booking_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL UNIQUE,              -- e.g. "juan-martinez"
    display_name    TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT '30-Minute Meeting',
    description     TEXT,
    avatar_url      TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,          -- 15, 30, 45, 60
    buffer_minutes  INT NOT NULL DEFAULT 10,           -- time between slots
    max_per_day     INT NOT NULL DEFAULT 8,
    -- Availability: JSONB array of {day: 0-6, start: "09:00", end: "17:00"}
    availability    JSONB NOT NULL DEFAULT '[
        {"day":1,"start":"09:00","end":"17:00"},
        {"day":2,"start":"09:00","end":"17:00"},
        {"day":3,"start":"09:00","end":"17:00"},
        {"day":4,"start":"09:00","end":"17:00"},
        {"day":5,"start":"09:00","end":"17:00"}
    ]'::jsonb,
    timezone        TEXT NOT NULL DEFAULT 'America/El_Salvador',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    color           TEXT NOT NULL DEFAULT '#4F46E5',
    location        TEXT DEFAULT 'Videollamada (enlace en confirmación)',
    questions       JSONB DEFAULT '[]'::jsonb,         -- custom intake questions
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Booking Appointments
CREATE TABLE IF NOT EXISTS public.booking_appointments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_link_id UUID NOT NULL REFERENCES public.booking_links(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Lead info (filled by the person booking)
    guest_name      TEXT NOT NULL,
    guest_email     TEXT NOT NULL,
    guest_phone     TEXT,
    guest_company   TEXT,
    notes           TEXT,
    answers         JSONB DEFAULT '{}'::jsonb,
    -- Scheduling
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    timezone        TEXT NOT NULL DEFAULT 'America/El_Salvador',
    -- Status
    status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed','cancelled','completed','no_show')),
    -- Optional: link to existing lead
    lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    -- Meeting details
    meeting_url     TEXT,
    cancellation_reason TEXT,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_links_slug ON public.booking_links(slug);
CREATE INDEX IF NOT EXISTS idx_booking_links_user ON public.booking_links(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_links_company ON public.booking_links(company_id);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_link ON public.booking_appointments(booking_link_id);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_start ON public.booking_appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_user ON public.booking_appointments(user_id);

-- RLS
ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_appointments ENABLE ROW LEVEL SECURITY;

-- booking_links: owner and company admins can manage; PUBLIC can read active links by slug
CREATE POLICY "Public can read active booking links" ON public.booking_links
    FOR SELECT USING (is_active = true);

CREATE POLICY "Agents can manage their own booking links" ON public.booking_links
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage company booking links" ON public.booking_links
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.profiles
            WHERE company_id = booking_links.company_id
            AND role IN ('super_admin','company_admin')
        )
    );

-- booking_appointments: public insert; owner/admin can read and update
CREATE POLICY "Public can create appointments" ON public.booking_appointments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Agents can read their appointments" ON public.booking_appointments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Agents can update their appointments" ON public.booking_appointments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage company appointments" ON public.booking_appointments
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.profiles
            WHERE company_id = booking_appointments.company_id
            AND role IN ('super_admin','company_admin')
        )
    );

-- Super admin bypass
CREATE POLICY "Super admin full access booking_links" ON public.booking_links
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
    );

CREATE POLICY "Super admin full access booking_appointments" ON public.booking_appointments
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
    );
