// @ts-nocheck
/**
 * WHATSAPP EMBEDDED SIGNUP — Edge Function
 * Exchanges the code from Meta's Embedded Signup popup for an access token,
 * then returns the WABA phone numbers for the user to confirm/pick.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_VERSION = "v21.0";
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { code, company_id } = await req.json();
    if (!code) throw new Error('Missing code from Meta Embedded Signup');
    if (!company_id) throw new Error('Missing company_id');

    const APP_ID = Deno.env.get('META_APP_ID') || '1187621119804509';
    const APP_SECRET = Deno.env.get('META_APP_SECRET');
    if (!APP_SECRET) throw new Error('META_APP_SECRET not configured in Supabase secrets');

    // STEP 1: Exchange code → user access token
    const tokenRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, code }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(`Token exchange: ${tokenData.error.message}`);
    const userToken = tokenData.access_token;

    // STEP 2: Fetch WABAs + phone numbers (try via businesses first, then direct)
    const results: { waba_id: string; numbers: any[] }[] = [];

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

    if (results.length === 0) {
      const r2 = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/me?fields=whatsapp_business_accounts{id,phone_numbers{id,display_phone_number,verified_name,status}}&access_token=${userToken}`
      );
      const d2 = await r2.json();
      for (const waba of d2.whatsapp_business_accounts?.data || []) {
        const nums = waba.phone_numbers?.data || [];
        if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
      }
    }

    const allNumbers = results.flatMap(r =>
      r.numbers.map(n => ({ ...n, waba_id: r.waba_id }))
    );

    if (allNumbers.length === 0) {
      throw new Error('No se encontraron números de WhatsApp en tu cuenta de Meta.');
    }

    // STEP 3: If exactly 1 number, auto-save to marketing_integrations
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

    // STEP 4: Multiple numbers — return list + token for frontend to pick
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
