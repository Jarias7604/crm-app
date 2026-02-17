# Protocolo de Integridad del Desarrollador (Cero Riesgo) 🛡️

Este documento establece las reglas estrictas para evitar regresiones o pérdida de visibilidad en el desarrollo del CRM.

## 1. Regla de Oro: Aprobación de Esquema
**NUNCA** se aplicarán migraciones de base de datos (`ALTER TABLE`, `UPDATE` masivos, o cambios de `RLS`) sin presentar primero un `implementation_plan.md` detallado y recibir el "OK" explícito del usuario.

## 2. Protección de Visibilidad (Local Safe Mode)
Para evitar que errores de lógica en la seguridad oculten módulos, el entorno local operará bajo estas reglas:
- **RLS Desactivado en Configuración**: Tablas como `profiles`, `custom_roles`, `role_permissions`, `marketing_integrations` y `marketing_ai_agents` tendrán el Row Level Security desactivado por defecto en local.
- **Bypass de Super Admin**: El usuario `jarias7604@gmail.com` es reconocido por el sistema como la autoridad máxima, ignorando cualquier filtro de permisos que pueda bloquear el desarrollo.

## 3. Inventario de Llaves Críticas
Para que los menús no desaparezcan, se deben respetar estas llaves en la base de datos:
- `mkt_view_dashboard` (Visibilidad del Hub)
- `mkt_ai_agents` (Acceso a Roger)
- `chat_view_all` (Mensajería)
- `cotizaciones.manage_implementation` (Cotizador)

## 4. Acción de Raíz Ejecutada
Se ha eliminado la recursión infinita en Postgres y se ha "anclado" la configuración de licencias para que sea persistente y no dependa de cálculos volátiles de seguridad.

---
**Compromiso de Confiabilidad:** Mi prioridad es que cada minuto que inviertes en desarrollo se traduzca en avance, no en retroceso.
