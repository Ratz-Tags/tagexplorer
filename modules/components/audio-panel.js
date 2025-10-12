const template = document.createElement('template');
template.innerHTML = `
  <section id="audio-section" aria-label="Audio controls">
    <div id="audio-panel" class="audio-panel hidden" role="region" aria-label="Hypnosis audio player">
      <div class="audio-header">
        <span aria-hidden="true">🎧</span>
        <span id="audio-track-name">No track playing</span>
      </div>
      <div class="audio-playlist-selector" role="group" aria-label="Ambience playlist">
        <label class="field-label" for="audio-playlist-select">Ambience</label>
        <select id="audio-playlist-select" class="voice-style-select" aria-label="Choose ambience playlist">
          <option value="__auto__">Auto (tags & intensity)</option>
        </select>
        <div class="audio-toggle-row">
          <button id="playlist-autopilot" type="button" class="audio-pill" aria-pressed="true">Auto-match</button>
          <button id="audio-intensity-sync" type="button" class="audio-pill" aria-pressed="true">Sync intensity</button>
        </div>
      </div>
      <div class="audio-indulgence" role="group" aria-label="Indulgence ASMR layers">
        <div class="indulgence-label-row">
          <label class="field-label" for="indulgence-slider">Indulgence</label>
          <output id="indulgence-caption" class="indulgence-caption" aria-live="polite">Muted. Layers asleep.</output>
        </div>
        <div class="indulgence-scale" aria-hidden="true">
          <span>Off</span>
          <span>Curious</span>
          <span>Needy</span>
          <span>Desperate</span>
        </div>
        <input
          type="range"
          id="indulgence-slider"
          class="indulgence-slider"
          min="0"
          max="3"
          step="1"
          value="0"
          aria-valuemin="0"
          aria-valuemax="3"
          aria-valuenow="0"
          aria-label="Indulgence intensity"
          aria-describedby="indulgence-announcement"
        />
        <p id="indulgence-announcement" class="sr-only" aria-live="assertive"></p>
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
      </div>
    </div>
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
    this.appendChild(clone);
  }
}

if (!customElements.get('te-audio-panel')) {
  customElements.define('te-audio-panel', AudioPanelElement);
}
