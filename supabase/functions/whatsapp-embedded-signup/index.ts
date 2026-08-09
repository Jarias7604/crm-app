// @ts-nocheck
/**
 * WHATSAPP EMBEDDED SIGNUP — Edge Function
 * Exchanges the code from Meta's Embedded Signup popup for an access token,
 * or returns all WABA phone numbers to pick/confirm.
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
    const { code, company_id, redirect_uri } = body;
    if (!company_id) throw new Error('Missing company_id');

    const APP_ID = Deno.env.get('META_APP_ID') || '1187621119804509';
    const APP_SECRET = Deno.env.get('META_APP_SECRET');
    const cleanRedirectUri = redirect_uri || 'https://ariascrm.com/integrations/wa/callback';

    let userToken = SYSTEM_TOKEN;

    // STEP 1: If code + secret available, exchange code for user access token
    if (code && code !== 'direct_fetch' && APP_SECRET) {
      try {
        const params = new URLSearchParams({
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: cleanRedirectUri,
          code: code,
        });

        const tokenRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          userToken = tokenData.access_token;
        } else if (tokenData.error) {
          console.warn('OAuth code exchange warning:', tokenData.error.message);
        }
      } catch (e) {
        console.warn('OAuth code exchange failed, using system token:', e.message);
      }
    }

    // STEP 2: Fetch WABAs + phone numbers
    const results: { waba_id: string; numbers: any[] }[] = [];

    // Query 1: me/businesses
    try {
      const r1 = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/me/businesses?fields=owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}}&access_token=${userToken}`
      );
      const d1 = await r1.json();
      for (const biz of d1.data || []) {
        for (const waba of biz.owned_whatsapp_business_accounts?.data || []) {
          const nums = waba.phone_numbers?.data || [];
          if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
        }
      }
    } catch (e) {
      console.warn('Business fetch failed:', e.message);
    }

    // Query 2: me/whatsapp_business_accounts
    try {
      const r2 = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/me?fields=whatsapp_business_accounts{id,phone_numbers{id,display_phone_number,verified_name,status}}&access_token=${userToken}`
      );
      const d2 = await r2.json();
      for (const waba of d2.whatsapp_business_accounts?.data || []) {
        const nums = waba.phone_numbers?.data || [];
        if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
      }
    } catch (e) {
      console.warn('WABA fetch failed:', e.message);
    }

    // Query 3: Known WABAs fallback
    const knownWabaIds = ['2058962911293336', '2216370055815946', '493677260500824', '2076489033220259'];
    for (const wabaId of knownWabaIds) {
      try {
        const r3 = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${SYSTEM_TOKEN}`
        );
        const d3 = await r3.json();
        if (d3.data && d3.data.length > 0) {
          results.push({ waba_id: wabaId, numbers: d3.data });
        }
      } catch (_) {}
    }

    let allNumbers = results.flatMap(r =>
      r.numbers.map(n => ({ ...n, waba_id: r.waba_id }))
    );

    // Deduplicate numbers by id
    const seen = new Set();
    allNumbers = allNumbers.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    // Always include Patty's number (+503 7971 8911) as available option if not present
    if (!seen.has('516453938224335')) {
      allNumbers.push({
        id: '516453938224335',
        display_phone_number: '+503 7971 8911',
        verified_name: 'Arias Defense Components (Ventas Patty)',
        status: 'CONNECTED',
        waba_id: '493677260500824'
      });
    }

    // Multiple numbers — return list for user to pick
    return new Response(JSON.stringify({
      success: true, auto_saved: false,
      token: userToken,
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
