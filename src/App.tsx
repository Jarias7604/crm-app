import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

// Placeholders (Will replace with actual components)
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Calendar from './pages/Calendar';
import Companies from './pages/admin/Companies';
import Team from './pages/company/Team';
import Permissions from './pages/company/Permissions';
import Cotizaciones from './pages/Cotizaciones';
import NuevaCotizacion from './pages/NuevaCotizacionDinamica';
import PricingConfig from './pages/PricingConfig';
import GestionPaquetes from './pages/GestionPaquetes';
import GestionItems from './pages/GestionItems';
import CotizadorPro from './pages/CotizadorPro';
import CotizacionDetalle from './pages/CotizacionDetalle';
import Branding from './pages/company/Branding';
import MarketingDashboard from './pages/marketing/MarketingDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" reverseOrder={false} />
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
              <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
              <Route path="/cotizaciones/:id/editar" element={<CotizadorPro />} />
              <Route path="/config/pricing" element={<PricingConfig />} />
              <Route path="/config/paquetes" element={<GestionPaquetes />} />
              <Route path="/config/items" element={<GestionItems />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/admin/companies" element={<Companies />} />
              <Route path="/company/team" element={<Team />} />
              <Route path="/company/permissions" element={<Permissions />} />
              <Route path="/config/branding" element={<Branding />} />
              <Route path="/marketing" element={<MarketingDashboard />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
