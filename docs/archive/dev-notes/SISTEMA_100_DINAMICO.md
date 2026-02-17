# 🎯 Sistema 100% Dinámico - Plan de Implementación

## ✅ Lo que Queremos Lograr:

### **Sistema Totalmente Configurable Sin Código**

1. ✅ **Precio base por DTE configurable**
2. ✅ **Crear planes desde cero en la UI**
3. ✅ **Modificar precios en tiempo real**
4. ✅ **Fórmulas de cálculo personalizadas**
5. ✅ **Todo editable desde el panel admin**

---

## 📋 Pasos para Implementar

### **PASO 1: Ejecutar SQL de Mejora (2 minutos)**

**Archivo:** `UPGRADE_PRICING_DINAMICO.sql`

**Qué hace:**
- Agrega columna `precio_base_dte` (precio por cada DTE)
- Agrega columna `formula_calculo` (fijo, por_dte, por_cantidad)
- Agrega columna `margen_ganancia` (porcentaje de margen)
- Agrega columna `mostrar_en_wizard` (control de visibilidad)
- Agrega columna `grupo` (para organizarlos por categorías)

**Cómo:**
1. Abre `UPGRADE_PRICING_DINAMICO.sql` en VS Code
2. Copia TODO el contenido
3. Supabase → SQL Editor → Pega → RUN

---

### **PASO 2: Actualizar Panel de Configuración**

El panel `PricingConfig.tsx` ahora permite editar:

**Campos Nuevos:**
- **Precio Base por DTE:** Define cuánto cuesta 1 DTE
- **Fórmula de Cálculo:**
  - `fijo`: Precio fijo independiente de DTEs
  - `por_dte`: Se multiplica por cantidad de DTEs
  - `por_cantidad`: Se multiplica por unidades
  - `personalizado`: Lógica custom
- **Margen de Ganancia:** % adicional sobre costo base
- **Mostrar en Wizard:** Si/No
- **Grupo:** Categoría (planes_principales, modulos_adicionales, etc.)

---

## 🎨 Flujo de Uso Final

### **Como Administrador:**

#### **1. Configurar Precio Base por DTE**

```
Config. Precios → Editar WhatsApp
─────────────────────────────────
Tipo: Servicio
Nombre: WhatsApp
Fórmula: por_dte
Precio Base DTE: $0.025
Mostrar en Wizard: ✓
```

Resultado: Cliente con 5,000 DTEs → $125 automático

---

#### **2. Crear un Plan Personalizado**

```
Config. Precios → Nuevo Ítem
─────────────────────────────────
Tipo: Plan
Nombre: PYME Plus
Rango DTEs: 1,000 - 5,000
Precio Anual: $1,800
Precio Mensual: $180
Implementación: $150
Fórmula: fijo
Margen: 20%
Grupo: planes_principales
```

Resultado: Plan aparece automáticamente en wizard

---

#### **3. Agregar Módulo con Precio Variable**

```
Config. Precios → Nuevo Ítem
─────────────────────────────────
Tipo: Módulo
Nombre: Licencias Adicionales
Fórmula: por_cantidad
Precio Unitario: $50/año
```

Resultado: Cliente selecciona 5 licencias → $250

---

### **Como Agente de Ventas:**

#### **Crear Cotización (100% Dinámico)**

**Paso 1 - Cliente:**
```
Nombre: Empresa XYZ
DTEs Estimados: 3,500
```

**Paso 2 - Plan:**
```
Sistema sugiere automáticamente:
✓ PYME Plus (1,000-5,000 DTEs) ⭐
  $1,800/año + $150 implementación
  
Otros disponibles:
  STARTER (501-3,000 DTEs)
  PRO (3,001-10,000 DTEs)
```

**Paso 3 - Módulos:**
```
☑ POS ($360/año)
☑ Ventas ($360/año)
☑ WhatsApp (3,500 × $0.025 = $87.50)
☐ Licencias Adicionales (× cantidad)
```

**Paso 4 - Resumen:**
```
Plan PYME Plus             $1,800
Implementación             $150
Margen 20%                 $390
Módulo POS                 $360
Módulo Ventas              $360
WhatsApp (3,500 DTEs)      $87.50
────────────────────────────────
TOTAL:                     $3,147.50/año
                           $262.29/mes
```

---

## 🚀 Ventajas del Sistema

### **1. Sin Código**
- ✅ Todo desde la interfaz
- ✅ Cambios instantáneos
- ✅ No requiere desarrollador

### **2. Flexibilidad Total**
- ✅ Precios fijos o variables
- ✅ Fórmulas personalizadas
- ✅ Márgenes configurables

### **3. Multi-Empresa**
- ✅ Planes globales (company_id = NULL)
- ✅ Planes custom por empresa
- ✅ Precios distintos por cliente

### **4. Escalable**
- ✅ Agrega planes sin límite
- ✅ Categoriza por grupos
- ✅ Control de visibilidad

---

## 📊 Ejemplos de Configuración

### **Ejemplo 1: Servicio con Precio por DTE**

```sql
INSERT INTO pricing_items VALUES (
    gen_random_uuid(),
    NULL, -- Global
    'servicio',
    'Envío Masivo Email',
    'Envío automático de DTEs por email',
    'SRV_EMAIL',
    0, -- precio_anual
    0, -- precio_mensual
    0, -- costo_unico
    NULL, -- min_dtes
    NULL, -- max_dtes
    0.01, -- precio_por_dte ($0.01 por DTE)
    0.01, -- precio_base_dte
    true, -- activo
    false, -- predeterminado
    10, -- orden
    'por_dte', -- formula_calculo
    0, -- margen_ganancia
    true, -- mostrar_en_wizard
    'servicios_extra', -- grupo
    '{}'::jsonb, -- metadata
    NOW(),
    NOW()
);
```

**Cálculo:** 10,000 DTEs × $0.01 = $100

---

### **Ejemplo 2: Plan con Margen de Ganancia**

```sql
-- Plan STARTER con margen del 25%
UPDATE pricing_items 
SET margen_ganancia = 25
WHERE nombre = 'STARTER';
```

**Cálculo:**
- Precio base: $1,200
- Margen 25%: +$300
- **Total: $1,500**

---

### **Ejemplo 3: Módulo por Cantidad**

```sql
INSERT INTO pricing_items VALUES (
    ...,
    'modulo',
    'Usuario Adicional',
    'Licencia adicional por usuario',
    'MOD_USER',
    60, -- $60/año por usuario
    6, -- $6/mes por usuario
    0,
    ...,
    'por_cantidad', -- Se multiplica por cantidad
    ...
);
```

**Cálculo:** 10 usuarios × $60 = $600/año

---

## ✅ Checklist de Implementación

### **Base de Datos:**
- [ ] Ejecutar `UPGRADE_PRICING_DINAMICO.sql`
- [ ] Verificar nuevas columnas: `precio_base_dte`, `formula_calculo`, etc.

### **Panel Admin:**
- [x] `PricingConfig.tsx` ya soporta edición
- [ ] Agregar campos nuevos al formulario (precio_base_dte, formula, etc.)

### **Wizard:**
- [x] `NuevaCotizacionDinamica.tsx` carga desde BD
- [ ] Usar `pricingService.calcularPrecioItem()` para cálculos
- [ ] Mostrar descripción del cálculo en desglose

### **Pruebas:**
- [ ] Crear plan con precio fijo
- [ ] Crear servicio con precio por DTE
- [ ] Crear módulo por cantidad
- [ ] Verificar cálculos en cotización

---

## 🎯 Próximo Paso Inmediato

**EJECUTA:**
```bash
# 1. SQL en Supabase
UPGRADE_PRICING_DINAMICO.sql

# 2. Verifica en la terminal
SELECT nombre, precio_anual, precio_base_dte, formula_calculo 
FROM pricing_items 
LIMIT 5;
```

Una vez ejecutado, el sistema estará **100% dinámico** y podrás:
- ✅ Configurar precios por DTE
- ✅ Elegir fórmulas de cálculo
- ✅ Crear planes personalizados
- ✅ Todo desde la interfaz

---

¿Ejecuto el SQL automáticamente o prefieres hacerlo manual en Supabase?
