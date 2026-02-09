-- =====================================================
-- RPC FUNCTION: Get Loss Statistics for Pareto Analysis
-- =====================================================
-- This function aggregates lost leads by reason and calculates
-- Pareto statistics (80/20 rule) for analytics visualization

CREATE OR REPLACE FUNCTION get_loss_statistics(
    p_company_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    reason_id UUID,
    reason_name TEXT,
    loss_count BIGINT,
    percentage NUMERIC,
    cumulative_percentage NUMERIC
) AS $$
DECLARE
    v_company_id UUID;
    v_total_lost BIGINT;
BEGIN
    -- Get company_id from auth context if not provided
    v_company_id := COALESCE(
        p_company_id,
        (SELECT company_id FROM profiles WHERE id = auth.uid())
    );

    -- Calculate total lost leads for this company (for percentage calculation)
    SELECT COUNT(*)
    INTO v_total_lost
    FROM leads l
    WHERE l.company_id = v_company_id
      AND l.status = 'Perdido'
      AND l.lost_reason_id IS NOT NULL
      AND (p_start_date IS NULL OR l.lost_date >= p_start_date)
      AND (p_end_date IS NULL OR l.lost_date <= p_end_date);

    -- Return aggregated statistics sorted by count (descending) for Pareto
    RETURN QUERY
    WITH loss_counts AS (
        SELECT 
            l.lost_reason_id,
            lr.reason,
            COUNT(*) as count
        FROM leads l
        INNER JOIN loss_reasons lr ON l.lost_reason_id = lr.id
        WHERE l.company_id = v_company_id
          AND l.status = 'Perdido'
          AND l.lost_reason_id IS NOT NULL
          AND (p_start_date IS NULL OR l.lost_date >= p_start_date)
          AND (p_end_date IS NULL OR l.lost_date <= p_end_date)
        GROUP BY l.lost_reason_id, lr.reason
        ORDER BY count DESC
    ),
    with_percentages AS (
        SELECT 
            lost_reason_id,
            reason,
            count,
            CASE 
                WHEN v_total_lost > 0 
                THEN ROUND((count::NUMERIC / v_total_lost::NUMERIC) * 100, 2)
                ELSE 0
            END as pct
        FROM loss_counts
    ),
    with_cumulative AS (
        SELECT 
            lost_reason_id,
            reason,
            count,
            pct,
            SUM(pct) OVER (ORDER BY count DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cum_pct
        FROM with_percentages
    )
    SELECT 
        lost_reason_id::UUID,
        reason::TEXT,
        count::BIGINT,
        pct::NUMERIC,
        cum_pct::NUMERIC
    FROM with_cumulative
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_loss_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_loss_statistics IS 'Aggregates lost leads by reason with Pareto analysis (cumulative percentages) for the authenticated user''s company';

-- =====================================================
-- EXAMPLE USAGE:
-- =====================================================
-- Get all-time statistics for current user's company:
-- SELECT * FROM get_loss_statistics();
--
-- Get statistics for specific date range:
-- SELECT * FROM get_loss_statistics(NULL, '2024-01-01'::TIMESTAMPTZ, '2024-12-31'::TIMESTAMPTZ);
--
-- Get statistics for specific company (Super Admin only):
-- SELECT * FROM get_loss_statistics('company-uuid-here'::UUID, NULL, NULL);
-- =====================================================
