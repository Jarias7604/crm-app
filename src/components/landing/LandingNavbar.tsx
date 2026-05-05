import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Globe, Phone, Headset, Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

export default function LandingNavbar({ onLoginClick }: { onLoginClick: () => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  return (
    <div className="fixed top-0 w-full z-50">
      {/* Top micro-bar */}
      <div className="hidden lg:flex items-center justify-end px-8 py-1.5 bg-slate-50 text-xs font-medium text-slate-600 border-b border-slate-200 gap-6">
        <button className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
          <Headset className="w-3.5 h-3.5" />
          Customer Support
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
          <Phone className="w-3.5 h-3.5" />
          Contact Sales
        </button>
      </div>

      {/* Main Navbar */}
      <nav className={`transition-all duration-300 border-b ${
        isScrolled 
          ? 'bg-white/90 backdrop-blur-md border-slate-200 shadow-sm py-3' 
          : 'bg-white border-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo & Links */}
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Arias CRM</span>
            </Link>

            <div className="hidden lg:flex items-center gap-8">
              <div className="group relative">
                <button className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-blue-600">
                  Products <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              </div>
              <div className="group relative">
                <button className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-blue-600">
                  Solutions <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              </div>
              <a href="#pricing" className="text-sm font-semibold text-slate-700 hover:text-blue-600">
                Pricing
              </a>
              <div className="group relative">
                <button className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-blue-600">
                  Resources <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-blue-600 mr-2"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </button>
            <Button variant="ghost" onClick={onLoginClick} className="font-semibold">
              Log In
            </Button>
            <Button onClick={() => navigate('/register')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full px-6 shadow-md shadow-indigo-600/20">
              Start for free
            </Button>
          </div>

          {/* Mobile menu button */}
          <button 
            className="lg:hidden p-2 text-slate-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-xl py-4 px-6 flex flex-col gap-4">
          <a href="#pricing" className="text-lg font-semibold text-slate-800 py-2 border-b border-slate-100" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <button onClick={() => { onLoginClick(); setMobileMenuOpen(false); }} className="text-lg font-semibold text-slate-800 py-2 border-b border-slate-100 text-left">Log In</button>
          <Button onClick={() => { navigate('/register'); setMobileMenuOpen(false); }} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            Start for free
          </Button>
        </div>
      )}
    </div>
  );
}
