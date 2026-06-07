import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  CreditCard,
  Building,
  FileText,
  DollarSign,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowUpDown,
  Filter,
  Calendar,
  Layers,
  X,
  TrendingUp,
  Clock,
  Sparkles,
  HelpCircle,
  Coins
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_annual: number;
}

interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  plan_id: string;
}

interface CompanyWithSub {
  id: string;
  name: string;
  license_status: string;
  created_at: string;
  company_subscriptions: Subscription[];
}

interface Invoice {
  id: string;
  company_id: string;
  subscription_id: string | null;
  invoice_number: string;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'refunded' | 'void';
  plan_slug: string | null;
  plan_name: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  issued_at: string;
  paid_at: string | null;
  due_at: string | null;
  stripe_hosted_url: string | null;
  pdf_url: string | null;
  companies: {
    name: string;
  } | null;
}

export default function BillingManager() {
  const [companies, setCompanies] = useState<CompanyWithSub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Modals state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Edit Subscription Form
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithSub | null>(null);
  const [subForm, setSubForm] = useState({
    planId: '',
    status: 'active',
    billingCycle: 'monthly',
    trialEndsAt: '',
    periodStart: '',
    periodEnd: '',
  });

  // Manual Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    companyId: '',
    amount: '',
    status: 'pending' as Invoice['status'],
    planSlug: '',
    planName: '',
    billingPeriodStart: '',
    billingPeriodEnd: '',
    issuedAt: format(new Date(), 'yyyy-MM-dd'),
    dueAt: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    invoiceNumber: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load plans
      const { data: plansData, error: plansErr } = await supabase
        .from('saas_plans')
        .select('id, name, slug, price_monthly, price_annual');
      if (plansErr) throw plansErr;
      setPlans(plansData || []);

      // 2. Load companies and their subscriptions
      const { data: cosData, error: cosErr } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          license_status,
          created_at,
          company_subscriptions (
            id,
            status,
            billing_cycle,
            trial_ends_at,
            current_period_start,
            current_period_end,
            plan_id
          )
        `);
      if (cosErr) throw cosErr;
      setCompanies((cosData as any) || []);

      // 3. Load invoices
      const { data: invsData, error: invsErr } = await supabase
        .from('saas_invoices')
        .select(`
          *,
          companies (
            name
          )
        `)
        .order('issued_at', { ascending: false });
      if (invsErr) throw invsErr;
      setInvoices((invsData as any) || []);
    } catch (err: any) {
      console.error('Error loading billing manager data:', err);
      toast.error('Error al cargar la información financiera: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // MRR & Revenue statistics
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  const activeSubscriptionsCount = companies.filter(
    c => c.company_subscriptions?.[0]?.status === 'active' || c.license_status === 'active'
  ).length;

  const trialSubscriptionsCount = companies.filter(
    c => c.company_subscriptions?.[0]?.status === 'trial' || c.license_status === 'trial'
  ).length;

  const pendingRevenue = invoices
    .filter(inv => inv.status === 'pending')
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  // Edit subscription modal trigger
  const handleEditSubscription = (company: CompanyWithSub) => {
    const sub = company.company_subscriptions?.[0];
    setSelectedCompany(company);
    setSubForm({
      planId: sub?.plan_id || plans[0]?.id || '',
      status: sub?.status || company.license_status || 'active',
      billingCycle: sub?.billing_cycle || 'monthly',
      trialEndsAt: sub?.trial_ends_at ? format(new Date(sub.trial_ends_at), 'yyyy-MM-dd') : '',
      periodStart: sub?.current_period_start ? format(new Date(sub.current_period_start), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      periodEnd: sub?.current_period_end ? format(new Date(sub.current_period_end), 'yyyy-MM-dd') : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    });
    setIsSubModalOpen(true);
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const sub = selectedCompany.company_subscriptions?.[0];
      const subData = {
        company_id: selectedCompany.id,
        plan_id: subForm.planId,
        status: subForm.status,
        billing_cycle: subForm.billingCycle,
        current_period_start: subForm.periodStart ? new Date(subForm.periodStart).toISOString() : null,
        current_period_end: subForm.periodEnd ? new Date(subForm.periodEnd).toISOString() : null,
        trial_ends_at: subForm.trialEndsAt ? new Date(subForm.trialEndsAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (sub?.id) {
        // Update
        const { error: err } = await supabase
          .from('company_subscriptions')
          .update(subData)
          .eq('id', sub.id);
        error = err;
      } else {
        // Insert
        const { error: err } = await supabase
          .from('company_subscriptions')
          .insert(subData);
        error = err;
      }
      if (error) throw error;

      // Update license status on company table for complete parity
      const { error: coError } = await supabase
        .from('companies')
        .update({ license_status: subForm.status })
        .eq('id', selectedCompany.id);
      if (coError) throw coError;

      toast.success('🎉 Suscripción actualizada correctamente');
      setIsSubModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar la suscripción: ' + err.message);
    }
  };

  // Generate invoice number automatically
  const suggestInvoiceNumber = (companyId: string) => {
    const co = companies.find(c => c.id === companyId);
    if (!co) return '';
    const prefix = co.name.substring(0, 3).toUpperCase();
    const count = invoices.filter(inv => inv.company_id === companyId).length + 1;
    return `INV-${format(new Date(), 'yyyy')}-${prefix}-${String(count).padStart(3, '0')}`;
  };

  const handleOpenManualInvoice = () => {
    const firstCompany = companies[0]?.id || '';
    setInvoiceForm({
      companyId: firstCompany,
      amount: '',
      status: 'pending',
      planSlug: plans[0]?.slug || '',
      planName: plans[0]?.name || '',
      billingPeriodStart: format(new Date(), 'yyyy-MM-dd'),
      billingPeriodEnd: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      issuedAt: format(new Date(), 'yyyy-MM-dd'),
      dueAt: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      invoiceNumber: suggestInvoiceNumber(firstCompany),
    });
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.companyId || !invoiceForm.amount || !invoiceForm.invoiceNumber) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    try {
      const co = companies.find(c => c.id === invoiceForm.companyId);
      const sub = co?.company_subscriptions?.[0];

      const invoiceData = {
        company_id: invoiceForm.companyId,
        subscription_id: sub?.id || null,
        invoice_number: invoiceForm.invoiceNumber,
        amount: Number(invoiceForm.amount),
        currency: 'usd',
        status: invoiceForm.status,
        plan_name: invoiceForm.planName || null,
        plan_slug: invoiceForm.planSlug || null,
        billing_period_start: invoiceForm.billingPeriodStart ? new Date(invoiceForm.billingPeriodStart).toISOString() : null,
        billing_period_end: invoiceForm.billingPeriodEnd ? new Date(invoiceForm.billingPeriodEnd).toISOString() : null,
        issued_at: new Date(invoiceForm.issuedAt).toISOString(),
        due_at: new Date(invoiceForm.dueAt).toISOString(),
        paid_at: invoiceForm.status === 'paid' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('saas_invoices')
        .insert(invoiceData);
      if (error) throw error;

      toast.success('🎉 Factura manual registrada correctamente');
      setIsInvoiceModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al registrar factura: ' + err.message);
    }
  };

  // Change invoice status on the fly
  const handleUpdateInvoiceStatus = async (invoiceId: string, status: Invoice['status']) => {
    try {
      const { error } = await supabase
        .from('saas_invoices')
        .update({
          status,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', invoiceId);
      if (error) throw error;

      toast.success(`Factura actualizada a ${status.toUpperCase()}`);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al actualizar factura: ' + err.message);
    }
  };

  // Filter and Sort tables
  const filteredCompanies = companies.filter(co => {
    const matchesSearch = co.name.toLowerCase().includes(searchTerm.toLowerCase());
    const sub = co.company_subscriptions?.[0];
    const status = sub?.status || co.license_status || 'inactive';
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesPlan = planFilter === 'all' || (sub && plans.find(p => p.id === sub.plan_id)?.slug === planFilter);
    return matchesSearch && matchesStatus && matchesPlan;
  }).sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let valA = a[key] ?? '';
    let valB = b[key] ?? '';
    if (key === 'plan') {
      valA = plans.find(p => p.id === a.company_subscriptions?.[0]?.plan_id)?.name || 'Sin plan';
      valB = plans.find(p => p.id === b.company_subscriptions?.[0]?.plan_id)?.name || 'Sin plan';
    } else if (key === 'status') {
      valA = a.company_subscriptions?.[0]?.status || a.license_status || 'inactive';
      valB = b.company_subscriptions?.[0]?.status || b.license_status || 'inactive';
    }
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredInvoices = invoices.filter(inv => {
    const coName = inv.companies?.name || '';
    const num = inv.invoice_number || '';
    const matchesSearch = coName.toLowerCase().includes(searchTerm.toLowerCase()) || num.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return 'bg-emerald-100/80 text-emerald-800 border-emerald-200/50';
      case 'trial':
      case 'pending':
        return 'bg-blue-100/80 text-blue-800 border-blue-200/50';
      case 'expired':
      case 'failed':
        return 'bg-rose-100/80 text-rose-800 border-rose-200/50';
      case 'manual_hold':
      case 'void':
        return 'bg-amber-100/80 text-amber-800 border-amber-200/50';
      default:
        return 'bg-slate-100/80 text-slate-800 border-slate-200/50';
    }
  };

  const getPlanBadge = (slug: string | null) => {
    switch (slug) {
      case 'starter': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'pro': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'enterprise': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <Clock className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Cargando base financiera...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-500">
      
      {/* Premium Dashboard Header & KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* KPI 1: Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-100/50 relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest">Ingresos Totales (SaaS)</p>
              <h3 className="text-3xl font-black mt-2">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-black uppercase">Cobro Exitoso</span>
            <span className="text-[10px] text-emerald-100 font-bold">Inscripción facturada</span>
          </div>
        </div>

        {/* KPI 2: Active Subscriptions */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-100/50 relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">Suscripciones Activas</p>
              <h3 className="text-3xl font-black mt-2">{activeSubscriptionsCount} Empresas</h3>
            </div>
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-black uppercase">MRR Estable</span>
            <span className="text-[10px] text-indigo-100 font-bold">Clientes con plan contratado</span>
          </div>
        </div>

        {/* KPI 3: Trial Accounts */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-100/50 relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest">Periodos de Prueba</p>
              <h3 className="text-3xl font-black mt-2">{trialSubscriptionsCount} Cuentas</h3>
            </div>
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-black uppercase">Lead Pipeline</span>
            <span className="text-[10px] text-blue-100 font-bold">Clientes potenciales</span>
          </div>
        </div>

        {/* KPI 4: Pending Overdues */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-[2rem] p-6 text-white shadow-xl shadow-amber-100/50 relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 text-[10px] font-black uppercase tracking-widest">Pendiente de Cobro</p>
              <h3 className="text-3xl font-black mt-2">${pendingRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-black uppercase">Facturas Pendientes</span>
            <span className="text-[10px] text-amber-100 font-bold">Por cobrar este mes</span>
          </div>
        </div>

      </div>

      {/* Main Tab Controls & Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-slate-100/60 p-1.5 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => { setActiveTab('subscriptions'); setSearchTerm(''); }}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'subscriptions'
              ? 'bg-[#4449AA] text-white shadow-lg shadow-indigo-100'
              : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Suscripciones
          </button>
          <button
            onClick={() => { setActiveTab('invoices'); setSearchTerm(''); }}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'invoices'
              ? 'bg-[#4449AA] text-white shadow-lg shadow-indigo-100'
              : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Facturas
          </button>
        </div>

        {/* Context Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="relative flex-1 md:w-64 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'subscriptions' ? 'Buscar empresa...' : 'Empresa o factura...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-xs"
            />
          </div>

          {activeTab === 'subscriptions' ? (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="all">Suscripción: Todos</option>
                <option value="active">🟢 Activas</option>
                <option value="trial">🔵 Prueba</option>
                <option value="expired">🔴 Expiradas</option>
                <option value="manual_hold">🟠 Retenidas</option>
              </select>

              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="all">Plan: Todos</option>
                {plans.map(p => (
                  <option key={p.id} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </>
          ) : (
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="all">Facturas: Todas</option>
              <option value="paid">🟢 Pagadas</option>
              <option value="pending">🔵 Pendientes</option>
              <option value="failed">🔴 Fallidas</option>
              <option value="void">🟠 Anuladas</option>
            </select>
          )}

          {activeTab === 'invoices' && (
            <Button
              onClick={handleOpenManualInvoice}
              className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 rounded-xl shadow-lg shadow-emerald-50 border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Facturar
            </Button>
          )}

        </div>

      </div>

      {/* Main Tables Content */}
      <div className="bg-white shadow-2xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden border border-slate-200/50">
        
        {activeTab === 'subscriptions' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa / Tenant</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Contratado</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ciclo</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Límite / Renovación</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCompanies.map(co => {
                  const sub = co.company_subscriptions?.[0];
                  const currentPlan = plans.find(p => p.id === sub?.plan_id);
                  const status = sub?.status || co.license_status || 'inactive';
                  
                  return (
                    <tr key={co.id} className="hover:bg-slate-50/40 transition-all duration-200 group">
                      
                      {/* Company name */}
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-indigo-50/50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100/30 group-hover:scale-105 transition-transform">
                            <Building className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 leading-none mb-1">{co.name}</div>
                            <span className="text-[9px] text-slate-400 font-mono tracking-tighter">ID: {co.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Plan details */}
                      <td className="px-8 py-5">
                        {currentPlan ? (
                          <div className="flex flex-col gap-1">
                            <span className={`px-2.5 py-0.5 inline-flex w-fit text-[9px] font-black uppercase tracking-wider rounded border ${getPlanBadge(currentPlan.slug)}`}>
                              {currentPlan.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              ${sub?.billing_cycle === 'annual' ? `${currentPlan.price_annual}/año` : `${currentPlan.price_monthly}/mes`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic uppercase">Sin suscripción activa</span>
                        )}
                      </td>

                      {/* Billing cycle */}
                      <td className="px-8 py-5 whitespace-nowrap">
                        {sub?.billing_cycle ? (
                          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            {sub.billing_cycle === 'annual' ? '🗓️ Anual' : '⏱️ Mensual'}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Subscription status */}
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-[9px] font-black uppercase tracking-wider rounded-full border ${getStatusBadge(status)}`}>
                          {status}
                        </span>
                      </td>

                      {/* Renewal/Trial end period */}
                      <td className="px-8 py-5">
                        {status === 'trial' && sub?.trial_ends_at ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-blue-600 font-black">Prueba vence</span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {format(new Date(sub.trial_ends_at), 'dd MMM yyyy')}
                            </span>
                          </div>
                        ) : sub?.current_period_end ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-700 font-black">Renueva</span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {format(new Date(sub.current_period_end), 'dd MMM yyyy')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-bold uppercase">Sin registros</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-8 py-5 text-center">
                        <Button
                          onClick={() => handleEditSubscription(co)}
                          className="h-9 px-4 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-none"
                        >
                          Modificar
                        </Button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Factura / Número</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Facturado</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Pago</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/40 transition-all duration-200 group">
                    
                    {/* Invoice number */}
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 border border-slate-100 transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900 leading-none mb-1">{inv.invoice_number}</div>
                          <span className="text-[10px] text-slate-400 font-bold">Emitido: {format(new Date(inv.issued_at), 'dd/MM/yyyy')}</span>
                        </div>
                      </div>
                    </td>

                    {/* Company name */}
                    <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-slate-800">
                      {inv.companies?.name || 'Cliente Desconocido'}
                    </td>

                    {/* Amount */}
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-black text-slate-900">${Number(inv.amount).toFixed(2)} USD</div>
                    </td>

                    {/* Snapshot plan info */}
                    <td className="px-8 py-5 whitespace-nowrap">
                      {inv.plan_name ? (
                        <span className={`px-2.5 py-0.5 inline-flex text-[9px] font-black uppercase tracking-wider rounded border ${getPlanBadge(inv.plan_slug)}`}>
                          {inv.plan_name}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Date paid or due date */}
                    <td className="px-8 py-5 whitespace-nowrap text-xs text-slate-500 font-bold">
                      {inv.status === 'paid' && inv.paid_at ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-emerald-600 font-black">Pagado el</span>
                          <span>{format(new Date(inv.paid_at), 'dd MMM yyyy')}</span>
                        </div>
                      ) : inv.due_at ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-rose-600 font-black">Vence el</span>
                          <span>{format(new Date(inv.due_at), 'dd MMM yyyy')}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Invoice status */}
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-[9px] font-black uppercase tracking-wider rounded-full border ${getStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>

                    {/* Quick status change toggler */}
                    <td className="px-8 py-5 text-center">
                      <div className="flex justify-center gap-1">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => handleUpdateInvoiceStatus(inv.id, 'paid')}
                            title="Marcar como PAGADA"
                            className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateInvoiceStatus(inv.id, 'failed')}
                            title="Marcar como FALLIDA"
                            className="p-2 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {inv.stripe_hosted_url && (
                          <a
                            href={inv.stripe_hosted_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center"
                          >
                            <CreditCard className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty States */}
        {((activeTab === 'subscriptions' && filteredCompanies.length === 0) ||
          (activeTab === 'invoices' && filteredInvoices.length === 0)) && (
          <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
            <HelpCircle className="w-12 h-12 text-slate-200" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No se encontraron registros</p>
            <p className="text-xs text-slate-300">Intenta cambiar la búsqueda o los filtros seleccionados.</p>
          </div>
        )}

      </div>

      {/* Modal 1: Modify Company Subscription */}
      <Modal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        title="Modificar Configuración de Suscripción"
        className="max-w-md"
      >
        {selectedCompany && (
          <form onSubmit={handleSaveSubscription} className="space-y-5">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Empresa Seleccionada</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                <Building className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-black text-slate-800">{selectedCompany.name}</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Plan Contratado</label>
              <select
                value={subForm.planId}
                onChange={(e) => setSubForm({ ...subForm, planId: e.target.value })}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-xs"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (${p.price_monthly}/mes)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ciclo Facturación</label>
                <select
                  value={subForm.billingCycle}
                  onChange={(e) => setSubForm({ ...subForm, billingCycle: e.target.value })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-xs"
                >
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estado Licencia</label>
                <select
                  value={subForm.status}
                  onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-xs"
                >
                  <option value="active">Activa</option>
                  <option value="trial">Periodo de Prueba</option>
                  <option value="expired">Expirada / Impaga</option>
                  <option value="manual_hold">Retención Manual</option>
                </select>
              </div>
            </div>

            {subForm.status === 'trial' ? (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vencimiento Prueba</label>
                <Input
                  type="date"
                  value={subForm.trialEndsAt}
                  onChange={(e) => setSubForm({ ...subForm, trialEndsAt: e.target.value })}
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Inicio Periodo</label>
                  <Input
                    type="date"
                    value={subForm.periodStart}
                    onChange={(e) => setSubForm({ ...subForm, periodStart: e.target.value })}
                    className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fin Periodo</label>
                  <Input
                    type="date"
                    value={subForm.periodEnd}
                    onChange={(e) => setSubForm({ ...subForm, periodEnd: e.target.value })}
                    className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-xl px-5 py-2.5 font-bold border border-slate-100 text-xs shadow-none"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#4449AA] hover:bg-[#3b3f94] text-white font-black rounded-xl px-6 py-2.5 text-xs shadow-lg shadow-indigo-100"
              >
                Guardar Cambios
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 2: Create Manual Invoice */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title="Registrar Factura Manual"
        className="max-w-lg"
      >
        <form onSubmit={handleSaveInvoice} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Empresa Cliente</label>
              <select
                value={invoiceForm.companyId}
                onChange={(e) => {
                  setInvoiceForm(prev => ({
                    ...prev,
                    companyId: e.target.value,
                    invoiceNumber: suggestInvoiceNumber(e.target.value),
                  }));
                }}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-xs"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Número de Factura</label>
              <Input
                required
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                placeholder="INV-YYYY-XXX-001"
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs font-black"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Monto (USD)</label>
              <Input
                type="number"
                step="0.01"
                required
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                placeholder="0.00"
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs font-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estado de Pago</label>
              <select
                value={invoiceForm.status}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as any })}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-xs"
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Pagada</option>
                <option value="failed">Fallida</option>
                <option value="void">Anulada</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Plan Relacionado</label>
              <select
                value={invoiceForm.planSlug}
                onChange={(e) => {
                  const p = plans.find(pl => pl.slug === e.target.value);
                  setInvoiceForm({
                    ...invoiceForm,
                    planSlug: e.target.value,
                    planName: p?.name || '',
                    amount: p ? String(p.price_monthly) : invoiceForm.amount,
                  });
                }}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-xs"
              >
                <option value="">Ninguno</option>
                {plans.map(p => (
                  <option key={p.id} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ciclo Plan</label>
              <input
                type="text"
                disabled
                value={invoiceForm.planSlug ? 'Mensual (Cargado)' : 'Libre'}
                className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Inicio Facturación</label>
              <Input
                type="date"
                value={invoiceForm.billingPeriodStart}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, billingPeriodStart: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fin Facturación</label>
              <Input
                type="date"
                value={invoiceForm.billingPeriodEnd}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, billingPeriodEnd: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fecha de Emisión</label>
              <Input
                type="date"
                value={invoiceForm.issuedAt}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, issuedAt: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fecha de Vencimiento</label>
              <Input
                type="date"
                value={invoiceForm.dueAt}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, dueAt: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              onClick={() => setIsInvoiceModalOpen(false)}
              className="bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-xl px-5 py-2.5 font-bold border border-slate-100 text-xs shadow-none"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl px-6 py-2.5 text-xs shadow-lg shadow-emerald-50"
            >
              Registrar Factura
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
