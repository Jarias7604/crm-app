-- ═══════════════════════════════════════════════════════════════════════════
-- MÓDULO DE CONTRATOS PROFESIONALES MULTI-TENANT CON FIRMA DIGITAL
-- Fecha: 2026-10-17
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE SET NULL,

    -- Control y Metadatos
    contract_number TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Contrato de Prestación de Servicios Profesionales',
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviado', 'firmado', 'cancelado')),
    
    -- Contenido y Cláusulas
    objeto TEXT NOT NULL,
    clausulas JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Términos Económicos
    monto_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    forma_pago TEXT,
    anticipo NUMERIC(12,2) DEFAULT 0,
    cuotas INTEGER DEFAULT 1,
    valor_cuota NUMERIC(12,2) DEFAULT 0,
    vigencia_meses INTEGER DEFAULT 12,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    jurisdiccion TEXT,
    
    -- Snapshots Legales (inmutabilidad post-firma)
    datos_empresa JSONB NOT NULL DEFAULT '{}'::jsonb,
    datos_cliente JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Auditoría de Firma Digital
    firmado_digitalmente BOOLEAN DEFAULT false,
    firmado_en TIMESTAMPTZ,
    firmante_nombre TEXT,
    firmante_identificacion TEXT,
    firmante_cargo TEXT,
    firma_imagen TEXT, -- Trazo en base64 o URL
    firmante_ip TEXT,
    firmante_user_agent TEXT,
    
    -- Archivo
    pdf_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_lead_id ON public.contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_cotizacion_id ON public.contracts(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

-- Habilitar RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 1. Política para usuarios autenticados del Tenant
DROP POLICY IF EXISTS contracts_company_access ON public.contracts;
CREATE POLICY contracts_company_access ON public.contracts
    FOR ALL
    TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    )
    WITH CHECK (
        company_id = public.get_auth_company_id()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'super_admin' OR profiles.is_platform_owner = true)
        )
    );

-- 2. Política pública de lectura (para que prospectos anónimos puedan ver su contrato asignado por ID)
DROP POLICY IF EXISTS contracts_anon_select ON public.contracts;
CREATE POLICY contracts_anon_select ON public.contracts
    FOR SELECT
    TO anon
    USING (true);

-- 3. RPC pública para obtener contrato sin fricción de RLS
CREATE OR REPLACE FUNCTION public.get_public_contract(contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contract RECORD;
    v_company RECORD;
BEGIN
    SELECT * INTO v_contract FROM public.contracts WHERE id = contract_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Contrato no encontrado');
    END IF;

    SELECT id, name, logo_url, website, address, phone, tax_id 
    INTO v_company 
    FROM public.companies 
    WHERE id = v_contract.company_id;

    RETURN jsonb_build_object(
        'contract', row_to_json(v_contract),
        'company', row_to_json(v_company)
    );
END;
$$;

-- 4. RPC pública para firmar digitalmente el contrato
CREATE OR REPLACE FUNCTION public.sign_contract_public(
    p_contract_id UUID,
    p_signer_name TEXT,
    p_signer_identification TEXT,
    p_signer_cargo TEXT,
    p_signature_image TEXT,
    p_signer_ip TEXT DEFAULT NULL,
    p_signer_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contract public.contracts%ROWTYPE;
    v_associated_client_id UUID;
BEGIN
    -- Validar existencia
    SELECT * INTO v_contract FROM public.contracts WHERE id = p_contract_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contrato no encontrado');
    END IF;

    -- Validar si ya está firmado
    IF v_contract.firmado_digitalmente = true THEN
        RETURN jsonb_build_object('success', true, 'message', 'El contrato ya se encontraba firmado', 'contract', row_to_json(v_contract));
    END IF;

    -- Si hay un lead asociado y todavía no hay client_id, buscar si ya existe o crearlo
    IF v_contract.lead_id IS NOT NULL THEN
        -- Promover lead a Cliente si estaba pendiente
        UPDATE public.leads 
        SET status = 'Cliente', updated_at = now()
        WHERE id = v_contract.lead_id;

        -- El trigger trg_lead_cerrado_to_client pudo haber creado el cliente
        SELECT id INTO v_associated_client_id 
        FROM public.clients 
        WHERE lead_id = v_contract.lead_id 
        LIMIT 1;
    END IF;

    -- Actualizar estado de la cotización si aplica
    IF v_contract.cotizacion_id IS NOT NULL THEN
        UPDATE public.cotizaciones
        SET estado = 'aceptada', updated_at = now()
        WHERE id = v_contract.cotizacion_id;
    END IF;

    -- Actualizar el contrato con la firma
    UPDATE public.contracts
    SET 
        status = 'firmado',
        firmado_digitalmente = true,
        firmado_en = now(),
        firmante_nombre = p_signer_name,
        firmante_identificacion = p_signer_identification,
        firmante_cargo = p_signer_cargo,
        firma_imagen = p_signature_image,
        firmante_ip = p_signer_ip,
        firmante_user_agent = p_signer_user_agent,
        client_id = COALESCE(client_id, v_associated_client_id),
        updated_at = now()
    WHERE id = p_contract_id
    RETURNING * INTO v_contract;

    -- Registrar documento en client_documents si existe cliente
    IF v_contract.client_id IS NOT NULL THEN
        BEGIN
            INSERT INTO public.client_documents (
                company_id,
                client_id,
                nombre,
                subido_por_cliente,
                file_type,
                created_at
            ) VALUES (
                v_contract.company_id,
                v_contract.client_id,
                'Contrato de Servicios - ' || v_contract.contract_number || ' (Firmado)',
                false,
                'application/pdf',
                now()
            );
        EXCEPTION WHEN OTHERS THEN
            -- No bloquear si la tabla o columnas varían
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Contrato firmado exitosamente',
        'contract', row_to_json(v_contract)
    );
END;
$$;
