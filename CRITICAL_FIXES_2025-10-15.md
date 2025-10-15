# Critical Fixes — October 15, 2025

## Issues Fixed

### 1. ✅ ReferenceError: coverObserver is not defined

**Error:**
```
ReferenceError: coverObserver is not defined at bindCoverModeObserver (audio.js:566:3)
```

**Fix:** Added missing variable declaration in `modules/audio.js`:
```javascript
let coverObserver = null;
```

**Location:** Line 25 (after other variable declarations)

---

### 2. ✅ Double Vertical Scrollbars

**Cause:** Removing `overflow-x: hidden` from `.gallery-shell` exposed the body scrollbar while keeping the content scrollbar.

**Fix:** Used `overflow-x: clip` instead, which prevents horizontal scrolling without creating a stacking context:

```css
.gallery-shell {
  overflow-x: clip; /* Prevents scrollbar, doesn't create stacking context */
}
```

**Why `clip` is better:**
- ✅ Prevents horizontal scrolling
- ✅ No stacking context (dossier can escape)
- ✅ No scrollbar
- ✅ Modern CSS solution

---

### 3. ✅ 404 Errors for Audio Files and Manifest

**Errors:**
```
gallery/data/asmr-layers.json - 404
audio/asmr/whimper-mid.webm - 404
audio/asmr/moan-intense.webm - 404
audio/asmr/breath-soft.webm - 404
```

**Root Cause:** Relative paths like `data/asmr-layers.json` resolve incorrectly on subpages (e.g., `/gallery/` becomes `/gallery/data/asmr-layers.json`).

**Fix:** Changed all audio-related paths to absolute paths in `modules/audio/humiliation-audio.js`:

**Before:**
```javascript
const MANIFEST_URL = 'data/asmr-layers.json';
src: 'audio/asmr/breath-soft.webm',
```

**After:**
```javascript
const MANIFEST_URL = '/data/asmr-layers.json';
src: '/audio/asmr/breath-soft.webm',
```

---

### 4. ⚠️ Missing Audio Files

**Status:** Files don't exist yet (expected)

**Location:** `audio/asmr/` directory only contains `README.md`

**Expected files:**
- `breath-soft.webm` (barely audible breaths)
- `whimper-mid.webm` (restrained whimpers)
- `moan-intense.webm` (edge-of-orgasm sounds)

**Requirements (per README):**
- Loop-friendly `.webm` files
- Mastered around -18 LUFS
- Seamless loops
- Mono Opus codec
- Under 20 seconds
- Respectful content (no explicit words)
- CC0/CC-BY licensed or self-recorded

**Action Required:**
1. Record or source licensed audio files
2. Place `.webm` files in `audio/asmr/` directory
3. Run `npm run update:audio` to regenerate manifest

**Until files are added:** The humiliation audio system will use fallback behavior (no ASMR layers).

---

## Files Modified

1. **modules/audio.js** (line 25)
   - Added `let coverObserver = null;`

2. **modules/audio/humiliation-audio.js** (lines 7, 17, 26, 35)
   - Changed paths to absolute (`/data/...` and `/audio/...`)

3. **styles/tailwind.css** (line 992)
   - Changed `overflow-x: hidden` → `overflow-x: clip`

4. **style.css** (compiled output)

---

## Testing Checklist

- [x] No console errors about `coverObserver`
- [x] No double scrollbars on gallery page
- [x] No 404 errors for `asmr-layers.json` manifest
- [ ] 404 errors for `.webm` files remain (expected until files added)
- [x] Dossier appears above gallery cards (from previous fix)
- [x] No horizontal scrolling on gallery

---

## Notes

- The 404 errors for `.webm` files are **expected** until you add the actual audio files
- The code handles missing files gracefully with fallback behavior
- `overflow-x: clip` has excellent browser support (Chrome 90+, Firefox 81+, Safari 14+)
- If you need older browser support, consider using a wrapper div with `overflow: hidden` instead
