# 🛡️ Protocolo de Prevención de Caídas de RLS y Aislamiento de Entornos

Este protocolo establece los pasos obligatorios para desarrolladores e inteligencias artificiales para asegurar que **nunca** se repita una caída de políticas RLS en producción y que el entorno local **jamás** apunte a producción de forma accidental.

---

## 1. Regla de Oro: Prohibición de `CASCADE` en Producción

> [!WARNING]
> El uso de `DROP FUNCTION ... CASCADE` o `DROP TABLE ... CASCADE` en scripts de migración está **estrictamente prohibido** sin un análisis previo de dependencias.

* **Por qué falló**: PostgreSQL elimina automáticamente (en cascada) todas las políticas RLS, vistas y triggers dependientes cuando se elimina una función o tabla referenciada.
* **El estándar de reemplazo**:
  - Para modificar una función sin cambiar sus parámetros (firma), utiliza siempre `CREATE OR REPLACE FUNCTION`. Esto preserva todas las políticas RLS intactas.
  - Si necesitas cambiar los parámetros de la función, debes **declarar explícitamente la recreación de todas las políticas afectadas** dentro del mismo archivo de migración.

---

## 2. Aislamiento Estricto de Entornos (Desarrollo Seguro)

Para garantizar la confidencialidad de la información de los clientes reales y evitar mutaciones catastróficas accidentales en producción:

> [!IMPORTANT]
> **Prohibición de Credenciales de Producción en Local**:
> Ningún desarrollador ni agente de IA debe configurar la URL de producción (`mtxqqamitglhehaktgxm`) ni sus llaves de API en archivos locales como `.env.local` o `.env.development.local`.

*   **Entorno de Desarrollo Local**: Debe configurarse estrictamente para apuntar al proyecto de **Testing/Secundario** (`ubqscyfefgfbmndnypbp`) o a un emulador local de Supabase.
*   **Configuración Estándar de `.env.local`**:
    ```env
    VITE_SUPABASE_URL="https://ubqscyfefgfbmndnypbp.supabase.co"
    VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    ```

---

## 3. Proceso Obligatorio de Verificación (Local → Testing → Producción)

Antes de que cualquier cambio toque producción, debe seguir este flujo de validación:

```mermaid
graph TD
    A[Escribir Migración SQL] --> B[Aplicar en Local / Testing]
    B --> C[Ejecutar Script de Auditoría de RLS]
    C -->|Faltan Políticas| D[Corregir Migración]
    C -->|Verificación Exitosa| E[Merge a main / Deploy a Prod]
```

1. **Paso 1: Aplicar en Testing**:
   Ejecutar la migración primero en el proyecto de testing (`ubqscyfefgfbmndnypbp`).
2. **Paso 2: Ejecutar Script de Auditoría de RLS**:
   Ejecutar un script automatizado en local o testing para auditar el estado de RLS.
3. **Paso 3: Pruebas de Roles Simulación**:
   Verificar el acceso de datos simulando un usuario con rol limitado (agente) y un administrador para confirmar que las políticas RBAC aíslan la información correctamente.

---

## 4. Script de Auditoría de Políticas (Integrado en el Repositorio)

Hemos creado una herramienta de auditoría en la carpeta `scripts/audit-rls.cjs` que verifica automáticamente si existen tablas con RLS activo pero sin políticas aplicadas (estado de "denegación por defecto").

Este script debe ejecutarse antes de cada despliegue:
```bash
node scripts/audit-rls.cjs
```
