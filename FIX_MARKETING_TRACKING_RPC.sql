-- Create the RPC for incrementing marketing campaign stats
-- This ensures that tracking Edge Functions can update the dashboard in real-time

CREATE OR REPLACE FUNCTION increment_campaign_stats(campaign_id UUID, stat_key TEXT)
RETURNS VOID AS $$
BEGIN
  -- We assume stats is a jsonb column with keys like 'sent', 'opened', 'clicked'
  UPDATE marketing_campaigns
  SET stats = jsonb_set(
    COALESCE(stats, '{}'::jsonb),
    array[stat_key],
    (COALESCE((stats->>stat_key)::int, 0) + 1)::text::jsonb
  )
  WHERE id = campaign_id;

  -- Optional: If it was the first open/click, update statuses or timestamps
  IF stat_key = 'sent' AND (SELECT status FROM marketing_campaigns WHERE id = campaign_id) = 'draft' THEN
    UPDATE marketing_campaigns SET status = 'sending' WHERE id = campaign_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION increment_campaign_stats IS 'Increments a specific stat counter in the marketing_campaigns JSONB stats column.';
