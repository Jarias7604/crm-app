CREATE TABLE IF NOT EXISTS public.password_reset_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_user_id UUID NOT NULL,
    target_email TEXT,
    target_full_name TEXT,
    performed_by_id UUID NOT NULL,
    performed_by_email TEXT,
    performed_by_role TEXT,
    ip_address TEXT,
    reset_method TEXT DEFAULT 'direct',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.password_reset_log ENABLE ROW LEVEL SECURITY;

-- Política 1: El Edge Function (service_role) puede hacer todo
CREATE POLICY "service_role_all" ON public.password_reset_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Política 2: Solo el super_admin puede leer los logs
CREATE POLICY "super_admin_read" ON public.password_reset_log
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ));
