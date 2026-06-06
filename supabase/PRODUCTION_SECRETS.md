# 🔐 Secretos de Producción - CRÍTICOS

## ⚠️ IMPORTANTE
Este archivo contiene secretos configurados en Supabase Edge Functions.
**NUNCA subir a git** - está en .gitignore

## 📋 Secretos Configurados

### Google Places API
```
GOOGLE_PLACES_API_KEY=AIzaSyC85B9gJA5QT6glExecwxttKlQYNZrteF8
```

**Usado por:**
- `search-businesses` Edge Function
- Marketing Hub → Lead Hunter

**Cómo verificar que está configurado:**
```bash
npx supabase secrets list --project-ref mtxqqamitglhehaktgxm
```

**Cómo configurarlo si falta:**
```bash
npx supabase secrets set GOOGLE_PLACES_API_KEY=AIzaSyC85B9gJA5QT6glExecwxttKlQYNZrteF8 --project-ref mtxqqamitglhehaktgxm
```

## ✅ Checklist ANTES de Deploy

- [ ] Verificar secretos: `npx supabase secrets list --project-ref mtxqqamitglhehaktgxm`
- [ ] Si falta alguno, configurar con comando de arriba
- [ ] Deploy function: `npx supabase functions deploy [nombre] --project-ref mtxqqamitglhehaktgxm`
- [ ] Verificar logs en Supabase Dashboard
- [ ] Probar manualmente en producción

## 🆘 Si algo deja de funcionar

1. Ejecutar: `npx supabase secrets list --project-ref mtxqqamitglhehaktgxm`
2. Si NO aparece `GOOGLE_PLACES_API_KEY`, ejecutar el comando de configuración de arriba
3. Redeploy: `npx supabase functions deploy search-businesses --project-ref mtxqqamitglhehaktgxm`
4. Probar en https://crm-app-v2.vercel.app/marketing/lead-hunter

---

**Última actualización:** 2026-02-06  
**Estado:** ✅ Configurado y funcionando
