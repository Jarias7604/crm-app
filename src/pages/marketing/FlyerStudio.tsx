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

// 2. Utilidades Geométricas
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ');
  const lines = []; let currLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (ctx.measureText(currLine + ' ' + w).width < maxWidth) { currLine += ' ' + w; }
    else { lines.push(currLine); currLine = w; }
  }
  lines.push(currLine); return lines;
}

// ─── HELPERS DE CANVAS PREMIUM ───────────────────────────────────────────────
function drawBadge(ctx, text, x, y, bg, fg, fontSize = 26, px2 = 28, py2 = 14, r2 = 10) {
  ctx.save(); ctx.font = `900 ${fontSize}px Outfit`;
  const tw = ctx.measureText(text).width; const bw = tw + px2 * 2; const bh = fontSize + py2 * 2;
  roundRect(ctx, x, y, bw, bh, r2); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.fillText(text, x + px2, y + bh - py2 - 2); ctx.restore();
}
function drawHex(ctx, cx, cy, r, fill, stroke, sw = 3) {
  ctx.save(); ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); } ctx.restore();
}
function drawIconCircle(ctx, cx, cy, r, bg, symbol, fg = '#fff', fs = 22) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill(); ctx.fillStyle = fg; ctx.font = `700 ${fs}px Outfit`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, cx, cy + 1); ctx.textBaseline = 'alphabetic'; ctx.restore();
}
function drawFeatures(ctx, benefits, x, y, maxW, acc, light, cols = 1, iconSize = 26) {
  if (!benefits?.length) return;
  const ICONS = ['\u2726', '\u25c8', '\u25b8', '\u2605', '\u2b21', '\u2691'];
  const colW = maxW / cols;
  benefits.slice(0, cols * 2).forEach((b, i) => {
    const col = cols === 2 ? i % 2 : 0; const row = cols === 2 ? Math.floor(i / 2) : i;
    const bx = x + col * colW; const by = y + row * 60;
    drawIconCircle(ctx, bx + iconSize, by, iconSize, acc, ICONS[i % ICONS.length], '#fff', Math.round(iconSize * 0.7));
    ctx.font = '600 20px Outfit'; ctx.fillStyle = light ? '#1e293b' : 'rgba(255,255,255,0.9)'; ctx.textAlign = 'left';
    ctx.fillText(b.substring(0, 32), bx + iconSize * 2 + 10, by + 7);
  });
}
function drawShadowText(ctx, text, x, y, color, font, shadowColor = 'rgba(0,0,0,0.7)', blur = 18) {
  ctx.save(); ctx.shadowColor = shadowColor; ctx.shadowBlur = blur; ctx.shadowOffsetY = 4;
  ctx.fillStyle = color; ctx.font = font; ctx.fillText(text, x, y); ctx.restore();
}
function drawCTA(ctx, text, x, y, w, h, fillColor, textColor, r = 8) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = fillColor; ctx.fill();
  ctx.shadowColor = 'transparent';
  const hi = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  hi.addColorStop(0, 'rgba(255,255,255,0.18)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(ctx, x, y, w, h * 0.5, r); ctx.fillStyle = hi; ctx.fill();
  ctx.font = `900 ${Math.round(h * 0.4)}px Outfit`; ctx.fillStyle = textColor; ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h * 0.65); ctx.restore();
}
function drawContact(ctx, phone, x, y, acc, light = false) {
  ctx.save(); drawIconCircle(ctx, x + 22, y, 22, acc, '\u260e', '#fff', 14);
  ctx.font = '700 18px Outfit'; ctx.fillStyle = light ? '#0f172a' : '#fff'; ctx.textAlign = 'left';
  ctx.fillText(phone, x + 52, y + 7); ctx.restore();
}
function drawSocialBar(ctx, y, W, acc, light, web = '') {
  ctx.save(); const icons = ['f', 'in', '@', '\u25b6']; let sx = 40;
  icons.forEach(ic => { drawIconCircle(ctx, sx + 16, y, 16, light ? '#e2e8f0' : 'rgba(255,255,255,0.15)', ic, light ? '#64748b' : 'rgba(255,255,255,0.7)', 11); sx += 42; });
  if (web) { ctx.font = '600 15px Outfit'; ctx.fillStyle = light ? '#64748b' : 'rgba(255,255,255,0.55)'; ctx.textAlign = 'right'; ctx.fillText(web, W - 40, y + 5); } ctx.restore();
}
function drawDotGrid(ctx, x, y, cols, rows, gap, color, r = 2) {
  ctx.save(); ctx.fillStyle = color;
  for (let c = 0; c < cols; c++) for (let r2 = 0; r2 < rows; r2++) { ctx.beginPath(); ctx.arc(x + c * gap, y + r2 * gap, r, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
}
function engine_splitPanel(ctx, W, H, d) {
  const acc = d.accent || '#1a56db';
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(W*0.55,0); ctx.bezierCurveTo(W*0.72,H*0.2,W*0.38,H*0.8,W*0.6,H); ctx.lineTo(0,H); ctx.closePath(); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,0,0,W*0.7,H); else { ctx.fillStyle='#334155'; ctx.fillRect(0,0,W,H); }
  const og=ctx.createLinearGradient(0,0,W*0.6,0); og.addColorStop(0,'rgba(0,0,0,0.15)'); og.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=og; ctx.fillRect(0,0,W,H); ctx.restore();
  drawDotGrid(ctx,W*0.65,40,5,5,22,acc+'44',3);
  drawHex(ctx,W*0.82,H*0.15,55,acc+'22',acc+'55',2); drawHex(ctx,W*0.9,H*0.82,35,acc+'15',acc+'33',1);
  ctx.fillStyle=acc; ctx.fillRect(W*0.62,0,W*0.38,8);
  if (d.logoImage) ctx.drawImage(d.logoImage,W*0.63,24,44,44);
  ctx.textAlign='left'; ctx.fillStyle='#64748b'; ctx.font='700 13px Outfit'; ctx.fillText('LOGO HERE',W*0.63+(d.logoImage?52:0),40);
  ctx.fillStyle=acc; ctx.font='600 11px Outfit'; ctx.fillText('WWW.EMPRESA.COM',W*0.63+(d.logoImage?52:0),58);
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(W*0.63+(i*18),80,4,0,Math.PI*2);ctx.fillStyle=i===0?acc:acc+'55';ctx.fill();}
  const lines=wrapText(ctx,(d.title||'').toUpperCase(),W*0.36); ctx.textAlign='left';
  lines.slice(0,3).forEach((l,i)=>{ ctx.font=i===0?'900 64px Playfair Display':'900 60px Playfair Display'; drawShadowText(ctx,l,W*0.62,160+i*74,i===1?acc:'#0f172a',ctx.font,'rgba(0,0,0,0.05)',4); });
  ctx.fillStyle=acc; ctx.fillRect(W*0.62,160+lines.length*74+8,60,4);
  const subY=160+lines.length*74+28; const subs=wrapText(ctx,d.subtitle||'',W*0.36);
  ctx.font='400 20px Outfit'; ctx.fillStyle='#475569'; subs.slice(0,3).forEach((s,i)=>ctx.fillText(s,W*0.62,subY+i*28));
  drawFeatures(ctx,d.beneficios||[],W*0.62,subY+subs.length*28+30,W*0.34,acc,true,1,22);
  drawCTA(ctx,d.cta||'GET STARTED',W*0.62,H-170,230,58,acc,'#fff');
  drawSocialBar(ctx,H-72,W,acc,true,d.contact?.web||'www.empresa.com');
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W*0.62,H-105,acc,true);
}
function engine_fullOverlay(ctx, W, H, d) {
  const acc = d.accent || '#D4AF37';
  if (d.bgImage) ctx.drawImage(d.bgImage,0,0,W,H); else { ctx.fillStyle='#1e293b'; ctx.fillRect(0,0,W,H); }
  const gr=ctx.createLinearGradient(0,0,0,H); gr.addColorStop(0,'rgba(0,0,0,0.75)'); gr.addColorStop(0.45,'rgba(0,0,0,0.3)'); gr.addColorStop(1,'rgba(0,0,0,0.92)'); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,100);
  if (d.logoImage) ctx.drawImage(d.logoImage,W/2-26,18,52,52);
  ctx.textAlign='center'; ctx.fillStyle=acc; ctx.font='700 13px Outfit'; ctx.fillText('ARIAS GROUP  \u2022  EXCLUSIVE',W/2,82);
  ctx.fillStyle=acc; ctx.fillRect(W/2-50,92,100,3);
  drawHex(ctx,80,H*0.35,45,'rgba(255,255,255,0.04)',acc+'40',1); drawHex(ctx,W-70,H*0.65,35,'rgba(255,255,255,0.04)',acc+'30',1);
  const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-120);
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,W/2,H*0.45+i*92,'#fff',`900 ${i===0?84:80}px Playfair Display`,'rgba(0,0,0,0.8)',30));
  ctx.fillStyle=acc; ctx.font='500 28px Outfit'; ctx.textAlign='center'; ctx.fillText(d.subtitle||'',W/2,H*0.45+tl.length*92+10);
  const fbY=H*0.45+tl.length*92+60;
  (d.beneficios||[]).slice(0,3).forEach((b,i)=>{
    ctx.font='600 19px Outfit'; const tw=ctx.measureText(b).width+48; const bx=W/2-tw/2;
    roundRect(ctx,bx,fbY+i*54,tw,40,20); ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fill();
    ctx.strokeStyle=acc+'80'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(b,W/2,fbY+i*54+27);
  });
  drawCTA(ctx,d.cta||'SABER M\u00c1S',W/2-130,H-160,260,62,acc,'#000');
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2-80,H-70,acc,false);
}
function engine_bottomBanner(ctx, W, H, d) {
  const acc = d.accent || '#e11d48'; const splitY=H*0.5;
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,splitY+20); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,0,0,W,splitY*1.6); else { ctx.fillStyle='#334155'; ctx.fillRect(0,0,W,H); }
  const pgr=ctx.createLinearGradient(0,0,0,splitY+20); pgr.addColorStop(0,'rgba(0,0,0,0.5)'); pgr.addColorStop(1,'rgba(15,23,42,0.95)'); ctx.fillStyle=pgr; ctx.fillRect(0,0,W,splitY+20); ctx.restore();
  ctx.fillStyle='#0f172a'; ctx.fillRect(0,splitY,W,H-splitY);
  ctx.fillStyle=acc; ctx.fillRect(0,splitY,W,6);
  ctx.save(); ctx.beginPath(); ctx.moveTo(0,splitY+6); ctx.lineTo(W*0.45,splitY+6); ctx.lineTo(W*0.35,splitY+100); ctx.lineTo(0,splitY+100); ctx.closePath(); ctx.fillStyle=acc+'22'; ctx.fill(); ctx.restore();
  if (d.logoImage) ctx.drawImage(d.logoImage,40,26,48,48);
  ctx.textAlign='left'; ctx.font='700 15px Outfit'; ctx.fillStyle='#fff'; ctx.fillText('ARIAS GROUP',d.logoImage?100:40,45);
  ctx.fillStyle=acc; ctx.font='600 12px Outfit'; ctx.fillText('EXCLUSIVE MARKETING',d.logoImage?100:40,64);
  if (d.price) drawBadge(ctx,d.price,W-220,26,acc,'#fff',38,20,12,8);
  const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-80);
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,40,splitY-120+i*80,'#fff','900 72px Playfair Display'));
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='400 22px Outfit'; ctx.textAlign='left'; ctx.fillText(d.subtitle||'',40,splitY-20);
  drawFeatures(ctx,d.beneficios||[],40,splitY+40,W-80,acc,false,2,24);
  drawCTA(ctx,d.cta||'CONTACTANOS',W-268,H-90,228,58,acc,'#fff');
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',40,H-58,acc,false);
  drawSocialBar(ctx,H-30,W,acc,false,d.contact?.web||'');
}
function engine_magazine(ctx, W, H, d) {
  const acc = d.accent || '#D4AF37';
  if (d.bgImage) ctx.drawImage(d.bgImage,0,0,W,H); else { ctx.fillStyle='#1e293b'; ctx.fillRect(0,0,W,H); }
  ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=acc; ctx.fillRect(0,0,16,H);
  const tgr=ctx.createLinearGradient(0,0,0,220); tgr.addColorStop(0,'rgba(0,0,0,0.9)'); tgr.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=tgr; ctx.fillRect(0,0,W,220);
  ctx.fillStyle=acc; ctx.font='900 13px Outfit'; ctx.textAlign='left'; ctx.fillText('MARKETING EXCLUSIVE',40,52);
  ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='400 13px Outfit'; ctx.fillText(' \u2014 EDICION ESPECIAL',40+ctx.measureText('MARKETING EXCLUSIVE').width,52);
  if (d.logoImage) ctx.drawImage(d.logoImage,W-80,24,50,50);
  ctx.fillStyle=acc+'99'; ctx.fillRect(40,64,W-130,1);
  drawDotGrid(ctx,W-120,100,4,6,20,'rgba(255,255,255,0.12)',2);
  const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-80); ctx.textAlign='left';
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,36,H*0.44+i*110,'#fff',`900 ${i===0?100:92}px Playfair Display`,'rgba(0,0,0,0.9)',35));
  ctx.fillStyle=acc; ctx.fillRect(36,H*0.44+tl.length*110+10,80,4);
  ctx.fillStyle=acc; ctx.font='600 28px Outfit'; ctx.fillText((d.subtitle||'').toUpperCase(),36,H*0.44+tl.length*110+50);
  drawFeatures(ctx,d.beneficios||[],36,H*0.44+tl.length*110+90,W-72,acc,false,2,24);
  drawCTA(ctx,d.cta||'VER OFERTA',W-296,H-90,256,58,acc,'#000');
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',36,H-52,acc,false);
}
function engine_circle(ctx, W, H, d) {
  const acc = d.accent || '#1a56db';
  const bgGr=ctx.createLinearGradient(0,0,W,H); bgGr.addColorStop(0,acc); bgGr.addColorStop(1,'#0f172a'); ctx.fillStyle=bgGr; ctx.fillRect(0,0,W,H);
  const R=W*0.38,cx2=W*0.35,cy2=H*0.38;
  ctx.save(); const glow=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,R+20); glow.addColorStop(0,'rgba(255,255,255,0.12)'); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx2,cy2,R+20,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx2,cy2,R,0,Math.PI*2); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,cx2-R,cy2-R,R*2,R*2); else { ctx.fillStyle='#334155'; ctx.fillRect(0,0,W,H); } ctx.restore();
  ctx.strokeStyle='#fff'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(cx2,cy2,R,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=acc+'80'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx2,cy2,R+14,0,Math.PI*2); ctx.stroke();
  const feats=(d.beneficios||[]).slice(0,4); const ICONS4=['\u2605','\u25c8','\u25b8','\u2726'];
  const positions=[{x:cx2-R*1.1,y:cy2-R*0.5},{x:cx2+R*1.0,y:cy2-R*0.7},{x:cx2-R*1.0,y:cy2+R*0.7},{x:cx2+R*1.1,y:cy2+R*0.45}];
  feats.forEach((b,i)=>{ const pos=positions[i]; drawIconCircle(ctx,pos.x,pos.y,36,'#fff',ICONS4[i],acc,18);
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.setLineDash([4,6]); ctx.beginPath(); ctx.moveTo(cx2,cy2); ctx.lineTo(pos.x,pos.y); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.font='600 15px Outfit'; ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.textAlign=pos.x>cx2?'left':'right'; ctx.fillText(b.substring(0,18),pos.x>cx2?pos.x+44:pos.x-44,pos.y+6); });
  ctx.textAlign='right'; if (d.logoImage) ctx.drawImage(d.logoImage,W-90,36,50,50);
  ctx.fillStyle=acc+'dd'; ctx.font='700 13px Outfit'; ctx.fillText('ARIAS GROUP EXCLUSIVE',W-36,65);
  const tl=wrapText(ctx,(d.title||'').toUpperCase(),W*0.43); tl.slice(0,3).forEach((l,i)=>drawShadowText(ctx,l,W-36,H*0.65+i*76,i===1?acc:'#fff','900 56px Playfair Display'));
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='400 20px Outfit'; ctx.fillText(d.subtitle||'',W-36,H*0.65+tl.length*76+18);
  drawCTA(ctx,d.cta||'CONTACTANOS',W-256,H-150,220,52,'#fff',acc);
  ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.font='600 16px Outfit'; ctx.textAlign='right'; ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W-36,H-70);
  drawSocialBar(ctx,H-30,W,acc,false,d.contact?.web||'');
}
function engine_stripes(ctx, W, H, d) {
  const acc = d.accent || '#1a56db';
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,W,H*0.09); ctx.fillStyle=acc; ctx.fillRect(0,H*0.09,W,H*0.055);
  ctx.save(); ctx.beginPath(); ctx.rect(0,H*0.145,W,H*0.48); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,0,H*0.12,W,H*0.54); else { ctx.fillStyle='#e2e8f0'; ctx.fillRect(0,0,W,H); }
  const fgr=ctx.createLinearGradient(0,H*0.5,0,H*0.63); fgr.addColorStop(0,'rgba(255,255,255,0)'); fgr.addColorStop(1,'#fff'); ctx.fillStyle=fgr; ctx.fillRect(0,H*0.5,W,H*0.13); ctx.restore();
  ctx.fillStyle=acc; ctx.fillRect(0,H*0.625,W,H*0.036); ctx.fillStyle='#0f172a'; ctx.fillRect(0,H*0.661,W,H*0.339);
  if (d.logoImage) ctx.drawImage(d.logoImage,30,6,50,50);
  ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='700 15px Outfit'; ctx.fillText('ARIAS GROUP',d.logoImage?90:30,35);
  drawHex(ctx,W-60,H*0.045,34,acc+'33',acc,2); ctx.fillStyle=acc; ctx.font='700 10px Outfit'; ctx.textAlign='center'; ctx.fillText('PRO',W-60,H*0.045+4);
  ctx.textAlign='left'; const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-80);
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,40,H*0.24+i*86,'#fff','900 76px Playfair Display'));
  const botY=H*0.69; drawFeatures(ctx,d.beneficios||[],40,botY,W-80,acc,false,2,22);
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(40,botY+130,W-80,1);
  ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.font='400 20px Outfit'; ctx.textAlign='left'; ctx.fillText(d.subtitle||'',40,botY+158);
  drawCTA(ctx,d.cta||'SABER M\u00c1S',W-268,H-90,228,54,acc,'#fff');
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',40,H-52,acc,false);
}
function engine_cornerBurst(ctx, W, H, d) {
  const acc = d.accent || '#0ea5e9';
  ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W,0); ctx.lineTo(W,H*0.56); ctx.lineTo(0,H*0.44); ctx.closePath(); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,0,0,W,H); else { ctx.fillStyle='#334155'; ctx.fillRect(0,0,W,H); }
  const dog=ctx.createLinearGradient(0,0,0,H*0.56); dog.addColorStop(0,'rgba(0,0,0,0.5)'); dog.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=dog; ctx.fillRect(0,0,W,H*0.56); ctx.restore();
  ctx.save(); ctx.globalAlpha=0.9; ctx.fillStyle=acc; ctx.beginPath(); ctx.moveTo(0,H*0.42); ctx.lineTo(W,H*0.54); ctx.lineTo(W,H*0.60); ctx.lineTo(0,H*0.48); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; ctx.restore();
  if (d.logoImage) ctx.drawImage(d.logoImage,36,28,48,48);
  ctx.textAlign='left'; ctx.font='700 14px Outfit'; ctx.fillStyle='#fff'; ctx.fillText('ARIAS GROUP',d.logoImage?96:36,50);
  ctx.fillStyle=acc; ctx.font='600 11px Outfit'; ctx.fillText('DIGITAL MARKETING',d.logoImage?96:36,68);
  drawHex(ctx,W-70,80,50,'rgba(255,255,255,0.04)',acc+'66',2); drawDotGrid(ctx,W-140,40,4,4,20,acc+'33',2);
  drawBadge(ctx,'OFERTA',W-180,30,acc,'#fff',20,16,10,6);
  const titY=H*0.65; const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-80);
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,36,titY+i*80,'#fff','900 68px Playfair Display'));
  ctx.fillStyle=acc; ctx.font='500 24px Outfit'; ctx.fillText(d.subtitle||'',36,titY+tl.length*80+16);
  drawFeatures(ctx,d.beneficios||[],36,titY+tl.length*80+56,W-72,acc,false,2,20);
  drawCTA(ctx,d.cta||'CONTACTANOS',W-268,H-80,230,54,acc,'#fff');
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',36,H-44,acc,false);
}
function engine_architectural(ctx, W, H, d) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=acc; ctx.fillRect(0,0,W,10);
  drawDotGrid(ctx,W-160,30,6,5,22,'#e2e8f0',3);
  const px=80,py=60,pw=W-160,ph=H*0.42;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.15)'; ctx.shadowBlur=30; ctx.shadowOffsetY=8;
  roundRect(ctx,px,py,pw,ph,16); ctx.fillStyle='#e2e8f0'; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx,px,py,pw,ph,16); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,px,py,pw,ph); else { ctx.fillStyle='#94a3b8'; ctx.fillRect(px,py,pw,ph); }
  const pfgr=ctx.createLinearGradient(0,py+ph*0.6,0,py+ph); pfgr.addColorStop(0,'rgba(0,0,0,0)'); pfgr.addColorStop(1,'rgba(0,0,0,0.4)'); ctx.fillStyle=pfgr; ctx.fillRect(px,py,pw,ph);
  drawCTA(ctx,d.cta||'VER DETALLES',px+pw-230,py+ph-72,210,50,acc,'#fff'); ctx.restore();
  drawBadge(ctx,'NUEVO',px+16,py+16,acc,'#fff',18,14,8,6);
  const bY=py+ph+32;
  if (d.logoImage) ctx.drawImage(d.logoImage,px,bY,40,40);
  ctx.textAlign='left'; ctx.fillStyle='#94a3b8'; ctx.font='700 12px Outfit';
  ctx.fillText('ARIAS GROUP  \u2022  EXCLUSIVE REAL ESTATE',px+(d.logoImage?50:0),bY+16);
  ctx.fillStyle=acc; ctx.fillRect(px,bY+30,60,4);
  const titleY=bY+58; const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-200); ctx.font='900 62px Playfair Display';
  tl.slice(0,2).forEach((l,i)=>{ ctx.fillStyle=i===0?'#0f172a':acc; ctx.fillText(l,px,titleY+i*72); });
  const afterTitle=titleY+tl.length*72; ctx.fillStyle='#64748b'; ctx.font='400 20px Outfit';
  const subs=wrapText(ctx,d.subtitle||'',W-180); subs.slice(0,2).forEach((s,i)=>ctx.fillText(s,px,afterTitle+8+i*28));
  drawFeatures(ctx,d.beneficios||[],px,afterTitle+8+subs.length*28+20,W-180,acc,true,2,22);
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',px,H-44,acc,true);
  drawSocialBar(ctx,H-24,W,acc,true,d.contact?.web||'');
}
function engine_luxuryDark(ctx, W, H, d) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle='#070711'; ctx.fillRect(0,0,W,H);
  const rglow=ctx.createRadialGradient(W/2,H*0.5,0,W/2,H*0.5,W*0.55); rglow.addColorStop(0,acc+'18'); rglow.addColorStop(1,'transparent'); ctx.fillStyle=rglow; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=acc+'15'; ctx.lineWidth=1;
  for(let gy=0;gy<H;gy+=70){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
  for(let gx=0;gx<W;gx+=70){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  drawHex(ctx,W*0.12,H*0.12,60,acc+'08',acc+'25',1); drawHex(ctx,W*0.88,H*0.88,50,acc+'08',acc+'20',1);
  const ph=H*0.33,py=H*0.27;
  ctx.save(); ctx.shadowColor=acc; ctx.shadowBlur=20; ctx.strokeStyle=acc; ctx.lineWidth=3;
  ctx.beginPath(); ctx.rect(W*0.12,py-4,W*0.76,ph+8); ctx.stroke(); ctx.shadowColor='transparent'; ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(W*0.12,py,W*0.76,ph); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,W*0.12,py-H*0.1,W*0.76,ph+H*0.15); else { ctx.fillStyle='#1e293b'; ctx.fillRect(0,py,W,ph); }
  const pf=ctx.createLinearGradient(0,py,0,py+ph); pf.addColorStop(0,'rgba(7,7,17,0.75)'); pf.addColorStop(0.3,'rgba(7,7,17,0)'); pf.addColorStop(0.7,'rgba(7,7,17,0)'); pf.addColorStop(1,'rgba(7,7,17,0.85)');
  ctx.fillStyle=pf; ctx.fillRect(0,py,W,ph); ctx.restore();
  if (d.logoImage) ctx.drawImage(d.logoImage,W/2-26,28,52,52);
  ctx.textAlign='center'; ctx.fillStyle=acc; ctx.font='700 13px Outfit'; ctx.fillText('ARIAS GROUP  \u25c6  EXCLUSIVE',W/2,94);
  const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-100);
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,W/2,H*0.17+i*80,i===0?'#fff':acc,'900 72px Playfair Display','rgba(0,0,0,0.8)',25));
  const afterPh=py+ph+44; ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.font='400 22px Outfit'; ctx.textAlign='center'; ctx.fillText(d.subtitle||'',W/2,afterPh);
  (d.beneficios||[]).slice(0,3).forEach((b,i)=>{
    const cardW=W*0.68,cardX=(W-cardW)/2; roundRect(ctx,cardX,afterPh+32+i*58,cardW,46,8);
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fill(); ctx.strokeStyle=acc+'40'; ctx.lineWidth=1; ctx.stroke();
    drawIconCircle(ctx,cardX+28,afterPh+55+i*58,18,acc,'\u2605','#000',11);
    ctx.font='600 18px Outfit'; ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.textAlign='left'; ctx.fillText(b.substring(0,36),cardX+54,afterPh+62+i*58);
  });
  const ctaY=afterPh+32+(d.beneficios||[]).length*58+20;
  drawCTA(ctx,d.cta||'VER PROPIEDAD',W/2-135,ctaY,270,58,acc,'#000');
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='600 15px Outfit'; ctx.textAlign='center'; ctx.fillText(d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2,ctaY+78);
}
function engine_boldGradient(ctx, W, H, d) {
  const acc = d.accent || '#0ea5e9'; const dark='#0c1445';
  const bgGr=ctx.createLinearGradient(0,0,W,H); bgGr.addColorStop(0,dark); bgGr.addColorStop(0.6,acc+'cc'); bgGr.addColorStop(1,dark); ctx.fillStyle=bgGr; ctx.fillRect(0,0,W,H);
  const ex=W/2,ey=H*0.34,erx=W*0.38,ery=H*0.26;
  ctx.save(); ctx.shadowColor=acc; ctx.shadowBlur=30; ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.ellipse(ex,ey,erx,ery,0,0,Math.PI*2); ctx.stroke(); ctx.shadowColor='transparent'; ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.ellipse(ex,ey,erx,ery,0,0,Math.PI*2); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage,ex-erx,ey-ery,erx*2,ery*2); else { ctx.fillStyle='#1e40af'; ctx.fillRect(0,0,W,H); } ctx.restore();
  ctx.strokeStyle=acc+'60'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(ex,ey,erx+16,ery+16,0,0,Math.PI*2); ctx.stroke();
  drawDotGrid(ctx,40,80,4,6,22,'rgba(255,255,255,0.08)',2); drawDotGrid(ctx,W-130,H*0.55,4,5,22,'rgba(255,255,255,0.08)',2);
  if (d.logoImage) ctx.drawImage(d.logoImage,W/2-26,20,52,52);
  ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='700 13px Outfit'; ctx.fillText('ARIAS GROUP  \u2022  EXCLUSIVE REAL ESTATE',W/2,86);
  if (d.price) { drawShadowText(ctx,d.price,W/2,H*0.08,'#fff','900 90px Outfit','rgba(0,0,0,0.5)',20); ctx.font='700 22px Outfit'; ctx.fillStyle=acc; ctx.fillText('/MES  \u2022  GARANTIA DE PRECIO',W/2,H*0.08+36); }
  const titY=ey+ery+50; const tl=wrapText(ctx,(d.title||'').toUpperCase(),W-100);
  tl.slice(0,2).forEach((l,i)=>drawShadowText(ctx,l,W/2,titY+i*84,i===0?'#fff':acc,`900 ${i===0?74:68}px Playfair Display`,'rgba(0,0,0,0.7)',20));
  ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font='400 22px Outfit'; ctx.textAlign='center'; ctx.fillText(d.subtitle||'',W/2,titY+tl.length*84+14);
  const featY=titY+tl.length*84+50;
  (d.beneficios||[]).slice(0,2).forEach((b,i)=>{ drawIconCircle(ctx,W/2-90+(i*180),featY,28,'rgba(255,255,255,0.12)','\u2726','#fff',14); ctx.font='600 18px Outfit'; ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.textAlign='center'; ctx.fillText(b.substring(0,18),W/2-90+(i*180),featY+46); });
  drawCTA(ctx,d.cta||'LEARN MORE',W/2-140,H-155,280,62,'#fff',dark);
  drawContact(ctx,d.contact?.whatsapp||profile_phone||'+503 7XXX-XXXX',W/2-80,H-68,acc,false);
  drawSocialBar(ctx,H-28,W,acc,false,d.contact?.web||'');
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
          idea: { ...idea, style_instructions: `LUXURY PROPERTIES, PROFESSIONAL MARKETING AGENCY STYLE, cinematic lighting. DO NOT WRITE TEXT ON IMAGE.` },
          industria: selectedIndustry,
          oferta, tono,
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
