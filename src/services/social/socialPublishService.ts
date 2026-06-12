import { supabase } from '../supabase';
import { simGuard } from '../simGuard';

export interface SocialAccount {
    id: string;
    company_id: string;
    platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
    account_name: string | null;
    display_name: string | null;
    account_id: string | null;
    avatar_url: string | null;
    access_token: string | null;
    token_expires_at: string | null;
    is_active: boolean;
    is_default: boolean;
    follower_count: number;
    metadata: Record<string, any>;
    created_at: string;
    updated_at?: string | null;
}

export interface SocialPost {
    id: string;
    company_id: string;
    content_url: string | null;
    content_type: 'image' | 'video' | 'reel' | 'story';
    captions: Record<string, string>;
    platforms: string[];
    status: 'draft' | 'publishing' | 'published' | 'scheduled' | 'failed';
    scheduled_at: string | null;
    published_at: string | null;
    results: Record<string, any>;
    flyer_id: string | null;
    created_by: string | null;
    created_at: string;
}

export const socialPublishService = {

    // ── Accounts ────────────────────────────────────────────────────

    async getAccounts(): Promise<SocialAccount[]> {
        const query = supabase.from('social_accounts').select('*').eq('is_active', true).order('platform');
        const { data, error } = await simGuard(query);
        if (error) throw error;
        return (data || []) as SocialAccount[];
    },

    async saveAccount(account: Partial<SocialAccount>): Promise<SocialAccount> {
        const { data, error } = await supabase
            .from('social_accounts')
            .upsert(account, { onConflict: 'company_id,platform,account_id' })
            .select()
            .single();
        if (error) throw error;
        return data as SocialAccount;
    },

    async disconnectAccount(id: string): Promise<void> {
        const { error } = await supabase
            .from('social_accounts')
            .update({ is_active: false, access_token: null })
            .eq('id', id);
        if (error) throw error;
    },

    // ── Posts ────────────────────────────────────────────────────────

    async getPosts(): Promise<SocialPost[]> {
        const query = supabase
            .from('social_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        const { data, error } = await simGuard(query);
        if (error) throw error;
        return (data || []) as SocialPost[];
    },

    async createPost(post: Partial<SocialPost>): Promise<SocialPost> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('social_posts')
            .insert({ ...post, created_by: user?.id })
            .select()
            .single();
        if (error) throw error;
        return data as SocialPost;
    },

    async updatePost(id: string, updates: Partial<SocialPost>): Promise<void> {
        const { error } = await supabase.from('social_posts').update(updates).eq('id', id);
        if (error) throw error;
    },

    // ── Publishing ────────────────────────────────────────────────────

    async publish(postId: string, selectedCuentas: { platform: string; account_id: string }[]): Promise<Record<string, any>> {
        const results: Record<string, any> = {};

        // Mark as publishing
        await supabase.from('social_posts').update({ status: 'publishing' }).eq('id', postId);

        for (const item of selectedCuentas) {
            const { platform, account_id } = item;
            try {
                let fnName = '';
                if (platform === 'facebook') fnName = 'publish-facebook';
                else if (platform === 'instagram') fnName = 'publish-instagram';
                else {
                    results[platform] = { error: `Platform ${platform} not yet supported in Phase 1` };
                    continue;
                }

                const { data, error } = await supabase.functions.invoke(fnName, {
                    body: { post_id: postId, account_id }
                });

                if (error) throw error;
                results[`${platform}_${account_id}`] = data;
            } catch (err: any) {
                results[`${platform}_${account_id}`] = { error: err.message };
            }
        }

        // Check if all succeeded
        const anySuccess = Object.values(results).some((r: any) => r?.success);
        const allFailed = Object.values(results).every((r: any) => r?.error);

        await supabase.from('social_posts').update({
            status: allFailed ? 'failed' : 'published',
            published_at: allFailed ? null : new Date().toISOString(),
            results,
        }).eq('id', postId);

        return results;
    },

    // ── Caption AI ────────────────────────────────────────────────────

    async generateCaption(platform: string, content: string, tone: string, companyId: string): Promise<string> {
        const platformGuide: Record<string, string> = {
            facebook: 'copy persuasivo para Facebook, 2-3 párrafos, emojis moderados al inicio de cada párrafo, termina con llamada a la acción clara y un link placeholder',
            instagram: 'copy visual e inspirador para Instagram, máximo 150 palabras, 8-12 hashtags relevantes al final separados por espacios, emojis estratégicos',
            tiktok: 'copy energético y viral para TikTok, máximo 80 palabras, trending hashtags, tono juvenil',
            youtube: 'descripción SEO-optimizada para YouTube, 3-4 párrafos, palabras clave naturales, timestamps placeholder, links en descripción',
        };

        const toneGuide: Record<string, string> = {
            'Profesional': 'tono corporativo, formal pero accesible, enfocado en valor de negocio y ROI',
            'Urgente': 'tono de urgencia y escasez, crea FOMO, usa palabras como HOY, AHORA, ÚLTIMAS PLAZAS',
            'Premium': 'tono exclusivo y aspiracional, palabras como elite, exclusivo, premium, select',
            'Amigable': 'tono cálido y cercano como hablarle a un amigo, primera persona, empatía',
            'Informal': 'tono casual y divertido, jerga moderna, emojis abundantes',
        };

        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
                messages: [
                    {
                        role: 'system',
                        content: `Eres un experto en marketing digital y copywriting para redes sociales en El Salvador y Latinoamérica. Especializas en contenido para empresas B2B y servicios profesionales. Tu trabajo es crear copy que convierte y genera engagement real. IMPORTANTE: Responde ÚNICAMENTE con el caption listo para publicar, sin comillas alrededor, sin explicaciones, sin prefijos como "Aquí tienes" o "Caption:".`
                    },
                    {
                        role: 'user',
                        content: `Crea un caption de alta conversión para ${platform.toUpperCase()} para el siguiente contenido o idea: "${content}".

Pauta de plataforma: ${platformGuide[platform] || 'copy profesional y conciso'}.
Tono de marca requerido: ${tone} — ${toneGuide[tone] || 'profesional'}.

El caption debe:
- Capturar atención en la primera línea (hook fuerte)
- Comunicar el beneficio clave claramente
- Terminar con una llamada a la acción (CTA) específica
- Ser 100% en español latinoamericano

Escribe SOLO el caption, nada más.`
                    }
                ],
                companyId: companyId || undefined,
            }
        });

        if (error) throw new Error(error.message || 'Error generating caption');

        // ai-chat returns {content} when messages+companyId, {response} otherwise
        const text = data?.content || data?.response || '';
        if (!text) throw new Error('La IA no generó texto. Intenta de nuevo.');
        return text.trim();
    },

    // ── Storage: Upload content for publishing ─────────────────────────

    async uploadContent(file: File, companyId: string): Promise<string> {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `social/${companyId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('marketing_assets').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('marketing_assets').getPublicUrl(path);
        return data.publicUrl;
    },
};
