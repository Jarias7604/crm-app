import { useNavigate } from 'react-router-dom';
import { PlayCircle, CheckCircle2, Building2, Users, Database, Bot, ArrowRight, Zap, Target, LineChart, MessageSquare, Briefcase } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthProvider';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import AriasAgent from '../../components/landing/AriasAgent';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';

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
      <LandingNavbar />

      {/* 1. HERO SECTION (Dark Blue like Salesforce, Text RIGHT, Image LEFT) */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 bg-[#032D60] overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Professional Image */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl order-2 lg:order-1 animate-in slide-in-from-left-8 duration-700">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent mix-blend-overlay"></div>
              <img 
                src="/hero_image_crm.png" 
                alt="Arias CRM Agentic Enterprise" 
                className="w-full h-auto object-cover rounded-2xl"
              />
              {/* Floating UI Element */}
              <div className="absolute bottom-6 -right-6 lg:-right-12 bg-white rounded-xl shadow-xl p-4 flex items-center gap-4 animate-bounce-slow">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Agent Deployed</p>
                  <p className="text-xs text-slate-500">Task completed successfully</p>
                </div>
              </div>
            </div>

            {/* Right: Text Content */}
            <div className="order-1 lg:order-2 animate-in slide-in-from-right-8 duration-700">
              <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
                Welcome to the <br/>
                <span className="text-blue-400">Agentic Enterprise.</span>
              </h1>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl font-medium leading-relaxed">
                Automate better sales, service, and marketing with humans and AI agents working together on one trusted, agentic CRM platform. See value from day one.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  <Button 
                    onClick={() => navigate('/dashboard')} 
                    size="lg" 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg px-8 py-4 h-auto shadow-lg shadow-emerald-900/50"
                  >
                    Ir al Dashboard <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={() => navigate('/register')} 
                      size="lg" 
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg px-8 py-4 h-auto shadow-lg shadow-emerald-900/50"
                    >
                      Start for free
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold rounded-lg px-8 py-4 h-auto backdrop-blur-sm"
                    >
                      <PlayCircle className="w-5 h-5 mr-2" />
                      Watch demo
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
            <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Discover the #1 AI CRM</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Unite marketing, sales, and service on a single platform.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Sales Cloud', icon: Target, desc: 'Grow your business, increase productivity, and win more deals.', color: 'text-blue-600', bg: 'bg-blue-50' },
              { title: 'Marketing Hub', icon: Zap, desc: 'Engage customers with relevant, empathetic digital marketing.', color: 'text-orange-600', bg: 'bg-orange-50' },
              { title: 'Service Desk', icon: MessageSquare, desc: 'Deliver smarter, more personalized support across all channels.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { title: 'AI Agents', icon: Bot, desc: 'Scale your team with autonomous AI agents that work 24/7.', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((product, idx) => (
              <div key={idx} className="group p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer">
                <div className={`w-14 h-14 ${product.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <product.icon className={`w-7 h-7 ${product.color}`} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{product.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">{product.desc}</p>
                <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                  Learn more <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-12">Trusted by fast-growing enterprises</h3>
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
            <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Transparent pricing for every stage</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Start free, upgrade when you need more power.</p>
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
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                    <p className="text-sm text-slate-500 mb-6 min-h-[40px]">{plan.description}</p>
                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-extrabold text-slate-900">{formatPrice(plan.price_monthly)}</span>
                        <span className="text-slate-500 font-medium">/mo</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Billed annually at {formatPrice(plan.price_annual)}/yr</p>
                    </div>

                    <Button 
                      className={`w-full mb-8 font-bold py-6 rounded-xl ${
                        isPro 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                      }`}
                      onClick={() => navigate('/register')}
                    >
                      Start Free Trial
                    </Button>

                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-slate-900">What's included:</p>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                          <span>Up to <strong>{plan.max_users}</strong> users</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                          <span><strong>{plan.max_leads.toLocaleString()}</strong> leads capacity</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                          <span><strong>{plan.max_ai_tokens.toLocaleString()}</strong> AI tokens</span>
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
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to build your Agentic Enterprise?</h2>
        <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">Join thousands of companies growing faster with Arias CRM.</p>
        <Button 
          size="lg" 
          onClick={() => navigate('/register')}
          className="bg-white text-blue-600 hover:bg-slate-50 font-bold rounded-lg px-10 py-5 text-lg shadow-xl"
        >
          Start your free trial
        </Button>
      </section>

      <LandingFooter />
      <AriasAgent />
    </div>
  );
}
