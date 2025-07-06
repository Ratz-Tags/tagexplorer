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
} from "./modules/gallery.js";
import {
  initUI,
  setupInfiniteScroll,
  setupBackgroundRotation,
} from "./modules/ui.js";
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
