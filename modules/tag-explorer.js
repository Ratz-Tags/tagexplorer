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
let filterTriggerEl = null;
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
      (filterTriggerEl && filterTriggerEl.contains(target)) ||
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
  if (
    !popoverEl ||
    !panelEl ||
    !filtersButtonEl ||
    typeof window === "undefined"
  ) {

    return;
  }

  const btnRect = filtersButtonEl.getBoundingClientRect();
  if (!btnRect || !Number.isFinite(btnRect.top)) return;

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 0;
  const panelRect = panelEl.getBoundingClientRect();
  const panelHeight = panelRect.height || panelEl.offsetHeight || 0;
  const gutter = 16;

  const spaceBelow = viewportHeight ? viewportHeight - btnRect.bottom - gutter : 0;
  const spaceAbove = btnRect.top - gutter;
  let flipped = false;
  let availableSpace = spaceBelow;

  if (panelHeight && spaceBelow < panelHeight && spaceAbove > spaceBelow) {
    flipped = true;
    availableSpace = spaceAbove;
  }

  const maxHeight = Math.max(
    240,
    Math.min(
      560,
      Number.isFinite(availableSpace)
        ? Math.max(availableSpace - gutter / 2, 240)
        : 320
    )
  );

  if (Number.isFinite(maxHeight) && maxHeight > 0) {
    try {
      popoverEl.style.setProperty(
        "--filter-panel-max-height",
        `${Math.round(maxHeight)}px`
      );
    } catch {
      // ignore style assignment issues
    }
  }

  if (filterTriggerEl) {
    filterTriggerEl.classList.toggle("is-flipped", flipped);
  }
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

function expandAllCategories() {
  if (!groupsContainerEl) return;
  const sections = groupsContainerEl.querySelectorAll(".tag-category-item");
  sections.forEach(section => {
    section.classList.add("open");
    const header = section.querySelector(".tag-category-header");
    const tagList = section.querySelector(".tag-category-tags");
    if (header) header.setAttribute("aria-expanded", "true");
    if (tagList) tagList.setAttribute("aria-hidden", "false");
  });
  scheduleOpenCategoryHeightSync();
}

function collapseAllCategories() {
  if (!groupsContainerEl) return;
  const sections = groupsContainerEl.querySelectorAll(".tag-category-item");
  sections.forEach(section => {
    section.classList.remove("open");
    const header = section.querySelector(".tag-category-header");
    const tagList = section.querySelector(".tag-category-tags");
    if (header) header.setAttribute("aria-expanded", "false");
    if (tagList) tagList.setAttribute("aria-hidden", "true");
  });
  scheduleOpenCategoryHeightSync();
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
    const section = document.createElement("div");
    section.className = "tag-category-item";
    const shouldOpen =
      searchValueLower !== "" || matchingTags.some((tag) => active.has(tag));
    if (shouldOpen) section.classList.add("open");

    const header = document.createElement("div");
    header.className = "tag-category-header";
    header.innerHTML = `
      <div class="tag-category-info">
        <span class="tag-category-title">${category}</span>
        <span class="tag-category-count">${matchingTags.length}</span>
      </div>
      <div class="tag-category-arrow">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    const tagList = document.createElement("div");
    tagList.className = "tag-category-tags";
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

    header.addEventListener("click", (e) => {
      console.log("Category header clicked:", category, "Current open state:", section.classList.contains("open"));
      e.preventDefault();
      e.stopPropagation();
      setExpandedState(!section.classList.contains("open"));
    });
    section.appendChild(header);

    matchingTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = active.has(tag) ? "tag-button-sidebar active" : "tag-button-sidebar";
      btn.setAttribute("data-tag", tag);
      const count = counts[tag] || 0;
      btn.innerHTML = `${formatTagLabel(tag)} <span style="color: #94a3b8; font-size: 0.7em;">(${count})</span>`;
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
  
  // Show overlay on mobile
  const overlay = document.querySelector("#tag-explorer-overlay");
  if (overlay && window.innerWidth <= 520) {
    overlay.classList.add("visible");
  }
  
  if (filterTriggerEl) {
    filterTriggerEl.classList.add("is-open");
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
  
  // Hide overlay
  const overlay = document.querySelector("#tag-explorer-overlay");
  if (overlay) {
    overlay.classList.remove("visible");
  }
  
  if (filterTriggerEl) {
    filterTriggerEl.classList.remove("is-open");
    filterTriggerEl.classList.remove("is-flipped");
  }

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
  if (filtersButtonEl) {
    filterTriggerEl = filtersButtonEl.closest(".filter-trigger");
    if (!filterTriggerEl && filtersButtonEl.parentElement) {
      const wrapper = document.createElement("div");
      wrapper.className = "filter-trigger";
      filtersButtonEl.parentElement.insertBefore(wrapper, filtersButtonEl);
      wrapper.appendChild(filtersButtonEl);
      filterTriggerEl = wrapper;
    }
    
    // Bind filter button click event
    filtersButtonEl.addEventListener("click", (event) => {
      event.preventDefault();
      if (isOpen) {
        closeTagExplorer();
      } else {
        openTagExplorer();
      }
    });
  }

  popoverEl = document.getElementById("tag-filter-popover");
  if (!popoverEl) {
    popoverEl = document.createElement("div");
    popoverEl.id = "tag-filter-popover";
    document.body.appendChild(popoverEl);
  }
  popoverEl.classList.add("tag-explorer-sidebar");
  popoverEl.setAttribute("aria-hidden", "true");
  popoverEl.innerHTML = `
    <div class="tag-explorer-header">
      <h2 class="tag-explorer-title">Filter Tags</h2>
      <div class="tag-explorer-controls">
        <button type="button" class="tag-explorer-expand-all" aria-label="Expand all categories" title="Expand All">⊞</button>
        <button type="button" class="tag-explorer-collapse-all" aria-label="Collapse all categories" title="Collapse All">⊟</button>
        <button type="button" class="tag-explorer-close" aria-label="Close tag explorer">×</button>
      </div>
    </div>
    <div class="tag-explorer-content">
      <div class="tag-explorer-search">
        <input id="tag-filter-search" type="search" placeholder="Search tags..." autocomplete="off" />
      </div>
      <div class="tag-explorer-categories" id="tag-explorer-categories"></div>
    </div>
  `;
  
  // Create overlay for mobile
  const mobileOverlay = document.createElement("div");
  mobileOverlay.className = "tag-explorer-overlay";
  mobileOverlay.id = "tag-explorer-overlay";
  document.body.appendChild(mobileOverlay);

  searchInputEl = popoverEl.querySelector("#tag-filter-search");
  groupsContainerEl = popoverEl.querySelector("#tag-explorer-categories");
  
  const closeBtn = popoverEl.querySelector(".tag-explorer-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeTagExplorer());
  }
  
  const expandAllBtn = popoverEl.querySelector(".tag-explorer-expand-all");
  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => expandAllCategories());
  }
  
  const collapseAllBtn = popoverEl.querySelector(".tag-explorer-collapse-all");
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", () => collapseAllCategories());
  }
  
  const overlay = document.querySelector("#tag-explorer-overlay");
  if (overlay) {
    overlay.addEventListener("click", () => closeTagExplorer());
  }

  if (searchInputEl) {
    searchInputEl.addEventListener("input", (event) => {
      handleSearchInput(event.target.value || "");
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
