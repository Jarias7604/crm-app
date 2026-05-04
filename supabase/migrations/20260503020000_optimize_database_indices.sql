-- Fase 3.1: Optimización de Base de Datos - Índices de Alto Rendimiento
-- Objetivo: Prevenir cuellos de botella ("Full Table Scans") cuando las tablas crezcan a +1M de registros.

-- 1. Índices para la tabla 'leads'
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);

-- Índices compuestos para 'leads' (Optimizan consultas con múltiples filtros del Dashboard)
CREATE INDEX IF NOT EXISTS idx_leads_company_status ON public.leads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_company_assigned ON public.leads(company_id, assigned_to);

-- 2. Índices para tablas dependientes de Leads
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON public.follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_lead_id ON public.call_activities(lead_id);

-- 3. Índices para Cotizaciones (Finanzas)
CREATE INDEX IF NOT EXISTS idx_cotizaciones_lead_id ON public.cotizaciones(lead_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_company_id ON public.cotizaciones(company_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_status ON public.cotizaciones(status);

-- 4. Índices para Usuarios/Perfiles
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 5. Índices de texto para búsquedas (Omni-Buscador)
-- Usamos pg_trgm (Trigram) para búsquedas difusas ultrarrápidas (ILIKE '%texto%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON public.leads USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_company_name_trgm ON public.leads USING GIN (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON public.leads USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON public.leads USING GIN (phone gin_trgm_ops);
