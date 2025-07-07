/**
 * API module - Handles Danbooru API interactions and caching
 */

// Use the global fetch implementation (available in modern browsers and Node 18+)
const fetchFn = fetch;

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
    limit = 1000,
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
    console.warn("Failed to get random background:", error);
    return null;
  }
}

/**
 * Fetches artist image data with caching
 */
async function fetchArtistImages(artistName, selectedTags = []) {
  const apiCacheKey = `danbooru-api-${artistName}-${selectedTags.join(",")}`;

  const posts = await fetchPosts(artistName, {
    cacheKey: apiCacheKey,
    limit: 1000,
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
      const response = await fetchFn("artists.json");
      artistsCache = await response.json();
    }
  } catch (e) {
    console.warn("Failed to load artists.json:", e);
    artistsCache = [];
  }
  return artistsCache;
}

export async function getArtistImageCount(
  artistName,
  options = {}
) {
  const { forceFetch = false } = options;
  if (!forceFetch) {
    const artists = await loadArtists();
    const artist = artists.find((a) => a.artistName === artistName);
    if (artist && typeof artist.postCount === "number") {
      return artist.postCount;
    }
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
    // If the returned count seems unreasonably high, treat as a failure
    if (typeof count === "number" && count < 1_000_000) {
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
    const [artists, tooltips, generalTaunts, tagTaunts] = await Promise.all([
      fetchFn("artists.json").then((r) => r.json()),
      fetchFn("tag-tooltips.json").then((r) => r.json()),
      fetchFn("taunts.json").then((r) => r.json()),
      fetchFn("tag-taunts.json").then((r) => r.json()),
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

// Export functions for ES modules
export {
  postHasAllTags,
  buildImageUrl,
  fetchPosts,
  filterValidImagePosts,
  getRandomBackgroundImage,
  fetchArtistImages,
  clearArtistCache,
  loadAppData,
};

