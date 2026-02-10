/**
 * @cometweb/carbon-badge — Main Web Component
 * 
 * <cometweb-carbon-badge> — Shadow DOM widget showing CO₂e per page view.
 * 
 * Attributes:
 *   url        — URL to analyze (default: current page)
 *   mode       — "api" (default) | "estimate" (client-side)
 *   theme      — "dark" (default) | "light"
 *   lang       — "en" (default) | "pl"
 *   cache-ttl  — cache TTL in minutes (default: 720 = 12h)
 *   api-url    — override API base URL
 *   api-key    — optional API key for higher rate limits
 *   green-host — "true" to override green hosting factor in estimate mode
 */

import type { BadgeData, BadgeTheme, BadgeMode, ScoreLetter, APIResponse } from './types';
import { getCached, isCacheValid, setCache, clearExpired } from './cache';
import { estimateCO2, co2ToScore } from './estimator';
import { getStyles } from './styles';

const DEFAULT_API_URL = 'https://api.cometweb.io/api';
const DEFAULT_CACHE_TTL = 720; // 12 hours in minutes
const MAX_RETRIES = 3;

const I18N: Record<string, Record<string, string>> = {
    en: {
        co2PerVisit: 'CO₂e per visit',
        visit: 'visit',
        cleanerThanPrefix: 'Cleaner than',
        cleanerThanSuffix: 'of web',
        cleanerThan: 'Cleaner than {pct}% of sites',
        poweredBy: 'Powered by CometWeb',
        loading: 'Measuring…',
        error: 'Unable to calculate',
        retry: 'Retry',
        ariaLabel: 'Carbon footprint badge: {co2}g CO₂e per visit, score {score}',
        ariaLoading: 'Calculating carbon footprint…',
        ariaError: 'Carbon footprint calculation failed',
    },
    pl: {
        co2PerVisit: 'CO₂e na wizytę',
        visit: 'wizytę',
        cleanerThanPrefix: 'Czystsza niż',
        cleanerThanSuffix: 'stron',
        cleanerThan: 'Czystsza niż {pct}% stron',
        poweredBy: 'Powered by CometWeb',
        loading: 'Pomiar…',
        error: 'Nie udało się obliczyć',
        retry: 'Ponów',
        ariaLabel: 'Odznaka śladu węglowego: {co2}g CO₂e na wizytę, ocena {score}',
        ariaLoading: 'Obliczanie śladu węglowego…',
        ariaError: 'Obliczanie śladu węglowego nie powiodło się',
    },
};

export class CometWebCarbonBadge extends HTMLElement {
    private shadow: ShadowRoot;
    private data: BadgeData | null = null;
    private retryCount = 0;

    static get observedAttributes() {
        return ['url', 'mode', 'theme', 'lang', 'cache-ttl', 'api-url', 'api-key', 'green-host'];
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
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

    private get badgeLang(): string {
        return this.getAttribute('lang') || 'en';
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
        const strings = I18N[this.badgeLang] || I18N.en;
        let s = strings[key] || key;
        for (const [k, v] of Object.entries(vars)) {
            s = s.replace(`{${k}}`, String(v));
        }
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
        const url = this.targetUrl;
        if (!url) {
            this.renderError();
            return;
        }

        if (isCacheValid(url, this.cacheTtl)) {
            const cached = getCached(url);
            if (cached) {
                this.data = cached;
                this.renderBadge();
                return;
            }
        }

        if (this.mode === 'estimate') {
            this.runEstimate();
        } else {
            await this.fetchFromAPI(url);
        }
    }

    private runEstimate() {
        try {
            setTimeout(() => {
                this.data = estimateCO2(this.greenHost);
                setCache(this.targetUrl, this.data);
                this.renderBadge();
            }, 100);
        } catch {
            this.renderError();
        }
    }

    private async fetchFromAPI(url: string) {
        try {
            const params = new URLSearchParams({ url });
            if (this.apiKey) params.set('api_key', this.apiKey);

            const response = await fetch(`${this.apiUrl}/public/carbon-badge?${params}`, {
                headers: { 'Accept': 'application/json' },
            });

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

                this.runEstimate();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const apiData: APIResponse = await response.json();

            this.data = {
                url: apiData.url,
                co2Grams: apiData.co2_grams,
                score: apiData.score as ScoreLetter,
                cleanerThan: apiData.cleaner_than,
                pageWeightKb: apiData.page_weight_kb,
                greenHost: apiData.green_host,
                timestamp: Date.now(),
            };

            setCache(url, this.data);
            this.retryCount = 0;
            this.renderBadge();
        } catch {
            if (this.retryCount < MAX_RETRIES) {
                this.retryCount++;
                this.runEstimate();
            } else {
                this.renderError();
            }
        }
    }

    // --- Render methods ---

    private renderLoading() {
        const styles = getStyles(this.theme);
        this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="cw-badge loading" role="status" aria-label="${this.t('ariaLoading')}" aria-live="polite">
        <div class="cw-grade grade-unknown">…</div>
        <div class="cw-content">
          <div class="cw-title">${this.t('loading')}</div>
          <div class="cw-subtitle">${this.t('poweredBy')}</div>
        </div>
      </div>
    `;
    }

    private renderBadge() {
        if (!this.data) return;

        const { co2Grams, score, cleanerThan } = this.data;
        const styles = getStyles(this.theme);
        const scoreClass = this.getScoreClass(score);
        const co2Display = co2Grams < 0.01 ? '<0.01' : co2Grams.toFixed(2);
        const themeClass = this.theme; // 'dark' or 'light'

        this.shadow.innerHTML = `
      <style>${styles}</style>
      <a class="cw-badge ${themeClass}"
         href="https://cometweb.io/insight/ecology"
         target="_blank"
         rel="noopener noreferrer"
         role="status"
         aria-label="${this.t('ariaLabel', { co2: co2Display, score })}"
         aria-live="polite">
        <div class="cw-grade ${scoreClass}">${score}</div>
        <div class="cw-content">
          <div class="cw-title">${co2Display}g CO₂e <small>/ ${this.t('visit') || 'visit'}</small></div>
          <div class="cw-subtitle">
            ${this.t('cleanerThanPrefix') || 'Cleaner than'} <span class="cw-highlight">${cleanerThan}%</span> ${this.t('cleanerThanSuffix') || 'of web'}
          </div>
        </div>
        <div class="cw-footer">Verified by CometWeb</div>
      </a>
    `;
    }

    private renderError() {
        const styles = getStyles(this.theme);

        this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="cw-badge error" role="status" aria-label="${this.t('ariaError')}" aria-live="polite">
        <div class="cw-grade grade-f">!</div>
        <div class="cw-content">
          <div class="cw-title">${this.t('error')}</div>
          <div class="cw-error-actions">
            <button class="cw-retry-btn" aria-label="${this.t('retry')}">${this.t('retry')}</button>
          </div>
        </div>
        <div class="cw-footer">Verified by CometWeb</div>
      </div>
    `;

        const btn = this.shadow.querySelector('.cw-retry-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.retryCount = 0;
                this.renderLoading();
                this.loadData();
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
