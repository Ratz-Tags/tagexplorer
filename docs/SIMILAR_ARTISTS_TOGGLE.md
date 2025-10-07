# Similar Artists Feature - Style vs Content Toggle

## Overview
The similar artists feature now supports two modes for finding related artists:

### 🎨 **Style Mode** (NEW)
Finds artists with similar **visual aesthetics and art styles** based on general Danbooru tags like:
- Drawing techniques: `monochrome`, `sketch`, `lineart`, `watercolor`, `pixel_art`
- Art styles: `anime_style`, `western_style`, `chibi`, `realistic`, `cartoon`
- Visual characteristics: `soft_shading`, `cel_shading`, `flat_colors`, `painterly`
- Body proportions: `thick_thighs`, `muscular`, `petite`, `curvy`, `slender`
- Breast size: `huge_breasts`, `large_breasts`, `medium_breasts`, `small_breasts`
- Figure types: `hourglass_figure`, `wide_hips`, `narrow_waist`

### 🏷️ **Content Mode** (Original)
Finds artists with similar **kink tags and themes** based on your curated kink tag list.

## How It Works

### User Interface
1. Click the "Similar" button (🔍) on any artist card
2. A modal opens showing similar artists
3. Use the toggle at the top right to switch between:
   - **Content** - Matches based on kink tags
   - **Style** - Matches based on visual aesthetics

### Background Processing
When the gallery loads, the app automatically:
1. Fetches general tags from Danbooru for each artist
2. Filters for style-related tags
3. Stores them in `artist.styleTags` array
4. Caches results in sessionStorage for 24 hours
5. Processes in batches of 5 artists every 3 seconds to respect rate limits

### Similarity Calculation
Both modes use **Jaccard similarity coefficient**:
```
similarity = (shared_tags) / (total_unique_tags)
```

**Style Mode:**
- Compares `artist.styleTags` (general Danbooru tags)
- Tags must appear in ≥10% of artist's posts to be included
- Sorted by frequency (most common tags weighted higher)

**Content Mode:**
- Compares `artist.tags` (your curated kink tags)
- Uses existing tag data from `artists.json`

## Technical Implementation

### Modified Files

**modules/similar-artists.js**
- Added `similarityMode` state (persisted to localStorage)
- Added `getSimilarityMode()` and `setSimilarityMode()` functions
- Modified `calculateSimilarity()` to accept mode parameter
- Modified `findSimilarArtists()` to use mode-specific tags
- Added toggle UI with visual indicators in modal

**modules/api.js**
- Added `fetchArtistStyleTags()` function
- Fetches posts for artist and extracts general tags
- Filters for style-related tag patterns
- Caches with 24-hour TTL in sessionStorage
- Returns tags appearing in ≥10% of posts

**modules/gallery.js**
- Added `fetchStyleTagsForAllArtists()` background process
- Processes 5 artists every 3 seconds
- Updates `artist.styleTags` as tags are fetched
- Calls after `setAllArtists()` on initial load

### Data Structure

**Artist object after style tag fetch:**
```javascript
{
  artistName: "artist_name",
  tags: ["kink_tag_1", "kink_tag_2"],  // Original kink tags
  styleTags: ["monochrome", "sketch", "thick_thighs"],  // NEW
  postCount: 123,
  thumbnailUrl: "..."
}
```

### Caching Strategy
- **Style tags cache:** 24 hours (long-lived, style rarely changes)
- **Post count cache:** 1 hour (moderate changes)
- **API responses:** Session-only (may change frequently)

## Performance Considerations

### Rate Limiting
- Background fetch processes 5 artists per batch
- 3-second delay between batches
- Uses existing API rate limiting (600ms min delay, exponential backoff)
- Total time for 100 artists: ~1 minute

### Memory
- Style tags array typically 5-15 tags per artist
- ~1KB per artist with style tags
- Cached in sessionStorage (no memory pressure)

### User Experience
- Gallery loads immediately with content mode
- Style mode becomes available as tags are fetched
- Toggle works immediately (uses cached tags)
- No blocking or UI freezes

## Usage Examples

### Toggle Between Modes
```javascript
import { setSimilarityMode, getSimilarityMode } from './modules/similar-artists.js';

// Set mode
setSimilarityMode('style');   // or 'content'

// Get current mode
const mode = getSimilarityMode(); // returns 'style' or 'content'
```

### Find Similar Artists
```javascript
import { findSimilarArtists } from './modules/similar-artists.js';

const similar = findSimilarArtists(artist, {
  limit: 10,
  minSimilarity: 0.1,
  mode: 'style'  // optional, defaults to current mode
});
```

### Fetch Style Tags
```javascript
import { fetchArtistStyleTags } from './modules/api.js';

const styleTags = await fetchArtistStyleTags('artist_name', {
  limit: 200,    // posts to analyze
  useCache: true // use cached results
});
```

## Future Enhancements

### Possible Improvements
1. **Manual tag curation:** Allow users to edit style tags
2. **Weight tuning:** Prioritize certain style aspects
3. **Multi-mode:** Combine style + content similarity
4. **Visual feedback:** Show progress bar for style tag fetching
5. **Batch export:** Download style tags for all artists
6. **Custom patterns:** Let users define style tag patterns

### Advanced Features
- **Image analysis:** Use computer vision API for pixel-level similarity
- **Color palette matching:** Extract and compare dominant colors
- **Composition analysis:** Detect layout patterns and framing
- **Artist clustering:** Visualize artist relationships in 2D space

## Troubleshooting

### Style tags not appearing
- Check console: Look for "Starting background style tag fetch"
- Wait 1-2 minutes for initial fetch to complete
- Clear sessionStorage and reload if needed

### Few style tags returned
- Artist may have consistent style (few general tags)
- Increase `limit` parameter in `fetchArtistStyleTags()`
- Lower threshold from 10% to 5% in tag filtering

### Rate limiting errors
- Background fetch is already throttled
- If manual testing, increase `BATCH_DELAY` in gallery.js
- Check API status: https://danbooru.donmai.us/

## API Reference

### fetchArtistStyleTags(artistName, options)
Fetches general style-related tags for an artist.

**Parameters:**
- `artistName` (string): Artist name from Danbooru
- `options.limit` (number): Posts to fetch (default: 200)
- `options.useCache` (boolean): Use cached results (default: true)

**Returns:** `Promise<string[]>` - Array of style tag strings

**Cache:** 24-hour TTL in sessionStorage

**Example:**
```javascript
const tags = await fetchArtistStyleTags('artist_name', { limit: 100 });
console.log(tags); // ['monochrome', 'sketch', 'thick_thighs']
```

### Style Tag Patterns
Current patterns matched in `fetchArtistStyleTags()`:

**Drawing Techniques:**
- monochrome, greyscale, sketch, lineart, comic, manga
- watercolor_(medium), traditional_media, digital_media

**Art Styles:**
- realistic, anime_style, western_style, chibi, pixel_art
- stylized, semi-realistic, cartoon, anime_coloring

**Shading/Coloring:**
- soft_shading, cel_shading, flat_colors, painterly

**Body Types:**
- thick_thighs, muscular, petite, voluptuous, slender, curvy
- hourglass_figure, wide_hips, narrow_waist

**Breast Sizes:**
- huge_breasts, large_breasts, medium_breasts, small_breasts, flat_chest

## License
Same as parent project.
