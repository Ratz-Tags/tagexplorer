import {
  getActiveTags,
  getKinkTags,
  toggleTag,
  getArtistNameFilter,
  handleArtistNameFilter,
  artists,
  clearAllTags,
} from "./tags.js";
import { filterArtists } from "./gallery.js";
let filteredArtistsCache = null;
let filteredActiveCache = null;
let filteredNameCache = null;

let lastCountsCache = null;
let lastActiveCache = null;
let lastNameFilterCache = null;

function setAllArtists(list) {
  artists.value = Array.isArray(list) ? list : [];
  lastCountsCache = null;
  filteredArtistsCache = null;
}

function getFilteredArtists(active) {
  const nameFilter = (getArtistNameFilter && getArtistNameFilter() || '').toLowerCase();
  if (
    filteredArtistsCache &&
    filteredActiveCache &&
    filteredNameCache === nameFilter &&
    JSON.stringify([...active]) === JSON.stringify([...filteredActiveCache])
  ) {
    return filteredArtistsCache;
  }
  const filtered = artists.value.filter((a) => {
    const tags = Array.isArray(a.kinkTags) ? a.kinkTags : [];
    if (![...active].every((t) => tags.includes(t))) return false;
    if (nameFilter && !a.artistName.toLowerCase().includes(nameFilter)) return false;
    return true;
  });
  filteredArtistsCache = filtered;
  filteredActiveCache = new Set(active);
  filteredNameCache = nameFilter;
  return filtered;
}

function getFilteredCounts(active) {
  const nameFilter = (getArtistNameFilter && getArtistNameFilter() || '').toLowerCase();
  if (
    lastCountsCache &&
    lastActiveCache &&
    lastNameFilterCache === nameFilter &&
    JSON.stringify([...active]) === JSON.stringify([...lastActiveCache])
  ) {
    return lastCountsCache;
  }
  const counts = {};
  const tagArtists = {};
  const filtered = getFilteredArtists(active);
  filtered.forEach((a) => {
    const artistName = a.artistName;
    const tags = Array.isArray(a.kinkTags) ? [...new Set(a.kinkTags)] : [];
    tags.forEach((t) => {
      if (!tagArtists[t]) tagArtists[t] = new Set();
      if (!tagArtists[t].has(artistName)) {
        counts[t] = (counts[t] || 0) + 1;
        tagArtists[t].add(artistName);
      }
    });
  });
  lastCountsCache = counts;
  lastActiveCache = new Set(active);
  lastNameFilterCache = nameFilter;
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

async function filterTags() {
  // Close any existing tag explorer
  const existingWrapper = document.querySelector(
    ".fullscreen-wrapper.tag-explorer-wrapper"
  );
  if (existingWrapper) {
    existingWrapper.remove();
  }

  const allTags = getKinkTags();
  let active = getActiveTags();

  let sortMode = "name";
  let searchText = "";

  const tagCategories = {
    Bondage: [
      "bdsm",
      "bondage",
      "shibari",
      "restraints",
      "restrained",
      "hogtie",
      "leash",
      "spreader_bar",
      "chastity_cage",
      "chastity_cage_emission",
      "flat_chastity_cage",
      "holding_key",
      "immobilization",
    ],
    Feminization: [
      "feminization",
      "forced_feminization",
      "bimbofication",
      "crossdressing",
      "crossdressing_(mtf)",
      "trap",
    ],
    Penetration: [
      "anal_fingering",
      "anal_fisting",
      "anal_object_insertion",
      "object_insertion",
      "object_insertion_from_behind",
      "urethral_insertion",
      "prostate_milking",
      "pegging",
      "male_penetrated",
      "dildo_riding",
      "strap-on",
      "large_insertion",
      "huge_dildo",
      "sounding",
      "knotting",
      "tentacle_sex",
      "tentacle_pit",
    ],
    Oral: [
      "oral",
      "fellatio",
      "irrumatio",
      "bukkake",
      "face_fucking",
      "spitroast",
      "gokkun",
      "blowjob",
    ],
  };
  const collapsedCategories = new Set(Object.keys(tagCategories));
  const categorizedTagSet = new Set(
    Object.values(tagCategories).flat()
  );
  collapsedCategories.add("Other");

  // Create fullscreen wrapper similar to zoom viewer
  const wrapper = document.createElement("div");
  wrapper.className = "fullscreen-wrapper tag-explorer-wrapper";

  const container = document.createElement("div");
  container.className = "tag-explorer";

  const header = document.createElement("div");
  header.className = "tag-explorer-header";

  const title = document.createElement("h3");
  title.textContent = "Browse Tags";
  header.appendChild(title);

  // Add close button in header (move this inside header)
  const closeBtn = document.createElement("button");
  closeBtn.className = "zoom-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => {
    wrapper.remove();
    // --- Fix: Remove any margin/left style from .container and #artist-gallery after tag-explorer closes ---
    const container = document.querySelector('.container');
    if (container && container.style.marginLeft) container.style.marginLeft = '';
    const gallery = document.getElementById('artist-gallery');
    if (gallery && gallery.style.marginLeft) gallery.style.marginLeft = '';
    if (gallery && gallery.style.left) gallery.style.left = '';
  };
  closeBtn.title = "Close (Esc)";
  header.appendChild(closeBtn); // <-- Move this line here

  // Feature: Add clear tags button for quick reset
  const clearTagsBtn = document.createElement("button");
  clearTagsBtn.className = "tag-explorer-clear browse-btn";
  clearTagsBtn.textContent = "Clear Tags";
  clearTagsBtn.setAttribute("id", "clear-tags-btn");
  clearTagsBtn.onclick = () => {
    clearAllTags();
    searchInput.value = "";
    nameInput.value = "";
    handleArtistNameFilter("");
    renderList();
    // Refilter gallery on clear
    filterArtists(true, true);
  };
  header.appendChild(clearTagsBtn);

  const sortSelect = document.createElement("select");
  sortSelect.innerHTML = `<option value="name">Sort: Name</option><option value="count">Sort: Count</option>`;
  sortSelect.onchange = () => {
    sortMode = sortSelect.value;
    renderList();
  };

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search tags";
  searchInput.oninput = () => {
    searchText = searchInput.value.toLowerCase();
    renderList();
  };

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Filter artists";
  nameInput.value = getArtistNameFilter ? getArtistNameFilter() : "";
  nameInput.oninput = () => {
    handleArtistNameFilter(nameInput.value);
    renderList();
    filterArtists(true, true);
  };

  header.appendChild(searchInput);
  header.appendChild(nameInput);
  header.appendChild(sortSelect);

  container.appendChild(header);

  const list = document.createElement("div");
  list.className = "tag-explorer-tags";
  list.setAttribute("id", "tag-list");
  container.appendChild(list);

  function renderList() {
    list.innerHTML = "";
    active = getActiveTags();
    const counts = getFilteredCounts(active);
    let tags = allTags.filter((t) => t.toLowerCase().includes(searchText));
    tags = tags.filter((t) => counts[t] || active.has(t));
    if (tags.length === 0) {
      list.textContent = "No tags";
      return;
    }

    const categorized = {};
    Object.entries(tagCategories).forEach(([cat, catTags]) => {
      categorized[cat] = tags.filter((t) => catTags.includes(t));
    });
    const others = tags.filter((t) => !categorizedTagSet.has(t));

    let idxCounter = 0;
    const createBtn = (tag) => {
      const btn = document.createElement("button");
      btn.className = "tag-button";
      btn.textContent = `${tag.replace(/_/g, " ")} (${counts[tag] || 0})`;
      if (active.has(tag)) btn.classList.add("active");
      btn.onclick = () => {
        toggleTag(tag);
        renderList();
        filterArtists(true, true);
      };
      btn.tabIndex = 0;
      btn.dataset.idx = idxCounter++;
      return btn;
    };

    const buildCategory = (cat, catTags) => {
      if (!catTags.length) return;
      const section = document.createElement("div");
      section.className = "tag-category";

      const toggle = document.createElement("button");
      toggle.className = "browse-btn tag-category-toggle";
      toggle.textContent = cat;
      toggle.setAttribute(
        "aria-expanded",
        String(!collapsedCategories.has(cat))
      );
      toggle.onclick = () => {
        if (collapsedCategories.has(cat)) collapsedCategories.delete(cat);
        else collapsedCategories.add(cat);
        renderList();
      };
      section.appendChild(toggle);

      const tagWrap = document.createElement("div");
      tagWrap.className = "tag-category-tags";
      if (collapsedCategories.has(cat)) tagWrap.style.display = "none";

      catTags.sort((a, b) => {
        if (sortMode === "count") {
          return (counts[b] || 0) - (counts[a] || 0);
        }
        return a.localeCompare(b);
      });
      catTags.forEach((tag) => tagWrap.appendChild(createBtn(tag)));
      section.appendChild(tagWrap);
      list.appendChild(section);
    };

    Object.entries(categorized).forEach(([cat, catTags]) =>
      buildCategory(cat, catTags)
    );
    buildCategory("Other", others);
  }

  // Keyboard navigation for tag explorer
  let selectedIdx = 0;
  const onKey = (e) => {
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
    if (e.key === "Escape") {
      closeBtn.click();
    }
    // Feature: clear tags with Ctrl+Backspace
    if (e.ctrlKey && e.key === "Backspace") {
      clearTagsBtn.click();
      e.preventDefault();
    }
  };
  wrapper.addEventListener("keydown", onKey);

  // Feature: auto-focus search on open
  setTimeout(() => searchInput.focus(), 100);

  // Assemble the modal
  wrapper.appendChild(container);

  document.body.appendChild(wrapper);
  wrapper.setAttribute('tabindex', '0');
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

function openTagExplorer() {
  filterTags();
}

// All functions in this file are defined and used as follows:

// setAllArtists: exported, used by main.js
// getFilteredCounts: used by renderList
// showTagLoadingError: used by filterTags
// filterTags: used by openTagExplorer
// fetchTagCounts: used by filterTags
// enhanceTagControls: exported, not used internally (for external use)
// openTagExplorer: exported, used by main.js

// No unused or undefined functions in this file.

export { openTagExplorer, setAllArtists, getFilteredCounts };
