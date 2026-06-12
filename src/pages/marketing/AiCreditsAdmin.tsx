import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import {
  ArrowLeft, Zap, Image, TrendingUp, AlertTriangle,
  CheckCircle2, BarChart3, Building, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CompanyCredit {
  company_id: string;
  company_name: string;
  credits_used: number;
  credits_limit: number;
  reset_at: string;
  flyers_count: number;
}

interface RecentFlyer {
  id: string;
  company_id: string;
  company_name?: string;
  prompt_used: string;
  format: string;
  tone: string;
  image_urls: string[];
  credits_spent: number;
  created_at: string;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AiCreditsAdmin() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [credits, setCredits] = useState<CompanyCredit[]>([]);
  const [recentFlyers, setRecentFlyers] = useState<RecentFlyer[]>([]);
  const [loading, setLoading] = useState(true);

  // My company credits (for non-super-admins)
  const [myCredits, setMyCredits] = useState<{ used: number; limit: number; reset_at: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        // Load all companies' credit usage
        const { data: creditRows } = await supabase
          .from('ai_generation_credits')
          .select('company_id, credits_used, credits_limit, reset_at')
          .order('credits_used', { ascending: false });

        if (creditRows && creditRows.length > 0) {
          const companyIds = creditRows.map(r => r.company_id);
          const { data: companies } = await supabase
            .from('companies')
            .select('id, name')
            .in('id', companyIds);

          const { data: flyerCounts } = await supabase
            .from('ai_generated_flyers')
            .select('company_id')
            .in('company_id', companyIds);

          const companyMap: Record<string, string> = {};
          companies?.forEach(c => { companyMap[c.id] = c.name; });

          const countMap: Record<string, number> = {};
          flyerCounts?.forEach(f => { countMap[f.company_id] = (countMap[f.company_id] || 0) + 1; });

          setCredits(creditRows.map(r => ({
            ...r,
            company_name: companyMap[r.company_id] || r.company_id.slice(0, 8),
            flyers_count: countMap[r.company_id] || 0,
          })));
        }

        // Recent flyers across all companies
        const { data: flyers } = await supabase
          .from('ai_generated_flyers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (flyers) {
          const fCompanyIds = [...new Set(flyers.map(f => f.company_id))];
          const { data: fCompanies } = await supabase
            .from('companies').select('id, name').in('id', fCompanyIds);
          const fMap: Record<string, string> = {};
          fCompanies?.forEach(c => { fMap[c.id] = c.name; });
          setRecentFlyers(flyers.map(f => ({ ...f, company_name: fMap[f.company_id] })));
        }
      } else {
        // Company admin: only see own credits
        const { data: creditRow } = await supabase
          .from('ai_generation_credits')
          .select('credits_used, credits_limit, reset_at')
          .eq('company_id', profile?.company_id)
          .order('period_start', { ascending: false })
          .limit(1)
          .single();

        setMyCredits(creditRow
          ? { used: creditRow.credits_used, limit: creditRow.credits_limit, reset_at: creditRow.reset_at }
          : { used: 0, limit: 20, reset_at: new Date().toISOString() });

        const { data: flyers } = await supabase
          .from('ai_generated_flyers')
          .select('*')
          .eq('company_id', profile?.company_id)
          .order('created_at', { ascending: false })
          .limit(20);

        setRecentFlyers(flyers || []);
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const totalGenerated = isSuperAdmin
    ? credits.reduce((s, c) => s + c.flyers_count, 0)
    : recentFlyers.length;

  const totalCreditsUsed = isSuperAdmin
    ? credits.reduce((s, c) => s + c.credits_used, 0)
    : myCredits?.used || 0;

  const companiesAtRisk = credits.filter(c =>
    c.credits_limit > 0 && c.credits_used / c.credits_limit >= 0.8
  ).length;

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight: 'calc(100vh - 64px)', background: '#f4f6f9', fontFamily: 'system-ui, -apple-system, sans-serif' },
    header: {
      padding: '12px 24px', borderBottom: '1px solid #d8dde6', background: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
    },
    body: { padding: '32px 24px', maxWidth: 1200, margin: '0 auto' },
    card: {
      background: '#fff', borderRadius: 12, border: '1px solid #d8dde6',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    },
    kpiCard: (color: string) => ({
      background: '#fff', borderRadius: 12, border: `1px solid ${color}20`,
      padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }),
    label: { fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  };

  const creditPct = (used: number, limit: number) =>
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const creditColor = (pct: number) =>
    pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#10b981';

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Cargando datos de créditos...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(isSuperAdmin ? '/admin/companies' : '/marketing/flyers')}
            style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={15} color="#54698d" strokeWidth={2.5} />
          </button>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.12em' }}>
              {isSuperAdmin ? 'SUPER ADMIN · PLATAFORMA' : 'ARIAS CRM · MARKETING'}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#081c3b' }}>⚡ AI Credits Dashboard</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/marketing/flyers')}
          style={{ background: 'linear-gradient(135deg, #0070d2, #005fb2)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Image size={13} /> Ir al AI Flyer Studio
        </button>
      </header>

      <div style={S.body}>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isSuperAdmin ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>

          <div style={S.kpiCard('#0070d2')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="#0070d2" fill="#0070d2" />
              </div>
              <span style={S.label}>Créditos Usados</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#0070d2', lineHeight: 1 }}>{totalCreditsUsed}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>este mes</div>
          </div>

          <div style={S.kpiCard('#10b981')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image size={15} color="#10b981" />
              </div>
              <span style={S.label}>Flyers Generados</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{totalGenerated}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>total acumulado</div>
          </div>

          {isSuperAdmin ? (
            <>
              <div style={S.kpiCard('#7c3aed')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building size={15} color="#7c3aed" />
                  </div>
                  <span style={S.label}>Empresas Activas</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{credits.length}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>con créditos asignados</div>
              </div>

              <div style={S.kpiCard(companiesAtRisk > 0 ? '#ef4444' : '#10b981')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: companiesAtRisk > 0 ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {companiesAtRisk > 0
                      ? <AlertTriangle size={15} color="#ef4444" />
                      : <CheckCircle2 size={15} color="#10b981" />}
                  </div>
                  <span style={S.label}>En Alerta</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: companiesAtRisk > 0 ? '#ef4444' : '#10b981', lineHeight: 1 }}>{companiesAtRisk}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>&gt;80% de créditos usados</div>
              </div>
            </>
          ) : (
            <div style={S.kpiCard(myCredits ? creditColor(creditPct(myCredits.used, myCredits.limit)) : '#10b981')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={15} color="#0070d2" />
                </div>
                <span style={S.label}>Disponibles</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                {myCredits ? myCredits.limit - myCredits.used : 20}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                de {myCredits?.limit || 20} créditos este mes
              </div>
            </div>
          )}
        </div>

        {/* ── My Credits Bar (company admin view) ─────────────────────────── */}
        {!isSuperAdmin && myCredits && (
          <div style={{ ...S.card, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Tu uso mensual</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Reinicia el {format(new Date(myCredits.reset_at), "d 'de' MMMM", { locale: es })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: creditColor(creditPct(myCredits.used, myCredits.limit)) }}>
                  {myCredits.used} / {myCredits.limit}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>créditos usados</div>
              </div>
            </div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${creditPct(myCredits.used, myCredits.limit)}%`,
                background: `linear-gradient(90deg, ${creditColor(creditPct(myCredits.used, myCredits.limit))}, ${creditColor(creditPct(myCredits.used, myCredits.limit))}dd)`,
                borderRadius: 99, transition: 'width 0.6s ease',
              }} />
            </div>
            {creditPct(myCredits.used, myCredits.limit) >= 80 && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>
                  Estás usando más del 80% de tus créditos. Considera actualizar tu plan para continuar generando flyers.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Super Admin: Companies Credit Table ─────────────────────────── */}
        {isSuperAdmin && credits.length > 0 && (
          <div style={{ ...S.card, marginBottom: 28, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#0070d2" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Uso por Empresa</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Empresa', 'Créditos Usados', 'Límite', 'Uso %', 'Flyers Generados', 'Reinicio', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {credits.map((c, i) => {
                  const pct = creditPct(c.credits_used, c.credits_limit);
                  const color = creditColor(pct);
                  return (
                    <tr key={c.company_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building size={13} color="#0070d2" />
                          </div>
                          {c.company_name}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 800, color }}>{c.credits_used}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{c.credits_limit}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#0f172a', fontWeight: 700 }}>{c.flyers_count}</td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#64748b' }}>
                        {format(new Date(c.reset_at), "d MMM", { locale: es })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {pct >= 90 ? (
                          <span style={{ fontSize: 10, fontWeight: 800, background: '#fef2f2', color: '#991b1b', padding: '3px 8px', borderRadius: 20, border: '1px solid #fecaca' }}>⚠ CRÍTICO</span>
                        ) : pct >= 75 ? (
                          <span style={{ fontSize: 10, fontWeight: 800, background: '#fffbeb', color: '#92400e', padding: '3px 8px', borderRadius: 20, border: '1px solid #fde68a' }}>Alerta</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 800, background: '#f0fdf4', color: '#166534', padding: '3px 8px', borderRadius: 20, border: '1px solid #bbf7d0' }}>Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Recent Flyers ───────────────────────────────────────────────── */}
        {recentFlyers.length > 0 && (
          <div style={S.card}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Image size={16} color="#0070d2" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  {isSuperAdmin ? 'Flyers Recientes (Plataforma)' : 'Mis Flyers Generados'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Últimos {recentFlyers.length}</span>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {recentFlyers.map(flyer => (
                <div key={flyer.id} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {flyer.image_urls?.[0] && (
                    <div style={{ position: 'relative', paddingTop: '100%', background: '#f1f5f9' }}>
                      <img
                        src={flyer.image_urls[0]}
                        alt="Flyer"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {flyer.prompt_used}
                    </div>
                    {isSuperAdmin && flyer.company_name && (
                      <div style={{ fontSize: 10, color: '#0070d2', fontWeight: 700, marginBottom: 4 }}>{flyer.company_name}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        {format(new Date(flyer.created_at), "d MMM, HH:mm", { locale: es })}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 10 }}>
                        {flyer.credits_spent} crédito{flyer.credits_spent > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentFlyers.length === 0 && (
          <div style={{ ...S.card, padding: '48px 32px', textAlign: 'center' }}>
            <Image size={36} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Aún no hay flyers generados</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
              Ve al AI Flyer Studio y genera tu primer flyer profesional con IA.
            </div>
            <button
              onClick={() => navigate('/marketing/flyers')}
              style={{ background: 'linear-gradient(135deg, #0070d2, #005fb2)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
            >
              Ir al Flyer Studio
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
