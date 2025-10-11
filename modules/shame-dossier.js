const STORAGE_KEY = 'te.dossier.entries';
const MAX_ENTRIES = 240;
const DEDUPE_WINDOW_MS = 4200;

let entries = [];
let initPromise = null;
let dossierElement = null;
let hasOpened = false;
const dedupeMap = new Map();
const listeners = new Map();

function now() {
  return Date.now();
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadEntriesFromStorage() {
  if (entries.length) return entries;
  if (typeof window === 'undefined') {
    entries = [];
    return entries;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      entries = [];
      return entries;
    }
    const parsed = safeParse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed
        .map((item) => {
          const ts = Number(item?.timestamp) || now();
          return {
            id: item?.id || `${ts}-${Math.random().toString(16).slice(2)}`,
            timestamp: ts,
            title: String(item?.title || 'Recorded action'),
            detail: String(item?.detail || ''),
            type: String(item?.type || 'system'),
            category: String(item?.category || 'system'),
            accent: String(item?.accent || ''),
            meta: item?.meta || {},
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_ENTRIES);
      return entries;
    }
  } catch (error) {
    console.warn('[shame-dossier] Failed to parse storage entries', error);
  }
  entries = [];
  return entries;
}

function persistEntries() {
  if (typeof window === 'undefined') return;
  try {
    const payload = entries.slice(0, MAX_ENTRIES).map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      title: entry.title,
      detail: entry.detail,
      type: entry.type,
      category: entry.category,
      accent: entry.accent,
      meta: entry.meta || {},
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[shame-dossier] Failed to persist entries', error);
  }
}

function ensureElement() {
  if (typeof document === 'undefined') return null;
  if (dossierElement && document.body.contains(dossierElement)) {
    return dossierElement;
  }
  dossierElement = document.querySelector('te-shame-dossier');
  if (!dossierElement) {
    dossierElement = document.createElement('te-shame-dossier');
    dossierElement.id = 'shame-dossier-overlay';
    dossierElement.setAttribute('hidden', '');
    document.body.appendChild(dossierElement);
  }
  if (typeof dossierElement.setEntries === 'function') {
    dossierElement.setEntries(entries);
  }
  return dossierElement;
}

function registerCustomElement() {
  if (typeof customElements === 'undefined') return;
  if (customElements.get('te-shame-dossier')) return;
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="shame-dossier-overlay" data-open="false">
      <div class="shame-dossier-backdrop" data-close="true"></div>
      <section
        class="shame-dossier-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shame-dossier-title"
      >
        <header class="shame-dossier-header">
          <div class="shame-dossier-heading">
            <h2 id="shame-dossier-title">Shame dossier</h2>
            <p class="shame-dossier-caption">Every indulgence you tried to hide.</p>
            <p class="shame-dossier-whisper" data-soft-whisper aria-live="polite"></p>
          </div>
          <div class="shame-dossier-actions">
            <label class="shame-dossier-filter">
              <span class="sr-only">Filter dossier</span>
              <select data-filter>
                <option value="all">Everything</option>
                <option value="tag">Tags</option>
                <option value="favorites">Favorites</option>
                <option value="progress">Progress</option>
                <option value="taunt">Taunts</option>
                <option value="system">System</option>
              </select>
            </label>
            <button type="button" class="shame-dossier-clear" data-clear>
              Wipe log
            </button>
            <button type="button" class="shame-dossier-close" data-close>
              <span aria-hidden="true">✕</span>
              <span class="sr-only">Close dossier</span>
            </button>
          </div>
        </header>
        <div class="shame-dossier-content">
          <ol class="shame-dossier-timeline" data-list role="list"></ol>
          <div class="shame-dossier-empty" data-empty hidden>
            <p>No shame logged yet. Curious.</p>
          </div>
        </div>
        <div class="sr-only" aria-live="polite" data-live></div>
      </section>
    </div>
  `;

  class ShameDossierElement extends HTMLElement {
    constructor() {
      super();
      this._entries = [];
      this._filter = 'all';
      this._rendered = false;
      this._handleKeydown = this._handleKeydown.bind(this);
    }

    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;
      const content = template.content.cloneNode(true);
      this.appendChild(content);
      this.overlay = this.querySelector('.shame-dossier-overlay');
      this.list = this.querySelector('[data-list]');
      this.emptyState = this.querySelector('[data-empty]');
      this.filterSelect = this.querySelector('[data-filter]');
      this.clearButton = this.querySelector('[data-clear]');
      this.closeButtons = this.querySelectorAll('[data-close]');
      this.softWhisper = this.querySelector('[data-soft-whisper]');
      this.liveRegion = this.querySelector('[data-live]');
      this.panel = this.querySelector('.shame-dossier-panel');

      if (this.filterSelect) {
        this.filterSelect.addEventListener('change', () => {
          this._filter = this.filterSelect.value;
          this.render();
        });
      }

      if (this.clearButton) {
        this.clearButton.addEventListener('click', () => {
          clearDossierEntries();
          this.focus();
        });
      }

      this.closeButtons.forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });

      this.addEventListener('click', (event) => {
        if (event.target?.dataset?.close === 'true') {
          this.close();
        }
      });

      this.setEntries(entries);
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this._handleKeydown);
    }

    _handleKeydown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    }

    setEntries(list) {
      this._entries = Array.isArray(list) ? list.slice() : [];
      this.render();
    }

    setSoftWhisper(text) {
      if (!this.softWhisper) return;
      if (!text) {
        this.softWhisper.textContent = '';
        this.softWhisper.hidden = true;
        return;
      }
      this.softWhisper.textContent = text;
      this.softWhisper.hidden = false;
    }

    render() {
      if (!this.list) return;
      const filter = this._filter || 'all';
      const filtered = this._entries.filter((entry) => {
        if (filter === 'all') return true;
        return entry.category === filter;
      });
      this.list.innerHTML = '';
      if (!filtered.length) {
        if (this.emptyState) this.emptyState.hidden = false;
        return;
      }
      if (this.emptyState) this.emptyState.hidden = true;
      const fragment = document.createDocumentFragment();
      filtered
        .sort((a, b) => b.timestamp - a.timestamp)
        .forEach((entry) => {
          const item = document.createElement('li');
          item.className = `shame-dossier-entry ${entry.accent ? `is-${entry.accent}` : ''}`;
          item.dataset.type = entry.type;
          item.dataset.category = entry.category;

          const marker = document.createElement('div');
          marker.className = 'shame-dossier-entry__marker';
          marker.setAttribute('aria-hidden', 'true');

          const body = document.createElement('article');
          body.className = 'shame-dossier-entry__body';
          body.innerHTML = `
            <header>
              <h3>${entry.title}</h3>
              <time datetime="${new Date(entry.timestamp).toISOString()}">
                ${new Intl.DateTimeFormat(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(entry.timestamp)}
              </time>
            </header>
            <p>${entry.detail}</p>
          `;
          if (entry.meta && typeof entry.meta === 'object') {
            const metaList = Object.entries(entry.meta)
              .filter(([key, value]) =>
                typeof value !== 'undefined' && value !== null && value !== '',
              )
              .map(
                ([key, value]) =>
                  `<span class="shame-dossier-meta" data-key="${key}">${key}: <strong>${value}</strong></span>`,
              )
              .join('');
            if (metaList) {
              const footer = document.createElement('footer');
              footer.className = 'shame-dossier-entry__meta';
              footer.innerHTML = metaList;
              body.appendChild(footer);
            }
          }

          item.appendChild(marker);
          item.appendChild(body);
          fragment.appendChild(item);
        });
      this.list.appendChild(fragment);
    }

    open() {
      if (!this.overlay) return;
      this.removeAttribute('hidden');
      this.overlay.dataset.open = 'true';
      document.body.classList.add('shame-dossier-open');
      if (this.panel) {
        this.panel.setAttribute('tabindex', '-1');
        this.panel.focus({ preventScroll: true });
      }
      document.addEventListener('keydown', this._handleKeydown);
      try {
        document.dispatchEvent(new CustomEvent('dossier:toggle', { detail: { open: true } }));
      } catch {}
    }

    close() {
      if (!this.overlay) return;
      this.overlay.dataset.open = 'false';
      this.setAttribute('hidden', '');
      document.body.classList.remove('shame-dossier-open');
      document.removeEventListener('keydown', this._handleKeydown);
      if (this.panel) {
        this.panel.removeAttribute('tabindex');
      }
      this.setSoftWhisper('');
      try {
        document.dispatchEvent(new CustomEvent('dossier:toggle', { detail: { open: false } }));
      } catch {}
    }

    announce(message) {
      if (!this.liveRegion) return;
      this.liveRegion.textContent = '';
      if (message) {
        requestAnimationFrame(() => {
          this.liveRegion.textContent = message;
        });
      }
    }
  }

  customElements.define('te-shame-dossier', ShameDossierElement);
}

function normalizeEntryPayload(type, detail = {}) {
  const timestamp = now();
  const entry = {
    id: `${type}-${timestamp}-${Math.random().toString(16).slice(2)}`,
    timestamp,
    type,
    category: 'system',
    title: 'Logged action',
    detail: '',
    accent: '',
    meta: {},
    dedupeKey: detail?.dedupeKey,
  };

  switch (type) {
    case 'tags:add': {
      const tag = String(detail?.tag || '').replaceAll('_', ' ');
      const total = Number(detail?.totalActive) || 0;
      entry.category = 'tag';
      entry.title = `Tag added: ${tag || 'unknown'}`;
      entry.detail = total
        ? `Stack now at ${total} active ${total === 1 ? 'tag' : 'tags'}.`
        : 'Tag toggled on.';
      entry.meta = {
        tag: detail?.tag || tag,
        stack: total,
      };
      entry.accent = 'cyan';
      entry.dedupeKey = entry.dedupeKey || `tag-add:${detail?.tag}:${total}`;
      break;
    }
    case 'tags:remove': {
      const tag = String(detail?.tag || '').replaceAll('_', ' ');
      const total = Number(detail?.totalActive) || 0;
      entry.category = 'tag';
      entry.title = `Tag removed: ${tag || 'unknown'}`;
      entry.detail = total
        ? `Stack trimmed to ${total} ${total === 1 ? 'tag' : 'tags'}.`
        : 'No tags remain.';
      entry.meta = {
        tag: detail?.tag || tag,
        stack: total,
      };
      entry.accent = 'cyan';
      entry.dedupeKey = entry.dedupeKey || `tag-remove:${detail?.tag}:${total}`;
      break;
    }
    case 'tags:clear': {
      entry.category = 'tag';
      entry.title = 'Tag stack wiped';
      entry.detail = 'All filters cleared. Pretending innocence?';
      entry.accent = 'pink';
      entry.meta = { previous: Number(detail?.previousCount) || 0 };
      entry.dedupeKey = entry.dedupeKey || `tag-clear:${detail?.previousCount}`;
      break;
    }
    case 'favorites:change': {
      const action = String(detail?.action || 'updated');
      const artist = String(detail?.artist || detail?.subject || '').trim();
      entry.category = 'favorites';
      if (action === 'added') {
        entry.title = artist ? `Favorited ${artist}` : 'Artist favorited';
        entry.detail = 'Pinned for repeat inspection.';
        entry.accent = 'pink';
      } else if (action === 'removed') {
        entry.title = artist ? `Unfavorited ${artist}` : 'Artist unpinned';
        entry.detail = 'Scrubbing the wall never hides the obsession.';
        entry.accent = 'slate';
      } else if (action === 'cleared') {
        entry.title = 'Favorites wiped';
        entry.detail = 'An empty trophy case still smells like you.';
        entry.accent = 'slate';
      } else if (action === 'imported') {
        entry.title = 'Favorites imported';
        entry.detail = 'Smuggled trophies restored.';
        entry.accent = 'pink';
      } else {
        entry.title = 'Favorites updated';
        entry.detail = 'Another shuffle of the shrine.';
        entry.accent = 'slate';
      }
      entry.meta = {
        count: Number(detail?.count) || 0,
        artist,
      };
      entry.dedupeKey = entry.dedupeKey || `favorites:${action}:${artist}:${detail?.count}`;
      break;
    }
    case 'goal:progress': {
      const shown = Number(detail?.shown) || 0;
      const total = Number(detail?.total) || 0;
      entry.category = 'progress';
      entry.title = 'Gallery progress logged';
      entry.detail = total
        ? `You've exposed yourself to ${shown}/${total} profiles.`
        : `You're ${shown} entries deep.`;
      entry.meta = {
        direction: detail?.direction || 'forward',
        page: detail?.page,
      };
      entry.accent = 'violet';
      entry.dedupeKey = entry.dedupeKey || `progress:${detail?.signature}`;
      break;
    }
    case 'humiliation:taunt': {
      const message = String(detail?.message || '').trim();
      entry.category = 'taunt';
      entry.title = 'Taunt delivered';
      entry.detail = message || 'A fresh whisper curled around you.';
      entry.accent = 'red';
      entry.meta = {
        context: detail?.context || '',
      };
      entry.dedupeKey = entry.dedupeKey || `taunt:${message}`;
      break;
    }
    case 'dossier:open': {
      entry.category = 'system';
      entry.title = detail?.first ? 'First dossier inspection' : 'Dossier revisited';
      entry.detail = detail?.first
        ? 'Every entry is timestamped. Nothing slips away.'
        : "You knew you couldn't look away for long.";
      entry.accent = 'teal';
      entry.meta = { source: detail?.source || 'unknown' };
      entry.dedupeKey = entry.dedupeKey || `open:${detail?.first}`;
      break;
    }
    default: {
      if (detail?.entry) {
        return {
          ...entry,
          ...detail.entry,
          timestamp,
        };
      }
      entry.detail = detail?.detail || 'Action recorded.';
      entry.meta = detail?.meta || {};
      entry.accent = detail?.accent || 'slate';
    }
  }
  return entry;
}

function shouldDedupe(entry) {
  if (!entry || !entry.dedupeKey) return false;
  const key = String(entry.dedupeKey);
  const previous = dedupeMap.get(key) || 0;
  const current = entry.timestamp;
  if (current - previous < DEDUPE_WINDOW_MS) {
    return true;
  }
  dedupeMap.set(key, current);
  return false;
}

function appendEntry(entry) {
  if (!entry || shouldDedupe(entry)) return null;
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persistEntries();
  const element = ensureElement();
  if (element && typeof element.setEntries === 'function') {
    element.setEntries(entries);
    if (element.overlay?.dataset?.open === 'true') {
      element.announce(`${entry.title}. ${entry.detail}`);
    }
  }
  if (typeof document !== 'undefined') {
    try {
      document.dispatchEvent(
        new CustomEvent('dossier:append', {
          detail: { entry },
        }),
      );
    } catch (error) {
      console.warn('[shame-dossier] Failed to broadcast append event', error);
    }
  }
  return entry;
}

function logDossierEvent(type, detail = {}) {
  const entry = normalizeEntryPayload(type, detail);
  if (!entry) return null;
  return appendEntry(entry);
}

function clearDossierEntries() {
  entries = [];
  persistEntries();
  const element = ensureElement();
  if (element && typeof element.setEntries === 'function') {
    element.setEntries(entries);
    element.announce('Dossier log cleared.');
  }
  if (typeof document !== 'undefined') {
    try {
      document.dispatchEvent(new CustomEvent('dossier:cleared'));
    } catch {}
  }
}

function getDossierEntries(filter) {
  if (!filter || filter === 'all') {
    return entries.slice();
  }
  if (typeof filter === 'string') {
    return entries.filter((entry) => entry.category === filter || entry.type === filter);
  }
  if (typeof filter === 'function') {
    return entries.filter(filter);
  }
  return entries.slice();
}

function bindEventListener(eventName, handler) {
  if (typeof document === 'undefined') return;
  const key = String(eventName);
  if (!key || typeof handler !== 'function') return;
  if (listeners.has(key)) return;
  const wrapped = (event) => {
    try {
      handler(event?.detail || {}, event);
    } catch (error) {
      console.warn(`[shame-dossier] Handler for ${key} failed`, error);
    }
  };
  listeners.set(key, wrapped);
  document.addEventListener(key, wrapped);
}

function ensureListeners() {
  bindEventListener('tags:add', (detail) => logDossierEvent('tags:add', detail));
  bindEventListener('tags:remove', (detail) => logDossierEvent('tags:remove', detail));
  bindEventListener('tags:clear', (detail) => logDossierEvent('tags:clear', detail));
  bindEventListener('favorites:change', (detail) => logDossierEvent('favorites:change', detail));
  bindEventListener('goal:progress', (detail) => logDossierEvent('goal:progress', detail));
  bindEventListener('humiliation:taunt', (detail) => logDossierEvent('humiliation:taunt', detail));
  bindEventListener('dossier:entry', (detail) => {
    if (detail?.type) {
      logDossierEvent(detail.type, detail);
    }
  });
}

function initShameDossier() {
  if (initPromise) return initPromise;
  initPromise = new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    requestAnimationFrame(() => {
      registerCustomElement();
      loadEntriesFromStorage();
      ensureElement();
      ensureListeners();
      if (typeof document !== 'undefined') {
        try {
          document.dispatchEvent(new CustomEvent('dossier:ready'));
        } catch {}
      }
      resolve(dossierElement);
    });
  });
  if (typeof window !== 'undefined') {
    window.te = window.te || {};
    window.te.dossier = {
      get entries() {
        return entries.slice();
      },
      open: openShameDossier,
      clear: clearDossierEntries,
      filter: getDossierEntries,
      log: logDossierEvent,
    };
  }
  return initPromise;
}

function openShameDossier(options = {}) {
  if (typeof document === 'undefined') return;
  initShameDossier().then((element) => {
    const target = element || ensureElement();
    if (!target || typeof target.open !== 'function') return;
    target.open();
    const detail = {
      source: options?.source || 'unknown',
      first: !hasOpened,
    };
    logDossierEvent('dossier:open', detail);
    const whisperKey = hasOpened ? 'dossier_revisit' : 'dossier_open';
    hasOpened = true;
    import('./tts-dispatcher.js')
      .then(({ dispatchWhisperEvent }) => {
        const response = dispatchWhisperEvent(whisperKey, { maxIntensity: 2 });
        if (response?.reason === 'tts-disabled' && response.text) {
          target.setSoftWhisper(response.text);
        } else if (!response?.text) {
          target.setSoftWhisper('');
        }
      })
      .catch(() => {
        target.setSoftWhisper('');
      });
  });
}

function closeShameDossier() {
  if (!dossierElement || typeof dossierElement.close !== 'function') return;
  dossierElement.close();
}

export {
  initShameDossier,
  openShameDossier,
  closeShameDossier,
  logDossierEvent,
  getDossierEntries,
  clearDossierEntries,
};

