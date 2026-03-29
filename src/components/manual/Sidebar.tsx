import { useState, useEffect } from 'react';
import { 
  Info, 
  Users, 
  Target, 
  Bot, 
  FileText, 
  Megaphone, 
  ShieldCheck, 
  Code, 
  HelpCircle 
} from 'lucide-react';

const sections = [
  { id: 'manual-maestro-guia-de-usuario-crm', label: 'Visión General', icon: Info },
  { id: '1-modulo-de-leads', label: 'Gestión de Leads', icon: Users },
  { id: '2-modulo-de-ventas-oportunidades', label: 'Pipeline de Ventas', icon: Target },
  { id: '3-bots-e-inbox-centralizado', label: 'Automatización (Bots)', icon: Bot },
  { id: '4-motor-de-cotizaciones', label: 'Cotizador & Finanzas', icon: FileText },
  { id: '5-marketing-omnicanal', label: 'Marketing & Campañas', icon: Megaphone },
  { id: '6-administracion-y-seguridad', label: 'Admin & Seguridad', icon: ShieldCheck },
  { id: 'api-y-desarrollo', label: 'API & Desarrollo', icon: Code }, // Not in current md, kept for future
  { id: '7-preguntas-frecuentes-faq', label: 'FAQ & Glosario', icon: HelpCircle },
];

export default function Sidebar() {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: '-100px 0px -50% 0px' }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">
          Contenido
        </h2>
        <nav className="space-y-0.5">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = activeId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleClick(s.id)}
                className={`
                  w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-300
                  ${isActive 
                    ? 'bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 translate-x-1' 
                    : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 border border-transparent'}
                `}
              >
                <Icon className={`w-[16px] h-[16px] mr-2.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="tracking-tight">{s.label}</span>
                {isActive && (
                   <div className="ml-auto w-1.5 h-1.5 bg-indigo-600 rounded-full animate-in zoom-in duration-300" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-auto p-5 relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-100 to-transparent pointer-events-none" />
        
        <div className="relative bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-1">
             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
               <Bot className="w-4 h-4 text-slate-600" />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asistente IA</p>
               <p className="text-[13px] font-bold text-slate-900 tracking-tight">Potenciando Arias CRM</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
