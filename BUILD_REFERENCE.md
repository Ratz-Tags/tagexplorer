# Build Reference & Feature Status

## 🏗️ Building Styles

### Command
```bash
npm run build:css
```

### What it does
- Compiles `styles/tailwind.css` → `style.css`
- Uses Tailwind CSS with minification
- Must be run after editing `styles/tailwind.css`

### Other Build Commands
```bash
npm run update:tags     # Update kink tags from source
npm run update:audio    # Generate audio file list
npm run serve          # Start local dev server on port 8080
```

---

## 🌌 Ambience System Status

### ✅ **Working as Designed**

The ambience system is **fully functional** and follows this architecture:

### How It Works

1. **Initialization** (`modules/pages/gallery.js:662`)
   ```javascript
   setupBackgroundRotation(setRandomBackground, {
     getActiveTags,
     getFilteredArtists,
     getPaginationInfo,
   });
   ```

2. **Controller** (`modules/ambience-controller.js`)
   - Exports `initAmbienceController()`
   - Tracks tag weights with decay (0.65 per refresh)
   - Responds to events:
     - `tags:updated` - When user selects/removes tags
     - `tts:intensity` - When intensity changes
     - `motion:change` - When motion mode changes
   - Default refresh interval: **15 seconds**

3. **Background Setting** (`modules/gallery.js:688`)
   - `setRandomBackground()` function:
     - Derives ambient weights from active tags
     - Builds query from top-weighted tags
     - Fetches Danbooru image via `getRandomBackgroundImage()`
     - Creates animated layer with Motion One
     - Crossfades between backgrounds

4. **Visual Layer** (`gallery/index.html:15`)
   ```html
   <div id="background-blur" class="background-lattice" aria-hidden="true"></div>
   ```
   - Container receives `.ambient-layer` child divs
   - Each layer has absolute positioning with blur/scale effects
   - Crossfades with opacity animations

### Key Features

- **Tag-Based**: Uses your active filter tags + gallery content
- **Weight System**: Recent tags weighted higher, decays over time
- **Motion Aware**: Respects reduced motion preference
- **Incognito Mode**: Disables backgrounds when incognito theme active
- **Preloading**: Images preloaded before transition
- **Fallback**: Uses timer-based rotation if controller fails

### Default Ambient Tags
```javascript
'chastity_cage', 'femdom', 'humiliation', 'sissy_training',
'pegging', 'denial', 'foot_worship', 'bondage'
```

### Styling (styles/tailwind.css:1306-1320)
```css
.ambient-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(14px) saturate(1.2);
  transform: scale(1.08);
  mix-blend-mode: screen;
  pointer-events: none;
  will-change: opacity, transform, filter;
  transition: opacity 0.6s ease;
}
```

---

## 🧪 Testing Ambience

### Visual Verification
1. Open gallery page
2. Open browser DevTools Console
3. Look for: `[ambience]` log messages
4. Watch for background transitions every ~15 seconds

### Manual Trigger
```javascript
// In browser console:
document.dispatchEvent(new CustomEvent('tags:updated', {
  detail: { activeTags: ['femdom', 'chastity_cage'] }
}));
```

### Check Active Layer
```javascript
// In browser console:
document.querySelectorAll('.ambient-layer')
// Should show dynamically created layers
```

---

## 🐛 Troubleshooting

### "Ambience not changing"
- Check console for `[ambience]` errors
- Verify API calls to Danbooru succeed
- Ensure not in incognito theme
- Check if `motion:change` event set to 'reduced'

### "Styles not updating"
- Run `npm run build:css`
- Hard refresh browser (Ctrl+Shift+R)
- Check that `style.css` timestamp updated

### "Module not found" errors
- Verify file exists in `modules/` directory
- Check import path matches actual filename
- Ensure ES module syntax (`import`/`export`)

---

## 📋 Recent Fixes (Oct 8, 2025)

### Audio Path Resolution
- Added `getPathPrefix()` to detect subdirectory pages
- Fixed 404s for `data/audio-files.json` and `data/audio-playlists.json`
- Audio files now load correctly from gallery subdirectory

### Gallery Grid Centering
- Changed from `auto-fit` to fixed column counts
- Responsive breakpoints: 2/3/4/5/6 columns
- Centered layout with `margin: 0 auto`
- Galaxy Z Fold4 support maintained (4 columns)

---

## 📝 Notes

- **Don't use `node build`** - that's not a valid command
- Always rebuild CSS after editing `styles/tailwind.css`
- Ambience system is working - check DevTools if unsure
- Motion One library used for smooth animations
- Tag weights decay over time to prevent staleness
