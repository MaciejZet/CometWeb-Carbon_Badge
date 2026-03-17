/**
 * Tests for localStorage caching layer (cache.ts)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, isCacheValid, setCache, clearExpired } from '../cache';
import type { BadgeData } from '../types';

const mockData: BadgeData = {
    url: 'https://example.com',
    co2Grams: 0.23,
    score: 'B',
    cleanerThan: 72,
    pageWeightKb: 480,
    greenHost: false,
    timestamp: Date.now(),
};

const CACHE_PREFIX = 'cwb:';

// Simple localStorage mock
function makeLocalStorageMock() {
    let store: Record<string, string> = {};
    return {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (i: number) => Object.keys(store)[i] ?? null,
    };
}

beforeEach(() => {
    const ls = makeLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
});

describe('setCache / getCached', () => {
    it('stores and retrieves data for a URL', () => {
        setCache('https://example.com', mockData);
        const result = getCached('https://example.com');
        expect(result).toEqual(mockData);
    });

    it('returns null for a URL not in cache', () => {
        expect(getCached('https://missing.com')).toBeNull();
    });

    it('returns null when localStorage contains malformed JSON', () => {
        localStorage.setItem(CACHE_PREFIX + 'https://bad.com', 'not-json{');
        expect(getCached('https://bad.com')).toBeNull();
    });

    it('warns on setCache failure (quota exceeded)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('localStorage', {
            ...makeLocalStorageMock(),
            setItem: () => { throw new DOMException('QuotaExceededError'); },
        });
        setCache('https://example.com', mockData);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Cache write failed'),
            expect.anything(),
        );
        warnSpy.mockRestore();
    });
});

describe('isCacheValid', () => {
    it('returns true for a fresh entry within TTL', () => {
        setCache('https://example.com', mockData);
        expect(isCacheValid('https://example.com', 720)).toBe(true);
    });

    it('returns false for an expired entry', () => {
        const expiredEntry = { data: mockData, ts: Date.now() - 25 * 60 * 60 * 1000 }; // 25h ago
        localStorage.setItem(CACHE_PREFIX + 'https://old.com', JSON.stringify(expiredEntry));
        expect(isCacheValid('https://old.com', 720)).toBe(false);
    });

    it('returns false when no entry exists', () => {
        expect(isCacheValid('https://nonexistent.com', 720)).toBe(false);
    });
});

describe('clearExpired', () => {
    it('removes expired entries', () => {
        const expiredEntry = { data: mockData, ts: Date.now() - 25 * 60 * 60 * 1000 };
        localStorage.setItem(CACHE_PREFIX + 'https://expired.com', JSON.stringify(expiredEntry));
        clearExpired(720);
        expect(localStorage.getItem(CACHE_PREFIX + 'https://expired.com')).toBeNull();
    });

    it('keeps fresh entries', () => {
        setCache('https://fresh.com', mockData);
        clearExpired(720);
        expect(getCached('https://fresh.com')).toEqual(mockData);
    });

    it('removes entries with malformed JSON', () => {
        localStorage.setItem(CACHE_PREFIX + 'https://corrupt.com', 'bad{json');
        clearExpired(720);
        expect(localStorage.getItem(CACHE_PREFIX + 'https://corrupt.com')).toBeNull();
    });

    it('does not touch keys without the cwb: prefix', () => {
        localStorage.setItem('other:key', 'untouched');
        clearExpired(720);
        expect(localStorage.getItem('other:key')).toBe('untouched');
    });
});
