-- ==========================================
-- 🎯 SALES GOALS TABLE & SECURITY
-- ==========================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.sales_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    target NUMERIC(15,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure one goal per agent/month/year
    UNIQUE(agent_id, company_id, month, year)
);

-- 2. Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Admins can do everything for their company
CREATE POLICY "Admins can manage sales goals" ON public.sales_goals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'company_admin')
            AND (company_id = public.sales_goals.company_id OR role = 'super_admin')
        )
    );

-- Agents can only view their own goals
CREATE POLICY "Agents can view their own goals" ON public.sales_goals
    FOR SELECT
    USING (
        agent_id = auth.uid()
    );

-- 4. Grant access to authenticated users
GRANT ALL ON public.sales_goals TO authenticated;

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sales_goals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_goals_modtime
    BEFORE UPDATE ON public.sales_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_goals_timestamp();
