import {
  Sparkles,
  Zap,
  Instagram,
  Facebook,
  Linkedin,
  Smartphone,
  Video,
  Crown,
  Smile,
  Building2,
  Layout,
} from 'lucide-react';

export const FORMATS = [
  { id: 'ig-post', label: 'Instagram Post', tag: '1:1', icon: Instagram },
  { id: 'ig-portrait', label: 'IG Retrato', tag: '4:5', icon: Smartphone },
  { id: 'fb-post', label: 'Facebook Post', tag: '6:5', icon: Facebook },
  { id: 'story', label: 'Story / Reels', tag: '9:16', icon: Video },
  { id: 'fb-cover', label: 'Portada Facebook', tag: 'Banner', icon: Layout },
  { id: 'li-post', label: 'LinkedIn', tag: '1.91:1', icon: Linkedin },
];

export const TONES = [
  { key: 'premium', label: 'Premium', icon: Crown, color: '#D4AF37' },
  { key: 'urgente', label: 'Urgente', icon: Zap, color: '#ef4444' },
  { key: 'moderno', label: 'Moderno', icon: Sparkles, color: '#7c3aed' },
  { key: 'amigable', label: 'Amigable', icon: Smile, color: '#10b981' },
  { key: 'corporativo', label: 'Corporativo', icon: Building2, color: '#0070d2' },
];

export const BRAND_COLORS = [
  '#06c7d9', '#2563eb', '#6d4aff', '#071640', '#667085', '#f7f8fc',
  '#0070d2', '#7c3aed', '#ef4444', '#f59e0b', '#10b981', '#111827',
];

export const GRADIENT_PRESETS = [
  { id: 'iclesia-brand', name: 'Iclesia Pro (#06C7D9 → #2563EB → #6D4AFF)', value: 'linear-gradient(135deg, #06c7d9 0%, #2563eb 50%, #6d4aff 100%)', c1: '#06c7d9', c2: '#2563eb', c3: '#6d4aff', angle: 135, type: 'linear' as const },
  { id: 'meta-violet', name: 'Violeta Viral (Foto 5)', value: 'linear-gradient(135deg, #7928ca 0%, #c026d3 50%, #ff0080 100%)', c1: '#7928ca', c2: '#c026d3', c3: '#ff0080', angle: 135, type: 'linear' as const },
  { id: 'royal-indigo', name: 'Índigo Tech', value: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #6366f1 100%)', c1: '#1e1b4b', c2: '#4338ca', c3: '#6366f1', angle: 135, type: 'linear' as const },
  { id: 'ocean-cyan', name: 'Océano Cyan', value: 'linear-gradient(135deg, #082f49 0%, #0284c7 50%, #06b6d4 100%)', c1: '#082f49', c2: '#0284c7', c3: '#06b6d4', angle: 135, type: 'linear' as const },
  { id: 'sunset-fire', name: 'Atardecer Coral', value: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)', c1: '#7c2d12', c2: '#ea580c', c3: '#fbbf24', angle: 135, type: 'linear' as const },
  { id: 'emerald-pro', name: 'Esmeralda Pro', value: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)', c1: '#064e3b', c2: '#059669', c3: '#10b981', angle: 135, type: 'linear' as const },
  { id: 'gold-luxury', name: 'Oro & Bronce VIP', value: 'linear-gradient(135deg, #451a03 0%, #b45309 50%, #f59e0b 100%)', c1: '#451a03', c2: '#b45309', c3: '#f59e0b', angle: 135, type: 'linear' as const },
  { id: 'rose-wine', name: 'Rubí & Rosa', value: 'linear-gradient(135deg, #4c0519 0%, #be123c 50%, #f43f5e 100%)', c1: '#4c0519', c2: '#be123c', c3: '#f43f5e', angle: 135, type: 'linear' as const },
  { id: 'midnight-dark', name: 'Obsidiana Minimal', value: 'linear-gradient(135deg, #030712 0%, #0f172a 50%, #1e293b 100%)', c1: '#030712', c2: '#0f172a', c3: '#1e293b', angle: 135, type: 'linear' as const },
];

export const DEFAULT_BG_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop';

export const DEFAULT_LOGO_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHBvbHlnb24gcG9pbnRzPSI1MCwxNSA5MCw4MCAxMCw4MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjgiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIxNSIgZmlsbD0iIzdjM2FlZCIvPjwvc3ZnPg==';

export const FONT_OPTIONS = [
  { value: 'Outfit', name: 'Outfit', desc: 'Moderna & Limpia' },
  { value: 'Montserrat', name: 'Montserrat', desc: 'Geométrica B2B' },
  { value: 'Oswald', name: 'Oswald', desc: 'Condensada Impacto' },
  { value: 'Poppins', name: 'Poppins', desc: 'Redonda Popular' },
  { value: 'Playfair Display', name: 'Playfair Display', desc: 'Serif Elegante' },
  { value: 'Bebas Neue', name: 'Bebas Neue', desc: 'Titulares Sans' },
  { value: 'Raleway', name: 'Raleway', desc: 'Sofisticada Delgado' },
  { value: 'Inter', name: 'Inter', desc: 'Estándar Pro' },
];

export const css = {
  page: { height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' as const, background: '#f0f2f5', fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden' },
  header: { padding: '10px 20px', background: '#fff', borderBottom: '1px solid #dde1e7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  cols: { flex: 1, display: 'flex', gap: 0, overflow: 'hidden' },
  col: (w: string, bg = '#fff', border = true) => ({ width: w, flexShrink: 0, background: bg, borderRight: border ? '1px solid #dde1e7' : 'none', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }),
  colHead: { padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  colBody: { flex: 1, overflowY: 'auto' as const, padding: '16px 18px' },
  label: { fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
  input: { width: '100%', border: '1px solid #d8dde6', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: '#0f172a', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' },
  select: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontWeight: 700,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px 16px',
    paddingRight: '36px',
  },
  textarea: { width: '100%', border: '1px solid #d8dde6', borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#0f172a', outline: 'none', resize: 'vertical' as const, minHeight: 100, fontFamily: 'inherit', boxSizing: 'border-box' as const },
  section: { marginBottom: 20 },
  pill: (active: boolean, accent = '#0070d2') => ({ border: `1.5px solid ${active ? accent : '#e2e8f0'}`, borderRadius: 7, padding: '7px 10px', cursor: 'pointer', background: active ? `${accent}10` : '#f8fafc', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5 }),
  btn: { background: 'linear-gradient(135deg,#0070d2,#005fb2)', border: 'none', borderRadius: 7, padding: '11px 20px', fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, width: '100%', justifyContent: 'center' as const },
  ghost: { background: '#f4f6f9', border: '1px solid #d8dde6', borderRadius: 7, padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
};
