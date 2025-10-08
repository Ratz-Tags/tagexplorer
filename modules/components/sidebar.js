const template = document.createElement('template');
template.innerHTML = `
  <aside class="sidebar-wrapper" aria-label="Copied artists">
    <div id="copied-sidebar" class="sidebar-panel sidebar-hidden" role="complementary" aria-label="Pinned artists">
      <div class="sidebar-header">
        <h2 class="text-sm font-display uppercase tracking-[0.4em] text-white">Pinned Artists</h2>
        <button class="copied-sidebar-close" aria-label="Close sidebar">Close</button>
      </div>
      <div class="sidebar-content">
        <div class="sidebar-taunt-banner">No artists copied yet. Too shy to commit?</div>
        <div class="sidebar-sections"></div>
      </div>
    </div>
  </aside>
`;

class PinnedSidebarElement extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.appendChild(template.content.cloneNode(true));
  }
}

if (!customElements.get('te-pinned-sidebar')) {
  customElements.define('te-pinned-sidebar', PinnedSidebarElement);
}
