/**
 * API module - Handles Danbooru API interactions and caching
 */

// Use the global fetch implementation (available in modern browsers and Node 18+)
const fetchFn = fetch;

import { fetchWithCache } from "./fetch-cache.js";

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

  const tagsParam = Array.isArray(tags) ? tags.join(" ") : tags;
  const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(
    tagsParam
  )}+order:${order}&limit=${limit}&page=${page}`;

  try {
    const response = await fetchFn(url);
    const data = await response.json();

    // Cache the result if enabled
    if (useCache && cacheKey && Array.isArray(data)) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // Cache quota exceeded, ignore
      }
    }

    return Array.isArray(data) ? data : [];
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
  const apiCacheKey = `danbooru-api-${artistName}-${selectedTags.join(",")}`;
  const posts = await fetchPosts(artistName, {
    cacheKey: apiCacheKey,
    limit: options.limit || 200,
    page: options.page || 1,
  });
  return filterValidImagePosts(posts, selectedTags);
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
    const resp = await fetchFn(
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
  const MAX_PAGES = options.maxPages || 40; // 40 pages x 200 = 8000 max
  const LIMIT = 200;
  // First, fetch the first page to get total count
  const firstPage = await fetchArtistImages(artistName, selectedTags, {
    limit: LIMIT,
    page: 1,
  });
  if (!firstPage || firstPage.length === 0) return [];
  // Estimate total pages
  let totalPages = MAX_PAGES;
  if (firstPage.length === LIMIT) {
    // Try to get total count from API
    try {
      const count = await getArtistImageCount(artistName);
      totalPages = Math.min(MAX_PAGES, Math.ceil(count / LIMIT));
    } catch {}
  } else {
    totalPages = 1;
  }
  // Fetch all pages in parallel
  const pagePromises = [];
  for (let page = 2; page <= totalPages; page++) {
    pagePromises.push(
      fetchArtistImages(artistName, selectedTags, { limit: LIMIT, page })
    );
  }
  const restPages = await Promise.all(pagePromises);
  let allPosts = firstPage;
  restPages.forEach((posts) => {
    if (Array.isArray(posts) && posts.length > 0) {
      allPosts = allPosts.concat(posts);
    }
  });
  return allPosts;
}

/**
 * Fetches post count for a set of tags using Danbooru's /counts/posts endpoint (HTML response)
 */
export async function fetchPostCountForTags(tags) {
  const url = `https://danbooru.donmai.us/counts/posts?tags=${tags.join("+")}`;
  const response = await fetchFn(url);
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
  fetchAllArtistImages,
  clearArtistCache,
  loadAppData,
};

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
