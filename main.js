// Ensure Azure TTS is used and default voice is Ava (whisper), fallback to Ava default
import { setAzureTTSConfig, fetchAzureVoices } from "./modules/azure-tts.js";
async function setDefaultAzureVoice() {
  try {
    const voices = await fetchAzureVoices(window._azureTTSKey, window._azureTTSRegion);
    const avaWhisper = voices.find(v => v.ShortName === "en-US-AvaMultilingualNeural" && v.StyleList && v.StyleList.includes("Whispering"));
    if (avaWhisper) {
      setAzureTTSConfig({ voice: avaWhisper.ShortName, style: "Whispering" });
    } else {
      setAzureTTSConfig({ voice: "en-US-AvaMultilingualNeural" });
    }
  } catch (e) {
    setAzureTTSConfig({ voice: "en-US-AvaMultilingualNeural" });
  }
}
setDefaultAzureVoice();
/**
 * Main entry point - Coordinates all modules and initializes the application
 */

import {
  initSidebar,
  setAllArtists as setSidebarArtists,
} from "./modules/sidebar.js";
import { initAudio, initAudioUI } from "./modules/audio.js";
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
  setTagSearchMode,
} from "./modules/tags.js";
import {
  initGallery,
  filterArtists,
  setRandomBackground,
  setAllArtists as setGalleryArtists,
  setGetActiveTagsCallback,
  setGetArtistNameFilterCallback,
  setSortMode,
  setSortPreference,
  forceSortAndRender,
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
import { startTauntTicker } from "./modules/humiliation.js";


import { renderPromptCacheUI } from "./modules/prompt-cache.js";
import { createTTSToggleButton } from "./modules/tts-toggle.js";

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
    initAudioUI();

    // Set initial background now that bg layer exists
    setRandomBackground();

    // Add TTS toggle button to audio controls
    createTTSToggleButton();
    await initTags();
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
    startTauntTicker(generalTaunts, 30000);

    // Use loaded tooltips to set a random tagline
    const quotes = Object.values(tooltips).filter(Boolean);
    if (quotes.length > 0) {
      const random = quotes[Math.floor(Math.random() * quotes.length)];
      const taglineElem = document.getElementById("tagline");
      if (taglineElem) taglineElem.textContent = random;
    }

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

// tag-tooltips are loaded in initApp and used for tagline

// Global error handling
window.addEventListener("error", (event) => {
  // Suppress media/network spam
  if (event.error && event.error.name === 'DOMException') return;
  if (event.error && event.error.message && event.error.message.includes('NetworkError')) return;
  console.error("Unhandled error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  // Suppress media/network spam
  if (event.reason && event.reason.name === 'DOMException') return;
  if (event.reason && event.reason.message && event.reason.message.includes('NetworkError')) return;
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

// --- SIDEBAR TOGGLE BUTTON ---
const sidebarToggleBtn = document.querySelector(".sidebar-toggle");
const copiedSidebarEl = document.getElementById("copied-sidebar");
if (sidebarToggleBtn && copiedSidebarEl) {
    sidebarToggleBtn.addEventListener("click", () => {
        // Toggle visibility via class so CSS can manage layout
        copiedSidebarEl.classList.toggle("sidebar-hidden");
        const isHidden = copiedSidebarEl.classList.contains("sidebar-hidden");
        copiedSidebarEl.setAttribute("aria-hidden", isHidden ? "true" : "false");
    });
}

const audioToggleBtn = document.querySelector(".audio-toggle");
const audioPanelEl = document.getElementById("audio-panel");
if (audioToggleBtn && audioPanelEl) {
    audioToggleBtn.addEventListener("click", () => {
        // Toggle visibility for fixed audio panel container
        audioPanelEl.classList.toggle("hidden");
        const isHidden = audioPanelEl.classList.contains("hidden");
        audioPanelEl.setAttribute("aria-hidden", isHidden ? "true" : "false");
    });
}

const sidebarCloseBtn = document.querySelector(".copied-sidebar-close");
const copiedSidebar = document.getElementById("copied-sidebar");
if (sidebarCloseBtn && copiedSidebar) {
  sidebarCloseBtn.addEventListener("click", () => {
    // Hide the sidebar and clear any open state
    copiedSidebar.classList.add("sidebar-hidden");
    document.body.classList.remove("sidebar-open");
    copiedSidebar.setAttribute("aria-hidden", "true");
  });
}

const sortSelect = document.getElementById("sort-by");
if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    // No immediate sort, just set mode for button
    // Optionally, update UI to reflect selection
  });
}

const sortButtonElem = document.getElementById("sort-button");
if (sortButtonElem && sortSelect) {
  sortButtonElem.addEventListener("click", () => {
    if (
      sortSelect.value === "top" &&
      typeof window.kexplorer !== "undefined" &&
      typeof window.kexplorer.showTopArtistsByTagCount === "function"
    ) {
      window.kexplorer.showTopArtistsByTagCount();
    } else {
      setSortMode(sortSelect.value);
      forceSortAndRender();
    }
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
} else {
  bodyEl.classList.add("fem-theme");
  bodyEl.classList.remove("incognito-theme");
}
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    bodyEl.classList.toggle("incognito-theme");
    bodyEl.classList.toggle("fem-theme");
    const current = bodyEl.classList.contains("incognito-theme") ? "incognito" : "fem";
    localStorage.setItem("theme", current);
    setRandomBackground();
  });
}

const sortPreferenceElem = document.getElementById("sort-preference");
if (sortPreferenceElem) {
  sortPreferenceElem.addEventListener("change", (e) => {
    setSortPreference(e.target.value);
  });
}

// Add tag search mode selector
const tagSearchModeSelect = document.createElement("select");
tagSearchModeSelect.id = "tag-search-mode";
tagSearchModeSelect.innerHTML = `
  <option value="contains">Contains</option>
  <option value="starts">Starts with</option>
  <option value="ends">Ends with</option>
`;
tagSearchModeSelect.style.marginLeft = "0.5em";
const tagSearchInput = document.getElementById("tag-search");
if (tagSearchInput && tagSearchInput.parentNode) {
  tagSearchInput.parentNode.insertBefore(
    tagSearchModeSelect,
    tagSearchInput.nextSibling
  );
  tagSearchModeSelect.addEventListener("change", (e) => {
    setTagSearchMode(e.target.value);
  });
}

// Add JOI mode toggle button
const joiBtn = document.createElement("button");
joiBtn.textContent = "JOI Mode";
joiBtn.className = "browse-btn humiliation-glow";
joiBtn.style.marginLeft = "1em";
let joiActive = false;
joiBtn.onclick = () => {
  if (!joiActive && window.startJOIMode) {
    window.startJOIMode();
    joiActive = true;
    joiBtn.textContent = "Stop JOI Mode";
    joiBtn.classList.add("active");
  } else if (joiActive && window.stopJOIMode) {
    window.stopJOIMode();
    joiActive = false;
    joiBtn.textContent = "JOI Mode";
    joiBtn.classList.remove("active");
  }
};
const controlsBar = document.querySelector(".sort-controls");
if (controlsBar) controlsBar.appendChild(joiBtn);

// Add Prompt Cache button
const promptBtn = document.createElement("button");
promptBtn.textContent = "Prompts";
promptBtn.className = "browse-btn";
promptBtn.style.marginLeft = "1em";
promptBtn.onclick = () => {
  renderPromptCacheUI();
};
if (controlsBar) controlsBar.appendChild(promptBtn);

// --- Wire up static Top Artists button (fixes non-working UI button) ---
const staticTopArtistsBtn = document.getElementById("show-top-artists");
if (staticTopArtistsBtn) {
  staticTopArtistsBtn.addEventListener("click", () => {
    if (
      typeof window.kexplorer !== "undefined" &&
      typeof window.kexplorer.showTopArtistsByTagCount === "function"
    ) {
      window.kexplorer.showTopArtistsByTagCount();
    }
  });
}

// --- Add floating chibi mascot image (fixes chibi.png placement) ---
window.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("floating-chibi-mascot")) {
    const chibi = document.createElement("img");
    chibi.id = "floating-chibi-mascot";
    chibi.src = "icons/chibi.png";
    chibi.alt = "Chibi Mascot";
    chibi.style.position = "fixed";
    chibi.style.bottom = "2.5em";
    chibi.style.right = "2.5em";
    chibi.style.width = "90px";
    chibi.style.height = "auto";
    chibi.style.zIndex = "13000";
    chibi.style.pointerEvents = "none";
    chibi.style.userSelect = "none";
    chibi.style.filter = "drop-shadow(0 2px 12px #fd7bc5cc)";
    document.body.appendChild(chibi);
  }

  // Tag Explorer Bar buttons
  const topArtistsBtn = document.getElementById("top-artists-btn");
  const joiModeBtn = document.getElementById("joi-mode-btn");
  const promptsBtn = document.getElementById("prompts-btn");
  const browseTagsBtn = document.getElementById("browse-tags-btn");
  if (topArtistsBtn) {
    topArtistsBtn.addEventListener("click", () => {
      if (window.kexplorer && typeof window.kexplorer.showTopArtistsByTagCount === "function") {
        window.kexplorer.showTopArtistsByTagCount();
      }
    });
  }
  if (joiModeBtn) {
    joiModeBtn.addEventListener("click", () => {
      if (window.startJOIMode) window.startJOIMode();
    });
  }
  if (promptsBtn) {
    promptsBtn.addEventListener("click", () => {
      if (window.renderPromptCacheUI) window.renderPromptCacheUI();
    });
  }
  if (browseTagsBtn) {
    browseTagsBtn.addEventListener("click", () => {
      if (window.openTagExplorer) window.openTagExplorer();
    });
  }

  // Make tag-explorer-bar fixed on scroll
  const tagBar = document.getElementById("tag-explorer-bar");
  let lastScrollY = 0;
  window.addEventListener("scroll", () => {
    if (!tagBar) return;
    if (window.scrollY > 60) {
      tagBar.classList.add("fixed");
    } else {
      tagBar.classList.remove("fixed");
    }
    lastScrollY = window.scrollY;
  });

  // Remove old filter toggle logic if present
  const filterToggle = document.getElementById("toggle-filters");
  if (filterToggle) filterToggle.style.display = "none";
});
