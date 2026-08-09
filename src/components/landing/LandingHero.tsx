import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useTranslation } from 'react-i18next';

// Realistic CRM dashboard mockup SVG
const DashboardMockup = () => (
  <div className="relative w-full">
    {/* Main dashboard card */}
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200" style={{background:'#fff'}}>
      {/* Top bar */}
      <div style={{background:'#1e2d5a'}} className="px-4 py-2 flex items-center gap-3">
        <div style={{background:'#2d4080'}} className="rounded-lg px-3 py-1 text-white text-xs font-bold">Arias CRM</div>
        {['Pipeline','Leads','WhatsApp','Reportes','Campañas'].map(tab=>(
          <span key={tab} className="text-xs text-white/50 hover:text-white cursor-pointer px-2">{tab}</span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-xs">A</div>
        </div>
      </div>
      {/* Content area */}
      <div className="flex" style={{minHeight:'320px'}}>
        {/* Sidebar */}
        <div style={{background:'#f8faff',width:'52px',borderRight:'1px solid #e8edf5'}} className="flex flex-col items-center py-3 gap-3 flex-shrink-0">
          {[['▦','#3b82f6'],['◉','#8b5cf6'],['◈','#06b6d4'],['▲','#10b981'],['⋮','#94a3b8']].map(([ic,cl],i)=>(
            <div key={i} style={{background:i===0?cl+'20':'transparent',color:i===0?cl:'#94a3b8'}} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm cursor-pointer hover:bg-blue-50 transition-colors">{ic}</div>
          ))}
        </div>
        {/* Main content */}
        <div style={{background:'#f5f7fc'}} className="flex-1 p-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              {label:'Leads Totales',val:'1,247',change:'+18%',color:'#3b82f6'},
              {label:'Cerrados Hoy',val:'38',change:'+34%',color:'#10b981'},
              {label:'Revenue Mes',val:'$94K',change:'+22%',color:'#8b5cf6'},
              {label:'Tasa Cierre',val:'38%',change:'+12%',color:'#f97316'},
            ].map((s,i)=>(
              <div key={i} style={{background:'#fff',border:'1px solid #e8edf5'}} className="rounded-xl p-3 shadow-sm">
                <p style={{color:'#94a3b8',fontSize:'10px'}} className="font-medium mb-1">{s.label}</p>
                <p style={{color:'#111827',fontSize:'20px',fontWeight:900}} className="leading-none">{s.val}</p>
                <p style={{color:'#10b981',fontSize:'10px'}} className="font-bold mt-1">{s.change} vs mes anterior</p>
              </div>
            ))}
          </div>
          {/* Pipeline + Chat split */}
          <div className="grid grid-cols-3 gap-3">
            {/* Kanban */}
            <div className="col-span-2" style={{background:'#fff',border:'1px solid #e8edf5',borderRadius:'12px',padding:'12px'}}>
              <div className="flex items-center justify-between mb-3">
                <p style={{fontSize:'11px',fontWeight:700,color:'#111827'}}>Pipeline de Ventas</p>
                <div style={{background:'#e13b24',color:'white',fontSize:'9px',fontWeight:700}} className="px-2 py-1 rounded-full">+ Nuevo Lead</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  {stage:'Nuevos',color:'#3b82f6',leads:['Carlos M.','Ana L.','Pedro R.']},
                  {stage:'Contactados',color:'#8b5cf6',leads:['María G.','Luis V.']},
                  {stage:'Propuesta',color:'#f97316',leads:['Julia H.','Miguel A.']},
                  {stage:'Ganados',color:'#10b981',leads:['Sofía C.']},
                ].map(col=>(
                  <div key={col.stage}>
                    <div style={{background:col.color+'15',borderRadius:'6px',padding:'4px 6px',marginBottom:'6px'}}>
                      <span style={{color:col.color,fontSize:'9px',fontWeight:700}}>{col.stage} ({col.leads.length})</span>
                    </div>
                    {col.leads.map(n=>(
                      <div key={n} style={{background:'#f8faff',border:'1px solid #e8edf5',borderRadius:'8px',padding:'6px',marginBottom:'4px'}}>
                        <div style={{fontSize:'9px',fontWeight:600,color:'#374151'}}>{n}</div>
                        <div style={{height:'2px',background:col.color+'30',borderRadius:'2px',marginTop:'3px'}}>
                          <div style={{height:'2px',background:col.color,borderRadius:'2px',width:'60%'}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* WhatsApp chat */}
            <div style={{background:'#fff',border:'1px solid #e8edf5',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{background:'#25d366',padding:'8px 10px'}}>
                <p style={{color:'white',fontSize:'10px',fontWeight:700}}>WhatsApp Inbox</p>
                <p style={{color:'rgba(255,255,255,0.7)',fontSize:'8px'}}>3 conversaciones activas</p>
              </div>
              <div style={{padding:'8px'}}>
                {[
                  {name:'Carlos M.',msg:'Me interesa el plan...',time:'10:32',unread:2},
                  {name:'Ana López',msg:'¿Tienen demo disponible?',time:'10:18',unread:1},
                  {name:'Pedro R.',msg:'Perfecto, lo revisaré',time:'09:45',unread:0},
                ].map(c=>(
                  <div key={c.name} style={{borderBottom:'1px solid #f3f4f6',padding:'6px 0',display:'flex',gap:'6px',alignItems:'center'}}>
                    <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'#e8edf5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#374151',flexShrink:0}}>{c.name[0]}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:'10px',fontWeight:700,color:'#111827'}}>{c.name}</span>
                        <span style={{fontSize:'8px',color:'#94a3b8'}}>{c.time}</span>
                      </div>
                      <p style={{fontSize:'9px',color:'#6b7280',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.msg}</p>
                    </div>
                    {c.unread>0&&<div style={{background:'#25d366',color:'white',borderRadius:'50%',width:'16px',height:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700,flexShrink:0}}>{c.unread}</div>}
                  </div>
                ))}
                {/* AI response suggestion */}
                <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:'8px',padding:'6px',marginTop:'6px'}}>
                  <p style={{fontSize:'8px',color:'#0369a1',fontWeight:700,marginBottom:'2px'}}>💡 Respuesta sugerida IA:</p>
                  <p style={{fontSize:'8px',color:'#374151'}}>"Hola Carlos, claro que sí..."</p>
                  <button style={{background:'#e13b24',color:'white',fontSize:'8px',fontWeight:700,padding:'2px 8px',borderRadius:'4px',marginTop:'4px',border:'none',cursor:'pointer'}}>Enviar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* Floating notification */}
    <div style={{position:'absolute',top:'-12px',right:'-16px',background:'white',borderRadius:'16px',padding:'10px 14px',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',border:'1px solid #e8edf5',display:'flex',gap:'8px',alignItems:'center',zIndex:10}}>
      <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#10b981',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
      </div>
      <div>
        <p style={{fontSize:'10px',fontWeight:700,color:'#111827'}}>Nuevo lead capturado</p>
        <p style={{fontSize:'9px',color:'#6b7280'}}>TikTok Ads · hace 2 seg</p>
      </div>
    </div>
    {/* Bottom metric */}
    <div style={{position:'absolute',bottom:'-14px',left:'24px',background:'white',borderRadius:'16px',padding:'10px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',border:'1px solid #e8edf5'}}>
      <p style={{fontSize:'9px',color:'#6b7280',marginBottom:'2px'}}>IA respondió en</p>
      <p style={{fontSize:'18px',fontWeight:900,color:'#e13b24'}}>2.4 seg</p>
    </div>
  </div>
);

interface LandingHeroProps { onLoginClick: () => void; }

export default function LandingHero({ onLoginClick }: LandingHeroProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const t = (es: string, en: string) => isES ? es : en;

  return (
    <section style={{background:'linear-gradient(160deg,#fafafa 0%,#f0f4ff 100%)',borderBottom:'1px solid #e8edf5'}} className="pt-28 pb-24 relative overflow-hidden">
      {/* Subtle grid */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(#e8edf5 1px,transparent 1px),linear-gradient(90deg,#e8edf5 1px,transparent 1px)',backgroundSize:'40px 40px',opacity:0.4}} />
      
      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Two-column hero */}
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: Copy */}
          <div className="pt-8">
            {/* Badge */}
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'#fff0ef',border:'1px solid #fecaca',borderRadius:'100px',padding:'6px 14px',marginBottom:'24px'}}>
              <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#e13b24',display:'inline-block'}} className="animate-pulse"/>
              <span style={{fontSize:'11px',fontWeight:700,color:'#e13b24',letterSpacing:'0.1em',textTransform:'uppercase'}}>
                {t('CRM #1 para Latinoamérica','#1 CRM for Latin America')}
              </span>
            </div>

            {/* Headline — Zoho style with colored word */}
            <h1 style={{fontSize:'clamp(36px,4vw,58px)',fontWeight:900,color:'#111827',lineHeight:1.05,letterSpacing:'-0.02em',marginBottom:'20px'}}>
              {t('Convierte más leads en clientes,','Convert more leads into customers,')}<br/>
              <span style={{color:'#1f73b7',position:'relative',display:'inline-block'}}>
                {t('automáticamente.','automatically.')}
                <svg viewBox="0 0 260 14" style={{position:'absolute',bottom:'-4px',left:0,width:'100%'}} fill="none">
                  <path d="M4 10 Q65 4 130 8 Q195 12 256 6" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>

            <p style={{fontSize:'17px',color:'#6b7280',lineHeight:1.7,maxWidth:'480px',marginBottom:'32px'}}>
              {t(
                'Arias CRM unifica leads, WhatsApp, AI Agent, cotizaciones y campañas en una sola plataforma. Diseñado para equipos de ventas modernos.',
                'Arias CRM unifies leads, WhatsApp, AI Agent, quotes and campaigns in one platform. Built for modern sales teams.'
              )}
            </p>

            {/* CTAs */}
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'32px'}}>
              {user ? (
                <button onClick={() => navigate('/dashboard')} style={{background:'#e13b24',color:'white',fontWeight:700,padding:'14px 32px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'15px',boxShadow:'0 4px 24px rgba(225,59,36,0.35)'}}>
                  {t('Ir al Dashboard →','Go to Dashboard →')}
                </button>
              ) : (
                <>
                  <button onClick={() => navigate('/register')} style={{background:'#e13b24',color:'white',fontWeight:700,padding:'14px 32px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'15px',boxShadow:'0 4px 24px rgba(225,59,36,0.35)'}}>
                    {t('Empieza gratis →','Start free →')}
                  </button>
                  <button onClick={onLoginClick} style={{background:'white',color:'#374151',fontWeight:600,padding:'14px 28px',borderRadius:'8px',border:'1px solid #d1d5db',cursor:'pointer',fontSize:'15px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <Play size={14} style={{color:'#1f73b7'}} fill="#1f73b7"/>
                    {t('Ver demo','Watch demo')}
                  </button>
                </>
              )}
            </div>

            {/* Trust micro-signals */}
            <div style={{display:'flex',gap:'20px',flexWrap:'wrap'}}>
              {[
                t('✓ Sin tarjeta de crédito','✓ No credit card'),
                t('✓ Cancela cuando quieras','✓ Cancel anytime'),
                t('✓ Soporte en español','✓ Spanish support'),
              ].map((s,i)=>(
                <span key={i} style={{fontSize:'12px',color:'#6b7280',fontWeight:500}}>{s}</span>
              ))}
            </div>
          </div>

          {/* Right: Sign-up card (Zoho style) */}
          <div style={{background:'white',borderRadius:'20px',padding:'32px',boxShadow:'0 20px 60px rgba(0,0,0,0.12)',border:'1px solid #e8edf5'}}>
            <h3 style={{fontSize:'18px',fontWeight:800,color:'#111827',marginBottom:'6px'}}>
              {t('Prueba gratuita — 14 días','Free trial — 14 days')}
            </h3>
            <p style={{fontSize:'13px',color:'#6b7280',marginBottom:'20px'}}>
              {t('Sin tarjeta de crédito. Cancela cuando quieras.','No credit card. Cancel anytime.')}
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'16px'}}>
              {[
                {placeholder:t('Tu nombre completo','Your full name'),type:'text'},
                {placeholder:t('Email corporativo','Corporate email'),type:'email'},
                {placeholder:t('Nombre de tu empresa','Company name'),type:'text'},
                {placeholder:t('Teléfono de contacto','Contact phone'),type:'tel'},
              ].map((f,i)=>(
                <input key={i} type={f.type} placeholder={f.placeholder} style={{width:'100%',padding:'11px 14px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',color:'#374151',outline:'none',boxSizing:'border-box'}} onFocus={e=>{e.target.style.borderColor='#1f73b7'}} onBlur={e=>{e.target.style.borderColor='#d1d5db'}}/>
              ))}
            </div>
            <button onClick={() => navigate('/register')} style={{width:'100%',background:'#e13b24',color:'white',fontWeight:800,padding:'14px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'15px',letterSpacing:'0.03em',boxShadow:'0 4px 20px rgba(225,59,36,0.3)'}}>
              {t('CREAR MI CUENTA GRATIS','CREATE MY FREE ACCOUNT')}
            </button>
            <p style={{fontSize:'11px',color:'#9ca3af',textAlign:'center',marginTop:'12px'}}>
              {t('Al registrarte aceptas nuestros Términos de Servicio','By signing up you agree to our Terms of Service')}
            </p>
          </div>
        </div>

        {/* Full-width dashboard mockup below */}
        <div style={{marginTop:'64px',paddingBottom:'32px'}}>
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
