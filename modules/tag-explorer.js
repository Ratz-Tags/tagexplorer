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
let popoverEl = null;
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
let heightSyncFrame = null;
let tagListResizeObserver = null;
const observedTagLists =
  typeof WeakSet === "function" ? new WeakSet() : null;
let heightSyncListenersBound = false;
let heightSyncResizeHandler = null;
let scrollRepositionHandler = null;
let filtersButtonEl = null;
let outsideClickHandler = null;
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

function bindOutsideClickListener() {
  if (outsideClickHandler || typeof document === "undefined") return;
  outsideClickHandler = (event) => {
    if (!isOpen) return;
    const target = event.target;
    if (
      (popoverEl && popoverEl.contains(target)) ||
      (filtersButtonEl && filtersButtonEl.contains(target))
    ) {
      return;
    }
    closeTagExplorer();
  };
  try {
    document.addEventListener("mousedown", outsideClickHandler, true);
    document.addEventListener("touchstart", outsideClickHandler, { passive: true });
  } catch {
    // ignore listener binding issues
  }
}

function unbindOutsideClickListener() {
  if (!outsideClickHandler || typeof document === "undefined") return;
  try {
    document.removeEventListener("mousedown", outsideClickHandler, true);
    document.removeEventListener("touchstart", outsideClickHandler);
  } catch {
    // ignore listener cleanup issues
  }
  outsideClickHandler = null;
}

function positionPopover() {
  if (!popoverEl || !panelEl || !filtersButtonEl || typeof window === "undefined") {
    return;
  }

  const btnRect = filtersButtonEl.getBoundingClientRect();
  if (!btnRect || !Number.isFinite(btnRect.top)) return;

  const panelRect = panelEl.getBoundingClientRect();
  const panelWidth = panelRect.width || panelEl.offsetWidth || 0;
  const panelHeight = panelRect.height || panelEl.offsetHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  let left = btnRect.right - panelWidth;
  if (!Number.isFinite(left)) left = btnRect.left || 0;
  const minMargin = 12;
  if (left < minMargin) {
    left = Math.max(minMargin, btnRect.left || minMargin);
  }
  if (viewportWidth && panelWidth) {
    const maxLeft = viewportWidth - panelWidth - minMargin;
    if (Number.isFinite(maxLeft)) {
      left = Math.min(left, maxLeft);
    }
  }

  let top = btnRect.bottom + 8;
  let flipped = false;
  if (viewportHeight && panelHeight) {
    const maxTop = viewportHeight - panelHeight - minMargin;
    if (Number.isFinite(maxTop) && top > maxTop) {
      const aboveTop = btnRect.top - panelHeight - 8;
      if (Number.isFinite(aboveTop) && aboveTop >= minMargin) {
        top = aboveTop;
        flipped = true;
      } else {
        top = Math.max(minMargin, maxTop);
      }
    }
  }

  popoverEl.style.left = `${Math.round(left)}px`;
  popoverEl.style.top = `${Math.round(top)}px`;
  popoverEl.classList.toggle("is-flipped", flipped);
}

function syncOpenCategoryHeights() {
  heightSyncFrame = null;
  if (!groupsContainerEl) return;
  const sections = groupsContainerEl.querySelectorAll(".filter-category");
  sections.forEach((section) => {
    const tagList = section.querySelector(".filter-category__tags");
    if (!tagList) return;
    
    // Force layout to get accurate measurements
    tagList.style.transition = 'none';
    const height = tagList.scrollHeight;
    const value = Number.isFinite(height) && height > 0 ? `${Math.ceil(height)}px` : "0px";
    
    // Only update if the value has actually changed to prevent flickering
    const currentValue = section.style.getPropertyValue("--filter-category-open-height");
    if (currentValue !== value) {
      try {
        section.style.setProperty("--filter-category-open-height", value);
      } catch {
        // ignore style assignment issues
      }
    }
    
    // Re-enable transitions after a frame
    requestAnimationFrame(() => {
      tagList.style.transition = '';
    });
  });
}

function scheduleOpenCategoryHeightSync() {
  if (heightSyncFrame !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(heightSyncFrame);
  }
  if (typeof requestAnimationFrame === "function") {
    heightSyncFrame = requestAnimationFrame(() => {
      syncOpenCategoryHeights();
    });
  } else {
    syncOpenCategoryHeights();
  }
}

function observeTagListHeight(tagList) {
  if (!tagList || typeof ResizeObserver !== "function") return;
  if (!tagListResizeObserver) {
    try {
      tagListResizeObserver = new ResizeObserver(() => {
        scheduleOpenCategoryHeightSync();
      });
    } catch {
      tagListResizeObserver = null;
    }
  }
  if (!tagListResizeObserver) return;
  if (observedTagLists && observedTagLists.has(tagList)) return;
  try {
    tagListResizeObserver.observe(tagList);
    if (observedTagLists) observedTagLists.add(tagList);
  } catch {
    // ignore observer errors
  }
}

function ensureHeightSyncListeners() {
  if (heightSyncListenersBound || typeof window === "undefined") return;
  heightSyncResizeHandler = () => {
    scheduleOpenCategoryHeightSync();
    if (isOpen) {
      positionPopover();
    }
  };
  try {
    window.addEventListener("resize", heightSyncResizeHandler, { passive: true });
    window.addEventListener("orientationchange", heightSyncResizeHandler);
  } catch {
    // ignore listener binding failures
  }
  try {
    scrollRepositionHandler = () => {
      if (isOpen) {
        positionPopover();
      }
    };
    window.addEventListener("scroll", scrollRepositionHandler, { passive: true });
  } catch {
    scrollRepositionHandler = null;
  }
  try {
    window.addEventListener("beforeunload", () => {
      if (heightSyncResizeHandler) {
        window.removeEventListener("resize", heightSyncResizeHandler);
        window.removeEventListener("orientationchange", heightSyncResizeHandler);
        heightSyncResizeHandler = null;
      }
      if (scrollRepositionHandler) {
        window.removeEventListener("scroll", scrollRepositionHandler);
        scrollRepositionHandler = null;
      }
      unbindOutsideClickListener();
      if (tagListResizeObserver) {
        try {
          tagListResizeObserver.disconnect();
        } catch {
          // ignore disconnect issues
        }
        tagListResizeObserver = null;
      }
    });
  } catch {
    // ignore beforeunload issues
  }
  try {
    window.scheduleOpenCategoryHeightSync = scheduleOpenCategoryHeightSync;
  } catch {
    // ignore global assignment issues
  }
  heightSyncListenersBound = true;
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

    const setExpandedState = (open, options = {}) => {
      const isOpen = Boolean(open);
      section.classList.toggle("open", isOpen);
      header.setAttribute("aria-expanded", isOpen ? "true" : "false");
      tagList.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (!options.skipSchedule) {
        scheduleOpenCategoryHeightSync();
      }
    };

    header.addEventListener("click", () => {
      setExpandedState(!section.classList.contains("open"));
    });
    section.appendChild(header);

    matchingTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-tag-button";
      btn.setAttribute("data-tag", tag);
      const count = counts[tag] || 0;
      const labelSpan = document.createElement("span");
      labelSpan.className = "filter-tag-button__label";
      labelSpan.textContent = formatTagLabel(tag);
      const countSpan = document.createElement("span");
      countSpan.className = "filter-tag-button__count";
      countSpan.textContent = `(${count})`;
      btn.appendChild(labelSpan);
      btn.appendChild(countSpan);
      const isActive = active.has(tag);
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.addEventListener("click", () => handleTagToggle(tag));
      tagList.appendChild(btn);
    });

    section.appendChild(tagList);
    groupsContainerEl.appendChild(section);
    observeTagListHeight(tagList);
    setExpandedState(shouldOpen, { skipSchedule: true });
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

  scheduleOpenCategoryHeightSync();
}

function renderExplorer() {
  renderSelectedTags();
  renderCategories();
  if (isOpen) {
    positionPopover();
  }
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
  if (!filtersButtonEl && typeof document !== "undefined") {
    filtersButtonEl = document.getElementById("filters-btn");
  }
  if (!popoverEl) return;
  if (isOpen) {
    closeTagExplorer();
    return;
  }
  isOpen = true;
  popoverEl.classList.add("open");
  popoverEl.setAttribute("aria-hidden", "false");
  if (searchInputEl) {
    searchInputEl.value = searchValue;
  }
  if (nameInputEl) {
    const currentName =
      typeof getArtistNameFilter === "function" ? getArtistNameFilter() : "";
    nameInputEl.value = currentName || "";
  }
  renderExplorer();
  if (searchInputEl) {
    try {
      searchInputEl.focus({ preventScroll: true });
    } catch {
      // ignore focus issues
    }
  } else if (panelEl) {
    panelEl.setAttribute("tabindex", "-1");
    try {
      panelEl.focus({ preventScroll: true });
    } catch {
      // ignore focus issues
    }
  }
  positionPopover();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      positionPopover();
    });
  }
  bindEscapeListener();
  bindOutsideClickListener();
  emitOverlayToggle(true);
}

function closeTagExplorer() {
  if (!popoverEl || !isOpen) return;
  isOpen = false;
  popoverEl.classList.remove("open");
  popoverEl.setAttribute("aria-hidden", "true");
  unbindEscapeListener();
  unbindOutsideClickListener();
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

  filtersButtonEl = document.getElementById("filters-btn");

  popoverEl = document.createElement("div");
  popoverEl.className = "filter-popover";
  popoverEl.id = "tag-filter-popover";
  popoverEl.setAttribute("aria-hidden", "true");
  popoverEl.innerHTML = `
    <div class="filter-panel filter-panel--floating" id="tag-filter-panel" role="region" aria-label="Tag filters">
      <header class="filter-panel__header filter-panel__header--compact">
        <h2>Filters</h2>
        <div class="filter-panel__header-buttons">
          <button type="button" class="filter-panel__clear">Clear all</button>
          <button type="button" class="filter-panel__close" aria-label="Close filters">×</button>
        </div>
      </header>
      <div class="filter-panel__controls filter-panel__controls--floating">
        <label class="visually-hidden" for="tag-filter-search">Search tags</label>
        <input id="tag-filter-search" class="filter-panel__search" type="search" placeholder="Search tags" autocomplete="off" />
        <label class="visually-hidden" for="tag-filter-name">Filter artists by name</label>
        <input id="tag-filter-name" class="filter-panel__search" type="search" placeholder="Filter artists by name" autocomplete="off" />
        <p class="filter-panel__notice" aria-live="assertive"></p>
      </div>
      <div class="filter-panel__selected" aria-live="polite"></div>
      <div class="filter-panel__groups"></div>
    </div>
  `;

  document.body.appendChild(popoverEl);

  panelEl = popoverEl.querySelector("#tag-filter-panel");
  searchInputEl = popoverEl.querySelector("#tag-filter-search");
  nameInputEl = popoverEl.querySelector("#tag-filter-name");
  groupsContainerEl = popoverEl.querySelector(".filter-panel__groups");
  overlaySelectedEl = popoverEl.querySelector(".filter-panel__selected");
  limitNoticeEl = popoverEl.querySelector(".filter-panel__notice");
  clearButtonEl = popoverEl.querySelector(".filter-panel__clear");
  if (panelEl) {
    panelEl.setAttribute("tabindex", "-1");
  }

  const closeBtn = popoverEl.querySelector(".filter-panel__close");
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

  ensureHeightSyncListeners();
  renderExplorer();
  isInitialized = true;
}

export { openTagExplorer, initTagExplorer, setAllArtists, getFilteredCounts };
