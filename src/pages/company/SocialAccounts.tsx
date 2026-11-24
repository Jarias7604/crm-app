import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { socialPublishService, type SocialAccount } from '../../services/social/socialPublishService';
import { SocialConnectionsGrid } from '../../components/social/SocialBrandKit';

export default function SocialAccounts() {
    const { profile, simulatedCompanyId } = useAuth();
    const companyId = simulatedCompanyId || profile?.company_id || '';
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [settingDefault, setSettingDefault] = useState<string | null>(null);

    useEffect(() => {
        load();
    }, [companyId]);

    async function load() {
        setLoading(true);
        try {
            setAccounts(await socialPublishService.getAccounts());
        } catch (e) {
            console.error(e);
            toast.error('No se pudieron cargar las cuentas conectadas');
        } finally {
            setLoading(false);
        }
    }

    async function handleSetDefault(account: SocialAccount) {
        setSettingDefault(account.id);
        try {
            const same = accounts.filter(
                (a) => a.platform === account.platform && a.is_default && a.id !== account.id,
            );
            for (const a of same) {
                await socialPublishService.saveAccount({ ...a, is_default: false });
            }
            await socialPublishService.saveAccount({ ...account, is_default: true });
            toast.success(`${account.account_name} ahora es la cuenta principal`);
            load();
        } catch {
            toast.error('Error al actualizar la cuenta principal');
        } finally {
            setSettingDefault(null);
        }
    }

    async function handleDisconnect(account: SocialAccount) {
        if (!confirm(`¿Desconectar "${account.account_name}" de ${account.platform}?`)) return;
        try {
            await socialPublishService.disconnectAccount(account.id);
            toast.success('Cuenta desconectada');
            load();
        } catch {
            toast.error('Error al desconectar');
        }
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] py-7 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/marketing/social')}
                            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
                            title="Volver a Social Media Hub"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Social Media Hub · Conexiones
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                Gestionar conexiones de redes sociales
                            </h1>
                        </div>
                    </div>

                    <Link
                        to="/marketing/planning"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition"
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        Ir a Planning
                    </Link>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                    <SocialConnectionsGrid
                        accounts={accounts}
                        companyId={companyId}
                        loading={loading}
                        onRefresh={load}
                        onSetDefault={handleSetDefault}
                        onDisconnect={handleDisconnect}
                        settingDefaultId={settingDefault}
                    />
                </div>

                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                        <strong className="text-slate-900">Arquitectura Multi-Tenant aislada:</strong> cada empresa
                        conecta sus propias páginas con OAuth en 1 clic. Los tokens se guardan aislados por empresa (RLS)
                        y nunca se comparten entre organizaciones.
                    </p>
                </div>
            </div>
        </div>
    );
}
