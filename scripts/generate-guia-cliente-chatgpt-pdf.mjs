import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.cwd();
const SCRATCH_SHOTS = 'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch/screenshots';
const OUT_PDF = path.join(WORKSPACE, 'docs', 'Guia_Rapida_Conectar_ChatGPT_Arias_CRM.pdf');
const TMP_HTML = path.join(WORKSPACE, 'scratch_guia_cliente_chatgpt.html');

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
  if (!fs.existsSync(full)) {
    throw new Error(`Falta captura real: ${full}`);
  }
  return `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
}

const cAddMcp = loadShot('c_01_chatgpt_plugins_add_mcp.png');
const cOauth = loadShot('c_02_crm_oauth_autorizar.png');
const cConnected = loadShot('c_03_chatgpt_plugin_conectado.png');

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
    margin-bottom: 18px;
  }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #111827; }
  .doc-code { font-size: 9.5px; color: #475569; font-weight: 500; }
  .kicker {
    font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    color: #991B2B; margin-bottom: 5px;
  }
  .cover-title {
    font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.14; letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .cover-sub { font-size: 11px; color: #334155; font-weight: 500; margin-bottom: 14px; line-height: 1.45; }
  h1.sec-h1 { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.015em; margin-bottom: 5px; }
  p.lead-p { font-size: 10.2px; color: #475569; line-height: 1.45; margin-bottom: 12px; }
  p.body-p { font-size: 9.8px; color: #1f2937; line-height: 1.48; margin-bottom: 8px; }
  h3.sub-h { font-size: 11.5px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; }
  .step-hdr { font-size: 11px; font-weight: 800; color: #0f172a; margin: 8px 0 4px 0; }
  .step-hdr .num { color: #991B2B; margin-right: 4px; }
  table.inst { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.4px; }
  table.inst th {
    background: #142136; color: #ffffff; text-align: left; padding: 6.5px 10px;
    font-size: 8.8px; font-weight: 700;
  }
  table.inst td {
    padding: 6.5px 10px; border-bottom: 1px solid #cbd5e1; color: #1f2937; vertical-align: top; line-height: 1.4;
  }
  table.inst tr:nth-child(even) td { background: #f8fafc; }
  .shot-frame {
    position: relative;
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    overflow: hidden;
    line-height: 0;
    margin: 5px 0 3px 0;
    background: #ffffff;
  }
  .shot-frame.wide-guide {
    width: 92%;
    margin: 6px auto 4px auto;
  }
  .shot-frame.compact {
    width: 84%;
    margin: 5px auto 3px auto;
  }
  .shot-frame img {
    width: 100%;
    height: auto;
    display: block;
  }
  .callout-box {
    position: absolute;
    border: 2.2px solid #B91C1C;
    border-radius: 3px;
    background: rgba(185, 28, 28, 0.05);
    pointer-events: none;
  }
  .callout-tag {
    position: absolute;
    top: -15px;
    left: -1px;
    background: #991B2B;
    color: #ffffff;
    font-size: 7.5px;
    font-weight: 800;
    padding: 2px 5px;
    line-height: 1.1;
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
  .fig-cap { font-size: 8.5px; color: #64748b; margin-bottom: 8px; line-height: 1.35; }
  .rules-list { list-style: none; margin: 6px 0 14px 0; }
  .rules-list li { font-size: 9.8px; color: #1f2937; margin-bottom: 6px; line-height: 1.45; }
  .rules-list li strong { color: #0f172a; }
  .privacy-title { font-size: 10px; font-weight: 800; color: #991B2B; margin: 10px 0 3px 0; }
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

const hdr = () => `
  <div class="top-rule">
    <span class="brand">ARIAS GROUP</span>
    <span class="doc-code">GUIA-COM-2026-01 | Guía para clientes</span>
  </div>`;

const ftr = (page, total) => `
  <div class="footer-rule">
    <span>Arias CRM · Guía Rápida ChatGPT Plus + Redes Sociales</span>
    <span>${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`;

const html = `${commonHead('Guía Rápida — Conecta tu ChatGPT Plus con Arias CRM')}

<!-- PAGE 1: INICIO + PASO 1 -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">GUÍA RÁPIDA PARA ADMINISTRADORES Y EQUIPOS</div>
    <div class="cover-title">Conecta tu ChatGPT Plus con Arias CRM</div>
    <div class="cover-sub">
      Guía sencilla en 4 pasos para crear tus flyers en ChatGPT y publicarlos o programarlos directo en Facebook e Instagram (toma de 3 a 5 minutos la primera vez; después no vuelves a hacerlo).
    </div>

    <h3 class="sub-h" style="margin-top:4px;">Antes de empezar (3 requisitos)</h3>
    <table class="inst">
      <thead>
        <tr>
          <th style="width:14%;">Requisito</th>
          <th style="width:32%;">Qué necesitas tener listo</th>
          <th style="width:54%;">Dónde revisarlo</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. Páginas</strong></td>
          <td>Facebook / Instagram conectados</td>
          <td>En Arias CRM entra a <strong>Social Media Hub → Cuentas Conectadas</strong> y verifica que tu página aparezca activa.</td>
        </tr>
        <tr>
          <td><strong>2. ChatGPT</strong></td>
          <td>Cuenta ChatGPT Plus (\$20/mes)</td>
          <td>Abre <code>chatgpt.com</code> en tu navegador Google Chrome con tu sesión iniciada.</td>
        </tr>
        <tr>
          <td><strong>3. Enlace</strong></td>
          <td><code>https://www.ariascrm.com/mcp</code></td>
          <td>Copia este enlace único desde <strong>Planning → Conectar ChatGPT</strong> (o directamente desde esta guía).</td>
        </tr>
      </tbody>
    </table>

    <div class="step-hdr"><span class="num">Paso 01 ·</span> Agrega Arias CRM dentro de tu ChatGPT</div>
    <p class="body-p">
      Entra a <code>chatgpt.com/plugins</code>, haz clic arriba a la derecha en <strong>Add → Add custom MCP server</strong>, llena los campos exactamente como muestra la imagen y presiona <strong>Create</strong>.
    </p>

    <div class="shot-frame wide-guide">
      <img src="${cAddMcp}" alt="Paso 1: Agregar Arias CRM en ChatGPT Plugins" />
      <div class="callout-box" style="left:34.2%;top:24.2%;width:30.6%;height:17.2%;"><span class="callout-tag">1. Escribe el nombre: Arias CRM Planning</span></div>
      <div class="callout-box" style="left:34.2%;top:48.2%;width:30.6%;height:4.8%;"><span class="callout-tag right">2. Pega: https://www.ariascrm.com/mcp</span></div>
      <div class="callout-box" style="left:34.2%;top:55.5%;width:30.6%;height:6.5%;"><span class="callout-tag bottom">3. En Authentication elige: OAuth</span></div>
      <div class="callout-box" style="left:35.0%;top:83.5%;width:29.5%;height:10.0%;"><span class="callout-tag right">4. Marca la casilla y pulsa Create</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;">Figura 1. Llena estos 4 puntos dentro de ChatGPT Plugins (no necesitas copiar códigos ni llaves largas).</div>
  </div>
  ${ftr(1, 3)}
</section>

<!-- PAGE 2: PASO 2 Y PASO 3 -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">PASO A PASO VISUAL</div>
    <h1 class="sec-h1">Autorización en 1 clic y confirmación</h1>
    <p class="lead-p">Al presionar Create, ChatGPT te llevará automáticamente a tu pantalla segura de Arias CRM para darte permiso.</p>

    <div class="step-hdr"><span class="num">Paso 02 ·</span> Inicia sesión en tu empresa y haz clic en Autorizar ChatGPT</div>
    <p class="body-p">
      Si no tenías sesión abierta en el CRM, inicia sesión con tu correo. Verifica arriba el nombre de tu empresa y tu usuario, y haz clic en el botón azul <strong>Autorizar ChatGPT</strong>.
    </p>
    <div class="shot-frame compact">
      <img src="${cOauth}" alt="Paso 2: Autorizar en Arias CRM" />
      <div class="callout-box" style="left:39.4%;top:38.5%;width:21.2%;height:7.9%;"><span class="callout-tag right">1. Revisa tu empresa y usuario</span></div>
      <div class="callout-box" style="left:39.4%;top:50.8%;width:21.2%;height:11.2%;"><span class="callout-tag">2. Permisos claros</span></div>
      <div class="callout-box" style="left:50.1%;top:63.8%;width:10.5%;height:5.2%;"><span class="callout-tag bottom right">3. Clic en Autorizar ChatGPT</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:8px;">Figura 2. Cada persona y cada empresa autoriza únicamente sus propias páginas.</div>

    <div class="step-hdr"><span class="num">Paso 03 ·</span> Confirma que Arias CRM quedó conectado</div>
    <p class="body-p">
      ChatGPT regresará solo y verás la tarjeta <strong>Arias CRM Planning</strong> conectada con tus 4 herramientas listas para publicar, programar y consultar tus páginas.
    </p>
    <div class="shot-frame compact">
      <img src="${cConnected}" alt="Paso 3: Arias CRM conectado en ChatGPT" />
      <div class="callout-box" style="left:35.3%;top:25.2%;width:29.2%;height:38.3%;"><span class="callout-tag right">1. Herramientas para publicar y borrar</span></div>
      <div class="callout-box" style="left:35.3%;top:64.8%;width:29.2%;height:24.2%;"><span class="callout-tag bottom">2. Herramientas para ver páginas y memoria</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 3. Cuando veas estas 4 herramientas activas, presiona Try in chat para empezar a crear flyers.</div>
  </div>
  ${ftr(2, 3)}
</section>

<!-- PAGE 3: PASO 4 FRASES LISTAS + EQUIPO/CLIENTES + PREGUNTAS -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">USO DIARIO Y EQUIPOS</div>
    <h1 class="sec-h1">Cómo pedir flyers y sumar a tu equipo</h1>
    <p class="lead-p">En cualquier chat nuevo, escribe <code>@Arias CRM Planning</code> y pídele lo que necesitas como hablas normalmente.</p>

    <div class="step-hdr"><span class="num">Paso 04 ·</span> Frases listas que puedes copiar y pegar en ChatGPT</div>
    <table class="inst">
      <thead>
        <tr>
          <th style="width:26%;">Qué quieres lograr</th>
          <th style="width:74%;">Qué escribir en tu chat de ChatGPT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Ver tus páginas</strong></td>
          <td><code>@Arias CRM Planning</code> dime qué páginas de Facebook e Instagram tengo conectadas en Arias CRM.</td>
        </tr>
        <tr>
          <td><strong>Crear flyer nuevo</strong></td>
          <td><code>@Arias CRM Planning</code> revisa mis últimos posts para no repetir tema, créame un flyer de [tu tema] con mi texto para Facebook y pregúntame si lo publico de una vez o lo pongo en Planning.</td>
        </tr>
        <tr>
          <td><strong>Enviar a Facebook / IG</strong></td>
          <td>Súbelo a Planning para mañana martes a las 10:00 AM en mi página [nombre de tu página] <em>(o "Publícalo de una vez")</em>.</td>
        </tr>
      </tbody>
    </table>

    <h3 class="sub-h">Cómo se conectan otros miembros de tu equipo o nuevas empresas</h3>
    <ul class="rules-list">
      <li><strong>01 · Cada persona usa su propia cuenta:</strong> Cualquier compañero autorizado o administrador de otra empresa solo entra a <code>chatgpt.com/plugins</code>, agrega <code>https://www.ariascrm.com/mcp</code> e inicia sesión con <strong>su propio correo del CRM</strong>.</li>
      <li><strong>02 · Control de permisos del administrador:</strong> Desde <strong>Arias CRM → Social Media Hub → Planning → Conectar ChatGPT</strong> puedes decidir con 1 clic si un miembro del equipo <em>Publica directo</em> o solo guarda como <em>Borrador</em> para que tú lo apruebes antes.</li>
      <li><strong>03 · Privacidad entre empresas:</strong> Cada empresa ve únicamente sus propias páginas, sus imágenes y su calendario.</li>
    </ul>

    <h3 class="sub-h">Preguntas rápidas</h3>
    <table class="inst">
      <thead>
        <tr>
          <th style="width:36%;">Duda frecuente</th>
          <th style="width:64%;">Respuesta simple</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>¿Debo repetir esta conexión cada día?</strong></td>
          <td>No. Solo se configura una vez; en tus próximos chats únicamente escribes <code>@Arias CRM Planning</code>.</td>
        </tr>
        <tr>
          <td><strong>¿Pago algo extra por cada imagen?</strong></td>
          <td>No. Todo corre dentro de tu suscripción actual de ChatGPT Plus (\$20/mes) con calidad 100% original.</td>
        </tr>
        <tr>
          <td><strong>¿Dónde edito o cancelo lo programado?</strong></td>
          <td>En <strong>Arias CRM → Social Media Hub → Planning</strong> (Calendario, Lista o Eliminados para restaurar en 1 clic).</td>
        </tr>
      </tbody>
    </table>

    <div class="privacy-title">Control de privacidad</div>
    <p class="body-p" style="color:#475569;">Esta guía no expone contraseñas, historiales personales ni cuentas privadas de clientes. Puedes compartir este PDF directamente con miembros de tu equipo o administradores autorizados.</p>
  </div>
  ${ftr(3, 3)}
</section>

</body>
</html>`;

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
console.log('Guía rápida para clientes generada:', OUT_PDF);
