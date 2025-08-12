import { vibrate } from "./ui.js";

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

// External dependencies that will be injected
let allArtists = [];
let renderArtists = null;
let setRandomBackground = null;

// Kink tags list (loaded from kink-tags.json)
let kinkTags = [
  "femdom",
  "chastity_cage",
  "trap",
  "anal_object_insertion",
  "prostate_milking",
  "gagged",
  "dominatrix",
  "humiliation",
  "lactation",
  "flat_chastity_cage",
  "used_condom",
  "orgasm_denial",
  "mind_break",
  "shibari",
  "object_insertion",
  "penis_milking",
  "small_penis_humiliation",
  "sex_machine",
  "foot_worship",
  "dildo_riding",
  "milking_machine",
  "huge_dildo",
  "spreader_bar",
  "large_insertion",
  "hand_milking",
  "cum_in_mouth",
  "gokkun",
  "knotting",
  "toe_sucking",
  "feminization",
  "hogtie",
  "bimbofication",
  "restraints",
  "sockjob",
  "tentacle_pit",
  "tentacle_sex",
  "object_insertion_from_behind",
  "pouring_from_condom",
  "forced_feminization",
  "netorare",
  "netorase",
  "futanari",
];

function setKinkTags(tags) {
  kinkTags = Array.isArray(tags) ? tags : [];
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
  if (!tagButtonsContainer) return;

  tagButtonsContainer.innerHTML = "";

  // Get artists matching current filters
  let filteredArtists = allArtists.filter((artist) => {
    const tags = artist.kinkTags || [];
    return (
      Array.from(activeTags).every((tag) => tags.includes(tag)) &&
      (artist.artistName.toLowerCase().includes(artistNameFilter) ||
        artistNameFilter === "")
    );
  });

  // Update filtered results summary
  updateFilteredResultsSummary(filteredArtists.length, allArtists.length);

  // Get all tags present in filtered artists
  let possibleTags = new Set();
  filteredArtists.forEach((artist) => {
    (artist.kinkTags || []).forEach((tag) => possibleTags.add(tag));
  });

  // --- Allow user to add a custom/typed tag if not present ---
  const filter = searchFilter.trim().toLowerCase();
  let tagsToShow = kinkTags
    .filter((tag) => {
      const filter = searchFilter.trim().toLowerCase();
      if (!filter) return possibleTags.has(tag) || activeTags.has(tag);
      if (tagSearchMode === "starts") {
        return (
          tag.toLowerCase().startsWith(filter) &&
          (possibleTags.has(tag) || activeTags.has(tag))
        );
      }
      if (tagSearchMode === "ends") {
        return (
          tag.toLowerCase().endsWith(filter) &&
          (possibleTags.has(tag) || activeTags.has(tag))
        );
      }
      // default: contains
      return (
        tag.toLowerCase().includes(filter) &&
        (possibleTags.has(tag) || activeTags.has(tag))
      );
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  // If user typed a tag that is not in kinkTags, offer to add/search for it
  if (
    filter &&
    !kinkTags.some((tag) => tag.toLowerCase() === filter) &&
    !tagsToShow.some((tag) => tag.toLowerCase() === filter)
  ) {
    const customBtn = document.createElement("button");
    customBtn.className = "tag-button";
    customBtn.type = "button";
    customBtn.textContent = `Search for "${filter}"`;
    customBtn.style.background = "#ffd6f6";
    customBtn.style.color = "#a0005a";
    customBtn.onclick = () => {
      activeTags.add(filter);
      renderTagButtons();
      if (renderArtists) renderArtists(true);
      if (setRandomBackground) setRandomBackground();
      if (navigator.vibrate) navigator.vibrate(50);
    };
    tagButtonsContainer.appendChild(customBtn);
  }

  tagsToShow.forEach((tag) => {
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
      if (renderArtists) renderArtists(true); // <-- force full update
      if (setRandomBackground) setRandomBackground();
      if (navigator.vibrate) navigator.vibrate(50);
    };
    tagButtonsContainer.appendChild(btn);
  });

  if (clearTagsBtn) clearTagsBtn.style.display = activeTags.size ? "" : "none";
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
  renderTagButtons();
  if (renderArtists) renderArtists(true);
  if (setRandomBackground) setRandomBackground();
  if (navigator.vibrate) navigator.vibrate(50);
}

/**
 * Handles tag search input with debouncing and search mode
 */
function handleTagSearch(value) {
  searchFilter = value;
  renderTagButtons();
  if (renderArtists) renderArtists(true);
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
}

/**
 * Initializes the tags module with DOM elements and event listeners
 */
function initTags() {
  // Get DOM references
  tagButtonsContainer = document.getElementById("tag-buttons");
  tagSearchInput = document.getElementById("tag-search");
  artistNameFilterInput = document.getElementById("artist-name-filter");
  clearTagsBtn = document.getElementById("clear-tags");
  jrpgBubbles = document.getElementById("jrpg-bubbles");

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
}

/**
 * Sets the reference to all artists data
 */
function setAllArtists(artists) {
  allArtists = artists;
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
  return [...kinkTags];
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
