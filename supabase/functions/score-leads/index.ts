// @ts-nocheck
/**
 * score-leads — AI-powered Lead Scoring Engine
 * ============================================
 * Replaces static/hardcoded engagement_score with a dynamic,
 * multi-signal score (0-100) for every active lead in a company.
 *
 * Signals used (same logic as HubSpot's Contact Scoring):
 *   - Status advancement       → up to +30 pts
 *   - Follow-up activity       → up to +20 pts
 *   - Recency of contact       → up to +15 pts
 *   - Has email + phone        → up to +15 pts
 *   - Has an active cotización → +10 pts
 *   - Campaign engagement      → up to +10 pts
 *   - Time decay (stale leads) → -2 pts/day inactive
 *
 * Invocation: POST { company_id: "uuid" }
 * Can also run for ALL companies if called as a cron job with {}
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

// Status → base score (progression through the funnel)
const STATUS_SCORE: Record<string, number> = {
  "Prospecto": 5,
  "Contactado": 10,
  "Lead calificado": 15,
  "En seguimiento": 18,
  "Cotizado": 22,
  "Negociación": 28,
  "Cerrado": 30,
  "Cliente": 30,
  "Perdido": 0,
  "Erróneo": 0,
};

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function computeScore(lead: any, cotizaciones: Set<string>, campaignEngaged: Set<string>): number {
  let score = 0;

  // 1. Status progression (0-30 pts)
  score += STATUS_SCORE[lead.status] ?? 5;

  // 2. Follow-up activity (0-20 pts) — capped at 5 follow-ups
  const followUps = Math.min(lead.contact_count || 0, 5);
  score += followUps * 4;

  // 3. Recency of last contact (0-15 pts)
  const daysSinceContact = daysSince(lead.last_follow_up_at ?? lead.created_at);
  if (daysSinceContact <= 1) score += 15;
  else if (daysSinceContact <= 3) score += 12;
  else if (daysSinceContact <= 7) score += 8;
  else if (daysSinceContact <= 14) score += 4;
  else if (daysSinceContact <= 30) score += 2;
  // 30+ days: 0 pts, plus decay below

  // 4. Contact completeness (0-15 pts)
  if (lead.email && lead.phone) score += 15;
  else if (lead.email || lead.phone) score += 7;

  // 5. Has active cotización (0-10 pts)
  if (cotizaciones.has(lead.id)) score += 10;

  // 6. Campaign engagement (0-10 pts)
  if (campaignEngaged.has(lead.id)) score += 10;

  // 7. Priority boost
  if (lead.priority === "high") score += 5;

  // 8. Time decay — stale leads lose pts (min 0)
  if (daysSinceContact > 30) {
    const staleDays = Math.floor(daysSinceContact - 30);
    score -= Math.min(staleDays * 2, 20); // max -20 pts decay
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { company_id } = body;

    // Load all ACTIVE leads (exclude permanently closed)
    let leadsQuery = supabase
      .from("leads")
      .select("id, status, priority, email, phone, contact_count, last_follow_up_at, created_at, company_id")
      .not("status", "in", '("Perdido","Erróneo")');

    if (company_id) leadsQuery = leadsQuery.eq("company_id", company_id);

    const { data: leads, error: leadsError } = await leadsQuery;
    if (leadsError) throw leadsError;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: true, scored: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const leadIds = leads.map((l: any) => l.id);

    // Leads with cotizaciones (any status)
    const { data: cotizRows } = await supabase
      .from("cotizaciones")
      .select("lead_id")
      .in("lead_id", leadIds);
    const cotizaciones = new Set((cotizRows || []).map((r: any) => r.lead_id));

    // Leads that opened/clicked a marketing campaign message
    const { data: engagRows } = await supabase
      .from("marketing_messages")
      .select("metadata")
      .in("metadata->>lead_id", leadIds)
      .eq("direction", "outbound");
    const campaignEngaged = new Set(
      (engagRows || [])
        .filter((r: any) => r.metadata?.opened || r.metadata?.clicked)
        .map((r: any) => r.metadata?.lead_id)
        .filter(Boolean)
    );

    // Compute and batch-update scores
    const updates = leads.map((lead: any) => ({
      id: lead.id,
      engagement_score: computeScore(lead, cotizaciones, campaignEngaged),
    }));

    // Update in batches of 100 to avoid payload limits
    const BATCH = 100;
    let updated = 0;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      const { error: updateError } = await supabase
        .from("leads")
        .upsert(batch, { onConflict: "id" });
      if (updateError) console.error(`Batch ${i / BATCH} error:`, updateError);
      else updated += batch.length;
    }

    console.log(`[score-leads] Scored ${updated}/${leads.length} leads for company: ${company_id || "ALL"}`);

    return new Response(
      JSON.stringify({ success: true, scored: updated, total: leads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[score-leads] FATAL:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
