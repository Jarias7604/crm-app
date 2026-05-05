import { Globe, Twitter, Linkedin, Facebook, Youtube } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LandingFooter() {
  const { i18n } = useTranslation();
  const en = i18n.language !== 'es';

  return (
    <footer className="bg-[#0f172a] text-slate-300 py-14 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-14">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-5 text-white">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Arias CRM</span>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              {en ? 'The #1 Agentic AI CRM. Humans with Agents drive customer success together.' : 'El CRM con IA Agéntica #1. Humanos y Agentes impulsan el éxito del cliente juntos.'}
            </p>
            <div className="flex items-center gap-4 text-white">
              <a href="#" className="hover:text-blue-400 transition-colors"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="hover:text-blue-400 transition-colors"><Linkedin className="w-5 h-5" /></a>
              <a href="#" className="hover:text-blue-400 transition-colors"><Facebook className="w-5 h-5" /></a>
              <a href="#" className="hover:text-blue-400 transition-colors"><Youtube className="w-5 h-5" /></a>
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">{en ? 'Products' : 'Productos'}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Sales Cloud</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Service Hub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Marketing Hub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Commerce' : 'Comercio'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Data & Analytics' : 'Datos y Analítica'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Agentforce AI</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">{en ? 'Solutions' : 'Soluciones'}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'By Industry' : 'Por Industria'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'By Role' : 'Por Rol'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'By Company Size' : 'Por Tamaño'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Small Business' : 'Pequeña Empresa'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Enterprise</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">{en ? 'Resources' : 'Recursos'}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Learning Center' : 'Centro de Aprendizaje'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Customer Stories' : 'Historias de Clientes'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Events & Webinars' : 'Eventos y Webinars'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Developers' : 'Desarrolladores'}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">{en ? 'Company' : 'Empresa'}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'About Us' : 'Nosotros'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Careers' : 'Carreras'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Newsroom' : 'Noticias'}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{en ? 'Contact Us' : 'Contáctanos'}</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Arias Defense El Salvador. {en ? 'All rights reserved.' : 'Todos los derechos reservados.'}</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Legal</a>
            <a href="#" className="hover:text-white transition-colors">{en ? 'Terms of Service' : 'Términos de Servicio'}</a>
            <a href="#" className="hover:text-white transition-colors">{en ? 'Privacy' : 'Privacidad'}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
