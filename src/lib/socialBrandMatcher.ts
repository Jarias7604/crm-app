export interface SocialAccountSummary {
    id: string;
    platform: string;
    account_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    is_default?: boolean | null;
}

const STOP_WORDS = new Set([
    'the',
    'and',
    'del',
    'los',
    'las',
    'para',
    'con',
    'inc',
    'llc',
    'sas',
    'ltd',
    'srl',
    'de',
    'el',
    'la',
    'por',
    'com',
    'sv',
]);

const PLATFORM_ORDER: Record<string, number> = {
    meta_ads: 0,
    facebook: 1,
    instagram: 2,
    youtube: 3,
    tiktok: 4,
};

export function normalizeBrandText(text?: string | null): string {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function tokenizeBrand(text?: string | null): string[] {
    const norm = normalizeBrandText(text);
    if (!norm) return [];
    return norm
        .split(' ')
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

export function matchBrandSocialAccounts<T extends SocialAccountSummary>(
    brandName: string,
    accounts: T[],
): { matched: T[]; avatarUrl: string | null; platforms: string[] } {
    const publishable = accounts.filter((a) => a.platform !== 'meta_ads');
    const brandNorm = normalizeBrandText(brandName);
    const brandTokens = tokenizeBrand(brandName);

    if (!brandNorm || brandTokens.length === 0) {
        return { matched: [], avatarUrl: null, platforms: [] };
    }

    const matched = publishable.filter((acc) => {
        const candidateText = acc.display_name || acc.account_name || '';
        const accNorm = normalizeBrandText(candidateText);
        if (!accNorm) return false;

        if (brandNorm.length >= 4 && accNorm.length >= 4) {
            if (accNorm.includes(brandNorm) || brandNorm.includes(accNorm)) {
                return true;
            }
        }

        const accTokens = new Set(tokenizeBrand(candidateText));
        let shared = 0;
        for (const t of brandTokens) {
            if (accTokens.has(t)) shared++;
        }

        if (brandTokens.length === 1) {
            return shared >= 1;
        }
        return shared >= 2;
    });

    const sorted = [...matched].sort((a, b) => {
        const pa = PLATFORM_ORDER[a.platform] ?? 99;
        const pb = PLATFORM_ORDER[b.platform] ?? 99;
        if (pa !== pb) return pa - pb;
        return Number(Boolean(b.is_default)) - Number(Boolean(a.is_default));
    });

    const seenIds = new Set<string>();
    const deduped: T[] = [];
    for (const item of sorted) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        deduped.push(item);
    }

    const avatarUrl = deduped.find((a) => Boolean(a.avatar_url))?.avatar_url || null;
    const platforms = Array.from(new Set(deduped.map((a) => a.platform)));

    return { matched: deduped, avatarUrl, platforms };
}

export function pickDistinctPlatformAccounts<T extends SocialAccountSummary>(accounts: T[], limit = 4): T[] {
    if (accounts.length === 0 || limit <= 0) return [];

    const ranked = [...accounts].sort((a, b) => {
        const hasAvDiff = Number(Boolean(b.avatar_url)) - Number(Boolean(a.avatar_url));
        if (hasAvDiff !== 0) return hasAvDiff;
        const defDiff = Number(Boolean(b.is_default)) - Number(Boolean(a.is_default));
        if (defDiff !== 0) return defDiff;
        return (PLATFORM_ORDER[a.platform] ?? 99) - (PLATFORM_ORDER[b.platform] ?? 99);
    });

    const picked: T[] = [];
    const seenPlatforms = new Set<string>();
    const seenIds = new Set<string>();

    for (const acc of ranked) {
        if (picked.length >= limit) break;
        if (seenPlatforms.has(acc.platform)) continue;
        seenPlatforms.add(acc.platform);
        seenIds.add(acc.id);
        picked.push(acc);
    }

    for (const acc of ranked) {
        if (picked.length >= limit) break;
        if (seenIds.has(acc.id)) continue;
        seenIds.add(acc.id);
        picked.push(acc);
    }

    return picked;
}
