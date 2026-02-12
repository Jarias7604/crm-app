-- ==========================================
-- 🚀 UPDATED DASHBOARD FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_company_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result JSON;
    v_current_month INTEGER := EXTRACT(MONTH FROM COALESCE(p_start_date, now()));
    v_current_year INTEGER := EXTRACT(YEAR FROM COALESCE(p_start_date, now()));
BEGIN
    WITH filtered_leads AS (
        SELECT *
        FROM leads
        WHERE company_id = p_company_id
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    stats AS (
        SELECT
            COUNT(*) as total_leads,
            COALESCE(SUM(value), 0) as total_pipeline,
            COUNT(*) FILTER (WHERE status IN ('Cerrado', 'Cliente')) as won_deals,
            COALESCE(SUM(closing_amount) FILTER (WHERE status IN ('Cerrado', 'Cliente')), 0) as total_won_amount,
            COUNT(*) FILTER (WHERE status = 'Erróneo') as erroneous_leads
        FROM filtered_leads
    ),
    by_status AS (
        SELECT
            json_agg(
                json_build_object(
                    'name', status,
                    'value', count
                )
            ) as data
        FROM (
            SELECT status, COUNT(*) as count
            FROM filtered_leads
            GROUP BY status
            ORDER BY count DESC
        ) s
    ),
    by_source AS (
        SELECT
            json_agg(
                json_build_object(
                    'name', source,
                    'value', count
                )
            ) as data
        FROM (
            SELECT source, COUNT(*) as count
            FROM filtered_leads
            WHERE source IS NOT NULL
            GROUP BY source
            ORDER BY count DESC
        ) s
    ),
    by_priority AS (
        SELECT
            json_agg(
                json_build_object(
                    'name', priority,
                    'value', count
                )
            ) as data
        FROM (
            SELECT priority, COUNT(*) as count
            FROM filtered_leads
            WHERE priority IS NOT NULL
            GROUP BY priority
            ORDER BY count DESC
        ) p
    ),
    top_opportunities AS (
        SELECT
            json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'company_name', company_name,
                    'value', value,
                    'status', status,
                    'priority', priority
                )
            ) as data
        FROM (
            SELECT id, name, company_name, value, status, priority
            FROM filtered_leads
            WHERE value > 0
            ORDER BY value DESC
            LIMIT 4
        ) t
    ),
    quality_trend AS (
        SELECT
            json_agg(
                json_build_object(
                    'date', day,
                    'count', count
                )
            ) as data
        FROM (
            SELECT 
                DATE_TRUNC('day', created_at)::DATE as day,
                COUNT(*) as count
            FROM filtered_leads
            WHERE status = 'Erróneo'
            GROUP BY 1
            ORDER BY 1 ASC
        ) q
    ),
    sales_kpis AS (
        SELECT
            json_agg(
                json_build_object(
                    'agent_name', p.full_name,
                    'actual', COALESCE(s.actual_sales, 0),
                    'target', COALESCE(g.target, 0),
                    'percentage', CASE 
                        WHEN COALESCE(g.target, 0) > 0 
                        THEN ROUND((COALESCE(s.actual_sales, 0) / g.target) * 100)
                        ELSE 0 
                    END
                )
            ) as data
        FROM public.profiles p
        LEFT JOIN (
            SELECT 
                assigned_to, 
                SUM(closing_amount) as actual_sales
            FROM filtered_leads
            WHERE status IN ('Cerrado', 'Cliente')
            GROUP BY assigned_to
        ) s ON s.assigned_to = p.id
        LEFT JOIN public.sales_goals g ON g.agent_id = p.id 
            AND g.company_id = p_company_id
            AND g.month = v_current_month
            AND g.year = v_current_year
        WHERE p.company_id = p_company_id
          AND p.role IN ('sales_agent', 'company_admin')
          AND p.is_active = true
    )
    SELECT json_build_object(
        'stats', json_build_object(
            'totalLeads', (SELECT total_leads FROM stats),
            'totalPipeline', (SELECT total_pipeline FROM stats),
            'wonDeals', (SELECT won_deals FROM stats),
            'totalWonAmount', (SELECT total_won_amount FROM stats),
            'erroneousLeads', (SELECT erroneous_leads FROM stats),
            'conversionRate', CASE 
                WHEN (SELECT total_leads FROM stats) > 0 
                THEN ROUND(((SELECT won_deals FROM stats)::NUMERIC / (SELECT total_leads FROM stats)::NUMERIC) * 100)
                ELSE 0 
            END
        ),
        'byStatus', COALESCE((SELECT data FROM by_status), '[]'::json),
        'bySource', COALESCE((SELECT data FROM by_source), '[]'::json),
        'byPriority', COALESCE((SELECT data FROM by_priority), '[]'::json),
        'topOpportunities', COALESCE((SELECT data FROM top_opportunities), '[]'::json),
        'qualityTrend', COALESCE((SELECT data FROM quality_trend), '[]'::json),
        'salesKpis', COALESCE((SELECT data FROM sales_kpis), '[]'::json)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
