import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

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
          <ArrowLeft className="w-4 h-4" /> Volver al Inicio
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Política de Privacidad</h1>
            <p className="text-sm text-slate-400 mt-1">Última actualización: 3 de junio de 2026</p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-3xl p-8 md:p-10 space-y-8 text-slate-300">
          
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2>1. Introducción y Consentimiento</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              En Arias CRM, valoramos profundamente tu privacidad y la seguridad de tus datos. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos la información cuando interactúas con nuestra plataforma, incluyendo nuestros servicios de integración con terceros como Google Workspace. Al utilizar nuestros servicios, aceptas las prácticas descritas en este documento.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h2>2. Integración con Google Calendar</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Arias CRM ofrece una sincronización nativa y opcional con Google Calendar para facilitar la gestión de reuniones y seguimientos de clientes (leads).
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs uppercase text-indigo-300">¿Qué datos solicitamos?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Solicitamos acceso a tus calendarios de Google (lectura y escritura de eventos) y tu dirección de correo electrónico para identificar tu integración.
                </p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs uppercase text-indigo-300">¿Cómo usamos esta información?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sincronizamos tus seguimientos del CRM directamente como eventos de Google Calendar. Si lo deseas, generamos enlaces automáticos de Google Meet para tus citas.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Eye className="w-5 h-5 text-indigo-400" />
              <h2>3. Uso Limitado de Datos (Google API Services)</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              El uso y la transferencia por parte de Arias CRM a cualquier otra aplicación de la información recibida de las APIs de Google se adherirán a la 
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" 
                target="_blank" 
                rel="noreferrer" 
                className="text-indigo-400 hover:underline mx-1"
              >
                Política de Datos de Usuario de los Servicios de las APIs de Google
              </a>, incluyendo los requisitos de Uso Limitado (Limited Use). No vendemos ni compartimos los datos de tu cuenta de Google con anunciantes ni con terceros ajenos al servicio.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <h2>4. Seguridad y Retención</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Almacenamos de manera encriptada y segura las credenciales de acceso OAuth (access token y refresh token). Estos tokens permanecen bajo estrictas políticas de Row Level Security (RLS) en nuestra base de datos, lo que garantiza que solo tú y los usuarios autorizados de tu empresa tengan acceso a ellos. Puedes desconectar y eliminar tu integración de Google en cualquier momento desde la sección de Integraciones.
            </p>
          </section>

          <section className="space-y-4">
            <div className="text-white font-bold text-lg">
              <h2>5. Contacto</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Si tienes preguntas sobre esta política o deseas ejercer tus derechos sobre tus datos, puedes ponerte en contacto con nosotros escribiendo al correo electrónico: <strong className="text-white">jarias7604@gmail.com</strong>.
            </p>
          </section>

        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
