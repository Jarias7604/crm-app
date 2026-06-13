// FlyerTemplates.tsx — Professional HTML flyer templates
// These render pixel-perfect marketing flyers identical to ChatGPT quality
// Captured to PNG using html-to-image library

import React from 'react';

export interface FlyerData {
  company_name: string;
  headline?: string;
  subheadline?: string;
  prompt: string;
  cta: string;
  price?: string;
  phone?: string;
  email?: string;
  website?: string;
  features?: string[];
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  tone?: string;
  bgImageUrl?: string;
}

// ── Utility: clean phrases from bullet points or numbers ──────────────────────
function cleanPhrase(text: string): string {
  return text
    .replace(/^[-*•+\s\d.]+\s*/, '') // Remove bullet points or numbers at start
    .replace(/[;.,—:|]+$/, '')        // Remove trailing punctuation
    .trim();
}

export interface ParsedPrompt {
  title?: string;
  subtitle?: string;
  features?: string[];
  price?: string;
  cta?: string;
  phone?: string;
  website?: string;
}

export function parsePrompt(prompt: string): ParsedPrompt {
  if (!prompt) return {};

  const tags = [
    { key: 'title', regex: /(?:t[íi]tulo(?: principal| del flyer)?|headline)\s*[:：]/i },
    { key: 'subtitle', regex: /(?:subt[íi]tulo(?: del flyer)?|sub-headline|bajada)\s*[:：]/i },
    { key: 'features', regex: /(?:incluye|ofrece|beneficios|caracter[íi]sticas|servicios|lleva|contiene)\s*[:：]/i },
    { key: 'price', regex: /(?:precio|costo|desde|price|valor)\s*[:：]/i },
    { key: 'cta', regex: /(?:cta|bot[oó]n|llamada a la acci[oó]n|acci[oó]n|accion)\s*[:：]/i },
    { key: 'phone', regex: /(?:whatsapp|tel[eé]fono|contacto|celular|phone)\s*[:：]/i },
    { key: 'website', regex: /(?:sitio(?: web)?|web|p[aá]gina|link|url|website)\s*[:：]/i },
  ];

  const matches: { key: string; start: number; end: number }[] = [];
  for (const tag of tags) {
    const match = tag.regex.exec(prompt);
    if (match) {
      matches.push({
        key: tag.key,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const result: ParsedPrompt = {};

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const valStart = current.end;
    const valEnd = next ? next.start : prompt.length;
    let val = prompt.substring(valStart, valEnd).trim();
    
    val = val.replace(/^[:：\s,.-]+|[:：\s,.-]+$/g, '');

    if (current.key === 'title') result.title = val;
    else if (current.key === 'subtitle') result.subtitle = val;
    else if (current.key === 'price') result.price = val;
    else if (current.key === 'cta') result.cta = val;
    else if (current.key === 'phone') result.phone = val;
    else if (current.key === 'website') result.website = val;
    else if (current.key === 'features') {
      result.features = val
        .split(/[,;\n]|y\s+/)
        .map(item => item.trim().replace(/^[:：\s,.-]+|[:：\s,.-]+$/g, ''))
        .filter(item => item.length > 2);
    }
  }

  return result;
}

export function getFeatureIcon(f: string): string {
  const lower = f.toLowerCase();
  if (lower.includes('factur') || lower.includes('dte')) return '📄';
  if (lower.includes('inventario') || lower.includes('bodega') || lower.includes('stock')) return '📦';
  if (lower.includes('client') || lower.includes('crm') || lower.includes('lead')) return '👥';
  if (lower.includes('report') || lower.includes('analit') || lower.includes('dashboard') || lower.includes('métrica')) return '📊';
  if (lower.includes('hacienda') || lower.includes('mh') || lower.includes('cumple')) return '✅';
  if (lower.includes('soporte') || lower.includes('24/7') || lower.includes('atencion')) return '🛠️';
  if (lower.includes('nube') || lower.includes('cloud') || lower.includes('web')) return '☁️';
  if (lower.includes('segur') || lower.includes('segundo') || lower.includes('respaldo')) return '🔒';
  if (lower.includes('configur') || lower.includes('rapido') || lower.includes('fácil') || lower.includes('facil')) return '⚡';
  return '✨';
}

// ── Utility: derive headline from prompt ──────────────────────────────────────
export function deriveHeadline(prompt: string, company: string): { h1: string; h2: string } {
  if (!prompt || !prompt.trim()) {
    return { h1: 'Diseño Profesional', h2: company };
  }

  // 1. Look for explicit tags like Título/Subtítulo or Headline/Subheadline
  const titleMatch = prompt.match(/(?:t[íi]tulo|headline|t[íi]tulo del flyer|t[íi]tulo principal)\s*[:：]\s*([^\n|;.-]+)/i);
  const subMatch = prompt.match(/(?:subt[íi]tulo|subheadline|descripci[oó]n corta)\s*[:：]\s*([^\n|;.-]+)/i);

  let h1 = '';
  let h2 = '';

  if (titleMatch && titleMatch[1]) {
    h1 = cleanPhrase(titleMatch[1]);
  }
  if (subMatch && subMatch[1]) {
    h2 = cleanPhrase(subMatch[1]);
  }

  if (h1 && h2) return { h1, h2 };

  // 2. Look for splitters like double newlines or single newlines
  const lines = prompt.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  if (!h1 && lines.length > 0 && lines[0].split(/\s+/).length <= 10) {
    h1 = cleanPhrase(lines[0]);
    if (!h2 && lines.length > 1) {
      h2 = cleanPhrase(lines[1]);
    }
  }

  // 3. Look for dashes or bullets as separators
  if (!h1) {
    const parts = prompt.split(/[—|•]|\s{2,}/);
    if (parts.length > 1 && parts[0].trim().split(/\s+/).length <= 10) {
      h1 = cleanPhrase(parts[0]);
      h2 = cleanPhrase(parts[1]);
    }
  }

  // Fallbacks
  if (!h1) {
    const words = prompt.trim().split(/\s+/);
    h1 = words.slice(0, 6).join(' ');
    h1 = cleanPhrase(h1);
  }

  if (!h2) {
    const words = prompt.trim().split(/\s+/);
    if (words.length > 6) {
      h2 = words.slice(6, 15).join(' ');
      h2 = cleanPhrase(h2);
    } else {
      h2 = `${company} — Innovación a tu alcance`;
    }
  }

  // Capitalize first letter
  if (h1.length > 0) h1 = h1.charAt(0).toUpperCase() + h1.slice(1);
  if (h2.length > 0) h2 = h2.charAt(0).toUpperCase() + h2.slice(1);

  return { h1, h2 };
}

// ── Utility: derive features from prompt ──────────────────────────────────────
export function deriveFeatures(prompt: string): string[] {
  if (!prompt || !prompt.trim()) return [];

  const features: string[] = [];

  // 1. Try to find bullet points or list items
  const listMatches = prompt.matchAll(/(?:[-*•+]|\b\d\.)\s*([^\n,;•-]+)/g);
  for (const match of listMatches) {
    const val = cleanPhrase(match[1]);
    if (val.length > 3 && val.length < 35 && !features.includes(val)) {
      features.push(val);
    }
  }

  // 2. Try to find comma-separated items after list indicators
  if (features.length < 3) {
    const listMatch = prompt.match(/(?:incluye|ofrece|beneficios|caracter[íi]sticas|servicios|lleva|contiene)\s*[:：]?\s*([^.\n]+)/i);
    if (listMatch && listMatch[1]) {
      const items = listMatch[1].split(/[,;]|y\s+/).map(i => cleanPhrase(i)).filter(i => i.length > 3 && i.length < 35);
      items.forEach(item => {
        if (!features.includes(item) && features.length < 4) {
          features.push(item);
        }
      });
    }
  }

  // 3. Fallback to keyword search in prompt
  const lower = prompt.toLowerCase();
  if (lower.includes('factur') && !features.includes('Facturación Electrónica')) {
    features.push('Facturación Electrónica');
  }
  if ((lower.includes('inventario') || lower.includes('bodega') || lower.includes('compras')) && !features.includes('Inventario y Bodega')) {
    features.push('Inventario y Bodega');
  }
  if ((lower.includes('venta') || lower.includes('cliente') || lower.includes('crm')) && !features.includes('Control de Clientes')) {
    features.push('Control de Clientes');
  }
  if ((lower.includes('reporte') || lower.includes('analítica') || lower.includes('dashboard') || lower.includes('métrica')) && !features.includes('Reportes en Tiempo Real')) {
    features.push('Reportes en Tiempo Real');
  }
  if ((lower.includes('hacienda') || lower.includes('dte') || lower.includes('mh')) && !features.includes('100% Cumple con MH')) {
    features.push('100% Cumple con MH');
  }
  if ((lower.includes('soporte') || lower.includes('ayuda') || lower.includes('atencion')) && !features.includes('Soporte Premium 24/7')) {
    features.push('Soporte Premium 24/7');
  }
  if ((lower.includes('nube') || lower.includes('cloud') || lower.includes('web')) && !features.includes('Acceso en la Nube')) {
    features.push('Acceso en la Nube');
  }
  if ((lower.includes('seguridad') || lower.includes('seguro') || lower.includes('respaldo')) && !features.includes('Seguridad Garantizada')) {
    features.push('Seguridad Garantizada');
  }

  // 4. Fill to 3 features with default high-quality items if empty
  while (features.length < 3) {
    const defaults = ['Fácil de Configurar', 'Seguridad Garantizada', 'Acceso en la Nube', 'Soporte 24/7'];
    const next = defaults.find(d => !features.includes(d));
    if (next) features.push(next); else break;
  }

  return features.slice(0, 3); // Max 3 features looks best on our layouts
}

// ── Utility: derive price from prompt ─────────────────────────────────────────
export function derivePrice(prompt: string): string {
  const match = prompt.match(/\$[\d,.]+/);
  if (match) return match[0];
  const match2 = prompt.match(/([\d,.]+)\s*(d[oó]lar|d[oó]lares|dollar|usd)/i);
  if (match2) return '$' + match2[1];
  return ''; 
}

// ── Utility: derive phone from prompt ─────────────────────────────────────────
function derivePhone(prompt: string, defaultPhone?: string): string {
  const match = prompt.match(/(?:📱|whatsapp|tel|tel[eé]fono|celular|cel|llama al|contacto:)\s*[:：]?\s*(\+?[\d\s()-]{8,18}\b)/i);
  if (match) {
    const clean = match[1].trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 7) return clean;
  }
  return defaultPhone || '';
}

// ── Utility: derive website from prompt ───────────────────────────────────────
function deriveWebsite(prompt: string, defaultWebsite?: string): string {
  const match = prompt.match(/(?:🌐|sitio|web|visita|url:|link:|www\.)\s*[:：]?\s*(\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]{2,}\b)/i);
  if (match) {
    const clean = match[1].trim().toLowerCase();
    if (!clean.includes('hacienda.gob') && !clean.includes('mh.gob') && clean.length > 4) {
      return clean;
    }
  }
  return defaultWebsite || '';
}

// ── Utility: derive CTA from prompt ───────────────────────────────────────────
function deriveCta(prompt: string, defaultCta?: string): string {
  const match = prompt.match(/(?:cta|bot[oó]n|llamado a la acci[oó]n|acci[oó]n)\s*[:：]\s*([^\n|;.-]+)/i);
  if (match && match[1]) {
    return cleanPhrase(match[1]);
  }
  return defaultCta || 'Contáctanos HOY';
}

// ── ICON SVGs ─────────────────────────────────────────────────────────────────
const icons: Record<string, string> = {
  'Facturación Electrónica': '📄',
  'Inventario y Bodega': '📦',
  'Control de Clientes': '👥',
  'Reportes en Tiempo Real': '📊',
  '100% Cumple con MH': '✅',
  'Soporte Premium 24/7': '🛠️',
  'Acceso en la Nube': '☁️',
  'Seguridad Garantizada': '🔒',
  'Fácil de Configurar': '⚡',
};

// ── TEMPLATE A — Classic Corporate (Redesigned with Mockups & Premium Aesthetics) ───
export const FlyerTemplateA = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#e91e8c';
    const secondary = data.secondaryColor || '#1a1a2e';
    const price = data.price || parsed.price || derivePrice(data.prompt);
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1;
    const subheadline = data.subheadline || parsed.subtitle || h2;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, 'Contáctanos HOY');

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: data.bgImageUrl ? `url(${data.bgImageUrl}) center/cover no-repeat` : `radial-gradient(circle at 100% 0%, ${primary}08 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 0% 100%, ${secondary}05 0%, rgba(255,255,255,0) 45%), #ffffff`,
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Background Grid */}
        {!data.bgImageUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
            backgroundSize: '30px 30px',
            opacity: 0.35,
            pointerEvents: 'none'
          }} />
        )}

        {/* TOP SECTION */}
        <div style={{ padding: '52px 64px 24px', flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          {/* Left: Headline & Price */}
          <div style={{ flex: 1, marginRight: 32 }}>
            <div style={{
              fontSize: headline.length > 30 ? 36 : 44,
              fontWeight: 900,
              color: data.bgImageUrl ? '#ffffff' : '#0f172a',
              textShadow: data.bgImageUrl ? '0 4px 10px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.7)' : 'none',
              lineHeight: 1.1,
              letterSpacing: 'normal',
              marginBottom: 10
            }}>
              {headline.split('NEGOCIO').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}{i < arr.length - 1 && <span style={{ color: primary }}>NEGOCIO</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: data.bgImageUrl ? '#f1f5f9' : '#475569',
              textShadow: data.bgImageUrl ? '0 2px 6px rgba(0,0,0,0.8)' : 'none',
              marginBottom: 24
            }}>{subheadline}</div>

            {price && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 14,
                background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, borderRadius: 16, padding: '14px 32px',
                boxShadow: `0 10px 25px ${primary}35`, border: '1px solid rgba(255,255,255,0.15)'
              }}>
                <span style={{ fontSize: 16, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desde</span>
                <span style={{ fontSize: 44, color: '#fff', fontWeight: 900, lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>+ IVA</span>
              </div>
            )}
          </div>

          {/* Right: Brand Logo */}
          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {data.logoUrl ? (
              <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 90, maxWidth: 220, objectFit: 'contain', filter: data.bgImageUrl ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' : 'none' }} alt="Brand Logo" />
            ) : (
              <div style={{ padding: '14px 24px', background: data.bgImageUrl ? 'rgba(255,255,255,0.95)' : `${primary}08`, borderRadius: 16, border: `2px dashed ${primary}60`, boxShadow: data.bgImageUrl ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: primary, letterSpacing: '0.02em' }}>{data.company_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE — Features + Laptop Mockup */}
        <div style={{ flex: 1, display: 'flex', padding: '0 64px', gap: 48, zIndex: 10, alignItems: 'center' }}>
          {/* LEFT: Features list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 18,
                background: data.bgImageUrl ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 20,
                padding: '20px 24px', boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `linear-gradient(135deg, ${primary}12, ${primary}25)`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: primary
                }}>
                  {getFeatureIcon(f)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>{f}</div>
                  <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.4, fontWeight: 500 }}>
                    Gestiona de forma simple, rápida y segura.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: Laptop Mockup */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', width: 400, filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.12))' }}>
              {/* Laptop Screen */}
              <div style={{
                background: '#1e293b', borderRadius: '16px 16px 0 0',
                padding: '12px 12px 0', position: 'relative',
                border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none'
              }}>
                {/* Browser Dots */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
                </div>
                {/* Dashboard Screen */}
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, height: 230, border: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ background: secondary, borderRadius: 6, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.02em' }}>Dashboard Activo</span>
                    <span style={{ color: primary, fontSize: 14, fontWeight: 900 }}>●</span>
                  </div>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {['$24,560', '$8,340', '1,250', '320'].map((v, idx) => (
                      <div key={idx} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: '#64748b', marginBottom: 2, fontWeight: 700 }}>{['Ventas', 'Compras', 'Clientes', 'DTEs'][idx]}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a' }}>{v}</div>
                        <div style={{ fontSize: 7, color: '#10b981', fontWeight: 800 }}>+{[12, 6, 8, 15][idx]}%</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, marginBottom: 8, display: 'flex', alignItems: 'flex-end', gap: 4, height: 62 }}>
                    {[35, 55, 45, 75, 50, 85, 65, 95].map((h, idx) => (
                      <div key={idx} style={{
                        flex: 1, background: idx === 7 ? primary : `${primary}45`,
                        borderRadius: '2px 2px 0 0', height: `${h}%`,
                      }} />
                    ))}
                  </div>
                  {/* Table */}
                  {['Arias Defense', 'Cliente Premium', 'Corporación Alfa'].map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 8, color: '#334155', fontWeight: 600 }}>{c}</span>
                      <span style={{ fontSize: 8, color: primary, fontWeight: 800 }}>${(1650 - idx * 400).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Laptop Base */}
              <div style={{ background: '#e2e8f0', height: 12, borderRadius: '0 0 4px 4px', border: '1px solid #cbd5e1' }} />
              <div style={{ background: '#cbd5e1', height: 6, borderRadius: '0 0 10px 10px', width: '110%', marginLeft: '-5%' }} />
            </div>
          </div>
        </div>

        {/* BOTTOM BENEFITS */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '28px 64px', display: 'flex', gap: 24, zIndex: 10 }}>
          {[
            { label: 'Resultados inmediatos', desc: 'Ahorra tiempo y enfócate en hacer crecer tu negocio.', icon: '⚡' },
            { label: 'Seguridad total', desc: 'Tus datos protegidos con respaldo automático en la nube.', icon: '🔒' },
            { label: 'Mayor rentabilidad', desc: 'Optimiza tus procesos y maximiza tus ganancias hoy.', icon: '📈' }
          ].map((item, idx) => (
            <div key={idx} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 14,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
              padding: '16px 20px', boxShadow: '0 4px 12px rgba(15,23,42,0.03)'
            }}>
              <span style={{ fontSize: 26 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: primary, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, lineHeight: 1.3 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ background: secondary, padding: '24px 64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: 'normal' }}>{data.company_name}</div>
          <div style={{ display: 'flex', gap: 32 }}>
            {phone && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>📱 {phone}</span>}
            {website && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>🌐 {website}</span>}
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, borderRadius: 10, padding: '12px 28px',
            color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            boxShadow: `0 6px 15px ${primary}35`, border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {cta}
          </div>
        </div>
      </div>
    );
  }
);

// ── TEMPLATE B — Bold Professional (Mockups & Deep Red theme) ───────────
export const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#9b1c1c';
    const secondary = data.secondaryColor || '#1a1a2e';
    const price = data.price || parsed.price || derivePrice(data.prompt) || '$12.95';
    const rawFeatures = data.features || parsed.features || deriveFeatures(data.prompt);
    
    // Enforce exactly 4 features for the 4 side layout quadrants (2 left, 2 right)
    const defaultFeatures = [
      'Facturación Electrónica',
      'Control de Ventas',
      'Gestión de Inventario',
      'Módulo de Compras'
    ];
    const features: string[] = [];
    for (let i = 0; i < 4; i++) {
      features.push(rawFeatures[i] || defaultFeatures[i]);
    }

    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1 || '¿Sin control de tu NEGOCIO?';
    const subheadline = data.subheadline || parsed.subtitle || h2 || `${data.company_name} todo en un solo sistema`;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, `Todo con ${data.company_name}`);

    // Parse the headline parts to color the word "NEGOCIO" in primaryColor if present
    const renderHeadline = () => {
      const parts = headline.split(/(NEGOCIO)/g);
      return parts.map((part, i) => {
        if (part === 'NEGOCIO') {
          return <span key={i} style={{ color: primary }}>NEGOCIO</span>;
        }
        return part;
      });
    };

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: data.bgImageUrl ? `url(${data.bgImageUrl}) center/cover no-repeat` : '#f8fafc',
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Subtle grid backdrop */}
        {!data.bgImageUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
            opacity: 0.5,
            pointerEvents: 'none'
          }} />
        )}

        {/* HEADER SECTION */}
        <div style={{ paddingTop: 45, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, paddingLeft: 60, paddingRight: 60 }}>
          <h1 style={{
            fontSize: headline.length > 30 ? 44 : 52,
            fontWeight: 900,
            color: '#0f172a',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: data.bgImageUrl ? '0 4px 12px rgba(255,255,255,0.95)' : 'none'
          }}>
            {renderHeadline()}
          </h1>
          <p style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#334155',
            textAlign: 'center',
            margin: '8px 0 0 0',
            textShadow: data.bgImageUrl ? '0 2px 6px rgba(255,255,255,0.9)' : 'none'
          }}>
            {subheadline}
          </p>
        </div>

        {/* CENTER ELEMENT: LAPTOP + SIDE FEATURES + CONNECTIONS */}
        <div style={{ position: 'relative', flex: 1, zIndex: 5 }}>
          
          {/* 1. Incline Price Tag */}
          <div style={{
            position: 'absolute',
            top: 60,
            left: 360,
            transform: 'rotate(-8deg)',
            background: primary,
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 12,
            fontWeight: 900,
            fontSize: 24,
            zIndex: 15,
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 4
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>Desde</span>
            <span>{price}</span>
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.95 }}>+ IVA</span>
          </div>

          {/* 2. Side Features */}
          {/* FEATURE 0: Top Left */}
          <div style={{
            position: 'absolute',
            top: 80,
            left: 60,
            width: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 10
          }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              background: '#fff', border: `3px solid ${primary}`,
              color: primary, fontSize: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0,0,0,0.08)'
            }}>
              {getFeatureIcon(features[0])}
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 12, lineHeight: 1.2 }}>
              {features[0]}
            </span>
          </div>

          {/* FEATURE 1: Bottom Left */}
          <div style={{
            position: 'absolute',
            top: 290,
            left: 60,
            width: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 10
          }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              background: '#fff', border: `3px solid ${primary}`,
              color: primary, fontSize: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0,0,0,0.08)'
            }}>
              {getFeatureIcon(features[1])}
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 12, lineHeight: 1.2 }}>
              {features[1]}
            </span>
          </div>

          {/* FEATURE 2: Top Right */}
          <div style={{
            position: 'absolute',
            top: 80,
            right: 60,
            width: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 10
          }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              background: '#fff', border: `3px solid ${primary}`,
              color: primary, fontSize: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0,0,0,0.08)'
            }}>
              {getFeatureIcon(features[2])}
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 12, lineHeight: 1.2 }}>
              {features[2]}
            </span>
          </div>

          {/* FEATURE 3: Bottom Right */}
          <div style={{
            position: 'absolute',
            top: 290,
            right: 60,
            width: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 10
          }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              background: '#fff', border: `3px solid ${primary}`,
              color: primary, fontSize: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0,0,0,0.08)'
            }}>
              {getFeatureIcon(features[3])}
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 12, lineHeight: 1.2 }}>
              {features[3]}
            </span>
          </div>

          {/* 3. Dotted Connection Lines */}
          <div style={{ position: 'absolute', top: 118, left: 210, width: 150, borderBottom: '3px dashed #cbd5e1', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 328, left: 210, width: 150, borderBottom: '3px dashed #cbd5e1', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 118, right: 210, width: 150, borderBottom: '3px dashed #cbd5e1', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 328, right: 210, width: 150, borderBottom: '3px dashed #cbd5e1', zIndex: 1 }} />

          {/* 4. Large Centered Laptop */}
          <div style={{
            position: 'absolute',
            top: 250,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 520,
            zIndex: 5,
            filter: 'drop-shadow(0 20px 35px rgba(0,0,0,0.12))'
          }}>
            {/* Screen */}
            <div style={{
              background: '#1e293b', borderRadius: '16px 16px 0 0',
              padding: '10px 10px 0', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none'
            }}>
              {/* Browser Dots */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
              </div>
              
              {/* Dashboard Content */}
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, height: 230, border: '1px solid rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', marginBottom: 8, borderRadius: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#334155' }}>Resumen del Negocio</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {['Hoy', 'Semana', 'Este mes', 'Este año', 'Todo'].map((t, idx) => (
                      <span key={idx} style={{ fontSize: 6, background: idx === 2 ? '#f1f5f9' : 'transparent', color: '#64748b', padding: '2px 4px', borderRadius: 3, fontWeight: idx === 2 ? 800 : 500 }}>{t}</span>
                    ))}
                  </div>
                </div>

                {/* KPIs Grid */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {[
                    { label: 'Ventas del Mes', val: '$5,234.75', change: '+18.4% vs mes anterior' },
                    { label: 'Cuentas por Cobrar', val: '$1,414.55', change: 'Vencidas: 15. Por vencer: 8' },
                    { label: 'Gastos del Mes', val: '$1,774.55', change: '-6.7% vs mes anterior' },
                    { label: 'Utilidad del Mes', val: '$2,160.20', change: '+12.3% vs mes anterior' },
                  ].map((kpi, idx) => (
                    <div key={idx} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '5px 6px' }}>
                      <div style={{ fontSize: 6, color: '#64748b', fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap' }}>{kpi.label}</div>
                      <div style={{ fontSize: 9, fontWeight: 900, color: '#0f172a' }}>{kpi.val}</div>
                      <div style={{ fontSize: 5, color: kpi.change.startsWith('+') ? '#10b981' : kpi.change.startsWith('-') ? '#ef4444' : '#64748b', fontWeight: 800, marginTop: 1, whiteSpace: 'nowrap' }}>
                        {kpi.change}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts Area */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Left Column chart */}
                  <div style={{ flex: 1.5, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: 6 }}>
                    <div style={{ fontSize: 6, color: '#64748b', fontWeight: 800, marginBottom: 4 }}>Ventas por Mes</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                      {[25, 45, 35, 65, 50, 80, 60].map((val, idx) => (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '100%', background: idx === 5 ? primary : `${primary}40`, height: val, borderRadius: '2px 2px 0 0' }} />
                          <span style={{ fontSize: 4, color: '#94a3b8', marginTop: 2, fontWeight: 700 }}>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'][idx]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Middle list */}
                  <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: 5 }}>
                    <div style={{ fontSize: 6, color: '#64748b', fontWeight: 800, marginBottom: 3 }}>Top Clientes</div>
                    {[
                      { n: 'Jenny A. Brown', v: '$614.95' },
                      { n: 'Maria Alexander', v: '$412.60' },
                      { n: 'Maria Escobar', v: '$336.60' },
                      { n: 'Garcia total', v: '$316.40' },
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '2px 0' }}>
                        <span style={{ fontSize: 5, color: '#334155', fontWeight: 600 }}>{item.n}</span>
                        <span style={{ fontSize: 5, color: primary, fontWeight: 800 }}>{item.v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Right Impuestos card */}
                  <div style={{ flex: 1.2, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: 6 }}>
                    <div style={{ fontSize: 6, color: '#ef4444', fontWeight: 800, marginBottom: 2 }}>IMPUESTOS A PAGAR</div>
                    <div style={{ fontSize: 5, color: '#64748b' }}>Total a Pagar</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', margin: '2px 0' }}>$1,245.60</div>
                    <div style={{ fontSize: 4, color: '#94a3b8', marginBottom: 4 }}>Actualizado en tiempo real</div>
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 2 }}>
                      <div style={{ fontSize: 4, color: '#334155', fontWeight: 700 }}>Próximas Declaraciones</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 4, color: '#64748b', marginTop: 1 }}>
                        <span>IVA Mensual</span>
                        <span style={{ fontWeight: 700 }}>15 Jul 2026</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            {/* Laptop Base */}
            <div style={{ background: '#cbd5e1', height: 12, borderRadius: '0 0 4px 4px', border: '1px solid #94a3b8' }} />
            <div style={{ background: '#94a3b8', height: 6, borderRadius: '0 0 10px 10px', width: '112%', marginLeft: '-6%', border: '1px solid #475569', borderTop: 'none' }} />
          </div>
        </div>

        {/* PROMPTED / HIGHLIGHT TEXT UNDER LAPTOP */}
        <div style={{
          position: 'absolute',
          top: 730,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '0 100px',
          zIndex: 10
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#0f172a',
            margin: 0,
            lineHeight: 1.3
          }}>
            ¿Quieres saber cuánto tienes que pagar de <span style={{ color: primary }}>impuesto</span>?
          </h2>
          <p style={{
            fontSize: 18,
            color: '#334155',
            fontWeight: 600,
            margin: '4px 0 0 0'
          }}>
            Acá mismo, lo vas a tener en este tablero, <span style={{ color: primary }}>en tiempo real</span>.
          </p>
        </div>

        {/* BOTTOM BENEFITS (3 CARDS ALIGNED) */}
        <div style={{
          position: 'absolute',
          top: 840,
          left: 60,
          right: 60,
          display: 'flex',
          gap: 20,
          zIndex: 10
        }}>
          {[
            { title: 'Declaraciones a Tiempo', desc: 'Preparándote todas tus declaraciones a tiempo.', icon: '📄' },
            { title: 'Tranquilidad Absoluta', desc: 'La tranquilidad no se compra.', icon: '⏱️' },
            { title: 'Crecimiento de Negocio', desc: 'Ahora sí puede generar más.', icon: '📈' }
          ].map((item, idx) => (
            <div key={idx} style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 4px 12px rgba(15,23,42,0.04)'
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `${primary}15`, color: primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: primary, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER BAR (RED WITH BLACK ROUND BUTTON) */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 68,
          background: primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 60px',
          zIndex: 10
        }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '0.02em' }}>
            Más control. Más orden. Más crecimiento.
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {phone && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>📱 {phone}</span>}
            {website && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>🌐 {website}</span>}
            
            <div style={{
              background: '#090d16',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 24,
              fontWeight: 800,
              fontSize: 13,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {cta}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FlyerTemplateA.displayName = 'FlyerTemplateA';
FlyerTemplateB.displayName = 'FlyerTemplateB';
