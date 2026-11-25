import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.cwd();
const SCRATCH_SHOTS =
  'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch/screenshots';
const OUT_PDF = path.join(WORKSPACE, 'docs', 'SOP_Gestion_Tickets_Chat_WhatsApp_Equipo.pdf');
const TMP_HTML = path.join(
  'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch',
  'sop_tickets_workflow.html'
);

function resolveChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No se encontró Chrome ni Edge para renderizar PDF');
}

function loadShot(name) {
  const full = path.join(SCRATCH_SHOTS, name);
  return `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
}

const sActivos = loadShot('tickets_activos_limpio.png');
const sCompletados = loadShot('tickets_completados.png');
const sPanelSolucion = loadShot('ticket_panel_solucion.png');
const sCrearModal = loadShot('chat_crear_ticket_modal.png');
const sBusquedaGlobal = loadShot('tickets_busqueda_global.png');

const commonHead = (title) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    color: #111827;
    background: #ffffff;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .page {
    width: 8.5in;
    height: 11in;
    padding: 0.42in 0.60in 0.40in 0.60in;
    position: relative;
    page-break-after: always;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .page:last-child { page-break-after: auto; }
  .top-rule {
    border-top: 2.2px solid #991B2B;
    padding-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #111827; }
  .doc-code { font-size: 9.5px; color: #475569; font-weight: 500; }
  .kicker {
    font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    color: #991B2B; margin-bottom: 5px;
  }
  .cover-title {
    font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.12; letter-spacing: -0.02em;
    margin-bottom: 10px;
  }
  .cover-sub { font-size: 13px; color: #334155; font-weight: 500; margin-bottom: 24px; line-height: 1.4; }
  h1.sec-h1 { font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.015em; margin-bottom: 5px; }
  p.lead-p { font-size: 10.5px; color: #475569; line-height: 1.48; margin-bottom: 12px; }
  p.body-p { font-size: 9.8px; color: #1f2937; line-height: 1.48; margin-bottom: 8px; }
  h3.sub-h { font-size: 11.5px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; }
  .step-hdr { font-size: 10.8px; font-weight: 800; color: #0f172a; margin: 8px 0 4px 0; }
  .step-hdr .num { color: #991B2B; margin-right: 4px; }
  table.inst { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.3px; }
  table.inst th {
    background: #142136; color: #ffffff; text-align: left; padding: 7px 10px;
    font-size: 8.8px; font-weight: 700;
  }
  table.inst td {
    padding: 6.5px 10px; border-bottom: 1px solid #cbd5e1; color: #1f2937; vertical-align: top; line-height: 1.38;
  }
  table.inst tr:nth-child(even) td { background: #f8fafc; }
  .kv-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 9.8px; }
  .kv-table td { padding: 7.5px 10px; border-bottom: 1px solid #cbd5e1; }
  .kv-table tr:nth-child(odd) td { background: #f8fafc; }
  .kv-key { width: 34%; color: #475569; font-weight: 500; }
  .kv-val { color: #0f172a; font-weight: 600; }
  .diagram-wrap {
    margin: 12px 0 12px 0;
  }
  .shot-frame {
    position: relative;
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    overflow: visible;
    line-height: 0;
    margin: 10px 0 6px 0;
    background: #ffffff;
  }
  .shot-frame.compact {
    width: 88%;
    margin: 10px auto 6px auto;
  }
  .shot-frame img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 2px;
  }
  .callout-box {
    position: absolute;
    border: 2.2px solid #B91C1C;
    border-radius: 3px;
    background: rgba(185, 28, 28, 0.05);
    pointer-events: none;
    z-index: 2;
  }
  .callout-tag {
    position: absolute;
    top: -15px;
    left: -1px;
    background: #991B2B;
    color: #ffffff;
    font-size: 7.4px;
    font-weight: 800;
    padding: 2px 6px;
    line-height: 1.15;
    border-radius: 2px;
    white-space: nowrap;
  }
  .callout-tag.bottom {
    top: auto;
    bottom: -15px;
  }
  .callout-tag.right {
    left: auto;
    right: -1px;
  }
  .callout-tag.out-left {
    top: 2px;
    left: auto;
    right: calc(100% + 6px);
  }
  .callout-tag.out-right {
    top: 2px;
    left: calc(100% + 6px);
    right: auto;
  }
  .fig-cap { font-size: 8.5px; color: #64748b; margin-top: 10px; margin-bottom: 8px; line-height: 1.35; }
  .rules-list { list-style: none; margin: 5px 0 12px 0; }
  .rules-list li { font-size: 9.5px; color: #1f2937; margin-bottom: 5px; line-height: 1.42; }
  .rules-list li strong { color: #0f172a; }
  .info-box {
    background: #f8fafc;
    border-left: 3px solid #142136;
    padding: 9px 12px;
    margin: 10px 0;
    font-size: 9.5px;
    color: #1f2937;
    line-height: 1.45;
  }
  .alert-box {
    background: #fef2f2;
    border-left: 3px solid #991B2B;
    padding: 9px 12px;
    margin: 10px 0;
    font-size: 9.5px;
    color: #1f2937;
    line-height: 1.45;
  }
  .privacy-title { font-size: 9.8px; font-weight: 800; color: #991B2B; margin: 10px 0 3px 0; }
  .footer-rule {
    border-top: 1px solid #cbd5e1;
    padding-top: 7px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #64748b;
  }
</style>
</head>
<body>`;

const hdr = (code = 'SOP-SOP-2026-01 | Uso interno') => `
  <div class="top-rule">
    <span class="brand">ARIAS GROUP</span>
    <span class="doc-code">${code}</span>
  </div>`;

const ftr = (page, total) => `
  <div class="footer-rule">
    <span>Soporte Técnico &amp; Equipo Comercial / Versión 1.1 · Documentación operativa</span>
    <span>${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`;

const TOTAL_PAGES = 8;

const html = `${commonHead('SOP-SOP-2026-01 — Gestión Estructurada de Tickets WhatsApp y Autoservicio Comercial')}

<!-- PAGE 1: COVER -->
<section class="page">
  <div>
    ${hdr()}
    <div style="margin-top:28px;">
      <div class="kicker">SERVICE HUB / PROCEDIMIENTO ESTÁNDAR DE OPERACIÓN</div>
      <div class="cover-title">Gestión de Tickets Técnicos desde<br/>Chat WhatsApp y Seguimiento Comercial</div>
      <div class="cover-sub">Creación estructurada (<em>Módulo — Problema</em>), notificaciones automáticas por Campana y Email, y consulta autoservicio de casos <strong>Completados</strong></div>

      <div class="kicker" style="margin-top:20px;">CONTROL DOCUMENTAL</div>
      <table class="kv-table">
        <tr><td class="kv-key">Código</td><td class="kv-val">SOP-SOP-2026-01</td></tr>
        <tr><td class="kv-key">Versión</td><td class="kv-val">1.1 · Desplegado en producción (ariascrm.com)</td></tr>
        <tr><td class="kv-key">Fecha de vigencia</td><td class="kv-val">24 de noviembre de 2026 (Actualización v1.1: Enlace directo + Buscador global)</td></tr>
        <tr><td class="kv-key">Áreas usuarias</td><td class="kv-val">Soporte Técnico, Desarrollo y Equipo Comercial (Diana, Patricia, Grecia)</td></tr>
        <tr><td class="kv-key">Alcance técnico</td><td class="kv-val">Chat WhatsApp (/support/chat), Service Hub (/support/tickets), Deep-link ?ticket=, Edge Functions &amp; Notificaciones</td></tr>
      </table>

      <h3 class="sub-h">Responsables y roles en el flujo</h3>
      <table class="inst">
        <thead>
          <tr><th style="width:32%;">Rol / Equipo</th><th style="width:68%;">Responsabilidad operativa clave</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Soporte Técnico (Chat WA)</strong></td><td>Atender consultas diarias en Chat WhatsApp y escalar únicamente fallas reales mediante el botón <em>Crear Ticket Técnico</em> con título <code>Módulo — Problema</code>.</td></tr>
          <tr><td><strong>Desarrollo / Ingeniería</strong></td><td>Tomar tickets en <em>Ticket Generado</em>, pasarlos a <em>En Proceso</em> al iniciar diagnóstico y registrar Hallazgos, Causa Raíz y <strong>Solución Aplicada</strong> para marcarlos <em>Completado</em>.</td></tr>
          <tr><td><strong>Equipo Comercial (Diana, Patricia, Grecia)</strong></td><td>Recibir alertas por Campana y Email en cada cambio de estado y consultar en segundos la pestaña <em>Completados</em> cuando un cliente pregunte por su caso.</td></tr>
          <tr><td><strong>Supervisión / Admin</strong></td><td>Mantener el tablero limpio sin basura operativa usando el filtro humano y, de ser necesario, la herramienta segura <em>Limpiar Auto-WA</em>.</td></tr>
        </tbody>
      </table>

      <div class="privacy-title">Uso interno y confidencialidad</div>
      <p class="body-p" style="color:#475569;">Documento de distribución interna para Arias Group y colaboradores autorizados. Las pantallas mostradas corresponden al entorno operativo de Arias CRM; la limpieza de tickets basura no elimina mensajes ni historial de conversaciones WhatsApp.</p>
    </div>
  </div>
  ${ftr(1, TOTAL_PAGES)}
</section>

<!-- PAGE 2: 01 / MARCO OPERATIVO & DIAGRAMA DE FLUJO -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">01 / ARQUITECTURA Y REGLA DE ORO</div>
    <h1 class="sec-h1">Por qué cambiamos el flujo: cero basura, 100% trazabilidad</h1>
    <p class="lead-p">Todo mensaje de cliente entra primero como conversación en <strong>Chat WhatsApp</strong>; únicamente un humano escala problemas técnicos reales.</p>

    <div class="alert-box">
      <strong>Regla de Oro operativa:</strong> Ningún mensaje o nota de voz entrante de WhatsApp crea un ticket técnico automático en <code>/support/tickets</code>. Saludos, dudas rápidas, agradecimientos y audios se atienden en <strong>Chat WhatsApp</strong> con todo su historial intacto, evitando alertas rojas falsas de SLA y ruido para desarrolladores y asesores comerciales.
    </div>

    <div class="diagram-wrap">
      <svg viewBox="0 0 680 250" width="100%" height="236" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
          </marker>
        </defs>
        <!-- Row 1 -->
        <rect x="14" y="14" width="142" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="85" y="34" text-anchor="middle" font-size="9.8" font-weight="700" fill="#0f172a">1. Mensaje WhatsApp</text>
        <text x="85" y="48" text-anchor="middle" font-size="8.3" fill="#475569">Texto, audio o imagen</text>
        <text x="85" y="59" text-anchor="middle" font-size="8.0" fill="#991B2B" font-weight="700">Solo Chat (0 basura)</text>

        <line x1="157" y1="41" x2="188" y2="41" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <polygon points="258,10 328,41 258,72 188,41" fill="#ffffff" stroke="#142136" stroke-width="1.5"/>
        <text x="258" y="38" text-anchor="middle" font-size="8.8" font-weight="700" fill="#0f172a">¿Falla real</text>
        <text x="258" y="50" text-anchor="middle" font-size="8.8" font-weight="700" fill="#0f172a">escalable?</text>

        <line x1="258" y1="73" x2="258" y2="108" stroke="#64748b" stroke-width="1.3" marker-end="url(#arr1)"/>
        <text x="266" y="95" font-size="8.2" font-weight="700" fill="#64748b">NO (Duda / Saludo)</text>

        <rect x="172" y="110" width="172" height="44" rx="5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="258" y="129" text-anchor="middle" font-size="9.2" font-weight="700" fill="#334155">Se resuelve en Chat WA</text>
        <text x="258" y="143" text-anchor="middle" font-size="8.2" fill="#64748b">No contamina Service Hub</text>

        <line x1="329" y1="41" x2="365" y2="41" stroke="#991B2B" stroke-width="1.5" marker-end="url(#arr1)"/>
        <text x="347" y="33" text-anchor="middle" font-size="8.2" font-weight="800" fill="#991B2B">SÍ</text>

        <rect x="368" y="14" width="146" height="54" rx="5" fill="#fef2f2" stroke="#991B2B" stroke-width="1.4"/>
        <text x="441" y="34" text-anchor="middle" font-size="9.5" font-weight="800" fill="#991B2B">2. Modal IA Ticket</text>
        <text x="441" y="48" text-anchor="middle" font-size="8.2" fill="#1f2937">Módulo — Problema</text>
        <text x="441" y="59" text-anchor="middle" font-size="8.0" fill="#475569">+ Watchers Comerciales</text>

        <line x1="515" y1="41" x2="545" y2="41" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <rect x="548" y="14" width="120" height="54" rx="5" fill="#eff6ff" stroke="#1d4ed8" stroke-width="1.4"/>
        <text x="608" y="34" text-anchor="middle" font-size="9.5" font-weight="800" fill="#1d4ed8">3. Ticket Generado</text>
        <text x="608" y="48" text-anchor="middle" font-size="8.1" fill="#1e3a8a">Campana + Email</text>
        <text x="608" y="59" text-anchor="middle" font-size="7.9" fill="#475569">al equipo comercial</text>

        <!-- Vertical connector down to Row 2 -->
        <path d="M 608 69 L 608 176 L 548 176" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <!-- Row 2 (right to left flow ending at Self-service) -->
        <rect x="394" y="150" width="152" height="54" rx="5" fill="#eef2ff" stroke="#4338ca" stroke-width="1.4"/>
        <text x="470" y="170" text-anchor="middle" font-size="9.5" font-weight="800" fill="#312e81">4. En Proceso</text>
        <text x="470" y="184" text-anchor="middle" font-size="8.2" fill="#3730a3">Dev asignado trabajando</text>
        <text x="470" y="196" text-anchor="middle" font-size="8.0" fill="#475569">Dispara Campana + Email</text>

        <line x1="393" y1="177" x2="363" y2="177" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <rect x="196" y="150" width="165" height="54" rx="5" fill="#ecfdf5" stroke="#047857" stroke-width="1.5"/>
        <text x="278" y="170" text-anchor="middle" font-size="9.5" font-weight="800" fill="#065f46">5. Completado ✓</text>
        <text x="278" y="184" text-anchor="middle" font-size="8.2" fill="#064e3b">Solución Aplicada obligatoria</text>
        <text x="278" y="196" text-anchor="middle" font-size="8.0" fill="#047857" font-weight="700">Dispara Campana + Email</text>

        <line x1="195" y1="177" x2="164" y2="177" stroke="#047857" stroke-width="1.5" marker-end="url(#arr1)"/>

        <rect x="14" y="150" width="148" height="54" rx="5" fill="#142136" stroke="#142136" stroke-width="1.3"/>
        <text x="88" y="169" text-anchor="middle" font-size="9.3" font-weight="800" fill="#ffffff">6. Consulta Comercial</text>
        <text x="88" y="183" text-anchor="middle" font-size="8.0" fill="#e2e8f0">Tab Completados / Buscar</text>
        <text x="88" y="195" text-anchor="middle" font-size="7.9" fill="#a7f3d0">Diana, Patricia y Grecia</text>
      </svg>
    </div>

    <h3 class="sub-h">Resumen de beneficios por área</h3>
    <table class="inst">
      <thead>
        <tr><th style="width:24%;">Área</th><th style="width:38%;">Antes (Problema)</th><th style="width:38%;">Ahora (Nuevo Estándar)</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Soporte WhatsApp</strong></td><td>Chats de saludo o duda rápida abrían tickets rojos sin categoría ni dueño.</td><td>Todo entra como conversación; solo se crea ticket si el agente presiona <em>Crear Ticket Técnico</em>.</td></tr>
        <tr><td><strong>Desarrollo</strong></td><td>Títulos incomprensibles como <em>"Les de Dios, yo aquí molestando..."</em>.</td><td>Título obligatorio con IA: <code>Módulo — Problema concreto</code> + resumen técnico limpio.</td></tr>
        <tr><td><strong>Equipo Comercial</strong></td><td>Diana, Patricia y Grecia debían preguntar por chat a desarrollo cómo iba cada caso.</td><td>Reciben Campana + Email en vivo y consultan la pestaña <strong>Completados</strong> al instante.</td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(2, TOTAL_PAGES)}
</section>

<!-- PAGE 3: 02 / CREAR TICKET TÉCNICO DESDE CHAT WHATSAPP -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">02 / PROCEDIMIENTO PARA SOPORTE Y ATENCIÓN</div>
    <h1 class="sec-h1">Cómo escalar un chat de WhatsApp a Ticket Técnico</h1>
    <p class="lead-p">Usa el modal asistido por IA para redactar títulos precisos con formato <strong>Módulo — Problema concreto</strong> y suscribir al equipo comercial.</p>

    <div class="step-hdr"><span class="num">01 ·</span> Abrir el modal desde la conversación en Chat WhatsApp</div>
    <p class="body-p">Dentro de <strong>Service Hub → Chat WhatsApp</strong>, abre el chat del cliente y verifica que realmente exista una falla o ajuste técnico del ERP. Haz clic en <strong>Crear Ticket Técnico</strong> (barra superior o panel lateral derecho).</p>

    <div class="step-hdr"><span class="num">02 ·</span> Revisar el borrador IA, definir Módulo — Problema y notificar al equipo</div>
    <p class="body-p">La IA lee los últimos mensajes y pre-llena automáticamente el <strong>Módulo</strong>, el <strong>Problema concreto</strong> (sin saludos ni relleno) y el <strong>Resumen técnico</strong>. Selecciona Categoría SLA, Prioridad, Responsable y verifica que las asesoras comerciales (Diana, Patricia, Grecia) estén marcadas antes de pulsar <strong>Generar Ticket y Notificar</strong>.</p>

    <div class="shot-frame compact">
      <img src="${sCrearModal}" alt="Modal Crear Ticket Técnico Formal desde Chat WhatsApp" />
      <div class="callout-box" style="left:31.2%;top:19.2%;width:37.6%;height:8.0%;"><span class="callout-tag out-left">1. Vista previa (Módulo — Problema)</span></div>
      <div class="callout-box" style="left:31.2%;top:28.7%;width:37.6%;height:7.8%;"><span class="callout-tag out-right">2. Módulo y Problema concreto</span></div>
      <div class="callout-box" style="left:31.2%;top:37.9%;width:37.6%;height:12.4%;"><span class="callout-tag out-left">3. Resumen técnico generado por IA</span></div>
      <div class="callout-box" style="left:31.2%;top:66.8%;width:37.6%;height:14.2%;"><span class="callout-tag out-left">4. Suscriptores (Campana + Email)</span></div>
      <div class="callout-box" style="left:52.9%;top:83.6%;width:15.8%;height:5.0%;"><span class="callout-tag out-right">5. Generar y Notificar</span></div>
    </div>
    <div class="fig-cap">Figura 1. Modal <em>Crear Ticket Técnico Formal</em> invocado desde Chat WhatsApp con extracción asistida por IA y selección de seguidores.</div>
  </div>
  ${ftr(3, TOTAL_PAGES)}
</section>

<!-- PAGE 4: 03 / ESTÁNDAR DE TÍTULOS + VALIDACIONES -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">03 / ESTÁNDAR DE CALIDAD DE TÍTULOS</div>
    <h1 class="sec-h1">Reglas de redacción: Módulo — Problema concreto</h1>
    <p class="lead-p">Cualquier asesor o técnico debe entender qué falla y qué módulo afecta leyendo solo la primera línea del ticket.</p>

    <p class="body-p">El sistema bloquea títulos ambiguos o que sean únicamente un saludo (<em>"Hola buenas tardes"</em>, <em>"Ayuda por favor"</em>, <em>"Ok gracias"</em>). Todo ticket generado desde chat o manualmente en <strong>Service Hub → Tickets → Nuevo Ticket</strong> debe respetar la fórmula:</p>
    <div class="info-box">
      <strong>Fórmula obligatoria:</strong> <code>[Módulo del sistema] — [Qué falla o qué acción no se completa con precisión]</code><br/>
      <strong>Ejemplo modelo:</strong> <code>Inventario — No reduce las cantidades del inventario al facturar</code>
    </div>

    <h3 class="sub-h">Comparativa práctica: títulos rechazados vs. títulos institucionales</h3>
    <table class="inst">
      <thead>
        <tr><th style="width:18%;">Módulo</th><th style="width:39%;">Incorrecto (Lo que nunca debe guardarse)</th><th style="width:43%;">Correcto (Estándar Arias CRM)</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Inventario</strong></td><td><em>"Hola muchachos me ayudan urgente"</em></td><td><code>Inventario — No reduce las cantidades del inventario al facturar</code></td></tr>
        <tr><td><strong>Facturación DTE</strong></td><td><em>"Les de Dios, no encuentro estas facturas"</em></td><td><code>Facturación DTE — Error al consultar DTE emitidos del día viernes</code></td></tr>
        <tr><td><strong>Accesos / Usuarios</strong></td><td><em>"Eso dice Wendy, que no puede hacer"</em></td><td><code>Accesos / Usuarios — Usuario de Prototal sin permiso de emisión CCF</code></td></tr>
        <tr><td><strong>POS / Caja</strong></td><td><em>"Se quedó pegado el ticket de venta"</em></td><td><code>POS / Caja — No imprime comprobante tras cerrar venta en caja 2</code></td></tr>
        <tr><td><strong>Contabilidad</strong></td><td><em>"Revisar libro por favor gracias"</em></td><td><code>Contabilidad — Libro de ventas no incluye notas de crédito anuladas</code></td></tr>
        <tr><td><strong>Reportes</strong></td><td><em>"Baltazar pregunta por un reporte"</em></td><td><code>Reportes — Exportación Excel de ventas sale en blanco para marzo</code></td></tr>
      </tbody>
    </table>

    <h3 class="sub-h">Checklist antes de presionar "Generar Ticket y Notificar"</h3>
    <ul class="rules-list">
      <li><strong>1. ¿Es falla real o configuración técnica?</strong> Si es solo saludo o pregunta rápida de uso, respóndelo en <strong>Chat WhatsApp</strong> y no generes ticket.</li>
      <li><strong>2. ¿Se entiende sin abrir el chat?</strong> Verifica en la <em>Vista previa en Service Hub</em> que el título especifique módulo y falla exacta.</li>
      <li><strong>3. ¿Están las comerciales suscritas?</strong> Deja seleccionadas a <strong>Diana, Patricia y Grecia</strong> (o la asesora de la cuenta) para que reciban avisos automáticos sin tener que preguntar.</li>
    </ul>
  </div>
  ${ftr(4, TOTAL_PAGES)}
</section>

<!-- PAGE 5: 04 / CICLO DE ESTADOS Y NOTIFICACIONES -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">04 / CICLO DE VIDA Y TABLERO LIMPIO</div>
    <h1 class="sec-h1">Estados oficiales, notificaciones y bandeja operativa</h1>
    <p class="lead-p">Cada transición clave actualiza al equipo comercial automáticamente por <strong>Campana interna</strong> y <strong>Correo electrónico</strong>.</p>

    <table class="inst">
      <thead>
        <tr><th style="width:18%;">Estado</th><th style="width:30%;">Significado operativo</th><th style="width:24%;">Notificación automática</th><th style="width:28%;">Responsable del cambio</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Ticket Generado</strong></td><td>Caso formal creado desde Chat WhatsApp o Nuevo Ticket, listo para asignación.</td><td><strong>Campana + Email</strong> a creador, técnico y seguidores.</td><td>Soporte Técnico / Asesor</td></tr>
        <tr><td><strong>En Proceso</strong></td><td>El desarrollador o especialista ya tomó el caso y está trabajando en la solución.</td><td><strong>Campana + Email</strong> anunciando que el caso está en atención.</td><td>Desarrollador asignado</td></tr>
        <tr><td><strong>En Espera</strong></td><td>Pausado esperando información del cliente, credenciales o validación externa.</td><td>Visible en tablero (sin envío repetitivo de correo).</td><td>Soporte / Desarrollador</td></tr>
        <tr><td><strong>Completado</strong></td><td>Falla corregida; incluye Horas reales, Hallazgos, Causa Raíz y <strong>Solución Aplicada</strong>.</td><td><strong>Campana + Email</strong> con el texto completo de la solución y enlace directo.</td><td>Desarrollador / Soporte</td></tr>
        <tr><td><strong>Cerrado</strong></td><td>Archivado administrativo final (también usado al limpiar conversaciones de Solo Chat).</td><td>Sin correo adicional (historial consultable).</td><td>Admin / Soporte</td></tr>
      </tbody>
    </table>

    <div class="shot-frame compact">
      <img src="${sActivos}" alt="Tablero Service Hub Activos limpio con nuevos estados" />
      <div class="callout-box" style="left:64.5%;top:1.5%;width:10.5%;height:4.4%;"><span class="callout-tag bottom">1. Limpiar Auto-WA</span></div>
      <div class="callout-box" style="left:42.2%;top:47.9%;width:21.5%;height:3.8%;"><span class="callout-tag">2. Vistas rápidas: Activos / Completados / Todos</span></div>
      <div class="callout-box" style="left:22.4%;top:52.2%;width:31.2%;height:3.8%;"><span class="callout-tag bottom">3. Estados estandarizados</span></div>
      <div class="callout-box" style="left:20.4%;top:64.0%;width:75.5%;height:21.2%;"><span class="callout-tag bottom">4. Solo tickets técnicos reales y asignables</span></div>
    </div>
    <div class="fig-cap">Figura 2. Vista <em>Activos</em> de Service Hub tras eliminar auto-tickets basura (de 82 a 49 casos reales sin borrar chats WhatsApp).</div>
  </div>
  ${ftr(5, TOTAL_PAGES)}
</section>

<!-- PAGE 6: 05 / GUÍA AUTOSERVICIO EQUIPO COMERCIAL (COMPLETADOS) -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">05 / GUÍA RÁPIDA PARA EQUIPO COMERCIAL (DIANA, PATRICIA, GRECIA)</div>
    <h1 class="sec-h1">Cómo buscar tickets Completados sin preguntar al dev</h1>
    <p class="lead-p">Cuando un cliente pregunte por teléfono o WhatsApp qué pasó con su reporte, consulta la respuesta en menos de 10 segundos.</p>

    <div class="step-hdr"><span class="num">01 ·</span> Entrar a Service Hub → Tickets y pulsar la pestaña Completados</div>
    <p class="body-p">Abre <strong>Service Hub → Tickets</strong> y haz clic en el botón superior <strong>COMPLETADOS</strong>. Allí aparecen ordenados del más reciente al más antiguo los tickets finalizados. Escribe el <strong>nombre del cliente</strong>, el <strong>módulo</strong>, una palabra clave de la falla o el código <code>#ID</code> en <strong>Buscar #ID, cliente, módulo...</strong>.</p>

    <div class="shot-frame compact">
      <img src="${sCompletados}" alt="Vista Completados con búsqueda y vista previa verde de solución" />
      <div class="callout-box" style="left:49.0%;top:45.6%;width:9.2%;height:4.2%;"><span class="callout-tag">1. Pestaña Completados</span></div>
      <div class="callout-box" style="left:81.5%;top:47.7%;width:12.6%;height:4.6%;"><span class="callout-tag right">2. Buscador instantáneo</span></div>
      <div class="callout-box" style="left:22.2%;top:72.0%;width:31.2%;height:5.8%;"><span class="callout-tag bottom">3. Vista previa verde de la Solución en la lista</span></div>
      <div class="callout-box" style="left:22.0%;top:83.2%;width:57.6%;height:11.4%;"><span class="callout-tag bottom">4. Fila con categoría y badge de resolución documentada</span></div>
    </div>
    <div class="fig-cap">Figura 3. La pestaña <em>Completados</em> muestra la caja verde <strong>✓ Solución:</strong> directamente en la tabla para lectura inmediata.</div>
  </div>
  ${ftr(6, TOTAL_PAGES)}
</section>

<!-- PAGE 7: 06 / BUSCADOR GLOBAL Y ENLACE DIRECTO DESDE CORREO -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">06 / ACTUALIZACIÓN v1.1 · BUSCADOR GLOBAL Y DEEP-LINK DIRECTO</div>
    <h1 class="sec-h1">Encontrar cualquier ticket por #ID y abrir directo desde el correo</h1>
    <p class="lead-p">Mejora desplegada para evitar búsquedas vacías al cambiar de pestaña o enlaces que detenían al usuario en el login.</p>

    <div class="step-hdr"><span class="num">01 ·</span> Buscador global multiestado (sin importar la pestaña activa)</div>
    <p class="body-p">Al escribir un código como <code>8295</code> o <code>#8295834D</code>, el cliente, el módulo o la solución en <strong>Buscar #ID, cliente, módulo...</strong>, el CRM busca automáticamente en <strong>todos los estados</strong> (<em>Activos + Completados</em>) ignorando tildes y el símbolo <code>#</code>, y muestra la insignia <strong>BUSCANDO EN TODOS LOS ESTADOS</strong> para confirmar el alcance global.</p>

    <div class="shot-frame compact">
      <img src="${sBusquedaGlobal}" alt="Buscador global por código 8295 encontrando ticket activo desde pestaña Completados" />
      <div class="callout-box" style="left:79.2%;top:48.0%;width:15.0%;height:4.8%;"><span class="callout-tag">1. Buscador (8295)</span></div>
      <div class="callout-box" style="left:72.9%;top:46.2%;width:5.8%;height:8.0%;"><span class="callout-tag bottom right">2. Busca en Activos + Completados</span></div>
      <div class="callout-box" style="left:69.1%;top:75.0%;width:5.4%;height:5.0%;"><span class="callout-tag bottom right">3. Estado real (Generado)</span></div>
      <div class="callout-box" style="left:22.6%;top:66.8%;width:72.4%;height:20.4%;"><span class="callout-tag bottom">4. Ticket #8295834D encontrado al instante aun estando en Completados</span></div>
    </div>
    <div class="fig-cap" style="margin-bottom:8px;">Figura 4. Búsqueda real en producción con el código <code>8295</code>: estando en la pestaña <em>Completados</em>, el buscador localiza el ticket <code>#8295834D</code>.</div>

    <div class="info-box" style="margin-top:4px;">
      <strong>02 · Botón “Ver Ticket en Arias CRM” en el correo (ariascrm.com + post-login automático):</strong><br/>
      Todos los correos de notificación apuntan ahora siempre al dominio oficial <code>https://ariascrm.com/support/tickets?ticket=&lt;UUID&gt;</code> (nunca a URLs de preview de Vercel). Si tu sesión estaba cerrada, iniciarás sesión en <code>/login</code> y el sistema te redirigirá de forma automática al ticket exacto abierto en pantalla.
    </div>
  </div>
  ${ftr(7, TOTAL_PAGES)}
</section>

<!-- PAGE 8: 07 / DETALLE DE SOLUCIÓN, SEGUIDORES Y FUTURA FASE 2 -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">07 / DETALLE DE SOLUCIÓN Y HOJA DE RUTA</div>
    <h1 class="sec-h1">Leer la Solución Aplicada y gestionar suscriptores</h1>
    <p class="lead-p">Al hacer clic en un ticket (o abrir el enlace que llega por correo/campana), se despliega el detalle completo a la derecha.</p>

    <div class="shot-frame compact">
      <img src="${sPanelSolucion}" alt="Panel lateral del ticket mostrando Solución Aplicada y Notificar Cambios" />
      <div class="callout-box" style="left:59.5%;top:11.4%;width:39.0%;height:5.5%;"><span class="callout-tag out-left">1. Progreso (Generado → Completado)</span></div>
      <div class="callout-box" style="left:60.0%;top:24.8%;width:18.2%;height:7.8%;"><span class="callout-tag out-left">2. Estado: Completado</span></div>
      <div class="callout-box" style="left:59.8%;top:33.8%;width:37.5%;height:17.2%;"><span class="callout-tag out-left">3. Solución Aplicada (lista para cliente)</span></div>
      <div class="callout-box" style="left:59.8%;top:52.2%;width:37.5%;height:11.2%;"><span class="callout-tag out-left">4. Suscriptores Campana + Email</span></div>
    </div>
    <div class="fig-cap" style="margin-bottom:8px;">Figura 5. Panel lateral de detalle: bloque verde <em>Solución Aplicada</em> listo para copiar o parafrasear al cliente y chips de notificación.</div>

    <h3 class="sub-h" style="margin-top:6px;">Recomendación de seguridad y Fase 2 futura (WhatsApp directo al cliente)</h3>
    <ul class="rules-list">
      <li><strong>Por qué hoy notificamos internamente primero:</strong> Campana + Email protegen la carga del servidor de WhatsApp (Evolution API) y permiten que <strong>Diana, Patricia y Grecia</strong> validen el tono comercial antes de responder al cliente.</li>
      <li><strong>Fase 2 opcional recomendada:</strong> Cuando la dirección lo autorice, podrá activarse un aviso automático opcional por WhatsApp al cliente usando <strong>únicamente dos hitos</strong> (<em>En Proceso</em> y <em>Completado</em>), con un mensaje corto y controlado por una casilla explícita en el ticket, evitando spam.</li>
      <li><strong>Nota de soporte:</strong> Si necesitas agregar a alguien más a un ticket ya abierto, basta un clic en su nombre dentro de <strong>Notificar cambios (Campana + Email)</strong>; se guarda al instante.</li>
    </ul>
  </div>
  ${ftr(8, TOTAL_PAGES)}
</section>

</body>
</html>`;

fs.mkdirSync(path.dirname(TMP_HTML), { recursive: true });
fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
fs.writeFileSync(TMP_HTML, html, 'utf8');

const chromePath = resolveChromePath();
execFileSync(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--print-to-pdf=${OUT_PDF}`,
    '--no-pdf-header-footer',
    pathToFileURL(TMP_HTML).href,
  ],
  { stdio: 'inherit' },
);
fs.unlinkSync(TMP_HTML);
console.log('PDF SOP Tickets generado correctamente:', OUT_PDF);
