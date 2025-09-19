import { initializeApp } from '../core/app.js';
import { safeAnimate, stagger } from '../core/motion.js';

const filterPanel = document.querySelector('[data-filter-panel]');
const activeFiltersRoot = document.querySelector('[data-active-filters]');
const tagOptionsRoot = document.querySelector('[data-tag-options]');
const galleryGrid = document.querySelector('[data-gallery-grid]');
const gallerySummary = document.querySelector('[data-gallery-summary]');
const galleryEmpty = document.querySelector('[data-gallery-empty]');
const filterCount = document.querySelector('[data-filter-count]');
const clearButtons = document.querySelectorAll('[data-clear-filters], [data-clear-filters-secondary]');
const bottomOpen = document.querySelector('[data-bottom-open]');

let datasetRef = null;
let updatePreferencesRef = null;

initializeApp('gallery', {
  onReady({ dataset, preferences, updatePreferences }) {
    datasetRef = dataset;
    updatePreferencesRef = updatePreferences;
    renderTagOptions(dataset.tags, preferences.filters);
    renderGallery(preferences.filters);
    bindEvents();
  },
  onPreferencesChange({ preferences }) {
    renderTagOptions(datasetRef?.tags ?? [], preferences.filters);
    renderGallery(preferences.filters);
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
    button.addEventListener('click', () => clearFilters());
  });

  if (bottomOpen && filterPanel) {
    bottomOpen.addEventListener('click', () => {
      filterPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
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
      fragment.appendChild(button);
    });
    tagOptionsRoot.appendChild(fragment);
  }

  const buttons = tagOptionsRoot.querySelectorAll('[data-tag-option]');
  buttons.forEach((button) => {
    const tagId = button.getAttribute('data-tag-option');
    const isActive = selectedFilters.includes(tagId);
    button.classList.toggle('border-accent-pink/60', isActive);
    button.classList.toggle('text-white', isActive);
    button.classList.toggle('shadow-neon', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

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
    placeholder.textContent = 'No tags yet — afraid to commit?';
    activeFiltersRoot.appendChild(placeholder);
    return;
  }

  const fragment = document.createDocumentFragment();
  filters.forEach((tagId) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip bg-accent-pink/10 text-[0.65rem] text-white hover:bg-accent-pink/20';
    chip.setAttribute('data-remove-filter', tagId);
    chip.innerHTML = `<span>${tagId.replace(/_/g, ' ')}</span><span aria-hidden="true">×</span>`;
    fragment.appendChild(chip);
  });
  activeFiltersRoot.appendChild(fragment);
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

  galleryGrid.innerHTML = '';

  if (!filteredArtists.length) {
    if (galleryEmpty) {
      galleryEmpty.classList.remove('hidden');
    }
  } else {
    if (galleryEmpty) {
      galleryEmpty.classList.add('hidden');
    }
    const fragment = document.createDocumentFragment();
    filteredArtists.forEach((artist) => {
      fragment.appendChild(createArtistCard(artist));
    });
    galleryGrid.appendChild(fragment);
    const cards = galleryGrid.querySelectorAll('article');
    safeAnimate(cards, { opacity: [0, 1], y: [16, 0] }, { delay: stagger(0.05), duration: 0.5 });
  }

  updateSummary(filteredArtists.length, artists.length, normalizedFilters.length);
}

function createArtistCard(artist) {
  const card = document.createElement('article');
  card.className = 'group relative flex flex-col gap-4 rounded-3xl border border-white/10 bg-panel/40 p-5 shadow-glass transition duration-500 hover:border-accent-pink/60 hover:shadow-neon';

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

  return card;
}

function updateSummary(visible, total, filterCountValue) {
  if (gallerySummary) {
    if (filterCountValue > 0) {
      gallerySummary.textContent = `Showing ${visible} / ${total} artists`;
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

  updatePreferencesRef((current) => {
    const set = new Set(current.filters);
    if (set.has(tagId) || forceRemove) {
      set.delete(tagId);
    } else {
      set.add(tagId);
    }
    current.filters = Array.from(set);
    return current;
  });
}

function clearFilters() {
  if (!updatePreferencesRef) {
    return;
  }
  updatePreferencesRef({ filters: [] });
}

