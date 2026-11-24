import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2, Youtube, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

export default function PrivacyPolicy() {
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
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {txt('Política de Privacidad — Arias CRM', 'Privacy Policy — Arias CRM')}
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
          {/* 1. Scope & Data Collected */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2>{txt('1. Introducción, Responsable y Datos Recopilados', '1. Introduction, Controller & Information Collected')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'Arias CRM (operado por Arias Defense Components LLC, https://www.ariascrm.com) es una plataforma empresarial SaaS multi-tenant para gestión de clientes, agenda comercial y planificación de redes sociales. Cuando utilizas nuestra aplicación o conectas integraciones de terceros autorizadas por ti, recopilamos y procesamos únicamente la información necesaria para brindar el servicio:',
                'Arias CRM (operated by Arias Defense Components LLC, https://www.ariascrm.com) is a multi-tenant B2B SaaS platform for customer relationship management, scheduling, and social media planning. When you use our application or connect authorized third-party integrations, we collect and process only the data strictly required to deliver the requested features:',
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-200">{txt('Datos de cuenta y empresa:', 'Account & Organization Data:')}</strong>{' '}
                {txt(
                  'nombre, correo electrónico corporativo, rol y registros CRM ingresados por tu organización.',
                  'full name, business email address, user role, and CRM records created by your organization.',
                )}
              </li>
              <li>
                <strong className="text-slate-200">{txt('Credenciales OAuth autorizadas:', 'Authorized OAuth Credentials:')}</strong>{' '}
                {txt(
                  'tokens de acceso y actualización emitidos tras tu consentimiento explícito en Google OAuth 2.0 o Meta OAuth, almacenados aislados por empresa.',
                  'access and refresh tokens issued upon your explicit Google OAuth 2.0 or Meta OAuth consent, stored isolated per company tenant.',
                )}
              </li>
              <li>
                <strong className="text-slate-200">{txt('Registros técnicos y seguridad:', 'Security & Diagnostic Logs:')}</strong>{' '}
                {txt(
                  'marcas de tiempo de sincronización, resultados de publicación (ID de publicación o error) y auditoría de acceso.',
                  'synchronization timestamps, publish audit results (post/video IDs or error messages), and access audit logs.',
                )}
              </li>
            </ul>
          </section>

          {/* 2. Google Calendar Integration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h2>{txt('2. Integración con Google Calendar (Workspace APIs)', '2. Google Calendar Integration (Workspace APIs)')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'Arias CRM ofrece una sincronización bidireccional opcional con Google Calendar utilizando únicamente los permisos mínimos necesarios (calendar.events y calendar.readonly).',
                'Arias CRM provides optional synchronization with Google Calendar using only the minimum required scopes (https://www.googleapis.com/auth/calendar.events and https://www.googleapis.com/auth/calendar.readonly).',
              )}
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div className="bg-white/[0.02] border border-white/10 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-indigo-300 text-xs uppercase">
                  {txt('Qué accedemos', 'What Data We Access')}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {txt(
                    'Tu correo de Google para identificar el calendario conectado, tus eventos para evitar conflictos de horario y crear citas de seguimiento con enlace automático de Google Meet cuando lo solicitas.',
                    'Your Google account email to label the connected calendar, existing event busy intervals to prevent double-booking, and calendar events created or updated directly at your request (including optional Google Meet links).',
                  )}
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/10 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-indigo-300 text-xs uppercase">
                  {txt('Qué nunca hacemos', 'What We Never Do')}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {txt(
                    'No leemos tus correos de Gmail, no accedemos a archivos privados de Drive ajenos a tu acción, ni vendemos ni transferimos información de tu calendario a terceros o anunciantes.',
                    'We do not access Gmail messages, private Google Drive files outside explicit user actions, or contacts beyond your scheduled CRM appointments. We never sell, rent, or transfer Google user data to data brokers or advertisers.',
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* 3. YouTube API Services */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Youtube className="w-5 h-5 text-red-400" />
              <h2>{txt('3. Integración con YouTube API Services', '3. YouTube API Services Integration')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'Dentro del módulo Social Planning, el usuario puede conectar voluntariamente uno o varios canales de YouTube (permisos youtube.readonly y youtube.upload) con el único fin de:',
                'Within the Arias CRM Social Planning module, authenticated business users may voluntarily connect one or more YouTube channels using YouTube API Services (https://www.googleapis.com/auth/youtube.readonly and https://www.googleapis.com/auth/youtube.upload) strictly to:',
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-400 leading-relaxed">
              <li>
                {txt(
                  'Listar el nombre, identificador y avatar de los canales autorizados por el usuario para mostrarlos en el selector de cuentas del CRM.',
                  'Retrieve the channel title, channel ID, subscriber count, and avatar URL of channels owned/managed by the authenticating Google account so the user can choose the destination channel.',
                )}
              </li>
              <li>
                {txt(
                  'Subir y publicar archivos de video o Shorts junto con el título y descripción configurados explícitamente por el usuario para su publicación inmediata o programada.',
                  'Upload and publish user-provided MP4/MOV video files, titles, and descriptions only when explicitly triggered by the user via "Publish Now" or their scheduled Social Planning calendar entry.',
                )}
              </li>
            </ul>
            <p className="text-xs text-slate-300 bg-white/[0.03] border border-white/10 rounded-xl p-4 leading-relaxed">
              {txt(
                'Al conectar y utilizar la integración de YouTube en Arias CRM, también aceptas quedar sujeto a los ',
                'Arias CRM uses YouTube API Services. By connecting a YouTube channel or publishing content to YouTube through Arias CRM, you acknowledge and agree to be bound by the ',
              )}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline font-semibold"
              >
                {txt('Términos de Servicio de YouTube', 'YouTube Terms of Service')}
              </a>{' '}
              {txt('y a la ', 'and the ')}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline font-semibold"
              >
                {txt('Política de Privacidad de Google', 'Google Privacy Policy')}
              </a>
              .
            </p>
          </section>

          {/* 4. Limited Use & Explicit Non-AI Training Pledge */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Eye className="w-5 h-5 text-indigo-400" />
              <h2>
                {txt(
                  '4. Uso Limitado y Prohibición de Entrenamiento de Modelos de IA / ML',
                  '4. Google API Services Limited Use & Zero AI/ML Model Training Policy',
                )}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'El uso y la transferencia por parte de Arias CRM a cualquier otra aplicación de la información recibida de las APIs de Google (incluyendo Google Calendar y YouTube API Services) se adherirá estrictamente a la ',
                "Arias CRM's use and transfer to any other app of information received from Google APIs (including Google Workspace Calendar APIs and YouTube API Services) strictly adheres to the ",
              )}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline font-semibold"
              >
                Google API Services User Data Policy
              </a>
              {txt(', incluyendo todos los requisitos de Uso Limitado (Limited Use).', ', including the Limited Use requirements.')}
            </p>
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-400/30 p-4 text-sm text-indigo-100 leading-relaxed font-medium">
              {txt(
                'Declaración explícita sobre Inteligencia Artificial: Arias CRM NO retiene, utiliza ni transfiere datos obtenidos a través de Google Workspace APIs o YouTube API Services para desarrollar, mejorar ni entrenar modelos generalizados de inteligencia artificial (IA) o aprendizaje automático (ML).',
                'Explicit AI/ML Affirmation: Arias CRM does NOT retain, share, or use any user data obtained through Google Workspace APIs or YouTube API Services to develop, improve, or train generalized artificial intelligence (AI) and/or machine learning (ML) models.',
              )}
            </div>
          </section>

          {/* 5. Security, Storage & Revocation */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <h2>{txt('5. Seguridad, Retención y Revocación de Acceso', '5. Data Security, Retention & Revoking Access')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {txt(
                'Todas las credenciales OAuth (access_token y refresh_token) se almacenan cifradas en tránsito (HTTPS/TLS) y en reposo en nuestra base de datos bajo estricto aislamiento multi-empresa mediante Row Level Security (RLS). Solo los usuarios autorizados de tu empresa acceden a tus configuraciones.',
                'All OAuth tokens and authorized channel metadata are encrypted in transit (HTTPS/TLS) and at rest under strict PostgreSQL Row Level Security (RLS) tenant isolation so no other company can view or use your credentials.',
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-200">{txt('Desconexión inmediata:', 'In-App Disconnection:')}</strong>{' '}
                {txt(
                  'Puedes desconectar Google Calendar o tus canales de YouTube en cualquier momento dentro de Arias CRM (Integraciones o Planning → Conexiones), lo cual desactiva y borra inmediatamente el token de acceso en el servidor.',
                  'You may disconnect Google Calendar or any YouTube channel at any time inside Arias CRM (Company Integrations or Social Planning → Connections), which immediately clears the stored access token.',
                )}
              </li>
              <li>
                <strong className="text-slate-200">{txt('Revocación desde Google:', 'Revocation via Google Security Settings:')}</strong>{' '}
                {txt(
                  'También puedes revocar el acceso de Arias CRM en cualquier momento desde ',
                  'In addition to disconnecting inside Arias CRM, you can revoke Arias CRM access at any time directly through the ',
                )}
                <a
                  href="https://security.google.com/settings/security/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  Google Security Settings Page
                </a>
                .
              </li>
              <li>
                <strong className="text-slate-200">{txt('Eliminación de datos:', 'Data Deletion & Retention:')}</strong>{' '}
                {txt(
                  'Conservamos los metadatos de publicación únicamente mientras tu cuenta esté activa; puedes solicitar la eliminación definitiva de todos tus datos escribiendo a nuestros correos de contacto (plazo máximo 30 días).',
                  'We retain authorized connection metadata only while your account remains active. Upon disconnection or deletion request sent to our privacy contacts below, stored API data and tokens are purged within 30 days.',
                )}
              </li>
            </ul>
          </section>

          {/* 6. Contact & Terms Link */}
          <section className="space-y-3 pt-2 border-t border-white/10">
            <h2 className="text-white font-bold text-lg">{txt('6. Contacto y Términos Relacionados', '6. Contact Information & Terms')}</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'Si tienes preguntas sobre esta Política de Privacidad o deseas solicitar acceso, corrección o eliminación de tus datos, contáctanos:',
                'If you have questions about this Privacy Policy or wish to request access, correction, or deletion of your data, please contact our team:',
              )}
            </p>
            <div className="text-sm text-slate-300 space-y-1">
              <div>
                <strong className="text-white">Arias Defense Components LLC (Arias CRM)</strong>
              </div>
              <div>
                Email: <strong className="text-white">jimmy@ariasdefense.com</strong> /{' '}
                <strong className="text-white">jarias7604@gmail.com</strong>
              </div>
              <div className="pt-2">
                <Link to="/terms" className="text-indigo-400 hover:underline text-xs font-semibold">
                  {txt('Ver Términos de Servicio →', 'Read Terms of Service →')}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
