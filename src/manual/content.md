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

## 10. Preguntas Frecuentes (FAQ)

### ¿Cómo agrego un nuevo lead manualmente?
Ve a **Leads → Nuevo Lead**, completa el formulario con nombre, teléfono, fuente y etapa inicial, y haz clic en **Guardar**.

### ¿Cómo restablezco mi contraseña?
En la pantalla de inicio de sesión, haz clic en **¿Olvidaste tu contraseña?**. Recibirás un enlace de recuperación en tu correo registrado.

### ¿Cómo asigno un lead a otro agente?
Abre el detalle del lead y en el campo **Asignado a**, selecciona el agente deseado del menú desplegable. El sistema notificará automáticamente al agente vía Telegram.

### ¿Cómo genero una cotización desde un lead?
Dentro del detalle del lead, haz clic en **Crear Cotización**. El motor de cotizaciones se abrirá con los datos del lead precargados.

### ¿Cómo configuro las etapas del pipeline o revierto un Lead?
Ve a **Admin → Pipeline** y arrastra las etapas para reordenarlas, edita sus nombres y marca hitos importantes. En el Tablero visual, los agentes también pueden utilizar el botón **"Revertir"** para regresar un Lead a la etapa anterior si hubo equivocaciones o re-negociaciones.

### ¿Los datos de cada empresa están separados?
Sí. El sistema es **multi-tenant** con aislamiento completo por Row Level Security (RLS) en la base de datos. Cada empresa ve únicamente sus propios datos.

---

*Arias CRM Professional — Documentación v3.0 — Actualizada Abril 2026*
