# Dossier Z-Index Fix — 2025-01-15

## Problem
The shame dossier overlay (`.shame-dossier-overlay`) was appearing **behind gallery cards** despite having `z-index: 10000`.

## Root Cause
The `.gallery-shell` class had `overflow-x: hidden`, which creates a **new stacking context** in CSS. This traps all child elements within that context, preventing them from escaping to higher z-index layers.

The dossier is appended to `document.body` via `shame-dossier.js`, but because `.gallery-shell` creates a stacking context, its z-index value is relative only to that context.

## Fix Applied
**File:** `styles/tailwind.css` line 988-992

**Before:**
```css
.gallery-shell {
  @apply mx-auto flex w-full flex-col gap-9 px-6 pb-20 pt-8 transition-all duration-500 ease-kink;
  max-width: min(1600px, 100vw);
  box-sizing: border-box;
  overflow-x: hidden;
}
```

**After:**
```css
.gallery-shell {
  @apply mx-auto flex w-full flex-col gap-9 px-6 pb-20 pt-8 transition-all duration-500 ease-kink;
  max-width: min(1600px, 100vw);
  box-sizing: border-box;
  /* overflow-x: hidden; */ /* Removed: Creates stacking context that traps dossier */
}
```

## Result
The dossier overlay now appears **above all gallery content** as intended with `z-index: 10000`.

## CSS Stacking Context Rules
Elements that create new stacking contexts:
- `position: fixed` or `position: sticky` with z-index
- `position: relative` or `position: absolute` with z-index other than `auto`
- `overflow: hidden`, `overflow: scroll`, or `overflow: auto` (anything other than `visible`)
- `transform`, `filter`, `perspective`, `clip-path`, `mask`, or `mix-blend-mode`
- `opacity` less than 1
- `isolation: isolate`

In our case, `overflow-x: hidden` was the culprit.

## Alternative Solutions (Not Used)
1. **Move dossier into body:** Already done — dossier is appended to `document.body` via JS
2. **Remove stacking context from gallery-shell:** ✅ **IMPLEMENTED** (removed `overflow-x`)
3. **Use CSS `isolation: isolate`:** Could isolate gallery without overflow, but adds complexity
4. **Portal API:** Modern but limited browser support

## Files Modified
- `styles/tailwind.css` (line 990)
- Compiled output: `style.css`

## Testing
1. Open gallery page
2. Add multiple tags to generate dossier entries
3. Click "Dossier" button
4. Verify overlay appears above all gallery cards
5. Test on mobile (Fold4 cover display)
6. Verify no horizontal scrolling issues without `overflow-x: hidden`

## Notes
- The `overflow-x: hidden` was likely added to prevent horizontal scroll, but the `max-width: min(1600px, 100vw)` already constrains width
- If horizontal overflow becomes an issue, consider alternative approaches (e.g., `overflow-x: clip` in modern browsers, or wrapping gallery content in a separate container)
