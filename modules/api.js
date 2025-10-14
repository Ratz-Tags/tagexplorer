/**
 * API module - Handles Danbooru API interactions and caching with rate limiting
 * Version: 2024-09-27-artist-deduplication-fix
 */

// Debug function to check API version
export const API_VERSION = "2024-09-27-artist-deduplication-fix";
export function getApiVersion() {
  return API_VERSION;
}

// Use the global fetch implementation (available in modern browsers and Node 18+)
const fetchFn = fetch;

import { fetchWithCache } from "./fetch-cache.js";

// Environment detection for better error handling
function isGitHubPages() {
  return typeof window !== 'undefined' && 
         (window.location.hostname.includes('github.io') || 
          window.location.hostname.includes('github.dev'));
}

function isCorsError(error) {
  return error && (
    (error.name === 'TypeError' && error.message.includes('Failed to fetch')) ||
    error.message.includes('CORS') ||
    error.message.includes('Cross-Origin') ||
    error.message.includes('blocked')
  );
}

const ARTISTS_DATA_URL = new URL("../artists.json", import.meta.url).href;
const TOOLTIP_DATA_URL = new URL("../tag-tooltips.json", import.meta.url).href;
const TAUNTS_DATA_URL = new URL("../taunts.json", import.meta.url).href;
const TAG_TAUNTS_DATA_URL = new URL("../tag-taunts.json", import.meta.url).href;
const TTS_LINES_DATA_URL = new URL("../data/tts_lines.json", import.meta.url).href;

const GALLERY_STATE_KEY = "tagexplorer:gallery:state";
const ARTIST_LOOKUP = new Map();
let artistsListPromise = null;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Slow the baseline to avoid hammering Danbooru during parallel fetches
  minDelay: 120, // Minimum spacing between queued requests
  maxDelay: 8000, // Maximum delay for aggressive backoff recovery
  maxRetries: 5, // allow a couple more retries before failing
  backoffMultiplier: 1.65, // quick recovery while respecting limits
};

// Request queue and tracking
let requestQueue = [];
let activeQueuedRequests = 0;
let queueProcessingScheduled = false;
let lastRequestTime = 0;
let currentDelay = RATE_LIMIT_CONFIG.minDelay;
let rateLimiterCursor = Promise.resolve();

// Request deduplication
const pendingRequests = new Map(); // url -> Promise
const pendingArtistRequests = new Map(); // artistName -> Promise
const requestBatches = new Map(); // batch key -> array of requests

// In-memory API JSON cache to avoid reparsing/rehydration during a session
const apiMemoryCache = new Map(); // cacheKey -> parsed JSON

const DEFAULT_BATCH_DELAY_MS = 16;
const DEFAULT_MAX_CONCURRENT_REQUESTS = (() => {
  if (typeof navigator !== 'undefined' && navigator?.hardwareConcurrency) {
    const hw = Number(navigator.hardwareConcurrency) || 0;
    if (hw > 0) {
      return Math.min(16, Math.max(8, Math.ceil(hw * 1.5)));
    }
  }
  return 12;
})();

const MAX_PARALLEL_FETCHES = (() => {
  if (typeof navigator !== 'undefined' && navigator?.hardwareConcurrency) {
    const hw = Number(navigator.hardwareConcurrency) || 0;
    if (hw > 0) {
      return Math.min(12, Math.max(4, Math.round(hw * 0.75)));
    }
  }
  return 6;
})();

let dynamicMaxParallelFetches = MAX_PARALLEL_FETCHES;

const scheduleMicrotask =
  typeof queueMicrotask === 'function'
    ? (cb) => queueMicrotask(cb)
    : (cb) => Promise.resolve().then(cb);

function delay(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.round(numeric * 1000);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    const diff = parsed - Date.now();
    return diff > 0 ? diff : 0;
  }
  return 0;
}

async function waitForRateSlot() {
  const previous = rateLimiterCursor;
  rateLimiterCursor = previous
    .catch(() => {})
    .then(async () => {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < currentDelay) {
        await delay(currentDelay - elapsed);
      }
      lastRequestTime = Date.now();
    });
  await rateLimiterCursor;
}

function toArtistSlug(name, fallbackIndex = 0) {
  const base = String(name || "artist").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (base) return base;
  return `artist-${fallbackIndex}`;
}

function indexArtists(list = []) {
  if (!Array.isArray(list)) return;
  list.forEach((artist, index) => {
    if (!artist || typeof artist !== "object") return;
    const slug = toArtistSlug(artist.slug || artist.artistName, index);
    if (!ARTIST_LOOKUP.has(slug)) {
      ARTIST_LOOKUP.set(slug, { ...artist, slug });
    }
  });
}

async function ensureArtistsList() {
  if (!artistsListPromise) {
    artistsListPromise = fetchWithCache(ARTISTS_DATA_URL).then((list) =>
      Array.isArray(list) ? list : []
    );
  }
  const artists = await artistsListPromise;
  indexArtists(artists);
  return artists;
}

/**
 * Rate-limited fetch wrapper with exponential backoff and deduplication
 */
async function rateLimitedFetch(url, options = {}) {
  // Check if this request is already pending
  const requestKey = `${url}:${JSON.stringify(options)}`;
  if (pendingRequests.has(requestKey)) {
    // Clone the response to allow multiple readers
    const sharedResponse = await pendingRequests.get(requestKey);
    return sharedResponse.clone();
  }
  
  const promise = new Promise((resolve, reject) => {
    requestQueue.push({ url, options, resolve, reject, retries: 0 });
    console.debug && console.debug('[api] enqueued', url, 'queueLen=', requestQueue.length);
    scheduleQueueProcessing();
  });
  
  // Store the promise for deduplication
  pendingRequests.set(requestKey, promise);
  
  // Clean up after completion
  promise.finally(() => {
    pendingRequests.delete(requestKey);
  });
  
  return promise;
}

/**
 * Process the request queue with rate limiting
 */
function processQueue() {
  queueProcessingScheduled = false;
  if (!requestQueue.length) {
    return;
  }

  const availableSlots = Math.max(1, dynamicMaxParallelFetches - activeQueuedRequests);
  for (let i = 0; i < availableSlots && requestQueue.length; i++) {
    const request = requestQueue.shift();
    activeQueuedRequests++;
    handleQueuedRequest(request)
      .catch((error) => {
        // The error has already been logged and rejected in handleQueuedRequest
        // This catch is just to ensure the promise chain doesn't break
      })
      .finally(() => {
        activeQueuedRequests = Math.max(0, activeQueuedRequests - 1);
        scheduleQueueProcessing();
      });
  }
}

function scheduleQueueProcessing() {
  if (queueProcessingScheduled) return;
  queueProcessingScheduled = true;
  scheduleMicrotask(processQueue);
}

async function handleQueuedRequest(request) {
  while (true) {
    try {
      await waitForRateSlot();
      const response = await fetchFn(request.url, request.options);

      if (response.status === 429) {
        request.retries += 1;
        if (request.retries <= RATE_LIMIT_CONFIG.maxRetries) {
          const retryAfterHeader = response.headers?.get('retry-after');
          const retryAfterMs = parseRetryAfter(retryAfterHeader);
          if (dynamicMaxParallelFetches > 1) {
            dynamicMaxParallelFetches = Math.max(1, Math.floor(dynamicMaxParallelFetches * 0.66));
          }
          let waitMs = retryAfterMs;
          if (!waitMs) {
            const next = Math.min(
              Math.floor(currentDelay * RATE_LIMIT_CONFIG.backoffMultiplier),
              RATE_LIMIT_CONFIG.maxDelay
            );
            const jitter = Math.floor(Math.random() * Math.max(150, Math.floor(next * 0.2)));
            currentDelay = Math.min(next + jitter, RATE_LIMIT_CONFIG.maxDelay);
            waitMs = currentDelay;
          } else {
            currentDelay = Math.max(waitMs, RATE_LIMIT_CONFIG.minDelay);
          }
          if (request.retries === 1) {
            showRateLimitWarning();
          }
          await delay(waitMs);
          continue;
        }
        console.error('Danbooru rate limit exceeded, max retries reached');
        showRateLimitError();
        request.reject(new Error('Rate limit exceeded, max retries reached'));
        return;
      }

      if (response.ok) {
        currentDelay = Math.max(Math.floor(currentDelay * 0.8), RATE_LIMIT_CONFIG.minDelay);
        if (dynamicMaxParallelFetches < MAX_PARALLEL_FETCHES) {
          dynamicMaxParallelFetches = Math.min(
            MAX_PARALLEL_FETCHES,
            dynamicMaxParallelFetches + 1
          );
        }
        hideRateLimitWarning();
      } else {
        console.warn(`API request failed with status ${response.status}: ${request.url}`);
      }

      request.resolve(response);
      return;
    } catch (error) {
      // Handle network errors, CORS errors, and other fetch failures
      if (isCorsError(error)) {
        if (isGitHubPages()) {
          console.warn(`CORS error on GitHub Pages for ${request.url}: Cross-origin requests may be blocked by browser policy`);
        } else {
          console.warn(`CORS error for ${request.url}: API may not allow cross-origin requests`);
        }
      } else {
        console.warn(`Fetch error for ${request.url}:`, error.message || error);
      }
      
      // Reject with a more descriptive error that won't cause unhandled rejections
      const friendlyError = new Error(`API request failed: ${error.message || 'Network error'}`);
      friendlyError.name = 'APIError'; // Specific error type for filtering
      friendlyError.originalError = error;
      request.reject(friendlyError);
      return;
    }
  }
}



/**
 * User feedback for rate limiting
 */
let rateLimitWarningEl = null;

function showRateLimitWarning() {
  if (typeof document === 'undefined') return;
  
  hideRateLimitWarning(); // Remove any existing warning
  
  rateLimitWarningEl = document.createElement('div');
  rateLimitWarningEl.className = 'rate-limit-warning';
  rateLimitWarningEl.innerHTML = `
    <div style="
      position: fixed; 
      top: 80px; 
      right: 20px; 
      background: rgba(255, 130, 87, 0.9); 
      color: white; 
      padding: 12px 20px; 
      border-radius: 12px; 
      font-size: 0.8rem; 
      z-index: 10000;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 130, 87, 0.3);
      max-width: 300px;
    ">
      ⚠️ API rate limited - slowing down requests...
    </div>
  `;
  
  document.body.appendChild(rateLimitWarningEl);
}

function showRateLimitError() {
  if (typeof document === 'undefined') return;
  
  hideRateLimitWarning();
  
  rateLimitWarningEl = document.createElement('div');
  rateLimitWarningEl.className = 'rate-limit-error';
  rateLimitWarningEl.innerHTML = `
    <div style="
      position: fixed; 
      top: 80px; 
      right: 20px; 
      background: rgba(239, 68, 68, 0.9); 
      color: white; 
      padding: 12px 20px; 
      border-radius: 12px; 
      font-size: 0.8rem; 
      z-index: 10000;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(239, 68, 68, 0.3);
      max-width: 300px;
    ">
      ❌ API rate limit exceeded - some images may not load
    </div>
  `;
  
  document.body.appendChild(rateLimitWarningEl);
  
  // Auto-hide error after 5 seconds
  setTimeout(() => {
    hideRateLimitWarning();
  }, 5000);
}

function hideRateLimitWarning() {
  if (rateLimitWarningEl && rateLimitWarningEl.parentNode) {
    rateLimitWarningEl.parentNode.removeChild(rateLimitWarningEl);
    rateLimitWarningEl = null;
  }
}

/**
 * Checks if a post has all the specified tags
 */
function postHasAllTags(post, tags) {
  if (!tags.length) return true;
  // Danbooru returns tags as a space-separated string in tag_string
  const tagArr = (post.tag_string || "").split(" ");
  return tags.every((tag) => tagArr.includes(tag));
}

/**
 * Builds a complete URL from a potentially relative Danbooru URL
 */
function buildImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://danbooru.donmai.us${url}`;
  return `https://danbooru.donmai.us/${url}`;
}

const IMAGE_FILE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "bmp",
  "heic",
  "heif",
]);

function extractExtension(url) {
  if (!url) return "";
  try {
    const normalized = url.split("?")[0];
    const lastDot = normalized.lastIndexOf(".");
    if (lastDot === -1) return "";
    return normalized.slice(lastDot + 1).toLowerCase();
  } catch (e) {
    return "";
  }
}

function isImageExtension(ext) {
  if (!ext) return false;
  const normalized = String(ext).toLowerCase();
  return IMAGE_FILE_EXTENSIONS.has(normalized);
}

function selectVariantUrl(post, types) {
  if (!post || !Array.isArray(post?.media_asset?.variants)) return "";
  for (const type of types) {
    const variant = post.media_asset.variants.find(
      (entry) => entry && entry.type === type && entry.url
    );
    if (variant && variant.url) {
      return variant.url;
    }
  }
  return "";
}

function resolvePostUrls(post) {
  const originalCandidates = [
    post?.large_file_url,
    post?.file_url,
    selectVariantUrl(post, ["original", "image", "large"]),
  ];
  const previewCandidates = [
    post?.preview_file_url,
    selectVariantUrl(post, [
      "720x720",
      "540x540",
      "360x360",
      "180x180",
      "medium",
      "small",
    ]),
  ];

  const fullUrl = originalCandidates.find(Boolean) || "";
  const previewUrl = previewCandidates.find(Boolean) || fullUrl;

  return {
    fullUrl,
    previewUrl,
  };
}

/**
 * Fetches posts from Danbooru API with optional caching
 */
async function fetchPosts(tags, options = {}) {
  const {
    limit = 200,
    page = 1,
    order = "score",
    useCache = true,
    cacheKey = null,
  } = options;

  // Check cache if enabled
  if (useCache && cacheKey) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache, continue to fetch
      }
    }
  }

  // Send all tags provided by the caller. Do not impose a client-side two-tag limit here.
  const tagsParam = Array.isArray(tags) ? tags.join(" ") : tags;
  const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(
    tagsParam
  )}+order:${order}&limit=${limit}&page=${page}`;

  try {
    // Use a memory cache key: prefer the explicit cacheKey, otherwise use the URL
    const memoryKey = cacheKey || url;
    if (apiMemoryCache.has(memoryKey)) {
      return apiMemoryCache.get(memoryKey);
    }

    const response = await rateLimitedFetch(url);
    
    // Check if the response is ok before trying to parse JSON
    if (!response.ok) {
      console.warn(`Danbooru API returned ${response.status} ${response.statusText} for: ${url}`);
      return [];
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn(`Failed to parse JSON response from Danbooru API: ${parseError.message}`);
      return [];
    }

    // Populate in-memory cache for this session (even if useCache is false)
    if (Array.isArray(data) && data.length > 0) {
      try { apiMemoryCache.set(memoryKey, data); } catch (e) {}
    }

    // Cache the result if enabled and non-empty (don't cache empty results)
    if (useCache && cacheKey && Array.isArray(data) && data.length > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // Cache quota exceeded, ignore
      }
    }
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    // More specific error logging
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.warn("Danbooru API network error: likely CORS or connectivity issue");
    } else if (error.message && error.message.includes('CORS')) {
      console.warn("Danbooru API CORS error: cross-origin request blocked");
    } else if (error.message && error.message.includes('Rate limit')) {
      console.warn("Danbooru API rate limit error:", error.message);
    } else {
      console.warn("Danbooru API fetch failed:", error.message || error);
    }
    return [];
  }
}

/**
 * Filters posts to only include valid image posts
 */
function filterValidImagePosts(posts, tags = []) {
  if (!Array.isArray(posts)) return [];

  const filtered = [];

  for (const post of posts) {
    if (!post || post.is_banned || post.is_deleted) {
      continue;
    }

    const { fullUrl, previewUrl } = resolvePostUrls(post);
    if (!fullUrl) {
      continue;
    }

    const normalizedFull = buildImageUrl(fullUrl);
    const normalizedPreview = buildImageUrl(previewUrl);

    const extFromField = String(post?.file_ext || "").toLowerCase();
    const extFromUrl = extractExtension(normalizedFull);
    const effectiveExt = extFromField || extFromUrl;

    if (effectiveExt && !isImageExtension(effectiveExt)) {
      continue;
    }

    if (!postHasAllTags(post, tags)) {
      continue;
    }

    const enriched = { ...post };
    if (!enriched.large_file_url) {
      enriched.large_file_url = normalizedFull;
    }
    if (!enriched.file_url) {
      enriched.file_url = normalizedFull;
    }
    if (!enriched.preview_file_url && normalizedPreview) {
      enriched.preview_file_url = normalizedPreview;
    }
    if (!enriched.file_ext && effectiveExt) {
      enriched.file_ext = effectiveExt;
    }

    filtered.push(enriched);
  }

  return filtered;
}

/**
 * Gets a random background image from Danbooru
 */
async function getRandomBackgroundImage(query = "chastity_cage") {
  const page = Math.floor(Math.random() * 5) + 1;
  console.log('[api] getRandomBackgroundImage query:', query, 'page:', page);

  try {
    const posts = await fetchPosts(query, {
      limit: 40,
      page,
      order: "approvals",
      useCache: false,
    });
    console.log('[api] fetchPosts returned:', posts.length, 'posts');

    if (posts.length === 0) {
      console.warn('[api] no posts found for query:', query);
      return null;
    }

    const validPosts = posts.filter(
      (post) => post?.large_file_url || post?.file_url
    );
    console.log('[api] filtered to', validPosts.length, 'valid posts');

    if (validPosts.length === 0) {
      console.warn('[api] no valid image posts found');
      return null;
    }

    const randomPost =
      validPosts[Math.floor(Math.random() * validPosts.length)];
    const url = randomPost.large_file_url || randomPost.file_url;
    const finalUrl = buildImageUrl(url);
    console.log('[api] selected background image:', finalUrl);
    return finalUrl;
  } catch (error) {
    // Suppress CORS/network spam
    if (error && error.message && error.message.includes('NetworkError')) {
      if (typeof window !== 'undefined') {
        window._danbooruUnavailable = true;
      }
      console.warn('[api] Danbooru unavailable (network error)');
      return null;
    }
    console.warn("[api] Failed to get random background:", error);
    return null;
  }
}

// Accept paging options for fetchArtistImages
async function fetchArtistImages(artistName, selectedTags = [], options = {}) {
  // Always query Danbooru with only the artist tag. Gallery filtering happens client-side.
  const page = Math.max(1, options.page || 1);
  const limit = options.limit || 200;
  const order = options.order || "approvals";
  const cacheSignature = [`p${page}`, `l${limit}`, `o${order}`].join("");
  const apiCacheKey = `danbooru-api-${artistName}-${cacheSignature}`;
  const useCache = options.useCache !== false;

  // Create deduplication key for this specific artist + paging request
  const artistRequestKey = `${artistName}-${cacheSignature}`;
  
  // Check if this exact artist request is already pending
  if (pendingArtistRequests.has(artistRequestKey)) {
    const posts = await pendingArtistRequests.get(artistRequestKey);
    return filterValidImagePosts(posts, selectedTags);
  }
  
  // Check cache first
  if (useCache) {
    // Try in-memory cache first (fast)
    if (apiMemoryCache.has(apiCacheKey)) {
      return filterValidImagePosts(apiMemoryCache.get(apiCacheKey), selectedTags);
    }

    const cached = sessionStorage.getItem(apiCacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        try { apiMemoryCache.set(apiCacheKey, data); } catch (e) {}
        return filterValidImagePosts(data, selectedTags);
      } catch {
        // Invalid cache, continue to fetch
      }
    }
  }
  
  // Create the API call promise using only the artist tag
  const apiPromise = fetchPosts([artistName], {
    cacheKey: useCache ? apiCacheKey : null,
    useCache,
    limit,
    page,
    order,
  });
  
  // Store the promise for deduplication
  pendingArtistRequests.set(artistRequestKey, apiPromise);
  
  // Clean up after completion
  apiPromise.finally(() => {
    pendingArtistRequests.delete(artistRequestKey);
  });
  
  // Wait for the API call and filter the results
  const posts = await apiPromise;
  try { apiMemoryCache.set(apiCacheKey, posts); } catch (e) {}
  return filterValidImagePosts(posts, selectedTags);
}

/**
 * Batch fetch multiple artist images with staggered requests
 */
async function fetchArtistImagesBatch(requests, options = {}) {
  const {
    batchDelay = DEFAULT_BATCH_DELAY_MS,
    maxConcurrent = DEFAULT_MAX_CONCURRENT_REQUESTS,
  } = options;
  const results = new Map();
  
  // Process requests in smaller concurrent batches
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const batch = requests.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async (request) => {
      try {
        const result = await fetchArtistImages(
          request.artistName,
          request.selectedTags,
          request.options
        );
        results.set(request.key || request.artistName, result);
      } catch (error) {
        console.warn(`Failed to fetch images for ${request.artistName}:`, error);
        results.set(request.key || request.artistName, []);
      }
    });
    
    // Wait for this batch to complete
    await Promise.all(batchPromises);
    
    // Add delay between batches (except for the last one)
    if (i + maxConcurrent < requests.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  return results;
}
/**
 * Gets artist image count with caching
 */
let artistsCache = null;

async function loadArtists() {
  if (artistsCache) return artistsCache;
  try {
    if (typeof window === "undefined") {
      const fs = await import("fs/promises");
      const { fileURLToPath } = await import("url");
      const { dirname, resolve } = await import("path");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const filePath = resolve(__dirname, "../artists.json");
      const data = await fs.readFile(filePath, "utf8");
      artistsCache = JSON.parse(data);
    } else {
      artistsCache = await fetchWithCache("artists.json");
    }
  } catch (e) {
    console.warn("Failed to load artists.json:", e);
    artistsCache = [];
  }
  return artistsCache;
}

export async function getArtistImageCount(artistName, options = {}) {
  const { force = false } = options;
  const artists = await loadArtists();
  const artist = artists.find((a) => a.artistName === artistName);
  // Only trust cached values that are positive. Zero is treated as unknown/stale.
  if (
    !force &&
    artist &&
    Number.isInteger(artist.postCount) &&
    artist.postCount > 0
  ) {
    return artist.postCount;
  }
  try {
    // small session cache to avoid repeated /counts calls
    const cacheKey = `danbooru-count-artist-${artistName}`;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const created = Number(parsed.t) || 0;
          const ttl = Number(parsed.ttl) || 0;
          if (ttl === 0 || Date.now() - created <= ttl) {
            if (typeof parsed.v === 'number') return parsed.v;
          } else {
            sessionStorage.removeItem(cacheKey);
          }
        }
      }
    } catch (e) {
      // ignore sessionStorage errors
    }

    const resp = await rateLimitedFetch(
      `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(
        artistName
      )}`
    );
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data = await resp.json();
    const count = data?.counts?.posts;
    if (typeof count === "number") {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), ttl: 1000 * 60 * 60, v: count }));
      } catch (e) {
        // ignore storage errors
      }
      return count;
    }
  } catch (e) {
    console.warn("getArtistImageCount fetch failed:", e);
  }
  return 0;
}

/**
 * Clears cached data for an artist
 */
function clearArtistCache(artistName) {
  // Remove localStorage cache
  localStorage.removeItem(`danbooru-image-${artistName}`);

  // Remove all sessionStorage keys for this artist
  const prefix = `danbooru-api-${artistName}-`;
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

/**
 * Loads app data files (artists, tooltips, taunts)
 */
async function loadAppData() {
  try {
    const [artists, tooltips, generalTaunts, tagTaunts, ttsLines] =
      await Promise.all([
        getArtistsIndex(),
        fetchWithCache(TOOLTIP_DATA_URL),
        fetchWithCache(TAUNTS_DATA_URL),
        fetchWithCache(TAG_TAUNTS_DATA_URL),
        fetchWithCache(TTS_LINES_DATA_URL),
      ]);

    return {
      artists,
      tooltips,
      generalTaunts,
      tagTaunts,
      ttsLines,
    };
  } catch (error) {
    console.error("Failed to load required data files:", error);
    throw error;
  }
}

export async function getArtistsIndex() {
  const artists = await ensureArtistsList();
  return artists;
}

export function getArtistSlug(name) {
  return toArtistSlug(name);
}

export async function getArtistBySlug(slug) {
  if (!slug) return null;
  const normalized = toArtistSlug(slug);
  if (ARTIST_LOOKUP.has(normalized)) {
    return ARTIST_LOOKUP.get(normalized);
  }
  const artists = await ensureArtistsList();
  return ARTIST_LOOKUP.get(normalized) ||
    artists.find((artist, index) => toArtistSlug(artist.artistName, index) === normalized) ||
    null;
}

export async function preloadArtistBySlug(slug) {
  if (!slug) return null;
  return getArtistBySlug(slug);
}

export async function preloadDataset(key) {
  switch (key) {
    case 'artists':
      return ensureArtistsList();
    case 'tooltips':
      return fetchWithCache(TOOLTIP_DATA_URL);
    case 'taunts':
      return fetchWithCache(TAUNTS_DATA_URL);
    case 'tag-taunts':
      return fetchWithCache(TAG_TAUNTS_DATA_URL);
    case 'tts-lines':
      return fetchWithCache(TTS_LINES_DATA_URL);
    default:
      return null;
  }
}

export function persistGalleryState(state = {}) {
  try {
    sessionStorage.setItem(
      GALLERY_STATE_KEY,
      JSON.stringify({ ...state, timestamp: Date.now() })
    );
  } catch (error) {
    console.warn('[api] Unable to persist gallery state', error);
  }
}

export function restoreGalleryState() {
  try {
    const raw = sessionStorage.getItem(GALLERY_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    console.warn('[api] Unable to restore gallery state', error);
    return null;
  }
}

export function clearGalleryState() {
  try {
    sessionStorage.removeItem(GALLERY_STATE_KEY);
  } catch (error) {
    console.warn('[api] Unable to clear gallery state', error);
  }
}

/**
 * Fetches all images for an artist, handling Danbooru API pagination
 * Returns an array of all valid image posts for the artist
 * Now supports parallel fetches for faster loading
 */
async function fetchAllArtistImages(
  artistName,
  selectedTags = [],
  options = {}
) {
  const LIMIT = 200;
  const ORDER = options.order || "approvals";
  const MAX_PAGES = options.maxPages || 1000; // safety cap
  let page = 1;
  let allPosts = [];
  // If parallel option is requested, attempt to fetch pages in parallel
  if (options.parallel) {
    try {
      const count = await getArtistImageCount(artistName);
      if (!count || count <= 0) return [];
      const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(count / LIMIT)));

      const requests = [];
      for (let p = 1; p <= totalPages; p++) {
        requests.push({ artistName, selectedTags, options: { limit: LIMIT, page: p, order: ORDER }, key: `p${p}` });
      }

      const parallelOptions = {
        batchDelay: options.batchDelay ?? DEFAULT_BATCH_DELAY_MS,
        maxConcurrent: options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT_REQUESTS,
      };
      const batchResults = await fetchArtistImagesBatch(requests, parallelOptions);
      for (let p = 1; p <= totalPages; p++) {
        const key = `p${p}`;
        const pagePosts = batchResults.get(key) || [];
        if (Array.isArray(pagePosts) && pagePosts.length) {
          allPosts = allPosts.concat(pagePosts);
        }
      }
      return allPosts;
    } catch (e) {
      console.warn('Parallel fetchAllArtistImages failed, falling back to sequential:', e);
      // fallthrough to sequential below
    }
  }

  // Sequential fetch (default)
  while (page <= MAX_PAGES) {
    const posts = await fetchArtistImages(artistName, selectedTags, {
      limit: LIMIT,
      page,
      order: ORDER,
    });
    if (!posts.length) break;
    allPosts = allPosts.concat(posts);
    if (posts.length < LIMIT) break;
    page++;
  }

  return allPosts;
}

/**
 * Fetches post count for a set of tags using Danbooru's /counts/posts endpoint (HTML response)
 */
export async function fetchPostCountForTags(tags) {
  const joined = Array.isArray(tags) ? tags.join('+') : String(tags || '');
  const cacheKey = `danbooru-count-tags-${joined}`;

  // Try session cache first (1 hour TTL)
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const created = Number(parsed.t) || 0;
        const ttl = Number(parsed.ttl) || 0;
        if (ttl === 0 || Date.now() - created <= ttl) {
          return typeof parsed.v === 'number' ? parsed.v : 0;
        }
        sessionStorage.removeItem(cacheKey);
      }
    }
  } catch (e) {}

  const url = `https://danbooru.donmai.us/counts/posts?tags=${joined}`;
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return 0;
    const html = await response.text();
    // Extract the post count from the HTML using a regex
    const match = html.match(/Post count for.*?:\s*(\d+)/);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), ttl: 1000 * 60 * 60, v: value }));
      } catch (e) {}
      return value;
    }
  } catch (e) {
    console.warn('fetchPostCountForTags failed:', e);
  }
  return 0;
}

/**
 * Fetch general (non-kink) style tags for an artist from Danbooru
 * These tags are used for visual similarity matching
 */
export async function fetchArtistStyleTags(artistName, options = {}) {
  const { limit = 200, useCache = true } = options;
  const cacheKey = `danbooru-style-tags-${artistName}`;
  
  // Try session cache first (24 hour TTL for style tags)
  if (useCache) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const created = Number(parsed.t) || 0;
          const ttl = Number(parsed.ttl) || 0;
          if (ttl === 0 || Date.now() - created <= ttl) {
            return Array.isArray(parsed.v) ? parsed.v : [];
          }
          sessionStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {}
  }
  
  // Style-related tag categories to look for
  const STYLE_TAG_PATTERNS = [
    'monochrome', 'greyscale', 'sketch', 'lineart', 'comic', 'manga',
    'realistic', 'anime_style', 'western_style', 'chibi', 'pixel_art',
    'watercolor_(medium)', 'traditional_media', 'digital_media',
    'thick_thighs', 'muscular', 'petite', 'voluptuous', 'slender',
    'huge_breasts', 'large_breasts', 'medium_breasts', 'small_breasts', 'flat_chest',
    'curvy', 'hourglass_figure', 'wide_hips', 'narrow_waist',
    'soft_shading', 'cel_shading', 'flat_colors', 'painterly',
    'stylized', 'semi-realistic', 'cartoon', 'anime_coloring'
  ];
  
  try {
    // Fetch posts for the artist
    const posts = await fetchPosts([artistName], {
      limit,
      page: 1,
      order: 'score',
      useCache: true
    });
    
    if (!posts || posts.length === 0) return [];
    
    // Collect all general tags from posts
    const tagFrequency = new Map();
    
    for (const post of posts) {
      if (!post.tag_string_general) continue;
      
      const generalTags = post.tag_string_general.split(' ');
      
      for (const tag of generalTags) {
        // Check if tag matches style patterns
        const isStyleTag = STYLE_TAG_PATTERNS.some(pattern => 
          tag.includes(pattern) || pattern.includes(tag)
        );
        
        if (isStyleTag) {
          tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
        }
      }
    }
    
    // Convert to array and sort by frequency
    const styleTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .filter(([tag, count]) => count >= Math.ceil(posts.length * 0.1)) // Must appear in at least 10% of posts
      .map(([tag]) => tag);
    
    // Cache the result (24 hour TTL)
    if (useCache && styleTags.length > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ 
          t: Date.now(), 
          ttl: 1000 * 60 * 60 * 24, // 24 hours
          v: styleTags 
        }));
      } catch (e) {
        console.warn('Failed to cache style tags:', e);
      }
    }
    
    return styleTags;
    
  } catch (error) {
    console.warn(`Failed to fetch style tags for ${artistName}:`, error);
    return [];
  }
}

// Export functions for ES modules
export {
  postHasAllTags,
  buildImageUrl,
  fetchPosts,
  filterValidImagePosts,
  getRandomBackgroundImage,
  fetchArtistImages,
  fetchArtistImagesBatch,
  fetchAllArtistImages,
  clearArtistCache,
  loadAppData,
};

// All functions in this file are defined and used as follows:

// postHasAllTags: exported, used by filterValidImagePosts
// buildImageUrl: exported, used by gallery.js, api.js
// fetchPosts: exported, used by fetchArtistImages, getRandomBackgroundImage, fetchArtistStyleTags
// filterValidImagePosts: exported, used by fetchArtistImages
// getRandomBackgroundImage: exported, used by gallery.js
// fetchArtistImages: exported, used by gallery.js, api.js
// loadArtists: used by getArtistImageCount
// getArtistImageCount: exported, used by fetchAllArtistImages
// clearArtistCache: exported, used by gallery.js
// loadAppData: exported, used by main.js
// fetchAllArtistImages: exported, used by gallery.js
// fetchPostCountForTags: exported, used by gallery.js
// fetchArtistStyleTags: exported, used by similar-artists.js

// No unused or undefined functions in this file.
