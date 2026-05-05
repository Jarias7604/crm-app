import { useNavigate } from 'react-router-dom';
import { PlayCircle, CheckCircle2, Building2, Users, Database, Bot, ArrowRight, Zap, Target, LineChart, MessageSquare, Briefcase } from 'lucide-react';
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

// Helper for format price
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = i18n.language !== 'es';
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Fetch active plans from database
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['saas_plans_public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-500 selection:text-white">
      <LandingNavbar onLoginClick={() => setShowLoginModal(true)} />

      {/* 1. HERO SECTION (Dark Blue like Salesforce, Text RIGHT, Image LEFT) */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 bg-[#032D60] overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Professional Image with Glow */}
            <div className="relative order-2 lg:order-1 animate-in slide-in-from-left-8 duration-700">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-3xl blur-2xl opacity-30 mix-blend-screen"></div>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent mix-blend-overlay"></div>
                <img 
                  src="/hero_image_crm.png" 
                  alt="Arias CRM Agentic Enterprise" 
                  className="w-full h-auto object-cover rounded-2xl scale-105 hover:scale-100 transition-transform duration-1000 ease-out"
                />
              </div>
            </div>

            {/* Right: Text Content */}
            <div className="order-1 lg:order-2 animate-in slide-in-from-right-8 duration-700">
              <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
                {isEn ? "Welcome to the" : "Bienvenido a la"} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                  {isEn ? "Agentic Enterprise." : "Empresa Agéntica."}
                </span>
              </h1>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl font-medium leading-relaxed">
                {isEn 
                  ? "Automate better sales, service, and marketing with humans and AI agents working together on one trusted, agentic CRM platform. See value from day one."
                  : "Automatiza ventas, servicio y marketing con humanos y agentes de IA trabajando juntos en una única plataforma CRM confiable. Ve el valor desde el primer día."}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  <Button 
                    onClick={() => navigate('/dashboard')} 
                    size="lg" 
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg px-8 py-4 h-auto shadow-lg shadow-indigo-900/50"
                  >
                    {isEn ? "Go to Dashboard" : "Ir al Dashboard"} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={() => navigate('/register')} 
                      size="lg" 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg px-8 py-4 h-auto shadow-lg shadow-indigo-900/50"
                    >
                      {isEn ? "Start for free" : "Comienza gratis"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold rounded-lg px-8 py-4 h-auto backdrop-blur-sm"
                    >
                      <PlayCircle className="w-5 h-5 mr-2" />
                      {isEn ? "Watch demo" : "Ver demo"}
                    </Button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. PRODUCT SHOWCASE */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              {isEn ? "Discover the #1 AI CRM" : "Descubre el CRM con IA #1"}
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              {isEn ? "Unite marketing, sales, and service on a single platform." : "Unifica marketing, ventas y servicio en una sola plataforma."}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Sales Cloud', icon: Target, desc: isEn ? 'Grow your business, increase productivity, and win more deals.' : 'Haz crecer tu negocio, aumenta la productividad y cierra más tratos.', color: 'text-blue-600', bg: 'bg-blue-50' },
              { title: 'Marketing Hub', icon: Zap, desc: isEn ? 'Engage customers with relevant, empathetic digital marketing.' : 'Atrae clientes con marketing digital relevante y empático.', color: 'text-orange-600', bg: 'bg-orange-50' },
              { title: 'Service Desk', icon: MessageSquare, desc: isEn ? 'Deliver smarter, more personalized support across all channels.' : 'Brinda soporte más inteligente y personalizado en todos los canales.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { title: 'AI Agents', icon: Bot, desc: isEn ? 'Scale your team with autonomous AI agents that work 24/7.' : 'Escala tu equipo con agentes autónomos de IA que trabajan 24/7.', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((product, idx) => (
              <div key={idx} className="group p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer">
                <div className={`w-14 h-14 ${product.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <product.icon className={`w-7 h-7 ${product.color}`} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{product.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">{product.desc}</p>
                <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                  {isEn ? "Learn more" : "Saber más"} <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-12">
            {isEn ? "Trusted by fast-growing enterprises" : "Respaldado por empresas de rápido crecimiento"}
          </h3>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Logos placeholders */}
            <Building2 className="w-12 h-12" />
            <Briefcase className="w-12 h-12" />
            <Database className="w-12 h-12" />
            <LineChart className="w-12 h-12" />
            <Users className="w-12 h-12" />
          </div>
        </div>
      </section>

      {/* 4. PRICING SECTION (Dynamic) */}
      <section id="pricing" className="py-24 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              {isEn ? "Transparent pricing for every stage" : "Precios transparentes para cada etapa"}
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              {isEn ? "Start free, upgrade when you need more power." : "Comienza gratis, mejora cuando necesites más poder."}
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8 items-start max-w-6xl mx-auto">
              {plans.map((plan) => {
                const isPro = plan.slug === 'pro';
                return (
                  <div 
                    key={plan.id}
                    className={`relative bg-white rounded-3xl p-8 border ${
                      isPro 
                        ? 'border-blue-600 shadow-2xl shadow-blue-900/10 scale-105 z-10' 
                        : 'border-slate-200 shadow-lg'
                    }`}
                  >
                    {isPro && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                        {isEn ? "Most Popular" : "Más Popular"}
                      </div>
                    )}
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                    <p className="text-sm text-slate-500 mb-6 min-h-[40px]">{plan.description}</p>
                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-extrabold text-slate-900">{formatPrice(plan.price_monthly)}</span>
                        <span className="text-slate-500 font-medium">{isEn ? "/mo" : "/mes"}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{isEn ? `Billed annually at ${formatPrice(plan.price_annual)}/yr` : `Facturado anualmente a ${formatPrice(plan.price_annual)}/año`}</p>
                    </div>

                    <Button 
                      className={`w-full mb-8 font-bold py-6 rounded-xl ${
                        isPro 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                      }`}
                      onClick={() => navigate('/register')}
                    >
                      {isEn ? "Start Free Trial" : "Iniciar Prueba Gratis"}
                    </Button>

                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-slate-900">{isEn ? "What's included:" : "Qué incluye:"}</p>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                          <span>{isEn ? "Up to" : "Hasta"} <strong>{plan.max_users}</strong> {isEn ? "users" : "usuarios"}</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                          <span><strong>{plan.max_leads.toLocaleString()}</strong> {isEn ? "leads capacity" : "leads permitidos"}</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                          <span><strong>{plan.max_ai_tokens.toLocaleString()}</strong> {isEn ? "AI tokens" : "tokens de IA"}</span>
                        </li>
                        {plan.features.map((feature: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 5. CTA BANNER */}
      <section className="py-24 bg-gradient-to-br from-blue-600 to-indigo-700 text-center px-4">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
          {isEn ? "Ready to build your Agentic Enterprise?" : "¿Listo para construir tu Empresa Agéntica?"}
        </h2>
        <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
          {isEn ? "Join thousands of companies growing faster with Arias CRM." : "Únete a miles de empresas que crecen más rápido con Arias CRM."}
        </p>
        <Button 
          size="lg" 
          onClick={() => navigate('/register')}
          className="bg-white text-blue-600 hover:bg-slate-50 font-bold rounded-lg px-10 py-5 text-lg shadow-xl"
        >
          {isEn ? "Start your free trial" : "Inicia tu prueba gratis"}
        </Button>
      </section>

      <LandingFooter />
      <AriasAgent />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8">
              <Login />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
