# Tailwind CSS Rework Proposal

## Objectives
- **Unify all styling with Tailwind CSS (Play CDN)** so the gallery, humiliation overlays, and tag tooling share a single design language instead of ad-hoc global selectors.
- **Deliver a pinned, neon command ribbon** that keeps the PINNED / AUDIO / GLOW / PROMPT / FILTER controls locked to the top of the viewport, paired with a feminine script "TagExplorer" wordmark to reinforce the humiliation fantasy.
- **Stabilise gallery rendering** by paginating artists in batches of 100 pulled from `artists.json`, using infinite scroll only to fetch the next page and preventing recycled pages from looping.
- **Improve reliability of the fullscreen viewer** with explicit Danbooru pagination and resilient fallbacks so image grids and zoom states never error out or vanish.
- **Preserve the no-build workflow** required for GitHub Pages hosting—Tailwind must be delivered via CDN with inline configuration and optional component layers.

## Constraints & Technical Guardrails
- Tailwind loads through the official **Play CDN** only. No Vite, PostCSS, or build tooling.
- Tailwind config must be defined before the CDN script executes. Prefer a shared module (e.g. `scripts/tailwind-config.js`) or inline `<script>` that sets `window.tailwind.config`.
- Custom utilities/components live inside `<style type="text/tailwindcss">` blocks. Bespoke CSS (Motion One keyframes, command-ribbon polish) can sit in lean `<style>` tags or `style.css`.
- Runtime stack remains **vanilla ES modules**, Motion One for animation, Azure whisper-only TTS with captions, and existing humiliation copy.
- Respect Fold4 breakpoints from `AGENTS.md` (`fold-cover`, `fold-inner`) and safe-area utilities.
- All changes must honour existing data models and JSON loading strategy.

## Tailwind Integration Plan
### 1. CDN Bootstrap
```html
<head>
  <script>
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            base: 'oklch(0.1 0.02 260)',
            panel: 'oklch(0.19 0.02 260)',
            accent: {
              cyan: 'oklch(0.8 0.14 205)',
              pink: 'oklch(0.8 0.18 350)',
              heat: 'oklch(0.66 0.25 25)'
            }
          },
          fontFamily: {
            display: ['Rajdhani', 'Orbitron', 'sans-serif'],
            sans: ['Inter', 'system-ui', 'sans-serif'],
            script: ['Parisienne', 'cursive']
          },
          boxShadow: {
            'neon-card': '0 25px 60px -25px rgba(102,243,255,.55)',
            'heat-ring': '0 0 0 1px rgba(255,118,214,.35) inset, 0 18px 48px -30px rgba(255,118,214,.8)'
          },
          screens: {
            'fold-cover': {'raw': '(max-width: 520px) and (orientation: portrait)'},
            'fold-inner': {'raw': '(min-width: 980px) and (min-height: 980px)'}
          }
        }
      }
    };
  </script>
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script>
  <style type="text/tailwindcss">
    @layer components {
      .command-btn {@apply control-btn px-6 py-2 tracking-[0.5em] text-white bg-accent-pink/20 border-accent-pink/40 shadow-heat-ring;}
      .command-btn--ghost {@apply control-btn bg-white/5 border-accent-pink/20 text-slate-200;}
      .tag-explorer-wordmark {@apply font-script text-[clamp(2.5rem,6vw,3.75rem)] text-accent-pink drop-shadow-[0_0_25px_rgba(255,118,214,0.45)];}
    }
  </style>
</head>
```
- Wrap the snippet in a reusable partial (e.g. `partials/tailwind-head.html`) to avoid duplication across `index.html`, future `/gallery/`, `/artist/`, etc.
- Keep the inline config under ~8 KB; defer rarely used utilities to bespoke CSS if necessary.

### 2. Component & Utility Layers
- Use `@layer components` for glass panels, humiliation banners, command ribbon, and fullscreen toolbar buttons.
- Extend `@layer utilities` with helpers for sticky safe zones, `backface-visibility`, `perspective`, and `view-transition-name` for Motion One tie-ins.
- Define typography tokens so the Parisienne script wordmark and Rajdhani headings are accessible via Tailwind classes.

### 3. Legacy CSS Bridging
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
1. Drop in the CDN bootstrap snippet on `index.html` and ensure Tailwind utilities render correctly.
2. Create Tailwind component classes for command ribbon, gallery cards, tag pills, and humiliation banners.
3. Replace legacy header markup with the sticky command ribbon, wiring existing button IDs/classes so JS keeps working.
4. Refactor gallery pagination to 100-per-page slices with a `renderedPages` guard, pruning old pages and preventing loops.
5. Harden fullscreen viewer to fetch sequential Danbooru pages, show fallback states, and close cleanly on Escape.
6. Remove redundant CSS from `style.css`, moving essential animations to `styles/motion.css`.
7. Update documentation (`README.md`, this proposal) with Tailwind usage notes, CDN caveats, and how to extend the command ribbon.
8. QA on desktop, Fold4 cover/inner, and reduced-motion contexts; confirm Azure whisper voices still initialise and captions render.

## Risks & Mitigations
- **Runtime config bloat**: keep Tailwind `extend` minimal; rely on component classes instead of long utility chains in markup.
- **CDN outage**: document a fallback (downloaded Tailwind standalone) and show a soft warning if CDN fails.
- **Sticky header overlap**: reserve space with padding on the main container and test on small screens to avoid content jumping under the command bar.
- **Danbooru rate limits**: paginate API calls, reuse sessionStorage caches, and handle empty responses gracefully.

## Approval & Next Steps
- Approve this proposal to greenlight the Tailwind refactor.
- Schedule implementation in two passes: (1) layout + command ribbon + pagination fixes, (2) fullscreen viewer polish + humiliation overlays.
- After implementation, capture visual snapshots (Playwright `page.screenshot`) to confirm the sticky command ribbon and pagination behave as designed.
