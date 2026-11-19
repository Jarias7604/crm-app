import { STAFF_GROUP_MIN, STAFF_GROUP_SHARE } from './types.ts';

// ─── Staff Group Threshold + Bridge Key-Value State + Evolution Outbox ───────

export async function staffGroupThreshold(supabase: any, companyId: string): Promise<number> {
  const { count } = await supabase
    .from('whatsapp_groups')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  return Math.max(STAFF_GROUP_MIN, Math.ceil((count || 0) * STAFF_GROUP_SHARE));
}

export async function getBridgeState(supabase: any, key: string): Promise<Record<string, any>> {
  const { data } = await supabase.from('whatsapp_bridge_state').select('value').eq('key', key).maybeSingle();
  return (data?.value || {}) as Record<string, any>;
}

export async function setBridgeState(supabase: any, key: string, value: Record<string, any>) {
  await supabase
    .from('whatsapp_bridge_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export async function evolutionCredentials(supabase: any): Promise<{ key: string; instance: string }> {
  const envKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  const envInstance = Deno.env.get('EVOLUTION_INSTANCE') || '';
  if (envKey) return { key: envKey, instance: envInstance || 'soporte' };
  const st = await getBridgeState(supabase, 'evolution');
  return { key: String(st.apikey || ''), instance: envInstance || String(st.instance || 'soporte') };
}

export function normalizeInstance(name: unknown): string {
  const n = String(name || '').trim();
  return !n || n === 'arias' ? 'soporte' : n;
}

// ─── Outbox (CRM -> WhatsApp through the bridge) ─────────────────────────────
// One row per outgoing message in whatsapp_outbox (atomic, no lost updates).

export async function enqueueOutbox(
  supabase: any,
  item: {
    companyId: string;
    ticketId: string;
    commentId: string | null;
    instance: string;
    number: string;
    kind: 'text' | 'media';
    payload: Record<string, any>;
    createdBy?: string | null;
  }
) {
  if (!item.number) return null;
  const { data, error } = await supabase
    .from('whatsapp_outbox')
    .insert({
      company_id: item.companyId,
      ticket_id: item.ticketId,
      comment_id: item.commentId,
      instance: normalizeInstance(item.instance),
      number: item.number,
      kind: item.kind,
      payload: item.payload,
      created_by: item.createdBy || null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[wa] outbox insert error', error);
    return null;
  }
  return data?.id || null;
}
