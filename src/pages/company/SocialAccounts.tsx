import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Trash2, Star, Loader2, CheckCircle, RefreshCw, Globe } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { socialPublishService, type SocialAccount } from '../../services/social/socialPublishService';

const META_APP_ID = '1187621119804509';
const SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'read_insights',
  'business_management',
].join(',');

function initiateMetaOAuth(redirectUri: string, companyId: string) {
  const state = encodeURIComponent(companyId);
  const url = [
    `https://www.facebook.com/v22.0/dialog/oauth`,
    `?client_id=${META_APP_ID}`,
    `&redirect_uri=${encodeURIComponent(redirectUri)}`,
    `&scope=${encodeURIComponent(SCOPES)}`,
    `&response_type=code`,
    `&state=${state}`,
  ].join('');
  window.location.href = url;
}

const PLATFORM_META: Record<string, { emoji: string; color: string; label: string }> = {
  facebook:  { emoji: '👥', color: '#1877F2', label: 'Facebook'  },
  instagram: { emoji: '📷', color: '#E1306C', label: 'Instagram' },
  tiktok:    { emoji: '🎵', color: '#010101', label: 'TikTok'    },
  youtube:   { emoji: '▶️', color: '#FF0000', label: 'YouTube'   },
};

function groupByPlatform(accounts: SocialAccount[]): Record<string, SocialAccount[]> {
  return accounts.reduce((acc, a) => {
    if (!acc[a.platform]) acc[a.platform] = [];
    acc[a.platform].push(a);
    return acc;
  }, {} as Record<string, SocialAccount[]>);
}

export default function SocialAccounts() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  useEffect(() => { load(); }, [profile?.company_id]);

  async function load() {
    setLoading(true);
    try { setAccounts(await socialPublishService.getAccounts()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSetDefault(account: SocialAccount) {
    setSettingDefault(account.id);
    try {
      // Clear existing default for this platform
      const same = accounts.filter(a => a.platform === account.platform && a.is_default && a.id !== account.id);
      for (const a of same) {
        await socialPublishService.saveAccount({ ...a, is_default: false });
      }
      await socialPublishService.saveAccount({ ...account, is_default: true });
      toast.success(`${account.account_name} ahora es la cuenta por defecto`);
      load();
    } catch { toast.error('Error al actualizar'); }
    finally { setSettingDefault(null); }
  }

  async function handleDisconnect(account: SocialAccount) {
    if (!confirm(`¿Desconectar "${account.account_name}" de ${account.platform}?`)) return;
    try {
      await socialPublishService.disconnectAccount(account.id);
      toast.success('Cuenta desconectada');
      load();
    } catch { toast.error('Error al desconectar'); }
  }

  const grouped = groupByPlatform(accounts);
  const redirectUri = `${window.location.origin}/integrations/meta/callback`;
  const metaConnected = (grouped.facebook?.length || 0) + (grouped.instagram?.length || 0) > 0;

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: '#f8fafc', padding: '28px 24px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button onClick={() => navigate('/marketing/social')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer' }}>
            <ArrowLeft size={18} color="#64748b" />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>SOCIAL MEDIA HUB</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>Cuentas Conectadas</h1>
          </div>
          <button onClick={load} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer' }}>
            <RefreshCw size={16} color="#64748b" />
          </button>
        </div>

        {/* Meta Connect Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1877F2 0%, #0d5abf 100%)',
          borderRadius: 20, padding: '24px 28px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 20,
          boxShadow: '0 8px 32px rgba(24,119,242,0.3)',
        }}>
          <div style={{ fontSize: 48 }}>👥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Meta Business Suite</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              Conecta una vez → importa automáticamente TODAS tus páginas de Facebook e Instagram Business
            </div>
            {metaConnected && (
              <div style={{ fontSize: 12, color: '#bbdefb', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={13} /> {(grouped.facebook?.length || 0)} páginas Facebook · {(grouped.instagram?.length || 0)} cuenta(s) Instagram conectadas
              </div>
            )}
          </div>
          <button
            onClick={() => initiateMetaOAuth(redirectUri, profile?.company_id || '')}
            style={{
              background: '#fff', color: '#1877F2', border: 'none',
              borderRadius: 12, padding: '12px 20px', fontSize: 13,
              fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {metaConnected ? '↺ Reconectar' : '+ Conectar con Facebook'}
          </button>
        </div>

        {/* Connected Accounts by Platform */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Loader2 size={28} color="#D4AF37" className="animate-spin" /></div>
        ) : (
          <>
            {['facebook', 'instagram'].map(platform => {
              const meta = PLATFORM_META[platform];
              const list = grouped[platform] || [];
              return (
                <div key={platform} style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', marginBottom: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{meta.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{list.length > 0 ? `${list.length} cuenta(s) conectada(s)` : 'Sin cuentas conectadas'}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: list.length > 0 ? '#f0fdf4' : '#fefce8', color: list.length > 0 ? '#16a34a' : '#ca8a04', border: `1px solid ${list.length > 0 ? '#bbf7d0' : '#fde68a'}` }}>
                      {list.length > 0 ? '✓ Activo' : '⚠ Sin cuenta'}
                    </div>
                  </div>

                  {list.length === 0 ? (
                    <div style={{ padding: '20px 24px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                      Conecta con Facebook arriba para importar tus cuentas de {meta.label} automáticamente
                    </div>
                  ) : (
                    list.map(account => (
                      <div key={account.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Avatar */}
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {account.avatar_url
                            ? <img src={account.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover' }} />
                            : meta.emoji
                          }
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{account.account_name}</span>
                            {account.is_default && (
                              <span style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Star size={9} fill="#D4AF37" color="#D4AF37" /> DEFAULT
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            ID: {account.account_id}
                            {account.follower_count > 0 && ` · ${account.follower_count.toLocaleString()} seguidores`}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!account.is_default && (
                            <button
                              onClick={() => handleSetDefault(account)}
                              disabled={settingDefault === account.id}
                              title="Establecer como predeterminada"
                              style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                              {settingDefault === account.id ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
                              Default
                            </button>
                          )}
                          <button
                            onClick={() => handleDisconnect(account)}
                            title="Desconectar"
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '6px 10px', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}

            {/* Coming Soon */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px dashed #e2e8f0', padding: '18px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>🔜 Próximamente</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {['tiktok', 'youtube'].map(p => {
                  const m = PLATFORM_META[p];
                  return (
                    <div key={p} style={{ flex: 1, background: '#f8fafc', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #f1f5f9', opacity: 0.6 }}>
                      <span style={{ fontSize: 22 }}>{m.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: '#cbd5e1' }}>OAuth pendiente de aprobación</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* How it works */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', marginBottom: 8 }}>ℹ️ Arquitectura SaaS Multi-Tenant</div>
          <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.7 }}>
            Cada empresa conecta sus propias cuentas con 1 click. Los tokens se almacenan de forma aislada por empresa (RLS). Las páginas de Facebook e Instagram se importan automáticamente sin configuración manual. Solo la empresa propietaria puede ver y usar sus cuentas.
          </div>
        </div>
      </div>
    </div>
  );
}
