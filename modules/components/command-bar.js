const template = document.createElement('template');
template.innerHTML = `
  <div class="command-bar-shell" role="presentation">
    <div class="command-bar-safe-area command-bar-safe-area--top" data-region="inner">
      <nav
        id="tag-explorer-bar"
        class="command-bar command-bar--inner"
        role="toolbar"
        aria-label="Pinned humiliation controls"
      >
        <div class="command-group" role="group" aria-label="Primary gallery controls">
          <button class="control-btn command-btn sidebar-toggle" type="button">PINNED</button>
          <button class="control-btn command-btn audio-toggle" type="button">AUDIO</button>
          <button class="control-btn command-btn theme-toggle" type="button">GLOW</button>
          <button
            id="filters-btn"
            class="control-btn command-btn"
            type="button"
            aria-haspopup="true"
            aria-expanded="false"
            aria-controls="tag-filter-popover"
          >
            FILTER
          </button>
          <button
            id="favorites-btn"
            class="control-btn command-btn"
            type="button"
            aria-label="Show favorite artists"
          >
            <span id="favorites-label">⭐ FAVS</span>
            <span id="favorites-count" class="favorites-count hidden"></span>
          </button>
          <button
            id="force-fetch-btn"
            class="control-btn command-btn"
            type="button"
            aria-label="Force fetch style tags"
          >
            FETCH
          </button>
        </div>
        <div class="command-status" aria-live="polite">
          <span class="command-status__label" data-mode="cover">COVER MODE</span>
          <span class="command-status__label" data-mode="inner">INNER MODE</span>
        </div>
      </nav>
    </div>
    <div class="command-bar-safe-area command-bar-safe-area--bottom" data-region="cover">
      <nav class="cover-command-bar" role="navigation" aria-label="Cover navigation">
        <a
          href="../"
          class="cover-command-btn cover-command-btn--link"
          data-router-link
          aria-label="Go to TagExplorer home"
        >
          <span aria-hidden="true">⌂</span>
          <span class="cover-command-label">Home</span>
        </a>
        <button
          id="cover-filters-btn"
          class="cover-command-btn"
          type="button"
          aria-haspopup="true"
          aria-expanded="false"
          aria-controls="tag-filter-popover"
        >
          <span aria-hidden="true">⛓</span>
          <span class="cover-command-label">Filters</span>
        </button>
        <button
          id="cover-settings-btn"
          class="cover-command-btn"
          type="button"
          aria-haspopup="true"
          aria-expanded="false"
          aria-controls="cover-settings-sheet"
        >
          <span aria-hidden="true">⚙</span>
          <span class="cover-command-label">Settings</span>
        </button>
        <button
          id="cover-mute-btn"
          class="cover-command-btn cover-mute-toggle"
          type="button"
          aria-pressed="false"
        >
          <span aria-hidden="true">🔇</span>
          <span class="cover-command-label">Mute</span>
        </button>
        <button
          id="cover-motion-btn"
          class="cover-command-btn motion-toggle"
          type="button"
          aria-pressed="false"
        >
          <span aria-hidden="true">⌁</span>
          <span class="cover-command-label">Motion</span>
        </button>
      </nav>
    </div>
  </div>
`;

class CommandBarElement extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    const content = template.content.cloneNode(true);
    this.appendChild(content);
  }
}

if (!customElements.get('te-command-bar')) {
  customElements.define('te-command-bar', CommandBarElement);
}
