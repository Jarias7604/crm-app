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
function deriveHeadline(prompt: string, company: string): { h1: string; h2: string } {
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
function deriveFeatures(prompt: string): string[] {
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
function derivePrice(prompt: string): string {
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
        background: `radial-gradient(circle at 100% 0%, ${primary}08 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 0% 100%, ${secondary}05 0%, rgba(255,255,255,0) 45%), #ffffff`,
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Background Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
          backgroundSize: '30px 30px',
          opacity: 0.35,
          pointerEvents: 'none'
        }} />

        {/* TOP SECTION */}
        <div style={{ padding: '52px 64px 24px', flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          {/* Left: Headline & Price */}
          <div style={{ flex: 1, marginRight: 32 }}>
            <div style={{ fontSize: headline.length > 30 ? 36 : 44, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: 'normal', marginBottom: 10 }}>
              {headline.split('NEGOCIO').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}{i < arr.length - 1 && <span style={{ color: primary }}>NEGOCIO</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#475569', marginBottom: 24 }}>{subheadline}</div>

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
              <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 90, maxWidth: 220, objectFit: 'contain' }} alt="Brand Logo" />
            ) : (
              <div style={{ padding: '14px 24px', background: `${primary}08`, borderRadius: 16, border: `2px dashed ${primary}60` }}>
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
                background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 20,
                padding: '20px 24px', boxShadow: '0 8px 24px rgba(15,23,42,0.02)'
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
    const price = data.price || parsed.price || derivePrice(data.prompt);
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1;
    const subheadline = data.subheadline || parsed.subtitle || h2;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, 'Activa HOY MISMO');

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: `radial-gradient(circle at 100% 0%, ${primary}18 0%, rgba(11,15,25,0) 60%), radial-gradient(circle at 0% 100%, ${secondary}18 0%, rgba(11,15,25,0) 60%), #0b111e`,
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Futuristic tech grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />

        {/* TOP BADGE */}
        <div style={{ background: `linear-gradient(90deg, ${primary}, ${primary}cc)`, padding: '12px 0', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 10 }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Solución Integral Para Tu Negocio
          </span>
        </div>

        {/* HEADER */}
        <div style={{ padding: '45px 80px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          <div style={{ flex: 1, marginRight: 40 }}>
            <div style={{ fontSize: headline.length > 30 ? 36 : 44, fontWeight: 900, color: '#ffffff', lineHeight: 1.05, letterSpacing: 'normal', marginBottom: 10 }}>
              {headline}
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, color: primary, marginBottom: 18 }}>{subheadline}</div>
            
            {/* Badges */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {features.slice(0, 3).map((f, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px' }}>{getFeatureIcon(f)} {f.length > 16 ? f.substring(0,16)+'…' : f}</span>
              ))}
            </div>
          </div>
          
          {/* Logo or Company Name */}
          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {data.logoUrl ? (
              <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 90, maxWidth: 240, objectFit: 'contain' }} alt="Brand Logo" />
            ) : (
              <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: 'normal', lineHeight: 1.1 }}>
                {data.company_name.length > 20 ? (
                  <>
                    <div style={{ color: primary }}>{data.company_name.split(' ').slice(0, 2).join(' ')}</div>
                    <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>{data.company_name.split(' ').slice(2).join(' ')}</div>
                  </>
                ) : (
                  data.company_name
                )}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE */}
        <div style={{ flex: 1, display: 'flex', padding: '0 80px', gap: 50, zIndex: 10, alignItems: 'center' }}>
          {/* LEFT: Features list */}
          <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 16, padding: '16px 20px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: primary, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  boxShadow: `0 0 15px ${primary}40`
                }}>
                  {getFeatureIcon(f)}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', marginBottom: 3 }}>{f}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                    Gestiona de forma eficiente y segura.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: Laptop + Phone mockup */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Laptop mockup */}
            <div style={{ position: 'relative', width: 360, zIndex: 2, filter: `drop-shadow(0 20px 40px ${primary}12)` }}>
              <div style={{ background: '#1e2530', borderRadius: '12px 12px 0 0', padding: '12px 12px 0', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
                </div>
                {/* Screen contents */}
                <div style={{ background: '#0e121d', borderRadius: 8, padding: 12, height: 210, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ background: secondary, borderRadius: 5, padding: '6px 10px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{data.company_name.substring(0,18)}</span>
                    <span style={{ color: primary, fontSize: 9, fontWeight: 800 }}>DASHBOARD</span>
                  </div>
                  
                  {/* Cards inside screen */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {['$24,560', '$8,340', '1,250'].map((v, idx) => (
                      <div key={idx} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, padding: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{['Ventas', 'Compras', 'Clientes'][idx]}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, padding: 6 }}>
                      {/* Glow graph bar chart */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 50 }}>
                        {[30, 50, 40, 75, 55, 90, 70].map((h, idx) => (
                          <div key={idx} style={{ flex: 1, background: idx === 5 ? primary : `${primary}50`, borderRadius: 1, height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, padding: 6 }}>
                      {['Actualizado', 'Verificado', 'Soporte 24/7'].map((txt, idx) => (
                        <div key={idx} style={{ fontSize: 7, color: idx === 2 ? primary : 'rgba(255,255,255,0.6)', fontWeight: idx === 2 ? 800 : 400, borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '3px 0' }}>
                          {txt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: '#2d3543', height: 10, borderRadius: '0 0 3px 3px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
              <div style={{ background: '#212732', height: 6, borderRadius: '0 0 8px 8px', width: '110%', marginLeft: '-5%' }} />
            </div>

            {/* Overlapping Phone mockup */}
            <div style={{ position: 'absolute', right: 20, bottom: -10, zIndex: 3, width: 115, background: '#1e2530', border: '2px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '8px 6px', boxShadow: '0 15px 35px rgba(0,0,0,0.4)' }}>
              <div style={{ background: '#0e121d', borderRadius: 14, padding: 8, height: 180, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ background: primary, borderRadius: 5, padding: '4px 6px', marginBottom: 6 }}>
                  <span style={{ color: '#fff', fontSize: 7, fontWeight: 800, letterSpacing: '0.05em' }}>COTIZACION</span>
                </div>
                {[`Ref: #${Math.floor(Math.random()*900)+100}`, data.company_name.substring(0,14), `Total: ${price || '$---'}`, 'Estado: Activo'].map((v, i) => (
                  <div key={i} style={{ fontSize: 7, color: i === 2 ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: i === 2 ? 800 : 400, borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '4px 0' }}>
                    {v}
                  </div>
                ))}
                <div style={{ background: primary, borderRadius: 6, padding: '6px 0', textAlign: 'center', marginTop: 14, cursor: 'pointer' }}>
                  <span style={{ color: '#fff', fontSize: 8, fontWeight: 800 }}>Ver Detalle</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PRICE + CTA BAR */}
        <div style={{ background: '#080d16', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '28px 80px', display: 'flex', alignItems: 'center', gap: 48, zIndex: 10 }}>
          {price && (
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Desde</div>
              <div style={{ fontSize: 54, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{price}</div>
              <div style={{ background: primary, borderRadius: 6, padding: '4px 12px', marginTop: 6, display: 'inline-block' }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>OFERTA POR TIEMPO LIMITADO</span>
              </div>
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, borderRadius: 14, padding: '18px 36px', display: 'inline-flex', alignItems: 'center', gap: 10, border: '1px solid rgba(255,255,255,0.1)', boxShadow: `0 8px 25px ${primary}35` }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Contáctanos</div>
                <div style={{ fontSize: 22, color: '#fff', fontWeight: 900 }}>{cta}</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              El poder de tu negocio,<br />al alcance de tu mano.
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ background: '#030508', borderTop: '1px solid rgba(255,255,255,0.03)', padding: '16px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {data.logoUrl ? (
              <img src={data.logoUrl} crossOrigin="anonymous" style={{ height: 36, width: 36, objectFit: 'contain' }} alt="logo" />
            ) : (
              <div style={{ width: 36, height: 36, background: primary, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>
                {data.company_name.substring(0, 1)}
              </div>
            )}
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{data.company_name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            {phone && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700 }}>WhatsApp</div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{phone}</div>
              </div>
            )}
            {website && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700 }}>Sitio web</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{website}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

FlyerTemplateA.displayName = 'FlyerTemplateA';
FlyerTemplateB.displayName = 'FlyerTemplateB';
