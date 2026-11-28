export interface SocialAccountSummary {
    id: string;
    platform: string;
    account_id?: string | null;
    account_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    is_default?: boolean | null;
}

export interface SocialBrandGroup<T extends SocialAccountSummary> {
    id: string;
    name: string;
    accounts: T[];
    publishableAccounts: T[];
    publishableAccountIds: string[];
    platforms: string[];
    avatarUrls: string[];
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
    const clean = String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z]+/g, ' ')
        .trim();
    if (!clean) return [];
    return clean
        .split(' ')
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function isReliableAvatarUrl(url?: string | null): boolean {
    if (!url) return false;
    return /yt3\.ggpht\.com|googleusercontent\.com/i.test(url);
}

function sortAvatarUrls<T extends SocialAccountSummary>(accounts: T[]): string[] {
    const urls = accounts
        .map((a) => a.avatar_url)
        .filter((u): u is string => Boolean(u && String(u).trim()));
    const deduped = Array.from(new Set(urls));
    return deduped.sort((a, b) => Number(isReliableAvatarUrl(b)) - Number(isReliableAvatarUrl(a)));
}

function brandsMatchName(aName: string, bName: string): boolean {
    const aNorm = normalizeBrandText(aName);
    const bNorm = normalizeBrandText(bName);
    if (!aNorm || !bNorm) return false;

    if (aNorm.length >= 4 && bNorm.length >= 4) {
        if (bNorm.includes(aNorm) || aNorm.includes(bNorm)) {
            return true;
        }
    }

    const aCompact = aNorm.replace(/\s+/g, '');
    const bCompact = bNorm.replace(/\s+/g, '');
    if (aCompact.length >= 6 && bCompact.length >= 6) {
        if (aCompact.includes(bCompact) || bCompact.includes(aCompact)) {
            return true;
        }
    }

    const aTokens = tokenizeBrand(aName);
    const bTokens = tokenizeBrand(bName);
    if (aTokens.length === 0 || bTokens.length === 0) return false;

    const bSet = new Set(bTokens);
    const sharedTokens = aTokens.filter((t) => bSet.has(t));

    if (aTokens.length === 1 || bTokens.length === 1) {
        return sharedTokens.some((t) => t.length >= 5) || (sharedTokens.length >= 1 && aTokens.length === bTokens.length);
    }
    return sharedTokens.length >= 2;
}

export function matchBrandSocialAccounts<T extends SocialAccountSummary>(
    brandName: string,
    accounts: T[],
): { matched: T[]; avatarUrl: string | null; platforms: string[] } {
    const publishable = accounts.filter((a) => a.platform !== 'meta_ads');
    const matched = publishable.filter((acc) => {
        const candidateText = acc.display_name || acc.account_name || '';
        return Boolean(candidateText && brandsMatchName(brandName, candidateText));
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

    const avatarUrls = sortAvatarUrls(deduped);
    const avatarUrl = avatarUrls[0] || null;
    const platforms = Array.from(new Set(deduped.map((a) => a.platform)));

    return { matched: deduped, avatarUrl, platforms };
}

export function groupSocialBrands<T extends SocialAccountSummary>(accounts: T[]): SocialBrandGroup<T>[] {
    if (accounts.length === 0) return [];

    const anchors = [
        ...accounts.filter((a) => a.platform === 'facebook'),
        ...accounts.filter((a) => a.platform === 'meta_ads'),
    ];

    const usedIds = new Set<string>();
    const groups: SocialBrandGroup<T>[] = [];

    const addGroupForAnchor = (anchor: T) => {
        const anchorName = anchor.display_name || anchor.account_name || anchor.platform;
        const members: T[] = [anchor];
        usedIds.add(anchor.id);

        for (const acc of accounts) {
            if (usedIds.has(acc.id)) continue;
            const accName = acc.display_name || acc.account_name || '';
            if (accName && brandsMatchName(anchorName, accName)) {
                members.push(acc);
                usedIds.add(acc.id);
            }
        }

        const publishableAccounts = members.filter((m) => m.platform !== 'meta_ads');
        const sortedMembers = [...members].sort(
            (a, b) => (PLATFORM_ORDER[a.platform] ?? 99) - (PLATFORM_ORDER[b.platform] ?? 99),
        );
        const publishableAccountIds = Array.from(
            new Set(
                publishableAccounts
                    .map((m) => m.account_id || m.id)
                    .filter((v): v is string => Boolean(v)),
            ),
        );
        const platforms = Array.from(new Set(sortedMembers.map((m) => m.platform)));
        const avatarUrls = sortAvatarUrls(sortedMembers);

        groups.push({
            id: `brand:${normalizeBrandText(anchorName).replace(/\s+/g, '-') || anchor.id}`,
            name: anchorName,
            accounts: sortedMembers,
            publishableAccounts,
            publishableAccountIds,
            platforms,
            avatarUrls,
        });
    };

    for (const anchor of anchors) {
        if (usedIds.has(anchor.id)) continue;
        addGroupForAnchor(anchor);
    }

    for (const acc of accounts) {
        if (usedIds.has(acc.id)) continue;
        addGroupForAnchor(acc);
    }

    return groups.sort((a, b) => {
        const defA = Number(a.accounts.some((m) => Boolean(m.is_default)));
        const defB = Number(b.accounts.some((m) => Boolean(m.is_default)));
        if (defB !== defA) return defB - defA;
        if (b.platforms.length !== a.platforms.length) return b.platforms.length - a.platforms.length;
        return a.name.localeCompare(b.name, 'es');
    });
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
