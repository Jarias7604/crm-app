import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { socialPublishService, type SocialAccount } from '../../services/social/socialPublishService';

const PLATFORM_INFO = {
  facebook: {
    label: 'Facebook', emoji: '👥', color: '#1877F2',
    description: 'Publica en tu Facebook Page',
    helpUrl: 'https://developers.facebook.com/docs/pages/access-tokens',
    fields: ['access_token', 'account_id'],
    fieldLabels: { access_token: 'Page Access Token', account_id: 'Page ID' },
    instructions: 'Ve a Meta Business Suite → Configuración → Avanzado → Tokens de acceso de página',
  },
  instagram: {
    label: 'Instagram', emoji: '📷', color: '#E1306C',
    description: 'Publica en tu cuenta Instagram Business',
    helpUrl: 'https://developers.facebook.com/docs/instagram-api',
    fields: ['access_token', 'account_id'],
    fieldLabels: { access_token: 'Page Access Token (misma que Facebook)', account_id: 'Instagram Business Account ID' },
    instructions: 'El token es el mismo que Facebook. El Instagram Business ID lo encuentras en Meta Business Suite → Configuración de Instagram',
  },
};

type PlatformKey = keyof typeof PLATFORM_INFO;

export default function SocialAccounts() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformKey | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAccounts(); }, [profile?.company_id]);

  async function loadAccounts() {
    setLoading(true);
    try {
      const data = await socialPublishService.getAccounts();
      setAccounts(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSave(platform: PlatformKey) {
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const info = PLATFORM_INFO[platform];
      const token = formData.access_token;
      const accountId = formData.account_id;
      const accountName = formData.account_name || platform;

      if (!token || !accountId) {
        toast.error('Completa todos los campos requeridos');
        return;
      }

      const accountPayload: any = {
        company_id: profile.company_id,
        platform,
        account_name: accountName,
        account_id: accountId,
        access_token: token,
        is_active: true,
        metadata: platform === 'instagram' ? { instagram_business_id: accountId } : {},
      };

      await socialPublishService.saveAccount(accountPayload);
      toast.success(`${info.label} conectado correctamente`);
      setConnectingPlatform(null);
      setFormData({});
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar cuenta');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect(account: SocialAccount) {
    if (!confirm(`¿Desconectar ${account.platform}?`)) return;
    try {
      await socialPublishService.disconnectAccount(account.id);
      toast.success('Cuenta desconectada');
      loadAccounts();
    } catch {
      toast.error('Error al desconectar');
    }
  }

  const getAccount = (platform: string) => accounts.find(a => a.platform === platform && a.is_active);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: 13, color: '#0f172a',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: '#f8fafc', padding: 32 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
          <button onClick={() => navigate('/marketing/social')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer' }}>
            <ArrowLeft size={18} color="#64748b" />
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>SOCIAL MEDIA HUB</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>Cuentas Sociales</h1>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Loader2 size={32} color="#D4AF37" className="animate-spin" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(Object.keys(PLATFORM_INFO) as PlatformKey[]).map(platform => {
              const info = PLATFORM_INFO[platform];
              const connected = getAccount(platform);
              const isExpanded = connectingPlatform === platform;

              return (
                <div key={platform} style={{ background: '#fff', borderRadius: 20, border: `1px solid ${connected ? '#bbf7d0' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  {/* Platform row */}
                  <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: info.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {info.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{info.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{info.description}</div>
                      {connected && (
                        <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckCircle size={13} /> Conectado: {connected.account_name || connected.account_id}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {connected ? (
                        <button onClick={() => handleDisconnect(connected)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Trash2 size={13} /> Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={() => { setConnectingPlatform(isExpanded ? null : platform); setFormData({}); }}
                          style={{ background: info.color, border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                        >
                          {isExpanded ? 'Cancelar' : '+ Conectar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connect form */}
                  {isExpanded && !connected && (
                    <div style={{ padding: '0 24px 24px', borderTop: '1px solid #f1f5f9' }}>
                      {/* Instructions */}
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', margin: '16px 0', display: 'flex', gap: 10 }}>
                        <AlertCircle size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>Cómo obtener las credenciales</div>
                          <div style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.5 }}>{info.instructions}</div>
                          <a href={info.helpUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, textDecoration: 'none' }}>
                            Ver documentación <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                            NOMBRE DE CUENTA (Referencia)
                          </label>
                          <input
                            value={formData.account_name || ''}
                            onChange={e => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                            placeholder={`Mi ${info.label} Page`}
                            style={inputStyle}
                          />
                        </div>

                        {info.fields.map(field => (
                          <div key={field}>
                            <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                              {(info.fieldLabels as any)[field]?.toUpperCase()}
                            </label>
                            <input
                              type={field === 'access_token' ? 'password' : 'text'}
                              value={formData[field] || ''}
                              onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                              placeholder={field === 'access_token' ? 'EAAxxxxxx...' : '1234567890'}
                              style={inputStyle}
                            />
                          </div>
                        ))}

                        <button
                          onClick={() => handleSave(platform)}
                          disabled={saving}
                          style={{ background: info.color, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 800, color: '#fff', cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : `Conectar ${info.label}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Phase 2 platforms */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: '20px 24px', opacity: 0.5 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>🔜 Próximamente — Fase 2</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[{ emoji: '🎵', label: 'TikTok' }, { emoji: '▶️', label: 'YouTube' }].map(p => (
                  <div key={p.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 20 }}>{p.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
