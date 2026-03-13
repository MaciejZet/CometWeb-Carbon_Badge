# Changelog

All notable changes to `@cometweb/carbon-badge` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
