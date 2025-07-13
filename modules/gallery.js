/**
 * Gallery module - Handles artist gallery display and image management
 */

import { createFullscreenViewer, createSpinner } from "./ui.js";
import { fetchArtistImages, clearArtistCache, buildImageUrl } from "./api.js";
import { handleArtistCopy } from "./sidebar.js";

// Gallery state
let currentArtistPage = 0;
const artistsPerPage = 24;
let filtered = [];
let isFetching = false;
let sortMode = "name";
let filterGeneration = 0;

// DOM references
let artistGallery = null;
let backgroundBlur = null;

// External dependencies
let allArtists = [];
let getActiveTags = null;
let getArtistNameFilter = null;

// Favorites/bookmarks state
let favoriteArtists = new Set(
  JSON.parse(localStorage.getItem("favoriteArtists") || "[]")
);

// Tag combination mode state
let tagCombinationMode = localStorage.getItem("tagCombinationMode") || "AND";

/**
 * Sets the background image with a random image
 */
async function setRandomBackground() {
  if (!backgroundBlur) return;

  try {
    if (document.body.classList.contains("incognito-theme")) {
      backgroundBlur.style.backgroundImage = "none";
      backgroundBlur.style.backgroundColor = "#111";
      return;
    }

    const { getRandomBackgroundImage } = await import("./api.js");
    const imageUrl = await getRandomBackgroundImage();

    if (imageUrl) {
      backgroundBlur.style.backgroundImage = `url(${imageUrl})`;
    } else {
      backgroundBlur.style.backgroundColor = "#111";
    }
  } catch (error) {
    console.warn("Failed to set random background:", error);
    backgroundBlur.style.backgroundColor = "#111";
  }
}

/**
 * Sets the best image for an artist with caching and lazy loading
 */
function setBestImage(artist, img) {
  const cacheKey = `danbooru-image-${artist.artistName}`;
  const cachedUrl = localStorage.getItem(cacheKey);

  // Get selected tags for filtering
  const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];

  // Session storage cache for API results
  const apiCacheKey = `danbooru-api-${artist.artistName}-${selectedTags.join(
    ","
  )}`;

  function getApiCache() {
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

  function showNoEntries() {
    img.style.display = "none";
    img.src = "fallback.jpg";
    setTimeout(() => {
      img.style.display = "block";
    }, 100);
  }

  function processApiData(data, isFallback = false) {
    const validPosts = Array.isArray(data)
      ? data.filter((post) => {
          const url = post?.large_file_url || post?.file_url;
          const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
          return isImage && !post.is_banned;
        })
      : [];

    if (validPosts.length === 0) {
      if (!isFallback && selectedTags.length > 0) {
        // Retry using only the artist name ordered by score
        fetchArtistImages(artist.artistName)
          .then((fallbackData) => {
            processApiData(fallbackData, true);
          })
          .catch(() => {
            showNoEntries();
          });
      } else {
        showNoEntries();
      }
      return;
    }

    function tryLoadUrls(urls, index = 0) {
      if (index >= urls.length) {
        showNoEntries();
        return;
      }
      const url = urls[index];
      img.onerror = () => tryLoadUrls(urls, index + 1);
      img.onload = () => {
        img.onerror = null;
        img.onload = null;
        if (index === 0) {
          localStorage.setItem(cacheKey, url);
        }
        artist._thumbnailPostId = validPosts[index]?.id;
      };
      img.src = url;
    }

    const imageUrls = validPosts
      .slice(0, 5)
      .map((post) => {
        const url = post.large_file_url || post.file_url;
        return buildImageUrl(url);
      })
      .filter(Boolean);

    if (imageUrls.length > 0) {
      tryLoadUrls(imageUrls);
    } else {
      showNoEntries();
    }
  }

  // Try cached image first
  if (cachedUrl) {
    img.onerror = fetchAndTry;
    img.onload = () => {
      img.onerror = null;
      img.onload = null;
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

    fetchArtistImages(artist.artistName, selectedTags)
      .then((data) => {
        setApiCache(data);
        processApiData(data);
      })
      .catch(() => {
        img.src = "fallback.jpg";
      });
  }
}

/**
 * Lazy loads the best image for an artist
 */
function lazyLoadBestImage(artist, img) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setBestImage(artist, img);
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "50px" }
  );
  observer.observe(img);
}

/**
 * Opens the fullscreen artist zoom view
 */
async function openArtistZoom(artist) {
  // Remove any existing fullscreen viewer
  document.querySelectorAll(".fullscreen-wrapper").forEach((el) => el.remove());

  const viewer = createFullscreenViewer();
  const {
    wrapper,
    img: zoomed,
    tagList,
    topTags,
    noEntriesMsg,
    prevBtn,
    nextBtn,
  } = viewer;

  let currentIndex = 0;
  let posts = [];

  // In-memory cache for top tags (limit to 20 artists per session)
  const topTagsCache = new Map();
  const TOP_TAGS_CACHE_LIMIT = 20;

  async function fetchAllArtistImages(artistName, selectedTags = []) {
    const cacheKey = `${artistName}-${selectedTags.join(",")}`;
    if (topTagsCache.has(cacheKey)) return topTagsCache.get(cacheKey);
    let allPosts = [];
    const MAX_PAGES = 40; // Limit to 20 pages (4000 posts if limit=200)
    const LIMIT = 200;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const pagePosts = await fetchArtistImages(artistName, selectedTags, {
        page,
        limit: LIMIT,
      });
      if (!pagePosts || pagePosts.length === 0) break;
      allPosts = allPosts.concat(pagePosts);
      // If less than LIMIT, still continue to next page (Danbooru may have more)
      // Only break if pagePosts.length === 0
    }
    // Limit cache size
    if (topTagsCache.size >= TOP_TAGS_CACHE_LIMIT) {
      const firstKey = topTagsCache.keys().next().value;
      topTagsCache.delete(firstKey);
    }
    topTagsCache.set(cacheKey, allPosts);
    return allPosts;
  }

  function showNoEntries() {
    zoomed.style.display = "none";
    noEntriesMsg.style.display = "block";
    noEntriesMsg.textContent = "No tags found.";
    // Add Retry button if not present
    if (!noEntriesMsg.querySelector(".retry-btn")) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn";
      retryBtn.textContent = "Retry";
      retryBtn.style.zIndex = "100000";
      retryBtn.setAttribute("aria-label", "Retry loading tags");
      retryBtn.onclick = () => {
        // Clear sessionStorage for this artist's tags
        const cacheKey = `allPosts-${artist.artistName}-${
          getActiveTags ? Array.from(getActiveTags()).join(",") : ""
        }`;
        sessionStorage.removeItem(cacheKey);
        noEntriesMsg.textContent = "Retrying...";
        // Re-run the zoom modal logic
        // Limit cache size
        openArtistZoom(artist);
      };
      noEntriesMsg.appendChild(retryBtn);
    }
  }

  function tryShow(index, attempts = 0) {
    if (!posts.length || attempts >= posts.length) {
      showNoEntries();
      return;
    }
    const raw = posts[index];
    const url = raw?.large_file_url || raw?.file_url;
    const full = buildImageUrl(url);
    zoomed.style.opacity = "0.5";
    zoomed.src = "";
    noEntriesMsg.style.display = "none";
    zoomed.onerror = () => {
      tryShow((index + 1) % posts.length, attempts + 1);
    };
    zoomed.onload = () => {
      zoomed.style.display = "block";
      zoomed.style.opacity = "1";
      noEntriesMsg.style.display = "none";
      zoomed.onerror = null;
      zoomed.onload = null;
      if (tagList && raw.tag_string) {
        tagList.textContent = raw.tag_string.split(" ").join(", ");
        tagList.style.display = "block";
      }
      if (topTags && topTags.textContent) {
        topTags.style.display = "block";
      }
    };
    zoomed.src = full;
  }

  let navTimeout;
  function debouncedShowPost(i) {
    clearTimeout(navTimeout);
    navTimeout = setTimeout(() => tryShow(i), 80);
  }

  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + posts.length) % posts.length;
    debouncedShowPost(currentIndex);
  };

  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % posts.length;
    debouncedShowPost(currentIndex);
  };

  document.body.appendChild(wrapper);
  wrapper.focus();

  // Fetch and show artist images
  try {
    const data = await fetchArtistImages(artist.artistName);
    if (!Array.isArray(data)) {
      posts = [];
      showNoEntries();
      return;
    }

    const validPosts = data.filter((post) => {
      const url = post?.large_file_url || post?.file_url;
      const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
      return isImage && !post.is_banned;
    });

    posts = validPosts;
    if (posts.length === 0) {
      showNoEntries();
      return;
    }
    // compute artist top tags
    try {
      // Count all tags
      const allPosts = await fetchAllArtistImages(artist.artistName);
      if (!Array.isArray(allPosts) || allPosts.length === 0) {
        if (topTags) topTags.textContent = "No tags found.";
      } else {
        // Deduplicate posts by ID
        const uniquePosts = [];
        const seenIds = new Set();
        allPosts.forEach((p) => {
          if (p.id && !seenIds.has(p.id)) {
            seenIds.add(p.id);
            uniquePosts.push(p);
          }
        });

        // Now count tags from uniquePosts instead of allPosts!
        const counts = {};
        uniquePosts.forEach((p) => {
          (p.tag_string || "").split(" ").forEach((t) => {
            counts[t] = (counts[t] || 0) + 1;
          });
        });

        // Get selected tags from filter (if any)
        const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];
        const selectedCounts = selectedTags
          .map((tag) => {
            const count = counts[tag] || 0;
            return `${tag.replace(/_/g, " ")} (${count})`;
          })
          .filter((str) => !str.startsWith(" (0)")); // Hide tags with 0 count

        // Top 20 overall tags (excluding selected tags and artist name)
        const artistTag = artist.artistName;
        const top = Object.entries(counts)
          .filter(([t]) => !selectedTags.includes(t) && t !== artistTag)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([t, c]) => `${t.replace(/_/g, " ")} (${c})`);

        // Only show tag counts, not total post count
        const tagString = [
          ...(selectedCounts.length ? selectedCounts : []),
          ...(top.length ? top : []),
        ].join(", ");

        if (topTags) topTags.textContent = tagString || "No tags found.";
      }
    } catch (err) {
      if (topTags) topTags.textContent = "Error loading tags.";
      console.warn("Failed to compute top tags:", err);
    }

    const startId = artist._thumbnailPostId;
    const idx = startId ? posts.findIndex((p) => p.id === startId) : -1;
    currentIndex = idx >= 0 ? idx : 0;
    tryShow(currentIndex);
  } catch (error) {
    console.warn("Failed to fetch artist images:", error);
    showNoEntries();
    if (topTags) topTags.textContent = "Error loading tags.";
  }

  // After you set tagList.textContent and topTags.textContent:
  tagList.style.display = "block";
  topTags.style.display = "block";
  tagList.setAttribute("aria-live", "polite");
  topTags.setAttribute("aria-live", "polite");
  zoomed.setAttribute("tabindex", "0");
  zoomed.setAttribute("aria-label", "Artist image, click to toggle tags");
}

/**
 * Renders the current page of artists
 */
function renderArtistsPage() {
  if (!artistGallery) return;

  // Only clear on first page
  if (currentArtistPage === 0) {
    artistGallery.innerHTML = "";
  }
  // Remove spinner if present
  removeGallerySpinner();
  if (filtered.length === 0) {
    const msg = document.createElement("div");
    msg.className = "no-artists-msg";
    msg.textContent = "No artists found for this filter.";
    artistGallery.appendChild(msg);
    return;
  }
  const start = currentArtistPage * artistsPerPage;
  const end = start + artistsPerPage;
  const artistsToShow = filtered.slice(start, end);
  artistsToShow.forEach((artist) => {
    const card = document.createElement("div");
    card.className = "artist-card";

    const img = document.createElement("img");
    img.className = "artist-image";
    lazyLoadBestImage(artist, img);

    // Fullscreen zoom on image click
    img.addEventListener("click", () => openArtistZoom(artist));

    const name = document.createElement("div");
    name.className = "artist-name";
    name.textContent = artist.artistName.replace(/_/g, " ");

    // Improved count display logic
    artist._updateCountDisplay = function () {
      const total =
        typeof this.postCount === "number" ? this.postCount : undefined;
      if (typeof total === "number") {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [${total}]`;
      } else {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [Loading…]`;
      }
    };

    artist._updateCountDisplay();

    // Remove live Danbooru count fetch for gallery display

    // Remove any fallback to artist.postCount for display

    // When counts are set later, call this function
    Object.defineProperty(artist, "_imageCount", {
      set(val) {
        this.__imageCount = val;
        if (typeof this._updateCountDisplay === "function")
          this._updateCountDisplay();
      },
      get() {
        return this.__imageCount;
      },
      configurable: true,
    });
    Object.defineProperty(artist, "_totalImageCount", {
      set(val) {
        this.__totalImageCount = val;
        if (typeof this._updateCountDisplay === "function")
          this._updateCountDisplay();
      },
      get() {
        return this.__totalImageCount;
      },
      configurable: true,
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-button";
    copyBtn.textContent = "📋";
    copyBtn.title = "Copy name";
    copyBtn.onclick = () => handleArtistCopy(artist, img.src);

    const reloadBtn = document.createElement("button");
    reloadBtn.className = "reload-button";
    reloadBtn.textContent = "⟳";
    reloadBtn.title = "Reload artist images/count";
    reloadBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      // Clear cache for this artist
      if (typeof clearArtistCache === "function")
        clearArtistCache(artist.artistName);
      // Also clear sessionStorage for top tags
      const cacheKey = `allPosts-${artist.artistName}-${
        getActiveTags ? Array.from(getActiveTags()).join(",") : ""
      }`;
      sessionStorage.removeItem(cacheKey);
      // Reset counts
      artist._imageCount = undefined;
      artist._totalImageCount = undefined;
      // Optionally show loading state
      name.textContent = artist.artistName.replace(/_/g, " ") + " [Loading…]";
      // Force re-fetch and re-render
      setTimeout(() => {
        if (typeof filterArtists === "function") {
          filterArtists(true, true); // force reload and re-render
        }
      }, 100);
    });

    // Add favorite/star button
    const favBtn = document.createElement("button");
    favBtn.className = "favorite-btn";
    favBtn.setAttribute(
      "aria-label",
      isArtistFavorited(artist.artistName)
        ? "Unfavorite artist"
        : "Favorite artist"
    );
    favBtn.innerHTML = isArtistFavorited(artist.artistName) ? "★" : "☆";
    favBtn.onclick = (e) => {
      e.stopPropagation();
      toggleFavoriteArtist(artist.artistName);
    };

    // Show tags if available
    if (artist.kinkTags && artist.kinkTags.length > 0) {
      const taglist = document.createElement("div");
      taglist.className = "artist-tags";
      taglist.textContent = artist.kinkTags.join(", ");
      card.append(img, name, taglist, copyBtn, reloadBtn, favBtn);
    } else {
      card.append(img, name, copyBtn, reloadBtn, favBtn);
    }

    artistGallery.appendChild(card);
  });
  currentArtistPage++;
  // Setup infinite scroll after initial render
  if (currentArtistPage === 1) setupInfiniteScrollGallery();
}

// Tag Cloud Visualization
function computeTagFrequencies(artists) {
  const tagCounts = {};
  artists.forEach((artist) => {
    (artist.kinkTags || []).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  return tagCounts;
}

function renderTagCloud() {
  let cloudContainer = document.getElementById("tag-cloud");
  if (!cloudContainer) {
    cloudContainer = document.createElement("div");
    cloudContainer.id = "tag-cloud";
    cloudContainer.className = "tag-cloud-container";
    artistGallery.parentNode.insertBefore(cloudContainer, artistGallery);
  }
  cloudContainer.innerHTML = "";
  const tagCounts = computeTagFrequencies(allArtists);
  const tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40); // Top 40 tags
  const maxCount = tags.length ? tags[0][1] : 1;
  tags.forEach(([tag, count]) => {
    const span = document.createElement("span");
    span.className = "tag-cloud-tag";
    span.textContent = tag.replace(/_/g, " ");
    // Font size and color scale
    const size = 0.9 + 1.2 * (count / maxCount);
    span.style.fontSize = `${size}em`;
    span.style.color = `hsl(${320 - 60 * (count / maxCount)}, 80%, 55%)`;
    span.title = `${tag.replace(/_/g, " ")} (${count})`;
    span.onclick = () => {
      if (typeof window.toggleTag === "function") {
        window.toggleTag(tag);
      }
    };
    cloudContainer.appendChild(span);
  });
}

// Call renderTagCloud on gallery init and after filtering
function initGalleryModule(
  galleryElement,
  blurElement,
  artistData,
  tagsGetter,
  nameFilterGetter
) {
  artistGallery = galleryElement;
  backgroundBlur = blurElement;
  allArtists = artistData;
  getActiveTags = tagsGetter;
  getArtistNameFilter = nameFilterGetter;
  addTagCombinationModeUI();
  renderTagCloud();
}

/**
 * Public API
 */
export {
  initGalleryModule,
  setRandomBackground,
  filterArtists,
  toggleFavoriteArtist,
  isArtistFavorited,
  openArtistZoom,
  clearArtistCache,
  setTagCombinationMode,
  getTagCombinationMode,
};
