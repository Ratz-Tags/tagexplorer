// Lightweight reactive tag state shared across the app

const ref =
  typeof Vue !== "undefined" && Vue.ref ? Vue.ref : (v) => ({ value: v });

// Shared reactive state
export const artists = ref([]);
export const activeTags = ref(new Set());
export const searchFilter = ref("");
export const artistNameFilter = ref("");

// Optional metadata loaded elsewhere
export let tagTooltips = {};
export let tagTaunts = {};
export let taunts = [];
export let tagSearchMode = "contains"; // "contains", "starts", "ends"
let kinkTags = [];

function toggleTag(tag) {
  const set = activeTags.value;
  set.has(tag) ? set.delete(tag) : set.add(tag);
}

function clearAllTags() {
  activeTags.value.clear();
}

function getActiveTags() {
  return new Set(activeTags.value);
}

function getSearchFilter() {
  return searchFilter.value;
}

function getArtistNameFilter() {
  return artistNameFilter.value;
}

function handleArtistNameFilter(value) {
  artistNameFilter.value = String(value || "").trim().toLowerCase();
}

function setTagTooltips(tooltips) {
  tagTooltips = tooltips || {};
}

function setTagTaunts(data) {
  tagTaunts = data || {};
}

function setTaunts(data) {
  taunts = Array.isArray(data) ? data : [];
}

function setTagSearchMode(mode) {
  tagSearchMode = mode;
}

function setKinkTags(tags) {
  kinkTags = Array.isArray(tags) ? tags : [];
}

function getKinkTags() {
  return [...kinkTags];
}

export {
  toggleTag,
  clearAllTags,
  getActiveTags,
  getSearchFilter,
  getArtistNameFilter,
  handleArtistNameFilter,
  setTagTooltips,
  setTagTaunts,
  setTaunts,
  setTagSearchMode,
  setKinkTags,
  getKinkTags,
};

