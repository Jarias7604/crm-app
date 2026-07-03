-- Migration: 20260623595959_create_missing_tables_for_rls.sql
-- Description: Create missing tables lead_marketing_stats, login_attempts, marketing_conversations, marketing_messages, and helper functions

-- 1. Create lead_marketing_stats table
CREATE TABLE IF NOT EXISTS public.lead_marketing_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_marketing_stats_lead ON public.lead_marketing_stats(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_marketing_stats_company ON public.lead_marketing_stats(company_id);

-- 2. Create login_attempts table
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    ip_address TEXT,
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    successful BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON public.login_attempts(email, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempt_time);

-- 3. Create or replace public.is_company_manager() helper function
CREATE OR REPLACE FUNCTION public.is_company_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin')
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_manager() TO authenticated;

-- 4. Create marketing_conversations table
CREATE TABLE IF NOT EXISTS public.marketing_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    provider TEXT,
    status TEXT DEFAULT 'active',
    external_id TEXT UNIQUE DEFAULT 'internal',
    last_message TEXT DEFAULT 'Nueva conversación...',
    unread_count INT DEFAULT 0,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_conversations_company ON public.marketing_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_lead ON public.marketing_conversations(lead_id);

-- Enable RLS on marketing_conversations
ALTER TABLE public.marketing_conversations ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for marketing_conversations supporting parent-child companies
DROP POLICY IF EXISTS marketing_conversations_tenant_policy ON public.marketing_conversations;
CREATE POLICY marketing_conversations_tenant_policy ON public.marketing_conversations FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()))
  WITH CHECK (company_id = public.get_auth_company_id() OR company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id()));

-- 5. Create marketing_messages table
CREATE TABLE IF NOT EXISTS public.marketing_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.marketing_conversations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'text',
    metadata JSONB DEFAULT '{}'::jsonb,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_messages_conversation ON public.marketing_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_company ON public.marketing_messages(company_id);

-- Enable RLS on marketing_messages
ALTER TABLE public.marketing_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for marketing_messages supporting parent-child companies
DROP POLICY IF EXISTS marketing_messages_tenant_policy ON public.marketing_messages;
CREATE POLICY marketing_messages_tenant_policy ON public.marketing_messages FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT mc.id FROM public.marketing_conversations mc
      WHERE mc.company_id = public.get_auth_company_id() OR mc.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT mc.id FROM public.marketing_conversations mc
      WHERE mc.company_id = public.get_auth_company_id() OR mc.company_id IN (SELECT id FROM public.companies WHERE parent_company_id = public.get_auth_company_id())
    )
  );
