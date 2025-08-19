export default {
  name: 'Controls',
  template: `
    <nav class="floating-controls" aria-label="Quick access controls">
      <div class="toggle-buttons-container">
        <button class="sidebar-toggle" aria-label="Show copied artists sidebar">🎀</button>
        <button class="audio-toggle" aria-label="Show audio panel">🎶</button>
        <button class="theme-toggle" aria-label="Toggle theme">🌓</button>
      </div>

      <button id="back-to-top" title="Back to top" aria-label="Scroll to top">
        <span aria-hidden="true">↑</span>
        <span class="control-label">Top</span>
      </button>
    </nav>
  `
};
