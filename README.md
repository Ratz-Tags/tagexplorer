# TagExplorer — Stage 2 Foldable UX

TagExplorer is now a Galaxy Z Fold4–first, humiliation-layered artist gallery powered by Tailwind CSS, Motion One, and Azure whisper-only TTS. Stage 2 focuses on cover/inner continuity, gallery virtualization, and live whisper playback so the experience stays hostile without breaking performance.

## What shipped in Stage 2

- **Fold-aware layouts**: bottom sheets, safe-area padding, and fold state detection ensure filters, captions, and controls reflow between cover and inner displays without losing scroll position.
- **Virtualized gallery & tag heatmaps**: chunked rendering keeps DOM weight low while a heat-reactive filter panel pulses brighter as you stack more tags.
- **Azure whisper integration**: runtime voice discovery (whisper-only), SSML synthesis, caption overlays, and intensity-aware cooldowns with mute/motion toggles persisted in `localStorage`.
- **Artist card motion polish**: pointer-driven tilt/glow, content-visibility hints for off-screen cards, and bottom navigation controls tuned for one-handed Fold4 reach.

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
  js/core/          # data-loader, preferences, motion, theme, fold + TTS helpers
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

Serve the `public/` directory (or the repository root) with any static HTTP server to preview the pages. Each HTML file loads its ES module entry point directly (`type="module"`), so no bundler is required during Stage 2.

## Data contracts

- `data/artists.json`: list of artists with `artist_id`, human name, preview asset, canonical tag ids, and outbound links.
- `data/tags.json`: tag catalog describing tone, intensity, and copy used for tooltips and summaries.
- `data/tts_lines.json`: event-to-line map that will feed the Azure whisper SSML template in later stages.

All three datasets are fetched in parallel by `src/js/core/data-loader.js` and cached for reuse across routes.

## Preference persistence

`src/js/core/preferences.js` centralizes a versioned preference schema. The landing page allows visitors to set humiliation intensity, whisper cadence, and whether tag stacks persist. Gallery and artist views subscribe to updates so UI copy stays in sync without reloading, while the Fold4 bottom sheets expose quick mute and reduced-motion toggles.

## Next steps

Stage 3 will finalize the humiliation overlay, tooltip teases, performance budgets, and launch documentation to complete the degrading experience.
