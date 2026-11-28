import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.cwd();
const SOCIAL_SHOTS = 'C:/Users/jaria/.gemini/antigravity/brain/f6e136e3-8fd0-4b66-a458-78558685f5ef/scratch/screenshots_social';
const OUT_PDF = path.join(WORKSPACE, 'docs', 'SOP_Social_Planning_Conector_ChatGPT_CRM.pdf');
const TMP_HTML = 'C:/Users/jaria/.gemini/antigravity/brain/f6e136e3-8fd0-4b66-a458-78558685f5ef/scratch/scratch_sop_social_planning.html';

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

function loadShot(dir, name) {
  const full = path.join(dir, name);
  if (!fs.existsSync(full)) {
    throw new Error(`Falta captura real: ${full}`);
  }
  return `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
}

const pHourly = loadShot(SOCIAL_SHOTS, 'p_01_planning_hourly.png');
const pList = loadShot(SOCIAL_SHOTS, 'p_02_planning_lista.png');
const pComposer = loadShot(SOCIAL_SHOTS, 'p_03_post_composer_preview.png');
const pConn = loadShot(SOCIAL_SHOTS, 'p_04_connections_grid_v14.png');
const pDel = loadShot(SOCIAL_SHOTS, 'p_05_planning_eliminados.png');
const pModal = loadShot(SOCIAL_SHOTS, 'p_06_modal_conectar_chatgpt.png');
const pAnalytics = loadShot(SOCIAL_SHOTS, 'p_07_planning_estadisticas_ads.png');
const pReportsMtd = loadShot(SOCIAL_SHOTS, 'p_08_reports_mtd.png');
const pRoiCierres = loadShot(SOCIAL_SHOTS, 'p_09_planning_roi_cierres.png');

const cAddMcp = loadShot(SOCIAL_SHOTS, 'c_01_chatgpt_plugins_add_mcp.png');
const cOauth = loadShot(SOCIAL_SHOTS, 'c_02_crm_oauth_autorizar.png');
const cConnected = loadShot(SOCIAL_SHOTS, 'c_03_chatgpt_plugin_conectado.png');
const cLive = loadShot(SOCIAL_SHOTS, 'c_04_chatgpt_prueba_vivo.png');

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
    margin-bottom: 24px;
  }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #111827; }
  .doc-code { font-size: 9.5px; color: #475569; font-weight: 500; }
  .kicker {
    font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    color: #991B2B; margin-bottom: 6px;
  }
  .cover-title {
    font-size: 30px; font-weight: 800; color: #0f172a; line-height: 1.12; letter-spacing: -0.02em;
    margin-bottom: 10px;
  }
  .cover-sub { font-size: 13px; color: #334155; font-weight: 500; margin-bottom: 28px; }
  h1.sec-h1 { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.015em; margin-bottom: 6px; }
  p.lead-p { font-size: 10.5px; color: #475569; line-height: 1.5; margin-bottom: 14px; }
  p.body-p { font-size: 10px; color: #1f2937; line-height: 1.5; margin-bottom: 9px; }
  h3.sub-h { font-size: 12px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; }
  .step-hdr { font-size: 11px; font-weight: 800; color: #0f172a; margin: 8px 0 4px 0; }
  .step-hdr .num { color: #991B2B; margin-right: 4px; }
  table.inst { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5px; }
  table.inst th {
    background: #142136; color: #ffffff; text-align: left; padding: 7px 10px;
    font-size: 9px; font-weight: 700;
  }
  table.inst td {
    padding: 7px 10px; border-bottom: 1px solid #cbd5e1; color: #1f2937; vertical-align: top; line-height: 1.4;
  }
  table.inst tr:nth-child(even) td { background: #f8fafc; }
  .kv-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 10px; }
  .kv-table td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
  .kv-table tr:nth-child(odd) td { background: #f8fafc; }
  .kv-key { width: 34%; color: #475569; font-weight: 500; }
  .kv-val { color: #0f172a; font-weight: 600; }
  .diagram-wrap { margin: 14px 0 12px 0; }
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
  .shot-frame.compact {
    width: 80%;
    margin: 4px auto 3px auto;
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
  .callout-tag.bottom { top: auto; bottom: -15px; }
  .callout-tag.right { left: auto; right: -1px; }
  .fig-cap { font-size: 8.5px; color: #64748b; margin-bottom: 8px; line-height: 1.35; }
  .rules-list { list-style: none; margin: 6px 0 14px 0; }
  .rules-list li { font-size: 9.8px; color: #1f2937; margin-bottom: 5px; line-height: 1.45; }
  .rules-list li strong { color: #0f172a; }
  .privacy-title { font-size: 10px; font-weight: 800; color: #991B2B; margin: 8px 0 3px 0; }
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

const hdr = (code = 'SOP-COM-2026-04 | Uso interno') => `
  <div class="top-rule">
    <span class="brand">ARIAS GROUP</span>
    <span class="doc-code">${code}</span>
  </div>`;

const ftr = (page, total) => `
  <div class="footer-rule">
    <span>Marketing y Redes Sociales / Versión 1.8 · Planning + Selector Marca Calendario/Analytics + Meta Ads ROI + MCP</span>
    <span>${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`;

const html = `${commonHead('SOP-COM-2026-04 — Social Planning, Meta Ads ROI Estilo Metricool, YouTube y ChatGPT Plus')}

<!-- PAGE 1: COVER -->
<section class="page">
  <div>
    ${hdr()}
    <div style="margin-top:34px;">
      <div class="kicker">MARKETING Y REDES SOCIALES / PROCEDIMIENTO ESTÁNDAR DE OPERACIÓN</div>
      <div class="cover-title">Social Planning, Meta Ads ROI,<br/>YouTube y ChatGPT Plus</div>
      <div class="cover-sub">Suite editorial y analítica estilo Metricool con ROI (Ads/IA vs Ventas Cerrado/Cliente), Cohorte de Ingreso CRM y Servidor MCP</div>

      <div class="kicker" style="margin-top:24px;">CONTROL DOCUMENTAL</div>
      <table class="kv-table">
        <tr><td class="kv-key">Código</td><td class="kv-val">SOP-COM-2026-04</td></tr>
        <tr><td class="kv-key">Versión</td><td class="kv-val">1.8 · Selector Moderno de Marca/Páginas Estilo Metricool en Calendario, Lista y Estadísticas + ROI</td></tr>
        <tr><td class="kv-key">Vigencia</td><td class="kv-val">27 de noviembre de 2026</td></tr>
        <tr><td class="kv-key">URL Servidor MCP</td><td class="kv-val"><code>https://www.ariascrm.com/mcp</code> (Streamable HTTP + PKCE S256)</td></tr>
        <tr><td class="kv-key">Alcance</td><td class="kv-val">Arias Defense Components LLC (flag <code>ai_content_studio_enabled</code>)</td></tr>
        <tr><td class="kv-key">Relación operativa</td><td class="kv-val">Extiende Social Media Hub y Reportes BI sin alterar conexiones actuales</td></tr>
      </table>

      <h3 class="sub-h">Responsables de control documental</h3>
      <table class="inst">
        <thead>
          <tr><th style="width:48%;">Función</th><th style="width:52%;">Responsable / estado</th></tr>
        </thead>
        <tbody>
          <tr><td>Elaboración · UI Comercial, Meta Ads, MCP, OAuth 2.1 y CRM</td><td>Implementado y verificado en producción</td></tr>
          <tr><td>Revisión · Dirección y Supervisión</td><td>Jimmy Arias (Super Admin · Arias Group)</td></tr>
          <tr><td>Uso operativo</td><td>Dirección, Equipo de Marketing (Patricia Morales) y Administración SaaS</td></tr>
        </tbody>
      </table>
      <p class="body-p" style="color:#475569;">Distribución prevista: Dirección, Marketing y Administración SaaS.</p>
    </div>
  </div>
  ${ftr(1, 12)}
</section>

<!-- PAGE 2: 01 / MARCO OPERATIVO -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">01 / MARCO OPERATIVO</div>
    <h1 class="sec-h1">Objetivo, alcance y flujo</h1>
    <p class="lead-p">Operación unificada estilo comercial para planificar flyers de ChatGPT Plus (\$0 extra API) sin depender de herramientas externas.</p>

    <p class="body-p"><strong>Objetivo.</strong> Centralizar la planificación semanal en una interfaz comercial limpia (Calendario por Horas, Lista con acciones en lote, Editor con vista previa real Facebook/Instagram/YouTube y Hub de Conexiones multi-canal), conectada directo al ChatGPT Plus de cada usuario vía <code>https://www.ariascrm.com/mcp</code>.</p>
    <p class="body-p"><strong>Alcance.</strong> Módulo <code>/marketing/planning</code>, gestión de redes y canales YouTube (<code>Iclesia</code>, <code>Arias Defense Components</code> o clientes SaaS) vía <code>youtube-oauth</code> + <code>publish-youtube</code>, callback unificado <code>/integrations/google/callback</code>, Edge Function <code>arias-social-bridge</code> y cron cada 5 min en zona El Salvador (<code>-06:00</code>).</p>

    <div class="diagram-wrap">
      <svg viewBox="0 0 680 265" width="100%" height="248" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
          </marker>
        </defs>
        <rect x="20" y="14" width="175" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="107" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f172a">1. ChatGPT Plugins / MCP</text>
        <text x="107" y="52" text-anchor="middle" font-size="9" fill="#475569">OAuth 1 clic + image_file</text>

        <line x1="196" y1="41" x2="246" y2="41" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <rect x="250" y="14" width="185" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="342" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f172a">2. ariascrm.com/mcp</text>
        <text x="342" y="52" text-anchor="middle" font-size="9" fill="#475569">Valida PKCE + Feature Flag SaaS</text>

        <line x1="436" y1="41" x2="484" y2="41" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <rect x="488" y="14" width="172" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="574" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f172a">3. Storage + Memoria BD</text>
        <text x="574" y="52" text-anchor="middle" font-size="9" fill="#475569">Bucket público + episodios previos</text>

        <path d="M 574 68 L 574 96 L 340 96 L 340 114" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <polygon points="340,116 426,150 340,184 254,150" fill="#ffffff" stroke="#1e293b" stroke-width="1.4"/>
        <text x="340" y="147" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0f172a">¿Publicar ahora</text>
        <text x="340" y="160" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0f172a">o Planning?</text>

        <path d="M 254 150 L 145 150 L 145 196" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>
        <path d="M 426 150 L 535 150 L 535 196" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>
        <text x="195" y="144" font-size="9" font-weight="700" fill="#991B2B">PUBLICAR YA</text>
        <text x="448" y="144" font-size="9" font-weight="700" fill="#991B2B">PLANNING</text>

        <rect x="28" y="200" width="234" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="145" y="218" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">Publicación inmediata</text>
        <text x="145" y="233" text-anchor="middle" font-size="8.8" fill="#475569">Invoca publish-facebook / ig / youtube</text>
        <text x="145" y="246" text-anchor="middle" font-size="8.8" fill="#475569">Registra ID de publicación Meta</text>

        <rect x="418" y="200" width="234" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="535" y="218" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">Grilla Horaria + Cron 5 min</text>
        <text x="535" y="233" text-anchor="middle" font-size="8.8" fill="#475569">Visible en Horas, Tarjetas y Lista (-06:00)</text>
        <text x="535" y="246" text-anchor="middle" font-size="8.8" fill="#475569">pg_cron publica automáticamente al vencer</text>
      </svg>
    </div>

    <p class="body-p"><strong>Resultado esperado:</strong> flujo completo desde la creación en ChatGPT hasta publicación o programación visual en Calendario por Horas, con vista previa real antes de publicar.</p>
    <p class="body-p"><strong>Aislamiento SaaS:</strong> cualquier empresa con <code>ai_content_studio_enabled = false</code> no visualiza el módulo ni puede autorizar ChatGPT (HTTP 403 en servidor).</p>
  </div>
  ${ftr(2, 12)}
</section>

<!-- PAGE 3: 02 / CONFIGURACIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">02 / CONFIGURACIÓN</div>
    <h1 class="sec-h1">Componentes UI, herramientas MCP y OAuth 2.1</h1>
    <p class="lead-p">Todos los tokens, flyers, cuentas conectadas y memoria editorial quedan aislados por <code>company_id</code>.</p>

    <table class="inst">
      <thead>
        <tr>
          <th style="width:28%;">Componente / Tool MCP</th>
          <th style="width:28%;">Mecanismo técnico</th>
          <th style="width:44%;">Regla operativa y seguridad</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Calendario Horas / Tarjetas</strong></td>
          <td>Grilla 24h con <em>Mejores horarios</em></td>
          <td>Muestra la semana en zona El Salvador (<code>-06:00</code>), línea de hora actual y clic en cualquier celda horaria para programar al instante.</td>
        </tr>
        <tr>
          <td><strong>Editor + Vista Previa</strong></td>
          <td>Modal 2 col. + <code>PostLivePreview</code></td>
          <td>Selector visual con avatar de página o canal, título para YouTube, carga MP4/MOV y simulación real Facebook / Instagram / YouTube.</td>
        </tr>
        <tr>
          <td><strong>YouTube Multi-Canal (2 clics)</strong></td>
          <td><code>youtube-oauth</code> + <code>publish-youtube</code></td>
          <td>Permite vincular múltiples canales (<em>Iclesia</em>, <em>Arias Defense Components</em>, etc.) con selector Google, auto-renovación de token y subida resumible MP4/MOV.</td>
        </tr>
        <tr>
          <td><strong>OAuth 2.1 + DCR + PKCE</strong></td>
          <td><code>/.well-known/*</code>, <code>/oauth/register</code>, <code>/oauth/token</code></td>
          <td>Cada usuario (Jimmy, Patricia o cliente SaaS autorizado) conecta ChatGPT en 1 clic con su sesión CRM y código PKCE S256.</td>
        </tr>
        <tr>
          <td><strong>create_or_publish_social_post</strong></td>
          <td>MCP Write + <code>marketing_assets</code></td>
          <td>Descarga el flyer o video (<code>image_file</code>, <code>openaiFileIdRefs</code> o URL), respalda en Storage público y crea en estado <em>published</em>, <em>scheduled</em> o <em>draft</em>.</td>
        </tr>
        <tr>
          <td><strong>Acciones en lote y Eliminados</strong></td>
          <td>Selección múltiple + Soft-delete</td>
          <td>Permite publicar o mover varios posts a Eliminados en lote, conservando auditoría de fecha/usuario y botón <em>Restaurar</em> en 1 clic.</td>
        </tr>
        <tr>
          <td><strong>Estadísticas, ROI &amp; Cohorte</strong></td>
          <td><code>meta-ads-insights</code> (solo lectura) + UI estilo Metricool</td>
          <td>Interfaz limpia en 3 sub-vistas (<em>Resumen &amp; ROI</em>, <em>Campañas Meta</em>, <em>Ventas &amp; Cohorte</em>). Separa origen (<code>Meta Ads</code>, <code>Redes Sociales</code>, <code>Otros</code>) y cohorte (<code>Mismo período</code> vs <code>Mes anterior</code>) con fecha ingreso CRM, fecha cierre, días y acceso directo al lead.</td>
        </tr>
        <tr>
          <td><strong>Filtro Este Mes (MTD)</strong></td>
          <td>Reportes BI (<code>/reports</code>)</td>
          <td>Rango <code>Este Mes (MTD)</code> por defecto desde el día 1 del mes en embudo comercial y Card de Consumo OpenAI (IA).</td>
        </tr>
      </tbody>
    </table>

    <h3 class="sub-h">Criterio multi-empresa y costo \$0 API</h3>
    <p class="body-p">La generación visual se ejecuta con el motor nativo de <strong>ChatGPT Plus (\$20/mes)</strong> conectado mediante <em>Plugins → Custom MCP server</em> (<code>https://www.ariascrm.com/mcp</code>), sin gasto adicional de API de imágenes y preservando intacto el módulo clásico <strong>Social Media Hub</strong> (<code>/marketing/social</code>).</p>
  </div>
  ${ftr(3, 12)}
</section>

<!-- PAGE 4: 03 / EJECUCIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">03 / EJECUCIÓN</div>
    <h1 class="sec-h1">Responsabilidades por área</h1>
    <p class="lead-p">Vinculación en 1 clic para cada integrante, operación diaria en la nueva interfaz Planning y administración de redes.</p>

    <h3 class="sub-h">A. Cómo se conecta cualquier usuario autorizado (Jimmy, Patricia o SaaS)</h3>
    <div class="step-hdr"><span class="num">01 ·</span> Copiar URL MCP desde Arias CRM</div>
    <p class="body-p">En la barra superior de <strong>Planning → Conectar ChatGPT</strong>, copiar la única URL oficial: <code>https://www.ariascrm.com/mcp</code>.</p>

    <div class="step-hdr"><span class="num">02 ·</span> Agregar servidor MCP en ChatGPT Plugins</div>
    <p class="body-p">Abrir <code>chatgpt.com/plugins</code>, elegir <strong>+ → Add custom MCP server</strong>, pegar la URL, seleccionar <strong>OAuth</strong> y pulsar <strong>Create</strong>.</p>

    <div class="step-hdr"><span class="num">03 ·</span> Autorizar en 1 clic con sesión del CRM</div>
    <p class="body-p">ChatGPT abre automáticamente <code>ariascrm.com/oauth/chatgpt-authorize</code>. Cada integrante inicia sesión con su propio usuario CRM y presiona <strong>Autorizar ChatGPT</strong>.</p>

    <h3 class="sub-h">B. Operación diaria en Planning y ChatGPT Plus</h3>
    <div class="step-hdr"><span class="num">01 ·</span> Invocar @Arias CRM Planning o crear desde el Calendario por Horas</div>
    <p class="body-p">Desde ChatGPT, mencionar <code>@Arias CRM Planning</code> para leer <code>get_content_memory</code> y generar el episodio siguiente; o en el CRM hacer clic directo en cualquier franja horaria del Calendario.</p>

    <div class="step-hdr"><span class="num">02 ·</span> Verificar Vista Previa y confirmar modo de salida</div>
    <p class="body-p">En el modal de 2 columnas, comprobar cómo luce el post en <strong>Vista previa en vivo</strong> (Facebook o Instagram), elegir <em>Publicar ahora</em>, <em>Programar fecha</em> o <em>Guardar borrador</em> y guardar.</p>

    <h3 class="sub-h">C. Conexión de YouTube Multi-Canal (proceso simple de 2 clics para cualquier usuario)</h3>
    <div class="step-hdr"><span class="num">01 ·</span> Vincular todos los canales necesarios (Iclesia, Arias Defense o clientes SaaS)</div>
    <p class="body-p">En <strong>Planning → Conexiones</strong>, pulsar <strong>+ Conectar canal de YouTube</strong>, elegir la cuenta Google y seleccionar el canal (ej. <em>Iclesia</em>). Repetir 1 vez para agregar otro canal (ej. <em>Arias Defense Components</em>) sin configurar llaves ni APIs manuales.</p>
  </div>
  ${ftr(4, 12)}
</section>

<!-- PAGE 5: 04 / CONTROL OPERATIVO Y SUPERVISIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">04 / CONTROL OPERATIVO Y SUPERVISIÓN</div>
    <h1 class="sec-h1">Estados, verificación y control documental</h1>
    <p class="lead-p">Interpretación de indicadores en Lista/Calendario y lista de chequeo semanal para Dirección.</p>

    <table class="inst">
      <thead>
        <tr>
          <th style="width:20%;">Estado visible</th>
          <th style="width:42%;">Significado en el CRM</th>
          <th style="width:38%;">Acción requerida</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>● Programado</strong></td>
          <td>En espera de fecha/hora en zona El Salvador (<code>-06:00</code>).</td>
          <td>El cron publica cada 5 min; o abrir menú <code>⋯</code> → <em>Publicar ahora</em>.</td>
        </tr>
        <tr>
          <td><strong>● Publicado</strong></td>
          <td>Enviado correctamente a Facebook / Instagram con ID Meta registrado.</td>
          <td>Alimenta la memoria automática en <code>get_content_memory</code>.</td>
        </tr>
        <tr>
          <td><strong>● Borrador</strong></td>
          <td>Creado en modo Solo Borrador o duplicado para revisión.</td>
          <td>Abrir en el compositor, revisar en <em>Vista previa en vivo</em> y programar.</td>
        </tr>
        <tr>
          <td><strong>● Error</strong></td>
          <td>Meta rechazó una página destino al intentar publicar.</td>
          <td>Revisar mensaje en la fila, reconectar en <em>Conexiones</em> y reintentar.</td>
        </tr>
        <tr>
          <td><strong>Eliminado</strong></td>
          <td>Movido a papelera con fecha y correo responsable registrados.</td>
          <td>Usar <em>Restaurar</em> en 1 clic si se desea recuperar como Borrador.</td>
        </tr>
      </tbody>
    </table>

    <h3 class="sub-h">Lista de verificación semanal</h3>
    <table class="inst">
      <thead>
        <tr><th style="width:26%;">Control</th><th style="width:48%;">Criterio de verificación</th><th style="width:26%;">Resultado</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Integridad de cola</strong></td><td>Cero posts retenidos en estado <em>Error</em> o <em>Borrador</em> vencidos sin atención.</td><td>[ ] Conforme &nbsp; [ ] Revisar</td></tr>
        <tr><td><strong>Continuidad editorial</strong></td><td>Numeración de episodios AI + LEAN™ continua sin duplicados en <em>Lista</em>.</td><td>[ ] Conforme &nbsp; [ ] Revisar</td></tr>
      </tbody>
    </table>
    <p class="body-p" style="color:#475569;margin-bottom:10px;">Registro de revisión: Fecha _______________ &nbsp;&nbsp;&nbsp; Responsable _____________________________</p>

    <h3 class="sub-h">Cuatro reglas de oro</h3>
    <ul class="rules-list">
      <li><strong>01.</strong> Nunca re-crear en herramientas externas como Metricool lo que ya diseñó ChatGPT Plus; enviarlo directo vía MCP.</li>
      <li><strong>02.</strong> Revisar siempre la pestaña <strong>Vista previa en vivo</strong> antes de lanzar o programar publicaciones multicuenta.</li>
      <li><strong>03.</strong> Confirmar la hora local El Salvador (<code>-06:00</code>) en la barra superior antes de programar en la grilla horaria.</li>
      <li><strong>04.</strong> No alterar el módulo clásico <code>Social Media Hub (/marketing/social)</code>; operar toda la planificación en <code>Planning</code>.</li>
    </ul>

    <h3 class="sub-h">Historial documental</h3>
    <table class="inst" style="margin-bottom:0;">
      <thead>
        <tr><th style="width:22%;">Versión / fecha</th><th style="width:52%;">Descripción</th><th style="width:26%;">Estado</th></tr>
      </thead>
      <tbody>
        <tr><td>1.8 / 27 Nov. 2026</td><td>Extiende el <strong>Selector Moderno de Marca y Páginas Estilo Metricool</strong> a toda la barra superior de <strong>Calendario y Lista</strong> (agrupando las 5 marcas con avatar, íconos y filtros por página en 1 clic) y reemplaza los menús nativos en <em>Filtros</em> por píldoras e íconos modernos.</td><td>Vigente en producción</td></tr>
        <tr><td>1.7 / 27 Nov. 2026</td><td>Reemplaza el menú desplegable nativo en <em>Estadísticas &amp; Ads</em> por un <strong>Selector Moderno de Marca y Cuentas Estilo Metricool</strong> con avatar de marca, íconos vectoriales (Meta Ads, Facebook, Instagram, YouTube), listado de páginas conectadas y píldora superior multi-red diferenciada.</td><td>Superada por v1.8</td></tr>
        <tr><td>1.6 / 27 Nov. 2026</td><td>Rediseño limpio estilo Metricool en 3 sub-vistas (<em>Resumen &amp; ROI</em>, <em>Campañas Meta</em>, <em>Ventas &amp; Cohorte</em>), atribución exacta <code>Redes Sociales</code> vs <code>Meta Ads</code> vs <code>Otros</code> y detalle de fecha de ingreso CRM, fecha de cierre, cohorte y días en cerrar.</td><td>Superada por v1.7</td></tr>
        <tr><td>1.5 / 27 Nov. 2026</td><td>Agrega <strong>Panel de Retorno de Inversión (ROI)</strong> en <strong>Estadísticas &amp; Ads</strong> (Inversión Ads + IA vs Ventas Ganadas <code>Cerrado</code>/<code>Cliente</code> por fecha de cierre real) y gráfica diaria <em>Inversión vs Ganado (\$USD)</em>.</td><td>Superada por v1.6</td></tr>
        <tr><td>1.4 / 27 Nov. 2026</td><td>Agrega pestaña <strong>Estadísticas &amp; Ads</strong> (inversión Meta Ads, impresiones, clics, formularios llenados, CPL y cruce CRM/IA) y filtro <strong>Este Mes (MTD)</strong> en <code>/reports</code>.</td><td>Superada por v1.5</td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(5, 12)}
</section>

<!-- PAGE 6: 05 / PROCEDIMIENTO VISUAL (Calendario Horario + Lista) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">05 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Calendario por Horas y Vista Lista Comercial</h1>
    <p class="lead-p" style="margin-bottom:6px;">Control visual de programación semanal con mejores horarios y gestión rápida en tabla con acciones en lote.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">01 ·</span> Cambiar de marca o página en Calendario y operar la grilla horaria</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Calendario</strong>, use el selector superior estilo Metricool para filtrar por marca o página conectada, alterne <strong>Horas / Tarjetas</strong> y pulse cualquier celda o <strong>+ Crear Post</strong>.</p>
    <div class="shot-frame compact">
      <img src="${pHourly}" alt="Calendario por Horas con Selector Moderno de Marca y Páginas en Planning" />
      <div class="callout-box" style="left:24.0%;top:18.5%;width:24.8%;height:64.5%;"><span class="callout-tag bottom">1. Selector Marca + 9 Páginas (Calendario)</span></div>
      <div class="callout-box" style="left:48.8%;top:25.2%;width:31.8%;height:4.2%;"><span class="callout-tag right">2. Horas / Tarjetas, Mejores horarios y Crear Post</span></div>
      <div class="callout-box" style="left:74.8%;top:47.0%;width:9.8%;height:8.6%;"><span class="callout-tag bottom right">3. Posts semanales</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:5px;">Figura 1. Vista real del Calendario con selector moderno de marca (5 marcas agrupadas con avatar/íconos y 9 páginas conectadas).</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">02 ·</span> Supervisar estado por red y ejecutar acciones en Lista</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Lista</strong>, filtre por estado (<em>Programados</em>, <em>Publicados</em>, <em>Borradores</em>), marque casillas para <strong>Acciones en lote</strong> o use el menú <code>⋯</code> por publicación.</p>
    <div class="shot-frame compact">
      <img src="${pList}" alt="Vista Lista Comercial" />
      <div class="callout-box" style="left:35.4%;top:7.4%;width:4.6%;height:5.2%;"><span class="callout-tag">1. Pestaña Lista</span></div>
      <div class="callout-box" style="left:21.6%;top:20.2%;width:28.3%;height:3.3%;"><span class="callout-tag bottom">2. Filtros rápidos</span></div>
      <div class="callout-box" style="left:68.7%;top:14.8%;width:9.4%;height:3.9%;"><span class="callout-tag right">3. Acciones en lote</span></div>
      <div class="callout-box" style="left:80.2%;top:32.0%;width:13.6%;height:4.5%;"><span class="callout-tag bottom right">4. Redes, Estado y menú ⋯</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 2. Tabla comercial con íconos oficiales por red, origen ChatGPT, indicador de estado y menú contextual.</div>
  </div>
  ${ftr(6, 12)}
</section>

<!-- PAGE 7: 06 / PROCEDIMIENTO VISUAL (Editor 2 Columnas + Conexiones) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">06 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Compositor con Vista Previa y Hub de Conexiones</h1>
    <p class="lead-p" style="margin-bottom:6px;">Edición de publicaciones con simulación de feed en vivo y administración centralizada de redes sociales.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">03 ·</span> Editar o programar posts verificando la Vista previa en vivo (FB / IG / YT)</div>
    <p class="body-p" style="margin-bottom:4px;">Seleccione las cuentas o canales a la izquierda, ajuste texto/título/video y confirme en la columna derecha cómo se verá en <strong>Facebook</strong>, <strong>Instagram</strong> o <strong>YouTube</strong>.</p>
    <div class="shot-frame compact">
      <img src="${pComposer}" alt="Modal Editor 2 Columnas con Vista Previa YouTube" />
      <div class="callout-box" style="left:15.2%;top:14.8%;width:37.8%;height:19.6%;"><span class="callout-tag">1. Selector visual de páginas y canales</span></div>
      <div class="callout-box" style="left:15.2%;top:36.8%;width:37.8%;height:50.0%;"><span class="callout-tag bottom">2. Texto, media MP4/imagen y programación</span></div>
      <div class="callout-box" style="left:55.9%;top:14.4%;width:27.6%;height:52.0%;"><span class="callout-tag right">3. Vista previa en vivo (FB / IG / YT)</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:5px;">Figura 3. Modal de creación/edición en dos columnas con vista previa real para Facebook, Instagram y YouTube.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">04 ·</span> Conectar Meta, YouTube y cuenta publicitaria Meta Ads (solo lectura)</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Conexiones</strong>, vincule sus páginas y canales YouTube en 2 clics, o conecte su cuenta publicitaria en <strong>Meta Ads (Aislado · Solo lectura)</strong> por OAuth <code>ads_read</code> o Token Permanente.</p>
    <div class="shot-frame compact">
      <img src="${pConn}" alt="Grid Conexiones con Facebook, Instagram, YouTube y Meta Ads activo" />
      <div class="callout-box" style="left:22.8%;top:35.5%;width:23.6%;height:37.5%;"><span class="callout-tag">1. Facebook (4 activas)</span></div>
      <div class="callout-box" style="left:47.0%;top:35.5%;width:23.4%;height:23.0%;"><span class="callout-tag">2. Instagram (2 activas)</span></div>
      <div class="callout-box" style="left:70.8%;top:35.5%;width:23.8%;height:35.5%;"><span class="callout-tag right">3. YouTube (3 canales activos)</span></div>
      <div class="callout-box" style="left:22.8%;top:74.0%;width:23.6%;height:12.2%;"><span class="callout-tag bottom">4. Meta Ads (Aislado · Solo lectura)</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 4. Panel de Conexiones actualizado con Facebook, Instagram, YouTube Multi-Canal y tarjeta activa Meta Ads.</div>
  </div>
  ${ftr(7, 12)}
</section>

<!-- PAGE 8: 07 / PROCEDIMIENTO VISUAL (Eliminados + Modal ChatGPT MCP) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">07 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Papelera Auditable y Servidor MCP en Arias CRM</h1>
    <p class="lead-p" style="margin-bottom:6px;">Recuperación segura de descartes y obtención de la URL oficial MCP para el equipo autorizado.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">05 ·</span> Auditar eliminaciones y restaurar al flujo en 1 clic</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Eliminados</strong> quedan registrados fecha y usuario responsable de cada descarte, permitiendo reactivarlo con <strong>Restaurar</strong> sin perder el historial.</p>
    <div class="shot-frame compact">
      <img src="${pDel}" alt="Vista Eliminados Auditable" />
      <div class="callout-box" style="left:41.2%;top:7.4%;width:6.7%;height:5.2%;"><span class="callout-tag">1. Pestaña Eliminados</span></div>
      <div class="callout-box" style="left:65.0%;top:15.2%;width:20.6%;height:11.2%;"><span class="callout-tag bottom">2. Auditoría fecha y correo</span></div>
      <div class="callout-box" style="left:87.3%;top:21.4%;width:6.7%;height:3.9%;"><span class="callout-tag right">3. Restaurar</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:5px;">Figura 5. Papelera auditable con trazabilidad completa por usuario y botón de restauración inmediata.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">06 ·</span> Copiar la URL MCP oficial y gestionar permisos de equipo</div>
    <p class="body-p" style="margin-bottom:4px;">Pulse <strong>Conectar ChatGPT</strong> en la esquina superior derecha para copiar <code>https://www.ariascrm.com/mcp</code> y administrar qué usuarios publican directo.</p>
    <div class="shot-frame compact">
      <img src="${pModal}" alt="Modal Conectar ChatGPT MCP" />
      <div class="callout-box" style="left:63.6%;top:25.7%;width:9.7%;height:3.9%;"><span class="callout-tag right">1. Copiar URL MCP</span></div>
      <div class="callout-box" style="left:25.8%;top:31.3%;width:47.4%;height:4.7%;"><span class="callout-tag">2. URL oficial del servidor MCP</span></div>
      <div class="callout-box" style="left:24.7%;top:48.2%;width:49.6%;height:28.0%;"><span class="callout-tag bottom">3. Sesiones y permisos por usuario</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 6. Modal comercial del Conector ChatGPT Plus con enlace MCP único y control de permisos por integrante.</div>
  </div>
  ${ftr(8, 12)}
</section>

<!-- PAGE 9: 08 / PROCEDIMIENTO VISUAL (Configurar Plugin MCP y Autorizar OAuth en 1 clic) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">08 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Conectar Servidor MCP en ChatGPT y Autorizar OAuth</h1>
    <p class="lead-p" style="margin-bottom:6px;">Configuración guiada paso a paso para cualquier usuario autorizado desde <code>chatgpt.com/plugins</code>.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">07 ·</span> Abrir Plugins → Add custom MCP server y pegar la URL oficial</div>
    <p class="body-p" style="margin-bottom:4px;">Entre a <code>chatgpt.com/plugins</code>, presione <strong>+ → Add custom MCP server</strong>, escriba <em>Arias CRM Planning</em>, pegue <code>https://www.ariascrm.com/mcp</code>, elija <strong>OAuth</strong>, marque la casilla inferior y presione <strong>Create</strong>.</p>
    <div class="shot-frame compact">
      <img src="${cAddMcp}" alt="Modal Add custom MCP server en ChatGPT Plugins" />
      <div class="callout-box" style="left:34.2%;top:24.2%;width:30.6%;height:17.2%;"><span class="callout-tag">1. Nombre y Descripción</span></div>
      <div class="callout-box" style="left:34.2%;top:48.2%;width:30.6%;height:4.8%;"><span class="callout-tag right">2. Pegar https://www.ariascrm.com/mcp</span></div>
      <div class="callout-box" style="left:34.2%;top:55.5%;width:30.6%;height:6.5%;"><span class="callout-tag bottom">3. Authentication: OAuth</span></div>
      <div class="callout-box" style="left:35.0%;top:83.5%;width:29.5%;height:10.0%;"><span class="callout-tag right">4. Aceptar y Create</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:5px;">Figura 7. Registro del servidor MCP de Arias CRM dentro de ChatGPT Plugins (sin copiar esquemas ni tokens manuales).</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">08 ·</span> Aprobar el acceso en 1 clic con tu usuario de Arias CRM</div>
    <p class="body-p" style="margin-bottom:4px;">ChatGPT abrirá la pantalla de consentimiento de Arias CRM verificando empresa y usuario. Presione <strong>Autorizar ChatGPT</strong> para completar el enlace OAuth 2.1 automáticamente.</p>
    <div class="shot-frame compact">
      <img src="${cOauth}" alt="Pantalla de consentimiento OAuth en Arias CRM" />
      <div class="callout-box" style="left:39.4%;top:38.5%;width:21.2%;height:7.9%;"><span class="callout-tag right">1. Empresa y usuario CRM</span></div>
      <div class="callout-box" style="left:39.4%;top:50.8%;width:21.2%;height:11.2%;"><span class="callout-tag">2. Alcance de permisos</span></div>
      <div class="callout-box" style="left:50.1%;top:63.8%;width:10.5%;height:5.2%;"><span class="callout-tag bottom right">3. Autorizar en 1 clic</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 8. Pantalla oficial de consentimiento OAuth 2.1 garantizando aislamiento estricto multi-empresa.</div>
  </div>
  ${ftr(9, 12)}
</section>

<!-- PAGE 10: 09 / PROCEDIMIENTO VISUAL (Plugin Conectado, Prueba Real & Privacidad) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">09 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Verificación de Herramientas y Operación en el Chat</h1>
    <p class="lead-p" style="margin-bottom:6px;">Confirmación de las 4 herramientas MCP activas y prueba real consultando páginas desde ChatGPT Plus.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">09 ·</span> Confirmar las 4 herramientas MCP activas en el plugin</div>
    <p class="body-p" style="margin-bottom:4px;">Al finalizar el enlace OAuth, ChatGPT muestra conectado <strong>Arias CRM Planning</strong> con sus 2 herramientas de escritura y 2 de lectura listas para usar en cualquier chat.</p>
    <div class="shot-frame compact">
      <img src="${cConnected}" alt="Plugin Arias CRM Planning conectado con 4 herramientas MCP" />
      <div class="callout-box" style="left:35.3%;top:25.2%;width:29.2%;height:38.3%;"><span class="callout-tag right">1. Write: Publicar / Programar / Borrar</span></div>
      <div class="callout-box" style="left:35.3%;top:64.8%;width:29.2%;height:24.2%;"><span class="callout-tag bottom">2. Read: Memoria y Páginas Meta</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:5px;">Figura 9. Detalle de herramientas MCP verificadas tras completar la autorización OAuth 2.1.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">10 ·</span> Invocar @Arias CRM Planning dentro del chat para diseñar y publicar</div>
    <p class="body-p" style="margin-bottom:4px;">En un chat nuevo, mencione <code>@Arias CRM Planning</code> para consultar sus páginas o memoria y crear flyers; al aprobar el diseño confirme si se publica de una vez o entra a Planning.</p>
    <div class="shot-frame compact">
      <img src="${cLive}" alt="Prueba en vivo de Arias CRM Planning en ChatGPT" />
      <div class="callout-box" style="left:43.0%;top:10.1%;width:27.8%;height:12.0%;"><span class="callout-tag">1. Invocar @Arias CRM Planning</span></div>
      <div class="callout-box" style="left:30.8%;top:33.2%;width:26.0%;height:37.0%;"><span class="callout-tag bottom">2. Respuesta en tiempo real del CRM</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 10. Consulta real ejecutada desde ChatGPT Plus devolviendo las páginas conectadas de Arias Defense.</div>
  </div>
  ${ftr(10, 12)}
</section>

<!-- PAGE 11: 10 / PROCEDIMIENTO VISUAL (Resumen & ROI Estilo Metricool + Ventas & Cohorte CRM) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:10px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">10 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:18.5px;">Analítica Estilo Metricool: Resumen ROI y Cohorte de Ventas CRM</h1>
    <p class="lead-p" style="margin-bottom:5px;">Evaluación ordenada por rango de fechas, origen exacto (<em>Meta Ads</em>, <em>Redes Sociales</em>, <em>Otros</em>) y maduración del prospecto.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">11 ·</span> Seleccionar cuenta publicitaria estilo Metricool, ver páginas y leer ROI</div>
    <p class="body-p" style="margin-bottom:3px;">En <strong>Planning → Estadísticas &amp; Ads</strong>, abra el selector moderno de marca para cambiar entre cuentas Meta Ads viendo íconos y páginas conectadas, y combine <strong>Origen</strong> y <strong>Cohorte</strong> para evaluar ROI.</p>
    <div class="shot-frame compact" style="width:76%;">
      <img src="${pAnalytics}" alt="Selector moderno de Marca y Cuentas estilo Metricool en Social Planning" />
      <div class="callout-box" style="left:49.3%;top:30.6%;width:24.8%;height:52.4%;"><span class="callout-tag bottom">1. Selector Marca Metricool + Páginas</span></div>
      <div class="callout-box" style="left:20.5%;top:40.2%;width:17.8%;height:12.2%;"><span class="callout-tag bottom">2. Inversión Total (Ads + IA)</span></div>
      <div class="callout-box" style="left:77.5%;top:40.2%;width:17.6%;height:12.2%;"><span class="callout-tag bottom right">3. Formularios &amp; CPL</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:5px;">Figura 11. Selector moderno de marca estilo Metricool con avatar, íconos por red (Meta Ads, FB, IG, YT), las 9 páginas conectadas y métricas ROI.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">12 ·</span> Auditar fecha de ingreso CRM, fecha de cierre, días y origen en Ventas &amp; Cohorte</div>
    <p class="body-p" style="margin-bottom:3px;">En la sub-pestaña <strong>Ventas &amp; Cohorte</strong>, verifique qué cierres ingresaron en el mismo mes frente a meses anteriores, su origen real y ábralos directo en el CRM.</p>
    <div class="shot-frame compact" style="width:76%;">
      <img src="${pRoiCierres}" alt="Sub-pestaña Ventas y Cohorte CRM con fecha ingreso, cierre y origen exacto" />
      <div class="callout-box" style="left:20.5%;top:19.6%;width:76.2%;height:10.4%;"><span class="callout-tag">1. Pestaña Ventas &amp; Cohorte (3) y período</span></div>
      <div class="callout-box" style="left:20.5%;top:32.0%;width:76.2%;height:12.6%;"><span class="callout-tag bottom right">2. Resumen Cohorte (\$220.35 mismo mes · \$774.50 ant.)</span></div>
      <div class="callout-box" style="left:20.5%;top:49.4%;width:76.2%;height:45.0%;"><span class="callout-tag bottom">3. Auditoría: Ingreso CRM, Cierre, Días, Origen y Abrir</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:0;">Figura 12. Auditoría exacta de ventas ganadas separando ingreso CRM vs cierre, días de maduración y origen exacto.</div>
  </div>
  ${ftr(11, 12)}
</section>

<!-- PAGE 12: 11 / PROCEDIMIENTO VISUAL (Reportes BI MTD + Reglas ROI + Privacidad) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:10px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">11 / REPORTES BI Y FÓRMULAS ROI</div>
    <h1 class="sec-h1" style="font-size:18.5px;">Reportes BI (MTD), Fórmulas ROI y Control de Privacidad</h1>
    <p class="lead-p" style="margin-bottom:6px;">Criterios contables del cálculo ROI sincronizado con Dashboard CRM y seguimiento acumulado mensual en /reports.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">13 ·</span> Auditar desempeño mensual acumulado con Este Mes (MTD) en /reports</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Reportes BI → Gráficos e Insights</strong>, el filtro <strong>Este Mes (MTD)</strong> carga por defecto el rango del día 1 al día actual junto al consumo real de OpenAI IA.</p>
    <div class="shot-frame compact" style="width:76%;">
      <img src="${pReportsMtd}" alt="Reportes BI con filtro Este Mes MTD" />
      <div class="callout-box" style="left:65.4%;top:20.8%;width:31.4%;height:4.8%;"><span class="callout-tag">1. Filtro Este Mes (MTD) por defecto</span></div>
      <div class="callout-box" style="left:20.0%;top:41.2%;width:76.8%;height:24.0%;"><span class="callout-tag">2. Card Consumo Estimado OpenAI (MTD)</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:8px;">Figura 13. Reportes BI en modo Este Mes (MTD) mostrando totales acumulados del mes actual y gasto OpenAI IA.</div>

    <h3 class="sub-h" style="margin:6px 0 4px 0;">Criterios de cálculo ROI y sincronización con Dashboard CRM</h3>
    <table class="inst" style="margin-bottom:8px;">
      <thead>
        <tr><th style="width:26%;">Indicador</th><th style="width:34%;">Fórmula aplicada</th><th style="width:40%;">Fuente y regla operativa</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Inversión Total</strong></td><td><code>Inversión Meta Ads + Consumo IA</code></td><td>Gasto reportado por Meta Graph API (<code>ads_read</code>) más costo real registrado en <code>ai_usage_logs</code>.</td></tr>
        <tr><td><strong>Ventas Ganadas</strong></td><td><code>Σ COALESCE(closing_amount, value)</code></td><td>Leads en estado <code>Cerrado</code> o <code>Cliente</code> con <code>internal_won_date</code> dentro del rango seleccionado.</td></tr>
        <tr><td><strong>Utilidad Neta &amp; ROI %</strong></td><td><code>((Ganado − Inv.) / Inv.) × 100</code></td><td>Muestra rentabilidad real del período tanto global CRM como filtrada a origen Meta / FB.</td></tr>
        <tr><td><strong>ROAS &amp; CAC</strong></td><td><code>ROAS = Ganado / Ads · CAC = Inv. / Cierres</code></td><td>Mide retorno bruto por dólar en pauta y costo promedio de adquisición por cliente ganado.</td></tr>
      </tbody>
    </table>

    <div class="privacy-title" style="margin-top:4px;">Control de privacidad</div>
    <p class="body-p" style="color:#475569;margin-bottom:0;">Las capturas fueron tomadas sin exponer credenciales ni tokens publicitarios. La conexión Meta Ads usa permiso <code>ads_read</code> de solo lectura y no altera Metricool ni campañas activas. Uso exclusivo de Arias Defense Components LLC.</p>
  </div>
  ${ftr(12, 12)}
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
try { fs.unlinkSync(TMP_HTML); } catch {}
console.log('PDF Planning generado:', OUT_PDF);
