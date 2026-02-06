# Review of Marketing Engine Implementation

## 1. Current Architecture Overview

We have built a **Marketing Engine** that consists of three main layers:

### A. Frontend (React/TypeScript)
*   **`EmailCampaigns.tsx`**: Dashboard view listing campaigns.
*   **`EmailBuilder.tsx`**: Advanced creation wizard with audience preview.
*   **`RichTextEditor.tsx`**: WYSIWYG editor with smart buttons.
*   **`MarketingSettings.tsx`**: **FULLY IMPLEMENTED**. Allows configuration of:
    *   **Email**: Resend, Gmail, Outlook.
    *   **WhatsApp**: Meta Cloud API (Twilio disabled).
    *   **Telegram**: Bot API.
    *   **AI**: OpenAI.

### B. Service Layer
*   `campaignService`: Handles CRUD and media uploads.
*   `integrationService`: Manages saving API keys to `marketing_integrations`.

### C. Backend (Edge Function: `marketing-engine`)
*   **Email**: Correctly uses Resend integration.
*   **WhatsApp/Social**: **CRITICAL ISSUE FOUND**.
    *   The backend hardcodes logic to fetch `telegram` credentials even if the campaign type is `whatsapp`.
    *   It effectively routes "WhatsApp" campaigns to the Telegram Bot API.
    *   It does *not* currently use the 'Meta' integration settings saved by the frontend.


## 2. Key Observations & Status

### ✅ What is Working Well
1.  **Audience Targeting**: The parity between frontend preview and backend execution logic seems robust. The ability to filter by Status + Priority + Date is implemented in both places.
2.  **Rich Content**: The editor successfully handles creating complex HTML for emails, including media.
3.  **Resend Integration**: Standard implementation with fallback logic for API keys.
4.  **Direct Connect**: The flow to pass `specificIds` allows for very targeted micro-campaigns.

### ⚠️ Potential Issues / Areas for Clarification
1.  **WhatsApp Logic**: In `index.ts` lines 126-151, the code handles `whatsapp` type by sending to Telegram API:
    ```typescript
    if ((campaign.type === 'social' || campaign.type === 'whatsapp')) {
        // ... fetches telegram token ...
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, ...
    }
    ```
    *Is this intentional? (e.g., sending "WhatsApp" leads to a Telegram group for manual agent pickup?) or is this a placeholder for the actual WhatsApp Business API?*

2.  **Tracking Endpoint**: The email logic generates a tracking pixel URL:
    `${trackingBaseUrl}?type=open&mid=${messageId}`
    *We need to verify if the `tracking` Edge function (`/functions/v1/tracking`) exists and is implemented to handle these requests and update `marketing_messages`.*

3.  **Scheduling**: The UI shows `scheduled_at`, but the current execution logic is "Immediate Send". There is no cron/scheduling infrastructure visible in the reviewed files to pick up `scheduled` campaigns later.

## 3. Proposed Next Steps

1.  **Verify/Implement Tracking**: Ensure the pixel/click tracking endpoint exists to actually record the stats we are promising in the UI.
2.  **Clarify Social Integration**: Decide if we implement true WhatsApp Business API or stick with the Telegram bridge.

