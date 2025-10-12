import {
  initSidebar,
  setAllArtists as setSidebarArtists,
} from '../sidebar.js';
import {
  initAudio,
  initAudioUI,
  syncAudioPanelLayout,
  toggleGlobalMute,
  getGlobalMuteState,
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
  getFilteredArtists,
} from '../gallery.js';
import {
  initUI,
  setupInfiniteScroll,
  setupBackgroundRotation,
  showToast,
} from '../ui.js';
import {
  loadAppData,
  persistGalleryState,
  restoreGalleryState,
} from '../api.js';
import { startTauntTicker } from '../humiliation.js';
import { createTTSToggleButton, createTTSIntensityControl } from '../tts-toggle.js';
import {
  initTagExplorer,
  toggleTagExplorer,
  setAllArtists as setExplorerArtists,
} from '../tag-explorer.js';
import { showAzureVoiceSelector } from '../azure-tts.js';
import { configureWhisperCatalog, dispatchWhisperEvent } from '../tts-dispatcher.js';
import {
  initShameDossier,
  openShameDossier,
  getDossierEntries,
} from '../shame-dossier.js';
import { incrementPressure } from '../progression/pressure-meter.js';

const MOTION_STORAGE_KEY = 'te.motion.preference';
const MOTION_DEFAULT = 'full';
const IDLE_THRESHOLD_MS = 60000;

function readMotionPreference() {
  if (typeof window === 'undefined') return MOTION_DEFAULT;
  try {
    const value = window.localStorage.getItem(MOTION_STORAGE_KEY);
    if (value === 'reduced' || value === 'full') {
      return value;
    }
  } catch {
    // Ignore storage access failures.
  }
  return MOTION_DEFAULT;
}

function applyMotionPreference(mode) {
  if (typeof document === 'undefined') return MOTION_DEFAULT;
  const normalized = mode === 'reduced' ? 'reduced' : 'full';
  document.documentElement.dataset.motion = normalized;
  document.body.dataset.motion = normalized;
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }
  try {
    document.dispatchEvent(
      new CustomEvent('motion:change', { detail: { mode: normalized } }),
    );
  } catch {
    // Ignore custom event dispatch failures.
  }
  return normalized;
}

function setupPressureProgression() {
  if (typeof document === 'undefined') {
    return {
      trackDepth() {},
      resetBaseline() {},
      dispose() {},
    };
  }

  let deepestPageSeen = 0;

  const computePageMarker = (info) => {
    if (!info || typeof info !== 'object') return 0;
    const candidates = [info.lastRenderedPage, info.currentPage];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
    }
    return 0;
  };

  const resetBaseline = () => {
    const info = getPaginationInfo();
    if (!info) return;
    const marker = computePageMarker(info);
    if (typeof marker === 'number' && Number.isFinite(marker) && marker > deepestPageSeen) {
      deepestPageSeen = marker;
    }
  };

  const trackDepth = () => {
    const info = getPaginationInfo();
    if (!info) return;
    const marker = computePageMarker(info);
    if (!Number.isFinite(marker) || marker <= deepestPageSeen) return;
    const delta = marker - deepestPageSeen;
    deepestPageSeen = marker;
    const amount = Math.min(12, Math.max(3, 2 + delta * 2));
    incrementPressure(amount, { source: 'gallery-depth' });
  };

  resetBaseline();

  return {
    trackDepth,
    resetBaseline,
    dispose() {},
  };
}

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
  const themeToggles = Array.from(document.querySelectorAll('.theme-toggle'));
  const bodyEl = document.body;
  if (!bodyEl) return;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'incognito') {
    bodyEl.classList.add('incognito-theme');
    bodyEl.classList.remove('fem-theme');
    setRandomBackground();
  } else {
    bodyEl.classList.add('fem-theme');
    bodyEl.classList.remove('incognito-theme');
  }
  if (!themeToggles.length) return;
  const handleToggle = () => {
    bodyEl.classList.toggle('incognito-theme');
    bodyEl.classList.toggle('fem-theme');
    const current = bodyEl.classList.contains('incognito-theme') ? 'incognito' : 'fem';
    localStorage.setItem('theme', current);
    setRandomBackground();
  };
  themeToggles.forEach((toggleEl) => {
    toggleEl.addEventListener('click', handleToggle);
  });
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

async function setupFavoritesButton() {
  await customElements.whenDefined('te-command-bar');
  await new Promise(resolve => setTimeout(resolve, 0));

  const favoritesBtn = document.getElementById('favorites-btn');
  const favoritesCount = document.getElementById('favorites-count');
  if (!favoritesBtn) return;

  let showingFavorites = false;

  favoritesBtn.addEventListener('click', async () => {
    const { filterGalleryToFavorites, clearGalleryFilters } = await import('../gallery.js');
    const { getFavoritesCount } = await import('../favorites.js');

    if (getFavoritesCount() === 0) {
      showToast('No trophies on your wall yet. Go star someone before begging.', 4200);
      // Ensure the command bar button keeps focus for keyboard users
      requestAnimationFrame(() => {
        if (typeof favoritesBtn.focus === 'function') {
          favoritesBtn.focus({ preventScroll: true });
        }
      });
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
  const copiedSidebarEl = document.getElementById('copied-sidebar');
  if (!copiedSidebarEl) return;
  const sidebarWrapper = copiedSidebarEl.closest('.sidebar-wrapper');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleButtons = Array.from(document.querySelectorAll('.sidebar-toggle'));

  const setSidebarHidden = (hidden, { userInitiated = false } = {}) => {
    const isHidden = Boolean(hidden);
    
    // Move focus away from sidebar before hiding to prevent aria-hidden focus warning
    if (isHidden && copiedSidebarEl.contains(document.activeElement)) {
      document.activeElement?.blur();
      // Try to focus a safe element like the body
      document.body.focus();
    }
    
    copiedSidebarEl.classList.toggle('sidebar-hidden', isHidden);
    copiedSidebarEl.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    if (sidebarWrapper) {
      sidebarWrapper.classList.toggle('visible', !isHidden);
      sidebarWrapper.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    }
    if (overlay) {
      const foldMode = document.documentElement?.dataset?.foldMode;
      const shouldShowOverlay = !isHidden && foldMode !== 'fold-inner';
      overlay.style.display = shouldShowOverlay ? 'block' : 'none';
      overlay.setAttribute('aria-hidden', shouldShowOverlay ? 'false' : 'true');
    }
    document.body.classList.toggle('sidebar-open', !isHidden);
    if (userInitiated) {
      copiedSidebarEl.dataset.userHidden = isHidden ? 'true' : 'false';
    }
  };

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const willHide = !copiedSidebarEl.classList.contains('sidebar-hidden');
      setSidebarHidden(willHide, { userInitiated: true });
    });
  });

  // Use event delegation to handle both static and dynamically created close buttons
  copiedSidebarEl.addEventListener('click', (e) => {
    if (e.target.closest('.copied-sidebar-close')) {
      setSidebarHidden(true, { userInitiated: true });
    }
  });

  // Overlay click closes sidebar
  if (overlay) {
    overlay.addEventListener('click', () => {
      setSidebarHidden(true, { userInitiated: true });
    });
  }

  // Escape key closes sidebar
  copiedSidebarEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setSidebarHidden(true, { userInitiated: true });
    }
  });

  // Touch swipe left to close (mobile UX)
  let touchStartX = null;
  copiedSidebarEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
    }
  });
  copiedSidebarEl.addEventListener('touchend', (e) => {
    if (touchStartX !== null && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx < -60) {
        setSidebarHidden(true, { userInitiated: true });
      }
    }
    touchStartX = null;
  });

  copiedSidebarEl._setSidebarHidden = (hidden, options = {}) => {
    setSidebarHidden(hidden, options);
  };

  // Initialize visibility - start hidden by default
  // (syncSidebarForFold will handle fold-inner mode separately)
  const initiallyHidden = copiedSidebarEl.classList.contains('sidebar-hidden');
  setSidebarHidden(initiallyHidden);
}

function setupAudioToggle() {
  const audioPanelEl = document.getElementById('audio-panel');
  if (!audioPanelEl) return;
  const audioToggleButtons = Array.from(document.querySelectorAll('.audio-toggle'));

  const setAudioHidden = (hidden) => {
    const isHidden = Boolean(hidden);
    audioPanelEl.classList.toggle('hidden', isHidden);
    audioPanelEl.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    audioToggleButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
      btn.classList.toggle('is-active', !isHidden);
    });
    syncAudioPanelLayout();
  };

  audioToggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const willHide = !audioPanelEl.classList.contains('hidden');
      setAudioHidden(willHide);
    });
  });

  setAudioHidden(audioPanelEl.classList.contains('hidden'));
}

function setupMuteToggle() {
  const muteBtn = document.getElementById('cover-mute-btn');
  if (!muteBtn) return;

  const updateButtonState = (muted) => {
    const isMuted = Boolean(muted);
    muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    muteBtn.classList.toggle('is-active', isMuted);
    muteBtn.dataset.state = isMuted ? 'muted' : 'unmuted';
    const label = muteBtn.querySelector('.cover-command-label');
    if (label) {
      label.textContent = isMuted ? 'Muted' : 'Mute';
    }
  };

  updateButtonState(typeof getGlobalMuteState === 'function' ? getGlobalMuteState() : false);

  muteBtn.addEventListener('click', () => {
    const muted = typeof toggleGlobalMute === 'function' ? toggleGlobalMute() : false;
    updateButtonState(muted);
  });

  document.addEventListener('audio:mutechange', (event) => {
    if (!event?.detail || typeof event.detail.muted === 'undefined') return;
    updateButtonState(Boolean(event.detail.muted));
  });
}

async function setupDossierButton() {
  await customElements.whenDefined('te-command-bar');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const entries = [
    { el: document.getElementById('dossier-btn'), source: 'inner' },
    { el: document.getElementById('cover-dossier-btn'), source: 'cover' },
  ].filter(({ el }) => el instanceof HTMLElement);

  if (!entries.length) {
    initShameDossier();
    return;
  }

  const setExpanded = (isOpen) => {
    entries.forEach(({ el }) => {
      if (!el) return;
      el.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      el.classList.toggle('is-active', Boolean(isOpen));
    });
  };

  const setHasEntries = (hasEntries) => {
    entries.forEach(({ el }) => {
      if (!el) return;
      if (hasEntries) {
        el.dataset.hasEntries = 'true';
      } else {
        delete el.dataset.hasEntries;
      }
    });
  };

  setHasEntries(false);
  setExpanded(false);

  entries.forEach(({ el, source }) => {
    el.addEventListener('click', () => {
      openShameDossier({ source });
    });
  });

  document.addEventListener('dossier:toggle', (event) => {
    setExpanded(Boolean(event?.detail?.open));
  });

  document.addEventListener('dossier:append', () => setHasEntries(true));
  document.addEventListener('dossier:cleared', () => setHasEntries(false));

  initShameDossier().then(() => {
    const hasAny = (getDossierEntries() || []).length > 0;
    setHasEntries(hasAny);
    setExpanded(false);
  });
}

function setupMotionToggle(initialMode) {
  const desiredMode = initialMode || readMotionPreference();
  const motionBtn = document.getElementById('cover-motion-btn');

  const updateButtonState = (mode) => {
    if (!motionBtn) return;
    const normalized = mode === 'reduced' ? 'reduced' : 'full';
    const isReduced = normalized === 'reduced';
    motionBtn.setAttribute('aria-pressed', isReduced ? 'true' : 'false');
    motionBtn.setAttribute(
      'aria-label',
      isReduced ? 'Enable motion animations' : 'Reduce motion animations',
    );
    motionBtn.classList.toggle('is-active', isReduced);
    motionBtn.dataset.state = normalized;
    const label = motionBtn.querySelector('.cover-command-label');
    if (label) {
      label.textContent = isReduced ? 'Motion Off' : 'Motion';
    }
  };

  const applyAndUpdate = (mode) => {
    const normalized = applyMotionPreference(mode);
    updateButtonState(normalized);
  };

  if (!motionBtn) {
    applyAndUpdate(desiredMode);
    return () => {};
  }

  applyAndUpdate(desiredMode);

  motionBtn.addEventListener('click', () => {
    const nextMode = motionBtn.dataset.state === 'reduced' ? 'full' : 'reduced';
    applyAndUpdate(nextMode);
  });

  document.addEventListener('motion:change', (event) => {
    if (!event?.detail?.mode) return;
    updateButtonState(event.detail.mode);
  });

  return (mode) => {
    if (mode) {
      applyAndUpdate(mode);
    }
  };
}

// Settings sheet removed - functionality now only in inner command bar

function updateCommandStatusLabels(mode) {
  const labels = document.querySelectorAll('.command-status__label');
  const normalized = mode || 'default';
  labels.forEach((label) => {
    const target = label?.dataset?.mode ? `fold-${label.dataset.mode}` : null;
    const isActive = target && target === normalized;
    label.classList.toggle('is-active', Boolean(isActive));
    label.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}

function syncSidebarForFold(mode) {
  const sidebar = document.getElementById('copied-sidebar');
  if (!sidebar || typeof sidebar._setSidebarHidden !== 'function') return;
  if (typeof sidebar.dataset.foldPrevHidden !== 'undefined') {
    delete sidebar.dataset.foldPrevHidden;
  }
  const userPreference = sidebar.dataset.userHidden;
  const isCurrentlyHidden = sidebar.classList.contains('sidebar-hidden');
  let shouldHide;
  if (userPreference === 'true') {
    shouldHide = true;
  } else if (userPreference === 'false') {
    shouldHide = false;
  } else {
    shouldHide = isCurrentlyHidden;
  }
  sidebar._setSidebarHidden(shouldHide);
}

function setupFoldModeSync({ foldAdapter, closeSettings }) {
  const applyMode = (mode) => {
    const normalized = mode || 'default';
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.foldMode = normalized;
      document.body.dataset.foldMode = normalized;
      const shellRoot = document.querySelector('[data-shell]');
      if (shellRoot) {
        shellRoot.dataset.foldMode = normalized;
      }
    }
    updateCommandStatusLabels(normalized);
    if (normalized !== 'fold-cover' && typeof closeSettings === 'function') {
      closeSettings();
    }
    if (normalized !== 'fold-cover' && typeof document !== 'undefined') {
      document.body.classList.remove('filters-open');
    }
    syncSidebarForFold(normalized);
  };

  const currentMode =
    (foldAdapter && typeof foldAdapter.getMode === 'function' && foldAdapter.getMode()) ||
    document.body.dataset.foldMode ||
    'default';
  applyMode(currentMode);

  if (!foldAdapter || typeof foldAdapter.subscribe !== 'function') {
    return () => {};
  }

  const unsubscribe = foldAdapter.subscribe((mode) => {
    applyMode(mode || 'default');
  });

  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
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

async function setupFiltersButton() {
  // Wait for command-bar web component to be defined
  await customElements.whenDefined('te-command-bar');
  
  // Small delay to ensure DOM is updated
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const filterButtons = [
    document.getElementById('filters-btn'),
    document.getElementById('cover-filters-btn'),
  ].filter(Boolean);
  if (!filterButtons.length) return;

  filterButtons.forEach((btn) => {
    if (btn.dataset.tagExplorerToggleBound === 'true') return;
    btn.addEventListener('click', toggleTagExplorer, { once: false });
    btn.dataset.tagExplorerToggleBound = 'true';
    btn.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('tagFilters:toggle', (event) => {
    const isOpen = Boolean(event?.detail?.open);
    filterButtons.forEach((btn) => {
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.body.classList.toggle('filters-open', isOpen);
  });
}

async function setupForceFetch() {
  await customElements.whenDefined('te-command-bar');
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const forceFetchBtn = document.getElementById('force-fetch-btn');
  if (!forceFetchBtn) return;
  forceFetchBtn.addEventListener('click', async () => {
    const { forceFetchStyleTags } = await import('../gallery.js');
    await forceFetchStyleTags();
  });
}

function setupIdleWhispers() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  let idleTimer = null;

  const schedule = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      dispatchWhisperEvent('idle', { minIntensity: 1 });
      schedule();
    }, IDLE_THRESHOLD_MS);
  };

  const handleActivity = () => {
    if (document.visibilityState === 'hidden') return;
    schedule();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (idleTimer) clearTimeout(idleTimer);
    } else {
      schedule();
    }
  };

  const events = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart', 'focus'];
  events.forEach((eventName) =>
    window.addEventListener(eventName, handleActivity, { passive: true })
  );
  document.addEventListener('visibilitychange', handleVisibility);

  schedule();

  return () => {
    if (idleTimer) clearTimeout(idleTimer);
    events.forEach((eventName) =>
      window.removeEventListener(eventName, handleActivity)
    );
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

export async function initGalleryPage({ foldAdapter } = {}) {
  const savedState = restoreGalleryState();

  const { artists, tooltips, generalTaunts, tagTaunts, ttsLines } = await loadAppData();

  initUI();
  initSidebar();
  await initAudio();
  initAudioUI();
  createTTSToggleButton();
  createTTSIntensityControl();
  setupVoiceSelectorButton();
  setupAudioToggle();
  setupMuteToggle();
  setupMotionToggle(readMotionPreference());
  const pressureProgression = setupPressureProgression();
  const foldCleanup = setupFoldModeSync({
    foldAdapter,
  });

  // Don't call setRandomBackground() here - let the controller handle it after initialization

  await initShameDossier();
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
  configureWhisperCatalog({
    events: ttsLines,
    tags: tagTaunts,
    generalTaunts,
  });
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

  if (pressureProgression && typeof pressureProgression.resetBaseline === 'function') {
    pressureProgression.resetBaseline();
  }

  initTagExplorer();
  setupBackgroundRotation(setRandomBackground, {
    getActiveTags,
    getFilteredArtists,
    getPaginationInfo,
  });
  setupInfiniteScroll({
    onForward: () => {
      const info = getPaginationInfo();
      if (!info?.hasMoreForward) return;
      renderArtistsPage({ direction: 'forward' });
      if (pressureProgression && typeof pressureProgression.trackDepth === 'function') {
        pressureProgression.trackDepth();
      }
    },
    onBackward: () => {
      const info = getPaginationInfo();
      if (!info?.hasMoreBackward) return;
      renderArtistsPage({ direction: 'backward' });
      if (pressureProgression && typeof pressureProgression.resetBaseline === 'function') {
        pressureProgression.resetBaseline();
      }
    },
    infoProvider: () => getPaginationInfo(),
  });

  setupThemeToggle();
  setupTagSearchModeSelector();
  setupSidebarToggle();
  setupSortControls();
  setupFiltersButton();
  setupForceFetch();
  setupFavoritesButton();
  setupDossierButton();

  const idleCleanup = setupIdleWhispers();

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
    onDispose: () => {
      persistState();
      if (typeof foldCleanup === 'function') foldCleanup();
      if (typeof idleCleanup === 'function') idleCleanup();
      if (pressureProgression && typeof pressureProgression.dispose === 'function') {
        pressureProgression.dispose();
      }
    },
  };
}

export const initPage = initGalleryPage;
