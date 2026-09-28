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
  companyName?: string;
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
  highlightColor?: string;
  subtitleScale?: number;
  subtitleBold?: boolean;
  benefitsScale?: number;
  benefitsBold?: boolean;
  ctaGradient?: boolean;
  flyerFont?: string;
  titleColor?: string;
  subtitleColor?: string;
  benefitsColor?: string;
  cardBgColor?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  textY?: number;
  textAlign?: 'left' | 'center' | 'right';
  onTitleClick?: () => void;
  onSubtitleClick?: () => void;
  onBenefitsClick?: () => void;
  onCtaClick?: () => void;
  onLogoClick?: () => void;
  onBgClick?: () => void;
  titleScale?: number;
  titleX?: number;
  titleY?: number;
  subtitleX?: number;
  subtitleY?: number;
  benefitsX?: number;
  benefitsY?: number;
  ctaScale?: number;
  ctaX?: number;
  ctaY?: number;
  contactScale?: number;
  contactX?: number;
  contactY?: number;
  contactColor?: string;
  onContactClick?: () => void;
  titleFont?: string;
  subtitleFont?: string;
  benefitsFont?: string;
  ctaFont?: string;
  contactFont?: string;
  // New properties for modern templates
  gradientBg?: string;
  gradColor1?: string;
  gradColor2?: string;
  gradColor3?: string;
  bgType?: 'photo' | 'gradient';
  badgeTextTop?: string;
  badgeTextBottom?: string;
}

// ─── PHOTO HELPERS ────────────────────────────────────────────────────────────
export const imgBg = (url: string | null | undefined, pos?: { x: number; y: number }): React.CSSProperties => ({
  backgroundImage: url ? `url('${url}')` : undefined,
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
  lk.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Montserrat:wght@400;600;700;800;900&family=Oswald:wght@500;700&family=Poppins:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600;1,700&family=Bebas+Neue&family=Raleway:wght@400;600;700;900&family=Inter:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(lk);
}

// ─── SCALE FACTOR ─────────────────────────────────────────────────────────────
const getScale = (w: number, h: number) => Math.min(w / 540, h / 675);
const getFontScale = (w: number, h: number, ts: number) => getScale(w, h) * ts;

const trunc = (s: string, n: number) => s?.length > n ? s.slice(0, n - 1) + '…' : (s || '');

// Clean raw tags or long lists from subtitles
export const cleanSubtitle = (s?: string) => {
  if (!s) return '';
  return s
    .replace(/(?:incluye|ofrece|beneficios|caracter[íi]sticas|cta|bot[oó]n|precio|costo|tel[eé]fono|contacto|whatsapp|web|sitio)\s*[:：][\s\S]*$/i, '')
    .trim();
};

// ─── MODERN SHARED COMPONENTS ─────────────────────────────────────────────────

export const PillBtn = ({ label, bg1, bg2, color = '#fff', style = {}, s = 1 }: {
  label: string; bg1: string; bg2: string; color?: string; style?: React.CSSProperties; s?: number;
}) => (
  <div style={{
    background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
    color, fontWeight: 900, fontSize: Math.round(13 * s),
    letterSpacing: '0.04em', borderRadius: 999,
    padding: `${Math.round(11 * s)}px ${Math.round(24 * s)}px`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(6 * s),
    boxShadow: `0 ${Math.round(6 * s)}px ${Math.round(20 * s)}px -4px ${bg1}66`,
    textAlign: 'center', textTransform: 'uppercase', cursor: 'pointer', ...style,
  }}>
    <span>{label}</span>
    <span style={{ fontSize: Math.round(13 * s), opacity: 0.9 }}>➔</span>
  </div>
);

export const BenChip = ({ text, color = '#38bdf8', gradient, s = 1, isDark = true, bold = false }: {
  text: string; color?: string; gradient?: string; s?: number; isDark?: boolean; bold?: boolean;
}) => {
  if (!text) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: Math.round(6 * s),
      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(15,23,42,0.12)',
      borderRadius: Math.round(8 * s),
      padding: `${Math.round(5 * s)}px ${Math.round(10 * s)}px`,
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: Math.round(11 * s),
      fontWeight: bold ? 800 : 600,
      lineHeight: 1.3
    }}>
      <span style={{
        background: gradient || color,
        WebkitBackgroundClip: gradient ? 'text' : undefined,
        WebkitTextFillColor: gradient ? 'transparent' : undefined,
        color: gradient ? undefined : color,
        fontWeight: 900,
        fontSize: Math.round(12 * s)
      }}>✓</span>
      <span>{text.replace(/^[✓\s*+•-]+/, '').trim()}</span>
    </div>
  );
};

export const Brand = ({ logo, name, color = '#fff', s = 1, forceText = false }: {
  logo: string | null; name?: string; color?: string; s?: number; forceText?: boolean;
}) => {
  const brandName = name && name !== 'auto' && name !== 'Mi Empresa' && !name.includes('ARIAS') ? name : 'Iclesia';
  if (logo && !forceText) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <img src={logo} alt="Logo" style={{ maxHeight: Math.round(44 * s), maxWidth: Math.round(160 * s), objectFit: 'contain' }} crossOrigin="anonymous" />
      </div>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(8 * s) }}>
      <div style={{
        width: Math.round(26 * s), height: Math.round(26 * s), borderRadius: Math.round(6 * s),
        background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.08))',
        backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: Math.round(12 * s), color
      }}>
        {brandName.charAt(0).toUpperCase()}
      </div>
      <span style={{ fontSize: Math.round(12 * s), fontWeight: 800, color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {trunc(brandName, 24)}
      </span>
    </div>
  );
};

// ─── GOLDEN STARBURST TRUST SEAL (Exact match to Fotos 2 & 3) ───────────────────
export const GoldenSeal = ({ textTop = '+600', textBottom = 'CLIENTES SATISFECHOS', s = 1, style = {} }: {
  textTop?: string; textBottom?: string; s?: number; style?: React.CSSProperties;
}) => (
  <div style={{
    width: Math.round(96 * s),
    height: Math.round(96 * s),
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.28))',
    flexShrink: 0,
    ...style
  }}>
    <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="25%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#ca8a04" />
          <stop offset="75%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
        <linearGradient id="darkGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* 16-point starburst fluted rosette */}
      <path d="M50 0 L58 10 L70 5 L75 17 L88 17 L89 30 L100 35 L96 48 L100 61 L89 67 L88 80 L75 80 L70 92 L58 87 L50 97 L42 87 L30 92 L25 80 L12 80 L11 67 L0 61 L4 48 L0 35 L11 30 L12 17 L25 17 L30 5 L42 10 Z" fill="url(#goldGrad)" />
      {/* Inner dark circle with golden border */}
      <circle cx="50" cy="50" r="38" fill="url(#darkGoldGrad)" stroke="url(#goldGrad)" strokeWidth="3" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="url(#goldGrad)" strokeWidth="0.8" strokeDasharray="2,2" />
    </svg>
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 4px' }}>
      <span style={{ fontSize: Math.round(18 * s), fontWeight: 900, color: '#fef08a', letterSpacing: '-0.02em', lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
        {textTop}
      </span>
      <span style={{ fontSize: Math.round(7 * s), fontWeight: 900, color: '#fde047', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.1, marginTop: 3, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
        {textBottom}
      </span>
    </div>
  </div>
);

// ─── CURVED WAVE FOOTER RIBBON (Exact match to Fotos 2 & 3) ─────────────────────
export const CurvedWave = ({ color = '#dc2626', c1, c2, c3, h = 75 }: { color?: string; c1?: string; c2?: string; c3?: string; h?: number }) => (
  <svg viewBox="0 0 500 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: h, zIndex: 3, pointerEvents: 'none' }}>
    <defs>
      <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={c1 || color} />
        {c2 && <stop offset="50%" stopColor={c2} />}
        <stop offset="100%" stopColor={c3 || `${c1 || color}dd`} />
      </linearGradient>
    </defs>
    <path d="M0,45 C150,15 350,75 500,30 L500,100 L0,100 Z" fill="url(#waveGrad)" />
  </svg>
);

export const ContactFooter = ({ phone, website, color = '#fff', s = 1, style = {}, onClick }: {
  phone?: string; website?: string; color?: string; s?: number; style?: React.CSSProperties; onClick?: () => void;
}) => {
  const cleanPhone = phone && !phone.includes('XXX') && phone.trim() !== '' ? phone.trim() : '';
  const cleanWeb = website && !website.includes('example') && website.trim() !== '' ? website.trim() : '';
  if (!cleanPhone && !cleanWeb) return null;
  return (
    <div 
      data-element-id="contact"
      className={onClick ? "editable-element flyer-contact-element" : "flyer-contact-element"}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick?.(); } : undefined}
      style={{
        position: 'absolute', bottom: Math.round(14 * s), left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        padding: `${Math.round(5 * s)}px ${Math.round(16 * s)}px`,
        borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', gap: Math.round(10 * s),
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}>
        {cleanPhone && (
          <span style={{ color, fontWeight: 800, fontSize: Math.round(11 * s), letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>📞</span> {cleanPhone}
          </span>
        )}
        {cleanPhone && cleanWeb && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: Math.round(10 * s) }}>•</span>
        )}
        {cleanWeb && (
          <span style={{ color, fontWeight: 800, fontSize: Math.round(11 * s), letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>🌐</span> {cleanWeb.replace(/^https?:\/\//, '')}
          </span>
        )}
      </div>
    </div>
  );
};

export const renderTitleWithHighlights = (
  text: string, 
  baseColor: string, 
  highlightColor?: string, 
  highlightShadow?: string
) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return (
        <span 
          key={index} 
          style={{ 
            color: highlightColor || '#f59e0b',
            textShadow: highlightShadow || '0 2px 10px rgba(245,158,11,0.4)',
            fontWeight: 900
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: CINEMATIC GRADIENT HERO (Estilo Foto 1 y 4 bien hecho)
// Foto panorámica completa + degradado suave inferior + texto limpio
// ═══════════════════════════════════════════════════════════════
export const Template_CinematicGradient = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#7c3aed';
  const sub = cleanSubtitle(d.subtitle);

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#030712', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      {/* 1. Full Image Background */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />

      {/* 2. Top Header Brand Scrim */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(90 * s), background: 'linear-gradient(180deg, rgba(3,7,18,0.7) 0%, transparent 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${Math.round(26 * s)}px`, zIndex: 10 }}>
        {d.logoX === undefined && (
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          >
            <Brand logo={d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
          </div>
        )}
      </div>

      {/* 3. Deep Cinematic Bottom-Up Scrim (No side cuts!) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(3,7,18,0.25) 25%, rgba(3,7,18,0.82) 60%, rgba(3,7,18,0.98) 95%, #030712 100%)',
        zIndex: 2
      }} />

      {/* 4. Bottom Content */}
      <div style={{ 
        position: 'absolute', bottom: Math.round(52 * s), left: Math.round(26 * s), right: Math.round(26 * s),
        display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), zIndex: 5,
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(30 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', textShadow: '0 4px 20px rgba(0,0,0,0.7)', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#fff', d.highlightColor || acc)}
        </div>

        {sub && (
          <div 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.9)', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, width: '100%', textShadow: '0 2px 8px rgba(0,0,0,0.6)', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
          >
            {sub}
          </div>
        )}
        
        {/* Horizontal Chips */}
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, justifyContent: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start', width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} gradient={d.gradientBg} s={s} isDark={true} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        {/* CTA Button */}
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', marginTop: Math.round(4 * s), transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'INICIAR HOY'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      {/* 5. Sleek Contact Footer */}
      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: CORPORATE TRUST SEAL (Exact match to Fotos 2 & 3)
// Fondo blanco limpio + logo arriba + título bicolor + personas + sello dorado + ola
// ═══════════════════════════════════════════════════════════════
export const Template_CorporateTrustSeal = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#dc2626'; // Red accent like in photos 2 & 3
  const sub = cleanSubtitle(d.subtitle);

  // Split title into 2 lines for 2-tone contrast (like "Menos papeleo" / "y más ventas")
  const titleParts = (d.title || 'Menos papeleo y más ventas').split(/(y más|y mayor|y mejor|\. )/i);
  const tLine1 = titleParts[0]?.trim();
  const tLine2 = titleParts.slice(1).join('').trim();

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ 
        width: W, height: H, position: 'relative', overflow: 'hidden', 
        fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', 
        background: '#ffffff', cursor: d.onBgClick ? 'pointer' : 'default' 
      }}
    >
      {/* 1. Subtle light geometric faceted background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 10% 20%, rgba(241, 245, 249, 0.8) 0%, rgba(255, 255, 255, 1) 70%)',
        zIndex: 1
      }} />

      {/* 2. Top Header Brand Center */}
      <div style={{ position: 'absolute', top: Math.round(18 * s), left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        {d.logoX === undefined && (
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          >
            <Brand logo={d.logoUrl} name={d.companyName || d.industria} color="#0f172a" s={s * 1.1} />
          </div>
        )}
      </div>

      {/* 3. Top / Center 2-Tone Headline */}
      <div style={{ 
        position: 'absolute', top: Math.round(80 * s), left: Math.round(24 * s), right: Math.round(24 * s),
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 6,
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
      }}>
        <h1 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ 
            fontSize: Math.round(28 * s * (d.titleScale ?? 1)), fontWeight: 900, 
            lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
            transform: d.titleY ? `translateY(${d.titleY}px)` : undefined 
          }}
        >
          {tLine2 ? (
            <>
              <span style={{ color: d.titleColor || '#64748b', display: 'block', fontWeight: 800 }}>{tLine1}</span>
              <span style={{ color: d.highlightColor || acc, display: 'block', fontWeight: 900 }}>{tLine2}</span>
            </>
          ) : (
            <span style={{ color: d.highlightColor || acc }}>{d.title || 'SOLUCIÓN DIGITAL INTELIGENTE'}</span>
          )}
        </h1>

        {sub && (
          <p 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ 
              fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#334155', 
              fontStyle: 'italic', fontWeight: 600, maxWidth: Math.round(400 * s), 
              margin: `${Math.round(8 * s)}px auto 0`, lineHeight: 1.4,
              transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined 
            }}
          >
            “{sub}”
          </p>
        )}
      </div>

      {/* 4. Left Feature Checklist (from Foto 3) */}
      <div style={{
        position: 'absolute', left: Math.round(24 * s), top: Math.round(220 * s),
        display: 'flex', flexDirection: 'column', gap: Math.round(8 * s), zIndex: 6,
        maxWidth: '52%'
      }}>
        {(d.beneficios || []).slice(0, 3).map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: Math.round(8 * s) }}>
            <span style={{
              background: d.gradientBg || `linear-gradient(135deg, ${acc} 0%, #2563eb 50%, #6d4aff 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 900,
              fontSize: Math.round(15 * s),
              display: 'inline-block'
            }}>✓</span>
            <span style={{ fontSize: Math.round(12 * s), fontWeight: 700, color: '#1e293b' }}>
              {b.replace(/^[✓\s*+•-]+/, '').trim()}
            </span>
          </div>
        ))}
      </div>

      {/* 5. Subject / People Photo (rested cleanly in bottom right/center) */}
      {d.bgImageUrl && (
        <div style={{
          position: 'absolute', right: 0, bottom: Math.round(20 * s), width: '60%', height: '58%',
          zIndex: 4, ...imgBg(d.bgImageUrl, d.bgImagePosition),
          maskImage: 'linear-gradient(to top, black 85%, transparent 100%), linear-gradient(to left, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 85%, transparent 100%)'
        }} />
      )}

      {/* 6. GOLDEN STARBURST TRUST BADGE (Like Fotos 2 & 3) */}
      <div style={{ position: 'absolute', right: Math.round(24 * s), bottom: Math.round(45 * s), zIndex: 12 }}>
        <GoldenSeal textTop={d.badgeTextTop || '+600'} textBottom={d.badgeTextBottom || 'CLIENTES SATISFECHOS'} s={s} />
      </div>

      {/* 7. Curved Dynamic Red Wave at Bottom */}
      <CurvedWave color={acc} c1={d.gradColor1} c2={d.gradColor2} c3={d.gradColor3} h={Math.round(80 * s)} />

      {/* 8. Contact Footer */}
      <ContactFooter phone={d.phone} website={d.website} color="#fff" s={s} style={{ zIndex: 15 }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: VIBRANT PURE GRADIENT / VIRAL QUOTE (Exact match to Foto 5)
// Sin foto obligatoria. Fondo de degradado rico + tipografía masiva blanca
// ═══════════════════════════════════════════════════════════════
export const Template_VibrantGradient = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const grad = d.gradientBg || d.cardBgColor || 'linear-gradient(135deg, #7928ca 0%, #ff0080 100%)';
  const sub = cleanSubtitle(d.subtitle);

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ 
        width: W, height: H, position: 'relative', overflow: 'hidden', 
        fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', 
        background: grad, cursor: d.onBgClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: `${Math.round(36 * s)}px ${Math.round(32 * s)}px`
      }}
    >
      {/* Subtle modern ambient light flare */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: Math.round(650 * s), height: Math.round(650 * s),
        background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none', zIndex: 1
      }} />

      {/* Top Logo / Brand Name */}
      <div style={{ display: 'flex', justifyContent: 'center', zIndex: 10, width: '100%' }}>
        {!d.logoUrl && (
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          >
            <Brand logo={null} name={d.companyName || d.industria} color="#fff" s={s * 1.15} forceText={true} />
          </div>
        )}
      </div>

      {/* Center Huge Typography (Like Foto 5: "Does your church use Clearstream yet?") */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: Math.round(18 * s), margin: 'auto 0', zIndex: 5, width: '100%',
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
      }}>
        <h1 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ 
            fontSize: Math.round(34 * s * (d.titleScale ?? 1)), fontWeight: 900, color: d.titleColor || '#ffffff', 
            lineHeight: 1.18, letterSpacing: '-0.02em', margin: 0, textShadow: '0 4px 20px rgba(0,0,0,0.25)',
            transform: d.titleY ? `translateY(${d.titleY}px)` : undefined
          }}
        >
          {renderTitleWithHighlights(d.title || '¿Tu congregación ya usa herramientas digitales?', d.titleColor || '#ffffff', d.highlightColor || '#fef08a')}
        </h1>

        {sub && (
          <p 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ 
              fontSize: Math.round(18 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.92)', 
              fontWeight: (d.subtitleBold ? 800 : 600), lineHeight: 1.35, margin: 0,
              maxWidth: Math.round(440 * s), textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined
            }}
          >
            {sub}
          </p>
        )}

        {/* Optional Benefit Chips */}
        {d.beneficios && d.beneficios.filter(b => b.trim() !== '').length > 0 && (
          <div 
            data-element-id="benefits" 
            className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
            onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
            style={{ 
              display: 'flex', flexWrap: 'wrap', gap: Math.round(8 * s), 
              justifyContent: 'center', margin: `${Math.round(4 * s)}px 0`, 
              maxWidth: Math.round(480 * s),
              transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined 
            }}
          >
            {d.beneficios.filter(b => b.trim() !== '').slice(0, 3).map((b, i) => (
              <BenChip key={i} text={b} color="#38bdf8" s={s * (d.benefitsScale ?? 1)} isDark={true} bold={!!d.benefitsBold} />
            ))}
          </div>
        )}

        {/* CTA Button — Guaranteed High Contrast */}
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ marginTop: Math.round(10 * s), transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          {(() => {
            const bg = d.ctaBgColor || '#ffffff';
            const isLightBg = !d.ctaBgColor || d.ctaBgColor.toLowerCase() === '#ffffff' || d.ctaBgColor.toLowerCase() === '#fff' || d.ctaBgColor.toLowerCase() === '#f8fafc';
            const hasExplicitDarkText = d.ctaTextColor && d.ctaTextColor.toLowerCase() !== '#ffffff' && d.ctaTextColor.toLowerCase() !== '#fff';
            const textColor = isLightBg ? (hasExplicitDarkText ? d.ctaTextColor : '#0f172a') : (d.ctaTextColor || '#ffffff');
            const ctaLabel = (d.cta && d.cta.trim() !== '') ? d.cta.trim() : 'PRUÉBALO GRATIS';

            return (
              <div style={{
                background: bg,
                color: textColor,
                fontWeight: 900,
                fontSize: Math.round(13 * s * (d.ctaScale ?? 1)),
                letterSpacing: '0.04em',
                borderRadius: 999,
                padding: `${Math.round(12 * s)}px ${Math.round(28 * s)}px`,
                display: 'inline-flex', alignItems: 'center', gap: Math.round(6 * s),
                boxShadow: isLightBg ? '0 10px 25px rgba(0,0,0,0.25)' : '0 10px 25px rgba(0,0,0,0.3)',
                textTransform: 'uppercase', cursor: 'pointer'
              }}>
                <span style={{ color: textColor }}>{ctaLabel}</span>
                <span style={{ color: textColor }}>➔</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bottom Contact Footer */}
      <ContactFooter phone={d.phone} website={d.website} color="#fff" s={s} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4: PROBLEM-SOLUTION URGENT AD (Exact match to Foto 4)
// Foto emotiva + degradado violeta inferior izquierdo + "Evita sorpresas con..."
// ═══════════════════════════════════════════════════════════════
export const Template_ProblemSolution = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#ec4899'; // Bright magenta like in Foto 4
  const sub = cleanSubtitle(d.subtitle);

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0a0a14', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      {/* 1. Full Image Background */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />

      {/* 2. Top Header Brand Bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(75 * s), background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)', display: 'flex', alignItems: 'center', padding: `0 ${Math.round(24 * s)}px`, zIndex: 10 }}>
        {!d.logoUrl && (
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          >
            <Brand logo={null} name={d.companyName || d.industria} color="#fff" s={s} forceText={true} />
          </div>
        )}
      </div>

      {/* 3. Deep Violet Bottom-Up Gradient (Foto 4 style) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(15, 10, 30, 0.4) 20%, rgba(15, 10, 30, 0.92) 65%, #0d091a 100%)',
        zIndex: 2
      }} />

      {/* 4. Bottom Content */}
      <div style={{ 
        position: 'absolute', bottom: Math.round(50 * s), left: Math.round(24 * s), right: Math.round(24 * s),
        display: 'flex', flexDirection: 'column', gap: Math.round(8 * s), zIndex: 5,
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
      }}>
        {/* Headline */}
        <h1 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(29 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', textShadow: '0 4px 16px rgba(0,0,0,0.8)', margin: 0, transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights(d.title || 'Evita sorpresas y problemas', d.titleColor || '#fff', d.highlightColor || '#c084fc')}
        </h1>

        {sub && (
          <p 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, margin: 0, transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
          >
            {sub}
          </p>
        )}

        {/* Action Button (Bright Neon CTA like Foto 4) */}
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', marginTop: Math.round(6 * s), transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <div style={{
            background: d.ctaBgColor || `linear-gradient(135deg, ${acc} 0%, #db2777 100%)`,
            color: d.ctaTextColor || '#ffffff',
            fontWeight: 900,
            fontSize: Math.round(12 * s * (d.ctaScale ?? 1)),
            letterSpacing: '0.04em',
            borderRadius: Math.round(8 * s),
            padding: `${Math.round(10 * s)}px ${Math.round(22 * s)}px`,
            display: 'inline-flex', alignItems: 'center', gap: Math.round(6 * s),
            boxShadow: `0 8px 20px ${acc}55`,
            textTransform: 'uppercase', cursor: 'pointer'
          }}>
            <span>{d.cta || '¡LLÁMANOS YA!'}</span>
            <span>➔</span>
          </div>
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5: WHITE CARD MINIMAL (Apple / Canva Pro Float)
// Foto en fondo + tarjeta de cristal blanco flotante abajo
// ═══════════════════════════════════════════════════════════════
export const Template_WhiteCardMinimal = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#2563eb';
  const sub = cleanSubtitle(d.subtitle);

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#f8fafc', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      {/* Background Image */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.3)' }} />
      
      {/* Top Header */}
      <div style={{ position: 'absolute', top: Math.round(18 * s), left: Math.round(20 * s), right: Math.round(20 * s), display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        {d.logoX === undefined && (
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', padding: `${Math.round(4 * s)}px ${Math.round(12 * s)}px`, borderRadius: 999, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            <Brand logo={d.logoUrl} name={d.companyName || d.industria} color="#0f172a" s={s} />
          </div>
        )}
      </div>

      {/* Floating White Card */}
      <div style={{ 
        position: 'absolute',
        left: Math.round(20 * s), right: Math.round(20 * s), bottom: Math.round(54 * s),
        background: d.cardBgColor || 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: Math.round(20 * s),
        padding: `${Math.round(20 * s)}px ${Math.round(24 * s)}px`,
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.35)',
        zIndex: 5,
        display: 'flex', flexDirection: 'column', gap: Math.round(10 * s),
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(24 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#0f172a', lineHeight: 1.18, letterSpacing: '-0.02em', margin: 0, width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights(d.title || 'OPORTUNIDAD EXCLUSIVA', d.titleColor || '#0f172a', d.highlightColor || acc)}
        </div>

        {sub && (
          <div 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#475569', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
          >
            {sub}
          </div>
        )}

        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(2 * s)}px 0`, width: '100%', justifyContent: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={false} bold={!!d.benefitsBold} />
          ))}
        </div>

        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ width: '100%', marginTop: Math.round(4 * s), transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'SABER MÁS'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} style={{ width: '100%' }} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color="#fff" s={s} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6: MINIMAL SWISS EDITORIAL
// ═══════════════════════════════════════════════════════════════
export const Template_MinimalSwiss = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#0f172a';
  const sub = cleanSubtitle(d.subtitle);

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#fafaf9', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: Math.round(8 * s), height: '100%', background: acc, zIndex: 10 }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.12, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />

      <div style={{ position: 'relative', zIndex: 5, padding: `${Math.round(40 * s)}px ${Math.round(40 * s)}px`, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        {d.logoX === undefined && (
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          >
            <Brand logo={d.logoUrl} name={d.companyName || d.industria} color="#0f172a" s={s} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(14 * s) }}>
          <h1 
            data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
            onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(36 * s * (d.titleScale ?? 1)), fontWeight: 900, color: d.titleColor || '#0f172a', lineHeight: 1.08, letterSpacing: '-0.03em', margin: 0 }}
          >
            {d.title || 'COMUNICADO OFICIAL'}
          </h1>
          {sub && (
            <p 
              data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
              onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
              style={{ fontSize: Math.round(14 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#57534e', lineHeight: 1.5, margin: 0 }}
            >
              {sub}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {(d.beneficios || []).slice(0, 3).map((b, i) => (
              <div key={i} style={{ fontSize: Math.round(12 * s), color: '#292524', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: acc }}>—</span> {b}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div 
            data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
            onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          >
            <PillBtn label={d.cta || 'INGRESAR'} bg1={acc} bg2={acc} color="#fff" s={s} />
          </div>
        </div>
      </div>
      <ContactFooter phone={d.phone} website={d.website} color="#0f172a" s={s} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 7: PROMO POP (Comercial Alto Impacto)
// ═══════════════════════════════════════════════════════════════
export const Template_PromoPop = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  const sub = cleanSubtitle(d.subtitle);

  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0f172a', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.6) 50%, rgba(15,23,42,0.92) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 5, padding: `${Math.round(28 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {d.logoX === undefined && (
            <div 
              className={d.onLogoClick ? "editable-element" : undefined}
              onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
            >
              <Brand logo={d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
            </div>
          )}
          <div style={{ background: acc, color: '#000', fontWeight: 900, padding: `${Math.round(4 * s)}px ${Math.round(12 * s)}px`, borderRadius: 999, fontSize: Math.round(11 * s) }}>
            OFERTA ESPECIAL
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), textAlign: 'center', alignItems: 'center' }}>
          <h1 
            data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
            onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(32 * s * (d.titleScale ?? 1)), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, textShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
          >
            {renderTitleWithHighlights(d.title || 'PROMOCIÓN EXCLUSIVA', d.titleColor || '#fff', d.highlightColor || acc)}
          </h1>
          {sub && (
            <p 
              data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
              onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
              style={{ fontSize: Math.round(13 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.9)', maxWidth: Math.round(380 * s) }}
            >
              {sub}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {(d.beneficios || []).slice(0, 3).map((b, i) => (
              <BenChip key={i} text={b} color={acc} s={s} isDark={true} />
            ))}
          </div>
          <div 
            data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
            onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
            style={{ marginTop: 8 }}
          >
            <PillBtn label={d.cta || 'OBTENER DESCUENTO'} bg1={acc} bg2={acc} color="#000" s={s} />
          </div>
        </div>

        <ContactFooter phone={d.phone} website={d.website} color="#fff" s={s} onClick={d.onContactClick} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 0: DIRECT MOCKUP (Imagen Pura)
// ═══════════════════════════════════════════════════════════════
export const Template_DirectMockup = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', boxSizing: 'border-box', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      {d.bgImageUrl ? (
        <img src={d.bgImageUrl} alt="Flyer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1e293b, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>Sube tu flyer diseñado o genera una imagen de fondo</div>
        </div>
      )}
    </div>
  );
};

// ─── TEMPLATE REGISTRY ────────────────────────────────────────────────────────
export const TEMPLATES: Record<string, React.ComponentType<{ d: FlyerData }>> = {
  // Style 1: Photo + Bottom Gradient (Fotos 1 & 4)
  'cinematic-gradient': Template_CinematicGradient,
  'cinematic': Template_CinematicGradient,
  'bold-split': Template_CinematicGradient, // Fallback mapped to new template!
  'full-bleed': Template_CinematicGradient,

  // Style 2: Corporate with Golden Seal + Wave (Fotos 2 & 3)
  'corporate-seal': Template_CorporateTrustSeal,
  'corporate-light': Template_CorporateTrustSeal,

  // Style 3: Vibrant Pure Gradient (Foto 5)
  'vibrant-gradient': Template_VibrantGradient,
  'center-gradient': Template_VibrantGradient,

  // Style 4: Problem-Solution / Urgent Alert (Foto 4)
  'problem-solution': Template_ProblemSolution,
  'magazine': Template_ProblemSolution,
  'dark-luxury': Template_ProblemSolution,

  // Style 5: Floating Minimal White Card (Apple Style)
  'white-card': Template_WhiteCardMinimal,

  // Style 6: Minimal Swiss Editorial
  'minimal-swiss': Template_MinimalSwiss,
  'minimal-editorial': Template_MinimalSwiss,

  // Style 7: Promo Pop
  'promo-pop': Template_PromoPop,

  // Style 0: Mockup Directo
  'direct-mockup': Template_DirectMockup,
};

// ─── RENDER FLYER DISPATCHER ──────────────────────────────────────────────────
export const RenderFlyer = ({ d, onLogoMove, onLogoResize, onMove, onResize }: {
  d: FlyerData;
  onLogoMove?: (x: number, y: number) => void;
  onLogoResize?: (size: number) => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (size: number) => void;
}) => {
  const Comp = TEMPLATES[d.templateId] || Template_VibrantGradient;
  const handleMove = onLogoMove || onMove;
  const handleResize = onLogoResize || onResize;
  return (
    <>
      <Comp d={d} />
      {d.logoUrl && (
        <FreeLogo 
          d={d} 
          onLogoMove={handleMove} 
          onLogoResize={handleResize} 
        />
      )}
    </>
  );
};

export const FreeLogo = ({ d, onLogoMove, onLogoResize, onMove, onResize }: { 
  d: FlyerData;
  onLogoMove?: (x: number, y: number) => void;
  onLogoResize?: (size: number) => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (size: number) => void;
}) => {
  const handleMove = onLogoMove || onMove;
  const handleResize = onLogoResize || onResize;
  const isDragging = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const parentRect = React.useRef<DOMRect | null>(null);
  // Store stable function refs to ensure addEventListener/removeEventListener use same reference
  const handleMoveRef = React.useRef(handleMove);
  handleMoveRef.current = handleMove;
  
  const onDragRef = React.useRef<((e: MouseEvent) => void) | undefined>(undefined);

  onDragRef.current = (e: MouseEvent) => {
    if (!isDragging.current || !parentRect.current || !handleMoveRef.current) return;
    const currentLeft = e.clientX - parentRect.current.left - dragStart.current.x;
    const currentTop = e.clientY - parentRect.current.top - dragStart.current.y;
    const pctX = Math.min(95, Math.max(0, (currentLeft / parentRect.current.width) * 100));
    const pctY = Math.min(90, Math.max(0, (currentTop / parentRect.current.height) * 100));
    handleMoveRef.current(pctX, pctY);
  };

  const stableOnDrag = React.useRef((e: MouseEvent) => onDragRef.current?.(e));
  const stableEndDrag = React.useRef(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', stableOnDrag.current);
    document.removeEventListener('mouseup', stableEndDrag.current);
  });

  const startDrag = (e: React.MouseEvent) => {
    if (!handleMoveRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    // Find the canvas container (position:relative parent that holds the flyer)
    // Walk up the DOM to find the element with data-flyer-canvas attribute, 
    // or fall back to the immediate parentElement
    let canvasEl: HTMLElement | null = e.currentTarget.parentElement;
    let walker: HTMLElement | null = e.currentTarget.parentElement;
    while (walker) {
      if (walker.dataset && walker.dataset.flyerCanvas) { canvasEl = walker; break; }
      walker = walker.parentElement;
    }
    if (canvasEl) {
      const canvasRect = canvasEl.getBoundingClientRect();
      parentRect.current = canvasRect;
      // dragStart offset = where inside the logo the user clicked (in visual/scaled px)
      const logoRect = e.currentTarget.getBoundingClientRect();
      dragStart.current = { x: e.clientX - logoRect.left, y: e.clientY - logoRect.top };
    }
    document.addEventListener('mousemove', stableOnDrag.current);
    document.addEventListener('mouseup', stableEndDrag.current);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', stableOnDrag.current);
      document.removeEventListener('mouseup', stableEndDrag.current);
    };
  }, []);

  if (!d.logoUrl) return null;

  const rawSize = d.logoSize !== undefined ? d.logoSize : 1.0;
  const isCustom = d.logoX !== undefined && d.logoY !== undefined;
  // Better default: top-left corner with a bit of margin
  const defaultX = 4;
  const defaultY = 4;
  const posX = isCustom ? d.logoX : defaultX;
  const posY = isCustom ? d.logoY : defaultY;
  
  return (
    <div
      data-element-id="logo"
      className={d.onLogoClick ? "editable-element flyer-logo-element" : "flyer-logo-element"}
      onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
      onMouseDown={startDrag}
      title={handleMove ? "Arrastra para mover el logo" : undefined}
      style={{
        position: 'absolute',
        left: `${posX}%`,
        top: `${posY}%`,
        cursor: handleMove ? 'move' : 'default',
        zIndex: 40,
        transform: `scale(${rawSize})`,
        transformOrigin: 'top left',
        padding: 0,
        background: 'transparent',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        userSelect: 'none'
      }}
    >
      <img
        src={d.logoUrl}
        alt="Logo"
        style={{
          maxHeight: 80,
          maxWidth: 180,
          objectFit: 'contain',
          pointerEvents: 'none',
          display: 'block'
        }}
      />
      {handleResize && (
        <div 
          className="logo-resize-controls"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2, 
            marginLeft: 6,
            opacity: 0,
            transition: 'opacity 0.15s ease',
          }} 
          onMouseDown={e => e.stopPropagation()}
        >
          <button 
            type="button"
            title="Agrandar logo"
            onClick={(e) => { e.stopPropagation(); handleResize(Math.min(rawSize + 0.15, 3.0)); }}
            style={{ width: 18, height: 18, fontSize: 13, fontWeight: 900, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', lineHeight: 1 }}
          >
            +
          </button>
          <button 
            type="button"
            title="Achicar logo"
            onClick={(e) => { e.stopPropagation(); handleResize(Math.max(rawSize - 0.15, 0.2)); }}
            style={{ width: 18, height: 18, fontSize: 13, fontWeight: 900, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', lineHeight: 1 }}
          >
            −
          </button>
        </div>
      )}
    </div>
  );
};


export const TEMPLATE_LIST = [
  { 
    id: 'vibrant-gradient', 
    name: '1. Degradado Puro / Viral Quote', 
    desc: 'Sin foto obligatoria. Fondo degradado de alto impacto con tipografía masiva (Estilo Foto 5)' 
  },
  { 
    id: 'problem-solution', 
    name: '2. Alerta & Solución Editorial', 
    desc: 'Foto con degradado inferior oscuro, titular de alto impacto y CTA llamativo (Estilo Foto 4)' 
  },
];
