# Sistema de Permisos - CRM Enterprise

## Descripción General

El sistema de permisos del CRM permite controlar qué acciones puede realizar cada rol de usuario. El **Super Admin** siempre tiene acceso completo a todas las funcionalidades.

## Jerarquía de Roles

1. **Super Admin** (super_admin)
   - Acceso TOTAL a todas las funcionalidades
   - No se puede restringir ningún permiso
   - Puede gestionar todos los permisos de otros roles

2. **Company Admin** (company_admin)
   - Permisos configurables
   - Puede gestionar su empresa y equipo
   - Acceso según permisos asignados

3. **Sales Agent** (sales_agent)
   - Permisos limitados
   - Enfocado en gestión de leads y seguimientos
   - Acceso según permisos asignados

## Uso del Sistema de Permisos

### 1. Hook usePermissions

```typescript
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
    const { hasPermission, isSuperAdmin, isAdmin } = usePermissions();

    // Verificar permiso específico
    if (hasPermission('leads:create')) {
        // Mostrar botón crear lead
    }

    // Verificar si es Super Admin
    if (isSuperAdmin()) {
        // Mostrar opciones avanzadas
    }

    // Verificar si es Admin (Super o Company)
    if (isAdmin()) {
        // Mostrar panel de administración
    }
}
```

### 2. Componente Protected

```tsx
import { Protected } from '../components/Protected';

// Proteger por permiso único
<Protected permission="leads:delete">
    <button>Eliminar Lead</button>
</Protected>

// Proteger por cualquiera de varios permisos
<Protected anyPermissions={['leads:edit', 'leads:delete']}>
    <button>Editar</button>
</Protected>

// Proteger por todos los permisos
<Protected allPermissions={['leads:view', 'leads:edit']}>
    <div>Panel de edición</div>
</Protected>

// Proteger solo para admins
<Protected requireAdmin>
    <div>Panel de administración</div>
</Protected>

// Proteger solo para super admin
<Protected requireSuperAdmin>
    <div>Configuración avanzada</div>
</Protected>

// Con fallback personalizado
<Protected 
    permission="leads:create"
    fallback={<div>No tienes permiso</div>}
>
    <button>Crear Lead</button>
</Protected>
```

### 3. Verificación en el Código

```typescript
import { usePermissions } from '../hooks/usePermissions';

function handleDelete(leadId: string) {
    const { hasPermission, isSuperAdmin } = usePermissions();

    // Super Admin puede eliminar cualquier lead
    if (isSuperAdmin()) {
        deleteLead(leadId);
        return;
    }

    // Otros roles deben tener permiso
    if (!hasPermission('leads:delete')) {
        alert('No tienes permiso para eliminar leads');
        return;
    }

    deleteLead(leadId);
}
```

## Categorías de Permisos

### Configuración (7 permisos)
- `config:manage_licenses` - Gestionar licencias y límites
- `config:manage_integrations` - Gestionar integraciones
- `config:view_settings` - Ver configuración
- `config:edit_settings` - Editar configuración
- `config:manage_billing` - Gestionar facturación
- `config:view_audit_logs` - Ver logs de auditoría
- `config:manage_security` - Gestionar seguridad

### Equipo (8 permisos)
- `team:view_all` - Ver todo el equipo
- `team:invite` - Invitar miembros
- `team:edit` - Editar miembros
- `team:remove` - Eliminar miembros
- `team:manage_roles` - Gestionar roles
- `team:view_performance` - Ver desempeño
- `team:assign_leads` - Asignar leads
- `team:manage_permissions` - Gestionar permisos

### Leads (12 permisos)
- `leads:view_own` - Ver leads propios
- `leads:view_team` - Ver leads del equipo
- `leads:view_all` - Ver todos los leads
- `leads:create` - Crear leads
- `leads:edit_own` - Editar leads propios
- `leads:edit_team` - Editar leads del equipo
- `leads:edit_all` - Editar todos los leads
- `leads:delete` - Eliminar leads
- `leads:export` - Exportar leads
- `leads:import` - Importar leads
- `leads:manage_status` - Gestionar estados
- `leads:view_analytics` - Ver analíticas

### Seguimientos (8 permisos)
- `followups:view_own` - Ver seguimientos propios
- `followups:view_team` - Ver seguimientos del equipo
- `followups:view_all` - Ver todos los seguimientos
- `followups:create` - Crear seguimientos
- `followups:edit_own` - Editar seguimientos propios
- `followups:edit_team` - Editar seguimientos del equipo
- `followups:delete` - Eliminar seguimientos
- `followups:manage_templates` - Gestionar plantillas

### Calendario (4 permisos)
- `calendar:view_own` - Ver calendario personal
- `calendar:edit_events` - Editar eventos del calendario
- `calendar:create_events` - Crear eventos en calendario
- `calendar:view_team` - Ver calendario del equipo completo

### Dashboard (12 permisos)
- `dashboard:view_own` - Ver dashboard personal
- `dashboard:view_team` - Ver dashboard del equipo
- `dashboard:view_company` - Ver dashboard de empresa
- `dashboard:export_reports` - Exportar reportes
- `dashboard:view_revenue` - Ver ingresos
- `dashboard:view_forecasts` - Ver proyecciones
- `dashboard:manage_widgets` - Gestionar widgets
- `dashboard:view_kpis` - Ver KPIs
- `dashboard:create_reports` - Crear reportes
- `dashboard:schedule_reports` - Programar reportes
- `dashboard:view_comparisons` - Ver comparaciones
- `dashboard:manage_goals` - Gestionar objetivos

## Reglas Importantes

1. **Super Admin NO se puede restringir**
   - Todos los switches de Super Admin están siempre habilitados
   - No se pueden desactivar permisos para Super Admin
   - La función `isEnabled('super_admin', key)` siempre retorna `true`

2. **Permisos heredados**
   - Si tienes `leads:edit_all`, implícitamente tienes `leads:edit_team` y `leads:edit_own`
   - Si tienes `leads:view_all`, implícitamente tienes `leads:view_team` y `leads:view_own`

3. **Permisos por defecto**
   - Super Admin: TODOS los permisos habilitados
   - Company Admin: Mayoría de permisos habilitados
   - Sales Agent: Permisos básicos de leads y seguimientos

## Scripts SQL

### Asegurar permisos de Super Admin
```sql
-- Ejecutar en Supabase SQL Editor
\i ensure_superadmin_permissions.sql
```

### Verificar estado de permisos
```sql
SELECT 
    role,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_enabled = true) as enabled
FROM role_permissions
GROUP BY role;
```

## Resolución de Problemas

### El Super Admin no puede acceder a algo
1. Verificar que `profile.role === 'super_admin'`
2. El hook `usePermissions` debería retornar `true` para cualquier permiso
3. Si usa `Protected`, debe renderizar siempre el contenido para super_admin

### Un permiso no se actualiza
1. Verificar en Supabase que el registro existe en `role_permissions`
2. Recargar la página para obtener los permisos actualizados
3. Verificar que el `permission_key` coincide exactamente

### Switches desactivados en la UI
1. Solo Super Admin puede editar permisos
2. Verificar `isSuperAdmin` en la página de Permisos
3. Los switches están deshabilitados para no-admins

## Soporte

Para más información, contactar al equipo de desarrollo.
