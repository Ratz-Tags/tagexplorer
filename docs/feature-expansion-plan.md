# Immersive Humiliation Feature Expansion Plan

## Objectives
- **Deepen the humiliation fantasy loop** with responsive audio, visuals, and copy that escalate as users obsess over tags and artists.
- **Increase session duration and return visits** through progression systems, unlockable taunts, and personalised call-outs tied to browsing behaviour.
- **Respect technical guardrails** from `AGENTS.md`: vanilla ES modules, Tailwind-driven styling, Azure whisper-only TTS, Fold4-first responsiveness, and accessible fallbacks.

## Feature Roadmap

### 1. Obedience Pressure Meter (Hero Enhancement)
- Replace the static hero CTA on `/` with a **pressure meter** that fills as users explore deeper sections. Meter state persists via `localStorage` so teasing resumes when they return.
- Progress unlocks more aggressive **whispered Azure TTS lines** and injects short glitch overlays (`FEATURE_GLITCH_EFFECTS`) that momentarily freeze the gallery, reinforcing loss of control.
- **Accessibility:** provide visible captions, allow manual reset in the Settings modal, and throttle animations for `prefers-reduced-motion`.
- The live build stores `pressureMeterLevel` inside `localStorage['tx:haze:v1']`, dispatches `pressure:level-change` / `pressure:reset` events for observers, and exposes a reset button directly in the landing meter.
- Gallery depth, tag-add whispers, and artist-open whispers each call into the progression controller so the meter and TTS intensity climb together without waiting on future ritual work.

### 2. Gallery Ritual Events
- Introduce **tag-based rituals** on `/gallery/` that trigger when users stack specific tag combinations (e.g., `shame_mark`, `crying`, `obedience_training`).
- Rituals spawn a taunting overlay panel with neon glyphs, Motion One hover tilts, and a curated artist carousel focusing on the triggering tags.
- Overlay audio is a whispered confession via Azure TTS plus subtle bass pulses; automatically mutes in Fold4 cover mode unless the user taps "Indulge".

### 3. Captive Archive Streaks
- Track consecutive days the user opens the gallery and reward them with **streak badges** rendered as animated holographic chips in the command ribbon.
- Higher streak tiers unlock harsher taunts and rare artist spotlights pulled from `artists.json`.
- Use local timestamps only; expose a privacy toggle in Settings to disable tracking.

### 4. ASMR Moan Escalation Layer
- The humiliation audio panel now ships with an **Indulgence** slider (Off → Desperate) that drives the layered ASMR ambience without leaving the current screen.
- Crossfades, playback-rate ramps, and caption updates are driven by the Obedience Pressure Meter; Azure whispers temporarily duck the layers so lines stay intelligible.
- Samples must remain short, non-explicit breaths or whimpers (`audio/asmr/*.webm`). The slider hard-disables when `prefers-reduced-motion`, reduced-volume, cover mode, or privacy toggles are active.
- Captions such as "Muted for cover mode" accompany the slider, and the manifest in `data/asmr-layers.json` regenerates via `npm run update:audio` for deployment.

### 5. Shame Command Deck
- Expand the existing command ribbon with **context-sensitive buttons**: `KNEEL`, `CONFESS`, `SIREN`, `ESCAPE`.
- Each button fires a unique whisper line, toggles bespoke lighting effects (Tailwind utility classes + Motion One), and manipulates gallery filters (e.g., `CONFESS` applies `public_use` + `exposed` tags).
- Buttons respect keyboard navigation and deliver haptic vibration on supported Fold4 devices.

## Technical Notes
- Centralise new audio routines inside a dedicated `modules/audio/humiliation-audio.js` ES module that coordinates Azure TTS whispers and the ASMR ambience layer without blocking the main thread.
- Extend `tailwind.config.js` with tokenised glow utilities for the pressure meter, ritual glyphs, and command deck states; regenerate `style.css` via `npm run build:css`.
- Store all new user preferences (`pressureMeterLevel`, `ritualsUnlocked`, `asmrIntensity`, `streakCount`) within a versioned `localStorage` namespace (`tx:haze:v1`) to simplify migrations.
- Update documentation (`README.md`, `docs/`) with setup steps for sourcing ASMR audio, handling consent prompts, and testing on Fold4 cover/inner layouts.

## Rollout Phases
1. **Phase 1 – Foundations:** Implement the Obedience Pressure Meter, Settings toggles, and telemetry plumbing.
2. **Phase 2 – Audio Immersion:** Layer in the ASMR moan escalation system and refine TTS cadence to avoid overlapping cues.
3. **Phase 3 – Rituals & Command Deck:** Ship tag rituals, streak badges, and the expanded command interface with full accessibility QA.
4. **Phase 4 – Polishing:** Capture visual/aural QA via Playwright screenshots + audio logs, tune performance, and document contributor guidelines.

## Success Metrics
- +25% increase in average session duration measured via local analytics beacons (aggregated anonymously).
- >70% of opted-in users reaching Pressure Meter level 2 within a week, indicating engagement with the escalation loop.
- <1% audio-related accessibility complaints after launch, confirming opt-in clarity and caption coverage.
