import { createFullscreenViewer, createSpinner, showToast } from "./ui.js";
import {
  fetchArtistImages,
  clearArtistCache,
  buildImageUrl,
  fetchAllArtistImages,
  getArtistImageCount,
  fetchArtistStyleTags,
  getArtistSlug,
  getRandomBackgroundImage,
  filterValidImagePosts,
  isApiRateLimited,
  getRateLimitDetail,
  fetchArtistsByTag,
} from "./api.js";
import { getGlobalSearchMode } from "./tag-explorer.js";
import { handleArtistCopy } from "./sidebar.js";
import { pickThumbnailCandidateUrls } from "./thumbnail-chooser.js";
import { enhanceGalleryImages, injectImageQualityCss } from "./image-quality.js";
import { showSimilarArtistsModal, setAllArtists as setSimilarArtists } from "./similar-artists.js";
import { toggleFavorite, isFavorite } from "./favorites.js";

const FALLBACK_IMAGE_URL = new URL('../fallback.jpg', import.meta.url).href;

/**
 * Returns the thumbnail URL for an artist (used by sidebar and cards)
 */
function getThumbnailUrl(artist) {
  return artist && artist.thumbnailUrl ? artist.thumbnailUrl : undefined;
}

/**
 * Gallery module - Handles artist gallery display and image management
 */

// Gallery state
// Optimized batch size: balance between initial load performance and memory usage
const VIRTUAL_BATCH_SIZE = 40; // Reduced from 48 for better initial render performance
const MAX_VIRTUAL_CHUNKS = 10; // Increased from 5 to keep more chunks for infinite scroll
const VIRTUAL_OVERSCAN_CHUNKS = 2; // Increased from 1 for better coverage

const DEFAULT_ARTISTS_PER_PAGE = VIRTUAL_BATCH_SIZE;
const MAX_PAGES_IN_DOM = MAX_VIRTUAL_CHUNKS + VIRTUAL_OVERSCAN_CHUNKS;

let filtered = [];
let isFetching = false;
let sortMode = ["name"];
let filterGeneration = 0;
let artistsPerPage = DEFAULT_ARTISTS_PER_PAGE;
let currentPage = 1;
let totalPages = 0;
const renderedPages = new Set();
const pagination = {
  current: 1,
  perPage: DEFAULT_ARTISTS_PER_PAGE,
  total: 0,
};

const virtualState = {
  chunks: [], // [{ id, start, end, node }]
  nextChunkId: 1,
  recyclePool: [],
};

const IMAGE_OBSERVER_ROOT_MARGIN = "80px"; // Reduced from 160px to prevent premature loading
const IMAGE_OBSERVER_THRESHOLD = 0.01;
const DEFAULT_EAGER_IMAGE_COUNT = 24; // Increased for better initial load
const IDLE_FALLBACK_TIMEOUT = 800; // Reduced timeout
const PRIME_VISIBLE_BUFFER = 320; // Increased buffer

const IMAGE_FETCH_CONCURRENCY = 8; // Optimized: increased slightly since server-side filtering reduces payload size
const PREVIEW_FETCH_LIMIT = 3; // Only fetch 3 images for previews instead of 200
const imageFetchQueue = []; // Regular priority queue
const previewFetchQueue = []; // High priority queue for previews
let activeImageFetches = 0;

const IMAGE_FETCH_MAX_RETRIES = 4;
const IMAGE_FETCH_BASE_DELAY = 100; // Reduced base delay
const IMAGE_FETCH_MAX_DELAY = 6500;

// Microtask scheduler used by the image fetch queue; provide a local fallback
// instead of relying on other modules defining it. This prevents queue stalls
// when running in environments where only queueMicrotask or Promises are available.
const scheduleMicrotask =
  typeof queueMicrotask === 'function'
    ? (cb) => queueMicrotask(cb)
    : (cb) => Promise.resolve().then(cb);

function scheduleImageFetchProcessing() {
  if (activeImageFetches >= IMAGE_FETCH_CONCURRENCY) return;
  
  // Prioritize preview fetches (they're faster and needed for visible cards)
  const next = previewFetchQueue.shift() || imageFetchQueue.shift();
  if (!next) return;

  activeImageFetches += 1;
  Promise.resolve()
    .then(next.task)
    .then((result) => {
      next.resolve(result);
    })
    .catch((error) => {
      next.reject(error);
    })
    .finally(() => {
      activeImageFetches = Math.max(0, activeImageFetches - 1);
      scheduleMicrotask(scheduleImageFetchProcessing);
    });
}

function enqueueImageFetch(task, priority = false) {
  return new Promise((resolve, reject) => {
    const item = { task, resolve, reject };
    if (priority) {
      previewFetchQueue.push(item);
    } else {
      imageFetchQueue.push(item);
    }
    scheduleMicrotask(scheduleImageFetchProcessing);
  });
}

function queueFetchArtistImages(artistName, tags = [], options = {}, isPreview = false) {
  // Preview fetches get priority and use smaller limit
  if (isPreview) {
    const previewOptions = {
      ...options,
      limit: PREVIEW_FETCH_LIMIT,
      page: 1,
    };
    return enqueueImageFetch(() => fetchArtistImages(artistName, tags, previewOptions), true);
  }
  return enqueueImageFetch(() => fetchArtistImages(artistName, tags, options), false);
}

const DEFAULT_AMBIENT_TAGS = [
  'chastity_cage',
  'femdom',
  'humiliation',
  'pegging',
  'bondage',
  'crossdressing',
  'feminization',
  'collar',
  'leash',
  'orgasm_denial',
  'spanking',
  'bdsm',
  'latex',
];

const ambienceState = {
  currentUrl: null,
  activeLayer: null,
  motionModulePromise: null,
  intensity: 2,
  motionMode: 'full',
  lastQuery: 'chastity_cage',
};

// Ambient background fetch guardrails to prevent request storms
let _ambientBackgroundBusy = false;
let _lastAmbientApplyTs = 0;
const AMBIENT_MIN_INTERVAL_MS = 2500; // coalesce bursts (tags toggled rapidly, etc.)

const resolvePerPage = (value) => {
  const floored = Math.floor(Number(value));
  if (Number.isFinite(floored) && floored > 0) {
    return floored;
  }
  return DEFAULT_ARTISTS_PER_PAGE;
};

function updatePaginationTotals(list = filtered) {
  const safeList = Array.isArray(list) ? list : [];
  const safePerPage = resolvePerPage(pagination.perPage);
  if (pagination.perPage !== safePerPage) {
    pagination.perPage = safePerPage;
  }
  const total = safeList.length ? Math.ceil(safeList.length / safePerPage) : 0;
  pagination.total = total;
  return total;
}

function getTotalPages() {
  if (!pagination.total && filtered.length) {
    return updatePaginationTotals();
  }
  return pagination.total;
}

function getCurrentPage() {
  return pagination.current;
}

function resetPaginationState() {
  pagination.current = 1;
  updatePaginationTotals();
}

function setCurrentPage(val) {
  const numeric = Number(val);
  const target = Number.isFinite(numeric) ? Math.floor(numeric) : 1;
  const totalPages = getTotalPages();
  const maxPage = Math.max(1, totalPages || 0);
  pagination.current = Math.min(Math.max(1, target), maxPage);
  return pagination.current;
}

// DOM references
let artistGallery = null;
let backgroundBlur = null;
let gallerySentinel = null;
let galleryStartSentinel = null;

function triggerGalleryHumiliationPatch() {
  if (typeof window === "undefined") return;
  const patch = window._galleryHumiliationPatch;
  if (typeof patch === "function") {
    try {
      patch();
    } catch (error) {
      // Swallow errors to avoid breaking gallery rendering if the helper fails
    }
  }
}

function isRateLimitActive() {
  try {
    if (typeof isApiRateLimited === "function" && isApiRateLimited()) {
      return true;
    }
  } catch (error) {
    // Ignore probing errors and fall back to DOM signal checks below
  }

  try {
    if (
      typeof document !== "undefined" &&
      document.body &&
      document.body.dataset &&
      document.body.dataset.apiRateLimited === "true"
    ) {
      return true;
    }
  } catch (error) {
    // Ignore DOM access errors (e.g. server-side rendering)
  }

  try {
    if (typeof window !== "undefined" && window._danbooruUnavailable) {
      return true;
    }
  } catch (error) {
    // Ignore window access errors
  }

  return false;
}

// External dependencies
let allArtists = [];
let getActiveTags = null;
let getArtistNameFilter = null;
let getActiveTagsCallbackFn = null;
let getArtistNameFilterCallbackFn = null;

let countsReadyForActiveFilter = false;
let pendingMostCommonTag = null;
let requestedCountSortMode = null;

// TTL-backed session cache defaults and helpers (module scope so multiple functions can reuse)
let DEFAULT_ALLPOSTS_TTL_MS = 1000 * 60 * 60; // 1 hour (mutable for tests)

function setWithTTL(key, value, ttl = DEFAULT_ALLPOSTS_TTL_MS) {
  try {
    const payload = { t: Date.now(), ttl: ttl, v: value };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    // ignore quota errors
  }
}

function getWithTTL(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const created = Number(parsed.t) || 0;
    const ttl = Number(parsed.ttl) || 0;
    if (ttl > 0 && Date.now() - created > ttl) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.v;
  } catch (e) {
    return null;
  }
}

function removeWithTTL(key) {
  try { sessionStorage.removeItem(key); } catch (e) {}
}

// Runtime helpers for testing: change TTL and expire existing caches
function setAllPostsTTL(ms) {
  const n = Number(ms) || 0;
  if (n > 0) DEFAULT_ALLPOSTS_TTL_MS = n;
  return DEFAULT_ALLPOSTS_TTL_MS;
}

function expireAllPostsCaches() {
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (key.startsWith('allPosts-') || key.startsWith('danbooru-api-')) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => {
      try { sessionStorage.removeItem(k); } catch (e) {}
    });
    return toRemove.length;
  } catch (e) {
    return 0;
  }
}

function resetGallerySentinel() {
  gallerySentinel = null;
  galleryStartSentinel = null;
}

function ensureGallerySentinel() {
  if (!artistGallery) return null;
  if (!gallerySentinel || !artistGallery.contains(gallerySentinel)) {
    gallerySentinel = document.createElement("div");
    gallerySentinel.id = "gallery-end-sentinel";
    gallerySentinel.className = "gallery-sentinel";
    gallerySentinel.setAttribute("aria-hidden", "true");
    gallerySentinel.dataset.direction = "forward";
    artistGallery.appendChild(gallerySentinel);
  } else if (artistGallery.lastElementChild !== gallerySentinel) {
    artistGallery.appendChild(gallerySentinel);
    gallerySentinel.dataset.direction = "forward";
  }
  return gallerySentinel;
}

function ensureGalleryStartSentinel() {
  if (!artistGallery) return null;
  if (!galleryStartSentinel || !artistGallery.contains(galleryStartSentinel)) {
    galleryStartSentinel = document.createElement("div");
    galleryStartSentinel.id = "gallery-start-sentinel";
    galleryStartSentinel.className = "gallery-sentinel";
    galleryStartSentinel.setAttribute("aria-hidden", "true");
    galleryStartSentinel.dataset.direction = "backward";
    artistGallery.insertBefore(galleryStartSentinel, artistGallery.firstChild);
  } else {
    galleryStartSentinel.dataset.direction = "backward";
  }
  return galleryStartSentinel;
}
function removePageFromDom(pageNumber) {
  if (!artistGallery) return;
  const numeric = Number(pageNumber);
  if (!Number.isNaN(numeric)) {
    const index = virtualState.chunks.findIndex((chunk) => chunk.id === numeric);
    if (index >= 0) {
      const [chunk] = virtualState.chunks.splice(index, 1);
      if (chunk) {
        releaseChunkContainer(chunk);
        renderedPages.delete(chunk.id);
      }
      return;
    }
  }
  const cards = artistGallery.querySelectorAll(
    `.artist-card[data-page="${pageNumber}"]`
  );
  cards.forEach((card) => card.remove());
  renderedPages.delete(pageNumber);
}

function removeGalleryEmptyState() {
  if (!artistGallery) return;
  const empty = artistGallery.querySelector(".gallery-empty-state");
  if (empty) empty.remove();
}

function showGalleryEmptyState() {
  if (!artistGallery) return;
  const empty = document.createElement("div");
  empty.className = "gallery-empty-state gallery-empty-humiliation";
  empty.innerHTML = `
    <span class="gallery-empty-emoji">😭</span>
    <div class="gallery-empty-msg">Nobody wants to play with you.<br>Try less picky tags!</div>
  `;
  artistGallery.appendChild(empty);
  renderedPages.clear();
  resetGallerySentinel();
  triggerGalleryHumiliationPatch();
}

function resetVirtualState() {
  if (!artistGallery) return;
  const existingChunks = virtualState.chunks.slice();
  existingChunks.forEach((chunk) => {
    if (chunk?.node && chunk.node.parentNode === artistGallery) {
      chunk.node.remove();
    }
  });
  virtualState.chunks = [];
  virtualState.nextChunkId = 1;
  // Keep a small recycle pool so we can reuse chunk containers without
  // recreating DOM nodes repeatedly.
  if (virtualState.recyclePool.length > MAX_VIRTUAL_CHUNKS * 2) {
    virtualState.recyclePool.length = MAX_VIRTUAL_CHUNKS * 2;
  }
}

function getVirtualChunkSize() {
  const size = Number(artistsPerPage);
  if (Number.isFinite(size) && size > 0) {
    return Math.max(12, Math.floor(size));
  }
  return VIRTUAL_BATCH_SIZE;
}

function acquireChunkContainer() {
  const recycled = virtualState.recyclePool.pop();
  if (recycled) {
    recycled.innerHTML = "";
    return recycled;
  }
  const section = document.createElement("section");
  section.className = "gallery-chunk";
  section.setAttribute("role", "presentation");
  return section;
}

function releaseChunkContainer(chunk) {
  if (!chunk || !chunk.node) return;
  chunk.node.innerHTML = "";
  if (chunk.node.parentNode === artistGallery) {
    chunk.node.remove();
  }
  if (virtualState.recyclePool.length < MAX_VIRTUAL_CHUNKS * 2 + 2) {
    virtualState.recyclePool.push(chunk.node);
  }
}

function updateChunkMetadata(node, { id, start, end }) {
  if (!node) return;
  node.dataset.chunkId = String(id);
  node.dataset.startIndex = String(start);
  node.dataset.endIndex = String(end);
}

function appendVirtualChunk(startIndex = null) {
  if (!artistGallery) return false;
  const start =
    startIndex !== null && Number.isFinite(Number(startIndex))
      ? Math.max(0, Math.floor(Number(startIndex)))
      : virtualState.chunks.length > 0
      ? virtualState.chunks[virtualState.chunks.length - 1].end
      : 0;
  if (start >= filtered.length) {
    return false;
  }
  const chunkSize = getVirtualChunkSize();
  const end = Math.min(filtered.length, start + chunkSize);
  const artistsSlice = filtered.slice(start, end);
  const container = acquireChunkContainer();
  const chunkId = virtualState.nextChunkId++;
  updateChunkMetadata(container, { id: chunkId, start, end });
  renderArtistCards(artistsSlice, undefined, {
    chunkId,
    target: container,
    annotatePage: false,
    eager: start === 0,
  });
  const sentinel = ensureGallerySentinel();
  if (sentinel) {
    artistGallery.insertBefore(container, sentinel);
  } else {
    artistGallery.appendChild(container);
  }
  virtualState.chunks.push({ id: chunkId, start, end, node: container });
  renderedPages.add(chunkId);
  return true;
}

function prependVirtualChunk() {
  if (!artistGallery) return false;
  if (virtualState.chunks.length === 0) {
    return appendVirtualChunk(0);
  }
  const firstChunk = virtualState.chunks[0];
  const chunkSize = getVirtualChunkSize();
  const start = Math.max(0, firstChunk.start - chunkSize);
  if (start >= firstChunk.start) {
    return false;
  }
  const end = Math.min(filtered.length, start + chunkSize);
  const artistsSlice = filtered.slice(start, end);
  const container = acquireChunkContainer();
  const chunkId = virtualState.nextChunkId++;
  updateChunkMetadata(container, { id: chunkId, start, end });
  renderArtistCards(artistsSlice, undefined, {
    chunkId,
    target: container,
    annotatePage: false,
    eager: false,
  });
  const startSentinel = ensureGalleryStartSentinel();
  if (startSentinel && startSentinel.parentNode === artistGallery) {
    artistGallery.insertBefore(container, startSentinel.nextSibling);
  } else {
    artistGallery.insertBefore(container, artistGallery.firstChild);
  }
  virtualState.chunks.unshift({ id: chunkId, start, end, node: container });
  renderedPages.add(chunkId);
  return true;
}

function trimVirtualChunks(direction = "forward") {
  const limit = MAX_VIRTUAL_CHUNKS + VIRTUAL_OVERSCAN_CHUNKS;
  while (virtualState.chunks.length > limit) {
    const chunk =
      direction === "backward"
        ? virtualState.chunks.pop()
        : virtualState.chunks.shift();
    if (chunk) {
      releaseChunkContainer(chunk);
      renderedPages.delete(chunk.id);
    }
  }
}

function getVirtualRange() {
  if (virtualState.chunks.length === 0) {
    return { start: 0, end: 0 };
  }
  return {
    start: virtualState.chunks[0].start,
    end: virtualState.chunks[virtualState.chunks.length - 1].end,
  };
}

function ensureViewportCoverage() {
  if (!artistGallery) return;
  const viewportHeight =
    window.innerHeight || document.documentElement?.clientHeight || 0;
  const desiredHeight = viewportHeight * 1.2;
  let totalHeight = artistGallery.scrollHeight;
  let guard = 0;
  while (totalHeight < desiredHeight && guard < MAX_VIRTUAL_CHUNKS + 4) {
    const appended = appendVirtualChunk();
    if (!appended) break;
    guard += 1;
    totalHeight = artistGallery.scrollHeight;
  }
}

function updatePaginationSnapshot() {
  const total = filtered.length;
  const chunkSize = getVirtualChunkSize();
  pagination.perPage = chunkSize;
  pagination.total = Math.ceil(total / pagination.perPage);
  const range = getVirtualRange();
  if (range.end > range.start) {
    const current = Math.floor(range.start / chunkSize) + 1;
    const last = Math.max(current, Math.ceil(range.end / chunkSize));
    pagination.current = current;
    currentPage = last;
  } else {
    pagination.current = 1;
    currentPage = 1;
  }
  totalPages = pagination.total;
}

// Fisher-Yates shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sortCurrentArtists(list = filtered, mode = sortMode) {
  if (!Array.isArray(list) || !list.length) return list;

  const modes = Array.isArray(mode) ? mode : [mode];

  // If "shuffle" is the primary mode, we randomize once and return.
  // Note: This mutates the list in-place, which is consistent with existing sort behavior.
  if (modes[0] === "shuffle") {
    // Only shuffle if we haven't already shuffled this specific filtered set
    // or if explicit reshuffle is requested (handled elsewhere by resetting this flag/state)
    if (!list._isShuffled) {
       shuffleArray(list);
       list._isShuffled = true;
    }
    return list;
  }
  
  // If we are not in shuffle mode, clear the shuffled flag so next time we do shuffle
  list._isShuffled = false;

  list.sort((a, b) => {
    for (const m of modes) {
      let diff = 0;
      if (m === "count") {
        diff = (b._totalImageCount || 0) - (a._totalImageCount || 0);
      } else if (m === "tag-frequency") {
        diff = (b._mostCommonTagCount || 0) - (a._mostCommonTagCount || 0);
      } else if (m === "shuffle") {
         // Shuffle as a secondary sort doesn't make much sense in a stable sort, 
         // but we can treat it as "no op" or random tie-breaker.
         // For now, let's treat it as random tie-breaker.
         diff = Math.random() - 0.5;
      } else {
        // Default: sort by name
        diff = a.artistName.localeCompare(b.artistName, undefined, {
          sensitivity: "base",
        });
      }
      if (diff !== 0) return diff;
    }
    return 0;
  });
  return list;
}

function requiresCountBasedData(mode = sortMode) {
  const modes = Array.isArray(mode) ? mode : [mode];
  return modes.includes("count") || modes.includes("tag-frequency");
}

function reshuffleArtists() {
  if (filtered) {
    filtered._isShuffled = false;
    sortCurrentArtists(filtered, ["shuffle"]);
    renderArtistsPage({ force: true });
  }
}

function clearArtistCountState(list = []) {
  if (!Array.isArray(list)) return;
  list.forEach((artist) => {
    if (!artist || typeof artist !== "object") return;
    artist._totalImageCount = undefined;
    artist._imageCount = undefined;
    artist._mostCommonTagCount = undefined;
  });
}

function computeMostCommonActiveTag(activeTags, artists) {
  if (!activeTags || activeTags.size === 0) return null;
  const tagCounts = new Map();
  const source = Array.isArray(artists) ? artists : [];
  activeTags.forEach((tag) => {
    const normalized = String(tag || "").trim();
    if (!normalized) return;
    const count = source.reduce((total, artist) => {
      const tags = Array.isArray(artist?.kinkTags) ? artist.kinkTags : [];
      return total + (tags.includes(tag) ? 1 : 0);
    }, 0);
    tagCounts.set(tag, count);
  });
  let bestTag = null;
  let bestScore = -1;
  tagCounts.forEach((count, tag) => {
    if (count > bestScore) {
      bestScore = count;
      bestTag = tag;
    }
  });
  return bestScore > 0 ? bestTag : null;
}

async function populateArtistCounts({
  artists,
  mostCommonTag,
  generation,
  spinner,
  batchSize = 18,
  delayMs = 150,
}) {
  if (!Array.isArray(artists) || artists.length === 0) return;
  let fetchPostCountForTagsFn = null;
  if (mostCommonTag) {
    try {
      const apiModule = await import("./api.js");
      fetchPostCountForTagsFn = apiModule.fetchPostCountForTags;
    } catch (error) {
      console.warn("Failed to load fetchPostCountForTags:", error);
    }
  }

  let processed = 0;
  const concurrency = resolveCountFetchConcurrency();
  
  // Helper to check sessionStorage cache before making API call
  function getCachedCount(artistName) {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const cacheKey = `danbooru-count-artist-${artistName}`;
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const created = Number(parsed.t) || 0;
          const ttl = Number(parsed.ttl) || 0;
          if (ttl === 0 || Date.now() - created <= ttl) {
            if (typeof parsed.v === 'number') return parsed.v;
          }
        }
      }
    } catch (e) {
      // ignore sessionStorage errors
    }
    return null;
  }
  
  for (let i = 0; i < artists.length; i += batchSize) {
    if (generation !== filterGeneration) return;
    const batch = artists.slice(i, i + batchSize);
    
    // Optimization: Separate artists that need fetching from those that don't
    const needsFetch = [];
    const needsTagCount = [];
    
    for (const artist of batch) {
      if (!artist) continue;
      
      // Fast path: check if we already have postCount from artists.json
      if (typeof artist.postCount === "number" && artist.postCount > 0) {
        artist._totalImageCount = artist.postCount;
        artist._imageCount = artist.postCount;
        
        // Check if we need tag-specific count
        if (mostCommonTag) {
          // Check cache for tag count first
          const tagCacheKey = `danbooru-count-tags-${artist.artistName}+${mostCommonTag}`;
          let tagCountCached = null;
          if (typeof sessionStorage !== "undefined") {
            try {
              const raw = sessionStorage.getItem(tagCacheKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                  const created = Number(parsed.t) || 0;
                  const ttl = Number(parsed.ttl) || 0;
                  if (ttl === 0 || Date.now() - created <= ttl) {
                    tagCountCached = typeof parsed.v === 'number' ? parsed.v : 0;
                  }
                }
              }
            } catch (e) {}
          }
          
          if (tagCountCached !== null) {
            artist._mostCommonTagCount = tagCountCached;
          } else {
            needsTagCount.push(artist);
          }
        } else {
          artist._mostCommonTagCount = 0;
        }
        continue;
      }
      
      // Check sessionStorage cache before deciding to fetch
      const cachedCount = getCachedCount(artist.artistName);
      if (cachedCount !== null) {
        artist._totalImageCount = cachedCount;
        artist._imageCount = cachedCount;
        
        if (mostCommonTag) {
          // Check tag count cache
          const tagCacheKey = `danbooru-count-tags-${artist.artistName}+${mostCommonTag}`;
          let tagCountCached = null;
          if (typeof sessionStorage !== "undefined") {
            try {
              const raw = sessionStorage.getItem(tagCacheKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                  const created = Number(parsed.t) || 0;
                  const ttl = Number(parsed.ttl) || 0;
                  if (ttl === 0 || Date.now() - created <= ttl) {
                    tagCountCached = typeof parsed.v === 'number' ? parsed.v : 0;
                  }
                }
              }
            } catch (e) {}
          }
          
          if (tagCountCached !== null) {
            artist._mostCommonTagCount = tagCountCached;
          } else {
            needsTagCount.push(artist);
          }
        } else {
          artist._mostCommonTagCount = 0;
        }
        continue;
      }
      
      // Need to fetch from API
      needsFetch.push(artist);
    }

    // Fetch tag counts separately (these are lighter requests)
    if (needsTagCount.length > 0 && typeof fetchPostCountForTagsFn === "function") {
      let tagCursor = 0;
      const tagWorkerCount = Math.min(concurrency, needsTagCount.length);
      const tagWorkers = Array.from({ length: tagWorkerCount }, () =>
        (async function worker() {
          while (true) {
            if (generation !== filterGeneration) return;
            const index = tagCursor++;
            if (index >= needsTagCount.length) return;
            
            const artist = needsTagCount[index];
            try {
              const tagCount = await fetchPostCountForTagsFn([
                artist.artistName,
                mostCommonTag,
              ]);
              artist._mostCommonTagCount = Number(tagCount) || 0;
            } catch (error) {
              artist._mostCommonTagCount = 0;
            }
          }
        })()
      );
      await Promise.all(tagWorkers);
    }

    // Only spin up workers if we actually have network requests to make
    if (needsFetch.length > 0) {
      let cursor = 0;
      const workerCount = Math.min(concurrency, needsFetch.length);
      const workers = Array.from({ length: workerCount }, () =>
        (async function worker() {
          while (true) {
            if (generation !== filterGeneration) return;
            const index = cursor++;
            if (index >= needsFetch.length) return;
            
            const artist = needsFetch[index];
            try {
              const totalCount = await getArtistImageCount(artist.artistName);
              artist._totalImageCount = totalCount;
              artist._imageCount = totalCount;
              
              if (mostCommonTag && typeof fetchPostCountForTagsFn === "function") {
                const tagCount = await fetchPostCountForTagsFn([
                  artist.artistName,
                  mostCommonTag,
                ]);
                artist._mostCommonTagCount = Number(tagCount) || 0;
              } else {
                artist._mostCommonTagCount = 0;
              }
            } catch (error) {
              artist._totalImageCount = artist.postCount || 0;
              artist._imageCount = artist.postCount || 0;
              artist._mostCommonTagCount = typeof artist._mostCommonTagCount === "number" ? artist._mostCommonTagCount : 0;
            }
          }
        })()
      );

      await Promise.all(workers);
      
      // Only delay if we actually did network work
      if (generation !== filterGeneration) return;
      if (i + batchSize < artists.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    processed += batch.length;
    if (spinner && typeof spinner.updateProgress === "function") {
      spinner.updateProgress(processed);
    }
  }
}

function resolveCountFetchConcurrency() {
  if (typeof navigator !== "undefined" && navigator?.hardwareConcurrency) {
    const cores = Number(navigator.hardwareConcurrency) || 0;
    if (cores >= 8) return 4;
    if (cores >= 4) return 3;
  }
  return 2;
}

function normaliseAmbientTag(tag) {
  if (!tag) return "";
  return String(tag).trim().toLowerCase().replace(/\s+/g, "_");
}

function toWeightMap(input) {
  const map = new Map();
  if (!input) return map;
  if (input instanceof Map) {
    input.forEach((value, key) => {
      const safeKey = normaliseAmbientTag(key);
      const numeric = Number(value);
      if (!safeKey || !Number.isFinite(numeric)) return;
      map.set(safeKey, numeric);
    });
    return map;
  }
  if (Array.isArray(input)) {
    input.forEach((key) => {
      const safeKey = normaliseAmbientTag(key);
      if (!safeKey) return;
      const prev = map.get(safeKey) || 0;
      map.set(safeKey, prev + 1);
    });
    return map;
  }
  if (typeof input === "object") {
    Object.entries(input).forEach(([key, value]) => {
      const safeKey = normaliseAmbientTag(key);
      const numeric = Number(value);
      if (!safeKey || !Number.isFinite(numeric)) return;
      map.set(safeKey, numeric);
    });
    return map;
  }
  return map;
}

function deriveAmbientWeights(tagWeights) {
  const base = toWeightMap(tagWeights);
  if (base.size === 0) {
    const sample = filtered.slice(0, 80);
    sample.forEach((artist, index) => {
      const tags = Array.isArray(artist?.kinkTags) ? artist.kinkTags : [];
      const bias = Math.max(1, sample.length - index);
      tags.forEach((tag) => {
        const safeKey = normaliseAmbientTag(tag);
        if (!safeKey) return;
        const prev = base.get(safeKey) || 0;
        base.set(safeKey, prev + 1 * bias);
      });
    });
  }
  if (base.size === 0) {
    DEFAULT_AMBIENT_TAGS.forEach((tag, index) => {
      base.set(tag, DEFAULT_AMBIENT_TAGS.length - index);
    });
  }
  return base;
}

function selectWeightedTag(weights, excludeTag = null) {
  const entries = Array.from(weights.entries()).filter(([tag, weight]) => {
    if (!tag || !Number.isFinite(Number(weight))) return false;
    if (excludeTag && tag === excludeTag) return false;
    return Number(weight) > 0;
  });
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  let threshold = Math.random() * total;
  for (const [tag, value] of entries) {
    threshold -= Number(value);
    if (threshold <= 0) {
      return tag;
    }
  }
  return entries[entries.length - 1][0];
}

function buildAmbientQuery(weights, intensity = 2) {
  const sorted = Array.from(weights.entries()).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0]?.[0] || selectWeightedTag(weights) || DEFAULT_AMBIENT_TAGS[0];
  
  // Return just the tag - fetchPosts will add the order parameter
  console.log(`[ambience] built query: "${primary}" from weights`);
  return primary;
}

async function ensureMotionModule() {
  if (typeof window === "undefined") return null;
  try {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return null;
    }
  } catch (error) {
    // Ignore matchMedia errors
  }
  if (!ambienceState.motionModulePromise) {
    ambienceState.motionModulePromise = import(
      "https://cdn.jsdelivr.net/npm/motion@10.16.4/+esm"
    ).catch((error) => {
      console.warn("[ambience] Motion One import failed", error);
      return null;
    });
  }
  try {
    return await ambienceState.motionModulePromise;
  } catch (error) {
    console.warn("[ambience] Motion module failed", error);
    return null;
  }
}

async function preloadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("Empty ambient url"));
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(url);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function createAmbientLayer(url) {
  const layer = document.createElement("div");
  layer.className = "ambient-layer";
  layer.style.backgroundImage = `url(${url})`;
  layer.style.opacity = "0";
  return layer;
}

async function applyAmbientLayer(container, url) {
  if (!container || !url) return;
  const newLayer = createAmbientLayer(url);
  container.appendChild(newLayer);
  const previous = ambienceState.activeLayer;
  let motionModule = null;
  if (ambienceState.motionMode !== "reduced") {
    motionModule = await ensureMotionModule();
  }

  if (motionModule && typeof motionModule.animate === "function") {
    const animations = [
      motionModule
        .animate(
          newLayer,
          {
            opacity: [0, 0.82],
            transform: ["scale(1.05)", "scale(1)"],
            filter: ["blur(8px)", "blur(0px)"],
          },
          {
            duration: 1000,
            easing: "cubic-bezier(.4,-0.2,.2,1.2)",
            fill: "forwards",
          }
        )
        .finished.catch(() => {}),
    ];
    if (previous) {
      animations.push(
        motionModule
          .animate(
            previous,
            {
              opacity: [Number(previous.style.opacity) || 0.75, 0],
              filter: ["blur(0px)", "blur(18px)"],
            },
            {
              duration: 800,
              easing: "ease-out",
              fill: "forwards",
            }
          )
          .finished.catch(() => {})
      );
    }
    await Promise.all(animations);
  } else {
    newLayer.style.opacity = "0.8";
    if (previous) previous.style.opacity = "0";
  }

  if (previous && previous !== newLayer) {
    setTimeout(() => {
      try {
        previous.remove();
      } catch (error) {
        console.warn("[ambience] failed to remove old layer", error);
      }
    }, 240);
  }

  ambienceState.activeLayer = newLayer;
  container.classList.add("ambient-layer-container");
}

/**
 * Sets the background image based on ambient tag weights.
 */
async function setRandomBackground(options = {}) {
  const blur = document.getElementById('background-blur');
  console.log('[ambience] setRandomBackground called', { options, blur: !!blur });
  
  if (!blur) {
    console.warn('[ambience] #background-blur element not found');
    return;
  }

  if (document.body?.classList.contains('incognito-theme')) {
    console.log('[ambience] incognito mode active, clearing background');
    blur.style.backgroundImage = 'none';
    blur.style.backgroundColor = '#111';
    if (ambienceState.activeLayer) {
      try { ambienceState.activeLayer.remove(); } catch {}
      ambienceState.activeLayer = null;
    }
    return;
  }

  // Throttle and de-dupe background refreshes to avoid request storms
  const now = Date.now();
  const force = options?.force === true || options?.reason === 'init';
  if (_ambientBackgroundBusy && !force) {
    console.log('[ambience] refresh skipped: in-flight');
    return;
  }
  if (!force && now - _lastAmbientApplyTs < AMBIENT_MIN_INTERVAL_MS) {
    console.log('[ambience] refresh skipped: within min interval');
    return;
  }

  const { tagWeights, intensity, motionMode } = options;
  if (Number.isFinite(Number(intensity))) {
    ambienceState.intensity = Number(intensity);
  }
  if (motionMode === 'reduced' || motionMode === 'full') {
    ambienceState.motionMode = motionMode;
  }

  const weights = deriveAmbientWeights(tagWeights);
  const query = buildAmbientQuery(weights, ambienceState.intensity);
  ambienceState.lastQuery = query;
  console.log('[ambience] derived query:', query, 'from weights:', Object.fromEntries(weights || []));

  let imageUrl = null;
  _ambientBackgroundBusy = true;
  try {
    imageUrl = await getRandomBackgroundImage(query);
    console.log('[ambience] fetched imageUrl:', imageUrl);
  } catch (error) {
    console.warn('[ambience] failed to fetch background', error);
  }

  if (!imageUrl && ambienceState.currentUrl) {
    console.log('[ambience] no new image, reusing current:', ambienceState.currentUrl);
    imageUrl = ambienceState.currentUrl;
  }

  if (!imageUrl) {
    console.warn('[ambience] no image available, will retry on next refresh');
    // Don't set backgroundColor here - leave it transparent so lattice shows
    // The controller will retry automatically
    return;
  }

  if (imageUrl === ambienceState.currentUrl && ambienceState.activeLayer) {
    console.log('[ambience] image unchanged, skipping layer update');
    return;
  }

  try {
    const loadedUrl = await preloadImage(imageUrl);
    console.log('[ambience] preloaded image:', loadedUrl);
    await applyAmbientLayer(blur, loadedUrl);
    ambienceState.currentUrl = loadedUrl;
    blur.style.backgroundImage = 'none';
    blur.style.backgroundColor = 'transparent';
    console.log('[ambience] ✓ background applied successfully');
    _lastAmbientApplyTs = Date.now();
  } catch (error) {
    console.warn('[ambience] failed to apply background', error);
  } finally {
    _ambientBackgroundBusy = false;
  }
}

/**
 * Sets the best image for an artist with caching and lazy loading
 */
function setBestImage(artist, img) {
  if (!img) {
    return;
  }
  if (img._loadingImage) {
    return;
  }

  if (img._pendingRetry) {
    try {
      clearTimeout(img._pendingRetry);
    } catch (error) {
      // Ignore timer cleanup failures
    }
    img._pendingRetry = null;
  }

  const artistData = artist || img.__artistData;
  if (!artistData || !artistData.artistName) {
    return;
  }

  if (typeof img._imageRetryCount !== "number") {
    img._imageRetryCount = 0;
  }

  img._loadingImage = true;

  const cacheKey = `danbooru-image-${artistData.artistName}`;
  const cachedUrl = localStorage.getItem(cacheKey);

  const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];

  // Check both preview cache (fast, limit=3) and full cache (limit=200)
  // Prefer preview cache for initial load, fall back to full cache if available
  const previewCacheKey = `danbooru-api-${artistData.artistName}-preview`;
  const _cache_page = 1;
  const _cache_limit = 200;
  const _cache_order = 'approvals';
  const cacheSignature = [`p${_cache_page}`, `l${_cache_limit}`, `o${_cache_order}`].join('');
  const apiCacheKey = `danbooru-api-${artistData.artistName}-${cacheSignature}`;

  function getApiCache() {
    // First check preview cache (faster, smaller)
    try {
      const previewCached = sessionStorage.getItem(previewCacheKey);
      if (previewCached) {
        const parsed = JSON.parse(previewCached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    
    // Fall back to full cache
    const cached = sessionStorage.getItem(apiCacheKey);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  function setApiCache(data) {
    try {
      sessionStorage.setItem(apiCacheKey, JSON.stringify(data));
    } catch {}
  }

  function applyFallbackImage(reason = "unknown") {
    try {
      if (img._pendingRetry) {
        clearTimeout(img._pendingRetry);
      }
    } catch (error) {
      // Ignore timer cleanup failures during fallback
    }
    img._pendingRetry = null;
    img._loadingImage = false;
    try {
      img._imageRetryCount = IMAGE_FETCH_MAX_RETRIES;
    } catch (error) {
      // Ignore retry counter assignment errors
    }

    const context = { artist: artistData.artistName, reason };
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[gallery] using fallback image", context);
    }

    img.style.display = "none";
    img.src = FALLBACK_IMAGE_URL;
    setTimeout(() => {
      img.style.display = "block";
    }, 100);
  }

  function scheduleImageRetry(reason = "unknown", delayOverride) {
    const attempt = typeof img._imageRetryCount === "number" ? img._imageRetryCount : 0;
    if (attempt >= IMAGE_FETCH_MAX_RETRIES) {
      applyFallbackImage(reason);
      return;
    }

    const exponent = Math.max(0, attempt);
    const computedDelay = IMAGE_FETCH_BASE_DELAY * Math.pow(1.6, exponent);
    const delay = Math.min(
      Math.max(IMAGE_FETCH_BASE_DELAY, Number(delayOverride) || computedDelay),
      IMAGE_FETCH_MAX_DELAY
    );

    if (typeof console !== "undefined" && console.info) {
      console.info(
        "[gallery] retrying artist image",
        {
          artist: artistData.artistName,
          attempt: attempt + 1,
          delay,
          reason,
          rateLimited: isRateLimitActive(),
          detail: typeof getRateLimitDetail === "function" ? getRateLimitDetail() : null,
        }
      );
    }

    img._loadingImage = false;
    img._imageRetryCount = attempt + 1;

    try {
      if (img._pendingRetry) {
        clearTimeout(img._pendingRetry);
      }
    } catch (error) {
      // Ignore timer cleanup issues and overwrite with new timer below
    }

    img._pendingRetry = setTimeout(() => {
      img._pendingRetry = null;
      setBestImage(artistData, img);
    }, delay);
  }

  function processApiData(data, isFallback = false) {
    const postsArray = Array.isArray(data) ? data : [];
    const tagsForFilter = isFallback ? [] : selectedTags;
    const validPosts = filterValidImagePosts(postsArray, tagsForFilter);

    if (validPosts.length === 0) {
      if (!isFallback && selectedTags.length > 0) {
        // Wait briefly to allow any rate-limited requests to complete before giving up
        const WAIT_MS = 300; // small grace period (reduced from 700ms)
        setTimeout(() => {
          // Use preview mode for fallback too (faster)
          queueFetchArtistImages(artistData.artistName, [], { order: 'score' }, true)
            .then((fallbackData) => {
              processApiData(fallbackData, true);
            })
            .catch((error) => {
              if (isRateLimitActive()) {
                scheduleImageRetry("fallback-fetch-error");
              } else {
                applyFallbackImage(error?.message || "fallback-fetch-error");
              }
            });
        }, WAIT_MS);
      } else if (isRateLimitActive()) {
        scheduleImageRetry("no-valid-posts");
      } else {
        applyFallbackImage("no-valid-posts");
      }
      return;
    }

    // Strategy: load a lightweight preview first for reliability, then upgrade to full in the background.
    function tryLoadPreviewThenUpgrade(posts, postIndex = 0) {
      if (postIndex >= posts.length) {
        if (isRateLimitActive()) {
          scheduleImageRetry("exhausted-image-candidates");
        } else {
          applyFallbackImage("exhausted-image-candidates");
        }
        return;
      }

      const post = posts[postIndex];
      const preview = buildImageUrl(post.preview_file_url || post.large_file_url || post.file_url);
      const full = buildImageUrl(post.large_file_url || post.file_url || post.preview_file_url);

      if (!preview && !full) {
        tryLoadPreviewThenUpgrade(posts, postIndex + 1);
        return;
      }

      // Ensure handlers are unique per attempt
      const onPreviewError = () => {
        img.onerror = null;
        img.onload = null;
        tryLoadPreviewThenUpgrade(posts, postIndex + 1);
      };

      const onPreviewLoad = () => {
        img.onerror = null;
        img.onload = null;

        // Persist cache to speed up next loads
        try { localStorage.setItem(cacheKey, img.src); } catch {}

        const postId = post?.id;
        if (postId) {
          try { img.dataset.postId = String(postId); } catch {}
          
          // Store multiple images for slideshow
          // We take up to 5 valid posts
          const slideshowPosts = posts.slice(0, 5);
          const slideshowUrls = slideshowPosts.map(p => 
            buildImageUrl(p.large_file_url || p.file_url || p.preview_file_url)
          ).filter(Boolean);
          
          if (slideshowUrls.length > 1) {
            img.__slideshowUrls = slideshowUrls;
            img.__slideshowIndex = 0;
            
            // If this is the first time setting up slideshow for this card, add listeners
            // Note: img is inside a card. We usually want to attach listeners to the card container.
            // But here we only have reference to 'img'. 
            // The card container is img.closest('.artist-card').
            const card = img.closest('.artist-card');
            if (card && !card.__slideshowInitialized) {
              card.__slideshowInitialized = true;
              
              // Reveal the slideshow toggle button if present
              const toggleBtn = card.querySelector('.slideshow-toggle');
              if (toggleBtn) {
                toggleBtn.style.display = 'inline-block';
              }

              // Desktop hover
              card.addEventListener('mouseenter', () => {
                // Only auto-start if not manually toggled on (to avoid double intervals, though startSlideshow handles that)
                // and if we want hover behavior. 
                // If the user manually toggled it ON, we don't need to do anything on enter.
                // If the user manually toggled it OFF (not implemented, just on/off), we might want to respect that?
                // For now, let's say manual toggle overrides hover.
                if (!img.__manualSlideshow) {
                   startSlideshow(img);
                }
              });
              card.addEventListener('mouseleave', () => {
                // Only stop if not manually toggled on
                if (!img.__manualSlideshow) {
                  stopSlideshow(img);
                }
              });
              
              // Mobile auto-cycle via IntersectionObserver is handled globally or by a separate observer
              if (typeof registerMobileSlideshowObserver === "function") {
                 registerMobileSlideshowObserver(card);
              }
            }
          }
          artistData._thumbnailPostId = postId;
        }

        try {
          img.dataset.qualityEnhanced = 'true';
          img.decoding = 'async';
          if ('fetchPriority' in HTMLImageElement.prototype) {
            img.fetchPriority = 'high';
          }
        } catch (e) {}

        // Mark preview phase complete
        img._loadingImage = false;
        img._imageRetryCount = 0;
        try { if (img._pendingRetry) clearTimeout(img._pendingRetry); } catch {}
        img._pendingRetry = null;

        // Attempt upgrade to full-resolution in the background; if it fails, keep preview.
        if (full && full !== img.src) {
          const upgrader = new Image();
          upgrader.decoding = 'async';
          upgrader.onload = () => {
            // Swap only if the same artist/card is still current
            try {
              img.src = full;
              localStorage.setItem(cacheKey, full);
            } catch {}
          };
          upgrader.onerror = () => {
            // Silently keep preview
          };
          upgrader.src = full;
        }
      };

      img.onerror = onPreviewError;
      img.onload = onPreviewLoad;
      img.src = preview || full;
    }

    // Prefer to try up to 8 posts, starting with ones likely to succeed quickly
    const candidates = Array.isArray(validPosts) ? validPosts.slice(0, 8) : [];
    if (candidates.length > 0) {
      tryLoadPreviewThenUpgrade(candidates, 0);
    } else if (isRateLimitActive()) {
      scheduleImageRetry("no-thumbnail-candidates");
    } else {
      applyFallbackImage("no-thumbnail-candidates");
    }
  }

  if (cachedUrl) {
    img.onerror = fetchAndTry;
    img.onload = () => {
      img.onerror = null;
      img.onload = null;
      img._loadingImage = false;
      img._imageRetryCount = 0;
      try {
        if (img._pendingRetry) {
          clearTimeout(img._pendingRetry);
        }
      } catch (error) {
        // Ignore cleanup errors for cached image load
      }
      img._pendingRetry = null;
    };
    img.src = cachedUrl;
  } else {
    fetchAndTry();
  }

  function fetchAndTry() {
    const cached = getApiCache();
    if (cached) {
      processApiData(cached);
      return;
    }

    // For thumbnail previews, use preview mode (limit=3, priority queue)
    // This is much faster and reduces API load
    queueFetchArtistImages(artistData.artistName, [], { order: 'score' }, true)
      .then((data) => {
        // Cache the preview results with a preview-specific key
        const previewCacheKey = `danbooru-api-${artistData.artistName}-preview`;
        try {
          sessionStorage.setItem(previewCacheKey, JSON.stringify(data));
        } catch {}
        processApiData(data);
      })
      .catch((error) => {
        if (isRateLimitActive()) {
          scheduleImageRetry("primary-fetch-error");
        } else {
          applyFallbackImage(error?.message || "primary-fetch-error");
        }
      });
  }
// Slideshow helpers
function startSlideshow(img) {
  if (!img || !img.__slideshowUrls || img.__slideshowUrls.length <= 1) return;
  if (img.__slideshowInterval) return;
  
  // Preload next images
  img.__slideshowUrls.forEach(url => {
    const i = new Image();
    i.src = url;
  });
  
  img.__slideshowInterval = setInterval(() => {
    cycleCardImage(img, 1);
  }, 2500); // 2.5s per slide
}

function stopSlideshow(img) {
  if (!img) return;
  if (img.__slideshowInterval) {
    clearInterval(img.__slideshowInterval);
    img.__slideshowInterval = null;
  }
  // Reset to primary image (index 0)
  if (img.__slideshowUrls && img.__slideshowUrls.length > 0) {
    img.src = img.__slideshowUrls[0];
    img.__slideshowIndex = 0;
  }
}

function cycleCardImage(img, direction = 1) {
  if (!img || !img.__slideshowUrls || img.__slideshowUrls.length <= 1) return;
  
  let nextIndex = (img.__slideshowIndex + direction) % img.__slideshowUrls.length;
  if (nextIndex < 0) nextIndex = img.__slideshowUrls.length - 1;
  
  img.__slideshowIndex = nextIndex;
  img.src = img.__slideshowUrls[nextIndex];
}

// Mobile Slideshow Observer
let mobileSlideshowObserver = null;
function registerMobileSlideshowObserver(card) {
  // Auto-play disabled by user request.
  // if (typeof IntersectionObserver === 'undefined') return;
  
  // if (!mobileSlideshowObserver) {
  //   mobileSlideshowObserver = new IntersectionObserver((entries) => {
  //     entries.forEach(entry => {
  //       const img = entry.target.querySelector('img');
  //       if (!img) return;
  //       
  //       if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
  //         // Card is mostly visible (center of screen likely)
  //         startSlideshow(img);
  //       } else {
  //         stopSlideshow(img);
  //       }
  //     });
  //   }, {
  //     threshold: 0.85,
  //     rootMargin: "-10% 0px -10% 0px" // Only trigger when well within viewport
  //   });
  // }
  
  // mobileSlideshowObserver.observe(card);
}
}

function lazyLoadBestImage(artist, img) {
  if (typeof IntersectionObserver !== "function") {
    setBestImage(artist, img);
    return;
  }

  const observer = initImageObserver();
  if (observer) {
    try {
      observer.observe(img);
      img._lazyObserver = observer;
    } catch (error) {
      // Fall back to immediate load if observation fails
      setBestImage(artist, img);
      return;
    }
  }

  const idleLoad = () => {
    if (!img || img._loadingImage || img.getAttribute("src")) {
      return;
    }
    setBestImage(artist, img);
  };

  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(() => {
      img._idleCleanup = null;
      idleLoad();
    }, { timeout: IDLE_FALLBACK_TIMEOUT });
    img._idleCleanup = () => {
      try {
        cancelIdleCallback(handle);
      } catch (error) {
        // Ignore cancel failures
      }
    };
  } else {
    const timeout = setTimeout(() => {
      img._idleCleanup = null;
      idleLoad();
    }, IDLE_FALLBACK_TIMEOUT);
    img._idleCleanup = () => clearTimeout(timeout);
  }

  // Also observe for face detection/persistence
  const fobs = initFaceObserver();
  if (fobs) {
    try { fobs.observe(img); } catch {}
  }
}

// Function called by the intersection observer
function loadArtistImage(img) {
  if (!img || img._loadingImage) return;

  if (typeof img._idleCleanup === "function") {
    try {
      img._idleCleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
    img._idleCleanup = null;
  }

  const artistData = img.__artistData;
  if (!artistData) return;

  setBestImage(artistData, img);
}

function primeVisibleArtistImages(buffer = PRIME_VISIBLE_BUFFER) {
  if (!artistGallery || typeof window === "undefined") return;
  const viewportHeight =
    window.innerHeight || document.documentElement?.clientHeight || 0;
  const minVisible = -buffer;
  const maxVisible = viewportHeight + buffer;
  const images = artistGallery.querySelectorAll(".artist-card img");
  images.forEach((img) => {
    if (!img || img.getAttribute("src")) return;
    const rect = img.getBoundingClientRect();
    if (rect.bottom < minVisible || rect.top > maxVisible) return;
    const artistData = img.__artistData;
    if (!artistData) return;
    if (img._lazyObserver) {
      try {
        img._lazyObserver.unobserve(img);
      } catch {}
      img._lazyObserver = null;
    }
    setBestImage(artistData, img);
  });
}

/**
 * Opens the fullscreen artist zoom view
 */
async function openArtistZoom(artist) {
  // remove existing viewer
  document.querySelectorAll(".fullscreen-wrapper").forEach((el) => el.remove());

  let grid, zoomContent, backBtn;
  const LIMIT = 40;
  let posts = [];
  let page = 1;
  let zoomTotalPages = Infinity;
  let loading = false;
  let currentIndex = 0;
  const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];
  const allPostsCacheKey = `allPosts-${artist.artistName}`;

  const updatePageFromInitial = (initialCount) => {
    const hasMore = posts.length > initialCount;
    if (!initialCount) {
      page = zoomTotalPages + 1;
      return;
    }
    const pagesRendered = Math.ceil(initialCount / LIMIT);
    page = hasMore ? pagesRendered + 1 : zoomTotalPages + 1;
  };
  try {
    const cachedAll = getWithTTL(allPostsCacheKey);
    if (cachedAll && Array.isArray(cachedAll) && cachedAll.length > 0) {
      console.debug(`[gallery] allPosts cache hit for ${artist.artistName}: ${cachedAll.length} posts`);
      posts = cachedAll.slice();
      zoomTotalPages = Math.max(1, Math.ceil(posts.length / LIMIT));
      const initial = posts.slice(0, LIMIT);
      renderThumbs(initial, 0);
      updatePageFromInitial(initial.length);
    } else {
      // Attempt to reconstruct from per-page session cache (danbooru-api-... keys)
      try {
        const prefix = `danbooru-api-${artist.artistName}-`;
        const pageEntries = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (!key || !key.startsWith(prefix)) continue;
          const suffix = key.slice(prefix.length);
          const m = suffix.match(/p(\d+)l(\d+)o(.+)/);
          const pageNum = m ? Number(m[1]) : NaN;
          try {
            const raw = sessionStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              pageEntries.push({ page: isNaN(pageNum) ? 0 : pageNum, posts: parsed });
            }
          } catch (e) {
            // ignore parse errors
          }
        }
        if (pageEntries.length) {
          pageEntries.sort((a, b) => a.page - b.page);
          const reconstructed = [];
          for (const e of pageEntries) {
            reconstructed.push(...e.posts);
          }
          if (reconstructed.length) {
            console.debug(`[gallery] reconstructed ${reconstructed.length} posts for ${artist.artistName} from per-page session cache`);
            posts = reconstructed;
            setWithTTL(allPostsCacheKey, posts, DEFAULT_ALLPOSTS_TTL_MS);
            zoomTotalPages = Math.max(1, Math.ceil(posts.length / LIMIT));
            const initial = posts.slice(0, LIMIT);
            renderThumbs(initial, 0);
            updatePageFromInitial(initial.length);
          } else {
            console.debug(`[gallery] failed to reconstruct posts for ${artist.artistName} from per-page session cache`);
          }
        } else {
          console.debug(`[gallery] no per-page session cache found for ${artist.artistName}`);
        }
      } catch (e) {
        console.debug(`[gallery] error reconstructing per-page cache for ${artist.artistName}:`, e);
        // ignore reconstruction failures and continue to network fetch below
      }
    }
  } catch (e) {
    console.debug(`[gallery] error in allPosts cache/reconstruction for ${artist.artistName}:`, e);
    // ignore cache parse errors
  }

  function returnToGrid() {
    if (zoomContent) zoomContent.style.display = "none";
    if (backBtn) backBtn.style.display = "none";
    if (grid) grid.style.display = "grid";
  }

  const viewer = createFullscreenViewer({ onImageClick: returnToGrid });
  const { wrapper, img: zoomed, tagList, topTags, noEntriesMsg, prevBtn, nextBtn } = viewer;
  zoomContent = wrapper.querySelector(".zoom-content");

  backBtn = document.createElement("button");
  backBtn.className = "zoom-back-btn";
  backBtn.textContent = "Back";
  backBtn.addEventListener("click", returnToGrid);
  zoomContent.appendChild(backBtn);
  backBtn.style.display = "none";

  grid = document.createElement("div");
  grid.className = "artist-thumb-grid";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(8, minmax(0%, 100%))";
  grid.style.gap = "3px";
  grid.style.height = "100%";
  grid.style.overflowY = "auto";
  wrapper.appendChild(grid);

  const sentinel = document.createElement("div");
  sentinel.id = "grid-sentinel";
  grid.appendChild(sentinel);

  zoomContent.style.display = "none";

  document.body.appendChild(wrapper);
  wrapper.focus();

  async function loadPage() {
    if (loading || page > zoomTotalPages) return;
    loading = true;
    try {
      const api = await import("./api.js");

      // If we already have cached posts that include this page, render from them
      const startIdx = (page - 1) * LIMIT;
      const endIdx = page * LIMIT;
      if (posts.length >= endIdx) {
        const slice = posts.slice(startIdx, endIdx);
        renderThumbs(slice, startIdx);
        page++;
        return;
      }

      // If this is the first network fetch, try to get a rough page count from the API
      if (page === 1) {
        try {
          const count = await api.getArtistImageCount(artist.artistName);
          if (count && Number.isFinite(count)) {
            zoomTotalPages = Math.max(1, Math.ceil(count / LIMIT));
          }
        } catch {
          zoomTotalPages = Infinity;
        }
      }

      const newPosts = await api.fetchAllArtistImages(artist.artistName, [], { order: 'approvals', parallel: true, maxConcurrent: 10, batchDelay: 40 });

      if (Array.isArray(newPosts) && newPosts.length > 0) {
        console.debug(`[gallery] network fetchAllArtistImages loaded ${newPosts.length} posts for ${artist.artistName}`);
        posts = newPosts.slice();
        try { setWithTTL(allPostsCacheKey, posts, DEFAULT_ALLPOSTS_TTL_MS); } catch (e) {}
        zoomTotalPages = Math.max(1, Math.ceil(posts.length / LIMIT));
        const initial = posts.slice(0, LIMIT);
        renderThumbs(initial, 0);
        updatePageFromInitial(initial.length);
        if (posts.length <= LIMIT) return;
      } else {
        console.debug(`[gallery] network fetchAllArtistImages returned no posts for ${artist.artistName}, falling back to per-page fetch`);
        const startIdx = (page - 1) * LIMIT;
        const endIdx = page * LIMIT;
        if (posts.length >= endIdx) {
          const slice = posts.slice(startIdx, endIdx);
          renderThumbs(slice, startIdx);
          page++;
          return;
        }

        const perPagePosts = await api.fetchArtistImages(artist.artistName, [], {
          limit: LIMIT,
          page,
          order: "approvals",
        });

        if (!Array.isArray(perPagePosts) || perPagePosts.length === 0) {
          console.debug(`[gallery] per-page fetch returned no posts for ${artist.artistName}`);
          zoomTotalPages = page - 1;
          return;
        }

        const start = posts.length;
        posts = posts.concat(perPagePosts);
        try { setWithTTL(allPostsCacheKey, posts, DEFAULT_ALLPOSTS_TTL_MS); } catch(e) {}

        renderThumbs(perPagePosts, start);
        page++;
        return;
      }

      
    } finally {
      loading = false;
    }
  }

  function renderThumbs(list, startIndex) {
    list.forEach((raw, idx) => {
      const url = buildImageUrl(raw.preview_file_url || raw.large_file_url || raw.file_url);
      if (!url) return;
      const thumb = document.createElement("img");
      thumb.src = url;
      thumb.loading = "lazy";
      thumb.className = "artist-thumb";
      thumb.style.width = "100%";
      thumb.style.height = "100%";
      // Default cover behavior. We'll attempt to bias/center on faces below.
      thumb.style.objectFit = "cover";
      thumb.style.objectPosition = "center center";

      // Face-aware centering: use the browser FaceDetector API when available
      // for reliable face bounding boxes. Fallback to an upward bias (center
      // 30%) so faces that are in the upper area of illustrations are more
      // likely to be visible in the cropped preview.
      const applyUpwardBias = () => {
        // move framing slightly upwards which commonly shows faces in portraits
        thumb.style.objectPosition = 'center 30%';
      };

      const runFaceDetection = async () => {
        // If the FaceDetector API is available, run it on the loaded image.
        if (typeof FaceDetector !== 'undefined') {
          try {
            // Ensure the image is loaded before detecting
            if (!thumb.complete) await new Promise((res) => { thumb.onload = res; thumb.onerror = res; });
            const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            const faces = await detector.detect(thumb);
            if (faces && faces.length > 0) {
              const face = faces[0].boundingBox; // x, y, width, height
              // Compute center of face in percentage coordinates
              const cx = (face.x + face.width / 2) / thumb.naturalWidth * 100;
              const cy = (face.y + face.height / 2) / thumb.naturalHeight * 100;
              // Set object-position so the face center lines up in the thumbnail
              thumb.style.objectPosition = `${Math.round(cx)}% ${Math.round(cy)}%`;
              return;
            }
          } catch (e) {
            // FaceDetector may throw on some images/browsers — fallback below
          }
        }
        // If FaceDetector not available or failed, apply upward bias
        applyUpwardBias();
      };

      // Apply persisted object-position if available (per-artist)
      try {
        const artistName = raw?.artist || raw?.tag_string?.split && raw?.tag_string[0];
        const cacheKey = artistName ? `objpos-${artistName}` : null;
        const persisted = cacheKey ? localStorage.getItem(cacheKey) : null;
        if (persisted) {
          thumb.style.objectPosition = persisted;
        }
      } catch (e) {}

      // Schedule non-blocking detection after insertion so it doesn't stall rendering
      setTimeout(() => { void runFaceDetection(); }, 10);

      // Ensure the faceObserver will observe this thumbnail to persist results
      try {
        const fobs = initFaceObserver();
        if (fobs) fobs.observe(thumb);
      } catch (e) {}
      const index = startIndex + idx;
      thumb.addEventListener("click", () => {
        currentIndex = index;
        showZoom(index);
      });
      grid.insertBefore(thumb, sentinel);
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadPage();
        }
      });
    },
    { root: grid, rootMargin: "0px", threshold: 0.1 }
  );

  observer.observe(sentinel);

  function showZoom(index) {
    grid.style.display = "none";
    zoomContent.style.display = "flex";
    backBtn.style.display = "block";
    showPost(index);
  }

  function showPost(index) {
    const raw = posts[index];
    if (!raw) return;
    const full = buildImageUrl(raw.large_file_url || raw.file_url);
    const preview = buildImageUrl(raw.preview_file_url || raw.large_file_url || raw.file_url);
    zoomed.style.opacity = "0.5";
    zoomed.src = preview;
    zoomed.onload = () => {
      zoomed.onload = null;
      zoomed.src = full;
      zoomed.style.opacity = "1";
    };
    if (tagList) {
      tagList.innerHTML = "";
      if (raw.tag_string) {
        raw.tag_string.split(" ").forEach((t) => {
          if (!t) return;
          const pill = document.createElement("span");
          pill.className = "zoom-tag-pill";
          pill.textContent = t.replace(/_/g, " ");
          tagList.appendChild(pill);
        });
        tagList.style.display = "flex";
      } else {
        tagList.style.display = "none";
      }
    }
    if (topTags) topTags.style.display = "none";
  }

  prevBtn.addEventListener("click", () => {
    if (posts.length === 0) return;
    currentIndex = (currentIndex - 1 + posts.length) % posts.length;
    showPost(currentIndex);
  });

  nextBtn.addEventListener("click", async () => {
    if (currentIndex === posts.length - 1 && page <= zoomTotalPages) {
      await loadPage();
    }
    if (currentIndex < posts.length - 1) {
      currentIndex++;
      showPost(currentIndex);
    }
  });

  if (wrapper && !wrapper.querySelector('.zoom-toolbar')) {
    const content = wrapper.querySelector('.zoom-content') || wrapper;
    const toolbar = document.createElement('div');
    toolbar.className = 'zoom-toolbar';

    const focusBtn = document.createElement('button');
    focusBtn.type = 'button';
    focusBtn.className = 'zoom-tool';
    focusBtn.textContent = 'Focus';
    focusBtn.title = 'Toggle focus mode';
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFocused = wrapper.classList.toggle('zoom-focus-mode');
      focusBtn.setAttribute('aria-pressed', String(isFocused));
    });

    const tagsBtn = document.createElement('button');
    tagsBtn.type = 'button';
    tagsBtn.className = 'zoom-tool';
    tagsBtn.textContent = 'Tags';
    tagsBtn.title = 'Show/hide tags';
    tagsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = wrapper.classList.toggle('hide-tags');
      tagsBtn.setAttribute('aria-pressed', String(!hidden));
    });

    const danbooruBtn = document.createElement('button');
    danbooruBtn.type = 'button';
    danbooruBtn.className = 'zoom-tool';
    danbooruBtn.title = 'Open on Danbooru (order:approval)';
    danbooruBtn.innerHTML = 'Go to Danbooru';
    danbooruBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openArtistOnDanbooru(artist);
    });

    toolbar.appendChild(focusBtn);
    toolbar.appendChild(tagsBtn);
    toolbar.appendChild(danbooruBtn);
    content.appendChild(toolbar);
  }

  // Removed taunt overlay - no longer needed

  await loadPage();

  async function ensureInitialDepth(maxExtraLoads = 2) {
    if (!grid) return;
    let attempts = 0;
    while (
      attempts < maxExtraLoads &&
      page <= zoomTotalPages &&
      grid.scrollHeight <= grid.clientHeight + 48
    ) {
      await loadPage();
      attempts += 1;
    }
  }

  await ensureInitialDepth();
} // end openArtistZoom

/**
 * Returns a copy of the currently filtered artists.
 */
function getFilteredArtists() {
  return filtered.slice();
}

/**
 * Sets the number of artists to show per page.
 */
function setArtistsPerPage(count) {
  const numeric = Number(count);
  const safeCount = Number.isFinite(numeric)
    ? Math.max(1, Math.floor(numeric))
    : DEFAULT_ARTISTS_PER_PAGE;
  pagination.perPage = Math.max(10, safeCount);
  updatePaginationTotals();
  setCurrentPage(1);
  renderArtistsPage({ force: true });
}

/**
 * Renders the current page of artists, with pagination.
 */
function renderArtistsPage(options = {}) {
  if (!artistGallery) return;
  const { force = false, direction = "forward" } = options;
  const normalizedDirection =
    direction === "backward" ? "backward" : "forward";

  if (force) {
    artistGallery.innerHTML = "";
    resetGallerySentinel();
    ensureGalleryStartSentinel();
    resetVirtualState();
    renderedPages.clear();
  }

  removeGalleryEmptyState();

  if (filtered.length === 0) {
    showGalleryEmptyState();
    updatePaginationSnapshot();
    return;
  }

  ensureGalleryStartSentinel();
  ensureGallerySentinel();

  let rendered = false;

  if (force) {
    rendered = appendVirtualChunk(0);
    ensureViewportCoverage();
  } else if (normalizedDirection === "backward") {
    rendered = prependVirtualChunk();
    trimVirtualChunks("forward");
  } else {
    rendered = appendVirtualChunk();
    trimVirtualChunks("backward");
  }

  if (!rendered && virtualState.chunks.length === 0) {
    rendered = appendVirtualChunk(0);
  }

  if (rendered) {
    triggerGalleryHumiliationPatch();
  }

  ensureViewportCoverage();
  updatePaginationSnapshot();

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => primeVisibleArtistImages());
  } else {
    primeVisibleArtistImages();
  }

  setTimeout(() => enhanceGalleryImages(), 50);
}

// Intersection observer for lazy loading images
let imageObserver = null;

// Face detection observer: run detect+persist when thumbnails enter viewport
let faceObserver = null;
let DEV_FACE_OVERLAY = false;

// LRU-backed storage for objpos entries to avoid unbounded localStorage growth
const OBJPOS_LRU_KEY = 'objpos-lru-list';
const OBJPOS_LRU_LIMIT = 1000; // cap entries

function readObjposLRU() {
  try {
    const raw = localStorage.getItem(OBJPOS_LRU_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [];
}

function writeObjposLRU(list) {
  try {
    if (!Array.isArray(list)) list = [];
    // trim to limit
    if (list.length > OBJPOS_LRU_LIMIT) list = list.slice(0, OBJPOS_LRU_LIMIT);
    localStorage.setItem(OBJPOS_LRU_KEY, JSON.stringify(list));
  } catch (e) {}
}

function lruSetObjpos(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    return;
  }
  try {
    const list = readObjposLRU();
    const idx = list.indexOf(key);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(key);
    // Evict if over limit
    while (list.length > OBJPOS_LRU_LIMIT) {
      const removed = list.pop();
      try { localStorage.removeItem(removed); } catch (e) {}
    }
    writeObjposLRU(list);
  } catch (e) {}
}

function lruRemoveObjpos(key) {
  try { localStorage.removeItem(key); } catch (e) {}
  try {
    const list = readObjposLRU();
    const idx = list.indexOf(key);
    if (idx !== -1) {
      list.splice(idx, 1);
      writeObjposLRU(list);
    }
  } catch (e) {}
}

function initFaceObserver() {
  if (faceObserver) return faceObserver;
  if (typeof IntersectionObserver !== 'function') return null;
  faceObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      try { faceObserver.unobserve(img); } catch {}
      // Skip if already has persisted object-position for this post or artist
      const postId = img.dataset.postId;
      if (postId) {
        const key = `objpos-post-${postId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          img.style.objectPosition = stored;
          return;
        }
      } else {
        const artist = img.__artistData;
        if (artist && artist.artistName) {
          const key = `objpos-${artist.artistName}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            img.style.objectPosition = stored;
            return;
          }
        }
      }
      // run detection and persist result
      runFaceDetectAndPersist(img).catch(() => {});
    });
  }, { root: null, rootMargin: '200px', threshold: 0.01 });
  return faceObserver;
}

function initImageObserver() {
  if (imageObserver) return imageObserver;

  imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          loadArtistImage(img);
          imageObserver.unobserve(img);
        }
      });
    },
    {
      root: null,
      rootMargin: IMAGE_OBSERVER_ROOT_MARGIN,
      threshold: IMAGE_OBSERVER_THRESHOLD,
    }
  );

  return imageObserver;
}

// Helper to render a list of artists using the normal card structure
function renderArtistCards(artists, selectedTagsOverride, options = 1) {
  if (!artistGallery) return;
  const config =
    typeof options === "number"
      ? { chunkId: options }
      : options && typeof options === "object"
      ? options
      : { chunkId: 1 };
  const rawChunkId = config.chunkId ?? config.pageNumber ?? 1;
  const chunkId = Number.isFinite(Number(rawChunkId))
    ? Number(rawChunkId)
    : 1;
  const targetElement =
    config && config.target instanceof Element ? config.target : artistGallery;
  const annotatePage = config.annotatePage !== false;
  const eagerRequested = config.eager === true;

  if (chunkId > 0 && renderedPages.has(chunkId) && targetElement === artistGallery) {
    removePageFromDom(chunkId);
  }

  // Inject image quality CSS if not already done
  injectImageQualityCss();

  const frag = document.createDocumentFragment();
  const eagerBudget = (eagerRequested || chunkId === 1) ? DEFAULT_EAGER_IMAGE_COUNT : 0;
  let eagerTokens = eagerBudget;
  const selectedTags =
    selectedTagsOverride || (getActiveTags ? Array.from(getActiveTags()) : []);
  initImageObserver();
  
  artists.forEach((artist) => {
    const card = document.createElement("div");
    card.className = "artist-card group";
    card.tabIndex = 0; // Enable keyboard focus
    if (annotatePage) {
      card.dataset.page = String(chunkId);
    } else {
      try {
        card.dataset.page = String(chunkId);
      } catch (error) {
        // Ignore dataset assignment errors
      }
    }
    card.dataset.virtualChunk = String(chunkId);
    card.setAttribute("data-artist", artist.artistName);
    const artistSlug = getArtistSlug(artist.artistName);
    if (artistSlug) {
      card.dataset.artistSlug = artistSlug;
    }

    const img = document.createElement("img");
    img.className = "artist-image";
    img.loading = "lazy";
    try {
      img.decoding = "async";
    } catch (error) {
      // Ignore decoding hint failures
    }
    if ("fetchPriority" in img) {
      try {
        img.fetchPriority = chunkId === 1 ? "high" : "auto";
      } catch (error) {
        // Ignore browsers that reject fetchPriority assignment
      }
    }
    img.alt = `${artist.artistName.replace(/_/g, " ")} preview`;
    img.__artistData = artist;
    img.style.backgroundColor = "#1a1825"; // Placeholder color
    
    const cacheKey = `danbooru-image-${artist.artistName}`;
    const cachedUrl = localStorage.getItem(cacheKey);
    if (cachedUrl) {
      // If we have a cached URL, use it immediately
      img.src = cachedUrl;
      img.style.display = "block";
      img.onerror = () => {
        img.src = FALLBACK_IMAGE_URL;
        img.style.display = "block";
      };
    } else {
      // Use intersection observer for lazy loading
      if (eagerTokens > 0) {
        eagerTokens -= 1;
        setBestImage(artist, img);
      } else {
        lazyLoadBestImage(artist, img);
      }
      img.style.display = "block";
    }
    const media = document.createElement("div");
    media.className = "artist-media";
    media.style.cursor = "pointer";

    // Favorite Heart Icon
    const heart = document.createElement("div");
    heart.className = "artist-heart";
    heart.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>`;
    
    if (isFavorite(artist.artistName)) {
      heart.classList.add("is-favorite");
    }

    // Heart click handler (toggle favorite without zooming)
    heart.addEventListener("click", (e) => {
      e.stopPropagation();
      const isFav = toggleFavorite(artist.artistName);
      if (isFav) {
        heart.classList.add("is-favorite");
        showToast(`Added ${artist.artistName} to favorites`);
      } else {
        heart.classList.remove("is-favorite");
        showToast(`Removed ${artist.artistName} from favorites`);
      }
    });

    media.appendChild(heart);
    media.appendChild(img);
    
    // Add click handler to media container for better reliability
    media.addEventListener("click", (e) => {
      e.stopPropagation();
      openArtistZoom(artist);
    });

    // Double-click to favorite
    media.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isFav = toggleFavorite(artist.artistName);
      if (isFav) {
        heart.classList.add("is-favorite");
        showToast(`Added ${artist.artistName} to favorites`);
      } else {
        heart.classList.remove("is-favorite");
        showToast(`Removed ${artist.artistName} from favorites`);
      }
    });

    // Hover Slideshow
    let slideshowTimer = null;
    let slideshowInterval = null;

    media.addEventListener("mouseenter", () => {
      if (slideshowTimer) clearTimeout(slideshowTimer);
      
      // Save original src if not already saved (and if it's not a placeholder)
      if (!img._originalSrc && img.src && !img.src.includes('data:image')) {
        img._originalSrc = img.src;
      }

      slideshowTimer = setTimeout(async () => {
        // If we don't have images yet, fetch them
        if (!artist._slideshowImages) {
          try {
            // Fetch a few images for the slideshow using preview mode (faster)
            const posts = await queueFetchArtistImages(artist.artistName, [], { limit: 6, order: 'score' }, true);
            artist._slideshowImages = posts
              .map(p => p.preview_file_url || p.large_file_url || p.file_url)
              .filter(Boolean);
          } catch (e) {
            // console.warn("Slideshow fetch failed for", artist.artistName, e);
            artist._slideshowImages = []; // Prevent retry loop
          }
        }

        if (artist._slideshowImages && artist._slideshowImages.length > 1) {
          let idx = 0;
          slideshowInterval = setInterval(() => {
            idx = (idx + 1) % artist._slideshowImages.length;
            const nextUrl = artist._slideshowImages[idx];
            if (nextUrl) img.src = nextUrl;
          }, 1200);
        }
      }, 600); // 600ms delay to prevent accidental triggers during scroll
    });

    media.addEventListener("mouseleave", () => {
      if (slideshowTimer) clearTimeout(slideshowTimer);
      if (slideshowInterval) clearInterval(slideshowInterval);
      slideshowTimer = null;
      slideshowInterval = null;
      
      // Restore original image
      if (img._originalSrc) {
        img.src = img._originalSrc;
      }
    });

    const name = document.createElement("div");
    name.className = "artist-name";
    let displayName = artist.artistName.replace(/_/g, " ");
    const total =
      typeof artist.postCount === "number" ? artist.postCount : undefined;
    if (typeof total === "number") {
      displayName += ` [${total}]`;
    }
    const nameLink = document.createElement("a");
    nameLink.textContent = displayName;
    nameLink.href = `../artist/[id]/?slug=${encodeURIComponent(artistSlug || '')}`;
    nameLink.className = "artist-name-link";
    nameLink.setAttribute('data-router-link', '');
    nameLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    name.appendChild(nameLink);

    const taglist = document.createElement("div");
    taglist.className = "artist-tags";
    const tagsId = `tags-${artist.artistName
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()}`;
    taglist.id = tagsId;
    taglist.hidden = true;
    if (artist.kinkTags && artist.kinkTags.length > 0) {
      artist.kinkTags.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "gallery-tag";
        tagEl.textContent = tag.replace(/_/g, " ");
        taglist.appendChild(tagEl);
      });
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-button";
    copyBtn.setAttribute("aria-label", "Copy artist name");
    copyBtn.textContent = "📋";
    copyBtn.title = "Copy name";
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      handleArtistCopy(artist, img.src);
    };

    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.className = "reload-button";
    reloadBtn.setAttribute("aria-label", "Reload artist");
    reloadBtn.textContent = "⟳";
    reloadBtn.title = "Reload artist images/count";
    reloadBtn.addEventListener("click", async (e) => {
      // Prevent any default browser action and stop event bubbling so
      // the UI doesn't shift focus or change the URL/hash which can
      // cause the page to jump to the top.
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

      // Remember current scroll position so we can restore it after
      // we refresh the artist data. This avoids the page jumping to
      // the top when the gallery is re-rendered.
      const prevScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };

      if (typeof clearArtistCache === "function") {
        clearArtistCache(artist.artistName);
      }
      const cacheKey = `allPosts-${artist.artistName}-${selectedTags.join(",")}`;
      if (typeof removeWithTTL === 'function') removeWithTTL(cacheKey);
      localStorage.removeItem(`danbooru-image-${artist.artistName}`);
      artist._imageCount = undefined;
      artist._totalImageCount = undefined;
      artist._tagMatchCount = undefined;
      name.textContent = artist.artistName.replace(/_/g, " ") + " [Loading…]";

      // Re-render but then restore scroll position. Use a short timeout
      // to let the DOM updates settle before restoring scroll.
      setTimeout(() => {
        if (typeof filterArtists === "function") {
          // Use the force=true flag to update counts but avoid resetting
          // the pagination to the top unless a full reset is required.
          filterArtists(false, true).then(() => {
            // Restore scroll position after render completes
            try { window.scrollTo(prevScroll.x, prevScroll.y); } catch (e) {}
          }).catch(() => {
            try { window.scrollTo(prevScroll.x, prevScroll.y); } catch (e) {}
          });
        } else {
          try { window.scrollTo(prevScroll.x, prevScroll.y); } catch (e) {}
        }
      }, 50);
    });

    const tagsToggle = document.createElement("button");
    tagsToggle.type = "button";
    tagsToggle.className = "tags-toggle";
    tagsToggle.setAttribute("aria-controls", tagsId);
    tagsToggle.setAttribute("aria-expanded", "false");
    tagsToggle.title = "Show tags";
    tagsToggle.textContent = "🏷️";
    tagsToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = card.classList.toggle("show-tags");
      taglist.hidden = !willShow;
      tagsToggle.setAttribute("aria-expanded", String(willShow));
      tagsToggle.title = willShow ? "Hide tags" : "Show tags";
    });

    // Pin/Favorite button
    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "copy-button";
    const isCurrentlyFavorited = isFavorite(artist.artistName);
    pinBtn.textContent = isCurrentlyFavorited ? "⭐" : "📌";
    pinBtn.title = isCurrentlyFavorited ? "Remove from favorites" : "Add to favorites";
    pinBtn.setAttribute("aria-label", isCurrentlyFavorited ? "Remove from favorites" : "Add to favorites");
    pinBtn.style.filter = isCurrentlyFavorited ? "brightness(1.3) drop-shadow(0 0 3px gold)" : "";
    pinBtn.onclick = (e) => {
      e.stopPropagation();
      const nowFavorited = toggleFavorite(artist.artistName);
      pinBtn.textContent = nowFavorited ? "⭐" : "📌";
      pinBtn.title = nowFavorited ? "Remove from favorites" : "Add to favorites";
      pinBtn.setAttribute("aria-label", nowFavorited ? "Remove from favorites" : "Add to favorites");
      pinBtn.style.filter = nowFavorited ? "brightness(1.3) drop-shadow(0 0 3px gold)" : "";
      
      // Show toast notification
      const message = nowFavorited ? `★ ${artist.artistName} added to favorites` : `Removed ${artist.artistName} from favorites`;
      if (typeof window.showToast === 'function') {
        window.showToast(message);
      }
    };

    // Similar artists button
    const similarBtn = document.createElement("button");
    similarBtn.type = "button";
    similarBtn.className = "browse-btn";
    similarBtn.style.cssText = "padding: 0.35rem 0.75rem; font-size: 0.55rem;";
    similarBtn.textContent = "Similar";
    similarBtn.title = "Find similar artists";
    similarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSimilarArtistsModal(artist, { limit: 12, minSimilarity: 0.05 });
    });

    // Slideshow toggle button (hidden by default)
    const slideshowBtn = document.createElement("button");
    slideshowBtn.type = "button";
    slideshowBtn.className = "slideshow-toggle copy-button"; // Reuse copy-button style for consistency
    slideshowBtn.textContent = "▶️";
    slideshowBtn.title = "Toggle slideshow";
    slideshowBtn.style.display = "none"; // Hidden until we know we have multiple images
    slideshowBtn.onclick = (e) => {
      e.stopPropagation();
      if (!img.__slideshowUrls || img.__slideshowUrls.length <= 1) return;
      
      img.__manualSlideshow = !img.__manualSlideshow;
      if (img.__manualSlideshow) {
        startSlideshow(img);
        slideshowBtn.textContent = "⏸️";
        slideshowBtn.title = "Pause slideshow";
        slideshowBtn.classList.add("active");
      } else {
        stopSlideshow(img);
        slideshowBtn.textContent = "▶️";
        slideshowBtn.title = "Play slideshow";
        slideshowBtn.classList.remove("active");
      }
    };

    const actions = document.createElement("div");
    actions.className = "artist-actions";
    actions.style.display = "flex";
    actions.style.gap = "0.5rem";
    actions.style.flexWrap = "wrap";
    actions.appendChild(copyBtn);
    actions.appendChild(pinBtn);
    actions.appendChild(reloadBtn);
    actions.appendChild(similarBtn);
    actions.appendChild(slideshowBtn);
  // Profile link removed per UI update
    actions.appendChild(tagsToggle);

    const footer = document.createElement("div");
    footer.className = "artist-footer";
    footer.appendChild(name);
    footer.appendChild(taglist);
    footer.appendChild(actions);

    card.appendChild(media);
    card.appendChild(footer);
    frag.appendChild(card);
  });

  if (targetElement === artistGallery) {
    const sentinel = ensureGallerySentinel();
    if (sentinel) {
      targetElement.insertBefore(frag, sentinel);
    } else {
      targetElement.appendChild(frag);
    }
    renderedPages.add(chunkId);
  } else {
    targetElement.appendChild(frag);
  }
}

function pruneGalleryPages(currentPage) {
  if (!artistGallery) return;
  trimVirtualChunks(currentPage && currentPage < pagination.current ? "backward" : "forward");
}

function getPaginationInfo() {
  const page = getCurrentPage();
  const total = filtered.length;
  const totalPages = getTotalPages();
  const range = getVirtualRange();
  const shown = Math.min(range.end, total);
  const lastRenderedPage =
    virtualState.chunks.length > 0
      ? virtualState.chunks[virtualState.chunks.length - 1].id
      : Math.max(0, pagination.current);
  return {
    total: total,
    shown: shown,
    hasMore: totalPages > 0 && range.end < total,
    hasMoreForward: range.end < total,
    hasMoreBackward: range.start > 0,
    currentPage: page,
    artistsPerPage: artistsPerPage,
    totalPages,
    lastRenderedPage,
  };
}

function attachPaginationDebugInterface() {
  if (typeof window === "undefined") return;
  const debugAPI = {
    get info() {
      return getPaginationInfo();
    },
    get state() {
      return {
        perPage: pagination.perPage,
        current: pagination.current,
        total: pagination.total,
        totalPages: getTotalPages(),
      };
    },
    get current() {
      return getCurrentPage();
    },
    set current(value) {
      setCurrentPage(value);
      renderArtistsPage();
    },
    get perPage() {
      return pagination.perPage;
    },
    set perPage(value) {
      setArtistsPerPage(value);
    },
    reset() {
      resetPaginationState();
      renderArtistsPage({ force: true });
    },
    render(options = {}) {
      renderArtistsPage(options);
    },
  };
  window.Pagination = debugAPI;
  window.pagination = pagination;
}

attachPaginationDebugInterface();

/**
 * Filters and displays artists based on current criteria
 */
async function filterArtists(reset = true, force = false) {
  if (!artistGallery) return;
  const generation = ++filterGeneration;
  if (isFetching) {
    const existing = artistGallery.querySelector(".gallery-spinner");
    if (!existing) {
      artistGallery.appendChild(createSpinner());
    }
  }

  let spinner;
  try {
    if (reset) {
      resetPaginationState();
      artistGallery.innerHTML = "";
      resetGallerySentinel();
      renderedPages.clear();
    }

    spinner = artistGallery.querySelector(".gallery-spinner");
    if (!spinner) {
      spinner = createSpinner();
      artistGallery.appendChild(spinner);
    } else if (!spinner.updateProgress) {
      spinner.remove();
      spinner = createSpinner();
      artistGallery.appendChild(spinner);
    }

    isFetching = true;

    const activeTags = getActiveTags ? getActiveTags() : new Set();
    const rawNameFilter = getArtistNameFilter ? getArtistNameFilter() : "";
    const artistNameFilter =
      typeof rawNameFilter === "string" ? rawNameFilter.toLowerCase() : "";
    
    // Check if global search mode is enabled
    const isGlobalSearch = typeof getGlobalSearchMode === "function" && getGlobalSearchMode();
    
    let sourceArtists = Array.isArray(allArtists) ? allArtists : [];
    
    // If in global search mode and we have active tags, fetch artists from Danbooru
    if (isGlobalSearch && activeTags.size > 0) {
      try {
        const searchTags = Array.from(activeTags);
        const searchResults = await fetchArtistsByTag(searchTags, {
          limit: 200,
          page: 1,
          order: "score",
          useCache: true,
        });
        
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          sourceArtists = searchResults;
        } else {
          // No results from search, show empty state
          sourceArtists = [];
        }
      } catch (error) {
        console.warn("Global search failed, falling back to curated list:", error);
        // Fall back to curated list on error
      }
    }
    
    pendingMostCommonTag = computeMostCommonActiveTag(activeTags, sourceArtists);

    if (!force) {
      countsReadyForActiveFilter = false;
      requestedCountSortMode = requiresCountBasedData(sortMode) ? sortMode : null;
    }

    if (activeTags.size === 0) {
      filtered = sourceArtists.filter((artist) => {
        if (!artist) return false;
        const name = artist.artistName || "";
        return (
          artistNameFilter === "" ||
          name.toLowerCase().includes(artistNameFilter)
        );
      });
    } else {
      // In global search mode, we already have filtered results from API
      // Just apply name filter if needed
      if (isGlobalSearch) {
        filtered = sourceArtists.filter((artist) => {
          if (!artist) return false;
          if (
            artistNameFilter &&
            !(artist.artistName || "").toLowerCase().includes(artistNameFilter)
          ) {
            return false;
          }
          return true;
        });
      } else {
        // Normal filter mode: filter from curated list
        filtered = sourceArtists.filter((artist) => {
          if (!artist) return false;
          const tags = Array.isArray(artist.kinkTags) ? artist.kinkTags : [];
          const tagMatch = Array.from(activeTags).every((tag) => tags.includes(tag));
          if (!tagMatch) return false;
          if (
            artistNameFilter &&
            !(artist.artistName || "").toLowerCase().includes(artistNameFilter)
          ) {
            return false;
          }
          return true;
        });
      }
    }

    const recalculatedTotal = updatePaginationTotals();
    const maxPage = Math.max(1, recalculatedTotal || 0);
    if (getCurrentPage() > maxPage) {
      setCurrentPage(maxPage);
    }

    if (spinner && typeof spinner.setTotal === "function") {
      spinner.setTotal(filtered.length);
    }
    if (spinner && typeof spinner.updateProgress === "function") {
      spinner.updateProgress(0);
    }

    clearArtistCountState(filtered);
    countsReadyForActiveFilter = false;

    if (!force) {
      const fallbackMode = requiresCountBasedData(sortMode) ? "name" : sortMode;
      sortCurrentArtists(filtered, fallbackMode);
      renderArtistsPage({ force: true });
      return;
    }

    const finalScrollY = window.scrollY;
    const countsLoaded = await populateArtistCounts({
      artists: filtered,
      mostCommonTag: pendingMostCommonTag,
      generation,
      spinner,
    })
      .then(() => true)
      .catch((error) => {
        console.error("Batch fetch failed:", error);
        return false;
      });

    if (generation !== filterGeneration) return;

    if (!countsLoaded) {
      countsReadyForActiveFilter = false;
      sortCurrentArtists(filtered, "name");
      renderArtistsPage({ force: true });
      window.scrollTo({ top: finalScrollY, behavior: "instant" });
      return;
    }

    countsReadyForActiveFilter = true;

    const currentModes = Array.isArray(sortMode) ? sortMode : [sortMode];
    const isDefaultName = currentModes.length === 1 && currentModes[0] === 'name';
    const hasTagFreq = currentModes.includes('tag-frequency');

    if (pendingMostCommonTag && isDefaultName) {
      console.log(
        `Auto-switching to tag-frequency sort (most common: ${pendingMostCommonTag})`
      );
      sortMode = ["tag-frequency", "name"];
      lastSortMode = sortMode;
    } else if (!pendingMostCommonTag && hasTagFreq) {
      sortMode = currentModes.filter(m => m !== "tag-frequency");
      if (sortMode.length === 0) sortMode = ["name"];
      lastSortMode = sortMode;
    }

    requestedCountSortMode = null;

    sortCurrentArtists(filtered, sortMode);
    renderArtistsPage({ force: true });
    window.scrollTo({ top: finalScrollY, behavior: "instant" });
  } catch (error) {
    console.warn("filterArtists failed", error);
  } finally {
    if (generation === filterGeneration) {
      const remaining = artistGallery.querySelector(".gallery-spinner");
      if (remaining) remaining.remove();
      isFetching = false;
    }
  }
}

let lastSortMode = null;

// Call this on gallery init
function initGallery() {
  artistGallery = document.getElementById("artist-gallery");
  backgroundBlur = document.getElementById("background-blur");
  // Patch: remember last sort mode
  const sortSelect = document.querySelector(".sort-controls select, #sort-by");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      lastSortMode = e.target.value;
    });
  }
}

function setSortMode(mode, options = {}) {
  const { preservePage = false, deferRender = false } = options;
  sortMode = Array.isArray(mode) ? mode : [mode];
  lastSortMode = sortMode;
  
  const needsCounts = requiresCountBasedData(mode);
  if (needsCounts && !countsReadyForActiveFilter) {
    requestedCountSortMode = mode;
    if (!preservePage) {
      setCurrentPage(1);
    }
    sortCurrentArtists(filtered, "name");
    if (!deferRender) {
      renderArtistsPage({ force: true });
    }
    return;
  }

  requestedCountSortMode = null;
  sortCurrentArtists(filtered, mode);
  if (!preservePage) {
    setCurrentPage(1);
  }
  if (!deferRender) {
    renderArtistsPage({ force: true });
  }
}

function forceSortAndRender() {
  if (lastSortMode) {
    setSortMode(lastSortMode, { preservePage: true, deferRender: true });
  }
  renderArtistsPage({ force: true });
}


function setAllArtists(artists) {
  if (Array.isArray(artists)) {
    allArtists = artists;
  } else {
    allArtists = [];
  }
  // Also set artists for similar-artists module
  setSimilarArtists(allArtists);
  
  // Start background fetch of style tags for all artists
  fetchStyleTagsForAllArtists();
}

/**
 * Fetch style tags for a specific list of artists
 * @param {Array} artistList - Array of artists to fetch style tags for
 * @param {Function} onProgress - Optional callback(current, total) for progress updates
 * @param {Function} shouldCancel - Optional callback that returns true if fetch should be cancelled
 */
async function fetchStyleTagsForArtistList(artistList, onProgress = null, shouldCancel = null) {
  if (!artistList || artistList.length === 0) return;
  const total = artistList.length;
  console.log(`Starting style tag fetch for ${total} artists (concurrent pool)...`);
  const CONCURRENCY = 10;
  let processed = 0;
  let index = 0;

  async function worker() {
    while (index < artistList.length) {
      // Atomically claim the next artist
      const myIndex = index++;
      if (myIndex >= artistList.length) return;
      const artist = artistList[myIndex];
      if (!artist || !artist.artistName) continue;
      if (shouldCancel && shouldCancel()) {
        console.log(`Style tag fetch cancelled at ${processed}/${total} artists`);
        return;
      }
      try {
        const styleTags = await fetchArtistStyleTags(artist.artistName, { limit: 100 });
        if (styleTags && styleTags.length > 0) {
          artist.styleTags = styleTags;
          //console.log(`Fetched ${styleTags.length} style tags for ${artist.artistName}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch style tags for ${artist.artistName}:`, error);
      }
      processed++;
      if (onProgress) onProgress(processed, total);
      // Don't call setSimilarArtists here - it's called once at the end
    }
  }

  // Launch a pool of CONCURRENCY workers
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Update similar artists once after all fetching is complete
  setSimilarArtists(allArtists);
  
  console.log('Style tag fetch complete');
  if (onProgress) onProgress(total, total);
}

/**
 * Fetch style tags for all artists in the background
 * This runs slowly over time to avoid overwhelming the API
 * @param {Function} onProgress - Optional callback(current, total) for progress updates
 * @param {Function} shouldCancel - Optional callback that returns true if fetch should be cancelled
 */
async function fetchStyleTagsForAllArtists(onProgress = null, shouldCancel = null) {
  return fetchStyleTagsForArtistList(allArtists, onProgress, shouldCancel);
}

/**
 * Force fetch style tags for currently filtered artists with UI feedback
 * This is the user-triggered version with progress display
 */
export async function forceFetchStyleTags(options = {}) {
  const { refreshCounts = false } = options ?? {};
  const {
    showForceFetchOverlay,
    updateForceFetchProgress,
    showFetchComplete,
    hideForceFetchOverlay,
    isCancelRequested,
    setForceFetchTaunt,
  } = await import('./force-fetch-ui.js');

  // Use filtered artists (those matching current tags), not all artists
  let artistsToFetch = filtered.length > 0 ? filtered : allArtists;
  let hasFilters = filtered.length > 0;

  if (!artistsToFetch || artistsToFetch.length === 0) {
    alert('No artists to fetch. Please wait for the gallery to load.');
    return;
  }

  // Show the overlay immediately with the current count
  showForceFetchOverlay(artistsToFetch.length);

  // Ensure the overlay paints before continuing
  await new Promise((resolve) => requestAnimationFrame(resolve));

  if (refreshCounts) {
    try {
      setForceFetchTaunt('Tightening your filters before I indulge you…', {
        tone: 'info',
        holdMs: 3600,
      });
      await filterArtists(false, true);
      artistsToFetch = filtered.length > 0 ? filtered : allArtists;
      hasFilters = filtered.length > 0;

      if (!artistsToFetch || artistsToFetch.length === 0) {
        setForceFetchTaunt('Your precious list is empty. Loosen those tags.', {
          tone: 'warning',
          holdMs: 4200,
        });
        hideForceFetchOverlay();
        return;
      }

      // Reset progress with the refreshed totals
      updateForceFetchProgress(0, artistsToFetch.length);
    } catch (error) {
      console.warn('Failed to refresh counts before force fetch:', error);
      setForceFetchTaunt('Fine. I will fetch without your tidy counts.', {
        tone: 'warning',
        holdMs: 3600,
      });
    }

    // Allow a frame for the status change before heavy work resumes
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  const totalCount = artistsToFetch.length;

  console.log(`Force fetching style tags for ${totalCount} ${hasFilters ? 'filtered' : 'total'} artists...`);

  setForceFetchTaunt(
    hasFilters
      ? 'Counting every filtered indulgence you demanded…'
      : 'All of them? Greedy. I’ll fetch them all.',
    { tone: 'info', holdMs: 2800 }
  );

  try {
    await fetchStyleTagsForArtistList(
      artistsToFetch,
      (current, total) => {
        updateForceFetchProgress(current, total);
      },
      () => isCancelRequested()
    );

    if (isCancelRequested()) {
      hideForceFetchOverlay();
      console.log('Style tag fetch cancelled by user');
      return;
    }

    setForceFetchTaunt('Processing results… Try not to squirm.', {
      tone: 'info',
      holdMs: 3200,
    });

    // Give UI time to update before sorting
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (sortMode === 'tag-frequency' || sortMode === 'count') {
      forceSortAndRender();
    }

    showFetchComplete(totalCount);
  } catch (error) {
    console.error('Force fetch failed:', error);
    hideForceFetchOverlay();
    alert('Failed to fetch style tags. Check console for details.');
  }
}

function setGetActiveTagsCallback(callback) {
  getActiveTags = callback;
  getActiveTagsCallbackFn = callback;
}

/**
 * Sets the callback to get artist name filter
 */
function setGetArtistNameFilterCallback(callback) {
  getArtistNameFilter = callback;
  getArtistNameFilterCallbackFn = callback;
}

function setSortPreference(preference) {
  const mode = preference === "count" ? "count" : "name";
  if (mode === sortMode) return;
  setSortMode(mode);
}


// Removed taunt overlay functions - no longer needed

function buildDanbooruArtistUrl(artistName) {
  if (!artistName) return "https://danbooru.donmai.us/posts";
  const q = encodeURIComponent(String(artistName).trim().replace(/\s+/g, "_"));
  return `https://danbooru.donmai.us/posts?tags=${q}+order%3Aapproval`;
}

function openArtistOnDanbooru(artist) {
  const name = typeof artist === "string" ? artist : artist?.artistName;
  const url = buildDanbooruArtistUrl(name);
  try { window.open(url, "_blank", "noopener"); } catch (_) { location.href = url; }
}

// --- EXPORTS ---
/**
 * Filter gallery to show only favorited artists
 */
async function filterGalleryToFavorites() {
  const { filterToFavorites, getFavoritesCount } = await import('./favorites.js');
  
  if (getFavoritesCount() === 0) {
    console.warn('No favorite artists to filter');
    return;
  }
  
  // Filter the current artist list to favorites only
  filtered = filterToFavorites(allArtists);
  
  // Reset pagination and re-render
  currentPage = 1;
  renderedPages.clear();
  totalPages = Math.ceil(filtered.length / artistsPerPage);
  pagination.current = 1;
  pagination.total = totalPages;
  
  renderArtistsPage({ force: true });
  
  console.log(`Filtered to ${filtered.length} favorite artists`);
}

/**
 * Clear favorites filter and show all artists
 */
async function clearGalleryFilters() {
  // Re-run the normal filter logic to restore the filtered state
  const activeTagsFn = getActiveTagsCallbackFn || getActiveTags;
  const artistNameFilterFn = getArtistNameFilterCallbackFn || getArtistNameFilter;

  if (typeof activeTagsFn === 'function' || typeof artistNameFilterFn === 'function') {
    const activeTags = typeof activeTagsFn === 'function' ? activeTagsFn() : [];
    const nameFilter = typeof artistNameFilterFn === 'function' ? artistNameFilterFn() : '';
    filterArtists(activeTags, nameFilter);
  } else {
    // Fallback: show all artists
    filtered = [...allArtists];
    currentPage = 1;
    renderedPages.clear();
    totalPages = Math.ceil(filtered.length / artistsPerPage);
    pagination.current = 1;
    pagination.total = totalPages;
    renderArtistsPage({ force: true });
  }

  console.log('Cleared favorites filter');
}

export {
  getCurrentPage,
  setCurrentPage,
  getThumbnailUrl,
  initGallery,
  filterArtists,
  renderArtistsPage,
  openArtistZoom,
  setSortPreference,
  forceSortAndRender,
  setRandomBackground,
  setAllArtists,
  setGetActiveTagsCallback,
  setGetArtistNameFilterCallback,
  setSortMode,
  reshuffleArtists,
  getPaginationInfo,
  getFilteredArtists,
  setArtistsPerPage,
  openArtistOnDanbooru,
  enhanceGalleryImages,
  filterGalleryToFavorites,
  clearGalleryFilters
};
// Note: forceFetchStyleTags is exported inline on line ~1692

// Testing helper: center a supplied image element on detected face or apply bias.
async function _test_centerFaceInThumb(imgEl) {
  if (!imgEl) throw new Error('imgEl required');
  // reuse face-detection logic from renderThumbs but operate on provided element
  const applyUpwardBias = () => { imgEl.style.objectPosition = 'center 30%'; };
  const runFaceDetection = async () => {
    if (typeof FaceDetector !== 'undefined') {
      try {
        if (!imgEl.complete) await new Promise((res) => { imgEl.onload = res; imgEl.onerror = res; });
        const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await detector.detect(imgEl);
        if (faces && faces.length > 0) {
          const face = faces[0].boundingBox;
          const cx = (face.x + face.width / 2) / imgEl.naturalWidth * 100;
          const cy = (face.y + face.height / 2) / imgEl.naturalHeight * 100;
          imgEl.style.objectPosition = `${Math.round(cx)}% ${Math.round(cy)}%`;
          return;
        }
      } catch (e) {}
    }
    applyUpwardBias();
  };
  await runFaceDetection();
}

export { _test_centerFaceInThumb };

// Run face detection on an image, persist object-position, and optionally draw overlay
async function runFaceDetectAndPersist(img) {
  if (!img) return;
  const applyUpwardBias = () => { img.style.objectPosition = 'center 30%'; };
  try {
    if (typeof FaceDetector !== 'undefined') {
      if (!img.complete) await new Promise((res) => { img.onload = res; img.onerror = res; });
      const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(img);
      if (faces && faces.length > 0) {
        const face = faces[0].boundingBox;
        const cx = (face.x + face.width / 2) / img.naturalWidth * 100;
        const cy = (face.y + face.height / 2) / img.naturalHeight * 100;
        const pos = `${Math.round(cx)}% ${Math.round(cy)}%`;
        img.style.objectPosition = pos;
        // persist per-post if available, otherwise per-artist as fallback
        const postId = img.dataset.postId;
        if (postId) {
          try { lruSetObjpos(`objpos-post-${postId}`, pos); } catch {}
        } else {
          const artist = img.__artistData;
          if (artist && artist.artistName) {
            try { lruSetObjpos(`objpos-${artist.artistName}`, pos); } catch {}
          }
        }
        if (DEV_FACE_OVERLAY) drawFaceOverlay(img, face);
        return pos;
      }
    }
  } catch (e) {
    // detection error -- fallthrough to bias
  }
  applyUpwardBias();
  return img.style.objectPosition;
}

function drawFaceOverlay(img, box) {
  try {
    // Create overlay container inside the thumbnail wrapper
    const wrap = img.parentElement || img;
    let overlay = wrap.querySelector && wrap.querySelector('.face-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'face-overlay';
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.boxSizing = 'border-box';
      overlay.style.zIndex = '2';
      if (wrap.style.position === '' || wrap.style.position === 'static') {
        wrap.style.position = 'relative';
      }
      wrap.appendChild(overlay);
    }
    overlay.innerHTML = '';
    const rect = document.createElement('div');
    rect.style.position = 'absolute';
    rect.style.border = '2px solid rgba(255,0,128,0.85)';
    rect.style.background = 'rgba(255,0,128,0.12)';
    // compute box relative to natural size and map to element
    const sx = img.naturalWidth ? img.naturalWidth : img.width;
    const sy = img.naturalHeight ? img.naturalHeight : img.height;
    const left = (box.x / sx) * 100;
    const top = (box.y / sy) * 100;
    const w = (box.width / sx) * 100;
    const h = (box.height / sy) * 100;
    rect.style.left = `${left}%`;
    rect.style.top = `${top}%`;
    rect.style.width = `${w}%`;
    rect.style.height = `${h}%`;
    overlay.appendChild(rect);
  } catch (e) {}
}

function setDevFaceOverlay(enabled) {
  DEV_FACE_OVERLAY = Boolean(enabled);
}

function clearPersistedObjposForArtist(artistName) {
  try { lruRemoveObjpos(`objpos-${artistName}`); } catch {}
}

// Export controls
export { setDevFaceOverlay, clearPersistedObjposForArtist };

function clearPersistedObjposForPost(postId) {
  try { lruRemoveObjpos(`objpos-post-${postId}`); } catch {}
}

export { clearPersistedObjposForPost };

// Helpers to inspect and clear the per-artist fullscreen cache
function getArtistAllPostsCache(artistName, tags = []) {
  try {
    const key = `allPosts-${artistName}-${tags.join(",")}`;
    return getWithTTL ? getWithTTL(key) : null;
  } catch (e) {
    return null;
  }
}

function clearArtistAllPostsCache(artistName, tags = []) {
  try {
    const key = `allPosts-${artistName}-${tags.join(",")}`;
    if (typeof removeWithTTL === 'function') removeWithTTL(key);
  } catch (e) {}
}

export { getArtistAllPostsCache, clearArtistAllPostsCache, DEFAULT_ALLPOSTS_TTL_MS, setAllPostsTTL, expireAllPostsCaches };
// Keyboard Navigation
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    // Only handle if no modal/overlay is open (simple check)
    if (document.querySelector(".fullscreen-viewer.open")) return;
    
    // If search input is focused, don't interfere
    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA") return;
      
    }

    const active = document.activeElement;
    if (!active || !active.classList.contains("artist-card")) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = active.nextElementSibling;
      if (next && next.classList.contains("artist-card")) next.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = active.previousElementSibling;
      if (prev && prev.classList.contains("artist-card")) prev.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Trigger the click on the media element
      const media = active.querySelector(".artist-media");
      if (media) media.click();
    }
  });
}
