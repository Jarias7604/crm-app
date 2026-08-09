// @ts-nocheck
/**
 * WHATSAPP EMBEDDED SIGNUP — Edge Function
 * Returns all WABA phone numbers for user selection.
 * Uses system token — no OAuth code exchange needed.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_VERSION = "v21.0";
const SYSTEM_TOKEN = "EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    const { company_id } = body;
    if (!company_id) throw new Error('Missing company_id');

    // Fetch from known WABAs using system token
    const results: { waba_id: string; numbers: any[] }[] = [];
    const knownWabaIds = ['2058962911293336', '2216370055815946', '2076489033220259'];

    for (const wabaId of knownWabaIds) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${SYSTEM_TOKEN}`
        );
        const d = await r.json();
        if (d.data && d.data.length > 0) {
          results.push({ waba_id: wabaId, numbers: d.data });
        }
      } catch (_) {}
    }

    let allNumbers = results.flatMap(r =>
      r.numbers.map(n => ({ ...n, waba_id: r.waba_id }))
    );

    // Deduplicate by id
    const seen = new Set();
    allNumbers = allNumbers.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    // Always include Patty's number
    if (!seen.has('516453938224335')) {
      allNumbers.push({
        id: '516453938224335',
        display_phone_number: '+503 7971 8911',
        verified_name: 'Ventas Patty',
        status: 'CONNECTED',
        waba_id: '493677260500824'
      });
    }

    return new Response(JSON.stringify({
      success: true,
      auto_saved: false,
      token: SYSTEM_TOKEN,
      numbers: allNumbers,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[whatsapp-embedded-signup]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  async function upsertIntegration(companyId: string, token: string, phoneNumberId: string, wabaId: string, phone: string) {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const settings = { token, phoneNumberId, wabaId, phone, connectedVia: 'embedded_signup', connectedAt: new Date().toISOString() };
    const { data: existing } = await supabase.from('marketing_integrations').select('id').eq('company_id', companyId).eq('provider', 'whatsapp').maybeSingle();
    if (existing) {
      await supabase.from('marketing_integrations').update({ settings, is_active: true }).eq('id', existing.id);
    } else {
      await supabase.from('marketing_integrations').insert({ company_id: companyId, provider: 'whatsapp', settings, is_active: true });
    }
  }
});
