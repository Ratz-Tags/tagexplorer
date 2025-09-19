import { initializeApp } from '../core/app.js';
import { safeAnimate, stagger } from '../core/motion.js';
import { createWhisperController } from '../core/tts.js';
import { watchFoldState, getFoldState } from '../core/fold.js';

const HUMILIATION_PLACEHOLDER = 'No tags yet — afraid to commit?';
const TTS_LABELS = ['Muted', 'Soft', 'Steady', 'Relentless'];
const IDLE_DELAYS = {
  1: 45000,
  2: 28000,
  3: 16000
};
const CAUGHT_SESSION_KEY = 'tagexplorer.caught.v1';
const TOOLTIP_COPY = {
  filters: () => {
    const count = currentPreferences?.filters?.length ?? 0;
    if (count >= 6) return 'Still stacking? We can smell the desperation.';
    if (count >= 3) return `Already ${count} deep. Keep going.`;
    if (count > 0) return `Only ${count}? We know you want more.`;
    return 'Go on. Open the stack. We dare you.';
  },
  settings: 'Tweaking controls won\'t hide your habits.',
  mute: () => (currentPreferences?.tts?.muted ? 'Thinking of listening again?' : 'Muting won\'t stop the whispers.'),
  motion: () =>
    currentPreferences?.motion?.reduced
      ? 'Motion off. Feeling less dizzy now?'
      : 'Afraid the glow gives you away?',
  reset: 'Wiping the evidence? Cute.',
  chip: (value) => (value ? `Drop “${value}”? You\'ll add it back.` : 'Drop it. We dare you.'),
  tagOption: (value) => (value ? `Stack “${value}”. You know you want to.` : 'Stack it already.'),
  navHome: 'Retreating home? The gallery remembers.',
  navMute: () => (currentPreferences?.tts?.muted ? 'Silence never lasts.' : 'You can mute, but we still watch.')
};
const CAUGHT_MESSAGES = {
  entry: (intensity) =>
    intensity >= 3
      ? 'Caught lingering again. We log every fold and twitch.'
      : 'We see you slipping back in. Keep pretending it\'s research.',
  filters: (intensity) =>
    intensity >= 3
      ? 'Opening filters yet again? That obsession is documented.'
      : 'Adjusting filters won\'t make this private.',
  stack: ({ count }) => {
    if (count >= 6) return 'Six tags deep. Shameless. Documented.';
    if (count >= 4) return `Already ${count} filters. Hungry much?`;
    if (count >= 3) return `${count} tags stacked. Subtle.`;
    return '';
  },
  reset: () => 'Clearing the stack doesn\'t clear the log.'
};

class GalleryVirtualizer {
  constructor(root, renderItem) {
    this.root = root;
    this.renderItem = renderItem;
    this.chunkSize = 12;
    this.maxChunks = 4;
    this.items = [];
    this.rendered = [];
    this.cursor = 0;
    this.sentinel = document.createElement('div');
    this.sentinel.setAttribute('data-gallery-sentinel', '');
    this.sentinel.className = 'h-1 w-full';
    this.handleIntersect = this.handleIntersect.bind(this);
    this.observer = new IntersectionObserver(this.handleIntersect, { rootMargin: '800px 0px' });
  }

  setItems(items) {
    this.items = Array.isArray(items) ? items : [];
    this.cursor = 0;
    this.rendered.forEach((chunk) => chunk.elements.forEach((element) => element.remove()));
    this.rendered = [];

    if (!this.root) {
      return;
    }

    this.root.innerHTML = '';
    this.root.appendChild(this.sentinel);
    if (this.items.length) {
      this.renderNextChunk(true);
    }
    this.updateObserver();
  }

  renderNextChunk(initial = false) {
    if (!this.root || this.cursor >= this.items.length) {
      return;
    }

    const start = this.cursor;
    const end = Math.min(this.cursor + this.chunkSize, this.items.length);
    const fragment = document.createDocumentFragment();
    const elements = [];

    for (let index = start; index < end; index += 1) {
      const element = this.renderItem(this.items[index], index);
      if (element) {
        fragment.appendChild(element);
        elements.push(element);
      }
    }

    this.root.insertBefore(fragment, this.sentinel);
    this.rendered.push({ start, end, elements });
    this.cursor = end;

    while (this.rendered.length > this.maxChunks) {
      const removed = this.rendered.shift();
      removed?.elements?.forEach((element) => element.remove());
    }

    if (!initial && elements.length) {
      safeAnimate(elements, { opacity: [0, 1], y: [16, 0] }, { delay: stagger(0.03), duration: 0.4 });
    }
  }

  handleIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.renderNextChunk();
      }
    });
  }

  updateObserver() {
    if (!this.observer) {
      return;
    }
    this.observer.disconnect();
    if (this.root?.contains(this.sentinel) && this.items.length > 0) {
      this.observer.observe(this.sentinel);
    }
  }

  clear() {
    this.items = [];
    this.cursor = 0;
    this.rendered.forEach((chunk) => chunk.elements.forEach((element) => element.remove()));
    this.rendered = [];
    if (this.root) {
      this.root.innerHTML = '';
    }
  }

  destroy() {
    this.clear();
    this.observer?.disconnect();
  }
}

function attachCardInteractions(card) {
  if (!card) {
    return;
  }
  const maxTilt = 6;

  function handlePointerMove(event) {
    if (document.documentElement.dataset.motion === 'off' || event.pointerType === 'touch') {
      return;
    }
    const rect = card.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateX = (-offsetY * maxTilt * 2).toFixed(2);
    const rotateY = (offsetX * maxTilt * 2).toFixed(2);
    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }

  function resetTilt() {
    card.style.transform = '';
  }

  card.addEventListener('pointermove', handlePointerMove);
  card.addEventListener('pointerleave', resetTilt);
  card.addEventListener('blur', resetTilt);
}

const filterPanel = document.querySelector('[data-filter-panel]');
const activeFiltersRoot = document.querySelector('[data-active-filters]');
const tagOptionsRoot = document.querySelector('[data-tag-options]');
const galleryGrid = document.querySelector('[data-gallery-grid]');
const gallerySummary = document.querySelector('[data-gallery-summary]');
const galleryEmpty = document.querySelector('[data-gallery-empty]');
const filterCount = document.querySelector('[data-filter-count]');
const clearButtons = document.querySelectorAll('[data-clear-filters], [data-clear-filters-secondary]');
const bottomOpen = document.querySelector('[data-bottom-open]');
const overlay = document.querySelector('[data-sheet-backdrop]');
const settingsSheet = document.querySelector('[data-settings-sheet]');
const ttsStatus = document.querySelector('[data-tts-status]');
const ttsSlider = document.querySelector('[data-sheet-tts]');
const ttsSliderLabel = document.querySelector('[data-sheet-tts-label]');
const muteToggle = document.querySelector('[data-sheet-mute]');
const motionToggle = document.querySelector('[data-sheet-motion]');
const bottomSettings = document.querySelector('[data-bottom-settings]');
const bottomMute = document.querySelector('[data-bottom-mute]');
const bottomMotion = document.querySelector('[data-bottom-motion]');
const sheetDismissButtons = document.querySelectorAll('[data-sheet-dismiss]');
const caughtOverlay = document.querySelector('[data-caught-overlay]');
const caughtCopy = document.querySelector('[data-caught-copy]');
const caughtDismiss = document.querySelector('[data-caught-dismiss]');


let datasetRef = null;
let updatePreferencesRef = null;
let currentPreferences = null;
let whisperController = null;
let galleryVirtualizer = null;
let foldState = getFoldState();
let idleTimer = null;
let activeSheet = null;
let unsubscribeFold = null;
let tooltipRoot = null;
let tooltipHideTimer = null;
let caughtTimer = null;
let caughtSeen = false;
let tagDictionary = new Map();

initializeApp('gallery', {
  onReady({ dataset, preferences, updatePreferences }) {
    datasetRef = dataset;
    tagDictionary = new Map((dataset?.tags ?? []).map((tag) => [tag.id, tag]));
    updatePreferencesRef = updatePreferences;
    currentPreferences = preferences;
    caughtSeen = hasSeenCaught();
    whisperController = createWhisperController({ dataset, preferences });
    whisperController?.subscribe(handleTtsStatus);
    handleTtsStatus({ status: 'initializing' });
    galleryVirtualizer = new GalleryVirtualizer(galleryGrid, createArtistCard);
    unsubscribeFold = watchFoldState(handleFoldChange);
    setupTooltips();
    primeCaught(preferences);

    renderTagOptions(dataset.tags, preferences.filters);
    renderGallery(preferences.filters);
    syncBottomControls(preferences);
    bindEvents();
    scheduleIdle(preferences);
  },
  onPreferencesChange({ preferences }) {
    currentPreferences = preferences;
    renderTagOptions(datasetRef?.tags ?? [], preferences.filters);
    renderGallery(preferences.filters);
    syncBottomControls(preferences);
    whisperController?.updatePreferences(preferences);
    scheduleIdle(preferences);
    primeCaught(preferences);
  }
});

function bindEvents() {
  if (tagOptionsRoot) {
    tagOptionsRoot.addEventListener('click', (event) => {
      const target = event.target.closest('[data-tag-option]');
      if (!target) return;
      event.preventDefault();
      const tagId = target.getAttribute('data-tag-option');
      if (!tagId) return;
      toggleFilter(tagId);
    });
  }

  if (activeFiltersRoot) {
    activeFiltersRoot.addEventListener('click', (event) => {
      const target = event.target.closest('[data-remove-filter]');
      if (!target) return;
      const tagId = target.getAttribute('data-remove-filter');
      if (!tagId) return;
      toggleFilter(tagId, { forceRemove: true });
    });
  }

  clearButtons.forEach((button) => {
    button.addEventListener('click', () => {
      clearFilters();
      closeSheet('filters');
    });
  });

  if (bottomOpen) {
    bottomOpen.addEventListener('click', handleFiltersTap);
  }

  if (bottomSettings) {
    bottomSettings.addEventListener('click', () => openSheet('settings'));
  }

  if (bottomMute) {
    bottomMute.addEventListener('click', () => toggleMute());
  }

  if (bottomMotion) {
    bottomMotion.addEventListener('click', () => toggleMotion());
  }

  if (overlay) {
    overlay.addEventListener('click', () => closeSheet());
  }

  sheetDismissButtons.forEach((button) => {
    button.addEventListener('click', () => closeSheet(button.getAttribute('data-sheet-dismiss')));
  });

  if (ttsSlider) {
    ttsSlider.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      updatePreferencesRef?.((current) => {
        current.tts.intensity = value;
        current.tts.muted = value === 0;
        return current;
      });
    });
  }

  if (muteToggle) {
    muteToggle.addEventListener('click', () => toggleMute());
  }

  if (motionToggle) {
    motionToggle.addEventListener('click', () => toggleMotion());
  }

  if (caughtDismiss) {
    caughtDismiss.addEventListener('click', () => hideCaught());
  }

  if (caughtOverlay) {
    caughtOverlay.addEventListener('click', (event) => {
      if (event.target === caughtOverlay) {
        hideCaught();
      }
    });
  }

  document.addEventListener('keydown', handleGlobalKeydown);

  const idleEvents = ['scroll', 'pointermove', 'keydown', 'touchstart'];
  idleEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => resetIdleTimer(), { passive: true });
  });
}

function handleFiltersTap() {
  if (foldState === 'cover') {
    openSheet('filters');
    maybeTriggerCaught('filters');
    return;
  }
  filterPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  maybeTriggerCaught('filters');
}

function openSheet(type) {
  if (!overlay) {
    return;
  }

  if (type === 'filters' && filterPanel) {
    filterPanel.setAttribute('data-open', 'true');
    activeSheet = filterPanel;
  } else if (type === 'settings' && settingsSheet) {
    settingsSheet.setAttribute('data-open', 'true');
    activeSheet = settingsSheet;
  }

  if (activeSheet) {
    overlay.hidden = false;
    overlay.dataset.visible = 'true';
    document.body.classList.add('sheet-open');
  }
}

function closeSheet(target) {
  const shouldCloseFilters = !target || target === 'filters';
  const shouldCloseSettings = !target || target === 'settings';

  if (shouldCloseFilters && filterPanel) {
    filterPanel.removeAttribute('data-open');
    if (activeSheet === filterPanel) {
      activeSheet = null;
    }
  }

  if (shouldCloseSettings && settingsSheet) {
    settingsSheet.removeAttribute('data-open');
    if (activeSheet === settingsSheet) {
      activeSheet = null;
    }
  }

  if (!filterPanel?.hasAttribute('data-open') && !settingsSheet?.hasAttribute('data-open')) {
    if (overlay) {
      delete overlay.dataset.visible;
      overlay.hidden = true;
    }
    document.body.classList.remove('sheet-open');
  }
}

function toggleMute() {
  if (!updatePreferencesRef) {
    return;
  }

  const next = updatePreferencesRef((current) => {
    current.tts.muted = !current.tts.muted;
    if (current.tts.muted) {
      current.tts.intensity = 0;
    } else if (current.tts.intensity === 0) {
      current.tts.intensity = 2;
    }
    return current;
  });

  if (!next.tts.muted) {
    whisperController?.speak('back');
  }
}

function toggleMotion() {
  if (!updatePreferencesRef) {
    return;
  }
  updatePreferencesRef((current) => {
    current.motion.reduced = !current.motion.reduced;
    return current;
  });
}

function renderTagOptions(tags, selectedFilters) {
  if (!tagOptionsRoot) {
    return;
  }

  if (!tagOptionsRoot.hasChildNodes()) {
    const fragment = document.createDocumentFragment();
    tags.forEach((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tag.label;
      button.className = 'tag-chip justify-center text-[0.65rem]';
      button.setAttribute('data-tag-option', tag.id);
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('title', tag.summary ?? tag.label);
      button.dataset.tooltip = 'tagOption';
      button.dataset.tooltipValue = tag.summary ?? tag.label;
      fragment.appendChild(button);
    });
    tagOptionsRoot.appendChild(fragment);
  }

  const buttons = tagOptionsRoot.querySelectorAll('[data-tag-option]');
  buttons.forEach((button) => {
    const tagId = button.getAttribute('data-tag-option');
    const isActive = selectedFilters.includes(tagId);
    const tagMeta = tagDictionary.get(tagId);
    if (tagMeta) {
      button.dataset.tooltipValue = tagMeta.summary ?? tagMeta.label ?? tagId;
    }
    button.classList.toggle('border-accent-pink/60', isActive);
    button.classList.toggle('text-white', isActive);
    button.classList.toggle('shadow-neon', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  registerTooltipTargets(tagOptionsRoot);

  renderActiveFilters(selectedFilters);
}

function renderActiveFilters(filters) {
  if (!activeFiltersRoot) {
    return;
  }

  activeFiltersRoot.innerHTML = '';

  if (!filters.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'text-[0.65rem] uppercase tracking-[0.4em] text-slate-500';
    placeholder.textContent = HUMILIATION_PLACEHOLDER;
    activeFiltersRoot.appendChild(placeholder);
    updateFilterHeatmap(0);
    return;
  }

  const fragment = document.createDocumentFragment();
  filters.forEach((tagId) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip bg-accent-pink/10 text-[0.65rem] text-white hover:bg-accent-pink/20';
    chip.setAttribute('data-remove-filter', tagId);
    const tagMeta = tagDictionary.get(tagId);
    const label = tagMeta?.label ?? tagId.replace(/_/g, ' ');
    const tease = tagMeta?.summary ?? label;
    chip.innerHTML = `<span>${label}</span><span aria-hidden="true">×</span>`;
    chip.dataset.tooltip = 'chip';
    chip.dataset.tooltipValue = tease;
    fragment.appendChild(chip);
  });
  activeFiltersRoot.appendChild(fragment);
  registerTooltipTargets(activeFiltersRoot);
  updateFilterHeatmap(filters.length);
}

function renderGallery(filters) {
  if (!galleryGrid) {
    return;
  }

  const artists = datasetRef?.artists ?? [];
  const normalizedFilters = Array.isArray(filters) ? filters : [];
  const filteredArtists = normalizedFilters.length
    ? artists.filter((artist) => normalizedFilters.every((tag) => artist.tags.includes(tag)))
    : artists;
  if (!filteredArtists.length) {
    galleryEmpty?.classList.remove('hidden');
    galleryVirtualizer?.clear();
  } else {
    galleryEmpty?.classList.add('hidden');
    galleryVirtualizer?.setItems(filteredArtists);
  }

  updateSummary(filteredArtists.length, artists.length, normalizedFilters.length);
}

function createArtistCard(artist) {
  const card = document.createElement('article');
  card.className =
    'virtual-card group relative flex flex-col gap-4 rounded-3xl border border-white/10 bg-panel/40 p-5 shadow-glass transition duration-500 hover:border-accent-pink/60 hover:shadow-neon';

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-3';
  const title = document.createElement('h3');
  title.className = 'font-display text-xl text-white';
  title.textContent = artist.name;
  header.appendChild(title);

  const link = document.createElement('a');
  link.href = `../artist/?id=${encodeURIComponent(artist.artist_id)}`;
  link.className = 'tag-chip bg-accent-cyan/10 text-[0.6rem] text-accent-cyan hover:bg-accent-cyan/20 hover:text-white';
  link.textContent = 'Open dossier';
  header.appendChild(link);
  card.appendChild(header);

  const tagsList = document.createElement('ul');
  tagsList.className = 'flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-[0.3em] text-slate-300';
  artist.tags.forEach((tag) => {
    const tagItem = document.createElement('li');
    tagItem.className = 'rounded-full border border-white/10 bg-white/5 px-3 py-1';
    tagItem.textContent = tag.replace(/_/g, ' ');
    tagsList.appendChild(tagItem);
  });
  card.appendChild(tagsList);

  attachCardInteractions(card);
  return card;
}

function updateSummary(visible, total, filterCountValue) {
  if (gallerySummary) {
    if (filterCountValue > 0) {
      gallerySummary.textContent = `Filtered to ${visible} / ${total} dossiers`;
    } else {
      gallerySummary.textContent = `${total} artists ready to taunt you`;
    }
  }

  if (filterCount) {
    const label = filterCountValue === 1 ? 'filter armed' : 'filters armed';
    filterCount.textContent = `${filterCountValue} ${label}`;
  }
}

function toggleFilter(tagId, { forceRemove = false } = {}) {
  if (!updatePreferencesRef) {
    return;
  }

  let added = false;
  let removed = false;

  const next = updatePreferencesRef((current) => {
    const set = new Set(current.filters);
    if (set.has(tagId) || forceRemove) {
      removed = set.delete(tagId);
    } else {
      set.add(tagId);
      added = true;
    }
    current.filters = Array.from(set);
    return current;
  });

  if (added) {
    const count = next.filters?.length ?? 0;
    if (count >= 5) {
      whisperController?.speak('too_many_tags');
    } else {
      whisperController?.speak('tag_add');
    }
    if (count >= 3) {
      maybeTriggerCaught('stack', { count });
    }
    const cadenceFactor = count >= 5 ? 0.4 : count >= 3 ? 0.5 : 0.65;
    whisperController?.accelerateCadence?.(cadenceFactor, 12000);
  } else if (removed && (next.filters?.length ?? 0) === 0) {
    whisperController?.speak('clear');
    whisperController?.accelerateCadence?.(0.75, 8000);
  }

  resetIdleTimer();
}

function clearFilters() {
  if (!updatePreferencesRef) {
    return;
  }
  const next = updatePreferencesRef({ filters: [] });
  if ((next.filters ?? []).length === 0) {
    whisperController?.speak('clear');
    whisperController?.accelerateCadence?.(0.7, 9000);
    maybeTriggerCaught('reset');
  }
  resetIdleTimer();
}

function updateFilterHeatmap(count) {
  if (filterPanel) {
    filterPanel.style.setProperty('--filter-heat', String(count));
  }
  document.documentElement.style.setProperty('--filter-heat', String(count));
}

function syncBottomControls(preferences) {
  if (!preferences) {
    return;
  }

  const intensity = preferences.tts?.intensity ?? 0;
  const muted = Boolean(preferences.tts?.muted);
  const motionReduced = Boolean(preferences.motion?.reduced);

  if (ttsSlider && String(ttsSlider.value) !== String(intensity)) {
    ttsSlider.value = String(intensity);
  }

  if (ttsSliderLabel) {
    ttsSliderLabel.textContent = TTS_LABELS[intensity] ?? 'Steady';
  }

  if (muteToggle) {
    muteToggle.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteToggle.textContent = muted ? 'On' : 'Off';
  }

  if (bottomMute) {
    bottomMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    bottomMute.classList.toggle('text-accent-pink', muted);
  }

  if (motionToggle) {
    motionToggle.setAttribute('aria-pressed', motionReduced ? 'true' : 'false');
    motionToggle.textContent = motionReduced ? 'On' : 'Off';
  }

  if (bottomMotion) {
    bottomMotion.setAttribute('aria-pressed', motionReduced ? 'true' : 'false');
    bottomMotion.classList.toggle('text-accent-pink', motionReduced);
  }
}

function scheduleIdle(preferences) {
  if (typeof window === 'undefined') {
    return;
  }
  clearTimeout(idleTimer);

  const muted = Boolean(preferences?.tts?.muted);
  const intensity = Number(preferences?.tts?.intensity ?? 0);
  if (muted || intensity === 0) {
    idleTimer = null;
    return;
  }

  const delay = IDLE_DELAYS[intensity] ?? 32000;
  idleTimer = window.setTimeout(() => {
    whisperController?.speak('idle');
    scheduleIdle(currentPreferences);
  }, delay);
}

function resetIdleTimer() {
  scheduleIdle(currentPreferences);
}

function handleFoldChange(state) {
  foldState = state;
  if (state !== 'cover') {
    closeSheet('filters');
  }
}

function handleTtsStatus({ status, reason }) {
  if (!ttsStatus) {
    return;
  }

  if (status === 'ready') {
    ttsStatus.textContent = 'Azure whisper voices rotating.';
    return;
  }

  if (status === 'disabled') {
    const messages = {
      'missing-credentials': 'Whispers disabled — no Azure credentials detected.',
      'no-whisper-voices': 'Whispers disabled — whispering voices unavailable.',
      'network-error': 'Whispers offline — check your connection.',
      'playback-error': 'Playback blocked — whispers muted for this session.'
    };
    ttsStatus.textContent = messages[reason] ?? 'Whispers disabled.';
    return;
  }

  ttsStatus.textContent = 'Initializing Azure whisper voices…';
}

function setupTooltips() {
  if (typeof document === 'undefined') {
    return;
  }

  if (!tooltipRoot) {
    tooltipRoot = document.createElement('div');
    tooltipRoot.className = 'tease-tooltip';
    tooltipRoot.setAttribute('role', 'status');
    tooltipRoot.hidden = true;
    document.body.appendChild(tooltipRoot);
    window.addEventListener('scroll', () => hideTooltip({ immediate: true }), { passive: true });
    window.addEventListener('resize', () => hideTooltip({ immediate: true }));
  }

  registerTooltipTargets(document);
}

function registerTooltipTargets(root) {
  if (!root) {
    return;
  }
  const elements = root.querySelectorAll('[data-tooltip]');
  elements.forEach(bindTooltipTarget);
}

function bindTooltipTarget(element) {
  if (!element || element.dataset.tooltipBound === 'true') {
    return;
  }
  element.dataset.tooltipBound = 'true';
  element.addEventListener('pointerenter', handleTooltipEnter);
  element.addEventListener('focus', handleTooltipEnter);
  element.addEventListener('pointerleave', handleTooltipLeave);
  element.addEventListener('blur', handleTooltipLeave);
  element.addEventListener('touchstart', handleTooltipEnter, { passive: true });
}

function handleTooltipEnter(event) {
  const target = event.currentTarget;
  showTooltip(target);
}

function handleTooltipLeave() {
  hideTooltip();
}

function showTooltip(target) {
  if (!tooltipRoot || !target) {
    return;
  }

  const text = resolveTooltipText(target);
  if (!text) {
    return;
  }

  tooltipRoot.textContent = text;
  tooltipRoot.hidden = false;
  tooltipRoot.dataset.visible = 'true';

  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltipRoot.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  let left = centerX - tooltipRect.width / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - tooltipRect.width - 12));
  let top = rect.top - tooltipRect.height - 12;
  if (top < 12) {
    top = rect.bottom + 12;
  }
  tooltipRoot.style.left = `${Math.round(left)}px`;
  tooltipRoot.style.top = `${Math.round(top)}px`;

  if (tooltipHideTimer) {
    window.clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

function hideTooltip({ immediate = false } = {}) {
  if (!tooltipRoot) {
    return;
  }

  if (tooltipHideTimer) {
    window.clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }

  const conceal = () => {
    delete tooltipRoot.dataset.visible;
    tooltipRoot.hidden = true;
  };

  if (immediate || typeof window === 'undefined') {
    conceal();
    return;
  }

  tooltipHideTimer = window.setTimeout(conceal, 160);
}

function resolveTooltipText(element) {
  const key = element.getAttribute('data-tooltip');
  const value = element.getAttribute('data-tooltip-value');
  const resolver = key ? TOOLTIP_COPY[key] : null;
  if (typeof resolver === 'function') {
    return resolver(value, element) ?? '';
  }
  if (resolver) {
    return resolver;
  }
  if (value) {
    return value;
  }
  return element.getAttribute('title') ?? '';
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (isCaughtVisible()) {
    hideCaught();
    event.preventDefault();
    return;
  }

  closeSheet();
}

function hasSeenCaught() {
  if (caughtSeen) {
    return true;
  }
  try {
    const value = window.sessionStorage?.getItem(CAUGHT_SESSION_KEY);
    caughtSeen = value === '1';
  } catch (error) {
    // ignore storage errors
  }
  return caughtSeen;
}

function markCaughtSeen() {
  caughtSeen = true;
  try {
    window.sessionStorage?.setItem(CAUGHT_SESSION_KEY, '1');
  } catch (error) {
    // ignore storage errors
  }
}

function primeCaught(preferences) {
  if (typeof window === 'undefined') {
    return;
  }
  if (caughtTimer) {
    window.clearTimeout(caughtTimer);
    caughtTimer = null;
  }
  if (hasSeenCaught()) {
    return;
  }
  const enabled = preferences?.humiliation?.enabled ?? true;
  const intensity = Number(preferences?.humiliation?.intensity ?? 0);
  if (!enabled || intensity <= 0) {
    return;
  }
  const delay = intensity >= 3 ? 2400 : intensity === 2 ? 3600 : 4600;
  caughtTimer = window.setTimeout(() => {
    maybeTriggerCaught('entry');
  }, delay);
}

function maybeTriggerCaught(reason, context = {}) {
  if (hasSeenCaught() || isCaughtVisible()) {
    return;
  }

  const enabled = currentPreferences?.humiliation?.enabled ?? true;
  const intensity = Number(currentPreferences?.humiliation?.intensity ?? 0);
  if (!enabled || intensity <= 0) {
    return;
  }

  if (reason === 'entry' && intensity <= 1) {
    return;
  }

  let message = '';
  if (reason === 'stack') {
    message = CAUGHT_MESSAGES.stack(context) ?? '';
  } else if (reason === 'filters') {
    message = CAUGHT_MESSAGES.filters(intensity) ?? '';
  } else if (reason === 'entry') {
    message = CAUGHT_MESSAGES.entry(intensity) ?? '';
  } else if (reason === 'reset') {
    message = CAUGHT_MESSAGES.reset(intensity) ?? CAUGHT_MESSAGES.reset();
  }

  if (!message) {
    return;
  }

  markCaughtSeen();
  showCaught(message);
  whisperController?.accelerateCadence?.(0.45, 14000);
}

function isCaughtVisible() {
  return Boolean(caughtOverlay && caughtOverlay.dataset.visible === 'true');
}

function showCaught(message) {
  if (!caughtOverlay) {
    return;
  }

  if (caughtTimer) {
    window.clearTimeout(caughtTimer);
    caughtTimer = null;
  }

  if (caughtCopy) {
    caughtCopy.textContent = message;
  }

  caughtOverlay.hidden = false;
  caughtOverlay.dataset.visible = 'true';
  caughtOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('caught-active');
  hideTooltip({ immediate: true });

  const focusTarget = caughtDismiss ?? caughtOverlay;
  focusTarget?.focus?.({ preventScroll: true });
}

function hideCaught() {
  if (!caughtOverlay || !isCaughtVisible()) {
    return;
  }

  delete caughtOverlay.dataset.visible;
  caughtOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('caught-active');

  if (typeof window === 'undefined') {
    caughtOverlay.hidden = true;
    return;
  }

  window.setTimeout(() => {
    if (!isCaughtVisible()) {
      caughtOverlay.hidden = true;
    }
  }, 220);
}
window.addEventListener('beforeunload', () => {
  unsubscribeFold?.();
  galleryVirtualizer?.destroy();
});
