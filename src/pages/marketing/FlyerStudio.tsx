import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Zap, Target, Crown, Flame, Star, 
  Loader2, Download
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { flyerService } from '../../services/flyerService';
import type { FlyerIdea } from '../../services/flyerService';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTES DE DISEÑO PREMIUM (2026 GOLD)
   ───────────────────────────────────────────────────────────────────────────── */
const CANVAS_W = 1080;
const CANVAS_H = 1350; // Aspecto Profesional 4:5 (Instagram/LinkedIn Ads)
const LUXURY_FALLBACK = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=2071&auto=format&fit=crop';
const ACCENT_COLORS = ['#D4AF37', '#B59410', '#111', '#fff', '#ef4444', '#3b82f6'];
const INDUSTRIES_FALLBACK = ['Bienes Raíces', 'Seguros', 'Consultoría', 'E-commerce', 'Turismo'];

const TONES = [
  { key: 'premium', label: 'Premium', icon: Crown },
  { key: 'moderno', label: 'Moderno', icon: Zap },
  { key: 'urgente', label: 'Urgente', icon: Flame },
  { key: 'amigable', label: 'Amigable', icon: Star },
  { key: 'corporativo', label: 'Corporativo', icon: Target },
];

/* ─────────────────────────────────────────────────────────────────────────────
   CANVAS ENGINE (ARIAS SIGNATURE - SANITIZADO)
   ───────────────────────────────────────────────────────────────────────────── */

// 1. Inyectando fuentes editoriales de lujo
function injectFonts() {
  const f = document.createElement('link');
  f.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;600;800;900&display=swap';
  f.rel = 'stylesheet';
  if (!document.head.querySelector(`link[href="${f.href}"]`)) document.head.appendChild(f);
}


// ─── HELPERS PREMIUM ─────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' '); const lines: string[] = []; let curr = words[0] || '';
  for (let i = 1; i < words.length; i++) {
    if (ctx.measureText(curr+' '+words[i]).width < maxWidth) curr += ' '+words[i];
    else { lines.push(curr); curr = words[i]; }
  }
  lines.push(curr); return lines;
}
// Draws full-bleed image + rich gradient overlay — the foundation of ALL professional layouts
function drawFullBleedBg(ctx: CanvasRenderingContext2D, W: number, H: number, img: HTMLImageElement | null, stops: {pos:number,color:string}[]) {
  if (img) {
    // Cover crop: maintain aspect ratio, fill canvas
    const ir = img.width/img.height; const cr = W/H;
    let sw=img.width,sh=img.height,sx=0,sy=0;
    if (ir>cr) { sw=img.height*cr; sx=(img.width-sw)/2; } else { sh=img.width/cr; sy=(img.height-sh)/2; }
    ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
  } else { ctx.fillStyle='#1e293b'; ctx.fillRect(0,0,W,H); }
  const gr = ctx.createLinearGradient(0,0,0,H);
  stops.forEach(s => gr.addColorStop(s.pos, s.color));
  ctx.fillStyle = gr; ctx.fillRect(0,0,W,H);
}
function pxFont(ctx: CanvasRenderingContext2D, font: string) { ctx.font = font; }
function txt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign='left') {
  ctx.fillStyle=color; ctx.textAlign=align; ctx.fillText(text,x,y);
}
function shadow(ctx: CanvasRenderingContext2D, color='rgba(0,0,0,0.8)', blur=20, oy=6) {
  ctx.shadowColor=color; ctx.shadowBlur=blur; ctx.shadowOffsetY=oy;
}
function noShadow(ctx: CanvasRenderingContext2D) { ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0; }
function drawPill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, fs=22, px=28, py=14, r=999) {
  ctx.save(); pxFont(ctx,`800 ${fs}px Outfit`);
  const tw=ctx.measureText(text).width; const bw=tw+px*2; const bh=fs+py*2;
  roundRect(ctx,x,y,bw,bh,r); ctx.fillStyle=bg; ctx.fill();
  txt(ctx,text,x+px,y+bh-py-3,fg,'left'); ctx.restore();
}
function drawMultilineTitleLeft(ctx: CanvasRenderingContext2D, title: string, x: number, startY: number, maxW: number, size: number, color1: string, color2: string, acc: string): number {
  pxFont(ctx, `900 ${size}px Playfair Display`);
  const lines = wrapText(ctx, title.toUpperCase(), maxW);
  lines.slice(0,3).forEach((l,i) => {
    shadow(ctx,'rgba(0,0,0,0.7)',24,8);
    ctx.fillStyle = i===1 ? acc : (i===0 ? color1 : color2);
    ctx.textAlign='left'; ctx.fillText(l,x,startY+i*(size+18));
    noShadow(ctx);
  });
  return startY + lines.slice(0,3).length*(size+18);
}
function drawMultilineTitleCenter(ctx: CanvasRenderingContext2D, title: string, cx: number, startY: number, maxW: number, size: number, color1: string, acc: string): number {
  pxFont(ctx, `900 ${size}px Playfair Display`);
  const lines = wrapText(ctx, title.toUpperCase(), maxW);
  lines.slice(0,3).forEach((l,i) => {
    shadow(ctx,'rgba(0,0,0,0.75)',28,10);
    ctx.fillStyle = i===0 ? color1 : acc;
    ctx.textAlign='center'; ctx.fillText(l,cx,startY+i*(size+20));
    noShadow(ctx);
  });
  return startY + lines.slice(0,3).length*(size+20);
}
function drawBenefitRow(ctx: CanvasRenderingContext2D, items: string[], x: number, y: number, maxW: number, acc: string, light=false) {
  if (!items.length) return y;
  const icons = ['✔','★','◆','▸','●','✦'];
  items.slice(0,4).forEach((b,i) => {
    const col = i%2; const row = Math.floor(i/2);
    const bx = x + col*(maxW/2); const by = y + row*72;
    // Icon circle
    ctx.save(); ctx.beginPath(); ctx.arc(bx+28,by,28,0,Math.PI*2);
    ctx.fillStyle=acc; ctx.fill(); noShadow(ctx);
    pxFont(ctx,'700 20px Outfit'); txt(ctx,icons[i%6],bx+28,by+7,light?'#000':'#fff','center');
    // Text
    pxFont(ctx,'700 28px Outfit'); txt(ctx,b.substring(0,26),bx+66,by+10,light?'#1e293b':'rgba(255,255,255,0.95)','left');
    ctx.restore();
  });
  return y + Math.ceil(items.length/2)*76;
}
function drawCTAButton(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, w: number, h: number, bg: string, fg: string) {
  ctx.save();
  shadow(ctx,'rgba(0,0,0,0.5)',24,8);
  roundRect(ctx,cx-w/2,y,w,h,h/2); ctx.fillStyle=bg; ctx.fill(); noShadow(ctx);
  // Highlight
  const hi=ctx.createLinearGradient(cx-w/2,y,cx-w/2,y+h*0.4);
  hi.addColorStop(0,'rgba(255,255,255,0.25)'); hi.addColorStop(1,'rgba(255,255,255,0)');
  roundRect(ctx,cx-w/2,y,w,h*0.5,h/2); ctx.fillStyle=hi; ctx.fill();
  pxFont(ctx,`900 ${Math.round(h*0.38)}px Outfit`);
  shadow(ctx,'rgba(0,0,0,0.4)',6,2);
  txt(ctx,text,cx,y+h*0.67,fg,'center'); noShadow(ctx);
  ctx.restore();
}
function drawLogoBar(ctx: CanvasRenderingContext2D, W: number, y: number, h: number, bg: string, logo: HTMLImageElement|null, phone: string, web: string, acc: string) {
  ctx.save(); ctx.fillStyle=bg; ctx.fillRect(0,y,W,h);
  if (logo) ctx.drawImage(logo,36,y+(h-52)/2,52,52);
  pxFont(ctx,'800 30px Outfit'); txt(ctx,'ARIAS GROUP',logo?108:40,y+h/2+6,acc,'left');
  if (phone) { pxFont(ctx,'700 28px Outfit'); txt(ctx,'📞 '+phone,W/2,y+h/2+10,'rgba(255,255,255,0.9)','center'); }
  if (web) { pxFont(ctx,'600 22px Outfit'); txt(ctx,web,W-40,y+h/2+8,'rgba(255,255,255,0.55)','right'); }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 1: HERO FULL BLEED — Imagen completa, título dominante abajo
// ═══════════════════════════════════════════════════════════════════
function engine_splitPanel(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent||'#D4AF37';
  // BG: full bleed image, gradient from transparent top → heavy dark bottom
  drawFullBleedBg(ctx,W,H,d.bgImage,[
    {pos:0,color:'rgba(0,0,0,0.10)'},{pos:0.45,color:'rgba(0,0,0,0.05)'},
    {pos:0.65,color:'rgba(0,0,0,0.55)'},{pos:1,color:'rgba(0,0,0,0.93)'}
  ]);
  // TOP BAR
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,W,110);
  if(d.logoImage) ctx.drawImage(d.logoImage,40,24,62,62);
  pxFont(ctx,'800 20px Outfit'); txt(ctx,d.industria||'ARIAS GROUP',d.logoImage?116:40,52,'rgba(255,255,255,0.9)','left');
  pxFont(ctx,'600 17px Outfit'); txt(ctx,(d.contact?.web||'WWW.EMPRESA.COM').toUpperCase(),d.logoImage?116:40,76,acc,'left');
  // PRICE BADGE top-right
  if(d.price) drawPill(ctx,d.price,W-270,26,acc,'#000',36,22,14);
  // ACCENT stripe
  ctx.fillStyle=acc; ctx.fillRect(0,H*0.58,W,8);
  // MAIN TITLE — left aligned big
  const titY = H*0.62;
  const titEnd = drawMultilineTitleLeft(ctx,d.title||'Tu Oferta Aquí',60,titY,W-100,110,'#fff','#fff',acc);
  // SUBTITLE
  pxFont(ctx,'400 34px Outfit');
  shadow(ctx,'rgba(0,0,0,0.6)',12,4);
  txt(ctx,d.subtitle||'',60,titEnd+20,'rgba(255,255,255,0.85)','left');
  noShadow(ctx);
  // BENEFITS
  const benY = drawBenefitRow(ctx,d.beneficios||[],60,titEnd+72,W-80,acc);
  // CTA
  drawCTAButton(ctx,d.cta||'CONTÁCTANOS',W/2,benY+36,560,88,acc,'#000');
  // PHONE + SOCIAL
  const barY = H-85;
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,barY,W,85);
  pxFont(ctx,'800 30px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,barY+50,'#fff','center');
  pxFont(ctx,'600 20px Outfit'); txt(ctx,d.contact?.web||'www.empresa.com',W/2,barY+74,'rgba(255,255,255,0.5)','center');
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 2: DARK HEADER LUXURY — Franja oscura top, imagen centro, texto bottom
// ═══════════════════════════════════════════════════════════════════
function engine_fullOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#D4AF37';
  // Full bleed image
  drawFullBleedBg(ctx,W,H,d.bgImage,[
    {pos:0,color:'rgba(0,0,0,0.85)'},{pos:0.3,color:'rgba(0,0,0,0.35)'},
    {pos:0.6,color:'rgba(0,0,0,0.45)'},{pos:1,color:'rgba(0,0,0,0.97)'}
  ]);
  // TOP BRANDING
  ctx.fillStyle=acc; ctx.fillRect(0,0,W,10);
  if(d.logoImage) ctx.drawImage(d.logoImage,W/2-36,28,72,72);
  pxFont(ctx,'700 18px Outfit'); txt(ctx,(d.industria||'MARKETING PREMIUM').toUpperCase(),W/2,d.logoImage?118:60,'rgba(255,255,255,0.6)','center');
  ctx.fillStyle=acc; ctx.fillRect(W/2-60,d.logoImage?126:68,120,4);
  // SUPER BIG CENTERED TITLE
  const titStart = d.logoImage?165:120;
  const titEnd = drawMultilineTitleCenter(ctx,d.title||'Tu Oferta',W/2,titStart,W-80,128,'#fff',acc);
  // SUBTITLE
  pxFont(ctx,'500 36px Outfit'); shadow(ctx,'rgba(0,0,0,0.7)',14,4);
  txt(ctx,d.subtitle||'',W/2,titEnd+28,'rgba(255,255,255,0.9)','center'); noShadow(ctx);
  // DIVIDER
  ctx.fillStyle=acc; ctx.fillRect(W/2-80,titEnd+56,160,4);
  // BENEFIT PILLS (horizontal, centered)
  const bens = (d.beneficios||[]).slice(0,3);
  let bpx = 60; const bpy = titEnd+90;
  bens.forEach((b: string) => {
    drawPill(ctx,b.substring(0,22),bpx,bpy,'rgba(255,255,255,0.12)','#fff',26,20,12);
    bpx += ctx.measureText(b.substring(0,22)).width+80;
  });
  // CTA
  const ctaY = Math.max(bpy+90, H-280);
  drawCTAButton(ctx,d.cta||'VER AHORA',W/2,ctaY,580,92,acc,'#000');
  // PRICE (if present)
  if(d.price){ pxFont(ctx,'900 90px Outfit'); shadow(ctx,'rgba(0,0,0,0.8)',20,6);
    txt(ctx,d.price,W/2,ctaY-60,'#fff','center'); noShadow(ctx); }
  // BOTTOM BAR
  ctx.fillStyle=acc; ctx.fillRect(0,H-90,W,90);
  pxFont(ctx,'900 32px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-50,'#000','center');
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 3: WHITE CARD — Fondo blanco, imagen top, contenido abajo limpio
// ═══════════════════════════════════════════════════════════════════
function engine_bottomBanner(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#e11d48';
  // WHITE BG
  ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);
  // TOP IMAGE SECTION (60% height)
  const imgH = Math.round(H*0.58);
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,imgH); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=W/imgH;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,0,0,W,imgH);
  } else { ctx.fillStyle='#cbd5e1'; ctx.fillRect(0,0,W,imgH); }
  // Overlay bottom of image
  const og=ctx.createLinearGradient(0,imgH*0.5,0,imgH); og.addColorStop(0,'rgba(248,250,252,0)'); og.addColorStop(1,'#f8fafc');
  ctx.fillStyle=og; ctx.fillRect(0,0,W,imgH);
  ctx.restore();
  // ACCENT BAR
  ctx.fillStyle=acc; ctx.fillRect(0,imgH,W,10);
  // TOP LOGO
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,80);
  if(d.logoImage) ctx.drawImage(d.logoImage,36,12,56,56);
  pxFont(ctx,'800 22px Outfit'); txt(ctx,d.industria||'ARIAS GROUP',d.logoImage?106:40,44,'#fff','left');
  if(d.price) drawPill(ctx,d.price,W-260,14,acc,'#fff',36,20,14);
  // CONTENT (bottom 40%)
  const contY = imgH+24;
  pxFont(ctx,'900 22px Outfit'); txt(ctx,(d.industria||'MARKETING').toUpperCase(),60,contY+28,acc,'left');
  const titEnd=drawMultilineTitleLeft(ctx,d.title||'Tu Oferta',60,contY+60,W-100,96,'#0f172a','#0f172a',acc);
  pxFont(ctx,'500 30px Outfit'); shadow(ctx,'rgba(0,0,0,0.1)',4,2);
  txt(ctx,d.subtitle||'',60,titEnd+16,'#475569','left'); noShadow(ctx);
  const benY=drawBenefitRow(ctx,d.beneficios||[],60,titEnd+58,W-80,acc,true);
  drawCTAButton(ctx,d.cta||'CONTÁCTANOS',W/2,benY+24,580,86,acc,'#fff');
  drawLogoBar(ctx,W,H-90,90,'#0f172a',d.logoImage,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',d.contact?.web||'',acc);
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 4: MAGAZINE BOLD — Imagen derecha, texto bold izquierda
// ═══════════════════════════════════════════════════════════════════
function engine_magazine(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#b91c1c';
  const splitX=Math.round(W*0.52);
  // LEFT: dark panel
  ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,splitX,H);
  // Accent left border
  ctx.fillStyle=acc; ctx.fillRect(0,0,14,H);
  // RIGHT: image
  ctx.save(); ctx.beginPath(); ctx.rect(splitX,0,W-splitX,H); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=(W-splitX)/H;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,splitX,0,W-splitX,H);
  } else {ctx.fillStyle='#334155';ctx.fillRect(splitX,0,W-splitX,H);}
  const rg=ctx.createLinearGradient(splitX,0,W,0); rg.addColorStop(0,'rgba(10,10,10,0.6)'); rg.addColorStop(0.4,'rgba(10,10,10,0)');
  ctx.fillStyle=rg; ctx.fillRect(splitX,0,W-splitX,H);
  ctx.restore();
  // LEFT CONTENT
  const M=28; const cW=splitX-M*2;
  if(d.logoImage) ctx.drawImage(d.logoImage,M+14,32,60,60);
  pxFont(ctx,'700 18px Outfit'); txt(ctx,(d.industria||'ARIAS GROUP').toUpperCase(),M+14,d.logoImage?106:52,'rgba(255,255,255,0.5)','left');
  ctx.fillStyle=acc; ctx.fillRect(M+14,d.logoImage?114:60,50,4);
  // BIG TITLE LEFT
  const titY=d.logoImage?150:110;
  const titEnd=drawMultilineTitleLeft(ctx,d.title||'Tu Oferta',M+14,titY,cW,118,'#fff','#fff',acc);
  pxFont(ctx,'500 30px Outfit'); shadow(ctx,'rgba(0,0,0,0.5)',10,3);
  txt(ctx,d.subtitle||'',M+14,titEnd+18,'rgba(255,255,255,0.8)','left'); noShadow(ctx);
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(M+14,titEnd+48,cW,1);
  // BENEFITS (single column)
  const icons=['✔','✔','✔','✔'];
  (d.beneficios||[]).slice(0,4).forEach((b: string,i: number)=>{
    ctx.save(); ctx.beginPath(); ctx.arc(M+30,titEnd+80+i*70,24,0,Math.PI*2);
    ctx.fillStyle=acc; ctx.fill(); pxFont(ctx,'900 18px Outfit'); txt(ctx,icons[i],M+30,titEnd+88+i*70,'#fff','center');
    pxFont(ctx,'700 28px Outfit'); txt(ctx,b.substring(0,24),M+66,titEnd+88+i*70,'rgba(255,255,255,0.9)','left'); ctx.restore();
  });
  const benBot=titEnd+80+(d.beneficios||[]).slice(0,4).length*70;
  if(d.price){ ctx.fillStyle=acc; ctx.fillRect(M+14,benBot+10,cW-M,4);
    pxFont(ctx,'900 70px Outfit'); shadow(ctx,'rgba(0,0,0,0.7)',16,5);
    txt(ctx,d.price,M+14,benBot+96,'#fff','left'); noShadow(ctx); }
  drawCTAButton(ctx,d.cta||'VER AHORA',M+14+Math.round(cW/2),Math.max(benBot+(d.price?120:20),H-240),cW,82,acc,'#fff');
  pxFont(ctx,'700 24px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',M+14,H-44,'rgba(255,255,255,0.7)','left');
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 5: GOLDEN DARK LUXURY — Fondo oscuro premium, detalles dorados
// ═══════════════════════════════════════════════════════════════════
function engine_circle(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#D4AF37';
  // DARK BG
  ctx.fillStyle='#070711'; ctx.fillRect(0,0,W,H);
  // Radial glow
  const rg=ctx.createRadialGradient(W*0.5,H*0.4,0,W*0.5,H*0.4,W*0.7);
  rg.addColorStop(0,acc+'20'); rg.addColorStop(1,'transparent'); ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
  // Image - centered oval frame
  const iw=Math.round(W*0.86),ih=Math.round(H*0.44),ix=(W-iw)/2,iy=Math.round(H*0.2);
  ctx.save();
  // Outer glow border
  ctx.shadowColor=acc; ctx.shadowBlur=28;
  ctx.strokeStyle=acc; ctx.lineWidth=5;
  roundRect(ctx,ix,iy,iw,ih,32); ctx.stroke();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0;
  roundRect(ctx,ix,iy,iw,ih,32); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=iw/ih;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,ix,iy,iw,ih);
  } else {ctx.fillStyle='#1e293b';ctx.fillRect(ix,iy,iw,ih);}
  const povg=ctx.createLinearGradient(ix,iy+ih*0.6,ix,iy+ih);
  povg.addColorStop(0,'rgba(7,7,17,0)'); povg.addColorStop(1,'rgba(7,7,17,0.9)');
  ctx.fillStyle=povg; ctx.fillRect(ix,iy,iw,ih);
  ctx.restore();
  // PRICE BADGE on top
  if(d.price) { const pw=340; drawPill(ctx,d.price,(W-pw)/2,iy-28,acc,'#000',40,28,18); }
  // TOP LOGO AREA
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,d.price?iy-36:iy-4);
  if(d.logoImage) ctx.drawImage(d.logoImage,40,20,60,60);
  pxFont(ctx,'800 20px Outfit'); txt(ctx,(d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?114:40,52,acc,'left');
  // TITLE + SUBTITLE (below frame)
  const botY=iy+ih+20;
  const titEnd=drawMultilineTitleCenter(ctx,d.title||'Tu Oferta',W/2,botY,W-80,108,'#fff',acc);
  ctx.fillStyle=acc; ctx.fillRect(W/2-80,titEnd+8,160,5);
  pxFont(ctx,'500 32px Outfit'); shadow(ctx,'rgba(0,0,0,0.6)',12,3);
  txt(ctx,d.subtitle||'',W/2,titEnd+52,'rgba(255,255,255,0.85)','center'); noShadow(ctx);
  // BENEFITS (horizontal pills)
  let bx2=60; const by2=titEnd+96;
  (d.beneficios||[]).slice(0,3).forEach((b: string)=>{
    drawPill(ctx,b.substring(0,18),bx2,by2,'rgba(255,255,255,0.08)','rgba(255,255,255,0.9)',24,16,10);
    bx2 += ctx.measureText(b.substring(0,18)).width+72;
  });
  drawCTAButton(ctx,d.cta||'CONTÁCTANOS',W/2,by2+78,580,88,acc,'#000');
  // BOTTOM
  ctx.fillStyle=acc; ctx.fillRect(0,H-80,W,80);
  pxFont(ctx,'900 30px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-38,'#000','center');
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 6: CORPORATE STRIPES — Limpio, barra color + imagen + texto
// ═══════════════════════════════════════════════════════════════════
function engine_stripes(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#1a56db';
  // Full white BG
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  // TOP header bar
  ctx.fillStyle=acc; ctx.fillRect(0,0,W,100);
  if(d.logoImage) ctx.drawImage(d.logoImage,30,18,64,64);
  pxFont(ctx,'900 26px Outfit'); txt(ctx,d.industria||'ARIAS GROUP',d.logoImage?108:36,56,'#fff','left');
  if(d.price) drawPill(ctx,d.price,W-280,18,acc==='#fff'?'#000':acc,'#fff',36,22,14);
  // IMAGE SECTION
  const imgY=100; const imgH=Math.round(H*0.48);
  ctx.save(); ctx.beginPath(); ctx.rect(0,imgY,W,imgH); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=W/imgH;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,0,imgY,W,imgH);
  } else {ctx.fillStyle='#e2e8f0'; ctx.fillRect(0,imgY,W,imgH);}
  // Bottom image fade to white
  const fgr=ctx.createLinearGradient(0,imgY+imgH*0.65,0,imgY+imgH);
  fgr.addColorStop(0,'rgba(255,255,255,0)'); fgr.addColorStop(1,'#fff');
  ctx.fillStyle=fgr; ctx.fillRect(0,imgY,W,imgH);
  ctx.restore();
  // ACCENT stripe
  ctx.fillStyle=acc; ctx.fillRect(0,imgY+imgH,W,10);
  // CONTENT (bottom area, white bg)
  const cY=imgY+imgH+22;
  const titEnd=drawMultilineTitleLeft(ctx,d.title||'Tu Oferta',60,cY,W-100,96,'#0f172a','#0f172a',acc);
  pxFont(ctx,'500 30px Outfit'); txt(ctx,d.subtitle||'',60,titEnd+14,'#475569','left');
  const benY2=drawBenefitRow(ctx,d.beneficios||[],60,titEnd+58,W-80,acc,true);
  drawCTAButton(ctx,d.cta||'CONTÁCTANOS',W/2,benY2+24,580,84,acc,'#fff');
  drawLogoBar(ctx,W,H-88,88,'#0f172a',null,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',d.contact?.web||'',acc);
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 7: DIAGONAL GEO BURST — Diagonal dramática, foto fondo
// ═══════════════════════════════════════════════════════════════════
function engine_cornerBurst(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#f59e0b';
  drawFullBleedBg(ctx,W,H,d.bgImage,[
    {pos:0,color:'rgba(0,0,0,0.55)'},{pos:0.4,color:'rgba(0,0,0,0.2)'},
    {pos:0.7,color:'rgba(0,0,0,0.6)'},{pos:1,color:'rgba(0,0,0,0.95)'}
  ]);
  // DIAGONAL overlay shape
  ctx.save(); ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(W*0.62,0); ctx.lineTo(W*0.38,H*0.5); ctx.lineTo(0,H*0.5); ctx.closePath();
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
  // ACCENT diagonal stripe
  ctx.save(); ctx.beginPath();
  ctx.moveTo(W*0.60,0); ctx.lineTo(W*0.65,0); ctx.lineTo(W*0.41,H*0.5); ctx.lineTo(W*0.36,H*0.5); ctx.closePath();
  ctx.fillStyle=acc; ctx.fill(); ctx.restore();
  // TOP LEFT CONTENT
  if(d.logoImage) ctx.drawImage(d.logoImage,40,30,64,64);
  pxFont(ctx,'800 18px Outfit'); txt(ctx,(d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?118:40,54,'rgba(255,255,255,0.7)','left');
  if(d.price) drawPill(ctx,d.price,40,d.logoImage?110:80,acc,'#000',36,22,14);
  const titY2=d.price?220:170;
  const titEnd2=drawMultilineTitleLeft(ctx,d.title||'Tu Oferta',40,titY2,W*0.55,114,'#fff','#fff',acc);
  pxFont(ctx,'500 32px Outfit'); shadow(ctx,'rgba(0,0,0,0.7)',10,3);
  txt(ctx,d.subtitle||'',40,titEnd2+16,'rgba(255,255,255,0.85)','left'); noShadow(ctx);
  // BOTTOM CONTENT
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,H*0.6,W,H*0.4);
  ctx.fillStyle=acc; ctx.fillRect(0,Math.round(H*0.6),W,8);
  const benY3=drawBenefitRow(ctx,d.beneficios||[],50,Math.round(H*0.62)+16,W-80,acc);
  drawCTAButton(ctx,d.cta||'CONTÁCTANOS',W/2,benY3+24,580,86,acc,'#000');
  pxFont(ctx,'700 26px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-40,'rgba(255,255,255,0.75)','center');
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 8: MINIMAL WHITE EDITORIAL — Clean & Sophisticated
// ═══════════════════════════════════════════════════════════════════
function engine_architectural(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#D4AF37';
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=acc; ctx.fillRect(0,0,W,16);
  // DOT PATTERN (decorative)
  ctx.fillStyle='#f1f5f9';
  for(let c=0;c<8;c++) for(let r=0;r<8;r++) { ctx.beginPath(); ctx.arc(W-120+c*16,24+r*16,3,0,Math.PI*2); ctx.fill(); }
  // TOP HEADER
  if(d.logoImage) ctx.drawImage(d.logoImage,48,28,60,60);
  pxFont(ctx,'700 16px Outfit'); txt(ctx,(d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?122:48,50,'#94a3b8','left');
  pxFont(ctx,'700 16px Outfit'); txt(ctx,acc.toUpperCase(),d.logoImage?122:48,70,acc,'left');
  // IMAGE in rounded frame
  const iY=110; const iH=Math.round(H*0.42); const iX=48; const iW=W-96;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.15)'; ctx.shadowBlur=30; ctx.shadowOffsetY=10;
  roundRect(ctx,iX,iY,iW,iH,24); ctx.fillStyle='#e2e8f0'; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx,iX,iY,iW,iH,24); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=iW/iH;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,iX,iY,iW,iH);
  } else {ctx.fillStyle='#94a3b8'; ctx.fillRect(iX,iY,iW,iH);}
  // Gradient over image bottom
  const ipg=ctx.createLinearGradient(iX,iY+iH*0.55,iX,iY+iH);
  ipg.addColorStop(0,'rgba(255,255,255,0)'); ipg.addColorStop(1,'rgba(255,255,255,0.5)');
  ctx.fillStyle=ipg; ctx.fillRect(iX,iY,iW,iH);
  if(d.price) drawPill(ctx,d.price,iX+16,iY+16,acc,'#fff',32,20,12);
  ctx.restore();
  // CONTENT BELOW IMAGE
  const cY=iY+iH+28;
  ctx.fillStyle=acc; ctx.fillRect(48,cY,80,6);
  const titEnd3=drawMultilineTitleLeft(ctx,d.title||'Tu Oferta',48,cY+24,W-96,96,'#0f172a','#0f172a',acc);
  pxFont(ctx,'500 28px Outfit'); txt(ctx,d.subtitle||'',48,titEnd3+14,'#64748b','left');
  const benY4=drawBenefitRow(ctx,d.beneficios||[],48,titEnd3+54,W-80,acc,true);
  drawCTAButton(ctx,d.cta||'CONTÁCTANOS',W/2,benY4+16,580,82,acc,'#fff');
  drawLogoBar(ctx,W,H-86,86,'#0f172a',d.logoImage,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',d.contact?.web||'',acc);
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 9: PHANTOM DARK PRESTIGE — Ultra dark luxury with glow
// ═══════════════════════════════════════════════════════════════════
function engine_luxuryDark(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#D4AF37';
  ctx.fillStyle='#050510'; ctx.fillRect(0,0,W,H);
  // Background glow
  const glow=ctx.createRadialGradient(W/2,H*0.45,0,W/2,H*0.45,W*0.65);
  glow.addColorStop(0,acc+'22'); glow.addColorStop(0.5,acc+'08'); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
  // TOP branding bar
  ctx.fillStyle=acc; ctx.fillRect(0,0,W,8);
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,8,W,92);
  if(d.logoImage) ctx.drawImage(d.logoImage,40,18,64,64);
  pxFont(ctx,'800 20px Outfit'); txt(ctx,(d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?118:40,48,acc,'left');
  pxFont(ctx,'600 16px Outfit'); txt(ctx,(d.contact?.web||'www.empresa.com').toUpperCase(),d.logoImage?118:40,68,'rgba(255,255,255,0.45)','left');
  // IMAGE FRAME — full width, elegant border
  const fY=108; const fH=Math.round(H*0.4); const fPad=40;
  ctx.save();
  ctx.shadowColor=acc; ctx.shadowBlur=24;
  ctx.strokeStyle=acc; ctx.lineWidth=4;
  roundRect(ctx,fPad,fY,W-fPad*2,fH,16); ctx.stroke();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0;
  roundRect(ctx,fPad,fY,W-fPad*2,fH,16); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=(W-fPad*2)/fH;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,fPad,fY,W-fPad*2,fH);
  } else {ctx.fillStyle='#1e293b';ctx.fillRect(fPad,fY,W-fPad*2,fH);}
  const fpg=ctx.createLinearGradient(0,fY+fH*0.5,0,fY+fH);
  fpg.addColorStop(0,'rgba(5,5,16,0)'); fpg.addColorStop(1,'rgba(5,5,16,0.92)');
  ctx.fillStyle=fpg; ctx.fillRect(fPad,fY,W-fPad*2,fH);
  ctx.restore();
  if(d.price){ const pw=340; drawPill(ctx,d.price,(W-pw)/2,fY+fH-76,acc,'#000',40,28,18); }
  // CONTENT BELOW
  const bBot=fY+fH+18;
  const titEnd4=drawMultilineTitleCenter(ctx,d.title||'Tu Oferta',W/2,bBot,W-80,104,'#fff',acc);
  ctx.fillStyle=acc; ctx.fillRect(W/2-60,titEnd4+8,120,4);
  pxFont(ctx,'400 32px Outfit'); shadow(ctx,'rgba(0,0,0,0.5)',10,3);
  txt(ctx,d.subtitle||'',W/2,titEnd4+50,'rgba(255,255,255,0.78)','center'); noShadow(ctx);
  // CARD BENEFITS
  (d.beneficios||[]).slice(0,3).forEach((b: string,i: number)=>{
    const cW2=W-120; const cX=(W-cW2)/2;
    roundRect(ctx,cX,titEnd4+80+i*72,cW2,58,12);
    ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
    ctx.strokeStyle=acc+'50'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cX+34,titEnd4+109+i*72,20,0,Math.PI*2);
    ctx.fillStyle=acc; ctx.fill(); pxFont(ctx,'900 16px Outfit'); txt(ctx,'★',cX+34,titEnd4+115+i*72,'#000','center');
    ctx.restore();
    pxFont(ctx,'700 26px Outfit'); txt(ctx,b.substring(0,32),cX+68,titEnd4+118+i*72,'rgba(255,255,255,0.9)','left');
  });
  const ctaY2=titEnd4+80+(d.beneficios||[]).slice(0,3).length*72+16;
  drawCTAButton(ctx,d.cta||'VER PROPIEDAD',W/2,ctaY2,580,88,acc,'#000');
  ctx.fillStyle=acc; ctx.fillRect(0,H-80,W,80);
  pxFont(ctx,'900 28px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-36,'#000','center');
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 10: GRADIENT POWER — Bold color gradient, modern energy
// ═══════════════════════════════════════════════════════════════════
function engine_boldGradient(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#6d28d9';
  // BOLD GRADIENT BG
  const bgGr=ctx.createLinearGradient(0,0,W,H);
  bgGr.addColorStop(0,'#0c1445'); bgGr.addColorStop(0.5,acc+'ee'); bgGr.addColorStop(1,'#0c1445');
  ctx.fillStyle=bgGr; ctx.fillRect(0,0,W,H);
  // TOP BAR
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,W,100);
  if(d.logoImage) ctx.drawImage(d.logoImage,40,18,64,64);
  pxFont(ctx,'800 20px Outfit'); txt(ctx,(d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?118:40,50,acc,'left');
  if(d.price) drawPill(ctx,d.price,W-300,16,acc,'#fff',38,24,16);
  // IMAGE in full-width rounded frame
  const iY=110; const iH=Math.round(H*0.40);
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=24; ctx.shadowOffsetY=8;
  roundRect(ctx,48,iY,W-96,iH,20); ctx.fillStyle='#1e293b'; ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  roundRect(ctx,48,iY,W-96,iH,20); ctx.clip();
  if(d.bgImage){
    const ir=d.bgImage.width/d.bgImage.height; const cr=(W-96)/iH;
    let sw=d.bgImage.width,sh=d.bgImage.height,sx=0,sy=0;
    if(ir>cr){sw=d.bgImage.height*cr;sx=(d.bgImage.width-sw)/2;}else{sh=d.bgImage.width/cr;sy=(d.bgImage.height-sh)/2;}
    ctx.drawImage(d.bgImage,sx,sy,sw,sh,48,iY,W-96,iH);
  } else {ctx.fillStyle='#1e40af'; ctx.fillRect(48,iY,W-96,iH);}
  const ipg2=ctx.createLinearGradient(0,iY+iH*0.55,0,iY+iH);
  ipg2.addColorStop(0,'rgba(12,20,69,0)'); ipg2.addColorStop(1,acc+'cc');
  ctx.fillStyle=ipg2; ctx.fillRect(48,iY,W-96,iH);
  ctx.restore();
  // CONTENT BELOW IMAGE
  const cY2=iY+iH+24;
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(48,cY2,W-96,2);
  const titEnd5=drawMultilineTitleCenter(ctx,d.title||'Tu Oferta',W/2,cY2+18,W-80,108,'#fff',acc);
  pxFont(ctx,'500 32px Outfit'); shadow(ctx,'rgba(0,0,0,0.6)',12,4);
  txt(ctx,d.subtitle||'',W/2,titEnd5+22,'rgba(255,255,255,0.85)','center'); noShadow(ctx);
  const benY5=drawBenefitRow(ctx,d.beneficios||[],60,titEnd5+68,W-80,acc);
  drawCTAButton(ctx,d.cta||'EMPIEZA HOY',W/2,benY5+24,580,88,'#fff',acc==='#6d28d9'?'#0c1445':acc);
  // BOTTOM
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,H-86,W,86);
  pxFont(ctx,'800 28px Outfit'); txt(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-46,'rgba(255,255,255,0.9)','center');
  pxFont(ctx,'600 20px Outfit'); txt(ctx,d.contact?.web||'',W/2,H-20,'rgba(255,255,255,0.4)','center');
}

// ─── MAPA DE ENGINES ─────────────────────────────────────────────────────────
const ENGINES: Record<string, (ctx: CanvasRenderingContext2D, W: number, H: number, d: any) => void> = {
  splitPanel: engine_splitPanel, fullOverlay: engine_fullOverlay, bottomBanner: engine_bottomBanner,
  magazine: engine_magazine, circle: engine_circle, stripes: engine_stripes,
  cornerBurst: engine_cornerBurst, architectural: engine_architectural,
  luxuryDark: engine_luxuryDark, boldGradient: engine_boldGradient,
};

// ─── 50 PRESETS ───────────────────────────────────────────────────────────────
export const LAYOUT_PRESETS = [
  { id: 'l1',  name: '1. Split Asimetrico (Agencia Marketing)', engine: 'splitPanel' },
  { id: 'l2',  name: '2. Full Overlay Cinematografico', engine: 'fullOverlay' },
  { id: 'l3',  name: '3. Bottom Banner Inmobiliario', engine: 'bottomBanner' },
  { id: 'l4',  name: '4. Magazine Editorial', engine: 'magazine' },
  { id: 'l5',  name: '5. Circulo Fotografico Boutique', engine: 'circle' },
  { id: 'l6',  name: '6. Franjas Corporativas', engine: 'stripes' },
  { id: 'l7',  name: '7. Corner Burst Angular', engine: 'cornerBurst' },
  { id: 'l8',  name: '8. Arquitectonico Minimalista', engine: 'architectural' },
  { id: 'l9',  name: '9. Luxury Dark Centrado', engine: 'luxuryDark' },
  { id: 'l10', name: '10. Bold Gradient Elipse', engine: 'boldGradient' },
  { id: 'l11', name: '11. Agency Pro Split', engine: 'splitPanel' },
  { id: 'l12', name: '12. Cine Negro Full Bleed', engine: 'fullOverlay' },
  { id: 'l13', name: '13. Sunset Strip Premium', engine: 'bottomBanner' },
  { id: 'l14', name: '14. Vogue Editorial Bold', engine: 'magazine' },
  { id: 'l15', name: '15. Circle Soho Luxury', engine: 'circle' },
  { id: 'l16', name: '16. Retail Stripes PRO', engine: 'stripes' },
  { id: 'l17', name: '17. Diagonal Impact Burst', engine: 'cornerBurst' },
  { id: 'l18', name: '18. Clean Arch Minimal', engine: 'architectural' },
  { id: 'l19', name: '19. Dark Gold Prestige', engine: 'luxuryDark' },
  { id: 'l20', name: '20. Gradient Oval Modern', engine: 'boldGradient' },
  { id: 'l21', name: '21. Pinterest Inmobiliario', engine: 'splitPanel' },
  { id: 'l22', name: '22. Hollywood Dark Overlay', engine: 'fullOverlay' },
  { id: 'l23', name: '23. Beachfront Banner', engine: 'bottomBanner' },
  { id: 'l24', name: '24. Harpers Editorial', engine: 'magazine' },
  { id: 'l25', name: '25. Oval Photographer', engine: 'circle' },
  { id: 'l26', name: '26. Brand Identity Stripes', engine: 'stripes' },
  { id: 'l27', name: '27. Trophy Corner Burst', engine: 'cornerBurst' },
  { id: 'l28', name: '28. Gallery White Minimal', engine: 'architectural' },
  { id: 'l29', name: '29. Oscuro Lujo Absoluto', engine: 'luxuryDark' },
  { id: 'l30', name: '30. Aurora Gradient Bloom', engine: 'boldGradient' },
  { id: 'l31', name: '31. Agency Bicolor Split', engine: 'splitPanel' },
  { id: 'l32', name: '32. Sky Overlay Soft', engine: 'fullOverlay' },
  { id: 'l33', name: '33. Metropolitan Strip', engine: 'bottomBanner' },
  { id: 'l34', name: '34. Forbes Cover Style', engine: 'magazine' },
  { id: 'l35', name: '35. Circular Prestige', engine: 'circle' },
  { id: 'l36', name: '36. Candy Stripes Pro', engine: 'stripes' },
  { id: 'l37', name: '37. Geo Angular Bold', engine: 'cornerBurst' },
  { id: 'l38', name: '38. Museum White Layout', engine: 'architectural' },
  { id: 'l39', name: '39. Obsidian Luxury Frame', engine: 'luxuryDark' },
  { id: 'l40', name: '40. Holographic Gradient', engine: 'boldGradient' },
  { id: 'l41', name: '41. Curator Split Panel', engine: 'splitPanel' },
  { id: 'l42', name: '42. Moodboard Dark', engine: 'fullOverlay' },
  { id: 'l43', name: '43. Promo Bottom Banner', engine: 'bottomBanner' },
  { id: 'l44', name: '44. Architect Magazine', engine: 'magazine' },
  { id: 'l45', name: '45. Round Frame Studio', engine: 'circle' },
  { id: 'l46', name: '46. Vertical Stripe Power', engine: 'stripes' },
  { id: 'l47', name: '47. Geo Corner Impact', engine: 'cornerBurst' },
  { id: 'l48', name: '48. Pure White Luxury', engine: 'architectural' },
  { id: 'l49', name: '49. Phantom Dark Mode', engine: 'luxuryDark' },
  { id: 'l50', name: '50. Premium Gradient PRO', engine: 'boldGradient' },
];

// ─── DISPATCHER ───────────────────────────────────────────────────────────────
function renderAriasSignature(ctx: CanvasRenderingContext2D, W: number, H: number, data: any) {
  injectFonts();
  const preset = LAYOUT_PRESETS.find((p: any) => p.id === data.layout) || LAYOUT_PRESETS[0];
  const engineFn = ENGINES[(preset as any).engine] || engine_splitPanel;
  engineFn(ctx, W, H, data);
}

let profile_phone = '';

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
   ───────────────────────────────────────────────────────────────────────────── */

export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estados Base
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingFlyer, setIsGeneratingFlyer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Formulario Paso 1
  const [industrias, setIndustries] = useState<string[]>(INDUSTRIES_FALLBACK);
  const [selectedIndustrias, setSelectedIndustrias] = useState<string[]>([]);
  const [customIndustria, setCustomIndustria] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [oferta, setOferta] = useState('');
  const [tono, setTono] = useState('premium');

  // Datos del Flyer (Step 2 & 3)
  const [ideas, setIdeas] = useState<FlyerIdea[]>([]);
  const [flyerTitle, setFlyerTitle] = useState('');
  const [flyerSubtitle, setFlyerSubtitle] = useState('');
  const [flyerCta, setFlyerCta] = useState('');
  const [flyerBeneficios, setFlyerBeneficios] = useState<string[]>([]);
  const [flyerAccent, setFlyerAccent] = useState('#D4AF37');
  const [layoutStyle, setLayoutStyle] = useState<string>(LAYOUT_PRESETS[0].id);
  const [flyerImageUrl, setFlyerImageUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Datos de Contacto Directos
  const [contactPhone, setContactPhone] = useState('');
  const [contactWeb, setContactWeb] = useState('');

  const selectedIndustry = useCustom ? customIndustria : selectedIndustrias.join(', ');

  // SINCRIZACIÓN INSTANTÁNEA (WYSIWYG)
  const doRender = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const finalizeDraw = (bgImg: HTMLImageElement | null, lImg: HTMLImageElement | null) => {
      renderAriasSignature(ctx, CANVAS_W, CANVAS_H, {
        layout: layoutStyle,
        title: flyerTitle,
        subtitle: flyerSubtitle,
        cta: flyerCta,
        accent: flyerAccent,
        beneficios: flyerBeneficios,
        bgImage: bgImg,
        logoImage: lImg,
        contact: { whatsapp: contactPhone, web: contactWeb }
      });
    };

    const loadLogo = (bg: HTMLImageElement | null) => {
      if (logoUrl) {
        const li = new Image(); li.crossOrigin = 'anonymous';
        li.onload = () => finalizeDraw(bg, li);
        li.onerror = () => finalizeDraw(bg, null);
        li.src = logoUrl;
      } else finalizeDraw(bg, null);
    };

    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => loadLogo(img);
    img.onerror = () => {
      const fb = new Image(); fb.crossOrigin = 'anonymous';
      fb.onload = () => loadLogo(fb);
      fb.src = LUXURY_FALLBACK;
    };
    img.src = flyerImageUrl || LUXURY_FALLBACK;

  }, [flyerImageUrl, flyerTitle, flyerSubtitle, flyerCta, flyerAccent, flyerBeneficios, layoutStyle, logoUrl, contactPhone, contactWeb]);

  useEffect(() => {
    if (step === 3) doRender();
  }, [doRender, step, flyerTitle, flyerSubtitle, flyerCta, flyerAccent, flyerBeneficios, layoutStyle]);

  // ––– FUNCIONES DE LÓGICA –––
  
  useEffect(() => {
    (async () => {
      // 1. Fetch industries from CRM for dynamic pills
      const { data: leadData } = await supabase.from('leads').select('industry').limit(100);
      const fromCRM = (leadData || []).map(l => l.industry).filter(Boolean) as string[];
      const merged = Array.from(new Set([...INDUSTRIES_FALLBACK, ...fromCRM])).sort();
      setIndustries(merged.slice(0, 20));

      // 2. Fetch company contact defaults
      const { data: comp } = await supabase.from('companies').select('logo_url, phone, website').eq('id', profile?.company_id || '').single();
      if (comp) {
        setLogoUrl(comp.logo_url);
        setContactPhone(comp.phone || '');
        setContactWeb(comp.website || '');
        profile_phone = comp.phone || '';
      }
    })();
  }, [profile?.company_id]);

  const handleGenerateIdeas = async () => {
    if (!selectedIndustry || !oferta) return toast.error('Completa los campos');
    setIsGenerating(true);
    try {
      const result = await flyerService.recommendIdeas({ industria: selectedIndustry, oferta, tono, companyId: profile?.company_id || '', idioma: 'es' });
      setIdeas(result);
      setStep(2);
    } catch {
      // PREMIUM FALLBACK (Totalmente en Español)
      setIdeas([
        { titulo: "ESTILO DE VIDA ÚNICO", gancho: "Vive el lujo en la mejor ubicación", beneficios: [], cta: "VER TOUR", paleta: [], tono: 'premium' },
        { titulo: "TU NUEVA MANSIÓN", gancho: "El confort que tu familia merece", beneficios: [], cta: "MÁS INFO", paleta: [], tono: 'moderno' },
        { titulo: "INVERSIÓN SEGURA", gancho: "Plusvalía garantizada hoy mismo", beneficios: [], cta: "PEDIR LISTA", paleta: [], tono: 'corporativo' }
      ]);
      setStep(2);
    } finally { setIsGenerating(false); }
  };

  const handleSelectIdea = async (idea: any) => {
    setFlyerTitle(idea.titulo || '');
    setFlyerSubtitle(idea.gancho || '');
    setFlyerCta(idea.cta || 'CONTÁCTANOS');
    setFlyerBeneficios(idea.beneficios || []);
    setFlyerImageUrl(null);
    setStep(3);

    setIsGeneratingFlyer(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flyer-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({
          idea,
          industria: selectedIndustry,
          oferta,
          tono,
        }),
      });
      const d = await res.json();
      if (d.fondo_url) {
        setFlyerImageUrl(d.fondo_url);
      } else {
        toast.error('Motor IA Ocupado. Diseño Estructural Renderizado (Modo Nativo).');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Respuesta Rápida ⚡. Modo Estructural (Sin IA fotográfica).');
    } finally { setIsGeneratingFlyer(false); }
  };

  const handleSaveToCRM = async () => {
    if (!canvasRef.current || !flyerImageUrl) return;
    setIsSaving(true);
    try {
      const blob = await new Promise<Blob>((res) => canvasRef.current!.toBlob(b => res(b!), 'image/png'));
      const url = await flyerService.uploadFlyer(blob, profile?.company_id || 'shared');
      await flyerService.saveFlyer({ company_id: profile!.company_id!, image_url: url, prompt_used: flyerSubtitle, titulo: flyerTitle, status: 'ready' });
      toast.success('¡Guardado en Galería!');
    } catch { toast.error('Error al guardar'); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ height: 'calc(100vh - 132px)', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* HEADER COMPACTO */}
      <header style={{ height: 60, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/marketing')} style={{ borderRadius: 10, background: '#f1f5f9', border: 'none', padding: 8, cursor: 'pointer' }}>
             <ArrowLeft size={20} color="#64748b" />
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>ARIAS FLYER STUDIO</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Motor de Marketing IA</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
           {[1, 2, 3].map(s => <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: step === s ? 1 : 0.4 }}>
             <div style={{ width: 24, height: 24, borderRadius: 6, background: step >= s ? '#D4AF37' : '#e2e8f0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{s}</div>
             <span style={{ fontSize: 11, fontWeight: 800 }}>{s === 1 ? 'DATOS' : s === 2 ? 'DISEÑO' : 'ESTUDIO'}</span>
           </div>)}
        </div>

        <div style={{ width: 140 }}>
           {step === 3 && <button onClick={() => {
             const link = document.createElement('a'); link.download = 'flyer-premium.png'; link.href = canvasRef.current!.toDataURL('image/png'); link.click();
           }} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
             <Download size={14} /> EXPORTAR
           </button>}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
        
        {step === 1 && (
          <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Configuración</h2>
              <textarea value={oferta} onChange={e => setOferta(e.target.value)} placeholder="Ej: Vendo penthouse de lujo con 3 recámaras en la playa..." style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, fontSize: 14, fontWeight: 500, resize: 'none', outline: 'none' }} />
              <button onClick={handleGenerateIdeas} disabled={isGenerating} style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, padding: 14, fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                {isGenerating ? 'GENERANDO...' : 'RECOMENDAR IDEAS'}
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
               <label style={{ fontSize: 11, fontWeight: 900, color: '#D4AF37' }}>RUBRO / INDUSTRIA</label>
               {!useCustom ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   {/* Dropdown con diseño de Pill (Chip selectivo) */}
                   <div style={{ position: 'relative' }}>
                     <select
                       value={selectedIndustrias[0] || ''}
                       onChange={(e) => {
                         const val = e.target.value;
                         if (val) setSelectedIndustrias([val]);
                       }}
                       style={{
                         padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                         background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a',
                         appearance: 'auto', outline: 'none', cursor: 'pointer', width: '100%'
                       }}
                     >
                       <option value="" disabled>Selecciona un rubro...</option>
                       {industrias.map(ind => (
                         <option key={ind} value={ind}>{ind}</option>
                       ))}
                     </select>
                   </div>
                   
                   {/* Mostramos el seleccionado como Pill elegante */}
                   {selectedIndustrias.length > 0 && (
                     <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selectedIndustrias.map(si => (
                          <div key={si} style={{ background: '#D4AF37', color: '#000', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, display: 'inline-block' }}>
                            ✓ {si}
                          </div>
                        ))}
                     </div>
                   )}
                   
                   <button onClick={() => setUseCustom(true)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
                     + O ingresarlo Manualmente
                   </button>
                 </div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                   <input
                     value={customIndustria}
                     onChange={(e) => setCustomIndustria(e.target.value)}
                     placeholder="Ej: Inmobiliaria, Odontología..."
                     style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }}
                   />
                   <button onClick={() => setUseCustom(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
                     ← Volver a opciones
                   </button>
                 </div>
               )}
               <label style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8' }}>TONO DE MARCA</label>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                 {TONES.map(t => <button key={t.key} onClick={() => setTono(t.key)} style={{ padding: 12, borderRadius: 10, border: `1.5px solid ${tono === t.key ? '#D4AF37' : '#e2e8f0'}`, background: tono === t.key ? '#fffbeb' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                   <t.icon size={18} color={tono === t.key ? '#D4AF37' : '#94a3b8'} />
                   <span style={{ fontSize: 8, fontWeight: 900 }}>{t.label}</span>
                 </button>)}
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Elige tu Concepto Publicitario Premium</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, flex: 1, paddingBottom: 20, overflowY: 'auto' }}>
              {ideas.map((id, idx) => (
                <button key={idx} onClick={() => handleSelectIdea(id)} style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: 16, border: '1px solid rgba(212, 175, 55, 0.3)', padding: 24, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 0.2s', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)' }}>
                   <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{id.titulo}</div>
                   <div style={{ fontSize: 13, color: '#94a3b8' }}>{id.gancho}</div>
                   
                   <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                     {id.beneficios?.slice(0, 3).map((b, i) => (
                       <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#e2e8f0', fontSize: 12 }}>
                          <span style={{ color: '#D4AF37', fontWeight: 900 }}>✓</span> <span>{b}</span>
                       </div>
                     ))}
                   </div>
                   <div style={{ background: '#D4AF37', color: '#000', padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 900, textAlign: 'center', marginTop: 'auto', width: '100%' }}>PULSAR PARA DISEÑAR</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ height: '100%', display: 'flex', gap: 12 }}>
            <div style={{ width: 340, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>Personalización Real</h3>
              <input value={flyerTitle} onChange={e => setFlyerTitle(e.target.value)} placeholder="Título" style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
              <textarea value={flyerSubtitle} onChange={e => setFlyerSubtitle(e.target.value)} placeholder="Gancho Comercial" style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, minHeight: 80 }} />
              <input value={flyerCta} onChange={e => setFlyerCta(e.target.value)} placeholder="Llamada a acción" style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
              
              <label style={{ fontSize: 10, fontWeight: 900, color: '#D4AF37' }}>ESTILO DEL FLYER ({LAYOUT_PRESETS.length} PRESETS)</label>
              <select 
                value={layoutStyle} 
                onChange={e => setLayoutStyle(e.target.value)}
                style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 800, outline: 'none', cursor: 'pointer' }}
              >
                {LAYOUT_PRESETS.map(lp => (
                  <option key={lp.id} value={lp.id}>{lp.name}</option>
                ))}
              </select>

              <label style={{ fontSize: 10, fontWeight: 900, color: '#D4AF37', marginTop: 10 }}>PUNTOS DESTACADOS (EXTRAÍDOS POR IA)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flyerBeneficios.map((ben, i) => (
                  <input 
                    key={i} value={ben} 
                    onChange={e => {
                      const newB = [...flyerBeneficios];
                      newB[i] = e.target.value;
                      setFlyerBeneficios(newB);
                    }}
                    style={{ padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} 
                  />
                ))}
              </div>

              <label style={{ fontSize: 10, fontWeight: 900, color: '#D4AF37', marginTop: 10 }}>COLOR DE MARCA</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Native Color Picker Oculto envolviendo un Label */}
                <label style={{ width: 36, height: 36, borderRadius: '50%', background: 'conic-gradient(red, yellow, green, cyan, blue, magenta, red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a', overflow: 'hidden' }}>
                  <input type="color" value={flyerAccent} onChange={e => setFlyerAccent(e.target.value)} style={{ opacity: 0, width: 0, height: 0 }} />
                </label>
                
                {ACCENT_COLORS.map(c => <button key={c} onClick={() => setFlyerAccent(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: flyerAccent === c ? '3px solid #000' : '1px solid #e2e8f0', cursor: 'pointer' }} />)}
              </div>

              <div style={{ flex: 1 }} />
              <button onClick={handleSaveToCRM} disabled={isSaving || !flyerImageUrl} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                {isSaving ? 'GUARDANDO...' : 'GUARDAR EN GALERÍA'}
              </button>
            </div>

            <div style={{ flex: 1, background: '#0a0a0a', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {isGeneratingFlyer && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 20, backdropFilter: 'blur(8px)' }}>
                   <Loader2 size={40} className="animate-spin" />
                   <p style={{ marginTop: 12, fontWeight: 800 }}>GENERANDO ARTE CON IA...</p>
                </div>
              )}
              <div style={{ height: '94%', aspectRatio: '4/5' }}>
                <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ width: '100%', height: '100%', borderRadius: 12, boxShadow: '0 30px 90px rgba(0,0,0,0.8)' }} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
