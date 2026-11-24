import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Bot,
    Calendar as CalendarIcon,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Copy,
    ExternalLink,
    Key,
    LayoutList,
    Loader2,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    ShieldAlert,
    Sparkles,
    Trash2,
    Upload,
    Video,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { socialPublishService, type SocialAccount } from '../../services/social/socialPublishService';
import {
    buildChatGptOpenApiSchema,
    buildChatGptSystemInstructions,
    socialPlanningService,
    type PlanningSocialPost,
    type SocialBridgeTokenRecord,
    type TargetAccountRef,
} from '../../services/social/socialPlanningService';

type PlanningTab = 'calendar' | 'list' | 'deleted';

const STATUS_META: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Programado', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    published: { label: 'Publicado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    draft: { label: 'Borrador', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    publishing: { label: 'Publicando…', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    failed: { label: 'Error', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const EDITORIAL_LINES = ['AI + LEAN™', 'Motivación Empresarial', 'General'] as const;

function startOfWeekSunday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function toLocalDateKey(isoOrDate: string | Date): string {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toDatetimeLocalValue(iso?: string | null): string {
    const d = iso ? new Date(iso) : new Date(Date.now() + 2 * 3600_000);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
}

function formatDateTimeSv(iso?: string | null): string {
    if (!iso) return 'Sin fecha';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleString('es-SV', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatTimeOnly(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function postDisplayDate(p: PlanningSocialPost): string {
    return p.scheduled_at || p.published_at || p.created_at;
}

function postCaption(p: PlanningSocialPost): string {
    return p.captions?.facebook || p.captions?.instagram || p.captions?.default || '';
}

export default function SocialPlanning() {
    const { profile, simulatedCompanyId } = useAuth();
    const companyId = simulatedCompanyId || profile?.company_id || '';

    const [activeTab, setActiveTab] = useState<PlanningTab>('calendar');
    const [loading, setLoading] = useState(true);
    const [flagEnabled, setFlagEnabled] = useState<boolean | null>(null);
    const [companyName, setCompanyName] = useState('Arias Defense');

    const [posts, setPosts] = useState<PlanningSocialPost[]>([]);
    const [deletedPosts, setDeletedPosts] = useState<PlanningSocialPost[]>([]);
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);

    // Calendar & list filters
    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekSunday(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [lineFilter, setLineFilter] = useState<string>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');

    // Create / Edit Post modal
    const [showPostModal, setShowPostModal] = useState(false);
    const [editingPost, setEditingPost] = useState<PlanningSocialPost | null>(null);
    const [formCaption, setFormCaption] = useState('');
    const [formLine, setFormLine] = useState<string>('AI + LEAN™');
    const [formEpisode, setFormEpisode] = useState('');
    const [formTopic, setFormTopic] = useState('');
    const [formMode, setFormMode] = useState<'publish_now' | 'schedule' | 'draft'>('schedule');
    const [formScheduledLocal, setFormScheduledLocal] = useState(() => toDatetimeLocalValue());
    const [formSelectedAccounts, setFormSelectedAccounts] = useState<TargetAccountRef[]>([]);
    const [formMediaUrl, setFormMediaUrl] = useState<string>('');
    const [formIsVideo, setFormIsVideo] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [savingPost, setSavingPost] = useState(false);
    const [busyPostId, setBusyPostId] = useState<string | null>(null);

    // ChatGPT Connector Modal
    const [showBridgeModal, setShowBridgeModal] = useState(false);
    const [tokens, setTokens] = useState<SocialBridgeTokenRecord[]>([]);
    const [loadingBridge, setLoadingBridge] = useState(false);
    const [newTokenLabel, setNewTokenLabel] = useState('ChatGPT Plus');
    const [newTokenPublishDirect, setNewTokenPublishDirect] = useState(true);
    const [creatingToken, setCreatingToken] = useState(false);
    const [revealedToken, setRevealedToken] = useState<string | null>(null);
    const [bridgeSetup, setBridgeSetup] = useState<{
        authorization_url: string;
        token_url: string;
        openapi_schema: Record<string, any>;
        instructions: string;
    } | null>(null);

    const loadAll = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const { data: comp } = await supabase
                .from('companies')
                .select('id, name, features')
                .eq('id', companyId)
                .maybeSingle();

            const enabled = Boolean((comp?.features as any)?.ai_content_studio_enabled);
            setFlagEnabled(enabled);
            setCompanyName(comp?.name || 'Arias Defense');

            if (!enabled) {
                setLoading(false);
                return;
            }

            const [activeList, deletedList, accList] = await Promise.all([
                socialPlanningService.listPosts(false),
                socialPlanningService.listPosts(true),
                socialPublishService.getAccounts(),
            ]);
            setPosts(activeList);
            setDeletedPosts(deletedList);
            setAccounts(accList);
        } catch (err: any) {
            toast.error(err?.message || 'Error al cargar Social Planning');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const openChatGptModal = async () => {
        setShowBridgeModal(true);
        setRevealedToken(null);
        setLoadingBridge(true);
        try {
            const [tokList, setup] = await Promise.all([
                socialPlanningService.listTokens(companyId),
                socialPlanningService.getChatGptSetup(companyId),
            ]);
            setTokens(tokList);
            setBridgeSetup(setup);
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo cargar la configuración de ChatGPT');
            const fallbackUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://mtxqqamitglhehaktgxm.supabase.co'}/functions/v1/arias-social-bridge`;
            setBridgeSetup({
                authorization_url: 'https://ariascrm.com/oauth/chatgpt-authorize',
                token_url: `${fallbackUrl}/oauth/token`,
                openapi_schema: buildChatGptOpenApiSchema(fallbackUrl),
                instructions: buildChatGptSystemInstructions(companyName),
            });
        } finally {
            setLoadingBridge(false);
        }
    };

    const handleCreateToken = async () => {
        if (!companyId) return;
        setCreatingToken(true);
        try {
            const res = await socialPlanningService.createToken(
                companyId,
                newTokenLabel.trim() || `ChatGPT · ${profile?.full_name || 'Equipo'}`,
                newTokenPublishDirect,
            );
            setRevealedToken(res.token);
            setTokens((prev) => [
                {
                    ...res.record,
                    user_name: profile?.full_name || null,
                    user_email: profile?.email || null,
                },
                ...prev,
            ]);
            toast.success('Token generado. Cópialo ahora (solo se muestra una vez).');
        } catch (err: any) {
            toast.error(err?.message || 'Error generando token');
        } finally {
            setCreatingToken(false);
        }
    };

    const handleRevokeToken = async (tokenId: string) => {
        try {
            await socialPlanningService.revokeToken(companyId, tokenId);
            setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, is_active: false } : t)));
            toast.success('Acceso revocado');
        } catch (err: any) {
            toast.error(err?.message || 'Error revocando token');
        }
    };

    const handleToggleTokenPermission = async (tok: SocialBridgeTokenRecord) => {
        const nextVal = !tok.can_publish_directly;
        try {
            await socialPlanningService.toggleTokenPublish(companyId, tok.id, nextVal);
            setTokens((prev) =>
                prev.map((t) => (t.id === tok.id ? { ...t, can_publish_directly: nextVal } : t)),
            );
            toast.success(
                nextVal
                    ? 'Token habilitado para publicar directo'
                    : 'Restringido: solo puede enviar a Borrador/Planning',
            );
        } catch (err: any) {
            toast.error(err?.message || 'Error actualizando permiso');
        }
    };

    const openCreateModal = (presetDateKey?: string) => {
        setEditingPost(null);
        setFormCaption('');
        setFormLine('AI + LEAN™');
        setFormEpisode('');
        setFormTopic('');
        setFormMode('schedule');
        if (presetDateKey) {
            setFormScheduledLocal(`${presetDateKey}T09:00`);
        } else {
            setFormScheduledLocal(toDatetimeLocalValue());
        }
        const defaultTargets = accounts
            .filter((a) => a.is_default && a.account_id)
            .map((a) => ({
                platform: a.platform,
                account_id: a.account_id!,
                account_name: a.display_name || a.account_name,
            }));
        setFormSelectedAccounts(
            defaultTargets.length > 0
                ? defaultTargets
                : accounts[0]?.account_id
                ? [
                      {
                          platform: accounts[0].platform,
                          account_id: accounts[0].account_id,
                          account_name: accounts[0].display_name || accounts[0].account_name,
                      },
                  ]
                : [],
        );
        setFormMediaUrl('');
        setFormIsVideo(false);
        setShowPostModal(true);
    };

    const openEditModal = (post: PlanningSocialPost) => {
        setEditingPost(post);
        setFormCaption(postCaption(post));
        setFormLine(post.editorial_line || 'AI + LEAN™');
        setFormEpisode(post.episode_label || '');
        setFormTopic(post.topic || '');
        setFormMode(
            post.status === 'scheduled' ? 'schedule' : post.status === 'published' ? 'schedule' : 'draft',
        );
        setFormScheduledLocal(toDatetimeLocalValue(post.scheduled_at));
        const existingTargets = Array.isArray(post.target_account_ids) ? post.target_account_ids : [];
        setFormSelectedAccounts(existingTargets);
        setFormMediaUrl(post.content_url || '');
        setFormIsVideo(post.content_type === 'video' || post.content_type === 'reel');
        setShowPostModal(true);
    };

    const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyId) return;
        setUploadingMedia(true);
        try {
            const res = await socialPlanningService.uploadPlanningMedia(companyId, file);
            setFormMediaUrl(res.url);
            setFormIsVideo(res.isVideo);
            toast.success('Archivo subido al almacenamiento privado de Planning');
        } catch (err: any) {
            toast.error(err?.message || 'Error subiendo archivo');
        } finally {
            setUploadingMedia(false);
        }
    };

    const toggleFormTarget = (acc: SocialAccount) => {
        if (!acc.account_id) return;
        const exists = formSelectedAccounts.some(
            (t) => t.platform === acc.platform && t.account_id === acc.account_id,
        );
        if (exists) {
            setFormSelectedAccounts((prev) =>
                prev.filter((t) => !(t.platform === acc.platform && t.account_id === acc.account_id)),
            );
        } else {
            setFormSelectedAccounts((prev) => [
                ...prev,
                {
                    platform: acc.platform,
                    account_id: acc.account_id!,
                    account_name: acc.display_name || acc.account_name,
                },
            ]);
        }
    };

    const handleSavePostModal = async () => {
        if (!formCaption.trim()) {
            toast.error('Escribe la descripción (caption) del post');
            return;
        }
        if (formSelectedAccounts.length === 0) {
            toast.error('Selecciona al menos una página destino');
            return;
        }
        if (formMode === 'schedule' && !formScheduledLocal) {
            toast.error('Elige fecha y hora para programar en Planning');
            return;
        }
        if (!editingPost && !formMediaUrl) {
            toast.error('Sube una imagen o video (o créalo desde ChatGPT conectado)');
            return;
        }

        setSavingPost(true);
        try {
            const schedIso = formMode === 'schedule' ? new Date(formScheduledLocal).toISOString() : null;
            const platforms = [...new Set(formSelectedAccounts.map((t) => t.platform))];

            if (editingPost) {
                await socialPlanningService.updatePlanningPost(editingPost.id, {
                    caption: formCaption.trim(),
                    editorial_line: formLine,
                    episode_label: formEpisode.trim() || null,
                    topic: formTopic.trim() || null,
                    platforms,
                    target_account_ids: formSelectedAccounts,
                    status: formMode === 'schedule' ? 'scheduled' : formMode === 'draft' ? 'draft' : 'publishing',
                    scheduled_at: schedIso,
                });
                if (formMode === 'publish_now') {
                    await socialPlanningService.publishPostNow(companyId, editingPost.id);
                    toast.success('Publicación enviada a tus redes');
                } else {
                    toast.success('Cambios guardados en Planning');
                }
            } else {
                const created = await socialPlanningService.createPlanningPost({
                    companyId,
                    contentUrl: formMediaUrl,
                    contentType: formIsVideo ? 'video' : 'image',
                    caption: formCaption.trim(),
                    targets: formSelectedAccounts,
                    editorialLine: formLine,
                    episodeLabel: formEpisode.trim() || null,
                    topic: formTopic.trim() || null,
                    status: formMode === 'schedule' ? 'scheduled' : formMode === 'draft' ? 'draft' : 'publishing',
                    scheduledAt: schedIso,
                });
                if (formMode === 'publish_now') {
                    await socialPlanningService.publishPostNow(companyId, created.id);
                    toast.success('Publicado ahora correctamente');
                } else {
                    toast.success(
                        formMode === 'schedule' ? 'Programado en Calendario Planning' : 'Guardado en Borradores',
                    );
                }
            }
            setShowPostModal(false);
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'Error guardando post');
        } finally {
            setSavingPost(false);
        }
    };

    const handlePublishNow = async (post: PlanningSocialPost) => {
        setBusyPostId(post.id);
        try {
            await socialPlanningService.publishPostNow(companyId, post.id);
            toast.success('Publicado en tus páginas seleccionadas');
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'Error al publicar');
            await loadAll();
        } finally {
            setBusyPostId(null);
        }
    };

    const handleSoftDelete = async (post: PlanningSocialPost) => {
        setBusyPostId(post.id);
        try {
            await socialPlanningService.softDeletePost(post.id, profile?.id, profile?.email);
            toast.success('Movido a Eliminados');
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo eliminar');
        } finally {
            setBusyPostId(null);
        }
    };

    const handleRestore = async (post: PlanningSocialPost) => {
        setBusyPostId(post.id);
        try {
            await socialPlanningService.restorePost(post.id);
            toast.success('Restaurado como Borrador en Lista');
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo restaurar');
        } finally {
            setBusyPostId(null);
        }
    };

    const copyText = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado al portapapeles`);
    };

    const filteredPosts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return posts.filter((p) => {
            if (statusFilter !== 'all' && p.status !== statusFilter) return false;
            if (lineFilter !== 'all' && (p.editorial_line || 'General') !== lineFilter) return false;
            if (accountFilter !== 'all') {
                const targets = Array.isArray(p.target_account_ids) ? p.target_account_ids : [];
                if (!targets.some((t) => t.account_id === accountFilter)) return false;
            }
            if (term) {
                const hay = [
                    postCaption(p),
                    p.episode_label || '',
                    p.editorial_line || '',
                    p.topic || '',
                ]
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [posts, searchTerm, statusFilter, lineFilter, accountFilter]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, idx) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + idx);
            return {
                date: d,
                key: toLocalDateKey(d),
                dayName: d.toLocaleDateString('es-SV', { weekday: 'short' }),
                dayNum: d.getDate(),
            };
        });
    }, [weekStart]);

    const weekRangeLabel = useMemo(() => {
        const start = weekDays[0]?.date;
        const end = weekDays[6]?.date;
        if (!start || !end) return '';
        const fmt = (d: Date) => d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
        return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
    }, [weekDays]);

    const postsByDayKey = useMemo(() => {
        const map: Record<string, PlanningSocialPost[]> = {};
        for (const p of filteredPosts) {
            const key = toLocalDateKey(postDisplayDate(p));
            if (!key) continue;
            if (!map[key]) map[key] = [];
            map[key].push(p);
        }
        for (const key of Object.keys(map)) {
            map[key].sort(
                (a, b) => new Date(postDisplayDate(a)).getTime() - new Date(postDisplayDate(b)).getTime(),
            );
        }
        return map;
    }, [filteredPosts]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[420px]">
                <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                    <Loader2 className="w-5 h-5 animate-spin text-[#4449AA]" />
                    <span>Cargando Social Planning &amp; ChatGPT Bridge…</span>
                </div>
            </div>
        );
    }

    if (flagEnabled === false) {
        return (
            <div className="p-6 max-w-2xl mx-auto mt-10">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
                    <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
                    <h1 className="text-lg font-bold text-slate-900">Social Planning no habilitado</h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Este módulo privado (`ai_content_studio_enabled`) está reservado para empresas autorizadas. Tu{' '}
                        <strong>Panel de Publicación</strong> actual sigue funcionando normalmente.
                    </p>
                    <Link
                        to="/marketing/social"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4449AA] text-white text-xs font-bold"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Social Media Hub
                    </Link>
                </div>
            </div>
        );
    }

    const todayKey = toLocalDateKey(new Date());

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
            {/* Top Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Link
                            to="/marketing/social"
                            className="inline-flex items-center gap-1 hover:text-[#4449AA] font-medium"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Social Media Hub
                        </Link>
                        <span>/</span>
                        <span className="font-semibold text-slate-700">Planning</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4449AA]">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                Planning &amp; Conector ChatGPT Plus
                            </h1>
                            <p className="text-xs text-slate-500">
                                Crea flyers 100% originales en tu ChatGPT Plus ($0 extra API), prográmalos aquí o
                                publícalos directo en Facebook/IG.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/company/social-accounts"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                    >
                        Páginas ({accounts.length})
                    </Link>
                    <button
                        type="button"
                        onClick={openChatGptModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800"
                    >
                        <Bot className="w-3.5 h-3.5" />
                        Conectar ChatGPT
                    </button>
                    <button
                        type="button"
                        onClick={() => openCreateModal()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Crear Post
                    </button>
                </div>
            </div>

            {/* Navigation Tabs + Filters */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-2 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                        { id: 'calendar' as PlanningTab, label: 'Calendario', icon: CalendarIcon },
                        { id: 'list' as PlanningTab, label: `Lista (${posts.length})`, icon: LayoutList },
                        {
                            id: 'deleted' as PlanningTab,
                            label: `Eliminados (${deletedPosts.length})`,
                            icon: Trash2,
                        },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                                    active
                                        ? 'bg-[#4449AA] text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {activeTab !== 'deleted' && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar episodio o texto…"
                                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-44 focus:outline-none focus:border-[#4449AA]"
                            />
                        </div>
                        <select
                            value={lineFilter}
                            onChange={(e) => setLineFilter(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
                        >
                            <option value="all">Todas las líneas</option>
                            {EDITORIAL_LINES.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>
                        <select
                            value={accountFilter}
                            onChange={(e) => setAccountFilter(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
                        >
                            <option value="all">Todas las páginas</option>
                            {accounts
                                .filter((a) => a.account_id)
                                .map((a) => (
                                    <option key={`${a.platform}-${a.account_id}`} value={a.account_id!}>
                                        {a.platform === 'facebook' ? 'FB' : 'IG'} · {a.display_name || a.account_name}
                                    </option>
                                ))}
                        </select>
                        <button
                            type="button"
                            onClick={loadAll}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                            title="Actualizar"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* TAB 1: CALENDAR */}
            {activeTab === 'calendar' && (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    const prev = new Date(weekStart);
                                    prev.setDate(prev.getDate() - 7);
                                    setWeekStart(prev);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
                                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                            >
                                Hoy
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = new Date(weekStart);
                                    next.setDate(next.getDate() + 7);
                                    setWeekStart(next);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <span className="ml-2 text-xs font-bold text-slate-800">{weekRangeLabel}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                            Publicación automática cada 5 min según fecha programada (El Salvador -06:00).
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
                        {weekDays.map((day) => {
                            const isToday = day.key === todayKey;
                            const dayPosts = postsByDayKey[day.key] || [];
                            return (
                                <div
                                    key={day.key}
                                    className={`rounded-xl border min-h-[260px] flex flex-col ${
                                        isToday ? 'border-[#4449AA] bg-indigo-50/20' : 'border-slate-200 bg-slate-50/40'
                                    }`}
                                >
                                    <div
                                        className={`px-2.5 py-2 border-b flex items-center justify-between text-xs font-bold rounded-t-xl ${
                                            isToday
                                                ? 'bg-[#4449AA] text-white border-[#4449AA]'
                                                : 'bg-white text-slate-700 border-slate-200'
                                        }`}
                                    >
                                        <span className="capitalize">
                                            {day.dayName} {day.dayNum}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openCreateModal(day.key)}
                                            className={`p-0.5 rounded ${
                                                isToday ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-100 text-slate-500'
                                            }`}
                                            title="Programar en este día"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="p-1.5 space-y-1.5 flex-1">
                                        {dayPosts.length === 0 ? (
                                            <button
                                                type="button"
                                                onClick={() => openCreateModal(day.key)}
                                                className="w-full h-20 rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400 hover:border-[#4449AA]/50 hover:text-[#4449AA] transition"
                                            >
                                                + Programar
                                            </button>
                                        ) : (
                                            dayPosts.map((p) => {
                                                const st = STATUS_META[p.status] || STATUS_META.draft;
                                                return (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => openEditModal(p)}
                                                        className="bg-white border border-slate-200 hover:border-[#4449AA] rounded-lg p-2 cursor-pointer shadow-xs space-y-1.5 transition"
                                                    >
                                                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                                                            <span className="text-slate-600">
                                                                {formatTimeOnly(postDisplayDate(p))}
                                                            </span>
                                                            <span className={`px-1.5 py-0.5 rounded border ${st.cls}`}>
                                                                {st.label}
                                                            </span>
                                                        </div>
                                                        {p.content_url && (
                                                            <div className="w-full h-20 rounded bg-slate-100 overflow-hidden">
                                                                {p.content_type === 'video' ? (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] gap-1">
                                                                        <Video className="w-4 h-4" /> Video
                                                                    </div>
                                                                ) : (
                                                                    <img
                                                                        src={p.content_url}
                                                                        alt="Flyer"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                        {p.episode_label && (
                                                            <div className="text-[10px] font-extrabold text-[#4449AA] truncate">
                                                                {p.episode_label}
                                                            </div>
                                                        )}
                                                        <p className="text-[11px] text-slate-700 line-clamp-2 leading-snug">
                                                            {postCaption(p)}
                                                        </p>
                                                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                                            <span>{(p.platforms || []).map((x) => (x === 'facebook' ? 'FB' : 'IG')).join(' · ')}</span>
                                                            <span>{p.source === 'chatgpt' ? '🤖 GPT' : 'CRM'}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: LIST */}
            {activeTab === 'list' && (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-1.5">
                        {[
                            { k: 'all', label: 'Todos' },
                            { k: 'scheduled', label: 'Programados' },
                            { k: 'published', label: 'Publicados' },
                            { k: 'draft', label: 'Borradores' },
                            { k: 'failed', label: 'Error' },
                        ].map((s) => (
                            <button
                                key={s.k}
                                type="button"
                                onClick={() => setStatusFilter(s.k)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                                    statusFilter === s.k
                                        ? 'bg-indigo-50 border-indigo-300 text-[#4449AA]'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-4 font-bold">Fecha / Hora</th>
                                    <th className="py-2.5 px-4 font-bold">Contenido y Memoria</th>
                                    <th className="py-2.5 px-4 font-bold">Páginas</th>
                                    <th className="py-2.5 px-4 font-bold">Estado</th>
                                    <th className="py-2.5 px-4 font-bold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPosts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-slate-400">
                                            No hay publicaciones todavía. Crea una aquí o envía un flyer directo desde
                                            ChatGPT Plus.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPosts.map((p) => {
                                        const st = STATUS_META[p.status] || STATUS_META.draft;
                                        const targets = Array.isArray(p.target_account_ids) ? p.target_account_ids : [];
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50/70">
                                                <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                                                    <div>{formatDateTimeSv(postDisplayDate(p))}</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {p.source === 'chatgpt' ? '🤖 Desde ChatGPT Plus' : '🖥️ Desde CRM'}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-start gap-3 max-w-xl">
                                                        {p.content_url && (
                                                            <img
                                                                src={p.content_url}
                                                                alt="Flyer"
                                                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                                                            />
                                                        )}
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {p.episode_label && (
                                                                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-[#4449AA] font-bold text-[10px]">
                                                                        {p.episode_label}
                                                                    </span>
                                                                )}
                                                                {p.editorial_line && (
                                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                                                        {p.editorial_line}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-slate-700 line-clamp-2">{postCaption(p)}</p>
                                                            {p.error_message && (
                                                                <p className="text-[11px] text-rose-600">{p.error_message}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {targets.length > 0
                                                            ? targets.map((t) => (
                                                                  <span
                                                                      key={`${t.platform}-${t.account_id}`}
                                                                      className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                                                  >
                                                                      {t.platform === 'facebook' ? 'FB' : 'IG'} ·{' '}
                                                                      {t.account_name || t.account_id}
                                                                  </span>
                                                              ))
                                                            : (p.platforms || []).map((pl) => (
                                                                  <span
                                                                      key={pl}
                                                                      className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                                                  >
                                                                      {pl}
                                                                  </span>
                                                              ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${st.cls}`}>
                                                        {st.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                                                    {p.status !== 'published' && (
                                                        <button
                                                            type="button"
                                                            disabled={busyPostId === p.id}
                                                            onClick={() => handlePublishNow(p)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                                        >
                                                            {busyPostId === p.id ? '…' : 'Publicar ya'}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(p)}
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busyPostId === p.id}
                                                        onClick={() => handleSoftDelete(p)}
                                                        className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50"
                                                        title="Mover a Eliminados"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: DELETED POSTS */}
            {activeTab === 'deleted' && (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-4 font-bold">Fecha Original</th>
                                    <th className="py-2.5 px-4 font-bold">Contenido</th>
                                    <th className="py-2.5 px-4 font-bold">Eliminado el</th>
                                    <th className="py-2.5 px-4 font-bold">Eliminado por</th>
                                    <th className="py-2.5 px-4 font-bold text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {deletedPosts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-slate-400">
                                            La papelera de Eliminados está vacía.
                                        </td>
                                    </tr>
                                ) : (
                                    deletedPosts.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                                {formatDateTimeSv(postDisplayDate(p))}
                                            </td>
                                            <td className="py-3 px-4 max-w-md">
                                                <div className="flex items-center gap-2.5">
                                                    {p.content_url && (
                                                        <img
                                                            src={p.content_url}
                                                            alt="Flyer"
                                                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                                        />
                                                    )}
                                                    <p className="text-slate-700 line-clamp-2">{postCaption(p)}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                                                {formatDateTimeSv(p.deleted_at)}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                                {p.deleted_by_email || 'Administrador CRM'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    type="button"
                                                    disabled={busyPostId === p.id}
                                                    onClick={() => handleRestore(p)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[#4449AA] text-[11px] font-bold"
                                                >
                                                    <RotateCcw className="w-3 h-3" /> Restaurar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE / EDIT POST */}
            {showPostModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h2 className="text-base font-bold text-slate-900">
                                {editingPost ? 'Editar publicación en Planning' : 'Nueva publicación / Programar post'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowPostModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Línea editorial</label>
                                <select
                                    value={formLine}
                                    onChange={(e) => setFormLine(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                >
                                    {EDITORIAL_LINES.map((l) => (
                                        <option key={l} value={l}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Episodio / Principio
                                </label>
                                <input
                                    type="text"
                                    value={formEpisode}
                                    onChange={(e) => setFormEpisode(e.target.value)}
                                    placeholder="Ej. EPISODIO 15"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tema corto</label>
                                <input
                                    type="text"
                                    value={formTopic}
                                    onChange={(e) => setFormTopic(e.target.value)}
                                    placeholder="Ej. Priorización Lean"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                                Páginas de Facebook / Instagram destino
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {accounts.length === 0 ? (
                                    <Link
                                        to="/company/social-accounts"
                                        className="text-xs font-bold text-[#4449AA] underline inline-flex items-center gap-1"
                                    >
                                        Conectar páginas en Cuentas Conectadas <ExternalLink className="w-3 h-3" />
                                    </Link>
                                ) : (
                                    accounts.map((acc) => {
                                        const selected = formSelectedAccounts.some(
                                            (t) => t.platform === acc.platform && t.account_id === acc.account_id,
                                        );
                                        return (
                                            <button
                                                key={acc.id}
                                                type="button"
                                                onClick={() => toggleFormTarget(acc)}
                                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                                                    selected
                                                        ? 'bg-indigo-50 border-[#4449AA] text-[#4449AA]'
                                                        : 'bg-white border-slate-200 text-slate-600'
                                                }`}
                                            >
                                                <Check className={`w-3.5 h-3.5 ${selected ? 'opacity-100' : 'opacity-20'}`} />
                                                {acc.platform === 'facebook' ? 'FB' : 'IG'} ·{' '}
                                                {acc.display_name || acc.account_name}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Imagen o Video
                                </label>
                                <label className="border-2 border-dashed border-slate-200 hover:border-[#4449AA] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer min-h-[120px] text-center">
                                    {formMediaUrl ? (
                                        formIsVideo ? (
                                            <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                                                <Video className="w-4 h-4" /> Video cargado
                                            </div>
                                        ) : (
                                            <img
                                                src={formMediaUrl}
                                                alt="Preview"
                                                className="w-full h-24 object-cover rounded-lg"
                                            />
                                        )
                                    ) : (
                                        <>
                                            {uploadingMedia ? (
                                                <Loader2 className="w-5 h-5 animate-spin text-[#4449AA]" />
                                            ) : (
                                                <Upload className="w-5 h-5 text-slate-400" />
                                            )}
                                            <span className="text-[11px] text-slate-500">Subir PNG / JPG / MP4</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*,video/mp4"
                                        onChange={handleUploadMedia}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Descripción (Caption)
                                </label>
                                <textarea
                                    rows={5}
                                    value={formCaption}
                                    onChange={(e) => setFormCaption(e.target.value)}
                                    placeholder="Escribe el texto para Facebook / Instagram…"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: 'publish_now', label: '🚀 Publicar ahora' },
                                    { id: 'schedule', label: '🗓️ Programar en Planning' },
                                    { id: 'draft', label: '📝 Guardar Borrador' },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setFormMode(m.id as any)}
                                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
                                            formMode === m.id
                                                ? 'bg-[#4449AA] border-[#4449AA] text-white'
                                                : 'bg-white border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            {formMode === 'schedule' && (
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-500" />
                                    <input
                                        type="datetime-local"
                                        value={formScheduledLocal}
                                        onChange={(e) => setFormScheduledLocal(e.target.value)}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowPostModal(false)}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={savingPost}
                                onClick={handleSavePostModal}
                                className="px-4 py-2 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold inline-flex items-center gap-1.5"
                            >
                                {savingPost ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                                {formMode === 'publish_now'
                                    ? 'Publicar ahora'
                                    : formMode === 'schedule'
                                    ? 'Guardar en Planning'
                                    : 'Guardar Borrador'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: CHATGPT CONNECTOR & TEAM TOKENS */}
            {showBridgeModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">
                                        Conectar ChatGPT Plus ($20/mes) con Arias CRM
                                    </h2>
                                    <p className="text-[11px] text-slate-500">
                                        Multi-empresa y por usuario (Jimmy, Patricia y futuros clientes SaaS).
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowBridgeModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {loadingBridge ? (
                            <div className="py-10 flex items-center justify-center text-xs text-slate-500 gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-[#4449AA]" /> Cargando credenciales y
                                esquema…
                            </div>
                        ) : (
                            <>
                                {/* Step 1: Personal / Team Token */}
                                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-4 h-4 text-[#4449AA]" />
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                            1. Token Privado de Usuario (Jimmy / Patricia)
                                        </h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            value={newTokenLabel}
                                            onChange={(e) => setNewTokenLabel(e.target.value)}
                                            placeholder="Ej. ChatGPT Patricia"
                                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs flex-1 min-w-[180px]"
                                        />
                                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newTokenPublishDirect}
                                                onChange={(e) => setNewTokenPublishDirect(e.target.checked)}
                                                className="accent-[#4449AA]"
                                            />
                                            <span>Permitir publicar directo</span>
                                        </label>
                                        <button
                                            type="button"
                                            disabled={creatingToken}
                                            onClick={handleCreateToken}
                                            className="px-3.5 py-1.5 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold inline-flex items-center gap-1.5"
                                        >
                                            {creatingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            Generar Token
                                        </button>
                                    </div>

                                    {revealedToken && (
                                        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 flex items-center justify-between gap-2">
                                            <div className="text-xs text-emerald-900 font-mono break-all">
                                                {revealedToken}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => copyText(revealedToken, 'Token')}
                                                className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                                            >
                                                <Copy className="w-3 h-3" /> Copiar
                                            </button>
                                        </div>
                                    )}

                                    {tokens.length > 0 && (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                                            {tokens.map((t) => (
                                                <div
                                                    key={t.id}
                                                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]"
                                                >
                                                    <div>
                                                        <span className="font-bold text-slate-800">{t.label}</span> ·{' '}
                                                        <code className="text-slate-500">{t.token_prefix}…</code> ·{' '}
                                                        <span className="text-slate-500">
                                                            {t.user_name || t.user_email || 'Usuario'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {t.is_active ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleTokenPermission(t)}
                                                                    className={`px-2 py-0.5 rounded border font-semibold ${
                                                                        t.can_publish_directly
                                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                            : 'bg-amber-50 border-amber-200 text-amber-800'
                                                                    }`}
                                                                >
                                                                    {t.can_publish_directly ? 'Publica directo' : 'Solo Borrador'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRevokeToken(t.id)}
                                                                    className="text-rose-600 font-semibold hover:underline"
                                                                >
                                                                    Revocar
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-400">Revocado</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Custom GPT OAuth + OpenAPI Schema */}
                                {bridgeSetup && (
                                    <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                                2. Configuración Custom GPT (1 sola vez para todo tu equipo/SaaS)
                                            </h3>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        copyText(
                                                            JSON.stringify(bridgeSetup.openapi_schema, null, 2),
                                                            'Esquema OpenAPI',
                                                        )
                                                    }
                                                    className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[#4449AA] text-[11px] font-bold inline-flex items-center gap-1"
                                                >
                                                    <Copy className="w-3 h-3" /> Copiar Esquema
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        copyText(bridgeSetup.instructions, 'Instrucciones GPT')
                                                    }
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-bold inline-flex items-center gap-1"
                                                >
                                                    <Copy className="w-3 h-3" /> Copiar Instrucciones
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                                <div className="font-bold text-slate-700 mb-0.5">
                                                    OAuth Authorization URL (para Patricia / SaaS 1 clic)
                                                </div>
                                                <div className="flex items-center justify-between gap-1">
                                                    <code className="text-[10px] text-slate-600 truncate">
                                                        {bridgeSetup.authorization_url}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            copyText(bridgeSetup.authorization_url, 'Authorization URL')
                                                        }
                                                        className="text-[#4449AA] font-bold shrink-0"
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                                <div className="font-bold text-slate-700 mb-0.5">OAuth Token URL</div>
                                                <div className="flex items-center justify-between gap-1">
                                                    <code className="text-[10px] text-slate-600 truncate">
                                                        {bridgeSetup.token_url}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(bridgeSetup.token_url, 'Token URL')}
                                                        className="text-[#4449AA] font-bold shrink-0"
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <textarea
                                            readOnly
                                            rows={5}
                                            value={JSON.stringify(bridgeSetup.openapi_schema, null, 2)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-700"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
