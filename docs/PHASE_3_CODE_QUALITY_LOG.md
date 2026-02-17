# Fase 3: Code Quality & Technical Debt — Log de Cambios
**Fecha inicio**: 2026-02-17  
**Estado**: ✅ COMPLETADA  

---

## Diagnóstico Inicial (Feb 17, 2026)

| Problema | Cantidad | Riesgo | Fix |
|:---|:---:|:---:|:---:|
| Funciones duplicadas `admin_create_user` | 5 overloads → 1 | Medio | ✅ FIX 3.1 |
| Funciones huérfanas (one-time fixes) | 3 scripts | Bajo | ✅ FIX 3.3 |
| Indexes sin uso (DB) | 5 | Bajo | ✅ FIX 3.2 |
| Archivos .sql sueltos en raíz | 88 | Bajo | ✅ FIX 3.4 |
| Archivos .md sueltos en raíz | 39 (excl README) | Bajo | ✅ FIX 3.4 |
| Archivos de debug/junk en raíz | 12 | Bajo | ✅ FIX 3.4 |
| Archivos TSX >50KB (monolitos) | 6 archivos | Alto | ⏳ Requiere sesión dedicada |
| Multiple permissive policies | ~60 alertas WARN | Medio | ⏳ Pendiente para Fase 4+ |

---

## Cambios Aplicados

### ✅ FIX 3.1: Limpiar funciones duplicadas `admin_create_user` (DB)
- **Fase**: 3 - Code Quality
- **Tipo**: Database migration
- **Migration name**: `cleanup_duplicate_admin_create_user`
- **Qué se hizo**: Se eliminaron 4 overloads obsoletos. Se mantuvo el overload completo (9 params con `new_role text`)
- **Overloads eliminados**:
  - `(text, text, text, text, uuid, text)` — 6 params, sin custom_role/birth_date/address
  - `(text, text, text, text, text, uuid, uuid)` — 7 params, sin birth_date/address
  - `(text, text, text, text, uuid, text, uuid, date, text)` — args desordenados (full_name antes de role)
  - `(text, text, app_role, text, text, uuid, uuid, date, text)` — tipo app_role en vez de text
- **Verificación**: Frontend compila, único overload confirmado
- **Rollback**: Recrear las funciones con CREATE OR REPLACE

### ✅ FIX 3.2: Eliminar indexes sin uso (DB)
- **Fase**: 3 - Code Quality
- **Tipo**: Database migration  
- **Migration name**: `cleanup_unused_indexes`
- **Indexes eliminados** (todos con 0 scans):
  - `idx_templates_global` (marketing_templates)
  - `idx_items_company` (cotizador_items)
  - `idx_items_activo` (cotizador_items)
  - `idx_cotizaciones_estado` (cotizaciones)
  - `idx_leads_lost_stage` (leads)
- **Rollback**:
  ```sql
  CREATE INDEX idx_templates_global ON marketing_templates(is_global);
  CREATE INDEX idx_items_company ON cotizador_items(company_id);
  CREATE INDEX idx_items_activo ON cotizador_items(activo);
  CREATE INDEX idx_cotizaciones_estado ON cotizaciones(estado);
  CREATE INDEX idx_leads_lost_stage ON leads(lost_stage);
  ```

### ✅ FIX 3.3: Eliminar funciones huérfanas (DB)
- **Fase**: 3 - Code Quality
- **Tipo**: Database migration
- **Migration name**: `cleanup_orphaned_fix_functions`
- **Funciones eliminadas**:
  - `agent_fix_diana_v2()` — one-time fix para usuario específico
  - `fix_broken_user(text, text)` — script de emergencia
  - `fix_my_admin_account()` — script de emergencia
- **Verificación**: Ninguna era usada por frontend, triggers, RLS policies, u otras funciones
- **Funciones conservadas (no usadas por frontend pero podrían necesitarse)**:
  - `admin_update_user` — recién creada/fixeada, posible uso futuro
  - `toggle_user_status` — utility para activar/desactivar usuarios
  - `check_is_super_admin` — helper internal
  - `is_super_admin` — usado históricamente

### ✅ FIX 3.4: Organizar directorio raíz (Filesystem)
- **Fase**: 3 - Code Quality
- **Tipo**: Filesystem cleanup
- **Qué se hizo**:
  - Creada estructura `docs/archive/sql-scripts/` y `docs/archive/dev-notes/`
  - Movidos 88 archivos .sql a `docs/archive/sql-scripts/`
  - Movidos 39 archivos .md (excl README.md) a `docs/archive/dev-notes/`
  - Movidos 12 archivos de debug/junk a `docs/archive/dev-notes/`
- **Resultado**: Root limpio con 14 archivos legítimos (configs + README)
- **Rollback**: Mover archivos de vuelta desde `docs/archive/`

---

## Verificaciones Post-Fase 3

| Check | Estado |
|:---|:---:|
| TypeScript compila sin errores | ✅ |
| Security Advisor: 0 issues | ✅ |
| Dev server funciona | ✅ |
| DB functions operativas | ✅ |

---

## Items Pendientes para Sesiones Futuras

1. **Refactoring de monolitos TSX** (ALTO RIESGO - requiere sesión dedicada):
   - `Leads.tsx` (191KB) → Split en ~10 componentes
   - `CotizadorPro.tsx` (99KB) → Split en ~6 componentes
   - `Dashboard.tsx` (85KB) → Split en ~5 componentes
   - `ChatHub.tsx` (65KB), `CampaignBuilder.tsx` (59KB), etc.

2. **Consolidar multiple permissive policies** (~60 alertas WARN):
   - Muchas tablas tienen "Super admin ALL" + specific role policies
   - Consolidar en policies únicas con lógica OR

3. **Funciones helper duplicadas** (bajo riesgo):
   - `get_my_company_id` y `get_my_company_v4` son idénticas
   - `is_super_admin` y `is_super_admin_v4` son similares
   - `get_auth_role` vs `get_my_role` (JWT vs DB lookup)
