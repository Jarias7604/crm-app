import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../auth/AuthProvider';

export interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'refunded' | 'void';
  planName: string | null;
  planSlug: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  issuedAt: string;
  paidAt: string | null;
  dueAt: string | null;
  stripeHostedUrl: string | null;
  pdfUrl: string | null;
}

export interface UsageMetrics {
  users: number;
  leads: number;
  aiTokens: number;
  smsSent: number;
  emailsSent: number;
}

const defaultMetrics: UsageMetrics = { users: 0, leads: 0, aiTokens: 0, smsSent: 0, emailsSent: 0 };

/**
 * useBillingData — Single hook for all billing page data.
 * Fetches invoices from saas_invoices table and usage from usage_events.
 * Falls back to counting actual leads/profiles if no usage_events exist.
 */
export function useBillingData() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [usage, setUsage] = useState<UsageMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch invoices — try RPC first, fallback to direct table query
        let invoiceData: InvoiceRecord[] = [];
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('get_company_invoices', {
            p_limit: 20,
            p_offset: 0,
          });

          if (rpcErr) throw rpcErr;

          invoiceData = (rpcData || []).map((row: any) => ({
            invoiceId: row.invoice_id,
            invoiceNumber: row.invoice_number,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            planName: row.plan_name,
            planSlug: row.plan_slug,
            billingPeriodStart: row.billing_period_start,
            billingPeriodEnd: row.billing_period_end,
            issuedAt: row.issued_at,
            paidAt: row.paid_at,
            dueAt: row.due_at,
            stripeHostedUrl: row.stripe_hosted_url,
            pdfUrl: row.pdf_url,
          }));
        } catch (invoiceErr) {
          // RPC may not be deployed yet — fallback to direct query
          console.warn('[useBillingData] RPC fallback for invoices:', invoiceErr);
          const { data: directData } = await supabase
            .from('saas_invoices')
            .select('*')
            .eq('company_id', profile.company_id)
            .order('issued_at', { ascending: false })
            .limit(20);

          if (directData) {
            invoiceData = directData.map((row: any) => ({
              invoiceId: row.id,
              invoiceNumber: row.invoice_number,
              amount: row.amount,
              currency: row.currency,
              status: row.status,
              planName: row.plan_name,
              planSlug: row.plan_slug,
              billingPeriodStart: row.billing_period_start,
              billingPeriodEnd: row.billing_period_end,
              issuedAt: row.issued_at,
              paidAt: row.paid_at,
              dueAt: row.due_at,
              stripeHostedUrl: row.stripe_hosted_url,
              pdfUrl: row.pdf_url,
            }));
          }
        }
        setInvoices(invoiceData);

        // 2. Fetch usage metrics — try RPC, fallback to counting real tables
        let metrics = { ...defaultMetrics };
        try {
          const { data: usageData, error: usageErr } = await supabase.rpc('get_usage_summary');
          if (usageErr) throw usageErr;

          if (usageData && usageData.length > 0) {
            for (const row of usageData) {
              switch (row.event_type) {
                case 'ai_token': metrics.aiTokens = Number(row.total); break;
                case 'sms_sent': metrics.smsSent = Number(row.total); break;
                case 'email_sent': metrics.emailsSent = Number(row.total); break;
                case 'lead_created': metrics.leads = Number(row.total); break;
              }
            }
          }
        } catch {
          // Fallback: count actual records from real tables
          console.warn('[useBillingData] Usage RPC not available, counting real tables');
        }

        // Always count real users and leads for accuracy
        const [usersRes, leadsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', profile.company_id)
            .eq('status', 'active'),
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', profile.company_id),
        ]);

        metrics.users = usersRes.count ?? metrics.users;
        metrics.leads = Math.max(leadsRes.count ?? 0, metrics.leads);

        setUsage(metrics);
      } catch (err: any) {
        console.error('[useBillingData] Error:', err);
        setError(err.message ?? 'Error loading billing data');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [profile?.company_id]);

  return { invoices, usage, loading, error };
}
