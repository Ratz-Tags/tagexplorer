import { createFullscreenViewer, createSpinner } from "./ui.js";
import {
  fetchArtistImages,
  clearArtistCache,
  buildImageUrl,
  fetchAllArtistImages,
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
        blur.style.opacity = "0.7";
        return;
      }
      // Restore randomized backgrounds
      const { getRandomBackgroundImage } = await import("./api.js");
      const imageUrl = await getRandomBackgroundImage();
      if (imageUrl) {
        blur.style.backgroundImage = `url(${imageUrl})`;
        blur.style.backgroundColor = "";
      } else {
        blur.style.backgroundColor = "#111";
      }
      // Fade in new background
      setTimeout(() => {
        blur.style.opacity = "0.7";
      }, 100);
    } catch (error) {
      console.warn("Failed to set random background:", error);
      blur.style.backgroundColor = "#111";
      blur.style.opacity = "0.7";
    }
  }, 400);
  try {
    if (document.body.classList.contains("incognito-theme")) {
      blur.style.backgroundImage = "none";
      blur.style.backgroundColor = "#111";
      return; // don't fetch image in incognito
    }
    // Restore randomized backgrounds
    const { getRandomBackgroundImage } = await import("./api.js");
    const imageUrl = await getRandomBackgroundImage();
    if (imageUrl) {
      blur.style.backgroundImage = `url(${imageUrl})`;
      blur.style.backgroundColor = "";
    } else {
      blur.style.backgroundColor = "#111";
    }
  } catch (error) {
    console.warn("Failed to set random background:", error);
    blur.style.backgroundColor = "#111";
  }
  setTimeout(() => { blur.style.opacity = "0.7"; }, 700);
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

  // --- UI/UX IMPROVEMENTS FOR ZOOMED MODAL ---
  // Only apply image-specific visual styles that do not affect layout; let CSS handle layout and flexbox
  zoomed.style.maxWidth = '90vw';
  zoomed.style.maxHeight = '75vh';
  zoomed.style.width = 'auto';
  zoomed.style.height = 'auto';
  zoomed.style.boxShadow = '0 4px 32px #fd7bc540';
  zoomed.style.borderRadius = '1.2em';
  zoomed.style.background = '#fff0fa';
  zoomed.style.zIndex = '10';

  // Do not override tagList/topTags layout or display here; let CSS and modal structure handle it
    if (tagList && tagList.nextSibling !== topTags) {
      tagList.parentNode.insertBefore(topTags, tagList.nextSibling);
    }
    // Shrink individual tag font size
    setTimeout(() => {
      topTags.querySelectorAll('.zoom-top-tag').forEach(el => {
        el.style.fontSize = '0.93em';
        el.style.margin = '0 0.4em';
        el.style.display = 'inline-block';
        el.style.padding = '0.1em 0.7em';
        el.style.background = '#fd7bc510';
        el.style.borderRadius = '1em';
      });
    }, 0);
  // Remove excessive white area from modal content
  if (wrapper && wrapper.querySelector('.zoom-content')) {
    const content = wrapper.querySelector('.zoom-content');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'flex-start';
    content.style.padding = '0.5em 0.5em 0.5em 0.5em';
    content.style.background = 'rgba(255,255,255,0.97)';
    content.style.minWidth = 'unset';
    content.style.maxWidth = '90vw';
    content.style.boxShadow = '0 2px 24px #fd7bc520';
    content.style.borderRadius = '1.5em';
  }

  let currentIndex = 0;
  let posts = [];

  // In-memory cache for top tags (limit to 20 artists per session)
  const topTagsCache = new Map();
  const TOP_TAGS_CACHE_LIMIT = 20;
  let artistTopTags = [];

  function showNoEntries(
    message = "No images found for this artist."
  ) {
    zoomed.style.display = "none";
    noEntriesMsg.style.display = "block";
    noEntriesMsg.textContent = message;
  }

  function processApiData(data) {
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
      if (topTags) {
        if (artistTopTags && artistTopTags.length > 0) {
          topTags.innerHTML = "<strong>Top Tags:</strong><br>";
          artistTopTags.forEach(({ tag, count }) => {
            const tagDiv = document.createElement("div");
            tagDiv.className = "zoom-top-tag";
            tagDiv.textContent = `${tag.replace(/_/g, " ")} (${count})`;
            topTags.appendChild(tagDiv);
          });
          topTags.style.display = "block";
        } else {
          topTags.innerHTML =
            "<strong>Top Tags:</strong> <span style='opacity:0.6;'>None found</span>";
          topTags.style.display = "block";
        }
      }
    }

    if (validPosts.length === 0) {
      showNoEntries("No images found for this artist.");
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
        // Rebuild tag list as wrapped pill elements instead of one long line
        tagList.innerHTML = '';
        raw.tag_string.split(' ').forEach(t => {
          if(!t) return;
          const pill = document.createElement('span');
            pill.className = 'zoom-tag-pill';
            pill.textContent = t.replace(/_/g,' ');
            tagList.appendChild(pill);
        });
        tagList.style.display = 'flex';
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

  // --- ZOOM TOOLBAR (Focus / Tags / Go to Danbooru) ---
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
      // Reflect state for accessibility
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

  // Add overlay above zoom modal
  showZoomTauntOverlay();

  // --- HUMILIATION: Add taunt header to zoom modal ---
  if (wrapper && !wrapper.querySelector(".taunt-header")) {
    (async () => {
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
    })();
  }

  // Fetch and show ALL images for the artist, regardless of selected tags
  (async () => {
    try {
      const api = await import("./api.js");
      posts = await api.fetchAllArtistImages(artist.artistName, [], { limit: 200 });
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
  })();
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
    sparkle.style.opacity = "0.025";
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
function renderArtistCards(artists, selectedTagsOverride) {
  if (!artistGallery) return;
  artistGallery.innerHTML = "";
  const frag = document.createDocumentFragment();
  // Determine the selected tags to use for cache keys / reload
  const selectedTags = selectedTagsOverride || (getActiveTags ? Array.from(getActiveTags()) : []);
  artists.forEach((artist) => {
    const card = document.createElement("div");
    card.className = "artist-card";
    // Store the raw artist tag for patches/overlays
    card.setAttribute("data-artist", artist.artistName);

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
    // Preload image for zoom
    img.addEventListener("click", () => {
      const preload = new Image();
      preload.src = img.src;
      preload.onload = () => openArtistZoom(artist);
      preload.onerror = () => openArtistZoom(artist);
    });

    // Media wrapper so card background transparency doesn't affect the image
    const media = document.createElement("div");
    media.className = "artist-media";
    media.appendChild(img);

    const name = document.createElement("div");
    name.className = "artist-name";
    const total = typeof artist.postCount === "number" ? artist.postCount : undefined;
    if (typeof total === "number") {
      name.textContent = `${artist.artistName.replace(/_/g, " ")} [${total}]`;
    } else {
      name.textContent = `${artist.artistName.replace(/_/g, " ")} [Loading…]`;
    }

    // Render tags as .gallery-tag (collapsed by default)
    const taglist = document.createElement("div");
    taglist.className = "artist-tags";
    const tagsId = `tags-${artist.artistName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    taglist.id = tagsId;
    taglist.hidden = true; // hidden by default, revealed via toggle
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
    copyBtn.onclick = (e) => { e.stopPropagation(); handleArtistCopy(artist, img.src); };

    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.className = "reload-button";
    reloadBtn.setAttribute("aria-label", "Reload artist");
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

    // Toggle to reveal/hide tags
    const tagsToggle = document.createElement("button");
    tagsToggle.type = "button";
    tagsToggle.className = "tags-toggle";
    tagsToggle.setAttribute("aria-controls", tagsId);
    tagsToggle.setAttribute("aria-expanded", "false");
    tagsToggle.title = "Show tags";
    tagsToggle.textContent = "🏷️";
    tagsToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = taglist.hasAttribute("hidden");
      if (isHidden) {
        taglist.removeAttribute("hidden");
        tagsToggle.setAttribute("aria-expanded", "true");
        tagsToggle.title = "Hide tags";
      } else {
        taglist.setAttribute("hidden", "");
        tagsToggle.setAttribute("aria-expanded", "false");
        tagsToggle.title = "Show tags";
      }
    });

    // Action bar (side-by-side small buttons)
    const actions = document.createElement("div");
    actions.className = "artist-actions";
    actions.appendChild(copyBtn);
    actions.appendChild(reloadBtn);
    actions.appendChild(tagsToggle);

    // Footer at the bottom with name + actions
    const footer = document.createElement("div");
    footer.className = "artist-footer";
    footer.appendChild(name);
    footer.appendChild(actions);

    // Assemble card
    card.appendChild(media);
    card.appendChild(footer);
    card.appendChild(taglist);

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
    if (activeTags.size === 0) {
      filtered = allArtists.filter((artist) =>
        artist.artistName.toLowerCase().includes(artistNameFilter) ||
        artistNameFilter === ""
      );
    } else {
      filtered = allArtists.filter((artist) => {
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
    } else if (sortMode === "top") {
      filtered.sort((a, b) => {
        if ((b._selectedTagMatchCount || 0) !== (a._selectedTagMatchCount || 0)) {
          return (b._selectedTagMatchCount || 0) - (a._selectedTagMatchCount || 0);
        }
        return a.artistName.localeCompare(b.artistName, undefined, { sensitivity: "base" });
      });
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

  // Only include artists that have ALL selected tags (AND logic)
  const artistsWithCounts = allArtists
    .filter((artist) => {
      const tags = artist.kinkTags || [];
      return selectedTags.every((tag) => tags.includes(tag));
    })
    .map((artist) => {
      const tags = artist.kinkTags || [];
      let tagCounts = {};
      selectedTags.forEach((tag) => {
        tagCounts[tag] = tags.filter((t) => t === tag).length || 1;
      });
      return { ...artist, _selectedTagMatchCount: selectedTags.length, _selectedTagCounts: tagCounts };
    });

  // Sort by name (since all have same match count)
  artistsWithCounts.sort((a, b) =>
    a.artistName.localeCompare(b.artistName, undefined, { sensitivity: "base" })
  );

  // Show a summary of how many artists are displayed
  const summaryDiv = document.createElement("div");
  summaryDiv.className = "filtered-results-summary";
  summaryDiv.style.margin = "1em 0 1em 0";
  summaryDiv.style.fontFamily = "'Hi Melody', sans-serif";
  summaryDiv.style.fontSize = "1.1em";
  summaryDiv.style.color = "#a0005a";
  summaryDiv.textContent = `Showing ${artistsWithCounts.length} artist${artistsWithCounts.length === 1 ? '' : 's'} matching ALL selected tags.`;
  artistGallery.innerHTML = "";
  artistGallery.appendChild(summaryDiv);

  if (artistsWithCounts.length > 0) {
    renderArtistCards(artistsWithCounts, selectedTags);
  } else {
    artistGallery.innerHTML +=
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
  overlay.style.margin = "-1em";
  overlay.style.zIndex = "13000";
  const taunt = document.createElement("div");
  taunt.className = "taunt-header";
  taunt.style.fontFamily = "'Hi Melody', sans-serif";
  taunt.style.fontSize = "0.8em";
  taunt.style.color = "#fd7bc5";
  taunt.style.textAlign = "center";
  taunt.style.margin = "2.5em 0 0 0";
  taunt.style.background = "rgba(255,255,255,0.5)";
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
  showTopArtistsByTagCount,
  openArtistOnDanbooru
};
