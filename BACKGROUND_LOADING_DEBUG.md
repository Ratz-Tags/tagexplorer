# Background Images Not Loading — Diagnostic Guide

## Symptoms
- Background images fail to load on the gallery page
- `#background-blur` element exists in DOM but shows no background
- Console shows ambience controller logs but no visible result

## Investigation Steps

### 1. Check Browser Console
Open Developer Tools (F12) and look for:

```
[ambience-controller] performRefresh triggered by: ...
[ambience-controller] calling setBackground with payload: ...
[ambience] setRandomBackground called
[ambience] derived query: ...
[api] getRandomBackgroundImage query: ... page: ...
[api] fetchPosts returned: ... posts
[api] filtered to ... valid posts
[api] selected background image: ...
[ambience] preloaded image: ...
[ambience] ✓ background applied successfully
```

**If you see warnings/errors:**
- `NetworkError` or `Failed to fetch` → CORS or connectivity issue
- `no posts found for query` → Invalid tag or no results from Danbooru
- `no valid image posts found` → Posts exist but have no image URLs
- `failed to apply background` → Image preload or DOM manipulation failed

### 2. Test Danbooru API Directly
Open a new browser tab and navigate to:
```
https://danbooru.donmai.us/posts.json?tags=chastity_cage+order:approvals&limit=10&page=1
```

**Expected result:** JSON array with post objects
**If you see:**
- `403 Forbidden` → IP banned or rate limited
- `CORS error` → Browser blocking cross-origin request (check console)
- Empty array `[]` → Tag has no results
- `503 Service Unavailable` → Danbooru is down

### 3. Check CORS Configuration
Danbooru's API should allow cross-origin requests, but some browsers/extensions may block them.

**To test:**
1. Open DevTools → Network tab
2. Refresh gallery page
3. Filter by "danbooru.donmai.us"
4. Look for red/failed requests
5. Click request → Headers tab
6. Check if `Access-Control-Allow-Origin` header exists

**Common CORS blockers:**
- Privacy extensions (uBlock Origin, Privacy Badger)
- Corporate firewalls
- Browser privacy settings (Firefox Enhanced Tracking Protection)

### 4. Test with Diagnostic Tool
Use the `test-background.html` file:

```
1. Open test-background.html in browser
2. Click "Test Background Load" button
3. Check console for detailed logs
4. Verify if image appears in #background-blur element
```

### 5. Verify Element Initialization
Check if `#background-blur` element exists:

```javascript
// Run in browser console
const blur = document.getElementById('background-blur');
console.log('blur element:', blur);
console.log('background-image:', blur?.style?.backgroundImage);
console.log('has ambient-layer class:', document.querySelector('.ambient-layer') !== null);
```

### 6. Check localStorage/sessionStorage
Background system uses session storage for caching:

```javascript
// Check for cached API responses
for (let key in sessionStorage) {
  if (key.includes('danbooru')) {
    console.log(key, sessionStorage.getItem(key).length, 'bytes');
  }
}
```

Clear cache if needed:
```javascript
sessionStorage.clear();
location.reload();
```

## Common Fixes

### Fix 1: Clear Browser Cache
```
Settings → Privacy → Clear browsing data → Cached images and files
```

### Fix 2: Disable Privacy Extensions
Temporarily disable extensions like:
- uBlock Origin
- Privacy Badger
- NoScript
- AdBlock Plus

### Fix 3: Test in Incognito Mode
Open site in incognito/private browsing to rule out extension interference.

**Note:** Site has "incognito-theme" detection that *disables* backgrounds — make sure this isn't active by checking:
```javascript
document.body.classList.contains('incognito-theme');
```

### Fix 4: Use Different Browser
Test in Chrome, Firefox, and Edge to isolate browser-specific issues.

### Fix 5: Check Rate Limiting
Danbooru API has rate limits. If you've made many requests:
- Wait 5-10 minutes
- Clear `window._danbooruUnavailable` flag:
  ```javascript
  delete window._danbooruUnavailable;
  ```

### Fix 6: Verify Tag Validity
Current ambient tags (13 total):
```
chastity_cage, femdom, humiliation, pegging, bondage, crossdressing, 
feminization, collar, leash, orgasm_denial, spanking, bdsm, latex
```

All should return results. Test individual tags:
```
https://danbooru.donmai.us/posts.json?tags=chastity_cage&limit=1
```

### Fix 7: Check Network Connectivity
```bash
# PowerShell
Test-NetConnection danbooru.donmai.us -Port 443
```

## Expected Behavior

1. **On page load:** Ambience controller initializes, schedules first refresh
2. **After 15 seconds:** First background refresh triggered
3. **API call:** Fetches 40 posts from Danbooru with random tag
4. **Image selection:** Picks random post, extracts `large_file_url`
5. **Preload:** Creates temporary Image object to preload
6. **Apply:** Creates `.ambient-layer` div with background-image
7. **Repeat:** Every 15 seconds (or on interaction)

## Files Involved

- `modules/ambience-controller.js` - Scheduling and payload building
- `modules/gallery.js` (lines 810-920) - `setRandomBackground()` function
- `modules/api.js` (lines 600-650) - `getRandomBackgroundImage()` function
- `styles/tailwind.css` (lines 1991-2028) - `.ambient-layer` styles
- `index.html` / `gallery/index.html` - `<div id="background-blur">` element

## Debug Commands

Run these in browser console:

```javascript
// Force immediate background refresh
window.refreshBackground?.();

// Check current ambience state
console.log(window.ambienceController);

// Manually trigger setRandomBackground
// (requires gallery.js exports this function)
```

## Report Template

When reporting background loading issues, include:

1. **Browser:** Chrome 120, Firefox 121, etc.
2. **OS:** Windows 11, macOS, Android
3. **Console logs:** Copy all [ambience] and [api] messages
4. **Network tab:** Screenshot of Danbooru API requests
5. **Direct API test:** Result of visiting danbooru.donmai.us/posts.json...
6. **Extensions:** List any ad blockers or privacy tools
7. **Private browsing:** Does it work in incognito mode?

## Known Issues

1. **CORS on some networks:** Corporate/school firewalls may block Danbooru
2. **Rate limiting:** Heavy usage can trigger 429 responses
3. **Danbooru downtime:** Site occasionally goes offline for maintenance
4. **Invalid tags:** Misspelled tags return empty results
5. **Incognito theme active:** Intentionally disables backgrounds for privacy
