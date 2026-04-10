# 🚀 Fase 2: Flyer Studio Enterprise (Vision & Plan)

Este documento guarda la visión arquitectónica y el plan paso a paso para transformar el Flyer Studio básico actual en una plataforma de grado "Enterprise" hiper-dinámica de siguiente nivel (estilo Canva / Professional CRM). 

Guarda este workflow y úsalo en cualquier sesión futura para retomar el desarrollo exactamente en el punto correcto.

---

## 🎯 1. Auto-Integración Bidireccional CRM (Inventory Sync)
**Problema Actual:** El agente inmobiliario debe escribir a mano los precios, beneficios, tamaños y buscar subir la foto manualmente para cada proyecto nuevo.
**La Solución Profesional:**
*   **Enlace de Base de Datos:** Crear un Selector dentro del Flyer Studio llamado `Seleccionar Inmueble del Inventario`.
*   **Auto-Completado Mágico:** Al seleccionar un terreno (ej. "Lote 24"), el Engine intercepta la consulta a Supabase y auto-rellena dinámicamente el Background (`bgImageUrl`), el Titulo Principal, Subtítulo (ej. Varas2 y Metros2) y Precio exacto sin que el usuario tenga que teclear una sola palabra.
*   **Beneficios Dinámicos IA:** Tomar los "specs" (características técnicas del lote) y procesarlas por nuestra IA existente para resumir e inyectar 3 viñetas perfectas como "Beneficios Vendedores" directamente en el Flyer.

## 📐 2. Herramienta Avanzada de Polígonos (Geo-Mapping)
**Problema Actual:** Los trazos son libres (`path` y `line` interconectados al pulso del ratón del usuario) lo cual puede verse tembloroso y poco profesional.
**La Solución Profesional:**
*   **Modo Polígono Perfecto:** Activar una sub-capa SVG donde el usuario simplemente hace "Click" en 4 ó 5 esquinas reales de la foto del terreno. El visor trazará las rectas automáticamente e inyectará un relleno translúcido (fill-opacity: 0.3) amarillo neón o rojo intenso.
*   **Exportación Milimétrica:** El polígono debe guardarse en el `FlyerData` de Supabase a través de tuplas `(x, y)` para que siempre sea reproducible cuando otro agente quiera retomar la edición del mismo Flyer.

## 🪄 3. Remoción de Fondos (BGremover AI) Front/Back
**Problema Actual:** Poner la foto personal o una propiedad encima genera un estorboso cuadro blanco.
**La Solución Profesional:**
*   **Implementación de API Externa:** (Por ejemplo Cloudinary BG Remover o Rembg Serverless Edge function).
*   **Botón de Magia:** Al arrastrar el "FreeLogo" o un "Speaker", habilitar el botón "Quitar Fondo IA" el cual procesa la capa, devuelve el PNG transparente alpha, y actualiza el render en vivo.

## 🖥 4. Motor Híbrido Canvas Completo (Fabric.js)
**Problema Actual:** Es un layout semi-rígido guiado por CSS `flex` o grids posicionados donde solo podemos cambiar textos y prender/apagar componentes.
**La Solución Profesional:**
*   Para pasar al nivel 10, se desecha la aproximación "Template HTML/CSS" y se reconstruye el Flyer Studio en **Fabric.js**.
*   Con Fabric, `Beneficios` es un nodo de texto; `Foto de Fondo` es un Layer raster; `Polígono` es una Entidad vectorial. Todo puede ser rotado (giros de 30 grados, enviar al fondo, traer al frente, opacidades dinámicas). 

## 🖨 5. Cluster de Exportación para Imprenta (High-Res CMYK)
**Problema Actual:** `html2canvas` aproxima el diseño asumiendo perfiles de color SRGB (monitores y celulares), lo cual hace que los azules y rojos salgan muertos/opacos al imprimirse en vallas de 3x3 Metros.
**La Solución Profesional:**
*   Lanzar una **Serverless Edge Function** o contenedor privado (Puppeteer/Playwright headless). 
*   Ese servicio renderizará el flyer utilizando perfiles de saturación CMYK (Cian, Magenta, Amarillo, Negro) y escupirá un `PDF/X-1a Vectorial` puro. Así el equipo de marketing puede descargarlo y dárselo directamente a la imprenta sin perder calidad de los textos ni opacar los colores.

---

### ¿Cómo iniciar este plan en nuestra próxima sesión?
Solo dime en el chat: **"Abre el plan de flyer studio pro e iniciemos con el auto-completado de CRM"** o también **"Empecemos a construir los polígonos inteligentes del plan."** y sabré exactamente la arquitectura a seguir.
