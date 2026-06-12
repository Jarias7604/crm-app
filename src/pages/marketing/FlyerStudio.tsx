import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Sparkles, Download, Send, RefreshCw,
  Zap, Image, Check, ChevronRight, Upload, X, Eye,
  BarChart3, Wand2, Layers, Palette, Type, Layout,
  ExternalLink, Star, Cpu, Crown, Smile, Building2,
  Instagram, Facebook, Linkedin, Smartphone, Video
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';

// ─── Data ─────────────────────────────────────────────────────────────────────
const FORMATS = [
  { id: 'ig-post',     label: 'Instagram Post',   tag: '1:1',     icon: Instagram },
  { id: 'ig-portrait', label: 'IG Retrato',        tag: '4:5',     icon: Smartphone },
  { id: 'fb-post',     label: 'Facebook Post',     tag: '6:5',     icon: Facebook },
  { id: 'story',       label: 'Story / Reels',     tag: '9:16',    icon: Video },
  { id: 'fb-cover',    label: 'Portada Facebook',  tag: 'Banner',  icon: Layout },
  { id: 'li-post',     label: 'LinkedIn',          tag: '1.91:1',  icon: Linkedin },
];

const TONES = [
  { key: 'premium',     label: 'Premium',     icon: Crown,      color: '#D4AF37' },
  { key: 'urgente',     label: 'Urgente',     icon: Zap,        color: '#ef4444' },
  { key: 'moderno',     label: 'Moderno',     icon: Sparkles,   color: '#7c3aed' },
  { key: 'amigable',    label: 'Amigable',    icon: Smile,      color: '#10b981' },
  { key: 'corporativo', label: 'Corporativo', icon: Building2,  color: '#0070d2' },
];

const BRAND_COLORS = [
  '#0070d2','#7c3aed','#ef4444','#f59e0b',
  '#10b981','#D4AF37','#ec4899','#06b6d4',
  '#1a1a2e','#111827',
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = {
  page:    { height:'calc(100vh - 64px)', display:'flex', flexDirection:'column' as const, background:'#f0f2f5', fontFamily:'system-ui,-apple-system,sans-serif', overflow:'hidden' },
  header:  { padding:'10px 20px', background:'#fff', borderBottom:'1px solid #dde1e7', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' },
  cols:    { flex:1, display:'flex', gap:0, overflow:'hidden' },
  col:     (w:string, bg='#fff', border=true) => ({ width:w, flexShrink:0, background:bg, borderRight: border ? '1px solid #dde1e7' : 'none', display:'flex', flexDirection:'column' as const, overflow:'hidden' }),
  colHead: { padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  colBody: { flex:1, overflowY:'auto' as const, padding:'16px 18px' },
  label:   { fontSize:10, fontWeight:800, color:'#54698d', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:6, display:'block' },
  input:   { width:'100%', border:'1px solid #d8dde6', borderRadius:7, padding:'9px 12px', fontSize:13, color:'#0f172a', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, background:'#fff' },
  textarea:{ width:'100%', border:'1px solid #d8dde6', borderRadius:7, padding:'10px 12px', fontSize:13, color:'#0f172a', outline:'none', resize:'vertical' as const, minHeight:100, fontFamily:'inherit', boxSizing:'border-box' as const },
  section: { marginBottom:20 },
  pill:    (active:boolean, accent='#0070d2') => ({ border:`1.5px solid ${active ? accent : '#e2e8f0'}`, borderRadius:7, padding:'7px 10px', cursor:'pointer', background: active ? `${accent}10` : '#f8fafc', transition:'all 0.12s', display:'flex', alignItems:'center', gap:5 }),
  btn:     { background:'linear-gradient(135deg,#0070d2,#005fb2)', border:'none', borderRadius:7, padding:'11px 20px', fontSize:12, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:7, width:'100%', justifyContent:'center' as const },
  ghost:   { background:'#f4f6f9', border:'1px solid #d8dde6', borderRadius:7, padding:'9px 14px', fontSize:12, fontWeight:700, color:'#0f172a', cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Form
  const [prompt, setPrompt]             = useState('');
  const [cta, setCta]                   = useState('');
  const [format, setFormat]             = useState('ig-post');
  const [tone, setTone]                 = useState('moderno');
  const [variantCount, setVariantCount] = useState<1|2|3>(1);
  const [colors, setColors]             = useState<string[]>([]);
  const [logoFile, setLogoFile]         = useState<File|null>(null);
  const [logoPreview, setLogoPreview]   = useState('');
  const logoRef = useRef<HTMLInputElement>(null);

  // State
  const [generating, setGenerating]     = useState(false);
  const [variants, setVariants]         = useState<string[]>([]);
  const [selected, setSelected]         = useState(0);
  const [credits, setCredits]           = useState<number|null>(null);
  const [companyName, setCompanyName]   = useState('');

  useEffect(() => {
    if (!profile?.company_id) return;
    supabase.from('companies').select('name').eq('id', profile.company_id).single()
      .then(({ data }) => { if (data?.name) setCompanyName(data.name); });
    supabase.from('ai_generation_credits')
      .select('credits_used,credits_limit').eq('company_id', profile.company_id)
      .order('period_start', { ascending:false }).limit(1).single()
      .then(({ data }) => setCredits(data ? data.credits_limit - data.credits_used : 20));
  }, [profile]);

  function toggleColor(hex:string) {
    setColors(p => p.includes(hex) ? p.filter(c=>c!==hex) : p.length<3 ? [...p,hex] : p);
  }

  async function generate() {
    if (!prompt.trim()) { toast.error('Describe qué quieres promocionar'); return; }
    setGenerating(true);
    setVariants([]);
    try {
      const { data:{session} } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flyer-ai-generator`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token}` },
        body: JSON.stringify({ prompt, company_name: companyName||'Mi Empresa', cta:cta||undefined, colors, format, tone, variant_count:variantCount, company_id:profile?.company_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.variants?.length) throw new Error(json.error||'Error generando');
      setVariants(json.variants);
      setSelected(0);
      if (json.credits_remaining != null) setCredits(json.credits_remaining);
    } catch(e:any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    const url = variants[selected];
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `flyer-${format}-${Date.now()}.png`;
      a.click();
      toast.success('Flyer descargado');
    } catch { window.open(url, '_blank'); }
  }

  function sendToSocialHub() {
    const url = variants[selected];
    if (!url) return;
    sessionStorage.setItem('socialhub_prefill_image', url);
    navigate('/marketing/social');
    toast.success('✅ Flyer enviado al Panel de Publicidad');
  }

  const credColor = credits === null ? '#94a3b8' : credits > 10 ? '#10b981' : credits > 3 ? '#f59e0b' : '#ef4444';

  return (
    <div style={css.page}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={css.header}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>navigate('/marketing')}
            style={{background:'#fff',border:'1px solid #d8dde6',borderRadius:7,padding:7,cursor:'pointer',display:'flex'}}>
            <ArrowLeft size={14} color="#54698d"/>
          </button>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:34,height:34,borderRadius:8,background:'linear-gradient(135deg,#0070d2,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Wand2 size={16} color="#fff" strokeWidth={2.5}/>
            </div>
            <div>
              <div style={{fontSize:8,fontWeight:900,color:'#D4AF37',letterSpacing:'0.12em'}}>ARIAS CRM · SOCIAL MEDIA HUB</div>
              <div style={{fontSize:15,fontWeight:800,color:'#081c3b'}}>AI Flyer Studio</div>
            </div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {credits !== null && (
            <div style={{display:'flex',alignItems:'center',gap:5,background:credits>10?'#f0fdf4':credits>3?'#fffbeb':'#fef2f2',border:`1px solid ${credColor}40`,borderRadius:20,padding:'5px 12px'}}>
              <Zap size={11} color={credColor} fill={credColor}/>
              <span style={{fontSize:11,fontWeight:700,color:credColor}}>{credits} créditos</span>
            </div>
          )}
          <button onClick={()=>navigate('/marketing/ai-credits')} style={{...css.ghost,padding:'6px 12px',fontSize:11}}>
            <BarChart3 size={12}/> Uso
          </button>
        </div>
      </header>

      {/* ── 3 COLUMNS ──────────────────────────────────────────────────────── */}
      <div style={css.cols}>

        {/* ══ COL 1 — CREATIVE BRIEF (320px) ════════════════════════════════ */}
        <div style={css.col('320px')}>
          <div style={css.colHead}>
            <div style={{width:26,height:26,borderRadius:6,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Type size={13} color="#0070d2"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:'#0f172a'}}>Brief Creativo</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>Describe tu publicidad</div>
            </div>
          </div>

          <div style={css.colBody}>
            {/* Prompt */}
            <div style={css.section}>
              <label style={css.label}>¿Qué quieres promocionar? *</label>
              <textarea
                style={css.textarea}
                placeholder="Ej: Promoción especial de verano — 30% off en todos los servicios. Incluye kit completo de defensa personal..."
                value={prompt}
                onChange={e=>setPrompt(e.target.value)}
              />
            </div>

            {/* CTA */}
            <div style={css.section}>
              <label style={css.label}>Llamada a la acción (CTA)</label>
              <input style={css.input} placeholder="Ej: Reserva hoy · Llama ahora · Obtén 30% off"
                value={cta} onChange={e=>setCta(e.target.value)}/>
            </div>

            {/* Logo */}
            <div style={css.section}>
              <label style={css.label}>Logo / imagen de referencia</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button onClick={()=>logoRef.current?.click()} style={{...css.ghost,fontSize:11,padding:'7px 12px'}}>
                  <Upload size={12}/> {logoFile?'Cambiar':'Subir logo'}
                </button>
                {logoPreview && (
                  <div style={{position:'relative',display:'inline-flex'}}>
                    <img src={logoPreview} alt="logo" style={{height:36,width:36,objectFit:'contain',borderRadius:5,border:'1px solid #e2e8f0'}}/>
                    <button onClick={()=>{setLogoFile(null);setLogoPreview('');}} style={{position:'absolute',top:-5,right:-5,background:'#ef4444',border:'none',borderRadius:'50%',width:14,height:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <X size={9} color="#fff"/>
                    </button>
                  </div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setLogoFile(f);const r=new FileReader();r.onload=ev=>setLogoPreview(ev.target?.result as string);r.readAsDataURL(f);}} style={{display:'none'}}/>
            </div>

            {/* Variants */}
            <div style={css.section}>
              <label style={css.label}>¿Cuántas variantes? (1 crédito c/u)</label>
              <div style={{display:'flex',gap:8}}>
                {([1,2,3] as const).map(n=>(
                  <button key={n} onClick={()=>setVariantCount(n)}
                    style={{flex:1,height:44,border:`1.5px solid ${variantCount===n?'#0070d2':'#e2e8f0'}`,borderRadius:7,background:variantCount===n?'#eff6ff':'#f8fafc',cursor:'pointer',fontSize:18,fontWeight:900,color:variantCount===n?'#0070d2':'#94a3b8'}}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:5}}>
                Costo: <strong style={{color:'#0f172a'}}>{variantCount} crédito{variantCount>1?'s':''}</strong>
                {credits!==null?` · Quedan ${credits}`:''}</div>
            </div>
          </div>
        </div>

        {/* ══ COL 2 — STYLE SETTINGS (340px) ════════════════════════════════ */}
        <div style={css.col('340px')}>
          <div style={css.colHead}>
            <div style={{width:26,height:26,borderRadius:6,background:'#f5f3ff',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Palette size={13} color="#7c3aed"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:'#0f172a'}}>Estilo & Formato</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>Define el look del flyer</div>
            </div>
          </div>

          <div style={css.colBody}>
            {/* Format (2 Columns) */}
            <div style={css.section}>
              <label style={css.label}>Formato</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {FORMATS.map(f=>{
                  const IconComponent = f.icon;
                  return (
                    <button key={f.id} onClick={()=>setFormat(f.id)}
                      style={{...css.pill(format===f.id), flexDirection:'row' as const, alignItems:'center', padding:'8px 10px', gap:6}}>
                      <IconComponent size={13} color={format===f.id?'#0070d2':'#54698d'}/>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                        <span style={{fontSize:11,fontWeight:700,color:format===f.id?'#0070d2':'#0f172a',lineHeight:1.1}}>{f.label}</span>
                        <span style={{fontSize:9,color:'#94a3b8'}}>{f.tag}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone (2 Columns) */}
            <div style={css.section}>
              <label style={css.label}>Tono de diseño</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {TONES.map(t=>{
                  const ToneIcon = t.icon;
                  return (
                    <button key={t.key} onClick={()=>setTone(t.key)}
                      style={{...css.pill(tone===t.key), justifyContent:'flex-start', gap:6, padding:'8px 10px'}}>
                      <ToneIcon size={13} color={tone===t.key?'#0070d2':t.color}/>
                      <span style={{fontSize:11,fontWeight:700,color:tone===t.key?'#0070d2':'#0f172a'}}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brand colors */}
            <div style={css.section}>
              <label style={css.label}>Colores de marca (máx. 3)</label>
              <div style={{display:'flex',gap:7,flexWrap:'wrap' as const}}>
                {BRAND_COLORS.map(hex=>(
                  <button key={hex} onClick={()=>toggleColor(hex)}
                    style={{width:24,height:24,borderRadius:'50%',background:hex,border:'none',cursor:'pointer',outline:colors.includes(hex)?`2px solid ${hex}`:'2px solid transparent',outlineOffset:2,boxShadow:'0 1px 3px rgba(0,0,0,0.18)',transition:'outline 0.1s'}}/>
                ))}
                {colors.length>0 && <button onClick={()=>setColors([])} style={{fontSize:10,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Limpiar</button>}
              </div>
            </div>

            {/* Generate button */}
            <div style={{paddingTop:8}}>
              <button onClick={generate} disabled={generating||!prompt.trim()}
                style={{...css.btn, opacity:generating||!prompt.trim()?0.5:1, cursor:generating||!prompt.trim()?'not-allowed':'pointer', padding:'12px 20px'}}>
                {generating
                  ? <><Cpu size={14} style={{animation:'spin 1s linear infinite'}}/> Generando con IA...</>
                  : <><Sparkles size={14} color="#D4AF37" fill="#D4AF37"/> Generar Flyer con IA <ChevronRight size={13}/></>
                }
              </button>
              <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>
        </div>

        {/* ══ COL 3 — PREVIEW & RESULTS (flex:1) ════════════════════════════ */}
        <div style={{...css.col('1fr','#f0f2f5',false), flex:1}}>
          <div style={{...css.colHead, background:'#fff', borderBottom:'1px solid #dde1e7'}}>
            <div style={{width:26,height:26,borderRadius:6,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Image size={13} color="#10b981"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:800,color:'#0f172a'}}>Vista Previa & Resultados</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>
                {generating ? 'Generando tu flyer...' : variants.length>0 ? `${variants.length} variante${variants.length>1?'s':''} lista${variants.length>1?'s':''}` : 'Tu flyer aparecerá aquí'}
              </div>
            </div>
            {variants.length>0 && (
              <button onClick={()=>setVariants([])} style={{...css.ghost,padding:'5px 10px',fontSize:11}}>
                <RefreshCw size={11}/> Nuevo
              </button>
            )}
          </div>

          <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16,alignItems:'center',justifyContent:'center'}}>

            {/* Empty / loading state */}
            {!generating && variants.length===0 && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,paddingTop:20}}>
                <div style={{width:72,height:72,borderRadius:16,background:'linear-gradient(135deg,#0070d220,#7c3aed20)',border:'2px dashed #d8dde6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Layers size={28} color="#94a3b8"/>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#64748b',marginBottom:4}}>Completa el brief y genera</div>
                  <div style={{fontSize:12,color:'#94a3b8',maxWidth:240}}>La IA creará un flyer profesional listo para publicar en tus redes sociales.</div>
                </div>
                {/* Tips */}
                {[
                  {icon:Star, text:'Usa un tono acorde a tu audiencia'},
                  {icon:Palette, text:'Agrega tus colores de marca'},
                  {icon:Layout, text:'Elige el formato según la red social'},
                ].map(({icon:Icon,text})=>(
                  <div key={text} style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 14px',width:'100%',maxWidth:280}}>
                    <Icon size={13} color="#0070d2"/>
                    <span style={{fontSize:11,color:'#64748b'}}>{text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Generating animation */}
            {generating && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
                <div style={{width:64,height:64,borderRadius:'50%',background:'linear-gradient(135deg,#0070d2,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',animation:'pulse 1.5s ease-in-out infinite'}}>
                  <Sparkles size={26} color="#fff"/>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:15,fontWeight:800,color:'#0f172a',marginBottom:4}}>Generando con gpt-image-1</div>
                  <div style={{fontSize:12,color:'#64748b'}}>{variantCount>1?`Creando ${variantCount} variantes...`:'Procesando diseño...'}<br/>15–45 segundos</div>
                </div>
                <div style={{width:200,height:5,background:'#e2e8f0',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',background:'linear-gradient(90deg,#0070d2,#7c3aed)',borderRadius:99,animation:'progress 2s ease-in-out infinite',width:'60%'}}/>
                </div>
                <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}} @keyframes progress{0%{width:20%}50%{width:80%}100%{width:50%}}`}</style>
              </div>
            )}

            {/* Results */}
            {variants.length>0 && (
              <div style={{width:'100%',maxWidth:440,display:'flex',flexDirection:'column',gap:16}}>
                {/* Variant selector tabs */}
                {variants.length>1 && (
                  <div style={{display:'flex',gap:8,background:'#fff',padding:8,borderRadius:8,border:'1px solid #e2e8f0'}}>
                    {variants.map((_,i)=>(
                      <button key={i} onClick={()=>setSelected(i)}
                        style={{flex:1,padding:'7px',borderRadius:6,border:`1.5px solid ${selected===i?'#0070d2':'#e2e8f0'}`,background:selected===i?'#eff6ff':'#f8fafc',cursor:'pointer',fontSize:11,fontWeight:700,color:selected===i?'#0070d2':'#64748b',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                        {selected===i && <Check size={10}/>} Variante {i+1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Flyer image */}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e8f0',overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
                  <img
                    src={variants[selected]}
                    alt={`Variante ${selected+1}`}
                    style={{width:'100%',display:'block',maxHeight:'350px',objectFit:'contain',background:'#f8fafc'}}
                  />
                </div>

                {/* Action buttons */}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e8f0',padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#0f172a',marginBottom:2}}>Acciones rápidas</div>

                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>window.open(variants[selected],'_blank')}
                      style={{...css.ghost,flex:1,justifyContent:'center'}}>
                      <ExternalLink size={13}/> Pantalla Completa
                    </button>

                    <button onClick={handleDownload}
                      style={{...css.ghost,flex:1,justifyContent:'center',background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#166534'}}>
                      <Download size={13}/> Descargar PNG
                    </button>
                  </div>

                  <button onClick={sendToSocialHub}
                    style={{...css.btn,background:'linear-gradient(135deg,#0070d2,#005fb2)'}}>
                    <Send size={13}/>
                    Publicar en Social Hub
                    <ChevronRight size={13}/>
                  </button>

                  <div style={{fontSize:10,color:'#94a3b8',textAlign:'center',marginTop:2}}>
                    El flyer se abrirá en el Panel de Publicidad listo para subir a tus redes
                  </div>
                </div>

                {/* Credits remaining */}
                {credits!==null && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <Zap size={11} color={credColor} fill={credColor}/>
                    <span style={{fontSize:11,color:'#64748b'}}>
                      <strong style={{color:credColor}}>{credits}</strong> créditos restantes este mes
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}