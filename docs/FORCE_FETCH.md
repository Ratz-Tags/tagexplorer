# Force Fetch Feature - Documentation

## Overview
The "FETCH" button in the top command bar allows users to manually trigger an immediate fetch of style tags for all artists, with a humiliating progress display that matches the site's tone.

## User Experience

### Button Location
- **Position**: Top command bar, after FILTER button
- **Label**: "FETCH"
- **Style**: Consistent with other command buttons (PINNED, AUDIO, GLOW, FILTER)

### Activation Flow
1. User clicks **FETCH** button
2. Full-screen overlay appears with progress bar
3. Humiliating messages rotate every 4 seconds
4. Progress bar fills as artists are processed
5. Completion message appears with final taunt
6. Auto-closes after 3 seconds (or user can click Close)

### Visual Design
- **Overlay**: Full-screen modal with 90% black background
- **Progress Bar**: Gradient cyan-to-pink with glow effect
- **Message**: Large italic text that fades between taunts
- **Counters**: Shows "current / total" below progress bar
- **Cancel Button**: Disabled and labeled "Cancel (Coward)" to maintain tone

## Humiliating Messages

### During Fetch (30 variations)
Messages rotate every 4 seconds while fetching:
- "Impatient, are we? Typical."
- "Can't wait for the background fetch? Needy."
- "Forcing me to hurry... how demanding."
- "You know this won't make you find them faster."
- "Desperate to see who draws what you crave."
- "All this effort just to feed your obsession."
- "Watch the bar fill. That's all you're good for."
- "You really can't wait, can you? Pathetic."
- "Every second you wait is delicious."
- "Imagine explaining THIS to someone."
- "Staring at a loading bar for your fetishes. Peak behavior."
- "You'd wait all day if I told you to."
- "This is taking too long? Good."
- "Count the seconds. Feel the need."
- "You're not going anywhere until I'm done."
- [... and 15 more]

### On Completion (8 variations)
Random taunt when complete:
- "Done. Feel better now?"
- "There. Happy now? Doubt it."
- "All that waiting for this. Worth it?"
- "Your artists are ready. Like you care about art."
- "Enjoy your results. We both know what you're really looking for."
- "Fetched. Now you have no excuse."
- "Complete. The shame continues."
- "Got what you needed. Feel proud?"

## Technical Details

### Performance
- **Batch Size**: 5 artists per batch
- **Batch Delay**: 3 seconds between batches
- **Rate Limiting**: Respects Danbooru API limits (600ms min between requests)
- **Cache**: Results stored for 24 hours in sessionStorage
- **Total Time**: ~1 minute for 100 artists

### Data Fetched
For each artist:
- Fetches up to 100 posts from Danbooru
- Extracts general (non-kink) tags
- Filters for style-related tags (monochrome, sketch, chibi, thick_thighs, etc.)
- Only includes tags appearing in ≥10% of posts
- Stores in `artist.styleTags` array

### Progress Tracking
- Real-time updates every batch (5 artists)
- Progress bar animates smoothly
- Counter shows "current / total"
- Console logs each artist fetched

### Error Handling
- Graceful failure per artist (continues to next)
- Failed artists logged to console
- Alert shown if entire fetch fails
- Overlay closes on error

## Files Modified/Created

### New Files
**modules/force-fetch-ui.js** - UI module for overlay and progress display
- `showForceFetchOverlay(totalArtists)` - Creates and shows overlay
- `updateForceFetchProgress(current, total)` - Updates progress bar
- `showFetchComplete(totalFetched)` - Shows completion message
- `hideForceFetchOverlay()` - Closes and cleans up overlay

### Modified Files
**index.html**
- Added FETCH button to command bar after FILTER button

**main.js**
- Added click handler for force-fetch-btn
- Imports and calls `forceFetchStyleTags()` from gallery.js

**modules/gallery.js**
- Modified `fetchStyleTagsForAllArtists()` to accept progress callback
- Added `forceFetchStyleTags()` export for manual triggering
- Added progress tracking and callback invocation

## Usage

### From UI
Simply click the **FETCH** button in the top command bar.

### Programmatic
```javascript
import { forceFetchStyleTags } from './modules/gallery.js';

// Trigger force fetch with UI
await forceFetchStyleTags();
```

### Custom Progress Handler
```javascript
import { fetchStyleTagsForAllArtists } from './modules/gallery.js';

// Internal function with custom progress callback
await fetchStyleTagsForAllArtists((current, total) => {
  console.log(`Progress: ${current}/${total}`);
});
```

## Message Customization

To add more taunts, edit `modules/force-fetch-ui.js`:

### During-Fetch Messages
Edit the `FETCH_TAUNTS` array (line ~8):
```javascript
const FETCH_TAUNTS = [
  "Your message here",
  // ... add more
];
```

### Completion Messages
Edit the `finalTaunts` array in `showFetchComplete()` (line ~128):
```javascript
const finalTaunts = [
  "Your completion message here",
  // ... add more
];
```

## Styling

### Progress Bar
- Gradient: cyan (#66f3ff) to pink (#ff66c4)
- Height: 2rem
- Glow: 20px cyan shadow
- Smooth transition: 0.3s ease

### Message Display
- Font size: 0.9rem
- Style: italic
- Min height: 3rem (prevents layout shift)
- Fade transition: 0.3s ease
- Rotation: Every 4 seconds

### Overlay
- Z-index: 20000 (above everything)
- Background: rgba(0, 0, 0, 0.9)
- Modal max-width: 600px

## Future Enhancements

### Possible Additions
1. **Pause/Resume**: Allow pausing the fetch
2. **Skip Artists**: Option to skip artists that already have style tags
3. **Batch Size Control**: Let user adjust speed vs rate limits
4. **Custom Tag Patterns**: Allow filtering for specific style aspects
5. **Sound Effects**: Optional audio feedback on progress milestones
6. **Export Progress**: Save partially completed fetches
7. **Keyboard Shortcut**: Add hotkey for force fetch (e.g., Ctrl+Shift+F)

### UI Improvements
1. **Visual Effects**: Add glitch effects or pulse animations
2. **Intensity Levels**: Different taunt intensities based on user settings
3. **Progress Visualization**: Artist thumbnails appearing as fetched
4. **Statistics**: Show cache hit rate, failed artists, etc.

## Troubleshooting

### Button Not Working
- Check console for errors
- Ensure gallery is loaded (artists data present)
- Verify main.js loaded properly

### Slow Progress
- Normal: 3 seconds between batches of 5 artists
- If stuck: Check network tab for API rate limiting
- If error: Check console for specific failure messages

### No Style Tags After Fetch
- Check if artists have sufficient posts (need at least 10 posts)
- Verify tag patterns match (see api.js STYLE_TAG_PATTERNS)
- Clear sessionStorage and retry

### Messages Not Rotating
- Check browser console for JavaScript errors
- Verify force-fetch-ui.js loaded correctly
- Ensure interval not cleared prematurely

## API Reference

### showForceFetchOverlay(totalArtists)
Creates and displays the force fetch overlay.

**Parameters:**
- `totalArtists` (number): Total number of artists to fetch

**Returns:** HTMLElement - The overlay element

### updateForceFetchProgress(current, total)
Updates the progress bar and counters.

**Parameters:**
- `current` (number): Number of artists processed
- `total` (number): Total artists to process

### showFetchComplete(totalFetched)
Shows completion message with random taunt.

**Parameters:**
- `totalFetched` (number): Number of artists successfully fetched

### hideForceFetchOverlay()
Closes the overlay with fade-out animation.

### forceFetchStyleTags()
Main entry point for force fetch with UI.

**Returns:** Promise<void>

**Throws:** Error if no artists loaded or fetch fails

## License
Same as parent project.
