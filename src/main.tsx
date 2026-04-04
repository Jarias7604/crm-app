import { StrictMode, Suspense, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import './i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
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
    console.error("Uncaught error:", error, errorInfo);

    // Detectar "stale chunk" — ocurre cuando Vercel hace deploy mientras
    // un usuario tiene la app abierta. Los hashes de los chunks cambian
    // y el browser falla al cargar el módulo antiguo. Solución: recargar una vez.
    const isStaleChunk =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.message?.includes('error loading dynamically imported module');

    if (isStaleChunk) {
      const alreadyRetried = sessionStorage.getItem(STALE_CHUNK_KEY);
      if (!alreadyRetried) {
        sessionStorage.setItem(STALE_CHUNK_KEY, 'true');
        // Recarga forzada limpiando caché del browser
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem(STALE_CHUNK_KEY);
    window.location.reload();
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
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 28px', lineHeight: 1.6 }}>
              {isStaleChunk
                ? 'El sistema fue actualizado. Recarga la página para continuar trabajando con la versión más reciente.'
                : 'Ocurrió un error inesperado. Por favor recarga la página o contacta al administrador si el problema persiste.'}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: '#4449AA', color: 'white', border: 'none', borderRadius: '12px',
                padding: '12px 32px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                width: '100%', transition: 'opacity 0.2s'
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              Recargar ahora
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
