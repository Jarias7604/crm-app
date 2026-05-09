-- ================================================================
-- MASTER SYNC v2 — Testing Environment Full Schema Alignment
-- Project: ubqscyfefgfbmndnypbp (crm-app-testing)
-- Apply at: https://supabase.com/dashboard/project/ubqscyfefgfbmndnypbp/sql/new
-- Run in ONE SHOT — all statements are idempotent (safe to re-run)
-- ================================================================

-- ================================================================
-- 1. LEADS — Add missing columns (if not exist)
-- ================================================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS document_path text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS internal_won_date date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS etiqueta text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_count integer DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- ================================================================
-- 2. TABLE: ticket_categories
-- ================================================================
CREATE TABLE IF NOT EXISTS public.ticket_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    color text NOT NULL DEFAULT '#6366F1',
    sla_hours integer NOT NULL DEFAULT 24,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_categories_company_isolation" ON public.ticket_categories;
CREATE POLICY "ticket_categories_company_isolation" ON public.ticket_categories
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- ================================================================
-- 3. TABLE: tickets
-- ================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    category_id uuid REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','pending','resolved','closed')),
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    metadata jsonb DEFAULT '{}'::jsonb,
    lead_name text,          -- snapshot for RLS-safe display
    due_date timestamptz,
    last_status_change_at timestamptz DEFAULT now() NOT NULL,
    resolved_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_company_isolation" ON public.tickets;
CREATE POLICY "tickets_company_isolation" ON public.tickets
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON public.tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);

-- ================================================================
-- 4. TABLE: ticket_comments
-- ================================================================
CREATE TABLE IF NOT EXISTS public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    body text NOT NULL,
    is_internal boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_comments_company_isolation" ON public.ticket_comments;
CREATE POLICY "ticket_comments_company_isolation" ON public.ticket_comments
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

-- ================================================================
-- 5. TABLE: marketing_ai_agents
-- ================================================================
CREATE TABLE IF NOT EXISTS public.marketing_ai_agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT 'Asistente IA',
    role_description text NOT NULL DEFAULT 'Consultor experto',
    tone text NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional','friendly','persuasive')),
    language text NOT NULL DEFAULT 'es',
    is_active boolean NOT NULL DEFAULT false,
    active_channels text[] DEFAULT '{}',
    system_prompt text DEFAULT '',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.marketing_ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_ai_agents_company_isolation" ON public.marketing_ai_agents;
CREATE POLICY "marketing_ai_agents_company_isolation" ON public.marketing_ai_agents
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

CREATE INDEX IF NOT EXISTS idx_marketing_ai_agents_company ON public.marketing_ai_agents(company_id);

-- ================================================================
-- 6. TABLE: marketing_campaigns (if missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    subject text,
    content text,
    type text NOT NULL DEFAULT 'email' CHECK (type IN ('email','whatsapp','telegram','sms')),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','completed','paused')),
    total_recipients integer DEFAULT 0,
    sent_at timestamptz,
    audience_filters jsonb DEFAULT '{}'::jsonb,
    stats jsonb DEFAULT '{"sent":0,"delivered":0,"opened":0,"clicked":0,"replied":0,"bounced":0}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_campaigns_company_isolation" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_company_isolation" ON public.marketing_campaigns
    FOR ALL TO authenticated
    USING (company_id = (SELECT get_auth_company_id()))
    WITH CHECK (company_id = (SELECT get_auth_company_id()));

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_company ON public.marketing_campaigns(company_id);

-- ================================================================
-- 7. LEADS columns needed by Leads page cursor query
-- ================================================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value numeric(12,2) DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ================================================================
-- DONE
-- ================================================================
SELECT 'v2 sync complete — tickets, ticket_categories, ticket_comments, marketing_ai_agents, marketing_campaigns created. Leads columns patched.' AS result;
