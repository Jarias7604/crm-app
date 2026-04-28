-- Migration: Add Financial Tables
-- Created at: 2026-04-28

-- 1. Pagos (Recibos / Abonos)
CREATE TABLE IF NOT EXISTS public.pagos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    monto numeric(10,2) NOT NULL,
    fecha_pago date NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('anticipo', 'cuota', 'mensualidad', 'otro')),
    numero_cuota integer,
    metodo_pago text CHECK (metodo_pago IN ('transferencia', 'efectivo', 'cheque', 'tarjeta', 'otro')),
    registrado_por uuid REFERENCES auth.users(id),
    notas text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Gastos (Egresos Operativos)
CREATE TABLE IF NOT EXISTS public.gastos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    concepto text NOT NULL,
    categoria text NOT NULL,
    monto numeric(10,2) NOT NULL,
    fecha date NOT NULL,
    notas text,
    registrado_por uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Planes de Pago (Contratos de Amortización)
CREATE TABLE IF NOT EXISTS public.planes_pago (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
    monto_total numeric(10,2) NOT NULL,
    monto_anticipo numeric(10,2) NOT NULL,
    saldo_a_financiar numeric(10,2) NOT NULL,
    plazo_meses integer NOT NULL,
    tasa_interes_anual numeric(5,2) NOT NULL,
    sistema_amortizacion text NOT NULL CHECK (sistema_amortizacion IN ('flat', 'frances', 'unico')),
    fecha_inicio date NOT NULL,
    estado text NOT NULL CHECK (estado IN ('borrador', 'activo', 'pagado', 'mora', 'cancelado')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Cuotas Esperadas (Cronograma de Pagos)
CREATE TABLE IF NOT EXISTS public.cuotas_esperadas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_pago_id uuid NOT NULL REFERENCES public.planes_pago(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    numero_cuota integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    monto_capital numeric(10,2) NOT NULL,
    monto_interes numeric(10,2) NOT NULL,
    monto_total_cuota numeric(10,2) NOT NULL,
    saldo_restante_capital numeric(10,2) NOT NULL,
    monto_pagado numeric(10,2) DEFAULT 0 NOT NULL,
    estado text NOT NULL CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'vencida')),
    fecha_ultimo_pago date,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. View: panorama_financiero
CREATE OR REPLACE VIEW public.panorama_financiero AS
SELECT 
    c.id AS cotizacion_id,
    c.company_id,
    c.nombre_cliente,
    c.plan_nombre,
    c.tipo_pago,
    c.total_anual AS venta_total,
    c.monto_anticipo AS anticipo_acordado,
    c.cuotas AS total_cuotas,
    c.plazo_meses,
    COALESCE(SUM(p.monto), 0::numeric) AS total_cobrado,
    c.total_anual - COALESCE(SUM(p.monto), 0::numeric) AS total_pendiente,
    COUNT(p.id) AS cuotas_pagadas,
    COALESCE(c.cuotas, 1) - COUNT(p.id) AS cuotas_restantes,
    CASE
        WHEN COALESCE(c.cuotas, 1) > 0 THEN c.total_anual / COALESCE(c.cuotas, 1)
        ELSE c.total_anual
    END AS valor_por_cuota,
    MAX(p.fecha_pago) AS ultimo_pago,
    c.created_at AS cotizacion_fecha
FROM public.cotizaciones c
LEFT JOIN public.pagos p ON p.cotizacion_id = c.id
WHERE c.estado = ANY (ARRAY['aceptada'::text, 'ganado'::text, 'aprobada'::text])
GROUP BY c.id, c.company_id, c.nombre_cliente, c.plan_nombre, c.tipo_pago, c.total_anual, c.monto_anticipo, c.cuotas, c.plazo_meses, c.created_at;

-- Enable RLS
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas_esperadas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "pagos_company_isolation" ON public.pagos FOR ALL USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "gastos_company_isolation" ON public.gastos FOR ALL USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "planes_pago_company_isolation" ON public.planes_pago FOR ALL USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "cuotas_esperadas_company_isolation" ON public.cuotas_esperadas FOR ALL USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

-- Triggers to auto-update cuotas_esperadas status when a pago is made
CREATE OR REPLACE FUNCTION public.trg_actualizar_cuota_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id uuid;
BEGIN
    IF NEW.tipo = 'cuota' AND NEW.numero_cuota IS NOT NULL THEN
        -- Find the active plan for this cotizacion
        SELECT id INTO v_plan_id FROM public.planes_pago 
        WHERE cotizacion_id = NEW.cotizacion_id AND estado = 'activo' LIMIT 1;

        IF v_plan_id IS NOT NULL THEN
            UPDATE public.cuotas_esperadas
            SET monto_pagado = monto_pagado + NEW.monto,
                fecha_ultimo_pago = NEW.fecha_pago,
                estado = CASE 
                            WHEN (monto_pagado + NEW.monto) >= monto_total_cuota THEN 'pagada'
                            WHEN (monto_pagado + NEW.monto) > 0 THEN 'parcial'
                            ELSE estado
                         END
            WHERE plan_pago_id = v_plan_id AND numero_cuota = NEW.numero_cuota;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pago_inserted
AFTER INSERT ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_cuota_pago();

CREATE OR REPLACE FUNCTION public.trg_revertir_cuota_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id uuid;
BEGIN
    IF OLD.tipo = 'cuota' AND OLD.numero_cuota IS NOT NULL THEN
        SELECT id INTO v_plan_id FROM public.planes_pago 
        WHERE cotizacion_id = OLD.cotizacion_id AND estado = 'activo' LIMIT 1;

        IF v_plan_id IS NOT NULL THEN
            UPDATE public.cuotas_esperadas
            SET monto_pagado = GREATEST(0, monto_pagado - OLD.monto),
                estado = CASE 
                            WHEN GREATEST(0, monto_pagado - OLD.monto) >= monto_total_cuota THEN 'pagada'
                            WHEN GREATEST(0, monto_pagado - OLD.monto) > 0 THEN 'parcial'
                            ELSE 'pendiente'
                         END
            WHERE plan_pago_id = v_plan_id AND numero_cuota = OLD.numero_cuota;
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pago_deleted
AFTER DELETE ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.trg_revertir_cuota_pago();

