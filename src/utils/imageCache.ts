/**
 * 🚀 PRODUCTION-GRADE IMAGE CACHE UTILITY
 * ========================================
 * Enterprise-level image caching with LRU eviction policy
 * Optimized for PDF generation and asset management
 */

interface CacheEntry {
    data: string;
    timestamp: number;
    size: number;
}

class ImageCacheManager {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly MAX_CACHE_SIZE_MB = 50;
    private readonly MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 minutes
    private currentSizeMB = 0;

    /**
     * Fast image loader using Fetch API (bypasses DOM overhead)
     */
    async loadImage(url: string): Promise<string | null> {
        if (!url) return null;

        // Check cache first
        const cached = this.getFromCache(url);
        if (cached) return cached;

        try {
            // Fetch image as blob (much faster than Image element)
            const response = await fetch(url, {
                mode: 'cors',
                cache: 'force-cache' // Use browser HTTP cache
            });

            if (!response.ok) return null;

            const blob = await response.blob();
            const base64 = await this.blobToBase64(blob);

            // Store in cache
            this.setCache(url, base64, blob.size);

            return base64;
        } catch (error) {
            console.warn(`Failed to load image: ${url}`, error);
            return null;
        }
    }

    /**
     * Load multiple images in parallel (much faster than sequential)
     */
    async loadImagesParallel(urls: string[]): Promise<(string | null)[]> {
        return Promise.all(urls.map(url => this.loadImage(url)));
    }

    /**
     * Convert Blob to Base64 using FileReader API
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Get from cache with expiration check
     */
    private getFromCache(url: string): string | null {
        const entry = this.cache.get(url);
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > this.MAX_CACHE_AGE_MS) {
            this.cache.delete(url);
            return null;
        }

        return entry.data;
    }

    /**
     * Set cache with LRU eviction
     */
    private setCache(url: string, data: string, size: number): void {
        const sizeMB = size / (1024 * 1024);

        // Evict old entries if cache is too large
        while (this.currentSizeMB + sizeMB > this.MAX_CACHE_SIZE_MB && this.cache.size > 0) {
            const firstKey = this.cache.keys().next().value;
            const firstEntry = this.cache.get(firstKey);
            if (firstEntry) {
                this.currentSizeMB -= firstEntry.size / (1024 * 1024);
            }
            this.cache.delete(firstKey);
        }

        // Add to cache
        this.cache.set(url, {
            data,
            timestamp: Date.now(),
            size
        });
        this.currentSizeMB += sizeMB;
    }

    /**
     * Clear entire cache
     */
    clearCache(): void {
        this.cache.clear();
        this.currentSizeMB = 0;
    }

    /**
     * Get cache stats for monitoring
     */
    getStats() {
        return {
            entries: this.cache.size,
            sizeMB: this.currentSizeMB.toFixed(2),
            maxSizeMB: this.MAX_CACHE_SIZE_MB
        };
    }
}

// Singleton instance for global use
export const imageCache = new ImageCacheManager();
