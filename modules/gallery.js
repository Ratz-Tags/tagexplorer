/**
 * Returns the thumbnail URL for an artist (used by sidebar and cards)
 */
export function getThumbnailUrl(artist) {
  return artist && artist.thumbnailUrl ? artist.thumbnailUrl : undefined;
}
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
let artistsPerPage = 100;
let currentPage = 1;

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
  let artistTopTags = [];

  function showNoEntries(
    message = "No images found for this artist and filter."
  ) {
    zoomed.style.display = "none";
    noEntriesMsg.style.display = "block";
    noEntriesMsg.textContent = message;
    // Add fallback button if filtered fetch failed
    if (!noEntriesMsg.querySelector(".show-all-btn")) {
      const showAllBtn = document.createElement("button");
      showAllBtn.className = "show-all-btn";
      showAllBtn.textContent = "Show all images for this artist";
      showAllBtn.style.marginTop = "1em";
      showAllBtn.onclick = async () => {
        noEntriesMsg.textContent = "Loading all images...";
        showAllBtn.disabled = true;
        try {
          const allData = await fetchAllArtistImages(artist.artistName, []);
          if (Array.isArray(allData) && allData.length > 0) {
            posts = allData;
            processApiData(posts, true);
            zoomed.style.display = "block";
            noEntriesMsg.style.display = "none";
          } else {
            noEntriesMsg.textContent = "No images found for this artist.";
          }
        } catch {
          noEntriesMsg.textContent = "Error loading images.";
        }
        showAllBtn.disabled = false;
      };
      noEntriesMsg.appendChild(showAllBtn);
    }
    // Add retry button if not present
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

  function processApiData(data, isFallback = false) {
    const validPosts = Array.isArray(data)
      ? data.filter((post) => {
          const url = post?.large_file_url || post?.file_url;
          const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
          return isImage && !post.is_banned;
        })
      : [];

    posts = validPosts;

    // --- Calculate top 20 tags for this artist (excluding artist tag) ---
    if (posts.length > 0) {
      // Count tag frequencies
      const tagCounts = {};
      posts.forEach((post) => {
        if (post.tag_string) {
          post.tag_string.split(" ").forEach((tag) => {
            // Exclude artist tag (danbooru: artist:xxx)
            if (!tag.startsWith("artist:")) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          });
        }
      });
      // Remove the artist's own tag if present (e.g. artistName)
      const artistTag = (
        artist.artistTag ||
        artist.artistName ||
        ""
      ).toLowerCase();
      delete tagCounts[artistTag];
      // Sort tags by frequency
      artistTopTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count]) => ({ tag, count }));
      // Render top tags in the modal
      if (topTags && artistTopTags.length > 0) {
        topTags.innerHTML = "<strong>Top Tags:</strong><br>";
        artistTopTags.forEach(({ tag, count }) => {
          const tagDiv = document.createElement("div");
          tagDiv.className = "zoom-top-tag";
          tagDiv.textContent = `${tag.replace(/_/g, " ")} (${count})`;
          topTags.appendChild(tagDiv);
        });
        topTags.style.display = "block";
      } else if (topTags) {
        topTags.innerHTML = "";
        topTags.style.display = "none";
      }
    }

    if (validPosts.length === 0) {
      if (
        !isFallback &&
        getActiveTags &&
        Array.from(getActiveTags()).length > 0
      ) {
        showNoEntries("No images found for this artist and selected tags.");
      } else {
        showNoEntries("No images found for this artist.");
      }
      return;
    }

    // Show the first image, navigation will use posts[]
    tryShow(currentIndex);
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

  // Add overlay above zoom modal
  showZoomTauntOverlay();

  // --- HUMILIATION: Add taunt header to zoom modal ---
  if (wrapper && !wrapper.querySelector(".taunt-header")) {
    let taunt = "";
    // Try to get a tag-specific taunt if possible
    if (
      artist.kinkTags &&
      Array.isArray(artist.kinkTags) &&
      artist.kinkTags.length > 0
    ) {
      // Import tag taunts if available
      try {
        const tagsMod = await import("./tags.js");
        const tagTaunts = tagsMod && tagsMod.tagTaunts ? tagsMod.tagTaunts : {};
        const tag =
          artist.kinkTags[Math.floor(Math.random() * artist.kinkTags.length)];
        if (tagTaunts && tagTaunts[tag] && tagTaunts[tag].length > 0) {
          taunt =
            tagTaunts[tag][Math.floor(Math.random() * tagTaunts[tag].length)];
        }
      } catch {}
    }
    // Fallback to a general taunt if no tag-specific taunt
    if (!taunt) {
      try {
        const humiliation = await import("./humiliation.js");
        if (
          humiliation &&
          humiliation.startTauntTicker &&
          window._generalTaunts
        ) {
          taunt =
            window._generalTaunts[
              Math.floor(Math.random() * window._generalTaunts.length)
            ];
        }
      } catch {}
    }
    if (!taunt) taunt = "You really can't get enough, can you?";
    const tauntHeader = document.createElement("div");
    tauntHeader.className = "taunt-header";
    tauntHeader.textContent = taunt;
    wrapper.querySelector(".zoom-content").prepend(tauntHeader);
  }

  // Fetch and show artist images
  try {
    // Fetch all images for the artist only (not filtered by tags)
    posts = await import("./api.js").then((api) =>
      api.fetchAllArtistImages(artist.artistName, [], { limit: 200 })
    );
    // If artist has a thumbnailUrl, prepend it as the first image if not already present
    if (artist.thumbnailUrl) {
      const thumbUrl = artist.thumbnailUrl;
      const alreadyIncluded = posts.some(
        (p) => api.buildImageUrl(p.large_file_url || p.file_url) === thumbUrl
      );
      if (!alreadyIncluded) {
        posts.unshift({
          large_file_url: thumbUrl,
          tag_string: "thumbnail",
          file_url: thumbUrl,
        });
      }
    }
    if (!posts || posts.length === 0) {
      showNoEntries();
      return;
    }
    // Show the first image (thumbnail or first post)
    tryShow(0);
  } catch (error) {
    showNoEntries("Error loading images for this artist.");
  }
  tagList.style.display = "block";
  topTags.style.display = "block";
  tagList.setAttribute("aria-live", "polite");
  topTags.setAttribute("aria-live", "polite");
  zoomed.setAttribute("tabindex", "0");
  zoomed.setAttribute("aria-label", "Artist image, click to toggle tags");

  // --- AESTHETIC TWEAKS & HUMILIATION ---
  // Add sparkle/heart overlay to modal
  if (wrapper && !wrapper.querySelector(".sparkle-overlay")) {
    const sparkle = document.createElement("div");
    sparkle.className = "sparkle-overlay";
    sparkle.style.position = "absolute";
    sparkle.style.top = "0";
    sparkle.style.left = "0";
    sparkle.style.width = "100%";
    sparkle.style.height = "100%";
    sparkle.style.pointerEvents = "none";
    sparkle.style.zIndex = "1";
    sparkle.style.backgroundImage =
      "url('icons/sparkle.png'), url('icons/bow.png')";
    sparkle.style.backgroundRepeat = "repeat";
    sparkle.style.opacity = "0.18";
    wrapper.appendChild(sparkle);
  }
  // Add humiliating taunt to modal header
  if (wrapper && !wrapper.querySelector(".taunt-header")) {
    const taunt = document.createElement("div");
    taunt.className = "taunt-header";
    taunt.style.fontFamily = "'Hi Melody', sans-serif";
    taunt.style.fontSize = "1.5em";
    taunt.style.color = "#fd7bc5";
    taunt.style.textAlign = "center";
    taunt.style.margin = "1em 0 0.5em 0";
    taunt.innerHTML =
      'You really think you deserve to see more? <span style="color:#a0005a;font-size:1.2em;">Pathetic.</span> 💖✨';
    wrapper.insertBefore(taunt, wrapper.firstChild);
  }
  // Style reload/copy buttons with playful tooltips
  document.querySelectorAll(".reload-button").forEach((btn) => {
    btn.style.background = "linear-gradient(90deg, #fd7bc5 0%, #ff63a5 100%)";
    btn.style.borderRadius = "2em";
    btn.style.color = "#fff";
    btn.style.fontFamily = "'Hi Melody', sans-serif";
    btn.style.fontSize = "1.1em";
    btn.style.boxShadow = "0 2px 8px #fd7bc540";
    btn.title = "Desperate for more?";
  });
  document.querySelectorAll(".copy-button").forEach((btn) => {
    btn.style.background = "linear-gradient(90deg, #fff0fa 0%, #fd7bc5 100%)";
    btn.style.borderRadius = "2em";
    btn.style.color = "#a0005a";
    btn.style.fontFamily = "'Hi Melody', sans-serif";
    btn.style.fontSize = "1.1em";
    btn.style.boxShadow = "0 2px 8px #fd7bc540";
    btn.title = "Copying again? How needy.";
  });
  // Add shame badge to artists with few images
  document.querySelectorAll(".artist-card").forEach((card) => {
    const nameDiv = card.querySelector(".artist-name");
    const imgCount = card.artist && card.artist._totalImageCount;
    if (
      imgCount !== undefined &&
      imgCount < 5 &&
      !card.querySelector(".shame-badge")
    ) {
      const badge = document.createElement("span");
      badge.className = "shame-badge";
      badge.textContent = "Shame: Only " + imgCount + " pics";
      badge.style.background = "#fd7bc5";
      badge.style.color = "#fff";
      badge.style.fontFamily = "'Hi Melody', sans-serif";
      badge.style.fontSize = "0.9em";
      badge.style.borderRadius = "1em";
      badge.style.padding = "0.2em 0.8em";
      badge.style.marginLeft = "1em";
      nameDiv.appendChild(badge);
    }
  });
  // Add lipstick kiss watermark to modal background
  if (wrapper && !wrapper.querySelector(".lipstick-kiss")) {
    const kiss = document.createElement("div");
    kiss.className = "lipstick-kiss";
    kiss.style.position = "absolute";
    kiss.style.bottom = "24px";
    kiss.style.right = "32px";
    kiss.style.width = "64px";
    kiss.style.height = "64px";
    kiss.style.backgroundImage = "url('icons/bow.png')";
    kiss.style.backgroundSize = "contain";
    kiss.style.backgroundRepeat = "no-repeat";
    kiss.style.opacity = "0.35";
    wrapper.appendChild(kiss);
  }
  // Add random taunt to empty states and tooltips
  if (noEntriesMsg) {
    const taunts = [
      "No images? Maybe you should try harder. 💔",
      "Not even Danbooru can help you. Tragic.",
      "Did you really expect more? How embarrassing.",
      "Keep searching, maybe you'll get lucky. Doubt it.",
      "Shame! Not a single pic for you.",
    ];
    const randomTaunt = taunts[Math.floor(Math.random() * taunts.length)];
    noEntriesMsg.innerHTML += `<br><span style='font-size:1.1em;color:#fd7bc5;'>${randomTaunt}</span>`;
  }
  // Add playful tooltips to sort/filter controls
  document
    .querySelectorAll(
      ".browse-btn, .sort-controls select, .sort-controls button"
    )
    .forEach((el) => {
      el.title = "Sorting again? You must be desperate.";
      el.style.fontFamily = "'Hi Melody', sans-serif";
      el.style.borderRadius = "2em";
      el.style.background = "linear-gradient(90deg, #fff0fa 0%, #fd7bc5 100%)";
      el.style.color = "#a0005a";
    });
  // Add playful tooltips to tag buttons
  document.querySelectorAll(".tag-btn, .tag-button").forEach((el) => {
    el.title = "Tagging up? You really want it all, don't you?";
    el.style.fontFamily = "'Hi Melody', sans-serif";
    el.style.borderRadius = "2em";
    el.style.background = "linear-gradient(90deg, #fd7bc5 0%, #ff63a5 100%)";
    el.style.color = "#fff";
  });
  // Animate shame badge for extra humiliation
  document.querySelectorAll(".shame-badge").forEach((badge) => {
    badge.style.animation = "shamePulse 1.2s infinite";
    badge.title = "So few images? Shameful.";
  });
  // Animate sparkles overlay
  if (wrapper) {
    const sparkleOverlay = wrapper.querySelector(".sparkle-overlay");
    if (sparkleOverlay) {
      sparkleOverlay.style.animation = "sparkleMove 8s linear infinite";
    }
  }
}

// There are no syntax errors or duplicate function declarations in this file now.
// However, to ensure robust compilation and runtime behavior, check the following:

// 1. Only one definition of getPaginationInfo exists (you already removed the duplicate).
// lazyLoadBestImage: used by renderArtistCards
// openArtistZoom: exported, used by renderArtistCards and sidebar.js
// getFilteredArtists: exported, not used internally (for external use)
// setArtistsPerPage: exported, not used internally (for external use)
// renderArtistsPage: exported, used by setSortMode, forceSortAndRender, setArtistsPerPage, filterArtists, and internally
// renderArtistCards: used by renderArtistsPage, showTopArtistsByTagCount
// getPaginationInfo: exported, used by main.js (infinite scroll), showTopArtistsByTagCount
// filterArtists: exported, used by main.js, tags.js, and internally
// showTopArtistsByTagCount: exported, used by addTopTagCountButton
// addTopTagCountButton: used by initGallery
// initGallery: exported, used by main.js
// setSortMode: exported, used by main.js, filterArtists, showTopArtistsByTagCount
// forceSortAndRender: exported, used by main.js
// setAllArtists: exported, used by main.js
// setGetActiveTagsCallback: exported, used by main.js
// setGetArtistNameFilterCallback: exported, used by main.js
// setSortPreference: exported, used by main.js

// No unused or undefined functions in this file.

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
  artistsPerPage = Math.max(10, count);
  currentPage = 1;
  renderArtistsPage();
}

/**
 * Renders the current page of artists, with pagination.
 */
function renderArtistsPage() {
  const start = (currentPage - 1) * artistsPerPage;
  const end = start + artistsPerPage;
  const artistsToShow = filtered.slice(0, end);
  renderArtistCards(artistsToShow);

  // Pagination: Show "Show More" button if there are more artists
  if (filtered.length > end) {
    let showMoreBtn = document.getElementById("show-more-artists-btn");
    if (!showMoreBtn) {
      showMoreBtn = document.createElement("button");
      showMoreBtn.id = "show-more-artists-btn";
      showMoreBtn.className = "browse-btn";
      showMoreBtn.textContent = "Show More Artists";
      showMoreBtn.style.display = "block";
      showMoreBtn.style.margin = "2em auto";
      showMoreBtn.onclick = () => {
        currentPage++;
        renderArtistsPage();
      };
      artistGallery.appendChild(showMoreBtn);
    }
  } else {
    const btn = document.getElementById("show-more-artists-btn");
    if (btn) btn.remove();
  }
}

// Helper to render a list of artists using the normal card structure
function renderArtistCards(artists) {
  if (!artistGallery) return;
  artistGallery.innerHTML = "";
  // Use DocumentFragment for performance
  const frag = document.createDocumentFragment();
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

    // Add humiliation overlay on hover
    card.addEventListener("mouseenter", () => {
      let overlay = card.querySelector(".gallery-humiliation-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "gallery-humiliation-overlay";
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "10";
        overlay.style.opacity = "0.18";
        overlay.style.backgroundImage =
          Math.random() > 0.5
            ? "url('icons/heart.png')"
            : "url('icons/lipstick.png')";
        overlay.style.backgroundRepeat = "repeat";
        card.appendChild(overlay);
        setTimeout(() => overlay.remove(), 1200);
      }
    });

    card.append(img, name, taglist, tagCountDiv, copyBtn, reloadBtn);
    frag.appendChild(card);
  });
  artistGallery.appendChild(frag);
}

function getPaginationInfo() {
  const total = filtered.length;
  const shown = Math.min(currentPage * artistsPerPage, total);
  return {
    total,
    shown,
    hasMore: shown < total,
    currentPage,
    artistsPerPage,
  };
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

// Optionally, expose this function for UI integration
export { showTopArtistsByTagCount };

if (typeof window !== "undefined" && typeof window.kexplorer === "object") {
  window.kexplorer.showTopArtistsByTagCount = showTopArtistsByTagCount;
}

let lastSortMode = null;

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
  // Patch: remember last sort mode
  const sortSelect = document.querySelector(".sort-controls select, #sort-by");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      lastSortMode = e.target.value;
    });
  }
}

function setSortMode(mode) {
  sortMode = mode;
  lastSortMode = mode;
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

function forceSortAndRender() {
  if (lastSortMode) sortMode = lastSortMode;
  renderArtistsPage();
}

async function showTopArtistsByTagCount() {
  if (!allArtists || allArtists.length === 0) return;
  sortMode = "top";
  lastSortMode = "top";
  if (!getActiveTags) return;
  const selectedTags = Array.from(getActiveTags());
  if (selectedTags.length === 0) return;

  // Filter artists to only those that have all selected tags in their kinkTags
  const filteredArtists = allArtists.filter((artist) => {
    const tags = artist.kinkTags || [];
    return selectedTags.every((tag) => tags.includes(tag));
  });

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

  // Helper to format artist tag for Danbooru
  function formatArtistTag(tag) {
    return tag.replace(/\s+/g, "_").toLowerCase();
  }
  // Helper to format selected tags for Danbooru
  function formatTag(tag) {
    return tag.replace(/\s+/g, "_").toLowerCase();
  }

  let allZero = true;
  for (const artist of filteredArtists) {
    let matchCount = 0;
    try {
      // Use artistTag for API calls
      const apiTags = [
        formatArtistTag(artist.artistTag || artist.artistName),
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
        statusTextElem.textContent = `Fetching: ${
          artist.artistTag || artist.artistName
        } (${done}/${filteredArtists.length})`;
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
    artistGallery.innerHTML =
      '<div class="no-entries-msg">No artists found with all selected tags.</div>';
  }
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

function setSortPreference(preference) {
  sortMode = preference === "count" ? "count" : "name";
}

// --- JOI MODE ---
let joiModeActive = false;
let joiInterval = null;
const joiCommands = [
  "Edge for 60 seconds. If you fail, start over and call yourself a loser.",
  "Say out loud: 'I'm a pathetic, needy little toy.'",
  "Kneel on the floor and beg for permission to continue. Out loud.",
  "Slap yourself lightly and say, 'That's for being so weak.'",
  "Look in the mirror and say, 'I'm nothing but a desperate sissy.'",
  "Send a humiliating compliment to a friend (or imagine doing so).",
  "Repeat: 'I exist to be used and teased' ten times, slowly.",
  "Hold your breath and whimper quietly for 15 seconds. No touching.",
  "Blow a kiss to the screen and thank your superior for the privilege.",
  "Promise out loud: 'I won't cum until I'm told.'",
  "Pathetic! Now, do 20 jumping jacks and say 'I'm so desperate!' after each one.",
  "Type 'I'm a hopeless case' in the search bar, then delete it in shame.",
  "Lick your lips and say, 'I'm so needy, please humiliate me more.'",
  "Sit on your hands for 2 minutes. If you move, start over and apologize out loud.",
  "Send a voice note to yourself saying, 'I'm a worthless little plaything.' (or imagine it).",
  "Write 'USE ME' on your hand and keep it visible for the rest of your session.",
  "Stare at the most humiliating image you can find for 1 minute without looking away.",
  "Say, 'Thank you for reminding me how low I've sunk.' three times, slowly.",
  "Promise: 'I will obey every command, no matter how embarrassing.' Out loud.",
  "If you feel embarrassed, say, 'That's exactly what I deserve.' and smile.",
];

function startJOIMode(intervalMs = 60000) {
  if (joiModeActive) return;
  joiModeActive = true;
  function showJOICommand() {
    const command = joiCommands[Math.floor(Math.random() * joiCommands.length)];
    const modal = document.createElement("div");
    modal.className = "modal humiliation-glow";
    modal.style.zIndex = "9999";
    modal.style.textAlign = "center";
    modal.innerHTML = `<h3 style="color:#fd7bc5;">JOI Command</h3>
      <div style="font-size:1.3em;margin:1em 0;">${command}</div>
      <button class="browse-btn" style="margin-top:1em;">Done</button>`;
    modal.querySelector("button").onclick = () => modal.remove();
    document.body.appendChild(modal);
    // Increase meter for every command shown
    if (typeof window.incrementDesperationMeter === "function") {
      window.incrementDesperationMeter(3);
    }
  }
  joiInterval = setInterval(showJOICommand, intervalMs);
  showJOICommand();
}

function stopJOIMode() {
  joiModeActive = false;
  if (joiInterval) clearInterval(joiInterval);
}

// Expose JOI mode globally
if (typeof window !== "undefined") {
  window.startJOIMode = startJOIMode;
  window.stopJOIMode = stopJOIMode;
}

function showZoomTauntOverlay() {
  let old = document.getElementById("taunt-overlay");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "taunt-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.display = "flex";
  overlay.style.alignItems = "flex-start";
  overlay.style.justifyContent = "center";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "13000";
  const taunt = document.createElement("div");
  taunt.className = "taunt-header";
  taunt.style.fontFamily = "'Hi Melody', sans-serif";
  taunt.style.fontSize = "1.8em";
  taunt.style.color = "#fd7bc5";
  taunt.style.textAlign = "center";
  taunt.style.margin = "2.5em 0 0 0";
  taunt.style.background = "rgba(255,255,255,0.94)";
  taunt.style.borderRadius = "2em";
  taunt.style.boxShadow = "0 2px 24px rgba(253,123,197,0.15)";
  taunt.style.padding = "0.6em 1.5em";
  taunt.innerHTML =
    'You really think you deserve to see more? <span style="color:#a0005a;font-size:1.2em;">Pathetic.</span> 💖✨';
  overlay.appendChild(taunt);
  document.body.appendChild(overlay);
}
function hideZoomTauntOverlay() {
  const old = document.getElementById("taunt-overlay");
  if (old) old.remove();
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
  getPaginationInfo,
  getFilteredArtists,
  setArtistsPerPage,
  hideZoomTauntOverlay,
};
