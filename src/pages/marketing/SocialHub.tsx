import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, Send, Globe, CheckCircle, XCircle, Loader2, Image, Video, Plus, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { socialPublishService, type SocialAccount, type SocialPost } from '../../services/social/socialPublishService';

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', emoji: '👥', phase: 1 },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', emoji: '📷', phase: 1 },
  { id: 'tiktok',    label: 'TikTok',    color: '#010101', emoji: '🎵', phase: 2 },
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', emoji: '▶️', phase: 2 },
];

const TONES = ['Profesional', 'Urgente', 'Amigable', 'Premium', 'Informal'];

export default function SocialHub() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flyerUrl = searchParams.get('flyerUrl');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Content
  const [contentUrl, setContentUrl] = useState<string>(flyerUrl || '');
  const [contentType, setContentType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  // Captions
  const [captions, setCaptions] = useState<Record<string, string>>({ facebook: '', instagram: '', tiktok: '', youtube: '' });
  const [generatingCaption, setGeneratingCaption] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState('Profesional');

  // Publish
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<string>('facebook');

  useEffect(() => {
    loadData();
  }, [profile?.company_id]);

  async function loadData() {
    setLoading(true);
    try {
      const [accs, posts] = await Promise.all([
        socialPublishService.getAccounts(),
        socialPublishService.getPosts(),
      ]);
      setAccounts(accs);
      setRecentPosts(posts);
      // Auto-select connected platforms
      const connected = accs.filter(a => a.is_active).map(a => a.platform);
      setSelectedPlatforms(connected as string[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.company_id) return;
    setUploading(true);
    try {
      const url = await socialPublishService.uploadContent(file, profile.company_id);
      setContentUrl(url);
      setContentType(file.type.startsWith('video') ? 'video' : 'image');
      toast.success('Contenido listo para publicar');
    } catch {
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleGenerateCaption(platform: string) {
    if (!contentUrl && !captions.default) {
      toast.error('Agrega contenido o descripción primero');
      return;
    }
    setGeneratingCaption(platform);
    try {
      const base = captions[platform] || captions.default || 'Contenido de marketing premium';
      const caption = await socialPublishService.generateCaption(platform, base, selectedTone, profile?.company_id || '');
      setCaptions(prev => ({ ...prev, [platform]: caption }));
    } catch {
      toast.error('Error generando caption');
    } finally {
      setGeneratingCaption(null);
    }
  }

  async function handlePublish() {
    if (!contentUrl) { toast.error('Sube contenido primero'); return; }
    if (selectedPlatforms.length === 0) { toast.error('Selecciona al menos una plataforma'); return; }

    const connectedSelected = selectedPlatforms.filter(p =>
      accounts.some(a => a.platform === p && a.is_active)
    );
    if (connectedSelected.length === 0) {
      toast.error('Las plataformas seleccionadas no están conectadas. Ve a Configuración → Cuentas Sociales.');
      return;
    }

    setPublishing(true);
    const publishToast = toast.loading(`Publicando en ${connectedSelected.join(', ')}...`);
    try {
      const post = await socialPublishService.createPost({
        company_id: profile!.company_id!,
        content_url: contentUrl,
        content_type: contentType,
        captions,
        platforms: connectedSelected,
        status: 'draft',
      });

      const results = await socialPublishService.publish(post.id, connectedSelected);

      const successes = Object.entries(results).filter(([, r]: any) => r?.success).map(([p]) => p);
      const failures = Object.entries(results).filter(([, r]: any) => r?.error).map(([p]) => p);

      toast.dismiss(publishToast);
      if (successes.length > 0) toast.success(`✅ Publicado en: ${successes.join(', ')}`);
      if (failures.length > 0) toast.error(`❌ Falló en: ${failures.join(', ')}`);

      loadData();
    } catch (err: any) {
      toast.dismiss(publishToast);
      toast.error(err.message || 'Error al publicar');
    } finally {
      setPublishing(false);
    }
  }

  const connectedPlatforms = accounts.filter(a => a.is_active).map(a => a.platform);

  const getStatusColor = (status: string) => {
    if (status === 'published') return '#10b981';
    if (status === 'failed') return '#ef4444';
    if (status === 'publishing') return '#f59e0b';
    return '#94a3b8';
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/marketing')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer' }}>
            <ArrowLeft size={18} color="#94a3b8" />
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>ARIAS CRM PREMIUM</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>🌐 Social Media Hub</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {connectedPlatforms.length} plataforma{connectedPlatforms.length !== 1 ? 's' : ''} conectada{connectedPlatforms.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => navigate('/company/social-accounts')}
            style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#D4AF37', cursor: 'pointer' }}
          >
            + Conectar Cuentas
          </button>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 320px', overflow: 'hidden' }}>

        {/* ── COL 1: Content Source ─────────────────────────────────── */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>CONTENIDO</div>

          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${contentUrl ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 16, padding: 24, textAlign: 'center', cursor: 'pointer',
              background: contentUrl ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
              minHeight: 160,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {uploading ? (
              <><Loader2 size={28} color="#D4AF37" className="animate-spin" /><span style={{ color: '#94a3b8', fontSize: 13 }}>Subiendo...</span></>
            ) : contentUrl ? (
              <>
                {contentType === 'image'
                  ? <img src={contentUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 10, objectFit: 'cover' }} />
                  : <><Video size={32} color="#10b981" /><span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>Video listo</span></>
                }
                <span style={{ fontSize: 11, color: '#64748b' }}>Click para cambiar</span>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={22} color="#D4AF37" />
                </div>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>Subir Imagen o Video</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>PNG, JPG, MP4 · Máx 50MB</div>
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} style={{ display: 'none' }} />

          {/* From Flyer Gallery */}
          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>— o usa un flyer existente —</div>
          <button
            onClick={() => navigate('/marketing/flyers')}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 16px', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
          >
            <Image size={15} /> Abrir Flyer Studio
          </button>

          {/* Tone selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', marginBottom: 8 }}>TONO DE MARCA</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => setSelectedTone(t)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${selectedTone === t ? '#D4AF37' : 'rgba(255,255,255,0.08)'}`, background: selectedTone === t ? 'rgba(212,175,55,0.15)' : 'transparent', color: selectedTone === t ? '#D4AF37' : '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Recent posts */}
          {recentPosts.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', marginBottom: 8 }}>HISTORIAL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentPosts.slice(0, 5).map(post => (
                  <div key={post.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{post.platforms.join(' · ')}</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(post.status), display: 'inline-block' }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{post.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── COL 2: Captions & Preview ─────────────────────────────── */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Platform preview tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {PLATFORMS.filter(p => p.phase === 1).map(p => (
              <button
                key={p.id}
                onClick={() => setPreviewPlatform(p.id)}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: previewPlatform === p.id ? p.color : 'rgba(255,255,255,0.05)',
                  color: previewPlatform === p.id ? '#fff' : '#64748b',
                  transition: 'all 0.2s',
                }}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>

          {/* Preview mockup */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#000' }}>
                {(profile?.name || 'A')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{profile?.name || 'Tu empresa'}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Ahora · 🌐</div>
              </div>
            </div>
            {contentUrl && contentType === 'image' && (
              <img src={contentUrl} alt="preview" style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }} />
            )}
            {contentUrl && contentType === 'video' && (
              <div style={{ background: '#000', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={40} color="#64748b" />
              </div>
            )}
            {!contentUrl && (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                Sube contenido para ver preview
              </div>
            )}
            <div style={{ padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {captions[previewPlatform] || <span style={{ color: '#475569', fontStyle: 'italic' }}>Caption aparecerá aquí...</span>}
              </p>
            </div>
          </div>

          {/* Caption editors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Captions por plataforma</div>
            {PLATFORMS.filter(p => p.phase === 1).map(p => (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{p.emoji} {p.label}</span>
                  <button
                    onClick={() => handleGenerateCaption(p.id)}
                    disabled={generatingCaption === p.id}
                    style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    {generatingCaption === p.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    IA
                  </button>
                </div>
                <textarea
                  value={captions[p.id] || ''}
                  onChange={e => setCaptions(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={`Caption para ${p.label}...`}
                  rows={3}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '10px 14px', fontSize: 13, color: '#cbd5e1', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── COL 3: Publish Panel ──────────────────────────────────── */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>PUBLICAR EN</div>

          {/* Platform selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLATFORMS.map(p => {
              const isConnected = connectedPlatforms.includes(p.platform as any);
              const isSelected = selectedPlatforms.includes(p.id);
              const isPhase2 = p.phase === 2;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isPhase2 || !isConnected) return;
                    setSelectedPlatforms(prev =>
                      isSelected ? prev.filter(x => x !== p.id) : [...prev, p.id]
                    );
                  }}
                  style={{
                    background: isSelected && isConnected ? `${p.color}15` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected && isConnected ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, padding: '12px 14px', cursor: isPhase2 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, opacity: isPhase2 ? 0.4 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {p.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: isConnected ? '#10b981' : '#f59e0b' }}>
                      {isPhase2 ? 'Próximamente' : isConnected ? '✓ Conectado' : 'No conectado'}
                    </div>
                  </div>
                  {!isPhase2 && (
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected && isConnected ? p.color : 'rgba(255,255,255,0.15)'}`, background: isSelected && isConnected ? p.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && isConnected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Connect accounts CTA if none connected */}
          {connectedPlatforms.length === 0 && (
            <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <Globe size={24} color="#D4AF37" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37', marginBottom: 4 }}>Conecta tus cuentas</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Vincula Facebook e Instagram para comenzar a publicar</div>
              <button
                onClick={() => navigate('/company/social-accounts')}
                style={{ background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#D4AF37', cursor: 'pointer' }}
              >
                Conectar Cuentas
              </button>
            </div>
          )}

          {/* Schedule option (Phase 2 placeholder) */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
            <Clock size={16} color="#64748b" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Programar publicación</div>
              <div style={{ fontSize: 11, color: '#475569' }}>Próximamente · Fase 2</div>
            </div>
          </div>

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={publishing || !contentUrl || selectedPlatforms.length === 0}
            style={{
              background: !contentUrl || selectedPlatforms.length === 0
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, #D4AF37, #f59e0b)',
              color: !contentUrl || selectedPlatforms.length === 0 ? '#475569' : '#000',
              border: 'none', borderRadius: 14, padding: '16px 24px',
              fontSize: 15, fontWeight: 900, cursor: publishing || !contentUrl || selectedPlatforms.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: contentUrl && selectedPlatforms.length > 0 ? '0 8px 24px rgba(212,175,55,0.3)' : 'none',
              transition: 'all 0.2s', marginTop: 'auto',
            }}
          >
            {publishing ? <><Loader2 size={18} className="animate-spin" /> Publicando...</> : <><Send size={18} /> Publicar Ahora</>}
          </button>

          <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', margin: 0 }}>
            Se publicará en {selectedPlatforms.filter(p => connectedPlatforms.includes(p as any)).length} plataforma(s) conectada(s)
          </p>
        </div>
      </div>
    </div>
  );
}
