import { initAudio, initAudioUI } from '../../modules/audio.js';

export default {
  name: 'AudioSection',
  mounted() {
    initAudio();
    initAudioUI();
  },
  template: `
    <section id="audio-section" aria-label="Audio controls">
      <div id="audio-panel" class="audio-panel hidden" role="region" aria-label="Hypnosis audio player">
        <div class="audio-header">
          <span aria-label="Audio indicator">🎧</span>
          <span id="audio-track-name">No track playing</span>
        </div>
        <div class="audio-controls" role="group" aria-label="Audio playback controls">
          <button id="audio-prev" class="browse-btn" aria-label="Previous track">⏮️</button>
          <button id="audio-toggle" class="browse-btn" aria-label="Play/pause">⏯️</button>
          <button id="audio-next" class="browse-btn" aria-label="Next track">⏭️</button>
          <button id="moan-mute" class="browse-btn" aria-label="Toggle moan sound">🔇 Moan</button>
        </div>
      </div>

      <!-- Audio elements -->
      <audio id="moan-audio" preload="auto" aria-label="Moan sound effects">
        <source src="moan.mp3" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>

      <audio id="hypnoAudio" preload="auto" aria-label="Hypnosis audio tracks">
        Your browser does not support the audio element.
      </audio>
    </section>
  `
};
