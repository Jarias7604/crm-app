import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, Loader2, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { socialPlanningService } from '../../services/social/socialPlanningService';

export default function ChatGptAuthorize() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { profile, loading: authLoading } = useAuth();

    const clientId = searchParams.get('client_id') || 'chatgpt';
    const redirectUri = searchParams.get('redirect_uri') || '';
    const state = searchParams.get('state') || '';
    const codeChallenge = searchParams.get('code_challenge') || '';
    const codeChallengeMethod = searchParams.get('code_challenge_method') || '';

    const [companyName, setCompanyName] = useState<string>('');
    const [flagEnabled, setFlagEnabled] = useState<boolean | null>(null);
    const [authorizing, setAuthorizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValidRedirect = useMemo(() => {
        if (!redirectUri) return false;
        try {
            const u = new URL(redirectUri);
            return u.protocol === 'https:';
        } catch {
            return false;
        }
    }, [redirectUri]);

    useEffect(() => {
        if (!profile?.company_id) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('companies')
                .select('name, features')
                .eq('id', profile.company_id)
                .maybeSingle();
            if (!cancelled) {
                setCompanyName(data?.name || 'Tu Empresa CRM');
                setFlagEnabled(Boolean((data?.features as any)?.ai_content_studio_enabled));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [profile?.company_id]);

    const handleAuthorize = async () => {
        if (!profile?.company_id || !isValidRedirect) return;
        setAuthorizing(true);
        setError(null);
        try {
            const res = await socialPlanningService.issueOAuthCode(
                profile.company_id,
                clientId,
                redirectUri,
                codeChallenge || null,
                codeChallengeMethod || null,
            );
            const target = new URL(redirectUri);
            target.searchParams.set('code', res.code);
            if (state) target.searchParams.set('state', state);
            window.location.href = target.toString();
        } catch (err: any) {
            setError(err?.message || 'No se pudo generar el código de autorización.');
            setAuthorizing(false);
        }
    };

    const handleDeny = () => {
        if (isValidRedirect) {
            const target = new URL(redirectUri);
            target.searchParams.set('error', 'access_denied');
            if (state) target.searchParams.set('state', state);
            window.location.href = target.toString();
        } else {
            navigate('/marketing/planning');
        }
    };

    if (authLoading || (profile?.company_id && flagEnabled === null)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="flex items-center gap-3 text-slate-600 text-sm font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin text-[#4449AA]" />
                    <span>Verificando sesión en Arias CRM…</span>
                </div>
            </div>
        );
    }

    if (!isValidRedirect) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-center space-y-3 shadow-sm">
                    <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
                    <h1 className="text-lg font-bold text-slate-900">Solicitud OAuth inválida</h1>
                    <p className="text-xs text-slate-500">
                        Falta un <code>redirect_uri</code> HTTPS válido desde ChatGPT.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4449AA]">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#4449AA]">
                            Arias CRM · Social Planning
                        </p>
                        <h1 className="text-lg font-bold text-slate-900">Conectar tu cuenta con ChatGPT</h1>
                    </div>
                </div>

                {!profile ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-slate-700 space-y-3 text-center">
                        <div className="font-bold text-slate-900">Inicia sesión en Arias CRM para continuar</div>
                        <p>
                            Para vincular ChatGPT con tu empresa, primero inicia sesión con tu cuenta autorizada en
                            Arias CRM.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                const nextUrl = `${window.location.pathname}${window.location.search}`;
                                navigate(`/login?redirect=${encodeURIComponent(nextUrl)}`);
                            }}
                            className="w-full h-10 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold"
                        >
                            Ir a Iniciar Sesión
                        </button>
                    </div>
                ) : flagEnabled === false ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                        <div className="font-bold">Módulo no habilitado para esta empresa</div>
                        <p>
                            El acceso a Social Planning y ChatGPT Bridge no está activado para{' '}
                            <strong>{companyName}</strong>.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Empresa:</span>
                                <span className="font-bold text-slate-900">{companyName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Usuario:</span>
                                <span className="font-semibold text-slate-800">
                                    {profile?.full_name || profile?.email}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600">
                            <p className="font-bold text-slate-800">Esta conexión permitirá a tu ChatGPT:</p>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span>Consultar páginas conectadas y memoria de episodios publicados.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Calendar className="w-4 h-4 text-[#4449AA] shrink-0 mt-0.5" />
                                <span>
                                    Enviar tus flyers y descripciones directo a Planning (programar, borrador o
                                    publicar en Facebook/Instagram).
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                <span>100% aislado a tu empresa. Puedes revocarlo en cualquier momento.</span>
                            </div>
                        </div>
                    </>
                )}

                {error && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                        {error}
                    </div>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                    <button
                        type="button"
                        onClick={handleDeny}
                        className="flex-1 h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={authorizing || flagEnabled !== true}
                        onClick={handleAuthorize}
                        className="flex-1 h-10 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                    >
                        {authorizing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Autorizar ChatGPT
                    </button>
                </div>
            </div>
        </div>
    );
}
