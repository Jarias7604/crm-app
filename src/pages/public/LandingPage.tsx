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

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');

  return (
    <div
      className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

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

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              ✕
            </button>
            <Login />
          </div>
        </div>
      )}
    </div>
  );
}
