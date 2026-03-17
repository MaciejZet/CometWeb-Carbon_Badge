/**
 * @cometweb/carbon-badge — localStorage caching layer
 */

import type { BadgeData, CacheEntry } from './types';

const CACHE_PREFIX = 'cwb:';

export function getCached(url: string): BadgeData | null {
    try {
        const key = CACHE_PREFIX + url;
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const entry: CacheEntry = JSON.parse(raw);
        return entry.data ?? null;
    } catch {
        return null;
    }
}

export function isCacheValid(url: string, ttlMinutes: number): boolean {
    try {
        const key = CACHE_PREFIX + url;
        const raw = localStorage.getItem(key);
        if (!raw) return false;

        const entry: CacheEntry = JSON.parse(raw);
        const ageMs = Date.now() - entry.ts;
        return ageMs < ttlMinutes * 60 * 1000;
    } catch {
        return false;
    }
}

export function setCache(url: string, data: BadgeData): void {
    try {
        const key = CACHE_PREFIX + url;
        const entry: CacheEntry = { data, ts: Date.now() };
        localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
        console.warn('[CometWeb Carbon Badge] Cache write failed (localStorage quota or access denied):', e);
    }
}

export function clearExpired(ttlMinutes: number): void {
    try {
        const now = Date.now();
        const maxAge = ttlMinutes * 60 * 1000;

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(CACHE_PREFIX)) continue;

            const raw = localStorage.getItem(key);
            if (!raw) continue;

            try {
                const entry: CacheEntry = JSON.parse(raw);
                if (now - entry.ts > maxAge) {
                    localStorage.removeItem(key);
                }
            } catch {
                localStorage.removeItem(key);
            }
        }
    } catch (e) {
        console.warn('[CometWeb Carbon Badge] Cache cleanup failed:', e);
    }
}
