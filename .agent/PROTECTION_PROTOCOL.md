# 🛡️ PROTOCOLO DE PROTECCIÓN DEL SISTEMA
**Fecha de Creación:** 2026-02-10  
**Prioridad:** CRÍTICA  
**Estado:** ACTIVO

---

## ⚠️ REGLA FUNDAMENTAL

**NUNCA modificar código de producción sin validación explícita del usuario.**

---

## 📋 CHECKLIST OBLIGATORIO ANTES DE CUALQUIER CAMBIO

### 1. IDENTIFICACIÓN DEL CAMBIO
- [ ] ¿Qué archivo(s) se modificarán?
- [ ] ¿Qué funcionalidad se verá afectada?
- [ ] ¿Es un cambio en producción o desarrollo?

### 2. JUSTIFICACIÓN
- [ ] ¿Por qué es necesario este cambio?
- [ ] ¿Qué problema específico resuelve?
- [ ] ¿Hay evidencia de que el problema existe?

### 3. ANÁLISIS DE IMPACTO
- [ ] ¿Qué otras partes del sistema podrían verse afectadas?
- [ ] ¿Hay dependencias que puedan romperse?
- [ ] ¿Se ha verificado el código actual antes de modificar?

### 4. VALIDACIÓN PREVIA
- [ ] ¿El usuario solicitó explícitamente este cambio?
- [ ] ¿Se ha mostrado el plan de cambios al usuario?
- [ ] ¿El usuario aprobó el cambio?

### 5. RESPALDO
- [ ] ¿Se ha documentado el estado actual?
- [ ] ¿Se puede revertir fácilmente?
- [ ] ¿Se ha guardado una copia del código original?

---

## 🚫 PROHIBICIONES ABSOLUTAS

### NUNCA hacer lo siguiente sin aprobación explícita:

1. **Modificar lógica de negocio existente** que funciona correctamente
2. **Cambiar estructuras de base de datos** en producción
3. **Alterar cálculos financieros** (precios, impuestos, descuentos)
4. **Modificar permisos o roles** sin auditoría previa
5. **Cambiar flujos de autenticación** o seguridad
6. **Actualizar dependencias críticas** sin testing
7. **Refactorizar código funcional** "por mejora estética"
8. **Eliminar código** sin confirmar que está obsoleto

---

## ✅ PROCESO DE CAMBIO SEGURO

### Paso 1: DIAGNÓSTICO
```
1. Usuario reporta un problema específico
2. Verificar que el problema existe realmente
3. Identificar la causa raíz (no asumir)
4. Documentar el comportamiento actual
```

### Paso 2: PROPUESTA
```
1. Presentar análisis del problema al usuario
2. Proponer solución específica y mínima
3. Explicar qué se modificará exactamente
4. Mostrar código antes/después si es relevante
5. ESPERAR APROBACIÓN EXPLÍCITA
```

### Paso 3: IMPLEMENTACIÓN
```
1. Hacer SOLO el cambio aprobado
2. No agregar "mejoras adicionales" no solicitadas
3. Documentar cada modificación
4. Verificar que no se rompió nada más
```

### Paso 4: VALIDACIÓN
```
1. Confirmar que el problema original se resolvió
2. Verificar que no se introdujeron nuevos problemas
3. Documentar el cambio en el historial
```

---

## 🎯 PRINCIPIOS DE INTERVENCIÓN

### 1. MÍNIMA INVASIÓN
- Hacer el cambio más pequeño posible
- No refactorizar código que funciona
- No "mejorar" cosas que no están rotas

### 2. EVIDENCIA PRIMERO
- No asumir que algo está mal
- Verificar con datos reales
- Consultar logs, base de datos, comportamiento actual

### 3. REVERSIBILIDAD
- Todo cambio debe ser reversible
- Documentar estado anterior
- Mantener copias de seguridad

### 4. TRANSPARENCIA TOTAL
- Explicar qué se va a hacer
- Mostrar el código que se modificará
- Obtener aprobación explícita

---

## 🔍 SEÑALES DE ALERTA

**DETENER INMEDIATAMENTE** si detectas:

- ❌ Estás modificando código sin entender completamente su propósito
- ❌ El cambio afecta múltiples archivos no relacionados
- ❌ No hay un problema claramente definido que resolver
- ❌ El usuario no solicitó este cambio específico
- ❌ Estás "mejorando" código funcional
- ❌ No puedes explicar exactamente qué hace el código actual

---

## 📊 CATEGORÍAS DE CAMBIO

### 🟢 CAMBIOS SEGUROS (Requieren aprobación básica)
- Corrección de typos en UI
- Ajustes de estilos CSS menores
- Actualización de texto/labels
- Logs adicionales para debugging

### 🟡 CAMBIOS MODERADOS (Requieren análisis y aprobación)
- Modificación de lógica de UI
- Nuevas validaciones
- Cambios en servicios existentes
- Actualizaciones de dependencias menores

### 🔴 CAMBIOS CRÍTICOS (Requieren análisis exhaustivo + aprobación explícita)
- Modificación de lógica de negocio
- Cambios en base de datos
- Alteración de cálculos financieros
- Modificación de permisos/seguridad
- Cambios en autenticación
- Refactorización de código core

---

## 🔒 PROTECCIÓN DE PRODUCCIÓN

### Base de Datos de Producción
**Proyecto ID:** `ikofyypxphrqkncimszt`

**NUNCA ejecutar en producción sin:**
1. Aprobación explícita del usuario
2. Backup verificado
3. Plan de rollback documentado
4. Testing en desarrollo primero

### Archivos Críticos Protegidos
```
src/services/
  - adminService.ts
  - teamService.ts
  - permissionsService.ts
  - quoteService.ts
  - pdfService.ts

src/hooks/
  - usePermissions.ts
  - useAuth.ts

Database RPCs:
  - get_user_permissions
  - Cualquier función SECURITY DEFINER
```

---

## 📝 TEMPLATE DE PROPUESTA DE CAMBIO

```markdown
## 🔧 Propuesta de Cambio

### Problema Identificado
[Descripción específica del problema reportado por el usuario]

### Causa Raíz
[Análisis técnico de por qué ocurre el problema]

### Solución Propuesta
[Descripción exacta de qué se modificará]

### Archivos Afectados
- `ruta/archivo1.ts` - [Qué se cambiará]
- `ruta/archivo2.ts` - [Qué se cambiará]

### Código Actual vs. Propuesto
```diff
- código actual
+ código propuesto
```

### Impacto
- ✅ Beneficios: [Lista]
- ⚠️ Riesgos: [Lista]
- 🔄 Dependencias afectadas: [Lista]

### Plan de Rollback
[Cómo revertir si algo sale mal]

---
**¿Apruebas este cambio?** (Esperar respuesta explícita)
```

---

## 🎓 LECCIONES APRENDIDAS

### Errores Pasados a Evitar
1. **Sincronización no solicitada** entre dev/prod
2. **Modificación de roles** sin validar impacto completo
3. **Cambios en RPC** sin verificar comportamiento actual
4. **Asunciones sobre "mejoras"** sin consultar al usuario

### Principio Guía
> **"Si funciona en producción, NO lo toques sin razón explícita y aprobación del usuario"**

---

## 📞 PROTOCOLO DE COMUNICACIÓN

### Antes de CUALQUIER cambio:
1. **Preguntar:** "¿Confirmas que quieres que modifique [X]?"
2. **Explicar:** "Esto afectará [Y] de esta manera: [Z]"
3. **Esperar:** Aprobación explícita del usuario
4. **Documentar:** Qué se cambió y por qué

### Durante el cambio:
- Informar progreso
- Reportar cualquier hallazgo inesperado
- DETENER si algo no cuadra

### Después del cambio:
- Confirmar que funcionó
- Documentar en Knowledge Items si es relevante
- Verificar que no se rompió nada más

---

## 🚀 COMPROMISO DE CALIDAD

**Este protocolo existe para:**
- Proteger la estabilidad del sistema
- Mantener la confianza del usuario
- Prevenir regresiones no intencionales
- Asegurar que cada cambio agregue valor real

**Última actualización:** 2026-02-10  
**Próxima revisión:** Cada vez que se identifique un nuevo patrón de riesgo
