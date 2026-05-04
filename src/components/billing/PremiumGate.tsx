import React from 'react';
import { Zap, Lock, ArrowRight } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';

interface PremiumGateProps {
  /** Minimum plan required to access this feature */
  requiredPlan: 'starter' | 'pro' | 'enterprise';
  /** Feature name shown in the upgrade prompt */
  featureName: string;
  /** Description of what the user unlocks */
  description?: string;
  /** Children to render when access is granted */
  children: React.ReactNode;
  /** Instead of blocking, show a blurred overlay with upgrade CTA */
  mode?: 'block' | 'blur';
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'indigo',
  pro: 'purple',
  enterprise: 'slate',
};

export function PremiumGate({
  requiredPlan,
  featureName,
  description,
  children,
  mode = 'block',
}: PremiumGateProps) {
  const { hasFeature, loading, isSuperAdmin } = useSubscription();

  // While loading, render children (avoid flashing the gate on fast plans)
  if (loading || isSuperAdmin) return <>{children}</>;

  const hasAccess = hasFeature(requiredPlan);

  if (hasAccess) return <>{children}</>;

  const planLabel = PLAN_LABELS[requiredPlan] ?? 'Pro';
  const colorPrefix = PLAN_COLORS[requiredPlan] ?? 'purple';

  // Tailwind class mappings since we can't fully construct dynamic tailwind classes safely in all bundlers
  const gradients: Record<string, string> = {
    indigo: 'from-indigo-50 to-indigo-100/50 border-indigo-200',
    purple: 'from-purple-50 to-purple-100/50 border-purple-200',
    slate: 'from-slate-100 to-slate-200/50 border-slate-300',
  };
  
  const iconBgs: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
    purple: 'bg-purple-100 text-purple-600 border-purple-200',
    slate: 'bg-slate-200 text-slate-800 border-slate-300',
  };

  const badgeBgs: Record<string, string> = {
    indigo: 'bg-indigo-100/50 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-100/50 border-purple-200 text-purple-700',
    slate: 'bg-slate-200/50 border-slate-300 text-slate-800',
  };

  const buttonBgs: Record<string, string> = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20',
    purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20',
    slate: 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20',
  };

  const UpgradeCard = () => (
    <div className={`flex flex-col items-center justify-center p-12 rounded-[2.5rem] bg-gradient-to-br ${gradients[colorPrefix]} border backdrop-blur-xl text-center max-w-lg mx-auto my-10 shadow-2xl shadow-slate-200/50 animate-in zoom-in-95 duration-500`}>
      {/* Icon */}
      <div className={`w-16 h-16 rounded-[1.2rem] border flex items-center justify-center mb-6 ${iconBgs[colorPrefix]} shadow-inner`}>
        <Lock className="w-8 h-8" />
      </div>

      {/* Plan badge */}
      <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border mb-4 font-black uppercase tracking-wider text-[10px] ${badgeBgs[colorPrefix]}`}>
        <Zap className="w-3.5 h-3.5" />
        Plan {planLabel} Requerido
      </div>

      {/* Feature name */}
      <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
        {featureName}
      </h3>

      {/* Description */}
      <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed max-w-sm">
        {description ?? `Esta función está disponible en el plan ${planLabel} y superiores. Actualiza tu plan para desbloquearla.`}
      </p>

      {/* CTA Button */}
      <a
        href="/billing/upgrade"
        className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white font-black shadow-lg transition-all hover:-translate-y-0.5 ${buttonBgs[colorPrefix]}`}
      >
        <Zap className="w-4 h-4" />
        Actualizar a {planLabel}
        <ArrowRight className="w-4 h-4" />
      </a>

      <p className="text-xs font-bold text-slate-400 mt-5 uppercase tracking-wider">
        Sin contratos. Cancela cuando quieras.
      </p>
    </div>
  );

  // Blur mode: show children blurred with overlay CTA
  if (mode === 'blur') {
    return (
      <div className="relative group">
        <div className="blur-md opacity-40 pointer-events-none select-none transition-all duration-500 group-hover:blur-lg">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
          <UpgradeCard />
        </div>
      </div>
    );
  }

  return <UpgradeCard />;
}
