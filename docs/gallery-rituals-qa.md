# Gallery Ritual QA Guidance

This checklist covers the Fold-aware ritual overlays introduced for the gallery page. Each ritual unlocks when a specific tag combination is active; completion state persists in `localStorage['tx:haze:v1']` under the `ritualState` key.

## Ritual Combos

| Ritual | Required Tags | Notes |
| ------ | ------------- | ----- |
| **Chastity Spiral** | `chastity_cage`, `hypnosis`, `mind_break` | Unlocks once per profile until reset. Expect the strongest bass pulse. |
| **Pink Conversion** | `feminization`, `bimbofication`, `pegging` | Repeatable after cooldown; verifies whisper cadence at higher intensities. |
| **Leash Subroutine** | `pet_play`, `leash`, `gagged` | Check cover-display muting and reduced motion fallbacks. |

## Verification Steps

1. **Hydrate Tag State**
   - Add each combo sequentially using the tag picker.
   - Confirm the overlay fires only after the last required tag is applied.
   - Ensure the queue handles multiple combos without skipping when overlays are open.

2. **Overlay Behaviour**
   - Dismiss and reopen overlays to verify `Not yet`, `Submit`, and `Reset` controls.
   - Tab through controls to confirm the focus trap loops and the host outline appears.
   - Toggle `prefers-reduced-motion` (or `Motion Off` in-app) and confirm glyph animations fall back to static fades.

3. **Audio & TTS Routing**
   - Listen for a whispered line on unlock, completion, and dismissal (`ritual_unlock`, `ritual_complete`, `ritual_dismiss`).
   - Verify bass pulses respect global mute and cover-mode auto muting (no pulse while in Fold cover mode unless forced via console).

4. **Persistence**
   - Refresh the page and ensure previously completed rituals remain suppressed.
   - Execute `window.txRituals.reset('pink_conversion')` in the console to clear a ritual and trigger it again.
   - Confirm `window.txRituals.state()` matches expectations (unlocked/completed/dismissed timestamps).

5. **QA Shortcuts**
   - `window.txRituals.list()` returns the metadata object for each ritual.
   - `window.txRituals.dismiss('<id>')` manually flags a ritual as dismissed.
   - `window.txRituals.complete('<id>')` simulates completion without the overlay (useful for regression scripts).

Document any deviations (missing audio, incorrect cooldowns, or failure to respect reduced-motion) before sign-off.
