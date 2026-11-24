import React, { useState } from 'react';
import { Bookmark, Globe, Heart, MessageCircle, MoreHorizontal, Play, Send, Share2, ThumbsUp, Video } from 'lucide-react';
import type { SocialAccount } from '../../services/social/socialPublishService';
import type { TargetAccountRef } from '../../services/social/socialPlanningService';
import { AccountAvatarWithBadge, FacebookIcon, InstagramIcon, YouTubeIcon } from './SocialBrandKit';

interface PostLivePreviewProps {
    caption: string;
    youtubeTitle?: string;
    mediaUrl: string;
    isVideo: boolean;
    selectedAccounts: TargetAccountRef[];
    accounts: SocialAccount[];
    scheduledLabel?: string;
}

export function PostLivePreview({
    caption,
    youtubeTitle,
    mediaUrl,
    isVideo,
    selectedAccounts,
    accounts,
    scheduledLabel,
}: PostLivePreviewProps) {
    const hasInstagram = selectedAccounts.some((t) => t.platform === 'instagram');
    const hasFacebook = selectedAccounts.some((t) => t.platform === 'facebook');
    const hasYouTube = selectedAccounts.some((t) => t.platform === 'youtube');

    const [previewTab, setPreviewTab] = useState<'facebook' | 'instagram' | 'youtube'>(
        hasFacebook ? 'facebook' : hasYouTube ? 'youtube' : hasInstagram ? 'instagram' : 'facebook',
    );

    const activePlatform = previewTab;

    const matchedTarget =
        selectedAccounts.find((t) => t.platform === activePlatform) ||
        selectedAccounts[0] ||
        null;

    const fullAccount = matchedTarget
        ? accounts.find((a) => a.account_id === matchedTarget.account_id && a.platform === matchedTarget.platform)
        : accounts.find((a) => a.platform === activePlatform) || accounts[0];

    const displayName =
        fullAccount?.display_name ||
        fullAccount?.account_name ||
        matchedTarget?.account_name ||
        (activePlatform === 'instagram'
            ? 'tu_cuenta_ig'
            : activePlatform === 'youtube'
            ? 'Tu Canal de YouTube'
            : 'Tu Página de Facebook');

    const previewCaption = caption.trim();
    const resolvedYtTitle =
        youtubeTitle?.trim() ||
        previewCaption.split(/\r?\n/).find(Boolean)?.slice(0, 80) ||
        'Título de tu video en YouTube';

    return (
        <div className="bg-slate-50/90 border-t lg:border-t-0 lg:border-l border-slate-200 p-5 flex flex-col justify-between">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Vista previa en vivo
                    </span>
                    <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5">
                        <button
                            type="button"
                            onClick={() => setPreviewTab('facebook')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                activePlatform === 'facebook'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <FacebookIcon className="w-3.5 h-3.5" />
                            Facebook
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewTab('instagram')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                activePlatform === 'instagram'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <InstagramIcon className="w-3.5 h-3.5" />
                            Instagram
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewTab('youtube')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                activePlatform === 'youtube'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <YouTubeIcon className="w-3.5 h-3.5" />
                            YouTube
                        </button>
                    </div>
                </div>

                {activePlatform === 'facebook' ? (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-sm mx-auto">
                        <div className="p-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <AccountAvatarWithBadge
                                    account={{
                                        platform: 'facebook',
                                        avatar_url: fullAccount?.avatar_url || null,
                                        account_name: displayName,
                                        display_name: displayName,
                                    }}
                                    size="md"
                                />
                                <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-slate-900 truncate">
                                        {displayName}
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                        <span>{scheduledLabel || 'Ahora · El Salvador'}</span>
                                        <span>·</span>
                                        <Globe className="w-3 h-3" />
                                    </div>
                                </div>
                            </div>
                            <MoreHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>

                        <div className="px-3 pb-2.5 text-[12px] text-slate-800 whitespace-pre-line break-words leading-relaxed max-h-28 overflow-y-auto">
                            {previewCaption ? (
                                previewCaption
                            ) : (
                                <span className="text-slate-400 italic">
                                    Tu texto aparecerá aquí con saltos de línea y emojis…
                                </span>
                            )}
                        </div>

                        <div className="bg-slate-100 border-y border-slate-100 aspect-[4/3] flex items-center justify-center overflow-hidden">
                            {mediaUrl ? (
                                isVideo ? (
                                    <div className="flex flex-col items-center gap-1.5 text-slate-500">
                                        <Video className="w-7 h-7" />
                                        <span className="text-xs font-medium">Video listo para publicar</span>
                                    </div>
                                ) : (
                                    <img src={mediaUrl} alt="Vista previa" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <span className="text-xs text-slate-400">Sin imagen o video adjunto</span>
                            )}
                        </div>

                        <div className="px-3 py-2 grid grid-cols-3 text-slate-500 text-[11px] font-medium">
                            <div className="flex items-center justify-center gap-1.5 py-1">
                                <ThumbsUp className="w-3.5 h-3.5" /> Me gusta
                            </div>
                            <div className="flex items-center justify-center gap-1.5 py-1">
                                <MessageCircle className="w-3.5 h-3.5" /> Comentar
                            </div>
                            <div className="flex items-center justify-center gap-1.5 py-1">
                                <Share2 className="w-3.5 h-3.5" /> Compartir
                            </div>
                        </div>
                    </div>
                ) : activePlatform === 'instagram' ? (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-sm mx-auto">
                        <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                                <AccountAvatarWithBadge
                                    account={{
                                        platform: 'instagram',
                                        avatar_url: fullAccount?.avatar_url || null,
                                        account_name: displayName,
                                        display_name: displayName,
                                    }}
                                    size="sm"
                                />
                                <span className="text-[12px] font-semibold text-slate-900 truncate">
                                    {displayName}
                                </span>
                            </div>
                            <MoreHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>

                        <div className="bg-slate-100 aspect-square flex items-center justify-center overflow-hidden">
                            {mediaUrl ? (
                                isVideo ? (
                                    <div className="flex flex-col items-center gap-1.5 text-slate-500">
                                        <Video className="w-7 h-7" />
                                        <span className="text-xs font-medium">Reel / Video adjunto</span>
                                    </div>
                                ) : (
                                    <img src={mediaUrl} alt="Vista previa" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <span className="text-xs text-slate-400">Sube una imagen cuadrada o vertical</span>
                            )}
                        </div>

                        <div className="p-3 space-y-1.5">
                            <div className="flex items-center justify-between text-slate-700">
                                <div className="flex items-center gap-3">
                                    <Heart className="w-4 h-4" />
                                    <MessageCircle className="w-4 h-4" />
                                    <Send className="w-4 h-4" />
                                </div>
                                <Bookmark className="w-4 h-4" />
                            </div>
                            <p className="text-[11px] text-slate-800 line-clamp-4 whitespace-pre-line break-words">
                                <span className="font-semibold mr-1.5">{displayName}</span>
                                {previewCaption || (
                                    <span className="text-slate-400 italic">Caption de Instagram…</span>
                                )}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-sm mx-auto">
                        <div className="relative bg-zinc-900 aspect-video flex items-center justify-center overflow-hidden">
                            {mediaUrl ? (
                                isVideo ? (
                                    <div className="flex flex-col items-center gap-2 text-white">
                                        <div className="w-12 h-12 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg">
                                            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                                        </div>
                                        <span className="text-[11px] font-medium text-zinc-200">
                                            Video listo para YouTube
                                        </span>
                                    </div>
                                ) : (
                                    <div className="px-4 text-center space-y-1 text-amber-300">
                                        <Video className="w-6 h-6 mx-auto" />
                                        <p className="text-[11px] font-semibold">
                                            YouTube requiere un archivo de video (MP4/MOV)
                                        </p>
                                    </div>
                                )
                            ) : (
                                <span className="text-xs text-zinc-400">Sube un video MP4 o MOV para YouTube</span>
                            )}
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-semibold">
                                16:9 / Short
                            </span>
                        </div>

                        <div className="p-3.5 space-y-2.5">
                            <h3 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">
                                {resolvedYtTitle}
                            </h3>

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <AccountAvatarWithBadge
                                        account={{
                                            platform: 'youtube',
                                            avatar_url: fullAccount?.avatar_url || null,
                                            account_name: displayName,
                                            display_name: displayName,
                                        }}
                                        size="sm"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-[12px] font-semibold text-slate-900 truncate">
                                            {displayName}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {scheduledLabel || 'Público · El Salvador'}
                                        </div>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[10px] font-semibold shrink-0">
                                    Suscrito
                                </span>
                            </div>

                            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-[11px] text-slate-700 whitespace-pre-line line-clamp-3">
                                {previewCaption || (
                                    <span className="text-slate-400 italic">Descripción del video para YouTube…</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-[11px] text-slate-400 text-center pt-4">
                Simulación visual de referencia · El encuadre final depende de cada red social.
            </p>
        </div>
    );
}
