# Manual Maestro – Guía de Usuario CRM

Bienvenido al centro de ayuda oficial de **Arias CRM Professional**. Aquí encontrarás documentación completa de todos los módulos del sistema.

---

## 1. Módulo de Leads

### Descripción
El módulo de Leads es el corazón del CRM. Gestiona la captura, deduplicación y ciclo de vida de cada prospecto desde el primer contacto hasta el cierre.

![Vista general del módulo de Leads](/manual/assets/leads_overview.png)

### Funcionalidades clave
- **Captura en tiempo real** vía API, webhook, y formularios Meta Ads.
- **Detección de duplicados** usando índices únicos en la base de datos.
- **Tablero Kanban** con arrastrar y soltar entre etapas del pipeline.
- **Vista de lista** con filtros avanzados por fuente, etapa, asignado y fecha.
- **Acciones masivas:** asignar, convertir, archivar y eliminar múltiples leads.
- **Historial de actividad** con línea de tiempo por lead.

### Flujo de trabajo
1. El lead entra automáticamente al sistema (webhook/API) o se crea manualmente.
2. Se asigna a un agente y aparece en la etapa "Nuevo".
3. El agente lo avanza por las etapas: Nuevo → Contactado → Calificado → Propuesta → Cierre.
4. Al cerrar, se convierte en cliente y se genera una cotización opcional.

---

## 2. Módulo de Clientes (Cartera Ganada)

### Descripción
A diferencia de los Leads (prospectos en proceso), el módulo de Clientes gestiona el portafolio exclusivo de cuentas que ya han cerrado exitosamente una negociación.

### Funcionalidades clave
- **Perfil Integral:** Agrupa el historial de cotizaciones aceptadas, seguimientos post-venta y documentación final.
- **Transición Inteligente:** Al mover un Lead a una etapa final (ej. "Cerrado Ganado"), la información comercial se consolida para gestión pasiva.
- **Acceso Controlado:** Por el nivel de confidencialidad, este módulo está restringido por defecto. Los colaboradores necesitan recibir el permiso "Ver Clientes" y "Editar Clientes" explícitamente desde la Matriz de Seguridad.

---

## 3. Módulo de Ventas / Oportunidades

### Descripción
El módulo de Ventas muestra el pipeline completo de oportunidades activas, métricas de rendimiento y pronósticos de ingresos.

![Vista general del módulo de Ventas](/manual/assets/sales_overview.png)

### Funcionalidades clave
- **Pipeline visual** con etapas configurables desde el panel de administración.
- **Pronóstico de ingresos** basado en probabilidad por etapa.
- **Integración directa** con el motor de cotizaciones.
- **KPIs en tiempo real:** tasa de conversión, valor promedio, tiempo en etapa.
- **Reportes exportables** en PDF y Excel.

---

## 3. Bots e Inbox Centralizado

### Descripción
El módulo de Bots integra todos los canales de mensajería (WhatsApp, Telegram, Web Chat) en un único inbox centralizado con automatización por IA.

![Vista general del módulo de Bots](/manual/assets/bots_overview.png)

### Funcionalidades clave
- **Inbox unificado** para WhatsApp, Telegram y Chat Web.
- **Bots de calificación automática** con IA conversacional.
- **Asignación automática** de conversaciones a agentes disponibles.
- **Plantillas de respuesta rápida** personalizables.
- **Notificaciones en tiempo real** vía Telegram al asignar leads.

---

## 4. Motor de Cotizaciones

### Descripción
Genera propuestas comerciales profesionales con precios dinámicos, descuentos y planes de pago configurables.

![Vista general del módulo de Cotizaciones](/manual/assets/quoting_overview.png)

### Funcionalidades clave
- **Catálogo de productos/servicios** con precios actualizables.
- **Cálculo automático** de impuestos, descuentos e instalaciones.
- **Generación de PDF** con logo y marca de la empresa.
- **Versionado de cotizaciones** con historial de cambios.
- **Flujo de aprobación** con firma digital del cliente vía portal.
- **Portal del cliente** para que el cliente acepte o negocie en línea.

---

## 5. Marketing Omnicanal

### Descripción
Planifica y ejecuta campañas masivas de marketing por múltiples canales con análisis de rendimiento en tiempo real y asistencia de IA.

![Vista general del módulo de Marketing](/manual/assets/marketing_overview.png)

### Funcionalidades clave
- **Campañas por Email, SMS y WhatsApp** masivos.
- **Segmentación avanzada** por etapa, fuente, y comportamiento del lead.
- **Asistente de IA** para generar copy persuasivo automáticamente.
- **Programación de envíos** con fecha y hora específica.
- **Dashboard de analítica:** aperturas, clics, conversiones, costo por lead.
- **Integración Meta Ads:** captura automática de leads desde anuncios.

---

## 7. Sistema de Roles y Permisos — Arquitectura Enterprise

### El Principio de Fuente Única de Verdad
El sistema de permisos de Arias CRM sigue el mismo estándar que HubSpot y Salesforce: **el Rol es la fuente única de verdad**. Los permisos del perfil individual nunca pueden contradecir o bloquear lo que el Rol otorga.

### Jerarquía de Resolución de Permisos

```
1. super_admin           → Acceso total a TODO (no se puede bloquear)
2. Usuario con Rol       → Los permisos del Rol definen TODO
3. Usuario sin Rol       → Se usan los permisos del perfil como fallback
```

### Por qué esto importa
**Problema anterior:** Cuando se editaba un usuario, el sistema guardaba permisos individuales en su perfil con algunos en `false`. Esos permisos bloqueaban módulos aunque el Rol del usuario los tuviera habilitados — causando el problema crónico de "un usuario dejó de ver módulos".

**Solución permanente:** Cuando un usuario tiene un Rol asignado, el sistema ignora completamente los permisos individuales del perfil y usa exclusivamente los del Rol.

### Proceso para Restablecer Accesos de un Usuario

Si un usuario no puede ver módulos que debería ver:

1. Ve a **Admin → Equipo → Miembros**
2. Verifica que el usuario tenga un **Rol Personalizado** asignado (ej. "Administrador de Empresa")
3. Si el rol está correcto pero sigue sin acceso, solicita al Administrador del sistema que limpie los permisos del perfil:
   ```sql
   UPDATE profiles SET permissions = '{}' WHERE email = 'correo@empresa.com';
   ```
4. El usuario debe cerrar sesión y volver a entrar — los permisos del rol se cargarán automáticamente.

### Estructura de Roles Disponibles

| Rol | Descripción | Nivel de Acceso |
|-----|-------------|-----------------|
| `super_admin` | Dueño del sistema | Todo sin restricciones |
| `company_admin` | Administrador de empresa | Todo dentro de su empresa |
| `sales_manager` | Gerente de ventas | Leads, clientes, reportes, equipo |
| `sales_agent` | Agente de ventas | Solo sus leads asignados |
| `support_agent` | Soporte | Tickets y clientes |

---

## 8. Calendario y Gestión de Citas

### Descripción
El módulo de Calendario te permite visualizar, agendar y organizar todas las reuniones, recordatorios y compromisos vinculados a tus clientes o prospectos. Todo evento está enlazado directamente al perfil del usuario.

### Funcionalidades clave
- **Vista Múltiple:** Interfaz visual por mes, semana o día.
- **Recordatorios Automáticos:** Alertas en el sistema para llamadas en frío o seguimientos.
- **Asociación Directa:** Cada evento se puede enlazar a un Lead específico para mantener el historial.

---

## 8. Notificaciones de Equipo (Telegram)

### Descripción
Arias CRM cuenta con un sistema robusto de notificaciones instantáneas (Fase 8d) para asegurar que los agentes de ventas nunca pierdan un prospecto asignado.

### Funcionalidades clave
- **Vínculo por `telegram_chat_id`:** Cada usuario del equipo debe registrar su ID de chat en su perfil (`profiles`).
- **Alertas de Asignación:** Al asignar un Lead a un agente, el sistema envía un mensaje de forma instantánea al bot de Telegram.
- **Sincronización:** Los administradores pueden visualizar si sus usuarios tienen activo el bot en la sección de "Equipo / Miembros".

---

## 9. Webhooks e Integraciones (Meta Ads)

### Descripción
El CRM funciona como un motor de recepción automática (Ingestion Engine). Permite conectar plataformas externas como Facebook e Instagram para que los clientes potenciales entren al embudo de ventas sin intervención humana.

### Funcionalidades clave
- **Conexión Meta Leads:** Generación de un endpoint seguro (Webhook) para recibir formularios de anuncios de Facebook.
- **Deduplicación Automática:** Si un Lead entra por webhook, el CRM verifica si el correo o teléfono ya existe para evitar registros duples.
- **Enrutamiento:** Asignación inteligente a los agentes disponibles según reglas de negocio.
---

## 10. Lead Scoring AI — Inteligencia Artificial de Calificación

### Descripción
El módulo de **Lead Scoring AI** calcula automáticamente un puntaje de 0 a 100 para cada lead basado en 7 factores de inteligencia. Esto permite que tu equipo de ventas sepa **al instante** quién es un lead caliente (listo para cerrar) y quién necesita más nutrición — sin intervención manual.

> **Ventaja competitiva:** HubSpot cobra $450+/mes por esta funcionalidad. En Arias CRM está incluida nativamente y corre a costo $0 (sin APIs externas).

### Cómo funciona
Cada vez que un lead se **crea o actualiza**, el motor de scoring analiza automáticamente su perfil y calcula un puntaje. No necesitas hacer nada — es 100% autónomo.

### Los 7 Factores de Scoring

| Factor | Puntos Máx. | Qué mide |
|--------|:-----------:|----------|
| **Valor del Deal** | 20 | Cuánto dinero representa la oportunidad |
| **Datos de Contacto** | 15 | Si tiene email, teléfono, empresa y dirección |
| **Dominio de Email** | 10 | Email corporativo (serio) vs Gmail/Hotmail (casual) |
| **Etapa del Pipeline** | 20 | Qué tan avanzado está en el proceso de ventas |
| **Engagement** | 15 | Cuántos seguimientos/interacciones ha tenido |
| **Fuente de Origen** | 15 | Referidos y sitio web valen más que llamada fría |
| **Frescura** | 5 | Leads recientes (< 7 días) puntúan más alto |

### Temperaturas del Lead

El score se traduce automáticamente en una **temperatura** visual:

| Temperatura | Rango | Significado | Acción recomendada |
|:-----------:|:-----:|-------------|--------------------|
| 🔥 **Caliente** | 75-100 | Alta probabilidad de cierre | Llamar HOY, prioridad máxima |
| ☀️ **Tibio** | 40-74 | Buen prospecto, necesita nutrición | Programar seguimiento esta semana |
| ❄️ **Frío** | 0-39 | Baja prioridad | Seguimiento pasivo, campañas de email |

### Dónde se ve el Score

- **Vista de Tarjetas (Grid):** Un badge con emoji y número aparece junto al estado del lead (ej. `🔥 82`)
- **Vista de Tabla (List):** Un anillo circular con el puntaje aparece en la columna de Prioridad
- **Detalle del Lead:** Al abrir un lead, la sección completa muestra cada factor desglosado con barras de progreso
- **Tooltip Hover:** Al pasar el mouse sobre cualquier badge de score, se despliega un tooltip con el desglose completo de los 7 factores

### Auto-Priorización

El scoring también **ajusta automáticamente la prioridad** del lead:

| Score | Prioridad asignada |
|:-----:|-------------------|
| 80-100 | 🔥 Altísima |
| 60-79 | ⚡ Alta |
| 40-59 | 💎 Media |
| 0-39 | 🌊 Baja |

### Preguntas sobre Lead Scoring

**¿Se recalcula el score cuando actualizo un lead?**
Sí. Cada vez que se edita un lead (cambio de etapa, se agrega teléfono, se actualiza el valor), el score se recalcula automáticamente.

**¿Consume tokens o APIs externas?**
No. Todo el cálculo se realiza en el frontend con algoritmos propios. Costo: $0.

**¿Puedo ver por qué un lead tiene ese score?**
Sí. Pasa el mouse sobre el badge de score y aparecerá un tooltip con los 7 factores y sus puntos individuales.

---

## 11. Cockpit del Agente AI — Centro de Mando Autónomo

### ¿Qué es el Cockpit del Agente AI?

El Cockpit es el **panel de control en tiempo real** donde puedes monitorear, supervisar y controlar todo lo que hace el agente de ventas autónomo (Sofía). Desde aquí ves cuántos leads está trabajando el bot, en qué etapa están, cómo se sienten, y si alguno necesita atención humana.

> **Acceso:** Marketing Hub → Cockpit AI — o directo en `/marketing/cockpit`

---

### 📊 Las 4 Métricas Principales — ¿Qué significa cada una?

| Métrica | Ícono | Qué significa exactamente |
|---------|-------|----------------------------|
| **Total Leads Rastreados** | 👥 | Cantidad de leads que tienen "memoria" activa. El bot los conoce: sabe su nombre, empresa, cuántos DTEs emiten, si ya cotizaron, si pusieron objeción de precio, etc. |
| **En Seguimiento Auto** | ⚡ | Leads donde el bot está enviando mensajes automáticos porque llevan más de 24h sin responder. Si el número es 55, el bot está persiguiendo activamente 55 prospectos mientras tú duermes. |
| **Sentiment Promedio** | ⭐ | Calificación de 0-100% del "estado de ánimo" promedio de todos los leads. 70%+ = entusiasmados. 40-69% = neutrales. Menos de 40% = fríos o con objeciones. |
| **Pendientes Escalar** | ⚠️ | Leads que el bot ya no puede manejar solo. Agotó todos sus intentos sin respuesta o detectó una situación compleja. Requieren que tú o tu equipo los contacten directamente. |

**Ejemplo práctico:**
- Total: 57 → El bot conoce y lleva seguimiento de 57 personas
- En Seguimiento Auto: 55 → 55 de esas personas están siendo contactadas automáticamente
- Sentiment: 50% → La mayoría está neutral, hay oportunidad de mejorar el pitch
- Pendientes Escalar: 0 → ¡Todo bajo control! El bot está manejando todo sin problemas 🎉

---

### 🔄 Pipeline del Bot — Las 7 Etapas

Cada lead en la memoria del bot tiene una **etapa de conversación** que avanza automáticamente según cómo interactúa:

| Etapa | Qué significa | Qué hace el bot |
|-------|---------------|------------------|
| **Nuevo** | Primer contacto — el bot no sabe nada del lead aún | Presenta a Sofía, pregunta nombre y empresa |
| **Calificado** | Ya tiene nombre, empresa y volumen de DTEs | Analiza qué plan le conviene y prepara propuesta |
| **Cotizado** | Ya recibió el precio y propuesta comercial | Hace seguimiento de la propuesta enviada |
| **Seguimiento** | Sigue caliente pero sin tomar decisión todavía | Envía recordatorios con urgencia y escasez |
| **Negociación** | Está discutiendo precio o condiciones | Usa técnicas de cierre y manejo de objeciones |
| **Cerrado ✓** | Compró o firmó contrato | Celebra y pasa al módulo de Clientes |
| **Perdido** | No hubo acuerdo — descartado temporalmente | Para el seguimiento automático |

---

### ⚠️ ¿Cuándo un Lead "Requiere Atención Humana"?

Hay 3 situaciones que hacen que el bot levante la bandera roja y pida ayuda humana:

**Situación 1 — Agotó todos los intentos**
```
Sofía envía mensaje #1 → Sin respuesta → espera 24h
Sofía envía mensaje #2 → Sin respuesta → espera 72h
Sofía envía mensaje #3 → Sin respuesta → espera 168h
→ El bot SE DETIENE y el lead aparece en "Pendientes Escalar"
```

**Situación 2 — Objeción compleja detectada**
Cuando el lead dice cosas como "quiero hablar con el gerente", "manden un vendedor a mi oficina", o "necesito una reunión formal" — el bot detecta que necesita presencia humana.

**Situación 3 — Sentiment muy bajo sin actividad**
Si el engagement cae y el lead lleva días sin interactuar con ningún mensaje.

**¿Qué pasa cuando escala?**
1. El lead aparece en la pestaña **"Escalar"** del Cockpit resaltado en rojo
2. El CRM agrega una nota automática al lead: *"⚠️ IA ESCALÓ: Sin respuesta tras 3 seguimientos. Requiere contacto humano."*
3. El bot **para de enviar mensajes** — no molesta más al lead
4. Tú puedes usar **"Abrir Chat"** para retomar la conversación o **"Reiniciar Bot"** para que Sofía intente de nuevo

---

### 🤖 Seguimientos Automáticos — Configuración Dinámica

El sistema de seguimientos es **completamente configurable** sin tocar código. Accede desde el ícono ⚙️ en el Cockpit:

| Configuración | Valor por defecto | Qué controla |
|---------------|:-----------------:|---------------|
| 1er seguimiento | **24 horas** | Cuánto tiempo espera antes del primer recordatorio |
| 2do seguimiento | **72 horas** | Tiempo entre el 1er y 2do mensaje |
| 3er seguimiento | **168 horas (7 días)** | Tiempo antes del último intento |
| Máx. intentos | **3** | Cuántos mensajes envía antes de escalar |
| Solo horario hábil | **Desactivado** | Si activas esto, solo envía Lun-Vie 8am-6pm |
| Pausar si ya cotizó | **Desactivado** | Pausa el seguimiento automático si ya hay propuesta enviada |
| Templates custom | **Auto-inteligente** | Deja en blanco para que Sofía genere mensajes según el contexto |

> **Consejo profesional:** Si quieres probar en vez de 24h usar 36h, simplemente cambia el valor y guarda. La próxima ejecución ya usa el nuevo tiempo. No necesitas tocar código.

---

### ▶️ "Ejecutar Seguimientos" — ¿Qué hace exactamente ese botón?

Cuando presionas **EJECUTAR SEGUIMIENTOS**, el sistema:
1. Revisa TODAS las conversaciones activas (ejemplo: 58 conversaciones)
2. Para cada una, verifica si pasaron las horas configuradas desde el último contacto
3. Si el lead no respondió y pasó el tiempo → le envía el mensaje de seguimiento por Telegram/WhatsApp
4. Actualiza la memoria del bot con el nuevo estado
5. Te muestra un resumen: *"56 seguimientos enviados, 2 omitidos"*

Este botón también corre automáticamente cada 4 horas en el servidor — no necesitas hacerlo manualmente a menos que quieras un run inmediato.

---

## 12. Preguntas Frecuentes (FAQ)

### ¿Cómo agrego un nuevo lead manualmente?
Ve a **Leads → Nuevo Lead**, completa el formulario con nombre, teléfono, fuente y etapa inicial, y haz clic en **Guardar**. El sistema le asignará un AI Score automáticamente.

### ¿Cómo restablezco mi contraseña?
En la pantalla de inicio de sesión, haz clic en **¿Olvidaste tu contraseña? Entra con código mágico**. Recibirás un enlace de recuperación en tu correo registrado.

### ¿Cómo asigno un lead a otro agente?
Abre el detalle del lead y en el campo **Asignado a**, selecciona el agente deseado del menú desplegable. El sistema notificará automáticamente al agente vía Telegram.

### ¿Cómo genero una cotización desde un lead?
Dentro del detalle del lead, haz clic en **Crear Cotización**. El motor de cotizaciones se abrirá con los datos del lead precargados.

### ¿Cómo configuro las etapas del pipeline o revierto un Lead?
Ve a **Admin → Pipeline** y arrastra las etapas para reordenarlas, edita sus nombres y marca hitos importantes. En el Tablero visual, los agentes también pueden utilizar el botón **"Revertir"** para regresar un Lead a la etapa anterior si hubo equivocaciones o re-negociaciones.

### ¿Los datos de cada empresa están separados?
Sí. El sistema es **multi-tenant** con aislamiento completo por Row Level Security (RLS) en la base de datos. Cada empresa ve únicamente sus propios datos.

### ¿Qué significa el badge 🔥/☀️/❄️ en los leads?
Es el **AI Lead Score**. Indica qué tan probable es que el lead cierre. 🔥 = llamar hoy, ☀️ = darle seguimiento pronto, ❄️ = baja prioridad. Pasa el mouse sobre el badge para ver el desglose completo.

---

*Arias CRM Professional — Documentación v5.0 — Actualizada Mayo 2026*
