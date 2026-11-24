import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Copy,
    ExternalLink,
    Filter,
    Key,
    LayoutGrid,
    LayoutList,
    Link2,
    Loader2,
    MoreVertical,
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
import {
    AccountAvatarWithBadge,
    ChatGptIcon,
    FacebookIcon,
    ManageConnectionsModal,
    SocialConnectionsGrid,
    SocialNetworkBadge,
} from '../../components/social/SocialBrandKit';
import { PostLivePreview } from '../../components/social/PostLivePreview';

type PlanningTab = 'calendar' | 'list' | 'deleted' | 'connections';
type CalendarMode = 'hourly' | 'cards';

const STATUS_META: Record<string, { label: string; dot: string; borderLeft: string; pillCls: string }> = {
    scheduled: {
        label: 'Programado',
        dot: 'bg-indigo-500',
        borderLeft: 'border-l-indigo-500',
        pillCls: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    },
    published: {
        label: 'Publicado',
        dot: 'bg-emerald-500',
        borderLeft: 'border-l-emerald-500',
        pillCls: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    draft: {
        label: 'Borrador',
        dot: 'bg-amber-500',
        borderLeft: 'border-l-amber-500',
        pillCls: 'text-amber-800 bg-amber-50 border-amber-200',
    },
    publishing: {
        label: 'Publicando…',
        dot: 'bg-sky-500',
        borderLeft: 'border-l-sky-500',
        pillCls: 'text-sky-700 bg-sky-50 border-sky-200',
    },
    failed: {
        label: 'Error',
        dot: 'bg-rose-500',
        borderLeft: 'border-l-rose-500',
        pillCls: 'text-rose-700 bg-rose-50 border-rose-200',
    },
};

const EDITORIAL_LINES = ['AI + LEAN™', 'Motivación Empresarial', 'General'] as const;
const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHourLabel(hour: number): string {
    if (hour === 0) return '12:00 am';
    if (hour < 12) return `${hour}:00 am`;
    if (hour === 12) return '12:00 pm';
    return `${hour - 12}:00 pm`;
}

function getBestTimeLevel(dayIndex: number, hour: number): 0 | 1 | 2 {
    // 2 = horario pico, 1 = horario recomendado
    if (hour === 9 || hour === 19 || hour === 20) return dayIndex === 2 || dayIndex === 4 ? 2 : 1;
    if (hour === 8 || hour === 12 || hour === 13 || hour === 18) return 1;
    return 0;
}

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

function formatDatePartsSv(iso?: string | null): { date: string; time: string } {
    if (!iso) return { date: 'Sin fecha', time: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: 'Sin fecha', time: '' };
    return {
        date: d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
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
    return p.captions?.facebook || p.captions?.instagram || p.captions?.youtube || p.captions?.default || '';
}

function getPostTargets(p: PlanningSocialPost): TargetAccountRef[] {
    if (Array.isArray(p.target_account_ids) && p.target_account_ids.length > 0) {
        return p.target_account_ids;
    }
    return (p.platforms || []).map((pl) => ({ platform: pl, account_id: pl, account_name: pl }));
}

export default function SocialPlanning() {
    const { profile, simulatedCompanyId } = useAuth();
    const companyId = simulatedCompanyId || profile?.company_id || '';
    const [searchParams, setSearchParams] = useSearchParams();

    const initialTabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<PlanningTab>(
        initialTabParam === 'list' || initialTabParam === 'deleted' || initialTabParam === 'connections'
            ? initialTabParam
            : 'calendar',
    );
    const [calendarMode, setCalendarMode] = useState<CalendarMode>('hourly');
    const [showBestTimes, setShowBestTimes] = useState(true);
    const [showFiltersPopover, setShowFiltersPopover] = useState(false);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'connections' || tabParam === 'list' || tabParam === 'deleted' || tabParam === 'calendar') {
            setActiveTab(tabParam);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const [loading, setLoading] = useState(true);
    const [flagEnabled, setFlagEnabled] = useState<boolean | null>(null);
    const [companyName, setCompanyName] = useState('Arias Defense');

    const [posts, setPosts] = useState<PlanningSocialPost[]>([]);
    const [deletedPosts, setDeletedPosts] = useState<PlanningSocialPost[]>([]);
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);

    // Live clock display for El Salvador (-06:00)
    const [nowClock, setNowClock] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNowClock(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    // Calendar & list filters
    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekSunday(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [lineFilter, setLineFilter] = useState<string>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');

    // List bulk actions & row menu
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkMenu, setShowBulkMenu] = useState(false);
    const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);

    // Connections modal & default toggle
    const [showConnectionsModal, setShowConnectionsModal] = useState(false);
    const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

    // Create / Edit Post modal
    const [showPostModal, setShowPostModal] = useState(false);
    const [editingPost, setEditingPost] = useState<PlanningSocialPost | null>(null);
    const [formCaption, setFormCaption] = useState('');
    const [formYoutubeTitle, setFormYoutubeTitle] = useState('');
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
        mcp_url?: string;
        authorization_url: string;
        token_url: string;
        openapi_schema: Record<string, any>;
        instructions: string;
    } | null>(null);

    const hourlyScrollRef = useRef<HTMLDivElement | null>(null);

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
            setSelectedIds([]);
        } catch (err: any) {
            toast.error(err?.message || 'Error al cargar Social Planning');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Close menus when clicking outside
    useEffect(() => {
        const handler = () => {
            setOpenRowMenuId(null);
            setShowBulkMenu(false);
        };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    const handleSetDefaultAccount = async (account: SocialAccount) => {
        setSettingDefaultId(account.id);
        try {
            const same = accounts.filter(
                (a) => a.platform === account.platform && a.is_default && a.id !== account.id,
            );
            for (const a of same) {
                await socialPublishService.saveAccount({ ...a, is_default: false });
            }
            await socialPublishService.saveAccount({ ...account, is_default: true });
            toast.success(`${account.account_name} marcada como principal`);
            await loadAll();
        } catch {
            toast.error('No se pudo actualizar la cuenta principal');
        } finally {
            setSettingDefaultId(null);
        }
    };

    const handleDisconnectAccount = async (account: SocialAccount) => {
        if (!confirm(`¿Desconectar "${account.account_name}" de ${account.platform}?`)) return;
        try {
            await socialPublishService.disconnectAccount(account.id);
            toast.success('Cuenta desconectada');
            await loadAll();
        } catch {
            toast.error('No se pudo desconectar la cuenta');
        }
    };

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
                mcp_url: 'https://www.ariascrm.com/mcp',
                authorization_url: 'https://www.ariascrm.com/oauth/chatgpt-authorize',
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
                nextVal ? 'Token habilitado para publicar directo' : 'Restringido: solo Borrador/Planning',
            );
        } catch (err: any) {
            toast.error(err?.message || 'Error actualizando permiso');
        }
    };

    const openCreateModal = (presetDateKey?: string, presetHour?: number) => {
        setEditingPost(null);
        setFormCaption('');
        setFormYoutubeTitle('');
        setFormLine('AI + LEAN™');
        setFormEpisode('');
        setFormTopic('');
        setFormMode('schedule');
        if (presetDateKey) {
            const hh = String(presetHour ?? 9).padStart(2, '0');
            setFormScheduledLocal(`${presetDateKey}T${hh}:00`);
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
        setFormYoutubeTitle(post.captions?.youtube_title || '');
        setFormLine(post.editorial_line || 'AI + LEAN™');
        setFormEpisode(post.episode_label || '');
        setFormTopic(post.topic || '');
        setFormMode(post.status === 'scheduled' ? 'schedule' : post.status === 'published' ? 'schedule' : 'draft');
        setFormScheduledLocal(toDatetimeLocalValue(post.scheduled_at || post.published_at));
        const existingTargets = Array.isArray(post.target_account_ids) ? post.target_account_ids : [];
        setFormSelectedAccounts(existingTargets);
        setFormMediaUrl(post.content_url || '');
        setFormIsVideo(post.content_type === 'video' || post.content_type === 'reel');
        setShowPostModal(true);
    };

    const handleDuplicateAsDraft = async (post: PlanningSocialPost) => {
        setBusyPostId(post.id);
        try {
            const targets = getPostTargets(post);
            await socialPlanningService.createPlanningPost({
                companyId,
                contentUrl: post.content_url,
                contentType: post.content_type === 'video' || post.content_type === 'reel' ? 'video' : 'image',
                caption: postCaption(post),
                targets,
                editorialLine: post.editorial_line || 'AI + LEAN™',
                episodeLabel: post.episode_label ? `${post.episode_label} (Copia)` : null,
                topic: post.topic || null,
                status: 'draft',
                scheduledAt: null,
            });
            toast.success('Duplicado como borrador');
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo duplicar');
        } finally {
            setBusyPostId(null);
        }
    };

    const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyId) return;
        setUploadingMedia(true);
        try {
            const res = await socialPlanningService.uploadPlanningMedia(companyId, file);
            setFormMediaUrl(res.url);
            setFormIsVideo(res.isVideo);
            toast.success('Archivo cargado correctamente');
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
            toast.error('Escribe el texto (caption) del post');
            return;
        }
        if (formSelectedAccounts.length === 0) {
            toast.error('Selecciona al menos una red o página destino');
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
                    youtube_title: formYoutubeTitle.trim() || null,
                    content_url: formMediaUrl || editingPost.content_url,
                    content_type: formIsVideo ? 'video' : 'image',
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
                    youtubeTitle: formYoutubeTitle.trim() || null,
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
            toast.success('Restaurado como Borrador');
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo restaurar');
        } finally {
            setBusyPostId(null);
        }
    };

    const handleBulkPublish = async () => {
        if (selectedIds.length === 0) return;
        setBulkBusy(true);
        setShowBulkMenu(false);
        let ok = 0;
        let fail = 0;
        try {
            for (const id of selectedIds) {
                const post = posts.find((p) => p.id === id);
                if (!post || post.status === 'published') continue;
                try {
                    await socialPlanningService.publishPostNow(companyId, id);
                    ok++;
                } catch {
                    fail++;
                }
            }
            toast.success(`Publicación en lote: ${ok} enviada(s)${fail > 0 ? ` · ${fail} con error` : ''}`);
            await loadAll();
        } finally {
            setBulkBusy(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`¿Mover ${selectedIds.length} publicación(es) a Eliminados?`)) return;
        setBulkBusy(true);
        setShowBulkMenu(false);
        try {
            for (const id of selectedIds) {
                await socialPlanningService.softDeletePost(id, profile?.id, profile?.email);
            }
            toast.success(`${selectedIds.length} publicación(es) movidas a Eliminados`);
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'Error en acción en lote');
        } finally {
            setBulkBusy(false);
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
                dayName: d.toLocaleDateString('es-SV', { weekday: 'short' }).replace('.', ''),
                dayNum: d.getDate(),
            };
        });
    }, [weekStart]);

    const weekRangeLabel = useMemo(() => {
        const start = weekDays[0]?.date;
        const end = weekDays[6]?.date;
        if (!start || !end) return '';
        const fmt = (d: Date) => d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
        return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
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

    const postsByDayAndHour = useMemo(() => {
        const map: Record<string, PlanningSocialPost[]> = {};
        for (const day of weekDays) {
            for (const p of postsByDayKey[day.key] || []) {
                const d = new Date(postDisplayDate(p));
                const h = Number.isNaN(d.getTime()) ? 9 : d.getHours();
                const slotKey = `${day.key}_${h}`;
                if (!map[slotKey]) map[slotKey] = [];
                map[slotKey].push(p);
            }
        }
        return map;
    }, [weekDays, postsByDayKey]);

    // Auto-scroll hourly grid so visible posts (or business hours) appear in frame immediately
    useEffect(() => {
        if (activeTab !== 'calendar' || calendarMode !== 'hourly' || loading) return;
        const el = hourlyScrollRef.current;
        if (!el) return;

        let targetHour = 7;
        const weekHours: number[] = [];
        for (const day of weekDays) {
            for (const p of postsByDayKey[day.key] || []) {
                const d = new Date(postDisplayDate(p));
                if (!Number.isNaN(d.getTime())) weekHours.push(d.getHours());
            }
        }
        if (weekHours.length > 0) {
            const latestOrClosest = weekHours.sort((a, b) => a - b)[0];
            targetHour = Math.max(0, Math.min(latestOrClosest - 2, 16));
        }

        requestAnimationFrame(() => {
            el.scrollTo({ top: targetHour * HOUR_HEIGHT, behavior: 'auto' });
        });
    }, [activeTab, calendarMode, weekStart, loading, weekDays, postsByDayKey]);

    const activeFiltersCount = (lineFilter !== 'all' ? 1 : 0) + (accountFilter !== 'all' ? 1 : 0);
    const todayKey = toLocalDateKey(new Date());
    const svTimeFormatted = nowClock.toLocaleTimeString('es-SV', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    const currentHourFloat = nowClock.getHours() + nowClock.getMinutes() / 60;

    const allFilteredSelected =
        filteredPosts.length > 0 && filteredPosts.every((p) => selectedIds.includes(p.id));

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-600 text-sm font-medium bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                    <span>Cargando Planning comercial…</span>
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
                        Este módulo privado (<code>ai_content_studio_enabled</code>) está reservado para empresas
                        autorizadas. Tu <strong>Panel de Publicación</strong> clásico sigue operando normalmente.
                    </p>
                    <Link
                        to="/marketing/social"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Social Media Hub
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] text-slate-900 flex flex-col">
            {/* TOP COMMERCIAL HEADER + SUB-TABS */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        {/* Left: Clean Minimalist Underline Tabs */}
                        <div className="flex items-center gap-1 sm:gap-5 overflow-x-auto">
                            <Link
                                to="/marketing/social"
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 pb-3 pr-2 border-r border-slate-200 mr-1 whitespace-nowrap"
                                title="Volver a Social Media Hub clásico"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Social Hub</span>
                            </Link>

                            {[
                                { id: 'calendar' as PlanningTab, label: 'Calendario', count: null },
                                { id: 'list' as PlanningTab, label: 'Lista', count: posts.length },
                                { id: 'deleted' as PlanningTab, label: 'Eliminados', count: deletedPosts.length },
                                { id: 'connections' as PlanningTab, label: 'Conexiones', count: accounts.length },
                            ].map((t) => {
                                const isActive = activeTab === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setActiveTab(t.id)}
                                        className={`relative pb-3 px-1 text-[13px] whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                                            isActive
                                                ? 'text-slate-900 font-semibold border-b-2 border-zinc-900'
                                                : 'text-slate-500 font-medium hover:text-slate-800 border-b-2 border-transparent'
                                        }`}
                                    >
                                        <span>{t.label}</span>
                                        {t.count !== null && (
                                            <span
                                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                                    isActive
                                                        ? 'bg-zinc-900 text-white'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {t.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right: Clock, Connected Avatars Pill, ChatGPT Bridge CTA */}
                        <div className="flex items-center gap-2.5 pb-2.5">
                            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 pr-2 border-r border-slate-200">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{svTimeFormatted} · El Salvador (-06:00)</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowConnectionsModal(true)}
                                className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                                title="Gestionar conexiones de redes"
                            >
                                <div className="flex -space-x-1.5">
                                    {accounts.slice(0, 3).map((acc) => (
                                        <span
                                            key={acc.id}
                                            className="w-5 h-5 rounded-full ring-2 ring-white bg-white overflow-hidden flex items-center justify-center text-[9px] font-bold text-slate-700"
                                        >
                                            {acc.avatar_url ? (
                                                <img
                                                    src={acc.avatar_url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <SocialNetworkBadge platform={acc.platform} size="xs" />
                                            )}
                                        </span>
                                    ))}
                                </div>
                                <span className="text-xs font-medium text-slate-700">
                                    {accounts.length} {accounts.length === 1 ? 'red' : 'redes'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={openChatGptModal}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition cursor-pointer"
                            >
                                <ChatGptIcon className="w-3.5 h-3.5" />
                                <span>Conectar ChatGPT</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="MCP OAuth Activo" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4 flex-1 flex flex-col">
                {/* ACTION TOOLBAR (Calendar & List) */}
                {(activeTab === 'calendar' || activeTab === 'list') && (
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[220px] max-w-md">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por episodio, texto o campaña…"
                                className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Right Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                            {activeTab === 'calendar' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
                                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs cursor-pointer"
                                    >
                                        Hoy
                                    </button>

                                    {/* Week Navigator Pill */}
                                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const prev = new Date(weekStart);
                                                prev.setDate(prev.getDate() - 7);
                                                setWeekStart(prev);
                                            }}
                                            className="px-2.5 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-l-lg cursor-pointer"
                                            title="Semana anterior"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-800 border-x border-slate-100 whitespace-nowrap">
                                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{weekRangeLabel}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = new Date(weekStart);
                                                next.setDate(next.getDate() + 7);
                                                setWeekStart(next);
                                            }}
                                            className="px-2.5 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-r-lg cursor-pointer"
                                            title="Semana siguiente"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* View Switcher: Horas | Tarjetas */}
                                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                                        <button
                                            type="button"
                                            onClick={() => setCalendarMode('hourly')}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                                                calendarMode === 'hourly'
                                                    ? 'bg-slate-100 text-slate-900 font-semibold'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            <Clock className="w-3.5 h-3.5" />
                                            Horas
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCalendarMode('cards')}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                                                calendarMode === 'cards'
                                                    ? 'bg-slate-100 text-slate-900 font-semibold'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" />
                                            Tarjetas
                                        </button>
                                    </div>

                                    {/* Best Times Toggle */}
                                    {calendarMode === 'hourly' && (
                                        <button
                                            type="button"
                                            onClick={() => setShowBestTimes((v) => !v)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium shadow-2xs transition cursor-pointer ${
                                                showBestTimes
                                                    ? 'bg-sky-50 border-sky-200 text-slate-900 font-semibold'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                            title="Resaltar mejores horarios sugeridos de audiencia"
                                        >
                                            <FacebookIcon className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Mejores horarios</span>
                                        </button>
                                    )}
                                </>
                            )}

                            {activeTab === 'list' && (
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        disabled={selectedIds.length === 0 || bulkBusy}
                                        onClick={() => setShowBulkMenu((v) => !v)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium shadow-2xs transition ${
                                            selectedIds.length > 0
                                                ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold cursor-pointer'
                                                : 'bg-white border-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <span>
                                            Acciones en lote
                                            {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                                        </span>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                    {showBulkMenu && selectedIds.length > 0 && (
                                        <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30">
                                            <button
                                                type="button"
                                                onClick={handleBulkPublish}
                                                className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                Publicar seleccionados
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleBulkDelete}
                                                className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Mover a eliminados
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Compact Filter Popover */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowFiltersPopover((v) => !v)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium shadow-2xs transition cursor-pointer ${
                                        activeFiltersCount > 0
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                    title="Filtrar por línea editorial o página"
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">Filtros</span>
                                    {activeFiltersCount > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                </button>

                                {showFiltersPopover && (
                                    <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-900">Filtros</span>
                                            {activeFiltersCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLineFilter('all');
                                                        setAccountFilter('all');
                                                    }}
                                                    className="text-[11px] font-medium text-indigo-600 hover:underline"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                                Línea editorial
                                            </label>
                                            <select
                                                value={lineFilter}
                                                onChange={(e) => setLineFilter(e.target.value)}
                                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                                            >
                                                <option value="all">Todas las líneas</option>
                                                {EDITORIAL_LINES.map((l) => (
                                                    <option key={l} value={l}>
                                                        {l}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                                Página o cuenta destino
                                            </label>
                                            <select
                                                value={accountFilter}
                                                onChange={(e) => setAccountFilter(e.target.value)}
                                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                                            >
                                                <option value="all">Todas las cuentas</option>
                                                {accounts
                                                    .filter((a) => a.account_id)
                                                    .map((a) => (
                                                        <option
                                                            key={`${a.platform}-${a.account_id}`}
                                                            value={a.account_id!}
                                                        >
                                                            {a.platform.toUpperCase()} · {a.display_name || a.account_name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={loadAll}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-2xs cursor-pointer"
                                title="Actualizar datos"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => openCreateModal()}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Crear Post</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 1: CALENDAR (HOURLY & CARDS) */}
                {activeTab === 'calendar' && (
                    <>
                        {calendarMode === 'hourly' ? (
                            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col">
                                {/* Sticky 7-Day Header */}
                                <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-white pr-[6px]">
                                    <div className="py-2.5 px-2 text-[10px] font-medium text-slate-400 flex items-center justify-center border-r border-slate-100">
                                        -06:00
                                    </div>
                                    {weekDays.map((day) => {
                                        const isToday = day.key === todayKey;
                                        return (
                                            <div
                                                key={day.key}
                                                className="py-2 px-2 flex items-center justify-center border-r last:border-r-0 border-slate-100"
                                            >
                                                <div
                                                    className={`w-full py-1 px-2 rounded-md text-center text-xs font-semibold capitalize flex items-center justify-center gap-1.5 ${
                                                        isToday
                                                            ? 'bg-[#1C1917] text-white shadow-2xs'
                                                            : 'bg-slate-100 text-slate-700'
                                                    }`}
                                                >
                                                    <span>{day.dayNum}</span>
                                                    <span className="font-medium opacity-90">{day.dayName}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Scrollable Hourly Grid */}
                                <div
                                    ref={hourlyScrollRef}
                                    className="overflow-y-auto h-[calc(100vh-235px)] min-h-[540px] relative"
                                >
                                    <div className="relative min-w-[780px]">
                                        {HOURS.map((hour) => (
                                            <div
                                                key={hour}
                                                className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-slate-100"
                                                style={{ minHeight: `${HOUR_HEIGHT}px` }}
                                            >
                                                {/* Time Gutter */}
                                                <div className="px-2 py-1.5 text-[10px] font-medium text-slate-400 text-right border-r border-slate-100 bg-white select-none">
                                                    {formatHourLabel(hour)}
                                                </div>

                                                {/* 7 Day Cells */}
                                                {weekDays.map((day, dIdx) => {
                                                    const isToday = day.key === todayKey;
                                                    const slotPosts = postsByDayAndHour[`${day.key}_${hour}`] || [];
                                                    const heat = showBestTimes ? getBestTimeLevel(dIdx, hour) : 0;

                                                    const cellBg =
                                                        heat === 2
                                                            ? 'bg-[#dbeafe]/75 hover:bg-[#bfdbfe]/60'
                                                            : heat === 1
                                                            ? 'bg-[#eff6ff]/85 hover:bg-[#dbeafe]/55'
                                                            : isToday
                                                            ? 'bg-slate-50/50 hover:bg-slate-100/70'
                                                            : 'bg-white hover:bg-slate-50';

                                                    return (
                                                        <div
                                                            key={`${day.key}_${hour}`}
                                                            onClick={() => {
                                                                if (slotPosts.length === 0) {
                                                                    openCreateModal(day.key, hour);
                                                                }
                                                            }}
                                                            className={`group relative border-r last:border-r-0 border-slate-100 p-1 transition ${
                                                                slotPosts.length === 0 ? 'cursor-pointer' : ''
                                                            } ${cellBg}`}
                                                        >
                                                            {/* Current Time Line Indicator */}
                                                            {isToday &&
                                                                Math.floor(currentHourFloat) === hour && (
                                                                    <div
                                                                        className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                                                                        style={{
                                                                            top: `${(currentHourFloat - hour) * 100}%`,
                                                                        }}
                                                                    >
                                                                        <span className="w-2 h-2 rounded-full bg-zinc-900 -ml-1" />
                                                                        <div className="flex-1 h-[1.5px] bg-zinc-900" />
                                                                    </div>
                                                                )}

                                                            {slotPosts.length === 0 ? (
                                                                <span className="opacity-0 group-hover:opacity-100 transition text-[10px] font-medium text-slate-500 px-1.5 py-0.5 rounded bg-white/90 border border-slate-200 shadow-2xs inline-flex items-center gap-0.5">
                                                                    <Plus className="w-2.5 h-2.5" />
                                                                    {String(hour).padStart(2, '0')}:00
                                                                </span>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {slotPosts.map((p) => {
                                                                        const st = STATUS_META[p.status] || STATUS_META.draft;
                                                                        const targets = getPostTargets(p);
                                                                        const uniquePlats = [
                                                                            ...new Set(targets.map((t) => t.platform)),
                                                                        ];
                                                                        return (
                                                                            <div
                                                                                key={p.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openEditModal(p);
                                                                                }}
                                                                                className={`bg-white border border-slate-200 border-l-[3px] ${st.borderLeft} rounded-lg p-1.5 shadow-2xs hover:shadow-sm hover:border-slate-300 cursor-pointer transition flex items-start gap-2`}
                                                                            >
                                                                                {p.content_url && (
                                                                                    <div className="w-9 h-9 rounded-md bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                                                                                        {p.content_type === 'video' ? (
                                                                                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                                                                <Video className="w-4 h-4" />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <img
                                                                                                src={p.content_url}
                                                                                                alt=""
                                                                                                className="w-full h-full object-cover"
                                                                                            />
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                                                    <div className="flex items-center justify-between gap-1">
                                                                                        <span className="text-[10px] font-semibold text-slate-600">
                                                                                            {formatTimeOnly(
                                                                                                postDisplayDate(p),
                                                                                            )}
                                                                                        </span>
                                                                                        <div className="flex items-center -space-x-1">
                                                                                            {uniquePlats.map((pl) => (
                                                                                                <SocialNetworkBadge
                                                                                                    key={pl}
                                                                                                    platform={pl}
                                                                                                    size="xs"
                                                                                                />
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                    <p className="text-[11px] font-semibold text-slate-900 truncate">
                                                                                        {p.episode_label || postCaption(p)}
                                                                                    </p>
                                                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                                                        <span
                                                                                            className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                                                                                        />
                                                                                        <span className="truncate">
                                                                                            {st.label}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Compact Cards View */
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                                    {weekDays.map((day) => {
                                        const isToday = day.key === todayKey;
                                        const dayPosts = postsByDayKey[day.key] || [];
                                        return (
                                            <div
                                                key={day.key}
                                                className={`rounded-xl border min-h-[300px] flex flex-col ${
                                                    isToday
                                                        ? 'border-zinc-900 bg-slate-50/40'
                                                        : 'border-slate-200 bg-slate-50/30'
                                                }`}
                                            >
                                                <div
                                                    className={`px-3 py-2 border-b flex items-center justify-between text-xs font-semibold rounded-t-xl ${
                                                        isToday
                                                            ? 'bg-zinc-900 text-white border-zinc-900'
                                                            : 'bg-white text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    <span className="capitalize">
                                                        {day.dayNum} {day.dayName}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => openCreateModal(day.key)}
                                                        className={`p-1 rounded-md transition ${
                                                            isToday
                                                                ? 'hover:bg-white/15 text-white'
                                                                : 'hover:bg-slate-100 text-slate-500'
                                                        }`}
                                                        title="Programar en este día"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                <div className="p-2 space-y-2 flex-1">
                                                    {dayPosts.length === 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openCreateModal(day.key)}
                                                            className="w-full h-24 rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400 hover:border-slate-400 hover:text-slate-700 transition cursor-pointer"
                                                        >
                                                            + Programar
                                                        </button>
                                                    ) : (
                                                        dayPosts.map((p) => {
                                                            const st = STATUS_META[p.status] || STATUS_META.draft;
                                                            const uniquePlats = [
                                                                ...new Set(
                                                                    getPostTargets(p).map((t) => t.platform),
                                                                ),
                                                            ];
                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    onClick={() => openEditModal(p)}
                                                                    className="bg-white border border-slate-200 hover:border-slate-400 rounded-lg p-2 cursor-pointer shadow-2xs space-y-1.5 transition"
                                                                >
                                                                    <div className="flex items-center justify-between gap-1 text-[10px]">
                                                                        <span className="font-semibold text-slate-700">
                                                                            {formatTimeOnly(postDisplayDate(p))}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                                                            <span
                                                                                className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                                                                            />
                                                                            {st.label}
                                                                        </span>
                                                                    </div>
                                                                    {p.content_url && (
                                                                        <div className="w-full h-24 rounded-md bg-slate-100 overflow-hidden">
                                                                            {p.content_type === 'video' ? (
                                                                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[11px] gap-1">
                                                                                    <Video className="w-4 h-4" /> Video
                                                                                </div>
                                                                            ) : (
                                                                                <img
                                                                                    src={p.content_url}
                                                                                    alt=""
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {p.episode_label && (
                                                                        <div className="text-[11px] font-bold text-slate-900 truncate">
                                                                            {p.episode_label}
                                                                        </div>
                                                                    )}
                                                                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                                                                        {postCaption(p)}
                                                                    </p>
                                                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                                        <div className="flex items-center gap-1">
                                                                            {uniquePlats.map((pl) => (
                                                                                <SocialNetworkBadge
                                                                                    key={pl}
                                                                                    platform={pl}
                                                                                    size="xs"
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                                            {p.source === 'chatgpt' ? 'ChatGPT' : 'CRM'}
                                                                        </span>
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
                    </>
                )}

                {/* TAB 2: LIST (METRICOOL COMMERCIAL TABLE) */}
                {activeTab === 'list' && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-1.5">
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
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                                        statusFilter === s.k
                                            ? 'bg-zinc-900 border-zinc-900 text-white'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-visible">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-medium bg-slate-50/60">
                                            <th className="py-3 pl-4 pr-2 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={allFilteredSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedIds(filteredPosts.map((p) => p.id));
                                                        } else {
                                                            setSelectedIds([]);
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 accent-zinc-900 cursor-pointer"
                                                />
                                            </th>
                                            <th className="py-3 px-3 font-medium">Fecha</th>
                                            <th className="py-3 px-3 font-medium">Contenido del post</th>
                                            <th className="py-3 px-3 font-medium">Redes</th>
                                            <th className="py-3 px-3 font-medium">Estado</th>
                                            <th className="py-3 pr-4 pl-2 w-12 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredPosts.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                                                    No hay publicaciones que coincidan con tus filtros. Crea una arriba o
                                                    envía un flyer desde ChatGPT Plus.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPosts.map((p) => {
                                                const st = STATUS_META[p.status] || STATUS_META.draft;
                                                const targets = getPostTargets(p);
                                                const dateParts = formatDatePartsSv(postDisplayDate(p));
                                                const isChecked = selectedIds.includes(p.id);

                                                return (
                                                    <tr
                                                        key={p.id}
                                                        className={`hover:bg-slate-50/80 transition ${
                                                            isChecked ? 'bg-indigo-50/30' : ''
                                                        }`}
                                                    >
                                                        <td className="py-3.5 pl-4 pr-2 align-middle">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedIds((prev) => [...prev, p.id]);
                                                                    } else {
                                                                        setSelectedIds((prev) =>
                                                                            prev.filter((id) => id !== p.id),
                                                                        );
                                                                    }
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 accent-zinc-900 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-3.5 px-3 whitespace-nowrap align-middle">
                                                            <div className="text-[12px] font-medium text-slate-800">
                                                                {dateParts.date}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {dateParts.time}
                                                            </div>
                                                        </td>
                                                        <td
                                                            className="py-3.5 px-3 align-middle cursor-pointer"
                                                            onClick={() => openEditModal(p)}
                                                        >
                                                            <div className="flex items-start gap-3 max-w-2xl">
                                                                {p.content_url && (
                                                                    <img
                                                                        src={p.content_url}
                                                                        alt="Flyer"
                                                                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                                                                    />
                                                                )}
                                                                <div className="min-w-0 space-y-0.5">
                                                                    {(p.episode_label || p.source === 'chatgpt') && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            {p.episode_label && (
                                                                                <span className="text-[10px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                    {p.episode_label}
                                                                                </span>
                                                                            )}
                                                                            {p.editorial_line && (
                                                                                <span className="text-[10px] text-slate-500">
                                                                                    {p.editorial_line}
                                                                                </span>
                                                                            )}
                                                                            {p.source === 'chatgpt' && (
                                                                                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                                    ChatGPT
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    <p className="text-[12px] text-slate-700 line-clamp-2 leading-relaxed">
                                                                        {postCaption(p)}
                                                                    </p>
                                                                    {p.error_message && (
                                                                        <p className="text-[11px] text-rose-600">
                                                                            {p.error_message}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 align-middle">
                                                            <div className="flex items-center gap-1.5">
                                                                {targets.map((t, i) => (
                                                                    <SocialNetworkBadge
                                                                        key={`${t.platform}-${t.account_id}-${i}`}
                                                                        platform={t.platform}
                                                                        size="sm"
                                                                        title={`${t.platform.toUpperCase()} · ${t.account_name || t.account_id}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 whitespace-nowrap align-middle">
                                                            <span className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-700">
                                                                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                                                                {st.label}
                                                            </span>
                                                        </td>
                                                        <td
                                                            className="py-3.5 pr-4 pl-2 text-right align-middle relative"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                disabled={busyPostId === p.id}
                                                                onClick={() =>
                                                                    setOpenRowMenuId((prev) =>
                                                                        prev === p.id ? null : p.id,
                                                                    )
                                                                }
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                                            >
                                                                {busyPostId === p.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <MoreVertical className="w-4 h-4" />
                                                                )}
                                                            </button>

                                                            {openRowMenuId === p.id && (
                                                                <div className="absolute right-4 top-11 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 text-left">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setOpenRowMenuId(null);
                                                                            openEditModal(p);
                                                                        }}
                                                                        className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
                                                                    >
                                                                        Editar / Ver detalle
                                                                    </button>
                                                                    {p.status !== 'published' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setOpenRowMenuId(null);
                                                                                handlePublishNow(p);
                                                                            }}
                                                                            className="w-full px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 font-medium flex items-center gap-2"
                                                                        >
                                                                            Publicar ahora
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setOpenRowMenuId(null);
                                                                            handleDuplicateAsDraft(p);
                                                                        }}
                                                                        className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
                                                                    >
                                                                        Duplicar como borrador
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setOpenRowMenuId(null);
                                                                            handleSoftDelete(p);
                                                                        }}
                                                                        className="w-full px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2 border-t border-slate-100 mt-0.5"
                                                                    >
                                                                        Mover a eliminados
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: DELETED POSTS */}
                {activeTab === 'deleted' && (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-medium bg-slate-50/60">
                                        <th className="py-3 px-4 font-medium">Fecha original</th>
                                        <th className="py-3 px-4 font-medium">Contenido</th>
                                        <th className="py-3 px-4 font-medium">Eliminado el</th>
                                        <th className="py-3 px-4 font-medium">Eliminado por</th>
                                        <th className="py-3 px-4 font-medium text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {deletedPosts.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-slate-400">
                                                La papelera de Eliminados está vacía.
                                            </td>
                                        </tr>
                                    ) : (
                                        deletedPosts.map((p) => {
                                            const orig = formatDatePartsSv(postDisplayDate(p));
                                            const del = formatDatePartsSv(p.deleted_at);
                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50/80">
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                                                        <div>{orig.date}</div>
                                                        <div className="text-[11px] text-slate-400">{orig.time}</div>
                                                    </td>
                                                    <td className="py-3.5 px-4 max-w-lg">
                                                        <div className="flex items-center gap-3">
                                                            {p.content_url && (
                                                                <img
                                                                    src={p.content_url}
                                                                    alt=""
                                                                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                                                                />
                                                            )}
                                                            <p className="text-slate-700 line-clamp-2">{postCaption(p)}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                                                        {del.date} {del.time}
                                                    </td>
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                                                        {p.deleted_by_email || 'Administrador CRM'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <button
                                                            type="button"
                                                            disabled={busyPostId === p.id}
                                                            onClick={() => handleRestore(p)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs cursor-pointer"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
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

                {/* TAB 4: CONNECTIONS (INLINE METRICOOL-GRADE GRID) */}
                {activeTab === 'connections' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Gestionar conexiones</h2>
                                <p className="text-xs text-slate-500">
                                    Redes sociales activas para publicación automática desde Planning y ChatGPT Plus.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => openCreateModal()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-semibold"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Crear Post
                            </button>
                        </div>

                        <SocialConnectionsGrid
                            accounts={accounts}
                            companyId={companyId}
                            loading={loading}
                            onRefresh={loadAll}
                            onSetDefault={handleSetDefaultAccount}
                            onDisconnect={handleDisconnectAccount}
                            settingDefaultId={settingDefaultId}
                        />
                    </div>
                )}
            </main>

            {/* MODAL: 2-COLUMN COMMERCIAL CREATE / EDIT POST + LIVE PREVIEW */}
            {showPostModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    {editingPost ? 'Editar publicación' : 'Crear nueva publicación'}
                                </h2>
                                <p className="text-[11px] text-slate-500">
                                    Configura tus redes, multimedia y fecha de publicación en El Salvador (-06:00).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPostModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1">
                            {/* Left Column: Composer */}
                            <div className="lg:col-span-7 p-6 space-y-5 overflow-y-auto">
                                {/* Account Selector */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-semibold text-slate-800">
                                            Publicar en ({formSelectedAccounts.length} seleccionadas)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowPostModal(false);
                                                setShowConnectionsModal(true);
                                            }}
                                            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                                        >
                                            <Link2 className="w-3 h-3" /> Gestionar cuentas
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {accounts.map((acc) => {
                                            const selected = formSelectedAccounts.some(
                                                (t) =>
                                                    t.platform === acc.platform &&
                                                    t.account_id === acc.account_id,
                                            );
                                            return (
                                                <button
                                                    key={acc.id}
                                                    type="button"
                                                    onClick={() => toggleFormTarget(acc)}
                                                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                                                        selected
                                                            ? 'border-zinc-900 bg-slate-50 ring-1 ring-zinc-900'
                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <AccountAvatarWithBadge account={acc} size="sm" />
                                                        <span className="text-xs font-medium text-slate-800 truncate">
                                                            {acc.display_name || acc.account_name}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 ${
                                                            selected
                                                                ? 'bg-zinc-900 border-zinc-900 text-white'
                                                                : 'border-slate-300 bg-white'
                                                        }`}
                                                    >
                                                        {selected && <Check className="w-2.5 h-2.5" />}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Caption + Media */}
                                <div className="space-y-3">
                                    {formSelectedAccounts.some((t) => t.platform === 'youtube') && (
                                        <div className="rounded-xl bg-red-50/70 border border-red-200/80 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-red-900">
                                                    Título del video en YouTube
                                                </label>
                                                <span className="text-[10px] text-red-600">
                                                    {formYoutubeTitle.length} / 100
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                maxLength={100}
                                                value={formYoutubeTitle}
                                                onChange={(e) => setFormYoutubeTitle(e.target.value)}
                                                placeholder="Ej. IA + Lean Episodio 22: Cómo eliminar errores"
                                                className="w-full px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-red-400"
                                            />
                                            {!formIsVideo && (
                                                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1">
                                                    YouTube solo admite archivo de video (MP4 o MOV). Sube un video abajo.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-800">Texto del post</label>
                                        <span className="text-[11px] text-slate-400">
                                            {formCaption.length} / 2,200 caracteres
                                        </span>
                                    </div>
                                    <textarea
                                        rows={5}
                                        value={formCaption}
                                        onChange={(e) => setFormCaption(e.target.value)}
                                        placeholder="Escribe aquí el mensaje para Facebook, Instagram o YouTube…"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-slate-400"
                                    />

                                    <div className="flex items-center gap-3">
                                        <label className="flex-1 border border-dashed border-slate-300 hover:border-slate-500 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer bg-slate-50/50 transition">
                                            {formMediaUrl ? (
                                                <>
                                                    {formIsVideo ? (
                                                        <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                                                            <Video className="w-5 h-5" />
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={formMediaUrl}
                                                            alt="Media"
                                                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                                                        />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-semibold text-slate-800">
                                                            Archivo multimedia listo
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            Clic aquí para reemplazar imagen o video
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                                                        {uploadingMedia ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                                                        ) : (
                                                            <Upload className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-semibold text-slate-800">
                                                            Subir imagen o video
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            PNG, JPG, MP4 o MOV (YouTube usa MP4/MOV)
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*,video/mp4,video/quicktime,video/webm"
                                                onChange={handleUploadMedia}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Editorial Metadata */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Línea editorial
                                        </label>
                                        <select
                                            value={formLine}
                                            onChange={(e) => setFormLine(e.target.value)}
                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-800"
                                        >
                                            {EDITORIAL_LINES.map((l) => (
                                                <option key={l} value={l}>
                                                    {l}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Episodio / Etiqueta
                                        </label>
                                        <input
                                            type="text"
                                            value={formEpisode}
                                            onChange={(e) => setFormEpisode(e.target.value)}
                                            placeholder="Ej. EPISODIO 22"
                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Tema corto
                                        </label>
                                        <input
                                            type="text"
                                            value={formTopic}
                                            onChange={(e) => setFormTopic(e.target.value)}
                                            placeholder="Ej. Control visual"
                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Publish Mode */}
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'publish_now', label: 'Publicar ahora' },
                                            { id: 'schedule', label: 'Programar fecha' },
                                            { id: 'draft', label: 'Guardar borrador' },
                                        ].map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setFormMode(m.id as any)}
                                                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                                                    formMode === m.id
                                                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xs'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
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
                                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                                            />
                                            <span className="text-[11px] text-slate-500">Hora El Salvador (-06:00)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Live Feed Preview */}
                            <div className="lg:col-span-5">
                                <PostLivePreview
                                    caption={formCaption}
                                    youtubeTitle={formYoutubeTitle}
                                    mediaUrl={formMediaUrl}
                                    isVideo={formIsVideo}
                                    selectedAccounts={formSelectedAccounts}
                                    accounts={accounts}
                                    scheduledLabel={
                                        formMode === 'schedule' && formScheduledLocal
                                            ? `Programado · ${formScheduledLocal.replace('T', ' ')}`
                                            : formMode === 'draft'
                                            ? 'Borrador · El Salvador'
                                            : 'Publicar ahora · El Salvador'
                                    }
                                />
                            </div>
                        </div>

                        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowPostModal(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={savingPost}
                                onClick={handleSavePostModal}
                                className="px-5 py-2 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                {savingPost ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                                {formMode === 'publish_now'
                                    ? 'Publicar ahora'
                                    : formMode === 'schedule'
                                    ? 'Guardar programación'
                                    : 'Guardar borrador'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: MANAGE CONNECTIONS (3-COLUMN METRICOOL GRID) */}
            <ManageConnectionsModal
                open={showConnectionsModal}
                onClose={() => setShowConnectionsModal(false)}
                accounts={accounts}
                companyId={companyId}
                loading={loading}
                onRefresh={loadAll}
                onSetDefault={handleSetDefaultAccount}
                onDisconnect={handleDisconnectAccount}
                settingDefaultId={settingDefaultId}
            />

            {/* MODAL: CHATGPT MCP CONNECTOR & TEAM TOKENS */}
            {showBridgeModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                            <div className="flex items-center gap-3">
                                <ChatGptIcon className="w-8 h-8" />
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">
                                        Conector oficial ChatGPT Plus (MCP + OAuth 2.1)
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Multi-empresa y por usuario (Jimmy, Patricia y futuros clientes SaaS).
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowBridgeModal(false)}
                                className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {loadingBridge ? (
                            <div className="py-10 flex items-center justify-center text-xs text-slate-500 gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" /> Cargando servidor MCP…
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1">
                                                Activo · ChatGPT Plugins / Custom MCP Server
                                            </span>
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                                1. Conectar ChatGPT con 1 sola URL (OAuth en 1 clic)
                                            </h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyText(
                                                    bridgeSetup?.mcp_url || 'https://www.ariascrm.com/mcp',
                                                    'URL del Servidor MCP',
                                                )
                                            }
                                            className="px-3.5 py-2 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5" /> Copiar URL MCP
                                        </button>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                                        <code className="text-xs font-mono font-bold text-slate-900 truncate">
                                            {bridgeSetup?.mcp_url || 'https://www.ariascrm.com/mcp'}
                                        </code>
                                        <a
                                            href="https://chatgpt.com/plugins"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-semibold text-slate-700 hover:text-zinc-900 inline-flex items-center gap-1 shrink-0"
                                        >
                                            Abrir ChatGPT Plugins <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>

                                    <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-700">
                                        <li className="p-2.5 rounded-lg bg-white border border-slate-200">
                                            <strong className="text-slate-900 block mb-0.5">1. Abre Plugins</strong>
                                            En <code>chatgpt.com/plugins</code> elige <strong>+ → Add custom MCP server</strong>.
                                        </li>
                                        <li className="p-2.5 rounded-lg bg-white border border-slate-200">
                                            <strong className="text-slate-900 block mb-0.5">2. Pega la URL MCP</strong>
                                            Pega la URL de arriba y selecciona autenticación <strong>OAuth</strong>.
                                        </li>
                                        <li className="p-2.5 rounded-lg bg-white border border-slate-200">
                                            <strong className="text-slate-900 block mb-0.5">3. Autoriza 1 clic</strong>
                                            Inicia sesión con tu usuario CRM y permite acceso.
                                        </li>
                                    </ol>
                                </div>

                                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-4 h-4 text-slate-700" />
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                            2. Sesiones Conectadas y Tokens de Equipo (Jimmy / Patricia)
                                        </h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            value={newTokenLabel}
                                            onChange={(e) => setNewTokenLabel(e.target.value)}
                                            placeholder="Ej. ChatGPT Patricia"
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs flex-1 min-w-[180px]"
                                        />
                                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newTokenPublishDirect}
                                                onChange={(e) => setNewTokenPublishDirect(e.target.checked)}
                                                className="accent-zinc-900"
                                            />
                                            <span>Permitir publicar directo</span>
                                        </label>
                                        <button
                                            type="button"
                                            disabled={creatingToken}
                                            onClick={handleCreateToken}
                                            className="px-3.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                        >
                                            {creatingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            Generar Token
                                        </button>
                                    </div>

                                    {revealedToken && (
                                        <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 flex items-center justify-between gap-2">
                                            <div className="text-xs text-emerald-900 font-mono break-all">
                                                {revealedToken}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => copyText(revealedToken, 'Token')}
                                                className="px-2.5 py-1 rounded-md bg-emerald-700 text-white text-[11px] font-semibold shrink-0 inline-flex items-center gap-1"
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
                                                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
                                                >
                                                    <div>
                                                        <span className="font-semibold text-slate-800">{t.label}</span> ·{' '}
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
                                                                    {t.can_publish_directly
                                                                        ? 'Publica directo'
                                                                        : 'Solo Borrador'}
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

                                {bridgeSetup && (
                                    <details className="rounded-xl border border-slate-200 p-4 space-y-3">
                                        <summary className="text-xs font-bold text-slate-700 cursor-pointer select-none flex items-center justify-between">
                                            <span>3. Instrucciones de Estilo &amp; Referencia OAuth / OpenAPI Avanzada</span>
                                            <span className="text-[11px] font-normal text-slate-500">Clic para ver</span>
                                        </summary>
                                        <div className="flex flex-wrap gap-2 pt-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copyText(
                                                        bridgeSetup.instructions,
                                                        'Instrucciones Editorial ChatGPT',
                                                    )
                                                }
                                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1"
                                            >
                                                <Copy className="w-3 h-3" /> Copiar Instrucciones AI + LEAN™
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copyText(
                                                        JSON.stringify(bridgeSetup.openapi_schema, null, 2),
                                                        'Esquema OpenAPI',
                                                    )
                                                }
                                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1"
                                            >
                                                <Copy className="w-3 h-3" /> Copiar Esquema OpenAPI
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                                <div className="font-semibold text-slate-700 mb-0.5">
                                                    OAuth Authorization URL
                                                </div>
                                                <div className="flex items-center justify-between gap-1">
                                                    <code className="text-[10px] text-slate-600 truncate">
                                                        {bridgeSetup.authorization_url}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            copyText(
                                                                bridgeSetup.authorization_url,
                                                                'Authorization URL',
                                                            )
                                                        }
                                                        className="text-slate-900 font-semibold shrink-0"
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                                <div className="font-semibold text-slate-700 mb-0.5">
                                                    OAuth Token URL
                                                </div>
                                                <div className="flex items-center justify-between gap-1">
                                                    <code className="text-[10px] text-slate-600 truncate">
                                                        {bridgeSetup.token_url}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            copyText(bridgeSetup.token_url, 'Token URL')
                                                        }
                                                        className="text-slate-900 font-semibold shrink-0"
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </details>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
