# Changelog

All notable changes to `@cometweb/carbon-badge` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.4] — 2026-03-17

### Fixed
- **Race condition in `loadData()`** — rapid attribute changes (e.g. `url` updated via JS) could trigger multiple concurrent fetches whose results would overwrite `this.data` in arbitrary order. A `_loadId` counter is now incremented on every `loadData()` call; stale fetches and estimate timeouts silently discard their result if a newer load has already started.

### Changed
- **`estimator.ts` fallback logging** — silent `catch {}` blocks in `measurePageWeight()` now emit `console.warn` when the Performance Resource Timing API is unavailable or DOM size estimation fails, making unexpected fallbacks visible in DevTools.
- **Removed `lang` attribute** — Polish (`pl`) language support was listed in the README and present in `test.html` but was never implemented in code (`observedAttributes` did not include `lang`). All references removed to avoid misleading consumers.

---

## [1.0.3] — 2026-03-17

### Security
- **API key moved to `Authorization` header** — previously `api_key` was appended as a URL query parameter, making it visible in browser history, server access logs, and network proxies. It is now sent as `Authorization: Bearer <key>` in the request header.

### Fixed
- **`type="button"` on retry button** — the retry button in error state lacked an explicit type, risking unintended form submission in environments that wrap the badge in a `<form>`. Fixed.
- **`tabindex="0"` on host element** — `this.focus()` after retry had no effect because the custom element host was not focusable. The host now receives `tabindex="0"` at construction time (only if not already set), restoring keyboard focus correctly after retry.
- **`setTimeout` delay in `runEstimate` reduced to 0ms** — the previous 100ms arbitrary delay is now `0ms` (single macrotask deferral). The purpose remains: allow the loading state to paint before estimation runs. A comment documents this intent.

### Changed
- **Source maps** — now enabled in non-production builds (`NODE_ENV !== 'production'`) for easier debugging. Production builds remain without source maps.
- **`drop_console`** — changed from `true` (drops all console calls) to `['log']` (drops only `console.log`). `console.warn` and `console.error` are preserved in the production bundle for operational diagnostics.
- **`cache.ts` error handling** — silent `catch {}` blocks in `setCache()` and `clearExpired()` now emit `console.warn` with the underlying error, making localStorage quota issues and access-denied errors visible during debugging.

### Added
- **Public `reload()` method** — allows forcing a fresh data fetch from JavaScript without DOM manipulation: `document.querySelector('cometweb-carbon-badge').reload()`.

---

## [1.0.2] — 2026-03-17

### Security
- **GDPR/RODO — removed Google Fonts CDN** — the `@import url('https://fonts.googleapis.com/...')` call has been removed from the component styles. Previously every page visitor's IP address was sent to Google servers without consent, which violates GDPR (cf. LG München I ruling, 2022). The component now uses a system font stack: `'Nunito Sans', 'Segoe UI', system-ui, -apple-system, sans-serif` — if the host page already loads Nunito Sans it will be used; otherwise the browser falls back to system fonts with no external request.

### Added
- **`CustomEvent 'cometweb:badge-load'`** — dispatched on the host element (bubbles, composed) after badge data is successfully rendered. Detail: `{ url, co2Grams, score, cleanerThan, pageWeightKb, greenHost, source: 'api' | 'cache' | 'estimate' }`. Enables GDPR-friendly integration with analytics tools (GA4, Plausible, etc.) without collecting personal data.
- **`CustomEvent 'cometweb:badge-error'`** — dispatched when the badge fails to load data. Detail: `{ url }`.
- **Public getters** on the custom element: `badgeData`, `co2Grams`, `score`, `cleanerThan`, `pageWeightKb` — allows reading badge state from JavaScript after load.

---

## [1.0.1] — 2026-03-12

### Security
- **XSS protection** — all dynamic values rendered inside the Shadow DOM are now HTML-escaped via `escapeHtml()` before insertion (`&`, `<`, `>`, `"`, `'`)
- **API timeout** — fetch requests are cancelled after 5 seconds using `AbortController`; the badge gracefully falls back to client-side estimate mode on timeout
- **Score whitelist** — API-returned score is validated against `ALLOWED_SCORES = ['A+','A','B','C','D','F']`; any unexpected value defaults to `F`

### Added
- `toFiniteNumber(value, fallback)` — safe numeric conversion that prevents `NaN`/`Infinity` from reaching the UI
- `clamp(value, min, max)` — ensures `cleanerThan` is always within `[0, 100]`
- `source=badge` query parameter sent to the API for backend analytics (identifies badge widget traffic)
- Handling of HTTP 429 (rate limit) responses — logs a warning and falls back to estimate mode
- `eco_badge_eligible` and `eco_badge_threshold_grams` optional fields added to the `APIResponse` TypeScript type

### Changed
- Upgraded terser plugin from `rollup-plugin-terser` to the official `@rollup/plugin-terser ^0.4.4`
- `drop_console: true` in production build — console statements are stripped from the published bundle
- `rollup` upgraded to `^4.28.0`, `typescript` to `^5.7.0`

### Fixed
- Prevented potential UI glitches from negative or non-finite CO₂ values (`Math.max(0, ...)`)
- Timeout error now correctly identified via `error.name === 'AbortError'` across browsers

---

## [1.0.0] — 2026-02

### Added
- Initial release of `@cometweb/carbon-badge` Web Component
- Shadow DOM encapsulation with `dark` / `light` themes
- `api` mode — fetches live CO₂e data from the CometWeb public API
- `estimate` mode — client-side calculation via Performance Resource Timing API
- SWDM v4 Hybrid Model for emissions calculation
- Attributes: `url`, `mode`, `theme`, `lang`, `cache-ttl`, `api-url`, `api-key`, `green-host`
- Scoring scale: A+ / A / B / C / D / F
- Polish (`pl`) and English (`en`) i18n support
- ESM and UMD builds with TypeScript declarations
