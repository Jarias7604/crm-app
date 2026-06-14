const fs = require('fs');

const filePath = 'c:\\\\Users\\\\jaria\\\\OneDrive\\\\DELL\\\\Desktop\\\\crm-app\\\\src\\\\components\\\\flyers\\\\FlyerTemplates.tsx';

let content = fs.readFileSync(filePath, 'utf8');

const startA = content.indexOf('export const FlyerTemplateA =');
const endAll = content.indexOf('FlyerTemplateA.displayName =');

if (startA === -1 || endAll === -1) {
    console.error("Could not find boundaries!");
    process.exit(1);
}

const newTemplateA = `export const FlyerTemplateA = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#e91e8c';
    const secondary = data.secondaryColor || '#0f172a'; // Dark color for the left banner
    const price = data.price || parsed.price || derivePrice(data.prompt) || '$12.95';
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    if (features.length === 0) features.push('Gestión rápida y efectiva de cuentas', 'Sin recordatorios incómodos con clientes', 'Recupera hasta el último de tus saldos');
    
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1 || '¡NO MÁS CUENTAS!';
    const subheadline = data.subheadline || parsed.subtitle || h2 || 'Deja que nosotros las gestionemos por ti y olvídate del estrés.';
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, '¡ACTÚA AHORA!');
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    
    const industry = deriveIndustryContent(data.prompt, data);

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: '#f8fafc',
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top Content Area */}
        <div style={{ flex: 1, padding: '60px 60px 0 60px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header */}
          <div style={{ marginBottom: 40, width: '60%', zIndex: 10 }}>
            <h1 style={{
              fontSize: headline.length > 25 ? 56 : 64,
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.05,
              margin: '0 0 16px 0',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>{headline}</h1>
            <p style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#334155',
              margin: 0,
              lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>{subheadline}</p>
          </div>
          
          {/* Middle Section: Left List + Right Mockup */}
          <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
            
            {/* Features List */}
            <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: 32, paddingTop: 10, zIndex: 10 }}>
              {features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: '#fff', color: primary, border: \`3px solid \${primary}\`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 24, fontWeight: 900,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                  }}>
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Absolute Mockup overlapping the right side */}
            <div style={{ position: 'absolute', right: -60, top: -140, width: 700, height: 600, zIndex: 5 }}>
              {/* Laptop */}
              <div style={{ position: 'absolute', bottom: 100, right: 80, width: 620, filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.2))' }}>
                <div style={{ background: '#1e293b', borderRadius: '24px 24px 0 0', padding: '16px 16px 0', border: '2px solid #334155', borderBottom: 'none' }}>
                  <div style={{ background: '#f8fafc', borderRadius: 12, height: 350, border: '1px solid #e2e8f0', padding: 16, overflow: 'hidden' }}>
                    {/* Mockup UI */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                       <div style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>{industry.mockup_title}</div>
                       <div style={{ width: 100, height: 16, background: '#e2e8f0', borderRadius: 8 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      {industry.kpis.slice(0,3).map((kpi, idx) => (
                        <div key={idx} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>{kpi.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{kpi.val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Chart */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, height: 180, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      {[35, 55, 45, 75, 50, 85, 65, 95].map((h, idx) => (
                        <div key={idx} style={{ flex: 1, background: idx === 7 ? primary : \`\${primary}40\`, borderRadius: '4px 4px 0 0', height: \`\${h}%\` }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#cbd5e1', height: 16, borderRadius: '0 0 6px 6px' }} />
                <div style={{ background: '#94a3b8', height: 8, borderRadius: '0 0 20px 20px', width: '110%', marginLeft: '-5%' }} />
              </div>
              
              {/* Phone overlaying the laptop */}
              <div style={{ position: 'absolute', bottom: 60, right: 30, width: 160, height: 320, background: '#fff', borderRadius: 24, border: '6px solid #1e293b', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.25))', zIndex: 10, overflow: 'hidden' }}>
                <div style={{ background: '#1e293b', width: 80, height: 16, position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', borderRadius: '0 0 8px 8px' }} />
                <div style={{ padding: '30px 12px 12px' }}>
                  <div style={{ background: \`\${primary}15\`, color: primary, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>{industry.highlight_title}</div>
                  <div style={{ background: '#f1f5f9', height: 40, borderRadius: 8, marginBottom: 8 }} />
                  <div style={{ background: '#f1f5f9', height: 40, borderRadius: 8, marginBottom: 8 }} />
                  <div style={{ background: '#f1f5f9', height: 40, borderRadius: 8 }} />
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* Footer Split Band */}
        <div style={{ height: 180, display: 'flex', width: '100%', zIndex: 20 }}>
          <div style={{ background: secondary, flex: '0 0 45%', padding: '0 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>DESDE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ color: '#fff', fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{price}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: 700 }}>/mes</div>
            </div>
          </div>
          
          <div style={{ background: primary, flex: 1, padding: '0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
             <div style={{ color: '#fff', fontSize: 42, fontWeight: 900, letterSpacing: 1, marginBottom: 8, textShadow: '0 2px 4px rgba(0,0,0,0.2)', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
               {cta}
             </div>
             {phone && (
               <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 20px', borderRadius: 20, color: '#fff', fontSize: 18, fontWeight: 800 }}>
                 📞 {phone}
               </div>
             )}
          </div>
        </div>
        
      </div>
    );
  }
);

export const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#0ea5e9';
    const secondary = data.secondaryColor || '#1e293b';
    
    const industry = deriveIndustryContent(data.prompt, data);
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    if (features.length === 0) features.push('Control total de créditos', 'Reportes automáticos en tiempo real', 'Opciones de pago múltiples');

    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1 || 'DOMINA TUS COBROS';
    const subheadline = data.subheadline || parsed.subtitle || h2 || 'Transforma el caos de tus cuentas por cobrar en un flujo constante.';
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, 'OPTIMIZA AHORA');

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: '#ffffff',
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px',
      }}>
        {/* Soft Background Ornaments */}
        <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, background: \`radial-gradient(circle, \${primary}30 0%, transparent 70%)\`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -200, right: -100, width: 600, height: 600, background: \`radial-gradient(circle, \${secondary}15 0%, transparent 70%)\`, borderRadius: '50%' }} />

        {/* Header (Logo + Title Centered) */}
        <div style={{ textAlign: 'center', zIndex: 10, width: '100%', marginBottom: 40 }}>
          {data.logoUrl ? (
             <img src={data.logoUrl} crossOrigin="anonymous" style={{ height: 60, objectFit: 'contain', marginBottom: 24 }} alt="Logo" />
          ) : (
             <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 24, letterSpacing: 2 }}>{data.company_name}</div>
          )}
          
          <h1 style={{
            fontSize: headline.length > 25 ? 56 : 68,
            fontWeight: 900,
            color: '#0f172a',
            lineHeight: 1.1,
            margin: '0 0 16px 0',
            textTransform: 'uppercase',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>{headline}</h1>
          <p style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#334155',
            margin: '0 auto',
            maxWidth: '80%',
            lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>{subheadline}</p>
        </div>

        {/* Central Floating UI / Dashboard Mockup */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 40, zIndex: 10 }}>
           {/* Abstract colored shape behind mockup */}
           <div style={{ position: 'absolute', width: '80%', height: '80%', background: \`linear-gradient(135deg, \${primary}, \${secondary})\`, borderRadius: 40, top: '10%', transform: 'rotate(-3deg)', zIndex: 0 }} />
           
           {/* Mockup UI Window */}
           <div style={{ width: '85%', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', padding: 24, zIndex: 5 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                 <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0' }} />
                 <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0' }} />
                 <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0' }} />
              </div>
              
              <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#64748b', marginBottom: 24 }}>{industry.highlight_title}</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {industry.kpis.slice(0,3).map((kpi, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: \`\${primary}20\`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: primary, fontWeight: 900 }}>✓</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>{kpi.label}</div>
                       </div>
                       <div style={{ width: '30%', height: 6, background: '#e2e8f0', borderRadius: 4 }}>
                          <div style={{ width: \`\${40 + idx*20}%\`, height: '100%', background: primary, borderRadius: 4 }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Footer Features & Button */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', zIndex: 10 }}>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, width: '80%' }}>
              {features.map((f, idx) => (
                 <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: primary }} />
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#475569', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f}</div>
                 </div>
              ))}
           </div>
           
           <div style={{ background: '#e11d48', color: '#fff', padding: '20px 60px', borderRadius: 100, fontSize: 28, fontWeight: 900, letterSpacing: 1, boxShadow: '0 10px 25px rgba(225,29,72,0.4)', textTransform: 'uppercase' }}>
              {cta}
           </div>
        </div>

      </div>
    );
  }
);
`;

const newContent = content.substring(0, startA) + newTemplateA + '\n' + content.substring(endAll);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Templates updated successfully!");
