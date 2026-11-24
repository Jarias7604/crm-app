import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Play, Sparkles, Youtube } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useTranslation } from 'react-i18next';

interface LandingHeroProps {
  onLoginClick: () => void;
}

export default function LandingHero({ onLoginClick }: LandingHeroProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const t = (es: string, en: string) => (isES ? es : en);

  return (
    <section
      style={{
        background: 'linear-gradient(160deg,#fafafa 0%,#f0f4ff 100%)',
        borderBottom: '1px solid #e8edf5',
      }}
      className="pt-28 pb-20 relative overflow-hidden"
    >
      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(#e8edf5 1px,transparent 1px),linear-gradient(90deg,#e8edf5 1px,transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.4,
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Two-column public product hero */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Product Copy & Public CTAs */}
          <div className="pt-4">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fff0ef',
                border: '1px solid #fecaca',
                borderRadius: '100px',
                padding: '6px 14px',
                marginBottom: '24px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#e13b24',
                  display: 'inline-block',
                }}
                className="animate-pulse"
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#e13b24',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {t('CRM #1 para Latinoamérica', '#1 B2B CRM & Social Planning Suite')}
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(36px,4vw,56px)',
                fontWeight: 900,
                color: '#111827',
                lineHeight: 1.06,
                letterSpacing: '-0.02em',
                marginBottom: '20px',
              }}
            >
              {t('Convierte más leads en clientes,', 'Convert more leads into customers,')}
              <br />
              <span style={{ color: '#1f73b7', position: 'relative', display: 'inline-block' }}>
                {t('automáticamente.', 'automatically.')}
                <svg
                  viewBox="0 0 260 14"
                  style={{ position: 'absolute', bottom: '-4px', left: 0, width: '100%' }}
                  fill="none"
                >
                  <path
                    d="M4 10 Q65 4 130 8 Q195 12 256 6"
                    stroke="#fbbf24"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p
              style={{
                fontSize: '17px',
                color: '#4b5563',
                lineHeight: 1.7,
                maxWidth: '500px',
                marginBottom: '28px',
              }}
            >
              {t(
                'Arias CRM unifica pipeline de ventas, sincronización con Google Calendar, cotizaciones y planificación de redes (Facebook, Instagram y YouTube) en una sola plataforma empresarial.',
                'Arias CRM unifies B2B lead pipelines, Google Calendar scheduling, automated quoting, and Social Planning across Facebook, Instagram, and YouTube in one multi-tenant platform.',
              )}
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                    color: 'white',
                    fontWeight: 800,
                    padding: '14px 32px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '15px',
                    boxShadow: '0 8px 25px rgba(6,182,212,0.35)',
                  }}
                  className="hover:scale-105 active:scale-95 transition-all"
                >
                  {t('Ir al Dashboard →', 'Go to Dashboard →')}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/register')}
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                      color: 'white',
                      fontWeight: 800,
                      padding: '14px 32px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '15px',
                      boxShadow: '0 8px 25px rgba(6,182,212,0.35)',
                    }}
                    className="hover:scale-105 active:scale-95 transition-all"
                  >
                    {t('Prueba gratuita 14 días →', 'Start 14-day free trial →')}
                  </button>
                  <button
                    onClick={onLoginClick}
                    style={{
                      background: 'white',
                      color: '#374151',
                      fontWeight: 600,
                      padding: '14px 28px',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                      cursor: 'pointer',
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    className="hover:bg-slate-50 transition-all"
                  >
                    <Play size={14} style={{ color: '#1f73b7' }} fill="#1f73b7" />
                    {t('Iniciar sesión / Demo', 'Sign in / Watch demo')}
                  </button>
                </>
              )}
            </div>

            {/* Trust micro-signals + public legal links */}
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                t('✓ Sin tarjeta de crédito', '✓ No credit card'),
                t('✓ Multi-empresa seguro (RLS)', '✓ Multi-tenant RLS security'),
                t('✓ Soporte técnico directo', '✓ Direct support'),
              ].map((s, i) => (
                <span key={i} style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                  {s}
                </span>
              ))}
              <Link to="/privacy" className="text-xs font-semibold text-indigo-700 hover:underline">
                {t('Política de Privacidad', 'Privacy Policy')}
              </Link>
              <Link to="/terms" className="text-xs font-semibold text-indigo-700 hover:underline">
                {t('Términos de Servicio', 'Terms of Service')}
              </Link>
            </div>
          </div>

          {/* Right: Commercial Platform Overview & Live Dashboard Showcase */}
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.10)',
              border: '1px solid #e8edf5',
            }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t('Vista de Plataforma · Arias CRM', 'Platform Overview · Arias CRM')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> CRM &amp; Leads
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[11px] font-semibold">
                  <Calendar className="w-3 h-3" /> Google Calendar
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold">
                  <Youtube className="w-3 h-3" /> Meta &amp; YouTube
                </span>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img
                src="/crm-dashboard.png"
                alt="Arias CRM Dashboard — Leads, Calendar & Social Planning"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                loading="eager"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
              <span>
                {t(
                  'Operado por Arias Defense Components LLC',
                  'Operated by Arias Defense Components LLC',
                )}
              </span>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="font-bold text-indigo-700 hover:underline cursor-pointer"
              >
                {t('Explorar prueba gratuita →', 'Explore free 14-day trial →')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
