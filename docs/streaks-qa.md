# Captive Archive Streak QA Guide

This checklist covers the streak tracker introduced on the gallery page. It verifies persistence, privacy toggles, and tie-ins to taunts/TTS.

## Storage + Namespace

- Streak metadata lives in the shared namespace `localStorage['tx:haze:v1']` under the keys `streakState` and `streakOptOut`.
- `streakState` holds:
  - `count`: current consecutive-day streak (integer)
  - `longest`: best streak observed
  - `lastVisit`: local midnight timestamp (ms) of the most recent day counted
  - `history`: up to 32 day-start timestamps (ms) for QA/time-travel validation
- Ghost mode (opt-out) toggles `streakOptOut` to `true` without mutating the stored counts. When ghosted the module skips persistence and emits `reason: 'opted-out'` events.

## QA Shortcuts

Open the gallery console and use the global helpers:

```js
// simulate visits
window.txStreaks.recordVisit(0);      // today
window.txStreaks.recordVisit(1);      // yesterday
window.txStreaks.recordVisit(7);      // one week ago

// inspect state
window.txStreaks.getState();          // returns { count, longest, history, lastVisit }
window.txStreaks.tiers;               // array of tier metadata (id, min, label)

// toggle privacy
window.txStreaks.setEnabled(false);   // ghost mode
window.txStreaks.setEnabled(true);    // resume tracking
```

For time-travel QA, chain multiple `recordVisit` calls with descending offsets (e.g. `3,2,1,0`) to emulate consecutive days without changing your system clock. The tracker normalises to local midnight, so offsets measured in whole days are sufficient.

## Event Contracts

- Every mutation emits a `window` `CustomEvent('streaks:change', { detail })` where `detail` includes:
  - `state`, `previousState`
  - `trackingEnabled`, `tier`, `previousTier`
  - `didIncrement`, `wasReset`, `deltaDays`, `reason`
- Gallery bootstrap surfaces toast + whisper feedback when `detail.didIncrement === true`.
- Toggling ghost mode emits `reason: 'toggle'` events so downstream listeners can update UI immediately.

## UI Expectations

- Command bar badge should read `DAY CAPTURED` on day 1, `DAY STREAK` afterwards. Ghost mode swaps the label to `GHOST MODE` and the count to `—`.
- Cover toolbar button mirrors the same state and toggles tracking with a single tap.
- `prefers-reduced-motion` (or the in-app Motion toggle) removes the holographic spin/pulse animation without collapsing layout.

## Humiliation / TTS Hooks

- High streak tiers feed harsher taunts (`humiliation:taunt`) and trigger rare spotlights sourced from `artists.json`. Spotlights throttle to once every three minutes.
- `modules/tts-dispatcher` raises the minimum whisper lane according to streak tier, so Azure voices escalate in tandem with your chain.
- `dispatchWhisperEvent('streak_increment', { text })` fires on each increment; check caption overlays when audio is muted.

## Reset + Cleanup

- Clear the streak quickly with `localStorage.removeItem('tx:haze:v1')` or by wiping just the `streakState` key via devtools storage editor.
- Ghost mode prevents any writes while active. Reactivate tracking to resume counting without losing the previous streak record.
