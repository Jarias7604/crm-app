-- Migration: Add parent_ticket_id to tickets
-- Date: 2026-06-16
-- Purpose: Support child tickets (sub-tickets) that prevent parent deletion (RESTRICT)

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id UUID REFERENCES public.tickets(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.tickets.parent_ticket_id IS 'Link to the parent support ticket (for sub-tickets)';
