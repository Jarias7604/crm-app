-- Migration: 20260703130000_public_read_marketing_flyers.sql
-- Description: Allow public read of marketing_flyers so clients can view them online without logging in

DROP POLICY IF EXISTS "public_read_marketing_flyers" ON public.marketing_flyers;
CREATE POLICY "public_read_marketing_flyers" ON public.marketing_flyers
  FOR SELECT TO anon, authenticated
  USING (true);
