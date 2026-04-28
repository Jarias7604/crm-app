-- Backfill internal_won_date for legacy closed deals
UPDATE public.leads 
SET internal_won_date = COALESCE(updated_at, created_at) 
WHERE status IN ('Cerrado', 'Cliente') AND internal_won_date IS NULL;

-- Update get_dashboard_stats to use strictly internal_won_date for tracking closed deals
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_company_id uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_assigned_to uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSON;
    v_prev_start TIMESTAMPTZ;
    v_prev_end TIMESTAMPTZ;
    v_duration INTERVAL;
    v_curr_total_leads INTEGER;
    v_curr_total_pipeline NUMERIC;
    v_curr_won_count INTEGER;
    v_curr_won_amount NUMERIC;
    v_curr_erroneous_count INTEGER;
    v_prev_leads_count INTEGER;
    v_prev_pipeline NUMERIC;
    v_prev_won_count INTEGER;
    v_prev_erroneous_count INTEGER;
    v_current_month INTEGER := EXTRACT(MONTH FROM COALESCE(p_start_date, now()));
    v_current_year INTEGER := EXTRACT(YEAR FROM COALESCE(p_start_date, now()));
BEGIN
    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        v_duration := p_end_date - p_start_date;
        v_prev_start := p_start_date - v_duration;
        v_prev_end := p_start_date;
    ELSE v_prev_start := NULL; v_prev_end := NULL; END IF;

    SELECT COUNT(*), COALESCE(SUM(value), 0), COUNT(*) FILTER (WHERE status = 'Erróneo')
    INTO v_curr_total_leads, v_curr_total_pipeline, v_curr_erroneous_count
    FROM public.leads WHERE company_id = p_company_id
      AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
      AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date);

    SELECT COUNT(*), COALESCE(SUM(closing_amount), 0)
    INTO v_curr_won_count, v_curr_won_amount
    FROM public.leads WHERE company_id = p_company_id AND status IN ('Cerrado', 'Cliente')
      AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
      AND (p_start_date IS NULL OR internal_won_date >= p_start_date)
      AND (p_end_date IS NULL OR internal_won_date <= p_end_date);

    IF v_prev_start IS NOT NULL THEN
        SELECT COUNT(*), COALESCE(SUM(value), 0), COUNT(*) FILTER (WHERE status = 'Erróneo')
        INTO v_prev_leads_count, v_prev_pipeline, v_prev_erroneous_count
        FROM public.leads WHERE company_id = p_company_id
          AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
          AND created_at >= v_prev_start AND created_at < v_prev_end;
        SELECT COUNT(*) INTO v_prev_won_count FROM public.leads WHERE company_id = p_company_id AND status IN ('Cerrado', 'Cliente')
          AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
          AND internal_won_date >= v_prev_start AND internal_won_date < v_prev_end;
    ELSE v_prev_leads_count := 0; v_prev_pipeline := 0; v_prev_won_count := 0; v_prev_erroneous_count := 0; END IF;

    SELECT json_build_object(
        'stats', json_build_object(
            'totalLeads', v_curr_total_leads,
            'totalLeadsTrend', CASE WHEN v_prev_leads_count > 0 THEN ROUND(((v_curr_total_leads - v_prev_leads_count)::NUMERIC / v_prev_leads_count) * 100, 1) ELSE 0 END,
            'totalPipeline', v_curr_total_pipeline,
            'totalPipelineTrend', CASE WHEN v_prev_pipeline > 0 THEN ROUND(((v_curr_total_pipeline - v_prev_pipeline) / v_prev_pipeline) * 100, 1) ELSE 0 END,
            'wonDeals', v_curr_won_count,
            'wonDealsTrend', CASE WHEN v_prev_won_count > 0 THEN ROUND(((v_curr_won_count - v_prev_won_count)::NUMERIC / v_prev_won_count) * 100, 1) ELSE 0 END,
            'totalWonAmount', v_curr_won_amount,
            'conversionRate', CASE WHEN v_curr_total_leads > 0 THEN ROUND((v_curr_won_count::NUMERIC / v_curr_total_leads) * 100) ELSE 0 END,
            'conversionRateTrend', 0,
            'erroneousLeads', v_curr_erroneous_count,
            'erroneousLeadsTrend', CASE WHEN v_prev_erroneous_count > 0 THEN ROUND(((v_curr_erroneous_count - v_prev_erroneous_count)::NUMERIC / v_prev_erroneous_count) * 100, 1) ELSE 0 END
        ),
        'byStatus', (
            SELECT COALESCE(json_agg(json_build_object('name', status, 'value', count::INTEGER, 'amount', amount)), '[]'::json)
            FROM (
                SELECT status, COUNT(*) as count, COALESCE(SUM(value), 0) as amount FROM public.leads WHERE company_id = p_company_id
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                  AND status NOT IN ('Cerrado', 'Cliente', 'Perdido', 'Erróneo')
                  AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY status
                UNION ALL
                SELECT status, COUNT(*) as count, COALESCE(SUM(closing_amount), 0) as amount FROM public.leads WHERE company_id = p_company_id
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                  AND status IN ('Cerrado', 'Cliente')
                  AND (p_start_date IS NULL OR internal_won_date >= p_start_date) AND (p_end_date IS NULL OR internal_won_date <= p_end_date) GROUP BY status
                UNION ALL
                SELECT status, COUNT(*) as count, COALESCE(SUM(value), 0) as amount FROM public.leads WHERE company_id = p_company_id
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                  AND status = 'Erróneo'
                  AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY status
                UNION ALL
                SELECT status, COUNT(*) as count, COALESCE(SUM(value), 0) as amount FROM public.leads WHERE company_id = p_company_id
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                  AND status = 'Perdido'
                  AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY status
            ) sub
        ),
        'bySource', (SELECT COALESCE(json_agg(json_build_object('name', source_label, 'value', count::INTEGER)), '[]'::json) FROM (
            SELECT COALESCE(NULLIF(source, ''), 'Otros') as source_label, COUNT(*) as count FROM public.leads WHERE company_id = p_company_id
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY source_label ORDER BY count DESC) sc),
        'byPriority', (SELECT COALESCE(json_agg(json_build_object('name', priority, 'value', count::INTEGER)), '[]'::json) FROM (
            SELECT priority, COUNT(*) as count FROM public.leads WHERE company_id = p_company_id AND priority IS NOT NULL
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY priority) p),
        'upcomingFollowUps', (SELECT COALESCE(json_agg(f), '[]'::json) FROM (
            SELECT id, name, company_name, next_followup_date, next_action_notes, status FROM public.leads WHERE company_id = p_company_id
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND next_followup_date IS NOT NULL AND status NOT IN ('Cerrado', 'Cliente', 'Perdido', 'Erróneo') ORDER BY next_followup_date ASC LIMIT 10) f),
        'recentConversions', (SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT id, name, company_name, value, closing_amount, status, internal_won_date as updated_at FROM public.leads WHERE company_id = p_company_id
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND status IN ('Cerrado', 'Cliente')
              AND (p_start_date IS NULL OR internal_won_date >= p_start_date) AND (p_end_date IS NULL OR internal_won_date <= p_end_date)
              ORDER BY internal_won_date DESC LIMIT 15) c),
        'topOpportunities', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT id, name, company_name, value, status, priority FROM public.leads WHERE company_id = p_company_id
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND status NOT IN ('Cerrado', 'Cliente', 'Perdido', 'Erróneo') AND value > 0
              AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) ORDER BY value DESC LIMIT 4) t),
        'lossReasons', (SELECT COALESCE(json_agg(json_build_object('reason_id', id, 'reason_name', reason, 'loss_count', count::INTEGER, 'percentage', percentage)), '[]'::json) FROM (
            SELECT lr.id, lr.reason, COUNT(l.id) as count,
                ROUND((COUNT(l.id)::NUMERIC / NULLIF((SELECT COUNT(*) FROM public.leads WHERE company_id = p_company_id AND status = 'Perdido'
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                  AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date)), 0) * 100)) as percentage
            FROM public.loss_reasons lr LEFT JOIN public.leads l ON l.lost_reason_id = lr.id AND l.status = 'Perdido'
              AND (p_assigned_to IS NULL OR l.assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR l.created_at >= p_start_date) AND (p_end_date IS NULL OR l.created_at <= p_end_date)
            WHERE lr.company_id = p_company_id OR lr.company_id IS NULL GROUP BY lr.id, lr.reason HAVING COUNT(l.id) > 0 ORDER BY count DESC) r),
        'lossStages', (SELECT COALESCE(json_agg(json_build_object('stage_name', lost_at_stage, 'loss_count', count::INTEGER)), '[]'::json) FROM (
            SELECT COALESCE(lost_at_stage, 'Desconocida') as lost_at_stage, COUNT(*) as count FROM public.leads WHERE company_id = p_company_id AND status = 'Perdido'
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY lost_at_stage ORDER BY count DESC) ls),
        'qualityTrend', (SELECT COALESCE(json_agg(json_build_object('date', day, 'count', count)), '[]'::json) FROM (
            SELECT DATE_TRUNC('day', created_at)::DATE as day, COUNT(*) as count FROM public.leads WHERE company_id = p_company_id AND status = 'Erróneo'
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at <= p_end_date) GROUP BY 1 ORDER BY 1 ASC) q),
        'salesTrend', (SELECT COALESCE(json_agg(json_build_object('date', day, 'amount', amount, 'count', count)), '[]'::json) FROM (
            SELECT DATE_TRUNC('day', internal_won_date)::DATE as day, COALESCE(SUM(closing_amount), 0) as amount, COUNT(*) as count 
            FROM public.leads 
            WHERE company_id = p_company_id AND status IN ('Cerrado', 'Cliente') AND internal_won_date IS NOT NULL
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR internal_won_date >= p_start_date) 
              AND (p_end_date IS NULL OR internal_won_date <= p_end_date) 
            GROUP BY 1 ORDER BY 1 ASC) st),
        'salesKpis', (SELECT COALESCE(json_agg(json_build_object('agent_name', p.full_name, 'actual', COALESCE(s.actual_sales, 0), 'target', COALESCE(g.target, 0),
                'percentage', CASE WHEN COALESCE(g.target, 0) > 0 THEN ROUND((COALESCE(s.actual_sales, 0) / g.target) * 100) ELSE 0 END)), '[]'::json)
            FROM public.profiles p
            LEFT JOIN (SELECT assigned_to, SUM(closing_amount) as actual_sales FROM public.leads WHERE company_id = p_company_id AND status IN ('Cerrado', 'Cliente')
              AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
              AND (p_start_date IS NULL OR internal_won_date >= p_start_date) AND (p_end_date IS NULL OR internal_won_date <= p_end_date) GROUP BY assigned_to) s ON s.assigned_to = p.id
            LEFT JOIN public.sales_goals g ON g.agent_id = p.id AND g.company_id = p_company_id AND g.month = v_current_month AND g.year = v_current_year
            WHERE p.company_id = p_company_id AND p.role IN ('sales_agent', 'company_admin') AND p.is_active = true)
    ) INTO v_result;
    RETURN v_result;
END;
$function$;
