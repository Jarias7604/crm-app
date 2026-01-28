-- Optimized Dashboard Stats Function
-- Replaces 5 separate queries with 1 aggregated query
-- Reduces database round-trips from 5 to 1

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
            COUNT(*) FILTER (WHERE status IN ('Cerrado', 'Cliente')) as won_deals
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
    )
    SELECT json_build_object(
        'stats', json_build_object(
            'totalLeads', (SELECT total_leads FROM stats),
            'totalPipeline', (SELECT total_pipeline FROM stats),
            'wonDeals', (SELECT won_deals FROM stats),
            'conversionRate', CASE 
                WHEN (SELECT total_leads FROM stats) > 0 
                THEN ROUND(((SELECT won_deals FROM stats)::NUMERIC / (SELECT total_leads FROM stats)::NUMERIC) * 100)
                ELSE 0 
            END
        ),
        'byStatus', COALESCE((SELECT data FROM by_status), '[]'::json),
        'bySource', COALESCE((SELECT data FROM by_source), '[]'::json),
        'byPriority', COALESCE((SELECT data FROM by_priority), '[]'::json),
        'topOpportunities', COALESCE((SELECT data FROM top_opportunities), '[]'::json)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_dashboard_stats IS 'Optimized function to fetch all dashboard statistics in a single query. Replaces 5 separate queries with 1 aggregated query for better performance.';
