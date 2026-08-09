// @ts-nocheck
/**
 * WHATSAPP EMBEDDED SIGNUP — Edge Function
 * Exchanges the code from Meta's Embedded Signup popup for an access token,
 * or falls back to system token, then returns all WABA phone numbers to pick/confirm.
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
    const { code, company_id } = await req.json();
    if (!company_id) throw new Error('Missing company_id');

    const APP_ID = Deno.env.get('META_APP_ID') || '1187621119804509';
    const APP_SECRET = Deno.env.get('META_APP_SECRET');

    let userToken = SYSTEM_TOKEN;

    // STEP 1: If code + secret available, exchange code for user access token
    if (code && APP_SECRET) {
      try {
        const tokenRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, code }).toString(),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          userToken = tokenData.access_token;
        }
      } catch (e) {
        console.warn('OAuth code exchange failed, falling back to system token:', e.message);
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

    // Query 2: me/whatsapp_business_accounts (or explicit WABA lookup if empty)
    if (results.length === 0) {
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
    }

    // Query 3: Known WABAs fallback (for system token)
    if (results.length === 0) {
      const knownWabaIds = ['2216370055815946', '493677260500824', '2058962911293336', '2076489033220259'];
      for (const wabaId of knownWabaIds) {
        try {
          const r3 = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${userToken}`
          );
          const d3 = await r3.json();
          if (d3.data && d3.data.length > 0) {
            results.push({ waba_id: wabaId, numbers: d3.data });
          }
        } catch (_) {}
      }
    }

    const allNumbers = results.flatMap(r =>
      r.numbers.map(n => ({ ...n, waba_id: r.waba_id }))
    );

    if (allNumbers.length === 0) {
      throw new Error('No se encontraron números de WhatsApp en tu cuenta de Meta.');
    }

    // If exactly 1 number found, auto-save
    if (allNumbers.length === 1) {
      const num = allNumbers[0];
      await upsertIntegration(company_id, userToken, num.id, num.waba_id, num.display_phone_number);
      return new Response(JSON.stringify({
        success: true, auto_saved: true,
        phone_number: num.display_phone_number,
        phone_number_id: num.id,
        waba_id: num.waba_id,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
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
