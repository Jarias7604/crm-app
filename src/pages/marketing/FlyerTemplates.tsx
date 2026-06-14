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
        <svg width={Math.round(12 * s)} height={Math.round(12 * s)} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.8 9.5L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
        <svg width={Math.round(12 * s)} height={Math.round(12 * s)} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.8 9.5L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
      <div style={{ width: '100%', height: '100%', backgroundImage: `url(${d.logoUrl})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', borderRadius: 8, pointerEvents: 'none' }} />
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

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: BOLD SPLIT — color panel left, photo right (Glassmorphic)
// ═══════════════════════════════════════════════════════════════
export const Template_BoldSplit = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#1a56db';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box' }}>
      {/* Background Image / Gradient */}
      {isBg ? (
        <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${acc} 0%, ${acc}cc 100%)` }} />
      )}
      
      {/* Left panel glass overlay */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: '52%', height: '100%',
        background: isBg ? 'rgba(15, 23, 42, 0.4)' : `linear-gradient(160deg, ${acc} 0%, ${acc}cc 100%)`,
        backdropFilter: isBg ? 'blur(12px)' : 'none',
        borderRight: isBg ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
        zIndex: 2
      }} />

      {/* Text overlays */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '52%', height: '100%', padding: `${Math.round(28 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', zIndex: 4, boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), margin: 'auto 0' }}>
          <h1 style={{ fontSize: Math.round(28 * s), fontWeight: 900, color: '#fff', lineHeight: 1.15, textShadow: '0 4px 12px rgba(0,0,0,0.3)', letterSpacing: '-0.02em', margin: 0 }}>
            {title}
          </h1>
          <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 900 : 500), lineHeight: 1.4 }}>
            {trunc(d.subtitle || '', 120)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(10 * s) }}>
          <div style={{ marginBottom: Math.round(6 * s) }}>
            {(d.beneficios || []).slice(0, 3).map((b, i) => <BenRow key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
          </div>
          <PillBtn label={d.cta || 'CONTACTAR'} bg1="#fff" bg2="rgba(255,255,255,0.85)" color={isBg ? '#0f172a' : acc} s={s} style={{ fontSize: Math.round(12 * s), padding: `${Math.round(12 * s)}px ${Math.round(20 * s)}px`, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>
      
      {/* Footer phone & website bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(40 * s), background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(13 * s), letterSpacing: '0.04em' }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: CINEMATIC FULL (Glassmorphic Card Bottom)
// ═══════════════════════════════════════════════════════════════
export const Template_Cinematic = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0f172a' }}>
      {/* Background Image / Gradient */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition), background: d.bgImageUrl ? undefined : `linear-gradient(135deg, #1e293b, #0f172a)` }} />
      
      {/* Top Brand bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(60 * s), background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)', display: 'flex', alignItems: 'center', paddingLeft: Math.round(20 * s), zIndex: 10 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(4 * s), background: `linear-gradient(90deg, ${acc}, ${acc}88)`, zIndex: 11 }} />

      {/* Bottom Panel */}
      <div style={{ 
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '44%', 
        padding: `${Math.round(14 * s)}px ${Math.round(24 * s)}px ${Math.round(48 * s)}px`, 
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column', 
        justifyContent: 'space-between', zIndex: 5,
        background: isBg ? 'rgba(15, 23, 42, 0.4)' : '#0f172a',
        backdropFilter: isBg ? 'blur(12px)' : 'none',
        borderTop: isBg ? '1px solid rgba(255, 255, 255, 0.15)' : 'none'
      }}>
        <div style={{ fontSize: Math.round(28 * s), fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 50)}
        </div>
        <div style={{ fontSize: Math.round(11 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.75)', fontWeight: (d.subtitleBold ? 900 : 400), lineHeight: 1.4 }}>
          {trunc(d.subtitle || '', 120)}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s) }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${acc}44`, color: '#f1f5f9', fontSize: Math.round(10 * s), fontWeight: 600, padding: `${Math.round(5 * s)}px ${Math.round(10 * s)}px`, borderRadius: Math.round(20 * s) }}>
              {trunc(b, 32)}
            </div>
          ))}
        </div>
        
        <PillBtn label={d.cta || 'VER MÁS'} bg1={acc} bg2={acc + 'cc'} color="#000" s={s} style={{ fontSize: Math.round(12 * s), alignSelf: 'flex-start', padding: `${Math.round(10 * s)}px ${Math.round(24 * s)}px` }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: Math.round(13 * s), letterSpacing: '0.05em' }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: WHITE CARD EDITORIAL (Floating White Glass)
// ═══════════════════════════════════════════════════════════════
export const Template_WhiteCard = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#3b82f6';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#f8fafc' }}>
      {/* Background Image / fallback */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition), background: d.bgImageUrl ? undefined : `linear-gradient(135deg, #f1f5f9, #e2e8f0)` }} />
      
      {/* Top Header Row */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(12 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isBg ? 'rgba(255, 255, 255, 0.8)' : '#fff', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', backdropFilter: isBg ? 'blur(10px)' : 'none', zIndex: 10 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#0f172a" s={s} />
      </div>

      {/* Floating glass content card overlay */}
      <div style={{ 
        position: 'absolute',
        left: Math.round(20 * s),
        right: Math.round(20 * s),
        bottom: Math.round(56 * s),
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        borderRadius: Math.round(16 * s),
        border: '1px solid rgba(255, 255, 255, 0.4)',
        padding: `${Math.round(16 * s)}px ${Math.round(20 * s)}px`,
        boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(8 * s)
      }}>
        <div style={{ fontSize: Math.round(26 * s), fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        <div style={{ height: Math.round(3 * s), width: Math.round(50 * s), background: acc, borderRadius: Math.round(2 * s) }} />
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: '#334155', fontWeight: (d.subtitleBold ? 900 : 500), lineHeight: 1.4 }}>
          {trunc(d.subtitle || '', 120)}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(4 * s)}px ${Math.round(8 * s)}px`, margin: `${Math.round(4 * s)}px 0` }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'cc'} color="#fff" s={s} style={{ marginTop: Math.round(4 * s), textAlign: 'center', fontSize: Math.round(13 * s) }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(12 * s) }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4: MAGAZINE DARK (Editorial Glassmorphism)
// ═══════════════════════════════════════════════════════════════
export const Template_Magazine = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#ef4444';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', display: 'flex' }}>
      {/* Background Image / Fallback */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {d.bgImageUrl ? (
          <div style={{ width: '100%', height: '100%', ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, #0f172a)` }} />
        )}
        {isBg && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(9,9,15,0.4), transparent)' }} />}
      </div>

      {/* Left panel glass overlay */}
      <div style={{ 
        width: '48%', 
        background: isBg ? 'rgba(9, 9, 15, 0.4)' : '#09090f', 
        backdropFilter: isBg ? 'blur(12px)' : 'none',
        borderRight: isBg ? '1px solid rgba(255,255,255,0.15)' : 'none',
        display: 'flex', flexDirection: 'column', 
        padding: `${Math.round(24 * s)}px ${Math.round(20 * s)}px`, 
        boxSizing: 'border-box', position: 'relative', zIndex: 2,
        justifyContent: 'space-between'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: Math.round(5 * s), background: `linear-gradient(180deg, ${acc}, ${acc}44)` }} />
        
        <div>
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS'} color={acc} s={s} />
          <div style={{ height: 1, background: `${acc}44`, margin: `${Math.round(12 * s)}px 0` }} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(8 * s), margin: 'auto 0' }}>
          <h1 style={{ fontSize: Math.round(28 * s), fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0 }}>
            {title}
          </h1>
          <div style={{ height: Math.round(3 * s), background: acc, width: '40%' }} />
          <div style={{ fontSize: Math.round(11 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            {trunc(d.subtitle || '', 100)}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(12 * s) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(4 * s) }}>
            {(d.beneficios || []).slice(0, 3).map((b, i) => <BenRow key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
          </div>
          <PillBtn label={d.cta || 'MÁS INFO'} bg1={acc} bg2={acc + 'bb'} color="#fff" s={s} style={{ fontSize: Math.round(12 * s), padding: `${Math.round(10 * s)}px ${Math.round(16 * s)}px` }} />
          
          <div style={{ fontSize: Math.round(11 * s), color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5: CENTER GRADIENT (Glassmorphic Center Card)
// ═══════════════════════════════════════════════════════════════
export const Template_CenterGradient = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#7c3aed';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: `linear-gradient(160deg, ${acc} 0%, ${acc}88 50%, #08031a 100%)` }}>
      {/* Background Image / fallback */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      {isBg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(8, 3, 26, 0.35)' }} />}

      {/* Top Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(16 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS'} color="#fff" s={s} />
        <div style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: Math.round(20 * s), padding: `${Math.round(5 * s)}px ${Math.round(14 * s)}px`, fontSize: Math.round(11 * s), fontWeight: 800, color: '#fff' }}>★ PREMIUM</div>
      </div>

      {/* Centered glass card */}
      <div style={{ 
        position: 'absolute',
        top: '52%',
        left: Math.round(24 * s),
        right: Math.round(24 * s),
        transform: 'translateY(-50%)',
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: Math.round(20 * s),
        padding: `${Math.round(24 * s)}px ${Math.round(20 * s)}px`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        textAlign: 'center',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(10 * s)
      }}>
        <div style={{ fontSize: Math.round(32 * s), fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 900 : 400), lineHeight: 1.5 }}>
          {trunc(d.subtitle || '', 100)}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: Math.round(8 * s), margin: `${Math.round(4 * s)}px 0` }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: Math.round(11 * s), fontWeight: 600, padding: `${Math.round(5 * s)}px ${Math.round(12 * s)}px`, borderRadius: Math.round(20 * s) }}>
              ✓ {trunc(b, 28)}
            </div>
          ))}
        </div>
        
        <PillBtn label={d.cta || 'EMPEZAR'} bg1="rgba(255,255,255,0.98)" bg2="rgba(255,255,255,0.85)" color={acc} s={s} style={{ fontSize: Math.round(13 * s), minWidth: Math.round(180 * s), alignSelf: 'center' }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(13 * s) }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6: CORPORATE LIGHT (HubSpot Style light glass)
// ═══════════════════════════════════════════════════════════════
export const Template_CorporateLight = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#1e40af';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', display: 'flex', background: '#fff' }}>
      {/* Background Image */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {d.bgImageUrl ? <div style={{ width: '100%', height: '100%', ...imgBg(d.bgImageUrl, d.bgImagePosition) }} /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, ${acc}22)` }} />}
        {isBg && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.3), transparent)' }} />}
      </div>

      {/* Left panel light glassmorphism */}
      <div style={{ 
        width: '50%', 
        padding: `${Math.round(24 * s)}px ${Math.round(20 * s)}px`, 
        display: 'flex', flexDirection: 'column', 
        boxSizing: 'border-box', 
        borderRight: `${Math.round(4 * s)}px solid ${acc}`,
        background: isBg ? 'rgba(255, 255, 255, 0.78)' : '#fff',
        backdropFilter: isBg ? 'blur(20px)' : 'none',
        zIndex: 2,
        justifyContent: 'space-between'
      }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={acc} s={s} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(8 * s), margin: 'auto 0' }}>
          <h1 style={{ fontSize: Math.round(28 * s), fontWeight: 900, color: '#0f172a', lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0 }}>
            {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
          </h1>
          <div style={{ height: Math.round(3 * s), background: acc, width: Math.round(50 * s), borderRadius: Math.round(2 * s) }} />
          <div style={{ fontSize: Math.round(11 * s * (d.subtitleScale ?? 1)), color: '#334155', fontWeight: (d.subtitleBold ? 900 : 500), lineHeight: 1.4 }}>
            {trunc(d.subtitle || '', 120)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(10 * s) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(4 * s) }}>
            {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
          </div>
          <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'cc'} color="#fff" s={s} style={{ fontSize: Math.round(12 * s), padding: `${Math.round(12 * s)}px ${Math.round(20 * s)}px` }} />
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>
            {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 7: DARK LUXURY (Gold Framing and Glass)
// ═══════════════════════════════════════════════════════════════
export const Template_DarkLuxury = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#D4AF37';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: 'linear-gradient(160deg, #060612 0%, #0d0d1f 100%)' }}>
      {/* Background Image / Gradient */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition), background: d.bgImageUrl ? undefined : `linear-gradient(160deg, #060612 0%, #0d0d1f 100%)` }} />
      {isBg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(4 * s), background: `linear-gradient(90deg, ${acc}, ${acc}88)`, zIndex: 11 }} />
      
      {/* Header Row */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(14 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${acc}22`, background: 'rgba(0,0,0,0.4)', zIndex: 10 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={acc} s={s} />
        <span style={{ fontSize: Math.round(11 * s), color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{d.website || 'www.empresa.com'}</span>
      </div>

      {/* Floating glass content card with gold border */}
      <div style={{ 
        position: 'absolute',
        top: '52%',
        left: Math.round(24 * s),
        right: Math.round(24 * s),
        transform: 'translateY(-50%)',
        background: 'rgba(6, 6, 18, 0.5)',
        backdropFilter: 'blur(12px)',
        border: `${Math.round(2 * s)}px solid ${acc}`,
        boxShadow: `0 10px 40px ${acc}22`,
        borderRadius: Math.round(16 * s),
        padding: `${Math.round(20 * s)}px ${Math.round(20 * s)}px`,
        textAlign: 'center',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(8 * s)
      }}>
        <div style={{ fontSize: Math.round(30 * s), fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        <div style={{ height: Math.round(3 * s), width: Math.round(60 * s), background: acc, borderRadius: Math.round(2 * s), margin: `${Math.round(4 * s)}px auto` }} />
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {trunc(d.subtitle || '', 100)}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(6 * s), margin: `${Math.round(6 * s)}px 0`, textAlign: 'left' }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: Math.round(8 * s), background: 'rgba(255,255,255,0.04)', border: `1px solid ${acc}22`, borderRadius: Math.round(8 * s), padding: `${Math.round(6 * s)}px ${Math.round(12 * s)}px` }}>
              <span style={{ color: acc, fontWeight: 900, flexShrink: 0 }}>★</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: Math.round(11 * s), fontWeight: 500 }}>{trunc(b, 48)}</span>
            </div>
          ))}
        </div>
        
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'bb'} color="#000" s={s} style={{ fontSize: Math.round(13 * s), minWidth: Math.round(180 * s), alignSelf: 'center' }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: `linear-gradient(90deg, ${acc}, ${acc}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: Math.round(13 * s), letterSpacing: '0.05em' }}>
          {d.phone || '+503 7XXX-XXXX'}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 8: PROMO POP (Promo Special Glass)
// ═══════════════════════════════════════════════════════════════
export const Template_PromoPop = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#fff' }}>
      {/* Background Image / Gradient */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition), background: d.bgImageUrl ? undefined : `linear-gradient(135deg, ${acc}, ${acc}44)` }} />
      
      {/* Top Header info */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(16 * s)}px ${Math.round(20 * s)}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
        <div style={{ background: acc, borderRadius: '50%', width: Math.round(64 * s), height: Math.round(64 * s), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${acc}66` }}>
          <div style={{ fontSize: Math.round(18 * s), fontWeight: 900, color: '#000', lineHeight: 1 }}>HOY</div>
          <div style={{ fontSize: Math.round(9 * s), fontWeight: 800, color: '#000' }}>OFERTA</div>
        </div>
      </div>

      {/* Glass card overlay */}
      <div style={{ 
        position: 'absolute',
        left: Math.round(20 * s),
        right: Math.round(20 * s),
        bottom: Math.round(52 * s),
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        borderRadius: Math.round(16 * s),
        border: '1px solid rgba(255, 255, 255, 0.4)',
        padding: `${Math.round(16 * s)}px ${Math.round(20 * s)}px`,
        boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(6 * s)
      }}>
        <div style={{ fontSize: Math.round(28 * s), fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: '#334155', lineHeight: 1.4 }}>
          {trunc(d.subtitle || '', 120)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(4 * s)}px ${Math.round(8 * s)}px`, margin: `${Math.round(4 * s)}px 0` }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        <PillBtn label={d.cta || 'OBTENER OFERTA'} bg1={acc} bg2={acc + 'cc'} color="#000" s={s} style={{ fontSize: Math.round(12 * s), marginTop: Math.round(4 * s) }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(12 * s) }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 9: MINIMAL EDITORIAL (Elegant Typography and Translucency)
// ═══════════════════════════════════════════════════════════════
export const Template_MinimalEditorial = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#0ea5e9';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Background Image / fallback */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition), background: d.bgImageUrl ? undefined : `linear-gradient(135deg, ${acc}22, #fff)` }} />
      
      {/* Brand logo top left */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(16 * s)}px ${Math.round(20 * s)}px`, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={isBg ? "#fff" : "#0f172a"} s={s} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(4 * s), background: acc, zIndex: 11 }} />

      {/* Floating glass content panel */}
      <div style={{ 
        position: 'absolute',
        left: Math.round(20 * s),
        right: Math.round(20 * s),
        bottom: Math.round(52 * s),
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        borderRadius: Math.round(16 * s),
        border: '1px solid rgba(255, 255, 255, 0.4)',
        padding: `${Math.round(16 * s)}px ${Math.round(20 * s)}px`,
        boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(8 * s)
      }}>
        <div style={{ fontSize: Math.round(30 * s), fontWeight: 900, color: acc, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        <div style={{ height: Math.round(3 * s), background: acc, width: Math.round(50 * s), borderRadius: Math.round(2 * s) }} />
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: '#475569', lineHeight: 1.4 }}>
          {trunc(d.subtitle || '', 120)}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(4 * s)}px ${Math.round(8 * s)}px`, margin: `${Math.round(4 * s)}px 0` }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} scale={d.benefitsScale ?? 1} bold={!!d.benefitsBold} color={acc} s={s} />)}
        </div>
        
        <PillBtn label={d.cta || 'SABER MÁS'} bg1={acc} bg2={acc + 'bb'} color="#fff" s={s} style={{ fontSize: Math.round(12 * s), marginTop: Math.round(4 * s) }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(36 * s), background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: Math.round(12 * s) }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 10: FULL BLEED BOLD (Polished High Contrast and Bottom Overlay)
// ═══════════════════════════════════════════════════════════════
export const Template_FullBleedBold = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#22d3ee';
  const isBg = !!d.bgImageUrl;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box' }}>
      {/* Background Image / fallback */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: imgObjPos(d.bgImagePosition) }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg, ${acc}44, #0f172a)` }} />
        )}
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(100 * s), background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)', zIndex: 2 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%', background: `linear-gradient(0deg, rgba(15, 23, 42, 0.75) 40%, rgba(15, 23, 42, 0.45) 80%, transparent 100%)`, zIndex: 2 }} />
      <div style={{ position: 'absolute', left: 0, top: '48%', bottom: 0, width: Math.round(5 * s), background: acc, zIndex: 3 }} />
      
      {/* Brand logo top left */}
      <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s), right: Math.round(20 * s), display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" s={s} />
      </div>

      {/* Floating details overlay on bottom */}
      <div style={{ 
        position: 'absolute', 
        bottom: Math.round(54 * s), 
        left: Math.round(20 * s), 
        right: Math.round(20 * s), 
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(8 * s)
      }}>
        <div style={{ fontSize: Math.round(36 * s), fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        <div style={{ height: Math.round(3 * s), background: acc, width: Math.round(60 * s), borderRadius: Math.round(2 * s) }} />
        <div style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          {trunc(d.subtitle || '', 120)}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0` }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${acc}55`, color: '#fff', fontSize: Math.round(10 * s), fontWeight: 600, padding: `${Math.round(4 * s)}px ${Math.round(10 * s)}px`, borderRadius: Math.round(16 * s) }}>
              ✓ {trunc(b, 26)}
            </div>
          ))}
        </div>
        
        <PillBtn label={d.cta || 'VER MÁS'} bg1={acc} bg2={acc + 'bb'} color="#000" s={s} style={{ fontSize: Math.round(12 * s), alignSelf: 'flex-start', padding: `${Math.round(10 * s)}px ${Math.round(24 * s)}px` }} />
      </div>

      {/* Footer bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(38 * s), background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: Math.round(12 * s), letterSpacing: '0.04em' }}>
          {d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 11: DIRECT MOCKUP (pure image, no overlays)
// ═══════════════════════════════════════════════════════════════
export const Template_DirectMockup = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      {d.bgImageUrl ? (
        <img src={d.bgImageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1e293b, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>Sube tu flyer diseñado o genera una imagen de fondo con IA</div>
        </div>
      )}
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
  'direct-mockup': Template_DirectMockup,
};

// Lazy forward ref so RenderFlyer can reference TEMPLATES
Object.assign(RenderFlyer, {});

export const TEMPLATE_LIST = [
  { id: 'direct-mockup', name: '0. Mockup Directo (Imagen Pura)', desc: 'Muestra la imagen al 100% sin textos encima' },
  { id: 'bold-split', name: '1. Split Asimétrico Bold', desc: 'Panel color + foto, texto masivo' },
  { id: 'cinematic', name: '2. Cinematic Full', desc: 'Foto top, panel oscuro info' },
  { id: 'white-card', name: '3. White Card Editorial', desc: 'Blanco limpio, foto redondeada' },
  { id: 'magazine', name: '4. Magazine Dark', desc: 'Editorial tipo Forbes/Vogue' },
  { id: 'center-gradient', name: '5. Gradient Center Pop', desc: 'Gradiente vibrante, centrado' },
  { id: 'corporate-light', name: '6. Corporate Light', desc: 'B2B profesional, blanco/color' },
  { id: 'dark-luxury', name: '7. Dark Luxury Gold', desc: 'Oscuro premium, marco dorado' },
  { id: 'promo-pop', name: '8. Promo Pop', desc: 'Oferta specials, energético' },
  { id: 'minimal-editorial', name: '9. Minimal Editorial', desc: 'Clean, tipografía grande' },
  { id: 'full-bleed', name: '10. Full Bleed Bold', desc: 'Foto completa, texto panel' },
];
