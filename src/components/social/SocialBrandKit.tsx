import React from 'react';
import { Loader2, Plus, RefreshCw, Star, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SocialAccount } from '../../services/social/socialPublishService';

export const META_APP_ID = '1463889952375598';

export const META_SCOPES = [
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_show_list',
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'read_insights',
    'business_management',
].join(',');

export function initiateMetaOAuth(companyId: string) {
    const cleanOrigin = window.location.origin.replace('://www.', '://');
    const redirectUri = `${cleanOrigin}/integrations/meta/callback`;
    const state = encodeURIComponent(companyId);
    const url = [
        'https://www.facebook.com/v22.0/dialog/oauth',
        `?client_id=${META_APP_ID}`,
        `&redirect_uri=${encodeURIComponent(redirectUri)}`,
        `&scope=${encodeURIComponent(META_SCOPES)}`,
        '&response_type=code',
        `&state=${state}`,
    ].join('');
    window.location.href = url;
}

export function FacebookIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#1877F2" />
            <path
                d="M15.12 12.64l.53-3.45h-3.31V6.95c0-.94.46-1.86 1.94-1.86h1.5V2.15S14.42 1.92 13.12 1.92c-2.71 0-4.48 1.64-4.48 4.62v2.65H5.61v3.45h3.03v8.34a12.1 12.1 0 003.7 0v-8.34h2.78z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
    const gradId = React.useId();
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <defs>
                <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FD5949" />
                    <stop offset="45%" stopColor="#D6249F" />
                    <stop offset="100%" stopColor="#285AEB" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="24" height="24" rx="7" fill={`url(#${gradId})`} />
            <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="3.6" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
            <circle cx="16.9" cy="7.1" r="1.1" fill="#FFFFFF" />
        </svg>
    );
}

export function YouTubeIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="1" y="4.2" width="22" height="15.6" rx="4.5" fill="#FF0000" />
            <path d="M9.8 8.7l6.2 3.3-6.2 3.3V8.7z" fill="#FFFFFF" />
        </svg>
    );
}

export function TikTokIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#0F172A" />
            <path
                d="M15.8 7.5a3.7 3.7 0 01-1.9-2.2h-2.1v9.4a2.2 2.2 0 11-1.5-2.1V10.4a4.4 4.4 0 103.6 4.3V9.9a5.8 5.8 0 003.4 1.1V8.9a3.7 3.7 0 01-1.5-1.4z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function LinkedInIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="1" y="1" width="22" height="22" rx="4.5" fill="#0A66C2" />
            <path
                d="M7.2 10.1v7.6H4.7v-7.6h2.5zM6 6.2a1.45 1.45 0 110 2.9 1.45 1.45 0 010-2.9zm12.8 7.1v4.4h-2.5v-4.1c0-1-.36-1.72-1.26-1.72-.68 0-1.1.46-1.28.9-.07.17-.08.4-.08.62v4.3h-2.5s.03-7 0-7.6h2.5v1.08c.33-.52.93-1.25 2.26-1.25 1.65 0 2.86 1.08 2.86 3.37z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function ThreadsIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#111827" />
            <path
                d="M15.3 11.4c-.2-2-1.5-3.2-3.6-3.2-1.9 0-3.2 1.1-3.4 2.5h1.8c.2-.6.8-1 1.6-1 1 0 1.6.5 1.7 1.3-.9-.2-1.9-.2-2.8 0-1.5.3-2.4 1.3-2.4 2.6 0 1.4 1.1 2.4 2.7 2.4 1.3 0 2.3-.6 2.8-1.5.5.2.9.6.9 1.2 0 1.4-1.2 2.4-3.1 2.4-2.5 0-4.2-1.7-4.2-4.4 0-2.8 1.8-4.6 4.4-4.6 2.2 0 3.7 1.1 4.1 3l1.6-.4C17 8.4 14.9 6.6 11.7 6.6 8.2 6.6 5.6 9.2 5.6 12.9c0 3.7 2.5 6.2 6 6.2 2.9 0 4.9-1.6 4.9-4 0-1.5-.7-2.6-1.2-3.7zm-3.8 3.2c-.8 0-1.4-.4-1.4-1.1 0-.7.6-1.1 1.6-1.2.6-.1 1.2 0 1.7.1-.2 1.3-.9 2.2-1.9 2.2z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#0F1419" />
            <path
                d="M16.6 6h2.1l-4.6 5.3L19.5 18h-4.2l-3.3-4.3L8.2 18H6.1l4.9-5.6L5.9 6h4.3l3 3.9L16.6 6zm-.7 10.7h1.2L9.5 7.2H8.2l7.7 9.5z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function GoogleBusinessIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#4285F4" />
            <path
                d="M6.5 9.2L7.7 6.5h8.6l1.2 2.7v1.1a2 2 0 01-4 0 2 2 0 01-3.5 0 2 2 0 01-3.5 0V9.2zM7.5 12.6h9v4.9h-9v-4.9z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function MetaAdsIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#0081FB" />
            <path
                d="M8.5 15.8c-1.8 0-3-1.4-3-3.4 0-2.3 1.5-4.3 3.3-4.3 1.3 0 2.3 1 3.2 2.6.9-1.6 1.9-2.6 3.2-2.6 1.8 0 3.3 2 3.3 4.3 0 2-1.2 3.4-3 3.4-1.3 0-2.2-.9-3.5-3.1-1.3 2.2-2.2 3.1-3.5 3.1zm.3-6c-.9 0-1.6 1.2-1.6 2.6 0 1 .5 1.7 1.3 1.7.8 0 1.4-.7 2.5-2.5-.8-1.2-1.5-1.8-2.2-1.8zm6.4 0c-.7 0-1.4.6-2.2 1.8 1.1 1.8 1.7 2.5 2.5 2.5.8 0 1.3-.7 1.3-1.7 0-1.4-.7-2.6-1.6-2.6z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function ChatGptIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#10A37F" />
            <path
                d="M16.9 10.6a3.3 3.3 0 00-.3-2.7 3.4 3.4 0 00-3.6-1.6 3.3 3.3 0 00-2.5-1.1 3.4 3.4 0 00-3.2 2.3 3.3 3.3 0 00-2.2 1.6 3.4 3.4 0 00.4 3.9 3.3 3.3 0 00.3 2.7 3.4 3.4 0 003.6 1.6 3.3 3.3 0 002.5 1.1 3.4 3.4 0 003.2-2.3 3.3 3.3 0 002.2-1.6 3.4 3.4 0 00-.4-3.9zm-4.9 6.6a2.3 2.3 0 01-1.5-.5l.1-.1 2.4-1.4c.1-.1.2-.2.2-.3v-3.4l1 .6v2.8a2.3 2.3 0 01-2.2 2.3zm-5-2.1a2.3 2.3 0 01-.3-1.5l.1.1 2.4 1.4c.1.1.3.1.4 0l2.9-1.7v1.2l-2.4 1.4a2.3 2.3 0 01-3.1-.9zm-.6-5.4a2.3 2.3 0 011.2-1v2.9c0 .1.1.3.2.3l2.9 1.7-1 .6-2.4-1.4a2.3 2.3 0 01-.9-3.1zm8.4 1.9l-2.9-1.7 1-.6 2.4 1.4a2.3 2.3 0 01-.3 4.2v-2.9c0-.1-.1-.3-.2-.4zm1-1.5l-.1-.1-2.4-1.4c-.1-.1-.3-.1-.4 0l-2.9 1.7V9.1l2.4-1.4a2.3 2.3 0 013.4 2.4zm-6.3 2.1l-1-.6V8.8a2.3 2.3 0 013.8-1.7l-.1.1-2.4 1.4c-.1.1-.2.2-.2.3v3.3z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

export function renderPlatformIcon(platform: string, className = 'w-4 h-4') {
    const p = platform.toLowerCase();
    if (p === 'facebook') return <FacebookIcon className={className} />;
    if (p === 'instagram') return <InstagramIcon className={className} />;
    if (p === 'youtube') return <YouTubeIcon className={className} />;
    if (p === 'tiktok') return <TikTokIcon className={className} />;
    if (p === 'linkedin') return <LinkedInIcon className={className} />;
    if (p === 'threads') return <ThreadsIcon className={className} />;
    if (p === 'x' || p === 'twitter') return <XIcon className={className} />;
    if (p === 'google_business') return <GoogleBusinessIcon className={className} />;
    if (p === 'meta_ads') return <MetaAdsIcon className={className} />;
    return <FacebookIcon className={className} />;
}

export function SocialNetworkBadge({
    platform,
    size = 'sm',
    title,
}: {
    platform: string;
    size?: 'xs' | 'sm' | 'md';
    title?: string;
}) {
    const dim = size === 'xs' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
    return (
        <span
            title={title || platform}
            className={`inline-flex items-center justify-center rounded-full shrink-0 shadow-2xs ring-1 ring-white ${dim}`}
        >
            {renderPlatformIcon(platform, dim)}
        </span>
    );
}

export function AccountAvatarWithBadge({
    account,
    size = 'md',
}: {
    account: Pick<SocialAccount, 'platform' | 'avatar_url' | 'account_name' | 'display_name'>;
    size?: 'sm' | 'md' | 'lg';
}) {
    const label = account.display_name || account.account_name || account.platform;
    const initials = label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || 'AR';

    const boxCls =
        size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-xs' : 'w-8 h-8 text-[11px]';
    const badgeCls = size === 'sm' ? 'w-3.5 h-3.5 -bottom-0.5 -right-0.5' : 'w-4 h-4 -bottom-0.5 -right-0.5';

    const bgAccent =
        account.platform === 'instagram'
            ? 'bg-gradient-to-tr from-amber-500 via-pink-600 to-indigo-600 text-white'
            : account.platform === 'youtube'
            ? 'bg-red-600 text-white'
            : 'bg-[#1877F2] text-white';

    return (
        <div className={`relative inline-flex shrink-0 ${boxCls}`}>
            {account.avatar_url ? (
                <img
                    src={account.avatar_url}
                    alt={label}
                    className="w-full h-full rounded-full object-cover border border-slate-200 bg-white"
                />
            ) : (
                <div
                    className={`w-full h-full rounded-full flex items-center justify-center font-bold border border-white shadow-2xs ${bgAccent}`}
                >
                    {initials}
                </div>
            )}
            <span className={`absolute rounded-full ring-2 ring-white bg-white flex items-center justify-center ${badgeCls}`}>
                {renderPlatformIcon(account.platform, 'w-full h-full')}
            </span>
        </div>
    );
}

interface SocialConnectionsGridProps {
    accounts: SocialAccount[];
    companyId: string;
    loading?: boolean;
    onRefresh?: () => void;
    onSetDefault?: (account: SocialAccount) => Promise<void> | void;
    onDisconnect?: (account: SocialAccount) => Promise<void> | void;
    settingDefaultId?: string | null;
}

interface FutureNetworkCard {
    key: string;
    label: string;
    cta: string;
    subtitle: string;
    btnClass: string;
}

const ROADMAP_NETWORKS: FutureNetworkCard[] = [
    {
        key: 'youtube',
        label: 'YouTube',
        cta: 'Conectar canal de YouTube',
        subtitle: 'Videos & Shorts · Fase 2',
        btnClass: 'bg-[#FF0000]/90 hover:bg-[#FF0000] text-white',
    },
    {
        key: 'tiktok',
        label: 'TikTok',
        cta: 'Conectar cuenta de TikTok',
        subtitle: 'Reels & Videos cortos · Fase 2',
        btnClass: 'bg-[#0F172A]/90 hover:bg-[#0F172A] text-white',
    },
    {
        key: 'linkedin',
        label: 'LinkedIn',
        cta: 'Conectar página de LinkedIn',
        subtitle: 'Perfil o empresa · Fase 2',
        btnClass: 'bg-[#0A66C2]/90 hover:bg-[#0A66C2] text-white',
    },
    {
        key: 'google_business',
        label: 'Google Business Profile',
        cta: 'Conectar Google Business',
        subtitle: 'Novedades locales · Fase 2',
        btnClass: 'bg-[#4285F4]/90 hover:bg-[#4285F4] text-white',
    },
    {
        key: 'threads',
        label: 'Threads',
        cta: 'Conectar cuenta de Threads',
        subtitle: 'Hilos cortos · Fase 2',
        btnClass: 'bg-zinc-900/90 hover:bg-zinc-900 text-white',
    },
    {
        key: 'x',
        label: 'X / Twitter',
        cta: 'Conectar cuenta de X',
        subtitle: 'Publicaciones & hilos · Fase 2',
        btnClass: 'bg-slate-900/90 hover:bg-slate-900 text-white',
    },
    {
        key: 'meta_ads',
        label: 'Meta Ads',
        cta: 'Conectar cuenta publicitaria',
        subtitle: 'Métricas de campañas · Fase 2',
        btnClass: 'bg-[#0081FB]/90 hover:bg-[#0081FB] text-white',
    },
];

export function SocialConnectionsGrid({
    accounts,
    companyId,
    loading = false,
    onRefresh,
    onSetDefault,
    onDisconnect,
    settingDefaultId = null,
}: SocialConnectionsGridProps) {
    const fbAccounts = accounts.filter((a) => a.platform === 'facebook');
    const igAccounts = accounts.filter((a) => a.platform === 'instagram');

    const handleConnectMeta = () => {
        if (!companyId) {
            toast.error('No se detectó la empresa activa para vincular Meta.');
            return;
        }
        initiateMetaOAuth(companyId);
    };

    const renderActiveSection = (
        platform: 'facebook' | 'instagram',
        title: string,
        typeLabel: string,
        list: SocialAccount[],
        btnLabel: string,
        btnStyle: string,
    ) => (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {renderPlatformIcon(platform, 'w-5 h-5')}
                    <span className="text-[13px] font-semibold text-slate-900">{title}</span>
                    {list.length > 0 && (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            {list.length} {list.length === 1 ? 'activa' : 'activas'}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {list.map((acc) => (
                    <div
                        key={acc.id}
                        className="group flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-2xs hover:border-slate-300 transition"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <AccountAvatarWithBadge account={acc} size="md" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                        {typeLabel}
                                    </span>
                                    {acc.is_default && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded">
                                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                            Principal
                                        </span>
                                    )}
                                </div>
                                <div className="text-[13px] font-semibold text-slate-900 truncate">
                                    {acc.display_name || acc.account_name}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            {onSetDefault && !acc.is_default && (
                                <button
                                    type="button"
                                    disabled={settingDefaultId === acc.id}
                                    onClick={() => onSetDefault(acc)}
                                    title="Marcar como cuenta principal"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                                >
                                    {settingDefaultId === acc.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Star className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                            {onDisconnect && (
                                <button
                                    type="button"
                                    onClick={() => onDisconnect(acc)}
                                    title={`Desconectar ${acc.account_name || title}`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={handleConnectMeta}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between shadow-2xs transition cursor-pointer ${btnStyle}`}
                >
                    <span className="truncate flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        {list.length > 0 ? `Sincronizar otra cuenta de ${title}` : btnLabel}
                    </span>
                    {renderPlatformIcon(platform, 'w-4 h-4 shrink-0 ring-1 ring-white/40 rounded-full')}
                </button>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                <span>Cargando cuentas conectadas…</span>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                    <p className="text-xs text-slate-500">
                        Conecta tus páginas y canales por empresa. Los tokens se aíslan automáticamente con seguridad multi-tenant.
                    </p>
                </div>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Actualizar
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {renderActiveSection(
                    'facebook',
                    'Facebook',
                    'Página',
                    fbAccounts,
                    'Conectar página de Facebook',
                    'bg-[#1877F2] hover:bg-[#166FE5] text-white',
                )}

                {renderActiveSection(
                    'instagram',
                    'Instagram',
                    'Profesional',
                    igAccounts,
                    'Conectar Instagram Business',
                    'bg-gradient-to-r from-[#E1306C] to-[#C13584] hover:opacity-95 text-white',
                )}

                {ROADMAP_NETWORKS.map((net) => (
                    <div key={net.key} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {renderPlatformIcon(net.key, 'w-5 h-5')}
                                <span className="text-[13px] font-semibold text-slate-900">{net.label}</span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                Próximamente
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                toast(`${net.label}: se habilitará en la Fase 2 del plan de redes (${net.subtitle}).`, {
                                    icon: '🗓️',
                                })
                            }
                            className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between shadow-2xs opacity-90 hover:opacity-100 transition cursor-pointer ${net.btnClass}`}
                        >
                            <span className="truncate">{net.cta}</span>
                            {renderPlatformIcon(net.key, 'w-4 h-4 shrink-0 ring-1 ring-white/30 rounded-full')}
                        </button>
                        <p className="text-[11px] text-slate-400 px-0.5">{net.subtitle}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ManageConnectionsModal({
    open,
    onClose,
    accounts,
    companyId,
    loading,
    onRefresh,
    onSetDefault,
    onDisconnect,
    settingDefaultId,
}: SocialConnectionsGridProps & { open: boolean; onClose: () => void }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="relative bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Gestionar conexiones</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Administra tus páginas activas de Meta y el roadmap de canales conectados al Planning.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center transition shadow-xs"
                        aria-label="Cerrar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <SocialConnectionsGrid
                    accounts={accounts}
                    companyId={companyId}
                    loading={loading}
                    onRefresh={onRefresh}
                    onSetDefault={onSetDefault}
                    onDisconnect={onDisconnect}
                    settingDefaultId={settingDefaultId}
                />
            </div>
        </div>
    );
}
