# 🧪 GUÍA DE PRUEBA RÁPIDA - Sistema de Cotización Unificado

## ⚡ Prueba en 5 Minutos

### 1️⃣ Verificar que el servidor está corriendo

```bash
npm run dev
```

Accede a: `http://localhost:5173`

---

### 2️⃣ Verificar la Navegación Actualizada

**CHECKLIST:**
- [ ] Inicia sesión en el sistema
- [ ] Abre el Sidebar (menú lateral)
- [ ] Verifica que aparece **"Nueva Cotización"** (NO "Cotizador Pro")
- [ ] Verifica que **NO aparece** un enlace a `/cotizaciones/nueva` (sistema antiguo)

---

### 3️⃣ Probar: Cotización desde un Lead Existente

**PASO A PASO:**

1. **Navega a "Nueva Cotización"** (clic en el sidebar)
   - URL: `http://localhost:5173/cotizaciones/nueva-pro`

2. **Paso 1 - Cliente:**
   - [ ] Activa el checkbox **"📋 Seleccionar de Leads existentes"**
   - [ ] Verifica que aparece un dropdown con tus Leads
   - [ ] Selecciona un Lead del dropdown
   - [ ] **ESPERADO**: 
     - ✅ El nombre del cliente se llena automáticamente
     - ✅ El email se llena automáticamente
     - ✅ Los campos tienen fondo gris (deshabilitados)
     - ✅ Aparece mensaje verde: "✓ Lead seleccionado - Datos del cliente cargados automáticamente"
   - [ ] Ingresa un volumen de DTEs (ej: **2200**)
   - [ ] **ESPERADO**: Aparece mensaje verde con el paquete sugerido

3. **Clic en "Siguiente"**

4. **Paso 2 - Paquete:**
   - [ ] Verifica que aparecen los paquetes disponibles
   - [ ] El paquete sugerido tiene un badge **"⭐ Sugerido"**
   - [ ] Selecciona un paquete (puede ser el sugerido)
   - [ ] **ESPERADO**: Panel flotante aparece en la esquina superior derecha con el precio

5. **Clic en "Siguiente"**

6. **Paso 3 - Módulos/Servicios:**
   - [ ] Selecciona algunos módulos (ej: POS, Cuentas por Cobrar)
   - [ ] Selecciona algunos servicios (ej: WhatsApp)
   - [ ] **ESPERADO**: El panel flotante actualiza los totales en tiempo real

7. **Clic en "Siguiente"**

8. **Paso 4 - Resumen:**
   - [ ] Verifica el desglose completo
   - [ ] (Opcional) Ingresa un descuento (ej: 10%)
   - [ ] (Opcional) Agrega notas
   - [ ] **Clic en "Generar Cotización"**

9. **ESPERADO:**
   - [ ] Mensaje de éxito: "✅ Cotización creada exitosamente"
   - [ ] Redirección a `/cotizaciones`
   - [ ] La nueva cotización aparece en la tabla

---

### 4️⃣ Verificar en la Base de Datos

**Consulta SQL:**
```sql
SELECT 
    id, 
    nombre_cliente, 
    email_cliente, 
    lead_id,
    plan_nombre,
    total_anual,
    estado,
    created_at
FROM cotizaciones
ORDER BY created_at DESC
LIMIT 1;
```

**CHECKLIST:**
- [ ] `nombre_cliente` coincide con el Lead seleccionado
- [ ] `email_cliente` coincide con el Lead seleccionado
- [ ] `lead_id` **NO ES NULL** (debe ser el UUID del Lead)
- [ ] `total_anual` es correcto
- [ ] `estado` es **'borrador'**

---

### 5️⃣ Probar: Cotización con Ingreso Manual

**PASO A PASO:**

1. **Navega a "Nueva Cotización"** nuevamente

2. **Paso 1 - Cliente:**
   - [ ] **NO actives** el checkbox "Seleccionar de Leads existentes"
   - [ ] Ingresa manualmente:
     - Nombre: "Empresa de Prueba Manual S.A."
     - Email: "manual@test.com"
     - DTEs: 1500
   - [ ] **ESPERADO**: Los campos están habilitados (sin fondo gris)

3. **Completa el wizard** (Pasos 2, 3, 4)

4. **Genera la cotización**

5. **Verifica en BD:**
   ```sql
   SELECT lead_id FROM cotizaciones 
   WHERE nombre_cliente = 'Empresa de Prueba Manual S.A.';
   ```
   - [ ] `lead_id` **ES NULL** ✅

---

### 6️⃣ Probar: Cambio de Modo (Lead ⟷ Manual)

1. **Activar toggle** → Seleccionar Lead → **Ver datos cargados**
2. **Desactivar toggle**
   - [ ] **ESPERADO**: Campos se limpian
   - [ ] Campos están habilitados nuevamente

---

## 🚨 Errores Comunes y Soluciones

### Error: "No aparecen Leads en el dropdown"

**Causa:** No hay Leads en la BD o hay un error de permisos

**Solución:**
1. Verifica que tienes Leads creados en `/leads`
2. Revisa la consola del navegador (F12) para errores
3. Verifica las políticas RLS de la tabla `leads`

---

### Error: "Los campos no se llenan al seleccionar un Lead"

**Causa:** La función handleSeleccionarLead no se ejecuta

**Solución:**
1. Abre la consola del navegador (F12)
2. Verifica que no hay errores en `CotizadorPro.tsx`
3. Revisa que el Lead seleccionado tiene `nombre` y `email`

---

### Error: "El panel flotante no aparece"

**Causa:** No has seleccionado un paquete en el Paso 2

**Solución:**
- El panel flotante solo aparece a partir del **Paso 2** (después de seleccionar un paquete)

---

## ✅ Checklist Final

Marca cada ítem cuando lo hayas verificado:

- [ ] ✅ El sidebar muestra "Nueva Cotización" (NO "Cotizador Pro")
- [ ] ✅ NO hay enlace al sistema antiguo en el sidebar
- [ ] ✅ Puedo seleccionar un Lead en el Paso 1
- [ ] ✅ Los datos del Lead se cargan automáticamente
- [ ] ✅ Los campos se deshabilitan cuando uso un Lead
- [ ] ✅ Puedo ingresar datos manualmente (sin seleccionar Lead)
- [ ] ✅ El paquete sugerido aparece según los DTEs
- [ ] ✅ El panel flotante muestra totales en tiempo real
- [ ] ✅ La cotización se genera correctamente con `lead_id`
- [ ] ✅ La cotización se genera correctamente sin `lead_id` (manual)

---

## 🎉 Sistema Listo

Si todos los checks están ✅, el sistema de cotización unificado está funcionando perfectamente.

**¡Felicitaciones! 🚀**
