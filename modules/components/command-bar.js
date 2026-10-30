const template = document.createElement('template');
template.innerHTML = `
  <div class="command-bar-shell" role="presentation">
    <div class="command-bar-safe-area command-bar-safe-area--top" data-region="inner">
      <nav
        id="tag-explorer-bar"
        class="command-bar command-bar--inner toolbar"
        role="toolbar"
        aria-label="Gallery controls"
      >
        <div class="toolbar__group" role="group" aria-label="Browse">
          <button
            id="filters-btn"
            class="control-btn toolbar__btn toolbar__btn--primary"
            type="button"
            aria-haspopup="true"
            aria-expanded="false"
            aria-controls="tag-filter-popover"
            title="Filters (F)"
          >
            <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z"/></svg><span>Filters</span>
          </button>
          <button
            id="favorites-btn"
            class="control-btn toolbar__btn saved-toggle"
            type="button"
            aria-haspopup="dialog"
            title="Favorites and lists"
          >
            <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/></svg><span id="favorites-label">Saved</span>
            <span id="favorites-count" class="favorites-count hidden"></span>
          </button>
          <button class="control-btn toolbar__btn sidebar-toggle" type="button" title="Artists you copied">
            <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z"/><path d="M12 14v6"/></svg><span>Pinned</span>
          </button>
        </div>
        <div class="toolbar__group toolbar__group--end" role="group" aria-label="Settings">
          <button class="control-btn toolbar__btn toolbar__btn--icon mute-toggle" type="button" aria-pressed="false" aria-label="Mute (M)" title="Mute (M)">
            <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="m17 9 4 6M21 9l-4 6"/></svg><span class="sr-only" data-label>Mute</span>
          </button>
          <button class="control-btn toolbar__btn more-toggle" type="button" data-more-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="more-menu">
            <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>More</span>
          </button>
        </div>
        <span class="sr-only" id="command-deck-announcement" aria-live="polite"></span>
      </nav>
    </div>
    <div id="more-menu" class="more-menu" role="menu" aria-label="More tools" hidden>
      <button
        id="dossier-btn"
        class="more-menu__item dossier-toggle"
        type="button"
        role="menuitem"
        aria-haspopup="dialog"
        aria-controls="shame-dossier-overlay"
      >
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg><span>Dossier</span><small>Activity log</small>
      </button>
      <button class="more-menu__item audio-toggle" type="button" role="menuitem">
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg><span>Audio &amp; ambience</span><small>Music, whispers, indulgence</small>
      </button>
      <button class="more-menu__item theme-toggle" type="button" role="menuitem">
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Glow theme</span><small>Switch color theme</small>
      </button>
      <button class="more-menu__item motion-toggle" type="button" role="menuitemcheckbox" aria-pressed="false">
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg><span data-label>Motion</span><small>Reduce animations</small>
      </button>
      <button
        id="streak-chip"
        class="more-menu__item streak-chip"
        type="button"
        role="menuitemcheckbox"
        aria-pressed="true"
        aria-describedby="streak-announcement"
        aria-label="Disable streak tracking"
      >
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 0-3-.5-5.5.5-8Z"/></svg>
        <span class="streak-chip__label"><span class="streak-chip__value" data-streak-count>0</span> <span class="streak-chip__suffix" data-streak-label>DAY STREAK</span></span>
        <small class="streak-chip__tier" data-streak-tier>—</small>
      </button>
      <span class="sr-only" id="streak-announcement" data-streak-announcer aria-live="polite"></span>
      <div class="more-menu__divider" role="separator"></div>
      <button id="prompter-toggle-btn" class="more-menu__item" type="button" role="menuitem" aria-label="Toggle NovelAI Prompt Generator">
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/></svg><span>Prompt generator</span><small>NovelAI prompts from artists</small>
      </button>
      <button id="force-fetch-btn" class="more-menu__item" type="button" role="menuitem" aria-label="Force fetch style tags">
        <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.6L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.6L20 16"/><path d="M20 20v-4h-4"/></svg><span>Fetch style tags</span><small>For "Similar → Style" (slow)</small>
      </button>
    </div>
    <div class="command-bar-safe-area command-bar-safe-area--bottom" data-region="cover">
      <nav class="cover-command-bar bottom-nav" role="navigation" aria-label="Quick controls">
        <a href="../" class="cover-command-btn bottom-nav__btn" data-router-link aria-label="Go to TagExplorer home">
          <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z"/></svg><span class="cover-command-label">Home</span>
        </a>
        <button
          id="cover-filters-btn"
          class="cover-command-btn bottom-nav__btn bottom-nav__btn--primary"
          type="button"
          aria-haspopup="true"
          aria-expanded="false"
          aria-controls="tag-filter-popover"
        >
          <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z"/></svg><span class="cover-command-label">Filters</span>
        </button>
        <button id="cover-saved-btn" class="cover-command-btn bottom-nav__btn saved-toggle" type="button" aria-haspopup="dialog">
          <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/></svg><span class="cover-command-label">Saved</span>
        </button>
        <button id="cover-mute-btn" class="cover-command-btn bottom-nav__btn mute-toggle" type="button" aria-pressed="false">
          <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="m17 9 4 6M21 9l-4 6"/></svg><span class="cover-command-label" data-label>Mute</span>
        </button>
        <button class="cover-command-btn bottom-nav__btn more-toggle" type="button" data-more-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="more-menu">
          <svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span class="cover-command-label">More</span>
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
