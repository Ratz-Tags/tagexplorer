# TagExplorer — Stage 1 Foundations

TagExplorer is evolving into a Galaxy Z Fold4–first, humiliation-layered artist gallery powered by Tailwind CSS, Motion One, and Azure whisper-only TTS. Stage 1 focuses on information architecture, data hydration, and persistent preferences so every subsequent feature inherits a consistent spine.

## What shipped in Stage 1

- **Reorganized project structure** into `/public`, `/data`, and `/src` so HTML, JSON contracts, and ES modules are decoupled and ready for static deployment.
- **Tailwind token layer** with OKLCH palette, Rajdhani/Orbitron display fonts, Inter body typography, and reusable glass/neon component classes.
- **Motion One scaffolding** that respects `prefers-reduced-motion` while exposing a `safeAnimate` helper for future page transitions and heatmap effects.
- **Dataset preload** for `artists.json`, `tags.json`, and `tts_lines.json` with a cache-aware loader that hydrates every page before UI work begins.
- **localStorage preferences** (`tagexplorer.preferences.v1`) persisting tag filters, humiliation intensity, and whisper cadence from the landing page through gallery and artist views.

## Directory layout

```
public/
  assets/           # Compiled CSS, media, config
  index.html        # Landing experience
  gallery/index.html
  artist/index.html
  about/index.html

src/
  styles/           # Tailwind entrypoint & design tokens
  js/core/          # data-loader, preferences, motion, theme helpers
  js/pages/         # ES module entry points per route
  legacy/           # Archived v1 implementation for reference

data/
  artists.json      # {artist_id, name, preview, tags[], links{}}
  tags.json         # Tag metadata with tone/intensity summaries
  tts_lines.json    # Whisper line map keyed by event
  legacy/           # Historical JSON archives
```

## Developing locally

```bash
npm install          # install tailwind, motion, and tooling
npm run dev:css      # watch & rebuild Tailwind output to public/assets/styles.css
npm run build:css    # on-demand production build of the Tailwind bundle
```

Serve the `public/` directory (or the repository root) with any static HTTP server to preview the pages. Each HTML file loads its ES module entry point directly (`type="module"`), so no bundler is required during Stage 1.

## Data contracts

- `data/artists.json`: list of artists with `artist_id`, human name, preview asset, canonical tag ids, and outbound links.
- `data/tags.json`: tag catalog describing tone, intensity, and copy used for tooltips and summaries.
- `data/tts_lines.json`: event-to-line map that will feed the Azure whisper SSML template in later stages.

All three datasets are fetched in parallel by `src/js/core/data-loader.js` and cached for reuse across routes.

## Preference persistence

`src/js/core/preferences.js` centralizes a versioned preference schema. The landing page allows visitors to set humiliation intensity, whisper cadence, and whether tag stacks persist. Gallery and artist views subscribe to updates so UI copy stays in sync without reloading.

## Next steps

Stage 2 will layer in Fold4 cover/inner responsive layouts, filter virtualization, Azure Speech integration, and animated heatmaps. Stage 3 will finalize the humiliation overlay, tooltip teases, and performance gates before deployment.
