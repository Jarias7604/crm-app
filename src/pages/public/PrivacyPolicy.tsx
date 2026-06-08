import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  
  const txt = (esVal: string, enVal: string) => i18n.language?.startsWith('es') ? esVal : enVal;

  return (
    <div className="min-h-screen bg-[#07070d] text-white font-sans antialiased overflow-x-hidden" style={{ fontFamily: "'Inter','system-ui',sans-serif" }}>
      {/* Background glow effects */}
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] right-[10%] w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Landing Navbar */}
      <LandingNavbar onLoginClick={() => navigate('/login')} onProductClick={() => {}} />

      <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 relative z-10">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {txt('Volver al Inicio', 'Back to Home')}
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">{txt('Política de Privacidad', 'Privacy Policy')}</h1>
            <p className="text-sm text-slate-400 mt-1">{txt('Última actualización: 3 de junio de 2026', 'Last updated: June 3, 2026')}</p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-3xl p-8 md:p-10 space-y-8 text-slate-300">
          
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2>{txt('1. Introducción y Consentimiento', '1. Introduction and Consent')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'En Arias CRM, valoramos profundamente tu privacidad y la seguridad de tus datos. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos la información cuando interactúas con nuestra plataforma, incluyendo nuestros servicios de integración con terceros como Google Workspace. Al utilizar nuestros servicios, aceptas las prácticas descritas en este documento.',
                'At Arias CRM, we deeply value your privacy and the security of your data. This Privacy Policy describes how we collect, use, store, and protect information when you interact with our platform, including our integration services with third parties such as Google Workspace. By using our services, you accept the practices described in this document.'
              )}
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h2>{txt('2. Integración con Google Calendar', '2. Google Calendar Integration')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'Arias CRM ofrece una sincronización nativa y opcional con Google Calendar para facilitar la gestión de reuniones y seguimientos de clientes (leads).',
                'Arias CRM offers native and optional synchronization with Google Calendar to facilitate meeting management and customer (lead) follow-ups.'
              )}
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs uppercase text-indigo-300">{txt('¿Qué datos solicitamos?', 'What data do we request?')}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {txt(
                    'Solicitamos acceso a tus calendarios de Google (lectura y escritura de eventos) y tu dirección de correo electrónico para identificar tu integración.',
                    'We request access to your Google calendars (read and write events) and your email address to identify your integration.'
                  )}
                </p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs uppercase text-indigo-300">{txt('¿Cómo usamos esta información?', 'How do we use this information?')}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {txt(
                    'Sincronizamos tus seguimientos del CRM directamente como eventos de Google Calendar. Si lo deseas, generamos enlaces automáticos de Google Meet para tus citas.',
                    'We synchronize your CRM follow-ups directly as Google Calendar events. If you wish, we generate automatic Google Meet links for your appointments.'
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Eye className="w-5 h-5 text-indigo-400" />
              <h2>{txt('3. Uso Limitado de Datos (Google API Services)', '3. Limited Use of Data (Google API Services)')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'El uso y la transferencia por parte de Arias CRM a cualquier otra aplicación de la información recibida de las APIs de Google se adherirán a la ',
                'Arias CRM’s use and transfer to any other app of information received from Google APIs will adhere to the '
              )}
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" 
                target="_blank" 
                rel="noreferrer" 
                className="text-indigo-400 hover:underline mx-1"
              >
                {txt(
                  'Política de Datos de Usuario de los Servicios de las APIs de Google',
                  'Google API Services User Data Policy'
                )}
              </a>
              {txt(
                ', incluyendo los requisitos de Uso Limitado (Limited Use). No vendemos ni compartimos los datos de tu cuenta de Google con anunciantes ni con terceros ajenos al servicio.',
                ', including Limited Use requirements. We do not sell or share your Google account data with advertisers or third parties outside the service.'
              )}
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <h2>{txt('4. Seguridad y Retención', '4. Security and Retention')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'Almacenamos de manera encriptada y segura las credenciales de acceso OAuth (access token y refresh token). Estos tokens permanecen bajo estrictas políticas de Row Level Security (RLS) en nuestra base de datos, lo que garantiza que solo tú y los usuarios autorizados de tu empresa tengan acceso a ellos. Puedes desconectar y eliminar tu integración de Google en cualquier momento desde la sección de Integraciones.',
                'We store OAuth access credentials (access token and refresh token) in an encrypted and secure manner. These tokens remain under strict Row Level Security (RLS) policies in our database, which guarantees that only you and the authorized users of your company have access to them. You can disconnect and remove your Google integration at any time from the Integrations section.'
              )}
            </p>
          </section>

          <section className="space-y-4">
            <div className="text-white font-bold text-lg">
              <h2>{txt('5. Contacto', '5. Contact')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {txt(
                'Si tienes preguntas sobre esta política o deseas ejercer tus derechos sobre tus datos, puedes ponerte en contacto con nosotros escribiendo al correo electrónico: ',
                'If you have questions about this policy or wish to exercise your rights regarding your data, you can contact us by writing to the email: '
              )}
              <strong className="text-white">jarias7604@gmail.com</strong>.
            </p>
          </section>

        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
