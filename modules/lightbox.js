// Full-screen image browser for one artist. It opens on the first image after
// a single light request, pages in more as you browse, and keeps the common
// actions (save, copy tag, similar artists, Danbooru) one click away.
import { fetchArtistImages, buildImageUrl, getArtistSlug } from './api.js';
import {
  isFavorite,
  toggleFavorite,
  getCollections,
  isInCollection,
  toggleInCollection,
  createCollection,
  getCollectionsForArtist,
} from './favorites.js';
import { findSimilarArtists } from './similar-artists.js';

const PAGE_SIZE = 40;
const FIELDS = 'id,file_ext,preview_file_url,large_file_url,file_url,tag_string,is_banned,is_deleted';
const MAX_EMPTY_PAGES = 3;

const ICONS = {
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  similar: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  prev: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
};

const icon = (name) => `<svg class="lb__icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

let active = null;

export function closeLightbox() {
  if (active) active.close();
}

export function openLightbox(artist, options = {}) {
  if (!artist?.artistName) return null;
  closeLightbox();
  active = createLightbox(artist, options);
  return active;
}

function createLightbox(artist, options) {
  const name = artist.artistName;
  const displayName = name.replace(/_/g, ' ');
  const totalPages = artist.postCount > 0 ? Math.ceil(artist.postCount / PAGE_SIZE) : Infinity;
  const posts = [];
  const preloaded = new Set();
  let index = 0;
  let nextPage = 1;
  let exhausted = false;
  let loading = null;
  let closed = false;
  let showToken = 0;
  const returnFocus = document.activeElement;

  const root = document.createElement('div');
  root.className = 'lb';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `Images by ${displayName}`);
  root.tabIndex = -1;
  root.innerHTML = `
    <header class="lb__bar">
      <div class="lb__title">
        <a class="lb__name" data-router-link></a>
        <span class="lb__count" aria-live="polite"></span>
      </div>
      <div class="lb__actions">
        <div class="lb__save">
          <button type="button" class="lb__btn" data-action="save" aria-haspopup="true" aria-expanded="false" aria-label="Save to favorites or a list">${icon('star')}<span>Save</span></button>
          <div class="lb__menu" hidden></div>
        </div>
        <button type="button" class="lb__btn" data-action="copy" title="Copy artist:${escapeAttr(name)}" aria-label="Copy artist tag">${icon('copy')}<span>Copy tag</span></button>
        <button type="button" class="lb__btn" data-action="similar" aria-pressed="false" aria-label="Similar artists">${icon('similar')}<span>Similar</span></button>
        <a class="lb__btn" data-action="danbooru" target="_blank" rel="noopener noreferrer" title="Open this post on Danbooru" aria-label="Open on Danbooru">${icon('external')}<span>Danbooru</span></a>
        <button type="button" class="lb__btn lb__btn--icon" data-action="grid" aria-pressed="false" title="All images (G)" aria-label="Show all images">${icon('grid')}</button>
        <button type="button" class="lb__btn lb__btn--icon" data-action="close" title="Close (Esc)" aria-label="Close">${icon('close')}</button>
      </div>
    </header>
    <div class="lb__body">
      <div class="lb__stage">
        <button type="button" class="lb__nav lb__nav--prev" aria-label="Previous image">${icon('prev')}</button>
        <img class="lb__img" alt="" decoding="async" hidden>
        <p class="lb__status" role="status">Loading images…</p>
        <button type="button" class="lb__nav lb__nav--next" aria-label="Next image">${icon('next')}</button>
      </div>
      <aside class="lb__side" hidden>
        <h3 class="lb__side-title">Similar artists</h3>
        <ol class="lb__similar"></ol>
      </aside>
    </div>
    <div class="lb__strip"><div class="lb__sentinel" aria-hidden="true"></div></div>
  `;

  const $ = (selector) => root.querySelector(selector);
  const nameLink = $('.lb__name');
  const countEl = $('.lb__count');
  const saveBtn = $('[data-action="save"]');
  const menu = $('.lb__menu');
  const similarBtn = $('[data-action="similar"]');
  const danbooruLink = $('[data-action="danbooru"]');
  const gridBtn = $('[data-action="grid"]');
  const stage = $('.lb__stage');
  const img = $('.lb__img');
  const status = $('.lb__status');
  const side = $('.lb__side');
  const similarList = $('.lb__similar');
  const strip = $('.lb__strip');
  const sentinel = $('.lb__sentinel');

  nameLink.textContent = displayName;
  nameLink.href = `../artist/[id]/?slug=${encodeURIComponent(getArtistSlug(name))}`;
  danbooruLink.href = `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(`${name} order:approvals`)}`;

  function largeUrl(post) {
    return buildImageUrl(post.large_file_url || post.file_url || post.preview_file_url);
  }

  function previewUrl(post) {
    return buildImageUrl(post.preview_file_url || post.large_file_url || post.file_url);
  }

  function preload(i) {
    const post = posts[i];
    if (!post) return;
    const url = largeUrl(post);
    if (!url || preloaded.has(url)) return;
    preloaded.add(url);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  }

  function updateCount() {
    if (!posts.length) {
      countEl.textContent = artist.postCount ? `${artist.postCount} posts` : '';
      return;
    }
    const total = exhausted ? posts.length : Math.max(posts.length, artist.postCount || 0);
    countEl.textContent = `${index + 1} / ${total}`;
  }

  function updateStatus() {
    if (posts.length) {
      status.hidden = true;
      return;
    }
    status.hidden = false;
    status.textContent = loading ? 'Loading images…' : 'No images found for this artist.';
  }

  function show(i) {
    if (!posts.length) return;
    index = Math.max(0, Math.min(i, posts.length - 1));
    const post = posts[index];
    const token = ++showToken;
    img.hidden = false;
    img.classList.add('is-loading');
    img.src = previewUrl(post);
    img.alt = `${displayName}, image ${index + 1}`;
    const full = new Image();
    full.decoding = 'async';
    full.onload = () => {
      if (token !== showToken) return;
      img.src = full.src;
      img.classList.remove('is-loading');
    };
    full.onerror = () => {
      if (token === showToken) img.classList.remove('is-loading');
    };
    full.src = largeUrl(post);
    danbooruLink.href = `https://danbooru.donmai.us/posts/${post.id}`;
    strip.querySelectorAll('[aria-current]').forEach((node) => node.removeAttribute('aria-current'));
    const thumb = strip.querySelector(`[data-index="${index}"]`);
    if (thumb) {
      thumb.setAttribute('aria-current', 'true');
      if (!root.classList.contains('lb--grid')) {
        thumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    }
    updateCount();
    preload(index + 1);
    preload(index + 2);
    if (index >= posts.length - 5) loadMore();
  }

  async function step(delta) {
    if (!posts.length) return;
    if (delta > 0 && index >= posts.length - 1) {
      if (exhausted) return;
      await loadMore();
      if (index >= posts.length - 1) return;
    }
    if (delta < 0 && index === 0) return;
    show(index + delta);
  }

  function appendThumbs(batch, start) {
    const fragment = document.createDocumentFragment();
    batch.forEach((post, offset) => {
      const position = start + offset;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lb__thumb';
      button.dataset.index = String(position);
      button.setAttribute('aria-label', `Image ${position + 1}`);
      const thumb = document.createElement('img');
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      thumb.alt = '';
      thumb.src = previewUrl(post);
      button.appendChild(thumb);
      button.addEventListener('click', () => {
        setGrid(false);
        show(position);
      });
      fragment.appendChild(button);
    });
    strip.insertBefore(fragment, sentinel);
  }

  function loadMore() {
    if (loading || exhausted || closed) return loading || Promise.resolve();
    loading = (async () => {
      let emptyPages = 0;
      try {
        while (!closed && nextPage <= totalPages) {
          const batch = await fetchArtistImages(name, [], {
            limit: PAGE_SIZE,
            page: nextPage++,
            order: 'approvals',
            only: FIELDS,
            priority: 'high',
          });
          if (closed) return;
          if (Array.isArray(batch) && batch.length) {
            const start = posts.length;
            posts.push(...batch);
            appendThumbs(batch, start);
            if (start === 0) show(0);
            return;
          }
          // A page can come back empty after filtering out deleted or banned
          // posts; keep paging only while the post count says more exist.
          if (totalPages === Infinity || ++emptyPages >= MAX_EMPTY_PAGES) break;
        }
        exhausted = true;
      } catch (error) {
        console.warn('[lightbox] failed to load images', error);
        exhausted = true;
      } finally {
        loading = null;
        if (!closed) {
          updateStatus();
          updateCount();
        }
      }
    })();
    updateStatus();
    return loading;
  }

  function setGrid(on) {
    root.classList.toggle('lb--grid', on);
    gridBtn.setAttribute('aria-pressed', String(on));
    if (!on) {
      strip.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  function renderSimilar() {
    const matches = findSimilarArtists(artist, { limit: 12, minSimilarity: 0.05, mode: 'content' });
    similarList.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'lb__empty';
      empty.textContent = 'No similar artists found.';
      similarList.appendChild(empty);
      return;
    }
    for (const { artist: other, score, sharedTags } of matches) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lb__similar-item';
      const label = document.createElement('span');
      label.className = 'lb__similar-name';
      label.textContent = other.artistName.replace(/_/g, ' ');
      const meta = document.createElement('span');
      meta.className = 'lb__similar-meta';
      meta.textContent = `${Math.round(score * 100)}% match${other.postCount ? ` · ${other.postCount} posts` : ''}`;
      button.append(label, meta);
      if (Array.isArray(sharedTags) && sharedTags.length) {
        button.title = `Shared: ${sharedTags.slice(0, 8).map((tag) => tag.replace(/_/g, ' ')).join(', ')}`;
      }
      button.addEventListener('click', () => openLightbox(other, options));
      item.appendChild(button);
      similarList.appendChild(item);
    }
  }

  function toggleSimilar() {
    const open = side.hidden;
    side.hidden = !open;
    similarBtn.setAttribute('aria-pressed', String(open));
    if (open) renderSimilar();
  }

  function updateSaveButton() {
    const saved = isFavorite(name) || getCollectionsForArtist(name).length > 0;
    saveBtn.classList.toggle('is-saved', saved);
    saveBtn.querySelector('span').textContent = saved ? 'Saved' : 'Save';
    saveBtn.setAttribute('aria-label', saved ? 'Saved — edit favorites and lists' : 'Save to favorites or a list');
  }

  function menuItem(label, checked, onToggle) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lb__menu-item';
    button.setAttribute('role', 'menuitemcheckbox');
    button.setAttribute('aria-checked', String(checked));
    button.textContent = label;
    button.addEventListener('click', () => {
      onToggle();
      renderSaveMenu();
      updateSaveButton();
    });
    return button;
  }

  function renderSaveMenu() {
    menu.replaceChildren();
    menu.appendChild(menuItem('Favorites', isFavorite(name), () => toggleFavorite(name)));
    for (const { name: listName } of getCollections()) {
      menu.appendChild(menuItem(listName, isInCollection(listName, name), () => toggleInCollection(listName, name)));
    }
    const form = document.createElement('form');
    form.className = 'lb__menu-new';
    form.innerHTML = '<input type="text" maxlength="40" placeholder="New list…" aria-label="New list name"><button type="submit">Add</button>';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      const listName = input.value.trim();
      if (!listName) return;
      createCollection(listName);
      if (!isInCollection(listName, name)) toggleInCollection(listName, name);
      renderSaveMenu();
      updateSaveButton();
      menu.querySelector('.lb__menu-new input')?.focus();
    });
    menu.appendChild(form);
  }

  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : menu.hidden;
    menu.hidden = !open;
    saveBtn.setAttribute('aria-expanded', String(open));
    if (open) renderSaveMenu();
  }

  function close() {
    if (closed) return;
    closed = true;
    observer.disconnect();
    document.removeEventListener('keydown', onKeydown, true);
    root.remove();
    document.documentElement.classList.remove('lb-open');
    if (active?.root === root) active = null;
    if (returnFocus && typeof returnFocus.focus === 'function' && document.contains(returnFocus)) {
      returnFocus.focus({ preventScroll: true });
    }
  }

  function onKeydown(event) {
    const typing = event.target instanceof HTMLElement && event.target.closest('.lb input');
    if (typing) {
      if (event.key === 'Escape') toggleMenu(false);
      event.stopPropagation();
      return;
    }
    const handlers = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      Escape: () => (menu.hidden ? close() : toggleMenu(false)),
      g: () => setGrid(!root.classList.contains('lb--grid')),
      G: () => setGrid(!root.classList.contains('lb--grid')),
    };
    const handler = handlers[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
    // Keep the gallery's own shortcuts (F, /, audio keys…) from firing
    // underneath, except M so mute still works everywhere.
    if (event.key !== 'm' && event.key !== 'M') event.stopPropagation();
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') close();
    else if (action === 'grid') setGrid(!root.classList.contains('lb--grid'));
    else if (action === 'similar') toggleSimilar();
    else if (action === 'save') toggleMenu();
    else if (action === 'copy' && typeof options.onCopy === 'function') options.onCopy(artist);
    if (!menu.hidden && !event.target.closest('.lb__save')) toggleMenu(false);
    if (event.target === stage) close();
  });
  $('.lb__nav--prev').addEventListener('click', () => step(-1));
  $('.lb__nav--next').addEventListener('click', () => step(1));
  img.addEventListener('click', () => step(1));

  // Swipe left/right on touch screens.
  let swipeStart = null;
  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') swipeStart = event.clientX;
  });
  stage.addEventListener('pointerup', (event) => {
    if (swipeStart === null) return;
    const dx = event.clientX - swipeStart;
    swipeStart = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root: strip, rootMargin: '0px 400px 400px 0px' },
  );
  observer.observe(sentinel);

  document.addEventListener('keydown', onKeydown, true);
  document.documentElement.classList.add('lb-open');
  document.body.appendChild(root);
  root.focus({ preventScroll: true });
  updateSaveButton();
  updateCount();
  loadMore();

  return { root, close };
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
