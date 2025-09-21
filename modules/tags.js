import { vibrate } from "./ui.js";
import { fetchWithCache } from "./fetch-cache.js";

/**
 * Tags module - Handles tag filtering, buttons, and related functionality
 */

// Tag state
let activeTags = new Set();
let searchFilter = "";
let artistNameFilter = "";
let tagTooltips = {};
let tagTaunts = {};
let taunts = [];

// DOM references
let tagButtonsContainer = null;
let tagSearchInput = null;
let artistNameFilterInput = null;
let clearTagsBtn = null;
let jrpgBubbles = null;
let selectedTagsBar = null;

// External dependencies that will be injected
let allArtists = [];
let renderArtists = null;
let setRandomBackground = null;

let kinkTags = [];

// Kink tags list (loaded from kink-tags.json)
const kinkTagsByCategory = [
  {
    category: "Bondage & Restraints",
    tags: [
      "bondage", "bound", "hogtie", "restraints", "restrained", "leash", "spreader_bar", "shibari", "immobilization", "chastity_cage", "flat_chastity_cage", "chastity_cage_emission", "holding_key"
    ]
  },
  {
    category: "Feminization & Gender Play",
    tags: [
      "feminization", "forced_feminization", "bimbofication", "crossdressing", "crossdressing_(mtf)", "trap"
    ]
  },
  {
    category: "Humiliation & Degradation",
    tags: [
      "humiliation", "bullying", "small_penis", "small_penis_humiliation", "public_nudity", "body_writing", "cumdump", "viewer_on_leash"
    ]
  },
  {
    category: "Anal & Object Play",
    tags: [
      "anal_fingering", "anal_fisting", "anal_object_insertion", "object_insertion", "object_insertion_from_behind", "large_insertion", "sounding", "urethral_insertion", "dildo_riding", "huge_dildo", "strap-on", "pegging", "sex_toy", "sex_machine", "milking_machine", "penis_milking", "prostate_milking", "hand_milking", "handsfree_ejaculation"
    ]
  },
  {
    category: "Domination, Power & Sadism",
    tags: [
      "femdom", "dominatrix", "sadism", "assertive_female", "pet_play", "cbt", "punishment", "boot_worship", "trample"
    ]
  },
  {
    category: "Feet & Legs",
    tags: [
      "foot_worship", "toe_sucking", "sockjob"
    ]
  },
  {
    category: "Tentacles & Monsters",
    tags: [
      "tentacle_sex", "tentacle_pit", "knotting"
    ]
  },
  {
    category: "Cum, Fluids & Orifices",
    tags: [
      "cum", "cum_in_ass", "cum_in_mouth", "precum", "swallowing", "gokkun", "drinking_from_condom", "pouring_from_condom", "used_condom", "pussy_juice", "lactation"
    ]
  },
  {
    category: "Mind, Hypnosis & Control",
    tags: [
      "hypnosis", "mind_break", "mind_control"
    ]
  },
  {
    category: "Public, Cheating & Social",
    tags: [
      "before_and_after", "annoyed", "cheating_(relationship)", "clothed_female_nude_male", "public_nudity"
    ]
  },
  {
    category: "Body & Skin",
    tags: [
      "dark_skin", "nipple_piercing", "pubic_hair", "lactation", "stomach_bulge"
    ]
  },
  {
    category: "Oral & Face",
    tags: [
      "fellatio", "oral", "sitting_on_face"
    ]
  },
  {
    category: "Orgasm & Denial",
    tags: [
      "orgasm_denial", "forced_orgasm", "ruined_orgasm", "premature_ejaculation"
    ]
  },
  {
    category: "Nonconsensual & Extreme",
    tags: [
      "rape", "netorare", "netorase"
    ]
  },
];

function setKinkTags(tagsByCategory) {
  // Accepts array of { category, tags } objects
  if (Array.isArray(tagsByCategory)) {
    for (const cat of tagsByCategory) {
      if (!cat.category || !Array.isArray(cat.tags)) return;
    }
    kinkTagsByCategory.length = 0;
    kinkTagsByCategory.push(...tagsByCategory);
    // Regenerate the flat list of kinkTags
    kinkTags = kinkTagsByCategory.flatMap(category => category.tags);
  }
}


// Tag icons mapping
const tagIcons = {
  pegging: "icons/pegging.svg",
  chastity_cage: "icons/chastity_cage.svg",
  feminization: "icons/feminization.svg",
  bimbofication: "icons/bimbofication.svg",
  gagged: "icons/gagged.png",
  tentacle_sex: "icons/tentacle_sex.png",
  bukkake: "icons/bukkake.png",
  footjob: "icons/footjob.png",
  anal: "icons/anal.png",
  mind_break: "icons/mind_break.png",
  hypnosis: "icons/hypnosis.png",
  inflation: "icons/inflation.png",
  pregnant: "icons/pregnant.png",
};

let tagSearchMode = "contains"; // "contains", "starts", "ends"

function emitTagUpdate() {
  if (typeof document === "undefined" || typeof document.dispatchEvent !== "function") {
    return;
  }
  const detail = {
    activeTags: Array.from(activeTags),
    artistNameFilter,
  };
  try {
    document.dispatchEvent(new CustomEvent("tags:updated", { detail }));
  } catch (err) {
    if (typeof document.createEvent === "function") {
      try {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("tags:updated", false, false, detail);
        document.dispatchEvent(evt);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Spawns a taunt bubble for a selected tag
 */
function spawnBubble(tag) {
  if (!jrpgBubbles) return;

  const div = document.createElement("div");
  div.className = "jrpg-bubble";
  const chibi = document.createElement("img");
  chibi.src = "icons/chibi.png";
  chibi.className = "chibi";
  const line = document.createElement("span");
  const pool = tagTaunts[tag] || taunts;
  line.textContent =
    pool[Math.floor(Math.random() * pool.length)] ||
    `Still chasing '${tag}' huh? You're beyond help.`;
  div.append(chibi, line);
  jrpgBubbles.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

/**
 * Updates the filtered results summary section
 */
function updateFilteredResultsSummary(filteredCount, totalCount) {
  if (typeof document === "undefined") return;
  const filteredResultsEl = document.getElementById("filtered-results");
  if (!filteredResultsEl) return;

  if (activeTags.size > 0 || artistNameFilter) {
    // Show summary when filters are active
    const tagText =
      activeTags.size > 0 ? `Tags: ${Array.from(activeTags).join(", ")}` : "";
    const nameText = artistNameFilter
      ? `Name filter: "${artistNameFilter}"`
      : "";
    const filterText = [tagText, nameText].filter((t) => t).join(" | ");

    filteredResultsEl.innerHTML = `
      <div class="filter-summary">
        <div class="filter-count">Showing ${filteredCount} of ${totalCount} artists</div>
        <div class="filter-details">${filterText}</div>
      </div>
    `;
    filteredResultsEl.style.display = "block";
  } else {
    // Hide summary when no filters are active
    filteredResultsEl.style.display = "none";
  }
}

/**
 * Renders the tag filter buttons based on current state
 */
function renderTagButtons() {
  // Get artists matching current filters
  const filteredArtists = allArtists.filter((artist) => {
    const tags = artist.kinkTags || [];
    return (
      Array.from(activeTags).every((tag) => tags.includes(tag)) &&
      (artist.artistName.toLowerCase().includes(artistNameFilter) ||
        artistNameFilter === "")
    );
  });

  // Update filtered results summary
  updateFilteredResultsSummary(filteredArtists.length, allArtists.length);

  if (clearTagsBtn) clearTagsBtn.style.display = activeTags.size ? "" : "none";

  if (!tagButtonsContainer) return;

  tagButtonsContainer.innerHTML = "";
  tagButtonsContainer.setAttribute("role", "group");
  tagButtonsContainer.setAttribute("aria-label", "Tag filters");

  // Get all tags present in filtered artists
  const possibleTags = new Set();
  filteredArtists.forEach((artist) => {
    (artist.kinkTags || []).forEach((tag) => possibleTags.add(tag));
  });

  const filter = searchFilter.trim().toLowerCase();
  let foundMatch = false;

  // Build category sections
  kinkTagsByCategory.forEach(({ category, tags }) => {
    let categoryTags = tags.filter(
      (t) => possibleTags.has(t) || activeTags.has(t)
    );

    if (filter) {
      categoryTags = categoryTags.filter((t) => {
        const tl = t.toLowerCase();
        if (tagSearchMode === "starts") return tl.startsWith(filter);
        if (tagSearchMode === "ends") return tl.endsWith(filter);
        return tl.includes(filter);
      });
      if (categoryTags.length > 0) foundMatch = true;
    }

    if (categoryTags.length === 0) return;

    const details = document.createElement("details");
    details.className = "tag-group";
    if (filter || categoryTags.some((t) => activeTags.has(t))) details.open = true;

    const summary = document.createElement("summary");
    summary.className = "tag-group-header";
    summary.textContent = category;
    details.appendChild(summary);

    const tagsDiv = document.createElement("div");
    tagsDiv.className = "tag-group-tags";

    categoryTags.forEach((tag) => {
      const button = document.createElement("button");
      button.className = "tag-button";
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Toggle tag ${tag.replaceAll("_", " ")}`
      );
      button.setAttribute("aria-pressed", activeTags.has(tag) ? "true" : "false");
      button.setAttribute("role", "switch");
      if (tagIcons[tag]) {
        const icon = document.createElement("img");
        icon.src = tagIcons[tag];
        icon.style.height = "16px";
        icon.style.marginRight = "4px";
        button.appendChild(icon);
      }
      button.appendChild(document.createTextNode(tag.replaceAll("_", " ")));
      button.dataset.tag = tag;
      if (tagTooltips[tag]) button.title = tagTooltips[tag];
      if (activeTags.has(tag)) button.classList.add("active");
      button.onclick = () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
        } else {
          if (activeTags.size >= 2) return;
          activeTags.add(tag);
          spawnBubble(tag);
        }
        button.setAttribute(
          "aria-pressed",
          activeTags.has(tag) ? "true" : "false"
        );
        renderTagButtons();
        if (renderArtists) renderArtists(true);
        if (setRandomBackground) setRandomBackground();
        if (navigator.vibrate) navigator.vibrate(50);
      };
      tagsDiv.appendChild(button);
    });

    details.appendChild(tagsDiv);
    tagButtonsContainer.appendChild(details);
  });

  // Custom typed tag not found in known list
  if (filter && !foundMatch && !kinkTags.includes(filter)) {
    const button = document.createElement("button");
    button.className = "tag-button";
    button.type = "button";
    button.textContent = filter.replaceAll("_", " ");
    button.dataset.tag = filter;
    if (activeTags.has(filter)) button.classList.add("active");
    button.onclick = () => {
      if (activeTags.has(filter)) {
        activeTags.delete(filter);
      } else {
        if (activeTags.size >= 2) return;
        activeTags.add(filter);
        spawnBubble(filter);
      }
      renderTagButtons();
      if (renderArtists) renderArtists(true);
      if (setRandomBackground) setRandomBackground();
      if (navigator.vibrate) navigator.vibrate(50);
    };
    tagButtonsContainer.prepend(button);
  }
}

/**
 * Clears all active tags
 */
function clearAllTags() {
  activeTags.clear();
  renderTagButtons();
  if (navigator.vibrate) navigator.vibrate(50);
  if (renderArtists) renderArtists(true); // <-- force full update
  if (setRandomBackground) setRandomBackground();
  emitTagUpdate();
}

/**
 * Toggles a single tag on or off
 */
function toggleTag(tag) {
  if (activeTags.has(tag)) {
    activeTags.delete(tag);
  } else {
    activeTags.add(tag);
    spawnBubble(tag);
  }
  // After changing state, try to update any visible tag buttons' aria-pressed
  if (tagButtonsContainer) {
    const btn = tagButtonsContainer.querySelector(`.tag-button[data-tag="${CSS.escape(tag)}"]`);
    if (btn) btn.setAttribute("aria-pressed", activeTags.has(tag) ? "true" : "false");
  }
  renderTagButtons();
  if (renderArtists) renderArtists(true);
  if (setRandomBackground) setRandomBackground();
  if (navigator.vibrate) navigator.vibrate(50);
  emitTagUpdate();
}

/**
 * Handles tag search input with debouncing and search mode
 */
function handleTagSearch(value) {
  searchFilter = value;
  renderTagButtons();
  emitTagUpdate();
}

/**
 * Sets the tag search mode ("contains", "starts", "ends")
 */
function setTagSearchMode(mode) {
  tagSearchMode = mode;
  renderTagButtons();
}

/**
 * Handles artist name filter input
 */
function handleArtistNameFilter(value) {
  artistNameFilter = value.trim().toLowerCase();
  renderTagButtons(); // Update the summary display
  if (renderArtists) renderArtists(true);
  emitTagUpdate();
}

/**
 * Initializes the tags module with DOM elements and event listeners
 */
async function initTags(
  artists,
  renderArtistsFunc,
  setRandomBgFunc
) {
  allArtists = Array.isArray(artists) ? [...artists] : [];
  renderArtists = renderArtistsFunc;
  setRandomBackground = setRandomBgFunc;

  // Initial population of kinkTags from default categories
  kinkTags = kinkTagsByCategory.flatMap(category => category.tags);

  // DOM element lookups
  tagButtonsContainer = document.getElementById("tag-buttons");
  tagSearchInput = document.getElementById("tag-search");
  artistNameFilterInput = document.getElementById("artist-name-filter");
  clearTagsBtn = document.getElementById("clear-tags");
  jrpgBubbles = document.getElementById("jrpg-bubbles");
  selectedTagsBar = document.getElementById("selected-tags");

  // Set up debounced search input for tags
  if (tagSearchInput) {
    let searchTimeout;
    tagSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        handleTagSearch(e.target.value);
      }, 150);
    });
  }

  // Set up clear all button
  if (clearTagsBtn) {
    clearTagsBtn.addEventListener("click", (e) => {
      vibrate();
      clearAllTags(e);
    });
  }

  // Set up artist name filter
  if (artistNameFilterInput) {
    artistNameFilterInput.addEventListener("input", (e) => {
      handleArtistNameFilter(e.target.value);
    });
  }

  // Load kink tags from file
  const loadedTags = await fetchWithCache("kink-tags.json");
  if (Array.isArray(loadedTags)) {
    setKinkTags(loadedTags);
  }
}

/**
 * Sets the reference to all artists data
 */
function setAllArtists(artists) {
  allArtists = Array.isArray(artists) ? [...artists] : [];
}

/**
 * Sets the render artists callback function
 */
function setRenderArtistsCallback(callback) {
  renderArtists = callback;
}

/**
 * Sets the random background callback function
 */
function setRandomBackgroundCallback(callback) {
  setRandomBackground = callback;
}

/**
 * Sets the tag tooltips data
 */
function setTagTooltips(tooltips) {
  tagTooltips = tooltips;
}

/**
 * Sets the tag taunts data
 */
function setTagTaunts(tauntsData) {
  tagTaunts = tauntsData;
}

/**
 * Sets the general taunts data
 */
function setTaunts(tauntsData) {
  taunts = tauntsData;
}

/**
 * Gets the current active tags
 */
function getActiveTags() {
  return new Set(activeTags);
}

/**
 * Gets the current search filter
 */
function getSearchFilter() {
  return searchFilter;
}

/**
 * Gets the current artist name filter
 */
function getArtistNameFilter() {
  return artistNameFilter;
}

/**
 * Gets the available kink tags
 */
function getKinkTags() {
  return kinkTagsByCategory.map(cat => ({ category: cat.category, tags: [...cat.tags] }));
}

// Export functions for ES modules
export {
  initTags,
  renderTagButtons,
  clearAllTags,
  handleTagSearch,
  handleArtistNameFilter,
  setAllArtists,
  setRenderArtistsCallback,
  setRandomBackgroundCallback,
  setTagTooltips,
  setTagTaunts,
  setTaunts,
  setKinkTags,
  getActiveTags,
  getSearchFilter,
  getArtistNameFilter,
  getKinkTags,
  toggleTag,
  spawnBubble,
  setTagSearchMode,
};

// All functions in this file are defined and used as follows:

// spawnBubble: exported, used by toggleTag, renderTagButtons
// updateFilteredResultsSummary: used by renderTagButtons
// renderTagButtons: exported, used by main.js, tags.js, and internally
// clearAllTags: exported, used by clearTagsBtn event, tag-explorer.js (window.clearAllTags)
// toggleTag: exported, used by renderTagButtons, tag-explorer.js
// handleTagSearch: exported, used by tagSearchInput event
// handleArtistNameFilter: exported, used by artistNameFilterInput event, tag-explorer.js
// initTags: exported, used by main.js
// setAllArtists: exported, used by main.js, tag-explorer.js
// setRenderArtistsCallback: exported, used by main.js
// setRandomBackgroundCallback: exported, used by main.js
// setTagTooltips: exported, used by main.js
// setTagTaunts: exported, used by main.js
// setTaunts: exported, used by main.js
// getActiveTags: exported, used by main.js, gallery.js, tag-explorer.js, humiliation.js
// getSearchFilter: exported, not used internally (for external use)
// getArtistNameFilter: exported, used by main.js, gallery.js, tag-explorer.js
// getKinkTags: exported, used by tag-explorer.js

// No unused or undefined functions in this file.
