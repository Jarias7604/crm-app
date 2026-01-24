-- Mejorar la función de búsqueda para que siempre devuelva el paquete más cercano (o el máximo disponible)
CREATE OR REPLACE FUNCTION buscar_paquete_por_dtes(
    p_cantidad_dtes INTEGER,
    p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    paquete TEXT,
    cantidad_dtes INTEGER,
    costo_implementacion DECIMAL,
    costo_paquete_anual DECIMAL,
    costo_paquete_mensual DECIMAL
) AS $$
DECLARE
    v_has_exact BOOLEAN;
BEGIN
    -- Verificar si hay algún paquete que cubra la cantidad
    SELECT EXISTS (
        SELECT 1 FROM cotizador_paquetes 
        WHERE activo = true 
        AND (company_id IS NULL OR company_id = p_company_id)
        AND cantidad_dtes >= p_cantidad_dtes
    ) INTO v_has_exact;

    IF v_has_exact THEN
        -- Si hay paquetes que cubren, devolver el menor de ellos
        RETURN QUERY
        SELECT 
            cp.id, cp.paquete, cp.cantidad_dtes,
            cp.costo_implementacion, cp.costo_paquete_anual, cp.costo_paquete_mensual
        FROM cotizador_paquetes cp
        WHERE cp.activo = true
        AND (cp.company_id IS NULL OR cp.company_id = p_company_id)
        AND cp.cantidad_dtes >= p_cantidad_dtes
        ORDER BY cp.cantidad_dtes ASC
        LIMIT 1;
    ELSE
        -- Si ninguno cubre (volumen muy alto), devolver el más grande disponible
        RETURN QUERY
        SELECT 
            cp.id, cp.paquete, cp.cantidad_dtes,
            cp.costo_implementacion, cp.costo_paquete_anual, cp.costo_paquete_mensual
        FROM cotizador_paquetes cp
        WHERE cp.activo = true
        AND (cp.company_id IS NULL OR cp.company_id = p_company_id)
        ORDER BY cp.cantidad_dtes DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
