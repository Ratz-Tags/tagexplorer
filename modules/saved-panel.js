// Saved panel: favorites plus named lists, with the ways people use them —
// open an artist, show a list in the gallery, copy it as artist tags, export.
import {
  getAllFavorites,
  toggleFavorite,
  getCollections,
  getCollection,
  createCollection,
  renameCollection,
  deleteCollection,
  toggleInCollection,
} from './favorites.js';

const FAVORITES = '__favorites__';

let hooks = {};
let root = null;
let selected = FAVORITES;
let returnFocus = null;

// hooks: { showList(names), clearList(), openArtist(name), findArtist(name), notify(message) }
export function initSavedPanel(options = {}) {
  hooks = options;
  const refresh = () => {
    if (root && !root.hidden) render();
  };
  document.addEventListener('favorites:changed', refresh);
  document.addEventListener('collections:changed', refresh);
}

export function toggleSavedPanel() {
  if (root && !root.hidden) closeSavedPanel();
  else openSavedPanel();
}

export function openSavedPanel() {
  ensureRoot();
  returnFocus = document.activeElement;
  if (selected !== FAVORITES && !getCollections().some((list) => list.name === selected)) {
    selected = FAVORITES;
  }
  root.hidden = false;
  document.documentElement.classList.add('saved-open');
  render();
  root.querySelector('[aria-selected="true"]')?.focus();
}

export function closeSavedPanel() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.documentElement.classList.remove('saved-open');
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
}

function listNames(key) {
  return key === FAVORITES ? getAllFavorites() : getCollection(key);
}

function listLabel(key) {
  return key === FAVORITES ? 'Favorites' : key;
}

function ensureRoot() {
  if (root) return;
  root = document.createElement('div');
  root.className = 'saved';
  root.hidden = true;
  root.innerHTML = `
    <div class="saved__backdrop" data-close></div>
    <aside class="saved__panel" role="dialog" aria-modal="true" aria-labelledby="saved-title">
      <header class="saved__head">
        <h2 id="saved-title" class="saved__title">Saved</h2>
        <button type="button" class="saved__close" data-close aria-label="Close">✕</button>
      </header>
      <div class="saved__lists" role="tablist" aria-label="Lists"></div>
      <form class="saved__new">
        <input type="text" maxlength="40" placeholder="New list name" aria-label="New list name">
        <button type="submit">Create list</button>
      </form>
      <div class="saved__actions">
        <button type="button" data-act="show">Show in gallery</button>
        <button type="button" data-act="copy">Copy as tags</button>
        <button type="button" data-act="export">Export</button>
        <button type="button" data-act="rename">Rename</button>
        <button type="button" data-act="delete">Delete list</button>
      </div>
      <ul class="saved__artists" role="tabpanel"></ul>
      <p class="saved__empty" hidden></p>
    </aside>
  `;
  document.body.appendChild(root);

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) {
      closeSavedPanel();
      return;
    }
    const tab = event.target.closest('[data-list]');
    if (tab) {
      selected = tab.dataset.list;
      render();
      root.querySelector('[aria-selected="true"]')?.focus();
      return;
    }
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      const name = remove.dataset.remove;
      if (selected === FAVORITES) toggleFavorite(name);
      else toggleInCollection(selected, name);
      return;
    }
    const open = event.target.closest('[data-open]');
    if (open) {
      closeSavedPanel();
      hooks.openArtist?.(open.dataset.open);
      return;
    }
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action) runAction(action);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeSavedPanel();
    }
  });

  root.querySelector('.saved__new').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    const name = input.value.trim();
    if (!name) return;
    if (!createCollection(name)) {
      hooks.notify?.(`A list called “${name}” already exists.`);
      return;
    }
    input.value = '';
    selected = name;
    render();
  });
}

function runAction(action) {
  const names = listNames(selected);
  const label = listLabel(selected);
  if (action === 'show') {
    if (!names.length) return;
    closeSavedPanel();
    hooks.showList?.(names);
    showScopeChip(label, names.length);
  } else if (action === 'copy') {
    if (!names.length) return;
    const text = names.map((name) => `artist:${name}`).join(', ');
    navigator.clipboard?.writeText(text).then(
      () => hooks.notify?.(`Copied ${names.length} artist tags from ${label}`),
      () => hooks.notify?.('Copy failed — your browser blocked clipboard access'),
    );
  } else if (action === 'export') {
    const payload = {
      exportedAt: new Date().toISOString(),
      favorites: getAllFavorites(),
      collections: Object.fromEntries(getCollections().map((list) => [list.name, list.artists])),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tagexplorer-saved.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (action === 'rename' && selected !== FAVORITES) {
    const next = window.prompt('Rename list', selected)?.trim();
    if (next && next !== selected && renameCollection(selected, next)) {
      selected = next;
      render();
    }
  } else if (action === 'delete' && selected !== FAVORITES) {
    if (window.confirm(`Delete the list “${selected}”? Artists stay in your favorites.`)) {
      deleteCollection(selected);
      selected = FAVORITES;
      render();
    }
  }
}

function render() {
  const lists = [{ key: FAVORITES, label: 'Favorites', count: getAllFavorites().length }].concat(
    getCollections().map((list) => ({ key: list.name, label: list.name, count: list.artists.length })),
  );
  const tabs = root.querySelector('.saved__lists');
  tabs.replaceChildren(
    ...lists.map(({ key, label, count }) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'saved__tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(key === selected));
      tab.dataset.list = key;
      const name = document.createElement('span');
      name.textContent = label;
      const badge = document.createElement('span');
      badge.className = 'saved__count';
      badge.textContent = String(count);
      tab.append(name, badge);
      return tab;
    }),
  );

  const isCollection = selected !== FAVORITES;
  root.querySelector('[data-act="rename"]').hidden = !isCollection;
  root.querySelector('[data-act="delete"]').hidden = !isCollection;

  const names = listNames(selected).slice().sort((a, b) => a.localeCompare(b));
  for (const act of ['show', 'copy']) {
    root.querySelector(`[data-act="${act}"]`).disabled = names.length === 0;
  }

  const list = root.querySelector('.saved__artists');
  list.replaceChildren(
    ...names.map((name) => {
      const item = document.createElement('li');
      item.className = 'saved__artist';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'saved__open';
      open.dataset.open = name;
      const label = document.createElement('span');
      label.textContent = name.replace(/_/g, ' ');
      open.appendChild(label);
      const posts = hooks.findArtist?.(name)?.postCount;
      if (posts) {
        const meta = document.createElement('span');
        meta.className = 'saved__meta';
        meta.textContent = `${posts} posts`;
        open.appendChild(meta);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'saved__remove';
      remove.dataset.remove = name;
      remove.setAttribute('aria-label', `Remove ${name.replace(/_/g, ' ')} from ${listLabel(selected)}`);
      remove.textContent = '✕';
      item.append(open, remove);
      return item;
    }),
  );

  const empty = root.querySelector('.saved__empty');
  empty.hidden = names.length > 0;
  empty.textContent = isCollection
    ? 'This list is empty. Add artists with Save in the image viewer.'
    : 'No favorites yet. Use Save in the image viewer, or the heart on a card.';
}

function showScopeChip(label, count) {
  const bar = document.querySelector('.gallery-results__bar');
  if (!bar) return;
  bar.querySelector('.results-scope')?.remove();
  const chip = document.createElement('div');
  chip.className = 'results-scope';
  const text = document.createElement('span');
  text.textContent = `Showing ${label} (${count})`;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Back to all artists';
  clear.addEventListener('click', () => {
    chip.remove();
    hooks.clearList?.();
  });
  chip.append(text, clear);
  bar.prepend(chip);
  // Any new tag or name filter replaces the list view.
  document.addEventListener('tags:updated', () => chip.remove(), { once: true });
}
