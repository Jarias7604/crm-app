import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Globe, Phone, Headset, Menu, X, Sparkles, Zap, Shield, HelpCircle, HeartHandshake } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

// ─── SVG BRAND ICONS FOR DROPDOWN ───────────────────────────────────────────
const WhatsAppMin = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#25D366">
    <path d="M12.012 2C6.485 2 2 6.487 2 12.012c0 1.767.46 3.426 1.262 4.887L2 22l5.234-1.373a9.98 9.98 0 004.778 1.208c5.527 0 10.012-4.485 10.012-10.012C22.024 6.487 17.539 2 12.012 2zm6.056 14.195c-.247.697-1.246 1.282-1.722 1.344-.45.06-1.037.09-2.833-.65-2.296-.948-3.774-3.284-3.889-3.438-.115-.15-1.012-1.343-1.012-2.565 0-1.22.638-1.819.866-2.063.228-.244.5-.305.667-.305.167 0 .333.003.479.01.147.007.345-.056.54.417.202.493.689 1.681.748 1.804.06.122.099.266.018.428-.08.163-.122.26-.244.402-.122.143-.257.319-.367.428-.122.12-.249.25-.107.493.143.244.636 1.05 1.36 1.697.933.83 1.716 1.087 1.96 1.208.244.12.387.102.53-.064.143-.167.612-.713.774-.956.163-.244.326-.204.549-.122.224.081 1.411.666 1.654.788.244.12.406.181.465.283.06.099.06.577-.187 1.274z" />
  </svg>
);

const TelegramMin = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#0088cc">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.12 1.13-.64 4.2-1.01 6.18-.15.8-.3 1.2-.55 1.25-.56.09-.94-.33-1.48-.68-.84-.55-1.31-.88-2.12-1.42-.94-.62-.33-1.06.21-1.61.14-.14 2.53-2.32 2.58-2.54.01-.03.01-.13-.05-.18-.06-.05-.15-.03-.22-.02-.1.02-1.68 1.06-4.75 3.13-.45.31-.86.46-1.22.45-.4-.01-1.17-.23-1.74-.41-.7-.23-1.26-.35-1.21-.73.03-.2.27-.4.74-.6 2.9-1.26 4.83-2.1 5.8-2.5 2.76-1.12 3.33-1.32 3.7-1.32.08 0 .27.02.39.12.1.08.13.2.14.3-.01.06 0 .24-.02.39z" />
  </svg>
);

const MetaMin = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.8c4.56-.93 8-4.96 8-9.8z" />
  </svg>
);

const TikTokMin = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#000000">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.95.83 2.19 1.4 3.49 1.63v3.9c-.83-.02-1.66-.23-2.43-.55-.77-.38-1.46-.92-2.02-1.57-.02 2.16-.01 4.31-.02 6.47 0 1.25-.26 2.5-.83 3.61-.59.88-1.43 1.58-2.4 2.02-.97.43-2.05.59-3.1.48-1.28-.15-2.5-.77-3.37-1.72-.94-1.12-1.4-2.58-1.28-4.03.11-1.39.77-2.69 1.8-3.56.96-.81 2.2-1.28 3.46-1.29.02 1.34 0 2.67.01 4.01-1.24.08-2.4.92-2.77 2.12-.33.81-.19 1.76.36 2.45.54.73 1.46 1.08 2.36.96.9-.11 1.7-.76 1.99-1.63.15-.55.15-1.13.14-1.7.01-4.49 0-8.98.01-13.47z" />
  </svg>
);

export default function LandingNavbar({ onLoginClick, onProductClick }: { onLoginClick: () => void; onProductClick?: (key: string) => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const en = i18n.language !== 'es';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProductsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  return (
    <div className="fixed top-0 w-full z-50">
      {/* Top micro-bar */}
      <div className="hidden lg:flex items-center justify-end px-8 py-1.5 bg-slate-900 text-xs font-semibold text-slate-400 border-b border-white/[0.05] gap-6">
        <button className="flex items-center gap-1.5 hover:text-white transition-colors">
          <Headset className="w-3.5 h-3.5" />
          {en ? 'Customer Support' : 'Soporte al Cliente'}
        </button>
        <button className="flex items-center gap-1.5 hover:text-white transition-colors">
          <Phone className="w-3.5 h-3.5" />
          {en ? 'Contact Sales' : 'Contactar Ventas'}
        </button>
      </div>

      {/* Main Navbar */}
      <nav className={`transition-all duration-300 border-b relative ${
        isScrolled 
          ? 'bg-slate-950/95 backdrop-blur-md border-white/[0.08] shadow-lg py-3' 
          : 'bg-[#07070d]/60 backdrop-blur-md border-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo & Links */}
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/35">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black text-white tracking-tight">Arias CRM</span>
            </Link>

            <div className="hidden lg:flex items-center gap-8">
              {/* Products Mega Dropdown Toggle */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setProductsOpen(!productsOpen)}
                  className={`flex items-center gap-1 text-sm font-bold transition-colors ${productsOpen ? 'text-blue-500' : 'text-slate-300 hover:text-white'}`}
                >
                  {en ? 'Products' : 'Productos'} <ChevronDown className="w-4 h-4 opacity-75" />
                </button>

                {/* WOW MEGA DROPDOWN (Like respond.io, but styled for maximum tech win) */}
                {productsOpen && (
                  <div className="absolute top-[calc(100%+16px)] -left-24 w-[980px] bg-[#07070f]/90 backdrop-blur-3xl border border-blue-500/30 rounded-3xl p-10 shadow-[0_0_80px_-15px_rgba(59,130,246,0.4)] z-[90] grid grid-cols-12 gap-8 animate-fadeIn">
                    
                    {/* Col 1: Capture */}
                    <div className="col-span-3 space-y-5">
                      <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Capturar Leads</p>
                      <div className="space-y-4">
                        <div onClick={() => { onProductClick?.('tiktok-api'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">TikTok API Captura</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Ingestión directa sin retraso.</p>
                        </div>
                        <div onClick={() => { onProductClick?.('meta-ads'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Meta Lead Ads</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Campañas FB/IG webhook.</p>
                        </div>
                        <div onClick={() => { onProductClick?.('whatsapp-gen'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">WhatsApp Lead Generator</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Chat widget de retención.</p>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Convert */}
                    <div className="col-span-3 space-y-5">
                      <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Cualificar & Convertir</p>
                      <div className="space-y-4">
                        <div onClick={() => { onProductClick?.('ai-agent'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-emerald-400 flex items-center gap-1 group-hover:text-emerald-300">
                            AI Agent 24/7 <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Califica prospectos al instante.</p>
                        </div>
                        <div onClick={() => { onProductClick?.('omnicanal'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Bandeja Omnicanal</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Inbox unificado colaborativo.</p>
                        </div>
                        <div onClick={() => { onProductClick?.('lead-hunter'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Lead Hunter</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Extracción directa Google Maps.</p>
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Close */}
                    <div className="col-span-3 space-y-5">
                      <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Cierre & Finanzas</p>
                      <div className="space-y-4">
                        <div onClick={() => { onProductClick?.('cotizador'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Cotizador Profesional</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Partidas y PDF branding.</p>
                        </div>
                        <div onClick={() => { onProductClick?.('cobros'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Portal de Cobros</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Pasarela de pago para clientes.</p>
                        </div>
                        <div onClick={() => { onProductClick?.('flyer'); setProductsOpen(false); }} className="group cursor-pointer">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Flyer Studio IA</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Creador de arte promocional.</p>
                        </div>
                      </div>
                    </div>

                    {/* Col 4: Integrations & pricing hook */}
                    <div className="col-span-3 bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Conectividad Directa</p>
                        <div className="flex gap-3 items-center flex-wrap">
                          <WhatsAppMin />
                          <TelegramMin />
                          <MetaMin />
                          <TikTokMin />
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-xs font-black text-emerald-400 mb-1">💸 40% más accesible</p>
                        <p className="text-[10px] text-slate-400 leading-normal">Compara con HubSpot y respond.io.</p>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <button className="flex items-center gap-1 text-sm font-bold text-slate-300 hover:text-white transition-colors">
                {en ? 'Solutions' : 'Soluciones'} <ChevronDown className="w-4 h-4 opacity-50" />
              </button>
              <a href="#pricing" className="text-sm font-bold text-slate-300 hover:text-white transition-colors">
                {en ? 'Pricing' : 'Precios'}
              </a>
              <button className="flex items-center gap-1 text-sm font-bold text-slate-300 hover:text-white transition-colors">
                {en ? 'Resources' : 'Recursos'} <ChevronDown className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white mr-2 transition-colors"
            >
              <Globe className="w-4 h-4 text-slate-400" />
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </button>
            
            {/* FIXED TEXT COLOR: Styled as a premium glowing glass border button */}
            <button 
              onClick={onLoginClick} 
              className="text-sm font-black border border-white/20 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl transition-all shadow-md shadow-white/5 hover:scale-105 active:scale-95"
            >
              {en ? 'Log In' : 'Iniciar Sesión'}
            </button>

            <Button onClick={() => navigate('/register')} className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl px-6 py-5 shadow-lg shadow-blue-600/25 transition-all text-xs">
              {en ? 'Start for free' : 'Comenzar gratis'}
            </Button>
          </div>

          {/* Mobile menu button */}
          <button className="lg:hidden p-2 text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-slate-950 border-b border-white/10 shadow-2xl py-6 px-6 flex flex-col gap-4">
          <a href="#pricing" className="text-lg font-bold text-slate-200 py-2 border-b border-white/5" onClick={() => setMobileMenuOpen(false)}>{en ? 'Pricing' : 'Precios'}</a>
          <button onClick={() => { onLoginClick(); setMobileMenuOpen(false); }} className="text-lg font-bold text-slate-200 py-2 border-b border-white/5 text-left">{en ? 'Log In' : 'Iniciar Sesión'}</button>
          <Button onClick={() => { navigate('/register'); setMobileMenuOpen(false); }} className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white">
            {en ? 'Start for free' : 'Comenzar gratis'}
          </Button>
        </div>
      )}
    </div>
  );
}
