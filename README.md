# Tag Explorer

A modern, visually unified web app for exploring, filtering, and discovering artists and tags with a focus on a playful, interactive UI/UX.

## Features

- **Artist Explorer**: Browse a gallery of artists with infinite scroll and quick tag-based filtering.
- **Tag Explorer**: Browse, select, and combine tags to filter artists. Sticky, unified bars for navigation.
- **Sidebar**: Minimal, icon-driven, collapsible sidebar for copied artists and actions.
- **Modern UI**: Unified backgrounds, border radii, and compact layouts for all navigation bars and sidebar.
- **Responsive Design**: Works on desktop and mobile, with adaptive layouts and touch-friendly controls.
- **Fun Interactions**: Includes taunt banners, shame badges, and playful iconography.

## Shame Dossier

- Open the dossier from the **DOSSIER** controls in the command bar (inner layout) or the cover toolbar to review a glassmorphic timeline of every tag edit, gallery crawl milestone, favorite toggle, and taunt.
- Use the **Wipe log** action inside the overlay (or clear `localStorage['te.dossier.entries']` in the console) to purge local history instantly.
- Dossier whispers respect the TTS intensity slider: higher intensities surface harsher `dossier_open` / `dossier_revisit` lines, while disabled TTS falls back to a soft on-screen caption inside the panel.

## Command Deck

- **KNEEL / CONFESS / SIREN / ESCAPE** sit in the inner command bar and the Fold cover navigation. Each preset rewrites the active tag filters, applies coordinated lighting/glow classes, and adjusts the humiliation audio slider:
  - **Kneel** stacks `leash`, `viewer_on_leash`, and `restraints`, bumps ASMR intensity to 2, and nudges the pressure meter upward.
  - **Confess** pushes `humiliation`, `body_writing`, and `public_nudity`, keeps the indulgence low (lane 1), and sustains a softer glow.
  - **Siren** floods `hypnosis`, `mind_break`, and `orgasm_denial`, maxes indulgence (lane 3), and fires a brighter alarm pulse plus a bass hit.
  - **Escape** restores the last manual tag snapshot, drops indulgence to 0, and bleeds off pressure.
- Button presses trigger patterned vibrations via `modules/ui.js` and dispatch bespoke whisper lines through the TTS dispatcher; the current preset, baseline tag snapshot, and indulgence lane persist in `localStorage['tx:haze:v1']` under the `commandDeck` key.
- Keyboard shortcuts mirror the UI: **Shift+K** (Kneel), **Shift+C** (Confess), **Shift+S** (Siren), and **Shift+E** (Escape). Cover and inner layouts share the same state, so switching fold modes keeps the active preset.
- **QA scenarios**:
  - Confirm presets on both Fold cover and inner layouts (the cover deck collapses to a 2×2 grid and the inner buttons hide when `data-fold-mode="fold-cover"`).
  - Enable `prefers-reduced-motion` (or the in-app motion toggle) to ensure the deck falls back to the CSS pulse instead of Motion One timelines.
  - Reload after engaging a preset to verify the command deck, indulgence slider, and glow state hydrate from `tx:haze:v1`.

## Shame Pressure Meter

- The landing hero now replaces its CTA stack with a persistent **Shame Pressure** meter. It fills from the `tx:haze:v1` namespace in `localStorage`, mirroring the current `pressureMeterLevel` whenever you return to the site.
- Adding tags, triggering stack-overflow taunts, or opening artists in the gallery nudges the level upward; endless-scroll depth adds even more heat. The meter modulates TTS intensity so higher tiers unlock harsher whisper lanes automatically.
- A "Reset pressure" control sits in the landing meter for quick purges. Clearing the namespace manually (`localStorage.removeItem('tx:haze:v1')`) also wipes the counter if you prefer using dev tools.
- Motion is throttled automatically when `prefers-reduced-motion` is active or when the in-app motion toggle is set to Reduced, keeping the glow collapse gentle on the Fold cover screen.

## Humiliation Audio Stack

- The audio panel now includes an **Indulgence** slider (Off → Desperate) that crossfades whisper-moans sourced from `audio/asmr/*.webm` on top of the ambience playlist.
- Slider output mirrors the shame pressure meter—higher levels increase playback rate and volume until Azure TTS fires, at which point the layers duck automatically so captions remain legible.
- Cover mode, ghost/privacy toggles, and reduced-motion/volume preferences all hard-mute the slider and surface a caption explaining why it is disabled.
- Captions are rendered inline next to the slider for screen readers, and the current intensity is also exposed via `document.body.dataset.indulgence` so HUD elements can react.
- Drop seamless mono Opus loops into `audio/asmr/` (see [`audio/asmr/README.md`](audio/asmr/README.md) for curation and consent guidance) and run `npm run update:audio` to refresh `data/asmr-layers.json` for deployment.
- Consent matters: only ingest ASMR layers you personally recorded or are licensed to share. The README banner in `audio/asmr/` highlights the expectation for explicit opt-in.

## Captive Archive Streaks

- Every day you open the gallery is logged in the shared `tx:haze:v1` namespace under `streakState`. The tracker keeps the current count, the longest chain, and a capped history of day-start timestamps—never more than 32 entries.
- The command bar now surfaces an animated holographic streak badge. Click or tap it (or the matching Cover screen button) to opt into or out of tracking. When disabled the UI drops into **Ghost mode** and no new visits are persisted.
- Streak tiers (Dormant → Ember Drift → Glass Glow → Infra Inferno → Void Crown) unlock harsher taunts and rare artist spotlights. They also raise the floor for Azure whisper intensity, so the audio digs deeper the longer you return.
- QA shortcuts live in the console: `window.txStreaks.recordVisit(daysAgo)` simulates a visit offset, `window.txStreaks.setEnabled(false)` flips ghost mode, and `window.txStreaks.getState()` surfaces the raw persisted payload for time-travel debugging.
- Streak data is strictly local. Delete it by clearing the namespace (`localStorage.removeItem('tx:haze:v1')`) or by toggling Ghost mode before you browse.

## Project Structure

- `index.html` – Main entry point with inline Tailwind Play config and component layers (no build step required)
- `main.js` – App bootstrap and logic
- `modules/` – Modular JavaScript (gallery, tag explorer, sidebar, etc.)
- `audio/`, `icons/` – Media assets
- `test/` – Test files

## Getting Started

1. Clone the repository
2. Open `index.html` in your browser
3. Explore artists, tags, and sidebar features

## Landing Ritual & Mission Storage

- The landing page now opens with a whisper ritual that locks the **Enter Gallery** call-to-action until you pick a mission profile, consent to local logging, and confirm the choice.
- Once confirmed, TagExplorer stores the mission metadata in `localStorage` under the key `te.mission.profile` with the mission id, display label, description copy, and a UNIX timestamp.
- A `landing:mission-set` `CustomEvent` is dispatched on `document` after the ritual resolves so other modules can react (e.g., updating UI states or scheduling whispers). Azure TTS also emits a `mission_confirm` whisper when available.
- The data never leaves your machine. To reset the ritual, clear that key via the browser console (`localStorage.removeItem('te.mission.profile')`) or delete the entry from Application Storage tools, then refresh the page.

## Customization

- Add new tags or artists by editing the JSON files
- Tweak colors, shadows, or component layers inside `index.html`'s `<style type="text/tailwindcss">` block or the adjacent `tailwind.config` script
- Extend sidebar or gallery features in the `modules/` directory

## License

MIT License
