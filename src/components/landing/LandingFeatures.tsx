import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// CRM Hub SVG illustration
const CRMHubSVG = () => (
  <svg viewBox="0 0 400 360" className="w-full max-w-sm mx-auto" fill="none">
    <circle cx="200" cy="180" r="48" fill="#f97316" />
    <circle cx="200" cy="180" r="38" fill="#1d4ed8" />
    <text x="200" y="187" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">CRM</text>
    {/* Connection lines */}
    {[[200,60],[320,110],[340,240],[260,320],[140,320],[60,240],[80,110]].map(([x,y],i)=>(
      <line key={i} x1="200" y1="180" x2={x} y2={y} stroke="rgba(99,179,237,0.4)" strokeWidth="1.5" strokeDasharray="4 3"/>
    ))}
    {/* Contact */}
    <rect x="165" y="25" width="70" height="55" rx="12" fill="#3b82f6"/>
    <circle cx="200" cy="42" r="10" fill="white"/>
    <rect x="182" y="57" width="36" height="6" rx="3" fill="rgba(255,255,255,0.5)"/>
    <text x="200" y="90" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">CONTACT</text>
    {/* Email */}
    <rect x="285" y="82" width="65" height="50" rx="12" fill="#f97316"/>
    <path d="M295 100 L317 115 L339 100" stroke="white" strokeWidth="1.5" fill="none"/>
    <rect x="295" y="99" width="44" height="22" rx="2" stroke="white" strokeWidth="1.5" fill="none"/>
    <text x="317" y="144" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">EMAIL</text>
    {/* WhatsApp */}
    <rect x="305" y="215" width="65" height="50" rx="12" fill="#25d366"/>
    <circle cx="337" cy="235" r="10" fill="white"/>
    <text x="337" y="239" textAnchor="middle" fill="#25d366" fontSize="7" fontWeight="bold">W</text>
    <text x="337" y="277" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">WHATSAPP</text>
    {/* Report */}
    <rect x="230" y="292" width="60" height="50" rx="12" fill="#8b5cf6"/>
    <rect x="241" y="305" width="8" height="22" rx="2" fill="white"/>
    <rect x="253" y="312" width="8" height="15" rx="2" fill="rgba(255,255,255,0.6)"/>
    <rect x="265" y="308" width="8" height="19" rx="2" fill="rgba(255,255,255,0.8)"/>
    <text x="260" y="354" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">REPORTS</text>
    {/* Leads */}
    <rect x="110" y="292" width="60" height="50" rx="12" fill="#06b6d4"/>
    <path d="M125 317 L155 317 M125 324 L148 324 M125 331 L152 331" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="155" cy="310" r="7" fill="white"/>
    <text x="140" y="354" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">LEADS</text>
    {/* Phone */}
    <rect x="30" y="215" width="65" height="50" rx="12" fill="#ec4899"/>
    <rect x="50" y="225" width="25" height="30" rx="4" stroke="white" strokeWidth="1.5" fill="none"/>
    <circle cx="62" cy="251" r="2" fill="white"/>
    <text x="62" y="277" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">CALLS</text>
    {/* Calendar */}
    <rect x="50" y="82" width="65" height="50" rx="12" fill="#10b981"/>
    <rect x="60" y="92" width="45" height="35" rx="4" stroke="white" strokeWidth="1.5" fill="none"/>
    <line x1="60" y1="101" x2="105" y2="101" stroke="white" strokeWidth="1"/>
    <rect x="66" y="107" width="8" height="6" rx="1" fill="rgba(255,255,255,0.7)"/>
    <rect x="78" y="107" width="8" height="6" rx="1" fill="rgba(255,255,255,0.7)"/>
    <rect x="90" y="107" width="8" height="6" rx="1" fill="rgba(255,255,255,0.7)"/>
    <text x="82" y="144" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">CALENDAR</text>
  </svg>
);

// Pipeline Kanban SVG
const PipelineSVG = () => (
  <svg viewBox="0 0 420 300" className="w-full max-w-md mx-auto" fill="none">
    <rect width="420" height="300" rx="16" fill="#1e293b"/>
    {/* Header */}
    <text x="20" y="30" fill="white" fontSize="13" fontWeight="700">Sales Pipeline</text>
    <rect x="340" y="14" width="60" height="22" rx="6" fill="rgba(99,179,237,0.2)"/>
    <text x="370" y="29" textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="600">+ New</text>
    {/* Columns */}
    {[
      { x:14, label:'New', color:'#3b82f6', cards:['Carlos M.','Ana López'], vals:['$1,200','$3,400'] },
      { x:114, label:'Contacted', color:'#8b5cf6', cards:['Pedro R.','María G.'], vals:['$850','$2,100'] },
      { x:214, label:'Proposal', color:'#f97316', cards:['Luis V.'], vals:['$5,600'] },
      { x:314, label:'Closed', color:'#10b981', cards:['Julia H.','Miguel A.'], vals:['$4,200','$1,800'] },
    ].map(col => (
      <g key={col.x}>
        <rect x={col.x} y="44" width="92" height="18" rx="5" fill={col.color + '33'}/>
        <circle cx={col.x+8} cy="53" r="4" fill={col.color}/>
        <text x={col.x+16} y="57" fill="white" fontSize="9" fontWeight="700">{col.label}</text>
        <text x={col.x+80} y="57" textAnchor="end" fill={col.color} fontSize="8" fontWeight="700">{col.cards.length}</text>
        {col.cards.map((name, i) => (
          <g key={i}>
            <rect x={col.x} y={68+i*70} width="92" height="60" rx="8" fill="#334155"/>
            <circle cx={col.x+14} cy={82+i*70} r="8" fill={col.color}/>
            <text x={col.x+14} y={85+i*70} textAnchor="middle" fill="white" fontSize="8" fontWeight="700">{name[0]}</text>
            <text x={col.x+26} y={82+i*70} fill="white" fontSize="8" fontWeight="600">{name}</text>
            <text x={col.x+26} y={92+i*70} fill="#94a3b8" fontSize="7">{col.vals[i]}</text>
            <rect x={col.x+6} y={100+i*70} width="80" height="3" rx="2" fill="#475569"/>
            <rect x={col.x+6} y={100+i*70} width={i===0?60:40} height="3" rx="2" fill={col.color}/>
          </g>
        ))}
      </g>
    ))}
  </svg>
);

// AI Agent Chat SVG
const AIAgentSVG = () => (
  <svg viewBox="0 0 380 300" className="w-full max-w-md mx-auto" fill="none">
    <rect width="380" height="300" rx="16" fill="#0f172a"/>
    {/* Header */}
    <circle cx="24" cy="28" r="14" fill="#8b5cf6"/>
    <text x="24" y="32" textAnchor="middle" fill="white" fontSize="11" fontWeight="800">AI</text>
    <text x="46" y="25" fill="white" fontSize="12" fontWeight="700">Sofía — AI Sales Agent</text>
    <circle cx="370" cy="24" r="5" fill="#10b981"/>
    <text x="362" y="43" fill="#10b981" fontSize="8">LIVE</text>
    <line x1="0" y1="48" x2="380" y2="48" stroke="#1e293b" strokeWidth="1"/>
    {/* Messages */}
    <rect x="12" y="58" width="220" height="44" rx="12" fill="#1e293b"/>
    <text x="22" y="75" fill="white" fontSize="9">Hola, estoy interesado en el</text>
    <text x="22" y="89" fill="white" fontSize="9">servicio de seguridad. ¿Tienen precios?</text>
    <text x="22" y="115" fill="#64748b" fontSize="8">Carlos • 10:32 AM</text>
    <rect x="100" y="128" width="268" height="60" rx="12" fill="#7c3aed" style={{filter:'drop-shadow(0 4px 12px rgba(124,58,237,0.4))'}}/> 
    <text x="112" y="147" fill="white" fontSize="9">¡Hola Carlos! Claro que sí. Tenemos</text>
    <text x="112" y="161" fill="white" fontSize="9">planes desde $65/mes. ¿Me cuentas</text>
    <text x="112" y="175" fill="white" fontSize="9">el tamaño de tu negocio? 😊</text>
    <rect x="280" y="196" width="60" height="14" rx="4" fill="rgba(255,255,255,0.05)"/>
    <text x="310" y="207" textAnchor="middle" fill="#64748b" fontSize="8">10:32 AM ✓✓</text>
    <rect x="12" y="210" width="180" height="32" rx="12" fill="#1e293b"/>
    <text x="22" y="225" fill="white" fontSize="9">Somos 15 personas en ventas.</text>
    <text x="22" y="237" fill="white" fontSize="9">¿Pueden agendar una demo?</text>
    {/* Typing indicator */}
    <rect x="100" y="252" width="80" height="28" rx="12" fill="#1e293b"/>
    {[115,128,141].map((x,i)=><circle key={i} cx={x} cy={266} r={3} fill="#8b5cf6" opacity={0.4+i*0.3}/>)}
    {/* Stats bar */}
    <rect x="0" y="280" width="380" height="20" rx="0" fill="#0a0f1e"/>
    <circle cx="18" cy="290" r="5" fill="#10b981"/>
    <text x="28" y="293" fill="#10b981" fontSize="8" fontWeight="700">RESP: 2.4s avg</text>
    <text x="130" y="293" fill="#64748b" fontSize="8">Calificación: 94%</text>
    <text x="240" y="293" fill="#64748b" fontSize="8">Demos agendadas: 12 hoy</text>
  </svg>
);

// Lead Hunter SVG
const LeadHunterSVG = () => (
  <svg viewBox="0 0 400 300" className="w-full max-w-md mx-auto" fill="none">
    <rect width="400" height="300" rx="16" fill="#f0fdf4"/>
    <rect x="0" y="0" width="400" height="48" rx="16" fill="#166534"/>
    <text x="20" y="20" fill="white" fontSize="11" fontWeight="700">Lead Hunter</text>
    <rect x="100" y="10" width="130" height="28" rx="8" fill="rgba(255,255,255,0.15)"/>
    <text x="132" y="28" fill="white" fontSize="10">🏢  Gimnasios</text>
    <rect x="240" y="10" width="90" height="28" rx="8" fill="rgba(255,255,255,0.15)"/>
    <text x="265" y="28" fill="white" fontSize="10">📍 Miami</text>
    <rect x="340" y="10" width="48" height="28" rx="8" fill="#10b981"/>
    <text x="364" y="28" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">Buscar</text>
    {/* Map */}
    <rect x="12" y="56" width="180" height="180" rx="8" fill="#dcfce7"/>
    <path d="M40 180 Q80 140 120 160 Q160 130 200 150" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 2" fill="none"/>
    {[[60,140],[95,165],[130,150],[165,170],[80,120],[140,130]].map(([x,y],i)=>(
      <g key={i}>
        <circle cx={x} cy={y} r="8" fill="#16a34a"/>
        <circle cx={x} cy={y} r="4" fill="white"/>
      </g>
    ))}
    <text x="102" y="250" textAnchor="middle" fill="#166534" fontSize="9" fontWeight="700">47 ubicaciones</text>
    {/* Lead cards */}
    {[
      {name:'FitLife Gym',phone:'+1 305 442 1234',email:'info@fitlife.com',y:60},
      {name:'PowerZone Miami',phone:'+1 786 555 9876',email:'hola@pzone.com',y:120},
      {name:'Iron Temple',phone:'+1 305 333 4567',email:'gym@iron.com',y:180},
    ].map(l=>(
      <g key={l.y}>
        <rect x="202" y={l.y} width="186" height="52" rx="8" fill="white" style={{filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.06))'}}/>
        <circle cx="218" cy={l.y+16} r="8" fill="#dcfce7"/>
        <text x="218" y={l.y+20} textAnchor="middle" fill="#16a34a" fontSize="8" fontWeight="700">G</text>
        <text x="232" y={l.y+14} fill="#111827" fontSize="9" fontWeight="700">{l.name}</text>
        <text x="232" y={l.y+26} fill="#6b7280" fontSize="7.5">{l.phone}</text>
        <text x="232" y={l.y+38} fill="#6b7280" fontSize="7.5">{l.email}</text>
        <rect x="352" y={l.y+30} width="28" height="14" rx="4" fill="#dcfce7"/>
        <text x="366" y={l.y+41} textAnchor="middle" fill="#16a34a" fontSize="7" fontWeight="700">+ Add</text>
      </g>
    ))}
    <text x="295" y="248" textAnchor="middle" fill="#6b7280" fontSize="8">500+ leads extraídos</text>
  </svg>
);

const SLIDES = [
  {
    num:'01', total:'04',
    gradient:'linear-gradient(135deg,#0f2460 0%,#1a3a8f 50%,#0e1f5b 100%)',
    labelES:'Captura de Leads', labelEN:'Lead Capture',
    titleES:'Captura leads desde TikTok, Meta e Instagram automáticamente',
    titleEN:'Capture leads from TikTok, Meta and Instagram automatically',
    descES:'Conéctate a las APIs oficiales de TikTok Leads y Meta Lead Ads. Cada lead llega al CRM en milisegundos y activa el AI bot para contactarlo al instante.',
    descEN:'Connect to official TikTok Leads and Meta Lead Ads APIs. Every lead arrives in the CRM in milliseconds and triggers the AI bot to contact them instantly.',
    bullets:{es:['TikTok & Meta API oficial','< 120ms de latencia','Deduplicación automática','Webhooks en tiempo real'],en:['Official TikTok & Meta API','< 120ms latency','Automatic deduplication','Real-time webhooks']},
    Illustration: CRMHubSVG,
  },
  {
    num:'02', total:'04',
    gradient:'linear-gradient(135deg,#1e1060 0%,#2d1b6e 50%,#1a0d55 100%)',
    labelES:'Pipeline Visual', labelEN:'Visual Pipeline',
    titleES:'Gestiona tu pipeline con Kanban visual en tiempo real',
    titleEN:'Manage your pipeline with real-time visual Kanban',
    descES:'Arrastra y suelta leads entre etapas. Ve el valor de cada oportunidad, asigna agentes y monitorea el progreso de todo tu equipo desde un solo tablero.',
    descEN:'Drag and drop leads between stages. See the value of each opportunity, assign agents and monitor your entire team\'s progress from one board.',
    bullets:{es:['Drag & drop instantáneo','Valor por etapa en tiempo real','Asignación de agentes','Filtros avanzados'],en:['Instant drag & drop','Real-time stage value','Agent assignment','Advanced filters']},
    Illustration: PipelineSVG,
  },
  {
    num:'03', total:'04',
    gradient:'linear-gradient(135deg,#0d3d2e 0%,#134e38 50%,#0a3326 100%)',
    labelES:'Lead Hunter', labelEN:'Lead Hunter',
    titleES:'Extrae 500+ prospectos de Google Maps en 60 segundos',
    titleEN:'Extract 500+ prospects from Google Maps in 60 seconds',
    descES:'Ingresa industria y ciudad. Nuestro extractor te entrega nombres, teléfonos, emails y ubicaciones de empresas locales listos para inyectar a tu pipeline.',
    descEN:'Enter industry and city. Our extractor delivers names, phones, emails and locations of local businesses ready to inject into your pipeline.',
    bullets:{es:['Google Maps API directa','Validación de teléfonos','Enriquecimiento de emails','Exporta a CSV o CRM'],en:['Direct Google Maps API','Phone validation','Email enrichment','Export to CSV or CRM']},
    Illustration: LeadHunterSVG,
  },
  {
    num:'04', total:'04',
    gradient:'linear-gradient(135deg,#3b0764 0%,#4c1d95 50%,#2e065a 100%)',
    labelES:'Agente IA 24/7', labelEN:'24/7 AI Agent',
    titleES:'Tu vendedor virtual que nunca descansa ni pierde un lead',
    titleEN:'Your virtual sales agent that never rests or loses a lead',
    descES:'El AI Agent califica prospectos, responde objeciones, cotiza productos y agenda reuniones en WhatsApp mientras tu equipo duerme.',
    descEN:'The AI Agent qualifies prospects, handles objections, quotes products and schedules meetings on WhatsApp while your team sleeps.',
    bullets:{es:['GPT-4o integrado','Califica y cotiza en WhatsApp','Agenda citas en tu calendario','Handoff a agente humano'],en:['GPT-4o integrated','Qualifies & quotes on WhatsApp','Schedules calendar appointments','Handoff to human agent']},
    Illustration: AIAgentSVG,
  },
];

export default function LandingFeatures() {
  const [active, setActive] = useState(0);
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const slide = SLIDES[active];
  const { Illustration } = slide;

  const prev = () => setActive(a => (a - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setActive(a => (a + 1) % SLIDES.length);

  return (
    <section className="py-20 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-xs font-black uppercase tracking-[0.25em]" style={{ color:'#06b6d4' }}>
            {isES ? 'La Plataforma Completa' : 'The Complete Platform'}
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mt-3 leading-tight">
            {isES ? 'Todo lo que tu equipo necesita' : 'Everything your team needs'}
          </h2>
          <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">
            {isES ? 'Un embudo completo: desde la captura hasta el cobro.' : 'A complete funnel: from capture to payment.'}
          </p>
        </div>

        {/* Zoho-style dark card carousel */}
        <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: slide.gradient }}>
          <div className="grid lg:grid-cols-2 min-h-[460px]">
            {/* Left: Text */}
            <div className="p-10 lg:p-14 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs font-black text-white/40 tracking-[0.3em]">{slide.num} / {slide.total}</span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/70">
                  {isES ? slide.labelES : slide.labelEN}
                </span>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-white mb-5 leading-snug">
                {isES ? slide.titleES : slide.titleEN}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                {isES ? slide.descES : slide.descEN}
              </p>
              <ul className="grid grid-cols-2 gap-2.5 mb-10">
                {(isES ? slide.bullets.es : slide.bullets.en).map((b,i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/80">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth={3} className="w-4 h-4 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
              {/* Navigation */}
              <div className="flex items-center gap-3">
                <button onClick={prev} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                  <ChevronLeft className="w-5 h-5 text-white"/>
                </button>
                <button onClick={next} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                  <ChevronRight className="w-5 h-5 text-white"/>
                </button>
                <div className="flex gap-1.5 ml-2">
                  {SLIDES.map((_,i) => (
                    <button key={i} onClick={() => setActive(i)} className={`h-1.5 rounded-full transition-all ${active===i ? 'bg-white w-6' : 'bg-white/30 w-2'}`}/>
                  ))}
                </div>
              </div>
            </div>
            {/* Right: Illustration */}
            <div className="flex items-center justify-center p-8 bg-black/10">
              <Illustration/>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
