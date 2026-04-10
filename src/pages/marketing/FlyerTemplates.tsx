import React from 'react';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export interface FlyerData {
  title: string;
  subtitle: string;
  cta: string;
  beneficios: string[];
  accent: string;
  bgImageUrl: string | null;
  bgImagePosition?: { x: number; y: number };
  bgImage2Url?: string | null;
  photoLayout?: 'single' | 'split-h' | 'split-v' | 'pip-br' | 'pip-bl';
  logoUrl: string | null;
  industria: string;
  phone: string;
  website: string;
  templateId: string;
  containerW?: number;
  containerH?: number;
  textScale?: number;
  logoSize?: number;
  logoPos?: 'top-left' | 'top-right' | 'top-center';
  logoX?: number;
  logoY?: number;
  subtitleScale?: number;
  subtitleBold?: boolean;
  benefitsScale?: number;
  benefitsBold?: boolean;
  ctaGradient?: boolean;
  flyerFont?: string;
}

// ─── PHOTO HELPERS ────────────────────────────────────────────────────────────
export const imgBg = (url: string | null | undefined, pos?: { x: number; y: number }): React.CSSProperties => ({
  backgroundImage: url ? `url(${url})` : undefined,
  backgroundSize: 'cover',
  backgroundPosition: pos ? `${pos.x}% ${pos.y}%` : 'center',
});
export const imgObjPos = (pos?: { x: number; y: number }) =>
  pos ? `${pos.x}% ${pos.y}%` : 'center';

// ─── FONT SYSTEM ──────────────────────────────────────────────────────────────
export const getFontFamily = (f?: string) =>
  f && f !== 'Outfit' ? `'${f}','Outfit','Inter',sans-serif` : "'Outfit','Inter',sans-serif";

if (typeof document !== 'undefined' && !document.getElementById('gf-flyer')) {
  const lk = document.createElement('link');
  lk.id = 'gf-flyer'; lk.rel = 'stylesheet';
  lk.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Poppins:wght@400;700;900&family=Playfair+Display:ital,wght@0,700;1,700&family=Bebas+Neue&family=Raleway:wght@400;700;900&family=Inter:wght@400;700;900&display=swap';
  document.head.appendChild(lk);
}

// ─── SCALE FACTOR ─────────────────────────────────────────────────────────────
const getScale = (w: number, h: number) => Math.min(w / 540, h / 675);
const getFontScale = (w: number, h: number, ts: number) => getScale(w, h) * ts;

// ─── SHARED COMPONENTS (receive scale factor s) ───────────────────────────────
const trunc = (s: string, n: number) => s?.length > n ? s.slice(0, n - 1) + '…' : (s || '');

const PillBtn = ({ label, bg1, bg2, color = '#fff', style = {}, s = 1 }: {
  label: string; bg1: string; bg2: string; color?: string; style?: React.CSSProperties; s?: number;
}) => (
  <div style={{
    background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
    color, fontWeight: 900, fontSize: Math.round(15 * s),
    letterSpacing: '0.08em', borderRadius: 50,
    padding: `${Math.round(14 * s)}px ${Math.round(32 * s)}px`,
    display: 'inline-block',
    boxShadow: `0 ${Math.round(8 * s)}px ${Math.round(24 * s)}px ${bg1}55`,
    textAlign: 'center', ...style,
  }}>
    {label.toUpperCase()}
  </div>
);

const BenRow = ({ text, color, s = 1, scale = 1, bold = false }: { text: string; color: string; s?: number; scale?: number; bold?: boolean }) => {
  // Dynamically shrink font as text grows longer so everything fits
  const len = (text || '').length;
  const dynScale = len > 40 ? scale * 0.82 : len > 25 ? scale * 0.91 : scale;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: Math.round(10 * s), marginBottom: Math.round(6 * s) }}>
      <div style={{ width: Math.round(22 * s), height: Math.round(22 * s), borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <svg width={Math.round(12 * s)} height={Math.round(12 * s)} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.8 9.5L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <span style={{ fontSize: Math.round(13 * s * dynScale), fontWeight: bold ? 800 : 600, color: '#fff', lineHeight: 1.35, wordBreak: 'break-word' }}>{text || ''}</span>
    </div>
  );
};

const BenRowDark = ({ text, color, s = 1, scale = 1, bold = false }: { text: string; color: string; s?: number; scale?: number; bold?: boolean }) => {
  const len = (text || '').length;
  const dynScale = len > 40 ? scale * 0.82 : len > 25 ? scale * 0.91 : scale;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: Math.round(10 * s), marginBottom: Math.round(8 * s) }}>
      <div style={{ width: Math.round(22 * s), height: Math.round(22 * s), borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <svg width={Math.round(12 * s)} height={Math.round(12 * s)} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.8 9.5L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <span style={{ fontSize: Math.round(13 * s * dynScale), fontWeight: bold ? 800 : 600, color: '#334155', lineHeight: 1.35, wordBreak: 'break-word' }}>{text || ''}</span>
    </div>
  );
};

const Brand = ({ logo, name, color = '#fff', s = 1 }: {
  logo: string | null; name: string; color?: string; s?: number;
}) => {
  if (!logo) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(8 * s) }}>
      <img src={logo} style={{ width: Math.round(40 * s), height: Math.round(40 * s), borderRadius: Math.round(8 * s), objectFit: 'contain' }} crossOrigin="anonymous" />
      <span style={{ fontSize: Math.round(13 * s), fontWeight: 800, color, letterSpacing: '0.05em' }}>{trunc(name, 20).toUpperCase()}</span>
    </div>
  );
};

// ─── FREE LOGO overlay (drag + resize) ────────────────────────────────────────
export const FreeLogo = ({ d, onMove, onResize }: {
  d: FlyerData;
  onMove?: (x: number, y: number) => void;
  onResize?: (size: number) => void;
}) => {
  if (!d.logoUrl || d.logoX === undefined) return null;
  const W = d.containerW || 540, H = d.containerH || 675;
  const sz = Math.round(64 * (d.logoSize ?? 1));
  const x = (d.logoX / 100) * W, y = (d.logoY ?? 5) / 100 * H;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: sz, height: sz, cursor: onMove ? 'move' : 'default', zIndex: 20, userSelect: 'none' }}
      onMouseDown={e => {
        if (!onMove) return;
        e.preventDefault();
        const startX = e.clientX - x, startY = e.clientY - y;
        const move = (ev: MouseEvent) => onMove(Math.min(95, Math.max(0, ((ev.clientX - startX) / W) * 100)), Math.min(95, Math.max(0, ((ev.clientY - startY) / H) * 100)));
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      }}
    >
      <img src={d.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8, pointerEvents: 'none' }} crossOrigin="anonymous" />
      {onResize && (
        <div style={{ position: 'absolute', bottom: -4, right: -4, width: 14, height: 14, background: '#D4AF37', borderRadius: '50%', cursor: 'se-resize', zIndex: 21 }}
          onMouseDown={e => {
            e.stopPropagation(); e.preventDefault();
            const startX = e.clientX, startSz = d.logoSize ?? 1;
            const move = (ev: MouseEvent) => onResize(Math.max(0.3, Math.min(4, startSz + (ev.clientX - startX) / 80)));
            const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
          }}
        />
      )}
    </div>
  );
};

// ─── RENDER FLYER wrapper ─────────────────────────────────────────────────────
export const RenderFlyer = ({ d, onLogoMove, onLogoResize }: {
  d: FlyerData; onLogoMove?: (x: number, y: number) => void; onLogoResize?: (s: number) => void;
}) => {
  const Tmpl = TEMPLATES[d.templateId] || Template_BoldSplit;
  return (
    <div style={{ position: 'relative', width: d.containerW || 540, height: d.containerH || 675 }}>
      <Tmpl d={d} />
      <FreeLogo d={d} onMove={onLogoMove} onResize={onLogoResize} />
    </div>
  );
};

const Tag = ({ label, bg, color, s = 1 }: { label: string; bg: string; color: string; s?: number }) => (
  <div style={{ background: bg, color, fontSize: Math.round(11 * s), fontWeight: 800, padding: `${Math.round(4 * s)}px ${Math.round(14 * s)}px`, borderRadius: Math.round(20 * s), letterSpacing: '0.06em', display: 'inline-block' }}>
    {label.toUpperCase()}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: BOLD SPLIT — color panel left, photo right
// ═══════════════════════════════════════════════════════════════
export const Template_BoldSplit = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#1a56db';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  const words = title.split(' ');
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: '52%', height: '100%', background: `linear-gradient(160deg, ${acc} 0%, ${acc}cc 100%)`, zIndex: 2 }} />
      {d.bgImageUrl && <div style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />}
      <div style={{ position: 'absolute', left: '42%', top: 0, width: '20%', height: '100%', background: `linear-gradient(90deg, ${acc}ee 0%, transparent 100%)`, zIndex: 3 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: '52%', height: '100%', padding: `${Math.round(28 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', zIndex: 4, boxSizing: 'border-box' }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
          {words.slice(0, 4).map((w, i) => (
            <div key={i} style={{ fontSize: Math.round((i === 0 ? 58 : i === 1 ? 52 : 42) * s), fontWeight: 900, color: i === 1 ? 'rgba(255,255,255,0.78)' : '#fff', lineHeight: 1.0, textShadow: '0 4px 12px rgba(0,0,0,0.3)', letterSpacing: '-0.02em' }}>{w}</div>
          ))}
        </div>
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 900 : 500), lineHeight: 1.4, marginBottom: Math.round(14 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 80)}</div>
        <div style={{ marginBottom: Math.round(16 * s) }}>{(d.beneficios || []).slice(0, 3).map((b, i) => <BenRow key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color="rgba(255,255,255,0.25)" s={s} />)}</div>
        <PillBtn label={d.cta || 'CONTACTAR'} bg1="#fff" bg2="rgba(255,255,255,0.85)" color={acc} s={s} style={{ fontSize: Math.round(12 * s), padding: `${Math.round(12 * s)}px ${Math.round(20 * s)}px`, width: '100%', boxSizing: 'border-box' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(40 * s), background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(13 * s), letterSpacing: '0.04em' }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: CINEMATIC FULL
// ═══════════════════════════════════════════════════════════════
export const Template_Cinematic = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0f172a' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '58%', ...imgBg(d.bgImageUrl, d.bgImagePosition), background: d.bgImageUrl ? undefined : `linear-gradient(135deg, #1e293b, #0f172a)` }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(80 * s), background: 'linear-gradient(0deg, #0f172a 0%, transparent 100%)' }} />
        <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s), zIndex: 2 }}>
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(4 * s), background: `linear-gradient(90deg, ${acc}, ${acc}88)` }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '44%', padding: `${Math.round(12 * s)}px ${Math.round(28 * s)}px ${Math.round(48 * s)}px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: Math.round(36 * s), fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', margin: `${Math.round(8 * s)}px 0` }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}</div>
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.7)', fontWeight: (d.subtitleBold ? 900 : 400), lineHeight: 1.4, marginBottom: Math.round(10 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 90)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), marginBottom: Math.round(14 * s) }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${acc}44`, color: '#e2e8f0', fontSize: Math.round(11 * s), fontWeight: 600, padding: `${Math.round(5 * s)}px ${Math.round(12 * s)}px`, borderRadius: Math.round(20 * s) }}>{trunc(b, 28)}</div>
          ))}
        </div>
        <PillBtn label={d.cta || 'VER MÁS'} bg1={acc} bg2={acc + 'cc'} color="#000" s={s} style={{ fontSize: Math.round(13 * s), alignSelf: 'flex-start' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: Math.round(13 * s), letterSpacing: '0.05em' }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: WHITE CARD EDITORIAL
// ═══════════════════════════════════════════════════════════════
export const Template_WhiteCard = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#3b82f6';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#f8fafc' }}>
      <div style={{ height: Math.round(5 * s), background: `linear-gradient(90deg, ${acc}, ${acc}88)` }} />
      <div style={{ padding: `${Math.round(12 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#0f172a" s={s} />
      </div>
      <div style={{ margin: `${Math.round(16 * s)}px ${Math.round(20 * s)}px 0`, borderRadius: Math.round(16 * s), overflow: 'hidden', height: Math.round(210 * s), position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}, ${acc}88)` }} />
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(60 * s), background: 'linear-gradient(0deg, rgba(248,250,252,0.9), transparent)' }} />
      </div>
      <div style={{ padding: `${Math.round(16 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s) }}>
        <div style={{ fontSize: Math.round(34 * s), fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 30)}</div>
        <div style={{ height: Math.round(4 * s), width: Math.round(60 * s), background: acc, borderRadius: Math.round(2 * s) }} />
        <div style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: '#475569', fontWeight: (d.subtitleBold ? 900 : 400), lineHeight: 1.5 }}>{trunc(d.subtitle || '', 100)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(4 * s)}px ${Math.round(8 * s)}px`, marginTop: Math.round(4 * s) }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'cc'} color="#fff" s={s} style={{ marginTop: Math.round(8 * s), textAlign: 'center', fontSize: Math.round(13 * s) }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(36 * s), background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(12 * s) }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''} {d.website ? `· ${d.website}` : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4: MAGAZINE DARK
// ═══════════════════════════════════════════════════════════════
export const Template_Magazine = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#ef4444';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', display: 'flex' }}>
      <div style={{ width: '48%', background: '#09090f', display: 'flex', flexDirection: 'column', padding: `${Math.round(24 * s)}px ${Math.round(20 * s)}px`, boxSizing: 'border-box', position: 'relative', zIndex: 2 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: Math.round(5 * s), background: `linear-gradient(180deg, ${acc}, ${acc}44)` }} />
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS'} color={acc} s={s} />
        <div style={{ height: 1, background: `${acc}44`, margin: `${Math.round(12 * s)}px 0` }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {title.split(' ').slice(0, 4).map((w, i) => (
            <div key={i} style={{ fontSize: Math.round((i === 0 ? 54 : i === 1 ? 48 : 38) * s), fontWeight: 900, color: i === 1 ? acc : '#fff', lineHeight: 1.0, letterSpacing: '-0.03em' }}>{w}</div>
          ))}
        </div>
        <div style={{ height: Math.round(3 * s), background: acc, margin: `${Math.round(12 * s)}px 0`, width: '40%' }} />
        <div style={{ fontSize: Math.round(11 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: Math.round(14 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 80)}</div>
        <div style={{ marginBottom: Math.round(14 * s) }}>{(d.beneficios || []).slice(0, 3).map((b, i) => <BenRow key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}</div>
        <PillBtn label={d.cta || 'MÁS INFO'} bg1={acc} bg2={acc + 'bb'} color="#fff" s={s} style={{ fontSize: Math.round(12 * s), padding: `${Math.round(12 * s)}px ${Math.round(16 * s)}px` }} />
        <div style={{ marginTop: Math.round(10 * s), fontSize: Math.round(11 * s), color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', objectPosition: imgObjPos(d.bgImagePosition) }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, #0f172a)` }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%', background: 'linear-gradient(90deg, #09090f, transparent)' }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5: CENTER GRADIENT
// ═══════════════════════════════════════════════════════════════
export const Template_CenterGradient = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#7c3aed';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: `linear-gradient(160deg, ${acc} 0%, ${acc}88 50%, #08031a 100%)` }}>
      <div style={{ padding: `${Math.round(16 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS'} color="#fff" s={s} />
        <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: Math.round(20 * s), padding: `${Math.round(5 * s)}px ${Math.round(14 * s)}px`, fontSize: Math.round(11 * s), fontWeight: 800, color: '#fff' }}>★ PREMIUM</div>
      </div>
      <div style={{ margin: `${Math.round(8 * s)}px ${Math.round(28 * s)}px`, borderRadius: Math.round(20 * s), overflow: 'hidden', height: Math.round(220 * s), boxShadow: '0 20px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
        {d.bgImageUrl ? <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.1)' }} />}
      </div>
      <div style={{ padding: `${Math.round(16 * s)}px ${Math.round(28 * s)}px`, textAlign: 'center' }}>
        <div style={{ fontSize: Math.round(42 * s), fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: '0 4px 16px rgba(0,0,0,0.5)', marginBottom: Math.round(8 * s) }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 25)}</div>
        <div style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.8)', fontWeight: (d.subtitleBold ? 900 : 400), lineHeight: 1.5, marginBottom: Math.round(14 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 80)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: Math.round(8 * s), marginBottom: Math.round(16 * s) }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: Math.round(11 * s), fontWeight: 600, padding: `${Math.round(5 * s)}px ${Math.round(12 * s)}px`, borderRadius: Math.round(20 * s) }}>✓ {trunc(b, 24)}</div>
          ))}
        </div>
        <PillBtn label={d.cta || 'EMPEZAR'} bg1="rgba(255,255,255,0.95)" bg2="rgba(255,255,255,0.75)" color={acc} s={s} style={{ fontSize: Math.round(14 * s), minWidth: Math.round(200 * s) }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(13 * s) }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6: CORPORATE LIGHT
// ═══════════════════════════════════════════════════════════════
export const Template_CorporateLight = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#1e40af';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', display: 'flex', background: '#fff' }}>
      <div style={{ width: '50%', padding: `${Math.round(28 * s)}px ${Math.round(22 * s)}px`, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', borderRight: `${Math.round(4 * s)}px solid ${acc}` }}>
        <div style={{ height: Math.round(4 * s), background: `linear-gradient(90deg, ${acc}, ${acc}44)`, marginBottom: Math.round(18 * s), borderRadius: Math.round(2 * s) }} />
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={acc} s={s} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: Math.round(20 * s) }}>
          <div style={{ fontSize: Math.round(38 * s), fontWeight: 900, color: '#0f172a', lineHeight: 1.05, letterSpacing: '-0.03em', margin: `${Math.round(12 * s)}px 0 ${Math.round(8 * s)}px` }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 22)}</div>
          <div style={{ height: Math.round(4 * s), background: acc, width: Math.round(50 * s), borderRadius: Math.round(2 * s), marginBottom: Math.round(10 * s) }} />
          <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: '#475569', fontWeight: (d.subtitleBold ? 900 : 400), lineHeight: 1.5, marginBottom: Math.round(16 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 100)}</div>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'cc'} color="#fff" s={s} style={{ marginTop: Math.round(12 * s), fontSize: Math.round(12 * s), padding: `${Math.round(12 * s)}px ${Math.round(20 * s)}px` }} />
        <div style={{ marginTop: Math.round(8 * s), fontSize: Math.round(11 * s), color: '#94a3b8', fontWeight: 600 }}>{d.phone}</div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {d.bgImageUrl ? <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, ${acc}22)` }} />}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, #fff, transparent)' }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 7: DARK LUXURY
// ═══════════════════════════════════════════════════════════════
export const Template_DarkLuxury = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#D4AF37';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: 'linear-gradient(160deg, #060612 0%, #0d0d1f 100%)' }}>
      <div style={{ height: Math.round(5 * s), background: `linear-gradient(90deg, ${acc}, ${acc}88)` }} />
      <div style={{ padding: `${Math.round(12 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${acc}22` }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={acc} s={s} />
        <span style={{ fontSize: Math.round(11 * s), color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{d.website || 'www.empresa.com'}</span>
      </div>
      <div style={{ margin: `${Math.round(16 * s)}px ${Math.round(24 * s)}px`, borderRadius: Math.round(16 * s), overflow: 'hidden', height: Math.round(230 * s), border: `${Math.round(2 * s)}px solid ${acc}55`, boxShadow: `0 0 ${Math.round(30 * s)}px ${acc}33`, position: 'relative' }}>
        {d.bgImageUrl ? <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: imgObjPos(d.bgImagePosition) }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', background: `radial-gradient(ellipse, ${acc}22, #060612)` }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #060612 0%, transparent 50%)' }} />
      </div>
      <div style={{ padding: `${Math.round(8 * s)}px ${Math.round(24 * s)}px`, textAlign: 'center' }}>
        <div style={{ fontSize: Math.round(36 * s), fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: Math.round(6 * s) }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 28)}</div>
        <div style={{ height: Math.round(3 * s), width: Math.round(80 * s), background: acc, borderRadius: Math.round(2 * s), margin: `${Math.round(8 * s)}px auto ${Math.round(10 * s)}px` }} />
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: Math.round(14 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 80)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(8 * s), marginBottom: Math.round(16 * s), textAlign: 'left' }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: Math.round(10 * s), background: 'rgba(255,255,255,0.04)', border: `1px solid ${acc}33`, borderRadius: Math.round(10 * s), padding: `${Math.round(8 * s)}px ${Math.round(14 * s)}px` }}>
              <span style={{ color: acc, fontWeight: 900, flexShrink: 0 }}>★</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: Math.round(12 * s), fontWeight: 500 }}>{trunc(b, 42)}</span>
            </div>
          ))}
        </div>
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'bb'} color="#000" s={s} style={{ fontSize: Math.round(13 * s), minWidth: Math.round(220 * s) }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: `linear-gradient(90deg, ${acc}, ${acc}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: Math.round(13 * s), letterSpacing: '0.05em' }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 8: PROMO POP
// ═══════════════════════════════════════════════════════════════
export const Template_PromoPop = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#fff' }}>
      <div style={{ height: Math.round(310 * s), position: 'relative', overflow: 'hidden' }}>
        {d.bgImageUrl ? <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}, ${acc}44)` }} />}
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: Math.round(60 * s), background: '#fff', clipPath: 'polygon(0 60%, 100% 0, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s) }}><Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} /></div>
        <div style={{ position: 'absolute', top: Math.round(12 * s), right: Math.round(20 * s), background: acc, borderRadius: '50%', width: Math.round(80 * s), height: Math.round(80 * s), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${acc}66` }}>
          <div style={{ fontSize: Math.round(22 * s), fontWeight: 900, color: '#000', lineHeight: 1 }}>HOY</div>
          <div style={{ fontSize: Math.round(10 * s), fontWeight: 800, color: '#000' }}>ESPECIAL</div>
        </div>
      </div>
      <div style={{ padding: `${Math.round(4 * s)}px ${Math.round(24 * s)}px ${Math.round(48 * s)}px`, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s) }}>
        <div style={{ fontSize: Math.round(36 * s), fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 28)}</div>
        <div style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: '#64748b', lineHeight: 1.5 }}>{trunc(d.subtitle || '', 90)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(4 * s)}px ${Math.round(8 * s)}px` }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        <PillBtn label={d.cta || 'OBTENER OFERTA'} bg1={acc} bg2={acc + 'cc'} color="#000" s={s} style={{ fontSize: Math.round(13 * s), marginTop: Math.round(8 * s) }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(12 * s) }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 9: MINIMAL EDITORIAL
// ═══════════════════════════════════════════════════════════════
export const Template_MinimalEditorial = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#0ea5e9';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: Math.round(300 * s), position: 'relative', overflow: 'hidden' }}>
        {d.bgImageUrl ? <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, ${acc}22)` }} />}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, #fff 0%, transparent 40%)` }} />
        <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s) }}><Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} /></div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(4 * s), background: acc }} />
      </div>
      <div style={{ flex: 1, padding: `${Math.round(8 * s)}px ${Math.round(24 * s)}px ${Math.round(44 * s)}px`, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s) }}>
        <div style={{ fontSize: Math.round(38 * s), fontWeight: 900, color: acc, lineHeight: 1.1, letterSpacing: '-0.03em' }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 28)}</div>
        <div style={{ height: Math.round(3 * s), background: acc, width: Math.round(50 * s), borderRadius: Math.round(2 * s) }} />
        <div style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: '#64748b', lineHeight: 1.5 }}>{trunc(d.subtitle || '', 100)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(4 * s)}px ${Math.round(8 * s)}px`, flex: 1 }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        <PillBtn label={d.cta || 'SABER MÁS'} bg1={acc} bg2={acc + 'bb'} color="#fff" s={s} style={{ fontSize: Math.round(13 * s), marginTop: Math.round(4 * s) }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(36 * s), background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(12 * s) }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}{d.website ? ` · ${d.website}` : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 10: FULL BLEED BOLD
// ═══════════════════════════════════════════════════════════════
export const Template_FullBleedBold = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#22d3ee';
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box' }}>
      {d.bgImageUrl ? (
        <img src={d.bgImageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: imgObjPos(d.bgImagePosition) }} crossOrigin="anonymous" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${acc}44, #0f172a)` }} />
      )}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(100 * s), background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%', background: `linear-gradient(0deg, rgba(0,0,0,0.96) 60%, transparent 100%)` }} />
      <div style={{ position: 'absolute', left: 0, top: '52%', bottom: 0, width: Math.round(5 * s), background: acc }} />
      <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s), right: Math.round(20 * s), display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
      </div>
      <div style={{ position: 'absolute', bottom: Math.round(38 * s), left: Math.round(20 * s), right: Math.round(20 * s), zIndex: 5 }}>
        <div style={{ fontSize: Math.round(46 * s), fontWeight: 900, color: '#fff', lineHeight: 1.0, letterSpacing: '-0.03em', textShadow: '0 4px 20px rgba(0,0,0,0.8)', marginBottom: Math.round(8 * s) }}>{trunc((d.title || 'TU OFERTA').toUpperCase(), 25)}</div>
        <div style={{ height: Math.round(3 * s), background: acc, width: Math.round(60 * s), borderRadius: Math.round(2 * s), marginBottom: Math.round(10 * s) }} />
        <div style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: Math.round(12 * s * (d.subtitleScale ?? 1)) }}>{trunc(d.subtitle || '', 80)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), marginBottom: Math.round(14 * s) }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${acc}55`, color: '#fff', fontSize: Math.round(11 * s), fontWeight: 600, padding: `${Math.round(4 * s)}px ${Math.round(10 * s)}px`, borderRadius: Math.round(16 * s) }}>✓ {trunc(b, 22)}</div>
          ))}
        </div>
        <PillBtn label={d.cta || 'VER MÁS'} bg1={acc} bg2={acc + 'bb'} color="#000" s={s} style={{ fontSize: Math.round(13 * s) }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(36 * s), background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: Math.round(12 * s), letterSpacing: '0.04em' }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ' · ' : ''}</span>
      </div>
    </div>
  );
};

// ─── TEMPLATE REGISTRY ────────────────────────────────────────────────────────
export const TEMPLATES: Record<string, React.ComponentType<{ d: FlyerData }>> = {
  'bold-split': Template_BoldSplit,
  'cinematic': Template_Cinematic,
  'white-card': Template_WhiteCard,
  'magazine': Template_Magazine,
  'center-gradient': Template_CenterGradient,
  'corporate-light': Template_CorporateLight,
  'dark-luxury': Template_DarkLuxury,
  'promo-pop': Template_PromoPop,
  'minimal-editorial': Template_MinimalEditorial,
  'full-bleed': Template_FullBleedBold,
};

// Lazy forward ref so RenderFlyer can reference TEMPLATES
Object.assign(RenderFlyer, {});

export const TEMPLATE_LIST = [
  { id: 'bold-split',        name: '1. Split Asimétrico Bold',      desc: 'Panel color + foto, texto masivo' },
  { id: 'cinematic',         name: '2. Cinematic Full',             desc: 'Foto top, panel oscuro info' },
  { id: 'white-card',        name: '3. White Card Editorial',       desc: 'Blanco limpio, foto redondeada' },
  { id: 'magazine',          name: '4. Magazine Dark',              desc: 'Editorial tipo Forbes/Vogue' },
  { id: 'center-gradient',   name: '5. Gradient Center Pop',        desc: 'Gradiente vibrante, centrado' },
  { id: 'corporate-light',   name: '6. Corporate Light',            desc: 'B2B profesional, blanco/color' },
  { id: 'dark-luxury',       name: '7. Dark Luxury Gold',           desc: 'Oscuro premium, marco dorado' },
  { id: 'promo-pop',         name: '8. Promo Pop',                  desc: 'Oferta specials, energético' },
  { id: 'minimal-editorial', name: '9. Minimal Editorial',          desc: 'Clean, tipografía grande' },
  { id: 'full-bleed',        name: '10. Full Bleed Bold',           desc: 'Foto completa, texto panel' },
];
