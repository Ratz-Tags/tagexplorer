import {
  getActiveTags,
  getKinkTags,
  toggleTag,
  getArtistNameFilter,
  handleArtistNameFilter,
  handleTagSearch,
  clearAllTags,
} from "./tags.js";

const MAX_TAG_SELECTION = 2;

let allArtists = [];
let overlayEl = null;
let panelEl = null;
let searchInputEl = null;
let nameInputEl = null;
let groupsContainerEl = null;
let overlaySelectedEl = null;
let pinnedSelectedEl = null;
let limitNoticeEl = null;
let clearButtonEl = null;
let isInitialized = false;
let isOpen = false;
let escapeListener = null;
let searchValue = "";
let searchValueLower = "";
let limitMessageTimer = null;
let isResizeListenerBound = false;
let resizeSyncFrame = null;

function scheduleOpenCategoryHeightSync() {
  if (typeof document === "undefined") return;
  if (resizeSyncFrame !== null) return;
  const raf =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 16);
  resizeSyncFrame = raf(() => {
    resizeSyncFrame = null;
    const openLists = document.querySelectorAll(
      ".filter-category.open .filter-category__tags"
    );
    openLists.forEach((list) => {
      list.style.maxHeight = `${list.scrollHeight}px`;
    });
  });
}

function setAllArtists(artists) {
  if (!Array.isArray(artists)) {
    allArtists = [];
    return;
  }
  allArtists = [...artists];
}

function getFilteredArtists(active = getActiveTags()) {
  const activeTags = active instanceof Set ? active : new Set(active || []);
  const nameFilter = (typeof getArtistNameFilter === "function"
    ? getArtistNameFilter() || ""
    : "").toLowerCase();

  return allArtists.filter((artist) => {
    const tags = Array.isArray(artist?.kinkTags) ? artist.kinkTags : [];
    if (![...activeTags].every((tag) => tags.includes(tag))) return false;
    if (nameFilter && !artist.artistName.toLowerCase().includes(nameFilter)) {
      return false;
    }
    return true;
  });
}

function getFilteredCounts(active = getActiveTags()) {
  const counts = {};
  const filtered = getFilteredArtists(active);
  filtered.forEach((artist) => {
    const tags = Array.isArray(artist?.kinkTags) ? artist.kinkTags : [];
    tags.forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return counts;
}

function ensurePinnedSelectedContainer() {
  if (typeof document === "undefined") return null;
  if (pinnedSelectedEl && document.body.contains(pinnedSelectedEl)) {
    return pinnedSelectedEl;
  }
  let container = document.getElementById("selected-tags");
  if (!container) {
    container = document.createElement("section");
    container.id = "selected-tags";
    container.className = "selected-tags-bar";
    container.setAttribute("aria-label", "Active tag filters");
    const main = document.querySelector("main") || document.body;
    main.insertBefore(container, main.firstChild || null);
  } else if (!container.classList.contains("selected-tags-bar")) {
    container.classList.add("selected-tags-bar");
  }
  pinnedSelectedEl = container;
  return pinnedSelectedEl;
}

function createTagPill(tag, options = {}) {
  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "selected-tag-pill";
  if (options.compact) pill.classList.add("compact");
  pill.textContent = tag.replace(/_/g, " ");
  pill.setAttribute("data-tag", tag);
  pill.setAttribute("aria-label", `Remove tag ${tag.replace(/_/g, " ")}`);
  pill.addEventListener("click", () => {
    toggleTag(tag);
  });
  return pill;
}

function clearSelectionLimitMessage() {
  if (!limitNoticeEl) return;
  limitNoticeEl.textContent = "";
  limitNoticeEl.classList.remove("visible");
  if (limitMessageTimer) {
    clearTimeout(limitMessageTimer);
    limitMessageTimer = null;
  }
}

function showSelectionLimitMessage() {
  if (!limitNoticeEl) return;
  limitNoticeEl.textContent = `You can only select up to ${MAX_TAG_SELECTION} tags at a time.`;
  limitNoticeEl.classList.add("visible");
  if (limitMessageTimer) clearTimeout(limitMessageTimer);
  limitMessageTimer = setTimeout(() => {
    clearSelectionLimitMessage();
  }, 2200);
}

function emitOverlayToggle(open) {
  if (typeof document === "undefined" || typeof document.dispatchEvent !== "function") {
    return;
  }
  const detail = { open: Boolean(open) };
  try {
    document.dispatchEvent(new CustomEvent("tagFilters:toggle", { detail }));
  } catch (err) {
    if (typeof document.createEvent === "function") {
      try {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("tagFilters:toggle", false, false, detail);
        document.dispatchEvent(evt);
      } catch {
        // ignore
      }
    }
  }
}

function fillSelectedContainer(container, tags, options = {}) {
  if (!container) return;
  container.innerHTML = "";
  if (!tags.length) {
    container.classList.add("is-empty");
    if (options.placeholder) {
      const message = document.createElement("p");
      message.className = "selected-tags-empty";
      message.textContent = options.placeholder;
      container.appendChild(message);
    }
    return;
  }
  container.classList.remove("is-empty");
  if (options.showLabel) {
    const label = document.createElement("span");
    label.className = "selected-tags-label";
    label.textContent = "Active filters";
    container.appendChild(label);
  }
  const list = document.createElement("div");
  list.className = "selected-tags-list";
  tags.forEach((tag) => {
    list.appendChild(createTagPill(tag, { compact: options.compact }));
  });
  container.appendChild(list);
}

function renderSelectedTags() {
  const active = Array.from(getActiveTags());
  const overlayPlaceholder = active.length
    ? null
    : "No filters applied. Choose tags to narrow results.";
  fillSelectedContainer(overlaySelectedEl, active, {
    placeholder: overlayPlaceholder,
    compact: false,
  });
  const pinned = ensurePinnedSelectedContainer();
  fillSelectedContainer(pinned, active, {
    showLabel: true,
    compact: true,
    placeholder: "No filters active",
  });
  if (active.length < MAX_TAG_SELECTION) {
    clearSelectionLimitMessage();
  }
}

function handleTagToggle(tag) {
  const active = getActiveTags();
  if (!active.has(tag) && active.size >= MAX_TAG_SELECTION) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {
        // ignore vibration errors
      }
    }
    showSelectionLimitMessage();
    return;
  }
  toggleTag(tag);
  renderExplorer();
}

function formatTagLabel(tag) {
  return tag.replace(/_/g, " ");
}

function renderCategories() {
  if (!groupsContainerEl) return;
  groupsContainerEl.innerHTML = "";
  const active = getActiveTags();
  const counts = getFilteredCounts(active);
  const categories = getKinkTags();
  let renderedAny = false;

  if (!isResizeListenerBound && typeof window !== "undefined") {
    window.addEventListener("resize", scheduleOpenCategoryHeightSync, {
      passive: true,
    });
    isResizeListenerBound = true;
  }

  categories.forEach(({ category, tags }, index) => {
    const matchingTags = tags.filter((tag) => {
      if (searchValueLower && !tag.toLowerCase().includes(searchValueLower)) {
        return false;
      }
      const count = counts[tag] || 0;
      return count > 0 || active.has(tag);
    });

    if (matchingTags.length === 0) return;

    renderedAny = true;
    const section = document.createElement("section");
    section.className = "filter-category";
    const shouldOpen =
      searchValueLower !== "" || matchingTags.some((tag) => active.has(tag));
    if (shouldOpen) section.classList.add("open");

    const slug = category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const groupId = `filter-category-${index}-${slug || "group"}`;

    const header = document.createElement("button");
    header.type = "button";
    header.className = "filter-category__header";
    header.textContent = category;
    header.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    header.setAttribute("aria-controls", groupId);

    const tagList = document.createElement("div");
    tagList.className = "filter-category__tags";
    tagList.id = groupId;
    tagList.setAttribute("role", "group");
    tagList.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

    const applyExpandedState = (open, { immediate = false } = {}) => {
      const isOpen = Boolean(open);
      if (immediate) {
        tagList.style.transition = "none";
      }
      section.classList.toggle("open", isOpen);
      header.setAttribute("aria-expanded", isOpen ? "true" : "false");
      tagList.setAttribute("aria-hidden", isOpen ? "false" : "true");
      const target = isOpen ? `${tagList.scrollHeight}px` : "0px";
      tagList.style.maxHeight = target;
      if (isOpen) {
        scheduleOpenCategoryHeightSync();
      }
      if (immediate) {
        const restore = () => {
          tagList.style.transition = "";
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(restore);
        } else {
          setTimeout(restore, 16);
        }
      }
    };

    header.addEventListener("click", () => {
      const nowOpen = !section.classList.contains("open");
      applyExpandedState(nowOpen);
    });
    section.appendChild(header);

    matchingTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-tag-button";
      btn.setAttribute("data-tag", tag);
      const count = counts[tag] || 0;
      btn.innerHTML = `
        <span class="filter-tag-button__label">${formatTagLabel(tag)}</span>
        <span class="filter-tag-button__count">${count}</span>
      `;
      const isActive = active.has(tag);
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.addEventListener("click", () => handleTagToggle(tag));
      tagList.appendChild(btn);
    });

    section.appendChild(tagList);
    groupsContainerEl.appendChild(section);

    const init = () => applyExpandedState(shouldOpen, { immediate: true });
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(init);
    } else {
      init();
    }
  });

  if (!renderedAny) {
    const emptyState = document.createElement("p");
    emptyState.className = "filter-empty-state";
    emptyState.textContent = searchValueLower
      ? "No tags match your search."
      : "No tags available for the current filters.";
    groupsContainerEl.appendChild(emptyState);
  } else {
    scheduleOpenCategoryHeightSync();
  }
}

function renderExplorer() {
  renderSelectedTags();
  renderCategories();
}

function bindEscapeListener() {
  if (typeof document === "undefined") return;
  if (escapeListener) return;
  escapeListener = (event) => {
    if (event.key === "Escape") {
      closeTagExplorer();
    }
  };
  document.addEventListener("keydown", escapeListener);
}

function unbindEscapeListener() {
  if (typeof document === "undefined") return;
  if (!escapeListener) return;
  document.removeEventListener("keydown", escapeListener);
  escapeListener = null;
}

function openTagExplorer() {
  if (!isInitialized) initTagExplorer();
  if (!overlayEl || isOpen) return;
  isOpen = true;
  overlayEl.classList.add("open");
  overlayEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("tag-filter-open");
  if (panelEl) {
    panelEl.setAttribute("tabindex", "-1");
    panelEl.focus({ preventScroll: true });
  }
  if (searchInputEl) {
    searchInputEl.value = searchValue;
  }
  if (nameInputEl) {
    const currentName =
      typeof getArtistNameFilter === "function" ? getArtistNameFilter() : "";
    nameInputEl.value = currentName || "";
  }
  renderExplorer();
  bindEscapeListener();
  emitOverlayToggle(true);
}

function closeTagExplorer() {
  if (!overlayEl || !isOpen) return;
  isOpen = false;
  overlayEl.classList.remove("open");
  overlayEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("tag-filter-open");
  unbindEscapeListener();
  emitOverlayToggle(false);
}

function handleSearchInput(value) {
  searchValue = value;
  searchValueLower = value.trim().toLowerCase();
  handleTagSearch(value);
  renderCategories();
}

function initTagExplorer() {
  if (isInitialized || typeof document === "undefined") return;
  ensurePinnedSelectedContainer();

  overlayEl = document.createElement("div");
  overlayEl.className = "filter-overlay";
  overlayEl.setAttribute("aria-hidden", "true");
  overlayEl.innerHTML = `
    <div class="filter-panel" id="tag-filter-panel" role="dialog" aria-modal="true" aria-label="Tag filters">
      <div class="filter-panel__handle" aria-hidden="true"></div>
      <header class="filter-panel__header">
        <h2>Filters</h2>
        <button type="button" class="filter-panel__close" aria-label="Close filters">×</button>
      </header>
      <div class="filter-panel__controls">
        <div class="filter-panel__inputs">
          <label class="visually-hidden" for="tag-filter-search">Search tags</label>
          <input id="tag-filter-search" class="filter-panel__search" type="search" placeholder="Search tags" autocomplete="off" />
          <label class="visually-hidden" for="tag-filter-name">Filter artists by name</label>
          <input id="tag-filter-name" class="filter-panel__search" type="search" placeholder="Filter artists by name" autocomplete="off" />
        </div>
        <div class="filter-panel__actions">
          <button type="button" class="filter-panel__clear">Clear all</button>
        </div>
        <p class="filter-panel__notice" aria-live="assertive"></p>
      </div>
      <div class="filter-panel__selected" aria-live="polite"></div>
      <div class="filter-panel__groups"></div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  panelEl = overlayEl.querySelector("#tag-filter-panel");
  searchInputEl = overlayEl.querySelector("#tag-filter-search");
  nameInputEl = overlayEl.querySelector("#tag-filter-name");
  groupsContainerEl = overlayEl.querySelector(".filter-panel__groups");
  overlaySelectedEl = overlayEl.querySelector(".filter-panel__selected");
  limitNoticeEl = overlayEl.querySelector(".filter-panel__notice");
  clearButtonEl = overlayEl.querySelector(".filter-panel__clear");

  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) {
      closeTagExplorer();
    }
  });

  const closeBtn = overlayEl.querySelector(".filter-panel__close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeTagExplorer());
  }

  if (searchInputEl) {
    searchInputEl.addEventListener("input", (event) => {
      handleSearchInput(event.target.value || "");
    });
  }

  if (nameInputEl) {
    nameInputEl.addEventListener("input", (event) => {
      handleArtistNameFilter(event.target.value || "");
    });
  }

  if (clearButtonEl) {
    clearButtonEl.addEventListener("click", (event) => {
      event.preventDefault();
      searchInputEl && (searchInputEl.value = "");
      handleSearchInput("");
      nameInputEl && (nameInputEl.value = "");
      handleArtistNameFilter("");
      clearAllTags();
      renderExplorer();
    });
  }

  document.addEventListener("tags:updated", () => {
    renderSelectedTags();
    if (isOpen) {
      renderCategories();
      if (nameInputEl) {
        const currentName =
          typeof getArtistNameFilter === "function"
            ? getArtistNameFilter()
            : "";
        nameInputEl.value = currentName || "";
      }
    }
  });

  renderExplorer();
  isInitialized = true;
}

export { openTagExplorer, initTagExplorer, setAllArtists, getFilteredCounts };
