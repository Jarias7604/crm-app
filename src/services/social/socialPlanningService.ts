import { supabase } from '../supabase';
import { getSimulatedCompanyId, simGuard } from '../simGuard';
import {
    buildChatGptOpenApiSchema,
    buildChatGptSystemInstructions,
    type TargetAccountRef,
} from '../../../supabase/functions/arias-social-bridge/helpers';

export { buildChatGptOpenApiSchema, buildChatGptSystemInstructions };
export type { TargetAccountRef };

export interface PlanningSocialPost {
    id: string;
    company_id: string;
    content_url: string | null;
    content_type: 'image' | 'video' | 'reel' | 'story';
    captions: Record<string, string>;
    platforms: string[];
    target_account_ids?: TargetAccountRef[];
    editorial_line?: string | null;
    episode_label?: string | null;
    topic?: string | null;
    source?: string | null;
    status: 'draft' | 'publishing' | 'published' | 'scheduled' | 'failed';
    scheduled_at: string | null;
    published_at: string | null;
    deleted_at?: string | null;
    deleted_by?: string | null;
    deleted_by_email?: string | null;
    error_message?: string | null;
    results: Record<string, any>;
    created_by: string | null;
    created_at: string;
    updated_at?: string | null;
}

export interface SocialBridgeTokenRecord {
    id: string;
    label: string;
    token_prefix: string;
    can_publish_directly: boolean;
    is_active: boolean;
    last_used_at: string | null;
    created_at: string;
    user_id: string;
    user_name?: string | null;
    user_email?: string | null;
}

async function invokeBridge<T = any>(body: Record<string, any>): Promise<T> {
    const simId = getSimulatedCompanyId();
    const { data, error } = await supabase.functions.invoke('arias-social-bridge', {
        body,
        headers: simId ? { 'x-company-id': simId } : undefined,
    });
    if (error) throw new Error(error.message || 'Error al invocar arias-social-bridge');
    if (data && data.ok === false) {
        throw new Error(data.error || 'El conector reportó un error');
    }
    return data as T;
}

export const socialPlanningService = {
    async listPosts(includeDeleted = false): Promise<PlanningSocialPost[]> {
        let query = supabase
            .from('social_posts')
            .select('*')
            .order('scheduled_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(150);

        query = simGuard(query);
        if (includeDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.is('deleted_at', null);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as PlanningSocialPost[];
    },

    async uploadPlanningMedia(companyId: string, file: File): Promise<{ url: string; isVideo: boolean }> {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const isVideo = file.type.startsWith('video/') || ext === 'mp4' || ext === 'mov' || ext === 'webm';
        const filePath = `social/${companyId}/planning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
            .from('marketing_assets')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!upErr) {
            const {
                data: { publicUrl },
            } = supabase.storage.from('marketing_assets').getPublicUrl(filePath);
            return { url: publicUrl, isVideo };
        }

        const fallbackPath = `public/social-planning/${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: fbErr } = await supabase.storage
            .from('avatars')
            .upload(fallbackPath, file, { cacheControl: '3600', upsert: true });
        if (fbErr) throw fbErr;

        const {
            data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(fallbackPath);

        return { url: publicUrl, isVideo };
    },

    async createPlanningPost(input: {
        companyId: string;
        contentUrl: string | null;
        contentType: 'image' | 'video';
        caption: string;
        youtubeTitle?: string | null;
        targets: TargetAccountRef[];
        editorialLine?: string | null;
        episodeLabel?: string | null;
        topic?: string | null;
        status: 'draft' | 'scheduled' | 'publishing';
        scheduledAt?: string | null;
    }): Promise<PlanningSocialPost> {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const platforms = [...new Set(input.targets.map((t) => t.platform))];
        const captions: Record<string, string> = { default: input.caption };
        for (const plat of platforms) {
            captions[plat] = input.caption;
        }
        if (input.youtubeTitle?.trim()) {
            captions.youtube_title = input.youtubeTitle.trim().slice(0, 100);
        }

        const { data, error } = await supabase
            .from('social_posts')
            .insert({
                company_id: input.companyId,
                content_url: input.contentUrl,
                content_type: input.contentType,
                captions,
                platforms,
                target_account_ids: input.targets,
                editorial_line: input.editorialLine || null,
                episode_label: input.episodeLabel || null,
                topic: input.topic || null,
                source: 'crm',
                status: input.status,
                scheduled_at: input.scheduledAt || null,
                created_by: user?.id || null,
            })
            .select('*')
            .single();

        if (error) throw error;
        return data as PlanningSocialPost;
    },

    async updatePlanningPost(
        postId: string,
        patch: {
            caption?: string;
            youtube_title?: string | null;
            content_url?: string | null;
            content_type?: 'image' | 'video' | 'reel' | 'story';
            platforms?: string[];
            target_account_ids?: TargetAccountRef[];
            editorial_line?: string | null;
            episode_label?: string | null;
            topic?: string | null;
            status?: PlanningSocialPost['status'];
            scheduled_at?: string | null;
        },
    ): Promise<void> {
        const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };
        if (patch.caption !== undefined) {
            const plats = patch.platforms || ['facebook'];
            const capObj: Record<string, string> = { default: patch.caption };
            for (const p of plats) capObj[p] = patch.caption;
            if (patch.youtube_title?.trim()) {
                capObj.youtube_title = patch.youtube_title.trim().slice(0, 100);
            }
            payload.captions = capObj;
        }
        if (patch.content_url !== undefined) payload.content_url = patch.content_url;
        if (patch.content_type !== undefined) payload.content_type = patch.content_type;
        if (patch.platforms !== undefined) payload.platforms = patch.platforms;
        if (patch.target_account_ids !== undefined) payload.target_account_ids = patch.target_account_ids;
        if (patch.editorial_line !== undefined) payload.editorial_line = patch.editorial_line;
        if (patch.episode_label !== undefined) payload.episode_label = patch.episode_label;
        if (patch.topic !== undefined) payload.topic = patch.topic;
        if (patch.status !== undefined) payload.status = patch.status;
        if (patch.scheduled_at !== undefined) payload.scheduled_at = patch.scheduled_at;

        const { error } = await supabase.from('social_posts').update(payload).eq('id', postId);
        if (error) throw error;
    },

    async softDeletePost(postId: string, userId?: string | null, userEmail?: string | null): Promise<void> {
        const { error } = await supabase
            .from('social_posts')
            .update({
                deleted_at: new Date().toISOString(),
                deleted_by: userId || null,
                deleted_by_email: userEmail || null,
            })
            .eq('id', postId);
        if (error) throw error;
    },

    async restorePost(postId: string): Promise<void> {
        const { error } = await supabase
            .from('social_posts')
            .update({
                deleted_at: null,
                deleted_by: null,
                deleted_by_email: null,
                status: 'draft',
            })
            .eq('id', postId);
        if (error) throw error;
    },

    async publishPostNow(companyId: string, postId: string) {
        return invokeBridge<{ ok: boolean; status: string; error?: string | null }>({
            action: 'publish_post_now',
            company_id: companyId,
            post_id: postId,
        });
    },

    async getChatGptSetup(companyId: string) {
        return invokeBridge<{
            ok: boolean;
            mcp_url?: string;
            authorization_url: string;
            token_url: string;
            openapi_schema: Record<string, any>;
            instructions: string;
        }>({
            action: 'get_chatgpt_setup',
            company_id: companyId,
        });
    },

    async listTokens(companyId: string): Promise<SocialBridgeTokenRecord[]> {
        const res = await invokeBridge<{ ok: boolean; tokens: SocialBridgeTokenRecord[] }>({
            action: 'list_tokens',
            company_id: companyId,
        });
        return res.tokens || [];
    },

    async createToken(companyId: string, label: string, canPublishDirectly: boolean) {
        return invokeBridge<{ ok: boolean; token: string; record: SocialBridgeTokenRecord }>({
            action: 'create_token',
            company_id: companyId,
            label,
            can_publish_directly: canPublishDirectly,
        });
    },

    async revokeToken(companyId: string, tokenId: string) {
        return invokeBridge<{ ok: boolean }>({
            action: 'revoke_token',
            company_id: companyId,
            token_id: tokenId,
        });
    },

    async toggleTokenPublish(companyId: string, tokenId: string, canPublishDirectly: boolean) {
        return invokeBridge<{ ok: boolean }>({
            action: 'toggle_token_publish',
            company_id: companyId,
            token_id: tokenId,
            can_publish_directly: canPublishDirectly,
        });
    },

    async issueOAuthCode(
        companyId: string,
        clientId: string,
        redirectUri: string,
        codeChallenge?: string | null,
        codeChallengeMethod?: string | null,
    ) {
        return invokeBridge<{ ok: boolean; code: string }>({
            action: 'issue_oauth_code',
            company_id: companyId,
            client_id: clientId,
            redirect_uri: redirectUri,
            code_challenge: codeChallenge || null,
            code_challenge_method: codeChallengeMethod || null,
        });
    },
};
