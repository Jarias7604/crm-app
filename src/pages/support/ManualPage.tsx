import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/manual/Sidebar';
import content from '../../manual/content.md?raw';
import ReactMarkdown from 'react-markdown';
import { Book, Search, ExternalLink, Sparkles, Quote } from 'lucide-react';

/**
 * ManualPage – renders the full process manual.
 * Premium Documentation Hub UI.
 */
export default function ManualPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Instant Search Engine for Markdown
  const filteredContent = useMemo(() => {
    if (!searchTerm.trim()) return content;
    const lowerTerm = searchTerm.toLowerCase();
    
    const chunks = content.split('\n## ');
    let result = chunks[0].toLowerCase().includes(lowerTerm) ? chunks[0] : '';
    
    for (let i = 1; i < chunks.length; i++) {
        if (chunks[i].toLowerCase().includes(lowerTerm)) {
             result += (result ? '\n\n' : '') + '## ' + chunks[i];
        }
    }
    
    return result || `# Sin resultados\nNo encontramos coincidencias para "**${searchTerm}**" en el manual.`;
  }, [searchTerm]);

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900 overflow-hidden">
      {/* Sidebar - Fixed Left */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-200">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 bg-slate-50">
          <Book className="w-5 h-5 text-indigo-600 mr-2" />
          <span className="font-bold text-slate-800 tracking-tight">Manual Maestro</span>
        </div>
        <div className="h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
          <Sidebar />
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header - Fixed Top inside scrollable area or sticky */}
        <header className="h-20 flex items-center justify-between px-10 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-10 shrink-0 sticky top-0 supports-[backdrop-filter]:bg-white/60">
          <div className="flex items-center flex-1 max-w-xl">
             <div className="relative w-full max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar en el manual..." 
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/50 rounded-2xl text-[14px] font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                />
             </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center text-[13px] font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50">
              <span className="tracking-tight">Volver al CRM</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div className="px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200/60">
               <span className="text-[11px] font-bold text-slate-500 tracking-wider">v2.0.4</span>
            </div>
          </div>
        </header>

        {/* Content Area - Scrollable */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="max-w-[850px] px-8 py-8 md:px-12 lg:px-16">
            <div className="manual-content animate-in">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => {
                    const id = String(props.children).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    return (
                        <div className="relative mb-6 mt-0">
                           <div className="absolute -left-12 top-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                           <h1 id={id} className="relative text-transparent bg-clip-text bg-gradient-to-br from-indigo-950 via-indigo-700 to-purple-800" {...props} />
                        </div>
                    )
                  },
                  h2: ({node, ...props}) => {
                    const id = String(props.children).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    const text = String(props.children);
                    const match = text.match(/^(\d+)\.\s*(.*)/); // Match "1. Text"
                    
                    if (match) {
                        return (
                            <div className="mt-8 mb-4 relative group scroll-mt-28" id={id}>
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 flex items-center justify-center shrink-0 border border-white/20">
                                     <span className="text-white text-sm font-black">{match[1]}</span>
                                  </div>
                                  <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight leading-tight m-0 border-none pb-0">{match[2]}</h2>
                               </div>
                               <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" />
                            </div>
                        )
                    }
                    return (
                        <div className="mt-8 mb-4 relative group scroll-mt-28" id={id}>
                           <div className="flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-indigo-500" />
                              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight m-0 border-none pb-0" {...props} />
                           </div>
                           <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" />
                        </div>
                    )
                  },
                  h3: ({node, ...props}) => {
                    const id = String(props.children).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    return <h3 id={id} {...props} />
                  },
                  blockquote: ({node, ...props}) => (
                    <div className="my-4 relative">
                        <div className="absolute top-2 -left-3 w-6 h-6 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.15)] z-10">
                            <Quote className="w-2.5 h-2.5 text-indigo-500 fill-indigo-500/20" />
                        </div>
                        <div className="border-l-[3px] border-indigo-500 bg-gradient-to-r from-indigo-50/70 to-transparent py-3 pl-6 pr-4 rounded-r-lg shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl -mt-8 -mr-8" />
                           <blockquote className="text-[14.5px] italic text-slate-700 font-medium leading-relaxed relative z-10 m-0 border-none bg-transparent p-0" {...props} />
                        </div>
                    </div>
                  ),
                  p: ({node, ...props}) => <p {...props} />,
                  ul: ({node, ...props}) => <ul {...props} />,
                  li: ({node, ...props}) => <li><span>{props.children}</span></li>,
                  img: ({node, ...props}) => (
                    <div className="my-6 -mx-2 md:mx-0 relative group">
                      <div className="absolute -inset-2 bg-gradient-to-b from-indigo-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl -z-10" />
                      <div className="rounded-lg overflow-hidden border border-slate-200/80 shadow-[0_4px_15px_-4px_rgba(0,0,0,0.06)] transition-all duration-500 bg-white">
                        {/* Premium Browser Mockup Header */}
                        <div className="h-6 bg-[#f8fafc] border-b border-slate-200/60 flex items-center px-2.5 space-x-1.5">
                            <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-[#ff5f56] transition-colors duration-300" />
                            <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-[#ffbd2e] transition-colors duration-300 delay-75" />
                            <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-[#27c93f] transition-colors duration-300 delay-150" />
                        </div>
                        <img className="w-full object-cover" {...props} />
                      </div>
                      {props.alt && (
                        <p className="mt-4 text-center text-[12.5px] font-semibold text-slate-400 tracking-wide uppercase">
                          {props.alt}
                        </p>
                      )}
                    </div>
                  ),
                }}
              >
                {filteredContent}
              </ReactMarkdown>
            </div>

            {/* Footer inside content */}
            <footer className="mt-24 pt-12 border-t border-slate-100 flex items-center justify-between text-slate-400 text-sm">
              <p>© 2026 Arias CRM Professional. Todos los derechos reservados.</p>
              <div className="flex space-x-6">
                 <a href="#" className="hover:text-slate-600">Privacidad</a>
                 <a href="#" className="hover:text-slate-600">Términos</a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
