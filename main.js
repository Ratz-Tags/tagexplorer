// Ensure Azure TTS is used and default voice is Ava (whisper), fallback to Ava default
import {
  setAzureTTSConfig,
  fetchAzureVoices,
  showAzureVoiceSelector,
  DEFAULT_VOICE,
  WHISPER_STYLE_CANONICAL,
} from "./modules/azure-tts.js";
async function setDefaultAzureVoice() {
  try {
    if (window._azureTTSKey && window._azureTTSRegion) {
      const voices = await fetchAzureVoices(
        window._azureTTSKey,
        window._azureTTSRegion
      );
      const whisperVoices = Array.isArray(voices)
        ? voices.filter((voice) =>
            Array.isArray(voice?.StyleList) &&
            voice.StyleList.some(
              (style) => String(style).toLowerCase() === "whispering"
            )
          )
        : [];
      if (whisperVoices.length) {
        const currentVoice = window._azureTTSVoice;
        const preferred = whisperVoices.find(
          (voice) => voice.ShortName === currentVoice
        );
        const fallback =
          whisperVoices.find(
            (voice) => voice.ShortName === DEFAULT_VOICE
          ) || whisperVoices[0];
        const voiceToUse = (preferred || fallback).ShortName;
        setAzureTTSConfig({
          voice: voiceToUse,
          style: WHISPER_STYLE_CANONICAL,
        });
        return;
      }
    }
  } catch (error) {
    // Swallow errors so we can fall back to the built-in defaults below.
  }
  setAzureTTSConfig({
    voice: DEFAULT_VOICE,
    style: WHISPER_STYLE_CANONICAL,
  });
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
  getPaginationInfo,
  getCurrentPage,
  setCurrentPage,
  renderArtistsPage,
} from "./modules/gallery.js";
import {
  initUI,
  setupInfiniteScroll,
  setupBackgroundRotation,
} from "./modules/ui.js";
import { loadAppData } from "./modules/api.js";
import { startTauntTicker } from "./modules/humiliation.js";


import { renderPromptCacheUI } from "./modules/prompt-cache.js";
import { createTTSToggleButton } from "./modules/tts-toggle.js";
import {
  initTagExplorer,
  openTagExplorer,
  setAllArtists as setExplorerArtists,
} from "./modules/tag-explorer.js";

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
    // Add Azure TTS Voice Selector button to audio controls
    const audioControls = document.querySelector('.audio-controls');
    if (audioControls) {
      const voiceBtn = document.createElement('button');
      voiceBtn.textContent = 'Choose TTS Voice';
      voiceBtn.className = 'browse-btn';
      voiceBtn.style.marginLeft = '1em';
      voiceBtn.onclick = () => {
        showAzureVoiceSelector();
      };
      audioControls.appendChild(voiceBtn);
    }
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
    initTagExplorer();

    // Set up background rotation
    setupBackgroundRotation(setRandomBackground, 15000);

    // Set up infinite scroll
    setupInfiniteScroll(() => {
      const info = getPaginationInfo();
      if (info && info.hasMore) {
        setCurrentPage(getCurrentPage() + 1);
        renderArtistsPage();
      }
    }, getPaginationInfo);

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

// Expose some functions globally for debugging and button handlers
window.kexplorer = {
  filterArtists,
  setRandomBackground,
  getActiveTags,
  renderTagButtons,
};
// Ensure buttons that reference window.* work
window.renderPromptCacheUI = renderPromptCacheUI;

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
    copiedSidebar.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sidebar-open");
    const sidebarWrapper = copiedSidebar.closest(".sidebar-wrapper");
    if (sidebarWrapper) {
      sidebarWrapper.classList.remove("visible");
      sidebarWrapper.setAttribute("aria-hidden", "true");
    }
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
    }
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
    setSortMode(sortSelect.value);
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
tagSearchModeSelect.className = "field-input mt-2 sm:mt-0 sm:w-36 text-[0.6rem] uppercase tracking-[0.3em]";
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


window.addEventListener("DOMContentLoaded", () => {
  const promptsBtn = document.getElementById("prompts-btn");
  const filtersBtn = document.getElementById("filters-btn");

  if (promptsBtn) {
    promptsBtn.addEventListener("click", () => {
      if (window.renderPromptCacheUI) window.renderPromptCacheUI();
    });
  }

  if (filtersBtn) {
    filtersBtn.addEventListener("click", () => {
      openTagExplorer();
    });
    document.addEventListener("tagFilters:toggle", (event) => {
      const isOpen = !!(event?.detail && event.detail.open);
      filtersBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }
});

// Remove inline z-index overrides; CSS now controls stacking order
// const topBar = document.querySelector('.top-bar');
// if (topBar) topBar.style.zIndex = '5000';
// const tagBar = document.getElementById('tag-explorer-bar');
// if (tagBar) tagBar.style.zIndex = '4500';

// Fallback: delegate clicks for tag-explorer-bar buttons if individual binding failed
// This ensures all tag-explorer-bar buttons work regardless of render timing
['prompts-btn', 'filters-btn'].forEach(id => {
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.id === id) {
      e.preventDefault();
      if (id === 'prompts-btn' && window.renderPromptCacheUI) {
        window.renderPromptCacheUI();
      }
      if (id === 'filters-btn') {
        openTagExplorer();
      }
    }
  });
});
