import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, Send, Loader2, Image, Video, Sparkles, Clock, Star, ChevronDown, Check, Globe, HelpCircle, Zap, Hash, TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { socialPublishService, type SocialAccount, type SocialPost } from '../../services/social/socialPublishService';
import { flyerService, type FlyerAsset } from '../../services/flyerService';
import { supabase } from '../../services/supabase';

// ── BRAND SVG ICONS ─────────────────────────────────────────────────────────

export const FacebookIcon = ({ size = 20, color = "#1877F2", className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const InstagramIcon = ({ size = 20, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="url(#ig-gradient-sh2)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="ig-gradient-sh2" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export const TikTokIcon = ({ size = 20, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="#010101">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.85.99 2.0 1.69 3.25 2.02v3.8c-1.57-.16-3.07-.84-4.22-1.91-.12-.11-.22-.24-.33-.36v7.89c.04 2.44-1.2 4.77-3.26 6.07-2.07 1.3-4.75 1.44-6.95.36-2.2-1.08-3.69-3.28-3.92-5.73-.3-3.2 1.87-6.27 4.96-7.05 1.27-.32 2.6-.2 3.79.34v4.06c-.79-.5-1.74-.69-2.67-.51-1.39.26-2.42 1.48-2.52 2.9-.1 1.76 1.24 3.29 3.0 3.4 1.76.11 3.32-1.15 3.51-2.91.03-.27.04-.54.04-.81V.02z" />
  </svg>
);

export const YouTubeIcon = ({ size = 20, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.518 3.535 12 3.535 12 3.535s-7.518 0-9.388.52a3.005 3.005 0 0 0-2.11 2.108C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.87.52 9.388.52 9.388.52s7.518 0 9.388-.52a3.003 3.003 0 0 0 2.11-2.108C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const PLATFORM_META: Record<string, { icon: React.ComponentType<any>; color: string; bgLight: string; label: string }> = {
  facebook: { icon: FacebookIcon, color: '#1877F2', bgLight: '#e8f0fe', label: 'Facebook' },
  instagram: { icon: InstagramIcon, color: '#E1306C', bgLight: '#fdf0f5', label: 'Instagram' },
  tiktok: { icon: TikTokIcon, color: '#010101', bgLight: '#f1f1f1', label: 'TikTok' },
  youtube: { icon: YouTubeIcon, color: '#FF0000', bgLight: '#ffebee', label: 'YouTube' },
};

const TONES = ['Profesional', 'Urgente', 'Premium', 'Amigable', 'Informal'];

// ── VIRALITY SCORE ENGINE ───────────────────────────────────────────────────

interface ViralityResult {
  score: number;
  label: string;
  color: string;
  tips: Array<{ ok: boolean; text: string; detail: string }>;
}

function getViralityScore(caption: string, platform: string, hasMedia: boolean): ViralityResult {
  let score = 0;
  const tips: Array<{ ok: boolean; text: string; detail: string }> = [];

  // 1. Media uploaded (most important — +25 pts)
  const mediaOk = hasMedia;
  tips.push({ ok: mediaOk, text: 'Imagen o video adjunto', detail: 'Posts con visual obtienen 2.3x más alcance orgánico.' });
  if (mediaOk) score += 25;

  // 2. Caption not empty
  const hasCaption = caption.trim().length > 10;
  tips.push({ ok: hasCaption, text: 'Caption escrito', detail: 'Un caption bien escrito aumenta el tiempo de visualización.' });
  if (hasCaption) score += 10;

  // 3. Optimal caption length
  const len = caption.trim().length;
  const optimalLen = platform === 'facebook' ? (len >= 40 && len <= 300) : (len >= 100 && len <= 220);
  const lenLabel = platform === 'facebook' ? '40–300 caracteres (FB)' : '100–220 caracteres (IG)';
  tips.push({ ok: optimalLen, text: `Longitud óptima: ${lenLabel}`, detail: 'Meta recomienda esta longitud para máximo engagement.' });
  if (optimalLen) score += 15;

  // 4. Has emoji
  const hasEmoji = /\p{Emoji}/u.test(caption);
  tips.push({ ok: hasEmoji, text: 'Incluye emojis', detail: 'Los emojis aumentan el CTR hasta un 25% según estudios de Meta.' });
  if (hasEmoji) score += 10;

  // 5. Has CTA
  const ctaWords = ['escríbenos', 'llama', 'contáctanos', 'visita', 'descubre', 'agenda', 'reserva', 'compra', 'obtén', 'haz clic', 'click', 'link', 'bio', 'dm', 'mensaje', 'conoce', 'descarga', 'regístrate'];
  const hasCTA = ctaWords.some(w => caption.toLowerCase().includes(w));
  tips.push({ ok: hasCTA, text: 'Tiene CTA (llamada a acción)', detail: 'Posts con CTA generan 89% más interacciones.' });
  if (hasCTA) score += 15;

  // 6. Hashtag count
  const hashtagCount = (caption.match(/#\w+/g) || []).length;
  const optimalHashtags = platform === 'instagram' ? (hashtagCount >= 3 && hashtagCount <= 5) : (hashtagCount >= 1 && hashtagCount <= 2);
  const hashtagLabel = platform === 'instagram' ? '3–5 hashtags (IG óptimo)' : '1–2 hashtags (FB óptimo)';
  tips.push({ ok: optimalHashtags, text: hashtagLabel, detail: 'Meta penaliza el exceso de hashtags. 3-5 en IG es el punto dulce.' });
  if (optimalHashtags) score += 10;

  // 7. No link in IG caption
  if (platform === 'instagram') {
    const hasLink = /https?:\/\//i.test(caption);
    const noLink = !hasLink;
    tips.push({ ok: noLink, text: 'Sin links en caption (IG)', detail: 'Instagram suprime el alcance de posts con URLs en el caption.' });
    if (noLink) score += 10;
  }

  // 8. Hook in first line (starts with power word or question)
  const firstLine = caption.trim().split('\n')[0].toLowerCase();
  const hookWords = ['¿', 'cómo', 'por qué', 'el secreto', 'la verdad', 'descubre', 'alerta', 'nuevo', 'gratis', 'exclusivo', 'ya', 'ahora', '🚨', '🔥', '⚡', '💡'];
  const hasHook = hookWords.some(w => firstLine.includes(w));
  tips.push({ ok: hasHook, text: 'Gancho fuerte en la primera línea', detail: 'La primera frase decide si el usuario sigue leyendo o hace scroll.' });
  if (hasHook) score += 5;

  // Clamp score 0-100
  score = Math.min(100, Math.max(0, score));

  let label = '🔴 Bajo alcance';
  let color = '#ef4444';
  if (score >= 75) { label = '🔥 Viral potencial'; color = '#10b981'; }
  else if (score >= 50) { label = '✅ Buen alcance'; color = '#f59e0b'; }
  else if (score >= 25) { label = '⚠️ Alcance limitado'; color = '#f59e0b'; }

  return { score, label, color, tips };
}


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
  const meta = PLATFORM_META[platform];
  const BrandIcon = meta.icon;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          background: selected ? `${meta.color}08` : '#fff',
          border: `1.5px solid ${selected ? meta.color : '#cbd5e1'}`,
          borderRadius: 12, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s ease',
        }}
      >
        <BrandIcon size={18} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{meta.label}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: selected ? '#10b981' : '#ca8a04', marginTop: 1 }}>
            {selected ? `✓ ${selected.account_name}` : 'Seleccionar cuenta...'}
          </div>
        </div>
        {selected?.is_default && <Star size={11} color="#D4AF37" fill="#D4AF37" />}
        <ChevronDown size={14} color="#64748b" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          {/* None option */}
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            style={{
              width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none',
              background: !selected ? '#f1f5f9' : 'transparent',
              color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            — No publicar en {meta.label}
          </button>
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => { onChange(a); setOpen(false); }}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none',
                background: selected?.id === a.id ? `${meta.color}10` : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <BrandIcon size={14} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{a.account_name}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>ID: {a.account_id}</div>
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
  const [imgError, setImgError] = useState(false);

  const [captions, setCaptions] = useState<Record<string, string>>({ facebook: '', instagram: '' });
  const [generatingCaption, setGeneratingCaption] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState('Profesional');
  const [previewPlatform, setPreviewPlatform] = useState('facebook');
  const [publishing, setPublishing] = useState(false);
  const [showMetaTips, setShowMetaTips] = useState(false);
  const [generatingHashtags, setGeneratingHashtags] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);

  // Per-platform selected account
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, SocialAccount | null>>({
    facebook: null, instagram: null,
  });

  useEffect(() => { loadData(); }, [profile?.company_id]);

  // Load flyer data and auto-generate captions
  useEffect(() => {
    if (profile?.company_id && flyerUrl) {
      autoGenerateCaptions();
    }
  }, [profile?.company_id, flyerUrl]);

  async function autoGenerateCaptions() {
    if (!profile?.company_id) return;
    setGeneratingCaption('facebook');
    try {
      // 1. Get flyer details from db
      const { data: flyerData } = await supabase
        .from('flyer_assets')
        .select('titulo, prompt_used')
        .eq('image_url', flyerUrl)
        .maybeSingle();

      const context = flyerData
        ? `Flyer titulado "${flyerData.titulo || ''}" con diseño: ${flyerData.prompt_used || ''}`
        : 'Facturación instantánea y declaraciones para PYMEs';

      // 2. Generate for facebook and instagram
      const [fbText, igText] = await Promise.all([
        socialPublishService.generateCaption('facebook', context, selectedTone, profile.company_id),
        socialPublishService.generateCaption('instagram', context, selectedTone, profile.company_id)
      ]);

      setCaptions({
        facebook: fbText,
        instagram: igText
      });
      toast.success('¡Copy publicitario creado con IA!');
    } catch (err) {
      console.error('Error generating initial captions:', err);
    } finally {
      setGeneratingCaption(null);
    }
  }

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

  // ── Virality Score (reactive, no API call) ──────────────────────────────────
  const viralityResult = useMemo(() =>
    getViralityScore(captions[previewPlatform] || '', previewPlatform, !!contentUrl),
    [captions, previewPlatform, contentUrl]
  );

  // ── Hashtag Generator ────────────────────────────────────────────────────────
  async function handleGenerateHashtags() {
    const caption = captions[previewPlatform];
    if (!caption?.trim()) { toast.error('Escribe un caption primero'); return; }
    setGeneratingHashtags(true);
    setSuggestedHashtags([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: 'Eres un experto en marketing digital de El Salvador. Responde SOLO con una lista de hashtags separados por espacios, sin explicaciones. Incluye hashtags en español, inglés y algunos locales de El Salvador.' },
            { role: 'user', content: `Genera exactamente ${previewPlatform === 'instagram' ? 5 : 2} hashtags de alto impacto para este caption de ${previewPlatform === 'instagram' ? 'Instagram' : 'Facebook'}: "${caption.substring(0, 200)}"` }
          ],
          companyId: profile?.company_id,
        }
      });
      if (error) throw error;
      const raw: string = data?.content || data?.response || '';
      const tags = raw.match(/#\w+/g) || raw.split(/\s+/).filter((w: string) => w.startsWith('#'));
      if (tags.length === 0) throw new Error('No hashtags returned');
      setSuggestedHashtags(tags.slice(0, previewPlatform === 'instagram' ? 5 : 2));
    } catch (e) {
      toast.error('Error generando hashtags');
    } finally {
      setGeneratingHashtags(false);
    }
  }

  function applyHashtags() {
    if (!suggestedHashtags.length) return;
    const current = captions[previewPlatform] || '';
    const withTags = current.trim() + '\n\n' + suggestedHashtags.join(' ');
    setCaptions(prev => ({ ...prev, [previewPlatform]: withTags }));
    setSuggestedHashtags([]);
    toast.success('Hashtags agregados al caption');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.company_id) return;
    setUploading(true);
    setImgError(false);
    try {
      const url = await socialPublishService.uploadContent(file, profile.company_id);
      setContentUrl(url);
      setContentType(file.type.startsWith('video') ? 'video' : 'image');
      toast.success('Contenido listo');
      // Auto-generate captions for newly uploaded content
      if (profile.company_id) {
        setGeneratingCaption('facebook');
        try {
          const context = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
          const [fbText, igText] = await Promise.all([
            socialPublishService.generateCaption('facebook', context, selectedTone, profile.company_id),
            socialPublishService.generateCaption('instagram', context, selectedTone, profile.company_id)
          ]);
          setCaptions({ facebook: fbText, instagram: igText });
          toast.success('¡Copy generado con IA!');
        } catch { /* caption errors are non-blocking */ }
        finally { setGeneratingCaption(null); }
      }
    } catch { toast.error('Error al subir'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  }

  async function handleAICaption(platform: string) {
    const originalText = captions[platform] || '';
    // Need either a flyer loaded OR some text to work with
    if (!contentUrl && !originalText.trim()) {
      toast.error('Escribe una idea o sube contenido primero');
      return;
    }
    setGeneratingCaption(platform);
    try {
      const seedContent = originalText.trim() || 'Contenido de marketing profesional para mi empresa';
      const text = await socialPublishService.generateCaption(
        platform,
        seedContent,
        selectedTone,
        profile?.company_id || ''
      );
      setCaptions(prev => ({ ...prev, [platform]: text }));
      toast.success(`✨ Copy de ${platform} optimizado con IA`);
    } catch (err: any) {
      // Restore the original text — NEVER leave the user with an empty field
      setCaptions(prev => ({ ...prev, [platform]: originalText }));
      toast.error(err.message || 'Error generando caption. Tu texto original fue restaurado.');
    } finally {
      setGeneratingCaption(null);
    }
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
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f4f6f9', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header - Salesforce Lightning Design Aesthetic */}
      <header style={{
        padding: '12px 24px',
        borderBottom: '1px solid #d8dde6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/marketing')}
            style={{
              background: '#fff',
              border: '1px solid #d8dde6',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <ArrowLeft size={15} color="#54698d" strokeWidth={2.5} />
          </button>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.12em' }}>ARIAS CRM · MARKETING</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#081c3b', display: 'flex', alignItems: 'center', gap: 6 }}>
              🌐 Social Media Hub
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/company/social-accounts')}
            style={{
              background: '#ffffff',
              border: '1px solid #d8dde6',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              color: '#0070d2',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f6f9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          >
            Gestionar Cuentas
          </button>
        </div>
      </header>

      {/* Main Grid View: Balanced Salesforce Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 400px', overflow: 'hidden' }}>

        {/* ── COL 1: Media & Tone (320px) ── */}
        <div style={{
          borderRight: '1px solid #d8dde6',
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          background: '#f4f6f9'
        }}>
          {/* Uploader Card */}
          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #d8dde6', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', marginBottom: 12 }}>MULTIMEDIA</div>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${contentUrl ? '#10b981' : '#d8dde6'}`,
                borderRadius: 8, padding: '24px 12px', textAlign: 'center', cursor: 'pointer',
                background: contentUrl ? '#f0fdf4' : '#fafbfc',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.15s ease',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={24} color="#0070d2" className="animate-spin" />
                  <span style={{ color: '#54698d', fontSize: 11, fontWeight: 700 }}>Subiendo...</span>
                </>
              ) : contentUrl ? (
                <>
                  {contentType === 'image'
                    ? <img src={contentUrl} alt="" style={{ maxWidth: '100%', maxHeight: 110, borderRadius: 6, objectFit: 'cover' }} />
                    : <><Video size={24} color="#10b981" /><span style={{ fontSize: 11, color: '#10b981', fontWeight: 800 }}>Video listo</span></>
                  }
                  <span style={{ fontSize: 10, color: '#0070d2', fontWeight: 700, marginTop: 4 }}>Cambiar archivo</span>
                </>
              ) : (
                <>
                  <Upload size={20} color="#54698d" />
                  <div>
                    <span style={{ color: '#081c3b', fontSize: 12, fontWeight: 700, display: 'block' }}>Subir imagen o video</span>
                    <span style={{ color: '#54698d', fontSize: 10, display: 'block', marginTop: 2 }}>Formatos: PNG, JPG, MP4</span>
                  </div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} style={{ display: 'none' }} />

            <button
              onClick={() => navigate('/marketing/flyers')}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #d8dde6',
                borderRadius: 8,
                padding: '9px 12px',
                color: '#0070d2',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'center',
                marginTop: 12
              }}
            >
              <Sparkles size={12} color="#D4AF37" fill="#D4AF37" /> Desde Flyer Studio
            </button>
          </div>

          {/* Brand Tone Card */}
          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #d8dde6', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', marginBottom: 12 }}>TONO DE MARCA</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TONES.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTone(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: `1px solid ${selectedTone === t ? '#0070d2' : '#d8dde6'}`,
                    background: selectedTone === t ? '#0070d2' : '#ffffff',
                    color: selectedTone === t ? '#ffffff' : '#54698d',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          {recentPosts.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #d8dde6', padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', marginBottom: 12 }}>HISTORIAL RECIENTE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentPosts.slice(0, 5).map(p => {
                  const postDate = new Date(p.created_at);
                  const now = new Date();
                  const diffDays = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
                  const dateLabel = diffDays === 0
                    ? `Hoy ${postDate.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`
                    : diffDays === 1
                    ? 'Ayer'
                    : postDate.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: '2-digit' });

                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f4f6f9' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: getStatusDot(p.status), display: 'inline-block', marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: '#081c3b', fontWeight: 700 }}>{p.platforms.join(' · ')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 9, color: p.status === 'published' ? '#10b981' : p.status === 'failed' ? '#ef4444' : '#64748b', fontWeight: 700, textTransform: 'capitalize' }}>
                            {p.status === 'published' ? '✓ Publicado' : p.status === 'failed' ? '✗ Falló' : p.status}
                          </span>
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>·</span>
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>{dateLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── COL 2: Message Composer (Center - 1fr) ── */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#081c3b', margin: 0 }}>Redactar Publicación</h2>
            <p style={{ fontSize: 12, color: '#54698d', margin: '4px 0 0 0' }}>Elige una pestaña para escribir y optimizar los textos específicos de cada red social.</p>
          </div>

          {/* Salesforce Tab Bar - Solid Border Bottom */}
          <div style={{ display: 'flex', borderBottom: '1px solid #d8dde6' }}>
            {activePlatforms.map(p => {
              const m = PLATFORM_META[p];
              const BrandIcon = m.icon;
              const isActive = previewPlatform === p;
              return (
                <button
                  key={p}
                  onClick={() => setPreviewPlatform(p)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #0070d2' : '3px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#081c3b' : '#54698d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: -1,
                    transition: 'all 0.15s'
                  }}
                >
                  <BrandIcon size={14} color={isActive ? m.color : '#54698d'} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Editor Area for the Active Tab */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Account Selector specifically for this tab */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#54698d' }}>CUENTA DE DESTINO ({previewPlatform.toUpperCase()})</label>
              <AccountPicker
                platform={previewPlatform}
                accounts={grouped[previewPlatform] || []}
                selected={selectedAccounts[previewPlatform] || null}
                onChange={a => setSelectedAccounts(prev => ({ ...prev, [previewPlatform]: a }))}
              />
              {(grouped[previewPlatform] || []).length === 0 && (
                <div style={{ fontSize: 11, color: '#c23934', padding: '6px 8px', marginTop: 4, background: '#fdf6f6', border: '1px solid #fcd2d2', borderRadius: 4 }}>
                  No hay cuentas conectadas de {PLATFORM_META[previewPlatform]?.label}. <button onClick={() => navigate('/company/social-accounts')} style={{ color: '#0070d2', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0, fontWeight: 'bold' }}>Conectar</button>
                </div>
              )}
            </div>

            {/* Large Text Area */}
            <div style={{ border: '1px solid #d8dde6', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#fafbfc', borderBottom: '1px solid #d8dde6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#54698d' }}>CAPTION DE PUBLICACIÓN</span>

                {/* AI Assistant Button */}
                <button
                  onClick={() => handleAICaption(previewPlatform)}
                  disabled={generatingCaption === previewPlatform}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d8dde6',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#0070d2',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {generatingCaption === previewPlatform ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Sparkles size={11} color="#D4AF37" fill="#D4AF37" />
                  )}
                  Optimizar con IA
                </button>
              </div>
              <textarea
                value={captions[previewPlatform] || ''}
                onChange={e => setCaptions(prev => ({ ...prev, [previewPlatform]: e.target.value }))}
                placeholder={`Escribe la publicación para ${PLATFORM_META[previewPlatform]?.label} aquí...`}
                rows={8}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: '14px',
                  fontSize: 14,
                  color: '#081c3b',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  lineHeight: 1.6
                }}
              />
            </div>
          </div>
        </div>

        {/* ── COL 3: Live Preview & Publish Pane (Right - 400px) ── */}
        <div style={{
          borderLeft: '1px solid #d8dde6',
          padding: '24px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          background: '#f4f6f9'
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em' }}>VISTA PREVIA EN VIVO</div>

          {/* Social Mockup Container — scrollable preview */}
          <div style={{
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #d8dde6',
            overflowX: 'hidden',
            overflowY: 'auto',
            maxHeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db transparent',
          }}>
            {/* Platform-aware mock header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, background: previewPlatform === 'instagram' ? 'linear-gradient(90deg,#fdf497 0%,#fd5949 45%,#d6249f 60%,#285AEB 100%)' : '#1877F2' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: previewPlatform === 'instagram' ? '#E1306C' : '#1877F2', flexShrink: 0 }}>
                {(selectedAccounts[previewPlatform]?.account_name || 'A')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{selectedAccounts[previewPlatform]?.account_name || 'ARIAS Defense Components'}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>Ahora · {previewPlatform === 'facebook' ? '🌐 Público' : '📷 Instagram'}</div>
              </div>
              {previewPlatform === 'facebook' ? <FacebookIcon size={16} color="#fff" /> : <InstagramIcon size={16} />}
            </div>

            {/* Facebook: caption ABOVE image */}
            {previewPlatform === 'facebook' && (
              <div style={{ padding: '10px 14px', borderBottom: captions.facebook ? '1px solid #f0f0f0' : 'none', background: '#fff' }}>
                {generatingCaption ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}><Loader2 size={12} className="animate-spin" /> Generando copy con IA...</div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#1c1e21', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif' }}>
                    {captions.facebook || <span style={{ color: '#bfc4cc', fontStyle: 'italic', fontSize: 12 }}>El copy aparecerá aquí automáticamente...</span>}
                  </p>
                )}
              </div>
            )}

            {/* Media */}
            {contentUrl ? (
              contentType === 'image' ? (
                <div style={{ background: '#f0f0f0', lineHeight: 0, position: 'relative', minHeight: 160 }}>
                  {!imgError ? (
                    <img
                      src={contentUrl}
                      alt="Vista previa"
                      onError={() => setImgError(true)}
                      style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,#0f172a,#1e293b)' }}>
                      <Image size={32} color="#475569" />
                      <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>Vista previa no disponible</span>
                      <span style={{ color: '#475569', fontSize: 10 }}>La imagen se publicará correctamente</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: 160, background: 'linear-gradient(135deg,#090d16,#1a2540)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Video size={32} color="#10b981" />
                  <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>Video listo para publicar</span>
                </div>
              )
            ) : (
              <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fafbfc' }}>
                <Upload size={22} color="#cbd5e1" />
                <span style={{ color: '#94a3b8', fontSize: 11 }}>Sube una imagen para la preview</span>
              </div>
            )}

            {/* Instagram: caption BELOW image */}
            {previewPlatform === 'instagram' && (
              <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {['❤️', '💬', '📤'].map(ic => <span key={ic} style={{ fontSize: 18 }}>{ic}</span>)}
                </div>
                {generatingCaption ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}><Loader2 size={12} className="animate-spin" /> Generando copy con IA...</div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12.5, color: '#262626', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif' }}>
                    <strong style={{ fontSize: 12 }}>{selectedAccounts['instagram']?.account_name || 'ariasdefense'} </strong>
                    {captions.instagram || <span style={{ color: '#bfc4cc', fontStyle: 'italic' }}>El copy aparecerá aquí...</span>}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── INTELLIGENCE PANEL (Sprint 2) ─────────────────────────────────── */}
          <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #d8dde6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

            {/* — Section: Virality Score — */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${viralityResult.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={14} color={viralityResult.color} fill={viralityResult.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>Score de Viralidad</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Basado en algoritmo Meta 2024</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: viralityResult.color, lineHeight: 1 }}>{viralityResult.score}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>/ 100</div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', width: `${viralityResult.score}%`, borderRadius: 99,
                  background: viralityResult.score >= 75 ? 'linear-gradient(90deg,#10b981,#059669)' : viralityResult.score >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)',
                  transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: viralityResult.color }}>{viralityResult.label}</span>
                <button onClick={() => setShowMetaTips(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#0070d2', fontWeight: 700, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ChevronDown size={11} style={{ transform: showMetaTips ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  {showMetaTips ? 'Ocultar análisis' : 'Ver análisis completo'}
                </button>
              </div>
            </div>

            {/* — Accordion: Meta Checklist — */}
            {showMetaTips && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.07em', marginBottom: 10 }}>
                  CHECKLIST META · {previewPlatform === 'instagram' ? 'Instagram' : 'Facebook'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {viralityResult.tips.map((tip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 10px', borderRadius: 7, background: tip.ok ? '#f0fdf4' : '#fffbeb', border: `1px solid ${tip.ok ? '#d1fae5' : '#fde68a'}` }}>
                      {tip.ok
                        ? <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
                        : <AlertTriangle size={13} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: tip.ok ? '#166534' : '#92400e' }}>{tip.text}</div>
                        {!tip.ok && <div style={{ fontSize: 10, color: '#78716c', marginTop: 2, lineHeight: 1.5 }}>{tip.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Meta insight footer */}
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <TrendingUp size={12} color="#1d4ed8" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 10, color: '#1e40af', lineHeight: 1.6 }}>
                    <strong>Meta 2024:</strong> Posts con imagen + CTA + 3–5 hashtags generan <strong>3.1× más alcance orgánico</strong>. Reels: 22% más distribución que fotos estáticas.
                  </div>
                </div>
              </div>
            )}

            {/* — Section: Hashtag Engine — */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: suggestedHashtags.length > 0 ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hash size={14} color="#0070d2" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>Hashtag Engine IA</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      {previewPlatform === 'instagram' ? '5 hashtags · óptimo según Meta' : '1–2 hashtags · FB penaliza el exceso'}
                    </div>
                  </div>
                </div>
                <button onClick={handleGenerateHashtags} disabled={generatingHashtags} style={{ background: generatingHashtags ? '#f1f5f9' : 'linear-gradient(135deg,#0070d2,#005fb2)', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: generatingHashtags ? '#94a3b8' : '#fff', cursor: generatingHashtags ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: generatingHashtags ? 'none' : '0 1px 4px rgba(0,112,210,0.3)', transition: 'all 0.15s' }}>
                  {generatingHashtags ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} color="#D4AF37" fill="#D4AF37" />}
                  {generatingHashtags ? 'Generando...' : 'Generar'}
                </button>
              </div>
              {suggestedHashtags.length > 0 && (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {suggestedHashtags.map((tag, i) => (
                      <span key={i} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99, padding: '4px 11px', fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>{tag}</span>
                    ))}
                  </div>
                  <button onClick={applyHashtags} style={{ width: '100%', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '8px', fontSize: 11, fontWeight: 700, color: '#166534', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Check size={12} /> Agregar al caption
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Future Networks */}
          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #d8dde6', padding: 14 }}>

            <div style={{ fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', marginBottom: 10 }}>FUTURAS REDES</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['tiktok', 'youtube'].map(p => {
                const m = PLATFORM_META[p];
                const BrandIcon = m.icon;
                return (
                  <div
                    key={p}
                    style={{
                      flex: 1,
                      background: '#f4f6f9',
                      borderRadius: 8,
                      padding: '10px',
                      border: '1px dashed #d8dde6',
                      textAlign: 'center',
                      opacity: 0.65
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}><BrandIcon size={16} /></div>
                    <div style={{ fontSize: 11, color: '#54698d', fontWeight: 700 }}>{m.label}</div>
                    <div style={{ fontSize: 9, color: '#54698d', marginTop: 1 }}>Fase 2</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schedule Picker placeholder */}
          <div style={{
            background: '#ffffff',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid #d8dde6',
            opacity: 0.75
          }}>
            <Clock size={15} color="#54698d" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#54698d' }}>Programar publicación</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Fase 2 · Configurar hora</div>
            </div>
          </div>

          {/* Action Publish Button */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handlePublish}
              disabled={publishing || !contentUrl || selectedCount === 0}
              style={{
                width: '100%',
                background: !contentUrl || selectedCount === 0
                  ? '#cbd5e1'
                  : 'linear-gradient(180deg, #0070d2 0%, #005fb2 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '14px 20px',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: publishing || !contentUrl || selectedCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: contentUrl && selectedCount > 0 ? '0 2px 6px rgba(0,112,210,0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {publishing ? (
                <><Loader2 size={15} className="animate-spin" /> Publicando...</>
              ) : (
                <><Send size={15} /> Publicar Ahora</>
              )}
            </button>
            <p style={{ fontSize: 11, color: '#54698d', textAlign: 'center', margin: 0, fontWeight: 600 }}>
              {selectedCount > 0 ? `Publicará en ${selectedCount} cuenta(s)` : 'Selecciona al menos una cuenta'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
