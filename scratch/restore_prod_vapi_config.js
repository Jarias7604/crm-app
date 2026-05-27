const TARGET_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const companies = [
  '7a582ba5-f7d0-4ae3-9985-35788deb1c30', // Arias Defense Components LLC El Salvador
  'ec88dff0-94a2-4544-ad2e-1f93a8163366'  // Ensivar S.A. de C.V.
];

const callBotConfig = {
  enabled: true,
  voice_engine: 'vapi',
  vapi_api_key: '15bc32d6-8c43-4f55-9e4a-5d7db558e2f5',
  vapi_assistant_id: 'e5b5aac9-5f4f-43b2-8079-6a296f2d5f6e',
  vapi_phone_id: 'fc4554b3-6774-4392-bbb8-faafc5c5f161',
  telnyx_api_key: 'KEY019D4A1A3D07A7ECC29724F60E1898DD_0OZ4Wm7sKcAQCS1x38kJOe',
  telnyx_connection_id: '2928628142903920631',
  telnyx_phone: '+13054885531',
  cartesia_api_key: '',
  cartesia_voice_id: '',
  wa_enabled: true,
  call_mode: 'manual'
};

async function restoreAll() {
  for (const companyId of companies) {
    console.log("\n===================================");
    console.log("Reading current features for company:", companyId);
    const getRes = await fetch(`${TARGET_URL}/rest/v1/companies?id=eq.${companyId}&select=features`, {
      headers: {
        'apikey': TARGET_KEY,
        'Authorization': `Bearer ${TARGET_KEY}`
      }
    });

    if (!getRes.ok) {
      console.error("Failed to read:", await getRes.text());
      continue;
    }

    const [company] = await getRes.json();
    if (!company) {
      console.error("Company not found in DB");
      continue;
    }
    console.log("Current features:", JSON.stringify(company.features, null, 2));

    const updatedFeatures = {
      ...company.features,
      call_bot: callBotConfig
    };

    console.log("Writing restored features object...");
    const patchRes = await fetch(`${TARGET_URL}/rest/v1/companies?id=eq.${companyId}`, {
      method: 'PATCH',
      headers: {
        'apikey': TARGET_KEY,
        'Authorization': `Bearer ${TARGET_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        features: updatedFeatures
      })
    });

    if (!patchRes.ok) {
      console.error("Failed to patch:", await patchRes.text());
    } else {
      console.log(`SUCCESS! Vapi credentials restored for company ${companyId}`);
    }
  }
}

restoreAll().catch(console.error);
