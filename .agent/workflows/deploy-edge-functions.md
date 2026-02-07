---
description: How to deploy Supabase Edge Functions safely without breaking production
---

# ⚠️ CRITICAL: Edge Function Deployment Rules

## NEVER use `npx supabase functions deploy` directly
It resets `verify_jwt` to `true` by default, which BREAKS functions that need public access.

## ALWAYS use MCP `deploy_edge_function` with correct `verify_jwt` setting

## Edge Function Registry (MASTER LIST)

| Function | verify_jwt | Secrets Required |
|----------|-----------|-----------------|
| search-businesses | **false** | GOOGLE_PLACES_API_KEY |
| telegram-webhook | **false** | TELEGRAM_BOT_TOKEN |
| send-telegram-message | **false** | TELEGRAM_BOT_TOKEN |
| ai-chat | **true** | - |
| ai-chat-processor | **false** | OPENAI_API_KEY |
| meta-webhook | **false** | META_VERIFY_TOKEN |
| setup-telegram | **false** | - |
| send-whatsapp-message | **false** | WHATSAPP_TOKEN |
| process-message-queue | **false** | - |
| marketing-engine | **false** | RESEND_API_KEY |
| tracking | **false** | - |

## Deployment Steps

// turbo-all

1. Read the function source code from `supabase/functions/[name]/index.ts`
2. Check this registry for the correct `verify_jwt` value
3. Deploy using MCP `deploy_edge_function` with the EXACT `verify_jwt` from the registry
4. Verify logs show 200 status (NOT 401)
5. If 401 appears, the function was deployed with wrong verify_jwt - FIX IMMEDIATELY

## Post-Deploy Verification

After ANY edge function deploy, check logs:
```
mcp_supabase-mcp-server_get_logs(project_id: "ikofyypxphrqkncimszt", service: "edge-function")
```

If you see `401` status codes → you broke verify_jwt → redeploy with correct setting.

## Secrets

Project ID: ikofyypxphrqkncimszt

To verify secrets are configured:
```bash
npx supabase secrets list --project-ref ikofyypxphrqkncimszt
```

To set a missing secret:
```bash
npx supabase secrets set KEY=VALUE --project-ref ikofyypxphrqkncimszt
```
