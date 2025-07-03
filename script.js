window._danbooruUnavailable = false;

function handleArtistCopy(artist, imgSrc) {
  // Remove underscores and copy as artist:artistTag
  const artistTag = artist.artistName.replace(/_/g, " ");
  const copyText = `artist:${artistTag}`;
  navigator.clipboard.writeText(copyText)
    .then(() => {
      showToast(`Copied: ${copyText}`);
      // Add to copied sidebar
      if (!copiedArtists.has(artist.artistName)) {
        copiedArtists.add(artist.artistName);
        updateCopiedSidebar();
      }
    })
    .catch(() => {
      showToast("Failed to copy!");
    });
}

function updateCopiedSidebar() {
  if (!copiedSidebar) return;
  copiedSidebar.innerHTML = "";
  copiedArtists.forEach(name => {
    const div = document.createElement("div");
    div.className = "copied-artist";
    div.textContent = name.replace(/_/g, " ");
    copiedSidebar.appendChild(div);
  });
}

function showNoEntriesMsg(element, msg = "No valid entries") {
  element.style.display = "none";
  let span = element.nextSibling;
  if (!span || !span.classList || !span.classList.contains('no-entries-msg')) {
    span = document.createElement("span");
    span.className = "no-entries-msg";
    span.style.color = "red";
    span.style.fontWeight = "bold";
    element.parentNode.insertBefore(span, element.nextSibling);
  }
  span.textContent = window._danbooruUnavailable ? "Danbooru unavailable" : msg;
  span.style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  const kinkTags = [
    "femdom", "chastity_cage", "trap",
    "anal_object_insertion", "prostate_milking", "gagged", "dominatrix", "humiliation", "lactation",
    "flat_chastity_cage", "used_condom", "orgasm_denial", "mind_break", "shibari", "object_insertion",
    "penis_milking", "small_penis_humiliation", "sex_machine", "foot_worship", "dildo_riding",
    "milking_machine", "huge_dildo", "spreader_bar", "large_insertion", "hand_milking", "cum_in_mouth",
    "gokkun", "knotting", "toe_sucking", "feminization", "hogtie", "bimbofication", "restraints",
    "sockjob", "tentacle_pit", "object_insertion_from_behind", "pouring_from_condom", "forced_feminization"
  ];

  const tagIcons = {
    "pegging": "icons/pegging.svg",
    "chastity_cage": "icons/chastity_cage.svg",
    "feminization": "icons/feminization.svg",
    "bimbofication": "icons/bimbofication.svg",
    "gagged": "icons/gagged.png",
    "tentacle_sex": "icons/tentacle_sex.png",
    "futanari": "icons/futanari.png",
    "mind_break": "icons/mind_break.png",
    "netorare": "icons/netorare.png"
  };

  const tagButtonsContainer = document.getElementById("tag-buttons");
  const artistGallery = document.getElementById("artist-gallery");
  const jrpgBubbles = document.getElementById("jrpg-bubbles");
  const backgroundBlur = document.getElementById("background-blur");
  const copiedSidebar = document.getElementById("copied-sidebar");
  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const moanAudio = document.getElementById("moan-audio");
  const tagSearchInput = document.getElementById("tag-search");
  const artistNameFilterInput = document.getElementById("artist-name-filter");
  let artistNameFilter = "";
  const clearTagsBtn = document.getElementById("clear-tags");
  let copiedArtists = new Set();
  let searchFilter = "";

  let currentTrack = 0;
  let moansMuted = false;

  const panelToggle = document.getElementById("audio-panel-toggle");
  const panel = document.getElementById("audio-panel");
  const trackName = document.getElementById("audio-track-name");
  const toggleBtn = document.getElementById("audio-toggle");
  const nextBtn = document.getElementById("audio-next");
  const prevBtn = document.getElementById("audio-prev");
  const moanBtn = document.getElementById("moan-mute");


  const audioFiles = [
    "Blank.mp3",
    "Filthy Habits.mp3",
    "Girl Factory.mp3",
    "Layer Zero.mp3",
    "Nipples.mp3",
    "Yes.mp3"
    // Add more audio files as needed
  ];
  const hypnoAudio = document.getElementById("hypnoAudio");

  function getAudioSrc(index) {
    return `audio/${audioFiles[index]}`;
  }

  function loadTrack(index) {
    hypnoAudio.src = getAudioSrc(index);
    trackName.textContent = audioFiles[index].replace(/\.mp3$/, "");
    hypnoAudio.play().catch(console.warn);
  }

  toggleBtn.addEventListener("click", () => {
    if (hypnoAudio.paused) {
      hypnoAudio.play();
      toggleBtn.textContent = "⏸️";
    } else {
      hypnoAudio.pause();
      toggleBtn.textContent = "▶️";
    }
  });

  nextBtn.addEventListener("click", () => {
    currentTrack = (currentTrack + 1) % audioFiles.length;
    loadTrack(currentTrack);
  });

  prevBtn.addEventListener("click", () => {
    currentTrack = (currentTrack - 1 + audioFiles.length) % audioFiles.length;
    loadTrack(currentTrack);
  });

  moanBtn.addEventListener("click", () => {
    moansMuted = !moansMuted;
    moanAudio.muted = moansMuted;
    moanBtn.textContent = moansMuted ? "🔈 Moan" : "🔇 Moan";
  });

  panelToggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  hypnoAudio.addEventListener("ended", () => {
    currentTrack = (currentTrack + 1) % audioFiles.length;
    loadTrack(currentTrack);
  });

  loadTrack(currentTrack);


  if (sidebarToggle && copiedSidebar) {
    sidebarToggle.addEventListener("click", () => {
      copiedSidebar.classList.toggle("visible");
    });
  }

  window.addEventListener("scroll", () => {
    if (window.scrollY > 100) {
      sidebarToggle.classList.add("pinned-visible");
    } else {
      sidebarToggle.classList.remove("pinned-visible");
    }
  });

  let activeTags = new Set();
  let allArtists = [];
  let tagTooltips = {};
  let tagTaunts = {};
  let taunts = [];

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-popup";
    toast.textContent = message;
    document.body.appendChild(toast);

    if (Math.random() < 0.4) {
      moanAudio.currentTime = 0;
      moanAudio.play().catch(() => { });
    }

    setTimeout(() => toast.remove(), 3000);
  }
  function postHasAllTags(post, tags) {
    if (!tags.length) return true;
    // Danbooru returns tags as a space-separated string in tag_string
    const tagArr = (post.tag_string || "").split(" ");
    return tags.every(tag => tagArr.includes(tag));
  }
  function setRandomBackground() {
    const query = "chastity_cage";
    const page = Math.floor(Math.random() * 5) + 1;

    fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(query)}+order:score&limit=40&page=${page}`)
      .then(res => res.json())
      .then(data => {
        if (data.length) {
          const post = data[Math.floor(Math.random() * data.length)];
          const validPosts = data.filter(post => post?.large_file_url || post?.file_url);
          const raw = validPosts[0];
          if (raw) {
            const url = raw.large_file_url || raw.file_url;
            const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
            backgroundBlur.style.backgroundImage = `url(${full})`;
          }
        }
      })
      .catch(() => {
        backgroundBlur.style.backgroundColor = "#111";
      });
  }

  function spawnBubble(tag) {
    const div = document.createElement("div");
    div.className = "jrpg-bubble";
    const chibi = document.createElement("img");
    chibi.src = "icons/chibi.png";
    chibi.className = "chibi";
    const line = document.createElement("span");
    const pool = tagTaunts[tag] || taunts;
    line.textContent = pool[Math.floor(Math.random() * pool.length)] || `Still chasing '${tag}' huh? You're beyond help.`;
    div.append(chibi, line);
    jrpgBubbles.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }

  function setBestImage(artist, img) {
    // Only use artist name for the query
    const tagQuery = artist.artistName;
    const cacheKey = `danbooru-image-${artist.artistName}`;
    const cachedUrl = localStorage.getItem(cacheKey);

    // Use activeTags for selected tags
    const selectedTags = Array.from(activeTags);

    // --- Add sessionStorage cache for Danbooru API results ---
    const apiCacheKey = `danbooru-api-${artist.artistName}-${selectedTags.join(",")}`;
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
      } catch { }
    }
    // ---------------------------------------------------------

    function showNoEntries() {
      img.style.display = 'none';
      let msg = img.nextSibling;
      if (!msg || !msg.classList.contains('no-entries-msg')) {
        msg = document.createElement("span");
        msg.className = "no-entries-msg";
        msg.style.color = "red";
        msg.style.fontWeight = "bold";
        msg.textContent = window._danbooruUnavailable
          ? "Danbooru unavailable"
          : "No valid entries";
        img.parentNode.insertBefore(msg, img.nextSibling);
      } else {
        msg.textContent = window._danbooruUnavailable
          ? "Danbooru unavailable"
          : "No valid entries";
      }
    }

    function tryLoadUrls(urls, index = 0) {
      if (index >= urls.length) {
        showNoEntries();
        return;
      }
      const url = urls[index];
      const testImg = new Image();
      testImg.onload = () => {
        img.src = url;
        img.style.display = '';
        if (img.nextSibling && img.nextSibling.classList?.contains('no-entries-msg')) {
          img.nextSibling.remove();
        }
        localStorage.setItem(cacheKey, url);
      };
      testImg.onerror = () => {
        console.warn("Failed to load image for artist", artist.artistName, url);
        tryLoadUrls(urls, index + 1);
      };
      testImg.src = url;
    }

    if (cachedUrl) {
      const testImg = new Image();
      testImg.onload = () => {
        img.src = cachedUrl;
        img.style.display = '';
        if (img.nextSibling && img.nextSibling.classList?.contains('no-entries-msg')) {
          img.nextSibling.remove();
        }
      };
      testImg.onerror = () => {
        localStorage.removeItem(cacheKey);
        fetchAndTry();
      };
      testImg.src = cachedUrl;
      return;
    }

    function fetchAndTry() {
      if (window._danbooruUnavailable) {
        showNoEntries();
        return;
      }

      // --- Use sessionStorage cache if available ---
      const cachedApiData = getApiCache();
      if (cachedApiData && Array.isArray(cachedApiData)) {
        processApiData(cachedApiData);
        return;
      }
      // --------------------------------------------

      // Only fetch with artist name and order:score
      fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagQuery)}+order:score&limit=1000`)
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) {
            showNoEntries();
            return;
          }
          // Only filter for images, not banned
          const validPosts = data.filter(post => {
            const url = post?.large_file_url || post?.file_url;
            const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
            return isImage && !post.is_banned;
          });
          const urls = validPosts.map(post => {
            const url = post.large_file_url || post.file_url;
            return url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
          });
          if (urls.length) {
            tryLoadUrls(urls);
          } else {
            showNoEntries();
          }
        })
        .catch(() => showNoEntries());
    }

    fetchAndTry();
  }
  function lazyLoadBestImage(artist, img) {
    if (img.dataset.loaded) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setBestImage(artist, img);
            img.dataset.loaded = "true";
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "100px" });
      observer.observe(img);
    } else {
      // Fallback: just load immediately
      setBestImage(artist, img);
      img.dataset.loaded = "true";
    }
  }

  function renderTagButtons() {
    tagButtonsContainer.innerHTML = "";

    // Get artists matching current filters
    let filteredArtists = allArtists.filter(artist => {
      const tags = artist.kinkTags || [];
      return (
        Array.from(activeTags).every(tag => tags.includes(tag)) &&
        (artist.artistName.toLowerCase().includes(artistNameFilter) || artistNameFilter === "")
      );
    });

    // Get all tags present in filtered artists
    let possibleTags = new Set();
    filteredArtists.forEach(artist => {
      (artist.kinkTags || []).forEach(tag => possibleTags.add(tag));
    });

    // Filter and sort tags
    let tagsToShow = kinkTags
      .filter(tag =>
        tag.toLowerCase().includes(searchFilter.trim().toLowerCase()) &&
        (possibleTags.has(tag) || activeTags.has(tag)) // always show selected tags
      )
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    if (tagsToShow.length === 0) {
      const emptyMsg = document.createElement("span");
      emptyMsg.style.fontStyle = "italic";
      emptyMsg.style.opacity = "0.7";
      emptyMsg.textContent = "No tags found.";
      tagButtonsContainer.appendChild(emptyMsg);
      if (clearTagsBtn) clearTagsBtn.style.display = activeTags.size ? "" : "none";
      return;
    }

    tagsToShow.forEach(tag => {
      const btn = document.createElement("button");
      btn.className = "tag-button";
      btn.type = "button";
      if (tagIcons[tag]) {
        const icon = document.createElement("img");
        icon.src = tagIcons[tag];
        icon.style.height = "16px";
        icon.style.marginRight = "4px";
        btn.appendChild(icon);
      }
      btn.appendChild(document.createTextNode(tag.replaceAll("_", " ")));
      btn.dataset.tag = tag;
      if (tagTooltips[tag]) btn.title = tagTooltips[tag];
      if (activeTags.has(tag)) btn.classList.add("active");
      btn.onclick = () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
        } else {
          activeTags.add(tag);
          spawnBubble(tag);
        }
        renderTagButtons();
        filterArtists();
        setRandomBackground();
      };
      tagButtonsContainer.appendChild(btn);
    });

    if (clearTagsBtn) clearTagsBtn.style.display = activeTags.size ? "" : "none";
  }
  // Debounced search input for tags
  if (tagSearchInput) {
    let searchTimeout;
    tagSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchFilter = e.target.value;
        renderTagButtons();
        filterArtists(true);
      }, 150);
    });
  }

  // Add event for "Clear All" button
  if (clearTagsBtn) {
    clearTagsBtn.addEventListener("click", () => {
      activeTags.clear();
      renderTagButtons();
      filterArtists(true); // This will fetch counts and sort by count
      setRandomBackground();
    });
  }

  // Setup artist name filter input event listener only once
  if (artistNameFilterInput) {
    artistNameFilterInput.addEventListener("input", (e) => {
      artistNameFilter = e.target.value.trim().toLowerCase();
      filterArtists(true); // Always reset paging when searching
    });
  }

  let currentArtistPage = 0;
  const artistsPerPage = 24;
  let filtered = [];

  function filterArtists(reset = true) {
    if (reset) {
      artistGallery.innerHTML = "";
      // Add spinner
      const spinner = document.createElement("div");
      spinner.className = "gallery-spinner";
      spinner.innerHTML = "<img src='spinner.gif' alt='Loading...' />";
      artistGallery.appendChild(spinner);

      // Filtered and deduped artists
      const selected = Array.from(activeTags);
      const seen = new Set();
      filtered = allArtists.filter(artist => {
        const tags = artist.kinkTags || [];
        const name = artist.artistName;
        if (
          selected.every(tag => tags.includes(tag)) &&
          !seen.has(name) &&
          (
            name.toLowerCase().includes(artistNameFilter) ||
            artistNameFilter === ""
          )
        ) {
          seen.add(name);
          return true;
        }
        return false;
      });

      // Fetch image counts for all filtered artists in parallel
      const countPromises = filtered.map(artist => {
        const tagQuery = activeTags.size
          ? [artist.artistName, ...activeTags].join(" ")
          : artist.artistName;
        return fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagQuery)}&limit=1000`)
          .then(r => r.json())
          .then(posts => {
            // Count unique post IDs
            const uniqueIds = new Set(Array.isArray(posts) ? posts.map(post => post.id) : []);
            artist._imageCount = uniqueIds.size;
          })
          .catch(() => {
            artist._imageCount = 0;
          });
      });

      // After all counts are fetched, sort and render
      Promise.all(countPromises).then(() => {
        // Sort by image count descending
        filtered.sort((a, b) => (b._imageCount || 0) - (a._imageCount || 0));
        currentArtistPage = 0; // Reset paging
        renderArtistsPage();
      });
      return; // Don't render until counts are ready
    }

    renderArtistsPage();
  }

  function renderArtistsPage() {
    // Remove spinner if present
    const spinner = artistGallery.querySelector('.gallery-spinner');
    if (spinner) spinner.remove();

    const start = currentArtistPage * artistsPerPage;
    const end = start + artistsPerPage;
    const artistsToShow = filtered.slice(start, end);

    artistsToShow.forEach(artist => {
      const card = document.createElement("div");
      card.className = "artist-card";

      const img = document.createElement("img");
      img.className = "artist-image";
      lazyLoadBestImage(artist, img);

      img.addEventListener("click", () => {
        let currentIndex = 0;
        let posts = [];
        const zoomWrapper = document.createElement("div");
        zoomWrapper.className = "fullscreen-wrapper";

        const zoomed = document.createElement("img");
        zoomed.className = "fullscreen-img";
        zoomWrapper.appendChild(zoomed);

        const noEntriesMsg = document.createElement("span");
        noEntriesMsg.style.display = "none";
        noEntriesMsg.className = "no-entries-msg";
        noEntriesMsg.textContent = "No valid entries";
        zoomWrapper.appendChild(noEntriesMsg);

        const closeBtn = document.createElement("button");
        closeBtn.className = "zoom-close";
        closeBtn.textContent = "×";
        closeBtn.onclick = () => zoomWrapper.remove();

        const prevBtn = document.createElement("button");
        prevBtn.className = "zoom-prev";
        prevBtn.textContent = "←";

        const nextBtn = document.createElement("button");
        nextBtn.className = "zoom-next";
        nextBtn.textContent = "→";

        zoomWrapper.append(closeBtn, prevBtn, nextBtn);
        document.body.appendChild(zoomWrapper);

        // Add keyboard navigation for fullscreen
        zoomWrapper.tabIndex = 0;
        zoomWrapper.focus();
        zoomWrapper.addEventListener("keydown", (e) => {
          if (e.key === "ArrowLeft") {
            prevBtn.click();
            e.preventDefault();
          }
          if (e.key === "ArrowRight") {
            nextBtn.click();
            e.preventDefault();
          }
          if (e.key === "Escape") {
            closeBtn.click();
            e.preventDefault();
          }
        });

        function showPost(i) {
          if (posts.length === 0) {
            showNoEntriesMsg(zoomed);
          } else {
            zoomed.style.display = "block";
            noEntriesMsg.style.display = "none";
            const raw = posts[i];
            if (raw) {
              const url = raw?.large_file_url || raw?.file_url;
              const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
              zoomed.src = full;
            }
          }
        }

        let navTimeout;
        function tryShow(index, attempts = 0) {
          if (!posts.length || attempts >= posts.length) {
            showNoEntriesMsg(zoomed);
            return;
          }
          const raw = posts[index];
          const url = raw?.large_file_url || raw?.file_url;
          const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
          zoomed.style.opacity = "0.5";
          zoomed.src = ""; // Clear previous image
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

        const tagQuery = `${artist.artistName}`;
        fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagQuery)}+order:score&limit=1000`)
          .then(res => res.json())
          .then(data => {
            if (!Array.isArray(data)) {
              posts = [];
              showNoEntriesMsg(zoomed);
              return;
            }
            // Only filter for images, not banned, and must have all selected tags
            const validPosts = data.filter(post => {
              const url = post?.large_file_url || post?.file_url;
              const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
              return isImage && !post.is_banned && postHasAllTags(post, Array.from(activeTags));
            });
            posts = validPosts;
            function tryShow(index, attempts = 0) {
              if (!posts.length || attempts >= posts.length) {
                showNoEntriesMsg(zoomed);
                return;
              }
              const raw = posts[index];
              const url = raw?.large_file_url || raw?.file_url;
              const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
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
            currentIndex = 0;
            tryShow(currentIndex);
            prevBtn.onclick = () => {
              currentIndex = (currentIndex - 1 + posts.length) % posts.length;
              tryShow(currentIndex);
            };
            nextBtn.onclick = () => {
              currentIndex = (currentIndex + 1) % posts.length;
              tryShow(currentIndex);
            };
          });
      });

      const nameRow = document.createElement("div");
      nameRow.className = "name-row";

      const name = document.createElement("div");
      name.className = "artist-name";
      name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ""})`;

      // Use cached image count
      if (typeof artist._imageCount === "number") {
        name.textContent += ` [${artist._imageCount}${artist._imageCount === 1000 ? "+" : ""}]`;
      } else {
        name.textContent += " [Loading count…]";
      }

      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-button";
      copyBtn.textContent = "📋";
      copyBtn.title = "Copy name";
      copyBtn.onclick = () => handleArtistCopy(artist, img.src);

      nameRow.append(name, copyBtn);

      const taglist = document.createElement("div");
      taglist.className = "artist-tags";
      taglist.textContent = artist.kinkTags.join(", ");

      const showWithTagBtn = document.createElement("button");
      showWithTagBtn.className = "show-with-tag-btn";
      showWithTagBtn.textContent = "Show with selected tag";
      showWithTagBtn.disabled = activeTags.size === 0;
      showWithTagBtn.onclick = () => {
        if (!activeTags.size) return;
        const tagQuery = `${artist.artistName}`;
        fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagQuery)}+order:score&limit=1000`)
          .then(r => r.json())
          .then(data => {
            if (!Array.isArray(data)) {
              showToast("No image found for this tag (API error or too many tags).");
              return;
            }
            const validPosts = data.filter(post => {
              const url = post?.large_file_url || post?.file_url;
              const isImage = url && /\.(jpg|jpeg|png|gif)$/i.test(url);
              return isImage && !post.is_banned && postHasAllTags(post, Array.from(activeTags));
            });
            if (validPosts.length) {
              const popup = document.createElement("div");
              popup.className = "tag-image-popup";
              const imgUrl = validPosts[0].large_file_url || validPosts[0].file_url;
              const fullUrl = imgUrl.startsWith("http") ? imgUrl : `https://danbooru.donmai.us${imgUrl}`;
              popup.innerHTML = `
                <div class="tag-image-popup-bg"></div>
                <img src="${fullUrl}" class="tag-image-popup-img" />
                <button class="tag-image-popup-close">×</button>
              `;
              document.body.appendChild(popup);
              popup.querySelector(".tag-image-popup-close").onclick = () => popup.remove();
              popup.querySelector(".tag-image-popup-bg").onclick = () => popup.remove();
            } else {
              showToast("No image found for this tag!");
            }
          })
          .catch(() => {
            showToast("Failed to fetch image (network or API error).");
          });
      };
      card.appendChild(showWithTagBtn);

      card.append(img, nameRow, taglist);
      artistGallery.appendChild(card);
    });

    if (artistsToShow.length === 0 && currentArtistPage > 0) {
      const endMsg = document.createElement("div");
      endMsg.className = "end-of-gallery";
      endMsg.textContent = "No more artists to show.";
      artistGallery.appendChild(endMsg);
    }

    currentArtistPage++;
  }

  // Infinite scroll event
  let scrollTimeout = null;
  window.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (
        (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 300) &&
        filtered.length > currentArtistPage * artistsPerPage
      ) {
        filterArtists(false);
      }
    }, 100);
  });

  // When filters/tags/search changes, call filterArtists(true) to reset
  // For example, in your tag search input event:
  if (tagSearchInput) {
    tagSearchInput.addEventListener("input", (e) => {
      searchFilter = e.target.value;
      filterArtists(true);
    });
  }
  // And for clear tags, etc.
  if (clearTagsBtn) {
    clearTagsBtn.addEventListener("click", () => {
      activeTags.clear();
      renderTagButtons();
      filterArtists(true);
      setRandomBackground();
    });
  }

  // Setup artist name filter input event listener only once
  if (artistNameFilterInput) {
    artistNameFilterInput.addEventListener("input", (e) => {
      artistNameFilter = e.target.value.trim().toLowerCase();
      filterArtists(true); // Always reset paging when searching
    });
  }

  // Setup back-to-top button functionality
  const backToTopBtn = document.getElementById("back-to-top");
  if (backToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 200) {
        backToTopBtn.style.display = "block";
      } else {
        backToTopBtn.style.display = "none";
      }
    });
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }


  // Setup moan toggle event listener only once
  const moanToggle = document.getElementById("moan-toggle");
  let moanPlaying = false;
  if (moanToggle && moanAudio) {
    moanToggle.addEventListener("click", () => {
      if (!moanAudio) return;
      if (moanPlaying) {
        moanAudio.pause();
        moanAudio.currentTime = 0;
        moanToggle.textContent = "🔊 Moan";
      } else {
        moanAudio.play();
        moanToggle.textContent = "🔇 Stop";
      }
      moanPlaying = !moanPlaying;
    });
  }

  Promise.all([
    fetch("artists.json").then(r => r.json()),
    fetch("tag-tooltips.json").then(r => r.json()),
    fetch("taunts.json").then(r => r.json()),
    fetch("tag-taunts.json").then(r => r.json())
  ]).then(([artists, tips, general, specific]) => {
    allArtists = artists;
    tagTooltips = tips;
    taunts = general;
    tagTaunts = specific;
    renderTagButtons();
    filterArtists();
    setRandomBackground();
    setInterval(setRandomBackground, 15000);
  }).catch(err => {
    console.error("Failed to load required data files:", err);
    // Optionally show a user-friendly message in the UI
  });

  // Add lipstick kiss watermark if not present
  if (!document.querySelector('.lipstick-kiss')) {
    const kiss = document.createElement('div');
    kiss.className = 'lipstick-kiss';
    document.body.appendChild(kiss);
  }
});
