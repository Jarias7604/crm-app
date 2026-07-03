-- Migration: Create Invoices (Facturas) Table
-- Created at: 2026-07-01

CREATE TABLE IF NOT EXISTS public.facturas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
    numero_factura text NOT NULL, -- e.g. "35771"
    workorder text, -- e.g. "60924"
    status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('draft', 'unpaid', 'paid', 'void', 'refunded')),
    
    -- Client / Billing Info
    nombre_cliente text NOT NULL,
    empresa_cliente text,
    email_cliente text,
    telefono_cliente text,
    
    -- Billing Address (Bill To)
    bill_to_name text,
    bill_to_account text,
    bill_to_company text,
    bill_to_address text,
    
    -- Shipping Address (Ship To)
    ship_to_name text,
    ship_to_company text,
    ship_to_address text,
    
    -- Order/Shipping Info
    date_ordered date,
    date_shipped date,
    due_date date,
    buyer_dept text,
    customer_po text,
    dismantler text,
    core numeric(10,2) DEFAULT 0,
    ro_number text,
    truck text,
    salesperson text,
    
    -- Items & Prices (JSONB array containing tag_number, item_detail, stock_number, amount)
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    
    -- Financials
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    iva numeric(10,2) NOT NULL DEFAULT 0,
    fuel_charge numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0,
    
    notas text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using get_auth_company_id() for consistency)
DROP POLICY IF EXISTS "facturas_company_isolation" ON public.facturas;
CREATE POLICY "facturas_company_isolation" ON public.facturas FOR ALL TO authenticated
  USING (company_id = (select get_auth_company_id()))
  WITH CHECK (company_id = (select get_auth_company_id()));

-- Allow public read of facturas so clients can view their bills online
DROP POLICY IF EXISTS "facturas_public_read" ON public.facturas;
CREATE POLICY "facturas_public_read" ON public.facturas FOR SELECT TO anon, authenticated
  USING (true);
