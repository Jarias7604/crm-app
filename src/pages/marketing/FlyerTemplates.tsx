import React from 'react';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export interface FlyerData {
  title: string;
  subtitle: string;
  cta: string;
  beneficios: string[];
  accent: string;
  bgImageUrl: string | null;
  logoUrl: string | null;
  industria: string;
  phone: string;
  website: string;
  templateId: string;
}

// ─── BASE STYLES ──────────────────────────────────────────────────────────────
const BASE: React.CSSProperties = {
  width: 540,
  height: 675,
  position: 'relative',
  overflow: 'hidden',
  fontFamily: "'Outfit', 'Inter', sans-serif",
  boxSizing: 'border-box',
};

// Truncate text to max chars
const trunc = (s: string, n: number) => s?.length > n ? s.slice(0, n - 1) + '…' : (s || '');

// Gradient text utility
const GradText = ({ text, from, to, size, weight = 900, style = {} }: { text: string; from: string; to: string; size: number; weight?: number; style?: React.CSSProperties }) => (
  <span style={{
    fontSize: size,
    fontWeight: weight,
    lineHeight: 1.05,
    background: `linear-gradient(135deg, ${from}, ${to})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    display: 'block',
    ...style,
  }}>
    {text}
  </span>
);

// Premium pill button
const PillBtn = ({ label, bg1, bg2, color = '#fff', style = {} }: { label: string; bg1: string; bg2: string; color?: string; style?: React.CSSProperties }) => (
  <div style={{
    background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
    color,
    fontWeight: 900,
    fontSize: 15,
    letterSpacing: '0.08em',
    borderRadius: 50,
    padding: '14px 32px',
    display: 'inline-block',
    boxShadow: `0 8px 24px ${bg1}55`,
    textAlign: 'center',
    ...style,
  }}>
    {label.toUpperCase()}
  </div>
);

// Check benefit row
const BenRow = ({ text, color }: { text: string; color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: 12, fontWeight: 900, color: '#fff',
    }}>✓</div>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{trunc(text, 45)}</span>
  </div>
);

const BenRowDark = ({ text, color }: { text: string; color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: 12, fontWeight: 900, color: '#fff',
    }}>✓</div>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>{trunc(text, 45)}</span>
  </div>
);

// Brand badge
const Brand = ({ logo, name, color = '#fff' }: { logo: string | null; name: string; color?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {logo && <img src={logo} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} crossOrigin="anonymous" />}
    <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '0.05em' }}>{trunc(name, 20).toUpperCase()}</span>
  </div>
);

// Tag pill
const Tag = ({ label, bg, color }: { label: string; bg: string; color: string }) => (
  <div style={{ background: bg, color, fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: '0.06em', display: 'inline-block' }}>
    {label.toUpperCase()}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: BOLD SPLIT — color panel left, photo right
// Like: "RISE WITH LOGISTICS" Pinterest style
// ═══════════════════════════════════════════════════════════════
export const Template_BoldSplit = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#1a56db';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  const words = title.split(' ');
  return (
    <div style={{ ...BASE }}>
      {/* LEFT color panel */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: '52%', height: '100%',
        background: `linear-gradient(160deg, ${acc} 0%, ${acc}cc 100%)`,
        zIndex: 2,
      }} />
      {/* RIGHT photo */}
      {d.bgImageUrl && (
        <div style={{
          position: 'absolute', right: 0, top: 0, width: '55%', height: '100%',
          backgroundImage: `url(${d.bgImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
      )}
      {/* Gradient bleed from color panel into photo */}
      <div style={{
        position: 'absolute', left: '42%', top: 0, width: '20%', height: '100%',
        background: `linear-gradient(90deg, ${acc}ee 0%, transparent 100%)`,
        zIndex: 3,
      }} />
      {/* CONTENT on left panel */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '52%', height: '100%', padding: '28px 24px', display: 'flex', flexDirection: 'column', zIndex: 4, boxSizing: 'border-box' }}>
        {/* Brand */}
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" />
        {/* Huge stacked title */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
          {words.slice(0, 4).map((w, i) => (
            <div key={i} style={{
              fontSize: i === 0 ? 58 : i === 1 ? 52 : 42,
              fontWeight: 900,
              color: i === 1 ? 'rgba(255,255,255,0.78)' : '#fff',
              lineHeight: 1.0,
              textShadow: '0 4px 12px rgba(0,0,0,0.3)',
              letterSpacing: '-0.02em',
            }}>{w}</div>
          ))}
        </div>
        {/* Subtitle */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500, lineHeight: 1.4, marginBottom: 14 }}>
          {trunc(d.subtitle || '', 80)}
        </div>
        {/* Benefits */}
        <div style={{ marginBottom: 16 }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => <BenRow key={i} text={b} color="rgba(255,255,255,0.25)" />)}
        </div>
        {/* CTA */}
        <PillBtn label={d.cta || 'CONTACTAR'} bg1="#fff" bg2="rgba(255,255,255,0.85)" color={acc} style={{ fontSize: 12, padding: '12px 20px', width: '100%', boxSizing: 'border-box' }} />
      </div>
      {/* Contact bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em' }}>{d.phone || '+503 7XXX-XXXX'}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: CINEMATIC FULL — photo top ~60%, solid dark panel bottom
// ═══════════════════════════════════════════════════════════════
export const Template_Cinematic = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#f59e0b';
  return (
    <div style={{ ...BASE, background: '#0f172a' }}>
      {/* TOP: Full photo */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '58%',
        backgroundImage: d.bgImageUrl ? `url(${d.bgImageUrl})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center',
        background: d.bgImageUrl ? undefined : `linear-gradient(135deg, #1e293b, #0f172a)`,
      }}>
        {/* Gradient fade into bottom panel */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(0deg, #0f172a 0%, transparent 100%)' }} />
        {/* Brand top-left */}
        <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 2 }}>
          <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" />
        </div>
        {/* Accent stripe top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${acc}, ${acc}88)` }} />
      </div>

      {/* BOTTOM: Dark info panel */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '44%', padding: '12px 28px 48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Tag */}
        <Tag label={d.industria || 'Marketing'} bg={acc} color="#000" />
        {/* Title */}
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '8px 0' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 40)}
        </div>
        {/* Subtitle */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 400, lineHeight: 1.4, marginBottom: 10 }}>
          {trunc(d.subtitle || '', 90)}
        </div>
        {/* Benefits in horizontal pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${acc}44`, color: '#e2e8f0', fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20 }}>
              {trunc(b, 28)}
            </div>
          ))}
        </div>
        {/* CTA */}
        <PillBtn label={d.cta || 'VER MÁS'} bg1={acc} bg2={acc + 'cc'} color="#000" style={{ fontSize: 13, alignSelf: 'flex-start' }} />
      </div>

      {/* Contact bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 38, background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: 13, letterSpacing: '0.05em' }}>{d.phone || '+503 7XXX-XXXX'}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: WHITE CARD — Clean white, photo top rounded card
// Like IMS UNISON / editorial style
// ═══════════════════════════════════════════════════════════════
export const Template_WhiteCard = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#3b82f6';
  return (
    <div style={{ ...BASE, background: '#f8fafc' }}>
      {/* Top accent stripe */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${acc}, ${acc}88)` }} />

      {/* Brand header */}
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#0f172a" />
        <Tag label={d.industria || 'Premium'} bg={acc} color="#fff" />
      </div>

      {/* Photo card */}
      <div style={{ margin: '16px 20px 0', borderRadius: 16, overflow: 'hidden', height: 210, position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}, ${acc}88)` }} />
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(0deg, rgba(248,250,252,0.9), transparent)' }} />
      </div>

      {/* Info block */}
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Title */}
        <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 30)}
        </div>
        {/* Accent line */}
        <div style={{ height: 4, width: 60, background: acc, borderRadius: 2 }} />
        {/* Subtitle */}
        <div style={{ fontSize: 13, color: '#475569', fontWeight: 400, lineHeight: 1.5 }}>
          {trunc(d.subtitle || '', 100)}
        </div>
        {/* Benefits — 2 col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginTop: 4 }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => (
            <BenRowDark key={i} text={b} color={acc} />
          ))}
        </div>
        {/* CTA */}
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'cc'} color="#fff" style={{ marginTop: 8, textAlign: 'center', fontSize: 13 }} />
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{d.phone || '+503 7XXX-XXXX'} {d.website ? `· ${d.website}` : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4: MAGAZINE DARK — Dark left panel with huge type, photo right
// Like Forbes / Vogue editorial
// ═══════════════════════════════════════════════════════════════
export const Template_Magazine = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#ef4444';
  const title = (d.title || 'TU OFERTA').toUpperCase();
  return (
    <div style={{ ...BASE, display: 'flex' }}>
      {/* LEFT: Dark editorial panel */}
      <div style={{ width: '48%', background: '#09090f', display: 'flex', flexDirection: 'column', padding: '24px 20px', boxSizing: 'border-box', position: 'relative', zIndex: 2 }}>
        {/* Left accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 5, background: `linear-gradient(180deg, ${acc}, ${acc}44)` }} />
        {/* Brand */}
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS'} color={acc} />
        <div style={{ height: 1, background: `${acc}44`, margin: '12px 0' }} />
        {/* HUGE stacked title */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {title.split(' ').slice(0, 4).map((w, i) => (
            <div key={i} style={{
              fontSize: i === 0 ? 54 : i === 1 ? 48 : 38,
              fontWeight: 900,
              color: i === 1 ? acc : '#fff',
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
            }}>{w}</div>
          ))}
        </div>
        {/* Divider */}
        <div style={{ height: 3, background: acc, margin: '12px 0', width: '40%' }} />
        {/* Subtitle */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 14 }}>
          {trunc(d.subtitle || '', 80)}
        </div>
        {/* Benefits */}
        <div style={{ marginBottom: 14 }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => <BenRow key={i} text={b} color={acc} />)}
        </div>
        {/* CTA */}
        <PillBtn label={d.cta || 'MÁS INFO'} bg1={acc} bg2={acc + 'bb'} color="#fff" style={{ fontSize: 12, padding: '12px 16px' }} />
        {/* Phone */}
        <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{d.phone || '+503 7XXX-XXXX'}</div>
      </div>

      {/* RIGHT: Photo full height */}
      <div style={{ flex: 1, position: 'relative' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, #0f172a)` }} />
        )}
        {/* Fade from left panel */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%', background: 'linear-gradient(90deg, #09090f, transparent)' }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5: CENTER GRADIENT — Vivid gradient, photo card, centered text
// Like "WE'RE OPEN" social ad
// ═══════════════════════════════════════════════════════════════
export const Template_CenterGradient = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#7c3aed';
  return (
    <div style={{ ...BASE, background: `linear-gradient(160deg, ${acc} 0%, ${acc}88 50%, #08031a 100%)`, padding: '0' }}>
      {/* Top brand bar */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS'} color="#fff" />
        <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 800, color: '#fff' }}>
          ★ PREMIUM
        </div>
      </div>

      {/* Photo card — rounded, centered */}
      <div style={{ margin: '8px 28px', borderRadius: 20, overflow: 'hidden', height: 220, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.1)' }} />
        )}
      </div>

      {/* Content below photo */}
      <div style={{ padding: '16px 28px', textAlign: 'center' }}>
        {/* Title */}
        <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: '0 4px 16px rgba(0,0,0,0.5)', marginBottom: 8 }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 25)}
        </div>
        {/* Subtitle */}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 400, lineHeight: 1.5, marginBottom: 14 }}>
          {trunc(d.subtitle || '', 80)}
        </div>
        {/* Benefits row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20 }}>
              ✓ {trunc(b, 24)}
            </div>
          ))}
        </div>
        {/* CTA */}
        <PillBtn label={d.cta || 'EMPEZAR'} bg1="rgba(255,255,255,0.95)" bg2="rgba(255,255,255,0.75)" color={acc} style={{ fontSize: 14, minWidth: 200 }} />
      </div>

      {/* Contact bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 38, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{d.phone || '+503 7XXX-XXXX'}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6: CORPORATE LIGHT — White left panel, photo right
// Clean, professional, B2B style
// ═══════════════════════════════════════════════════════════════
export const Template_CorporateLight = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#1e40af';
  return (
    <div style={{ ...BASE, display: 'flex', background: '#fff' }}>
      {/* LEFT: White info panel */}
      <div style={{ width: '50%', padding: '28px 22px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', borderRight: `4px solid ${acc}` }}>
        {/* Top accent */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${acc}, ${acc}44)`, marginBottom: 18, borderRadius: 2 }} />
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={acc} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: 20 }}>
          <Tag label={d.industria || 'Servicios'} bg={acc} color="#fff" />
          <div style={{ fontSize: 38, fontWeight: 900, color: '#0f172a', lineHeight: 1.05, letterSpacing: '-0.03em', margin: '12px 0 8px' }}>
            {trunc((d.title || 'TU OFERTA').toUpperCase(), 22)}
          </div>
          <div style={{ height: 4, background: acc, width: 50, borderRadius: 2, marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 400, lineHeight: 1.5, marginBottom: 16 }}>
            {trunc(d.subtitle || '', 100)}
          </div>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} color={acc} />)}
        </div>
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'cc'} color="#fff" style={{ marginTop: 12, fontSize: 12, padding: '12px 20px' }} />
        <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{d.phone}</div>
      </div>

      {/* RIGHT: Photo */}
      <div style={{ flex: 1, position: 'relative' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, ${acc}22)` }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, #fff, transparent)' }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 7: DARK LUXURY — Ultra dark, gold accents, framed photo
// ═══════════════════════════════════════════════════════════════
export const Template_DarkLuxury = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#D4AF37';
  return (
    <div style={{ ...BASE, background: 'linear-gradient(160deg, #060612 0%, #0d0d1f 100%)' }}>
      {/* Gold top stripe */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${acc}, ${acc}88)` }} />

      {/* Header */}
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${acc}22` }}>
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color={acc} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{d.website || 'www.empresa.com'}</span>
      </div>

      {/* Framed photo */}
      <div style={{ margin: '16px 24px', borderRadius: 16, overflow: 'hidden', height: 230, border: `2px solid ${acc}55`, boxShadow: `0 0 30px ${acc}33`, position: 'relative' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `radial-gradient(ellipse, ${acc}22, #060612)` }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #060612 0%, transparent 50%)' }} />
      </div>

      {/* Content */}
      <div style={{ padding: '8px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 6 }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 28)}
        </div>
        <div style={{ height: 3, width: 80, background: acc, borderRadius: 2, margin: '8px auto 10px' }} />
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 14 }}>
          {trunc(d.subtitle || '', 80)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, textAlign: 'left' }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${acc}33`, borderRadius: 10, padding: '8px 14px' }}>
              <span style={{ color: acc, fontWeight: 900, flexShrink: 0 }}>★</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>{trunc(b, 42)}</span>
            </div>
          ))}
        </div>
        <PillBtn label={d.cta || 'CONTACTAR'} bg1={acc} bg2={acc + 'bb'} color="#000" style={{ fontSize: 13, minWidth: 220 }} />
      </div>

      {/* Bottom gold bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 38, background: `linear-gradient(90deg, ${acc}, ${acc}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: 13, letterSpacing: '0.05em' }}>{d.phone || '+503 7XXX-XXXX'}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 8: PROMO POP — Bold discount badge, bright energy
// Like "40% OFF Sitewide" style
// ═══════════════════════════════════════════════════════════════
export const Template_PromoPop = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#f59e0b';
  return (
    <div style={{ ...BASE, background: '#fff' }}>
      {/* Full photo top half */}
      <div style={{ height: 310, position: 'relative', overflow: 'hidden' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}, ${acc}44)` }} />
        )}
        {/* Diagonal cut overlay */}
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 60, background: '#fff', clipPath: 'polygon(0 60%, 100% 0, 100% 100%, 0 100%)' }} />
        {/* Brand top-left */}
        <div style={{ position: 'absolute', top: 16, left: 20 }}>
          <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" />
        </div>
        {/* Promo badge top-right */}
        <div style={{ position: 'absolute', top: 12, right: 20, background: acc, borderRadius: '50%', width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${acc}66` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#000', lineHeight: 1 }}>HOY</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>ESPECIAL</div>
        </div>
      </div>

      {/* Info section white */}
      <div style={{ padding: '4px 24px 48px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Tag label={d.industria || 'Promo'} bg={acc} color="#000" />
        <div style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 28)}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          {trunc(d.subtitle || '', 90)}
        </div>
        {/* Benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} color={acc} />)}
        </div>
        <PillBtn label={d.cta || 'OBTENER OFERTA'} bg1={acc} bg2={acc + 'cc'} color="#000" style={{ fontSize: 13, marginTop: 8 }} />
      </div>

      {/* Contact bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 38, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{d.phone || '+503 7XXX-XXXX'}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 9: MINIMAL EDITORIAL — Clean white, large typography
// Like Charles Schwab / smart premium
// ═══════════════════════════════════════════════════════════════
export const Template_MinimalEditorial = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#0ea5e9';
  return (
    <div style={{ ...BASE, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Photo — full width, 45% height */}
      <div style={{ height: 300, position: 'relative', overflow: 'hidden' }}>
        {d.bgImageUrl ? (
          <img src={d.bgImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${acc}44, ${acc}22)` }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, #fff 0%, transparent 40%)` }} />
        <div style={{ position: 'absolute', top: 16, left: 20 }}>
          <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" />
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: acc }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '8px 24px 44px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Tag label={d.industria || 'Servicio'} bg={`${acc}22`} color={acc} />
        {/* Huge clean title */}
        <GradText text={trunc((d.title || 'TU OFERTA').toUpperCase(), 28)} from={acc} to={acc + 'aa'} size={38} />
        <div style={{ height: 3, background: acc, width: 50, borderRadius: 2 }} />
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{trunc(d.subtitle || '', 100)}</div>
        {/* 2-col benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', flex: 1 }}>
          {(d.beneficios || []).slice(0, 4).map((b, i) => <BenRowDark key={i} text={b} color={acc} />)}
        </div>
        <PillBtn label={d.cta || 'SABER MÁS'} bg1={acc} bg2={acc + 'bb'} color="#fff" style={{ fontSize: 13, marginTop: 4 }} />
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{d.phone || '+503 7XXX-XXXX'}{d.website ? ` · ${d.website}` : ''}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 10: FULL BLEED BOLD — Full photo, large text overlay bottom
// ═══════════════════════════════════════════════════════════════
export const Template_FullBleedBold = ({ d }: { d: FlyerData }) => {
  const acc = d.accent || '#22d3ee';
  return (
    <div style={{ ...BASE }}>
      {/* Full bleed photo */}
      {d.bgImageUrl ? (
        <img src={d.bgImageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${acc}44, #0f172a)` }} />
      )}

      {/* Top gradient for brand */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }} />

      {/* Bottom solid panel for text — clean, always readable */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%', background: `linear-gradient(0deg, rgba(0,0,0,0.96) 60%, transparent 100%)` }} />

      {/* Accent left bar */}
      <div style={{ position: 'absolute', left: 0, top: '52%', bottom: 0, width: 5, background: acc }} />

      {/* Brand top */}
      <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <Brand logo={d.logoUrl} name={d.industria || 'ARIAS GROUP'} color="#fff" />
        <Tag label="PREMIUM" bg={acc} color="#000" />
      </div>

      {/* Content bottom */}
      <div style={{ position: 'absolute', bottom: 38, left: 20, right: 20, zIndex: 5 }}>
        <div style={{ fontSize: 46, fontWeight: 900, color: '#fff', lineHeight: 1.0, letterSpacing: '-0.03em', textShadow: '0 4px 20px rgba(0,0,0,0.8)', marginBottom: 8 }}>
          {trunc((d.title || 'TU OFERTA').toUpperCase(), 25)}
        </div>
        <div style={{ height: 3, background: acc, width: 60, borderRadius: 2, marginBottom: 10 }} />
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>
          {trunc(d.subtitle || '', 80)}
        </div>
        {/* Benefits compact */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {(d.beneficios || []).slice(0, 3).map((b, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${acc}55`, color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 16 }}>
              ✓ {trunc(b, 22)}
            </div>
          ))}
        </div>
        <PillBtn label={d.cta || 'VER MÁS'} bg1={acc} bg2={acc + 'bb'} color="#000" style={{ fontSize: 13 }} />
      </div>

      {/* Contact bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#000', fontWeight: 900, fontSize: 12, letterSpacing: '0.04em' }}>{d.phone || '+503 7XXX-XXXX'}</span>
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
