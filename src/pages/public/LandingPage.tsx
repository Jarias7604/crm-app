import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Shield, Zap, TrendingUp, CheckCircle2, ArrowRight, Bot, MessageSquare } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export default function LandingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    async function fetchPlans() {
      try {
        const { data, error } = await supabase
          .from('saas_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });
        
        if (error) throw error;
        setPlans(data || []);
      } catch (err) {
        console.error('Error fetching plans:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg z-50 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            <span className="text-xl font-black tracking-tight text-slate-900">Arias CRM</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Características</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Precios</a>
            <a href="#testimonials" className="hover:text-indigo-600 transition-colors">Testimonios</a>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <Link to="/dashboard" className="text-sm font-bold bg-indigo-600 text-white px-5 py-2.5 rounded-full hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20">
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors">
                  Iniciar Sesión
                </Link>
                <Link to="/register" className="text-sm font-bold bg-indigo-600 text-white px-5 py-2.5 rounded-full hover:bg-indigo-700 transition-all transform hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20">
                  Prueba Gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold tracking-wide">
            <Zap className="w-4 h-4 fill-indigo-700" /> El CRM Definitivo para Escalar
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Gestiona. Cierra. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Automatiza.</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Una plataforma ultra rápida diseñada para equipos de alto rendimiento. Sustituye 5 herramientas distintas con un solo espacio de trabajo minimalista y con Inteligencia Artificial.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/register" className="w-full sm:w-auto text-base font-bold bg-slate-900 text-white px-8 py-4 rounded-full hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2">
              Comenzar Trial de 14 Días <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#pricing" className="w-full sm:w-auto text-base font-bold bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full hover:bg-slate-50 transition-all flex items-center justify-center">
              Ver Paquetes
            </a>
          </div>
          <p className="text-sm text-slate-400 font-medium pt-4">No se requiere tarjeta de crédito · Cancelas cuando quieras</p>
        </div>
      </section>

      {/* Grid de Precios Dinámico */}
      <section id="pricing" className="py-24 bg-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Precios Simples y Transparentes</h2>
            <p className="text-lg text-slate-500">Planes diseñados para crecer junto con tu empresa, desde startups hasta enterprise.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <div key={plan.id} className={`relative flex flex-col bg-white rounded-3xl p-8 transition-all duration-300 hover:shadow-2xl ${
                  plan.slug === 'pro' 
                    ? 'border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105 z-10' 
                    : 'border border-slate-200 shadow-sm'
                }`}>
                  {plan.slug === 'pro' && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <span className="bg-indigo-500 text-white text-xs font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg shadow-indigo-500/30">
                        Más Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-2xl font-black text-slate-900 capitalize mb-2">{plan.name}</h3>
                    <p className="text-sm text-slate-500 min-h-[40px]">{plan.description}</p>
                  </div>
                  
                  <div className="mb-8">
                    <span className="text-5xl font-black text-slate-900">${plan.price_monthly}</span>
                    <span className="text-slate-500 font-medium">/mes</span>
                  </div>

                  <div className="flex-grow space-y-4 mb-8">
                    {plan.features?.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${plan.slug === 'pro' ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <span className="text-sm text-slate-700 font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link 
                    to="/register" 
                    className={`w-full py-4 rounded-xl text-center font-bold transition-all ${
                      plan.slug === 'pro'
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200'
                    }`}
                  >
                    Comenzar con {plan.name}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-500" />
            <span className="text-xl font-black tracking-tight text-white">Arias CRM</span>
          </div>
          <div className="text-sm font-medium">
            © {new Date().getFullYear()} Arias Defense El Salvador. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
