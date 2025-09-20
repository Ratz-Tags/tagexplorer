# Tailwind CSS Rework Proposal

## Objectives
- **Unify styling under Tailwind CSS** while eliminating ad-hoc global selectors and duplicated visual rules that currently live in `style.css`.
- **Deliver a sharper, neon-glass aesthetic** aligned with the humiliation-focused moodboard in `AGENTS.md`, including Rajdhani/Inter typography, neon cyan/pink accents, and glitch-infused motion.
- **Guarantee a "no-build" workflow** so that GitHub Pages can continue serving static files without requiring local npm scripts or CI pipelines.
- **Improve perceived performance** by slimming CSS, reducing layout thrash, and leaning on GPU-accelerated transitions for a 60fps experience on desktop and Galaxy Z Fold4 displays.

## Constraints & Technical Guardrails
- Tailwind must load through the official **Play CDN** to avoid bundling (`<script src="https://cdn.tailwindcss.com?...">`).
- Custom tokens (OKLCH palette, fonts, fold breakpoints) should live in an inline `tailwind.config = { ... }` block inside each HTML entry point, or be factored into a shared module (e.g., `scripts/tailwind-config.js`) that sets `tailwind.config` before Tailwind initializes.
- Extended utilities or component recipes can be authored inside a `<style type="text/tailwindcss">` block using `@layer base|components|utilities`, which the CDN version parses at runtime.
- Any bespoke CSS that Tailwind cannot express (complex keyframes, Motion One integration) stays in tiny vanilla `<style>` blocks or dedicated CSS modules imported with `<link rel="stylesheet" href="...">`.
- Retain vanilla JS ES modules and Motion One for animation; avoid introducing build-time dependencies.

## Tailwind Integration Strategy

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
            sans: ['Inter', 'system-ui', 'sans-serif']
          },
          boxShadow: {
            'neon-card': '0 20px 40px -22px rgba(8,196,255,.55)',
            'heat-ring': '0 0 0 1px rgba(255,105,180,.4) inset, 0 12px 32px -20px rgba(255,105,180,.8)'
          },
          screens: {
            'fold-cover': { 'raw': '(max-width: 520px) and (orientation: portrait)' },
            'fold-inner': { 'raw': '(min-width: 980px) and (min-height: 980px)' }
          }
        }
      }
    };
  </script>
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script>
  <style type="text/tailwindcss">
    @layer base {
      html {
        font-family: theme('fontFamily.sans');
        background-color: theme('colors.panel');
        color: rgb(230 230 230);
      }
    }
    @layer components {
      .glass-panel {
        @apply bg-panel/80 backdrop-blur-xl border border-accent-pink/30 shadow-heat-ring rounded-[20px];
      }
      .neon-card {
        @apply glass-panel shadow-neon-card hover:shadow-accent-cyan/50 transition-shadow duration-300;
      }
    }
  </style>
</head>
```
- Encapsulate the snippet above in a shared fragment (e.g., `partials/tailwind-head.html`) to avoid duplication across `/`, `/gallery/`, `/artist/`, etc.
- Keep the CDN query string short; optional plugins (forms, typography) cover most needs without a build step.

### 2. Replace `style.css`
- Split the existing monolithic CSS into Tailwind utility classes applied directly in markup.
- Migrate recurring patterns into semantic component classes inside `@layer components` (e.g., `.tag-pill`, `.toolbar`, `.humiliation-banner`).
- Preserve keyframes for glitch/tilt in a trimmed `styles/motion.css` that only contains animation definitions and `@property` declarations not yet supported by Tailwind.
- Remove redundant CSS variables; re-express values via Tailwind theme tokens to avoid runtime recalculation.

### 3. Shared Layout Utilities
- Author custom utilities in `@layer utilities` for rare properties (e.g., `backface-visibility: hidden`, `perspective`, `view-transition-name`).
- Provide `safe-area` padding helpers:
```css
@layer utilities {
  .pb-safe { padding-bottom: calc(1.25rem + env(safe-area-inset-bottom)); }
  .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); }
}
```
- Use `fold-cover:` and `fold-inner:` modifiers to tailor gallery density, filter placement, and caption layout per Fold4 mode.

## Visual & Interaction System

### Landing (`/`)
- Structure: full-height flex column with a translucent hero card, "Enter" button, and whispering tagline.
- Tailwind primitives: `min-h-dvh`, `flex`, `items-center`, `justify-between`, `gap-12`, `text-accent-pink`.
- Motion: low-frequency background gradient animated using custom keyframes; "Enter" button uses Motion One on pointerenter for tilt.

### Gallery (`/gallery/`)
- Shell: `grid` layout with responsive columns `grid-cols-1 fold-inner:grid-cols-3 md:grid-cols-2`.
- Filters toolbar: `.toolbar` component using `@apply glass-panel sticky top-0 z-40 flex gap-3 px-4 py-2 fold-cover:pb-safe`.
- Tag pills: `inline-flex items-center gap-2 rounded-full border border-accent-pink/40 px-4 py-2 text-sm uppercase tracking-[0.2em] hover:bg-accent-pink/20`.
- Artist cards: `.neon-card flex flex-col gap-4 overflow-hidden` with image wrappers using `aspect-[4/5] rounded-2xl bg-panel/70` and `loading="lazy"` + `decoding="async"`.
- Virtualization: keep the existing lazy render logic but throttle reflows with `requestAnimationFrame` batching; pre-calc card heights to prevent layout shift.

### Artist Profile (`/artist/:id/`)
- Split view: `flex flex-col lg:flex-row gap-8`, with sticky metadata column on `lg:` breakpoints.
- Stats & humiliation copy live inside `.glass-panel` sections; use `accent-heat` gradient highlights for guilt prompts.
- Captions area: `fold-cover:fixed fold-cover:bottom-0 fold-cover:w-full` vs `fold-inner:absolute fold-inner:right-6 fold-inner:top-1/2` for large unfolded layout.

### About / Data Pages
- Use `prose prose-invert` from Tailwind Typography for documentation-style pages, wrapped inside `.glass-panel max-w-3xl mx-auto` containers.

## Motion & Feedback Layer
- Integrate Motion One with Tailwind's utility classes for base transforms; e.g., cards start at `transform-gpu will-change-transform` to hint at hardware acceleration.
- Define keyframes in `styles/motion.css` (e.g., `@keyframes neonFlicker`) and trigger via Tailwind's `animate-[neonFlicker_2s_ease-in-out_infinite]` syntax.
- Respect `prefers-reduced-motion` by wrapping Motion One triggers in `if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)`.
- Tailwind `group` and `group-hover` states drive humiliation tooltips and overlay transitions without extra JS listeners.

## Performance & Non-Lag Considerations
- **CSS payload**: Tailwind CDN only delivers used classes at runtime; removing `style.css` (38KB) cuts blocking CSS while still caching across pages.
- **Layout stability**: consistent `aspect-*` utilities ensure image skeletons hold space; combine with `bg-gradient-to-br from-panel/40 via-base/20` placeholders.
- **JS scheduling**: refactor filter updates to run inside `queueMicrotask` + `requestAnimationFrame` loops to avoid hitches when toggling many tags.
- **Asset strategy**: adopt `loading="lazy"`, `fetchpriority="low"` on gallery images, and preconnect to Azure TTS endpoints to reduce whisper latency.
- **Fold4 tuning**: use `fold-cover` variants to minimize simultaneous animations (only opacity/translate) while enabling full tilt/glitch on `fold-inner` and desktop.

## Migration Plan
1. **Bootstrap Tailwind** on `index.html` with CDN script + inline config; verify styling parity for hero layout.
2. **Create component library** inside `<style type="text/tailwindcss">` covering toolbars, cards, pills, overlays, and caption containers.
3. **Refactor markup** page-by-page, replacing `class="selected-tags-bar"` etc. with Tailwind utility strings or the new component classes.
4. **Isolate legacy CSS**: move remaining bespoke keyframes to `styles/motion.css`, rename old `style.css` to `styles/legacy.css`, and delete once markup conversion completes.
5. **Audit JS interactions** to align with new class hooks (e.g., query `.js-filter-pill` data attributes instead of CSS selectors that no longer exist).
6. **Performance pass**: instrument with `performance.mark` to track filter latency, add requestAnimationFrame batching, and verify `prefers-reduced-motion` fallback.
7. **Cross-device QA**: test Fold4 cover/inner breakpoints via Chrome device emulation; ensure safe-area utilities keep bottom navigation accessible.
8. **Documentation update**: refresh `README.md` with Tailwind usage notes, CDN caveats, and instructions for extending theme tokens without a build.

## Deliverables
- Updated HTML pages with Tailwind utilities and shared components.
- `scripts/tailwind-config.js` (optional) that centralizes the CDN config for reuse.
- `styles/motion.css` containing keyframes + Motion One CSS custom properties.
- Removal of `style.css` and replacement with Tailwind-first styling.
- README section documenting the no-build Tailwind workflow, how to edit inline config, and guidelines for adding new components using `@layer`.

## Risks & Mitigations
- **Runtime config size**: inline configs larger than ~10KB can slow page boot. Keep the theme extension minimal and defer non-critical utilities to bespoke CSS modules.
- **Class name verbosity**: to maintain readability, rely on semantic component classes defined via `@layer components` for complex groups (e.g., `.gallery-toolbar`).
- **CDN dependency**: add a `<noscript>` warning and document an offline workflow (downloaded Tailwind standalone file) should the CDN be blocked.
- **Browser support**: ensure fallback colors use hex or RGB for browsers lacking OKLCH; Tailwind allows specifying arrays like `['oklch(...)', '#0f0b1b']` for safety.

## Next Steps
- Approve this proposal.
- Schedule implementation sprints (estimated 2–3 passes: core shell, gallery/artist pages, humiliation + motion polish).
- Begin refactoring with automated visual regression snapshots (Playwright `page.screenshot`) to confirm parity after each page migration.
# Tailwind CSS Rework Proposal

## Objectives
- **Unify styling under Tailwind CSS** while eliminating ad-hoc global selectors and duplicated visual rules that currently live in `style.css`.
- **Deliver a sharper, neon-glass aesthetic** aligned with the humiliation-focused moodboard in `AGENTS.md`, including Rajdhani/Inter typography, neon cyan/pink accents, and glitch-infused motion.
- **Guarantee a "no-build" workflow** so that GitHub Pages can continue serving static files without requiring local npm scripts or CI pipelines.
- **Improve perceived performance** by slimming CSS, reducing layout thrash, and leaning on GPU-accelerated transitions for a 60fps experience on desktop and Galaxy Z Fold4 displays.

## Constraints & Technical Guardrails
- Tailwind must load through the official **Play CDN** to avoid bundling (`<script src="https://cdn.tailwindcss.com?...">`).
- Custom tokens (OKLCH palette, fonts, fold breakpoints) should live in an inline `tailwind.config = { ... }` block inside each HTML entry point, or be factored into a shared module (e.g., `scripts/tailwind-config.js`) that sets `tailwind.config` before Tailwind initializes.
- Extended utilities or component recipes can be authored inside a `<style type="text/tailwindcss">` block using `@layer base|components|utilities`, which the CDN version parses at runtime.
- Any bespoke CSS that Tailwind cannot express (complex keyframes, Motion One integration) stays in tiny vanilla `<style>` blocks or dedicated CSS modules imported with `<link rel="stylesheet" href="...">`.
- Retain vanilla JS ES modules and Motion One for animation; avoid introducing build-time dependencies.

## Tailwind Integration Strategy

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
            ui: ['Inter', 'system-ui', 'sans-serif']
          },
          boxShadow: {
            'neon-card': '0 20px 40px -22px rgba(8,196,255,.55)',
            'heat-ring': '0 0 0 1px rgba(255,105,180,.4) inset, 0 12px 32px -20px rgba(255,105,180,.8)'
          },
          screens: {
            'fold-cover': { 'raw': '(max-width: 520px) and (orientation: portrait)' },
            'fold-inner': { 'raw': '(min-width: 980px) and (min-height: 980px)' }
          }
        }
      }
    };
  </script>
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script>
  <style type="text/tailwindcss">
    @layer base {
      html {
        font-family: theme('fontFamily.sans');
        background-color: theme('colors.panel');
        color: rgb(230 230 230);
      }
    }
    @layer components {
      .glass-panel {
        @apply bg-panel/80 backdrop-blur-xl border border-accent-pink/30 shadow-heat-ring rounded-[20px];
      }
      .neon-card {
        @apply glass-panel shadow-neon-card hover:shadow-accent-cyan/50 transition-shadow duration-300;
      }
    }
  </style>
</head>
```
- Encapsulate the snippet above in a shared fragment (e.g., `partials/tailwind-head.html`) to avoid duplication across `/`, `/gallery/`, `/artist/`, etc.
- Keep the CDN query string short; optional plugins (forms, typography) cover most needs without a build step.

### 2. Replace `style.css`
- Split the existing monolithic CSS into Tailwind utility classes applied directly in markup.
- Migrate recurring patterns into semantic component classes inside `@layer components` (e.g., `.tag-pill`, `.toolbar`, `.humiliation-banner`).
- Preserve keyframes for glitch/tilt in a trimmed `styles/motion.css` that only contains animation definitions and `@property` declarations not yet supported by Tailwind.
- Remove redundant CSS variables; re-express values via Tailwind theme tokens to avoid runtime recalculation.

### 3. Shared Layout Utilities
- Author custom utilities in `@layer utilities` for rare properties (e.g., `backface-visibility: hidden`, `perspective`, `view-transition-name`).
- Provide `safe-area` padding helpers:
```css
@layer utilities {
  .pb-safe { padding-bottom: calc(1.25rem + env(safe-area-inset-bottom)); }
  .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); }
}
```
- Use `fold-cover:` and `fold-inner:` modifiers to tailor gallery density, filter placement, and caption layout per Fold4 mode.

## Visual & Interaction System

### Landing (`/`)
- Structure: full-height flex column with a translucent hero card, "Enter" button, and whispering tagline.
- Tailwind primitives: `min-h-dvh`, `flex`, `items-center`, `justify-between`, `gap-12`, `text-accent-pink`.
- Motion: low-frequency background gradient animated using custom keyframes; "Enter" button uses Motion One on pointerenter for tilt.

### Gallery (`/gallery/`)
- Shell: `grid` layout with responsive columns `grid-cols-1 fold-inner:grid-cols-3 md:grid-cols-2`.
- Filters toolbar: `.toolbar` component using `@apply glass-panel sticky top-0 z-40 flex gap-3 px-4 py-2 fold-cover:pb-safe`.
- Tag pills: `inline-flex items-center gap-2 rounded-full border border-accent-pink/40 px-4 py-2 text-sm uppercase tracking-[0.2em] hover:bg-accent-pink/20`.
- Artist cards: `.neon-card flex flex-col gap-4 overflow-hidden` with image wrappers using `aspect-[4/5] rounded-2xl bg-panel/70` and `loading="lazy"` + `decoding="async"`.
- Virtualization: keep the existing lazy render logic but throttle reflows with `requestAnimationFrame` batching; pre-calc card heights to prevent layout shift.

### Artist Profile (`/artist/:id/`)
- Split view: `flex flex-col lg:flex-row gap-8`, with sticky metadata column on `lg:` breakpoints.
- Stats & humiliation copy live inside `.glass-panel` sections; use `accent-heat` gradient highlights for guilt prompts.
- Captions area: `fold-cover:fixed fold-cover:bottom-0 fold-cover:w-full` vs `fold-inner:absolute fold-inner:right-6 fold-inner:top-1/2` for large unfolded layout.

### About / Data Pages
- Use `prose prose-invert` from Tailwind Typography for documentation-style pages, wrapped inside `.glass-panel max-w-3xl mx-auto` containers.

## Motion & Feedback Layer
- Integrate Motion One with Tailwind's utility classes for base transforms; e.g., cards start at `transform-gpu will-change-transform` to hint at hardware acceleration.
- Define keyframes in `styles/motion.css` (e.g., `@keyframes neonFlicker`) and trigger via Tailwind's `animate-[neonFlicker_2s_ease-in-out_infinite]` syntax.
- Respect `prefers-reduced-motion` by wrapping Motion One triggers in `if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)`.
- Tailwind `group` and `group-hover` states drive humiliation tooltips and overlay transitions without extra JS listeners.

## Performance & Non-Lag Considerations
- **CSS payload**: Tailwind CDN only delivers used classes at runtime; removing `style.css` (38KB) cuts blocking CSS while still caching across pages.
- **Layout stability**: consistent `aspect-*` utilities ensure image skeletons hold space; combine with `bg-gradient-to-br from-panel/40 via-base/20` placeholders.
- **JS scheduling**: refactor filter updates to run inside `queueMicrotask` + `requestAnimationFrame` loops to avoid hitches when toggling many tags.
- **Asset strategy**: adopt `loading="lazy"`, `fetchpriority="low"` on gallery images, and preconnect to Azure TTS endpoints to reduce whisper latency.
- **Fold4 tuning**: use `fold-cover` variants to minimize simultaneous animations (only opacity/translate) while enabling full tilt/glitch on `fold-inner` and desktop.

## Migration Plan
1. **Bootstrap Tailwind** on `index.html` with CDN script + inline config; verify styling parity for hero layout.
2. **Create component library** inside `<style type="text/tailwindcss">` covering toolbars, cards, pills, overlays, and caption containers.
3. **Refactor markup** page-by-page, replacing `class="selected-tags-bar"` etc. with Tailwind utility strings or the new component classes.
4. **Isolate legacy CSS**: move remaining bespoke keyframes to `styles/motion.css`, rename old `style.css` to `styles/legacy.css`, and delete once markup conversion completes.
5. **Audit JS interactions** to align with new class hooks (e.g., query `.js-filter-pill` data attributes instead of CSS selectors that no longer exist).
6. **Performance pass**: instrument with `performance.mark` to track filter latency, add requestAnimationFrame batching, and verify `prefers-reduced-motion` fallback.
7. **Cross-device QA**: test Fold4 cover/inner breakpoints via Chrome device emulation; ensure safe-area utilities keep bottom navigation accessible.
8. **Documentation update**: refresh `README.md` with Tailwind usage notes, CDN caveats, and instructions for extending theme tokens without a build.

## Deliverables
- Updated HTML pages with Tailwind utilities and shared components.
- `scripts/tailwind-config.js` (optional) that centralizes the CDN config for reuse.
- `styles/motion.css` containing keyframes + Motion One CSS custom properties.
- Removal of `style.css` and replacement with Tailwind-first styling.
- README section documenting the no-build Tailwind workflow, how to edit inline config, and guidelines for adding new components using `@layer`.

## Risks & Mitigations
- **Runtime config size**: inline configs larger than ~10KB can slow page boot. Keep the theme extension minimal and defer non-critical utilities to bespoke CSS modules.
- **Class name verbosity**: to maintain readability, rely on semantic component classes defined via `@layer components` for complex groups (e.g., `.gallery-toolbar`).
- **CDN dependency**: add a `<noscript>` warning and document an offline workflow (downloaded Tailwind standalone file) should the CDN be blocked.
- **Browser support**: ensure fallback colors use hex or RGB for browsers lacking OKLCH; Tailwind allows specifying arrays like `['oklch(...)', '#0f0b1b']` for safety.

## Next Steps
- Approve this proposal.
- Schedule implementation sprints (estimated 2–3 passes: core shell, gallery/artist pages, humiliation + motion polish).
- Begin refactoring with automated visual regression snapshots (Playwright `page.screenshot`) to confirm parity after each page migration.
# Tailwind CSS Rework Proposal

## Objectives
- **Unify styling under Tailwind CSS** while eliminating ad-hoc global selectors and duplicated visual rules that currently live in `style.css`.
- **Deliver a sharper, neon-glass aesthetic** aligned with the humiliation-focused moodboard in `AGENTS.md`, including Rajdhani/Inter typography, neon cyan/pink accents, and glitch-infused motion.
- **Guarantee a "no-build" workflow** so that GitHub Pages can continue serving static files without requiring local npm scripts or CI pipelines.
- **Improve perceived performance** by slimming CSS, reducing layout thrash, and leaning on GPU-accelerated transitions for a 60fps experience on desktop and Galaxy Z Fold4 displays.

## Constraints & Technical Guardrails
- Tailwind must load through the official **Play CDN** to avoid bundling (`<script src="https://cdn.tailwindcss.com?...">`).
- Custom tokens (OKLCH palette, fonts, fold breakpoints) should live in an inline `tailwind.config = { ... }` block inside each HTML entry point, or be factored into a shared module (e.g., `scripts/tailwind-config.js`) that sets `tailwind.config` before Tailwind initializes.
- Extended utilities or component recipes can be authored inside a `<style type="text/tailwindcss">` block using `@layer base|components|utilities`, which the CDN version parses at runtime.
- Any bespoke CSS that Tailwind cannot express (complex keyframes, Motion One integration) stays in tiny vanilla `<style>` blocks or dedicated CSS modules imported with `<link rel="stylesheet" href="...">`.
- Retain vanilla JS ES modules and Motion One for animation; avoid introducing build-time dependencies.

## Tailwind Integration Strategy

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
            ui: ['Inter', 'system-ui', 'sans-serif']
          },
          boxShadow: {
            'neon-card': '0 20px 40px -22px rgba(8,196,255,.55)',
            'heat-ring': '0 0 0 1px rgba(255,105,180,.4) inset, 0 12px 32px -20px rgba(255,105,180,.8)'
          },
          screens: {
            'fold-cover': { 'raw': '(max-width: 520px) and (orientation: portrait)' },
            'fold-inner': { 'raw': '(min-width: 980px) and (min-height: 980px)' }
          }
        }
      }
    };
  </script>
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script>
  <style type="text/tailwindcss">
    @layer base {
      html {
        font-family: theme('fontFamily.sans');
        background-color: theme('colors.panel');
        color: rgb(230 230 230);
      }
    }
    @layer components {
      .glass-panel {
        @apply bg-panel/80 backdrop-blur-xl border border-accent-pink/30 shadow-heat-ring rounded-[20px];
      }
      .neon-card {
        @apply glass-panel shadow-neon-card hover:shadow-accent-cyan/50 transition-shadow duration-300;
      }
    }
  </style>
</head>
```
- Encapsulate the snippet above in a shared fragment (e.g., `partials/tailwind-head.html`) to avoid duplication across `/`, `/gallery/`, `/artist/`, etc.
- Keep the CDN query string short; optional plugins (forms, typography) cover most needs without a build step.

### 2. Replace `style.css`
- Split the existing monolithic CSS into Tailwind utility classes applied directly in markup.
- Migrate recurring patterns into semantic component classes inside `@layer components` (e.g., `.tag-pill`, `.toolbar`, `.humiliation-banner`).
- Preserve keyframes for glitch/tilt in a trimmed `styles/motion.css` that only contains animation definitions and `@property` declarations not yet supported by Tailwind.
- Remove redundant CSS variables; re-express values via Tailwind theme tokens to avoid runtime recalculation.

### 3. Shared Layout Utilities
- Author custom utilities in `@layer utilities` for rare properties (e.g., `backface-visibility: hidden`, `perspective`, `view-transition-name`).
- Provide `safe-area` padding helpers:
```css
@layer utilities {
  .pb-safe { padding-bottom: calc(1.25rem + env(safe-area-inset-bottom)); }
  .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); }
}
```
- Use `fold-cover:` and `fold-inner:` modifiers to tailor gallery density, filter placement, and caption layout per Fold4 mode.

## Visual & Interaction System

### Landing (`/`)
- Structure: full-height flex column with a translucent hero card, "Enter" button, and whispering tagline.
- Tailwind primitives: `min-h-dvh`, `flex`, `items-center`, `justify-between`, `gap-12`, `text-accent-pink`.
- Motion: low-frequency background gradient animated using custom keyframes; "Enter" button uses Motion One on pointerenter for tilt.

### Gallery (`/gallery/`)
- Shell: `grid` layout with responsive columns `grid-cols-1 fold-inner:grid-cols-3 md:grid-cols-2`.
- Filters toolbar: `.toolbar` component using `@apply glass-panel sticky top-0 z-40 flex gap-3 px-4 py-2 fold-cover:pb-safe`.
- Tag pills: `inline-flex items-center gap-2 rounded-full border border-accent-pink/40 px-4 py-2 text-sm uppercase tracking-[0.2em] hover:bg-accent-pink/20`.
- Artist cards: `.neon-card flex flex-col gap-4 overflow-hidden` with image wrappers using `aspect-[4/5] rounded-2xl bg-panel/70` and `loading="lazy"` + `decoding="async"`.
- Virtualization: keep the existing lazy render logic but throttle reflows with `requestAnimationFrame` batching; pre-calc card heights to prevent layout shift.

### Artist Profile (`/artist/:id/`)
- Split view: `flex flex-col lg:flex-row gap-8`, with sticky metadata column on `lg:` breakpoints.
- Stats & humiliation copy live inside `.glass-panel` sections; use `accent-heat` gradient highlights for guilt prompts.
- Captions area: `fold-cover:fixed fold-cover:bottom-0 fold-cover:w-full` vs `fold-inner:absolute fold-inner:right-6 fold-inner:top-1/2` for large unfolded layout.

### About / Data Pages
- Use `prose prose-invert` from Tailwind Typography for documentation-style pages, wrapped inside `.glass-panel max-w-3xl mx-auto` containers.

## Motion & Feedback Layer
- Integrate Motion One with Tailwind's utility classes for base transforms; e.g., cards start at `transform-gpu will-change-transform` to hint at hardware acceleration.
- Define keyframes in `styles/motion.css` (e.g., `@keyframes neonFlicker`) and trigger via Tailwind's `animate-[neonFlicker_2s_ease-in-out_infinite]` syntax.
- Respect `prefers-reduced-motion` by wrapping Motion One triggers in `if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)`.
- Tailwind `group` and `group-hover` states drive humiliation tooltips and overlay transitions without extra JS listeners.

## Performance & Non-Lag Considerations
- **CSS payload**: Tailwind CDN only delivers used classes at runtime; removing `style.css` (38KB) cuts blocking CSS while still caching across pages.
- **Layout stability**: consistent `aspect-*` utilities ensure image skeletons hold space; combine with `bg-gradient-to-br from-panel/40 via-base/20` placeholders.
- **JS scheduling**: refactor filter updates to run inside `queueMicrotask` + `requestAnimationFrame` loops to avoid hitches when toggling many tags.
- **Asset strategy**: adopt `loading="lazy"`, `fetchpriority="low"` on gallery images, and preconnect to Azure TTS endpoints to reduce whisper latency.
- **Fold4 tuning**: use `fold-cover` variants to minimize simultaneous animations (only opacity/translate) while enabling full tilt/glitch on `fold-inner` and desktop.

## Migration Plan
1. **Bootstrap Tailwind** on `index.html` with CDN script + inline config; verify styling parity for hero layout.
2. **Create component library** inside `<style type="text/tailwindcss">` covering toolbars, cards, pills, overlays, and caption containers.
3. **Refactor markup** page-by-page, replacing `class="selected-tags-bar"` etc. with Tailwind utility strings or the new component classes.
4. **Isolate legacy CSS**: move remaining bespoke keyframes to `styles/motion.css`, rename old `style.css` to `styles/legacy.css`, and delete once markup conversion completes.
5. **Audit JS interactions** to align with new class hooks (e.g., query `.js-filter-pill` data attributes instead of CSS selectors that no longer exist).
6. **Performance pass**: instrument with `performance.mark` to track filter latency, add requestAnimationFrame batching, and verify `prefers-reduced-motion` fallback.
7. **Cross-device QA**: test Fold4 cover/inner breakpoints via Chrome device emulation; ensure safe-area utilities keep bottom navigation accessible.
8. **Documentation update**: refresh `README.md` with Tailwind usage notes, CDN caveats, and instructions for extending theme tokens without a build.

## Deliverables
- Updated HTML pages with Tailwind utilities and shared components.
- `scripts/tailwind-config.js` (optional) that centralizes the CDN config for reuse.
- `styles/motion.css` containing keyframes + Motion One CSS custom properties.
- Removal of `style.css` and replacement with Tailwind-first styling.
- README section documenting the no-build Tailwind workflow, how to edit inline config, and guidelines for adding new components using `@layer`.

## Risks & Mitigations
- **Runtime config size**: inline configs larger than ~10KB can slow page boot. Keep the theme extension minimal and defer non-critical utilities to bespoke CSS modules.
- **Class name verbosity**: to maintain readability, rely on semantic component classes defined via `@layer components` for complex groups (e.g., `.gallery-toolbar`).
- **CDN dependency**: add a `<noscript>` warning and document an offline workflow (downloaded Tailwind standalone file) should the CDN be blocked.
- **Browser support**: ensure fallback colors use hex or RGB for browsers lacking OKLCH; Tailwind allows specifying arrays like `['oklch(...)', '#0f0b1b']` for safety.

## Next Steps
- Approve this proposal.
- Schedule implementation sprints (estimated 2–3 passes: core shell, gallery/artist pages, humiliation + motion polish).
- Begin refactoring with automated visual regression snapshots (Playwright `page.screenshot`) to confirm parity after each page migration.
