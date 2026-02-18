# 💰 Modelo de Pricing — Costos Reales y Márgenes

> Fecha: 17 Febrero 2026

---

## 1. Costo de Infraestructura (fijo mensual)

| Componente | Servicio | Costo/mes | Nota |
|---|---|---|---|
| Base de datos + Auth + Storage | Supabase Pro | $25 | 8GB DB, 100GB storage |
| Hosting frontend | Vercel Pro | $20 | Build + CDN |
| Emails transaccionales | Resend | $0-20 | 3,000/mes free |
| Dominio + DNS | Cloudflare | ~$1 | Negligible |
| **Total fijo** | | **~$65/mes** | Independiente de usuarios |

---

## 2. Costo Variable por Usuario/mes

| Componente | Costo/usr/mes | Nota |
|---|---|---|
| Supabase (DB reads/writes) | ~$0.50 | Estimado por actividad |
| OpenAI API (AI agent) | ~$0.80-2.00 | Depende del uso del AI chat |
| Email delivery | ~$0.15 | ~50 emails/usr/mes |
| AssemblyAI (Meeting Intel) | ~$0.10-0.50 | Solo si activan la feature |
| **Total variable** | **~$1.50-3.00** | Por usuario activo |

---

## 3. Costo Total por Usuario según Volumen

| Usuarios activos | Costo fijo repartido | Costo variable/usr | Costo TOTAL/usr |
|---|---|---|---|
| 5 (1 empresa) | $13.00 | $1.50 | ~$14.50 |
| 10 (1-2 empresas) | $6.50 | $1.50 | ~$8.00 |
| 25 (3-5 empresas) | $2.60 | $1.50 | ~$4.10 |
| 50 (5-10 empresas) | $1.30 | $1.50 | ~$2.80 |
| 100 (10-20 empresas) | $0.65 | $1.50 | ~$2.15 |
| 500+ | $0.13 | $1.50 | ~$1.63 |

---

## 4. Planes Propuestos

| | Starter | Professional | Enterprise |
|---|---|---|---|
| **Precio venta** | **$15/usr/mes** | **$35/usr/mes** | **$65/usr/mes** |
| CRM completo | ✅ | ✅ | ✅ |
| Contactos ilimitados | ✅ | ✅ | ✅ |
| Pipelines ilimitados | ✅ | ✅ | ✅ |
| Email tracking | ✅ | ✅ | ✅ |
| Calendario integrado | ✅ | ✅ | ✅ |
| WhatsApp/Telegram | 1 canal | Multi-canal | Multi-canal |
| AI Chat Bot | ❌ | ✅ | ✅ |
| Cotizaciones AI | ❌ | ✅ | ✅ |
| Meeting Intelligence | ❌ | ✅ | ✅ |
| Lead Discovery AI | ❌ | ✅ | ✅ |
| Marketing Hub | Básico | Completo | Completo |
| Roles/Permisos | Básico | Completo | Avanzado |
| API access | ❌ | ✅ | ✅ |
| Soporte | Email | Chat prioritario | Dedicado |

---

## 5. Márgenes por Plan (base: 50 usuarios activos)

| Plan | Precio venta/usr | Tu costo/usr | Margen/usr | % Margen |
|---|---|---|---|---|
| Starter ($15) | $15 | $2.80 | $12.20 | 81% |
| Professional ($35) | $35 | $3.50 | $31.50 | 90% |
| Enterprise ($65) | $65 | $5.00 | $60.00 | 92% |

---

## 6. Proyección de Ingresos

| Escenario | Usuarios | Plan promedio | Ingreso/mes | Costo/mes | Ganancia/mes |
|---|---|---|---|---|---|
| 2 empresas chicas | 10 | $25 | $250 | $80 | $170 |
| 5 empresas medianas | 50 | $30 | $1,500 | $140 | $1,360 |
| 15 empresas | 150 | $35 | $5,250 | $290 | $4,960 |
| 50 empresas | 500 | $35 | $17,500 | $815 | $16,685 |

---

## 7. Notas Importantes

- Los costos de Supabase escalan por pasos — al superar 8GB DB o 100GB storage se necesita upgrade
- OpenAI puede reducir precios con el tiempo (histórico de reducciones anuales)
- El plan Starter debe ser rentable incluso con 5 usuarios (break-even point)
- Considerar descuentos anuales: pago anual = 2 meses gratis (equivalente a ~17% descuento)
