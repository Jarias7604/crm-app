import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Large centered product mockup SVGs

const OmnichannelMockup = () => (
  <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.12)', overflow: 'hidden', border: '1px solid #e8edf5', maxWidth: '1150px', margin: '0 auto' }}>
    <img
      src="/crm-omnichannel-inbox.png"
      alt="Bandeja Omnicanal WhatsApp & Telegram — Arias CRM"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      loading="lazy"
    />
  </div>
);

const LeadHunterMockup = () => (
  <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.12)', overflow: 'hidden', border: '1px solid #e8edf5', maxWidth: '1150px', margin: '0 auto' }}>
    <img
      src="/crm-lead-hunter.png"
      alt="Lead Hunter AI PRO — Arias CRM"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      loading="lazy"
    />
  </div>
);

const AIAgentMockup = () => (
  <div style={{background:'#fff',borderRadius:'16px',boxShadow:'0 24px 64px rgba(0,0,0,0.12)',overflow:'hidden',border:'1px solid #e8edf5',maxWidth:'800px',margin:'0 auto'}}>
    <div style={{background:'#2d1b69',padding:'12px 20px',display:'flex',alignItems:'center',gap:'12px'}}>
      <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#8b5cf6,#06b6d4)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:'13px'}}>AI</div>
      <div>
        <p style={{color:'white',fontSize:'13px',fontWeight:700}}>Sofía — Agente de Ventas IA</p>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'10px'}}>● En línea · GPT-4o · WhatsApp Business</p>
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:'8px'}}>
        <div style={{background:'rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',fontSize:'10px',color:'rgba(255,255,255,0.7)'}}>Configurar</div>
        <div style={{background:'#e13b24',borderRadius:'6px',padding:'5px 10px',fontSize:'10px',color:'white',fontWeight:700}}>Activa</div>
      </div>
    </div>
    <div style={{display:'flex',height:'300px'}}>
      {/* Stats sidebar */}
      <div style={{width:'180px',borderRight:'1px solid #f3f4f6',padding:'14px',background:'#fafbff',flexShrink:0}}>
        <p style={{fontSize:'9px',fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Métricas Hoy</p>
        {[
          {label:'Respuestas',val:'147',color:'#8b5cf6'},
          {label:'Leads calif.',val:'38',color:'#10b981'},
          {label:'Demos agend.',val:'12',color:'#1f73b7'},
          {label:'Cotizaciones',val:'8',color:'#f97316'},
          {label:'Tiempo resp.',val:'2.4s',color:'#e13b24'},
        ].map(s=>(
          <div key={s.label} style={{marginBottom:'10px'}}>
            <p style={{fontSize:'9px',color:'#6b7280'}}>{s.label}</p>
            <p style={{fontSize:'20px',fontWeight:900,color:s.color,lineHeight:1}}>{s.val}</p>
          </div>
        ))}
      </div>
      {/* Live chat */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f7fc'}}>
        <div style={{padding:'8px 14px',background:'rgba(255,255,255,0.8)',borderBottom:'1px solid #e8edf5',fontSize:'10px',color:'#6b7280',display:'flex',gap:'16px'}}>
          <span style={{color:'#8b5cf6',fontWeight:600}}>● Conversación activa: Carlos M.</span>
          <span>Duración: 3:24</span>
          <span>Etapa: Calificación</span>
        </div>
        <div style={{flex:1,padding:'16px',display:'flex',flexDirection:'column',gap:'10px',overflow:'hidden'}}>
          <div style={{alignSelf:'flex-end',maxWidth:'75%'}}>
            <div style={{background:'#8b5cf6',borderRadius:'12px 12px 0 12px',padding:'10px 14px',fontSize:'12px',color:'white'}}>
              Hola Carlos, vi que te interesa nuestro CRM. ¿Cuántas personas tiene tu equipo de ventas actualmente?
            </div>
            <p style={{fontSize:'9px',color:'#9ca3af',textAlign:'right',marginTop:'3px'}}>Sofía · IA · 10:30</p>
          </div>
          <div style={{alignSelf:'flex-start',maxWidth:'70%'}}>
            <div style={{background:'white',borderRadius:'12px 12px 12px 0',padding:'10px 14px',fontSize:'12px',color:'#374151',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              Somos 15 personas, tenemos muchos leads de TikTok pero los perdemos porque no hay seguimiento.
            </div>
            <p style={{fontSize:'9px',color:'#9ca3af',marginTop:'3px'}}>Carlos · 10:31</p>
          </div>
          <div style={{alignSelf:'flex-end',maxWidth:'80%'}}>
            <div style={{background:'#8b5cf6',borderRadius:'12px 12px 0 12px',padding:'10px 14px',fontSize:'12px',color:'white'}}>
              ¡Perfecto! Arias CRM conecta tu cuenta de TikTok Ads directamente. Cada lead entra automáticamente y yo los contacto en segundos. Para 15 personas, el plan Growth a $99/mes es ideal. ¿Te genero una cotización ahora?
            </div>
            <p style={{fontSize:'9px',color:'#9ca3af',textAlign:'right',marginTop:'3px'}}>Sofía · IA · 10:32</p>
          </div>
        </div>
        {/* AI suggestion bar */}
        <div style={{padding:'10px 14px',background:'white',borderTop:'1px solid #e8edf5'}}>
          <p style={{fontSize:'9px',color:'#8b5cf6',fontWeight:700,marginBottom:'4px'}}>💡 Sofía sugiere:</p>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            {['Enviar cotización Growth','Agendar demo ahora','Preguntar por presupuesto'].map(s=>(
              <button key={s} style={{background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:'20px',padding:'4px 10px',fontSize:'9px',color:'#7c3aed',fontWeight:600,cursor:'pointer'}}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SECTIONS = [
  {
    bg:'#fff',
    textColor:'#111827',
    labelColor:'#1f73b7',
    labelES:'OMNICANAL', labelEN:'OMNICHANNEL',
    titleES:'Todas tus conversaciones en un solo lugar',
    titleEN:'All your conversations in one place',
    descES:'WhatsApp, Instagram, TikTok, Meta Ads y más — todo centralizado. Tu equipo atiende sin cruzar cuentas. El admin ve todo desde arriba.',
    descEN:'WhatsApp, Instagram, TikTok, Meta Ads and more — all centralized. Your team responds without crossing accounts. Admin sees everything from above.',
    linkES:'Ver Bandeja Omnicanal →', linkEN:'See Omnichannel Inbox →',
    Mockup: OmnichannelMockup,
  },
  {
    bg:'#1a1d20',
    textColor:'#fff',
    labelColor:'#fbbf24',
    labelES:'LEAD HUNTER PRO & EMAIL SCRAPER', labelEN:'LEAD HUNTER PRO & EMAIL SCRAPER',
    titleES:'500 prospectos de Google Maps con extracción de Emails en 60 segundos',
    titleEN:'500 Google Maps prospects with Email Extraction in 60 seconds',
    descES:'Ingresa industria y ciudad. Nuestro motor de IA escanea sitios web en tiempo real para extraer correos corporativos, teléfonos y nombres de empresas locales listos para tus campañas masivas de email y pipeline de ventas.',
    descEN:'Enter industry and city. Our AI engine scans websites in real-time to extract verified corporate emails, phone numbers and business details ready for your outbound email campaigns and sales pipeline.',
    linkES:'Explorar Lead Hunter →', linkEN:'Explore Lead Hunter →',
    Mockup: LeadHunterMockup,
  },
  {
    bg:'#f7f7f3',
    textColor:'#111827',
    labelColor:'#8b5cf6',
    labelES:'AGENTE IA 24/7', labelEN:'AI AGENT 24/7',
    titleES:'Tu vendedor virtual que nunca descansa',
    titleEN:'Your virtual sales agent that never rests',
    descES:'Sofía, tu AI Agent, califica leads, responde objeciones, cotiza productos y agenda reuniones en WhatsApp mientras tu equipo duerme.',
    descEN:'Sofía, your AI Agent, qualifies leads, handles objections, quotes products and schedules meetings on WhatsApp while your team sleeps.',
    linkES:'Conocer al AI Agent →', linkEN:'Meet the AI Agent →',
    Mockup: AIAgentMockup,
  },
];

export default function LandingFeatures() {
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const t = (es: string, en: string) => isES ? es : en;

  return (
    <>
      {/* Section header */}
      <div style={{background:'white',padding:'60px 24px 0',textAlign:'center'}}>
        <div className="max-w-7xl mx-auto">
          <span style={{fontSize:'11px',fontWeight:800,color:'#1f73b7',letterSpacing:'0.2em',textTransform:'uppercase'}}>
            {isES ? 'La Plataforma Completa' : 'The Complete Platform'}
          </span>
          <h2 style={{fontSize:'clamp(28px,3.5vw,44px)',fontWeight:900,color:'#111827',marginTop:'8px',lineHeight:1.1}}>
            {isES ? 'Todo lo que tu equipo de ventas necesita' : 'Everything your sales team needs'}
          </h2>
        </div>
      </div>

      {/* ─── 2-ROW ZIGZAG SHOWCASE: MOBILE QUOTE & LEAD WORKFLOW ─── */}
      <section className="bg-gradient-to-b from-white via-slate-50/60 to-white py-16 px-6 border-b border-slate-100">
        <div className="max-w-7xl mx-auto space-y-20">
          
          {/* ROW 1: Text Left | Flyer 1 Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-black uppercase tracking-wider">
                📱 {t('Ventas Móviles en la Calle y Oficina', 'Mobile Sales in Field & Office')}
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 leading-tight">
                {t('Creación de Cotizaciones y Nuevos Leads al Instante', 'Instant Quote & New Lead Creation')}
              </h3>
              <p className="text-slate-600 text-base leading-relaxed">
                {t(
                  'Desde cualquier teléfono móvil, tus asesores pueden registrar prospectos y armar propuestas comerciales en segundos sin depender de una computadora de escritorio.',
                  'From any smartphone, your agents can log prospects and build commercial proposals in seconds without needing a desktop computer.'
                )}
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                    ⚡
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{t('Botón + de Acción Rápida', 'Fast Action + Button')}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t('Ubicado en la barra inferior para crear cotizaciones o prospectos con 1 toque.', 'Located in the bottom navigation to create quotes or leads in 1 tap.')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                    📊
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{t('Lead Discovery & Pipeline Visual', 'Lead Discovery & Visual Pipeline')}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t('Visualiza tarjetas, valores potenciales y estados de prospectos en tiempo real.', 'View cards, deal values, and prospect stages in real time.')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 flex justify-center">
              <div className="rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 bg-white p-2.5 max-w-lg w-full hover:shadow-cyan-500/10 transition-shadow">
                <img
                  src="/flyer-movil-parte1.jpg"
                  alt="Arias CRM — Creación de Cotizaciones y Nuevos Leads"
                  className="w-full h-auto rounded-2xl block"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* ROW 2: Flyer 2 Left | Text Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
              <div className="rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 bg-white p-2.5 max-w-lg w-full hover:shadow-indigo-500/10 transition-shadow">
                <img
                  src="/flyer-movil-parte2.jpg"
                  alt="Arias CRM — 3 Pasos para comenzar y envío por WhatsApp"
                  className="w-full h-auto rounded-2xl block"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-black uppercase tracking-wider">
                🚀 {t('Flujo de Cierre en 3 Pasos', '3-Step Closing Workflow')}
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 leading-tight">
                {t('Cotiza, Genera el PDF y Envía por WhatsApp en 30 Segundos', 'Quote, Generate PDF & Send via WhatsApp in 30 Seconds')}
              </h3>
              <p className="text-slate-600 text-base leading-relaxed">
                {t(
                  'El proceso de venta más rápido del mercado: selecciona el cliente, agrega los productos del catálogo y dispara la cotización con tu logo directo al WhatsApp del cliente.',
                  'The fastest sales workflow: pick the client, add catalog items, and shoot the branded quote directly to your client’s WhatsApp chat.'
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center mb-1.5">1</span>
                  <p className="text-xs font-bold text-slate-900">{t('Ve a Leads', 'Go to Leads')}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t('Toca el botón +', 'Tap + button')}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center mb-1.5">2</span>
                  <p className="text-xs font-bold text-slate-900">{t('Elige Opción', 'Pick Option')}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t('Nueva Cotización', 'New Quote')}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center mb-1.5">3</span>
                  <p className="text-xs font-bold text-slate-900">{t('WhatsApp', 'WhatsApp')}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t('Envío en PDF', 'PDF Send')}</p>
                </div>
              </div>

              {/* DTE Badge */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇸🇻</span>
                  <div>
                    <p className="text-xs font-black text-indigo-300 uppercase tracking-wider">{t('Add-on Exclusivo para El Salvador', 'Exclusive Add-on for El Salvador')}</p>
                    <p className="text-xs text-slate-300">{t('Facturación Electrónica DTE oficial conectada con Hacienda.', 'Official DTE Electronic Invoicing with Hacienda.')}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full border border-indigo-400/30 whitespace-nowrap">
                  CRM + ERP DTE
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {SECTIONS.map((sec, i) => {
        const { Mockup } = sec;
        return (
          <section key={i} style={{background:sec.bg,padding:'72px 24px'}}>
            <div className="max-w-7xl mx-auto">
              {/* Section label + title */}
              <div style={{textAlign:'center',marginBottom:'40px'}}>
                <span style={{fontSize:'11px',fontWeight:800,color:sec.labelColor,letterSpacing:'0.2em',textTransform:'uppercase'}}>
                  {isES ? sec.labelES : sec.labelEN}
                </span>
                <h3 style={{fontSize:'clamp(26px,3vw,40px)',fontWeight:900,color:sec.textColor,marginTop:'8px',lineHeight:1.1,maxWidth:'640px',margin:'10px auto 0'}}>
                  {isES ? sec.titleES : sec.titleEN}
                </h3>
                <p style={{fontSize:'16px',color:sec.textColor==='#fff'?'rgba(255,255,255,0.65)':'#6b7280',marginTop:'12px',maxWidth:'560px',margin:'12px auto 0',lineHeight:1.7}}>
                  {isES ? sec.descES : sec.descEN}
                </p>
                <a href="#" style={{display:'inline-block',marginTop:'12px',color:sec.labelColor,fontSize:'13px',fontWeight:700,textDecoration:'none'}}>
                  {isES ? sec.linkES : sec.linkEN}
                </a>
              </div>
              {/* Full-width mockup */}
              <Mockup />
            </div>
          </section>
        );
      })}
    </>
  );
}
