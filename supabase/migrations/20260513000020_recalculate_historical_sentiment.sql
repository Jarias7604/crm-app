-- =============================================================================
-- TAREA 3: Recálculo de sentiment para leads históricos
-- Actualiza lead_ai_memory.sentiment_score basado en el último mensaje
-- de cada lead en marketing_messages (dirección "inbound").
-- Ejecutar UNA SOLA VEZ en la consola SQL de Supabase.
-- =============================================================================

DO $$
DECLARE
    r RECORD;
    v_last_msg     TEXT;
    v_new_score    INTEGER;
    v_updated      INTEGER := 0;
    v_skipped      INTEGER := 0;
BEGIN

    -- Loop over every lead_ai_memory row
    FOR r IN
        SELECT m.lead_id, m.company_id, m.sentiment_score
        FROM   lead_ai_memory m
        ORDER BY m.lead_id
    LOOP
        -- Pull the latest inbound message for this lead
        SELECT mm.content
        INTO   v_last_msg
        FROM   marketing_messages mm
        JOIN   marketing_conversations mc ON mc.id = mm.conversation_id
        WHERE  mc.lead_id  = r.lead_id
        AND    mm.direction = 'inbound'
        ORDER BY mm.created_at DESC
        LIMIT 1;

        IF v_last_msg IS NULL THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        -- ── Sentiment scoring heuristic (same logic as edge function) ──────
        -- Starts at 50, adjust based on keyword patterns found in the text.
        v_new_score := 50;

        -- Positive signals (+)
        IF v_last_msg ILIKE '%si%'           THEN v_new_score := v_new_score + 15; END IF;
        IF v_last_msg ILIKE '%interesado%'   THEN v_new_score := v_new_score + 20; END IF;
        IF v_last_msg ILIKE '%cuando%'       THEN v_new_score := v_new_score + 10; END IF;
        IF v_last_msg ILIKE '%precio%'       THEN v_new_score := v_new_score + 5;  END IF;
        IF v_last_msg ILIKE '%cuanto%'       THEN v_new_score := v_new_score + 10; END IF;
        IF v_last_msg ILIKE '%demo%'         THEN v_new_score := v_new_score + 15; END IF;
        IF v_last_msg ILIKE '%cotiza%'       THEN v_new_score := v_new_score + 15; END IF;
        IF v_last_msg ILIKE '%quiero%'       THEN v_new_score := v_new_score + 20; END IF;
        IF v_last_msg ILIKE '%necesito%'     THEN v_new_score := v_new_score + 15; END IF;
        IF v_last_msg ILIKE '%gracias%'      THEN v_new_score := v_new_score + 10; END IF;
        IF v_last_msg ILIKE '%perfecto%'     THEN v_new_score := v_new_score + 20; END IF;
        IF v_last_msg ILIKE '%excelente%'    THEN v_new_score := v_new_score + 20; END IF;
        IF v_last_msg ILIKE '%adel%'         THEN v_new_score := v_new_score + 15; END IF;

        -- Negative signals (-)
        IF v_last_msg ILIKE '%no%'           THEN v_new_score := v_new_score - 15; END IF;
        IF v_last_msg ILIKE '%caro%'         THEN v_new_score := v_new_score - 20; END IF;
        IF v_last_msg ILIKE '%expensive%'    THEN v_new_score := v_new_score - 20; END IF;
        IF v_last_msg ILIKE '%no me interesa%' THEN v_new_score := v_new_score - 30; END IF;
        IF v_last_msg ILIKE '%ya tengo%'     THEN v_new_score := v_new_score - 20; END IF;
        IF v_last_msg ILIKE '%después%'      THEN v_new_score := v_new_score - 10; END IF;
        IF v_last_msg ILIKE '%luego%'        THEN v_new_score := v_new_score - 10; END IF;
        IF v_last_msg ILIKE '%ocupado%'      THEN v_new_score := v_new_score - 10; END IF;
        IF v_last_msg ILIKE '%no puedo%'     THEN v_new_score := v_new_score - 15; END IF;
        IF v_last_msg ILIKE '%stop%'         THEN v_new_score := v_new_score - 40; END IF;
        IF v_last_msg ILIKE '%baja%'         THEN v_new_score := v_new_score - 25; END IF;
        IF v_last_msg ILIKE '%cancelar%'     THEN v_new_score := v_new_score - 30; END IF;

        -- Clamp to [0, 100]
        v_new_score := GREATEST(0, LEAST(100, v_new_score));

        -- Only update if score actually changed from the stored value
        IF v_new_score <> COALESCE(r.sentiment_score, 50) THEN
            UPDATE lead_ai_memory
            SET    sentiment_score = v_new_score,
                   updated_at      = NOW()
            WHERE  lead_id = r.lead_id;
            v_updated := v_updated + 1;
            RAISE NOTICE 'Lead %: sentiment % → %', r.lead_id, COALESCE(r.sentiment_score, 50), v_new_score;
        ELSE
            v_skipped := v_skipped + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '=== DONE: % updated, % skipped (no change or no messages) ===', v_updated, v_skipped;
END;
$$;
