import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';

/**
 * MetaCallback — handles OAuth redirect from Facebook/Meta
 * URL: /integrations/meta/callback?code=...&state=company_id
 * SaaS-ready: uses the logged-in user's company_id from session
 */
export default function MetaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Conectando con Meta...');
  const [accountsFound, setAccountsFound] = useState(0);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Acceso denegado por Facebook. Intenta de nuevo.');
      setTimeout(() => navigate('/company/social-accounts'), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No se recibió código de autorización.');
      setTimeout(() => navigate('/company/social-accounts'), 3000);
      return;
    }

    if (!profile?.company_id) return; // Wait for profile

    exchangeCode(code);
  }, [searchParams, profile?.company_id]);

  async function exchangeCode(code: string) {
    try {
      setMessage('Intercambiando código por tokens seguros...');
      const redirectUri = `${window.location.origin}/integrations/meta/callback`;

      const { data, error } = await supabase.functions.invoke('meta-oauth', {
        body: {
          code,
          redirect_uri: redirectUri,
          company_id: profile!.company_id,
        }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      setAccountsFound(data.accounts_connected || 0);
      setStatus('success');
      setMessage(`¡Conectado! Se encontraron ${data.pages_found} página(s) de Facebook y ${data.accounts_connected} cuenta(s) total.`);

      setTimeout(() => navigate('/company/social-accounts'), 2500);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error al conectar con Meta');
      setTimeout(() => navigate('/company/social-accounts'), 3500);
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ background: '#1e293b', borderRadius: 24, padding: 48, textAlign: 'center', maxWidth: 420, border: '1px solid rgba(255,255,255,0.08)' }}>
        {status === 'loading' && (
          <>
            <Loader2 size={48} color="#1877F2" className="animate-spin" style={{ margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>Conectando con Meta</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{message}</div>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginBottom: 8 }}>¡Conectado!</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{message}</div>
            <div style={{ marginTop: 16, fontSize: 12, color: '#475569' }}>Redirigiendo...</div>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} color="#ef4444" style={{ margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Error de conexión</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{message}</div>
          </>
        )}
      </div>
    </div>
  );
}
