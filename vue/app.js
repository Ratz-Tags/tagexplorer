/**
 * Main entry point - Coordinates all modules and initializes the application
 */

import {
  initSidebar,
  setAllArtists as setSidebarArtists,
} from "../modules/sidebar.js";
import { initAudio, initAudioUI } from "../modules/audio.js";
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
} from "../modules/tags.js";
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
} from "../modules/gallery.js";
import {
  initUI,
  setupInfiniteScroll,
  setupBackgroundRotation,
} from "../modules/ui.js";
import {
  openTagExplorer,
  setAllArtists as setExplorerArtists,
} from "../modules/tag-explorer.js";
import { loadAppData } from "../modules/api.js";
import { startTauntTicker } from "../modules/humiliation.js";


import { renderPromptCacheUI } from "../modules/prompt-cache.js";
import { createTTSToggleButton } from "../modules/tts-toggle.js";

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
      import("../modules/gallery.js").then((gallery) => {
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
export default {
  name: 'KinkExplorerApp',
  data() {
    return {
      sidebarVisible: false,
      audioPanelVisible: false,
      theme: localStorage.getItem('theme') === 'incognito' ? 'incognito' : 'fem',
      joiActive: false,
      sortPreference: 'name',
      tagSearchMode: 'contains',
    };
  },
  computed: {
    themeClass() {
      return this.theme === 'incognito' ? 'incognito-theme' : 'fem-theme';
    },
  },
  watch: {
    sortPreference(val) {
      setSortPreference(val);
    },
    tagSearchMode(val) {
      setTagSearchMode(val);
    },
  },
  methods: {
    openTagExplorer,
    toggleAudioPanel() {
      this.audioPanelVisible = !this.audioPanelVisible;
      if (this.audioPanelVisible) {
        this.$nextTick(() => {
          this.$refs.audioPanel && this.$refs.audioPanel.focus();
        });
      }
    },
    toggleTheme() {
      this.theme = this.theme === 'incognito' ? 'fem' : 'incognito';
      localStorage.setItem('theme', this.theme);
      setRandomBackground();
    },
    toggleJOI() {
      if (!this.joiActive && window.startJOIMode) {
        window.startJOIMode();
        this.joiActive = true;
      } else if (this.joiActive && window.stopJOIMode) {
        window.stopJOIMode();
        this.joiActive = false;
      }
    },
    showPrompts() {
      renderPromptCacheUI();
    },
    onSortButtonClick() {
      if (
        this.sortPreference === 'top' &&
        typeof window.kexplorer !== 'undefined' &&
        typeof window.kexplorer.showTopArtistsByTagCount === 'function'
      ) {
        window.kexplorer.showTopArtistsByTagCount();
      } else {
        setSortMode(this.sortPreference);
        forceSortAndRender();
      }
    },
  },
  async mounted() {
    await initApp();
    setSortPreference(this.sortPreference);
    setTagSearchMode(this.tagSearchMode);
  },
};
