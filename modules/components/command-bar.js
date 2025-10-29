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
            id="dossier-btn"
            class="control-btn command-btn dossier-toggle"
            type="button"
            aria-haspopup="dialog"
            aria-controls="shame-dossier-overlay"
            aria-label="Open shame dossier overlay"
          >
            DOSSIER
          </button>
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
        <!-- Command deck buttons removed - they were confusing -->
        <div class="command-streak" role="group" aria-label="Return streak tracker">
          <button
            id="streak-chip"
            class="control-btn command-btn streak-chip"
            type="button"
            aria-pressed="true"
            aria-describedby="streak-announcement"
            aria-label="Disable streak tracking"
          >
            <span class="streak-chip__halo" aria-hidden="true"></span>
            <span class="streak-chip__core" aria-hidden="true"></span>
            <span class="streak-chip__label" aria-hidden="true">
              <span class="streak-chip__value" data-streak-count>0</span>
              <span class="streak-chip__suffix" data-streak-label>DAY STREAK</span>
              <span class="streak-chip__tier" data-streak-tier>—</span>
            </span>
          </button>
          <span class="sr-only" id="streak-announcement" data-streak-announcer aria-live="polite"></span>
        </div>
        <div class="command-status" aria-live="polite">
          <span class="command-status__label" data-mode="cover">COVER MODE</span>
          <span class="command-status__label" data-mode="inner">INNER MODE</span>
        </div>
        <span class="sr-only" id="command-deck-announcement" aria-live="polite"></span>
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
          id="cover-dossier-btn"
          class="cover-command-btn dossier-toggle"
          type="button"
          aria-haspopup="dialog"
          aria-controls="shame-dossier-overlay"
          aria-label="Open shame dossier overlay"
        >
          <span aria-hidden="true">🗒</span>
          <span class="cover-command-label">Dossier</span>
        </button>
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
        <div class="cover-command-deck" role="group" aria-label="Command deck controls">
          <button
            id="cover-command-kneel"
            class="cover-command-btn cover-command-deck__btn cover-command-deck__btn--kneel"
            type="button"
            data-command-action="kneel"
            data-haptic="command"
            aria-pressed="false"
            aria-describedby="cover-command-kneel-desc"
            aria-label="Kneel preset. Adds leash and restraint tags to the gallery filters."
          >
            <span class="cover-command-deck__glyph" aria-hidden="true">⟟</span>
            <span class="cover-command-label">Kneel</span>
            <span id="cover-command-kneel-desc" class="sr-only">
              Queue leash, restraint, and viewer-on-leash tags while intensifying the glow.
            </span>
          </button>
          <button
            id="cover-command-confess"
            class="cover-command-btn cover-command-deck__btn cover-command-deck__btn--confess"
            type="button"
            data-command-action="confess"
            data-haptic="command"
            aria-pressed="false"
            aria-describedby="cover-command-confess-desc"
            aria-label="Confess preset. Pushes humiliation and public exposure filters."
          >
            <span class="cover-command-deck__glyph" aria-hidden="true">✧</span>
            <span class="cover-command-label">Confess</span>
            <span id="cover-command-confess-desc" class="sr-only">
              Layer humiliation, public nudity, and body writing to broadcast every secret.
            </span>
          </button>
          <button
            id="cover-command-siren"
            class="cover-command-btn cover-command-deck__btn cover-command-deck__btn--siren"
            type="button"
            data-command-action="siren"
            data-haptic="command"
            aria-pressed="false"
            aria-describedby="cover-command-siren-desc"
            aria-label="Siren preset. Floods trance and denial tags while spiking the ambience."
          >
            <span class="cover-command-deck__glyph" aria-hidden="true">⚠</span>
            <span class="cover-command-label">Siren</span>
            <span id="cover-command-siren-desc" class="sr-only">
              Engage emergency trance: hypnosis, mind break, and denial tags plus alarmed lighting.
            </span>
          </button>
          <button
            id="cover-command-escape"
            class="cover-command-btn cover-command-deck__btn cover-command-deck__btn--escape"
            type="button"
            data-command-action="escape"
            data-haptic="command"
            aria-pressed="false"
            aria-describedby="cover-command-escape-desc"
            aria-label="Escape preset. Clears command filters and calms the ambience."
          >
            <span class="cover-command-deck__glyph" aria-hidden="true">⎋</span>
            <span class="cover-command-label">Escape</span>
            <span id="cover-command-escape-desc" class="sr-only">
              Release the deck influence, restore your saved tags, and drop the indulgence to zero.
            </span>
          </button>
        </div>
        <button
          id="cover-streak-btn"
          class="cover-command-btn cover-streak-btn"
          type="button"
          aria-pressed="true"
          aria-describedby="cover-streak-announcement"
        >
          <span class="cover-streak-orb" aria-hidden="true"></span>
          <span class="cover-streak-count" data-streak-count>0</span>
          <span class="cover-command-label">Streak</span>
        </button>
        <span
          class="sr-only"
          id="cover-streak-announcement"
          data-streak-announcer
          aria-live="polite"
        ></span>
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
