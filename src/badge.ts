/**
 * @cometweb/carbon-badge — Main Web Component
 *
 * Attributes: url, mode ("api"|"estimate"), theme ("dark"|"light"),
 *   cache-ttl, api-url, api-key, green-host
 */

import type { BadgeData, BadgeTheme, BadgeMode, ScoreLetter, APIResponse } from './types';
import { getCached, isCacheValid, setCache, clearExpired } from './cache';
import { estimateCO2, co2ToScore } from './estimator';
import { getStyles } from './styles';

const DEFAULT_API_URL = 'https://api.cometweb.io/api';
const DEFAULT_CACHE_TTL = 720; // 12 hours in minutes
const MAX_RETRIES = 3;
const API_TIMEOUT_MS = 5000;
const ALLOWED_SCORES: ScoreLetter[] = ['A+', 'A', 'B', 'C', 'D', 'F'];

function toFiniteNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const STRINGS: Record<string, string> = {
    visit: 'visit',
    cleanerThanPrefix: 'Cleaner than',
    cleanerThanSuffix: 'of web',
    poweredBy: 'Powered by CometWeb',
    loading: 'Measuring…',
    error: 'Unable to calculate',
    retry: 'Retry',
    ariaLabel: 'Carbon footprint: {co2}g CO₂e per visit, score {score}',
    ariaLoading: 'Calculating carbon footprint…',
    ariaError: 'Carbon footprint calculation failed',
};

export class CometWebCarbonBadge extends HTMLElement {
    private shadow: ShadowRoot;
    private data: BadgeData | null = null;
    private retryCount = 0;
    private dataSource: 'cache' | 'api' | 'estimate' = 'api';
    private _loadId = 0;

    // --- Public API ---

    get badgeData(): BadgeData | null { return this.data; }
    get co2Grams(): number | null { return this.data?.co2Grams ?? null; }
    get score(): ScoreLetter | null { return this.data?.score ?? null; }
    get cleanerThan(): number | null { return this.data?.cleanerThan ?? null; }
    get pageWeightKb(): number | null { return this.data?.pageWeightKb ?? null; }

    reload(): void {
        this.retryCount = 0;
        this.data = null;
        this._loadId++;
        this.renderLoading();
        this.loadData();
    }

    static get observedAttributes() {
        return ['url', 'mode', 'theme', 'cache-ttl', 'api-url', 'api-key', 'green-host'];
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        // tabindex makes the host focusable so this.focus() works on retry
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    }

    // --- Attribute helpers ---

    private get targetUrl(): string {
        return this.getAttribute('url') || (typeof location !== 'undefined' ? location.href : '');
    }

    private get mode(): BadgeMode {
        return (this.getAttribute('mode') as BadgeMode) || 'api';
    }

    private get theme(): BadgeTheme {
        return (this.getAttribute('theme') as BadgeTheme) || 'dark';
    }


    private get cacheTtl(): number {
        const val = this.getAttribute('cache-ttl');
        return val ? parseInt(val, 10) : DEFAULT_CACHE_TTL;
    }

    private get apiUrl(): string {
        return this.getAttribute('api-url') || DEFAULT_API_URL;
    }

    private get apiKey(): string | null {
        return this.getAttribute('api-key');
    }

    private get greenHost(): boolean {
        return this.getAttribute('green-host') === 'true';
    }

    private t(key: string, vars: Record<string, string | number> = {}): string {
        let s = STRINGS[key] ?? key;
        for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
        return s;
    }

    // --- Lifecycle ---

    connectedCallback() {
        this.renderLoading();
        clearExpired(this.cacheTtl);
        this.loadData();
    }

    attributeChangedCallback() {
        if (this.isConnected) {
            this.loadData();
        }
    }

    // --- Data loading ---

    private async loadData() {
        const loadId = ++this._loadId;
        const url = this.targetUrl;

        if (!url) {
            this.renderError();
            return;
        }

        if (isCacheValid(url, this.cacheTtl)) {
            const cached = getCached(url);
            if (cached) {
                if (loadId !== this._loadId) return;
                this.data = cached;
                this.dataSource = 'cache';
                this.renderBadge();
                return;
            }
        }

        if (this.mode === 'estimate') {
            this.runEstimate(loadId);
        } else {
            await this.fetchFromAPI(url, loadId);
        }
    }

    private runEstimate(loadId = this._loadId) {
        try {
            // Defer by one task to allow the loading render to paint before heavy estimation
            setTimeout(() => {
                if (loadId !== this._loadId) return;
                this.data = estimateCO2(this.greenHost);
                this.dataSource = 'estimate';
                setCache(this.targetUrl, this.data);
                this.renderBadge();
            }, 0);
        } catch {
            this.renderError();
        }
    }

    private async fetchFromAPI(url: string, loadId = this._loadId) {
        try {
            const params = new URLSearchParams({ url });
            params.set('source', 'badge');
            // api_key is sent via Authorization header, not URL, to avoid exposure in logs/history

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

            const headers: Record<string, string> = { 'Accept': 'application/json' };
            if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

            const response = await fetch(
                `${this.apiUrl}/public/carbon-badge?${params}`,
                { headers, signal: controller.signal },
            ).finally(() => clearTimeout(timeoutId));

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
                const delay = retryAfter > 0
                    ? retryAfter * 1000
                    : Math.min(1000 * Math.pow(2, this.retryCount), 30000);

                if (this.retryCount < MAX_RETRIES) {
                    this.retryCount++;
                    setTimeout(() => this.fetchFromAPI(url), delay);
                    return;
                }

                console.warn('[CometWeb Carbon Badge] API rate limited, falling back to estimate mode.');
                this.runEstimate();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const apiData: APIResponse = await response.json();
            if (loadId !== this._loadId) return;

            const score = ALLOWED_SCORES.includes(apiData.score as ScoreLetter)
                ? (apiData.score as ScoreLetter)
                : 'F';

            this.data = {
                url: apiData.url,
                co2Grams: Math.max(0, toFiniteNumber(apiData.co2_grams, 0)),
                score,
                cleanerThan: clamp(toFiniteNumber(apiData.cleaner_than, 0), 0, 100),
                pageWeightKb: Math.max(0, toFiniteNumber(apiData.page_weight_kb, 0)),
                greenHost: apiData.green_host,
                timestamp: Date.now(),
            };
            this.dataSource = 'api';

            setCache(url, this.data);
            this.retryCount = 0;
            this.renderBadge();
        } catch (error) {
            const isAbort = error instanceof DOMException && error.name === 'AbortError';
            if (isAbort) {
                console.warn('[CometWeb Carbon Badge] API request timed out, falling back to estimate mode.');
            }

            if (this.retryCount < MAX_RETRIES) {
                this.retryCount++;
                this.runEstimate();
            } else {
                this.renderError();
            }
        }
    }

    // --- Events ---

    private dispatchBadgeEvent() {
        if (!this.data) return;
        this.dispatchEvent(new CustomEvent('cometweb:badge-load', {
            bubbles: true,
            composed: true,
            detail: {
                url: this.data.url,
                co2Grams: this.data.co2Grams,
                score: this.data.score,
                cleanerThan: this.data.cleanerThan,
                pageWeightKb: this.data.pageWeightKb,
                greenHost: this.data.greenHost,
                source: this.dataSource,
            },
        }));
    }

    // --- Render methods ---

    private renderLoading() {
        const styles = getStyles(this.theme);
                const safeAriaLoading = escapeHtml(this.t('ariaLoading'));
                const safeLoading = escapeHtml(this.t('loading'));
                const safePoweredBy = escapeHtml(this.t('poweredBy'));
        this.shadow.innerHTML = `
      <style>${styles}</style>
      <div role="status" aria-live="polite" aria-label="${safeAriaLoading}">
        <div class="cw-badge loading">
          <div class="cw-grade grade-unknown" aria-hidden="true">…</div>
          <div class="cw-content">
            <div class="cw-title">${safeLoading}</div>
            <div class="cw-subtitle">${safePoweredBy}</div>
          </div>
        </div>
      </div>
    `;
    }

    private renderBadge() {
        if (!this.data) return;

        const co2Grams = Math.max(0, toFiniteNumber(this.data.co2Grams, 0));
        const score = ALLOWED_SCORES.includes(this.data.score) ? this.data.score : 'F';
        const cleanerThan = clamp(toFiniteNumber(this.data.cleanerThan, 0), 0, 100);
        const styles = getStyles(this.theme);
        const scoreClass = this.getScoreClass(score);
        const co2Display = co2Grams < 0.01 ? '<0.01' : co2Grams.toFixed(2);
                const safeCo2Display = escapeHtml(co2Display);
                const safeScore = escapeHtml(score);
                const safeCleanerThan = escapeHtml(cleanerThan.toString());
                const safeVisit = escapeHtml(this.t('visit') || 'visit');
                const safeCleanerPrefix = escapeHtml(this.t('cleanerThanPrefix') || 'Cleaner than');
                const safeCleanerSuffix = escapeHtml(this.t('cleanerThanSuffix') || 'of web');
                const safeAria = escapeHtml(this.t('ariaLabel', { co2: co2Display, score }));
        const themeClass = this.theme; // 'dark' or 'light'

        this.shadow.innerHTML = `
      <style>${styles}</style>
      <div role="status" aria-live="polite" aria-label="${safeAria}">
        <a class="cw-badge ${themeClass}"
           href="https://cometweb.io/insight/ecology"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="${safeAria} — CometWeb (opens in new tab)">
          <div class="cw-grade ${scoreClass}" aria-hidden="true">${safeScore}</div>
          <div class="cw-content">
            <div class="cw-title">${safeCo2Display}g CO₂e <small>/ ${safeVisit}</small></div>
            <div class="cw-subtitle">
              ${safeCleanerPrefix} <span class="cw-highlight">${safeCleanerThan}%</span> ${safeCleanerSuffix}
            </div>
          </div>
          <div class="cw-footer" aria-hidden="true">Verified by CometWeb</div>
        </a>
      </div>
    `;
        this.dispatchBadgeEvent();
    }

    private renderError() {
        const styles = getStyles(this.theme);
                const safeAriaError = escapeHtml(this.t('ariaError'));
                const safeError = escapeHtml(this.t('error'));
                const safeRetry = escapeHtml(this.t('retry'));

        this.shadow.innerHTML = `
      <style>${styles}</style>
      <div role="status" aria-live="polite" aria-label="${safeAriaError}">
        <div class="cw-badge error">
          <div class="cw-grade grade-f" aria-hidden="true">!</div>
          <div class="cw-content">
            <div class="cw-title">${safeError}</div>
            <div class="cw-error-actions">
              <button type="button" class="cw-retry-btn">${safeRetry}</button>
            </div>
          </div>
          <div class="cw-footer" aria-hidden="true">Verified by CometWeb</div>
        </div>
      </div>
    `;
        this.dispatchEvent(new CustomEvent('cometweb:badge-error', {
            bubbles: true,
            composed: true,
            detail: { url: this.targetUrl },
        }));

        const btn = this.shadow.querySelector<HTMLButtonElement>('.cw-retry-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.retryCount = 0;
                this.renderLoading();
                this.loadData();
                // Return focus to the badge host so keyboard users don't lose context
                this.focus();
            });
        }
    }

    private getScoreClass(score: ScoreLetter): string {
        const map: Record<string, string> = {
            'A+': 'grade-aplus',
            'A': 'grade-a',
            'B': 'grade-b',
            'C': 'grade-c',
            'D': 'grade-d',
            'F': 'grade-f',
        };
        return map[score] || 'grade-unknown';
    }
}
