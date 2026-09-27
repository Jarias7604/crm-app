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

// ─── MODERN SHARED COMPONENTS ─────────────────────────────────────────────────

export const PillBtn = ({ label, bg1, bg2, color = '#fff', style = {}, s = 1 }: {
  label: string; bg1: string; bg2: string; color?: string; style?: React.CSSProperties; s?: number;
}) => (
  <div style={{
    background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
    color, fontWeight: 900, fontSize: Math.round(13 * s),
    letterSpacing: '0.06em', borderRadius: 999,
    padding: `${Math.round(11 * s)}px ${Math.round(24 * s)}px`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(6 * s),
    boxShadow: `0 ${Math.round(6 * s)}px ${Math.round(20 * s)}px -4px ${bg1}66`,
    textAlign: 'center', textTransform: 'uppercase', cursor: 'pointer', ...style,
  }}>
    <span>{label}</span>
    <span style={{ fontSize: Math.round(13 * s), opacity: 0.9 }}>➔</span>
  </div>
);

export const BenChip = ({ text, color = '#38bdf8', s = 1, isDark = true, bold = false }: {
  text: string; color?: string; s?: number; isDark?: boolean; bold?: boolean;
}) => {
  if (!text) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: Math.round(6 * s),
      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(15,23,42,0.1)',
      borderRadius: Math.round(8 * s),
      padding: `${Math.round(5 * s)}px ${Math.round(10 * s)}px`,
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: Math.round(11 * s),
      fontWeight: bold ? 800 : 600,
      lineHeight: 1.3
    }}>
      <span style={{ color, fontWeight: 900, fontSize: Math.round(11 * s) }}>✦</span>
      <span>{text}</span>
    </div>
  );
};

export const Brand = ({ logo, name, color = '#fff', s = 1 }: {
  logo: string | null; name?: string; color?: string; s?: number;
}) => {
  const brandName = name && name !== 'auto' && name !== 'Mi Empresa' && !name.includes('ARIAS') ? name : 'Iclesia';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(8 * s) }}>
      {logo ? (
        <img src={logo} alt="Logo" style={{ width: Math.round(36 * s), height: Math.round(36 * s), borderRadius: Math.round(8 * s), objectFit: 'contain' }} crossOrigin="anonymous" />
      ) : (
        <div style={{
          width: Math.round(26 * s), height: Math.round(26 * s), borderRadius: Math.round(6 * s),
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.08))',
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: Math.round(12 * s), color
        }}>
          {brandName.charAt(0).toUpperCase()}
        </div>
      )}
      <span style={{ fontSize: Math.round(12 * s), fontWeight: 800, color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {trunc(brandName, 22)}
      </span>
    </div>
  );
};

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
        background: 'rgba(15, 23, 42, 0.75)',
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
      const cleanText = part.slice(2, -2);
      const hc = highlightColor || '#FFD700';
      return (
        <span 
          key={index} 
          style={{ 
            color: hc,
            fontWeight: 900,
            textShadow: highlightShadow || `0 2px 14px ${hc}88, 0 1px 3px rgba(0,0,0,0.6)`
          }}
        >
          {cleanText}
        </span>
      );
    }
    return part;
  });
};

// ─── FREE LOGO OVERLAY (drag + resize) ────────────────────────────────────────
export const FreeLogo = ({ d, onMove, onResize }: {
  d: FlyerData;
  onMove?: (x: number, y: number) => void;
  onResize?: (size: number) => void;
}) => {
  if (!d.logoUrl || d.logoX === undefined) return null;
  const W = d.containerW || 540, H = d.containerH || 675;
  const sz = Math.round(150 * (d.logoSize ?? 1));
  const x = (d.logoX / 100) * W, y = (d.logoY ?? 5) / 100 * H;
  return (
    <div 
      className={d.onLogoClick ? "editable-element" : undefined}
      onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
      style={{ 
        position: 'absolute', left: x, top: y, width: sz, 
        cursor: onMove ? 'move' : 'default', zIndex: 20, 
        userSelect: 'none', display: 'inline-flex'
      }}
      onMouseDown={e => {
        if (!onMove) return;
        e.preventDefault();
        const parent = e.currentTarget.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const logoRect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - logoRect.left;
        const offsetY = e.clientY - logoRect.top;
        
        const move = (ev: MouseEvent) => {
          const currentLeft = ev.clientX - rect.left - offsetX;
          const currentTop = ev.clientY - rect.top - offsetY;
          const pctX = Math.min(100, Math.max(0, (currentLeft / rect.width) * 100));
          const pctY = Math.min(100, Math.max(0, (currentTop / rect.height) * 100));
          onMove(pctX, pctY);
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      }}
    >
      <img src={d.logoUrl} alt="Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 8, pointerEvents: 'none' }} />
      {onResize && (
        <div 
          style={{ position: 'absolute', bottom: -4, right: -4, width: 14, height: 14, background: '#D4AF37', borderRadius: '50%', cursor: 'se-resize', zIndex: 21 }}
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

// ─── RENDER FLYER WRAPPER ─────────────────────────────────────────────────────
export const RenderFlyer = ({ d, onLogoMove, onLogoResize }: {
  d: FlyerData; onLogoMove?: (x: number, y: number) => void; onLogoResize?: (s: number) => void;
}) => {
  const Tmpl = TEMPLATES[d.templateId] || Template_BoldSplit;
  return (
    <div style={{ 
      position: 'relative', 
      width: d.containerW || 540, 
      height: d.containerH || 675,
      '--flyer-title-font': getFontFamily(d.titleFont || d.flyerFont),
      '--flyer-subtitle-font': getFontFamily(d.subtitleFont || d.flyerFont),
      '--flyer-benefits-font': getFontFamily(d.benefitsFont || d.flyerFont),
      '--flyer-cta-font': getFontFamily(d.ctaFont || d.flyerFont),
      '--flyer-contact-font': getFontFamily(d.contactFont || d.flyerFont),
    } as React.CSSProperties}>
      <Tmpl d={d} />
      <FreeLogo d={d} onMove={onLogoMove} onResize={onLogoResize} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: MODERN EDITORIAL GLASS (Full Photo + Frosted Left Panel)
// ═══════════════════════════════════════════════════════════════
export const Template_BoldSplit = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#6366f1';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  const isBg = !!d.bgImageUrl;
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', cursor: d.onBgClick ? 'pointer' : 'default', background: '#090d16' }}
    >
      {/* 1. Full-Bleed Background Photo */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />

      {/* 2. Seamless Left-to-Right Dark Gradient Scrim (No harsh cut) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isBg 
          ? 'linear-gradient(90deg, rgba(9, 13, 22, 0.94) 0%, rgba(9, 13, 22, 0.85) 48%, rgba(9, 13, 22, 0.3) 78%, transparent 100%)'
          : `linear-gradient(135deg, ${acc} 0%, #090d16 100%)`,
        zIndex: 2
      }} />

      {/* 3. Content Panel */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '56%', height: '100%', padding: `${Math.round(28 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', zIndex: 4, boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
        </div>
        
        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), margin: 'auto 0',
          transform: d.textY ? `translateY(${d.textY}px)` : undefined,
          textAlign: d.textAlign || 'left',
          alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
        }}>
          <h1 
            data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
            onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
            style={{ fontSize: (Math.round(28 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, textShadow: '0 4px 16px rgba(0,0,0,0.5)', letterSpacing: '-0.02em', margin: 0, transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
          >
            {renderTitleWithHighlights(title, d.titleColor || '#fff', d.highlightColor)}
          </h1>
          <div 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
          >
            {d.subtitle || ''}
          </div>

          {/* Benefit Chips */}
          <div 
            data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
            onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: Math.round(6 * s), marginTop: Math.round(6 * s), transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
          >
            {(d.beneficios || []).slice(0, 3).map((b, i) => (
              <BenChip key={i} text={b} color={acc} s={s} isDark={true} bold={!!d.benefitsBold} />
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ width: '100%', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'CONTACTAR'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} style={{ width: '100%' }} />
        </div>
      </div>
      
      {/* 4. Sleek Floating Contact Footer */}
      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: CINEMATIC FULL PRO (Apple / Movie Poster Gradient)
// ═══════════════════════════════════════════════════════════════
export const Template_Cinematic = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0a0e17', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      {/* 1. Full Image */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      
      {/* 2. Top Header Brand Scrim */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(80 * s), background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${Math.round(24 * s)}px`, zIndex: 10 }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
        </div>
        <div style={{ background: `${acc}25`, border: `1px solid ${acc}66`, color: acc, padding: `${Math.round(4 * s)}px ${Math.round(10 * s)}px`, borderRadius: 999, fontSize: Math.round(10 * s), fontWeight: 800, textTransform: 'uppercase' }}>
          ★ Exclusivo
        </div>
      </div>

      {/* 3. Bottom Cinematic Scrim */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(10, 14, 23, 0.4) 30%, rgba(10, 14, 23, 0.88) 65%, rgba(10, 14, 23, 0.98) 100%)',
        zIndex: 2
      }} />

      {/* 4. Bottom Floating Content */}
      <div style={{ 
        position: 'absolute', bottom: Math.round(52 * s), left: Math.round(24 * s), right: Math.round(24 * s),
        display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), zIndex: 5,
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(30 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', textShadow: '0 4px 16px rgba(0,0,0,0.6)', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#fff', d.highlightColor)}
        </div>
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, justifyContent: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start', width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={true} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'VER MÁS'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#000'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      {/* 5. Sleek Contact Footer */}
      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: WHITE CARD MINIMAL (Apple Clean Glass)
// ═══════════════════════════════════════════════════════════════
export const Template_WhiteCard = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#2563eb';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#f8fafc', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      {/* 1. Full Image */}
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.25)' }} />
      
      {/* 2. Top Header */}
      <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s), right: Math.round(20 * s), display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', padding: `${Math.round(4 * s)}px ${Math.round(12 * s)}px`, borderRadius: 999 }}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#0f172a" s={s} />
        </div>
      </div>

      {/* 3. Floating Frosted White Card */}
      <div style={{ 
        position: 'absolute',
        left: Math.round(20 * s), right: Math.round(20 * s), bottom: Math.round(54 * s),
        background: d.cardBgColor || 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: Math.round(20 * s),
        border: '1px solid rgba(255, 255, 255, 0.6)',
        padding: `${Math.round(20 * s)}px ${Math.round(24 * s)}px`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
        zIndex: 5, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s),
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'stretch'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(26 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#0f172a', lineHeight: 1.15, letterSpacing: '-0.02em', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#0f172a', d.highlightColor)}
        </div>
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#334155', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={false} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'CONTACTAR'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      {/* 4. Sleek Floating Contact Footer */}
      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4: MAGAZINE DARK EDITORIAL (Forbes / High Fashion)
// ═══════════════════════════════════════════════════════════════
export const Template_Magazine = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#e11d48';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#08080f', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(8, 8, 15, 0.96) 0%, rgba(8, 8, 15, 0.82) 48%, rgba(8, 8, 15, 0.25) 80%, transparent 100%)',
        zIndex: 2
      }} />

      <div style={{ position: 'absolute', left: 0, top: 0, width: '56%', height: '100%', padding: `${Math.round(28 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', zIndex: 4, boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div>
          <div 
            className={d.onLogoClick ? "editable-element" : undefined}
            onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          >
            <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color={acc} s={s} />
          </div>
          <div style={{ height: 2, background: `linear-gradient(90deg, ${acc}, transparent)`, width: Math.round(80 * s), margin: `${Math.round(12 * s)}px 0 0 0` }} />
        </div>
        
        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), margin: 'auto 0',
          transform: d.textY ? `translateY(${d.textY}px)` : undefined,
          textAlign: d.textAlign || 'left',
          alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
        }}>
          <h1 
            data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
            onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
            style={{ fontSize: (Math.round(30 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.12, letterSpacing: '-0.02em', margin: 0, transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
          >
            {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#fff', d.highlightColor)}
          </h1>
          <div 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.8)', fontWeight: (d.subtitleBold ? 800 : 400), lineHeight: 1.45, transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
          >
            {d.subtitle || ''}
          </div>

          <div 
            data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
            onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: Math.round(6 * s), marginTop: Math.round(4 * s), transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
          >
            {(d.beneficios || []).slice(0, 3).map((b, i) => (
              <BenChip key={i} text={b} color={acc} s={s} isDark={true} bold={!!d.benefitsBold} />
            ))}
          </div>
        </div>

        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ width: '100%', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'DESCUBRIR'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} style={{ width: '100%' }} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5: GRADIENT CENTER POP (Vibrant Glowing Card)
// ═══════════════════════════════════════════════════════════════
export const Template_CenterGradient = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#8b5cf6';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0a0a14', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10, 10, 20, 0.45)' }} />

      {/* Top Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(18 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: `${Math.round(4 * s)}px ${Math.round(12 * s)}px`, fontSize: Math.round(10 * s), fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>
          ★ Recomendado
        </div>
      </div>

      {/* Centered Glass Card */}
      <div style={{ 
        position: 'absolute', top: '50%', left: Math.round(24 * s), right: Math.round(24 * s),
        transform: 'translateY(-50%)' + (d.textY ? ` translateY(${d.textY}px)` : ''),
        background: d.cardBgColor || 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1.5px solid ${acc}66`,
        borderRadius: Math.round(22 * s),
        padding: `${Math.round(24 * s)}px ${Math.round(22 * s)}px`,
        boxShadow: `0 20px 50px rgba(0,0,0,0.35), 0 0 40px ${acc}20`,
        textAlign: d.textAlign || 'center',
        zIndex: 5, display: 'flex', flexDirection: 'column', gap: Math.round(10 * s),
        alignItems: d.textAlign === 'left' ? 'flex-start' : d.textAlign === 'right' ? 'flex-end' : 'center'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(30 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.12, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.5)', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#fff', d.highlightColor)}
        </div>
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.85)', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', justifyContent: d.textAlign || 'center', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={true} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'EMPEZAR'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6: CORPORATE SAAS & B2B (Clean Enterprise)
// ═══════════════════════════════════════════════════════════════
export const Template_CorporateLight = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#0284c7';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#f8fafc', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.88) 50%, rgba(255, 255, 255, 0.25) 80%, transparent 100%)',
        zIndex: 2
      }} />

      <div style={{ position: 'absolute', left: 0, top: 0, width: '56%', height: '100%', padding: `${Math.round(28 * s)}px ${Math.round(24 * s)}px`, display: 'flex', flexDirection: 'column', zIndex: 4, boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#0f172a" s={s} />
        </div>
        
        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: Math.round(10 * s), margin: 'auto 0',
          transform: d.textY ? `translateY(${d.textY}px)` : undefined,
          textAlign: d.textAlign || 'left',
          alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
        }}>
          <h1 
            data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
            onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
            style={{ fontSize: (Math.round(28 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#0f172a', lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0, transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
          >
            {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#0f172a', d.highlightColor)}
          </h1>
          <div style={{ height: 3, background: acc, width: Math.round(50 * s), borderRadius: 2 }} />
          <div 
            data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
            onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
            style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#334155', fontWeight: (d.subtitleBold ? 800 : 500), lineHeight: 1.45, transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
          >
            {d.subtitle || ''}
          </div>

          <div 
            data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
            onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: Math.round(6 * s), marginTop: Math.round(4 * s), transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
          >
            {(d.beneficios || []).slice(0, 3).map((b, i) => (
              <BenChip key={i} text={b} color={acc} s={s} isDark={false} bold={!!d.benefitsBold} />
            ))}
          </div>
        </div>

        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ width: '100%', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'SABER MÁS'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} style={{ width: '100%' }} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 7: DARK LUXURY GOLD (Onyx & Champagne Gold)
// ═══════════════════════════════════════════════════════════════
export const Template_DarkLuxury = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#D4AF37';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#07070d', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7, 7, 13, 0.4)' }} />
      
      {/* Top Gold Border Line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${acc}, transparent)`, zIndex: 11 }} />

      {/* Top Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: `${Math.round(16 * s)}px ${Math.round(24 * s)}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color={acc} s={s} />
        </div>
        <span style={{ fontSize: Math.round(10 * s), color: acc, letterSpacing: '0.15em', fontWeight: 800, textTransform: 'uppercase' }}>EDICIÓN VIP</span>
      </div>

      {/* Center Gold Border Card */}
      <div style={{ 
        position: 'absolute', top: '50%', left: Math.round(24 * s), right: Math.round(24 * s),
        transform: 'translateY(-50%)' + (d.textY ? ` translateY(${d.textY}px)` : ''),
        background: d.cardBgColor || 'rgba(7, 7, 13, 0.78)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1.5px solid ${acc}`,
        borderRadius: Math.round(18 * s),
        padding: `${Math.round(24 * s)}px ${Math.round(22 * s)}px`,
        boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 30px ${acc}20`,
        textAlign: d.textAlign || 'center',
        zIndex: 5, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s),
        alignItems: d.textAlign === 'left' ? 'flex-start' : d.textAlign === 'right' ? 'flex-end' : 'center'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(30 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, letterSpacing: '-0.01em', textShadow: '0 2px 14px rgba(0,0,0,0.6)', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#fff', d.highlightColor)}
        </div>
        <div style={{ height: 2, width: Math.round(60 * s), background: acc, margin: '4px auto' }} />
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.85)', fontStyle: 'italic', lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', justifyContent: d.textAlign || 'center', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={true} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'RESERVAR AHORA'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : '#b89628'} color={d.ctaTextColor || '#000'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 8: PROMO COMMERCIAL POP (High Energy Commercial)
// ═══════════════════════════════════════════════════════════════
export const Template_PromoPop = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#f59e0b';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#0b0f19', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(11, 15, 25, 0.35)' }} />

      {/* Top Header with Floating Promo Pill */}
      <div style={{ position: 'absolute', top: Math.round(16 * s), left: Math.round(20 * s), right: Math.round(20 * s), display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(10px)', padding: `${Math.round(4 * s)}px ${Math.round(12 * s)}px`, borderRadius: 999 }}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
        </div>
        <div style={{ background: acc, borderRadius: 999, padding: `${Math.round(6 * s)}px ${Math.round(14 * s)}px`, fontWeight: 900, color: '#000', fontSize: Math.round(11 * s), boxShadow: `0 4px 16px ${acc}66`, textTransform: 'uppercase' }}>
          🔥 Oferta Especial
        </div>
      </div>

      {/* Floating Frosted White Card */}
      <div style={{ 
        position: 'absolute', left: Math.round(20 * s), right: Math.round(20 * s), bottom: Math.round(54 * s),
        background: d.cardBgColor || 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRadius: Math.round(20 * s),
        border: '1px solid rgba(255, 255, 255, 0.6)',
        padding: `${Math.round(20 * s)}px ${Math.round(22 * s)}px`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
        zIndex: 5, display: 'flex', flexDirection: 'column', gap: Math.round(6 * s),
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'stretch'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(28 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#0f172a', lineHeight: 1.15, letterSpacing: '-0.02em', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#0f172a', d.highlightColor)}
        </div>
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#334155', lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={false} bold={!!d.benefitsBold} />
          ))}
        </div>
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'OBTENER OFERTA'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#000'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 9: MINIMAL SWISS MODERN (Clean Typography)
// ═══════════════════════════════════════════════════════════════
export const Template_MinimalEditorial = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#0ea5e9';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', background: '#f8fafc', cursor: d.onBgClick ? 'pointer' : 'default' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.3)' }} />
      
      {/* Brand logo top left */}
      <div style={{ position: 'absolute', top: Math.round(18 * s), left: Math.round(20 * s), right: Math.round(20 * s), zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', padding: `${Math.round(4 * s)}px ${Math.round(12 * s)}px`, borderRadius: 999 }}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#0f172a" s={s} />
        </div>
      </div>

      {/* Floating Glass Content Card */}
      <div style={{ 
        position: 'absolute', left: Math.round(20 * s), right: Math.round(20 * s), bottom: Math.round(54 * s),
        background: d.cardBgColor || 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRadius: Math.round(20 * s),
        border: '1px solid rgba(255, 255, 255, 0.5)',
        padding: `${Math.round(20 * s)}px ${Math.round(22 * s)}px`,
        boxShadow: '0 20px 48px rgba(0,0,0,0.18)',
        zIndex: 5, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s),
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'stretch'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(28 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#0f172a', lineHeight: 1.15, letterSpacing: '-0.02em', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#0f172a', d.highlightColor)}
        </div>
        <div style={{ height: 2, background: acc, width: Math.round(40 * s) }} />
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || '#475569', lineHeight: 1.45, width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={false} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'SABER MÁS'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#fff'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 10: FULL BLEED STORY (Photo Hero + Ambient Glass)
// ═══════════════════════════════════════════════════════════════
export const Template_FullBleedBold = ({ d }: { d: FlyerData }) => {
  const W = d.containerW || 540, H = d.containerH || 675;
  const s = getFontScale(W, H, d.textScale ?? 1);
  const acc = d.accent || '#38bdf8';
  return (
    <div 
      onClick={d.onBgClick ? (e) => { e.stopPropagation(); d.onBgClick?.(); } : undefined}
      style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: getFontFamily(d.flyerFont), boxSizing: 'border-box', cursor: d.onBgClick ? 'pointer' : 'default', background: '#0a0e1a' }}
    >
      <div style={{ position: 'absolute', inset: 0, ...imgBg(d.bgImageUrl, d.bgImagePosition) }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(90 * s), background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)', zIndex: 2 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '64%', background: 'linear-gradient(0deg, rgba(10, 14, 26, 0.98) 35%, rgba(10, 14, 26, 0.75) 70%, transparent 100%)', zIndex: 2 }} />
      
      {/* Brand logo top */}
      <div style={{ position: 'absolute', top: Math.round(18 * s), left: Math.round(20 * s), right: Math.round(20 * s), display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div 
          className={d.onLogoClick ? "editable-element" : undefined}
          onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
        >
          <Brand logo={d.logoX !== undefined ? null : d.logoUrl} name={d.companyName || d.industria} color="#fff" s={s} />
        </div>
      </div>

      {/* Details overlay on bottom */}
      <div style={{ 
        position: 'absolute', bottom: Math.round(54 * s), left: Math.round(22 * s), right: Math.round(22 * s), 
        zIndex: 5, display: 'flex', flexDirection: 'column', gap: Math.round(8 * s),
        transform: d.textY ? `translateY(${d.textY}px)` : undefined,
        textAlign: d.textAlign || 'left',
        alignItems: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start'
      }}>
        <div 
          data-element-id="title" className={d.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
          onClick={d.onTitleClick ? (e) => { e.stopPropagation(); d.onTitleClick?.(); } : undefined}
          style={{ fontSize: (Math.round(32 * s)) * (d.titleScale ?? 1), fontWeight: 900, color: d.titleColor || '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', textShadow: '0 4px 16px rgba(0,0,0,0.6)', width: '100%', transform: d.titleY ? `translateY(${d.titleY}px)` : undefined }}
        >
          {renderTitleWithHighlights((d.title || 'TU OFERTA').toUpperCase(), d.titleColor || '#fff', d.highlightColor)}
        </div>
        <div 
          data-element-id="subtitle" className={d.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
          onClick={d.onSubtitleClick ? (e) => { e.stopPropagation(); d.onSubtitleClick?.(); } : undefined}
          style={{ fontSize: Math.round(12 * s * (d.subtitleScale ?? 1)), color: d.subtitleColor || 'rgba(255,255,255,0.85)', lineHeight: 1.45, textShadow: '0 2px 8px rgba(0,0,0,0.5)', width: '100%', transform: d.subtitleY ? `translateY(${d.subtitleY}px)` : undefined }}
        >
          {d.subtitle || ''}
        </div>
        
        <div 
          data-element-id="benefits" className={d.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
          onClick={d.onBenefitsClick ? (e) => { e.stopPropagation(); d.onBenefitsClick?.(); } : undefined}
          style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(6 * s), margin: `${Math.round(4 * s)}px 0`, justifyContent: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start', width: '100%', transform: d.benefitsY ? `translateY(${d.benefitsY}px)` : undefined }}
        >
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <BenChip key={i} text={b} color={acc} s={s} isDark={true} bold={!!d.benefitsBold} />
          ))}
        </div>
        
        <div 
          data-element-id="cta" className={d.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
          onClick={d.onCtaClick ? (e) => { e.stopPropagation(); d.onCtaClick?.(); } : undefined}
          style={{ display: 'inline-block', transform: d.ctaY ? `translateY(${d.ctaY}px)` : undefined }}
        >
          <PillBtn label={d.cta || 'VER MÁS'} bg1={d.ctaBgColor || acc} bg2={d.ctaBgColor ? d.ctaBgColor + 'dd' : acc + 'dd'} color={d.ctaTextColor || '#000'} s={s * (d.ctaScale ?? 1)} />
        </div>
      </div>

      <ContactFooter phone={d.phone} website={d.website} color={d.contactColor} s={s} style={{ transform: d.contactY ? `translateY(${d.contactY}px)` : undefined }} onClick={d.onContactClick} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 0: DIRECT MOCKUP (pure image, no overlays)
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
  { id: 'bold-split', name: '1. Modern Editorial Glass', desc: 'Panel de cristal esmerilado + foto completa y tipografía de alto impacto' },
  { id: 'cinematic', name: '2. Cinematic Full Pro', desc: 'Foto panorámica con gradiente cinemático inferior y tarjetas flotantes' },
  { id: 'white-card', name: '3. White Card Minimal (Apple Style)', desc: 'Fondo fotográfico con tarjeta de cristal blanco puro y diseño limpio' },
  { id: 'magazine', name: '4. Magazine Dark Editorial', desc: 'Estilo portada Forbes/Vogue con degradado oscuro de alta costura' },
  { id: 'center-gradient', name: '5. Gradient Center Pop', desc: 'Tarjeta de cristal centrada con bordes luminosos y máxima atención' },
  { id: 'corporate-light', name: '6. Corporate SaaS & B2B', desc: 'Diseño limpio y tecnológico ideal para software, finanzas y empresas' },
  { id: 'dark-luxury', name: '7. Dark Luxury Gold', desc: 'Fondo ónix profundo con acentos dorados y tipografía serif premium' },
  { id: 'promo-pop', name: '8. Promo Commercial Pop', desc: 'Diseño de alto impacto comercial para ofertas, descuentos e inventario' },
  { id: 'minimal-editorial', name: '9. Minimal Swiss Modern', desc: 'Diseño minimalista moderno con tipografía sobria y espacios abiertos' },
  { id: 'full-bleed', name: '10. Full Bleed Story', desc: 'La foto como protagonista total con degradado continuo y detalles flotantes' },
  { id: 'direct-mockup', name: '0. Mockup Directo (Imagen Pura)', desc: 'Muestra la imagen al 100% sin textos encima' },
];
