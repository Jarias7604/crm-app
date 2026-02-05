-- Script de migración: Agregar descripciones a cotizaciones existentes
-- Este script actualiza el campo modulos_adicionales de todas las cotizaciones
-- para incluir la descripción de cada módulo/servicio desde pricing_items

-- Paso 1: Crear función temporal para actualizar modulos_adicionales
CREATE OR REPLACE FUNCTION temp_update_modulos_descriptions()
RETURNS void AS $$
DECLARE
    cot_record RECORD;
    modulos_array JSONB;
    updated_modulos JSONB;
    mod JSONB;
    mod_nombre TEXT;
    mod_descripcion TEXT;
    i INT;
BEGIN
    -- Iterar sobre todas las cotizaciones que tienen modulos_adicionales
    FOR cot_record IN 
        SELECT id, modulos_adicionales 
        FROM cotizaciones 
        WHERE modulos_adicionales IS NOT NULL 
          AND modulos_adicionales != '[]'::jsonb
          AND modulos_adicionales != 'null'::jsonb
    LOOP
        modulos_array := cot_record.modulos_adicionales;
        updated_modulos := '[]'::jsonb;
        
        -- Iterar sobre cada módulo en el array
        FOR i IN 0..jsonb_array_length(modulos_array) - 1 LOOP
            mod := modulos_array->i;
            mod_nombre := mod->>'nombre';
            
            -- Buscar la descripción en pricing_items
            SELECT descripcion INTO mod_descripcion
            FROM pricing_items
            WHERE nombre = mod_nombre
            LIMIT 1;
            
            -- Si encontramos descripción y el módulo no tiene una, agregarla
            IF mod_descripcion IS NOT NULL AND (mod->>'descripcion' IS NULL OR mod->>'descripcion' = '') THEN
                mod := jsonb_set(mod, '{descripcion}', to_jsonb(mod_descripcion));
            END IF;
            
            -- Agregar el módulo actualizado al array
            updated_modulos := updated_modulos || jsonb_build_array(mod);
        END LOOP;
        
        -- Actualizar la cotización
        UPDATE cotizaciones 
        SET modulos_adicionales = updated_modulos
        WHERE id = cot_record.id;
        
        RAISE NOTICE 'Actualizada cotización: %', cot_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Paso 2: Ejecutar la función
SELECT temp_update_modulos_descriptions();

-- Paso 3: Eliminar la función temporal
DROP FUNCTION IF EXISTS temp_update_modulos_descriptions();

-- Verificar resultados
SELECT id, modulos_adicionales
FROM cotizaciones
WHERE modulos_adicionales IS NOT NULL 
  AND modulos_adicionales != '[]'::jsonb
LIMIT 5;
