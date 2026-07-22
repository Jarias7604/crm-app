INSERT INTO public.marketing_integrations (company_id, provider, is_active, settings)
VALUES (
    '7a582ba5-f7d0-4ae3-9985-35788deb1c30',
    'whatsapp',
    true,
    '{"phoneNumberId":"1128590870346279","wabaId":"2216370055815946","token":null}'::jsonb
)
ON CONFLICT (company_id, provider) DO UPDATE 
    SET settings = EXCLUDED.settings, 
        is_active = true;

SELECT id, company_id, provider, is_active, settings 
FROM public.marketing_integrations 
WHERE company_id = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
