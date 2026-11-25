import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.cwd();
const SCRATCH_SHOTS =
  'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch/screenshots';
const OUT_PDF = path.join(WORKSPACE, 'docs', 'SOP_Chat_WhatsApp_Movil_Nativo_Arias_CRM.pdf');
const TMP_HTML = path.join(
  'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch',
  'sop_mobile_chat.html',
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

const sLista = loadShot('mobile_chat_lista.png');
const sAbierto = loadShot('mobile_chat_abierto.png');
const sAccionesMsg = loadShot('mobile_chat_acciones_mensaje.png');
const sMenu = loadShot('mobile_chat_menu_acciones.png');

const hdr = () => `
  <div class="top-rule">
    <span class="brand">ARIAS GROUP</span>
    <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
  </div>`;

const ftr = (page, total) => `
  <div class="footer-rule">
    <span>Comercial &amp; Soporte Técnico / Versión 1.0 · Documentación operativa</span>
    <span>${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`;

const TOTAL_PAGES = 4;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>SOP Chat WhatsApp Móvil Nativo — Arias CRM</title>
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
    margin-bottom: 18px;
  }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #111827; }
  .doc-code { font-size: 9.5px; color: #475569; font-weight: 500; }
  .kicker {
    font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    color: #991B2B; margin-bottom: 5px;
  }
  .cover-title {
    font-size: 27px; font-weight: 800; color: #0f172a; line-height: 1.12; letter-spacing: -0.02em;
    margin-bottom: 10px;
  }
  .cover-sub { font-size: 13px; color: #334155; font-weight: 500; margin-bottom: 22px; line-height: 1.4; }
  h1.sec-h1 { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.015em; margin-bottom: 5px; }
  p.lead-p { font-size: 10.3px; color: #475569; line-height: 1.48; margin-bottom: 12px; }
  p.body-p { font-size: 9.7px; color: #1f2937; line-height: 1.48; margin-bottom: 8px; }
  h3.sub-h { font-size: 11.2px; font-weight: 800; color: #0f172a; margin: 10px 0 6px 0; }
  .step-hdr { font-size: 10.3px; font-weight: 800; color: #0f172a; margin: 6px 0 4px 0; }
  .step-hdr .num { color: #991B2B; margin-right: 4px; }
  table.inst { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.2px; }
  table.inst th {
    background: #142136; color: #ffffff; text-align: left; padding: 7px 10px;
    font-size: 8.8px; font-weight: 700;
  }
  table.inst td {
    padding: 6.5px 10px; border-bottom: 1px solid #cbd5e1; color: #1f2937; vertical-align: top; line-height: 1.38;
  }
  table.inst tr:nth-child(even) td { background: #f8fafc; }
  .kv-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.6px; }
  .kv-table td { padding: 7px 10px; border-bottom: 1px solid #cbd5e1; }
  .kv-table tr:nth-child(odd) td { background: #f8fafc; }
  .kv-key { width: 34%; color: #475569; font-weight: 500; }
  .kv-val { color: #0f172a; font-weight: 600; }
  .alert-box {
    background: #fef2f2;
    border-left: 3px solid #991B2B;
    padding: 9px 12px;
    margin: 8px 0 12px 0;
    font-size: 9.5px;
    color: #1f2937;
    line-height: 1.45;
  }
  .info-box {
    background: #f8fafc;
    border-left: 3px solid #142136;
    padding: 8px 11px;
    margin: 8px 0;
    font-size: 9.3px;
    color: #1f2937;
    line-height: 1.42;
  }
  .two-phones {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    margin-top: 8px;
  }
  .phone-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .phone-frame {
    position: relative;
    width: 226px;
    border: 1.5px solid #cbd5e1;
    border-radius: 14px;
    overflow: visible;
    background: #ffffff;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
    padding: 4px;
    margin-top: 12px;
  }
  .phone-frame img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 10px;
  }
  .callout-box {
    position: absolute;
    border: 2.2px solid #B91C1C;
    border-radius: 4px;
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
    font-size: 7.3px;
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
  .fig-cap {
    font-size: 8.4px;
    color: #64748b;
    margin-top: 16px;
    line-height: 1.38;
    text-align: center;
    padding: 0 6px;
  }
  .rules-list { list-style: none; margin: 6px 0 8px 0; }
  .rules-list li { font-size: 9.4px; color: #1f2937; margin-bottom: 4.5px; line-height: 1.42; }
  .rules-list li strong { color: #0f172a; }
  .privacy-title { font-size: 10px; font-weight: 800; color: #0f172a; margin-top: 8px; margin-bottom: 4px; }
  .footer-rule {
    border-top: 1px solid #cbd5e1;
    padding-top: 7px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #64748b;
  }
  code { font-family: Consolas, monospace; font-size: 8.8px; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0f172a; }
</style>
</head>
<body>

<!-- PAGE 1: PORTADA & CONTROL DOCUMENTAL -->
<section class="page">
  <div>
    ${hdr()}
    <div style="margin-top: 8px;">
      <div class="kicker">MÓDULO COMERCIAL &amp; SOPORTE / PROCEDIMIENTO ESTÁNDAR DE OPERACIÓN</div>
      <h1 class="cover-title">Chat WhatsApp Móvil Nativo<br/>y Retiro de Inbox Antiguo</h1>
      <p class="cover-sub">Unificación en <code>/support/chat</code>, experiencia móvil limpia de pantalla completa (<code>390×844</code>), íconos 100% vectoriales y acciones contextuales por mensaje (Responder, Editar y Borrar).</p>

      <div class="kicker" style="margin-top: 4px;">CONTROL DOCUMENTAL</div>
      <table class="kv-table">
        <tr><td class="kv-key">Código</td><td class="kv-val">SOP-COM-2026-04</td></tr>
        <tr><td class="kv-key">Versión</td><td class="kv-val">1.0 · Desplegado en producción (ariascrm.com)</td></tr>
        <tr><td class="kv-key">Fecha de vigencia</td><td class="kv-val">24 de noviembre de 2026</td></tr>
        <tr><td class="kv-key">Áreas usuarias</td><td class="kv-val">Equipo Comercial (Diana, Patricia, Grecia), Soporte Técnico y Dirección</td></tr>
        <tr><td class="kv-key">Alcance técnico</td><td class="kv-val">MobileNav, Sidebar, retiro/redirección de /marketing/chat → /support/chat y ChatComposer responsivo</td></tr>
      </table>

      <h3 class="sub-h">Criterio de diseño por dispositivo (Producto)</h3>
      <table class="inst">
        <thead>
          <tr><th style="width:28%;">Dispositivo</th><th style="width:72%;">Objetivo operativo y alcance de herramientas</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Teléfono Móvil (&lt; 768 px)</strong></td><td>Responder mensajes rápido en la calle con pantalla limpia, teclado sin obstrucciones, menú <code>⋮</code> de 3 acciones esenciales (<em>Cambiar estado</em>, <em>Crear Ticket</em>, <em>Atendido/Llamar</em>) y gestión directa por mensaje (<em>Responder · Editar · Borrar</em>).</td></tr>
          <tr><td><strong>Tablet / Laptop / Desktop (&gt;= 768 px)</strong></td><td>Operación completa sin recortes: <em>Cotizador Pro</em>, <em>Diagnóstico HUD</em>, <em>Agendar Google Meet</em>, <em>Configuración IA</em>, <em>Control/Pulso</em>, <em>Accesos por rol</em>, filtros multi-estado y panel derecho de tickets.</td></tr>
          <tr><td><strong>Ruta retirada (/marketing/chat)</strong></td><td>El antiguo <em>Inbox Centralizado</em> fue retirado del menú lateral y de la barra móvil; cualquier marcador o enlace previo redirige automáticamente a <code>/support/chat</code>.</td></tr>
        </tbody>
      </table>

      <div class="privacy-title">Uso interno y confidencialidad</div>
      <p class="body-p" style="color:#475569;">Documento operativo interno de Arias Group. Todas las capturas incluidas corresponden a pantallas reales en producción (<code>390×844</code> sobre <code>ariascrm.com</code>) sin alteración de datos ni exposición externa.</p>
    </div>
  </div>
  ${ftr(1, TOTAL_PAGES)}
</section>

<!-- PAGE 2: ARQUITECTURA & RETIRO DE CHAT VIEJO -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">01 / ARQUITECTURA DE NAVEGACIÓN Y RESPONSIVIDAD</div>
    <h1 class="sec-h1">Un solo Chat WhatsApp y separación Móvil vs. Desktop</h1>
    <p class="lead-p">Eliminamos la duplicidad del menú “Mensajes” y evitamos sobrecargar la pantalla del teléfono con botones de escritorio.</p>

    <div class="alert-box">
      <strong>Cambio de ruta unificada:</strong> El botón <strong>Chat</strong> de la barra inferior móvil (<code>MobileNav</code>) y el menú lateral (<code>Sidebar</code>) ahora abren directamente <code>/support/chat</code>. Visitar <code>/marketing/chat</code> redirige de forma automática sin pantallas intermedias.
    </div>

    <!-- Clean Inline SVG Architecture Diagram -->
    <div style="margin: 10px 0 14px 0;">
      <svg viewBox="0 0 720 198" width="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569"/>
          </marker>
        </defs>
        <!-- Node 1: Entry -->
        <rect x="8" y="64" width="146" height="66" rx="8" fill="#f8fafc" stroke="#142136" stroke-width="1.6"/>
        <text x="81" y="88" text-anchor="middle" font-size="10.5" font-weight="800" fill="#0f172a">Acceso Chat CRM</text>
        <text x="81" y="104" text-anchor="middle" font-size="9" fill="#475569">/support/chat único</text>
        <text x="81" y="118" text-anchor="middle" font-size="8.5" font-weight="700" fill="#991B2B">(retira /marketing/chat)</text>

        <!-- Arrows to Mobile and Desktop -->
        <path d="M 154 84 L 222 46" fill="none" stroke="#475569" stroke-width="1.6" marker-end="url(#arr)"/>
        <path d="M 154 110 L 222 146" fill="none" stroke="#475569" stroke-width="1.6" marker-end="url(#arr)"/>

        <!-- Mobile Branch -->
        <rect x="226" y="12" width="218" height="72" rx="8" fill="#EEF0FF" stroke="#4F46E5" stroke-width="1.6"/>
        <text x="335" y="33" text-anchor="middle" font-size="10.5" font-weight="800" fill="#312E81">Móvil (&lt; 768 px)</text>
        <text x="335" y="49" text-anchor="middle" font-size="9" fill="#1e293b">1. Lista aireada + 1 fila filtros</text>
        <text x="335" y="63" text-anchor="middle" font-size="9" fill="#1e293b">2. Chat 100dvh (oculta MobileNav)</text>
        <text x="335" y="77" text-anchor="middle" font-size="8.5" font-weight="700" fill="#4338CA">Espacio libre con teclado (~52%)</text>

        <path d="M 444 48 L 494 48" fill="none" stroke="#475569" stroke-width="1.6" marker-end="url(#arr)"/>

        <rect x="498" y="12" width="214" height="72" rx="8" fill="#ffffff" stroke="#991B2B" stroke-width="1.6"/>
        <text x="605" y="33" text-anchor="middle" font-size="10.5" font-weight="800" fill="#991B2B">Acciones Móvil (Vector)</text>
        <text x="605" y="49" text-anchor="middle" font-size="9" fill="#1f2937">• Burbuja: Responder · Editar · Borrar</text>
        <text x="605" y="63" text-anchor="middle" font-size="9" fill="#1f2937">• Botón + : Archivo · Plantilla · Nota</text>
        <text x="605" y="77" text-anchor="middle" font-size="9" fill="#1f2937">• Menú ⋮ : Estado · Ticket · Llamar</text>

        <!-- Desktop Branch -->
        <rect x="226" y="112" width="486" height="72" rx="8" fill="#f8fafc" stroke="#142136" stroke-width="1.6"/>
        <text x="469" y="133" text-anchor="middle" font-size="10.5" font-weight="800" fill="#0f172a">Desktop / Laptop / Tablet (&gt;= 768 px) — Suite Completa</text>
        <text x="469" y="150" text-anchor="middle" font-size="9.2" fill="#334155">Mantiene 100% de herramientas avanzadas: Control/Pulso, Accesos por rol, Configuración IA,</text>
        <text x="469" y="165" text-anchor="middle" font-size="9.2" fill="#334155">Cotizador Pro, Diagnóstico HUD (7 preguntas), Agendar Google Meet y Panel derecho de Tickets.</text>
      </svg>
    </div>

    <h3 class="sub-h">Comportamiento técnico para evitar que el teclado tape la conversación</h3>
    <table class="inst">
      <thead>
        <tr><th style="width:30%;">Mecanismo</th><th style="width:70%;">Beneficio directo para el usuario en celular</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Modo pantalla completa al abrir chat</strong></td><td>Cuando el usuario entra a una conversación en móvil, <code>SupportChatCircles</code> emite <code>arias:mobile-chat-open</code>; <code>MobileNav</code> y el header global superior desaparecen temporalmente, liberando ~120 px de alto.</td></tr>
        <tr><td><strong>Viewport dinámico <code>100dvh</code> + <code>visualViewport</code></strong></td><td>Al desplegarse el teclado virtual en iOS o Android, el área de mensajes se ajusta a la altura visible real y hace scroll automático al último mensaje sin tapar las burbujas ni el botón de enviar.</td></tr>
        <tr><td><strong>Tipografía <code>16px</code> en caja móvil</strong></td><td>Previene el zoom automático forzado de iOS Safari al tocar el campo de escritura <em>Escribe un mensaje…</em>.</td></tr>
        <tr><td><strong>Estándar 100% SVG vectorial</strong></td><td>Todos los botones, navegación inferior, indicadores de IA y acciones de burbuja usan vectores nítidos (cero emojis).</td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(2, TOTAL_PAGES)}
</section>

<!-- PAGE 3: VISTA LISTA & VISTA CHAT PANTALLA COMPLETA -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">02 / OPERACIÓN EN CELULAR · LISTA Y CONVERSACIÓN</div>
    <h1 class="sec-h1">Pantallas limpias: entrar a Chats y responder con aire visual</h1>
    <p class="lead-p">Capturas reales de producción en formato móvil (<code>390×844</code>) mostrando el orden visual desde la bandeja hasta la conversación activa.</p>

    <div class="two-phones">
      <!-- Column 1: List View -->
      <div class="phone-col">
        <div class="step-hdr" style="text-align:center;"><span class="num">01 ·</span> Lista aireada y barra inferior única</div>
        <div class="phone-frame" style="margin-top: 20px;">
          <img src="${sLista}" alt="Lista de Chat WhatsApp en móvil" />
          <div class="callout-box" style="left:1.5%;top:0.5%;width:97%;height:5.4%;"><span class="callout-tag">1. Cabecera limpia + Alertas</span></div>
          <div class="callout-box" style="left:1.5%;top:10.7%;width:97%;height:4.1%;"><span class="callout-tag bottom">2. 1 sola fila deslizable de filtros</span></div>
          <div class="callout-box" style="left:1.5%;top:92.2%;width:97%;height:7.3%;"><span class="callout-tag">3. Barra MobileNav → /support/chat</span></div>
        </div>
        <div class="fig-cap"><strong>Figura 1.</strong> Vista lista móvil: solo título, campana, buscador, 1 tira de filtros y tarjetas con íconos vectoriales (<em>IA</em>, <em>reloj</em>, <em>doble check</em>).</div>
      </div>

      <!-- Column 2: Active Chat -->
      <div class="phone-col">
        <div class="step-hdr" style="text-align:center;"><span class="num">02 ·</span> Chat pantalla completa (sin barra inferior)</div>
        <div class="phone-frame" style="margin-top: 20px;">
          <img src="${sAbierto}" alt="Conversación abierta en pantalla completa móvil" />
          <div class="callout-box" style="left:1.5%;top:0.5%;width:97%;height:6.3%;"><span class="callout-tag">1. Cabecera 54px: ‹ Chats · Nombre · ⋮</span></div>
          <div class="callout-box" style="left:1.5%;top:93.0%;width:97%;height:6.5%;"><span class="callout-tag">2. Botón único + y campo de mensaje</span></div>
        </div>
        <div class="fig-cap"><strong>Figura 2.</strong> Al abrir el chat se ocultan <code>MobileNav</code> y el header global; queda espacio libre arriba y abajo para leer y escribir cómodo.</div>
      </div>
    </div>
  </div>
  ${ftr(3, TOTAL_PAGES)}
</section>

<!-- PAGE 4: RESPONDER / EDITAR / BORRAR + MENÚ ⋮ MÓVIL -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">03 / ACCIONES POR MENSAJE Y MENÚ RÁPIDO ⋮</div>
    <h1 class="sec-h1">Responder, editar (lápiz), borrar y cambiar estado en 1 toque</h1>
    <p class="lead-p">Las burbujas permanecen limpias todo el tiempo; las opciones aparecen solo cuando el usuario toca un mensaje o el botón superior <code>⋮</code>.</p>

    <div class="two-phones">
      <!-- Column 1: Message Contextual Pill -->
      <div class="phone-col">
        <div class="step-hdr" style="text-align:center;"><span class="num">03 ·</span> Tocar un mensaje para Responder, Editar o Borrar</div>
        <div class="phone-frame">
          <img src="${sAccionesMsg}" alt="Menú contextual Responder, Editar y Borrar sobre burbuja" />
          <div class="callout-box" style="left:16.5%;top:57.2%;width:82%;height:24.2%;"><span class="callout-tag">1. Píldora flotante 100% vectorial</span></div>
        </div>
        <div class="fig-cap"><strong>Figura 3.</strong> Toca cualquier burbuja para citar (<em>Responder</em>) o, en mensajes propios, abrir edición con <em>lápiz</em> o <em>Borrar</em> del chat.</div>
      </div>

      <!-- Column 2: MoreVertical Action Sheet -->
      <div class="phone-col">
        <div class="step-hdr" style="text-align:center;"><span class="num">04 ·</span> Menú superior ⋮ (solo acciones móviles)</div>
        <div class="phone-frame">
          <img src="${sMenu}" alt="Menú inferior móvil de acciones esenciales" />
          <div class="callout-box" style="left:1.5%;top:48.5%;width:97%;height:50.8%;"><span class="callout-tag">1. Estado · Ticket · Atendido · Llamar</span></div>
        </div>
        <div class="fig-cap"><strong>Figura 4.</strong> Al tocar <code>⋮</code> se despliega la hoja inferior limpia con estados, tickets y llamada directa más aviso para herramientas de escritorio.</div>
      </div>
    </div>

    <div class="info-box" style="margin-top: 10px;">
      <strong>Recordatorio operativo para el equipo:</strong>
      <ul class="rules-list" style="margin-bottom:0;">
        <li><strong>En mensajes recibidos del cliente:</strong> al tocar la burbuja verás el botón <em>Responder</em>, que inserta la cita compacta sobre el campo de escritura.</li>
        <li><strong>En mensajes enviados por el equipo:</strong> además de <em>Responder</em>, puedes pulsar <em>Editar</em> (lápiz para corregir en el historial o reenviar por WhatsApp) o <em>Borrar</em>.</li>
        <li><strong>Cotizaciones, Diagnóstico, Google Meet y Config IA:</strong> continúan disponibles con vista completa en Laptop, Desktop o Tablet.</li>
      </ul>
    </div>
  </div>
  ${ftr(4, TOTAL_PAGES)}
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
console.log('PDF SOP Móvil generado correctamente:', OUT_PDF);
