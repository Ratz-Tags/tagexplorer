/**
 * Gallery module - Handles artist gallery display and image management
 */

import { createFullscreenViewer, createSpinner } from "./ui.js";
import {
  fetchArtistImages,
  clearArtistCache,
  buildImageUrl,
  fetchAllArtistImages,
} from "./api.js";
import { handleArtistCopy } from "./sidebar.js";

// Gallery state
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
    const MAX_PAGES = 40; // Limit to 40 pages (8000 posts if limit=200)
    const LIMIT = 200;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const pagePosts = await fetchArtistImages(artistName, selectedTags, {
        page,
        limit: LIMIT,
      });
      if (!pagePosts || pagePosts.length === 0) break;
      allPosts = allPosts.concat(pagePosts);
    }
    if (topTagsCache.size >= TOP_TAGS_CACHE_LIMIT) {
      const firstKey = topTagsCache.keys().next().value;
      topTagsCache.delete(firstKey);
    }
    topTagsCache.set(cacheKey, allPosts);
    return allPosts;
  }

  function showNoEntries(message = "No tags found.") {
    zoomed.style.display = "none";
    noEntriesMsg.style.display = "block";
    noEntriesMsg.textContent = message;
    if (!noEntriesMsg.querySelector(".retry-btn")) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn";
      retryBtn.textContent = "Retry";
      retryBtn.style.zIndex = "100000";
      retryBtn.setAttribute("aria-label", "Retry loading tags");
      retryBtn.onclick = () => {
        const cacheKey = `allPosts-${artist.artistName}-${
          getActiveTags ? Array.from(getActiveTags()).join(",") : ""
        }`;
        sessionStorage.removeItem(cacheKey);
        noEntriesMsg.textContent = "Retrying...";
        openArtistZoom(artist);
      };
      noEntriesMsg.appendChild(retryBtn);
    }
  }

  function tryShow(index, attempts = 0) {
    if (!posts || posts.length === 0) {
      showNoEntries("No images found for this artist and filter.");
      return;
    }
    if (attempts >= posts.length) {
      showNoEntries("No valid images found for this artist.");
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
    if (!posts || posts.length === 0) return;
    currentIndex = (currentIndex - 1 + posts.length) % posts.length;
    debouncedShowPost(currentIndex);
  };

  nextBtn.onclick = () => {
    if (!posts || posts.length === 0) return;
    currentIndex = (currentIndex + 1) % posts.length;
    debouncedShowPost(currentIndex);
  };

  document.body.appendChild(wrapper);
  wrapper.focus();

  // Fetch and show artist images
  try {
    const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];
    const data = await fetchArtistImages(artist.artistName, selectedTags);
    if (!Array.isArray(data) || data.length === 0) {
      posts = [];
      showNoEntries("No images found for this artist and filter.");
      return;
    }
    const validPosts = data.filter((post) => {
      const url = post?.large_file_url || post?.file_url;
      const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
      return isImage && !post.is_banned;
    });
    posts = validPosts;
    if (posts.length === 0) {
      showNoEntries("No valid images found for this artist.");
      return;
    }
    // compute artist top tags
    try {
      const allPosts = await fetchAllArtistImages(
        artist.artistName,
        selectedTags
      );
      if (!Array.isArray(allPosts) || allPosts.length === 0) {
        if (topTags) topTags.textContent = "No tags found.";
      } else {
        const uniquePosts = [];
        const seenIds = new Set();
        allPosts.forEach((p) => {
          if (p.id && !seenIds.has(p.id)) {
            seenIds.add(p.id);
            uniquePosts.push(p);
          }
        });
        const counts = {};
        uniquePosts.forEach((p) => {
          (p.tag_string || "").split(" ").forEach((t) => {
            counts[t] = (counts[t] || 0) + 1;
          });
        });
        const selectedCounts = selectedTags
          .map((tag) => {
            const count = counts[tag] || 0;
            return `${tag.replace(/_/g, " ")} (${count})`;
          })
          .filter((str) => !str.startsWith(" (0)"));
        const artistTag = artist.artistName;
        const top = Object.entries(counts)
          .filter(([t]) => !selectedTags.includes(t) && t !== artistTag)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([t, c]) => `${t.replace(/_/g, " ")} (${c})`);
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
    showNoEntries("Error loading images for this artist.");
    if (topTags) topTags.textContent = "Error loading tags.";
  }
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

  artistGallery.innerHTML = "";

  // Remove spinner if present
  const spinner = artistGallery.querySelector(".gallery-spinner");
  if (spinner) spinner.remove();

  if (filtered.length === 0) {
    const msg = document.createElement("div");
    msg.className = "no-artists-msg";
    msg.textContent = "No artists found for this filter.";
    artistGallery.appendChild(msg);
    return;
  }

  filtered.forEach((artist) => {
    const card = document.createElement("div");
    card.className = "artist-card";

    const img = document.createElement("img");
    img.className = "artist-image";
    // Use cached image if available
    const cacheKey = `danbooru-image-${artist.artistName}`;
    const cachedUrl = localStorage.getItem(cacheKey);
    if (cachedUrl) {
      img.src = cachedUrl;
      img.style.display = "block";
      img.onerror = () => {
        img.src = "fallback.jpg";
        img.style.display = "block";
      };
    } else {
      lazyLoadBestImage(artist, img);
      img.style.display = "block";
    }

    // Fullscreen zoom on image click
    img.addEventListener("click", () => openArtistZoom(artist));

    const name = document.createElement("div");
    name.className = "artist-name";
    name.textContent = artist.artistName.replace(/_/g, " ");

    // Remove tagCountDiv summary text
    const tagCountDiv = document.createElement("div");
    tagCountDiv.className = "artist-tag-count";
    tagCountDiv.textContent = "";

    // Render kinkTags with [TagCount] for selected tags
    const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];
    let taglistText = "";
    if (artist.kinkTags && artist.kinkTags.length > 0) {
      taglistText = artist.kinkTags
        .map((tag) => {
          if (selectedTags.includes(tag)) {
            const count =
              artist._tagMatchCount !== undefined ? artist._tagMatchCount : "?";
            return `${tag.replace(/_/g, " ")} [${count}]`;
          }
          return tag.replace(/_/g, " ");
        })
        .join(", ");
    }

    const taglist = document.createElement("div");
    taglist.className = "artist-tags";
    taglist.textContent = taglistText;

    artist._updateCountDisplay = function () {
      const total =
        typeof this.postCount === "number" ? this.postCount : undefined;
      if (typeof total === "number") {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [${total}]`;
      } else {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [Loading…]`;
      }
      // Remove tagCountDiv summary text
      tagCountDiv.textContent = "";
      // Update taglist with [TagCount] for selected tags
      if (this.kinkTags && this.kinkTags.length > 0) {
        taglist.textContent = this.kinkTags
          .map((tag) => {
            if (selectedTags.includes(tag)) {
              const count =
                this._tagMatchCount !== undefined ? this._tagMatchCount : "?";
              return `${tag.replace(/_/g, " ")} [${count}]`;
            }
            return tag.replace(/_/g, " ");
          })
          .join(", ");
      }
      // Always show image if cached or fallback
      if (localStorage.getItem(`danbooru-image-${this.artistName}`)) {
        img.src = localStorage.getItem(`danbooru-image-${this.artistName}`);
        img.style.display = "block";
      } else {
        img.style.display = "block";
      }
    };
    artist._updateCountDisplay();

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
    Object.defineProperty(artist, "_tagMatchCount", {
      set(val) {
        this.__tagMatchCount = val;
        if (typeof this._updateCountDisplay === "function")
          this._updateCountDisplay();
      },
      get() {
        return this.__tagMatchCount;
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
      if (typeof clearArtistCache === "function")
        clearArtistCache(artist.artistName);
      const cacheKey = `allPosts-${artist.artistName}-${selectedTags.join(
        ","
      )}`;
      sessionStorage.removeItem(cacheKey);
      localStorage.removeItem(`danbooru-image-${artist.artistName}`);
      artist._imageCount = undefined;
      artist._totalImageCount = undefined;
      artist._tagMatchCount = undefined;
      name.textContent = artist.artistName.replace(/_/g, " ") + " [Loading…]";
      setTimeout(() => {
        if (typeof filterArtists === "function") {
          filterArtists(true, true);
        }
      }, 100);
    });

    card.append(img, name, taglist, tagCountDiv, copyBtn, reloadBtn);
    artistGallery.appendChild(card);
  });
}

// Helper to render a list of artists using the normal card structure
function renderArtistCards(artists) {
  if (!artistGallery) return;
  artistGallery.innerHTML = "";
  artists.forEach((artist) => {
    const card = document.createElement("div");
    card.className = "artist-card";

    const img = document.createElement("img");
    img.className = "artist-image";
    const cacheKey = `danbooru-image-${artist.artistName}`;
    const cachedUrl = localStorage.getItem(cacheKey);
    if (cachedUrl) {
      img.src = cachedUrl;
      img.style.display = "block";
      img.onerror = () => {
        img.src = "fallback.jpg";
        img.style.display = "block";
      };
    } else {
      lazyLoadBestImage(artist, img);
      img.style.display = "block";
    }
    img.addEventListener("click", () => openArtistZoom(artist));

    const name = document.createElement("div");
    name.className = "artist-name";
    const total =
      typeof artist.postCount === "number" ? artist.postCount : undefined;
    if (typeof total === "number") {
      name.textContent = `${artist.artistName.replace(/_/g, " ")} [${total}]`;
    } else {
      name.textContent = `${artist.artistName.replace(/_/g, " ")} [Loading…]`;
    }

    const tagCountDiv = document.createElement("div");
    tagCountDiv.className = "artist-tag-count";
    tagCountDiv.textContent = "";

    const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];
    let taglistText = "";
    if (artist.kinkTags && artist.kinkTags.length > 0) {
      taglistText = artist.kinkTags
        .map((tag) => {
          if (selectedTags.includes(tag)) {
            const count =
              artist._tagMatchCount !== undefined ? artist._tagMatchCount : "?";
            return `${tag.replace(/_/g, " ")} [${count}]`;
          }
          return tag.replace(/_/g, " ");
        })
        .join(", ");
    }
    const taglist = document.createElement("div");
    taglist.className = "artist-tags";
    taglist.textContent = taglistText;

    artist._updateCountDisplay = function () {
      const total =
        typeof this.postCount === "number" ? this.postCount : undefined;
      if (typeof total === "number") {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [${total}]`;
      } else {
        name.textContent = `${this.artistName.replace(/_/g, " ")} [Loading…]`;
      }
      tagCountDiv.textContent = "";
      if (this.kinkTags && this.kinkTags.length > 0) {
        taglist.textContent = this.kinkTags
          .map((tag) => {
            if (selectedTags.includes(tag)) {
              const count =
                this._tagMatchCount !== undefined ? this._tagMatchCount : "?";
              return `${tag.replace(/_/g, " ")} [${count}]`;
            }
            return tag.replace(/_/g, " ");
          })
          .join(", ");
      }
      if (localStorage.getItem(`danbooru-image-${this.artistName}`)) {
        img.src = localStorage.getItem(`danbooru-image-${this.artistName}`);
        img.style.display = "block";
      } else {
        img.style.display = "block";
      }
    };
    artist._updateCountDisplay();

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
    Object.defineProperty(artist, "_tagMatchCount", {
      set(val) {
        this.__tagMatchCount = val;
        if (typeof this._updateCountDisplay === "function")
          this._updateCountDisplay();
      },
      get() {
        return this.__tagMatchCount;
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
      if (typeof clearArtistCache === "function")
        clearArtistCache(artist.artistName);
      const cacheKey = `allPosts-${artist.artistName}-${selectedTags.join(
        ","
      )}`;
      sessionStorage.removeItem(cacheKey);
      localStorage.removeItem(`danbooru-image-${artist.artistName}`);
      artist._imageCount = undefined;
      artist._totalImageCount = undefined;
      artist._tagMatchCount = undefined;
      name.textContent = artist.artistName.replace(/_/g, " ") + " [Loading…]";
      setTimeout(() => {
        if (typeof filterArtists === "function") {
          filterArtists(true, true);
        }
      }, 100);
    });

    card.append(img, name, taglist, tagCountDiv, copyBtn, reloadBtn);
    artistGallery.appendChild(card);
  });
}

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
      artistGallery.innerHTML = "";
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

    if (spinner.setTotal) spinner.setTotal(filtered.length);
    if (spinner.updateProgress) spinner.updateProgress(0);

    // Always fetch counts for the current filtered artists
    async function fetchInBatches(
      artists,
      batchSize = 10,
      delayMs = 500,
      gen,
      spin
    ) {
      let done = 0;
      for (let i = 0; i < artists.length; i += batchSize) {
        if (gen !== filterGeneration) return;
        const batch = artists.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (artist) => {
            const totalCount = artist.postCount || 0;
            artist._totalImageCount = totalCount;
            artist._imageCount = totalCount;
            if (gen !== filterGeneration) {
              return;
            }
          })
        );

        done += batch.length;
        if (spin && spin.updateProgress) spin.updateProgress(done);

        if (i + batchSize < artists.length) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (gen !== filterGeneration) return;

      setSortMode(sortMode);
      renderArtistsPage();
    }

    renderArtistsPage(); // Render immediately

    if (reset) {
      await fetchInBatches(filtered, 5, 1000, generation, spinner).catch(
        (e) => {
          console.error("Batch fetch failed:", e);
        }
      );
      if (generation !== filterGeneration) return;
      setSortMode(sortMode);
      renderArtistsPage();
    } else if (force) {
      fetchInBatches(filtered, 5, 1000, generation, spinner).then(() => {
        if (generation !== filterGeneration) return;
        setSortMode(sortMode);
        renderArtistsPage();
      });
    }
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

/**
 * Calculates and displays artists with the most images matching all selected tags
 * Optimized: Uses Danbooru /counts/posts API for fast post counts
 */
async function showTopArtistsByTagCount() {
  if (!allArtists || allArtists.length === 0) return;
  if (!getActiveTags) return;
  const selectedTags = Array.from(getActiveTags());
  if (selectedTags.length === 0) return;

  // Filter artists to only those that have all selected tags in their kinkTags
  const filteredArtists = allArtists.filter((artist) => {
    const tags = artist.kinkTags || [];
    return selectedTags.every((tag) => tags.includes(tag));
  });

  // Debug: Show artistTag for each filtered artist
  let debugTags = filteredArtists.map(a => a.artistTag || a.artistName).join(", ");
  alert("Filtered artist tags: " + debugTags);

  // Show spinner and loading bar while loading
  if (artistGallery) {
    artistGallery.innerHTML = "";
    const spinner = document.createElement("div");
    spinner.className = "gallery-spinner";
    spinner.style.position = "fixed";
    spinner.style.top = "50%";
    spinner.style.left = "50%";
    spinner.style.transform = "translate(-50%, -50%)";
    spinner.style.zIndex = "10000";
    spinner.style.background = "rgba(255,255,255,0.95)";
    spinner.style.borderRadius = "2em";
    spinner.style.padding = "2em 2em 2.5em 2em";
    spinner.innerHTML = `<img src=\"spinner.gif\" alt=\"Loading...\" style=\"display:block;margin:0 auto;\" />`;
    // Add loading bar, styled center and large
    const loadingBar = document.createElement("progress");
    loadingBar.className = "loading-bar";
    loadingBar.value = 0;
    loadingBar.max = filteredArtists.length;
    loadingBar.style.display = "block";
    loadingBar.style.width = "80vw";
    loadingBar.style.maxWidth = "400px";
    loadingBar.style.height = "2.5em";
    loadingBar.style.margin = "2em auto 0 auto";
    loadingBar.style.position = "absolute";
    loadingBar.style.left = "50%";
    loadingBar.style.top = "calc(50% + 60px)";
    loadingBar.style.transform = "translate(-50%, 0)";
    spinner.appendChild(loadingBar);
    // Add status text
    const statusText = document.createElement("div");
    statusText.className = "loading-status";
    statusText.style.textAlign = "center";
    statusText.style.fontSize = "1.2em";
    statusText.style.marginTop = "1em";
    statusText.style.position = "absolute";
    statusText.style.left = "50%";
    statusText.style.top = "calc(50% + 120px)";
    statusText.style.transform = "translate(-50%, 0)";
    spinner.appendChild(statusText);
    artistGallery.appendChild(spinner);
  }

  // Use Danbooru /counts/posts API for each artist+tags
  const { fetchPostCountForTags, fetchArtistImages } = await import("./api.js");
  const artistTagCounts = [];
  let done = 0;
  const spinnerElem = artistGallery
    ? artistGallery.querySelector(".gallery-spinner")
    : null;
  const loadingBarElem = spinnerElem
    ? spinnerElem.querySelector(".loading-bar")
    : null;
  const statusTextElem = spinnerElem
    ? spinnerElem.querySelector(".loading-status")
    : null;

  // Helper to format artist name for Danbooru tag
  function formatArtistTag(name) {
    return name.replace(/\s+/g, "_").toLowerCase();
  }
  // Helper to format selected tags for Danbooru
  function formatTag(tag) {
    return tag.replace(/\s+/g, "_").toLowerCase();
  }

  let allZero = true;
  for (const artist of filteredArtists) {
    let matchCount = 0;
    try {
      // Format tags for API
      const apiTags = [
        formatArtistTag(artist.artistName),
        ...selectedTags.map(formatTag),
      ];
      matchCount = await fetchPostCountForTags(apiTags);
    } catch (e) {
      matchCount = 0;
    }
    artist._tagMatchCount = matchCount;
    if (matchCount > 0) allZero = false;
    artistTagCounts.push({ artist, count: matchCount });
    done++;
    if (spinnerElem) {
      if (loadingBarElem) loadingBarElem.value = done;
      if (loadingBarElem && !spinnerElem.contains(loadingBarElem)) {
        spinnerElem.appendChild(loadingBarElem);
      }
      if (statusTextElem) {
        statusTextElem.textContent = `Fetching: ${artist.artistName.replace(
          /_/g,
          " "
        )} (${done}/${filteredArtists.length}) [${matchCount}]`;
      }
    }
    // Ensure image is cached for card display
    const cacheKey = `danbooru-image-${artist.artistName}`;
    if (!localStorage.getItem(cacheKey)) {
      try {
        const posts = await fetchArtistImages(artist.artistName, [], {
          limit: 1,
        });
        if (Array.isArray(posts) && posts.length > 0) {
          const post = posts[0];
          const url = post.large_file_url || post.file_url;
          if (url) localStorage.setItem(cacheKey, url);
        }
      } catch {}
    }
  }

  // Sort artists by count descending
  artistTagCounts.sort((a, b) => b.count - a.count);

  // Only show artists with matches
  const topArtists = artistTagCounts
    .filter(({ count }) => count > 0)
    .map(({ artist }) => artist);
  if (topArtists.length > 0) {
    renderArtistCards(topArtists);
  } else {
    // Debug output if all zero
    if (allZero) {
      artistGallery.innerHTML =
        '<div class="no-entries-msg">No artists found with all selected tags.<br><span style="color:red">[Debug] All counts were zero. Check tag formatting and Danbooru API.</span></div>';
    } else {
      artistGallery.innerHTML =
        '<div class="no-entries-msg">No artists found with all selected tags.</div>';
    }
  }
}

// Optionally, expose this function for UI integration
export { showTopArtistsByTagCount };

function addTopTagCountButton() {
  const sortControls = document.querySelector(".sort-controls");
  if (!sortControls || document.getElementById("top-tag-count-btn")) return;
  const btn = document.createElement("button");
  btn.id = "top-tag-count-btn";
  btn.className = "browse-btn";
  btn.textContent = "Show Top Artists by Tag Count";
  btn.title =
    "See which artists have the most images matching all selected tags";
  btn.onclick = () => {
    if (typeof showTopArtistsByTagCount === "function") {
      showTopArtistsByTagCount();
    }
  };
  sortControls.appendChild(btn);
}

// Call this on gallery init
function initGallery() {
  artistGallery = document.getElementById("artist-gallery");
  backgroundBlur = document.getElementById("background-blur");
  addTopTagCountButton();
}
function getPaginationInfo() {
  return {
    total: filtered.length,
    shown: filtered.length,
    hasMore: false,
    currentPage: 1,
    artistsPerPage: filtered.length,
  };
}

function setAllArtists(artists) {
  allArtists = artists;
}

function setGetActiveTagsCallback(callback) {
  getActiveTags = callback;
}

/**
 * Sets the callback to get artist name filter
 */
function setGetArtistNameFilterCallback(callback) {
  getArtistNameFilter = callback;
}

function setSortMode(mode) {
  sortMode = mode === "count" ? "count" : "name";
  if (filtered.length > 0) {
    if (sortMode === "count") {
      filtered.sort(
        (a, b) => (b._totalImageCount || 0) - (a._totalImageCount || 0)
      );
    } else {
      filtered.sort((a, b) =>
        a.artistName.localeCompare(b.artistName, undefined, {
          sensitivity: "base",
        })
      );
    }
    renderArtistsPage();
  }
}
function setSortPreference(preference) {
  sortMode = preference === "count" ? "count" : "name";
}

function forceSortAndRender() {
  setSortMode(sortMode);
}

function getFilteredArtists() {
  return [...filtered];
}

export {
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
  getFilteredArtists,
  getPaginationInfo,
};
