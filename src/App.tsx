import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthProvider';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import FeatureProtectedRoute from './components/FeatureProtectedRoute';
import { Toaster } from 'react-hot-toast';

// Auth pages (not lazy loaded - needed immediately)
import Login from './pages/Login';
import SignUp from './pages/SignUp';

// Lazy loaded pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Companies = lazy(() => import('./pages/admin/Companies'));
const Team = lazy(() => import('./pages/company/Team'));
const Permissions = lazy(() => import('./pages/company/Permissions'));
const Cotizaciones = lazy(() => import('./pages/Cotizaciones'));
const NuevaCotizacion = lazy(() => import('./pages/NuevaCotizacionDinamica'));
const PricingConfig = lazy(() => import('./pages/PricingConfig'));
const FinancialRules = lazy(() => import('./pages/admin/FinancialRules'));
const LossReasons = lazy(() => import('./pages/admin/LossReasons'));
const GestionPaquetes = lazy(() => import('./pages/GestionPaquetes'));
const GestionItems = lazy(() => import('./pages/GestionItems'));
const CotizadorPro = lazy(() => import('./pages/CotizadorPro'));
const CotizacionDetalle = lazy(() => import('./pages/CotizacionDetalle'));
const Branding = lazy(() => import('./pages/company/Branding'));
const MarketingDashboard = lazy(() => import('./pages/marketing/MarketingDashboard'));
const LeadHunter = lazy(() => import('./pages/marketing/LeadHunter'));
const EmailCampaigns = lazy(() => import('./pages/marketing/EmailCampaigns'));
const EmailBuilder = lazy(() => import('./pages/marketing/EmailBuilder'));
const CampaignBuilder = lazy(() => import('./pages/marketing/CampaignBuilder'));
const AiAgentsConfig = lazy(() => import('./pages/marketing/AiAgentsConfig'));
const MarketingSettings = lazy(() => import('./pages/marketing/MarketingSettings'));
const ChatHub = lazy(() => import('./pages/marketing/ChatHub'));
const PublicQuoteView = lazy(() => import('./pages/PublicQuoteView'));

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<SignUp />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Dashboard />} />
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
                    <Route path="/pricing" element={<PricingConfig />} />
                    <Route path="/financial-rules" element={<FinancialRules />} />
                    <Route path="/loss-reasons" element={<LossReasons />} />
                    <Route path="/paquetes" element={<GestionPaquetes />} />
                    <Route path="/items" element={<GestionItems />} />
                  </Route>

                  {/* System Admin Routes (Super Admin only) */}
                  <Route element={<RoleProtectedRoute allowedRoles={['super_admin']} />}>
                    <Route path="/admin/companies" element={<Companies />} />
                  </Route>

                  {/* Marketing Routes (Protected) */}
                  <Route element={<FeatureProtectedRoute feature="marketing" />}>
                    <Route path="/marketing" element={<MarketingDashboard />} />
                    <Route path="/marketing/lead-hunter" element={<LeadHunter />} />
                    <Route path="/marketing/email" element={<EmailCampaigns />} />

                    {/* Unified Campaign Routes */}
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
                </Route>
              </Route>

              {/* Public Proposal Page (No Auth Required) */}
              <Route path="/propuesta/:id" element={<PublicQuoteView />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
