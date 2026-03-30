import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthProvider';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import FeatureProtectedRoute from './components/FeatureProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Auth pages (not lazy — needed immediately on first visit)
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import UpdatePassword from './pages/UpdatePassword';

// ─── Lazy loaded pages ────────────────────────────────────────────────────────
// Each page is downloaded only when visited → faster first load
const Dashboard         = lazy(() => import('./pages/Dashboard'));
const Leads             = lazy(() => import('./pages/Leads'));
const Calendar          = lazy(() => import('./pages/Calendar'));
const Companies         = lazy(() => import('./pages/admin/Companies'));
const Team              = lazy(() => import('./pages/company/Team'));
const Permissions       = lazy(() => import('./pages/company/Permissions'));
const Cotizaciones      = lazy(() => import('./pages/Cotizaciones'));
const NuevaCotizacion   = lazy(() => import('./pages/NuevaCotizacionDinamica'));
const PricingConfig     = lazy(() => import('./pages/PricingConfig'));
const FinancialRules    = lazy(() => import('./pages/admin/FinancialRules'));
const LossReasons       = lazy(() => import('./pages/admin/LossReasons'));
const Industries        = lazy(() => import('./pages/admin/Industries'));
const GestionPaquetes   = lazy(() => import('./pages/GestionPaquetes'));
const GestionItems      = lazy(() => import('./pages/GestionItems'));
const CotizadorPro      = lazy(() => import('./pages/CotizadorPro'));
const CotizacionDetalle = lazy(() => import('./pages/CotizacionDetalle'));
const Branding          = lazy(() => import('./pages/company/Branding'));
const MarketingDashboard= lazy(() => import('./pages/marketing/MarketingDashboard'));
const LeadHunter        = lazy(() => import('./pages/marketing/LeadHunter'));
const EmailCampaigns    = lazy(() => import('./pages/marketing/EmailCampaigns'));
const CampaignBuilder   = lazy(() => import('./pages/marketing/CampaignBuilder'));
const AiAgentsConfig    = lazy(() => import('./pages/marketing/AiAgentsConfig'));
const MarketingSettings = lazy(() => import('./pages/marketing/MarketingSettings'));
const ChatHub           = lazy(() => import('./pages/marketing/ChatHub'));
const PublicQuoteView   = lazy(() => import('./pages/PublicQuoteView'));
const AuditLog          = lazy(() => import('./pages/admin/AuditLog'));
const Teams             = lazy(() => import('./pages/company/Teams'));
const TeamPerformance   = lazy(() => import('./pages/company/TeamPerformance'));
const Tickets           = lazy(() => import('./pages/support/Tickets'));
const OverdueTickets    = lazy(() => import('./pages/support/OverdueTickets'));
const Clientes          = lazy(() => import('./pages/clientes/Clientes'));
const ClientPortal      = lazy(() => import('./pages/clientes/ClientPortal'));
const PipelineConfig    = lazy(() => import('./pages/admin/PipelineConfig'));
const ManualPage        = lazy(() => import('./pages/support/ManualPage'));
const HelpChat          = lazy(() => import('./components/HelpChat/HelpChat'));
const PWAInstallPrompt  = lazy(() => import('./components/PWAInstallPrompt').then(m => ({ default: m.PWAInstallPrompt })));

// ─── Skeleton Screen (técnica Netflix) ───────────────────────────────────────
// Muestra estructura visual inmediatamente mientras carga el JS del módulo.
// El usuario percibe la app como más rápida porque ve "contenido" de inmediato.
const PageSkeleton = () => (
  <div className="flex h-screen bg-gray-50 overflow-hidden">
    {/* Sidebar */}
    <div className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 p-4 gap-3 shrink-0">
      <div className="h-10 w-32 bg-gray-200 rounded-xl animate-pulse mb-4" />
      {[80, 65, 72, 58, 70, 60, 55].map((w, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-5 h-5 bg-gray-200 rounded-lg animate-pulse shrink-0" />
          <div className="h-3.5 bg-gray-200 rounded-full animate-pulse" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
    {/* Main */}
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 shrink-0">
        <div className="h-6 w-40 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex-1" />
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
      </div>
      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
              <div className="h-3 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-7 w-20 bg-gray-200 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="h-12 border-b border-gray-100 px-6 flex items-center gap-3">
            <div className="h-4 w-32 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1" />
            <div className="h-8 w-24 bg-gray-200 rounded-xl animate-pulse" />
          </div>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-14 border-b border-gray-50 px-6 flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse shrink-0" />
              <div className="h-3.5 bg-gray-200 rounded-full animate-pulse" style={{ width: `${30 + (i * 11) % 45}%` }} />
              <div className="flex-1" />
              <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language) {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" reverseOrder={false} />
          <Suspense fallback={null}>
            <PWAInstallPrompt />
          </Suspense>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<SignUp />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/cotizaciones" element={<Cotizaciones />} />
                  <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
                  <Route path="/cotizaciones/nueva-pro" element={<CotizadorPro />} />
                  <Route path="/cotizaciones/:id/editar" element={<CotizadorPro />} />
                  <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
                  <Route path="/calendar" element={<Calendar />} />

                  {/* Company & Config Routes (Admin only) */}
                  <Route element={<RoleProtectedRoute allowedRoles={['super_admin', 'company_admin']} />}>
                    <Route path="/company/team" element={<Team />} />
                    <Route path="/company/permissions" element={<Permissions />} />
                    <Route path="/company/branding" element={<Branding />} />
                    <Route path="/company/teams" element={<Teams />} />
                    <Route path="/company/performance" element={<TeamPerformance />} />
                    <Route path="/pricing" element={<PricingConfig />} />
                    <Route path="/financial-rules" element={<FinancialRules />} />
                    <Route path="/loss-reasons" element={<LossReasons />} />
                    <Route path="/industries" element={<Industries />} />
                    <Route path="/paquetes" element={<GestionPaquetes />} />
                    <Route path="/items" element={<GestionItems />} />
                    <Route path="/admin/pipeline" element={<PipelineConfig />} />
                  </Route>

                  {/* System Admin Routes (Super Admin only) */}
                  <Route element={<RoleProtectedRoute allowedRoles={['super_admin']} />}>
                    <Route path="/admin/companies" element={<Companies />} />
                    <Route path="/admin/audit-log" element={<AuditLog />} />
                  </Route>

                  {/* Marketing Routes (Protected) */}
                  <Route element={<FeatureProtectedRoute feature="marketing" />}>
                    <Route path="/marketing" element={<MarketingDashboard />} />
                    <Route path="/marketing/lead-hunter" element={<LeadHunter />} />
                    <Route path="/marketing/email" element={<EmailCampaigns />} />
                    <Route path="/marketing/email/new" element={<Navigate to="/marketing/campaign/new" replace />} />
                    <Route path="/marketing/email/:id/edit" element={<CampaignBuilder />} />
                    <Route path="/marketing/campaign/new" element={<CampaignBuilder />} />
                    <Route path="/marketing/campaign/:id/edit" element={<CampaignBuilder />} />
                    <Route path="/marketing/ai-agents" element={<AiAgentsConfig />} />
                    <Route path="/marketing/settings" element={<MarketingSettings />} />
                  </Route>

                  <Route element={<FeatureProtectedRoute feature="chat" />}>
                    <Route path="/marketing/chat" element={<ChatHub />} />
                  </Route>

                  {/* Clientes Module */}
                  <Route path="/clientes" element={<Clientes />} />

                  {/* Support Routes */}
                  <Route path="/support/tickets" element={<Tickets />} />
                  <Route path="/support/atrasados" element={<OverdueTickets />} />
                </Route>
              </Route>

              {/* Public routes (no auth required) */}
              <Route path="/propuesta/:id" element={<PublicQuoteView />} />
              <Route path="/portal/cliente/:token" element={<ClientPortal />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/support/manual" element={<ManualPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Suspense fallback={null}>
              <HelpChat />
            </Suspense>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
