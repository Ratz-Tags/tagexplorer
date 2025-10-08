const template = document.createElement('template');
template.innerHTML = `
  <div class="command-bar-shell" role="presentation">
    <nav id="tag-explorer-bar" class="command-bar" role="toolbar" aria-label="Pinned humiliation controls">
      <div class="command-group" role="group" aria-label="Primary gallery controls">
        <button class="control-btn command-btn sidebar-toggle" type="button">PINNED</button>
        <button class="control-btn command-btn audio-toggle" type="button">AUDIO</button>
        <button class="control-btn command-btn theme-toggle" type="button">GLOW</button>
        <button id="filters-btn" class="control-btn command-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="tag-filter-panel">FILTER</button>
        <button id="favorites-btn" class="control-btn command-btn" type="button" aria-label="Show favorite artists">
          <span id="favorites-label">⭐ FAVS</span>
          <span id="favorites-count" class="favorites-count hidden"></span>
        </button>
        <button id="force-fetch-btn" class="control-btn command-btn" type="button" aria-label="Force fetch style tags">FETCH</button>
      </div>
      <div class="command-status">
        <span class="hidden fold-cover:inline">COVER MODE</span>
        <span class="hidden fold-inner:inline">INNER MODE</span>
      </div>
    </nav>
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
