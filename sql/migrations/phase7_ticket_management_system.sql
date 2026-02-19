-- ================================================================
-- PHASE 7: TICKET MANAGEMENT SYSTEM (SERVICE HUB)
-- Unified support platform for Technical Support, Customer Service, etc.
-- ================================================================

-- 1. Ticket Categories (Dynamic Types)
CREATE TABLE IF NOT EXISTS public.ticket_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366F1',
    sla_hours INTEGER DEFAULT 24, -- Default resolution time in hours
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, name)
);

-- 2. Main Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- Customer/Lead link
    category_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new', -- new, open, pending, resolved, closed
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    metadata JSONB DEFAULT '{}', -- Custom fields
    
    -- SLA tracking
    last_status_change_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Ticket Comments / Thread
CREATE TABLE IF NOT EXISTS public.ticket_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'comment', -- comment, status_change, assignment
    old_status TEXT,
    new_status TEXT,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS POLICIES
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_updates ENABLE ROW LEVEL SECURITY;

-- Categories Policy
CREATE POLICY "Users can view categories of their company" ON ticket_categories
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage categories" ON ticket_categories
    FOR ALL USING (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- Tickets Policy
CREATE POLICY "Users can view tickets from their company" ON tickets
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create tickets" ON tickets
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Agents can update assigned tickets" ON tickets
    FOR UPDATE USING (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );

-- Comments Policy
CREATE POLICY "Users can view ticket updates" ON ticket_updates
    FOR SELECT USING (
        ticket_id IN (SELECT id FROM tickets WHERE company_id IN (SELECT company_id FROM profiles id = auth.uid()))
    );

-- 5. FUNCTION: Set some default categories for new companies
CREATE OR REPLACE FUNCTION setup_default_ticket_categories(target_company_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO ticket_categories (company_id, name, color, sla_hours) VALUES
    (target_company_id, 'Soporte Técnico', '#ef4444', 12),
    (target_company_id, 'Atención al Cliente', '#3b82f6', 24),
    (target_company_id, 'Facturación', '#10b981', 48);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
