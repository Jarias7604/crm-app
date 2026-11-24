import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.cwd();
const SCRATCH_SHOTS = 'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch/screenshots';
const OUT_PDF = path.join(WORKSPACE, 'docs', 'SOP_Social_Planning_Conector_ChatGPT_CRM.pdf');
const TMP_HTML = path.join(WORKSPACE, 'scratch_sop_social_planning.html');

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

const pCal = loadShot('p_01_planning_calendario.png');
const pList = loadShot('p_02_planning_lista.png');
const pDel = loadShot('p_03_planning_eliminados.png');
const pModal = loadShot('p_04_modal_conectar_chatgpt.png');

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
  .diagram-wrap {
    margin: 14px 0 12px 0;
  }
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
    width: 83%;
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
  .callout-tag.bottom {
    top: auto;
    bottom: -15px;
  }
  .callout-tag.right {
    left: auto;
    right: -1px;
  }
  .fig-cap { font-size: 8.5px; color: #64748b; margin-bottom: 10px; line-height: 1.35; }
  .rules-list { list-style: none; margin: 6px 0 14px 0; }
  .rules-list li { font-size: 9.8px; color: #1f2937; margin-bottom: 5px; line-height: 1.45; }
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

const hdr = (code = 'SOP-COM-2026-04 | Uso interno') => `
  <div class="top-rule">
    <span class="brand">ARIAS GROUP</span>
    <span class="doc-code">${code}</span>
  </div>`;

const ftr = (page, total) => `
  <div class="footer-rule">
    <span>Marketing y Redes Sociales / Versión 1.0 · Documentación operativa</span>
    <span>${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`;

const html = `${commonHead('SOP-COM-2026-04 — Social Planning y Conector ChatGPT Plus')}

<!-- PAGE 1: COVER -->
<section class="page">
  <div>
    ${hdr()}
    <div style="margin-top:34px;">
      <div class="kicker">MARKETING Y REDES SOCIALES / PROCEDIMIENTO ESTÁNDAR DE OPERACIÓN</div>
      <div class="cover-title">Social Planning y<br/>conector ChatGPT Plus</div>
      <div class="cover-sub">Integración multi-usuario con Arias CRM y publicación directa en Meta</div>

      <div class="kicker" style="margin-top:24px;">CONTROL DOCUMENTAL</div>
      <table class="kv-table">
        <tr><td class="kv-key">Código</td><td class="kv-val">SOP-COM-2026-04</td></tr>
        <tr><td class="kv-key">Versión</td><td class="kv-val">1.0 · Producción</td></tr>
        <tr><td class="kv-key">Vigencia</td><td class="kv-val">Noviembre 2026</td></tr>
        <tr><td class="kv-key">Alcance</td><td class="kv-val">Arias Defense Components LLC (flag ai_content_studio_enabled)</td></tr>
        <tr><td class="kv-key">Relación operativa</td><td class="kv-val">Extiende Social Media Hub sin alterar /marketing/social</td></tr>
      </table>

      <h3 class="sub-h">Responsables de control documental</h3>
      <table class="inst">
        <thead>
          <tr><th style="width:48%;">Función</th><th style="width:52%;">Responsable / estado</th></tr>
        </thead>
        <tbody>
          <tr><td>Elaboración · Arquitectura, Bridge y CRM</td><td>Implementado y verificado en producción</td></tr>
          <tr><td>Revisión · Dirección y Supervisión</td><td>Jimmy Arias (Super Admin · Arias Group)</td></tr>
          <tr><td>Uso operativo</td><td>Dirección, Equipo de Marketing (Patricia Morales) y Administración SaaS</td></tr>
        </tbody>
      </table>
      <p class="body-p" style="color:#475569;">Distribución prevista: Dirección, Marketing y Administración SaaS.</p>
    </div>
  </div>
  ${ftr(1, 8)}
</section>

<!-- PAGE 2: 01 / MARCO OPERATIVO -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">01 / MARCO OPERATIVO</div>
    <h1 class="sec-h1">Objetivo, alcance y flujo</h1>
    <p class="lead-p">Creación de flyers originales en ChatGPT Plus (\$20/mes) con envío directo o programación en Arias CRM.</p>

    <p class="body-p"><strong>Objetivo.</strong> Eliminar la descarga manual de flyers desde ChatGPT y el uso de plataformas externas como Metricool, permitiendo al equipo generar diseños originales en su cuenta ChatGPT Plus (\$0 costo extra de API) y elegir desde el chat si el post se publica al instante o entra al calendario de Planning.</p>
    <p class="body-p"><strong>Alcance.</strong> Módulo <code>/marketing/planning</code>, asistente de autorización OAuth <code>/oauth/chatgpt-authorize</code>, Edge Function <code>arias-social-bridge</code>, tabla <code>social_bridge_tokens</code>, memoria persistente en <code>social_posts</code> y ejecución programada cada 5 minutos en zona El Salvador (<code>-06:00</code>). El módulo <code>Social Media Hub (/marketing/social)</code> se mantiene intacto.</p>

    <div class="diagram-wrap">
      <svg viewBox="0 0 680 265" width="100%" height="248" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
          </marker>
        </defs>
        <rect x="20" y="14" width="175" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="107" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f172a">1. ChatGPT Plus ($20/mes)</text>
        <text x="107" y="52" text-anchor="middle" font-size="9" fill="#475569">Flyer original + openaiFileIdRefs</text>

        <line x1="196" y1="41" x2="246" y2="41" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <rect x="250" y="14" width="185" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="342" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f172a">2. arias-social-bridge</text>
        <text x="342" y="52" text-anchor="middle" font-size="9" fill="#475569">Valida OAuth/Token + Feature Flag</text>

        <line x1="436" y1="41" x2="484" y2="41" stroke="#475569" stroke-width="1.4" marker-end="url(#arr1)"/>

        <rect x="488" y="14" width="172" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="574" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f172a">3. Storage + Memoria BD</text>
        <text x="574" y="52" text-anchor="middle" font-size="9" fill="#475569">Guarda flyer y episodios previos</text>

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
        <text x="145" y="233" text-anchor="middle" font-size="8.8" fill="#475569">Invoca publish-facebook / publish-instagram</text>
        <text x="145" y="246" text-anchor="middle" font-size="8.8" fill="#475569">Registra ID de publicación Meta</text>

        <rect x="418" y="200" width="234" height="54" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="535" y="218" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">Calendario + Cron 5 min</text>
        <text x="535" y="233" text-anchor="middle" font-size="8.8" fill="#475569">Visible en Calendario y Lista (El Salvador -06:00)</text>
        <text x="535" y="246" text-anchor="middle" font-size="8.8" fill="#475569">pg_cron publica automáticamente al vencer</text>
      </svg>
    </div>

    <p class="body-p"><strong>Resultado esperado:</strong> flujo continuo desde el chat hasta Facebook e Instagram sin descargas manuales y sin repetir episodios previos.</p>
    <p class="body-p"><strong>Aislamiento SaaS:</strong> cualquier empresa con <code>ai_content_studio_enabled = false</code> no visualiza el menú ni puede operar la API (respuesta HTTP 403 en servidor).</p>
  </div>
  ${ftr(2, 8)}
</section>

<!-- PAGE 3: 02 / CONFIGURACIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">02 / CONFIGURACIÓN</div>
    <h1 class="sec-h1">Aislamiento, endpoints y reglas del puente</h1>
    <p class="lead-p">Todos los tokens, flyers, páginas conectadas y memoria editorial quedan aislados por <code>company_id</code>.</p>

    <table class="inst">
      <thead>
        <tr>
          <th style="width:24%;">Componente / Endpoint</th>
          <th style="width:30%;">Mecanismo técnico</th>
          <th style="width:46%;">Regla operativa y seguridad</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Feature flag SaaS</strong></td>
          <td><code>ai_content_studio_enabled</code> en <code>companies.features</code></td>
          <td>Activado únicamente para Arias Defense Components LLC; bloquea menú en frontend y peticiones en backend para otros tenants.</td>
        </tr>
        <tr>
          <td><strong>Tokens y OAuth 2.0</strong></td>
          <td><code>arias_gpt_*</code> (SHA-256) y <code>/oauth/chatgpt-authorize</code></td>
          <td>Un solo Custom GPT sirve para Jimmy, Patricia y futuros clientes SaaS; cada miembro autentica su propio usuario con permiso directo o solo borrador.</td>
        </tr>
        <tr>
          <td><strong>GET /accounts</strong></td>
          <td>Bridge Bearer Token por usuario</td>
          <td>Devuelve únicamente las páginas de Facebook e Instagram autorizadas de la empresa del usuario autenticado.</td>
        </tr>
        <tr>
          <td><strong>GET /memory</strong></td>
          <td>Bridge Bearer Token por usuario</td>
          <td>Consulta los últimos 15 posts de AI + LEAN™ y Motivación Empresarial para mantener secuencia exacta sin repetir temas.</td>
        </tr>
        <tr>
          <td><strong>POST /posts</strong></td>
          <td>Ingesta <code>openaiFileIdRefs</code> + Storage</td>
          <td>Descarga la imagen temporal de ChatGPT, la respalda en Supabase Storage privado y la crea como <em>published</em>, <em>scheduled</em> o <em>draft</em>.</td>
        </tr>
        <tr>
          <td><strong>Ejecución automática</strong></td>
          <td><code>pg_cron</code> cada 5 minutos (<code>process-scheduled-social-posts-5m</code>)</td>
          <td>Procesa posts con estado <em>scheduled</em> vencidos en hora local El Salvador (<code>-06:00</code>) y omite registros en papelera.</td>
        </tr>
      </tbody>
    </table>

    <h3 class="sub-h">Criterio multi-empresa y costo \$0 API</h3>
    <p class="body-p">La generación visual se ejecuta íntegramente con el motor nativo de <strong>ChatGPT Plus (\$20/mes)</strong> mediante el conector <em>Actions</em>, evitando pagar por consumo adicional de API de imágenes y preservando intacto el módulo clásico <strong>Social Media Hub</strong> (<code>/marketing/social</code>).</p>
  </div>
  ${ftr(3, 8)}
</section>

<!-- PAGE 4: 03 / EJECUCIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">03 / EJECUCIÓN</div>
    <h1 class="sec-h1">Responsabilidades por área</h1>
    <p class="lead-p">Operación diaria en ChatGPT Plus, Planning y administración de permisos por usuario.</p>

    <h3 class="sub-h">A. Dirección y Administración CRM (Jimmy Arias)</h3>
    <div class="step-hdr"><span class="num">01 ·</span> Configurar Custom GPT una sola vez</div>
    <p class="body-p">Desde <strong>Social Media Hub → Planning → Conectar ChatGPT</strong>, copiar el Esquema OpenAPI e Instrucciones maestras en OpenAI y definir la autenticación (OAuth 2.0 multi-usuario o token Bearer personal).</p>

    <div class="step-hdr"><span class="num">02 ·</span> Administrar tokens y permisos</div>
    <p class="body-p">Generar o revocar tokens por miembro (<em>Permitir publicar directo</em> vs <em>Solo Borrador</em>) sin compartir contraseñas ni exponer credenciales de Meta.</p>

    <div class="step-hdr"><span class="num">03 ·</span> Habilitar futuros tenants SaaS</div>
    <p class="body-p">Activar la bandera <code>ai_content_studio_enabled</code> únicamente cuando otra empresa contrate el servicio; cada cliente verá su propio calendario y sus propias páginas.</p>

    <h3 class="sub-h">B. Equipo de Marketing (Patricia y usuarios autorizados)</h3>
    <div class="step-hdr"><span class="num">01 ·</span> Vincular cuenta personal</div>
    <p class="body-p">Ingresar con su usuario CRM en el enlace OAuth o solicitar su token <code>arias_gpt_*</code> dentro de <em>Conectar ChatGPT</em>.</p>

    <div class="step-hdr"><span class="num">02 ·</span> Crear flyers en ChatGPT Plus con memoria</div>
    <p class="body-p">Antes de diseñar un nuevo episodio de <em>AI + LEAN™</em> o <em>Motivación empresarial</em>, permitir que el GPT consulte <code>GET /memory</code> para continuar la numeración oficial.</p>

    <div class="step-hdr"><span class="num">03 ·</span> Confirmar publicación directa o Planning</div>
    <p class="body-p">Responder a la pregunta del GPT (<em>"¿Lo publico de una vez o lo pongo en Planning?"</em>) indicando fecha/hora en El Salvador (<code>-06:00</code>) y páginas destino.</p>

    <h3 class="sub-h">C. Supervisión de colas y Meta</h3>
    <div class="step-hdr"><span class="num">01 ·</span> Verificar cuentas conectadas</div>
    <p class="body-p">Confirmar en el indicador <em>Páginas</em> y en <em>Connected Accounts</em> que los tokens de Facebook e Instagram permanezcan vigentes.</p>
  </div>
  ${ftr(4, 8)}
</section>

<!-- PAGE 5: 04 / CONTROL OPERATIVO Y SUPERVISIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">04 / CONTROL OPERATIVO Y SUPERVISIÓN</div>
    <h1 class="sec-h1">Estados, verificación y control documental</h1>
    <p class="lead-p">Interpretación de estados en Lista y herramientas de auditoría semanal para Dirección.</p>

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
          <td><strong>Programado</strong></td>
          <td>En espera de fecha/hora en zona El Salvador (<code>-06:00</code>).</td>
          <td>El cron publica cada 5 min; o pulsar <em>Publicar ya</em> para adelantarlo.</td>
        </tr>
        <tr>
          <td><strong>Publicado</strong></td>
          <td>Enviado correctamente a Facebook / Instagram con ID registrado.</td>
          <td>Sirve de memoria editorial automática en <code>GET /memory</code>.</td>
        </tr>
        <tr>
          <td><strong>Borrador</strong></td>
          <td>Generado por usuario sin permiso directo o pendiente de revisión.</td>
          <td>Revisar diseño/texto en <em>Lista → Editar</em> y cambiar a Programado.</td>
        </tr>
        <tr>
          <td><strong>Error / Parcial</strong></td>
          <td>Meta rechazó una o más páginas destino al intentar publicar.</td>
          <td>Renovar conexión en <em>Connected Accounts</em> y reintentar con <em>Publicar ya</em>.</td>
        </tr>
        <tr>
          <td><strong>Eliminado</strong></td>
          <td>Movido a papelera con fecha y usuario responsable registrados.</td>
          <td>Usar <em>Restaurar</em> en 1 clic si se requiere devolverlo al calendario.</td>
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
      <li><strong>01.</strong> Nunca re-crear manualmente en Canva o Metricool lo que ya diseñó ChatGPT Plus; enviarlo directo vía Actions al CRM.</li>
      <li><strong>02.</strong> Mantener un token individual por cada integrante (Jimmy, Patricia) para auditar quién envió o eliminó cada post.</li>
      <li><strong>03.</strong> Verificar siempre la zona horaria El Salvador (<code>-06:00</code>) antes de confirmar una fecha programada en Planning.</li>
      <li><strong>04.</strong> No alterar el módulo clásico <code>Social Media Hub (/marketing/social)</code>; operar toda programación semanal desde <code>Planning</code>.</li>
    </ul>

    <h3 class="sub-h">Historial documental</h3>
    <table class="inst" style="margin-bottom:0;">
      <thead>
        <tr><th style="width:22%;">Versión / fecha</th><th style="width:52%;">Descripción</th><th style="width:26%;">Estado</th></tr>
      </thead>
      <tbody>
        <tr><td>1.0 / Nov. 2026</td><td>Publicación inicial SOP-COM-2026-04 alineada al estándar ARIAS GROUP con capturas reales del CRM.</td><td>Vigente en producción</td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(5, 8)}
</section>

<!-- PAGE 6: 05 / PROCEDIMIENTO VISUAL (Conector ChatGPT + Calendario) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:14px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-04 | Uso interno</span>
    </div>
    <div class="kicker">05 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Conector ChatGPT Plus y Calendario Semanal</h1>
    <p class="lead-p" style="margin-bottom:8px;">Vinculación segura por usuario y vista semanal de publicaciones en <code>/marketing/planning</code>.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">01 ·</span> Abrir Conectar ChatGPT y gestionar tokens por usuario o esquema OpenAPI</div>
    <p class="body-p" style="margin-bottom:4px;">En la barra superior de Planning, presione <strong>Conectar ChatGPT</strong> para generar tokens individuales (Jimmy / Patricia), copiar el esquema OpenAPI e instrucciones o consultar las URLs OAuth 2.0 multi-usuario.</p>
    <div class="shot-frame compact">
      <img src="${pModal}" alt="Modal Conectar ChatGPT Plus" />
      <div class="callout-box" style="left:54.5%;top:31.8%;width:20.1%;height:4.9%;"><span class="callout-tag">1. Generar Token</span></div>
      <div class="callout-box" style="left:25.4%;top:37.3%;width:49.2%;height:11.0%;"><span class="callout-tag bottom">2. Tokens por usuario (Jimmy / Patricia)</span></div>
      <div class="callout-box" style="left:55.6%;top:52.8%;width:19.0%;height:5.8%;"><span class="callout-tag right">3. Esquema e Instrucciones</span></div>
      <div class="callout-box" style="left:25.4%;top:59.6%;width:49.2%;height:7.6%;"><span class="callout-tag bottom">4. URLs OAuth 2.0 (1 clic)</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:6px;">Figura 1. Asistente de vinculación multi-usuario con control granular de publicación directa vs solo borrador.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">02 ·</span> Planificar publicaciones en la grilla del Calendario Semanal</div>
    <p class="body-p" style="margin-bottom:4px;">La vista principal muestra la semana en horario de El Salvador (<code>-06:00</code>), diferenciando flyers programados, publicados y tarjetas generadas desde ChatGPT (<code>GPT</code>).</p>
    <div class="shot-frame compact">
      <img src="${pCal}" alt="Vista Calendario Semanal" />
      <div class="callout-box" style="left:21.6%;top:25.2%;width:24.2%;height:5.3%;"><span class="callout-tag">1. Vistas Calendario / Lista / Eliminados</span></div>
      <div class="callout-box" style="left:75.3%;top:11.9%;width:11.8%;height:4.9%;"><span class="callout-tag right">2. Conectar ChatGPT</span></div>
      <div class="callout-box" style="left:69.1%;top:16.6%;width:8.6%;height:4.5%;"><span class="callout-tag bottom right">3. + Crear Post</span></div>
      <div class="callout-box" style="left:32.9%;top:43.0%;width:10.1%;height:46.8%;"><span class="callout-tag">4. Flyers GPT y estados</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:2px;">Figura 2. Vista real del Calendario semanal con acceso directo al conector, creación manual por día e insignia GPT.</div>
  </div>
  ${ftr(6, 8)}
</section>

<!-- PAGE 7: 06 / PROCEDIMIENTO VISUAL (Lista y Publicación Inmediata) -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">06 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1">Vista Lista, filtros y publicación inmediata</h1>
    <p class="lead-p">Revisión cronológica del texto, páginas Meta asignadas y publicación en tiempo real antes de la hora programada.</p>

    <div class="step-hdr"><span class="num">03 ·</span> Filtrar la cola de publicaciones y ejecutar Publicar ya o Editar</div>
    <p class="body-p">En la pestaña <strong>Lista</strong>, utilice los filtros de estado (<em>Todos</em>, <em>Programados</em>, <em>Publicados</em>, <em>Borradores</em>, <em>Error</em>) y ejecute <strong>Publicar ya</strong>, <strong>Editar</strong> o el ícono de papelera en cualquier fila.</p>
    <div class="shot-frame">
      <img src="${pList}" alt="Vista Lista Social Planning" />
      <div class="callout-box" style="left:29.6%;top:25.2%;width:7.2%;height:5.2%;"><span class="callout-tag">1. Pestaña Lista</span></div>
      <div class="callout-box" style="left:22.2%;top:33.1%;width:29.4%;height:3.8%;"><span class="callout-tag bottom">2. Filtros por estado y cola</span></div>
      <div class="callout-box" style="left:82.8%;top:44.0%;width:12.6%;height:4.5%;"><span class="callout-tag right">3. Publicar ya / Editar / Eliminar</span></div>
    </div>
    <div class="fig-cap">Figura 3. Cola cronológica mostrando línea editorial (AI + LEAN™ / Motivación), páginas Meta destino y acciones directas.</div>

    <h3 class="sub-h">Flujo de publicación directa vs programación automática</h3>
    <p class="body-p">Al hacer clic en <strong>Publicar ya</strong> (o cuando ChatGPT recibe confirmación de publicación inmediata), <code>arias-social-bridge</code> invoca de inmediato las funciones existentes <code>publish-facebook</code> y <code>publish-instagram</code>, registrando los identificadores devueltos por Meta. Los posts programados permanecen visibles hasta que <code>pg_cron</code> los ejecuta en su ventana de 5 minutos.</p>
  </div>
  ${ftr(7, 8)}
</section>

<!-- PAGE 8: 07 / PROCEDIMIENTO VISUAL (Eliminados + Privacidad) -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">07 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1">Papelera auditable y control de privacidad</h1>
    <p class="lead-p">Trazabilidad completa de publicaciones descartadas con restauración en 1 clic sin pérdida del flyer.</p>

    <div class="step-hdr"><span class="num">04 ·</span> Auditar eliminaciones y restaurar publicaciones al calendario</div>
    <p class="body-p">Todo post eliminado pasa a la pestaña <strong>Eliminados</strong> conservando la marca de tiempo (<strong>ELIMINADO EL</strong>) y el usuario responsable (<strong>ELIMINADO POR</strong>), con el botón <strong>Restaurar</strong> disponible para reactivarlo sin perder su imagen respaldada en Storage.</p>
    <div class="shot-frame">
      <img src="${pDel}" alt="Vista Eliminados con auditoría y Restaurar" />
      <div class="callout-box" style="left:36.4%;top:25.2%;width:9.3%;height:5.2%;"><span class="callout-tag">1. Pestaña Eliminados</span></div>
      <div class="callout-box" style="left:61.8%;top:37.5%;width:25.4%;height:4.7%;"><span class="callout-tag bottom">2. Auditoría fecha y usuario</span></div>
      <div class="callout-box" style="left:88.0%;top:37.4%;width:7.5%;height:4.9%;"><span class="callout-tag right">3. Restaurar</span></div>
    </div>
    <div class="fig-cap">Figura 4. Papelera auditable equivalente a Metricool con registro de usuario y restauración instantánea.</div>

    <div class="step-hdr"><span class="num">05 ·</span> Confirmación diaria en ChatGPT Plus</div>
    <p class="body-p">Al finalizar cada flyer en ChatGPT, confirme si desea <strong>Publicar de una vez</strong> o enviarlo a <strong>Planning</strong> indicando fecha y hora local de El Salvador (<code>-06:00</code>); el registro aparecerá de inmediato en estas vistas.</p>

    <div class="privacy-title">Control de privacidad</div>
    <p class="body-p" style="color:#475569;">Las capturas incorporadas corresponden a un entorno ilustrativo con datos demostrativos. Los tokens personales <code>arias_gpt_*</code>, fotografías maestras autorizadas y credenciales OAuth son de uso exclusivo del personal autorizado de Arias Defense Components LLC y no deben compartirse fuera de la organización.</p>
  </div>
  ${ftr(8, 8)}
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
console.log('PDF Planning generado:', OUT_PDF);
