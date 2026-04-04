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

// ─── HELPERS DE CANVAS ──────────────────────────────────────────────────────
function drawShadowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, font: string, shadowColor = 'rgba(0,0,0,0.7)', blur = 18) {
  ctx.save();
  ctx.shadowColor = shadowColor; ctx.shadowBlur = blur; ctx.shadowOffsetY = 4;
  ctx.fillStyle = color; ctx.font = font; ctx.fillText(text, x, y);
  ctx.restore();
}
function drawCTA(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, fillColor: string, textColor: string, r = 30) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = fillColor; ctx.fill();
  ctx.font = `900 ${Math.round(h * 0.38)}px Outfit`; ctx.fillStyle = textColor; ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h * 0.65);
  ctx.restore();
}
function drawContact(ctx: CanvasRenderingContext2D, phone: string, x: number, y: number, acc: string, light = false) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x + 22, y, 22, 0, Math.PI * 2); ctx.fillStyle = acc; ctx.fill();
  ctx.font = '700 13px Outfit'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText('☎', x + 22, y + 5);
  ctx.font = '700 18px Outfit'; ctx.fillStyle = light ? '#0f172a' : '#fff'; ctx.textAlign = 'left';
  ctx.fillText(phone, x + 52, y + 7);
  ctx.restore();
}
function drawBenefits(ctx: CanvasRenderingContext2D, benefits: string[], startX: number, startY: number, maxW: number, acc: string, darkText: boolean, cols = 2) {
  if (!benefits || benefits.length === 0) return;
  const colW = maxW / cols;
  benefits.slice(0, cols * 2).forEach((b: string, i: number) => {
    const col = i % cols; const row = Math.floor(i / cols);
    const bx = startX + col * colW; const by = startY + row * 52;
    ctx.save();
    ctx.fillStyle = acc; ctx.font = '900 18px Outfit'; ctx.textAlign = 'left';
    ctx.fillText('▸', bx, by);
    ctx.fillStyle = darkText ? '#1e293b' : '#e2e8f0'; ctx.font = '600 20px Outfit';
    ctx.fillText(b.substring(0, 28), bx + 24, by);
    ctx.restore();
  });
}

// ─── ENGINE 1: SPLIT PANEL ───────────────────────────────────────────────────
function engine_splitPanel(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#22c55e';
  ctx.fillStyle = acc; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath();
  ctx.moveTo(W * 0.58, 0); ctx.bezierCurveTo(W * 0.92, H * 0.25, W * 0.22, H * 0.75, W * 0.58, H);
  ctx.lineTo(W, H); ctx.lineTo(W, 0); ctx.closePath(); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, 0, 0, W, H); else { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  ctx.save(); ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W * 0.62, 0);
  ctx.bezierCurveTo(W * 0.96, H * 0.25, W * 0.26, H * 0.75, W * 0.62, H);
  ctx.lineTo(0, H); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 60; ctx.shadowOffsetX = 12;
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  if (d.logoImage) ctx.drawImage(d.logoImage, 48, 40, 54, 54);
  ctx.textAlign = 'left'; ctx.fillStyle = '#64748b'; ctx.font = '700 15px Outfit';
  ctx.fillText('ARIAS GROUP • EXCLUSIVE REAL ESTATE', 48, 120);
  const titleLines = wrapText(ctx, (d.title || '').toUpperCase(), W * 0.55);
  ctx.font = '900 62px Playfair Display';
  titleLines.slice(0, 3).forEach((line: string, i: number) => {
    ctx.fillStyle = i === 1 ? acc : '#0f172a'; ctx.fillText(line, 48, 230 + i * 72);
  });
  const spSubY = 230 + titleLines.length * 72 + 14;
  const subLines = wrapText(ctx, d.subtitle || '', W * 0.52);
  ctx.fillStyle = '#64748b'; ctx.font = '400 21px Outfit';
  subLines.slice(0, 3).forEach((sl: string, ix: number) => ctx.fillText(sl, 48, spSubY + ix * 30));
  drawBenefits(ctx, d.beneficios || [], 48, spSubY + subLines.slice(0,3).length * 30 + 30, W * 0.53, acc, true, 1);
  drawCTA(ctx, d.cta || 'CONTACTANOS', 48, H - 190, 240, 58, acc, '#fff');
  drawContact(ctx, d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', 48, H - 90, acc, true);
}

// ─── ENGINE 2: FULL OVERLAY ──────────────────────────────────────────────────
function engine_fullOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  if (d.bgImage) ctx.drawImage(d.bgImage, 0, 0, W, H); else { ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, W, H); }
  const gr = ctx.createLinearGradient(0, H * 0.35, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const foTopGr = ctx.createLinearGradient(0, 0, 0, 180);
  foTopGr.addColorStop(0, 'rgba(0,0,0,0.8)'); foTopGr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = foTopGr; ctx.fillRect(0, 0, W, 180);
  if (d.logoImage) ctx.drawImage(d.logoImage, W / 2 - 28, 38, 56, 56);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 15px Outfit';
  ctx.fillText('ARIAS GROUP • EXCLUSIVE REAL ESTATE', W / 2, 120);
  ctx.fillStyle = acc; ctx.fillRect(W / 2 - 40, 130, 80, 3);
  const foTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 100);
  foTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    drawShadowText(ctx, line, W / 2, H * 0.6 + i * 90, '#fff', '900 80px Playfair Display');
  });
  ctx.fillStyle = acc; ctx.font = '400 32px Outfit'; ctx.textAlign = 'center';
  ctx.fillText(d.subtitle || '', W / 2, H * 0.6 + foTitleLines.length * 90 + 10);
  if (d.beneficios?.length) {
    d.beneficios.slice(0, 3).forEach((b: string, i: number) => {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '600 20px Outfit';
      ctx.fillText(`◆  ${b}`, W / 2, H * 0.6 + foTitleLines.length * 90 + 55 + i * 32);
    });
  }
  drawCTA(ctx, d.cta || 'VER MAS', W / 2 - 130, H - 150, 260, 60, acc, '#000');
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 17px Outfit';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', W / 2, H - 55);
}

// ─── ENGINE 3: BOTTOM BANNER ─────────────────────────────────────────────────
function engine_bottomBanner(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  const panelY = H * 0.55;
  if (d.bgImage) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, panelY + 30); ctx.clip(); ctx.drawImage(d.bgImage, 0, 0, W, H * 0.85); ctx.restore(); }
  else { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, W, panelY + 30); }
  const bbFadeGr = ctx.createLinearGradient(0, panelY - 80, 0, panelY + 30);
  bbFadeGr.addColorStop(0, 'rgba(0,0,0,0)'); bbFadeGr.addColorStop(1, '#0f172a');
  ctx.fillStyle = bbFadeGr; ctx.fillRect(0, panelY - 80, W, 110);
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, panelY + 28, W, H - panelY - 28);
  ctx.fillStyle = acc; ctx.fillRect(0, panelY + 26, W, 6);
  const bbTopGr = ctx.createLinearGradient(0, 0, 0, 160);
  bbTopGr.addColorStop(0, 'rgba(0,0,0,0.85)'); bbTopGr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bbTopGr; ctx.fillRect(0, 0, W, 160);
  if (d.logoImage) ctx.drawImage(d.logoImage, 50, 36, 50, 50);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 16px Outfit';
  ctx.fillText('ARIAS GROUP • EXCLUSIVE REAL ESTATE', 115, 72);
  const bbTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 80);
  bbTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    drawShadowText(ctx, line, 50, panelY + 95 + i * 78, '#fff', '900 68px Playfair Display');
  });
  ctx.fillStyle = acc; ctx.font = '500 26px Outfit'; ctx.textAlign = 'left';
  ctx.fillText(d.subtitle || '', 50, panelY + 95 + bbTitleLines.length * 78 + 8);
  drawBenefits(ctx, d.beneficios || [], 50, panelY + 95 + bbTitleLines.length * 78 + 50, W - 100, acc, false, 2);
  drawCTA(ctx, d.cta || 'CONTACTANOS', W - 290, H - 80, 240, 54, acc, '#000');
  drawContact(ctx, d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', 50, H - 53, acc, false);
}

// ─── ENGINE 4: MAGAZINE EDITORIAL ────────────────────────────────────────────
function engine_magazine(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  if (d.bgImage) ctx.drawImage(d.bgImage, 0, 0, W, H); else { ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = acc; ctx.fillRect(0, 0, 12, H); ctx.fillStyle = acc; ctx.fillRect(0, 0, W, 4);
  const magTopGr = ctx.createLinearGradient(0, 0, 0, 200);
  magTopGr.addColorStop(0, 'rgba(0,0,0,0.85)'); magTopGr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = magTopGr; ctx.fillRect(0, 0, W, 200);
  if (d.logoImage) ctx.drawImage(d.logoImage, 30, 30, 50, 50);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '800 15px Outfit';
  ctx.fillText('ARIAS GROUP  EXCLUSIVE REAL ESTATE', 92, 62);
  ctx.fillStyle = acc; ctx.fillRect(92, 72, 320, 2);
  const magTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 60);
  magTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    drawShadowText(ctx, line, 30, H * 0.45 + i * 108, '#fff', '900 96px Playfair Display', 'rgba(0,0,0,0.9)', 30);
  });
  ctx.fillStyle = acc; ctx.font = '700 36px Outfit'; ctx.textAlign = 'left';
  ctx.fillText((d.subtitle || '').toUpperCase(), 30, H * 0.45 + magTitleLines.length * 108 + 16);
  drawBenefits(ctx, d.beneficios || [], 30, H * 0.45 + magTitleLines.length * 108 + 65, W - 60, acc, false, 2);
  drawCTA(ctx, d.cta || 'VER PROPIEDAD', W - 300, H - 80, 268, 56, acc, '#000');
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '600 17px Outfit'; ctx.textAlign = 'left';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', 30, H - 50);
}

// ─── ENGINE 5: CIRCULO FOTOGRAFICO ───────────────────────────────────────────
function engine_circle(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
  const cirGr = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, W * 0.8);
  cirGr.addColorStop(0, acc + '33'); cirGr.addColorStop(1, 'transparent');
  ctx.fillStyle = cirGr; ctx.fillRect(0, 0, W, H);
  const R = W * 0.42, cirCx = W * 0.28, cirCy = H * 0.38;
  ctx.save(); ctx.beginPath(); ctx.arc(cirCx, cirCy, R, 0, Math.PI * 2); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, cirCx - R, cirCy - R, R * 2, R * 2);
  else { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cirCx, cirCy, R, 0, Math.PI * 2); ctx.stroke();
  if (d.logoImage) ctx.drawImage(d.logoImage, W * 0.55, 50, 50, 50);
  ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.font = '700 14px Outfit';
  ctx.fillText('ARIAS GROUP EXCLUSIVE', W - 44, 82);
  const cirTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W * 0.45);
  ctx.font = '900 60px Playfair Display'; ctx.textAlign = 'right';
  cirTitleLines.slice(0, 3).forEach((line: string, i: number) => {
    ctx.fillStyle = i === 0 ? '#fff' : (i === 1 ? acc : '#94a3b8');
    ctx.fillText(line, W - 40, H * 0.35 + i * 70);
  });
  ctx.fillStyle = acc; ctx.fillRect(W * 0.55, H * 0.35 + cirTitleLines.length * 70 + 14, W * 0.41, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '400 22px Outfit'; ctx.textAlign = 'right';
  const cirSubLines = wrapText(ctx, d.subtitle || '', W * 0.44);
  cirSubLines.slice(0, 3).forEach((sl: string, ix: number) => ctx.fillText(sl, W - 40, H * 0.35 + cirTitleLines.length * 70 + 40 + ix * 30));
  drawBenefits(ctx, d.beneficios || [], W * 0.54, H * 0.65, W * 0.41, acc, false, 1);
  drawCTA(ctx, d.cta || 'CONTACTANOS', W - 280, H - 160, 238, 54, acc, '#000');
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '600 17px Outfit'; ctx.textAlign = 'right';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', W - 40, H - 55);
}

// ─── ENGINE 6: FRANJAS ───────────────────────────────────────────────────────
function engine_stripes(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H * 0.08);
  ctx.fillStyle = acc; ctx.fillRect(0, H * 0.08, W, H * 0.06);
  ctx.save(); ctx.beginPath(); ctx.rect(0, H * 0.14, W, H * 0.52); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, 0, H * 0.12, W, H * 0.56);
  else { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, W, H); }
  const strFadeGr = ctx.createLinearGradient(0, H * 0.54, 0, H * 0.66);
  strFadeGr.addColorStop(0, 'rgba(255,255,255,0)'); strFadeGr.addColorStop(1, '#fff');
  ctx.fillStyle = strFadeGr; ctx.fillRect(0, H * 0.54, W, H * 0.12);
  ctx.restore();
  ctx.fillStyle = acc; ctx.fillRect(0, H * 0.66, W, H * 0.04);
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, H * 0.70, W, H * 0.30);
  if (d.logoImage) ctx.drawImage(d.logoImage, 30, 8, 42, 42);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 15px Outfit';
  ctx.fillText('ARIAS GROUP EXCLUSIVE REAL ESTATE', 84, 40);
  const strTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 60);
  ctx.font = '900 64px Playfair Display';
  strTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    ctx.fillStyle = i === 0 ? '#fff' : acc; ctx.fillText(line, 40, H * 0.77 + i * 74);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '400 22px Outfit';
  ctx.fillText(d.subtitle || '', 40, H * 0.77 + strTitleLines.length * 74 + 10);
  drawBenefits(ctx, d.beneficios || [], 40, H * 0.77 + strTitleLines.length * 74 + 46, W - 80, acc, false, 2);
  drawCTA(ctx, d.cta || 'CONTACTANOS', W - 280, H - 70, 238, 50, acc, '#000');
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 16px Outfit';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', 40, H - 44);
}

// ─── ENGINE 7: CORNER BURST ──────────────────────────────────────────────────
function engine_cornerBurst(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.62); ctx.lineTo(0, H * 0.48); ctx.closePath(); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, 0, 0, W, H); else { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, W, H); }
  const cbGr2 = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  cbGr2.addColorStop(0, 'rgba(0,0,0,0.6)'); cbGr2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cbGr2; ctx.fillRect(0, 0, W, H * 0.62); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, H * 0.46); ctx.lineTo(W, H * 0.6); ctx.lineTo(W, H * 0.66); ctx.lineTo(0, H * 0.52); ctx.closePath(); ctx.fillStyle = acc; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, H * 0.50); ctx.lineTo(W, H * 0.64); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = '#0f172a'; ctx.fill(); ctx.restore();
  if (d.logoImage) ctx.drawImage(d.logoImage, 40, 36, 52, 52);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 15px Outfit';
  ctx.fillText('ARIAS GROUP EXCLUSIVE REAL ESTATE', 106, 70);
  const cbTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 80);
  cbTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    drawShadowText(ctx, line, 40, H * 0.72 + i * 78, '#fff', '900 70px Playfair Display');
  });
  ctx.fillStyle = acc; ctx.font = '500 28px Outfit'; ctx.textAlign = 'left';
  ctx.fillText(d.subtitle || '', 40, H * 0.72 + cbTitleLines.length * 78 + 12);
  drawBenefits(ctx, d.beneficios || [], 40, H * 0.72 + cbTitleLines.length * 78 + 52, W - 80, acc, false, 2);
  drawCTA(ctx, d.cta || 'CONTACTANOS', W - 288, H - 72, 246, 52, acc, '#000');
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 17px Outfit'; ctx.textAlign = 'left';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', 40, H - 42);
}

// ─── ENGINE 8: ARQUITECTONICO LIGHT ──────────────────────────────────────────
function engine_architectural(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = acc; ctx.fillRect(0, 0, W, 10);
  const archPX = W * 0.1, archPY = H * 0.08, archPW = W * 0.8, archPH = H * 0.44;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ddd'; roundRect(ctx, archPX, archPY, archPW, archPH, 12); ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx, archPX, archPY, archPW, archPH, 12); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, archPX, archPY, archPW, archPH);
  else { ctx.fillStyle = '#94a3b8'; ctx.fillRect(archPX, archPY, archPW, archPH); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = acc + 'cc';
  roundRect(ctx, archPX + archPW - 180, archPY + archPH - 60, 168, 48, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 14px Outfit'; ctx.textAlign = 'center';
  ctx.fillText(d.cta || 'VER DETALLES', archPX + archPW - 96, archPY + archPH - 28); ctx.restore();
  if (d.logoImage) ctx.drawImage(d.logoImage, archPX, H * 0.08 + archPH + 24, 40, 40);
  ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8'; ctx.font = '700 13px Outfit';
  ctx.fillText('ARIAS GROUP EXCLUSIVE REAL ESTATE', archPX + 52, H * 0.08 + archPH + 52);
  ctx.fillStyle = acc; ctx.fillRect(archPX, H * 0.08 + archPH + 72, 50, 4);
  const archTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W * 0.75);
  ctx.font = '900 68px Playfair Display';
  archTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    ctx.fillStyle = i === 0 ? '#0f172a' : acc; ctx.textAlign = 'left';
    ctx.fillText(line, archPX, H * 0.08 + archPH + 110 + i * 76);
  });
  const archAfter = H * 0.08 + archPH + 110 + archTitleLines.length * 76;
  ctx.fillStyle = '#64748b'; ctx.font = '400 22px Outfit';
  const archSubLines = wrapText(ctx, d.subtitle || '', W * 0.76);
  archSubLines.slice(0, 2).forEach((sl: string, ix: number) => ctx.fillText(sl, archPX, archAfter + 10 + ix * 30));
  drawBenefits(ctx, d.beneficios || [], archPX, archAfter + 10 + archSubLines.length * 30 + 22, W * 0.77, acc, true, 2);
  drawContact(ctx, d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', archPX, H - 46, acc, true);
}

// ─── ENGINE 9: LUXURY DARK ───────────────────────────────────────────────────
function engine_luxuryDark(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, W, H);
  const lxMeshGr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
  lxMeshGr.addColorStop(0, acc + '15'); lxMeshGr.addColorStop(1, 'transparent');
  ctx.fillStyle = lxMeshGr; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = acc + '20'; ctx.lineWidth = 1;
  for (let lxy = 0; lxy < H; lxy += 60) { ctx.beginPath(); ctx.moveTo(0, lxy); ctx.lineTo(W, lxy); ctx.stroke(); }
  const lxPH = H * 0.32, lxPY = H * 0.28;
  ctx.save(); ctx.beginPath(); ctx.rect(0, lxPY, W, lxPH); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, 0, lxPY - H * 0.18, W, H);
  else { ctx.fillStyle = '#1e293b'; ctx.fillRect(0, lxPY, W, lxPH); }
  const lxPhotoFade = ctx.createLinearGradient(0, lxPY, 0, lxPY + lxPH);
  lxPhotoFade.addColorStop(0, 'rgba(10,10,15,0.8)'); lxPhotoFade.addColorStop(0.4, 'rgba(10,10,15,0)');
  lxPhotoFade.addColorStop(0.6, 'rgba(10,10,15,0)'); lxPhotoFade.addColorStop(1, 'rgba(10,10,15,0.9)');
  ctx.fillStyle = lxPhotoFade; ctx.fillRect(0, lxPY, W, lxPH); ctx.restore();
  ctx.strokeStyle = acc; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W * 0.15, lxPY); ctx.lineTo(W * 0.85, lxPY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.15, lxPY + lxPH); ctx.lineTo(W * 0.85, lxPY + lxPH); ctx.stroke();
  if (d.logoImage) ctx.drawImage(d.logoImage, W / 2 - 28, 32, 56, 56);
  ctx.textAlign = 'center'; ctx.fillStyle = acc; ctx.font = '700 14px Outfit';
  ctx.fillText('ARIAS GROUP EXCLUSIVE', W / 2, 110);
  const lxTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 80);
  ctx.font = '900 74px Playfair Display';
  lxTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    ctx.fillStyle = i === 0 ? '#fff' : acc; ctx.fillText(line, W / 2, H * 0.18 + i * 82);
  });
  const lxAfter = lxPY + lxPH + 40;
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '400 24px Outfit'; ctx.textAlign = 'center';
  ctx.fillText(d.subtitle || '', W / 2, lxAfter);
  if (d.beneficios?.length) {
    d.beneficios.slice(0, 3).forEach((b: string, i: number) => {
      ctx.fillStyle = acc; ctx.font = '600 20px Outfit';
      ctx.fillText(`— ${b} —`, W / 2, lxAfter + 42 + i * 34);
    });
  }
  drawCTA(ctx, d.cta || 'VER PROPIEDAD', W / 2 - 140, H - 145, 280, 58, acc, '#000');
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '600 17px Outfit'; ctx.textAlign = 'center';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', W / 2, H - 55);
}

// ─── ENGINE 10: BOLD GRADIENT ELIPSE ─────────────────────────────────────────
function engine_boldGradient(ctx: CanvasRenderingContext2D, W: number, H: number, d: any) {
  const acc = d.accent || '#D4AF37';
  const bgGr = ctx.createLinearGradient(0, 0, W, H);
  bgGr.addColorStop(0, '#0f172a'); bgGr.addColorStop(0.5, acc + 'bb'); bgGr.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGr; ctx.fillRect(0, 0, W, H);
  const bgOX = W / 2, bgOY = H * 0.36, bgORx = W * 0.36, bgORy = H * 0.28;
  ctx.save(); ctx.beginPath(); ctx.ellipse(bgOX, bgOY, bgORx, bgORy, 0, 0, Math.PI * 2); ctx.clip();
  if (d.bgImage) ctx.drawImage(d.bgImage, bgOX - bgORx, bgOY - bgORy, bgORx * 2, bgORy * 2);
  else { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(bgOX, bgOY, bgORx + 4, bgORy + 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = acc; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(bgOX, bgOY, bgORx + 14, bgORy + 14, 0, 0, Math.PI * 2); ctx.stroke();
  if (d.logoImage) ctx.drawImage(d.logoImage, W / 2 - 24, 22, 48, 48);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 15px Outfit';
  ctx.fillText('ARIAS GROUP EXCLUSIVE REAL ESTATE', W / 2, 85);
  const bgTitleLines = wrapText(ctx, (d.title || '').toUpperCase(), W - 80);
  bgTitleLines.slice(0, 2).forEach((line: string, i: number) => {
    drawShadowText(ctx, line, W / 2, H * 0.68 + i * 80, i === 0 ? '#fff' : acc, '900 70px Playfair Display', 'rgba(0,0,0,0.9)', 25);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '400 26px Outfit'; ctx.textAlign = 'center';
  ctx.fillText(d.subtitle || '', W / 2, H * 0.68 + bgTitleLines.length * 80 + 10);
  if (d.beneficios?.length) {
    ctx.font = '600 19px Outfit'; ctx.fillStyle = '#fff';
    d.beneficios.slice(0, 2).forEach((b: string, i: number) => ctx.fillText(`◆ ${b}`, W / 2, H * 0.68 + bgTitleLines.length * 80 + 50 + i * 32));
  }
  drawCTA(ctx, d.cta || 'CONTACTANOS', W / 2 - 130, H - 135, 260, 56, '#fff', '#0f172a');
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '600 17px Outfit'; ctx.textAlign = 'center';
  ctx.fillText(d.contact?.whatsapp || profile_phone || '+503 7XXX-XXXX', W / 2, H - 55);
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
