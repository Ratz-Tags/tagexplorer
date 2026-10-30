# Agent.MD — TagExplorer (Danbooru Artist Tag Gallery) — Consolidated Spec

This consolidated document merges all prior specs:
1. **Base redesign** (gallery, humiliation factor).  
2. **Moodboard & Whisper TTS**.  
3. **Galaxy Z Fold4–first extension**.  

---

## Mission
Redesign **TagExplorer** into a sleek, modern, animated gallery that surfaces artists (curated via Danbooru tag filters). The site must:  
- Present artists in a gallery filtered by tags.  
- Emphasize a **humiliation/discomfort theme** through copy, visuals, motion, and audio.  
- Use **free whisper TTS** (expressive cloud voice prompted to whisper, device-voice fallback) to deliver whispered, teasing/guilting lines.  
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
- **Audio/TTS:** Puter.js cloud voice (OpenAI `gpt-4o-mini-tts`, prompted to whisper) with the browser's `speechSynthesis` as fallback. **No API keys** in the repo or the deploy.  
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
- Every cloud line is **prompted to whisper**; the mood follows the event and intensity.  
- Captions mirrored on screen.  
- Random rotation of whisper voices to avoid repetition.  

---

## Fold4-First Design

### Breakpoints (Tailwind)
```js
screens: {
  'fold-cover': {'raw': '(max-width: 640px)'},
  'fold-inner': {'raw': '(min-width: 1024px)'}
}
```
Breakpoints are width-only so ordinary laptops/desktops get the inner (docked) layout; a height gate pushed them into the phone UI. Widths in between use the default layout (filters as a drawer).

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

## Whisper TTS Spec

### Engines (`modules/whisper-voice.js`)
- **Cloud (opt-in, free):** Puter.js, loaded lazily from `https://js.puter.com/v2/`, calls `puter.ai.txt2speech(text, { provider: 'openai', model: 'gpt-4o-mini-tts', voice, instructions })`. Puter is "user-pays": each listener signs in once with their own free Puter account, so the site needs no key.  
- **Device (default):** the browser's `speechSynthesis`, slower and quieter per intensity (it cannot whisper).  
- Sign-in only ever starts from the Voice dialog, never from a taunt; a signed-out listener hears the device voice.  
- After a cloud failure (usage limit, network) the session falls back to the device voice.  
- Rotate cloud voices (shimmer, nova, sage, coral) without immediate repeats, or pin one. Recently spoken lines replay from memory.  

### Delivery Prompt (replaces the SSML template)
```
Whisper softly and close, breathy and intimate, as if leaning in to the listener's ear.
Never raise your voice. Slow pacing with small pauses.
Mood: {{EVENT_MOOD}} {{INTENSITY_TONE}}
```
- Event moods: tag add = teasing/amused, stack = mocking, clear = softly accusing, artist open = pleased/possessive, idle = bored tease, back = smug.  
- Intensity tones: 1 = gentle and hushed, 2 = confident and teasing, 3 = colder and contemptuous.  

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
- TTS whispers (cloud voice prompted to whisper, device fallback) with captions.  
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
- `modules/whisper-voice.js` (Puter cloud whisper + device fallback).  
- README with setup (no API keys needed).  
