# ⚡ Leads Performance Upgrade Plan
**Creado:** 2026-02-20 00:12  
**Estado:** 🟡 Pendiente — implementar en próxima sesión

---

## Objetivo
Hacer el CRUD de Leads significativamente más rápido usando las mismas prácticas que HubSpot/Linear/Pipedrive:
- **Carga instantánea** al regresar a la página (caché)
- **Crear/editar sentido inmediato** (optimistic updates)
- **Lista viva sin recargar** (Supabase Realtime)

## Resultado esperado

| Escenario | Ahora | Después |
|-----------|-------|---------|
| Regresar a Leads | ~800ms spinner | ~0ms instantáneo |
| Crear lead | ~400ms + spinner | Inmediato |
| Otro usuario crea lead | ❌ no aparece | ✅ aparece solo |

---

## Pasos de implementación

### Paso 1 — Instalar TanStack Query
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### Paso 2 — Configurar QueryClient en `main.tsx`
Envolver la app con `QueryClientProvider`.

### Paso 3 — Migrar `Leads.tsx`
Reemplazar el patrón manual `useState + useEffect + setLoading` con:
```tsx
const { data: leads, isLoading } = useQuery({
  queryKey: ['leads'],
  queryFn: () => leadsService.getLeads(),
  staleTime: 2 * 60 * 1000,
  placeholderData: keepPreviousData
});
```

### Paso 4 — Optimistic Updates en crear/editar/eliminar leads
```tsx
const createMutation = useMutation({
  mutationFn: leadsService.createLead,
  onMutate: async (newLead) => {
    queryClient.setQueryData(['leads'], old => [tempLead, ...old]);
  },
  onError: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] })
});
```

### Paso 5 — Supabase Realtime
```tsx
useEffect(() => {
  const channel = supabase.channel('leads-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' },
      () => queryClient.invalidateQueries({ queryKey: ['leads'] })
    ).subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

### Paso 6 (Bonus) — Limpiar console.logs de producción en `leads.ts`
Eliminar los `console.log('🔍 Fetching ALL leads...')` que corren en producción.

---

## Archivos a modificar
- `src/main.tsx` — agregar QueryClientProvider
- `src/pages/Leads.tsx` — migrar a useQuery + useMutation + Realtime
- `src/services/leads.ts` — limpiar console.logs de producción

## NO cambiar
- `leadsService` (la lógica de Supabase queda igual)
- Ningún componente hijo de Leads
- Ninguna lógica de filtros existente

---

## Notas técnicas
- `staleTime: 2min` = muestra caché por 2 min antes de refetch en background
- `gcTime: 10min` = mantiene en memoria por 10 min aunque no esté en uso
- Los optimistic updates usan un ID temporal `temp-${Date.now()}` que se reemplaza al confirmar el servidor
- Supabase Realtime requiere que RLS esté configurado correctamente (ya está)
