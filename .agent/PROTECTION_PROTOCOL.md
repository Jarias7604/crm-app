# 🛡️ PROTOCOLO DE PROTECCIÓN DE PERMISOS
Este documento es una SALVAGUARDA CRÍTICA para el sistema de roles y permisos.

## REGLA DE ORO
**La decisión del Administrador en el perfil del usuario (Overwrites) es LEY ABSOLUTA.** 
Nunca, bajo ninguna circunstancia, se debe dar prioridad al permiso del Rol si el Administrador ha marcado un switch como 'false' en el perfil individual.

## COMPONENTES CRÍTICOS
1. **Frontend (`Team.tsx`):** El sistema debe guardar una FOTO EXACTA (Snapshot) de los permisos visibles en pantalla. No debe intentar calcular diferencias ni herencias.
2. **Backend (`get_user_permissions`):** La función SQL debe priorizar el objeto `permissions` de la tabla `profiles`.
3. **Autenticación (`AuthProvider.tsx`):** No se deben incluir 'bypasses' basados en correos electrónicos específicos (ej. jarias7604). La simulación debe ser un reflejo exacto de la realidad.

## VERIFICACIÓN DE INTEGRIDAD
Cada vez que se modifique la lógica de accesos, se DEBE:
1. Validar que un usuario con Rol "Agente de Ventas" NO vea el Calendario si el Admin lo apaga.
2. Validar que al cerrar y abrir el modal de Equipo, los cambiospersistan exactamente como se dejaron.
