import { StrictMode, Suspense, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import './i18n'

// ── Sentry Error Monitoring (Lightweight / Low-Overhead) ─────────────────────
// DSN is set in Vercel environment variables: VITE_SENTRY_DSN
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,           // 'production' | 'development'
  release: import.meta.env.VITE_APP_VERSION,  // optional: tag deploys
  enabled: import.meta.env.PROD,              // only active in production builds
  tracesSampleRate: 0.05,                     // lightweight 5% sampling to minimize JS execution overhead
  replaysOnErrorSampleRate: 0.1,              // reduced DOM replay overhead
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
});

import { queryClient } from './lib/queryClient';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app still works, just no offline support
    });
  });
}


const STALE_CHUNK_KEY = 'app_chunk_reload_attempted';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send all uncaught React errors to Sentry
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
      tags: {
        isStaleChunk: String(
          error.message?.includes('Failed to fetch dynamically imported module') ||
          error.message?.includes('Importing a module script failed') ||
          error.message?.includes('error loading dynamically imported module')
        )
      }
    });

    // Stale chunk auto-reload: happens when Vercel deploys while user has app open
    const isStaleChunk =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.message?.includes('error loading dynamically imported module');

    if (isStaleChunk) {
      const alreadyRetried = sessionStorage.getItem(STALE_CHUNK_KEY);
      if (!alreadyRetried) {
        sessionStorage.setItem(STALE_CHUNK_KEY, 'true');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem(STALE_CHUNK_KEY);
    window.location.reload();
  };

  handleHardReset = async () => {
    try {
      sessionStorage.clear();
      // Keep auth token to prevent logging the user out
      const keysToKeep = ['sb-ikofyypxphrqkncimszt-auth-token', 'supabase.auth.token'];
      const savedAuth: Record<string, string> = {};
      for (const k of keysToKeep) {
        const val = localStorage.getItem(k);
        if (val) savedAuth[k] = val;
      }
      localStorage.clear();
      for (const [k, v] of Object.entries(savedAuth)) {
        localStorage.setItem(k, v);
      }

      // Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // Clear Cache Storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch (e) {
      console.error('Error during hard reset:', e);
    }
    window.location.href = window.location.origin + window.location.pathname + '?fresh=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      const isStaleChunk =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed');

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', background: '#F8F9FD',
          fontFamily: 'Inter, -apple-system, sans-serif', padding: '24px', textAlign: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: '24px', padding: '48px 40px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.08)', maxWidth: '440px', width: '100%'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {isStaleChunk ? '🔄' : '⚠️'}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              {isStaleChunk ? 'Nueva versión disponible' : 'Algo salió mal'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.6 }}>
              {isStaleChunk
                ? 'El sistema fue actualizado. Recarga la página para continuar trabajando con la versión más reciente.'
                : 'Ocurrió un error inesperado. Por favor recarga la página o contacta al administrador si el problema persiste.'}
            </p>

            {this.state.error && (
              <details style={{ textAlign: 'left', margin: '0 0 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '11px', color: '#b91c1c' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#475569', outline: 'none' }}>
                  Detalles técnicos del error
                </summary>
                <div style={{ marginTop: '8px', wordBreak: 'break-all', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
                  {this.state.error.toString()}
                </div>
              </details>
            )}

            <button
              onClick={this.handleReload}
              style={{
                background: '#4449AA', color: 'white', border: 'none', borderRadius: '12px',
                padding: '12px 32px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                width: '100%', transition: 'opacity 0.2s', marginBottom: '10px'
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              Recargar ahora
            </button>
            <button
              onClick={this.handleHardReset}
              style={{
                background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px',
                padding: '10px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                width: '100%', transition: 'background 0.2s'
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
            >
              🔄 Limpiar caché y forzar actualización
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading Application...</div>}>
          <App />
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
