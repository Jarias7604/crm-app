// @ts-nocheck
/**
 * WHATSAPP EMBEDDED SIGNUP — Edge Function
 * Real SaaS WhatsApp OAuth Code Exchange & Number Selection Engine
 * 
 * Flow:
 * 1. Frontend sends { code, redirect_uri, company_id }
 * 2. If code is provided (from Meta Embedded Signup popup), exchange code for user access token:
 *    POST https://graph.facebook.com/v21.0/oauth/access_token
 * 3. Fetch all WABAs and phone numbers for this user from Meta Graph API using user token
 * 4. Also fetch from known/system WABAs as secondary fallback if needed
 * 5. Deduplicate and return all available numbers for user selection
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_VERSION = "v21.0";
const SYSTEM_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || "EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD";

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

    // Canonicalize redirect_uri — strip www. if present so it matches the dialog request 100%
    const cleanRedirectUri = redirect_uri
      ? redirect_uri.replace('://www.', '://')
      : 'https://ariascrm.com/integrations/wa/callback';

    let userToken = SYSTEM_TOKEN;
    let isUserSession = false;

    // STEP 1: Exchange code for user access token if code is provided
    if (code && code !== 'direct_fetch') {
      if (!APP_SECRET) {
        console.warn('META_APP_SECRET missing in environment. Using fallback token.');
      } else {
        console.log(`[whatsapp-embedded-signup] Exchanging OAuth code for company ${company_id}...`);
        
        const tokenParams = new URLSearchParams({
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: cleanRedirectUri,
          code: code,
        });

        const tokenRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams.toString(),
        });

        const tokenData = await tokenRes.json();
        
        if (tokenData.error) {
          console.error('[whatsapp-embedded-signup] Token exchange error:', tokenData.error);
          throw new Error(`Token exchange failed: ${tokenData.error.message}`);
        }

        if (tokenData.access_token) {
          userToken = tokenData.access_token;
          isUserSession = true;
          console.log('[whatsapp-embedded-signup] Token exchange successful!');
        }
      }
    }

    // STEP 2: Fetch WABAs and Phone Numbers
    const results: { waba_id: string; numbers: any[] }[] = [];

    // Query 1: me/granter_v2 (Meta Tech Provider Embedded Signup shared WABAs)
    if (isUserSession) {
      try {
        const gRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/me/granter_v2?fields=target&access_token=${userToken}`
        );
        const gData = await gRes.json();
        const grantedWabas = gData.data || [];
        for (const item of grantedWabas) {
          const wabaId = item.target?.id;
          if (wabaId) {
            const numRes = await fetch(
              `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status,quality_rating&access_token=${userToken}`
            );
            const numData = await numRes.json();
            if (numData.data && numData.data.length > 0) {
              results.push({ waba_id: wabaId, numbers: numData.data });
            }
          }
        }
      } catch (e: any) {
        console.warn('Granter WABA fetch failed:', e.message);
      }
    }

    // Query 2: me/whatsapp_business_accounts
    if (isUserSession) {
      try {
        const r1 = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}&access_token=${userToken}`
        );
        const d1 = await r1.json();
        for (const waba of d1.data || []) {
          const nums = waba.phone_numbers?.data || [];
          if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
        }
      } catch (e: any) {
        console.warn('Direct WABA fetch failed:', e.message);
      }
    }

    // Query 3: me/businesses
    if (isUserSession) {
      try {
        const r2 = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}},client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}}&access_token=${userToken}`
        );
        const d2 = await r2.json();
        for (const biz of d2.data || []) {
          for (const waba of biz.owned_whatsapp_business_accounts?.data || []) {
            const nums = waba.phone_numbers?.data || [];
            if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
          }
          for (const waba of biz.client_whatsapp_business_accounts?.data || []) {
            const nums = waba.phone_numbers?.data || [];
            if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
          }
        }
      } catch (e: any) {
        console.warn('Business WABA fetch failed:', e.message);
      }
    }

    // Query 4: System WABAs fallback
    const knownWabaIds = ['2058962911293336', '2216370055815946', '493677260500824', '2076489033220259'];
    for (const wabaId of knownWabaIds) {
      try {
        const r3 = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status,quality_rating&access_token=${SYSTEM_TOKEN}`
        );
        const d3 = await r3.json();
        if (d3.data && d3.data.length > 0) {
          results.push({ waba_id: wabaId, numbers: d3.data });
        }
      } catch (_) {}
    }

    let allNumbers = results.flatMap(r =>
      r.numbers.map(n => ({
        id: n.id,
        display_phone_number: n.display_phone_number,
        verified_name: n.verified_name || 'WhatsApp Business',
        status: n.status || 'CONNECTED',
        waba_id: r.waba_id,
      }))
    );

    // Deduplicate by id
    const seen = new Set();
    allNumbers = allNumbers.filter(n => {
      if (!n.id || seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    if (allNumbers.length === 0) {
      throw new Error('No se encontraron números de WhatsApp activos en tu cuenta de Meta.');
    }

    return new Response(JSON.stringify({
      success: true,
      auto_saved: false,
      token: userToken,
      numbers: allNumbers,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[whatsapp-embedded-signup] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
