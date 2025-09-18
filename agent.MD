# Agent.MD — TagExplorer (Danbooru Artist Tag Gallery) — Consolidated Spec

This consolidated document merges all prior specs:
1. **Base redesign** (gallery, humiliation factor).  
2. **Moodboard & Azure Whisper TTS**.  
3. **Galaxy Z Fold4–first extension**.  

---

## Mission
Redesign **TagExplorer** into a sleek, modern, animated gallery that surfaces artists (curated via Danbooru tag filters). The site must:  
- Present artists in a gallery filtered by tags.  
- Emphasize a **humiliation/discomfort theme** through copy, visuals, motion, and audio.  
- Use **Azure TTS (whisper-only voices)** to deliver whispered, teasing/guilting lines.  
- Be fully **mobile-first with special optimization for Galaxy Z Fold4** (cover + inner display).  
- Remain polished, navigable, and performant despite hostile/teasing UX layer.  

---

## Tech Guardrails
- **Styling:** Tailwind CSS (extended tokens).  
- **Runtime:** Vanilla JS (ES modules). No React/Vue.  
- **Animations:** Motion One + CSS modern features (`@property`, `:has()`, `@layer`, View Transitions API).  
- **Data Source:** Pre-generated JSON: `{artist_id, name, preview, tags[], links}`.  
- **Persistence:** localStorage for filters, preferences, TTS, humiliation mode.  
- **Hosting:** GitHub Pages (static).  
- **Audio/TTS:** Azure Cognitive Services Speech, **whisper-only voices** enforced.  
- **Accessibility:** Captions for all TTS lines; prefers-reduced-motion respected; safe-area insets respected on Fold4.  

---

## Information Architecture
- `/` — Landing (ominous intro, disclaimer, Enter).  
- `/gallery/` — Main gallery grid + filters.  
- `/artist/:id/` — Artist profile (preview, tags, links).  
- `/about/` — Project info, disclaimers, credits.  
- `/data/` — JSON: `artists.json`, `tags.json`, `tts_lines.json`.  

---

## Visual Moodboard

### Palette (OKLCH)
- **Base**: oklch(10% 0.02 260)  
- **Panel**: oklch(19% 0.02 260)  
- **Accent Cyan**: oklch(80% 0.14 205)  
- **Accent Pink**: oklch(80% 0.18 350)  
- **Heat Red**: oklch(66% 0.25 25)  

### Typography
- **Display**: Rajdhani / Orbitron (condensed gamer)  
- **Body/UI**: Inter / Satoshi  

### Components
- Cards: glass, neon edge glow, radial hover highlight.  
- Filters: pills with heat glow intensifying as tags accumulate.  
- Modals: blurred glass with red warning lines.  

### Motion
- Hover tilt (2–4deg), glow intensify.  
- Filter changes: staggered flicker reveal.  
- Page changes: glitch + View Transitions.  
- Easing: sticky, uncanny cubic-bezier(.4,-0.2,.2,1.2).  

### Audio/TTS
- Azure **whispering style voices only**.  
- Captions mirrored on screen.  
- Random rotation of whisper voices to avoid repetition.  

---

## Fold4-First Design

### Breakpoints (Tailwind)
```js
screens: {
  'fold-cover': {'raw': '(max-width: 520px) and (orientation: portrait)'},
  'fold-inner': {'raw': '(min-width: 980px) and (min-height: 980px)'}
}
```

### Cover Display
- 1-column gallery list.  
- Bottom nav bar: Home, Filters, Settings, Mute, Motion.  
- Filters: bottom sheet modal.  
- Motion minimized: opacity/translate only.  

### Inner Display
- 2–3 column gallery grid.  
- Persistent filter sidebar.  
- Artist page: two-pane layout.  
- Motion allowed: tilt, glow, glitch.  

### Fold Continuity
- Preserve gallery scroll + filters when folding/unfolding.  
- Re-layout without reload.  

### Safe Zones
- Controls within bottom 40% of cover for thumb reach.  
- `env(safe-area-inset-bottom)` respected.  

---

## Azure Whisper TTS Spec

### Runtime Voice Filtering
- Query Azure voices at init.  
- Filter to only whisper-capable voices.  
- Rotate randomly or round-robin.  
- If none found: disable TTS gracefully.  

### SSML Template
```xml
<speak version="1.0" xml:lang="en-US">
  <voice name="{{VOICE}}">
    <mstts:express-as style="whispering">
      <prosody rate="-10%" volume="-25%">Caught you narrowing it down again, hm?</prosody>
    </mstts:express-as>
  </voice>
</speak>
```

### Event-to-Line Map
- Tag add → “You really need *that* tag?”  
- Stack >5 → “Obvious. Desperate.”  
- Clear all → “Clean slate? Guilty conscience.”  
- Artist open → “This is what you came for.”  
- Idle → “Still here.”  
- Back to gallery → “You’ll be back.”  

### Intensity Levels
- 0 = Off  
- 1 = Minimal (rare, soft lines)  
- 2 = Normal (frequent, teasing)  
- 3 = Max (overlay interruptions, harsher tone)  

### UX Rules on Fold4
- Mute in bottom bar (cover) and top toolbar (inner).  
- Auto-suppress during rapid scroll.  
- Captions bottom-centered (cover), right column (inner).  

---

## Data Models

### Artist
```json
{
  "artist_id": "12345",
  "name": "Sample Artist",
  "preview": "images/sample.jpg",
  "tags": ["mouse_ears", "pastel_blue"],
  "links": {
    "danbooru": "https://danbooru.donmai.us/artists/12345",
    "pixiv": "https://pixiv.net/users/67890"
  }
}
```

### TTS Lines
```json
{
  "tag_add": ["You really need that tag?", "Getting specific, aren't you?"],
  "too_many_tags": ["Obvious. Desperate.", "Stacking them up, hm?"],
  "artist_open": ["This is what you came for.", "Finally found them?"],
  "idle": ["Still here.", "Lingering..."],
  "clear": ["Clean slate? Guilty conscience."],
  "back": ["You'll be back."]
}
```

---

## UX Quirks (Humiliation Layer)
- Teasing tooltips.  
- Red glow heatmap with more tags.  
- Occasional “Caught.” overlay (max 1/session).  
- Whisper lines + captions triggered by events.  
- M key = instant mute.  

---

## Performance Targets (Fold4)
- Input latency < 50ms.  
- 60fps gallery scroll with lazy load + virtualization.  
- Initial JS bundle < 90KB gzip; CSS < 60KB gzip.  
- Image previews ≤ 1024px, lazy-loaded with srcset.  

---

## Acceptance Criteria
- Works on Fold4 cover + inner displays with continuity.  
- Gallery filters + humiliation layer fully functional.  
- TTS uses whisper-only Azure voices with captions.  
- A11y: keyboard, TalkBack, captions, reduced motion.  
- Visual style = neon/glass, motion-heavy, but performant.  

---

## Directory Layout
```
/public
  /assets
  index.html
  gallery/index.html
  artist/[id]/index.html
  about/index.html
/data
  artists.json
  tags.json
  tts_lines.json
/src
  /styles
  /js (filters.js, gallery.js, motion.js, tts.js, settings.js)
```

---

## Feature Flags
- `FEATURE_VIEW_TRANSITIONS`  
- `FEATURE_GLITCH_EFFECTS`  
- `FEATURE_TTS_WHISPER`  
- `FEATURE_HUMILIATION_MODE`  
- `FEATURE_SERVERLESS` (future expansion)  

---

## Deliverables
- Static build for GitHub Pages.  
- Tailwind config with foldable screens.  
- Example datasets (`artists.json`, `tts_lines.json`).  
- `tts.js` with Azure whisper integration.  
- README with setup + Azure keys config.  
