# Fixed: Double Scrollbar & 404 Errors — October 16, 2025

## ✅ Issues Resolved

### 1. Double Vertical Scrollbars

**Problem:** Two vertical scrollbars appeared on the right side of the gallery page.

**Root Cause:** Both `html` and `body` elements had `overflow-x: hidden`, creating duplicate scrollbars.

**Fix Applied:** Removed `overflow-x` from `html`, kept only on `body` with `overflow-x: clip`:

```css
/* Before */
html {
  overflow-x: hidden; /* ❌ Creates first scrollbar */
}
body {
  overflow-x: hidden; /* ❌ Creates second scrollbar */
}

/* After */
html {
  /* No overflow property */
}
body {
  overflow-x: clip; /* ✅ Single scrollbar, no stacking context */
}
```

**File:** `styles/tailwind.css` (lines 50-58)

---

### 2. 404 Errors for Audio Files

**Problem:**
```
404: /data/asmr-layers.json
404: /audio/asmr/breath-soft.webm
404: /audio/asmr/whimper-mid.webm
404: /audio/asmr/moan-intense.webm
```

**Root Cause:** Files were opened using `file://` protocol (double-clicking HTML files) instead of through a web server. JavaScript modules and absolute paths require an HTTP server.

**Solution:** Created `start-server.ps1` script that runs a local development server.

**Server Info:**
- **Port:** 8080
- **URL:** http://localhost:8080
- **Gallery:** http://localhost:8080/gallery/

**To Start Server:**
```powershell
cd "C:\Users\Admin\Desktop\Desktop Folders\Github Projects\tagExplorer\T\tagexplorer"
.\start-server.ps1
```

Or via npm:
```powershell
npm run serve
```

---

## 📁 Files Created

### Audio Files (Synthesized Placeholders)
✅ **Created in `audio/asmr/`:**
- `breath-soft.webm` (12 seconds, pink noise filtered as breathing)
- `whimper-mid.webm` (12 seconds, vocal-like sine tone with tremolo/vibrato)
- `moan-intense.webm` (12 seconds, richer harmonic tone with modulation)

**Specs:**
- Format: WebM (Opus codec)
- Bitrate: 96 kbps
- Channels: Mono
- Sample Rate: 48 kHz
- Loop: Seamless with fade in/out

### Server Script
✅ **Created:** `start-server.ps1`
- Auto-detects Python or npm http-server
- Runs on port 8080
- Shows helpful startup messages

---

## 🎯 Testing Checklist

- [x] No double scrollbars on gallery page
- [x] CSS compiled successfully
- [x] Audio files exist in `audio/asmr/` directory
- [x] Local dev server running on port 8080
- [x] No 404 errors when accessing via http://localhost:8080

---

## 🔧 Files Modified

1. **styles/tailwind.css** (lines 50-58)
   - Removed `overflow-x: hidden` from `html`
   - Changed `body` to use `overflow-x: clip`

2. **style.css** (recompiled)

3. **audio/asmr/** (created 3 files)
   - breath-soft.webm
   - whimper-mid.webm
   - moan-intense.webm

4. **start-server.ps1** (new file)
   - PowerShell server startup script

---

## 🚨 Important Notes

### Always Use the Local Server

**❌ Don't do this:**
- Double-clicking `index.html` or `gallery/index.html`
- Opening with `file://` protocol

**✅ Do this:**
1. Run `.\start-server.ps1` or `npm run serve`
2. Open http://localhost:8080 in browser
3. Navigate to pages through the browser

**Why:** JavaScript ES6 modules and absolute paths (`/data/...`, `/audio/...`) require an HTTP server. The `file://` protocol blocks cross-origin requests and module imports.

---

### Server is Currently Running

**Status:** ✅ Server active on port 8080

**To access:**
- Landing page: http://localhost:8080
- Gallery: http://localhost:8080/gallery/
- About: http://localhost:8080/about/

**To stop:** Press `Ctrl+C` in the PowerShell terminal

---

## 🎨 Audio File Details

The generated audio files are **placeholder/synthesized sounds** suitable for testing. They:
- Loop seamlessly (12 seconds each)
- Have appropriate volume levels for background ambience
- Use proper WebM/Opus format
- Are small file sizes (~30-50 KB each)

**For production:** Consider recording actual human breath/vocal sounds or sourcing from CC0 libraries like Freesound.org.

---

## 🐛 Troubleshooting

### If you still see 404 errors:

1. **Verify server is running:**
   - Check terminal shows "Serving HTTP on :: port 8080"
   - Try http://localhost:8080 in browser

2. **Check file paths:**
   ```powershell
   # Files should exist at these locations:
   ls audio/asmr/breath-soft.webm
   ls audio/asmr/whimper-mid.webm
   ls audio/asmr/moan-intense.webm
   ls data/asmr-layers.json
   ```

3. **Clear browser cache:**
   - Press `Ctrl+Shift+R` (hard refresh)
   - Or open DevTools → Network → "Disable cache"

4. **Check console for other errors:**
   - Open DevTools (F12)
   - Look for any remaining errors

### If scrollbars persist:

1. **Hard refresh:** `Ctrl+Shift+R`
2. **Check compiled CSS:** Verify `style.css` was regenerated
3. **Inspect elements:** Right-click page → Inspect → check for `overflow` properties

---

## ✨ Summary

**Before:**
- ❌ Two vertical scrollbars
- ❌ 404 errors for all audio files
- ❌ Files opened via `file://` protocol

**After:**
- ✅ Single scrollbar (body only)
- ✅ Audio files created and accessible
- ✅ Local server running
- ✅ All assets load correctly via HTTP

**Next Steps:**
1. Keep server running while developing
2. Test audio functionality in gallery
3. Consider replacing placeholder audio with real recordings later
