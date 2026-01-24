# 📋 Plan de Implementación - Sistema de Cotizaciones Dinámico

## 🎯 Objetivos

1. **Precios dinámicos** basados en rangos de DTES desde BD
2. **Módulos adicionales** cargados desde pricing_items
3. **Submenú de configuración** bajo Cotizaciones
4. **Permisos por rol** (Super Admin, Admin, Agente)

---

## ✅ Paso 1: Ejecutar SQL para Agregar Módulos Faltantes

**Archivo:** `ADD_MISSING_MODULES.sql`

```sql
-- Ya creado, debes ejecutarlo en Supabase
```

**Qué hace:**
- Agrega "Módulo de Ventas" ($360/año)
- Agrega "Cuentas por Cobrar" ($300/año)
- Actualiza descripciones de POS y Compras

---

## ✅ Paso 2: Actualizar Permisos en PricingConfig

**Cambio necesario:**
```typescript
// Solo Super Admin y Company Admin pueden ver Config. Precios
// Agentes de Ventas NO tienen acceso
```

---

## ✅ Paso 3: Wizard Dinámico

**Cambios en `NuevaCotizacion.tsx`:**

### A. Cargar datos desde BD al inicio:
```typescript
useEffect(() => {
    loadPricingData();
}, []);

const loadPricingData = async () => {
    const config = await pricingService.getPricingConfig();
    setPlanesDisponibles(config.planes);
    setModulosDisponibles(config.modulos);
    setServiciosDisponibles(config.servicios);
};
```

### B. Sugerencia automática de plan por DTEs:
```typescript
useEffect(() => {
    if (formData.volumen_dtes > 0) {
        const planSugerido = planesDisponibles.find(
            p => formData.volumen_dtes >= p.min_dtes && 
                 formData.volumen_dtes <= p.max_dtes
        );
        if (planSugerido) {
            setFormData(prev => ({
                ...prev,
                plan_nombre: planSugerido.nombre,
                costo_plan_anual: planSugerido.precio_anual,
                costo_plan_mensual: planSugerido.precio_mensual,
                costo_implementacion: planSugerido.costo_unico
            }));
        }
    }
}, [formData.volumen_dtes, planesDisponibles]);
```

### C. Renderizar planes dinámicamente:
```typescript
const renderPaso2 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {planesDisponibles.map(plan => {
            const esRecomendado = formData.volumen_dtes >= plan.min_dtes && 
                                 formData.volumen_dtes <= plan.max_dtes;
            // ... resto del código
        })}
    </div>
);
```

---

## ✅ Paso 4: Estructura de Menú

**Sidebar actualizado:**
```
📊 Dashboard
👥 Leads
💰 Cotizaciones
   ├─ Lista de Cotizaciones (todos)
   └─ ⚙️ Config. Paquetes (solo Admin/Super Admin)
📅 Calendario
```

---

## ✅ Paso 5: Permisos por Rol

### **Super Admin:**
- ✅ Ver/editar TODOS los pricing_items
- ✅ Crear paquetes globales (company_id = NULL)
- ✅ Crear/editar cotizaciones de cualquier empresa

### **Company Admin:**
- ✅ Ver pricing_items globales + de su empresa
- ✅ Crear paquetes personalizados para su empresa
- ✅ Crear/editar cotizaciones de su empresa

### **Agente de Ventas:**
- ❌ NO puede ver Config. Paquetes
- ✅ Solo crear cotizaciones usando paquetes existentes
- ✅ Ver cotizaciones de su empresa

---

## 🚀 Instrucciones de Implementación

### **AHORA (Lo más urgente):**

1. **Ejecuta:** `ADD_MISSING_MODULES.sql` en Supabase
2. **Verifica:** Que tienes 10 módulos en total

```sql
SELECT COUNT(*) FROM pricing_items WHERE tipo = 'modulo';
-- Debe retornar: 10
```

### **Próximos Pasos:**

3. **Actualizar NuevaCotizacion.tsx** para cargar desde BD
4. **Crear submenú** en Sidebar
5. **Ajustar permisos** en PricingConfig

---

## 📝 Notas Importantes

- Los precios YA están en la BD con los rangos correctos
- Solo falta actualizar el wizard para leerlos dinámicamente
- Los permisos RLS ya están configurados correctamente
- El cálculo automático por DTEs funcionará cuando actualicemos el wizard

---

¿Quieres que implemente estos cambios ahora o prefieres hacerlo paso a paso?
