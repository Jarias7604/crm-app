import { useNavigate } from 'react-router-dom';
import { PlayCircle, CheckCircle2, Building2, Users, Database, Bot, ArrowRight, Zap, Target, LineChart, MessageSquare, Briefcase, TrendingUp, Shield, Clock, BarChart3, Sparkles, Star } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthProvider';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import AriasAgent from '../../components/landing/AriasAgent';
import Login from '../Login';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const en = i18n.language !== 'es';
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['saas_plans_public'],
    queryFn: async () => {
      const { data, error } = await supabase.from('saas_plans').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-500 selection:text-white">
      <LandingNavbar onLoginClick={() => setShowLoginModal(true)} />

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 25% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(16,185,129,0.2) 0%, transparent 50%)'}} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <img src="/hero_professional.png" alt="Arias CRM" className="w-full rounded-2xl shadow-2xl border border-white/10" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-200">{en ? '#1 AI-Powered CRM Platform' : 'Plataforma CRM con IA #1'}</span>
              </div>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
                {en ? 'Sell smarter.' : 'Vende mejor.'}<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                  {en ? 'Grow faster.' : 'Crece más rápido.'}
                </span>
              </h1>
              <p className="text-lg text-slate-300 mb-8 max-w-xl leading-relaxed">
                {en ? 'The complete CRM platform that unifies sales, marketing, service & AI agents — so your team closes more deals in less time.' : 'La plataforma CRM completa que unifica ventas, marketing, servicio y agentes IA — para que tu equipo cierre más tratos en menos tiempo.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <Button onClick={() => navigate('/dashboard')} size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg px-8 py-4 h-auto">
                    {en ? 'Go to Dashboard' : 'Ir al Dashboard'} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => navigate('/register')} size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg px-8 py-4 h-auto shadow-lg shadow-blue-600/30">
                      {en ? 'Start free trial' : 'Prueba gratis'}
                    </Button>
                    <Button variant="outline" size="lg" className="bg-white/5 hover:bg-white/10 border-white/20 text-white font-semibold rounded-lg px-8 py-4 h-auto">
                      <PlayCircle className="w-5 h-5 mr-2" />{en ? 'Watch demo' : 'Ver demo'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: '10,000+', label: en ? 'Leads Managed' : 'Leads Gestionados' },
              { num: '98%', label: en ? 'Uptime SLA' : 'Disponibilidad SLA' },
              { num: '3x', label: en ? 'Faster Deal Closing' : 'Cierre de Tratos Más Rápido' },
              { num: '500+', label: en ? 'Companies Trust Us' : 'Empresas Confían en Nosotros' },
            ].map((s, i) => (
              <div key={i}>
                <p className="text-3xl font-extrabold text-slate-900">{s.num}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRODUCTS ═══ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">{en ? 'Everything you need to grow' : 'Todo lo que necesitas para crecer'}</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">{en ? 'One platform for sales, marketing, service, and AI automation.' : 'Una plataforma para ventas, marketing, servicio y automatización con IA.'}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { title: 'Sales Cloud', icon: Target, desc: en ? 'Pipeline management, quotes, and deal tracking.' : 'Gestión de pipeline, cotizaciones y seguimiento.', color: 'text-blue-600', bg: 'bg-blue-50' },
              { title: 'Marketing Hub', icon: Zap, desc: en ? 'Email campaigns, lead hunter, and AI flyers.' : 'Campañas email, lead hunter y flyers con IA.', color: 'text-orange-600', bg: 'bg-orange-50' },
              { title: 'Service Desk', icon: MessageSquare, desc: en ? 'Ticket management and SLA tracking.' : 'Gestión de tickets y seguimiento SLA.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { title: 'AI Agents', icon: Bot, desc: en ? 'Autonomous agents that work 24/7.' : 'Agentes autónomos que trabajan 24/7.', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((p, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all duration-300 cursor-pointer">
                <div className={`w-12 h-12 ${p.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <p.icon className={`w-6 h-6 ${p.color}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{p.desc}</p>
                <span className="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  {en ? 'Learn more' : 'Saber más'} <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE: DASHBOARD ═══ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sm font-bold text-blue-600 uppercase tracking-wider">{en ? 'Sales Intelligence' : 'Inteligencia de Ventas'}</span>
              <h2 className="text-3xl font-bold text-slate-900 mt-3 mb-4">{en ? 'See your entire pipeline at a glance' : 'Ve todo tu pipeline de un vistazo'}</h2>
              <p className="text-slate-500 mb-6 leading-relaxed">{en ? 'Track every deal from first contact to close. Kanban boards, revenue forecasting, and AI-powered insights help your team prioritize what matters.' : 'Sigue cada trato desde el primer contacto al cierre. Tableros Kanban, pronósticos de ingresos e insights con IA ayudan a tu equipo a priorizar lo que importa.'}</p>
              <ul className="space-y-3">
                {(en ? ['Drag & drop pipeline management', 'AI lead scoring & prioritization', 'Real-time revenue forecasting', 'Automated follow-up sequences'] : ['Gestión de pipeline drag & drop', 'Scoring de leads con IA', 'Pronóstico de ingresos en tiempo real', 'Secuencias de seguimiento automatizadas']).map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />{f}</li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <img src="/feature_dashboard.png" alt="Dashboard" className="w-full rounded-2xl shadow-xl border border-slate-200" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURE: ANALYTICS (reversed) ═══ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img src="/feature_analytics.png" alt="Analytics" className="w-full rounded-2xl shadow-xl border border-slate-200" />
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-sm font-bold text-purple-600 uppercase tracking-wider">{en ? 'Marketing Automation' : 'Automatización de Marketing'}</span>
              <h2 className="text-3xl font-bold text-slate-900 mt-3 mb-4">{en ? 'Campaigns that convert, powered by AI' : 'Campañas que convierten, potenciadas por IA'}</h2>
              <p className="text-slate-500 mb-6 leading-relaxed">{en ? 'Launch multi-channel campaigns, discover new leads with Lead Hunter, and let AI agents handle the rest. Every interaction is tracked.' : 'Lanza campañas multicanal, descubre nuevos leads con Lead Hunter, y deja que los agentes IA se encarguen del resto.'}</p>
              <ul className="space-y-3">
                {(en ? ['Multi-channel email & SMS campaigns', 'AI-powered Lead Hunter discovery', 'Smart audience segmentation', 'Real-time campaign analytics'] : ['Campañas email y SMS multicanal', 'Descubrimiento de leads con IA', 'Segmentación inteligente de audiencia', 'Analítica de campañas en tiempo real']).map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY ARIAS ═══ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">{en ? 'Why companies choose Arias CRM' : 'Por qué las empresas eligen Arias CRM'}</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">{en ? 'Built for teams that want results, not complexity.' : 'Hecho para equipos que quieren resultados, no complejidad.'}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: en ? '3x Faster Growth' : '3x Más Rápido', desc: en ? 'Companies using Arias CRM close deals 3x faster than industry average.' : 'Las empresas que usan Arias CRM cierran tratos 3x más rápido.' },
              { icon: Shield, title: en ? 'Enterprise Security' : 'Seguridad Enterprise', desc: en ? 'Row-level security, SOC 2 compliance, and multi-tenant data isolation.' : 'Seguridad por filas, cumplimiento SOC 2, aislamiento de datos multi-tenant.' },
              { icon: Clock, title: en ? '24/7 AI Agents' : 'Agentes IA 24/7', desc: en ? 'AI agents handle inquiries, qualify leads, and book meetings around the clock.' : 'Los agentes IA gestionan consultas, califican leads y agendan reuniones 24/7.' },
              { icon: BarChart3, title: en ? 'Real-Time Analytics' : 'Analítica en Tiempo Real', desc: en ? 'Live dashboards, revenue forecasting, and team performance tracking.' : 'Dashboards en vivo, pronósticos de ingresos y seguimiento de rendimiento.' },
              { icon: Zap, title: en ? 'Automation First' : 'Automatización Primero', desc: en ? 'Automate follow-ups, campaigns, and workflows. Less manual work.' : 'Automatiza seguimientos, campañas y flujos. Menos trabajo manual.' },
              { icon: Star, title: en ? 'Premium Support' : 'Soporte Premium', desc: en ? 'Dedicated success manager, onboarding, and 99.9% uptime guarantee.' : 'Gerente de éxito dedicado, onboarding y garantía de 99.9% uptime.' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-md transition-shadow">
                <item.icon className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">{en ? 'Simple, transparent pricing' : 'Precios simples y transparentes'}</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">{en ? 'Start free. Upgrade when you need more.' : 'Empieza gratis. Mejora cuando necesites más.'}</p>
          </div>
          {isLoading ? (
            <div className="flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
              {plans.map((plan) => {
                const isPro = plan.slug === 'pro';
                return (
                  <div key={plan.id} className={`relative bg-white rounded-2xl p-7 border ${isPro ? 'border-blue-600 shadow-xl shadow-blue-900/10 scale-[1.03] z-10' : 'border-slate-200 shadow-sm'}`}>
                    {isPro && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase">{en ? 'Most Popular' : 'Más Popular'}</div>}
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                    <p className="text-sm text-slate-500 mb-5 min-h-[36px]">{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-extrabold text-slate-900">{formatPrice(plan.price_monthly)}</span>
                      <span className="text-slate-500 font-medium">/{en ? 'mo' : 'mes'}</span>
                    </div>
                    <Button className={`w-full mb-6 font-bold py-5 rounded-xl ${isPro ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`} onClick={() => navigate('/register')}>
                      {en ? 'Start Free Trial' : 'Prueba Gratis'}
                    </Button>
                    <ul className="space-y-2.5">
                      <li className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />{en ? 'Up to' : 'Hasta'} <strong>{plan.max_users}</strong> {en ? 'users' : 'usuarios'}</li>
                      <li className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /><strong>{plan.max_leads.toLocaleString()}</strong> leads</li>
                      <li className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /><strong>{plan.max_ai_tokens.toLocaleString()}</strong> AI tokens</li>
                      {plan.features.map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />{f}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-20 bg-[#0f172a] text-center px-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">{en ? 'Ready to transform your business?' : '¿Listo para transformar tu negocio?'}</h2>
        <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">{en ? 'Join thousands of companies growing faster with Arias CRM.' : 'Únete a miles de empresas que crecen más rápido con Arias CRM.'}</p>
        <Button size="lg" onClick={() => navigate('/register')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg px-10 py-5 text-lg shadow-xl shadow-blue-600/30">
          {en ? 'Start your free trial' : 'Inicia tu prueba gratis'}
        </Button>
      </section>

      <LandingFooter />
      <AriasAgent />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10">
              <X className="w-5 h-5" />
            </button>
            <div className="p-8"><Login /></div>
          </div>
        </div>
      )}
    </div>
  );
}
