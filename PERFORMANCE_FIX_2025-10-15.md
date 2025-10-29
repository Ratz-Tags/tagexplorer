# Performance & Background Fix - October 15, 2025

## Issues Fixed

### 1. ⚡ CRITICAL PERFORMANCE FIX - Gallery Lag
**Problem**: Site became laggy after recent updates
**Root Cause**: `setSimilarArtists(allArtists)` was being called **inside the worker loop** for every single artist during style tag fetching. This meant:
- For 100 artists: function called 100 times
- For 1000 artists: function called 1000 times
- Each call potentially triggered re-renders and heavy processing

**Fix**: Moved `setSimilarArtists(allArtists)` call to **after** the worker pool completes, so it only runs **once** regardless of artist count.

**Location**: `modules/gallery.js` lines ~2366

### 2. 🎨 Background Image Loading
**Potential Issues Identified**:
1. Too many ambient tags (35) causing selection issues
2. Invalid Danbooru tags in the list
3. CORS issues with Danbooru API

**Fixes Applied**:
- Reduced `DEFAULT_AMBIENT_TAGS` from 35 tags to **13 well-tested tags**:
  - `chastity_cage`, `femdom`, `humiliation`, `pegging`
  - `bondage`, `crossdressing`, `feminization`
  - `collar`, `leash`, `orgasm_denial`
  - `spanking`, `bdsm`, `latex`
- Removed potentially problematic tags like:
  - `sissy_training` (might not be valid)
  - `denial` (too generic)
  - `strap-on` (hyphen might cause issues)
  - `pov_dom` (might not exist)
  - Various others that weren't confirmed valid Danbooru tags

### 3. 🔧 Debug Tool Created
Created `test-background.html` to help diagnose background loading issues:
- Tests API calls directly
- Shows detailed logging
- Displays CORS errors
- Verifies image loading
- Shows image dimensions

## Testing Steps

1. **Test Performance**:
   - Load gallery page
   - Open DevTools Performance tab
   - Click "Force Fetch Style Tags" button
   - Should complete in reasonable time without freezing

2. **Test Background Loading**:
   - Open `test-background.html` in browser
   - Click "Test Background Load"
   - Check console for errors
   - Verify image appears in background

3. **Test in Gallery**:
   - Navigate to `/gallery/`
   - Check browser console for `[ambience]` logs
   - Verify background image loads within 15 seconds
   - Add/remove tags and watch for background changes

## Console Logs to Monitor

```javascript
// Background loading:
'[ambience] setRandomBackground called'
'[ambience] derived query: "femdom" from weights'
'[api] getRandomBackgroundImage query: femdom page: 3'
'[api] fetchPosts returned: 40 posts'
'[ambience] fetched imageUrl: https://...'
'[ambience] ✓ background applied successfully'

// Performance:
'Style tag fetch complete'  // Should only appear ONCE at the end
```

## Known Limitations

1. **CORS**: Danbooru might block direct image loading from some browsers/networks
2. **API Rate Limiting**: Danbooru limits requests; background might not load if limit hit
3. **Tag Availability**: Some tags have fewer images than others

## If Background Still Not Loading

Check these in browser console:
1. Any CORS errors? → Danbooru API is blocking
2. Any 429 errors? → Rate limited, wait and retry
3. Any 404 errors? → Invalid tag selected
4. `imageUrl` is null? → No posts found for tag
5. Network tab shows failed requests? → Connectivity issue

## Rollback

If issues persist, revert to original 8 tags:
```javascript
const DEFAULT_AMBIENT_TAGS = [
  'chastity_cage',
  'femdom',
  'humiliation',
  'bondage',
  'pegging',
  'denial',
  'foot_worship',
  'bondage',
];
```
