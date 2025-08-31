import { getActiveTags, getKinkTags, toggleTag, getArtistNameFilter, handleArtistNameFilter } from "./tags.js";

let allArtists = [];
let allArtistsCache = null;

function setAllArtists(artists) {
  if (allArtistsCache && JSON.stringify(allArtistsCache) === JSON.stringify(artists)) return;
  allArtists = Array.isArray(artists) ? artists : [];
  allArtistsCache = artists;
}

function getFilteredArtists(active) {
  const nameFilter = (getArtistNameFilter && getArtistNameFilter() || '').toLowerCase();
  return allArtists.filter((a) => {
    const tags = Array.isArray(a.kinkTags) ? a.kinkTags : [];
    if (![...active].every((t) => tags.includes(t))) return false;
    if (nameFilter && !a.artistName.toLowerCase().includes(nameFilter)) return false;
    return true;
  });
}

function getFilteredCounts(active) {
  const nameFilter = (getArtistNameFilter && getArtistNameFilter() || '').toLowerCase();
  const counts = {};
  const countedArtists = {};
  const filtered = getFilteredArtists(active);
  filtered.forEach((a) => {
    const artistName = a.artistName;
    const tags = Array.isArray(a.kinkTags) ? a.kinkTags : [];
    tags.forEach((t) => {
      if (!countedArtists[t]) countedArtists[t] = new Set();
      if (!countedArtists[t].has(artistName)) {
        countedArtists[t].add(artistName);
        counts[t] = (counts[t] || 0) + 1;
      }
    });
  });
  return counts;
}

// Add spinner and error handling for tag loading
function showTagLoadingError(container, errorMsg = "Error loading tags.") {
  container.textContent = errorMsg;
  container.style.display = "block";
  container.setAttribute("aria-live", "assertive");
  // Add Retry button if not present
  if (!container.querySelector(".retry-btn")) {
    const retryBtn = document.createElement("button");
    retryBtn.className = "retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.setAttribute("aria-label", "Retry loading tags");
    retryBtn.onclick = () => {
      container.textContent = "Retrying...";
      // Invalidate cache and re-fetch tags
      if (typeof invalidateTagCache === "function") invalidateTagCache();
      if (typeof fetchTagsAndCounts === "function") fetchTagsAndCounts();
    };
    container.appendChild(retryBtn);
  }
}

// Lazy fetch for tag counts (only for visible tags)
function fetchTagCounts(visibleTags = null) {
  // visibleTags: array of tags to count, or null for all
  const active = getActiveTags ? getActiveTags() : new Set();
  const filtered = getFilteredArtists(active);
  const counts = {};
  filtered.forEach((a) => {
    const tags = a.kinkTags || [];
    tags.forEach((t) => {
      if (!visibleTags || visibleTags.includes(t)) {
        counts[t] = (counts[t] || 0) + 1;
      }
    });
  });
  return counts;
}

// Add ARIA attributes and keyboard shortcuts for tag controls
function enhanceTagControls(tagControls) {
  tagControls.setAttribute("role", "toolbar");
  tagControls.setAttribute("aria-label", "Tag controls");
  // Keyboard shortcut: Clear tags (Ctrl+Shift+C)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
      if (typeof clearTags === "function") clearTags();
    }
  });
}

// Fixed: Only one openTagExplorer function, using the most complete version
function openTagExplorer() {
  // Close any existing tag explorer
  const existingWrapper = document.querySelector(".tag-explorer-wrapper");
  if (existingWrapper) existingWrapper.remove();

  // Create modal wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "tag-explorer-wrapper";
  wrapper.setAttribute("role", "dialog");
  wrapper.setAttribute("aria-modal", "true");
  wrapper.style.zIndex = "3000";

  // Tag explorer content
  const container = document.createElement("div");
  container.className = "tag-explorer";

  // Header (compact)
  const header = document.createElement("div");
  header.className = "tag-explorer-header";
  const title = document.createElement("h3");
  title.textContent = "Tags";
  header.appendChild(title);
  const closeBtn = document.createElement("button");
  closeBtn.className = "zoom-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => wrapper.remove();
  closeBtn.title = "Close (Esc)";
  header.appendChild(closeBtn);
  const clearTagsBtn = document.createElement("button");
  clearTagsBtn.className = "tag-explorer-clear";
  clearTagsBtn.textContent = "Clear";
  clearTagsBtn.setAttribute("id", "clear-tags-btn");
  clearTagsBtn.onclick = () => {
    if (typeof window.clearAllTags === "function") window.clearAllTags();
    searchInput.value = "";
    nameInput.value = "";
    renderList();
  };
  header.appendChild(clearTagsBtn);
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search";
  searchInput.oninput = () => {
    renderList();
  };
  header.appendChild(searchInput);
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Filter artists";
  nameInput.value = getArtistNameFilter ? getArtistNameFilter() : "";
  nameInput.oninput = () => {
    handleArtistNameFilter(nameInput.value);
    renderList();
  };
  header.appendChild(nameInput);
  const sortSelect = document.createElement("select");
  sortSelect.innerHTML = `<option value="name">Sort: Name</option><option value="count">Sort: Count</option>`;
  sortSelect.title = "Sort tags";
  sortSelect.onchange = () => {
    renderList();
  };
  header.appendChild(sortSelect);
  container.appendChild(header);

  // Selected tags bar (compact pills)
  const selectedTagsBar = document.createElement("div");
  selectedTagsBar.className = "selected-tags-bar";
  container.appendChild(selectedTagsBar);

  // Tag grid
  const list = document.createElement("div");
  list.className = "tag-explorer-tags";
  list.setAttribute("id", "tag-list");
  list.setAttribute("role", "listbox");
  container.appendChild(list);

  let allTags = getKinkTags();
  let sortMode = "name";

  function renderList() {
    // Selected tags pills
    selectedTagsBar.innerHTML = "";
    const active = getActiveTags();
    if (active.size > 0) {
      active.forEach((tag) => {
        const pill = document.createElement("span");
        pill.className = "selected-tag-pill";
        pill.textContent = tag.replace(/_/g, " ");
        pill.title = `Remove tag: ${tag.replace(/_/g, " ")}`;
        pill.onclick = () => {
          toggleTag(tag);
          renderList();
        };
        selectedTagsBar.appendChild(pill);
      });
    }
    // Tag grid
    list.innerHTML = "";
    const counts = getFilteredCounts(active);
    let searchText = searchInput.value.toLowerCase();
    let tags = allTags.filter((t) => t.toLowerCase().includes(searchText));
    tags = tags.filter((t) => counts[t] || active.has(t));
    sortMode = sortSelect.value;
    tags.sort((a, b) => {
      if (sortMode === "count") return (counts[b] || 0) - (counts[a] || 0);
      return a.localeCompare(b);
    });
    if (tags.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No tags";
      empty.style.color = "#a0005a";
      empty.style.gridColumn = "1/-1";
      list.appendChild(empty);
      return;
    }
    tags.forEach((tag, idx) => {
      const btn = document.createElement("button");
      btn.className = "tag-button";
      btn.textContent = `${tag.replace(/_/g, " ")} (${counts[tag] || 0})`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", `Toggle tag ${tag.replace(/_/g, " ")}`);
      btn.setAttribute("aria-pressed", active.has(tag) ? "true" : "false");
      if (active.has(tag)) btn.classList.add("active");
      btn.onclick = () => {
        toggleTag(tag);
        renderList();
      };
      btn.tabIndex = 0;
      btn.dataset.idx = idx;
      list.appendChild(btn);
    });
  }

  // Keyboard navigation for tag explorer
  let selectedIdx = 0;
  wrapper.addEventListener("keydown", (e) => {
    const tagBtns = list.querySelectorAll(".tag-button");
    if (e.key === "ArrowDown") {
      selectedIdx = Math.min(selectedIdx + 1, tagBtns.length - 1);
      tagBtns[selectedIdx]?.focus();
      e.preventDefault();
    }
    if (e.key === "ArrowUp") {
      selectedIdx = Math.max(selectedIdx - 1, 0);
      tagBtns[selectedIdx]?.focus();
      e.preventDefault();
    }
    if (e.key === "Enter") {
      tagBtns[selectedIdx]?.click();
      e.preventDefault();
    }
    // Feature: clear tags with Ctrl+Backspace
    if (e.ctrlKey && e.key === "Backspace") {
      clearTagsBtn.click();
      e.preventDefault();
    }
  });

  // Feature: auto-focus search on open
  setTimeout(() => searchInput.focus(), 100);

  // Assemble the modal
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);
  wrapper.focus();
  try {
    // Fetch tag counts, handle errors
    const counts = fetchTagCounts();
    if (!counts) throw new Error("No tag counts");
  } catch (err) {
    showTagLoadingError(list, "Error loading tags.");
    console.warn("Failed to fetch tag counts:", err);
  }
  renderList();
}

export { openTagExplorer, setAllArtists, getFilteredCounts };
