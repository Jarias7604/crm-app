# 🔒 ARCHIVOS PROTEGIDOS - NO MODIFICAR

## Versión Estable: `v1.0.0-cotizaciones-estable`

Esta documentación protege los archivos críticos del sistema de cotizaciones.
Estos archivos fueron probados exhaustivamente y están funcionando correctamente en producción.

---

## ⚠️ ARCHIVOS CRÍTICOS - REQUIEREN APROBACIÓN PARA MODIFICAR

### 1. `src/pages/CotizacionDetalle.tsx`
**Función**: Vista web de detalle de cotización con desglose transparente
- Cuadro de Pago Inicial
- Cuadro de Pago Recurrente
- Cálculos financieros

### 2. `src/pages/PublicQuoteView.tsx`
**Función**: Vista pública/móvil para clientes (link compartido por AI)
- Desglose detallado igual que la web
- Firma digital
- Descarga de PDF

### 3. `src/services/pdfService.ts`
**Función**: Generación del PDF oficial de cotización
- Layout dinámico para evitar superposición
- Desglose detallado en cuadros
- Términos y condiciones

### 4. `src/utils/quoteUtils.ts`
**Función**: Cálculos financieros centralizados
- `calculateQuoteFinancialsV2()` - FUENTE DE VERDAD para todos los cálculos
- Financiamiento, IVA, cuotas, etc.

---

## 🔄 CÓMO RESTAURAR SI ALGO SE ROMPE

Si algún cambio futuro rompe el sistema, restaurar a esta versión:

```bash
# Ver el estado estable
git show v1.0.0-cotizaciones-estable

# Restaurar un archivo específico
git checkout v1.0.0-cotizaciones-estable -- src/pages/CotizacionDetalle.tsx

# Restaurar todos los archivos protegidos
git checkout v1.0.0-cotizaciones-estable -- src/pages/CotizacionDetalle.tsx src/pages/PublicQuoteView.tsx src/services/pdfService.ts src/utils/quoteUtils.ts
```

---

## 📋 PROCESO PARA SOLICITAR CAMBIOS

1. **Describir el cambio** - ¿Qué se quiere modificar y por qué?
2. **Impacto** - ¿Afecta la visualización o los cálculos?
3. **Pruebas** - Verificar en desarrollo antes de producción
4. **Backup** - Crear nuevo tag antes de modificar

---

## 📅 Historial de Versiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| v1.0.0-cotizaciones-estable | 2026-02-03 | Sistema de cotizaciones con desglose transparente |

---

**Última actualización**: 2026-02-03
**Responsable**: Jimmy Arias
