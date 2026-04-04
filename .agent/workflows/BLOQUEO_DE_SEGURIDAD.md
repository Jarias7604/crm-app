# 🛑 BLOQUEO DE SEGURIDAD CRÍTICO - ARIAS DEFENSE CRM

Este protocolo es de LECTURA OBLIGATORIA para cualquier Agente de IA antes de realizar cambios en este repositorio.

## ⚡ Regla de Oro (Ley de Arias)
**NUNCA, bajo NINGUNA circunstancia**, se deben modificar los archivos `.env`, `.env.local` o `.env.production` para apuntar a un proyecto distinto sin la autorización EXPRESA y VERBAL del usuario (jarias7604).

## 🛡️ Protocolo de Ejecución
1.  **Identidad:** Antes de cada tarea, verificar que el proyecto cargado en local es **CRM-DEV** (`mtxqqamitglhehaktgxm`).
2.  **Producción:** La base de datos de producción (`ikofyypxphrqkncimszt`) está estrictamente **FUERA DE LÍMITES** para tareas de desarrollo local.
3.  **Aislamiento RLS:** Nunca desactivar el RLS en producción. En desarrollo, el RLS debe ser mantenido con la función `get_my_role()`.

## ⚠️ Consecuencias de Incumplimiento
Cualquier alteración de este protocolo que resulte en la pérdida de visibilidad de módulos o contaminación de bases de datos es considerada una **FALLA CRÍTICA DE MISIÓN**.

*Última actualización: 2 de abril de 2026 - Blindaje Maestro Restaurado.*
