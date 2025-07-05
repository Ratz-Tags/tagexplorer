/**
 * Gallery module - Handles artist gallery display and image management
 */

import { createFullscreenViewer, createSpinner } from "./ui.js";
import {
  fetchArtistImages,
  clearArtistCache,
  getArtistImageCount,
  buildImageUrl,
} from "./api.js";
import { handleArtistCopy } from "./sidebar.js";

// Gallery state
let currentArtistPage = 0;
const artistsPerPage = 24;
let filtered = [];
let isFetching = false;

// DOM references
let artistGallery = null;
let backgroundBlur = null;

// External dependencies
let allArtists = [];
let getActiveTags = null;
let getArtistNameFilter = null;

/**
 * Sets the background image with a random image
 */
async function setRandomBackground() {
  if (!backgroundBlur) return;

  try {
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
  const viewer = createFullscreenViewer();
  const { wrapper, img: zoomed, noEntriesMsg, prevBtn, nextBtn } = viewer;

  let currentIndex = 0;
  let posts = [];

  function showNoEntries() {
    zoomed.style.display = "none";
    noEntriesMsg.style.display = "block";
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

    currentIndex = 0;
    tryShow(currentIndex);
  } catch (error) {
    console.warn("Failed to fetch artist images:", error);
    showNoEntries();
  }
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
  const spinner = artistGallery.querySelector(".gallery-spinner");
  if (spinner) spinner.remove();

  // DO NOT clear artistGallery here!
  // artistGallery.innerHTML = ""; // <-- REMOVE THIS LINE

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

    // Helper to update count display
    artist._updateCountDisplay = function () {
      if (
        typeof this._imageCount === "number" &&
        typeof this._totalImageCount === "number"
      ) {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [${
          this._imageCount
        }/${this._totalImageCount}]`;
      } else if (typeof this._totalImageCount === "number") {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [${
          this._totalImageCount
        }]`;
      } else {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [Loading…]`;
      }
    };

    // Initial display
    artist._updateCountDisplay();

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

      // Reset counts
      artist._imageCount = undefined;
      artist._totalImageCount = undefined;

      // Optionally show loading state
      name.textContent = artist.artistName.replace(/_/g, " ") + " [Loading…]";

      // Fetch new counts
      const { getArtistImageCount } = await import("./api.js");
      const totalCount = await getArtistImageCount(artist.artistName);
      artist._totalImageCount = totalCount;

      const activeTags = getActiveTags ? getActiveTags() : new Set();
      if (activeTags && activeTags.size > 0) {
        const tagQuery = [artist.artistName, ...Array.from(activeTags)].join(
          " "
        );
        const response = await fetch(
          `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(
            tagQuery
          )}&limit=1000`
        );
        const posts = await response.json();
        const uniqueIds = new Set(
          Array.isArray(posts) ? posts.map((post) => post.id) : []
        );
        artist._imageCount = uniqueIds.size;
      } else {
        artist._imageCount = totalCount;
      }

      // Update display
      if (
        typeof artist._imageCount === "number" &&
        typeof artist._totalImageCount === "number"
      ) {
        name.textContent = `${artist.artistName.replace(/_/g, " ")} [${
          artist._imageCount
        }/${artist._totalImageCount}]`;
      } else if (typeof artist._totalImageCount === "number") {
        name.textContent = `${artist.artistName.replace(/_/g, " ")} [${
          artist._totalImageCount
        }]`;
      }
    });

    // Show tags if available
    if (artist.kinkTags && artist.kinkTags.length > 0) {
      const taglist = document.createElement("div");
      taglist.className = "artist-tags";
      taglist.textContent = artist.kinkTags.join(", ");
      card.append(img, name, taglist, copyBtn, reloadBtn);
    } else {
      card.append(img, name, copyBtn, reloadBtn);
    }

    artistGallery.appendChild(card);
  });
}

/**
 * Filters and displays artists based on current criteria
 */
async function filterArtists(reset = true) {
  if (!artistGallery) return;
  if (isFetching) {
    const existing = artistGallery.querySelector(".gallery-spinner");
    if (!existing) {
      artistGallery.appendChild(createSpinner());
    }
    return;
  }

  let spinner;
  try {
    if (reset) {
      currentArtistPage = 0;
      artistGallery.innerHTML = "";
    }

    spinner = artistGallery.querySelector(".gallery-spinner");
    if (!spinner) {
      spinner = createSpinner();
      artistGallery.appendChild(spinner);
    }

    isFetching = true;

    // Get active tags and filters
    const activeTags = getActiveTags ? getActiveTags() : new Set();
    const artistNameFilter = getArtistNameFilter ? getArtistNameFilter() : "";

    // Filter artists
    filtered = allArtists.filter((artist) => {
      const tags = artist.kinkTags || [];
      return (
        Array.from(activeTags).every((tag) => tags.includes(tag)) &&
        (artist.artistName.toLowerCase().includes(artistNameFilter) ||
          artistNameFilter === "")
      );
    });
    console.log(
      "Filtered artists:",
      filtered.length,
      filtered.map((a) => a.artistName)
    );

    // Always fetch counts for the current filtered artists
    async function fetchInBatches(artists, batchSize = 5, delayMs = 1000) {
      const { getArtistImageCount } = await import("./api.js");
      for (let i = 0; i < artists.length; i += batchSize) {
        const batch = artists.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (artist) => {
            // Always fetch and set total count
            const totalCount = await getArtistImageCount(artist.artistName);
            artist._totalImageCount = totalCount;
            // If tags are active, fetch filtered count, else use total
            const activeTags = getActiveTags ? getActiveTags() : new Set();
            if (activeTags && activeTags.size > 0) {
              const tagQuery = [
                artist.artistName,
                ...Array.from(activeTags),
              ].join(" ");
              const response = await fetch(
                `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(
                  tagQuery
                )}&limit=1000`
              );
              const posts = await response.json();
              const uniqueIds = new Set(
                Array.isArray(posts) ? posts.map((post) => post.id) : []
              );
              artist._imageCount = uniqueIds.size;
            } else {
              artist._imageCount = totalCount;
            }
          })
        );
        if (i + batchSize < artists.length) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    renderArtistsPage(); // Render immediately

    fetchInBatches(filtered).catch((e) => {
      console.error("Batch fetch failed:", e);
    });
  } catch (error) {
    console.warn("filterArtists failed", error);
  } finally {
    const remaining = artistGallery.querySelector(".gallery-spinner");
    if (remaining) remaining.remove();
    isFetching = false;
  }
}

/**
 * Initializes the gallery module
 */
function initGallery() {
  artistGallery = document.getElementById("artist-gallery");
  backgroundBlur = document.getElementById("background-blur");
}

/**
 * Sets the reference to all artists data
 */
function setAllArtists(artists) {
  allArtists = artists;
}

/**
 * Sets the callback to get active tags
 */
function setGetActiveTagsCallback(callback) {
  getActiveTags = callback;
}

/**
 * Sets the callback to get artist name filter
 */
function setGetArtistNameFilterCallback(callback) {
  getArtistNameFilter = callback;
}

/**
 * Gets the current filtered artists
 */
function getFilteredArtists() {
  return [...filtered];
}

/**
 * Gets pagination info
 */
function getPaginationInfo() {
  return {
    currentPage: currentArtistPage,
    perPage: artistsPerPage,
    total: filtered.length,
    hasMore: filtered.length > currentArtistPage * artistsPerPage,
  };
}

/**
 * Gets the artist image count with a timeout
 */
function getArtistImageCountWithTimeout(name, ms = 8000) {
  return Promise.race([
    getArtistImageCount(name),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

// Export functions for ES modules
export {
  initGallery,
  filterArtists,
  renderArtistsPage,
  openArtistZoom,
  setRandomBackground,
  setAllArtists,
  setGetActiveTagsCallback,
  setGetArtistNameFilterCallback,
  getFilteredArtists,
  getPaginationInfo,
  getArtistImageCountWithTimeout,
};

function setupInfiniteScroll() {
  window.addEventListener("scroll", () => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
      (currentArtistPage + 1) * artistsPerPage < filtered.length
    ) {
      currentArtistPage++;
      renderArtistsPage();
    }
  });
}

// Call this after initGallery()
setupInfiniteScroll();
