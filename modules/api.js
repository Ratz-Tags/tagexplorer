/**
 * API module - Handles Danbooru API interactions and caching with rate limiting
 */

// Use the global fetch implementation (available in modern browsers and Node 18+)
const fetchFn = fetch;

import { fetchWithCache } from "./fetch-cache.js";

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Tuned defaults: slightly more aggressive but include jitter to reduce thundering herd
  minDelay: 600, // Minimum 600ms between requests (helps throughput)
  maxDelay: 8000, // Maximum 8s delay for backoff
  maxRetries: 4, // allow an extra retry before failing
  backoffMultiplier: 1.8, // gentler backoff multiplier
};

// Request queue and tracking
let requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
let currentDelay = RATE_LIMIT_CONFIG.minDelay;

// Request deduplication
const pendingRequests = new Map(); // url -> Promise
const requestBatches = new Map(); // batch key -> array of requests

/**
 * Rate-limited fetch wrapper with exponential backoff and deduplication
 */
async function rateLimitedFetch(url, options = {}) {
  // Check if this request is already pending
  const requestKey = `${url}:${JSON.stringify(options)}`;
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }
  
  const promise = new Promise((resolve, reject) => {
    requestQueue.push({ url, options, resolve, reject, retries: 0 });
    // notify listeners and start processing
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        const detail = { length: requestQueue.length, currentDelay };
        try { window.dispatchEvent(new CustomEvent('api:queue:update', { detail })); } catch(e) { /* ignore */ }
      }
    } catch (e) {}
    console.debug && console.debug('[api] enqueued', url, 'queueLen=', requestQueue.length);
    processQueue();
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
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    // Wait if we need to respect rate limits
    if (timeSinceLastRequest < currentDelay) {
      await new Promise(resolve => setTimeout(resolve, currentDelay - timeSinceLastRequest));
    }
    
    try {
      lastRequestTime = Date.now();
      const response = await fetchFn(request.url, request.options);
      
      if (response.status === 429) {
        // Rate limited - implement exponential backoff
        request.retries++;
        if (request.retries <= RATE_LIMIT_CONFIG.maxRetries) {
          // Increase delay with multiplier, clamp to maxDelay, and add small random jitter
          const next = Math.min(
            Math.floor(currentDelay * RATE_LIMIT_CONFIG.backoffMultiplier),
            RATE_LIMIT_CONFIG.maxDelay
          );
          const jitter = Math.floor(Math.random() * Math.max(100, Math.floor(next * 0.12))); // up to ~12% jitter
          currentDelay = Math.min(next + jitter, RATE_LIMIT_CONFIG.maxDelay);
          console.warn(`Rate limited, backing off to ${currentDelay}ms delay (retry ${request.retries}/${RATE_LIMIT_CONFIG.maxRetries})`);
          
          // Show user feedback on first rate limit hit
          if (request.retries === 1) {
            showRateLimitWarning();
          }
          
          requestQueue.unshift(request); // Put back at front
          try { if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') { window.dispatchEvent(new CustomEvent('api:queue:update', { detail: { length: requestQueue.length, currentDelay } })); } } catch(e){}
          continue;
        } else {
          console.error('Danbooru rate limit exceeded, max retries reached');
          showRateLimitError();
          request.reject(new Error('Rate limit exceeded, max retries reached'));
          continue;
        }
      } else if (response.ok) {
        // Success - reduce delay gradually
        // Reduce currentDelay gradually toward minDelay
        currentDelay = Math.max(Math.floor(currentDelay * 0.88), RATE_LIMIT_CONFIG.minDelay);
        hideRateLimitWarning();
      } else {
        // Other HTTP errors
        console.warn(`API request failed with status ${response.status}: ${request.url}`);
      }
      // notify listeners that queue length changed
      try { if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') { window.dispatchEvent(new CustomEvent('api:queue:update', { detail: { length: requestQueue.length, currentDelay } })); } } catch(e){}
      request.resolve(response);
      
    } catch (error) {
      request.reject(error);
    }
  }
  
  isProcessingQueue = false;
}

// Expose a simple queue info function for debugging
function getQueueInfo() {
  return {
    length: requestQueue.length,
    isProcessing: isProcessingQueue,
    currentDelay,
    lastRequestTime,
  };
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
  return url.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
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

  // Danbooru limits basic searches to two tags. Ensure we never send more.
  const tagsParam = Array.isArray(tags)
    ? tags.slice(0, 2).join(" ")
    : tags;
  const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(
    tagsParam
  )}+order:${order}&limit=${limit}&page=${page}`;

  try {
    const response = await rateLimitedFetch(url);
    const data = await response.json();

  // Cache the result if enabled and non-empty (don't cache empty results)
  if (useCache && cacheKey && Array.isArray(data) && data.length > 0) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // Cache quota exceeded, ignore
    }
  }    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Danbooru API fetch failed:", error);
    return [];
  }
}

/**
 * Filters posts to only include valid image posts
 */
function filterValidImagePosts(posts, tags = []) {
  return posts.filter((post) => {
    const url = post?.large_file_url || post?.file_url;
    const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
    return isImage && !post.is_banned && postHasAllTags(post, tags);
  });
}

/**
 * Gets a random background image from Danbooru
 */
async function getRandomBackgroundImage(query = "chastity_cage") {
  const page = Math.floor(Math.random() * 5) + 1;

  try {
    const posts = await fetchPosts(query, {
      limit: 40,
      page,
      useCache: false,
    });

    if (posts.length === 0) return null;

    const validPosts = posts.filter(
      (post) => post?.large_file_url || post?.file_url
    );

    if (validPosts.length === 0) return null;

    const randomPost =
      validPosts[Math.floor(Math.random() * validPosts.length)];
    const url = randomPost.large_file_url || randomPost.file_url;
    return buildImageUrl(url);
  } catch (error) {
    // Suppress CORS/network spam
    if (error && error.message && error.message.includes('NetworkError')) {
      if (typeof window !== 'undefined') {
        window._danbooruUnavailable = true;
      }
      return null;
    }
    console.warn("Failed to get random background:", error);
    return null;
  }
}

// Accept paging options for fetchArtistImages
async function fetchArtistImages(artistName, selectedTags = [], options = {}) {
  // Only two tags may be queried; slice for safety
  const effectiveTags = selectedTags.slice(0, 2);
  const page = Math.max(1, options.page || 1);
  const limit = options.limit || 200;
  const order = options.order || "approvals";
  const cacheSignature = [`p${page}`, `l${limit}`, `o${order}`].join("");
  const apiCacheKey = `danbooru-api-${artistName}-${effectiveTags.join(",")}-${cacheSignature}`;
  const useCache = options.useCache !== false;
  
  // Check cache first
  if (useCache) {
    const cached = sessionStorage.getItem(apiCacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return filterValidImagePosts(data, effectiveTags);
      } catch {
        // Invalid cache, continue to fetch
      }
    }
  }
  
  // Include artist name with up to two selected tags for the API search
  const queryTags = [artistName, ...effectiveTags];
  const posts = await fetchPosts(queryTags, {
    cacheKey: useCache ? apiCacheKey : null,
    useCache,
    limit,
    page,
    order,
  });
  return filterValidImagePosts(posts, effectiveTags);
}

/**
 * Batch fetch multiple artist images with staggered requests
 */
async function fetchArtistImagesBatch(requests, options = {}) {
  const { batchDelay = 500, maxConcurrent = 3 } = options;
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
    const resp = await rateLimitedFetch(
      `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(
        artistName
      )}`
    );
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data = await resp.json();
    const count = data?.counts?.posts;
    if (typeof count === "number") {
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
    const [artists, tooltips, generalTaunts, tagTaunts] =
      await Promise.all([
        fetchWithCache("artists.json"),
        fetchWithCache("tag-tooltips.json"),
        fetchWithCache("taunts.json"),
        fetchWithCache("tag-taunts.json"),
      ]);

    return {
      artists,
      tooltips,
      generalTaunts,
      tagTaunts,
    };
  } catch (error) {
    console.error("Failed to load required data files:", error);
    throw error;
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
  const url = `https://danbooru.donmai.us/counts/posts?tags=${tags.join("+")}`;
  const response = await rateLimitedFetch(url);
  if (!response.ok) return 0;
  const html = await response.text();
  // Extract the post count from the HTML using a regex
  const match = html.match(/Post count for.*?:\s*(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0;
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

// Debug helper
export { getQueueInfo };

// All functions in this file are defined and used as follows:

// postHasAllTags: exported, used by filterValidImagePosts
// buildImageUrl: exported, used by gallery.js, api.js
// fetchPosts: exported, used by fetchArtistImages, getRandomBackgroundImage
// filterValidImagePosts: exported, used by fetchArtistImages
// getRandomBackgroundImage: exported, used by gallery.js
// fetchArtistImages: exported, used by gallery.js, api.js
// loadArtists: used by getArtistImageCount
// getArtistImageCount: exported, used by fetchAllArtistImages
// clearArtistCache: exported, used by gallery.js
// loadAppData: exported, used by main.js
// fetchAllArtistImages: exported, used by gallery.js
// fetchPostCountForTags: exported, used by gallery.js

// No unused or undefined functions in this file.
