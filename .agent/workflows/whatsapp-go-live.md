# Guía de Activación Final: Meta WhatsApp API

La infraestructura del CRM y la IA (Roger) están completamente integradas, probadas y funcionando en producción. 

Sigue estos **3 simples pasos** cuando tu cuenta RTSM de Meta esté desbloqueada y lista con tu número real (+503 7971 8911):

## PASO 1: Configurar Webhook en Meta
1. Ingresa a [developers.facebook.com](https://developers.facebook.com/)
2. Ve a tus **Apps** y selecciona tu App de WhatsApp (RTSM).
3. En el menú izquierdo, ve a **WhatsApp** -> **Configuración**.
4. Haz clic en **Editar Webhook** y coloca esta información precisa:
   - **URL de Devolución de Llamada (Callback URL):** 
     ```
     https://ikofyypxphrqkncimszt.supabase.co/functions/v1/meta-webhook?company_id=7a582ba5-f7d0-4ae3-9985-35788deb1c30
     ```
   - **Token de Verificación (Verify Token):**
     ```
     crm_secure_verify
     ```
5. Suscríbete al campo **Messages**.

## PASO 2: Obtener las nuevas Credenciales
Una vez con tu número real, Meta te dará dos valores nuevos:
1. El **Access Token** temporal o permanente (Asegúrate de generar un token permanente para no tener que cambiarlo).
2. El **ID del Número de Teléfono** (Phone Number ID) de tu número real de El Salvador.

## PASO 3: Actualizar Credenciales en el CRM
Contáctanos (o hazlo directo en base de datos) para actualizar las credenciales de WhatsApp en Producción.

El SQL exacto que ejecutaremos ese día será el siguiente:

```sql
UPDATE public.marketing_integrations 
SET settings = '{
  "wabaId": "111024181606819", 
  "accessToken": "[NUEVO_ACCESS_TOKEN]", 
  "phoneNumberId": "[NUEVO_PHONE_NUMBER_ID]", 
  "mode": "live"
}'::jsonb
WHERE company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
  AND provider = 'whatsapp';
```

---

¡Eso es todo!
Al hacer esto, tu sistema responderá de forma automática y las respuestas del bot llegarán exitosamente a los celulares de tus verdaderos clientes en lugar de ser bloqueadas por el sandbox de pruebas de Meta.
