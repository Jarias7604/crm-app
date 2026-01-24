# 📋 Sistema de Configuración Dinámica de Precios

## ✅ Lo que se ha creado:

### 1. **Base de Datos**
- ✅ `CREATE_PRICING_CONFIG_TABLE.sql` - Tabla `pricing_items` con datos iniciales
- Almacena: Planes, Módulos, Servicios e Implementación
- Precios editables: anual, mensual, único, por DTE
- RLS configurado para seguridad multi-tenant

### 2. **Backend (Servicios)**
- ✅ `src/types/pricing.ts` - Tipos TypeScript
- ✅ `src/services/pricing.ts` - CRUD completo para pricing

### 3. **Frontend (UI)**
- ✅ `src/pages/PricingConfig.tsx` - Panel de administración
- Tabla con filtros por tipo
- Formulario inline para crear/editar
- Activar/desactivar ítems

### 4. **Integración**
- ✅ Ruta agregada: `/config/pricing`
- ✅ Sidebar actualizado (solo admins)
- ✅ Icono: Settings ⚙️

---

## 🚀 Instrucciones de Ejecución

### **PASO 1: Ejecutar Scripts SQL**

Ejecuta AMBOS scripts en Supabase (en este orden):

1. **Primero:** `CREATE_COTIZACIONES_TABLE.sql`
2. **Segundo:** `CREATE_PRICING_CONFIG_TABLE.sql`

**Cómo:**
- Abre [supabase.com](https://supabase.com) → Proyecto → SQL Editor
- Copia y pega cada script
- Click en "RUN"

---

### **PASO 2: Iniciar la Aplicación**

```bash
npm run dev
```

---

### **PASO 3: Probar el Sistema**

1. **Accede al Panel de Configuración:**
   - Login como Admin
   - Sidebar → **"Config. Precios"** ⚙️

2. **Gestiona los Precios:**
   - Verás los ítems precargados (planes BASIC, STARTER, PRO, etc.)
   - Puedes editar precios haciendo click en el ícono de lápiz
   - Agrega nuevos módulos con el botón "Nuevo Ítem"

3. **Crea una Cotización:**
   - Sidebar → **"Cotizaciones"** 💰
   - Click en "Nueva Cotización"
   - El wizard ahora cargará los precios desde la base de datos

---

## 🎯 Características Implementadas

### ✅ Tabla Dinámica de Precios
- Crear, editar, eliminar ítems
- Filtrar por tipo (Plan, Módulo, Servicio)
- Activar/desactivar sin eliminar
- Ordenamiento personalizado

### ✅ Precios Flexibles
- **Precio Anual** - Para licencias anuales
- **Precio Mensual** - Para pagos recurrentes
- **Costo Único** - Para servicios de una sola vez
- **Precio por DTE** - Para servicios como WhatsApp (0.025 por DTE)

### ✅ Rangos de DTEs (Solo Planes)
- `min_dtes` y `max_dtes`
- El wizard sugerirá el plan automáticamente

### ✅ Metadatos Personalizados
- Campo JSONB para características
- Iconos personalizados
- Información adicional

---

## 📊 Datos Precargados

Al ejecutar el script, se crearán automáticamente:

**Planes (4):**
- BASIC (0-500 DTEs) - $600/año
- STARTER (501-3000 DTEs) - $1,200/año
- PRO (3001-10000 DTEs) - $2,400/año
- ENTERPRISE (10001+) - $4,800/año

**Módulos (8):**
- POS - $360/año
- Cuentas por Cobrar - $300/año
- Comisiones - $240/año
- Compras - $300/año
- Producción - $480/año
- Inventario - $240/año
- Contabilidad - $480/año
- Nómina - $600/año

**Servicios (5):**
- Personalización de Tickets - $150 (único)
- Descarga Masiva JSON - $120/año
- Sucursal Adicional - $300/año
- Banner Publicitario - $60/año
- WhatsApp - $0.025 por DTE

**Implementación (1):**
- Costo Implementación - $50 (único)

---

## 🔧 Próximos Pasos (Opcional)

1. **Modificar wizard de cotizaciones** para usar `pricing_items` en lugar de datos hardcodeados
2. **Agregar validaciones** de permisos (solo admins pueden editar)
3. **Exportar/Importar** configuraciones entre empresas
4. **Histórico de precios** para auditoría

---

## ❓ Preguntas Frecuentes

**P: ¿Los precios son globales o por compañía?**
R: Pueden ser ambos. Si `company_id` es `NULL`, el ítem es global (visible por todos). Si tiene un `company_id`, solo esa empresa lo ve.

**P: ¿Cómo calculo el precio de WhatsApp?**
R: `volumen_dtes * 0.025`. Ejemplo: 3000 DTEs × $0.025 = $75

**P: ¿Puedo tener precios personalizados por cliente?**
R: Sí, en el wizard de cotización puedes editar los precios antes de guardar.

---

## 🎉 ¡Listo!

Tu sistema ahora tiene configuración de precios totalmente dinámica y editable.

**¿Necesitas ayuda?** Pregúntame cualquier duda.
