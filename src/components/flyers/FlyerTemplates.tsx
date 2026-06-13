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

// ── Utility: derive headline from prompt ──────────────────────────────────────
function deriveHeadline(prompt: string, company: string): { h1: string; h2: string } {
  // Extract key info from prompt
  const lower = prompt.toLowerCase();
  if (lower.includes('erp') || lower.includes('sistema') || lower.includes('negocio')) {
    return { h1: '¿Sin control de tu NEGOCIO?', h2: `${company} — todo en un solo sistema` };
  }
  if (lower.includes('factur')) {
    return { h1: 'Facturación electrónica', h2: `con ${company}` };
  }
  // Generic
  const words = prompt.split(' ').slice(0, 6).join(' ');
  return { h1: words, h2: company };
}

function deriveFeatures(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const features: string[] = [];
  if (lower.includes('factur')) features.push('Facturación Electrónica');
  if (lower.includes('inventario')) features.push('Inventario y Compras');
  if (lower.includes('venta') || lower.includes('cliente')) features.push('Ventas y Clientes');
  if (lower.includes('reporte') || lower.includes('analítica') || lower.includes('dashboard')) features.push('Reportes en Tiempo Real');
  if (lower.includes('erp') || lower.includes('sistema')) {
    if (features.length < 2) features.push('Control Total del Negocio');
  }
  while (features.length < 4) {
    const extras = ['Soporte 24/7', 'Acceso en la Nube', 'Seguridad Garantizada', 'Fácil de Usar', '100% Cumple con Hacienda'];
    const next = extras.find(e => !features.includes(e));
    if (next) features.push(next); else break;
  }
  return features.slice(0, 4);
}

function derivePrice(prompt: string): string {
  const match = prompt.match(/\$[\d,.]+/);
  if (match) return match[0] + '/mes';
  const match2 = prompt.match(/([\d,.]+)\s*(dólar|dollar|usd)/i);
  if (match2) return '$' + match2[1] + '/mes';
  return ''; // No hardcoded price — only show if user specified it
}

// ── ICON SVGs ─────────────────────────────────────────────────────────────────
const icons: Record<string, string> = {
  'Facturación Electrónica': '📄',
  'Inventario y Compras': '📦',
  'Ventas y Clientes': '👥',
  'Reportes en Tiempo Real': '📊',
  'Control Total del Negocio': '🏢',
  'Soporte 24/7': '🛠️',
  'Acceso en la Nube': '☁️',
  'Seguridad Garantizada': '🔒',
  'Fácil de Usar': '⚡',
  '100% Cumple con Hacienda': '✅',
};

// ── TEMPLATE A — Classic Corporate (pink/white like reference flyer 1) ─────────
export const FlyerTemplateA = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const primary = data.primaryColor || '#e91e8c';
    const secondary = data.secondaryColor || '#1a1a2e';
    const price = data.price || derivePrice(data.prompt);
    const features = data.features || deriveFeatures(data.prompt);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || h1;
    const subheadline = data.subheadline || h2;

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: '#ffffff',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* TOP SECTION */}
        <div style={{ padding: '52px 64px 32px', flex: 'none' }}>
          {/* Headline */}
          <div style={{ fontSize: 62, fontWeight: 900, color: '#111', lineHeight: 1.1, marginBottom: 8 }}>
            {headline.split('NEGOCIO').map((part, i, arr) => (
              <React.Fragment key={i}>
                {part}{i < arr.length - 1 && <span style={{ color: primary }}>NEGOCIO?</span>}
              </React.Fragment>
            ))}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#333', marginBottom: 32 }}>{subheadline}</div>

          {/* Price Badge — only shown if price detected in prompt */}
          {price && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: primary, borderRadius: 16, padding: '14px 32px',
              marginBottom: 40,
            }}>
              <span style={{ fontSize: 18, color: '#fff', fontWeight: 700 }}>Desde</span>
              <span style={{ fontSize: 52, color: '#fff', fontWeight: 900, lineHeight: 1 }}>{price}</span>
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>+ IVA</span>
            </div>
          )}
        </div>

        {/* MIDDLE — Features grid + Laptop mockup */}
        <div style={{ flex: 1, display: 'flex', padding: '0 64px', gap: 48 }}>
          {/* LEFT: Features */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: `${primary}18`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {icons[f] || '✨'}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 2 }}>{f}</div>
                  <div style={{ fontSize: 14, color: '#666', lineHeight: 1.4 }}>
                    Gestiona de forma simple, rápida y segura.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: Laptop mockup */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Laptop frame */}
            <div style={{ position: 'relative', width: 380 }}>
              {/* Screen */}
              <div style={{
                background: '#1a1a2e', borderRadius: '12px 12px 0 0',
                padding: '12px 12px 0', position: 'relative',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}>
                {/* Browser bar */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                </div>
                {/* Dashboard UI */}
                <div style={{ background: '#f0f2f5', borderRadius: 8, padding: 12, height: 220 }}>
                  {/* Dashboard header */}
                  <div style={{ background: secondary, borderRadius: 6, padding: '6px 10px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>Dashboard</span>
                    <span style={{ color: primary, fontSize: 10 }}>●</span>
                  </div>
                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {['$24,560', '$8,340', '1,250', '320'].map((v, i) => (
                      <div key={i} style={{ flex: 1, background: '#fff', borderRadius: 4, padding: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#999', marginBottom: 2 }}>{['Ventas', 'Compras', 'Clientes', 'Productos'][i]}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#111' }}>{v}</div>
                        <div style={{ fontSize: 8, color: '#10b981' }}>+{[10, 8, 4, 2][i]}%</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart placeholder */}
                  <div style={{ background: '#fff', borderRadius: 4, padding: 6, marginBottom: 6, display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                    {[30, 50, 40, 70, 55, 80, 65, 90].map((h, i) => (
                      <div key={i} style={{
                        flex: 1, background: i === 7 ? primary : `${primary}60`,
                        borderRadius: 2, height: `${h}%`,
                      }} />
                    ))}
                  </div>
                  {/* Table rows */}
                  {['Cliente A', 'Cliente B', 'Cliente C'].map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: 8, color: '#333' }}>{c}</span>
                      <span style={{ fontSize: 8, color: primary, fontWeight: 700 }}>${(1250 - i * 300).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Laptop base */}
              <div style={{ background: '#d0d0d0', height: 12, borderRadius: '0 0 4px 4px', width: '100%' }} />
              <div style={{ background: '#b0b0b0', height: 6, borderRadius: '0 0 8px 8px', width: '110%', marginLeft: '-5%' }} />
            </div>
          </div>
        </div>

        {/* BOTTOM BENEFITS */}
        <div style={{ background: '#f8f8f8', padding: '24px 64px', display: 'flex', gap: 24 }}>
          {['Preparándote todas tus declaraciones a tiempo.', 'La tranquilidad no se compra.', 'Ahora sí puede generar más.'].map((b, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <span style={{ fontSize: 22 }}>{['📋', '🕐', '📈'][i]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: primary, lineHeight: 1.3 }}>{b}</span>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ background: secondary, padding: '18px 64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>{data.company_name}</div>
          <div style={{ display: 'flex', gap: 32 }}>
            {data.phone && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>📱 {data.phone}</span>}
            {data.email && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>✉️ {data.email}</span>}
            {data.website && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>🌐 {data.website}</span>}
          </div>
          <div style={{ background: primary, borderRadius: 8, padding: '10px 20px', color: '#fff', fontWeight: 800, fontSize: 14 }}>
            {data.cta}
          </div>
        </div>
      </div>
    );
  }
);

// ── TEMPLATE B — Bold Professional (dark red like reference flyer 2) ───────────
export const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const primary = data.primaryColor || '#9b1c1c';
    const secondary = data.secondaryColor || '#1a1a2e';
    const price = data.price || derivePrice(data.prompt);
    const features = data.features || deriveFeatures(data.prompt);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || h1;
    const subheadline = data.subheadline || h2;

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: '#ffffff',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* TOP BADGE */}
        <div style={{ background: primary, padding: '10px 0', textAlign: 'center' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Solución Integral Para Tu Negocio
          </span>
        </div>

        {/* HEADER */}
        <div style={{ padding: '40px 64px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 58, fontWeight: 900, color: '#111', lineHeight: 1.05, marginBottom: 8 }}>
              {headline}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: primary, marginBottom: 16 }}>{subheadline}</div>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {['✅ Fácil', '⚡ Rápido', '🔒 100% Cumple con Hacienda'].map((b, i) => (
                <span key={i} style={{ fontSize: 14, fontWeight: 700, color: '#333', background: '#f5f5f5', borderRadius: 6, padding: '6px 14px' }}>{b}</span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: primary, textAlign: 'right', lineHeight: 1 }}>
            {data.company_name.split(' ').map((w, i) => <div key={i}>{w}</div>)}
          </div>
        </div>

        {/* MIDDLE */}
        <div style={{ flex: 1, display: 'flex', padding: '0 64px', gap: 48 }}>
          {/* LEFT: Features list */}
          <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                background: '#fff', border: '1px solid #f0f0f0',
                borderRadius: 12, padding: '14px 16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: primary, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {icons[f] || '✨'}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 2 }}>{f}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Gestiona de forma eficiente y segura.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: Laptop + Phone mockup */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Laptop */}
            <div style={{ position: 'relative', width: 340, zIndex: 2 }}>
              <div style={{ background: '#222', borderRadius: '10px 10px 0 0', padding: '10px 10px 0', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 10, height: 200 }}>
                  <div style={{ background: secondary, borderRadius: 4, padding: '5px 8px', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>Arias ERP</span>
                    <span style={{ color: primary, fontSize: 9 }}>Dashboard</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {['$24,560', '$8,340', '1,250', '320'].map((v, i) => (
                      <div key={i} style={{ flex: 1, background: '#fff', borderRadius: 3, padding: 4, textAlign: 'center' }}>
                        <div style={{ fontSize: 7, color: '#999' }}>{['Ventas', 'Compras', 'Clientes', 'Productos'][i]}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#111' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ flex: 1, background: '#fff', borderRadius: 3, padding: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
                        {[40, 60, 45, 75, 55, 85, 70].map((h, i) => (
                          <div key={i} style={{ flex: 1, background: i === 6 ? primary : `${primary}50`, borderRadius: 2, height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: '#fff', borderRadius: 3, padding: 6 }}>
                      {['001-001', '001-002', '001-003'].map((n, i) => (
                        <div key={i} style={{ fontSize: 7, borderBottom: '1px solid #f0f0f0', padding: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#333' }}>Factura {n}</span>
                          <span style={{ color: primary, fontWeight: 700 }}>${(1250 - i * 300)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: '#ccc', height: 10, borderRadius: '0 0 3px 3px' }} />
              <div style={{ background: '#bbb', height: 5, borderRadius: '0 0 6px 6px', width: '110%', marginLeft: '-5%' }} />
            </div>

            {/* Phone mockup */}
            <div style={{ position: 'absolute', right: 20, bottom: -10, zIndex: 3, width: 110, background: '#222', borderRadius: 16, padding: '8px 6px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ background: '#f5f5f5', borderRadius: 10, padding: 6, height: 180 }}>
                <div style={{ background: secondary, borderRadius: 4, padding: '3px 5px', marginBottom: 4 }}>
                  <span style={{ color: '#fff', fontSize: 7, fontWeight: 700 }}>Factura</span>
                </div>
                {['001-000123', 'Cliente Uno', '20/04/2024', '$1,250.00'].map((v, i) => (
                  <div key={i} style={{ fontSize: 7, color: i === 3 ? primary : '#333', fontWeight: i === 3 ? 800 : 400, borderBottom: '1px solid #f0f0f0', padding: '3px 0' }}>
                    {['Factura', 'Cliente', 'Fecha', 'Total'][i]}: {v}
                  </div>
                ))}
                <div style={{ background: primary, borderRadius: 4, padding: '5px 0', textAlign: 'center', marginTop: 8 }}>
                  <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>Enviar</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PRICE + CTA BAR — conditional on price */}
        <div style={{ background: secondary, padding: '24px 64px', display: 'flex', alignItems: 'center', gap: 48 }}>
          {price && (
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Desde</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{price}</div>
              <div style={{ background: primary, borderRadius: 6, padding: '4px 12px', marginTop: 6, display: 'inline-block' }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>SIN CONTRATOS LARGOS</span>
              </div>
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ background: primary, borderRadius: 12, padding: '16px 32px', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>ACTIVA TU SISTEMA</div>
                <div style={{ fontSize: 24, color: '#fff', fontWeight: 900 }}>{data.cta}</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
              El poder de tu negocio,<br />al alcance de tu mano.
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ background: '#111', padding: '14px 64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {data.logoUrl
              ? <img src={data.logoUrl} style={{ height: 32, width: 32, objectFit: 'contain' }} alt="logo" />
              : <div style={{ width: 32, height: 32, background: primary, borderRadius: 6 }} />
            }
            <div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{data.company_name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            {data.phone && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>WhatsApp</div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{data.phone}</div>
              </div>
            )}
            {data.email && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>Correo</div>
                <div style={{ color: '#fff', fontSize: 11 }}>{data.email}</div>
              </div>
            )}
            {data.website && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>Sitio web</div>
                <div style={{ color: '#fff', fontSize: 11 }}>{data.website}</div>
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
