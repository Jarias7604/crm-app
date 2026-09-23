-- ================================================================
-- PURGE: Limpieza quirúrgica de conversaciones y leads contaminados
-- Causa: Mensajes dirigidos al número de Patricia (+503 7971 8911 / 516453938224335)
-- y chats personales/spam (Oscar, etc.)
-- ================================================================

DO $$
DECLARE
  v_conv_ids UUID[];
  v_lead_ids UUID[];
BEGIN
  -- 1. Identificar todas las conversaciones contaminadas
  SELECT ARRAY_AGG(id) INTO v_conv_ids
  FROM public.marketing_conversations
  WHERE metadata->>'phone_number_id' = '516453938224335'
     OR external_id IN ('50368273898', '50375812428', '50379283497', '50379028970', '50374705451');

  -- 2. Identificar los leads falsos asociados a estas conversaciones
  SELECT ARRAY_AGG(DISTINCT lead_id) INTO v_lead_ids
  FROM public.marketing_conversations
  WHERE id = ANY(v_conv_ids) AND lead_id IS NOT NULL;

  -- 3. Borrar tablas secundarias de leads si existen
  IF v_lead_ids IS NOT NULL AND array_length(v_lead_ids, 1) > 0 THEN
    BEGIN
      DELETE FROM public.lead_marketing_stats WHERE lead_id = ANY(v_lead_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.follow_ups WHERE lead_id = ANY(v_lead_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 4. Borrar mensajes de las conversaciones contaminadas
  IF v_conv_ids IS NOT NULL AND array_length(v_conv_ids, 1) > 0 THEN
    DELETE FROM public.marketing_messages WHERE conversation_id = ANY(v_conv_ids);
  END IF;

  -- 5. Borrar cualquier mensaje huérfano de Patricia o spam
  DELETE FROM public.marketing_messages WHERE metadata->>'phone_number_id' = '516453938224335';
  DELETE FROM public.marketing_messages WHERE metadata->>'chat_id' IN ('50368273898', '50375812428', '50379283497', '50379028970', '50374705451');

  -- 6. Borrar las conversaciones contaminadas
  IF v_conv_ids IS NOT NULL AND array_length(v_conv_ids, 1) > 0 THEN
    DELETE FROM public.marketing_conversations WHERE id = ANY(v_conv_ids);
  END IF;
  DELETE FROM public.marketing_conversations WHERE metadata->>'phone_number_id' = '516453938224335';
  DELETE FROM public.marketing_conversations WHERE external_id IN ('50368273898', '50375812428', '50379283497', '50379028970', '50374705451');

  -- 7. Borrar los leads falsos contaminados
  IF v_lead_ids IS NOT NULL AND array_length(v_lead_ids, 1) > 0 THEN
    BEGIN
      DELETE FROM public.leads WHERE id = ANY(v_lead_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;
