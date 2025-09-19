# TagExplorer — Stage 3 Humiliation Polish

TagExplorer is now a Galaxy Z Fold4–first, humiliation-layered artist gallery powered by Tailwind CSS, Motion One, and Azure whisper-only TTS. Stage 3 closes out the rework with teasing tooltips, a session-limited “Caught.” overlay, dynamic whisper cadence boosts, and launch-ready documentation tuned for GitHub Pages.

## What shipped in Stage 3

- **Teasing tooltip lattice**: Every bottom-bar control, filter chip, and sheet toggle exposes data-driven tooltip copy that adjusts to your current shame stack and preferences without blocking accessibility.
- **“Caught.” session overlay**: A once-per-session modal interrupts high-intensity browsing, persists with `sessionStorage`, and ties into the humiliation preference so the layer respects opt-outs and reduced states.
- **Adaptive whisper cadence**: Filter interactions now accelerate Azure whisper cooldowns, update the Stage 3 user agent, and keep caption overlays aligned with Fold4 safe areas while still honoring reduced-motion mode.
- **Performance & launch polish**: Gallery virtualization, lazy-loaded artist previews, tooltip/offscreen content-visibility, and documentation for GitHub Pages deployment keep the bundle under the 90 KB JS / 60 KB CSS budget.

## Quality gates

Run these checks before shipping:

- `npm run build:css` — produce the minified Tailwind bundle (target: <60 KB gzip).
- `npm test` — exercise preference persistence and subscription behaviour.
- Manual smoke: add at least three filters to trigger the “Caught.” overlay, verify tooltip copy updates after clearing filters, and confirm whisper captions appear (or surface helpful disabled messaging when Azure credentials are missing).

## Azure Whisper configuration

The whisper controller reads credentials from the global scope so static builds remain hostable on GitHub Pages. Inject the following snippet **before** the gallery script tags (for example in `public/gallery/index.html`) or via a site-wide include:

```html
<script>
  window._azureTTSRegion = 'YOUR_AZURE_REGION';
  window._azureTTSKey = 'YOUR_SUBSCRIPTION_KEY';
</script>
```

If credentials are omitted, the UI surfaces the disabled state copy and no network calls are attempted.

## Developing locally

```bash
npm install       # install Tailwind, Motion One, and test tooling
npm run dev:css   # watch Tailwind and rebuild ./public/assets/styles.css
npm run build     # on-demand Tailwind build (alias of build:css)
npm test          # run node-based unit tests
```

Serve the `public/` directory (or repo root) with any static HTTP server to preview the pages. Each HTML file loads its ES module entry point directly (`type="module"`), so no bundler is required.

## Directory layout

```
public/
  assets/           # Compiled CSS, media, favicon
  index.html        # Landing experience
  gallery/index.html
  artist/index.html
  about/index.html

src/
  styles/           # Tailwind entrypoint & design tokens
  js/core/          # data-loader, preferences, motion, theme, fold + TTS helpers
  js/pages/         # ES module entry points per route
  legacy/           # Archived v1 implementation for reference

data/
  artists.json      # {artist_id, name, preview, tags[], links{}}
  tags.json         # Tag metadata with tone/intensity summaries
  tts_lines.json    # Whisper line map keyed by event
```


## Data contracts

- `data/artists.json`: list of artists with `artist_id`, human name, preview asset, canonical tag ids, and outbound links.
- `data/tags.json`: tag catalog describing tone, intensity, and copy used for tooltips and summaries.
Usage: scxctl switch <--sched <SCHED>|--mode <MODE>|--args <ARGS>>

For more information, try '--help'.```
- `data/tts_lines.json`: event-to-line map that feeds the Azure whisper SSML template.

All three datasets are fetched in parallel by `src/js/core/data-loader.js` and cached for reuse across routes.

## Preference persistence & humiliation layer

`src/js/core/preferences.js` centralizes a versioned preference schema. The landing page allows visitors to set humiliation intensity, whisper cadence, and whether tag stacks persist. Gallery and artist views subscribe to updates so UI copy stays in sync, while Stage 3 adds the tooltip lattice, session-limited overlay, and cadence boosts that respect the same preference switches.

## Deployment

`public/` is a static bundle ready for GitHub Pages. Run `npm run build` to refresh the Tailwind output, upload the directory (or push to a `gh-pages` branch), and confirm the quality gates above. Azure credentials can be injected via the snippet in the HTML templates or through a small inline script served by your hosting provider.