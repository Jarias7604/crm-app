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

// ═══════════════════════════════════════════════════════════════════════════════
// PINTEREST-GRADE CANVAS ENGINE SYSTEM — 2026 PREMIUM
// Philosophy: Typography-first, Bold Color Blocks, Gradient Buttons, Cover Photos
// Reference: Top-performing social media ads (Canva Pro / Agency level)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── FOUNDATION HELPERS ───────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2*r) r = w/2; if (h < 2*r) r = h/2;
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const words = text.split(' '); const lines: string[] = []; let curr = words[0]||'';
  for (let i=1;i<words.length;i++) {
    const test = curr+' '+words[i];
    if (ctx.measureText(test).width<maxWidth) curr=test; else { lines.push(curr); curr=words[i]; }
  }
  lines.push(curr); return lines;
}

// Cover-crop: fills target area maintaining image aspect ratio (like CSS object-fit:cover)
function coverCrop(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const ir=img.width/img.height; const cr=dw/dh;
  let sw=img.width,sh=img.height,sx=0,sy=0;
  if (ir>cr) { sw=img.height*cr; sx=(img.width-sw)/2; } else { sh=img.width/cr; sy=(img.height-sh)/2; }
  ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
}

// Premium gradient-filled rounded button (like top ad flyers)
function drawGradBtn(ctx: CanvasRenderingContext2D, label: string, cx: number, y: number, w: number, h: number, c1: string, c2: string, textColor='#fff') {
  ctx.save();
  // Drop shadow
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=18; ctx.shadowOffsetY=6;
  // Gradient fill
  const gr=ctx.createLinearGradient(cx-w/2,y,cx+w/2,y+h);
  gr.addColorStop(0,c1); gr.addColorStop(1,c2);
  roundRect(ctx,cx-w/2,y,w,h,h/2); ctx.fillStyle=gr; ctx.fill();
  // Top shine
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  const shine=ctx.createLinearGradient(cx-w/2,y,cx-w/2,y+h*0.45);
  shine.addColorStop(0,'rgba(255,255,255,0.28)'); shine.addColorStop(1,'rgba(255,255,255,0)');
  roundRect(ctx,cx-w/2,y,w,h*0.5,h/2); ctx.fillStyle=shine; ctx.fill();
  // Label
  ctx.font=`900 ${Math.round(h*0.38)}px Outfit`; ctx.fillStyle=textColor; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label.toUpperCase(),cx,y+h*0.52); ctx.textBaseline='alphabetic';
  ctx.restore();
}

// Solid color block background (more impactful than gradient overlays)
function fillBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle=color; ctx.fillRect(x,y,w,h);
}

// Linear gradient block fill
function fillGradBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string, angle: 'v'|'h'|'d'='v') {
  let gr: CanvasGradient;
  if (angle==='h') gr=ctx.createLinearGradient(x,y,x+w,y);
  else if (angle==='d') gr=ctx.createLinearGradient(x,y,x+w,y+h);
  else gr=ctx.createLinearGradient(x,y,x,y+h);
  gr.addColorStop(0,c1); gr.addColorStop(1,c2); ctx.fillStyle=gr; ctx.fillRect(x,y,w,h);
}

// Massive typography with letter-spacing effect (dominant text)
function drawHeroWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign='left') {
  ctx.save();
  ctx.font=`900 ${size}px Outfit`; ctx.fillStyle=color; ctx.textAlign=align;
  // Bold shadow for depth
  ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=20; ctx.shadowOffsetY=8;
  ctx.fillText(word,x,y);
  ctx.restore();
}

// Accent underline / bar for section separation
function drawAccentBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string) {
  const gr=ctx.createLinearGradient(x,y,x+w,y); gr.addColorStop(0,c1); gr.addColorStop(1,c2);
  ctx.fillStyle=gr; ctx.fillRect(x,y,w,h);
}

// Logo badge (top-left branding)
function drawBrandBadge(ctx: CanvasRenderingContext2D, logo: HTMLImageElement|null, name: string, x: number, y: number, textColor: string, acc: string) {
  ctx.save();
  if (logo) { ctx.drawImage(logo,x,y-22,44,44); x+=52; }
  ctx.font='800 20px Outfit'; ctx.fillStyle=textColor; ctx.textAlign='left'; ctx.fillText(name,x,y+6);
  ctx.font='600 14px Outfit'; ctx.fillStyle=acc; ctx.fillText('★ PREMIUM',x,y+24);
  ctx.restore();
}

// Checkmark benefit row (clean, modern)
function drawCheckBenefit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, checkColor: string, textColor: string, size=26) {
  ctx.save();
  // Check circle
  ctx.beginPath(); ctx.arc(x+size*0.5,y,size*0.5,0,Math.PI*2); ctx.fillStyle=checkColor; ctx.fill();
  ctx.font=`900 ${Math.round(size*0.6)}px Outfit`; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText('✓',x+size*0.5,y+size*0.22);
  // Text
  ctx.font=`700 ${size}px Outfit`; ctx.fillStyle=textColor; ctx.textAlign='left';
  ctx.fillText(text.substring(0,28),x+size*1.3,y+size*0.35);
  ctx.restore();
}

// Photo block with clip region
function drawPhotoBlock(ctx: CanvasRenderingContext2D, img: HTMLImageElement|null, x: number, y: number, w: number, h: number, r=0, fallback='#334155') {
  ctx.save();
  if (r>0) { roundRect(ctx,x,y,w,h,r); ctx.clip(); }
  if (img) { coverCrop(ctx,img,x,y,w,h); } else { ctx.fillStyle=fallback; ctx.fillRect(x,y,w,h); }
  ctx.restore();
}

// Promo badge (like "40% OFF", "LIMITED TIME")
function drawPromoBadge(ctx: CanvasRenderingContext2D, line1: string, line2: string, cx: number, cy: number, size: number, bg: string, fg: string) {
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=16; ctx.shadowOffsetY=6;
  ctx.beginPath(); ctx.arc(cx,cy,size,0,Math.PI*2); ctx.fillStyle=bg; ctx.fill();
  ctx.shadowColor='transparent';
  ctx.font=`900 ${Math.round(size*0.7)}px Outfit`; ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(line1,cx,cy-size*0.15);
  ctx.font=`600 ${Math.round(size*0.28)}px Outfit`; ctx.fillText(line2,cx,cy+size*0.45);
  ctx.textBaseline='alphabetic';
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 1: BOLD SPLIT — Color block left, photo right (like "RISE WITH LOGISTICS")
// ═══════════════════════════════════════════════════════════════════
function engine_splitPanel(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#1a56db';
  const SPLIT=Math.round(W*0.52);

  // LEFT: bold gradient color block
  fillGradBlock(ctx,0,0,SPLIT,H,acc,shiftColor(acc,-30),'v');

  // RIGHT: photo
  drawPhotoBlock(ctx,d.bgImage,SPLIT,0,W-SPLIT,H,0,'#0f172a');
  // Gradient bleed from left into photo
  const bleed=ctx.createLinearGradient(SPLIT,0,SPLIT+(W-SPLIT)*0.45,0);
  bleed.addColorStop(0,acc+'ee'); bleed.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=bleed; ctx.fillRect(SPLIT,0,W-SPLIT,H);

  // TOP BRANDING
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',36,46,'#fff','rgba(255,255,255,0.6)');

  // HERO WORDS — stacked massive text
  const words = (d.title||'Tu Oferta').toUpperCase().split(' ');
  const lineH = 130; const startY = Math.round(H*0.28);
  words.slice(0,4).forEach((w,i) => {
    const sz = i===0?148:i===1?136:114;
    ctx.save(); ctx.font=`900 ${sz}px Outfit`;
    ctx.fillStyle = i%2===0 ? '#fff' : 'rgba(255,255,255,0.75)';
    ctx.textAlign='left';
    ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=18; ctx.shadowOffsetY=6;
    ctx.fillText(w,36,startY+i*lineH);
    ctx.restore();
  });

  // SUBTITLE under title
  const subY = startY + Math.min(words.length,4)*lineH + 8;
  ctx.save(); ctx.font='500 32px Outfit'; ctx.fillStyle='rgba(255,255,255,0.82)'; ctx.textAlign='left';
  const subs = wrapText(ctx,d.subtitle||'',SPLIT-60);
  subs.slice(0,2).forEach((s,i)=>ctx.fillText(s,36,subY+i*40));
  ctx.restore();

  // BENEFITS
  const benStart = subY + subs.slice(0,2).length*40 + 28;
  (d.beneficios||[]).slice(0,3).forEach((b: string,i: number) =>
    drawCheckBenefit(ctx,b,36,benStart+i*58,'rgba(255,255,255,0.25)','#fff',28)
  );

  // CTA BUTTON
  const ctaY = Math.max(benStart+(d.beneficios||[]).slice(0,3).length*58+28, H-220);
  drawGradBtn(ctx,d.cta||'CONTACTAR AHORA',SPLIT/2,ctaY,SPLIT-64,80,'#fff',`rgba(255,255,255,0.75)`,acc);

  // CONTACT BAR
  fillBlock(ctx,0,H-76,W,76,'rgba(0,0,0,0.45)');
  ctx.save(); ctx.font='800 28px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-40); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 2: FULL PROMO — Photo background, bold promo text (like "40% OFF Sitewide")
// ═══════════════════════════════════════════════════════════════════
function engine_fullOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#f59e0b';

  // FULL BLEED PHOTO
  drawPhotoBlock(ctx,d.bgImage,0,0,W,H);
  // TOP 40% overlay for text legibility (lighter — shows photo more)
  fillGradBlock(ctx,0,0,W,H*0.55,'rgba(0,0,0,0.78)','rgba(0,0,0,0)','v');
  // BOTTOM overlay for CTA area
  fillGradBlock(ctx,0,H*0.6,W,H*0.4,'rgba(0,0,0,0)','rgba(0,0,0,0.94)','v');

  // ACCENT top stripe + branding
  fillBlock(ctx,0,0,W,8,acc);
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',36,44,'#fff',acc);

  // PROMO BADGE (if price)
  if (d.price) {
    drawPromoBadge(ctx,d.price,'OFERTA ESPECIAL',W-100,80,72,acc,'#000');
  }

  // HUGE CENTERED TITLE
  ctx.save(); ctx.textAlign='center';
  const titleWords = (d.title||'TU OFERTA').toUpperCase().split(' ');
  const bigSz = titleWords.length<=2?180:titleWords.length<=3?148:128;
  titleWords.slice(0,3).forEach((w,i) => {
    ctx.font=`900 ${i===0?bigSz:Math.round(bigSz*0.82)}px Outfit`;
    ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=28; ctx.shadowOffsetY=10;
    ctx.fillStyle = i===1 ? acc : '#fff';
    ctx.fillText(w, W/2, H*0.28+i*(Math.round(bigSz*0.9)+14));
  });
  ctx.restore();

  // SUBTITLE (italic, refined)
  const subY = H*0.28 + titleWords.slice(0,3).length*(Math.round(bigSz*0.9)+14) + 16;
  ctx.save(); ctx.font='italic 500 34px Outfit'; ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.textAlign='center';
  ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=12;
  ctx.fillText(d.subtitle||'',W/2,subY); ctx.restore();

  // BENEFIT PILLS (horizontal row)
  const bens=(d.beneficios||[]).slice(0,3); const pillY=Math.max(subY+52,H*0.68);
  let pillX=56;
  bens.forEach((b: string) => {
    ctx.save(); ctx.font='700 26px Outfit';
    const tw=ctx.measureText(b.substring(0,20)).width+48; const ph=52;
    roundRect(ctx,pillX,pillY,tw,ph,ph/2); ctx.fillStyle=acc+'33';
    ctx.strokeStyle=acc; ctx.lineWidth=2.5; ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(b.substring(0,20),pillX+24,pillY+36);
    pillX+=tw+14; ctx.restore();
  });

  // GRADIENT CTA BUTTON
  const ctaY=Math.max(pillY+76,H-172);
  drawGradBtn(ctx,d.cta||'VER OFERTA',W/2,ctaY,W-100,86,acc,shiftColor(acc,-30),'#000');

  // PHONE BAR
  fillBlock(ctx,0,H-78,W,78,acc);
  ctx.save(); ctx.font='900 30px Outfit'; ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-36); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 3: WHITE CARD PRO — Clean white bg, photo top, info bottom (like "IMS UNISON")
// ═══════════════════════════════════════════════════════════════════
function engine_bottomBanner(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#3b82f6';

  // WHITE base
  ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);

  // TOP PHOTO (56% of height)
  const imgH=Math.round(H*0.56);
  drawPhotoBlock(ctx,d.bgImage,0,0,W,imgH);
  // Subtle overlay bottom of photo
  fillGradBlock(ctx,0,imgH*0.6,W,imgH*0.4,'rgba(248,250,252,0)','#f8fafc','v');

  // ACCENT bar separator
  fillGradBlock(ctx,0,imgH,W,10,acc,shiftColor(acc,30),'h');

  // TOP badge
  fillBlock(ctx,0,0,W,72,'rgba(0,0,0,0.38)');
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',32,42,'#fff','rgba(255,255,255,0.55)');
  if(d.price) drawGradBtn(ctx,d.price,W-120,10,200,52,acc,shiftColor(acc,-20),'#fff');

  // INFO SECTION
  const infoY=imgH+18;
  // Category tag
  ctx.save(); ctx.font='700 20px Outfit';
  const tagW=ctx.measureText((d.industria||'MARKETING').toUpperCase()).width+32;
  roundRect(ctx,40,infoY,tagW,40,20); ctx.fillStyle=acc; ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText((d.industria||'MARKETING').toUpperCase(),56,infoY+28); ctx.restore();

  // MASSIVE TITLE (dark, left aligned)
  ctx.save(); ctx.textAlign='left';
  const titleLines = wrapText(ctx,(d.title||'Tu Oferta').toUpperCase(),W-80);
  ctx.font=`900 ${titleLines.length<=2?100:82}px Outfit`;
  // Measure once
  titleLines.forEach(l => { const m=ctx.measureText(l); return m; });
  let ty=infoY+62;
  titleLines.slice(0,2).forEach((l,i)=>{
    ctx.font=`900 ${i===0?100:82}px Outfit`;
    ctx.shadowColor='rgba(0,0,0,0.12)'; ctx.shadowBlur=8; ctx.shadowOffsetY=4;
    ctx.fillStyle = i===0 ? '#0f172a' : acc;
    ctx.fillText(l,40,ty); ty+=i===0?108:92;
  });
  ctx.restore();

  // SUBTITLE
  ctx.save(); ctx.font='500 30px Outfit'; ctx.fillStyle='#475569'; ctx.textAlign='left';
  const subs=wrapText(ctx,d.subtitle||'',W-80); subs.slice(0,2).forEach((s,i)=>ctx.fillText(s,40,ty+i*38)); ctx.restore();
  ty+=subs.slice(0,2).length*38+18;

  // BENEFITS (2-column check list)
  const bens=(d.beneficios||[]).slice(0,4);
  bens.forEach((b: string,i: number)=>{
    const col=i%2; const row=Math.floor(i/2);
    drawCheckBenefit(ctx,b,40+col*(W/2-40),ty+row*60,acc,'#1e293b',26);
  });
  ty+=Math.ceil(bens.length/2)*62+20;

  // CTA
  drawGradBtn(ctx,d.cta||'CONTÁCTANOS',W/2,ty,W-80,80,acc,shiftColor(acc,-25),'#fff');

  // BOTTOM BAR
  fillBlock(ctx,0,H-72,W,72,'#0f172a');
  ctx.save(); ctx.font='800 26px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-34); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 4: VERTICAL SPLIT MAGAZINE — Dark left text, full photo right (Forbes style)
// ═══════════════════════════════════════════════════════════════════
function engine_magazine(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#ef4444';
  const SPLIT=Math.round(W*0.48);

  // LEFT: DARK solid panel
  ctx.fillStyle='#070711'; ctx.fillRect(0,0,SPLIT,H);
  // Accent left edge bar
  fillGradBlock(ctx,0,0,12,H,acc,shiftColor(acc,30),'v');

  // RIGHT: Full photo
  drawPhotoBlock(ctx,d.bgImage,SPLIT,0,W-SPLIT,H);
  // Gradient bleed into photo from left
  const bleed=ctx.createLinearGradient(SPLIT,0,SPLIT+(W-SPLIT)*0.42,0);
  bleed.addColorStop(0,'#070711'); bleed.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=bleed; ctx.fillRect(SPLIT,0,W-SPLIT,H);

  // LOGO + BRANDING
  if(d.logoImage) ctx.drawImage(d.logoImage,24,24,52,52);
  ctx.save(); ctx.font='700 17px Outfit'; ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.textAlign='left';
  ctx.fillText((d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?84:24,44);
  ctx.restore();
  drawAccentBar(ctx,24,72,SPLIT-48,4,acc,'transparent');

  // VERTICAL category text (editorial)
  ctx.save(); ctx.save(); ctx.translate(22,H*0.5); ctx.rotate(-Math.PI/2);
  ctx.font='700 18px Outfit'; ctx.fillStyle=acc; ctx.textAlign='center';
  ctx.fillText((d.industria||'MARKETING').toUpperCase(),0,0); ctx.restore(); ctx.restore();

  // MASSIVE STACKED TITLE
  const words=(d.title||'TU TITULO').toUpperCase().split(' ');
  let titleY=Math.round(H*0.2);
  words.slice(0,4).forEach((w,i)=>{
    const sz=i===0?154:i===1?142:112;
    ctx.save(); ctx.font=`900 ${sz}px Outfit`; ctx.fillStyle=i===1?acc:'#fff'; ctx.textAlign='left';
    ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=22; ctx.shadowOffsetY=8;
    ctx.fillText(w,20,titleY); titleY+=sz+8; ctx.restore();
  });

  // DIVIDER
  drawAccentBar(ctx,20,titleY+8,SPLIT-40,5,acc,'transparent'); titleY+=28;

  // SUBTITLE
  ctx.save(); ctx.font='500 28px Outfit'; ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.textAlign='left';
  const subs=wrapText(ctx,d.subtitle||'',SPLIT-40); subs.slice(0,2).forEach((s,i)=>ctx.fillText(s,20,titleY+10+i*36)); ctx.restore();
  titleY += subs.slice(0,2).length*36+24;

  // BENEFITS (single col)
  (d.beneficios||[]).slice(0,4).forEach((b: string,i: number)=>{
    drawCheckBenefit(ctx,b,20,titleY+i*58,acc,'rgba(255,255,255,0.9)',24);
  });
  const b4Y=titleY+(d.beneficios||[]).slice(0,4).length*58+20;

  // CTA
  drawGradBtn(ctx,d.cta||'SABER MÁS',SPLIT/2,b4Y,SPLIT-40,78,acc,shiftColor(acc,-30),'#fff');

  // CONTACT
  ctx.save(); ctx.font='700 24px Outfit'; ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.textAlign='left';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',20,H-28); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 5: BOLD CENTER DARK — Gradient bg, centered huge text (like "WE'RE OPEN")
// ═══════════════════════════════════════════════════════════════════
function engine_circle(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#1a56db';

  // GRADIENT BACKGROUND
  fillGradBlock(ctx,0,0,W,H,shiftColor(acc,-40),'#060615','d');

  // GEOMETRIC SHAPES for depth
  ctx.save();
  ctx.beginPath(); ctx.arc(W*0.85,H*0.15,W*0.32,0,Math.PI*2);
  ctx.fillStyle=acc+'22'; ctx.fill(); ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(W*0.08,H*0.82,W*0.28,0,Math.PI*2);
  ctx.fillStyle=acc+'15'; ctx.fill(); ctx.restore();

  // PHOTO — right side framed
  const phX=Math.round(W*0.45), phW=Math.round(W*0.48), phH=Math.round(H*0.52);
  ctx.save(); roundRect(ctx,phX,(H-phH)/2,phW,phH,24); ctx.clip();
  drawPhotoBlock(ctx,d.bgImage,phX,(H-phH)/2,phW,phH,0);
  // Edge fade from left
  const pfade=ctx.createLinearGradient(phX,0,phX+phW*0.4,0);
  pfade.addColorStop(0,shiftColor(acc,-40)+'ee'); pfade.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pfade; ctx.fillRect(phX,(H-phH)/2,phW,phH);
  ctx.restore();

  // BRANDING TOP
  fillBlock(ctx,0,0,W,88,'rgba(0,0,0,0.4)');
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',36,50,'#fff',acc);
  if(d.price) drawGradBtn(ctx,d.price,W-130,12,220,64,acc,shiftColor(acc,20),'#fff');

  // BIG TITLE (left)
  ctx.save(); ctx.textAlign='left';
  const tws=(d.title||'TU OFERTA').toUpperCase().split(' ');
  const bigS=tws.length<=2?170:tws.length<=3?148:122;
  tws.slice(0,3).forEach((w,i)=>{
    ctx.font=`900 ${i===0?bigS:Math.round(bigS*0.82)}px Outfit`;
    ctx.fillStyle=i===1?acc:'#fff';
    ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=24; ctx.shadowOffsetY=10;
    ctx.fillText(w,36,H*0.3+i*(Math.round(bigS*0.9)+12));
  });
  ctx.restore();
  const afterTitle=H*0.3+tws.slice(0,3).length*(Math.round(bigS*0.9)+12);

  // SUBTITLE
  ctx.save(); ctx.font='italic 500 30px Outfit'; ctx.fillStyle='rgba(255,255,255,0.78)'; ctx.textAlign='left';
  const ss=wrapText(ctx,d.subtitle||'',W*0.44); ss.slice(0,2).forEach((s,i)=>ctx.fillText(s,36,afterTitle+12+i*38)); ctx.restore();
  const afterSub=afterTitle+12+ss.slice(0,2).length*38+24;

  // BENEFITS (chips)
  (d.beneficios||[]).slice(0,3).forEach((b: string,i: number)=>{
    drawCheckBenefit(ctx,b,36,afterSub+i*58,acc,'#fff',26);
  });
  const afterBen=afterSub+(d.beneficios||[]).slice(0,3).length*58+24;

  // CTA
  drawGradBtn(ctx,d.cta||'EMPEZAR AHORA',Math.round(W*0.22),afterBen,Math.round(W*0.42),80,acc,shiftColor(acc,20),'#fff');

  // PHONE
  fillBlock(ctx,0,H-76,W,76,acc);
  ctx.save(); ctx.font='900 28px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-36); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 6: CORPORATE SPLIT RIGHT — Light bg, photo right, bold info left
// ═══════════════════════════════════════════════════════════════════
function engine_stripes(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#1e40af';
  const SPLIT=Math.round(W*0.46);

  // BG white
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);

  // RIGHT: photo full height
  drawPhotoBlock(ctx,d.bgImage,SPLIT,0,W-SPLIT,H);
  // Fade from right back to left (photo visible, left panel clean)
  const rf=ctx.createLinearGradient(SPLIT,0,SPLIT+(W-SPLIT)*0.5,0);
  rf.addColorStop(0,'#fff'); rf.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=rf; ctx.fillRect(SPLIT,0,W-SPLIT,H);

  // TOP accent stripe
  fillGradBlock(ctx,0,0,W,10,acc,shiftColor(acc,20),'h');

  // LEFT CONTENT
  if(d.logoImage) ctx.drawImage(d.logoImage,36,22,56,56);
  ctx.save(); ctx.font='800 20px Outfit'; ctx.fillStyle=acc; ctx.textAlign='left';
  ctx.fillText((d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?102:36,46);
  ctx.font='600 15px Outfit'; ctx.fillStyle='#94a3b8';
  ctx.fillText(d.contact?.web||'www.empresa.com',d.logoImage?102:36,66); ctx.restore();

  // HUGE TITLE — dark ink
  const titleWords=(d.title||'TU TITULO').toUpperCase().split(' ');
  let ty=Math.round(H*0.2);
  titleWords.slice(0,4).forEach((w,i)=>{
    const sz=i===0?148:i===1?136:110;
    ctx.save(); ctx.font=`900 ${sz}px Outfit`; ctx.textAlign='left';
    ctx.fillStyle=i===1?acc:'#0f172a';
    ctx.shadowColor='rgba(0,0,0,0.1)'; ctx.shadowBlur=6; ctx.shadowOffsetY=3;
    ctx.fillText(w,36,ty); ty+=sz+12; ctx.restore();
  });

  // DIVIDER
  drawAccentBar(ctx,36,ty+4,SPLIT-60,6,acc,'transparent'); ty+=24;

  // SUBTITLE
  ctx.save(); ctx.font='500 28px Outfit'; ctx.fillStyle='#475569'; ctx.textAlign='left';
  const ss2=wrapText(ctx,d.subtitle||'',SPLIT-60); ss2.slice(0,2).forEach((s,i)=>ctx.fillText(s,36,ty+i*36)); ctx.restore();
  ty+=ss2.slice(0,2).length*36+24;

  // BENEFITS
  (d.beneficios||[]).slice(0,4).forEach((b: string,i: number)=>{
    drawCheckBenefit(ctx,b,36,ty+i*58,acc,'#1e293b',26);
  });
  ty+=(d.beneficios||[]).slice(0,4).length*58+24;

  // CTA
  drawGradBtn(ctx,d.cta||'CONTÁCTANOS',36+Math.round((SPLIT-52)/2),ty,SPLIT-52,80,acc,shiftColor(acc,-20),'#fff');

  // BOTTOM
  fillBlock(ctx,0,H-72,W,72,'#0f172a');
  ctx.save(); ctx.font='800 26px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-34); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 7: DIAGONAL CUT IMPACT — Bold diagonal split, photo + text
// ═══════════════════════════════════════════════════════════════════
function engine_cornerBurst(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#f59e0b';

  // FULL BLEED PHOTO BG
  drawPhotoBlock(ctx,d.bgImage,0,0,W,H);

  // DIAGONAL dark overlay (top-left triangle covers ~55% for text)
  ctx.save(); ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(W*0.68,0); ctx.lineTo(W*0.35,H); ctx.lineTo(0,H); ctx.closePath();
  fillGradBlock(ctx,0,0,W*0.55,H,shiftColor(acc,-50)+'f2',shiftColor(acc,-60)+'cc','d');
  ctx.clip();
  fillGradBlock(ctx,0,0,W*0.55,H,shiftColor(acc,-50)+'f2',shiftColor(acc,-60)+'cc','d');
  ctx.restore();

  // ACCENT diagonal stripe border between sections
  ctx.save(); ctx.beginPath();
  ctx.moveTo(W*0.65,0); ctx.lineTo(W*0.70,0); ctx.lineTo(W*0.37,H); ctx.lineTo(W*0.32,H); ctx.closePath();
  ctx.fillStyle=acc; ctx.fill(); ctx.restore();

  // TOP BRANDING
  fillBlock(ctx,0,0,W,82,'rgba(0,0,0,0.35)');
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',36,46,'#fff','rgba(255,255,255,0.55)');
  if(d.price) drawGradBtn(ctx,d.price,W-130,10,220,62,acc,shiftColor(acc,20),'#000');

  // MASSIVE STACKED WORDS (left)
  const ws=(d.title||'TU OFERTA').toUpperCase().split(' ');
  let wy=Math.round(H*0.25);
  ws.slice(0,4).forEach((w,i)=>{
    const sz=i===0?162:i===1?148:118;
    ctx.save(); ctx.font=`900 ${sz}px Outfit`; ctx.textAlign='left'; ctx.fillStyle=i===1?acc:'#fff';
    ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=24; ctx.shadowOffsetY=10;
    ctx.fillText(w,36,wy); wy+=sz+6; ctx.restore();
  });
  drawAccentBar(ctx,36,wy+10,260,7,acc,'rgba(255,255,0,0)'); wy+=32;

  // SUBTITLE
  ctx.save(); ctx.font='italic 500 30px Outfit'; ctx.fillStyle='rgba(255,255,255,0.82)'; ctx.textAlign='left';
  const ss3=wrapText(ctx,d.subtitle||'',W*0.52); ss3.slice(0,2).forEach((s,i)=>ctx.fillText(s,36,wy+i*38)); ctx.restore();
  wy+=ss3.slice(0,2).length*38+24;

  // BENEFITS
  (d.beneficios||[]).slice(0,3).forEach((b: string,i: number)=>{
    drawCheckBenefit(ctx,b,36,wy+i*56,acc,'#fff',26);
  });
  wy+=(d.beneficios||[]).slice(0,3).length*56+24;

  // CTA
  drawGradBtn(ctx,d.cta||'SABER MÁS',Math.round(W*0.18),wy,Math.round(W*0.38),82,acc,shiftColor(acc,20),'#000');

  // CONTACT
  fillBlock(ctx,0,H-76,W,76,'rgba(0,0,0,0.55)');
  ctx.save(); ctx.font='800 26px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-38); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 8: CLEAN EDITORIAL WHITE — Minimal premium, card image top
// ═══════════════════════════════════════════════════════════════════
function engine_architectural(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#0ea5e9';

  // PURE WHITE CANVAS
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);

  // TOP ACCENT BAR
  fillGradBlock(ctx,0,0,W,12,acc,shiftColor(acc,20),'h');

  // TOP PHOTO in rounded card
  const photoY=72; const photoW=W-72; const photoH=Math.round(H*0.44);
  // Card shadow
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.18)'; ctx.shadowBlur=32; ctx.shadowOffsetY=12;
  roundRect(ctx,36,photoY,photoW,photoH,20); ctx.fillStyle='#e2e8f0'; ctx.fill(); ctx.restore();
  // Photo
  ctx.save(); roundRect(ctx,36,photoY,photoW,photoH,20); ctx.clip();
  drawPhotoBlock(ctx,d.bgImage,36,photoY,photoW,photoH,0);
  // Bottom photo fade to white
  fillGradBlock(ctx,36,photoY+photoH*0.6,photoW,photoH*0.4,'rgba(255,255,255,0)','rgba(255,255,255,0.7)','v');
  // OVERLAY TAGS IN PHOTO
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',52,photoY+32,'#fff','rgba(255,255,255,0.6)');
  if(d.price) drawGradBtn(ctx,d.price,W-130,photoY+14,200,56,acc,shiftColor(acc,-20),'#fff');
  ctx.restore();

  // CONTENT BELOW PHOTO
  const cY=photoY+photoH+20;
  // Accent pill tag
  ctx.save(); ctx.font='700 18px Outfit';
  const tgW=ctx.measureText((d.industria||'MARKETING').toUpperCase()).width+28;
  roundRect(ctx,36,cY,tgW,36,18); ctx.fillStyle=acc; ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText((d.industria||'MARKETING').toUpperCase(),50,cY+26); ctx.restore();

  // TITLE
  ctx.save(); ctx.textAlign='left';
  const tls=wrapText(ctx,(d.title||'TU OFERTA').toUpperCase(),W-72);
  let titleY2=cY+54;
  tls.slice(0,2).forEach((l,i)=>{
    ctx.font=`900 ${i===0?96:80}px Outfit`;
    ctx.fillStyle=i===0?'#0f172a':acc;
    ctx.shadowColor='rgba(0,0,0,0.1)'; ctx.shadowBlur=6; ctx.shadowOffsetY=3;
    ctx.fillText(l,36,titleY2); titleY2+=i===0?104:88;
  });
  ctx.restore();

  // SUBTITLE
  ctx.save(); ctx.font='500 28px Outfit'; ctx.fillStyle='#64748b'; ctx.textAlign='left';
  const ss=wrapText(ctx,d.subtitle||'',W-72); ss.slice(0,2).forEach((s,i)=>ctx.fillText(s,36,titleY2+i*36)); ctx.restore();
  titleY2+=ss.slice(0,2).length*36+20;

  // BENEFITS (2-col)
  const bens=(d.beneficios||[]).slice(0,4);
  bens.forEach((b: string,i: number)=>{
    const col=i%2; const row=Math.floor(i/2);
    drawCheckBenefit(ctx,b,40+col*(W/2-40),titleY2+row*56,acc,'#1e293b',24);
  });
  titleY2+=Math.ceil(bens.length/2)*58+20;

  // CTA
  drawGradBtn(ctx,d.cta||'VER MÁS',W/2,titleY2,W-72,80,acc,shiftColor(acc,-25),'#fff');

  // BOTTOM
  fillBlock(ctx,0,H-68,W,68,'#0f172a');
  ctx.save(); ctx.font='800 24px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-32); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 9: ULTRA DARK LUXURY — Gold accents, prestige frame (like Charles Schwab)
// ═══════════════════════════════════════════════════════════════════
function engine_luxuryDark(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#D4AF37';

  // ULTRA DARK BG with subtle gradient
  fillGradBlock(ctx,0,0,W,H,'#060612','#0d0d1f','d');

  // Decorative radial glow
  const glow=ctx.createRadialGradient(W*0.5,H*0.4,0,W*0.5,H*0.4,W*0.6);
  glow.addColorStop(0,acc+'18'); glow.addColorStop(0.6,acc+'06'); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);

  // TOP GOLD BAR
  fillGradBlock(ctx,0,0,W,10,acc,shiftColor(acc,20),'h');

  // BRAND HEADER
  fillBlock(ctx,0,10,W,82,'rgba(0,0,0,0.5)');
  if(d.logoImage) ctx.drawImage(d.logoImage,32,20,56,56);
  ctx.save(); ctx.font='800 20px Outfit'; ctx.fillStyle=acc; ctx.textAlign='left';
  ctx.fillText((d.industria||'ARIAS GROUP').toUpperCase(),d.logoImage?98:32,48);
  ctx.font='600 15px Outfit'; ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.fillText(d.contact?.web||'www.empresa.com',d.logoImage?98:32,68); ctx.restore();

  // PHOTO in golden-bordered frame
  const frameX=36; const frameY=102; const frameW=W-72; const frameH=Math.round(H*0.4);
  // Gold glow shadow
  ctx.save(); ctx.shadowColor=acc; ctx.shadowBlur=30; ctx.lineWidth=4; ctx.strokeStyle=acc;
  roundRect(ctx,frameX,frameY,frameW,frameH,16); ctx.stroke(); ctx.restore();
  ctx.save(); roundRect(ctx,frameX,frameY,frameW,frameH,16); ctx.clip();
  drawPhotoBlock(ctx,d.bgImage,frameX,frameY,frameW,frameH,0);
  // Photo overlay: dark vignette
  const pov=ctx.createRadialGradient(W/2,frameY+frameH/2,frameH*0.2,W/2,frameY+frameH/2,frameH*0.9);
  pov.addColorStop(0,'rgba(6,6,18,0)'); pov.addColorStop(1,'rgba(6,6,18,0.7)');
  ctx.fillStyle=pov; ctx.fillRect(frameX,frameY,frameW,frameH);
  if(d.price) drawPromoBadge(ctx,d.price,'OFERTA',W/2,frameY+frameH/2,66,acc,'#000');
  ctx.restore();

  // CONTENT BELOW
  let cY=frameY+frameH+28;
  // TITLE centered
  ctx.save(); ctx.textAlign='center';
  const tw=(d.title||'TU OFERTA').toUpperCase().split(' ');
  tw.slice(0,3).forEach((w,i)=>{
    const sz=i===0?110:i===1?96:82;
    ctx.font=`900 ${sz}px Outfit`; ctx.fillStyle=i===1?acc:'#fff';
    ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=24; ctx.shadowOffsetY=8;
    ctx.fillText(w,W/2,cY); cY+=sz+10;
  });
  ctx.restore();

  // Gold line
  drawAccentBar(ctx,W/2-80,cY+8,160,5,acc,'transparent'); cY+=28;

  // SUBTITLE
  ctx.save(); ctx.font='italic 400 28px Outfit'; ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.textAlign='center';
  ctx.fillText(d.subtitle||'',W/2,cY+8); ctx.restore(); cY+=48;

  // BENEFIT CARDS
  (d.beneficios||[]).slice(0,3).forEach((b: string,i: number)=>{
    const cw=W-88; const cx2=(W-cw)/2;
    roundRect(ctx,cx2,cY+i*64,cw,52,10);
    ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
    ctx.strokeStyle=acc+'60'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx2+30,cY+i*64+26,18,0,Math.PI*2);
    ctx.fillStyle=acc; ctx.fill(); ctx.font='900 14px Outfit'; ctx.fillStyle='#000'; ctx.textAlign='center';
    ctx.fillText('★',cx2+30,cY+i*64+32); ctx.restore();
    ctx.font='700 26px Outfit'; ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.textAlign='left';
    ctx.fillText(b.substring(0,32),cx2+58,cY+i*64+34);
  });
  cY+=(d.beneficios||[]).slice(0,3).length*64+24;

  // CTA
  drawGradBtn(ctx,d.cta||'CONTÁCTANOS',W/2,cY,W-80,84,acc,shiftColor(acc,-20),'#000');

  // GOLD BOTTOM BAR
  fillGradBlock(ctx,0,H-76,W,76,acc,shiftColor(acc,20),'h');
  ctx.save(); ctx.font='900 28px Outfit'; ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-36); ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE 10: GRADIENT POWER BOOST — Bold gradient bg, huge type, energy
// ═══════════════════════════════════════════════════════════════════
function engine_boldGradient(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc=d.accent||'#7c3aed';

  // VIVID GRADIENT BACKGROUND
  fillGradBlock(ctx,0,0,W,H,acc,shiftColor(acc,-45),'d');

  // Overlay for depth
  ctx.save();
  const ov=ctx.createRadialGradient(W*0.1,H*0.1,0,W*0.1,H*0.1,W*0.7);
  ov.addColorStop(0,'rgba(255,255,255,0.12)'); ov.addColorStop(1,'rgba(0,0,0,0.3)');
  ctx.fillStyle=ov; ctx.fillRect(0,0,W,H); ctx.restore();

  // PHOTO in center frame
  const phY=Math.round(H*0.18); const phH=Math.round(H*0.43); const phX=44; const phW=W-88;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=32; ctx.shadowOffsetY=12;
  roundRect(ctx,phX,phY,phW,phH,24); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx,phX,phY,phW,phH,24); ctx.clip();
  drawPhotoBlock(ctx,d.bgImage,phX,phY,phW,phH,0);
  // Photo vignette
  const pv=ctx.createLinearGradient(phX,phY+phH*0.55,phX,phY+phH);
  pv.addColorStop(0,'rgba(0,0,0,0)'); pv.addColorStop(1,shiftColor(acc,-45)+'ee');
  ctx.fillStyle=pv; ctx.fillRect(phX,phY,phW,phH);
  ctx.restore();

  // TOP BRANDING
  fillBlock(ctx,0,0,W,88,'rgba(0,0,0,0.35)');
  drawBrandBadge(ctx,d.logoImage,d.industria||'ARIAS GROUP',36,50,'#fff','rgba(255,255,255,0.55)');
  if(d.price) drawGradBtn(ctx,d.price,W-130,12,220,64,'rgba(255,255,255,0.25)','rgba(255,255,255,0.08)','#fff');

  // CONTENT BELOW PHOTO
  let bcY=phY+phH+20;
  // TITLE — centered massive
  ctx.save(); ctx.textAlign='center';
  const bw=(d.title||'TU OFERTA').toUpperCase().split(' ');
  const bsz=bw.length<=2?152:bw.length<=3?126:108;
  bw.slice(0,3).forEach((w,i)=>{
    ctx.font=`900 ${i===0?bsz:Math.round(bsz*0.82)}px Outfit`; ctx.fillStyle='#fff';
    ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=22; ctx.shadowOffsetY=8;
    ctx.fillText(w,W/2,bcY); bcY+=(i===0?bsz:Math.round(bsz*0.82))+10;
  });
  ctx.restore();

  // DIVIDER
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2;
  ctx.setLineDash([8,8]); ctx.beginPath(); ctx.moveTo(60,bcY+10); ctx.lineTo(W-60,bcY+10); ctx.stroke();
  ctx.setLineDash([]); ctx.restore(); bcY+=38;

  // SUBTITLE + BENEFITS
  ctx.save(); ctx.font='italic 500 30px Outfit'; ctx.fillStyle='rgba(255,255,255,0.82)'; ctx.textAlign='center';
  ctx.fillText(d.subtitle||'',W/2,bcY); ctx.restore(); bcY+=52;
  
  // BENEFITS horizontal
  let bpx=54; const bpy=bcY;
  (d.beneficios||[]).slice(0,3).forEach((b: string)=>{
    ctx.save(); ctx.font='700 24px Outfit';
    const tw=ctx.measureText(b.substring(0,22)).width+44; const bph=48;
    roundRect(ctx,bpx,bpy,tw,bph,24); ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1.5; ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(b.substring(0,22),bpx+22,bpy+33);
    bpx+=tw+12; ctx.restore();
  });
  bcY=bpy+72;

  // CTA
  drawGradBtn(ctx,d.cta||'AHORA',W/2,bcY,W-100,86,'rgba(255,255,255,0.95)','rgba(255,255,255,0.7)',acc);

  // CONTACT
  fillBlock(ctx,0,H-74,W,74,'rgba(0,0,0,0.45)');
  ctx.save(); ctx.font='800 26px Outfit'; ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,H-36); ctx.restore();
}

// ─── COLOR UTILITY: Shift a hex color lighter/darker ─────────────────────────
function shiftColor(hex: string, amount: number): string {
  const clamp=(n: number)=>Math.max(0,Math.min(255,n));
  let h=hex.replace('#','');
  if (h.length===3) h=h.split('').map(c=>c+c).join('');
  if (h.length!==6) return hex;
  const r=clamp(parseInt(h.slice(0,2),16)+amount);
  const g=clamp(parseInt(h.slice(2,4),16)+amount);
  const b=clamp(parseInt(h.slice(4,6),16)+amount);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

// ─── ENGINE MAP ───────────────────────────────────────────────────────────────
const ENGINES: Record<string, (ctx: CanvasRenderingContext2D, W: number, H: number, d: any) => void> = {
  splitPanel: engine_splitPanel, fullOverlay: engine_fullOverlay, bottomBanner: engine_bottomBanner,
  magazine: engine_magazine, circle: engine_circle, stripes: engine_stripes,
  cornerBurst: engine_cornerBurst, architectural: engine_architectural,
  luxuryDark: engine_luxuryDark, boldGradient: engine_boldGradient,
};
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
