import {
  getActiveTags,
  getKinkTags,
  toggleTag,
  getArtistNameFilter,
  handleArtistNameFilter,
  handleTagSearch,
  clearAllTags,
} from "./tags.js";
import { setSortMode, reshuffleArtists } from "./gallery.js";

// Removed client-side selection cap: allow unlimited tag selection.
// Server/API handles any practical limits; keep client lightweight.
const MAX_TAG_SELECTION = Infinity;

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
let searchDebounceTimer = null;
// Height sync variables removed
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
  // No-op when unlimited selection is allowed. Keep function for compatibility.
  return;
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

// Height sync functions removed

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
  // 1. Update state
  toggleTag(tag);
  
  // 2. Immediate visual feedback (optimistic update)
  if (groupsContainerEl) {
    const btn = groupsContainerEl.querySelector(`button[data-tag="${tag}"]`);
    if (btn) {
      const isActive = btn.classList.toggle("active");
      // Optional: Update aria-pressed if you were using it, or just rely on class
    }
  }
  
  // 3. Fast update of selected tags bar
  renderSelectedTags();

  // 4. Defer heavy re-render of categories (counts/sorting) to next frame
  // This allows the button toggle to paint immediately
  requestAnimationFrame(() => {
    setTimeout(() => {
      renderCategories();
    }, 0);
  });
}

function expandAllCategories() {
  if (!groupsContainerEl) return;
  const sections = groupsContainerEl.querySelectorAll(".filter-category");
  sections.forEach(section => {
    section.classList.add("open");
    const header = section.querySelector(".filter-category__header");
    const tagList = section.querySelector(".filter-category__tags");
    if (header) header.setAttribute("aria-expanded", "true");
    if (tagList) tagList.setAttribute("aria-hidden", "false");
  });
}

function collapseAllCategories() {
  if (!groupsContainerEl) return;
  const sections = groupsContainerEl.querySelectorAll(".filter-category");
  sections.forEach(section => {
    section.classList.remove("open");
    const header = section.querySelector(".filter-category__header");
    const tagList = section.querySelector(".filter-category__tags");
    if (header) header.setAttribute("aria-expanded", "false");
    if (tagList) tagList.setAttribute("aria-hidden", "true");
  });
}

function formatTagLabel(tag) {
  return tag.replace(/_/g, " ");
}

function renderCategories() {
  if (!groupsContainerEl) {
    console.warn('[tag-explorer] groupsContainerEl not found, skipping render');
    return;
  }
  
  const active = getActiveTags();
  const counts = getFilteredCounts(active);
  const categories = getKinkTags();
  
  // console.log('[tag-explorer] Rendering categories:', categories.length, 'categories available');
  
  if (!categories || categories.length === 0) {
    // Only show error if container is empty or showing spinner
    if (!groupsContainerEl.querySelector('.filter-category')) {
       console.warn('[tag-explorer] No categories found, showing error state');
       // ... existing error handling logic ...
       // For brevity, keeping the error handling simple or reusing existing if complex
       // But since we are diffing, we should only overwrite if truly empty/error
       groupsContainerEl.innerHTML = `
        <div class="tag-loading-error">
          <div class="tag-loading-error__title">Tags Not Available</div>
          <div class="tag-loading-error__message">Unable to load tag categories. Attempting to reload...</div>
          <button class="tag-loading-error__retry" onclick="this.disabled=true; this.textContent='Retrying...'; window.tagExplorer?.forceReload?.();">
            🔄 Retry Now
          </button>
        </div>
      `;
       // ... retry logic ...
    }
    return;
  }
  
  // Remove error/loading states if present
  const errorOrSpinner = groupsContainerEl.querySelector('.tag-loading-error, .tag-loading-spinner, .filter-empty-state');
  if (errorOrSpinner) {
    errorOrSpinner.remove();
  }

  let renderedAny = false;
  
  // Map existing categories by title for reuse
  const existingSections = new Map();
  groupsContainerEl.querySelectorAll('.filter-category').forEach(el => {
    const title = el.querySelector('.tag-category-title')?.textContent;
    if (title) existingSections.set(title, el);
  });

  categories.forEach(({ category, tags }, index) => {
    const matchingTags = tags.filter((tag) => {
      if (searchValueLower && !tag.toLowerCase().includes(searchValueLower)) {
        return false;
      }
      const count = counts[tag] || 0;
      return count > 0 || active.has(tag);
    });

    matchingTags.sort((a, b) => {
      const countA = counts[a] || 0;
      const countB = counts[b] || 0;
      return countB - countA || a.localeCompare(b);
    });

    if (matchingTags.length === 0) {
      // If category exists but has no matching tags, remove it
      if (existingSections.has(category)) {
        existingSections.get(category).remove();
        existingSections.delete(category);
      }
      return;
    }

    renderedAny = true;
    let section = existingSections.get(category);
    let tagListInner;

    const shouldOpen = searchValueLower !== "" || matchingTags.some((tag) => active.has(tag));

    if (!section) {
      // Create new section
      section = document.createElement("div");
      section.className = "filter-category";
      if (shouldOpen) section.classList.add("open");

      const header = document.createElement("div");
      header.className = "filter-category__header";
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
      tagList.className = "filter-category__tags";
      tagList.setAttribute("role", "group");
      tagList.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

      tagListInner = document.createElement("div");
      tagListInner.className = "filter-category__inner";
      
      tagList.appendChild(tagListInner);
      section.appendChild(header);
      section.appendChild(tagList);
      
      // Append in order? Ideally yes, but appending to end is simpler for now.
      // To maintain order, we might need `insertBefore` logic, but let's assume append is fine for new ones.
      groupsContainerEl.appendChild(section);

      // Add event listeners
      header.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = !section.classList.contains("open");
        section.classList.toggle("open", isOpen);
        header.setAttribute("aria-expanded", isOpen ? "true" : "false");
        tagList.setAttribute("aria-hidden", isOpen ? "false" : "true");
      });

    } else {
      // Update existing section
      existingSections.delete(category); // Remove from map so we don't delete it later
      
      // Update count
      const countEl = section.querySelector('.tag-category-count');
      if (countEl) countEl.textContent = matchingTags.length;
      
      // Update open state if searching
      if (searchValueLower !== "") {
         if (shouldOpen) section.classList.add("open");
      }
      
      tagListInner = section.querySelector('.filter-category__inner');
    }

    // Update tags within the category
    // We can use a similar diffing strategy for buttons
    const existingButtons = new Map();
    tagListInner.querySelectorAll('.tag-button-sidebar').forEach(btn => {
      const tag = btn.getAttribute('data-tag');
      if (tag) existingButtons.set(tag, btn);
    });

    matchingTags.forEach(tag => {
      const count = counts[tag] || 0;
      const isActive = active.has(tag);
      let btn = existingButtons.get(tag);

      if (btn) {
        existingButtons.delete(tag);
        // Update state
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
        
        // Update count text if needed (optimization: only if changed)
        // btn.innerHTML = `${formatTagLabel(tag)} <span style="color: #94a3b8; font-size: 0.7em;">(${count})</span>`;
        // To avoid innerHTML churn, maybe check?
        const countSpan = btn.querySelector('span');
        if (countSpan) {
           const currentCount = parseInt(countSpan.textContent.replace(/[()]/g, ''));
           if (currentCount !== count) {
             countSpan.textContent = `(${count})`;
           }
        }
      } else {
        // Create new button
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = isActive ? "tag-button-sidebar active" : "tag-button-sidebar";
        btn.setAttribute("data-tag", tag);
        btn.innerHTML = `${formatTagLabel(tag)} <span style="color: #94a3b8; font-size: 0.7em;">(${count})</span>`;
        btn.addEventListener("click", () => handleTagToggle(tag));
        tagListInner.appendChild(btn);
      }
      
      // Re-append to ensure sort order? 
      // If we want to strictly respect `matchingTags` sort order, we should appendChild (which moves it to end)
      // This is cheap if it's already the last child, but ensures order.
      tagListInner.appendChild(btn);
    });

    // Remove tags that are no longer matching
    existingButtons.forEach(btn => btn.remove());
  });

  // Remove sections that are no longer in the filtered categories
  existingSections.forEach(el => el.remove());

  if (!renderedAny) {
    const emptyState = document.createElement("p");
    emptyState.className = "filter-empty-state";
    emptyState.textContent = searchValueLower
      ? "No tags match your search."
      : "No tags available for the current filters.";
    groupsContainerEl.appendChild(emptyState);
  }
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

function toggleTagExplorer(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  if (isOpen) {
    closeTagExplorer();
  } else {
    openTagExplorer();
  }
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
  
  // Update aria-expanded on all filter buttons
  const filterButtons = [
    document.getElementById('filters-btn'),
    document.getElementById('cover-filters-btn'),
  ].filter(Boolean);
  filterButtons.forEach(btn => btn.setAttribute('aria-expanded', 'true'));
  
  // Show overlay on mobile
  const overlay = document.querySelector("#tag-explorer-overlay");
  const foldMode = document.documentElement?.dataset?.foldMode;
  const isCoverMode = foldMode === 'fold-cover' || (typeof window !== 'undefined' && window.matchMedia('(max-width: 520px)').matches);
  if (overlay && isCoverMode) {
    overlay.classList.add("visible");
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('filters-open');
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
    // Avoid auto-focusing the search input on small screens to prevent
    // triggering the mobile virtual keyboard and browser zoom behavior.
    if (typeof window !== 'undefined' && window.innerWidth > 520) {
      try {
        searchInputEl.focus({ preventScroll: true });
      } catch {
        // ignore focus issues
      }
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
  
  // Update aria-expanded on all filter buttons
  const filterButtons = [
    document.getElementById('filters-btn'),
    document.getElementById('cover-filters-btn'),
  ].filter(Boolean);
  filterButtons.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  
  // Hide overlay
  const overlay = document.querySelector("#tag-explorer-overlay");
  if (overlay) {
    overlay.classList.remove("visible");
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('filters-open');
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
  
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    handleTagSearch(value);
    renderCategories();
  }, 300);
}

function handleSortChange() {
  if (!popoverEl) return;
  const checkboxes = popoverEl.querySelectorAll('input[name="sort"]:checked');
  const modes = Array.from(checkboxes).map(cb => cb.value);
  
  // Ensure 'name' is always included as fallback
  if (!modes.includes('name')) modes.push('name');
  
  // Prioritize: Count > Tag Frequency > Name
  const order = ['count', 'tag-frequency', 'name'];
  modes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  
  setSortMode(modes);
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
      <div class="tag-explorer-sort">
        <div class="sort-options">
           <label class="sort-option" title="Sort by total number of images">
             <input type="checkbox" name="sort" value="count" />
             <span class="sort-chip">Count</span>
           </label>
           <label class="sort-option" title="Sort by frequency of selected tags">
             <input type="checkbox" name="sort" value="tag-frequency" />
             <span class="sort-chip">Relevance</span>
           </label>
           <label class="sort-option" title="Randomize order">
             <input type="checkbox" name="sort" value="shuffle" />
             <span class="sort-chip">Shuffle</span>
           </label>
           <label class="sort-option" title="Sort alphabetically (always active)">
             <input type="checkbox" name="sort" value="name" checked disabled />
             <span class="sort-chip">Name</span>
           </label>
        </div>
      </div>
      <div class="tag-explorer-search">
        <input id="tag-filter-search" type="search" placeholder="Search tags..." autocomplete="off" />
      </div>
      <div class="tag-explorer-categories" id="tag-explorer-categories"></div>
    </div>
  `;
  // Listen for tag loading events
  window.addEventListener('tagsLoaded', (event) => {
    console.log('[tag-explorer] Tags loaded event received:', event.detail);
    renderCategories();
  });
  
  window.addEventListener('tagsLoadError', (event) => {
    console.error('[tag-explorer] Tags load error event received:', event.detail);
    if (groupsContainerEl) {
      groupsContainerEl.innerHTML = `
        <div class="tag-loading-error">
          <div class="tag-loading-error__title">Tag Loading Failed</div>
          <div class="tag-loading-error__message">Unable to load tag data: ${event.detail.error}</div>
          <button class="tag-loading-error__retry" onclick="window.location.reload();">
            🔄 Reload Page
          </button>
        </div>
      `;
    }
  });
  
  // Set up manual reload callback for tag-explorer
  window.tagExplorer = window.tagExplorer || {};
  window.tagExplorer.onTagsLoaded = () => {
    console.log('[tag-explorer] Manual tags loaded callback triggered');
    renderCategories();
  };

  // Create mobile overlay
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

  const sortCheckboxes = popoverEl.querySelectorAll('input[name="sort"]');
  sortCheckboxes.forEach(cb => {
    cb.addEventListener("change", (e) => {
       if (e.target.value === "shuffle" && e.target.checked) {
         sortCheckboxes.forEach(other => {
           if (other !== e.target && other.value !== "name") {
             other.checked = false;
           }
         });
       } else if (e.target.value !== "shuffle" && e.target.checked) {
         const shuffleCb = popoverEl.querySelector('input[value="shuffle"]');
         if (shuffleCb) shuffleCb.checked = false;
       }
       handleSortChange();
    });
  });

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

  // ensureHeightSyncListeners removed
  renderExplorer();
  isInitialized = true;
}

export { openTagExplorer, initTagExplorer, toggleTagExplorer, setAllArtists, getFilteredCounts };
