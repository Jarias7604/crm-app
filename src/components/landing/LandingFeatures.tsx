import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Large centered product mockup SVGs

const OmnichannelMockup = () => (
  <div style={{background:'#fff',borderRadius:'16px',boxShadow:'0 24px 64px rgba(0,0,0,0.12)',overflow:'hidden',border:'1px solid #e8edf5',maxWidth:'800px',margin:'0 auto'}}>
    <div style={{background:'#1e2d5a',padding:'10px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
      <div style={{display:'flex',gap:'4px'}}>
        {['#ff5f57','#ffbd2e','#28ca41'].map(c=><div key={c} style={{width:'10px',height:'10px',borderRadius:'50%',background:c}}/>)}
      </div>
      <div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:'6px',padding:'3px 12px',fontSize:'10px',color:'rgba(255,255,255,0.6)'}}>ariascrm.com/inbox</div>
    </div>
    <div style={{display:'flex',height:'340px'}}>
      {/* Sidebar */}
      <div style={{width:'220px',borderRight:'1px solid #f3f4f6',background:'#fafbff',flexShrink:0}}>
        <div style={{padding:'12px',borderBottom:'1px solid #f3f4f6'}}>
          <div style={{background:'#e13b24',color:'white',fontSize:'10px',fontWeight:700,padding:'6px 10px',borderRadius:'6px',textAlign:'center'}}>+ Nueva Conversación</div>
        </div>
        {[
          {name:'Carlos Mendoza',ch:'WhatsApp',msg:'Me interesa el plan Pro',time:'10:32',unread:2,color:'#25d366'},
          {name:'Ana López',ch:'Instagram',msg:'¿Tienen demo disponible?',time:'10:18',unread:1,color:'#e1306c'},
          {name:'Pedro Ramírez',ch:'Meta Ads',msg:'Vi su anuncio en FB',time:'09:45',unread:0,color:'#1877f2'},
          {name:'María García',ch:'TikTok',msg:'¿Cuánto cuesta el plan?',time:'09:12',unread:0,color:'#000'},
          {name:'Luis Vásquez',ch:'WhatsApp',msg:'Perfecto, lo reviso',time:'ayer',unread:0,color:'#25d366'},
        ].map((c,i)=>(
          <div key={c.name} style={{padding:'10px 12px',borderBottom:'1px solid #f9fafb',background:i===0?'#f0f4ff':'white',cursor:'pointer',display:'flex',gap:'8px',alignItems:'flex-start'}}>
            <div style={{width:'34px',height:'34px',borderRadius:'50%',background:c.color,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'13px',fontWeight:700}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'11px',fontWeight:700,color:'#111827'}}>{c.name}</span>
                <span style={{fontSize:'9px',color:'#9ca3af'}}>{c.time}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'4px',marginTop:'2px'}}>
                <span style={{fontSize:'9px',background:c.color+'20',color:c.color,padding:'1px 5px',borderRadius:'4px',fontWeight:600}}>{c.ch}</span>
                <span style={{fontSize:'9px',color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.msg}</span>
              </div>
            </div>
            {c.unread>0&&<div style={{background:'#e13b24',color:'white',borderRadius:'50%',width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,flexShrink:0}}>{c.unread}</div>}
          </div>
        ))}
      </div>
      {/* Chat area */}
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:'10px',background:'white'}}>
          <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#25d366',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700}}>C</div>
          <div>
            <p style={{fontSize:'13px',fontWeight:700,color:'#111827'}}>Carlos Mendoza</p>
            <p style={{fontSize:'10px',color:'#25d366',fontWeight:600}}>● WhatsApp · En línea</p>
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:'6px'}}>
            <div style={{background:'#f0f4ff',borderRadius:'6px',padding:'5px 10px',fontSize:'10px',fontWeight:600,color:'#1f73b7',cursor:'pointer'}}>Asignar</div>
            <div style={{background:'#f0f4ff',borderRadius:'6px',padding:'5px 10px',fontSize:'10px',fontWeight:600,color:'#1f73b7',cursor:'pointer'}}>Ver lead</div>
          </div>
        </div>
        <div style={{flex:1,padding:'16px',background:'#f5f7fc',overflow:'hidden',display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{alignSelf:'flex-start',maxWidth:'70%'}}>
            <div style={{background:'white',borderRadius:'12px 12px 12px 0',padding:'10px 14px',boxShadow:'0 1px 4px rgba(0,0,0,0.08)',fontSize:'12px',color:'#374151'}}>Hola, vi su anuncio en TikTok. Me interesa el plan para mi equipo de 10 personas. ¿Tienen precios?</div>
            <p style={{fontSize:'9px',color:'#9ca3af',marginTop:'3px'}}>10:30</p>
          </div>
          <div style={{alignSelf:'flex-end',maxWidth:'75%'}}>
            <div style={{background:'#1f73b7',borderRadius:'12px 12px 0 12px',padding:'10px 14px',fontSize:'12px',color:'white'}}>
              ¡Hola Carlos! 👋 Claro que sí. Para equipos de 10 personas, el plan Growth a $99/mes es perfecto. ¿Quieres que te envíe una cotización personalizada?
            </div>
            <p style={{fontSize:'9px',color:'#9ca3af',marginTop:'3px',textAlign:'right'}}>10:32 · IA Agent ✓✓</p>
          </div>
          <div style={{alignSelf:'flex-start',maxWidth:'70%'}}>
            <div style={{background:'white',borderRadius:'12px 12px 12px 0',padding:'10px 14px',boxShadow:'0 1px 4px rgba(0,0,0,0.08)',fontSize:'12px',color:'#374151'}}>Sí, por favor. También me interesa ver una demo del sistema.</div>
            <p style={{fontSize:'9px',color:'#9ca3af',marginTop:'3px'}}>10:33</p>
          </div>
        </div>
        <div style={{padding:'10px 16px',borderTop:'1px solid #f3f4f6',background:'white',display:'flex',gap:'8px',alignItems:'center'}}>
          <input placeholder="Escribe un mensaje..." style={{flex:1,border:'1px solid #e5e7eb',borderRadius:'20px',padding:'8px 14px',fontSize:'12px',outline:'none'}}/>
          <button style={{background:'#e13b24',color:'white',borderRadius:'50%',width:'34px',height:'34px',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'14px'}}>→</button>
        </div>
      </div>
      {/* Right panel */}
      <div style={{width:'200px',borderLeft:'1px solid #f3f4f6',padding:'12px',background:'white',flexShrink:0}}>
        <p style={{fontSize:'10px',fontWeight:800,color:'#111827',marginBottom:'10px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Lead Info</p>
        {[
          {label:'Nombre',val:'Carlos Mendoza'},
          {label:'Canal',val:'TikTok Ads'},
          {label:'Empresa',val:'Distribuidora CM'},
          {label:'Teléfono',val:'+503 7890 1234'},
          {label:'Etapa',val:'Contactado'},
          {label:'Valor',val:'$3,200'},
        ].map(f=>(
          <div key={f.label} style={{marginBottom:'8px'}}>
            <p style={{fontSize:'9px',color:'#9ca3af',fontWeight:600}}>{f.label}</p>
            <p style={{fontSize:'11px',color:'#111827',fontWeight:600}}>{f.val}</p>
          </div>
        ))}
        <div style={{background:'#e13b24',color:'white',borderRadius:'6px',padding:'7px',textAlign:'center',fontSize:'10px',fontWeight:700,cursor:'pointer',marginTop:'8px'}}>Crear Cotización</div>
      </div>
    </div>
  </div>
);

const LeadHunterMockup = () => (
  <div style={{background:'#fff',borderRadius:'16px',boxShadow:'0 24px 64px rgba(0,0,0,0.12)',overflow:'hidden',border:'1px solid #e8edf5',maxWidth:'800px',margin:'0 auto'}}>
    <div style={{background:'#134e38',padding:'10px 20px',display:'flex',alignItems:'center',gap:'12px'}}>
      <span style={{color:'white',fontSize:'13px',fontWeight:700}}>🎯 Lead Hunter Pro</span>
      <div style={{background:'rgba(255,255,255,0.15)',borderRadius:'6px',padding:'5px 12px',display:'flex',alignItems:'center',gap:'8px',flex:1,maxWidth:'300px'}}>
        <span style={{fontSize:'11px',color:'rgba(255,255,255,0.7)'}}>Industria:</span>
        <span style={{fontSize:'11px',color:'white',fontWeight:600}}>Gimnasios y Fitness</span>
      </div>
      <div style={{background:'rgba(255,255,255,0.15)',borderRadius:'6px',padding:'5px 12px',display:'flex',alignItems:'center',gap:'8px'}}>
        <span style={{fontSize:'11px',color:'rgba(255,255,255,0.7)'}}>Ciudad:</span>
        <span style={{fontSize:'11px',color:'white',fontWeight:600}}>Miami, FL</span>
      </div>
      <button style={{background:'#e13b24',color:'white',border:'none',borderRadius:'6px',padding:'6px 16px',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>🔍 Buscar</button>
    </div>
    <div style={{display:'flex',height:'300px'}}>
      {/* Map area */}
      <div style={{width:'320px',background:'#e8f4e8',flexShrink:0,position:'relative',overflow:'hidden'}}>
        <svg viewBox="0 0 320 300" style={{width:'100%',height:'100%'}}>
          <rect width="320" height="300" fill="#e8f4e8"/>
          <path d="M30 150 Q80 100 130 130 Q180 90 240 120 Q280 100 310 110" stroke="#c8e0c8" strokeWidth="20" fill="none"/>
          <path d="M20 200 Q90 180 150 200 Q200 180 260 190 Q300 185 315 175" stroke="#c8e0c8" strokeWidth="15" fill="none"/>
          <rect x="60" y="120" width="40" height="30" rx="4" fill="#d4e8d4" stroke="#b8d4b8" strokeWidth="1"/>
          <rect x="140" y="90" width="50" height="35" rx="4" fill="#d4e8d4" stroke="#b8d4b8" strokeWidth="1"/>
          <rect x="220" y="110" width="45" height="28" rx="4" fill="#d4e8d4" stroke="#b8d4b8" strokeWidth="1"/>
          {[[80,118],[165,88],[243,108],[110,200],[200,195],[270,180],[145,155]].map(([x,y],i)=>(
            <g key={i}>
              <circle cx={x} cy={y} r="12" fill="#16a34a" opacity="0.9"/>
              <circle cx={x} cy={y} r="5" fill="white"/>
              <circle cx={x} cy={y+16} r="8" fill="#16a34a" opacity="0.2"/>
            </g>
          ))}
          <text x="160" y="280" textAnchor="middle" fill="#166534" fontSize="11" fontWeight="700">47 negocios encontrados</text>
        </svg>
      </div>
      {/* Results table */}
      <div style={{flex:1,overflow:'auto'}}>
        <div style={{padding:'10px 16px',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',fontWeight:700,color:'#111827'}}>47 leads encontrados · Miami, FL</span>
          <div style={{display:'flex',gap:'6px'}}>
            <button style={{background:'#f3f4f6',border:'none',borderRadius:'6px',padding:'5px 10px',fontSize:'10px',fontWeight:600,cursor:'pointer',color:'#374151'}}>Exportar CSV</button>
            <button style={{background:'#e13b24',border:'none',borderRadius:'6px',padding:'5px 10px',fontSize:'10px',fontWeight:700,cursor:'pointer',color:'white'}}>Agregar todos al CRM</button>
          </div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f9fafb'}}>
              {['','Negocio','Teléfono','Email','Rating','Acción'].map(h=>(
                <th key={h} style={{padding:'8px 10px',fontSize:'9px',fontWeight:700,color:'#6b7280',textAlign:'left',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {name:'FitLife Gym',phone:'+1 305 442 1234',email:'info@fitlife.com',rating:'4.8 ⭐',added:false},
              {name:'PowerZone Miami',phone:'+1 786 555 9876',email:'contact@pzone.com',rating:'4.6 ⭐',added:true},
              {name:'Iron Temple',phone:'+1 305 333 4567',email:'gym@irontemple.com',rating:'4.7 ⭐',added:false},
              {name:'South Beach Fit',phone:'+1 786 123 4567',email:'hello@sbfit.com',rating:'4.5 ⭐',added:false},
              {name:'Muscle Factory',phone:'+1 305 789 0123',email:'info@musclefact.com',rating:'4.9 ⭐',added:false},
            ].map((row,i)=>(
              <tr key={row.name} style={{borderBottom:'1px solid #f9fafb',background:i%2===0?'white':'#fafbff'}}>
                <td style={{padding:'8px 10px'}}><input type="checkbox" style={{cursor:'pointer'}}/></td>
                <td style={{padding:'8px 10px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <div style={{width:'28px',height:'28px',borderRadius:'6px',background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px'}}>🏋️</div>
                    <span style={{fontSize:'11px',fontWeight:600,color:'#111827'}}>{row.name}</span>
                  </div>
                </td>
                <td style={{padding:'8px 10px',fontSize:'10px',color:'#374151'}}>{row.phone}</td>
                <td style={{padding:'8px 10px',fontSize:'10px',color:'#1f73b7'}}>{row.email}</td>
                <td style={{padding:'8px 10px',fontSize:'10px',color:'#374151'}}>{row.rating}</td>
                <td style={{padding:'8px 10px'}}>
                  {row.added
                    ? <span style={{background:'#dcfce7',color:'#16a34a',fontSize:'9px',fontWeight:700,padding:'3px 8px',borderRadius:'4px'}}>✓ En CRM</span>
                    : <button style={{background:'#e13b24',color:'white',border:'none',borderRadius:'4px',padding:'3px 8px',fontSize:'9px',fontWeight:700,cursor:'pointer'}}>+ Agregar</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    bg:'#f7f7f3',
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
    labelES:'LEAD HUNTER PRO', labelEN:'LEAD HUNTER PRO',
    titleES:'500 prospectos de Google Maps en 60 segundos',
    titleEN:'500 prospects from Google Maps in 60 seconds',
    descES:'Ingresa industria y ciudad. Nuestro extractor entrega nombres, teléfonos y emails de empresas locales listos para tu pipeline de ventas.',
    descEN:'Enter industry and city. Our extractor delivers names, phones and emails of local businesses ready for your sales pipeline.',
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
