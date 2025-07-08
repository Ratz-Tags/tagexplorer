/**
 * Main entry point - Coordinates all modules and initializes the application
 */

import {
  initSidebar,
  setAllArtists as setSidebarArtists,
} from "./modules/sidebar.js";
import { initAudio } from "./modules/audio.js";
import {
  initTags,
  setAllArtists as setTagsArtists,
  setRenderArtistsCallback,
  setRandomBackgroundCallback,
  setTagTooltips,
  setTagTaunts,
  setTaunts,
  getActiveTags,
  getArtistNameFilter,
  renderTagButtons,
} from "./modules/tags.js";
import {
  initGallery,
  filterArtists,
  setRandomBackground,
  setAllArtists as setGalleryArtists,
  setGetActiveTagsCallback,
  setGetArtistNameFilterCallback,
  setSortMode,
} from "./modules/gallery.js";
import {
  initUI,
  setupInfiniteScroll,
  setupBackgroundRotation,
} from "./modules/ui.js";
import {
  openTagExplorer,
  setAllArtists as setExplorerArtists,
} from "./modules/tag-explorer.js";
import { loadAppData } from "./modules/api.js";

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Load data files
    const { artists, tooltips, generalTaunts, tagTaunts } = await loadAppData();

    // Initialize modules
    initUI();
    initSidebar();
    initAudio();
    initTags();
    initGallery();

    // Set up data sharing between modules
    setSidebarArtists(artists);
    setTagsArtists(artists);
    setGalleryArtists(artists);
    setExplorerArtists(artists);

    // Set up callback dependencies
    setRenderArtistsCallback(filterArtists);
    setRandomBackgroundCallback(setRandomBackground);
    setGetActiveTagsCallback(getActiveTags);
    setGetArtistNameFilterCallback(getArtistNameFilter);

    // Configure data
    setTagTooltips(tooltips);
    setTagTaunts(tagTaunts);
    setTaunts(generalTaunts);

    // Initial render
    renderTagButtons();
    filterArtists();

    // Set up background rotation
    setupBackgroundRotation(setRandomBackground, 15000);

    // Set up infinite scroll
    setupInfiniteScroll(() => {
      import("./modules/gallery.js").then((gallery) => {
        const galleryInfo = gallery.getPaginationInfo();
        if (galleryInfo.hasMore) {
          filterArtists(false);
        }
      });
    });

    console.log("Application initialized successfully");
  } catch (error) {
    console.error("Failed to initialize application:", error);
    // Show user-friendly error message
    document.body.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #d63384;">
        <h2>Failed to load the application</h2>
        <p>Please refresh the page to try again.</p>
        <p><small>Error: ${error.message}</small></p>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Load tag-tooltips.json and set a random quote as the tagline
fetch("tag-tooltips.json")
  .then((res) => res.json())
  .then((tooltips) => {
    // tooltips is expected to be an object: { tag: "tooltip", ... }
    const quotes = Object.values(tooltips).filter(Boolean);
    if (quotes.length > 0) {
      const random = quotes[Math.floor(Math.random() * quotes.length)];
      const taglineElem = document.getElementById("tagline");
      if (taglineElem) taglineElem.textContent = random;
    }
  })
  .catch(() => {
    // fallback: do nothing or keep default tagline
  });

// Global error handling
window.addEventListener("error", (event) => {
  console.error("Unhandled error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

// Expose some functions globally for debugging
window.kexplorer = {
  filterArtists,
  setRandomBackground,
  getActiveTags,
  renderTagButtons,
  openTagExplorer,
};

const audioToggleBtn = document.querySelector(".audio-toggle");
const audioPanel = document.getElementById("audio-panel");
if (audioToggleBtn && audioPanel) {
  audioToggleBtn.addEventListener("click", () => {
    audioPanel.classList.toggle("hidden");
  });
}

const sidebarCloseBtn = document.querySelector(".copied-sidebar-close");
const copiedSidebar = document.getElementById("copied-sidebar");
if (sidebarCloseBtn && copiedSidebar) {
  sidebarCloseBtn.addEventListener("click", () => {
    copiedSidebar.classList.remove("visible");
    document.body.classList.remove("sidebar-open");
  });
}

const sortSelect = document.getElementById("sort-by");
if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    setSortMode(e.target.value);
    filterArtists(true);
  });
}

const tagExplorerBtn = document.getElementById("open-tag-explorer");
if (tagExplorerBtn) {
  tagExplorerBtn.addEventListener("click", openTagExplorer);
}

const filterToggle = document.getElementById("toggle-filters");
if (filterToggle) {
  const filterBar = document.querySelector(".filter-bar");
  filterToggle.addEventListener("click", () => {
    const collapsed = filterBar.classList.toggle("collapsed");
    filterToggle.textContent = collapsed ? "Show Filters" : "Hide Filters";
    filterToggle.setAttribute("aria-expanded", (!collapsed).toString());
  });
}

// Theme toggling
const themeToggle = document.querySelector(".theme-toggle");
const bodyEl = document.body;
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "incognito") {
  bodyEl.classList.add("incognito-theme");
  bodyEl.classList.remove("fem-theme");
  setRandomBackground();
}
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    bodyEl.classList.toggle("incognito-theme");
    bodyEl.classList.toggle("fem-theme");
    const current = bodyEl.classList.contains("incognito-theme")
      ? "incognito"
      : "fem";
    localStorage.setItem("theme", current);
    setRandomBackground();
  });
}
