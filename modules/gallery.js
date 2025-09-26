import { createFullscreenViewer, createSpinner } from "./ui.js";
import {
  fetchArtistImages,
  clearArtistCache,
  buildImageUrl,
  fetchAllArtistImages,
  getArtistImageCount,
} from "./api.js";
import { handleArtistCopy } from "./sidebar.js";

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
const DEFAULT_ARTISTS_PER_PAGE = 100;
const MAX_PAGES_IN_DOM = 6;

let filtered = [];
let isFetching = false;
let sortMode = "name";
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

// External dependencies
let allArtists = [];
let getActiveTags = null;
let getArtistNameFilter = null;

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
}

function ensureGallerySentinel() {
  if (!artistGallery) return null;
  if (!gallerySentinel || !artistGallery.contains(gallerySentinel)) {
    gallerySentinel = document.createElement("div");
    gallerySentinel.id = "gallery-end-sentinel";
    gallerySentinel.className = "gallery-sentinel";
    gallerySentinel.setAttribute("aria-hidden", "true");
    artistGallery.appendChild(gallerySentinel);
  } else if (artistGallery.lastElementChild !== gallerySentinel) {
    artistGallery.appendChild(gallerySentinel);
  }
  return gallerySentinel;
}
function removePageFromDom(pageNumber) {
  if (!artistGallery) return;
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
}

function sortCurrentArtists(list = filtered, mode = sortMode) {
  if (!Array.isArray(list) || !list.length) return list;
  const activeMode = mode === "count" ? "count" : "name";
  if (activeMode === "count") {
    list.sort(
      (a, b) => (b._totalImageCount || 0) - (a._totalImageCount || 0)
    );
  } else {
    list.sort((a, b) =>
      a.artistName.localeCompare(b.artistName, undefined, {
        sensitivity: "base",
      })
    );
  }
  return list;
}

/**
 * Sets the background image with a random image
 */
async function setRandomBackground() {
  const blur = document.getElementById("background-blur");
  if (!blur) return;
  blur.style.transition = "background-image 0.7s ease, opacity 0.7s ease";
  // Fade out current background
  blur.style.opacity = "0";
  setTimeout(async () => {
    try {
      if (document.body.classList.contains("incognito-theme")) {
        blur.style.backgroundImage = "none";
        blur.style.backgroundColor = "#111";
      } else {
        const { getRandomBackgroundImage } = await import("./api.js");
        const imageUrl = await getRandomBackgroundImage();
        if (imageUrl) {
          blur.style.backgroundImage = `url(${imageUrl})`;
          blur.style.backgroundColor = "";
        } else {
          blur.style.backgroundImage = "none";
          blur.style.backgroundColor = "#111";
        }
      }
    } catch (error) {
      console.warn("Failed to set random background:", error);
      blur.style.backgroundImage = "none";
      blur.style.backgroundColor = "#111";
    } finally {
      setTimeout(() => {
        blur.style.opacity = "0.7";
      }, 100);
    }
  }, 400);
}

/**
 * Sets the best image for an artist with caching and lazy loading
 */
function setBestImage(artist, img) {
  if (!img || img._loadingImage) {
    return;
  }

  const artistData = artist || img.__artistData;
  if (!artistData || !artistData.artistName) {
    return;
  }

  img._loadingImage = true;

  const cacheKey = `danbooru-image-${artistData.artistName}`;
  const cachedUrl = localStorage.getItem(cacheKey);

  const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];

  // API cache key matches the format used in api.js fetchArtistImages
  const cacheSignature = "p1l200oapprovals"; // Default: page=1, limit=200, order=approvals
  const apiCacheKey = `danbooru-api-${artistData.artistName}-${cacheSignature}`;

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
        // Wait briefly to allow any rate-limited requests to complete before giving up
        const WAIT_MS = 700; // small grace period
        setTimeout(() => {
          fetchArtistImages(artistData.artistName)
            .then((fallbackData) => {
              processApiData(fallbackData, true);
            })
            .catch(() => {
              showNoEntries();
            });
        }, WAIT_MS);
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
        artistData._thumbnailPostId = validPosts[index]?.id;
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

    fetchArtistImages(artistData.artistName, selectedTags)
      .then((data) => {
        setApiCache(data);
        processApiData(data);
      })
      .catch(() => {
        img.src = "fallback.jpg";
      });
  }
}

function lazyLoadBestImage(artist, img) {
  if (typeof IntersectionObserver !== "function") {
    setBestImage(artist, img);
    return;
  }

  const observer = initImageObserver();
  observer.observe(img);
  img._lazyObserver = observer;
}

// Function called by the intersection observer
function loadArtistImage(img) {
  if (!img || img._loadingImage) return;
  
  const artistData = img.__artistData;
  if (!artistData) return;
  
  setBestImage(artistData, img);
}

function primeVisibleArtistImages(buffer = 180) {
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
  let posts = [];
  let page = 1;
  let zoomTotalPages = Infinity;
  let loading = false;
  let currentIndex = 0;
  const selectedTags = getActiveTags ? Array.from(getActiveTags()) : [];
  const allPostsCacheKey = `allPosts-${artist.artistName}-${selectedTags.join(",")}`;

  // Module-scope TTL helpers are used: getWithTTL / setWithTTL / removeWithTTL

  // Try to reuse cached full-post lists for this artist + tag signature (TTL-aware)
  try {
    const cachedAll = getWithTTL(allPostsCacheKey);
    if (cachedAll && Array.isArray(cachedAll) && cachedAll.length > 0) {
      posts = cachedAll.slice();
      // compute total pages based on 40-per-page page size used below
      zoomTotalPages = Math.max(1, Math.ceil(posts.length / 40));
      // render first page immediately from cache
      const initial = posts.slice(0, 40);
      renderThumbs(initial, 0);
      page = Math.floor(posts.length / 40) + 1;
    }
  } catch (e) {
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
      const LIMIT = 40;

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

      const newPosts = await api.fetchArtistImages(artist.artistName, selectedTags, {
        limit: LIMIT,
        page,
        order: "approvals",
      });

      if (!Array.isArray(newPosts) || newPosts.length === 0) {
        zoomTotalPages = page - 1;
        return;
      }

      const start = posts.length;
      posts = posts.concat(newPosts);
      // Persist accumulated posts into session cache to reuse for fullscreen later
      try {
        // Persist accumulated posts into TTL-backed session cache to reuse for fullscreen later
        setWithTTL(allPostsCacheKey, posts, DEFAULT_ALLPOSTS_TTL_MS);
      } catch (e) {
        // ignore storage errors
      }

      renderThumbs(newPosts, start);
      page++;
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
      thumb.style.objectFit = "cover";
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

  showZoomTauntOverlay();

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
  const { force = false } = options;
  const totalPages = updatePaginationTotals();
  const maxPage = Math.max(1, totalPages || 0);
  const current = getCurrentPage();
  const page = Math.min(current, maxPage);
  if (page !== current) {
    setCurrentPage(page);
  }
  const start = (page - 1) * artistsPerPage;

  if (page === 1) {
    artistGallery.innerHTML = "";
    resetGallerySentinel();
    renderedPages.clear();
  } else if (force) {
    removePageFromDom(page);
  } else if (renderedPages.has(page)) {
    pruneGalleryPages(page);
    return;
  }

  if (filtered.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "gallery-empty-state";

    const title = document.createElement("p");
    title.className = "gallery-empty-state__title";
    title.textContent = "No artists for that combination";
    emptyState.appendChild(title);

    const body = document.createElement("p");
    body.className = "gallery-empty-state__body";
    body.textContent =
      "Use the FILTER command above or clear your tags to coax new prey back into view.";
    emptyState.appendChild(body);

    artistGallery.appendChild(emptyState);
    return;
  }

  if (start >= filtered.length) {
    ensureGallerySentinel();
    pruneGalleryPages(page);
    return;
  }

  const end = Math.min(start + artistsPerPage, filtered.length);
  const artistsToShow = filtered.slice(start, end);

  if (artistsToShow.length > 0) {
    renderArtistCards(artistsToShow, undefined, page);
    renderedPages.add(page);
  } else {
    // No artists for this page; roll back the page counter and sentinel
    setCurrentPage(page - 1, { persist: true });
    ensureGallerySentinel();
    return;
  }

  pruneGalleryPages(getCurrentPage());
}

// Intersection observer for lazy loading images
let imageObserver = null;

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
      rootMargin: '100px', // Start loading 100px before the image is visible
      threshold: 0.01
    }
  );
  
  return imageObserver;
}

// Helper to render a list of artists using the normal card structure
function renderArtistCards(artists, selectedTagsOverride, pageNumber = 1) {
  if (!artistGallery) return;
  if (pageNumber > 0 && renderedPages.has(pageNumber)) {
    removePageFromDom(pageNumber);
  }
  const frag = document.createDocumentFragment();
  let eagerBudget = pageNumber === 1 ? 6 : 0; // Reduced from 12 to 6 for less initial load
  const selectedTags =
    selectedTagsOverride || (getActiveTags ? Array.from(getActiveTags()) : []);
  const observer = initImageObserver();
  
  artists.forEach((artist) => {
    const card = document.createElement("div");
    card.className = "artist-card group";
    card.dataset.page = String(pageNumber);
    card.setAttribute("data-artist", artist.artistName);

    const img = document.createElement("img");
    img.className = "artist-image";
    img.loading = "lazy";
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
        img.src = "fallback.jpg";
        img.style.display = "block";
      };
    } else {
      // Use intersection observer for lazy loading
      if (eagerBudget > 0) {
        eagerBudget -= 1;
        setBestImage(artist, img);
      } else {
        lazyLoadBestImage(artist, img);
      }
      img.style.display = "block";
    }
    img.addEventListener("click", () => {
      const preload = new Image();
      preload.src = img.src;
      preload.onload = () => openArtistZoom(artist);
      preload.onerror = () => openArtistZoom(artist);
    });

    const media = document.createElement("div");
    media.className = "artist-media";
    media.appendChild(img);

    const name = document.createElement("div");
    name.className = "artist-name";
    let displayName = artist.artistName.replace(/_/g, " ");
    const total =
      typeof artist.postCount === "number" ? artist.postCount : undefined;
    if (typeof total === "number") {
      displayName += ` [${total}]`;
    }
    name.textContent = displayName;

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
      e.stopPropagation();
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
      setTimeout(() => {
        if (typeof filterArtists === "function") {
          filterArtists(true, true);
        }
      }, 100);
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

    const actions = document.createElement("div");
    actions.className = "artist-actions";
    actions.appendChild(copyBtn);
    actions.appendChild(reloadBtn);
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

  const sentinel = ensureGallerySentinel();
  if (sentinel) {
    artistGallery.insertBefore(frag, sentinel);
  } else {
    artistGallery.appendChild(frag);
  }
  renderedPages.add(pageNumber);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => primeVisibleArtistImages());
  } else {
    primeVisibleArtistImages();
  }
}

function pruneGalleryPages(currentPage) {
  if (!artistGallery) return;
  const minimumPage = Math.max(1, currentPage - (MAX_PAGES_IN_DOM - 1));
  const cards = artistGallery.querySelectorAll(".artist-card[data-page]");
  const pagesRemoved = new Set();
  cards.forEach((card) => {
    const pageValue = parseInt(card.getAttribute("data-page") || "", 10);
    if (!Number.isNaN(pageValue) && pageValue < minimumPage) {
      card.remove();
      pagesRemoved.add(pageValue);
    }
  });
  pagesRemoved.forEach((page) => renderedPages.delete(page));
}

function getPaginationInfo() {
  const page = getCurrentPage();
  const total = filtered.length;
  const totalPages = getTotalPages();
  const shown = Math.min(page * pagination.perPage, total);
  const lastRenderedPage =
    renderedPages.size > 0
      ? Math.max(...renderedPages)
      : Math.max(0, pagination.current);
  return {
    total: total,
    shown: shown,
    hasMore: totalPages > 0 && page < totalPages,
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
    // Only reset currentPage if this is a true filter/search reset, not just paginating
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

    // Get active tags and filters
    const activeTags = getActiveTags ? getActiveTags() : new Set();
    const artistNameFilter = getArtistNameFilter ? getArtistNameFilter() : "";

    // Filter artists
    const sourceArtists = Array.isArray(allArtists) ? allArtists : [];

    if (activeTags.size === 0) {
      filtered = sourceArtists.filter((artist) =>
        artist.artistName.toLowerCase().includes(artistNameFilter) ||
        artistNameFilter === ""
      );
    } else {
      filtered = sourceArtists.filter((artist) => {
        const tags = artist.kinkTags || [];
        // Use AND logic (all tags must match) for main gallery filtering
        const tagMatch = Array.from(activeTags).every((tag) => tags.includes(tag));
        return (
          tagMatch &&
          (artist.artistName.toLowerCase().includes(artistNameFilter) ||
            artistNameFilter === "")
        );
      });
    }

    const recalculatedTotal = updatePaginationTotals();
    const maxPage = Math.max(1, recalculatedTotal || 0);
    if (getCurrentPage() > maxPage) {
      setCurrentPage(maxPage);
    }

    if (spinner.setTotal) spinner.setTotal(filtered.length);
    if (spinner.updateProgress) spinner.updateProgress(0);

    sortCurrentArtists();

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
        
        // Process batch in parallel (10 artists at once)
        await Promise.all(
          batch.map(async (artist) => {
            if (gen !== filterGeneration) return;
            try {
              // Use existing postCount if available, otherwise fetch from API
              const totalCount = artist.postCount || await getArtistImageCount(artist.artistName);
              artist._totalImageCount = totalCount;
              artist._imageCount = totalCount;
            } catch (e) {
              // If API fails, use fallback count
              artist._totalImageCount = artist.postCount || 0;
              artist._imageCount = artist.postCount || 0;
            }
          })
        );

        done += batch.length;
        if (spin && spin.updateProgress) spin.updateProgress(done);

        // Re-render every batch to show progress
        if (gen === filterGeneration) {
          sortCurrentArtists();
          renderArtistsPage({ force: true });
        }

        // Short delay between batches
        if (i + batchSize < artists.length) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (gen !== filterGeneration) return;

      sortCurrentArtists();
      renderArtistsPage({ force: true });
    }

    renderArtistsPage({ force: true }); // Render immediately

    if (reset) {
      await fetchInBatches(filtered, 10, 500, generation, spinner).catch(
        (e) => {
          console.error("Batch fetch failed:", e);
        }
      );
      if (generation !== filterGeneration) return;
      sortCurrentArtists();
      renderArtistsPage({ force: true });
    } else if (force) {
      fetchInBatches(filtered, 10, 500, generation, spinner).then(() => {
        if (generation !== filterGeneration) return;
        sortCurrentArtists();
        renderArtistsPage({ force: true });
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



// Export setBestImage for smoke testing in-browser
export { setBestImage as _test_setBestImage };

function setSortMode(mode, options = {}) {
  const { preservePage = false, deferRender = false } = options;
  sortMode = mode;
  lastSortMode = mode;
  sortCurrentArtists();
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
  const mode = preference === "count" ? "count" : "name";
  if (mode === sortMode) return;
  setSortMode(mode);
}


function showZoomTauntOverlay() {
  let old = document.getElementById("taunt-overlay");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "taunt-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "50%";
  overlay.style.transform = "translateX(-50%)";
  overlay.style.width = "auto";
  overlay.style.maxWidth = "95vw";
  overlay.style.height = "auto";
  overlay.style.display = "flex";
  overlay.style.alignItems = "flex-start";
  overlay.style.justifyContent = "center";
  overlay.style.pointerEvents = "none";
  overlay.style.margin = "0";
  overlay.style.zIndex = "13000";
  overlay.style.padding = "0.5em 0";
  const taunt = document.createElement("div");
  taunt.className = "taunt-header";
  taunt.style.fontFamily = "'Hi Melody', sans-serif";
  taunt.style.fontSize = window.innerWidth < 600 ? "1em" : "1.1em";
  taunt.style.color = "#fd7bc5";
  taunt.style.textAlign = "center";
  taunt.style.margin = "1.2em 0 0 0";
  taunt.style.background = "rgba(255,255,255,0.85)";
  taunt.style.borderRadius = "1.2em";
  taunt.style.boxShadow = "0 2px 16px rgba(253,123,197,0.13)";
  taunt.style.padding = window.innerWidth < 600 ? "0.7em 1.2em" : "0.8em 2.2em";
  taunt.style.maxWidth = "90vw";
  taunt.innerHTML =
    'You really think you deserve to see more? <span style="color:#a0005a;font-size:1.1em;">Pathetic.</span> 💖✨';
  overlay.appendChild(taunt);
  document.body.appendChild(overlay);
}
function hideZoomTauntOverlay() {
  const old = document.getElementById("taunt-overlay");
  if (old) old.remove();
}

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
  getPaginationInfo,
  getFilteredArtists,
  setArtistsPerPage,
  hideZoomTauntOverlay,
  openArtistOnDanbooru
};

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
