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

### 2. Gallery Ritual Events
- Introduce **tag-based rituals** on `/gallery/` that trigger when users stack specific tag combinations (e.g., `shame_mark`, `crying`, `obedience_training`).
- Rituals spawn a taunting overlay panel with neon glyphs, Motion One hover tilts, and a curated artist carousel focusing on the triggering tags.
- Overlay audio is a whispered confession via Azure TTS plus subtle bass pulses; automatically mutes in Fold4 cover mode unless the user taps "Indulge".

### 3. Captive Archive Streaks
- Track consecutive days the user opens the gallery and reward them with **streak badges** rendered as animated holographic chips in the command ribbon.
- Higher streak tiers unlock harsher taunts and rare artist spotlights pulled from `artists.json`.
- Use local timestamps only; expose a privacy toggle in Settings to disable tracking.

### 4. ASMR Moan Escalation Layer
- Add an **optional ASMR moan ambience** that rides atop existing TTS. A new "Indulgence" slider in Settings controls intensity levels (Off → Sighs → Soft Moans → Desperate).
- Implement a **volume/frequency ramp** tied to the Obedience Pressure Meter: as the meter climbs, the looped ASMR samples crossfade to denser layers and the playback rate subtly increases.
- Ensure samples are short, non-explicit breaths/moans sourced as pre-rendered audio (`audio/asmr/*.webm`). Respect `prefers-reduced-motion` and `reduced-volume` custom setting by muting automatically.
- Provide on-screen captions such as "ragged breathing intensifies" for accessibility; default the feature to Off and require explicit opt-in.

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
