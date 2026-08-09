import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import LandingHero from '../../components/landing/LandingHero';
import LandingFeatures from '../../components/landing/LandingFeatures';
import LandingPricing from '../../components/landing/LandingPricing';
import LandingFaqCta from '../../components/landing/LandingFaqCta';
import AriasAgent from '../../components/landing/AriasAgent';
import Login from '../Login';

// Load Inter font
const interFont = document.createElement('link');
interFont.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
interFont.rel = 'stylesheet';
if (!document.head.querySelector('[href*="Inter"]')) document.head.appendChild(interFont);

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');

  return (
    <div
      className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >

      {/* Navbar */}
      <LandingNavbar
        onLoginClick={() => setShowLogin(true)}
        onProductClick={() => {}}
      />

      {/* Hero */}
      <LandingHero onLoginClick={() => setShowLogin(true)} />

      {/* Social proof bar */}
      <section className="bg-gray-50 border-b border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
            {isES ? 'Usado por equipos de ventas modernos en Latinoamérica' : 'Used by modern sales teams in Latin America'}
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center justify-items-center">
            {[
              { label: '500+', sub: isES ? 'usuarios activos' : 'active users' },
              { label: '38%', sub: isES ? 'tasa de cierre' : 'close rate' },
              { label: '24/7', sub: isES ? 'AI disponible' : 'AI uptime' },
              { label: '<120ms', sub: isES ? 'captura de leads' : 'lead capture' },
              { label: '99.9%', sub: 'SLA uptime' },
              { label: '4.9★', sub: isES ? 'satisfacción' : 'satisfaction' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-black text-gray-900">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — 9-slide carousel */}
      <LandingFeatures />

      {/* Pricing */}
      <LandingPricing />

      {/* Why + FAQ + CTA */}
      <LandingFaqCta />

      {/* Footer */}
      <LandingFooter />

      {/* AI Chatbot */}
      <AriasAgent />

      {/* Login modal — dark theme matching Login.tsx */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}
        >
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden" style={{ background: '#0b1120' }}>
            {/* Close button */}
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
            >
              ✕
            </button>
            {/* Gradient top accent */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)' }} />
            <div className="p-8">
              <Login />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
