import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useTranslation } from 'react-i18next';

// Real CRM Dashboard screenshot from production
const DashboardMockup = () => (
  <div style={{ position: 'relative', width: '100%' }}>
    {/* Real screenshot */}
    <div style={{
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
      border: '1px solid #e8edf5',
    }}>
      <img
        src="/crm-dashboard.png"
        alt="Arias CRM Dashboard — Pipeline, Leads, WhatsApp Inbox"
        style={{ width: '100%', display: 'block' }}
        loading="eager"
      />
    </div>
    {/* Floating badge: New lead */}
    <div style={{
      position: 'absolute', top: '-14px', right: '-12px',
      background: 'white', borderRadius: '14px', padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid #e8edf5',
      display: 'flex', gap: '8px', alignItems: 'center', zIndex: 10,
    }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#111827', margin: 0 }}>Nuevo lead capturado</p>
        <p style={{ fontSize: '9px', color: '#6b7280', margin: 0 }}>TikTok Ads · hace 2 seg</p>
      </div>
    </div>
    {/* Floating badge: AI response time */}
    <div style={{
      position: 'absolute', bottom: '-14px', left: '24px',
      background: 'white', borderRadius: '14px', padding: '10px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid #e8edf5',
    }}>
      <p style={{ fontSize: '9px', color: '#6b7280', margin: '0 0 2px' }}>IA respondió en</p>
      <p style={{ fontSize: '20px', fontWeight: 900, color: '#e13b24', margin: 0 }}>2.4 seg</p>
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

        {/* Full-width real dashboard screenshot below */}
        <div style={{marginTop:'72px',paddingBottom:'40px'}}>
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
