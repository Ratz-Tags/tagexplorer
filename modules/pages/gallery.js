import {
  initSidebar,
  setAllArtists as setSidebarArtists,
} from '../sidebar.js';
import {
  initAudio,
  initAudioUI,
  syncAudioPanelLayout,
} from '../audio.js';
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
  hydrateTagState,
  handleArtistNameFilter,
} from '../tags.js';
import {
  initGallery,
  filterArtists,
  setRandomBackground,
  setAllArtists as setGalleryArtists,
  setGetActiveTagsCallback,
  setGetArtistNameFilterCallback,
  setSortMode,
  setSortPreference,
  getPaginationInfo,
  getCurrentPage,
  setCurrentPage,
  renderArtistsPage,
} from '../gallery.js';
import { initUI, setupInfiniteScroll, setupBackgroundRotation } from '../ui.js';
import {
  loadAppData,
  persistGalleryState,
  restoreGalleryState,
} from '../api.js';
import { startTauntTicker } from '../humiliation.js';
import { createTTSToggleButton } from '../tts-toggle.js';
import {
  initTagExplorer,
  openTagExplorer,
  setAllArtists as setExplorerArtists,
} from '../tag-explorer.js';
import { showAzureVoiceSelector } from '../azure-tts.js';

function setupVoiceSelectorButton() {
  const audioControls = document.querySelector('.audio-controls');
  if (!audioControls) return;

  let voiceBtn = document.getElementById('azure-voice-style-btn');
  if (!voiceBtn) {
    voiceBtn = document.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.id = 'azure-voice-style-btn';
    voiceBtn.className = 'audio-pill';
    voiceBtn.textContent = 'Voice & Style';
    voiceBtn.setAttribute('aria-haspopup', 'dialog');
    voiceBtn.setAttribute('aria-expanded', 'false');
    voiceBtn.addEventListener('click', () => {
      showAzureVoiceSelector();
    });
    audioControls.appendChild(voiceBtn);
  }
  if (!voiceBtn.dataset.selectorBound) {
    const updateExpandedState = (event) => {
      const isOpen = Boolean(event?.detail?.open);
      voiceBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };
    document.addEventListener('azureTTS:selector', updateExpandedState);
    voiceBtn.dataset.selectorBound = 'true';
  }
}

function setupThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle');
  const bodyEl = document.body;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'incognito') {
    bodyEl.classList.add('incognito-theme');
    bodyEl.classList.remove('fem-theme');
    setRandomBackground();
  } else {
    bodyEl.classList.add('fem-theme');
    bodyEl.classList.remove('incognito-theme');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      bodyEl.classList.toggle('incognito-theme');
      bodyEl.classList.toggle('fem-theme');
      const current = bodyEl.classList.contains('incognito-theme') ? 'incognito' : 'fem';
      localStorage.setItem('theme', current);
      setRandomBackground();
    });
  }
}

function setupTagSearchModeSelector() {
  const tagSearchModeSelect = document.createElement('select');
  tagSearchModeSelect.id = 'tag-search-mode';
  tagSearchModeSelect.innerHTML = `
    <option value="contains">Contains</option>
    <option value="starts">Starts with</option>
    <option value="ends">Ends with</option>
  `;
  tagSearchModeSelect.className = 'field-input mt-2 sm:mt-0 sm:w-36 text-[0.6rem] uppercase tracking-[0.3em]';
  const tagSearchInput = document.getElementById('tag-search');
  if (tagSearchInput && tagSearchInput.parentNode) {
    tagSearchInput.parentNode.insertBefore(tagSearchModeSelect, tagSearchInput.nextSibling);
    tagSearchModeSelect.addEventListener('change', (e) => {
      setTagSearchMode(e.target.value);
    });
  }
}

function setupFavoritesButton() {
  const favoritesBtn = document.getElementById('favorites-btn');
  const favoritesCount = document.getElementById('favorites-count');
  if (!favoritesBtn) return;

  let showingFavorites = false;

  favoritesBtn.addEventListener('click', async () => {
    const { filterGalleryToFavorites, clearGalleryFilters } = await import('../gallery.js');
    const { getFavoritesCount } = await import('../favorites.js');

    if (getFavoritesCount() === 0) {
      alert('No favorite artists yet. Star some artists first!');
      return;
    }

    showingFavorites = !showingFavorites;

    if (showingFavorites) {
      filterGalleryToFavorites();
      favoritesBtn.classList.add('active');
      favoritesBtn.setAttribute('aria-pressed', 'true');
    } else {
      clearGalleryFilters();
      favoritesBtn.classList.remove('active');
      favoritesBtn.setAttribute('aria-pressed', 'false');
    }
  });

  document.addEventListener('favorites:changed', (e) => {
    if (favoritesCount) {
      const count = e.detail.count;
      favoritesCount.textContent = count;
      favoritesCount.classList.toggle('hidden', count === 0);
    }

    if (favoritesBtn) {
      const count = e.detail.count;
      favoritesBtn.disabled = count === 0;
      if (count === 0 && favoritesBtn.classList.contains('active')) {
        favoritesBtn.classList.remove('active');
        favoritesBtn.setAttribute('aria-pressed', 'false');
      }
    }
  });

  (async () => {
    const { getFavoritesCount } = await import('../favorites.js');
    const count = getFavoritesCount();
    if (favoritesCount) {
      favoritesCount.textContent = count;
      favoritesCount.classList.toggle('hidden', count === 0);
    }
    favoritesBtn.disabled = count === 0;
  })();
}

function setupSidebarToggle() {
  const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
  const copiedSidebarEl = document.getElementById('copied-sidebar');
  if (sidebarToggleBtn && copiedSidebarEl) {
    sidebarToggleBtn.addEventListener('click', () => {
      copiedSidebarEl.classList.toggle('sidebar-hidden');
      const isHidden = copiedSidebarEl.classList.contains('sidebar-hidden');
      copiedSidebarEl.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    });
  }

  const sidebarCloseBtn = document.querySelector('.copied-sidebar-close');
  const copiedSidebar = document.getElementById('copied-sidebar');
  if (sidebarCloseBtn && copiedSidebar) {
    sidebarCloseBtn.addEventListener('click', () => {
      copiedSidebar.classList.add('sidebar-hidden');
      copiedSidebar.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sidebar-open');
      const sidebarWrapper = copiedSidebar.closest('.sidebar-wrapper');
      if (sidebarWrapper) {
        sidebarWrapper.classList.remove('visible');
        sidebarWrapper.setAttribute('aria-hidden', 'true');
      }
      const overlay = document.getElementById('sidebar-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
      }
    });
  }
}

function setupAudioToggle() {
  const audioToggleBtn = document.querySelector('.audio-toggle');
  const audioPanelEl = document.getElementById('audio-panel');
  if (audioToggleBtn && audioPanelEl) {
    audioToggleBtn.addEventListener('click', () => {
      audioPanelEl.classList.toggle('hidden');
      const isHidden = audioPanelEl.classList.contains('hidden');
      audioPanelEl.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
      syncAudioPanelLayout();
    });
  }
}

function setupSortControls() {
  const sortSelect = document.getElementById('sort-by');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {});
  }
  const sortButtonElem = document.getElementById('sort-button');
  if (sortButtonElem && sortSelect) {
    sortButtonElem.addEventListener('click', () => {
      setSortMode(sortSelect.value);
    });
  }
  const sortPreferenceElem = document.getElementById('sort-preference');
  if (sortPreferenceElem) {
    sortPreferenceElem.addEventListener('change', (e) => {
      setSortPreference(e.target.value);
    });
  }
}

function setupFiltersButton() {
  const filtersBtn = document.getElementById('filters-btn');
  if (filtersBtn) {
    filtersBtn.addEventListener('click', () => {
      openTagExplorer();
    });
    document.addEventListener('tagFilters:toggle', (event) => {
      const isOpen = !!(event?.detail && event.detail.open);
      filtersBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.id === 'filters-btn') {
      e.preventDefault();
      openTagExplorer();
    }
  });
}

function setupForceFetch() {
  const forceFetchBtn = document.getElementById('force-fetch-btn');
  if (!forceFetchBtn) return;
  forceFetchBtn.addEventListener('click', async () => {
    const { forceFetchStyleTags } = await import('../gallery.js');
    await forceFetchStyleTags();
  });
}

export async function initGalleryPage() {
  const savedState = restoreGalleryState();

  const { artists, tooltips, generalTaunts, tagTaunts } = await loadAppData();

  initUI();
  initSidebar();
  await initAudio();
  initAudioUI();
  createTTSToggleButton();
  setupVoiceSelectorButton();
  setupAudioToggle();

  setRandomBackground();

  await initTags();
  initGallery();

  setSidebarArtists(artists);
  setTagsArtists(artists);
  setGalleryArtists(artists);
  setExplorerArtists(artists);

  setRenderArtistsCallback(filterArtists);
  setRandomBackgroundCallback(setRandomBackground);
  setGetActiveTagsCallback(getActiveTags);
  setGetArtistNameFilterCallback(getArtistNameFilter);

  setTagTooltips(tooltips);
  setTagTaunts(tagTaunts);
  setTaunts(generalTaunts);
  startTauntTicker(generalTaunts, 30000);

  const quotes = Object.values(tooltips || {}).filter(Boolean);
  if (quotes.length > 0) {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    const taglineElem = document.getElementById('tagline');
    if (taglineElem) taglineElem.textContent = random;
  }

  let hydrated = false;
  if (savedState?.tags?.length) {
    hydrateTagState(savedState.tags, { silent: true });
    hydrated = true;
  }
  if (typeof savedState?.artistNameFilter === 'string' && savedState.artistNameFilter) {
    handleArtistNameFilter(savedState.artistNameFilter);
    const nameInput = document.getElementById('artist-name-filter');
    if (nameInput) nameInput.value = savedState.artistNameFilter;
    hydrated = true;
  }
  if (!hydrated) {
    renderTagButtons();
    filterArtists();
  }

  initTagExplorer();
  setupBackgroundRotation(setRandomBackground, 15000);
  setupInfiniteScroll(() => {
    const info = getPaginationInfo();
    if (info && info.hasMore) {
      setCurrentPage(getCurrentPage() + 1);
      renderArtistsPage();
    }
  }, getPaginationInfo);

  setupThemeToggle();
  setupTagSearchModeSelector();
  setupSidebarToggle();
  setupSortControls();
  setupFiltersButton();
  setupForceFetch();
  setupFavoritesButton();

  window.kexplorer = {
    filterArtists,
    setRandomBackground,
    getActiveTags,
    renderTagButtons,
  };

  if (typeof savedState?.scrollY === 'number') {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedState.scrollY, behavior: 'auto' });
    });
  }

  const persistState = () => {
    persistGalleryState({
      tags: Array.from(getActiveTags()),
      artistNameFilter: getArtistNameFilter(),
      scrollY: window.scrollY,
    });
  };

  return {
    beforeNavigate: persistState,
    onDispose: persistState,
  };
}

export const initPage = initGalleryPage;
