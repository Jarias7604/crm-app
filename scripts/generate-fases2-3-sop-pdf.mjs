import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.cwd();
const SCRATCH_SHOTS = 'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch/screenshots';
const OUT_PDF = path.join(WORKSPACE, 'docs', 'SOP_Fase2_y_3_Calificador_IA_Demos_Notificaciones_CRM.pdf');
const TMP_HTML = path.join(
  'C:/Users/jaria/.gemini/antigravity/brain/504f55bd-3e21-4700-afcf-dfa2a973fe47/scratch',
  'sop_fases2_3.html'
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

const m1 = loadShot('f23_01_control_maestro.png');
const m2 = loadShot('f23_02_prompts_handoff.png');
const m3 = loadShot('f23_03_playbooks_dolor.png');
const m4 = loadShot('f23_04_enrutamiento_sla.png');
const m5 = loadShot('f23_05_cola_y_simulador.png');
const m6 = loadShot('f23_06_chat_whatsapp_control.png');
const mSyncLead = loadShot('sync_01_lead_erroneo.png');
const mSyncChat = loadShot('sync_02_chat_erroneo.png');

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
    color: #991B2B; margin-bottom: 6px;
  }
  .cover-title {
    font-size: 29px; font-weight: 800; color: #0f172a; line-height: 1.12; letter-spacing: -0.02em;
    margin-bottom: 10px;
  }
  .cover-sub { font-size: 13px; color: #334155; font-weight: 500; margin-bottom: 24px; }
  h1.sec-h1 { font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.015em; margin-bottom: 5px; }
  p.lead-p { font-size: 10.2px; color: #475569; line-height: 1.45; margin-bottom: 12px; }
  p.body-p { font-size: 9.8px; color: #1f2937; line-height: 1.46; margin-bottom: 8px; }
  h3.sub-h { font-size: 11.5px; font-weight: 800; color: #0f172a; margin: 11px 0 5px 0; }
  .step-hdr { font-size: 10.8px; font-weight: 800; color: #0f172a; margin: 7px 0 3px 0; }
  .step-hdr .num { color: #991B2B; margin-right: 4px; }
  table.inst { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.2px; }
  table.inst th {
    background: #142136; color: #ffffff; text-align: left; padding: 6.5px 9px;
    font-size: 8.8px; font-weight: 700;
  }
  table.inst td {
    padding: 6.5px 9px; border-bottom: 1px solid #cbd5e1; color: #1f2937; vertical-align: top; line-height: 1.38;
  }
  table.inst tr:nth-child(even) td { background: #f8fafc; }
  .kv-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
  .kv-table td { padding: 7.5px 10px; border-bottom: 1px solid #cbd5e1; }
  .kv-table tr:nth-child(odd) td { background: #f8fafc; }
  .kv-key { width: 34%; color: #475569; font-weight: 500; }
  .kv-val { color: #0f172a; font-weight: 600; }
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
  .shot-frame.sync-shot {
    width: 67%;
    margin: 5px auto 2px auto;
    overflow: visible;
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
    top: -14px;
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
    bottom: -14px;
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
  .fig-cap { font-size: 8.3px; color: #64748b; margin-bottom: 9px; line-height: 1.32; }
  .rules-list { list-style: none; margin: 5px 0 12px 0; }
  .rules-list li { font-size: 9.5px; color: #1f2937; margin-bottom: 4.5px; line-height: 1.42; }
  .rules-list li strong { color: #0f172a; }
  .alert-sample {
    border: 1px solid #cbd5e1;
    border-left: 3px solid #142136;
    background: #f8fafc;
    padding: 8px 11px;
    font-size: 9px;
    color: #1f2937;
    line-height: 1.42;
    margin-bottom: 10px;
  }
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

const hdr = (code = 'SOP-COM-2026-03 | Uso interno') => `
  <div class="top-rule">
    <span class="brand">ARIAS GROUP</span>
    <span class="doc-code">${code}</span>
  </div>`;

const ftr = (page, total) => `
  <div class="footer-rule">
    <span>Gestión comercial / Versión 1.2 · Calificador IA, Cola Sheets y Sincronización Bidireccional</span>
    <span>${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`;

const html = `${commonHead('SOP-COM-2026-03 — Calificador IA 24/7, Auto-Demos y Alertas WhatsApp (Fases 2 y 3)')}

<!-- PAGE 1: COVER -->
<section class="page">
  <div>
    ${hdr()}
    <div style="margin-top:30px;">
      <div class="kicker">GESTIÓN COMERCIAL / PROCEDIMIENTO ESTÁNDAR DE OPERACIÓN</div>
      <div class="cover-title">Calificador IA 24/7, autoservicio de demos y alertas SLA</div>
      <div class="cover-sub">Fases 2 y 3: Atención comercial automática por Evolution WhatsApp API, Google Meet y enrutamiento</div>

      <div class="kicker" style="margin-top:22px;">CONTROL DOCUMENTAL</div>
      <table class="kv-table">
        <tr><td class="kv-key">Código</td><td class="kv-val">SOP-COM-2026-03</td></tr>
        <tr><td class="kv-key">Versión</td><td class="kv-val">1.2 · Fases 2 y 3 + Cola Sheets + Sincronización Chat ⇄ Lead</td></tr>
        <tr><td class="kv-key">Vigencia</td><td class="kv-val">Noviembre 2026</td></tr>
        <tr><td class="kv-key">Alcance</td><td class="kv-val">SaaS Multi-Empresa (aislado de Soporte Técnico)</td></tr>
        <tr><td class="kv-key">Estado inicial seguro</td><td class="kv-val">Motor APAGADO (is_enabled = false) · Modo Borrador</td></tr>
      </table>

      <h3 class="sub-h">Responsables de control documental</h3>
      <table class="inst">
        <thead>
          <tr><th style="width:48%;">Función</th><th style="width:52%;">Responsable / estado</th></tr>
        </thead>
        <tbody>
          <tr><td>Elaboración · Backend Edge y Frontend SaaS</td><td>Desplegado en producción y verificado</td></tr>
          <tr><td>Activación gradual · Modo Borrador → Auto</td><td>Administración CRM (<code>company_admin</code> / <code>super_admin</code>)</td></tr>
          <tr><td>Atención de Demos y traspasos humanos</td><td>Patricia Morales, Jimmy Arias, Diana López y equipo</td></tr>
        </tbody>
      </table>
      <p class="body-p" style="color:#475569;">Distribución prevista: Comercial, Supervisión operativa y Administración SaaS.</p>
    </div>
  </div>
  ${ftr(1, 10)}
</section>

<!-- PAGE 2: 01 / MARCO OPERATIVO & FLOW -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">01 / MARCO OPERATIVO</div>
    <h1 class="sec-h1">Seguridad anti-caos y flujo completo</h1>
    <p class="lead-p">Aislamiento estricto respecto a Soporte Técnico, atención nocturna 24/7 y traspaso humano instantáneo.</p>

    <p class="body-p"><strong>Objetivo.</strong> Atender al prospecto inmediatamente tras su ingreso por Google Sheets / Meta Ads atacando su dolor específico con Evolution API (sin bloqueo de plantillas 24h de Meta), responder incluso de noche (ej. 10:00 PM), agendar Demos con Google Meet solo en jornada laboral real y notificar directo al WhatsApp del asesor.</p>

    <div style="margin:10px 0 10px 0;">
      <svg viewBox="0 0 680 285" width="100%" height="266" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
          </marker>
        </defs>
        <rect x="14" y="12" width="150" height="50" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="89" y="32" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">1. Nuevo Lead Sheet/Ads</text>
        <text x="89" y="47" text-anchor="middle" font-size="8.5" fill="#475569">Dispara enroll_new_lead</text>

        <line x1="165" y1="37" x2="205" y2="37" stroke="#475569" stroke-width="1.4" marker-end="url(#arr2)"/>

        <rect x="209" y="12" width="170" height="50" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="294" y="32" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">2. Modo: Borrador vs Auto</text>
        <text x="294" y="47" text-anchor="middle" font-size="8.5" fill="#475569">Playbook por Dolor + 24/7</text>

        <line x1="380" y1="37" x2="420" y2="37" stroke="#475569" stroke-width="1.4" marker-end="url(#arr2)"/>

        <rect x="424" y="12" width="242" height="50" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="545" y="32" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">3. Conversación WhatsApp (Evolution API)</text>
        <text x="545" y="47" text-anchor="middle" font-size="8.5" fill="#475569">Responde a las 10:00 PM · Human Takeover si escribe asesor</text>

        <path d="M 545 62 L 545 92 L 340 92 L 340 112" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr2)"/>

        <polygon points="340,114 435,152 340,190 245,152" fill="#ffffff" stroke="#1e293b" stroke-width="1.4"/>
        <text x="340" y="148" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0f172a">¿Pide hablar con</text>
        <text x="340" y="161" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0f172a">humano o tope turnos?</text>

        <path d="M 245 152 L 136 152 L 136 206" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr2)"/>
        <path d="M 435 152 L 544 152 L 544 206" fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arr2)"/>
        <text x="174" y="145" font-size="9" font-weight="700" fill="#991B2B">NO · AGENDA DEMO</text>
        <text x="454" y="145" font-size="9" font-weight="700" fill="#991B2B">SÍ · TRASPASO + SLA</text>

        <rect x="16" y="210" width="242" height="62" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="137" y="229" text-anchor="middle" font-size="9.8" font-weight="700" fill="#0f172a">4A. Auto-Demo con Google Meet</text>
        <text x="137" y="244" text-anchor="middle" font-size="8.6" fill="#475569">3 horarios reales dentro de jornada L-V / Sáb</text>
        <text x="137" y="257" text-anchor="middle" font-size="8.6" fill="#475569">Crea follow_up + Meet + WhatsApp al asesor</text>

        <rect x="422" y="210" width="242" height="62" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.3"/>
        <text x="543" y="229" text-anchor="middle" font-size="9.8" font-weight="700" fill="#0f172a">4B. Traspaso Humano + Alerta SLA</text>
        <text x="543" y="244" text-anchor="middle" font-size="8.6" fill="#475569">Pausa IA · Asigna según regla · WhatsApp directo</text>
        <text x="543" y="257" text-anchor="middle" font-size="8.6" fill="#475569">Si nadie atiende en X min -&gt; Escala a respaldo</text>
      </svg>
    </div>

    <table class="inst" style="margin-bottom:0;">
      <thead>
        <tr><th style="width:28%;">Regla de seguridad</th><th style="width:72%;">Comportamiento garantizado en producción</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Sin riesgo en chats actuales</strong></td><td>El webhook solo ejecuta el calificador cuando el chat tiene <code>wa_scope = 'lead'</code> y <code>ai_qualifier_active = true</code>. Grupos y clientes de soporte siguen intactos.</td></tr>
        <tr><td><strong>Human Takeover automático</strong></td><td>Si un asesor contesta desde el CRM o desde el teléfono conectado, el bot se pausa al instante (<code>human_takeover</code>).</td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(2, 10)}
</section>

<!-- PAGE 3: 02 / CONFIGURACIÓN -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">02 / CONFIGURACIÓN</div>
    <h1 class="sec-h1">Playbooks por dolor y enrutamiento dinámico</h1>
    <p class="lead-p">Argumentos comerciales según Punto de Mejora y asignación multi-empresa sin código.</p>

    <table class="inst">
      <thead>
        <tr><th style="width:22%;">Playbook</th><th style="width:12%;">Producto</th><th style="width:24%;">Disparadores en Sheet</th><th style="width:42%;">Módulos fuertes que destaca la IA</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Inventarios y Productos</strong></td><td>ERP</td><td>inventario, bodega, kardex, stock</td><td>Inventario en tiempo real, Kardex multi-bodega y alertas de mínimo.</td></tr>
        <tr><td><strong>Facturación DTE</strong></td><td>ERP</td><td>facturación, dte, hacienda</td><td>Transmisión directa a Hacienda, anulaciones y libros IVA F07/F14.</td></tr>
        <tr><td><strong>Control Integral</strong></td><td>ERP</td><td>control integral, todo el negocio</td><td>Ventas, compras, inventario, CxC/CxP y rentabilidad unificada.</td></tr>
        <tr><td><strong>Contabilidad y Finanzas</strong></td><td>ERP</td><td>contabilidad, finanzas, iva</td><td>Partidas automáticas, conciliación y libros fiscales al día.</td></tr>
        <tr><td><strong>Ventas y Compras</strong></td><td>ERP</td><td>ventas, compras, pos, pedidos</td><td>POS con DTE, cotización a pedido en 1 clic y control de márgenes.</td></tr>
        <tr><td><strong>SIPLE · Lotes</strong></td><td>SIPLE</td><td>siple, lote, lotes, lotificadora</td><td>Control de disponibilidad, primas, amortizaciones, moras y portal.</td></tr>
      </tbody>
    </table>

    <h3 class="sub-h">Enrutamiento dinámico y alertas directas sin tickets falsos</h3>
    <table class="inst">
      <thead>
        <tr><th style="width:28%;">Componente</th><th style="width:72%;">Configuración en Frontend (<code>/leads/calificador-ia</code>)</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Reglas Fijo o Round-Robin</strong></td><td>Asigna responsables por producto (SIPLE, ERP o global) rotando entre Patricia, Diana, Jimmy o cualquier nuevo asesor agregado en el futuro.</td></tr>
        <tr><td><strong>WhatsApp directo al asesor</strong></td><td>Encola en <code>whatsapp_outbox</code> con <code>ticket_id = null</code> al número de <code>profiles.phone</code>. El filtro anti-rebote ignora el eco <code>fromMe</code> para no ensuciar bandejas.</td></tr>
        <tr><td><strong>Escalamiento SLA</strong></td><td>Si un estado <code>handed_off</code> supera <code>sla_escalation_minutes</code> sin atención, escala alerta WhatsApp + CRM al supervisor de respaldo.</td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(3, 10)}
</section>

<!-- PAGE 4: 03 / EJECUCIÓN Y ACTIVACIÓN GRADUAL -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">03 / EJECUCIÓN</div>
    <h1 class="sec-h1">Protocolo oficial de activación gradual (Go-Live)</h1>
    <p class="lead-p">Pasos obligatorios antes de pasar de modo Borrador a Automático 24/7.</p>

    <table class="inst">
      <thead>
        <tr><th style="width:12%;">Paso</th><th style="width:32%;">Actividad</th><th style="width:56%;">Criterio de validación</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Paso 1</strong></td><td>Validar teléfonos del equipo</td><td>Confirmar formato <code>+503...</code> en el perfil de Patricia, Jimmy, Diana y respaldo SLA.</td></tr>
        <tr><td><strong>Paso 2</strong></td><td>Crear reglas y probar alerta</td><td>Configurar reglas por producto y verificar entrega con el botón <em>Enviar WhatsApp de Prueba al Asesor</em>.</td></tr>
        <tr><td><strong>Paso 3</strong></td><td>Probar Simulador 10:00 PM</td><td>Ejecutar el <em>Simulador Seguro (0 WhatsApps Reales)</em> validando horario nocturno y traspaso humano.</td></tr>
        <tr><td><strong>Paso 4</strong></td><td>Encender Motor + Cola Sheets</td><td>Activar el motor arriba, pulsar <em>Guardar Cambios</em> y activar en lote leads del Sheet desde <em>Cola Borradores</em>.</td></tr>
        <tr><td><strong>Paso 5</strong></td><td>Pasar a Modo Automático 24/7</td><td>Al validar tono y agenda Google Meet correcta, cambiar a <code>Automático 24/7</code> y guardar.</td></tr>
      </tbody>
    </table>

    <h3 class="sub-h">Cuatro reglas de oro operativas</h3>
    <ul class="rules-list">
      <li><strong>01.</strong> Nunca activar Automático sin antes verificar que las reglas de asignación apunten a asesores con teléfono y calendario activos.</li>
      <li><strong>02.</strong> Respetar la cobertura 24/7 de noche para responder al lead mientras está caliente, manteniendo las citas solo en horario laboral.</li>
      <li><strong>03.</strong> Al recibir alerta WhatsApp de traspaso o demo, usar el link <code>/leads?lead=&lt;ID&gt;</code> para abrir el expediente completo en 1 clic.</li>
      <li><strong>04.</strong> Si el asesor interviene manualmente en cualquier chat, la IA se pausa sola; solo reactivarla con <em>Reactivar IA aquí</em> si se requiere retomar calificación.</li>
    </ul>
  </div>
  ${ftr(4, 10)}
</section>

<!-- PAGE 5: 04 / PROCEDIMIENTO VISUAL (Control Maestro & Prompts) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-03 | Uso interno</span>
    </div>
    <div class="kicker">04 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Control Maestro, horario 24/7 y Prompts</h1>
    <p class="lead-p" style="margin-bottom:8px;">Ubicación de interruptores principales y personalización de mensajes desde <code>/leads/calificador-ia</code>.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">01 ·</span> Abrir Calificador IA y configurar Modo Borrador / Automático y horario 24/7</div>
    <p class="body-p" style="margin-bottom:4px;">En el menú lateral bajo <strong>Leads</strong>, abra <strong>Calificador IA</strong>. Ajuste el modo, las fuentes permitidas, la cobertura 24/7 y presione <strong>Guardar Cambios</strong>.</p>
    <div class="shot-frame compact">
      <img src="${m1}" alt="Control Maestro Calificador IA" />
      <div class="callout-box" style="left:2.2%;top:45.6%;width:14.8%;height:4.4%;"><span class="callout-tag">1. Acceso Sidebar</span></div>
      <div class="callout-box" style="left:63.5%;top:14.0%;width:26.8%;height:10.6%;"><span class="callout-tag bottom">2. Motor IA y Guardar</span></div>
      <div class="callout-box" style="left:22.8%;top:53.0%;width:34.4%;height:13.0%;"><span class="callout-tag">3. Borrador vs Automático</span></div>
      <div class="callout-box" style="left:60.5%;top:53.0%;width:34.8%;height:22.0%;"><span class="callout-tag">4. Cobertura 24/7 y Horarios</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:6px;">Figura 1. Pestaña Control Maestro &amp; Horario 24/7 con interruptor de seguridad apagado de fábrica.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">02 ·</span> Editar prompts, plantilla inicial y palabras clave de traspaso humano</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Prompts y Traspaso Humano</strong>, adapte el saludo inicial con vista previa real de WhatsApp y configure las frases que transfieren al asesor.</p>
    <div class="shot-frame compact">
      <img src="${m2}" alt="Prompts y Traspaso Humano" />
      <div class="callout-box" style="left:22.0%;top:48.0%;width:36.2%;height:49.5%;"><span class="callout-tag">1. Plantilla inicial + Vista previa</span></div>
      <div class="callout-box" style="left:59.5%;top:48.0%;width:36.4%;height:46.5%;"><span class="callout-tag">2. Frases y respuestas de traspaso</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:2px;">Figura 2. Edición de prompts consultivos y respuestas diferenciadas en horario laboral vs nocturno (10:00 PM).</div>
  </div>
  ${ftr(5, 10)}
</section>

<!-- PAGE 6: 05 / PROCEDIMIENTO VISUAL (Playbooks & Enrutamiento) -->
<section class="page">
  <div>
    <div class="top-rule" style="margin-bottom:12px;">
      <span class="brand">ARIAS GROUP</span>
      <span class="doc-code">SOP-COM-2026-03 | Uso interno</span>
    </div>
    <div class="kicker">05 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1" style="font-size:19px;">Playbooks por dolor y enrutamiento de asesores</h1>
    <p class="lead-p" style="margin-bottom:8px;">Personalización de argumentos de venta y asignación dinámica con prueba real de WhatsApp.</p>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">03 ·</span> Ajustar o agregar Playbooks por Punto de Mejora</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Playbooks por Dolor</strong>, edite palabras disparadoras del Excel, módulos fuertes a destacar y preguntas de cierre, o añada nuevos con <strong>+ Agregar Playbook</strong>.</p>
    <div class="shot-frame compact">
      <img src="${m3}" alt="Playbooks por Dolor" />
      <div class="callout-box" style="left:84.0%;top:48.4%;width:11.5%;height:5.2%;"><span class="callout-tag">1. Nuevo Playbook</span></div>
      <div class="callout-box" style="left:21.8%;top:56.2%;width:74.2%;height:38.6%;"><span class="callout-tag">2. Tarjetas editables ERP / SIPLE</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:6px;">Figura 3. Matriz de playbooks conectada al campo Punto de Mejora ingresado desde Google Sheets.</div>

    <div class="step-hdr" style="margin-top:2px;"><span class="num">04 ·</span> Configurar reglas dinámicas, SLA y probar alerta WhatsApp al asesor</div>
    <p class="body-p" style="margin-bottom:4px;">En <strong>Asesores, WhatsApp &amp; SLA</strong>, defina reglas Fijo o Round-Robin por producto, seleccione a Patricia, Jimmy o Diana y presione <strong>Enviar WhatsApp de Prueba</strong>.</p>
    <div class="shot-frame compact">
      <img src="${m4}" alt="Enrutamiento de Asesores y SLA" />
      <div class="callout-box" style="left:21.8%;top:47.4%;width:49.2%;height:32.5%;"><span class="callout-tag">1. Reglas Fijo / Round-Robin</span></div>
      <div class="callout-box" style="left:72.8%;top:79.4%;width:22.8%;height:5.5%;"><span class="callout-tag">2. WhatsApp de Prueba real</span></div>
      <div class="callout-box" style="left:72.4%;top:88.2%;width:23.6%;height:11.0%;"><span class="callout-tag">3. Escalamiento SLA</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:2px;">Figura 4. Reglas activas por producto, prueba directa al celular del asesor y respaldo SLA anti-fuga.</div>
  </div>
  ${ftr(6, 10)}
</section>

<!-- PAGE 7: 06 / PROCEDIMIENTO VISUAL (Cola Sheets, Borradores & Simulador) -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">06 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1">Cola por lote Sheets, borradores y Simulador 10:00 PM</h1>
    <p class="lead-p">Activación por lote de leads recibidos vía Google Sheets, aprobación de borradores y pruebas seguras.</p>

    <div class="step-hdr"><span class="num">05 ·</span> Activar leads pendientes de Google Sheets por lote o simular escenario 10:00 PM</div>
    <p class="body-p">En <strong>Cola Borradores &amp; Simulador</strong>, la tarjeta superior izquierda <strong>Leads de Google Sheets sin IA Activa</strong> filtra por <strong>Hoy / 7 días / Todos</strong> y permite seleccionar varios prospectos para presionar <strong>Activar IA para Seleccionados (N)</strong> (envía su primer WhatsApp o prepara borrador abajo según el modo activo). La columna derecha simula horario <strong>10:00 PM (Nocturno)</strong> y vista previa de alerta ejecutiva.</p>
    <div class="shot-frame">
      <img src="${m5}" alt="Cola de Leads Google Sheets, Borradores y Simulador Seguro" />
      <div class="callout-box" style="left:21.3%;top:47.0%;width:36.8%;height:29.5%;"><span class="callout-tag">1. Filtrar Hoy y seleccionar leads del Sheet</span></div>
      <div class="callout-box" style="left:40.2%;top:78.5%;width:17.0%;height:4.5%;"><span class="callout-tag bottom">2. Activar IA por lote (1 clic)</span></div>
      <div class="callout-box" style="left:59.4%;top:61.2%;width:37.2%;height:29.2%;"><span class="callout-tag bottom">3. Simulación 10:00 PM / Pedir Humano</span></div>
    </div>
    <div class="fig-cap">Figura 5. Vista real de la Cola de Google Sheets sin IA Activa (con selección múltiple de leads de Hoy) y Simulador Seguro (Dry-Run).</div>

    <h3 class="sub-h">Estructura estándar de la alerta ejecutiva por WhatsApp al asesor</h3>
    <div class="alert-sample">
      <strong>DEMO AGENDADA AUTOMÁTICAMENTE / LEAD PIDE HABLAR CON ASESOR</strong><br/>
      <strong>Prospecto:</strong> Nombre completo · Empresa &nbsp;|&nbsp; <strong>Tel:</strong> +503... · Producto: ERP / SIPLE<br/>
      <strong>Cargo:</strong> Rol decisor &nbsp;|&nbsp; <strong>Dolor / Mejora:</strong> Inventarios y productos &nbsp;|&nbsp; <strong>Urgencia:</strong> Lo antes posible<br/>
      <strong>Horario Demo y Google Meet:</strong> Fecha confirmada + enlace Meet generado automáticamente<br/>
      <strong>Abrir ficha completa en CRM:</strong> <code>https://ariascrm.com/leads?lead=&lt;UUID&gt;</code>
    </div>
  </div>
  ${ftr(7, 10)}
</section>

<!-- PAGE 8: 07 / PROCEDIMIENTO VISUAL (Chat WhatsApp CRM) -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">07 / PROCEDIMIENTO VISUAL</div>
    <h1 class="sec-h1">Control por chat en WhatsApp CRM (/support/chat)</h1>
    <p class="lead-p">Supervisión visual de estado IA y pausa manual o automática por conversación individual.</p>

    <div class="step-hdr"><span class="num">06 ·</span> Supervisar insignias en bandeja y usar Pausar IA aquí / Human Takeover</div>
    <p class="body-p">En la lista izquierda de <strong>Chat WhatsApp</strong>, los leads muestran insignias claras de estado (<code>IA</code>, <code>Asesor</code>, <code>Demo</code>). Al abrir una conversación inscrita aparece la barra superior con el botón <strong>Pausar IA aquí</strong>. Además, si cualquier asesor escribe en el chat o desde su teléfono móvil, el bot se detiene automáticamente.</p>
    <div class="shot-frame">
      <img src="${m6}" alt="Chat WhatsApp Control Individual Calificador IA" />
      <div class="callout-box" style="left:18.2%;top:18.0%;width:26.8%;height:21.0%;"><span class="callout-tag">1. Insignias IA · Asesor · Demo</span></div>
      <div class="callout-box" style="left:46.2%;top:11.4%;width:53.0%;height:4.5%;"><span class="callout-tag bottom">2. Barra de control · Pausar / Reactivar IA</span></div>
    </div>
    <div class="fig-cap">Figura 6. Pantalla real de WhatsApp CRM con indicadores por hilo comercial y barra de control humano instantáneo.</div>

    <h3 class="sub-h">Comportamiento ante intervención humana</h3>
    <p class="body-p">Al hacer clic en <strong>Pausar IA aquí</strong> o enviar cualquier texto/archivo manual, el ticket cambia internamente a <code>human_takeover</code> o <code>paused</code>, protegiendo al cliente contra respuestas cruzadas entre el bot y el vendedor.</p>
  </div>
  ${ftr(8, 10)}
</section>

<!-- PAGE 9: 08 / SINCRONIZACIÓN BIDIRECCIONAL CHAT <-> LEAD -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">08 / SINCRONIZACIÓN DE ETAPAS (SSOT)</div>
    <h1 class="sec-h1">Sincronización bidireccional Chat WhatsApp ⇄ Lead Discovery</h1>
    <p class="lead-p">Cero discrepancias: cualquier cambio a <strong>Perdido</strong>, <strong>Erróneo</strong> o etapa comercial refleja el mismo estado en ambas pantallas.</p>

    <p class="body-p">La tabla <code>leads.status</code> actúa como fuente única de verdad reforzada por trigger PostgreSQL, backend Edge (<code>update_lead_status</code> + <code>handleBridgeAck</code>) y pausa automática de IA al marcar <strong>Perdido</strong>, <strong>Erróneo</strong>, <strong>Cerrado</strong> o <strong>Cliente</strong>:</p>
    <ul class="rules-list" style="margin-bottom:6px;">
      <li><strong>• Sin cuenta de WhatsApp (<code>exists:false</code>):</strong> Si el envío falla por número inexistente sin respuesta del cliente, el sistema marca automáticamente <code>Erróneo</code> en Chat y Lead y pausa el Calificador IA.</li>
      <li><strong>• Cambio manual prevalece:</strong> Si un asesor cambia la etapa desde Chat (ej. a <code>Perdido</code>) o desde Ficha Lead, se guarda con override manual en ambos módulos sin revertirse.</li>
    </ul>

    <div class="shot-frame sync-shot">
      <img src="${mSyncLead}" alt="Ficha Lead mostrando Estado del Embudo sincronizado en Erróneo" />
      <div class="callout-box" style="left:52.0%;top:65.6%;width:20.4%;height:7.2%;"><span class="callout-tag out-left">1. Mismo estado en Ficha Lead (Erróneo)</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:6px;">Figura 7a. Prospecto en <code>/leads</code> sincronizado automáticamente con el resultado real de entrega en WhatsApp.</div>

    <div class="shot-frame sync-shot">
      <img src="${mSyncChat}" alt="Chat WhatsApp mostrando Erróneo sincronizado e IA pausada" />
      <div class="callout-box" style="left:18.2%;top:54.3%;width:26.0%;height:6.6%;"><span class="callout-tag out-right">2. Badge sincronizado en lista</span></div>
      <div class="callout-box" style="left:65.1%;top:6.4%;width:7.2%;height:3.9%;"><span class="callout-tag out-left">3. Selector etapa</span></div>
      <div class="callout-box" style="left:60.0%;top:11.8%;width:39.2%;height:4.0%;"><span class="callout-tag bottom right">4. Calificador IA pausado automáticamente</span></div>
    </div>
    <div class="fig-cap" style="text-align:center;margin-bottom:2px;">Figura 7b. Vista en <code>/support/chat</code> coincidiendo al 100% con Ficha Lead y con el bot detenido.</div>
  </div>
  ${ftr(9, 10)}
</section>

<!-- PAGE 10: 09 / SUPERVISIÓN & PRIVACIDAD -->
<section class="page">
  <div>
    ${hdr()}
    <div class="kicker">09 / SUPERVISIÓN Y CONTROL DE CAMBIOS</div>
    <h1 class="sec-h1">Lista de verificación, SLA y control documental</h1>
    <p class="lead-p">Auditoría semanal recomendada para gerencia y líderes comerciales.</p>

    <table class="inst">
      <thead>
        <tr><th style="width:28%;">Control</th><th style="width:48%;">Criterio de verificación</th><th style="width:24%;">Resultado</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Integridad de borradores</strong></td><td>Sin leads retenidos en <code>draft_pending</code> más de 2 horas hábiles sin revisión.</td><td>[ ] Conforme &nbsp; [ ] Revisar</td></tr>
        <tr><td><strong>Cumplimiento SLA traspasos</strong></td><td>Ejecutivos atienden traspasos <code>handed_off</code> antes de disparar alerta de respaldo.</td><td>[ ] Conforme &nbsp; [ ] Revisar</td></tr>
        <tr><td><strong>Disponibilidad Google Meet</strong></td><td>Integración Google Calendar activa emitiendo enlaces <code>meet_link</code> en <code>follow_ups</code>.</td><td>[ ] Conforme &nbsp; [ ] Revisar</td></tr>
        <tr><td><strong>Aislamiento de Soporte</strong></td><td>Confirmar 0 activaciones comerciales en grupos o tickets de clientes de soporte.</td><td>[ ] Conforme &nbsp; [ ] Revisar</td></tr>
      </tbody>
    </table>

    <p class="body-p" style="color:#475569;margin-bottom:18px;">Registro de revisión: Fecha _______________ &nbsp;&nbsp;&nbsp; Responsable _____________________________</p>

    <h3 class="sub-h">Historial documental</h3>
    <table class="inst">
      <thead>
        <tr><th style="width:22%;">Versión / fecha</th><th style="width:52%;">Descripción</th><th style="width:26%;">Estado</th></tr>
      </thead>
      <tbody>
        <tr><td>1.2 / Nov. 2026</td><td>Agrega sincronización bidireccional Chat WhatsApp ⇄ Lead Discovery (SSOT trigger PostgreSQL, marcado automático Erróneo y pausa automática IA) con capturas reales.</td><td>Vigente en producción</td></tr>
        <tr><td>1.1 / Nov. 2026</td><td>Incorpora Cola por Lote de Google Sheets (filtro Hoy/7d/Todos y botón Activar IA para Seleccionados) con captura real actualizada.</td><td>Versión previa</td></tr>
        <tr><td>1.0 / Nov. 2026</td><td>SOP oficial Fases 2 y 3 con capturas reales del entorno CRM y trazabilidad visual.</td><td>Versión base</td></tr>
      </tbody>
    </table>

    <div class="privacy-title">Control de privacidad</div>
    <p class="body-p" style="color:#475569;">Las capturas incorporadas son evidencia ilustrativa generada con datos demostrativos sanitizados. No se deben distribuir hojas ni registros reales de prospectos fuera de los canales autorizados de Arias Group.</p>
  </div>
  ${ftr(10, 10)}
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
console.log('PDF Fases 2 y 3 generado:', OUT_PDF);
