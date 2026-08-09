import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SLIDES = [
  {
    num: '01',
    gradient: 'from-[#1e3a8a] to-[#1d4ed8]',
    accent: '#60a5fa',
    titleES: 'Lead Hunter Pro',
    titleEN: 'Lead Hunter Pro',
    descES: 'Extrae cientos de prospectos de Google Maps en segundos. Ingresa industria + ciudad y recibe nombres, teléfonos y correos listos para tu pipeline.',
    descEN: 'Extract hundreds of prospects from Google Maps in seconds. Enter industry + city and get names, phones, and emails ready for your pipeline.',
    metric: '500+', metricLabel: 'leads/min',
    bullets: ['Google Maps API directa', 'Exporta a CSV o inyecta al CRM', 'Deduplicación automática', 'Filtros por rating y categoría'],
    bulletsEN: ['Direct Google Maps API', 'Export to CSV or inject to CRM', 'Automatic deduplication', 'Filters by rating and category'],
    icon: '🎯',
  },
  {
    num: '02',
    gradient: 'from-[#7c3aed] to-[#6d28d9]',
    accent: '#c4b5fd',
    titleES: 'Campañas Automatizadas',
    titleEN: 'Automated Campaigns',
    descES: 'Diseña secuencias de follow-up multicanal. WhatsApp, Email y Telegram coordinados automáticamente según el comportamiento del lead.',
    descEN: 'Design multi-channel follow-up sequences. WhatsApp, Email and Telegram coordinated automatically based on lead behavior.',
    metric: '3×', metricLabel: 'más conversiones',
    bullets: ['Secuencias visuales drag & drop', 'Condiciones por comportamiento', 'WhatsApp + Email + Telegram', 'Horarios inteligentes por zona'],
    bulletsEN: ['Visual drag & drop sequences', 'Behavior-based conditions', 'WhatsApp + Email + Telegram', 'Smart schedules by timezone'],
    icon: '📣',
  },
  {
    num: '03',
    gradient: 'from-[#0e7490] to-[#0284c7]',
    accent: '#67e8f9',
    titleES: 'Agente IA de Ventas',
    titleEN: 'AI Sales Agent',
    descES: 'Configura tu vendedor virtual con IA. Califica leads, responde objeciones y agenda citas en WhatsApp las 24 horas, los 7 días.',
    descEN: 'Configure your virtual AI sales agent. Qualifies leads, handles objections, and schedules appointments on WhatsApp 24/7.',
    metric: '38%', metricLabel: 'tasa de cierre',
    bullets: ['Personalidad y tono ajustables', 'Handoff automático a humanos', 'Agenda reuniones en calendario', 'Memoriza historial de conversación'],
    bulletsEN: ['Adjustable personality & tone', 'Automatic handoff to humans', 'Schedules meetings in calendar', 'Remembers conversation history'],
    icon: '🤖',
  },
  {
    num: '04',
    gradient: 'from-[#b45309] to-[#d97706]',
    accent: '#fcd34d',
    titleES: 'Conecta Redes Sociales',
    titleEN: 'Connect Social Networks',
    descES: 'Conecta TikTok, Meta e Instagram con un clic. Los leads de tus anuncios llegan automáticamente al CRM en milisegundos.',
    descEN: 'Connect TikTok, Meta and Instagram with one click. Leads from your ads automatically arrive in the CRM in milliseconds.',
    metric: '<120ms', metricLabel: 'latencia de captura',
    bullets: ['TikTok Leads API oficial', 'Meta Leads Ads integrado', 'Instagram DMs capturados', 'Notificaciones en tiempo real'],
    bulletsEN: ['Official TikTok Leads API', 'Meta Leads Ads integrated', 'Instagram DMs captured', 'Real-time notifications'],
    icon: '🔗',
  },
  {
    num: '05',
    gradient: 'from-[#be185d] to-[#db2777]',
    accent: '#f9a8d4',
    titleES: 'Flyer Studio',
    titleEN: 'Flyer Studio',
    descES: 'Diseña materiales de marketing con IA y publícalos directamente en tus redes sociales sin salir de la plataforma.',
    descEN: 'Design marketing materials with AI and publish directly to your social networks without leaving the platform.',
    metric: '90%', metricLabel: 'ahorro en diseño',
    bullets: ['Generación de imágenes con IA', 'Formatos para Stories y Posts', 'Publicación directa a redes', 'Copys de alta conversión con IA'],
    bulletsEN: ['AI image generation', 'Formats for Stories and Posts', 'Direct publishing to networks', 'High-conversion AI copywriting'],
    icon: '🎨',
  },
  {
    num: '06',
    gradient: 'from-[#065f46] to-[#047857]',
    accent: '#6ee7b7',
    titleES: 'Bandeja de WhatsApp',
    titleEN: 'WhatsApp Inbox',
    descES: 'Centraliza todos los mensajes de WhatsApp de tu equipo. Asigna conversaciones, agrega notas internas y nunca pierdas un lead.',
    descEN: 'Centralize all WhatsApp messages from your team. Assign conversations, add internal notes, and never lose a lead.',
    metric: '0', metricLabel: 'mensajes sin respuesta',
    bullets: ['Multi-agente colaborativo', 'Notas internas invisibles', 'Asignación automática Round-Robin', 'Respuestas rápidas y plantillas'],
    bulletsEN: ['Collaborative multi-agent', 'Invisible internal notes', 'Round-Robin auto assignment', 'Quick replies and templates'],
    icon: '💬',
  },
  {
    num: '07',
    gradient: 'from-[#1e40af] to-[#1d4ed8]',
    accent: '#93c5fd',
    titleES: 'Cotizador Profesional',
    titleEN: 'Professional Quoting',
    descES: 'Genera cotizaciones con PDF en menos de 60 segundos. Envía por link, recibe aprobación del cliente y cobra en línea.',
    descEN: 'Generate quotes with PDF in less than 60 seconds. Send by link, receive client approval, and collect online.',
    metric: '<1 min', metricLabel: 'crear cotización',
    bullets: ['PDF con tu branding', 'Portal de pago para el cliente', 'Versiones y validez comercial', 'Firma digital integrada'],
    bulletsEN: ['PDF with your branding', 'Client payment portal', 'Versions and commercial validity', 'Integrated digital signature'],
    icon: '📄',
  },
  {
    num: '08',
    gradient: 'from-[#4c1d95] to-[#5b21b6]',
    accent: '#ddd6fe',
    titleES: 'Reportes y Performance',
    titleEN: 'Reports & Performance',
    descES: 'Analiza el rendimiento de tu equipo con dashboards en tiempo real. Identifica cuellos de botella y optimiza tu proceso de ventas.',
    descEN: 'Analyze your team\'s performance with real-time dashboards. Identify bottlenecks and optimize your sales process.',
    metric: '100%', metricLabel: 'visibilidad del equipo',
    bullets: ['Pipeline de ventas en vivo', 'Análisis de leads perdidos', 'Rendimiento por agente', 'Tendencias semanales y mensuales'],
    bulletsEN: ['Live sales pipeline', 'Lost leads analysis', 'Performance by agent', 'Weekly and monthly trends'],
    icon: '📊',
  },
  {
    num: '09',
    gradient: 'from-[#064e3b] to-[#065f46]',
    accent: '#a7f3d0',
    titleES: 'Workspaces Multi-Agente',
    titleEN: 'Multi-Agent Workspaces',
    descES: 'Crea números de WhatsApp separados por departamento o agente. Cada uno con su propio canal, leads y conversaciones aisladas.',
    descEN: 'Create separate WhatsApp numbers by department or agent. Each with their own channel, leads, and isolated conversations.',
    metric: '∞', metricLabel: 'workspaces',
    bullets: ['Número propio por agente', 'Datos 100% aislados por workspace', 'Conecta cualquier WABA con 1 clic', 'El admin ve todo desde arriba'],
    bulletsEN: ['Own number per agent', '100% isolated data per workspace', 'Connect any WABA with 1 click', 'Admin sees everything from above'],
    icon: '🏢',
  },
];

export default function LandingFeatures() {
  const [active, setActive] = useState(0);
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const slide = SLIDES[active];

  return (
    <section className="bg-white py-24 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-black text-red-600 uppercase tracking-[0.25em]">
            {isES ? 'La Plataforma Completa' : 'The Complete Platform'}
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mt-3 leading-tight">
            {isES ? 'Todo lo que tu equipo de ventas necesita' : 'Everything your sales team needs'}
          </h2>
          <p className="text-gray-500 mt-4 text-lg max-w-2xl mx-auto">
            {isES
              ? 'Un embudo completo: desde la captura del lead hasta el cobro, todo conectado en una plataforma.'
              : 'A complete funnel: from lead capture to payment collection, all connected in one platform.'}
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                active === i
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              <span>{s.icon}</span>
              <span>{isES ? s.titleES : s.titleEN}</span>
            </button>
          ))}
        </div>

        {/* Slide content */}
        <div className={`rounded-3xl bg-gradient-to-br ${slide.gradient} overflow-hidden shadow-2xl`}>
          <div className="grid lg:grid-cols-2 gap-0">
            {/* Left: Text */}
            <div className="p-12 lg:p-16 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">{slide.icon}</span>
                <span className="text-xs font-black uppercase tracking-[0.25em] text-white/50">{slide.num} / 09</span>
              </div>
              <h3 className="text-3xl lg:text-4xl font-black text-white mb-4">
                {isES ? slide.titleES : slide.titleEN}
              </h3>
              <p className="text-white/70 text-base leading-relaxed mb-8">
                {isES ? slide.descES : slide.descEN}
              </p>
              <ul className="space-y-3">
                {(isES ? slide.bullets : slide.bulletsEN).map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white/80">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            {/* Right: Metric card */}
            <div className="p-12 lg:p-16 flex flex-col items-center justify-center bg-black/10">
              <div className="w-full max-w-xs">
                <div className="bg-white/10 backdrop-blur rounded-3xl p-8 text-center mb-6 border border-white/10">
                  <p className="text-7xl font-black text-white leading-none mb-2" style={{ color: slide.accent }}>
                    {slide.metric}
                  </p>
                  <p className="text-white/60 text-sm font-medium">{isES ? slide.metricLabel : slide.metricLabel}</p>
                </div>
                {/* Mini feature pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {(isES ? slide.bullets : slide.bulletsEN).slice(0, 3).map((b, i) => (
                    <span key={i} className="bg-white/10 text-white/70 text-[11px] font-medium px-3 py-1.5 rounded-full border border-white/10">
                      {b.split(' ').slice(0, 3).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${active === i ? 'bg-gray-900 w-6' : 'bg-gray-300 w-2'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
