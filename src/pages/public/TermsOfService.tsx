import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileCheck2, Globe, ShieldCheck, Youtube, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

export default function TermsOfService() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [langOverride, setLangOverride] = useState<'en' | 'es' | null>(null);

  const activeLang: 'en' | 'es' =
    langOverride ?? (i18n.language?.startsWith('es') ? 'es' : 'en');
  const txt = (esVal: string, enVal: string) => (activeLang === 'es' ? esVal : enVal);

  return (
    <div
      className="min-h-screen bg-[#07070d] text-white font-sans antialiased overflow-x-hidden"
      style={{ fontFamily: "'Inter','system-ui',sans-serif" }}
    >
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] right-[10%] w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <LandingNavbar onLoginClick={() => navigate('/login')} onProductClick={() => {}} />

      <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {txt('Volver al Inicio', 'Back to Home')}
          </button>

          <div className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 text-xs">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <button
              type="button"
              onClick={() => setLangOverride('en')}
              className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
                activeLang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLangOverride('es')}
              className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
                activeLang === 'es' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Español
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {txt('Términos de Servicio — Arias CRM', 'Terms of Service — Arias CRM')}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {txt(
                'Operado por Arias Defense Components LLC · Última actualización: 24 de noviembre de 2026',
                'Operated by Arias Defense Components LLC · Last updated: November 24, 2026',
              )}
            </p>
          </div>
        </div>

        <div className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-3xl p-8 md:p-10 space-y-8 text-slate-300">
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h2>{txt('1. Aceptación y Descripción del Servicio', '1. Acceptance & Service Description')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'Al acceder o utilizar Arias CRM (https://www.ariascrm.com), operado por Arias Defense Components LLC, aceptas cumplir estos Términos de Servicio y nuestra Política de Privacidad. Arias CRM proporciona herramientas empresariales de gestión comercial (CRM), agenda, cotizaciones y programación de publicaciones en redes sociales.',
                'By accessing or using Arias CRM (https://www.ariascrm.com), operated by Arias Defense Components LLC, you agree to be bound by these Terms of Service and our Privacy Policy. Arias CRM provides B2B CRM tools, calendar scheduling, quoting, and multi-channel social media planning.',
              )}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-bold text-lg">
              {txt('2. Cuentas, Autorización Multi-Tenant y Uso Aceptable', '2. Accounts, Multi-Tenant Isolation & Acceptable Use')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'Cada organización es responsable de la confidencialidad de sus usuarios, del contenido que publica o programa y de contar con los derechos necesarios sobre las imágenes, videos y descripciones cargados en la plataforma. Está prohibido utilizar Arias CRM para spam, fraude o violación de leyes aplicables o políticas de plataformas conectadas.',
                'Each customer organization is responsible for safeguarding its account credentials and ensuring it holds all necessary rights and permissions for media, captions, and videos scheduled or published through Arias CRM. You may not use the service for spam, unauthorized scraping, or unlawful activity.',
              )}
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Youtube className="w-5 h-5 text-red-400" />
              <h2>{txt('3. Integraciones de Terceros (Google, YouTube y Meta)', '3. Third-Party Integrations (Google, YouTube & Meta)')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'Arias CRM se integra opcionalmente con Google Calendar, YouTube API Services y Meta (Facebook/Instagram) exclusivamente bajo autorización explícita del usuario. El tratamiento de los datos recibidos de las APIs de Google cumple íntegramente con la Google API Services User Data Policy (Limited Use).',
                'Arias CRM integrates optionally with Google Calendar, YouTube API Services, and Meta Platforms solely upon your explicit OAuth authorization. Handling of data received from Google APIs complies strictly with the Google API Services User Data Policy (Limited Use).',
              )}
            </p>
            <p className="text-xs text-slate-300 bg-white/[0.03] border border-white/10 rounded-xl p-4 leading-relaxed">
              {txt(
                'Aviso obligatorio de YouTube: Al utilizar funciones conectadas con YouTube dentro de Arias CRM, aceptas cumplir los ',
                'Mandatory YouTube Notice: By using YouTube features within Arias CRM, you agree to be bound by the ',
              )}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline font-semibold"
              >
                {txt('Términos de Servicio de YouTube', 'YouTube Terms of Service')}
              </a>
              .{' '}
              {txt('Puedes revocar los permisos en ', 'You can revoke API access anytime via ')}
              <a
                href="https://security.google.com/settings/security/permissions"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline"
              >
                Google Security Settings
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <AlertCircle className="w-5 h-5 text-indigo-400" />
              <h2>{txt('4. Propiedad, Disponibilidad y Limitación de Responsabilidad', '4. Ownership, Availability & Limitation of Liability')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'Conservas la plena titularidad de tus datos y contenido multimedia. Arias CRM se proporciona según disponibilidad operativa ("tal cual") y no será responsable por interrupciones derivadas de plataformas externas (Google, Meta, OpenAI) o cambios en sus APIs.',
                'You retain full ownership of your business data and uploaded media. Arias CRM is provided on an "as available" basis, and Arias Defense Components LLC is not liable for service interruptions caused by third-party API providers.',
              )}
            </p>
          </section>

          <section className="space-y-3 pt-2 border-t border-white/10">
            <h2 className="text-white font-bold text-lg">{txt('5. Contacto', '5. Contact')}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Arias Defense Components LLC · <strong className="text-white">jimmy@ariasdefense.com</strong> /{' '}
              <strong className="text-white">jarias7604@gmail.com</strong>
            </p>
            <div>
              <Link to="/privacy" className="text-indigo-400 hover:underline text-xs font-semibold">
                {txt('Ver Política de Privacidad →', 'Read Privacy Policy →')}
              </Link>
            </div>
          </section>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
