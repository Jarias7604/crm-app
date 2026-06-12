import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, Send, Loader2, Image, Video, Sparkles, Clock, Star, ChevronDown, Check, Globe } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { socialPublishService, type SocialAccount, type SocialPost } from '../../services/social/socialPublishService';

const PLATFORM_META: Record<string, { emoji: string; color: string; label: string }> = {
  facebook:  { emoji: '👥', color: '#1877F2', label: 'Facebook'  },
  instagram: { emoji: '📷', color: '#E1306C', label: 'Instagram' },
  tiktok:    { emoji: '🎵', color: '#010101', label: 'TikTok'    },
  youtube:   { emoji: '▶️', color: '#FF0000', label: 'YouTube'   },
};

const TONES = ['Profesional', 'Urgente', 'Premium', 'Amigable', 'Informal'];

// Groups accounts by platform
function groupByPlatform(accounts: SocialAccount[]) {
  const map: Record<string, SocialAccount[]> = {};
  for (const a of accounts) {
    if (!map[a.platform]) map[a.platform] = [];
    map[a.platform].push(a);
  }
  return map;
}

// Per-platform account picker
function AccountPicker({ platform, accounts, selected, onChange }: {
  platform: string; accounts: SocialAccount[];
  selected: SocialAccount | null; onChange: (a: SocialAccount | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = PLATFORM_META[platform] || { emoji: '🌐', color: '#888', label: platform };
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        background: selected ? `${meta.color}12` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? meta.color + '40' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s',
      }}>
        <span style={{ fontSize: 18 }}>{meta.emoji}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: selected ? '#10b981' : '#f59e0b' }}>
            {selected ? `✓ ${selected.account_name}` : 'Seleccionar cuenta...'}
          </div>
        </div>
        {selected?.is_default && <Star size={11} color="#D4AF37" fill="#D4AF37" />}
        <ChevronDown size={14} color="#64748b" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}>
          {/* None option */}
          <button onClick={() => { onChange(null); setOpen(false); }} style={{
            width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none',
            background: !selected ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: '#64748b', fontSize: 12, cursor: 'pointer',
          }}>
            — No publicar en {meta.label}
          </button>
          {accounts.map(a => (
            <button key={a.id} onClick={() => { onChange(a); setOpen(false); }} style={{
              width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none',
              background: selected?.id === a.id ? `${meta.color}20` : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize: 16 }}>{meta.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{a.account_name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>ID: {a.account_id}</div>
              </div>
              {a.is_default && <Star size={11} color="#D4AF37" fill="#D4AF37" />}
              {selected?.id === a.id && <Check size={14} color={meta.color} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SocialHub() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flyerUrl = searchParams.get('flyerUrl') || '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [contentUrl, setContentUrl] = useState(flyerUrl);
  const [contentType, setContentType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  const [captions, setCaptions] = useState<Record<string, string>>({ facebook: '', instagram: '' });
  const [generatingCaption, setGeneratingCaption] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState('Profesional');
  const [previewPlatform, setPreviewPlatform] = useState('facebook');
  const [publishing, setPublishing] = useState(false);

  // Per-platform selected account
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, SocialAccount | null>>({
    facebook: null, instagram: null,
  });

  useEffect(() => { loadData(); }, [profile?.company_id]);

  async function loadData() {
    setLoading(true);
    try {
      const [accs, posts] = await Promise.all([
        socialPublishService.getAccounts(),
        socialPublishService.getPosts(),
      ]);
      setAccounts(accs);
      setRecentPosts(posts);
      // Auto-select defaults
      const grouped = groupByPlatform(accs);
      const autoSelect: Record<string, SocialAccount | null> = {};
      for (const [plat, list] of Object.entries(grouped)) {
        autoSelect[plat] = list.find(a => a.is_default) || list[0] || null;
      }
      setSelectedAccounts(autoSelect);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const grouped = groupByPlatform(accounts);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.company_id) return;
    setUploading(true);
    try {
      const url = await socialPublishService.uploadContent(file, profile.company_id);
      setContentUrl(url);
      setContentType(file.type.startsWith('video') ? 'video' : 'image');
      toast.success('Contenido listo');
    } catch { toast.error('Error al subir'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  }

  async function handleAICaption(platform: string) {
    if (!contentUrl && !captions.default) { toast.error('Sube contenido primero'); return; }
    setGeneratingCaption(platform);
    try {
      const text = await socialPublishService.generateCaption(platform, captions[platform] || 'Contenido premium', selectedTone, profile?.company_id || '');
      setCaptions(prev => ({ ...prev, [platform]: text }));
    } catch { toast.error('Error generando caption'); }
    finally { setGeneratingCaption(null); }
  }

  async function handlePublish() {
    if (!contentUrl) { toast.error('Sube contenido primero'); return; }
    const toPublish = Object.entries(selectedAccounts).filter(([, a]) => a !== null);
    if (!toPublish.length) { toast.error('Selecciona al menos una cuenta'); return; }

    setPublishing(true);
    const tid = toast.loading('Publicando...');
    try {
      const post = await socialPublishService.createPost({
        company_id: profile!.company_id!,
        content_url: contentUrl,
        content_type: contentType,
        captions,
        platforms: toPublish.map(([p]) => p),
        status: 'draft',
      });
      const results = await socialPublishService.publish(
        post.id,
        toPublish.map(([p, a]) => ({ platform: p, account_id: a!.account_id! }))
      );
      toast.dismiss(tid);
      const ok = Object.entries(results).filter(([, r]: any) => r?.success).map(([p]) => p.split('_')[0]);
      const fail = Object.entries(results).filter(([, r]: any) => r?.error).map(([p]) => p.split('_')[0]);
      if (ok.length) toast.success(`✅ Publicado: ${ok.join(', ')}`);
      if (fail.length) toast.error(`❌ Falló: ${fail.join(', ')}`);
      loadData();
    } catch (err: any) { toast.dismiss(tid); toast.error(err.message); }
    finally { setPublishing(false); }
  }

  const activePlatforms = Object.keys(grouped).filter(p => PLATFORM_META[p]);
  const selectedCount = Object.values(selectedAccounts).filter(Boolean).length;

  const getStatusDot = (status: string) => ({ published: '#10b981', failed: '#ef4444', publishing: '#f59e0b', draft: '#64748b' }[status] || '#64748b');

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/marketing')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer' }}>
            <ArrowLeft size={18} color="#94a3b8" />
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.12em' }}>ARIAS CRM · PREMIUM</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>🌐 Social Media Hub</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/company/social-accounts')} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#D4AF37', cursor: 'pointer' }}>
            Gestionar Cuentas
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 300px', overflow: 'hidden' }}>

        {/* ── COL 1: Content ── */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.12em' }}>CONTENIDO</div>

          <div onClick={() => fileInputRef.current?.click()} style={{
            border: `2px dashed ${contentUrl ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 14, padding: 20, textAlign: 'center', cursor: 'pointer',
            background: contentUrl ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.01)',
            minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {uploading ? (
              <><Loader2 size={26} color="#D4AF37" className="animate-spin" /><span style={{ color: '#94a3b8', fontSize: 12 }}>Subiendo...</span></>
            ) : contentUrl ? (
              <>
                {contentType === 'image'
                  ? <img src={contentUrl} alt="" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 8, objectFit: 'cover' }} />
                  : <><Video size={28} color="#10b981" /><span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>Video listo</span></>
                }
                <span style={{ fontSize: 10, color: '#475569' }}>Click para cambiar</span>
              </>
            ) : (
              <>
                <Upload size={22} color="#D4AF37" />
                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>Subir imagen o video</span>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} style={{ display: 'none' }} />

          <button onClick={() => navigate('/marketing/flyers')} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '9px 12px', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
            <Image size={14} /> Desde Flyer Studio
          </button>

          {/* Tone */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.08em', marginBottom: 7 }}>TONO DE MARCA</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => setSelectedTone(t)} style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${selectedTone === t ? '#D4AF37' : 'rgba(255,255,255,0.07)'}`, background: selectedTone === t ? 'rgba(212,175,55,0.12)' : 'transparent', color: selectedTone === t ? '#D4AF37' : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          {recentPosts.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.08em', marginBottom: 7 }}>HISTORIAL RECIENTE</div>
              {recentPosts.slice(0, 4).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: getStatusDot(p.status), display: 'inline-block', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{p.platforms.join(' · ')}</div>
                    <div style={{ fontSize: 10, color: '#334155', textTransform: 'capitalize' }}>{p.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── COL 2: Preview + Captions ── */}
        <div style={{ padding: 22, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Platform preview tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {activePlatforms.map(p => {
              const m = PLATFORM_META[p];
              return (
                <button key={p} onClick={() => setPreviewPlatform(p)} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: previewPlatform === p ? m.color : 'rgba(255,255,255,0.05)', color: previewPlatform === p ? '#fff' : '#475569', transition: 'all 0.15s' }}>
                  {m.emoji} {m.label}
                </button>
              );
            })}
          </div>

          {/* Post preview */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#000' }}>
                {(selectedAccounts[previewPlatform]?.account_name || 'A')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{selectedAccounts[previewPlatform]?.account_name || 'ARIAS Defense Components'}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Ahora · 🌐</div>
              </div>
            </div>
            {contentUrl && contentType === 'image' && <img src={contentUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />}
            {contentUrl && contentType === 'video' && <div style={{ height: 180, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={36} color="#475569" /></div>}
            {!contentUrl && <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 13 }}>Sube contenido para ver preview</div>}
            <div style={{ padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {captions[previewPlatform] || <span style={{ color: '#334155', fontStyle: 'italic' }}>Caption para {PLATFORM_META[previewPlatform]?.label}...</span>}
              </p>
            </div>
          </div>

          {/* Captions per platform */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activePlatforms.map(p => {
              const m = PLATFORM_META[p];
              return (
                <div key={p} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1' }}>{m.emoji} {m.label}</span>
                    <button onClick={() => handleAICaption(p)} disabled={generatingCaption === p} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 7, padding: '3px 9px', fontSize: 11, fontWeight: 700, color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {generatingCaption === p ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} IA
                    </button>
                  </div>
                  <textarea value={captions[p] || ''} onChange={e => setCaptions(prev => ({ ...prev, [p]: e.target.value }))} placeholder={`Caption optimizado para ${m.label}...`} rows={3} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '10px 14px', fontSize: 13, color: '#94a3b8', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COL 3: Publish Panel ── */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.12em' }}>PUBLICAR EN</div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={24} color="#D4AF37" className="animate-spin" /></div>
          ) : (
            <>
              {/* Per-platform account selectors */}
              {Object.keys(PLATFORM_META).filter(p => p !== 'tiktok' && p !== 'youtube').map(platform => {
                const list = grouped[platform] || [];
                return (
                  <div key={platform}>
                    <AccountPicker
                      platform={platform}
                      accounts={list}
                      selected={selectedAccounts[platform] || null}
                      onChange={a => setSelectedAccounts(prev => ({ ...prev, [platform]: a }))}
                    />
                    {list.length === 0 && (
                      <div style={{ fontSize: 11, color: '#475569', padding: '4px 4px', marginTop: 4 }}>
                        No hay cuentas. <button onClick={() => navigate('/company/social-accounts')} style={{ color: '#D4AF37', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0 }}>Conectar</button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Phase 2 platforms */}
              <div style={{ opacity: 0.35, display: 'flex', gap: 8 }}>
                {['tiktok', 'youtube'].map(p => {
                  const m = PLATFORM_META[p];
                  return (
                    <div key={p} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 18 }}>{m.emoji}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: '#334155' }}>Próximo</div>
                    </div>
                  );
                })}
              </div>

              {/* Schedule placeholder */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.45 }}>
                <Clock size={15} color="#475569" />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Programar publicación</div>
                  <div style={{ fontSize: 10, color: '#334155' }}>Próximamente · Fase 2</div>
                </div>
              </div>

              {/* Publish button */}
              <button onClick={handlePublish} disabled={publishing || !contentUrl || selectedCount === 0} style={{
                background: !contentUrl || selectedCount === 0 ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #D4AF37, #f59e0b)',
                color: !contentUrl || selectedCount === 0 ? '#334155' : '#000',
                border: 'none', borderRadius: 14, padding: '14px 20px',
                fontSize: 14, fontWeight: 900,
                cursor: publishing || !contentUrl || selectedCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: contentUrl && selectedCount > 0 ? '0 8px 24px rgba(212,175,55,0.3)' : 'none',
                transition: 'all 0.2s', marginTop: 'auto',
              }}>
                {publishing ? <><Loader2 size={16} className="animate-spin" /> Publicando...</> : <><Send size={16} /> Publicar Ahora</>}
              </button>

              <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', margin: 0 }}>
                {selectedCount > 0 ? `Publicará en ${selectedCount} cuenta(s)` : 'Selecciona al menos una cuenta'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
