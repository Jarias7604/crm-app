-- 1. Create table lead_products
CREATE TABLE IF NOT EXISTS public.lead_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS on lead_products
ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for lead_products
CREATE POLICY "Users can view products of their company" 
ON public.lead_products FOR SELECT TO authenticated 
USING (company_id = get_auth_company_id());

CREATE POLICY "Users can insert products of their company" 
ON public.lead_products FOR INSERT TO authenticated 
WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "Users can update products of their company" 
ON public.lead_products FOR UPDATE TO authenticated 
USING (company_id = get_auth_company_id()) 
WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "Users can delete products of their company" 
ON public.lead_products FOR DELETE TO authenticated 
USING (company_id = get_auth_company_id());

-- 4. Add interested_product_id to public.leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS interested_product_id UUID REFERENCES public.lead_products(id) ON DELETE SET NULL;

-- 5. Create Indices
CREATE INDEX IF NOT EXISTS idx_lead_products_company_id ON public.lead_products(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_interested_product_id ON public.leads(interested_product_id);
