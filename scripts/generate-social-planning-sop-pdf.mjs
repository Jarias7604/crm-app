import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const WORKSPACE = process.cwd();
const OUT_PDF = path.join(WORKSPACE, 'docs', 'SOP_Social_Planning_Conector_ChatGPT_CRM.pdf');
const TMP_HTML = path.join(WORKSPACE, 'scratch_sop_social_planning.html');
const SCRATCH_SHOTS =
  'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch/screenshots';

function b64(filename) {
  const full = path.join(SCRATCH_SHOTS, filename);
  if (!fs.existsSync(full)) {
    throw new Error(`Falta captura real: ${full}`);
  }
  return `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
}

function resolveChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No se encontró Chrome ni Edge para generar PDF.');
  return found;
}

const TOTAL_PAGES = 7;

function pageHeader() {
  return `
    <div class="top-rule">
      <div class="brand">ARIAS GROUP</div>
      <div class="doc-code">SOP-COM-2026-04 | Uso interno</div>
    </div>
  `;
}

function pageFooter(pageNum, leftText) {
  const numStr = String(pageNum).padStart(2, '0');
  const totStr = String(TOTAL_PAGES).padStart(2, '0');
  return `
    <div class="footer-rule">
      <div>${leftText}</div>
      <div>${numStr} / ${totStr}</div>
    </div>
  `;
}

function buildHtml() {
  const imgCal = b64('p_01_planning_calendario.png');
  const imgList = b64('p_02_planning_lista.png');
  const imgDel = b64('p_03_planning_eliminados.png');
  const imgModal = b64('p_04_modal_conectar_chatgpt.png');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>SOP-COM-2026-04 — Social Planning y Conector ChatGPT Plus</title>
<style>
  @page {
    size: letter;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 8.5in;
    height: 11in;
    padding: 0.42in 0.60in 0.40in 0.60in;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child {
    page-break-after: auto;
  }

  /* Barra superior carmesí obligatoria */
  .top-rule {
    border-top: 2.2px solid #991B2B;
    padding-top: 7px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .brand {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #0f172a;
    text-transform: uppercase;
  }
  .doc-code {
    font-size: 8.5px;
    font-weight: 600;
    color: #475569;
    letter-spacing: 0.3px;
  }

  /* Tipografía editorial */
  .kicker {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: #991B2B;
    margin: 0 0 4px 0;
  }
  h1 {
    font-size: 21px;
    line-height: 1.18;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
  }
  h2 {
    font-size: 13.5px;
    line-height: 1.25;
    font-weight: 700;
    color: #0f172a;
    margin: 12px 0 6px 0;
  }
  h3 {
    font-size: 11px;
    font-weight: 700;
    color: #142136;
    margin: 8px 0 4px 0;
  }
  .lead {
    font-size: 10px;
    line-height: 1.45;
    color: #334155;
    margin: 0 0 10px 0;
  }
  p, li {
    font-size: 9.4px;
    line-height: 1.44;
    color: #1f2937;
  }
  ul, ol {
    margin: 4px 0 8px 0;
    padding-left: 16px;
  }
  li {
    margin-bottom: 3px;
  }

  /* Tarjeta destacada */
  .note-box {
    border-left: 3px solid #991B2B;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 11px;
    margin: 8px 0;
    font-size: 9.2px;
    line-height: 1.44;
    color: #1f2937;
  }
  .note-box strong {
    color: #0f172a;
  }

  /* Tablas institucionales azul marino */
  table.inst {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 10px 0;
    font-size: 8.8px;
  }
  table.inst thead th {
    background: #142136;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #142136;
    font-size: 8.5px;
    letter-spacing: 0.2px;
  }
  table.inst tbody td {
    padding: 5.5px 8px;
    border: 1px solid #cbd5e1;
    color: #1f2937;
    vertical-align: top;
    line-height: 1.38;
  }
  table.inst tbody tr:nth-child(even) td {
    background: #f8fafc;
  }
  table.kv-table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 10px 0;
    font-size: 8.8px;
  }
  table.kv-table th {
    width: 26%;
    background: #142136;
    color: #ffffff;
    text-align: left;
    padding: 5.5px 8px;
    border: 1px solid #142136;
    font-weight: 700;
  }
  table.kv-table td {
    background: #f8fafc;
    color: #111827;
    padding: 5.5px 8px;
    border: 1px solid #cbd5e1;
  }

  .pill-ok {
    display: inline-block;
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 7.8px;
    font-weight: 700;
  }
  .pill-warn {
    display: inline-block;
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 7.8px;
    font-weight: 700;
  }
  .code-inline {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.2px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 0.5px 4px;
    border-radius: 3px;
    color: #0f172a;
  }

  /* Contenedor de captura real + callouts */
  .shot-wrap {
    margin: 6px 0 8px 0;
  }
  .shot-frame {
    position: relative;
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    overflow: hidden;
    background: #f8fafc;
  }
  .shot-frame img {
    display: block;
    width: 100%;
    height: auto;
  }
  .callout-box {
    position: absolute;
    border: 2.2px solid #B91C1C;
    background: rgba(185, 28, 28, 0.05);
    border-radius: 4px;
    pointer-events: none;
  }
  .callout-tag {
    position: absolute;
    top: -11px;
    left: -2px;
    background: #991B2B;
    color: #ffffff;
    font-size: 9px;
    font-weight: 800;
    line-height: 1;
    padding: 2.5px 5.5px;
    border-radius: 3px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  }
  .callout-tag.bottom {
    top: auto;
    bottom: -11px;
  }
  .callout-tag.right {
    left: auto;
    right: -2px;
  }

  /* Leyenda de pasos bajo captura */
  .legend-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
    margin-top: 6px;
  }
  .legend-item {
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    border-radius: 4px;
    padding: 5.5px 8px;
    font-size: 8.6px;
    line-height: 1.35;
  }
  .legend-num {
    display: inline-block;
    background: #991B2B;
    color: #ffffff;
    font-weight: 800;
    font-size: 8px;
    padding: 1px 5px;
    border-radius: 3px;
    margin-right: 5px;
  }

  /* Contenedor SVG */
  .svg-box {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    border-radius: 4px;
    padding: 8px;
    margin: 6px 0 8px 0;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }

  /* Pie de página institucional */
  .footer-rule {
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    color: #64748b;
    flex-shrink: 0;
  }
</style>
</head>
<body>

  <!-- ================= PÁGINA 1: PORTADA & CONTROL DOCUMENTAL ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Manual Operativo Estándar (SOP) · Marketing &amp; Redes Sociales</div>
      <h1>Social Planning &amp; Conector ChatGPT Plus</h1>
      <p class="lead">
        Procedimiento oficial para planificar, programar y publicar flyers generados en ChatGPT Plus (\$20/mes) directamente hacia Facebook e Instagram desde ARIAS CRM, con aislamiento estricto multi-empresa y \$0 de costo adicional por API de imágenes.
      </p>

      <h2>1. Control Documental</h2>
      <table class="kv-table">
        <tr><th>Código Documental</th><td>SOP-COM-2026-04 (Edición Inicial v1.0)</td></tr>
        <tr><th>Organización Titular</th><td>ARIAS GROUP — Arias Defense Components LLC (Workspace <span class="code-inline">General</span>)</td></tr>
        <tr><th>Alcance Técnico</th><td>Módulo <span class="code-inline">/marketing/planning</span>, autorización OAuth <span class="code-inline">/oauth/chatgpt-authorize</span> y Edge Function <span class="code-inline">arias-social-bridge</span></td></tr>
        <tr><th>Feature Flag SaaS</th><td><span class="code-inline">ai_content_studio_enabled = true</span> (activado únicamente para Arias Defense)</td></tr>
        <tr><th>Responsables</th><td>Jimmy Arias (Super Admin / Dirección), Patricia Morales (Operación &amp; Marketing)</td></tr>
        <tr><th>Relación con Social Hub</th><td><span class="code-inline">/marketing/social</span> permanece intacto; Planning agrega calendario semanal, cola y puente GPT</td></tr>
      </table>

      <h2>2. Propósito Operativo y Estrategia de Costo Cero API</h2>
      <p>
        Este módulo elimina la descarga manual de flyers desde ChatGPT y su carga posterior en herramientas externas como Metricool. El equipo utiliza su suscripción existente de <strong>ChatGPT Plus (\$20/mes)</strong> mediante un Custom GPT privado conectado a ARIAS CRM:
      </p>
      <ul>
        <li><strong>Calidad original de ChatGPT:</strong> La imagen se diseña con el generador nativo de ChatGPT Plus (preservando rostro, tipografía AI + LEAN™ y estilo de liderazgo empresarial).</li>
        <li><strong>Transferencia automática sin re-generar vía API:</strong> ChatGPT envía el identificador temporal <span class="code-inline">openaiFileIdRefs</span> y el CRM descarga y almacena el flyer de forma permanente en Supabase Storage.</li>
        <li><strong>Flujo conversacional idéntico a Metricool:</strong> Antes de enviar al CRM, el Custom GPT pregunta explícitamente: <em>"¿Lo publico de una vez o lo pongo en Planning?"</em>.</li>
        <li><strong>Memoria permanente en PostgreSQL:</strong> Antes de redactar un nuevo episodio, ChatGPT consulta los últimos 15 posts de la empresa para evitar temas o numeraciones repetidas.</li>
      </ul>

      <h2>3. Matriz de Aislamiento Multi-Empresa (Seguridad SaaS)</h2>
      <table class="inst">
        <thead>
          <tr>
            <th style="width:24%">Control / Capa</th>
            <th style="width:48%">Mecanismo Implementado</th>
            <th style="width:28%">Estado Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Visibilidad UI &amp; Menú</strong></td>
            <td>El ítem <span class="code-inline">Planning</span> bajo Social Media Hub solo se renderiza cuando <span class="code-inline">company.features.ai_content_studio_enabled === true</span>.</td>
            <td><span class="pill-ok">Solo Arias Defense</span></td>
          </tr>
          <tr>
            <td><strong>Validación Backend</strong></td>
            <td><span class="code-inline">arias-social-bridge</span> bloquea con HTTP 403 toda petición de empresas sin la bandera activa, aunque conozcan la URL.</td>
            <td><span class="pill-ok">Forzado en servidor</span></td>
          </tr>
          <tr>
            <td><strong>Tokens por Usuario</strong></td>
            <td>Hash SHA-256 en <span class="code-inline">social_bridge_tokens</span> vinculado a <span class="code-inline">(company_id, user_id)</span> con permiso granular <span class="code-inline">can_publish_direct</span>.</td>
            <td><span class="pill-ok">Jimmy / Patricia aislados</span></td>
          </tr>
          <tr>
            <td><strong>Otras Empresas SaaS</strong></td>
            <td>Si otro tenant activa el servicio en el futuro, inicia sesión con su propio botón OAuth de 1 clic sin ver memoria ni páginas ajenas.</td>
            <td><span class="pill-warn">Desactivado por defecto</span></td>
          </tr>
        </tbody>
      </table>

      <div class="note-box">
        <strong>Regla de Protección de Módulos Existentes:</strong> La pantalla clásica <span class="code-inline">Social Media Hub (/marketing/social)</span> y su compositor manual no fueron alterados. El módulo Planning opera como extensión independiente para programación, auditoría y puente con ChatGPT Plus.
      </div>
    </div>
    ${pageFooter(1, 'ARIAS GROUP · Social Planning &amp; Conector ChatGPT Plus')}
  </section>

  <!-- ================= PÁGINA 2: ARQUITECTURA & MODELO MULTI-USUARIO ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Sección 01 · Arquitectura Técnica &amp; Flujo Multi-Usuario</div>
      <h1>Diagrama de Integración Punta a Punta</h1>
      <p class="lead">
        El puente <span class="code-inline">arias-social-bridge</span> unifica el Custom GPT de cada miembro del equipo con la base de datos de ARIAS CRM, el programador cron cada 5 minutos y las Edge Functions oficiales de Meta (<span class="code-inline">publish-facebook</span> e <span class="code-inline">publish-instagram</span>).
      </p>

      <div class="svg-box">
        <svg viewBox="0 0 700 225" width="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:'Segoe UI',sans-serif;">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#142136"/>
            </marker>
            <marker id="arrowRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#991B2B"/>
            </marker>
          </defs>

          <!-- Fondo sutil por zonas -->
          <rect x="6" y="8" width="150" height="208" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 3"/>
          <text x="81" y="24" text-anchor="middle" font-size="8.5" font-weight="800" fill="#475569">1. CHATGPT PLUS ($20/MES)</text>

          <rect x="180" y="8" width="165" height="208" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 3"/>
          <text x="262" y="24" text-anchor="middle" font-size="8.5" font-weight="800" fill="#475569">2. SEGURIDAD MULTI-TENANT</text>

          <rect x="369" y="8" width="165" height="208" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 3"/>
          <text x="451" y="24" text-anchor="middle" font-size="8.5" font-weight="800" fill="#475569">3. ARIAS CRM BACKEND</text>

          <rect x="558" y="8" width="136" height="208" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 3"/>
          <text x="626" y="24" text-anchor="middle" font-size="8.5" font-weight="800" fill="#475569">4. META GRAPH API</text>

          <!-- Cajas zona 1 -->
          <rect x="18" y="38" width="126" height="48" rx="5" fill="#142136"/>
          <text x="81" y="57" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">Jimmy / Patricia</text>
          <text x="81" y="71" text-anchor="middle" font-size="8" fill="#cbd5e1">Crea Flyer + Copy en GPT</text>

          <rect x="18" y="102" width="126" height="48" rx="5" fill="#ffffff" stroke="#991B2B" stroke-width="1.6"/>
          <text x="81" y="121" text-anchor="middle" font-size="9" font-weight="700" fill="#991B2B">Pregunta Clave GPT</text>
          <text x="81" y="135" text-anchor="middle" font-size="7.8" fill="#334155">¿Publico ya o Planning?</text>

          <rect x="18" y="164" width="126" height="40" rx="5" fill="#ffffff" stroke="#cbd5e1"/>
          <text x="81" y="181" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0f172a">openaiFileIdRefs</text>
          <text x="81" y="194" text-anchor="middle" font-size="7.5" fill="#475569">URL temporal del flyer</text>

          <!-- Cajas zona 2 -->
          <rect x="192" y="38" width="141" height="50" rx="5" fill="#ffffff" stroke="#142136" stroke-width="1.4"/>
          <text x="262" y="56" text-anchor="middle" font-size="9" font-weight="700" fill="#0f172a">OAuth 2.0 / Token</text>
          <text x="262" y="69" text-anchor="middle" font-size="7.6" fill="#475569">arias_gpt_... (SHA-256)</text>
          <text x="262" y="81" text-anchor="middle" font-size="7.6" fill="#991B2B" font-weight="700">1 token por usuario CRM</text>

          <rect x="192" y="104" width="141" height="46" rx="5" fill="#ffffff" stroke="#cbd5e1"/>
          <text x="262" y="122" text-anchor="middle" font-size="8.8" font-weight="700" fill="#0f172a">Guardia Feature Flag</text>
          <text x="262" y="136" text-anchor="middle" font-size="7.6" fill="#475569">ai_content_studio_enabled</text>

          <rect x="192" y="164" width="141" height="40" rx="5" fill="#ffffff" stroke="#cbd5e1"/>
          <text x="262" y="181" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0f172a">Permiso Granular</text>
          <text x="262" y="194" text-anchor="middle" font-size="7.5" fill="#475569">Publica directo vs Borrador</text>

          <!-- Cajas zona 3 -->
          <rect x="381" y="38" width="141" height="46" rx="5" fill="#991B2B"/>
          <text x="451" y="57" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">arias-social-bridge</text>
          <text x="451" y="70" text-anchor="middle" font-size="7.8" fill="#fee2e2">Edge Function + Storage</text>

          <rect x="381" y="98" width="141" height="50" rx="5" fill="#142136"/>
          <text x="451" y="116" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">social_posts (Planning)</text>
          <text x="451" y="129" text-anchor="middle" font-size="7.6" fill="#cbd5e1">Calendario, Lista, Papelera</text>
          <text x="451" y="140" text-anchor="middle" font-size="7.6" fill="#cbd5e1">+ Memoria últimos episodios</text>

          <rect x="381" y="162" width="141" height="42" rx="5" fill="#ffffff" stroke="#142136"/>
          <text x="451" y="180" text-anchor="middle" font-size="8.6" font-weight="700" fill="#0f172a">pg_cron (cada 5 min)</text>
          <text x="451" y="193" text-anchor="middle" font-size="7.5" fill="#475569">Dispara posts vencidos</text>

          <!-- Cajas zona 4 -->
          <rect x="570" y="54" width="112" height="54" rx="5" fill="#ffffff" stroke="#142136" stroke-width="1.4"/>
          <text x="626" y="74" text-anchor="middle" font-size="9.2" font-weight="700" fill="#142136">Facebook Pages</text>
          <text x="626" y="88" text-anchor="middle" font-size="7.6" fill="#475569">publish-facebook</text>
          <text x="626" y="99" text-anchor="middle" font-size="7.5" fill="#166534" font-weight="700">Arias Group / AI+Lean</text>

          <rect x="570" y="128" width="112" height="54" rx="5" fill="#ffffff" stroke="#142136" stroke-width="1.4"/>
          <text x="626" y="148" text-anchor="middle" font-size="9.2" font-weight="700" fill="#142136">Instagram Pro</text>
          <text x="626" y="162" text-anchor="middle" font-size="7.6" fill="#475569">publish-instagram</text>
          <text x="626" y="173" text-anchor="middle" font-size="7.5" fill="#166534" font-weight="700">@ariasdefense</text>

          <!-- Conectores -->
          <line x1="81" y1="86" x2="81" y2="99" stroke="#991B2B" stroke-width="1.5" marker-end="url(#arrowRed)"/>
          <line x1="81" y1="150" x2="81" y2="161" stroke="#142136" stroke-width="1.4" marker-end="url(#arrow)"/>
          <line x1="144" y1="62" x2="189" y2="62" stroke="#142136" stroke-width="1.5" marker-end="url(#arrow)"/>
          <line x1="262" y1="88" x2="262" y2="101" stroke="#142136" stroke-width="1.4" marker-end="url(#arrow)"/>
          <line x1="333" y1="61" x2="378" y2="61" stroke="#991B2B" stroke-width="1.6" marker-end="url(#arrowRed)"/>
          <line x1="451" y1="84" x2="451" y2="95" stroke="#142136" stroke-width="1.4" marker-end="url(#arrow)"/>
          <line x1="451" y1="148" x2="451" y2="159" stroke="#142136" stroke-width="1.4" marker-end="url(#arrow)"/>
          <line x1="522" y1="66" x2="567" y2="78" stroke="#142136" stroke-width="1.5" marker-end="url(#arrow)"/>
          <line x1="522" y1="180" x2="567" y2="156" stroke="#142136" stroke-width="1.5" marker-end="url(#arrow)"/>
        </svg>
      </div>

      <h2>2. Cómo Trabajan Jimmy, Patricia y Futuras Empresas SaaS</h2>
      <p>
        El administrador configura el Custom GPT en OpenAI <strong>una sola vez</strong>. No se crean múltiples GPTs ni se comparten contraseñas entre usuarios:
      </p>
      <table class="inst">
        <thead>
          <tr>
            <th style="width:20%">Escenario</th>
            <th style="width:45%">Cómo se Autentica desde ChatGPT</th>
            <th style="width:35%">Permisos y Resultados</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Jimmy Arias</strong><br/>(Super Admin)</td>
            <td>Token personal (<span class="code-inline">arias_gpt_...</span>) o botón OAuth en <span class="code-inline">/oauth/chatgpt-authorize</span> con su sesión del CRM.</td>
            <td><span class="pill-ok">Publica directo</span>, programa en Planning o edita memoria de Arias Defense.</td>
          </tr>
          <tr>
            <td><strong>Patricia Morales</strong><br/>(Equipo Marketing)</td>
            <td>Genera su propio token en el CRM (o hace clic en <em>Autorizar ChatGPT</em> con su usuario dentro del mismo enlace compartido).</td>
            <td>Puede configurarse en <span class="pill-warn">Solo Borrador</span> para aprobación previa o <span class="pill-ok">Publica directo</span> según rol.</td>
          </tr>
          <tr>
            <td><strong>Nuevo Cliente SaaS</strong><br/>(Futuro Tenant)</td>
            <td>Solo cuando ARIAS habilite <span class="code-inline">ai_content_studio_enabled</span> en su empresa, inicia sesión OAuth con su propia cuenta.</td>
            <td>Aislamiento absoluto: lee únicamente sus páginas de Facebook/IG y su propio calendario.</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Contratos API del Puente (<span class="code-inline">arias-social-bridge</span>)</h2>
      <table class="inst">
        <thead>
          <tr>
            <th style="width:26%">Endpoint / Acción</th>
            <th style="width:22%">Método</th>
            <th style="width:52%">Responsabilidad Operativa</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="code-inline">/accounts</span></td>
            <td>GET (Bearer Token)</td>
            <td>Lista páginas de Facebook e Instagram conectadas y autorizadas para el tenant activo.</td>
          </tr>
          <tr>
            <td><span class="code-inline">/memory</span></td>
            <td>GET (Bearer Token)</td>
            <td>Entrega las últimas publicaciones y códigos de episodio para mantener continuidad editorial.</td>
          </tr>
          <tr>
            <td><span class="code-inline">/posts</span></td>
            <td>POST (Bearer Token)</td>
            <td>Descarga el flyer (<span class="code-inline">openaiFileIdRefs</span>), lo persiste en Storage y crea registro como <span class="code-inline">scheduled</span>, <span class="code-inline">draft</span> o publica directo vía Meta.</td>
          </tr>
          <tr>
            <td><span class="code-inline">process_due_scheduled</span></td>
            <td>pg_cron / RPC</td>
            <td>Cada 5 minutos toma posts con <span class="code-inline">status = 'scheduled'</span> vencidos y ejecuta publicación multi-página.</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${pageFooter(2, 'ARIAS GROUP · Arquitectura Social Bridge &amp; Multi-Usuario')}
  </section>

  <!-- ================= PÁGINA 3: CONECTAR CHATGPT PLUS ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Sección 02 · Configuración Inicial del Conector</div>
      <h1>Paso 1 — Conectar ChatGPT Plus al CRM</h1>
      <p class="lead">
        Desde la barra superior de <span class="code-inline">/marketing/planning</span>, haga clic en el botón verde <strong>Conectar ChatGPT</strong> para abrir el asistente de vinculación por usuario y obtener el esquema OpenAPI e instrucciones del Custom GPT.
      </p>

      <div class="shot-wrap">
        <div class="shot-frame">
          <img src="${imgModal}" alt="Modal Conectar ChatGPT Plus en ARIAS CRM" />
          <div class="callout-box" style="left:54.5%;top:31.8%;width:20.1%;height:4.9%;">
            <div class="callout-tag">1</div>
          </div>
          <div class="callout-box" style="left:25.4%;top:37.3%;width:49.2%;height:11.0%;">
            <div class="callout-tag bottom">2</div>
          </div>
          <div class="callout-box" style="left:55.6%;top:52.8%;width:19.0%;height:5.8%;">
            <div class="callout-tag right">3</div>
          </div>
          <div class="callout-box" style="left:25.4%;top:59.6%;width:49.2%;height:7.6%;">
            <div class="callout-tag">4</div>
          </div>
        </div>
      </div>

      <div class="legend-grid">
        <div class="legend-item">
          <span class="legend-num">1</span><strong>Generar Token por Usuario:</strong> Escriba etiqueta (ej. <em>ChatGPT Plus · Patricia</em>), marque o desmarque <em>Permitir publicar directo</em> y presione <strong>Generar Token</strong>. Copie el token inmediatamente (solo se muestra una vez).
        </div>
        <div class="legend-item">
          <span class="legend-num">2</span><strong>Control de Equipo y Revocación:</strong> Visualiza los tokens activos de Jimmy y Patricia con su permiso (<em>Publica directo</em> vs <em>Solo Borrador</em>) y permite revocar acceso con 1 clic en caso de rotación.
        </div>
        <div class="legend-item">
          <span class="legend-num">3</span><strong>Copiar Esquema e Instrucciones:</strong> Botones rápidos para copiar el JSON OpenAPI 3.1.0 (ya incluye <span class="code-inline">x-openai-isConsequential: false</span> y soporte <span class="code-inline">openaiFileIdRefs</span>) y el prompt editorial maestro.
        </div>
        <div class="legend-item">
          <span class="legend-num">4</span><strong>URLs OAuth 2.0 Multi-Usuario:</strong> Para compartir el mismo Custom GPT con Patricia u otros tenants autorizados, pegue la <em>Authorization URL</em> (<span class="code-inline">/oauth/chatgpt-authorize</span>) y la <em>Token URL</em> en OpenAI Actions.
        </div>
      </div>

      <div class="note-box" style="margin-top:8px;">
        <strong>Configuración en OpenAI (una sola vez):</strong> En <em>chatgpt.com &gt; Explore GPTs &gt; Create &gt; Configure &gt; Actions</em>, pegue el <strong>Esquema OpenAPI</strong> (Recuadro 3) y seleccione autenticación <strong>OAuth</strong> con las dos URLs del Recuadro 4 (o <strong>API Key Bearer</strong> si desea conectar un token individual rápidamente).
      </div>
    </div>
    ${pageFooter(3, 'ARIAS GROUP · Paso 1: Conectar ChatGPT Plus al CRM')}
  </section>

  <!-- ================= PÁGINA 4: VISTA CALENDARIO SEMANAL ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Sección 03 · Planeación Visual por Semana</div>
      <h1>Paso 2 — Calendario Semanal de Publicaciones</h1>
      <p class="lead">
        La pestaña principal <strong>Calendario</strong> replica la estructura limpia de Metricool sobre una grilla de 7 días (domingo a sábado) en zona horaria fija <strong>El Salvador (-06:00)</strong>, mostrando miniatura real, línea editorial y estado de cada flyer.
      </p>

      <div class="shot-wrap">
        <div class="shot-frame">
          <img src="${imgCal}" alt="Vista Calendario en Social Planning de ARIAS CRM" />
          <div class="callout-box" style="left:21.6%;top:25.2%;width:24.2%;height:5.3%;">
            <div class="callout-tag">1</div>
          </div>
          <div class="callout-box" style="left:75.3%;top:11.9%;width:11.8%;height:4.9%;">
            <div class="callout-tag">2</div>
          </div>
          <div class="callout-box" style="left:69.1%;top:16.6%;width:8.6%;height:4.5%;">
            <div class="callout-tag bottom">3</div>
          </div>
          <div class="callout-box" style="left:32.9%;top:43.0%;width:10.1%;height:46.8%;">
            <div class="callout-tag right">4</div>
          </div>
        </div>
      </div>

      <div class="legend-grid">
        <div class="legend-item">
          <span class="legend-num">1</span><strong>Navegación de Vistas:</strong> Cambie al instante entre <strong>Calendario</strong> (semanal visual), <strong>Lista</strong> (cola tabular cronológica) y <strong>Eliminados</strong> (papelera auditable con restauración).
        </div>
        <div class="legend-item">
          <span class="legend-num">2</span><strong>Acceso al Conector ChatGPT:</strong> Abre el asistente de tokens e instrucciones Custom GPT mostrado en el Paso 1 y verifica cuántas páginas Meta activas tiene la empresa.
        </div>
        <div class="legend-item">
          <span class="legend-num">3</span><strong>+ Crear Post Manual:</strong> Permite programar o publicar directamente desde el CRM cargando cualquier imagen o video existente en el equipo sin depender de ChatGPT.
        </div>
        <div class="legend-item">
          <span class="legend-num">4</span><strong>Tarjetas de Flyer y Etiqueta GPT:</strong> Cada tarjeta muestra hora local, estado (<span class="code-inline">Publicado</span> verde o <span class="code-inline">Programado</span> azul), redes destino (<span class="code-inline">FB</span> / <span class="code-inline">IG</span>) e insignia <strong>GPT</strong> cuando proviene de ChatGPT Plus.
        </div>
      </div>

      <div class="note-box" style="margin-top:8px;">
        <strong>Programación Directa por Día:</strong> Al hacer clic en <strong>+</strong> de la cabecera del día o en <strong>+ Programar</strong> dentro de cualquier columna vacía, el modal pre-carga esa fecha exacta para agilizar la planeación semanal.
      </div>
    </div>
    ${pageFooter(4, 'ARIAS GROUP · Paso 2: Vista Calendario Semanal')}
  </section>

  <!-- ================= PÁGINA 5: VISTA LISTA & PUBLICACIÓN INMEDIATA ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Sección 04 · Gestión de Cola y Publicación Directa</div>
      <h1>Paso 3 — Vista Lista, Filtros y Publicación Inmediata</h1>
      <p class="lead">
        La pestaña <strong>Lista</strong> consolida todas las publicaciones ordenadas por fecha para revisar el texto completo, los chips de línea editorial, las páginas Meta destino y ejecutar publicación inmediata antes de la hora programada.
      </p>

      <div class="shot-wrap">
        <div class="shot-frame">
          <img src="${imgList}" alt="Vista Lista y acciones en Social Planning" />
          <div class="callout-box" style="left:29.6%;top:25.2%;width:7.2%;height:5.2%;">
            <div class="callout-tag">1</div>
          </div>
          <div class="callout-box" style="left:22.2%;top:33.1%;width:29.4%;height:3.8%;">
            <div class="callout-tag bottom">2</div>
          </div>
          <div class="callout-box" style="left:82.8%;top:44.0%;width:12.6%;height:4.5%;">
            <div class="callout-tag right">3</div>
          </div>
        </div>
      </div>

      <div class="legend-grid">
        <div class="legend-item">
          <span class="legend-num">1</span><strong>Pestaña Lista con Contador:</strong> Indica el total de publicaciones activas (excluyendo papelera) para revisión rápida de contenido pendiente y ya enviado.
        </div>
        <div class="legend-item">
          <span class="legend-num">2</span><strong>Filtros por Estado + Búsqueda:</strong> Separa con 1 clic <em>Todos</em>, <em>Programados</em>, <em>Publicados</em>, <em>Borradores</em> y <em>Error</em>, combinable con buscador por episodio y selector de línea o página.
        </div>
        <div class="legend-item" style="grid-column:1 / span 2;">
          <span class="legend-num">3</span><strong>Publicar ya / Editar / Mover a Eliminados:</strong> El botón verde <strong>Publicar ya</strong> ejecuta en tiempo real el envío hacia todas las páginas seleccionadas (<span class="code-inline">Facebook</span> e <span class="code-inline">Instagram</span>) guardando el <span class="code-inline">platform_post_id</span> de Meta; <strong>Editar</strong> ajusta fecha, caption o páginas; el ícono rojo mueve el post a la papelera sin perder historial.
        </div>
      </div>

      <table class="inst" style="margin-top:8px;">
        <thead>
          <tr>
            <th style="width:22%">Estado del Post</th>
            <th style="width:46%">Comportamiento del Sistema</th>
            <th style="width:32%">Acción Recomendada</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Programado</strong></td>
            <td>En espera de su hora local (<span class="code-inline">-06:00</span>). El job <span class="code-inline">pg_cron</span> lo publica en máximo 5 minutos tras vencer la hora.</td>
            <td>Usar <strong>Publicar ya</strong> si desea adelantarlo.</td>
          </tr>
          <tr>
            <td><strong>Borrador</strong></td>
            <td>Creado por usuario sin permiso directo o marcado para revisión editorial previa antes de salir a redes.</td>
            <td>Editar fecha/copy y cambiar estado a Programado.</td>
          </tr>
          <tr>
            <td><strong>Error / Parcial</strong></td>
            <td>Meta rechazó alguna página (ej. token expirado o formato). El detalle técnico queda guardado en el registro.</td>
            <td>Renovar conexión en <em>Connected Accounts</em> y reintentar.</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${pageFooter(5, 'ARIAS GROUP · Paso 3: Vista Lista y Publicación Inmediata')}
  </section>

  <!-- ================= PÁGINA 6: ELIMINADOS & AUDITORÍA ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Sección 05 · Control de Papelera y Trazabilidad</div>
      <h1>Paso 4 — Posts Eliminados y Restauración Segura</h1>
      <p class="lead">
        Siguiendo el diseño operativo de Metricool, ninguna eliminación borra evidencia operativa de forma irreversible: todo post descartado pasa a la pestaña <strong>Eliminados</strong> con fecha exacta y usuario responsable, listo para restaurarse en 1 clic.
      </p>

      <div class="shot-wrap">
        <div class="shot-frame">
          <img src="${imgDel}" alt="Vista Eliminados con auditoría y botón Restaurar" />
          <div class="callout-box" style="left:36.4%;top:25.2%;width:9.3%;height:5.2%;">
            <div class="callout-tag">1</div>
          </div>
          <div class="callout-box" style="left:61.8%;top:37.5%;width:25.4%;height:4.7%;">
            <div class="callout-tag">2</div>
          </div>
          <div class="callout-box" style="left:88.0%;top:37.4%;width:7.5%;height:4.9%;">
            <div class="callout-tag right">3</div>
          </div>
        </div>
      </div>

      <div class="legend-grid">
        <div class="legend-item">
          <span class="legend-num">1</span><strong>Pestaña Eliminados:</strong> Muestra contador en tiempo real de publicaciones movidas a papelera (<span class="code-inline">deleted_at IS NOT NULL</span>). El cron automático nunca publica registros en papelera.
        </div>
        <div class="legend-item">
          <span class="legend-num">2</span><strong>Auditoría de Quién Eliminó:</strong> Registra marca de tiempo exacta (<strong>ELIMINADO EL</strong>) y correo/nombre del usuario responsable (<strong>ELIMINADO POR</strong>) para trazabilidad total del equipo.
        </div>
        <div class="legend-item" style="grid-column:1 / span 2;">
          <span class="legend-num">3</span><strong>Botón Restaurar:</strong> Limpia <span class="code-inline">deleted_at</span> y devuelve la publicación inmediatamente a la pestaña <em>Calendario</em> y <em>Lista</em> conservando su fecha, flyer, línea editorial y páginas destino.
        </div>
      </div>

      <div class="note-box" style="margin-top:10px;">
        <strong>Política Anti-Pérdida de Contenido:</strong> Cuando un flyer fue enviado desde ChatGPT Plus con <span class="code-inline">openaiFileIdRefs</span>, su archivo ya quedó respaldado en Supabase Storage privado de Arias CRM antes de aparecer en Planning. Moverlo a Eliminados no rompe la imagen almacenada si posteriormente decide restaurarlo.
      </div>
    </div>
    ${pageFooter(6, 'ARIAS GROUP · Paso 4: Papelera y Auditoría')}
  </section>

  <!-- ================= PÁGINA 7: USO DIARIO GPT, CHECKLIST & PRIVACIDAD ================= -->
  <section class="page">
    ${pageHeader()}
    <div class="content">
      <div class="kicker">Sección 06 · Operación Diaria con ChatGPT Plus &amp; Cumplimiento</div>
      <h1>Flujo Diario en ChatGPT y Checklist Operativo</h1>
      <p class="lead">
        Para mantener la misma calidad gráfica original de ChatGPT y asegurar continuidad entre episodios de <strong>AI + LEAN™</strong> y <strong>Motivación Empresarial</strong>, el equipo sigue este ciclo estándar en cada publicación.
      </p>

      <h2>1. Secuencia Estándar dentro del Custom GPT</h2>
      <table class="inst">
        <thead>
          <tr>
            <th style="width:10%">Paso</th>
            <th style="width:30%">Acción del Usuario / GPT</th>
            <th style="width:60%">Resultado Técnico en ARIAS CRM</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>01</strong></td>
            <td>Solicitar tema o pedir sugerencia</td>
            <td>El Custom GPT invoca <span class="code-inline">GET /memory</span> y <span class="code-inline">GET /accounts</span> para leer los últimos episodios ya publicados y las páginas activas.</td>
          </tr>
          <tr>
            <td><strong>02</strong></td>
            <td>Generar y aprobar el flyer</td>
            <td>ChatGPT Plus genera el diseño original con su motor nativo de imágenes (\$0 costo API) respetando la fotografía maestra del autor y textos legibles.</td>
          </tr>
          <tr>
            <td><strong>03</strong></td>
            <td>Decidir destino (Pregunta obligatoria)</td>
            <td>El GPT pregunta: <em>"¿Lo publico de una vez o lo pongo en Planning?"</em> y confirma páginas (ej. <em>Arias Group</em> / <em>Jimmy Arias AI + Lean</em>).</td>
          </tr>
          <tr>
            <td><strong>04</strong></td>
            <td>Ejecución en CRM</td>
            <td>El GPT llama a <span class="code-inline">POST /posts</span> enviando <span class="code-inline">openaiFileIdRefs</span>. Si es inmediato, publica al instante en Meta; si es Planning, aparece en Calendario/Lista.</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Checklist de Verificación Pre-Publicación</h2>
      <table class="inst">
        <thead>
          <tr>
            <th style="width:8%">Ok</th>
            <th style="width:34%">Criterio de Calidad</th>
            <th style="width:58%">Validación Esperada</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>[ &nbsp; ]</td>
            <td>Continuidad de Episodio / Principio</td>
            <td>El código (<span class="code-inline">EPISODIO XX</span> / <span class="code-inline">PRINCIPIO XX</span>) no se duplica frente al historial en la vista <em>Lista</em>.</td>
          </tr>
          <tr>
            <td>[ &nbsp; ]</td>
            <td>Fidelidad Visual y Tipográfica</td>
            <td>Sin letras deformadas, rostro fiel del autor y firma institucional coherente con la línea seleccionada.</td>
          </tr>
          <tr>
            <td>[ &nbsp; ]</td>
            <td>Páginas Meta Destino Correctas</td>
            <td>Verificadas las insignias <span class="code-inline">FB</span> / <span class="code-inline">IG</span> deseadas y token de Meta vigente en <em>Connected Accounts</em>.</td>
          </tr>
          <tr>
            <td>[ &nbsp; ]</td>
            <td>Hora Programada en Zona -06:00</td>
            <td>Confirmar fecha/hora en horario de El Salvador; recordar que el cron ejecuta cada 5 minutos.</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Cláusula de Uso Interno, Privacidad y Propiedad Intelectual</h2>
      <div class="note-box">
        <strong>Confidencialidad y Gobierno Corporativo (ARIAS GROUP):</strong> Este manual operativo (<span class="code-inline">SOP-COM-2026-04</span>), los tokens personales <span class="code-inline">arias_gpt_*</span>, las fotografías maestras autorizadas y la metodología <strong>AI + LEAN™</strong> son activos confidenciales propiedad exclusiva de <strong>Arias Defense Components LLC</strong>. Está estrictamente prohibido compartir tokens personales, URLs privadas del puente o credenciales de OAuth fuera del personal autorizado de la organización. Toda actividad ejecutada mediante el puente queda registrada con marca de tiempo, empresa y usuario responsable para auditoría interna.
      </div>
    </div>
    ${pageFooter(7, 'ARIAS GROUP · Operación Diaria, Checklist y Privacidad')}
  </section>

</body>
</html>`;
}

function main() {
  const html = buildHtml();
  fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
  fs.writeFileSync(TMP_HTML, html, 'utf8');

  const chrome = resolveChrome();
  const fileUrl = `file:///${TMP_HTML.replace(/\\/g, '/')}`;

  try {
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        `--print-to-pdf=${OUT_PDF}`,
        fileUrl,
      ],
      { stdio: 'inherit' },
    );
  } finally {
    if (fs.existsSync(TMP_HTML)) {
      fs.unlinkSync(TMP_HTML);
    }
  }

  const bytes = fs.statSync(OUT_PDF).size;
  console.log(`PDF generado correctamente: ${OUT_PDF} (${bytes} bytes)`);
}

main();
