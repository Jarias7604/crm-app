import { useEffect, useState } from 'react';

/**
 * HeroIllustration — 3D Isometric CRM Dashboard
 * Enterprise-grade SVG illustration, no external deps.
 * Shows: Kanban pipeline board + floating notification cards
 */
export default function HeroIllustration() {
  const [tick, setTick] = useState(0);

  // Pulse animations via state
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const pulse = tick % 2 === 0;

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none" style={{ minHeight: 420 }}>
      {/* Glow behind illustration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-72 h-72 rounded-full bg-blue-500/15 blur-[80px]" />
        <div className="absolute w-40 h-40 rounded-full bg-teal-400/10 blur-[60px] translate-x-20 translate-y-10" />
      </div>

      <svg
        viewBox="0 0 540 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[540px] relative z-10 drop-shadow-2xl"
        aria-label="CRM Pipeline 3D Dashboard"
      >
        <defs>
          {/* Blue gradient for top faces */}
          <linearGradient id="topFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f2040" />
          </linearGradient>
          {/* Left face darker */}
          <linearGradient id="leftFace" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#071428" />
            <stop offset="100%" stopColor="#0a1d3a" />
          </linearGradient>
          {/* Right face */}
          <linearGradient id="rightFace" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0c1f3e" />
            <stop offset="100%" stopColor="#0a1830" />
          </linearGradient>
          {/* Card blue */}
          <linearGradient id="cardBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a4080" />
            <stop offset="100%" stopColor="#0e2a56" />
          </linearGradient>
          {/* Card teal */}
          <linearGradient id="cardTeal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
          {/* Card amber */}
          <linearGradient id="cardAmber" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          {/* Electric blue accent */}
          <linearGradient id="accentBlue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          {/* Teal accent */}
          <linearGradient id="accentTeal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
          {/* Notification card */}
          <linearGradient id="notifBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f2d52" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0a1e38" stopOpacity="0.98" />
          </linearGradient>
          {/* WhatsApp green */}
          <linearGradient id="waGreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#3b82f6" floodOpacity="0.25" />
          </filter>
          <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ── MAIN ISOMETRIC PLATFORM ─────────────────────────────── */}
        {/* Base platform — top face */}
        <polygon points="270,60 480,175 270,290 60,175" fill="url(#topFace)" stroke="#1e40af" strokeWidth="0.5" opacity="0.9" />
        {/* Base platform — left face */}
        <polygon points="60,175 270,290 270,320 60,205" fill="url(#leftFace)" opacity="0.9" />
        {/* Base platform — right face */}
        <polygon points="480,175 270,290 270,320 480,205" fill="url(#rightFace)" opacity="0.9" />

        {/* ── COLUMN 1: "Prospecto" ────────────────────────────────── */}
        {/* Col header — top */}
        <polygon points="100,155 185,110 185,125 100,170" fill="#1e3a6e" stroke="#3b82f6" strokeWidth="0.8" />
        <polygon points="100,155 100,170 100,175 100,160" fill="#0c1d3e" />
        <polygon points="185,110 185,125 185,130 185,115" fill="#152d5a" />
        {/* Column label */}
        <text x="135" y="122" fill="#60a5fa" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" textAnchor="middle" letterSpacing="1">PROSPECTO</text>
        <circle cx="178" cy="118" r="5" fill="#3b82f6" opacity="0.8" />
        <text x="178" y="121" fill="white" fontSize="6" fontWeight="800" textAnchor="middle">4</text>

        {/* Card 1a */}
        <polygon points="103,172 183,128 183,148 103,192" fill="url(#cardBlue)" filter="url(#cardShadow)" />
        <polygon points="103,172 103,192 103,196 103,176" fill="#071428" />
        <polygon points="183,128 183,148 183,152 183,132" fill="#0e2a56" />
        <rect x="0" y="0" width="60" height="14" fill="none" /> {/* spacer */}
        <text x="130" y="140" fill="#93c5fd" fontSize="7" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">Carlos M.</text>
        <text x="130" y="150" fill="#4b5563" fontSize="6" fontFamily="Inter,sans-serif" textAnchor="middle">WhatsApp • $2,400</text>
        <rect x="108" y="155" width="18" height="3" rx="1" fill="#3b82f6" opacity="0.7" />
        <rect x="130" y="155" width="12" height="3" rx="1" fill="#1d4ed8" opacity="0.5" />

        {/* Card 1b */}
        <polygon points="103,196 183,152 183,170 103,214" fill="#0f2547" filter="url(#cardShadow)" />
        <polygon points="103,196 103,214 103,218 103,200" fill="#060e1e" />
        <polygon points="183,152 183,170 183,174 183,156" fill="#0a1d3a" />
        <text x="130" y="163" fill="#93c5fd" fontSize="7" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">Ana Pérez</text>
        <text x="130" y="173" fill="#4b5563" fontSize="6" fontFamily="Inter,sans-serif" textAnchor="middle">TikTok Ads • $850</text>

        {/* ── COLUMN 2: "En Seguimiento" ───────────────────────────── */}
        {/* Col header */}
        <polygon points="185,125 270,80 270,95 185,140" fill="#1a3a5e" stroke="#14b8a6" strokeWidth="0.8" />
        <polygon points="185,125 185,140 185,145 185,130" fill="#0c1d3e" />
        <polygon points="270,80 270,95 270,100 270,85" fill="#142e50" />
        <text x="225" y="92" fill="#2dd4bf" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" textAnchor="middle" letterSpacing="1">SEGUIMIENTO</text>
        <circle cx="263" cy="88" r="5" fill="#0d9488" opacity="0.9" />
        <text x="263" y="91" fill="white" fontSize="6" fontWeight="800" textAnchor="middle">6</text>

        {/* Card 2a */}
        <polygon points="188,142 268,98 268,118 188,162" fill="url(#cardTeal)" filter="url(#cardShadow)" />
        <polygon points="188,142 188,162 188,166 188,146" fill="#022c22" />
        <polygon points="268,98 268,118 268,122 268,102" fill="#04422f" />
        <text x="225" y="110" fill="#6ee7b7" fontSize="7" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">Jorge Arias</text>
        <text x="225" y="120" fill="#4b5563" fontSize="6" fontFamily="Inter,sans-serif" textAnchor="middle">AI Bot activo • $5,200</text>
        <rect x="193" y="125" width="14" height="3" rx="1" fill="#14b8a6" opacity="0.8" />
        <rect x="212" y="125" width="10" height="3" rx="1" fill="#0d9488" opacity="0.5" />

        {/* Card 2b */}
        <polygon points="188,166 268,122 268,142 188,186" fill="#0a2a20" filter="url(#cardShadow)" />
        <polygon points="188,166 188,186 188,190 188,170" fill="#041812" />
        <polygon points="268,122 268,142 268,146 268,126" fill="#062018" />
        <text x="225" y="134" fill="#6ee7b7" fontSize="7" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">María López</text>
        <text x="225" y="144" fill="#4b5563" fontSize="6" fontFamily="Inter,sans-serif" textAnchor="middle">Meta Ads • $3,100</text>

        {/* ── COLUMN 3: "Cotización" ───────────────────────────────── */}
        {/* Col header */}
        <polygon points="270,80 355,125 355,140 270,95" fill="#2d1b1b" stroke="#f59e0b" strokeWidth="0.8" />
        <polygon points="270,80 270,95 270,100 270,85" fill="#1a0f0f" />
        <polygon points="355,125 355,140 355,145 355,130" fill="#261515" />
        <text x="308" y="112" fill="#fbbf24" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" textAnchor="middle" letterSpacing="1">COTIZACIÓN</text>
        <circle cx="348" cy="132" r="5" fill="#d97706" opacity="0.9" />
        <text x="348" y="135" fill="white" fontSize="6" fontWeight="800" textAnchor="middle">3</text>

        {/* Card 3a */}
        <polygon points="273,97 353,142 353,162 273,117" fill="url(#cardAmber)" filter="url(#cardShadow)" />
        <polygon points="273,97 273,117 273,121 273,101" fill="#3d1a03" />
        <polygon points="353,142 353,162 353,166 353,146" fill="#512807" />
        <text x="310" y="128" fill="#fcd34d" fontSize="7" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">Luis Martín</text>
        <text x="310" y="138" fill="#78350f" fontSize="6" fontFamily="Inter,sans-serif" textAnchor="middle">PDF enviado • $8,750</text>
        <rect x="278" y="143" width="16" height="3" rx="1" fill="#f59e0b" opacity="0.8" />

        {/* ── COLUMN 4: "Cerrado" ───────────────────────────────────── */}
        {/* Col header */}
        <polygon points="355,125 440,170 440,185 355,140" fill="#14321f" stroke="#22c55e" strokeWidth="0.8" />
        <polygon points="355,125 355,140 355,145 355,130" fill="#0a1e10" />
        <polygon points="440,170 440,185 440,190 440,175" fill="#0f2818" />
        <text x="395" y="152" fill="#4ade80" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" textAnchor="middle" letterSpacing="1">CERRADO ✓</text>
        <circle cx="433" cy="178" r="5" fill="#16a34a" opacity="0.9" />
        <text x="433" y="181" fill="white" fontSize="6" fontWeight="800" textAnchor="middle">9</text>

        {/* Card 4a */}
        <polygon points="358,142 438,187 438,207 358,162" fill="#0f3320" filter="url(#cardShadow)" />
        <polygon points="358,142 358,162 358,166 358,146" fill="#061910" />
        <polygon points="438,187 438,207 438,211 438,191" fill="#0a2516" />
        <text x="395" y="173" fill="#86efac" fontSize="7" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">Sandra V.</text>
        <text x="395" y="183" fill="#166534" fontSize="6" fontFamily="Inter,sans-serif" textAnchor="middle">$12,000 • 22 Jul</text>
        {/* Check badge */}
        <circle cx="425" cy="176" r="6" fill="#16a34a" opacity="0.9" />
        <text x="425" y="179" fill="white" fontSize="8" textAnchor="middle">✓</text>

        {/* ── FLOATING NOTIFICATION CARDS ──────────────────────────── */}

        {/* WhatsApp message card — top right */}
        <g filter="url(#shadow)" style={{ animation: 'float1 3.5s ease-in-out infinite' }}>
          <rect x="360" y="20" width="148" height="56" rx="10" fill="url(#notifBg)" stroke="#1e3a5f" strokeWidth="1" />
          <rect x="360" y="20" width="148" height="56" rx="10" fill="none" stroke="#22c55e" strokeWidth="0.5" opacity="0.4" />
          {/* WA icon */}
          <circle cx="378" cy="42" r="10" fill="url(#waGreen)" />
          <text x="378" y="46" fill="white" fontSize="10" textAnchor="middle">✉</text>
          <text x="395" y="36" fill="#86efac" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">WhatsApp Nuevo</text>
          <text x="395" y="47" fill="#94a3b8" fontSize="7" fontFamily="Inter,sans-serif">"Hola! Me interesa el plan Pro"</text>
          <text x="395" y="57" fill="#4ade80" fontSize="7" fontFamily="Inter,sans-serif">→ AI Agent respondiendo...</text>
          {/* Pulse dot */}
          <circle cx="496" cy="28" r="4" fill="#22c55e" opacity={pulse ? 0.9 : 0.4}>
            <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Lead captured card — top left */}
        <g filter="url(#shadow)">
          <rect x="30" y="40" width="140" height="52" rx="10" fill="url(#notifBg)" stroke="#1e3a5f" strokeWidth="1" />
          <rect x="30" y="40" width="140" height="52" rx="10" fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.4" />
          {/* Bolt icon */}
          <circle cx="48" cy="60" r="9" fill="#1d4ed8" opacity="0.9" />
          <text x="48" y="64" fill="white" fontSize="10" textAnchor="middle">⚡</text>
          <text x="63" y="54" fill="#60a5fa" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Lead Capturado</text>
          <text x="63" y="65" fill="#94a3b8" fontSize="7" fontFamily="Inter,sans-serif">TikTok Ads → CRM</text>
          <text x="63" y="75" fill="#3b82f6" fontSize="7" fontFamily="Inter,sans-serif">⚡ 118ms latencia</text>
        </g>

        {/* ROI card — bottom right */}
        <g filter="url(#shadow)">
          <rect x="370" y="290" width="142" height="58" rx="10" fill="url(#notifBg)" stroke="#1e3a5f" strokeWidth="1" />
          <rect x="370" y="290" width="142" height="58" rx="10" fill="none" stroke="#14b8a6" strokeWidth="0.5" opacity="0.4" />
          <text x="388" y="308" fill="#2dd4bf" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Revenue este mes</text>
          <text x="388" y="322" fill="white" fontSize="14" fontWeight="900" fontFamily="Inter,sans-serif">+$47,200</text>
          <text x="388" y="335" fill="#64748b" fontSize="7" fontFamily="Inter,sans-serif">vs $12,000 sin IA</text>
          {/* Mini chart bars */}
          <rect x="450" y="325" width="6" height="8" rx="1" fill="#0d9488" opacity="0.6" />
          <rect x="459" y="318" width="6" height="15" rx="1" fill="#14b8a6" opacity="0.7" />
          <rect x="468" y="310" width="6" height="23" rx="1" fill="#2dd4bf" opacity="0.9" />
          <rect x="477" y="305" width="6" height="28" rx="1" fill="#5eead4" />
          {/* Trend arrow */}
          <text x="488" y="315" fill="#4ade80" fontSize="12" fontWeight="900">↑</text>
        </g>

        {/* Quote sent badge — small, bottom left */}
        <g filter="url(#shadow)">
          <rect x="22" y="280" width="132" height="48" rx="10" fill="url(#notifBg)" stroke="#1e3a5f" strokeWidth="1" />
          <rect x="22" y="280" width="132" height="48" rx="10" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.3" />
          <circle cx="40" cy="300" r="9" fill="#92400e" opacity="0.9" />
          <text x="40" y="304" fill="#fbbf24" fontSize="9" textAnchor="middle">📄</text>
          <text x="56" y="295" fill="#fbbf24" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Cotización PDF</text>
          <text x="56" y="305" fill="#94a3b8" fontSize="7" fontFamily="Inter,sans-serif">Enviada a Luis M.</text>
          <text x="56" y="315" fill="#d97706" fontSize="7" fontFamily="Inter,sans-serif">$8,750 • Vista 3x</text>
        </g>

        {/* ── METRIC PILLS (floating) ──────────────────────────────── */}
        {/* Pill 1 — center top */}
        <rect x="215" y="18" width="110" height="26" rx="13" fill="#0f2040" stroke="#3b82f6" strokeWidth="1" opacity="0.95" />
        <circle cx="232" cy="31" r="6" fill="#3b82f6" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="270" y="35" fill="white" fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif" textAnchor="middle">AI Score: 94/100</text>

      </svg>

      {/* CSS float animation */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
