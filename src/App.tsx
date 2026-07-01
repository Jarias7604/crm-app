import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import FeatureProtectedRoute from './components/FeatureProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { supabase } from './services/supabase';

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
const CatalogoProductos   = lazy(() => import('./pages/CatalogoProductos'));
const FinancialRules    = lazy(() => import('./pages/admin/FinancialRules'));
const LossReasons       = lazy(() => import('./pages/admin/LossReasons'));
const Industries        = lazy(() => import('./pages/admin/Industries'));
const CotizadorPro      = lazy(() => import('./pages/CotizadorPro'));
const CotizacionDetalle = lazy(() => import('./pages/CotizacionDetalle'));
const Branding          = lazy(() => import('./pages/company/Branding'));
const MarketingDashboard= lazy(() => import('./pages/marketing/MarketingDashboard'));
const LeadHunter        = lazy(() => import('./pages/marketing/LeadHunter'));
const EmailCampaigns    = lazy(() => import('./pages/marketing/EmailCampaigns'));
const CampaignBuilder   = lazy(() => import('./pages/marketing/CampaignBuilder'));
const CampaignReport    = lazy(() => import('./pages/marketing/CampaignReport'));
const AiAgentsConfig    = lazy(() => import('./pages/marketing/AiAgentsConfig'));
const FollowupSettings  = lazy(() => import('./pages/marketing/FollowupSettings'));
const SalesEngineConfig = lazy(() => import('./pages/marketing/SalesEngineConfig'));
const AiAgentCockpit    = lazy(() => import('./pages/marketing/AiAgentCockpit'));
const PredictiveBoard   = lazy(() => import('./pages/marketing/PredictiveBoard'));
const DataHygiene       = lazy(() => import('./pages/marketing/DataHygiene'));
const AgentNetworkMap   = lazy(() => import('./pages/marketing/AgentNetworkMap'));
const MarketingSettings = lazy(() => import('./pages/marketing/MarketingSettings'));
const ChatHub           = lazy(() => import('./pages/marketing/ChatHub'));
const PublicQuoteView   = lazy(() => import('./pages/PublicQuoteView'));
const PublicInvoiceView = lazy(() => import('./pages/PublicInvoiceView'));
const AuditLog          = lazy(() => import('./pages/admin/AuditLog'));
const Teams             = lazy(() => import('./pages/company/Teams'));
const TeamPerformance   = lazy(() => import('./pages/company/TeamPerformance'));
const Tickets           = lazy(() => import('./pages/support/Tickets'));
const OverdueTickets    = lazy(() => import('./pages/support/OverdueTickets'));
const Clientes          = lazy(() => import('./pages/clientes/Clientes'));
const ClientPortal      = lazy(() => import('./pages/clientes/ClientPortal'));
const ProjectManagement = lazy(() => import('./pages/ProjectManagement'));
const PipelineConfig    = lazy(() => import('./pages/admin/PipelineConfig'));
const CallBot           = lazy(() => import('./pages/admin/CallBot'));
const ManualPage        = lazy(() => import('./pages/support/ManualPage'));
const PWAInstallPrompt  = lazy(() => import('./components/PWAInstallPrompt').then(m => ({ default: m.PWAInstallPrompt })));
const FlyerStudio       = lazy(() => import('./pages/marketing/FlyerStudio'));
const TestFlyer         = lazy(() => import('./pages/marketing/TestFlyer'));
const SocialHub         = lazy(() => import('./pages/marketing/SocialHub'));
const AiCreditsAdmin    = lazy(() => import('./pages/marketing/AiCreditsAdmin'));
const SocialAccounts    = lazy(() => import('./pages/company/SocialAccounts'));
const MetaCallback      = lazy(() => import('./pages/company/MetaCallback'));
const Finanzas          = lazy(() => import('./pages/Finanzas'));
const GlobalSearch      = lazy(() => import('./components/GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const OnboardingWizard  = lazy(() => import('./pages/OnboardingWizard'));
const LandingPage       = lazy(() => import('./pages/public/LandingPage'));
const Observatory       = lazy(() => import('./pages/admin/Observatory'));
const Integrations      = lazy(() => import('./pages/company/Integrations'));
const Billing           = lazy(() => import('./pages/company/Billing'));
const GoogleCallback    = lazy(() => import('./pages/company/GoogleCallback'));
const OutlookCallback   = lazy(() => import('./pages/company/OutlookCallback'));
const Reports           = lazy(() => import('./pages/Reports'));
const PlanManager       = lazy(() => import('./pages/admin/PlanManager'));
const BillingManager    = lazy(() => import('./pages/admin/BillingManager'));
const BookingSettings   = lazy(() => import('./pages/calendar/BookingSettings'));
const PublicBookingPage = lazy(() => import('./pages/public/PublicBookingPage'));
const PrivacyPolicy     = lazy(() => import('./pages/public/PrivacyPolicy'));
const Workspaces        = lazy(() => import('./pages/company/Workspaces'));
const Facturas          = lazy(() => import('./pages/Facturas'));
const FacturaDetalle    = lazy(() => import('./pages/FacturaDetalle'));


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

// ─── New Admin Onboarding Guard ───────────────────────────────────────────────
// Redirects brand-new company_admins (created < 2h ago) to the onboarding wizard
// so they don't land on a blank dashboard. Skips super_admins and collaborators.
function NewAdminOnboardingGuard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // ⛔ super_admin NEVER goes to onboarding — they use Admin → Companies panel
    if (profile?.role !== 'company_admin') return;
    // Skip if already in onboarding
    if (location.pathname === '/onboarding') return;
    // Skip if simulating a company to prevent hijacking context
    if (localStorage.getItem('simulated_company_id')) return;

    // Skip if user has been around for more than 6 hours (not brand new)
    const createdAt = profile?.created_at ? new Date(profile.created_at).getTime() : 0;
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    if (createdAt < sixHoursAgo) return;

    // Check if company name has been set (indicates onboarding was completed)
    supabase
      .from('companies')
      .select('name, logo_url, industry, parent_company_id')
      .eq('id', profile.company_id)
      .single()
      .then(({ data }) => {
        // Skip onboarding if it's a child workspace or already has an industry set
        if (data?.parent_company_id) return;
        if (!data?.industry) {
          navigate('/onboarding', { replace: true });
        }
      });
  }, [profile, location.pathname]);

  return null;
}

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
            <NewAdminOnboardingGuard />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<SignUp />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/cotizaciones" element={<Cotizaciones />} />
                  <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
                  <Route path="/cotizaciones/nueva-pro" element={<CotizadorPro />} />
                  <Route path="/cotizaciones/:id/editar" element={<CotizadorPro />} />
                  <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/calendar/booking" element={<BookingSettings />} />

                  {/* Company & Config Routes (Admin only) */}
                  <Route element={<RoleProtectedRoute allowedRoles={['super_admin', 'company_admin']} />}>
                    <Route path="/company/team" element={<Team />} />
                    <Route path="/company/permissions" element={<Permissions />} />
                    <Route path="/company/branding" element={<Branding />} />
                    <Route path="/company/billing" element={<Billing />} />
                    <Route path="/company/teams" element={<Teams />} />
                    <Route path="/company/performance" element={<TeamPerformance />} />
                    <Route path="/company/workspaces" element={<Workspaces />} />
                    <Route path="/company/social-accounts" element={<SocialAccounts />} />
                    <Route path="/integrations/meta/callback" element={<MetaCallback />} />
                    <Route path="/catalogo" element={<CatalogoProductos />} />
                    <Route path="/pricing" element={<Navigate to="/catalogo" replace />} />
                    <Route path="/paquetes" element={<Navigate to="/catalogo" replace />} />
                    <Route path="/items" element={<Navigate to="/catalogo" replace />} />
                    <Route path="/financial-rules" element={<FinancialRules />} />
                    <Route path="/loss-reasons" element={<LossReasons />} />
                    <Route path="/industries" element={<Industries />} />
                    <Route path="/admin/pipeline" element={<PipelineConfig />} />
                    <Route path="/admin/call-bot" element={<CallBot />} />
                  </Route>

                  {/* System Admin Routes (Super Admin only) */}
                  <Route element={<RoleProtectedRoute allowedRoles={['super_admin']} />}>
                    <Route path="/admin/companies" element={<Companies />} />
                    <Route path="/admin/audit-log" element={<AuditLog />} />
                    <Route path="/admin/observatory" element={<Observatory />} />
                    <Route path="/admin/plans" element={<PlanManager />} />
                    <Route path="/admin/billing" element={<BillingManager />} />
                  </Route>

                  {/* Company Admin Routes */}
                  <Route element={<RoleProtectedRoute allowedRoles={['super_admin', 'company_admin']} />}>
                    <Route path="/company/integrations" element={<Integrations />} />
                    <Route path="/integrations/google/callback" element={<GoogleCallback />} />
                    <Route path="/integrations/outlook/callback" element={<OutlookCallback />} />
                  </Route>

                  {/* Reports (all authenticated) */}
                  <Route path="/reports" element={<Reports />} />

                  {/* Marketing Routes (Protected) */}
                  <Route element={<FeatureProtectedRoute feature="marketing" />}>
                    <Route path="/marketing" element={<MarketingDashboard />} />
                    <Route path="/marketing/lead-hunter" element={<LeadHunter />} />
                    <Route path="/marketing/email" element={<EmailCampaigns />} />
                    <Route path="/marketing/email/new" element={<Navigate to="/marketing/campaign/new" replace />} />
                    <Route path="/marketing/email/:id/edit" element={<CampaignBuilder />} />
                    <Route path="/marketing/campaign/new" element={<CampaignBuilder />} />
                    <Route path="/marketing/campaign/:id/edit" element={<CampaignBuilder />} />
                    <Route path="/marketing/campaign/:id/report" element={<CampaignReport />} />
                    <Route path="/marketing/ai-agents" element={<AiAgentsConfig />} />
                    <Route path="/marketing/cockpit" element={<AiAgentCockpit />} />
                    <Route path="/marketing/followup-settings" element={<FollowupSettings />} />
                    <Route path="/marketing/engine-config" element={<SalesEngineConfig />} />
                    <Route path="/marketing/settings" element={<MarketingSettings />} />
                    <Route path="/marketing/flyers" element={<FlyerStudio />} />
                    <Route path="/marketing/social" element={<SocialHub />} />
                    <Route path="/marketing/ai-credits" element={<AiCreditsAdmin />} />
                    <Route path="/marketing/predictions" element={<PredictiveBoard />} />
                    <Route path="/marketing/data-hygiene" element={<DataHygiene />} />
                    <Route path="/marketing/agent-network" element={<AgentNetworkMap />} />
                  </Route>

                  <Route element={<FeatureProtectedRoute feature="chat" />}>
                    <Route path="/marketing/chat" element={<ChatHub />} />
                  </Route>

                  {/* Clientes Module */}
                  <Route path="/clientes" element={<Clientes />} />

                  {/* Facturación Module */}
                  <Route element={<FeatureProtectedRoute feature="invoices" />}>
                    <Route path="/facturas" element={<Facturas />} />
                    <Route path="/facturas/:id" element={<FacturaDetalle />} />
                  </Route>

                  {/* Proyectos Module */}
                  <Route path="/proyectos" element={<ProjectManagement />} />

                  {/* Finanzas Module */}
                  <Route path="/finanzas" element={<Finanzas />} />

                  {/* Support Routes */}
                  <Route path="/support/tickets" element={<Tickets />} />
                  <Route path="/support/atrasados" element={<OverdueTickets />} />
                  <Route path="/onboarding" element={<OnboardingWizard />} />
                </Route>
              </Route>

              {/* Public routes (no auth required) */}
              <Route path="/test-flyer" element={<TestFlyer />} />
              <Route path="/propuesta/:id" element={<PublicQuoteView />} />
              <Route path="/factura/publica/:id" element={<PublicInvoiceView />} />
              <Route path="/portal/cliente/:token" element={<ClientPortal />} />
              <Route path="/book/:slug" element={<PublicBookingPage />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/support/manual" element={<ManualPage />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Suspense fallback={null}>
              <GlobalSearch />
            </Suspense>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
