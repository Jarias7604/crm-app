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
  highlight_title?: string;
  highlight_desc?: string;
  benefits?: { title: string; desc: string; icon: string }[];
  mockup_info?: {
    title: string;
    kpis: { label: string; val: string; change?: string }[];
  };
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

export interface IndustryContent {
  highlight_title: string;
  highlight_desc: string;
  benefits: { title: string; desc: string; icon: string }[];
  mockup_title: string;
  kpis: { label: string; val: string; change?: string }[];
}

export function deriveIndustryContent(prompt: string, data: Partial<FlyerData>): IndustryContent {
  const lower = (prompt || '').toLowerCase();
  
  // 1. K9 / Dog Training / Pets
  if (lower.includes('perro') || lower.includes('canin') || lower.includes('mascota') || lower.includes('adiestra') || lower.includes('k9')) {
    return {
      highlight_title: data.highlight_title || '¿Quieres el mejor adiestramiento canino?',
      highlight_desc: data.highlight_desc || 'Programas personalizados para obediencia, socialización y defensa.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Conducta Canina', desc: 'Soluciona problemas de comportamiento y agresión.', icon: '🐕' },
        { title: 'Entrenadores Pro', desc: 'Instructores certificados con amplia experiencia.', icon: '🎓' },
        { title: 'Resultados Reales', desc: 'Adiestramiento garantizado para todas las razas.', icon: '✅' }
      ],
      mockup_title: data.mockup_info?.title || 'Registro K9',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Perros', val: '180+' },
        { label: 'Clases', val: '1,240' },
        { label: 'Eficacia', val: '99.4%' },
        { label: 'Calificación', val: '5.0 ★' }
      ]
    };
  }
  
  // 2. Food / Restaurants / Pizza
  if (lower.includes('pizz') || lower.includes('hamburgue') || lower.includes('taco') || lower.includes('comida') || lower.includes('restauran') || lower.includes('sabor') || lower.includes('chef') || lower.includes('cocin')) {
    return {
      highlight_title: data.highlight_title || '¿Listo para probar el mejor sabor?',
      highlight_desc: data.highlight_desc || 'Ingredientes seleccionados, recetas originales y el mejor ambiente para ti.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Sabor Único', desc: 'Recetas artesanales preparadas con pasión.', icon: '🍕' },
        { title: 'Servicio Rápido', desc: 'Directo a tu mesa o entrega a domicilio.', icon: '⚡' },
        { title: 'Ingredientes Frescos', desc: 'La mejor calidad en cada bocado.', icon: '🍅' }
      ],
      mockup_title: data.mockup_info?.title || 'Menú Digital',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Pedidos', val: '2,450' },
        { label: 'Valoraciones', val: '4.8 ★' },
        { label: 'Entregas', val: '99.2%' },
        { label: 'Especiales', val: '12' }
      ]
    };
  }
  
  // 3. Security / Guard / Defense
  if (lower.includes('segurid') || lower.includes('guardia') || lower.includes('vigilan') || lower.includes('patrulla') || lower.includes('defens')) {
    return {
      highlight_title: data.highlight_title || '¿Buscas la máxima seguridad?',
      highlight_desc: data.highlight_desc || 'Sistemas de protección, guardias entrenados y monitoreo permanente.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Vigilancia 24/7', desc: 'Monitoreo constante y respuesta inmediata.', icon: '🚨' },
        { title: 'Guardias Expertos', desc: 'Personal altamente calificado y evaluado.', icon: '👮' },
        { title: 'Control Total', desc: 'Sistemas avanzados para proteger lo tuyo.', icon: '🔒' }
      ],
      mockup_title: data.mockup_info?.title || 'Centro de Mando',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Cámaras', val: '32' },
        { label: 'Guardias', val: '18' },
        { label: 'Alarmas', val: 'Activa' },
        { label: 'Respuesta', val: '< 3 min' }
      ]
    };
  }
  
  // 4. Dental / Odontology / Clinics
  if (lower.includes('dent') || lower.includes('odont') || lower.includes('dient') || lower.includes('sonris') || lower.includes('ortodon')) {
    return {
      highlight_title: data.highlight_title || '¿Quieres la sonrisa de tus dreams?',
      highlight_desc: data.highlight_desc || 'Tratamientos dentales avanzados para toda tu familia con especialistas.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Odontólogos Pro', desc: 'Profesionales con amplia experiencia.', icon: '🦷' },
        { title: 'Tecnología 3D', desc: 'Diagnósticos precisos y sin dolor.', icon: '🔬' },
        { title: 'Planes Flexibles', desc: 'Financiamiento a tu medida para todo tratamiento.', icon: '💳' }
      ],
      mockup_title: data.mockup_info?.title || 'Historial Clínico',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Pacientes', val: '1,520' },
        { label: 'Clínicas', val: '2' },
        { label: 'Citas Mes', val: '340' },
        { label: 'Opiniones', val: '4.9 ★' }
      ]
    };
  }
  
  // 5. Default / B2B SaaS CRM & Business Growth
  return {
    highlight_title: data.highlight_title || '¿Quieres automatizar tu negocio y vender más?',
    highlight_desc: data.highlight_desc || 'Aumenta la productividad de tu equipo con herramientas inteligentes y control de leads.',
    benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
      { title: 'Eficiencia', desc: 'Automatiza tareas repetitivas y ahorra tiempo.', icon: '⚡' },
      { title: 'Control Total', desc: 'Gestiona tus clientes y ventas en un solo lugar.', icon: '👥' },
      { title: 'Crecimiento', desc: 'Incrementa tus conversiones con seguimiento inteligente.', icon: '📈' }
    ],
    mockup_title: data.mockup_info?.title || 'Control de Leads',
    kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
      { label: 'Leads Nuevos', val: '240+' },
      { label: 'Conversión', val: '18.4%' },
      { label: 'Atención', val: '< 2 min' },
      { label: 'Satisfacción', val: '4.9 ★' }
    ]
  };
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

function getIndustryType(prompt: string): 'k9' | 'food' | 'security' | 'dental' | 'saas' {
  const lower = (prompt || '').toLowerCase();
  if (lower.includes('perro') || lower.includes('canin') || lower.includes('mascota') || lower.includes('adiestra') || lower.includes('k9')) {
    return 'k9';
  }
  if (lower.includes('pizz') || lower.includes('hamburgue') || lower.includes('taco') || lower.includes('comida') || lower.includes('restauran') || lower.includes('sabor') || lower.includes('chef') || lower.includes('cocin')) {
    return 'food';
  }
  if (lower.includes('segurid') || lower.includes('guardia') || lower.includes('vigilan') || lower.includes('patrulla') || lower.includes('defens')) {
    return 'security';
  }
  if (lower.includes('dent') || lower.includes('odont') || lower.includes('dient') || lower.includes('sonris') || lower.includes('ortodon')) {
    return 'dental';
  }
  return 'saas';
}

export function renderIndustryMockup(prompt: string, primary: string, secondary: string, hasBg: boolean): React.ReactNode {
  const type = getIndustryType(prompt);
  
  const cardStyle: React.CSSProperties = {
    width: 380,
    borderRadius: 24,
    padding: '24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    transition: 'all 0.3s ease',
    fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif",
    background: hasBg ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
    backdropFilter: hasBg ? 'blur(20px)' : 'none',
    border: hasBg ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
    boxShadow: hasBg 
      ? '0 20px 45px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.15)' 
      : '0 15px 30px rgba(15, 23, 42, 0.05)',
    color: hasBg ? '#ffffff' : '#0f172a',
    textAlign: 'left'
  };

  const textPrimary = hasBg ? '#ffffff' : '#0f172a';
  const textSecondary = hasBg ? 'rgba(255, 255, 255, 0.7)' : '#475569';
  const borderLight = hasBg ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';
  const bgBadge = hasBg ? 'rgba(255, 255, 255, 0.1)' : `${primary}10`;
  const textBadge = hasBg ? '#ffffff' : primary;

  if (type === 'k9') {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, position: 'relative'
            }}>
              🐕
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 12, height: 12, borderRadius: '50%',
                background: '#10b981', border: `2px solid ${hasBg ? '#1e293b' : '#fff'}`
              }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>Apolo</div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>Pastor Alemán · 10 meses</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>★</span> 5.0
          </div>
        </div>

        {/* Badge */}
        <div style={{
          alignSelf: 'flex-start',
          background: bgBadge, color: textBadge,
          padding: '6px 12px', borderRadius: 12,
          fontSize: 11, fontWeight: 700, border: hasBg ? '1px solid rgba(255,255,255,0.06)' : 'none'
        }}>
          🏅 Adiestramiento K9 Certificado
        </div>

        {/* Progress tracks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {[
            { name: 'Obediencia Básica', val: 100 },
            { name: 'Socialización', val: 95 },
            { name: 'Agilidad & Destreza', val: 90 }
          ].map((t, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: textPrimary }}>
                <span>{t.name}</span>
                <span>{t.val}%</span>
              </div>
              <div style={{ height: 6, background: hasBg ? 'rgba(255,255,255,0.1)' : '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${t.val}%`, background: `linear-gradient(90deg, ${primary}, ${secondary})`, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'food') {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `linear-gradient(135deg, ${primary}20, ${primary}40)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32
            }}>
              🍕
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginBottom: 4 }}>Pizza Especial</div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, lineHeight: 1.3 }}>Masa madre de fermentación lenta & salsa artesanal.</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${borderLight}`, borderBottom: `1px solid ${borderLight}`, padding: '12px 0', margin: '4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: textSecondary, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Precio Especial</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: primary }}>$12.90</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 2 }}>★ 4.9</div>
            <div style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>240+ opiniones</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['100% Ingredientes Frescos', 'Horneado a la Leña', 'Envío Gratis en la zona'].map((tag, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: textPrimary }}>
              <span style={{ color: '#10b981' }}>✓</span> {tag}
            </div>
          ))}
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${primary}, ${primary}dd)`,
          borderRadius: 14, padding: '10px 16px', color: '#fff',
          fontSize: 12, fontWeight: 800, textAlign: 'center',
          boxShadow: `0 8px 20px ${primary}30`, cursor: 'pointer', marginTop: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          Pedir Ahora ⚡
        </div>
      </div>
    );
  }

  if (type === 'security') {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
            }}>
              🛡️
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>Centro de Mando</div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>Monitoreo en tiempo real</div>
            </div>
          </div>
          <div style={{
            background: hasBg ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
            border: `1px solid ${hasBg ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
            borderRadius: 20,
            padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#10b981',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: hasBg ? '#34d399' : '#065f46' }}>ONLINE</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: hasBg ? 'rgba(255,255,255,0.05)' : '#f8fafc', padding: 12, borderRadius: 16, border: `1px solid ${borderLight}` }}>
          <div>
            <div style={{ fontSize: 10, color: textSecondary, fontWeight: 600 }}>Cámaras Activas</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>8 Dispositivos</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: textSecondary, fontWeight: 600 }}>Tiempo Respuesta</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: primary }}>&lt; 3 min</div>
          </div>
        </div>

        {/* Activity Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: textSecondary, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Registro de Actividad</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: hasBg ? 'rgba(0,0,0,0.2)' : '#f1f5f9', padding: '10px 12px', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: textPrimary, display: 'flex', justifyContent: 'space-between' }}>
              <span>✓ Perímetro Verificado</span>
              <span style={{ opacity: 0.6 }}>12:40</span>
            </div>
            <div style={{ fontSize: 11, color: textPrimary, display: 'flex', justifyContent: 'space-between' }}>
              <span>✓ Conexión Segura VPN</span>
              <span style={{ opacity: 0.6 }}>12:15</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'dental') {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: `linear-gradient(135deg, ${primary}20, ${primary}50)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
            }}>
              👩‍⚕️
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>Dra. Sofía Mendoza</div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>Odontología Estética</div>
            </div>
          </div>
        </div>

        {/* Booking slot */}
        <div style={{
          background: hasBg ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
          border: `1px solid ${hasBg ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
          borderRadius: 14, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: hasBg ? '#34d399' : '#047857' }}>● Próxima Cita Disponible</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: hasBg ? '#fff' : '#065f46', background: hasBg ? 'rgba(255,255,255,0.1)' : '#fff', padding: '2px 8px', borderRadius: 6 }}>HOY 15:30</span>
        </div>

        {/* Rating & Reviews */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${borderLight}`, borderBottom: `1px solid ${borderLight}`, padding: '10px 0' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>Valoración</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>★ 5.0 (420+ opiniones)</span>
        </div>

        {/* Treatments grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Blanqueamiento', 'Implantes', 'Ortodoncia'].map((tag, idx) => (
            <span key={idx} style={{
              background: hasBg ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
              color: textPrimary, fontSize: 10, fontWeight: 700,
              padding: '6px 12px', borderRadius: 20, border: `1px solid ${borderLight}`
            }}>{tag}</span>
          ))}
        </div>
      </div>
    );
  }

  // default / saas
  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>Lead Control Hub</div>
          <div style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>Ventas y conversiones del mes</div>
        </div>
        <div style={{
          background: bgBadge, color: textBadge,
          padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800
        }}>
          SaaS Dashboard
        </div>
      </div>

      {/* SVG Line Chart */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox="0 0 100 30" style={{ width: '100%', height: 70, display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primary} stopOpacity={hasBg ? 0.35 : 0.2} />
              <stop offset="100%" stopColor={primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d="M 0 25 Q 15 10 30 18 T 60 5 T 90 12 L 100 2 L 100 30 L 0 30 Z" fill="url(#chart-glow)" />
          <path d="M 0 25 Q 15 10 30 18 T 60 5 T 90 12 L 100 2" fill="none" stroke={primary} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="2" r="3.5" fill="#fff" stroke={primary} strokeWidth="2" />
        </svg>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: hasBg ? 'rgba(255,255,255,0.04)' : '#f8fafc', padding: 10, borderRadius: 14, border: `1px solid ${borderLight}` }}>
          <div style={{ fontSize: 9, color: textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>Leads Nuevos</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginTop: 2 }}>240+ <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>↑ 24%</span></div>
        </div>
        <div style={{ flex: 1, background: hasBg ? 'rgba(255,255,255,0.04)' : '#f8fafc', padding: 10, borderRadius: 14, border: `1px solid ${borderLight}` }}>
          <div style={{ fontSize: 9, color: textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>Conversión</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginTop: 2 }}>18.4%</div>
        </div>
      </div>
    </div>
  );
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
  const match = prompt.match(/\$[d\d,.]+/);
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
    const secondary = data.secondaryColor || '#0f172a';
    const price = data.price || parsed.price || derivePrice(data.prompt);
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1;
    const subheadline = data.subheadline || parsed.subtitle || h2;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, 'Contáctanos HOY');
    
    const industry = deriveIndustryContent(data.prompt, data);
    const hasBg = !!data.bgImageUrl;
    const indType = getIndustryType(data.prompt);

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: hasBg 
          ? `url(${data.bgImageUrl}) center/cover no-repeat` 
          : `radial-gradient(circle at 80% 20%, ${primary}18 0%, transparent 60%), radial-gradient(circle at 20% 80%, ${secondary}12 0%, transparent 60%), #fafafa`,
        fontFamily: "'Plus Jakarta Sans', 'Outfit', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Load Google Fonts directly in the render flow */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" />

        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
            backgroundSize: '35px 35px',
            opacity: 0.4,
            pointerEvents: 'none'
          }} />
        )}
        
        {hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.15) 45%, rgba(15,23,42,0.85) 100%)',
            pointerEvents: 'none', zIndex: 1
          }} />
        )}

        {/* TOP SECTION */}
        <div style={{ padding: '54px 64px 20px', flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          <div style={{ flex: 1, marginRight: 32, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div style={{
              fontSize: 12, fontWeight: 900, color: hasBg ? '#ffffff' : primary,
              textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12,
              opacity: 0.95, textShadow: hasBg ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
            }}>
              ⭐ Propuesta Premium · {indType.toUpperCase()}
            </div>
            
            <div style={{
              fontSize: headline.length > 30 ? 38 : 46,
              fontWeight: 900,
              color: hasBg ? '#ffffff' : '#0f172a',
              textShadow: hasBg ? '0 4px 12px rgba(0,0,0,0.85)' : 'none',
              lineHeight: 1.1,
              marginBottom: 12,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {headline}
            </div>
            
            <div style={{
              fontSize: 20,
              fontWeight: 600,
              color: hasBg ? '#e2e8f0' : '#475569',
              textShadow: hasBg ? '0 2px 6px rgba(0,0,0,0.8)' : 'none',
              marginBottom: 24,
              lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>{subheadline}</div>

            {price && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 14,
                background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, borderRadius: 16, padding: '12px 30px',
                boxShadow: `0 10px 25px ${primary}35`, border: '1px solid rgba(255,255,255,0.15)',
                alignSelf: 'flex-start'
              }}>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desde</span>
                <span style={{ fontSize: 40, color: '#fff', fontWeight: 900, lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>+ IVA</span>
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {data.logoUrl ? (
              <div style={{ background: hasBg ? 'rgba(255,255,255,0.95)' : 'transparent', padding: hasBg ? 12 : 0, borderRadius: 18, boxShadow: hasBg ? '0 8px 20px rgba(0,0,0,0.18)' : 'none' }}>
                <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain' }} alt="Logo" />
              </div>
            ) : (
              <div style={{ padding: '14px 24px', background: hasBg ? 'rgba(255,255,255,0.95)' : `${primary}08`, borderRadius: 16, border: `2px dashed ${primary}60`, boxShadow: hasBg ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: primary, letterSpacing: '0.02em' }}>{data.company_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE SECTION: Features on left, custom mockup card on right */}
        <div style={{ flex: 1, display: 'flex', padding: '0 64px', gap: 48, zIndex: 10, alignItems: 'center' }}>
          {/* Features Column */}
          <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                background: hasBg ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(16px)',
                border: hasBg ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 20,
                padding: '20px 24px', boxShadow: hasBg ? '0 10px 30px rgba(0,0,0,0.2)' : '0 8px 24px rgba(15,23,42,0.04)',
                textAlign: 'left'
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: hasBg ? `linear-gradient(135deg, ${primary}30, ${primary}80)` : `linear-gradient(135deg, ${primary}12, ${primary}25)`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: hasBg ? '#fff' : primary
                }}>
                  {getFeatureIcon(f)}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: hasBg ? '#fff' : '#0f172a', marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f}</div>
                  <div style={{ fontSize: 13, color: hasBg ? 'rgba(255, 255, 255, 0.7)' : '#475569', lineHeight: 1.4, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    Garantía de calidad y soporte profesional.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dynamic Mockup Card Column */}
          <div style={{ flex: 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderIndustryMockup(data.prompt, primary, secondary, hasBg)}
          </div>
        </div>

        {/* BOTTOM BENEFITS (Horizontal clean ribbon) */}
        <div style={{ 
          background: hasBg ? 'rgba(15,23,42,0.4)' : '#f8fafc', 
          borderTop: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0', 
          padding: '20px 48px', 
          display: 'flex', 
          gap: 20, 
          zIndex: 10, 
          backdropFilter: hasBg ? 'blur(20px)' : 'none' 
        }}>
          {industry.benefits.slice(0, 3).map((item, idx) => (
            <div key={idx} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 12,
              background: hasBg ? 'rgba(15, 23, 42, 0.35)' : '#fff',
              border: hasBg ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #e2e8f0',
              borderRadius: 16, padding: '14px 18px',
              boxShadow: hasBg ? '0 10px 25px rgba(0,0,0,0.15)' : '0 4px 12px rgba(15,23,42,0.03)',
              textAlign: 'left'
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: hasBg ? '#fff' : primary, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: hasBg ? 'rgba(255,255,255,0.7)' : '#64748b', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ background: secondary, padding: '18px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, flexWrap: 'nowrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, maxWidth: '45%', textAlign: 'left' }}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.company_name}</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {phone && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 }}>📱 {phone}</span>}
              {website && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}>🌐 {website}</span>}
            </div>
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${primary}, ${primary}cc)`,
            borderRadius: 12, padding: '12px 28px',
            color: '#fff', fontWeight: 800, fontSize: 13,
            boxShadow: `0 6px 15px ${primary}40`,
            whiteSpace: 'nowrap', flexShrink: 0,
            maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {cta || 'Contáctanos HOY'}
          </div>
        </div>
      </div>
    );
  }
);

// ── TEMPLATE B — Studio Bold / Minimal Editorial ──────────────────────────────────
export const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#9b1c1c';
    const secondary = data.secondaryColor || '#0f172a';
    const price = data.price || parsed.price || derivePrice(data.prompt) || '';
    
    const industry = deriveIndustryContent(data.prompt, data);
    const rawFeatures = data.features || parsed.features || deriveFeatures(data.prompt);
    const defaultFeatures = industry.benefits.map(b => b.title).concat(['Soporte 24/7', 'Garantía Total']);
    const features: string[] = [];
    for (let i = 0; i < 4; i++) features.push(rawFeatures[i] || defaultFeatures[i] || 'Servicio Premium');

    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1 || '¿Listo para lo mejor?';
    const subheadline = data.subheadline || parsed.subtitle || h2 || `${data.company_name} — Siempre a tu servicio`;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, `Todo con ${data.company_name}`);

    const hasBg = !!data.bgImageUrl;
    const indType = getIndustryType(data.prompt);

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: hasBg 
          ? `url(${data.bgImageUrl}) center/cover no-repeat` 
          : `radial-gradient(circle at 10% 10%, ${secondary}15 0%, transparent 60%), radial-gradient(circle at 90% 90%, ${primary}12 0%, transparent 60%), #ffffff`,
        fontFamily: "'Outfit', 'Plus Jakarta Sans', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Load Google Fonts directly in the render flow */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" />

        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px', opacity: 0.5, pointerEvents: 'none'
          }} />
        )}
        
        {hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none', zIndex: 1
          }} />
        )}

        {/* HEADER SECTION */}
        <div style={{ paddingTop: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, paddingLeft: 60, paddingRight: 60 }}>
          {data.logoUrl && (
            <div style={{ marginBottom: 20, background: hasBg ? 'rgba(255,255,255,0.95)' : 'transparent', padding: hasBg ? '10px 20px' : 0, borderRadius: 12 }}>
              <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 70, maxWidth: 200, objectFit: 'contain' }} alt="Logo" />
            </div>
          )}
          
          <div style={{
            fontSize: 11, fontWeight: 900, color: hasBg ? '#f8fafc' : primary,
            textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 10,
            background: hasBg ? 'rgba(255,255,255,0.15)' : `${primary}10`,
            padding: '4px 14px', borderRadius: 20
          }}>
            🏢 EDITORIAL DESIGN · {indType.toUpperCase()}
          </div>
          
          <h1 style={{
            fontSize: headline.length > 30 ? 42 : 52,
            fontWeight: 800,
            fontFamily: "'Syne', 'Outfit', sans-serif",
            color: hasBg ? '#ffffff' : '#0f172a',
            textAlign: 'center', margin: 0, lineHeight: 1.1,
            textShadow: hasBg ? '0 4px 12px rgba(0,0,0,0.8)' : 'none',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {headline}
          </h1>
          
          <p style={{
            fontSize: 20, fontWeight: 600,
            color: hasBg ? '#f1f5f9' : '#334155',
            textAlign: 'center', margin: '12px 0 0 0',
            textShadow: hasBg ? '0 2px 6px rgba(0,0,0,0.8)' : 'none',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {subheadline}
          </p>
        </div>

        {/* MAIN CONTENT AREA: Features on left, Custom mockup card on right */}
        <div style={{ flex: 1, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 64px', gap: 40 }}>
          
          {/* Left Side: Elegant Stacked Editorial Cards */}
          <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {price && (
              <div style={{
                background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, color: '#fff',
                padding: '12px 30px', borderRadius: 16,
                fontWeight: 900, fontSize: 28,
                boxShadow: `0 8px 24px ${primary}30`,
                display: 'flex', alignItems: 'baseline', gap: 8,
                alignSelf: 'flex-start', marginBottom: 6,
                border: '1px solid rgba(255,255,255,0.12)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>Desde</span>
                <span>{price}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features.map((feat, i) => (
                <div key={i} style={{
                  background: hasBg ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
                  borderLeft: `5px solid ${primary}`,
                  borderTop: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                  borderRight: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                  borderBottom: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                  padding: '16px 20px', borderRadius: '0 16px 16px 0',
                  display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: hasBg ? '0 10px 25px rgba(0,0,0,0.15)' : '0 4px 12px rgba(15,23,42,0.02)',
                  textAlign: 'left'
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: hasBg ? 'rgba(255,255,255,0.1)' : `${primary}10`, color: hasBg ? '#fff' : primary, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getFeatureIcon(feat)}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: hasBg ? '#ffffff' : '#1e293b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{feat}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Mockup Card */}
          <div style={{ flex: 0.9, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {renderIndustryMockup(data.prompt, primary, secondary, hasBg)}
          </div>
        </div>

        {/* PROMPTED QUOTE TEXT */}
        <div style={{ padding: '0 100px 18px', textAlign: 'center', zIndex: 10 }}>
          <h2 style={{ 
            fontSize: 24, 
            fontWeight: 800, 
            fontFamily: "'Syne', 'Outfit', sans-serif",
            color: hasBg ? '#fff' : '#0f172a', 
            margin: 0, 
            textShadow: hasBg ? '0 2px 8px rgba(0,0,0,0.85)' : 'none' 
          }}>
            ★ {industry.highlight_title} ★
          </h2>
        </div>

        {/* BOTTOM BENEFITS CARDS */}
        <div style={{ display: 'flex', gap: 18, zIndex: 10, padding: '0 60px 36px' }}>
          {industry.benefits.slice(0, 3).map((item, idx) => (
            <div key={idx} style={{
              flex: 1,
              background: hasBg ? 'rgba(15, 23, 42, 0.35)' : '#fff',
              backdropFilter: hasBg ? 'blur(12px)' : 'none',
              border: hasBg ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #e2e8f0',
              borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: hasBg ? '0 10px 25px rgba(0,0,0,0.15)' : '0 4px 12px rgba(15,23,42,0.04)',
              textAlign: 'left'
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: hasBg ? 'rgba(255, 255, 255, 0.1)' : `${primary}15`, color: hasBg ? '#fff' : primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: hasBg ? '#fff' : primary, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: hasBg ? 'rgba(255,255,255,0.7)' : '#475569', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER BAR */}
        <div style={{
          height: 72, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', zIndex: 10, flexShrink: 0
        }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'left' }}>
            {data.company_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
            {phone && <span style={{ color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: 800 }}>📱 {phone}</span>}
            {website && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 700 }}>🌐 {website}</span>}
          </div>
          <div style={{
            background: '#090d16', color: '#fff', padding: '12px 28px', borderRadius: 24,
            fontWeight: 800, fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.1)', marginLeft: 32
          }}>
            {cta || 'Contáctanos HOY'}
          </div>
        </div>
      </div>
    );
  }
);
export const RenderFlyer: React.FC<{ data: FlyerData; templateId?: string }> = ({ data, templateId }) => {
  return templateId === 'B' ? <FlyerTemplateB data={data} /> : <FlyerTemplateA data={data} />;
};

export const FreeLogo: React.FC<{
  d: FlyerData & {
    containerW: number;
    containerH: number;
    logoSize: number;
    logoX: number;
    logoY: number;
    templateId: string;
  };
  onMove: (x: number, y: number) => void;
  onResize: (s: number) => void;
}> = ({ d, onMove, onResize }) => {
  const isDragging = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const positionStart = React.useRef({ x: 0, y: 0 });

  const startDrag = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { x: d.logoX, y: d.logoY };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  };

  const onDrag = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Calculate percentage shift relative to container width/height
    const pctX = (dx / d.containerW) * 100;
    const pctY = (dy / d.containerH) * 100;
    
    let newX = Math.min(Math.max(positionStart.current.x + pctX, 0), 90);
    let newY = Math.min(Math.max(positionStart.current.y + pctY, 0), 90);
    onMove(newX, newY);
  };

  const endDrag = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  };

  if (!d.logoUrl) return null;

  return (
    <div style={{
      position: 'absolute',
      left: `${d.logoX}%`,
      top: `${d.logoY}%`,
      cursor: 'move',
      zIndex: 40,
      transform: `scale(${d.logoSize})`,
      transformOrigin: 'top left',
      padding: 6,
      background: 'rgba(255,255,255,0.92)',
      borderRadius: 12,
      boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
      border: '1px solid rgba(255,255,255,0.8)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      userSelect: 'none'
    }}
    onMouseDown={startDrag}
    >
      <img src={d.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 34, maxWidth: 110, objectFit: 'contain' }} alt="Logo flotante" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} onMouseDown={e => e.stopPropagation()}>
        <button 
          onClick={() => onResize(Math.min(d.logoSize + 0.1, 2.5))}
          style={{ width: 14, height: 14, fontSize: 8, fontWeight: 900, background: '#fff', border: '1px solid #d8dde6', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          +
        </button>
        <button 
          onClick={() => onResize(Math.max(d.logoSize - 0.1, 0.4))}
          style={{ width: 14, height: 14, fontSize: 8, fontWeight: 900, background: '#fff', border: '1px solid #d8dde6', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          -
        </button>
      </div>
    </div>
  );
};

export const TEMPLATE_LIST = [
  { id: 'A', name: 'Flyer Moderno A (Glow Glassmorphic)' },
  { id: 'B', name: 'Flyer Bold B (Editorial Showcase)' }
];
