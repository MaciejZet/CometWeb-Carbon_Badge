# @cometweb/carbon-badge

Lightweight web component (< 5KB gzipped) showing CO₂e emissions per page view.  
Powered by [CometWeb](https://cometweb.io) & **SWDM v4** (Sustainable Web Design Model).

## Quick Start

### Script Tag (CDN)
```html
<!-- Use explicit version for stability -->
<script type="module" src="https://unpkg.com/@cometweb/carbon-badge@1.0.0/dist/cometweb-carbon-badge.esm.js"></script>

<!-- Place where you want the badge to appear -->
<cometweb-carbon-badge theme="dark"></cometweb-carbon-badge>
```

### Pro Tip: Lazy Loading (Performance)
To load the script only when the badge becomes visible (improves PageSpeed):

```html
<cometweb-carbon-badge theme="dark"></cometweb-carbon-badge>

<!-- Optimization Script -->
<script>
    (function () {
        var el = document.querySelector('cometweb-carbon-badge');
        if (!el) return;
        var src = 'https://unpkg.com/@cometweb/carbon-badge@1.0.0/dist/cometweb-carbon-badge.esm.js';
        var io = new IntersectionObserver(function (entries) {
            var e = entries[0];
            if (!e.isIntersecting) return;
            io.disconnect();
            var s = document.createElement('script');
            s.type = 'module';
            s.src = src;
            document.body.appendChild(s);
        }, { rootMargin: '200px', threshold: 0 });
        io.observe(el);
    })();
</script>
<link rel="preconnect" href="https://unpkg.com" crossorigin />
```

### NPM
```bash
npm install @cometweb/carbon-badge
```

```js
import '@cometweb/carbon-badge';
```

```html
<cometweb-carbon-badge
  url="https://your-site.com"
  theme="dark"
  mode="estimate"
></cometweb-carbon-badge>
```

## Attributes

| Attribute    | Default     | Description                                          |
|-------------|-------------|------------------------------------------------------|
| `url`       | current URL | URL to analyze                                       |
| `mode`      | `api`       | `api` (uses CometWeb API) or `estimate` (client-side)|
| `theme`     | `dark`      | `dark` or `light`                                    |
| `lang`      | `en`        | `en` or `pl`                                         |
| `cache-ttl` | `720`       | Cache TTL in minutes (default 12h)                   |
| `api-url`   | CometWeb    | Override API base URL                                |
| `api-key`   | —           | Optional API key for premium rate limits             |
| `green-host`| `false`     | Set `"true"` to indicate green hosting (estimate mode)|

## Scoring

| Score | CO₂e / visit | Meaning                    |
|-------|-------------|----------------------------|
| A+    | < 0.10g     | Exceptionally clean        |
| A     | < 0.20g     | Very clean                 |
| B     | < 0.40g     | Cleaner than average       |
| C     | < 0.70g     | Average                    |
| D     | < 1.00g     | Above average emissions    |
| F     | ≥ 1.00g     | High emissions             |

## Methodology

Uses the **SWDM v4 Hybrid Model** from the Green Web Foundation:

```
CO₂e = (E_dc × CI) + (E_net × CI) + (E_user × CI) + (E_embodied × CI)
```

In `estimate` mode, page weight is measured via the Performance Resource Timing API.

## License

MIT © [CometWeb](https://cometweb.io)
