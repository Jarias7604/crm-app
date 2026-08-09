import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * WAOAuthCallback — receives the OAuth code from Meta after WhatsApp Embedded Signup
 * This page is opened in a popup by WhatsAppEmbeddedConnect.
 * It sends the code back to the opener via postMessage and closes itself.
 */
export default function WAOAuthCallback() {
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state'); // company_id

        if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
                { type: 'WA_OAUTH_CALLBACK', code, error, state },
                '*'
            );
            setTimeout(() => window.close(), 500);
        } else {
            // Fallback: store in sessionStorage and redirect
            if (code) sessionStorage.setItem('wa_oauth_code', code);
            if (state) sessionStorage.setItem('wa_oauth_state', state);
            window.location.href = '/company/workspaces';
        }
    }, []);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100vh', background: '#f0fdf4',
            fontFamily: 'Inter, -apple-system, sans-serif', gap: 16
        }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <p style={{ fontWeight: 800, color: '#15803d', fontSize: 20, margin: 0 }}>
                ¡Autorización completada!
            </p>
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                Cerrando esta ventana y volviendo al CRM...
            </p>
        </div>
    );
}
