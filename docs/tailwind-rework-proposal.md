# Tailwind CSS Rework Proposal

## Objectives
- **Unify all styling with Tailwind CSS compiled via the CLI pipeline** so the gallery, humiliation overlays, and tag tooling share a single design language instead of ad-hoc global selectors.
- **Deliver a pinned, neon command ribbon** that keeps the PINNED / AUDIO / GLOW / PROMPT / FILTER controls locked to the top of the viewport, paired with a feminine script "TagExplorer" wordmark to reinforce the humiliation fantasy.
- **Stabilise gallery rendering** by paginating artists in batches of 100 pulled from `artists.json`, using infinite scroll only to fetch the next page and preventing recycled pages from looping.
- **Improve reliability of the fullscreen viewer** with explicit Danbooru pagination and resilient fallbacks so image grids and zoom states never error out or vanish.
- **Adopt a lightweight build step** (`npm run build:css`) that ships the minified `style.css` asset for GitHub Pages while keeping authoring in `styles/tailwind.css` human-friendly.

## Constraints & Technical Guardrails
- Tailwind ships through the **Tailwind CLI** (or PostCSS plugin) so production HTML never depends on `cdn.tailwindcss.com`.
- The authoritative config remains in `tailwind.config.js`; run `npm run build:css` locally or in CI to regenerate `style.css` before publishing.
- Custom utilities/components live inside `styles/tailwind.css` under explicit `@layer` blocks so classes like `selection:bg-blush/60` exist at build time.
- Runtime stack remains **vanilla ES modules**, Motion One for animation, Azure whisper-only TTS with captions, and existing humiliation copy.
- Respect Fold4 breakpoints from `AGENTS.md` (`fold-cover`, `fold-inner`) and safe-area utilities.
- All changes must honour existing data models and JSON loading strategy.

## Tailwind Integration Plan
### 1. CLI Bootstrap
- Keep the existing npm script (`"build:css": "tailwindcss -i styles/tailwind.css -o style.css --minify"`) as the single source of truth; run it before every deploy.
- Document the workflow so contributors run:
  ```bash
  npm install
  npm run build:css
  ```
  This ships a compressed `style.css` to GitHub Pages while Tailwind classes remain author-friendly in `styles/tailwind.css`.
- Extend `tailwind.config.js` with the humiliation palette, Parisienne script font, neon shadows, and Fold4 breakpoints. Example excerpt:
  ```js
  export default {
    content: ['./index.html', './modules/**/*.js'],
    theme: {
      extend: {
        colors: {
          night: '#0c0b16',
          panel: '#161525',
          glow: '#66f3ff',
          blush: '#ff64d4',
          ember: '#ff8257',
        },
        fontFamily: {
          script: ['Parisienne', 'cursive'],
          display: ['Rajdhani', 'system-ui', 'sans-serif'],
        },
        screens: {
          'fold-cover': {'raw': '(max-width: 520px) and (orientation: portrait)'},
          'fold-inner': {'raw': '(min-width: 980px) and (min-height: 980px)'},
        },
      },
    },
    plugins: [],
  };
  ```

### 2. Authoring in `styles/tailwind.css`
- Maintain the usual Tailwind entry point:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  @layer base {
    :root { color-scheme: dark; }
    ::selection { @apply bg-blush/60 text-white; }
  }

  @layer components {
    .tag-explorer-wordmark {@apply font-script text-[clamp(2.5rem,6vw,3.75rem)] text-blush drop-shadow-[0_0_25px_rgba(255,118,214,0.45)];}
    .command-btn {@apply control-btn px-6 py-2 tracking-[0.5em] text-white bg-blush/20 border-blush/40 shadow-pulse;}
    .command-btn--ghost {@apply control-btn bg-white/5 border-blush/20 text-slate-200;}
  }
  ```
- Commit both `styles/tailwind.css` and the generated `style.css` so GitHub Pages stays static while avoiding runtime CDN lookups.

### 3. HTML Integration
- Load the pre-built stylesheet in every page head:
  ```html
  <link rel="stylesheet" href="style.css">
  ```
- Fonts (`Inter`, `Rajdhani`, `Parisienne`) continue to stream from Google Fonts, pairing the neon wordmark with our icy body copy.

### 4. Component & Utility Layers
- Use `@layer components` for glass panels, humiliation banners, command ribbon, and fullscreen toolbar buttons.
- Extend `@layer utilities` with helpers for sticky safe zones, `backface-visibility`, `perspective`, and `view-transition-name` for Motion One tie-ins.
- Define typography tokens so the Parisienne script wordmark and Rajdhani headings are accessible via Tailwind classes.

### 5. Legacy CSS Bridging
- Trim `style.css` down to Motion One keyframes, glow halos, scrollbar styling, and the few advanced effects that Tailwind cannot express.
- Keep humiliating overlays (taunts, JRPG bubbles) as component classes so JS modules no longer rely on brittle selectors.
- Document any residual CSS in `styles/motion.css` with comments on why Tailwind utilities were insufficient.

## Layout & Component System
### Command Ribbon (Pinned Audio Glow Prompt Filter)
- Sticky header with script wordmark, taunting subtitle, and a command bar containing **PINNED / AUDIO / GLOW / PROMPT / FILTER / TOP** buttons.
- Buttons glow hotter on hover and remain reachable on Fold4 cover mode; add ghost styling for "TOP" so it reads as a secondary action.
- IntersectionObserver toggles an `is-sticky` class once the user scrolls, intensifying the glow and border to remind them they're being watched.

### Gallery Shell & Pagination
- Grid uses `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` with consistent `aspect-[4/5]` media wrappers.
- Pagination pulls **100 artists at a time** from `filtered` results. Infinite scroll merely advances `currentPage` by one and renders the next slice while guarding against duplicates via a `renderedPages` set.
- Keep at most six pages in the DOM to avoid bloat; prune older pages while preserving scroll height for smooth continuation.

### Fullscreen Viewer
- Fetch Danbooru posts 40 at a time, following `order:approvals` while respecting tag limits (2 tags max).
- Lazy render thumbnails inside the zoom modal, and load additional pages only when the sentinel comes into view.
- Provide friendly fallbacks (`fallback.jpg`, captions, taunt overlay) when Danbooru returns no results or a fetch errors out.

### Filters & Humiliation Layer
- Selected tags reside in a blurred pill rack with cumulative glow tied to tag count.
- Random background rotation respects incognito mode (solid dark) vs glow mode (OKLCH gradients).
- Audio and taunt banners remain accessible via keyboard and provide captions.

## Motion & Feedback
- Motion One handles hover tilts, sticky taunt pulses, and command-bar glow ramps. Guard with `prefers-reduced-motion` checks.
- Use Tailwind `group`/`group-hover` classes to trigger humiliating tooltips without extra JS.
- Screen pulse + vibration (when supported) accentuate tag actions; provide focus-visible outlines in high-contrast pink/cyan.

## Performance & Accessibility
- Artist cards lazy-load with `loading="lazy"` and prefetch on hover for the fullscreen viewer.
- Batch count hydration so we never call Danbooru for thousands of artists at once; throttle with `setTimeout` gaps.
- Keep header sticky but lightweight (<20 DOM nodes) so scroll performance stays at 60fps on Fold4 cover mode.
- Announce sticky state and pagination updates via ARIA live regions (existing `#filtered-results`).

## Migration Steps
1. Wire the CLI build (`npm run build:css`) into the release checklist and confirm `style.css` is regenerated before committing.
2. Create Tailwind component classes for command ribbon, gallery cards, tag pills, and humiliation banners.
3. Replace legacy header markup with the sticky command ribbon, wiring existing button IDs/classes so JS keeps working.
4. Refactor gallery pagination to 100-per-page slices with a `renderedPages` guard, pruning old pages and preventing loops.
5. Harden fullscreen viewer to fetch sequential Danbooru pages, show fallback states, and close cleanly on Escape.
6. Remove redundant CSS from `style.css`, moving essential animations to `styles/motion.css`.
7. Update documentation (`README.md`, this proposal) with Tailwind usage notes, CLI expectations, and how to extend the command ribbon.
8. QA on desktop, Fold4 cover/inner, and reduced-motion contexts; confirm Azure whisper voices still initialise and captions render.

## Risks & Mitigations
- **Runtime config bloat**: keep Tailwind `extend` minimal; rely on component classes instead of long utility chains in markup.
- **Build drift**: enforce `npm run build:css` in CI or a pre-push hook so the committed `style.css` always matches `styles/tailwind.css`.
- **Sticky header overlap**: reserve space with padding on the main container and test on small screens to avoid content jumping under the command bar.
- **Danbooru rate limits**: paginate API calls, reuse sessionStorage caches, and handle empty responses gracefully.

## Approval & Next Steps
- Approve this proposal to greenlight the Tailwind refactor.
- Schedule implementation in two passes: (1) layout + command ribbon + pagination fixes, (2) fullscreen viewer polish + humiliation overlays.
- After implementation, capture visual snapshots (Playwright `page.screenshot`) to confirm the sticky command ribbon and pagination behave as designed.
