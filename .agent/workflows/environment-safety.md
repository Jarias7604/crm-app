# 🛡️ Protocolo de Seguridad de Entornos — CRM Arias Defense

## Regla #1: Nunca configurar Vercel manualmente
Todas las variables de entorno de producción están documentadas aquí.
Cualquier cambio debe hacerse en git PRIMERO, luego en Vercel.

## Variables de Producción (crm-app-v2)
```
VITE_SUPABASE_URL=https://ikofyypxphrqkncimszt.supabase.co
VITE_SUPABASE_ANON_KEY=[ver Supabase Dashboard → Settings → API]
```

## Variables de DEV (solo local o preview branch)
```
VITE_SUPABASE_URL=https://mtxqqamitglhehaktgxm.supabase.co
VITE_SUPABASE_ANON_KEY=[ver Supabase Dashboard DEV → Settings → API]
```

## Regla #2: Lógica crítica = funciones de base de datos
- ✅ Reset de contraseñas → `admin_reset_user_password()` (RPC)
- ✅ Crear usuarios → `admin_create_user()` (RPC)
- ✅ Provisionar empresa → `provision_new_tenant()` (RPC)
- ❌ NUNCA depender de Edge Functions para operaciones administrativas críticas

## Regla #3: Checklist post-deploy obligatorio
Después de cada deploy a producción, verificar manualmente:
- [ ] Login funciona (usuario normal)
- [ ] Admin puede resetear contraseña desde Equipo
- [ ] Admin puede crear nuevo usuario
- [ ] Super admin puede crear nueva empresa
