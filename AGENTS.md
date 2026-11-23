# REGLAS BLOQUEADAS DEL WORKSPACE — ARIAS CRM (`crm-app`)

> **ESTADO: REGLA BLOQUEADA / SIEMPRE ACTIVA (`always_on`) / INVIOLABLE**  
> Ningún agente puede ignorar, debilitar, resumir ni eliminar estas reglas sin autorización expresa y directa de **Jimmy Arias (`jimmy@ariasdefense.com`)**.

---

## Regla Bloqueada 1 — Actualización Obligatoria de SOPs y Manuales en Cada Mejora o Cambio

- Siempre que se implemente una **mejora, nueva funcionalidad, nueva fase, ajuste de UI, cambio de flujo operativo o cambio de arquitectura** en `crm-app`, el agente **DEBE** crear o actualizar el SOP / Manual operativo en PDF **antes de dar la tarea por completada**.
- **PROHIBIDO** entregar manuales de solo texto o sin capturas reales cuando existan pantallas o interfaces de usuario involucradas.

---

## Regla Bloqueada 2 — Estándar Editorial y UI Institucional Obligatorio (`ARIAS GROUP`)

Todo SOP o manual en PDF debe mantener **exactamente** la misma UI institucional de `ARIAS_SOP_Prospectos_Institucional_Visual.pdf` y seguir los generadores de referencia `scripts/generate-fase1-sop-pdf.mjs` y `scripts/generate-fases2-3-sop-pdf.mjs`:

1. **Formato de página:** Carta (`8.5in × 11in`), fondo blanco (`#ffffff`), márgenes `0.42in 0.60in 0.40in 0.60in`, estética suiza minimalista.
2. **Tipografía limpia:** `'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif`; texto principal `#111827` / `#1f2937`, títulos `#0f172a`, texto secundario/pies `#475569` / `#64748b`.
3. **Barra superior carmesí (en todas las páginas):** borde superior `2.2px solid #991B2B`, marca izquierda `ARIAS GROUP`, código documental derecho `SOP-COM-YYYY-XX | Uso interno`. Kickers, etiquetas de paso y acentos en `#991B2B`.
4. **Tablas institucionales en azul marino:** encabezados `background: #142136` con texto blanco `#ffffff`, filas alternas `#f8fafc` y bordes `#cbd5e1`.
5. **Diagramas de flujo SVG:** diagramas vectoriales SVG limpios integrados directamente en el PDF para ilustrar arquitectura, decisiones y flujo de punta a punta.
6. **Capturas reales de la UI paso a paso:** capturas reales del navegador (`1440×900`) de las pantallas reales del CRM (nunca mockups inventados), con recuadros rojos de resaltado (`border: 2.2px solid #B91C1C`, fondo `rgba(185, 28, 28, 0.05)`) y etiquetas numeradas (`background: #991B2B`, texto blanco `#ffffff`) alineadas exactamente sobre los botones, pestañas y campos que el usuario debe operar.
7. **Pie de página y control documental:** línea superior `1px solid #cbd5e1`, leyenda operativa izquierda y paginación `01 / XX` derecha en cada página, tabla de control documental en portada y cláusula de uso interno/privacidad.

---

## Regla Bloqueada 3 — Verificación Visual Obligatoria Página por Página

- Antes de subir a Google Drive o entregar al usuario, el agente **DEBE** abrir e inspeccionar visualmente **todas y cada una de las páginas** del PDF final (vía `read_file`).
- Debe confirmar sin excepciones:
  - Cero texto cortado o desbordado.
  - Cero solapamientos entre elementos, tablas, diagramas o etiquetas.
  - Capturas reales nítidas y completas.
  - Alineación exacta de todos los recuadros rojos `#B91C1C` sobre los elementos reales de la UI.
- Si se detecta cualquier fallo visual, corregir, regenerar el PDF y volver a verificar página por página antes de continuar.

---

## Regla Bloqueada 4 — Guardado Obligatorio en Repositorio y Google Drive Corporativo

- Guardar el PDF final en `docs/` dentro del repositorio y mantener limpio el workspace (sin dejar archivos `scratch_*.html` ni capturas temporales en la raíz del proyecto; cualquier arnés temporal va en `scratch/` fuera del repositorio o se elimina al finalizar).
- Subir (o actualizar *in-place* si ya existe) en Google Drive usando **exclusivamente** la cuenta corporativa `AGY_ACCOUNT=jimmy@ariasdefense.com` (**NUNCA** la cuenta personal `jarias7604@gmail.com`) dentro de la carpeta corporativa `ARIAS SOP Corporativos` (`1ryFbNLVM_gbFH7d0xtHEk1mQr3Fpjrfd`), o dentro de la subcarpeta asignada si el documento ya fue organizado allí (por ejemplo, `Manual Flujo Lead GoogleSheet CRM`: `11NGWMxSXWEX0Gemw70X-YjJGSaY3F11E`).
- Verificar la subida/actualización en Drive (`gdrive readonly info` / `gdrive readonly tree`) antes de reportar como completado.

---

## Referencia Obligatoria a Protocolos Críticos Existentes

En cada sesión y tarea en `crm-app`, respetar intactos los bloqueos existentes (no modificarlos):
- `.agent/workflows/BLOQUEO_DE_SEGURIDAD.md`
- `.agent/PROTECTION_PROTOCOL.md`
