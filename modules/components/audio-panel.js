const template = document.createElement('template');
template.innerHTML = `
  <section id="audio-section" aria-label="Audio controls">
    <div id="audio-panel" class="audio-panel hidden" role="region" aria-label="Hypnosis audio player">
      <div class="audio-header">
        <span aria-hidden="true">🎧</span>
        <span id="audio-track-name">No track playing</span>
      </div>
      <div class="audio-track-selector" role="group" aria-label="Track selection">
        <label class="field-label" for="audio-track-select">Select track</label>
        <select id="audio-track-select" class="voice-style-select" aria-label="Choose audio track">
          <option value="">Loading tracks...</option>
        </select>
      </div>
      <div class="audio-controls" role="group" aria-label="Audio playback controls">
        <button id="audio-prev" type="button" aria-label="Previous track">⏮</button>
        <button id="audio-toggle" type="button" aria-label="Play or pause">▶</button>
        <button id="audio-next" type="button" aria-label="Next track">⏭</button>
        <button id="moan-mute" type="button" aria-label="Toggle moan sound">🔇 Moan</button>
      </div>
    </div>
    <audio id="moan-audio" preload="auto" aria-label="Moan sound effects">
      <source src="moan.mp3" type="audio/mpeg">
    </audio>
    <audio
      id="hypnoAudio"
      preload="auto"
      aria-label="Hypnosis audio tracks"
    ></audio>
  </section>
`;

class AudioPanelElement extends HTMLElement {
  connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    const clone = template.content.cloneNode(true);
    const srcPrefix = this.getAttribute('data-src-prefix') || '';
    const moan = clone.querySelector('#moan-audio source');
    if (moan && srcPrefix) {
      moan.setAttribute('src', `${srcPrefix}moan.mp3`);
    }
    this.appendChild(clone);
  }
}

if (!customElements.get('te-audio-panel')) {
  customElements.define('te-audio-panel', AudioPanelElement);
}
