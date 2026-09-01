// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Returns the APPROVED WhatsApp message templates for a company, parsed for the
 * chat UI (body text, variable count, quick-reply buttons). Reads the token +
 * wabaId from that company's marketing_integrations row (walking up to the
 * parent workspace if needed).
 *
 * POST { company_id }
 */

const SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getIntegration(companyId: string) {
  let { data } = await supabase
    .from('marketing_integrations')
    .select('company_id, settings')
    .eq('company_id', companyId)
    .eq('provider', 'whatsapp')
    .eq('is_active', true)
    .maybeSingle();
  if (data?.settings?.token && data?.settings?.wabaId) return data;

  // Walk up to parent workspace
  const { data: comp } = await supabase
    .from('companies').select('parent_company_id').eq('id', companyId).maybeSingle();
  if (comp?.parent_company_id) {
    const { data: parent } = await supabase
      .from('marketing_integrations')
      .select('company_id, settings')
      .eq('company_id', comp.parent_company_id)
      .eq('provider', 'whatsapp')
      .eq('is_active', true)
      .maybeSingle();
    if (parent?.settings?.token && parent?.settings?.wabaId) return parent;
  }
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400, headers: corsHeaders });
    }

    const integ = await getIntegration(company_id);
    if (!integ?.settings?.token || !integ?.settings?.wabaId) {
      return new Response(JSON.stringify({ templates: [], error: 'WhatsApp no configurado para esta empresa' }), { headers: corsHeaders });
    }

    const { token, wabaId } = integ.settings;
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,category,language,components&limit=100&access_token=${token}`
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ templates: [], error: data?.error?.message || 'Meta API error' }), { headers: corsHeaders });
    }

    const templates = (data.data || [])
      .filter((t: any) => t.status === 'APPROVED')
      .map((t: any) => {
        const body    = (t.components || []).find((c: any) => c.type === 'BODY');
        const header  = (t.components || []).find((c: any) => c.type === 'HEADER');
        const footer  = (t.components || []).find((c: any) => c.type === 'FOOTER');
        const buttons = (t.components || []).find((c: any) => c.type === 'BUTTONS');
        const bodyText = body?.text || '';
        const varCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
        const footerText = footer?.text || '';
        // "Manual safe": can a human reasonably fill this from the chat?
        // Exclude system/auto templates (footer says "no responder"/"automático"),
        // header attachments, hello_world, and anything with 3+ variables (those
        // are data-driven: DTE codes, quote numbers, links).
        const manual_safe =
          !/no responder|autom[aá]tic/i.test(footerText) &&
          !['DOCUMENT', 'IMAGE', 'VIDEO'].includes(header?.format) &&
          t.name !== 'hello_world' &&
          varCount <= 2;
        return {
          name: t.name,
          language: t.language || 'es',
          category: t.category,
          body_text: bodyText,
          header_text: header?.format === 'TEXT' ? (header.text || '') : '',
          header_format: header?.format || null,
          footer_text: footerText,
          var_count: varCount,
          buttons: (buttons?.buttons || []).map((b: any) => b.text).filter(Boolean),
          manual_safe,
        };
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ templates }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ templates: [], error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
