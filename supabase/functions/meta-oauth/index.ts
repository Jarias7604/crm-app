// @ts-nocheck
/**
 * META-OAUTH Edge Function
 * SaaS-ready OAuth token exchange for Meta (Facebook + Instagram)
 * 
 * Flow:
 * 1. Frontend sends { code, redirect_uri, company_id }
 * 2. We exchange code → short-lived user token
 * 3. Exchange short-lived → long-lived user token (60 days)
 * 4. Query /me/accounts to get ALL pages + their long-lived page tokens
 * 5. For each page, check for linked Instagram Business Account
 * 6. Save all to social_accounts table under company_id
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_VERSION = "v22.0";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { code, redirect_uri, company_id } = await req.json();

    const APP_ID = Deno.env.get('META_APP_ID') || '1187621119804509';
    const APP_SECRET = Deno.env.get('META_APP_SECRET');
    if (!APP_SECRET) throw new Error('META_APP_SECRET not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // STEP 1: Exchange code → short-lived user token
    const tokenRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(`Token exchange failed: ${tokenData.error.message}`);
    const shortToken = tokenData.access_token;

    // STEP 2: Exchange short-lived → long-lived user token (60 days)
    const llRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`
    );
    const llData = await llRes.json();
    const longToken = llData.access_token || shortToken;
    const expiresIn = llData.expires_in || 5183944; // ~60 days default
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // STEP 3: Get ALL pages with their long-lived page tokens
    const pagesRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token,fan_count,instagram_business_account{id,username,followers_count,profile_picture_url}&limit=50&access_token=${longToken}`
    );
    const pagesData = await pagesRes.json();
    if (pagesData.error) throw new Error(`Pages fetch failed: ${pagesData.error.message}`);

    const pages = pagesData.data || [];
    const savedAccounts: any[] = [];

    for (const page of pages) {
      // Save Facebook Page
      const { data: fbAcc } = await supabase.from('social_accounts').upsert({
        company_id,
        platform: 'facebook',
        account_name: page.name,
        display_name: page.name,
        account_id: page.id,
        access_token: page.access_token, // Page access tokens never expire
        token_expires_at: null,          // Page tokens don't expire
        is_active: true,
        follower_count: page.fan_count || 0,
        metadata: { page_id: page.id },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,platform,account_id' }).select().single();

      if (fbAcc) savedAccounts.push(fbAcc);

      // Save Instagram Business Account (if linked)
      const igAccount = page.instagram_business_account;
      if (igAccount?.id) {
        const { data: igAcc } = await supabase.from('social_accounts').upsert({
          company_id,
          platform: 'instagram',
          account_name: igAccount.username || page.name,
          display_name: igAccount.username || page.name,
          account_id: igAccount.id,
          access_token: page.access_token, // Use page token for IG API too
          token_expires_at: null,
          is_active: true,
          follower_count: igAccount.followers_count || 0,
          avatar_url: igAccount.profile_picture_url || null,
          metadata: {
            instagram_business_id: igAccount.id,
            linked_page_id: page.id,
            username: igAccount.username,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,platform,account_id' }).select().single();

        if (igAcc) savedAccounts.push(igAcc);
      }
    }

    // STEP 4: Auto-set first of each platform as default if none exists
    for (const platform of ['facebook', 'instagram']) {
      const { data: existing } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('company_id', company_id)
        .eq('platform', platform)
        .eq('is_default', true)
        .maybeSingle();

      if (!existing) {
        const { data: first } = await supabase
          .from('social_accounts')
          .select('id')
          .eq('company_id', company_id)
          .eq('platform', platform)
          .eq('is_active', true)
          .order('created_at')
          .limit(1)
          .maybeSingle();

        if (first) {
          await supabase.from('social_accounts').update({ is_default: true }).eq('id', first.id);
        }
      }
    }

    console.log(`[meta-oauth] ✅ Connected ${savedAccounts.length} accounts for company ${company_id}`);

    return new Response(JSON.stringify({
      success: true,
      accounts_connected: savedAccounts.length,
      pages_found: pages.length,
      accounts: savedAccounts.map(a => ({ id: a.id, platform: a.platform, account_name: a.account_name })),
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[meta-oauth] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
});
