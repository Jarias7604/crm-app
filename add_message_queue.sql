-- =====================================================
-- MARKETING MESSAGE QUEUE SYSTEM
-- Sistema de cola para envíos masivos
-- =====================================================
-- IMPORTANTE: Esta migración NO modifica tablas existentes
-- Solo agrega nueva funcionalidad

-- 1. Tabla de Cola de Mensajes
CREATE TABLE IF NOT EXISTS marketing_message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Canal y contenido
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'email', 'sms')),
    content TEXT NOT NULL,
    subject TEXT, -- Para emails
    
    -- Estado y tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    
    -- Retry y error handling
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata flexible
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_message_queue_status 
    ON marketing_message_queue(status, scheduled_at) 
    WHERE status IN ('pending', 'sending');

CREATE INDEX IF NOT EXISTS idx_message_queue_campaign 
    ON marketing_message_queue(campaign_id);

CREATE INDEX IF NOT EXISTS idx_message_queue_company 
    ON marketing_message_queue(company_id);

CREATE INDEX IF NOT EXISTS idx_message_queue_lead 
    ON marketing_message_queue(lead_id);

-- 2. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_message_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_queue_timestamp
    BEFORE UPDATE ON marketing_message_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_message_queue_timestamp();

-- 3. Función para auto-retry
CREATE OR REPLACE FUNCTION auto_retry_failed_messages()
RETURNS void AS $$
BEGIN
    -- Marca mensajes fallidos para retry si no han excedido max_retries
    UPDATE marketing_message_queue
    SET status = 'pending',
        retry_count = retry_count + 1,
        error = NULL
    WHERE status = 'failed'
        AND retry_count < max_retries
        AND updated_at < NOW() - INTERVAL '5 minutes'; -- Espera 5 min antes de reintentar
END;
$$ LANGUAGE plpgsql;

-- 4. RLS Policies
ALTER TABLE marketing_message_queue ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super admins can manage all message queues"
    ON marketing_message_queue
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Company members: Solo su empresa
CREATE POLICY "Company members can view their message queues"
    ON marketing_message_queue
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE profiles.id = auth.uid()
        )
    );

-- Company admins: Pueden insertar/actualizar
CREATE POLICY "Company admins can manage their message queues"
    ON marketing_message_queue
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'super_admin')
        )
    );

-- 5. Función helper para obtener stats
CREATE OR REPLACE FUNCTION get_campaign_queue_stats(p_campaign_id UUID)
RETURNS TABLE (
    total BIGINT,
    pending BIGINT,
    sending BIGINT,
    sent BIGINT,
    failed BIGINT,
    cancelled BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending,
        COUNT(*) FILTER (WHERE status = 'sending')::BIGINT as sending,
        COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as sent,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT as cancelled
    FROM marketing_message_queue
    WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Comentarios para documentación
COMMENT ON TABLE marketing_message_queue IS 'Cola de mensajes para envíos masivos de campañas de marketing';
COMMENT ON COLUMN marketing_message_queue.status IS 'Estado: pending (esperando), sending (enviando), sent (enviado), failed (fallido), cancelled (cancelado)';
COMMENT ON COLUMN marketing_message_queue.retry_count IS 'Número de reintentos realizados';
COMMENT ON COLUMN marketing_message_queue.metadata IS 'Información adicional en formato JSON (ej: message_id externo, delivery status, etc)';

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON marketing_message_queue TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_queue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_retry_failed_messages() TO authenticated;
