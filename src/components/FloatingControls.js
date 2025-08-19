import { inject } from 'vue';

export default {
  name: 'FloatingControls',
  setup() {
    const state = inject('state');

    function toggleSidebar() {
      state.isSidebarVisible = !state.isSidebarVisible;
    }

    function toggleAudio() {
      state.isAudioVisible = !state.isAudioVisible;
    }

    function backToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return { toggleSidebar, toggleAudio, backToTop };
  },
  template: `
    <nav class="floating-controls" aria-label="Quick access controls">
      <div class="toggle-buttons-container">
        <button class="sidebar-toggle" aria-label="Show copied artists sidebar" @click="toggleSidebar">🎀</button>
        <button class="audio-toggle" aria-label="Show audio panel" @click="toggleAudio">🎶</button>
        <button class="theme-toggle" aria-label="Toggle theme">🌓</button>
      </div>
      <button id="back-to-top" title="Back to top" aria-label="Scroll to top" @click="backToTop">
        <span aria-hidden="true">↑</span>
        <span class="control-label">Top</span>
      </button>
    </nav>
  `,
};

