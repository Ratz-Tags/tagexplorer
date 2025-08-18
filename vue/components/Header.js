export default {
  name: 'Header',
  template: `
    <header role="banner">
      <div class="container">
        <div class="top-bar">
          <h1 class="brand">Artist Explorer</h1>
          <div class="brand-sissy">✧ Welcome cutie. ✧<br>Obey, drool, and discover your next obsession~</div>
          <span class="tagline" id="tagline">Pathetic..~</span>
          <div class="sort-controls">
            <select id="sort-preference">
              <option value="name">Sort: Name (A-Z)</option>
              <option value="count">Sort: Tag Count</option>
              <option value="top">Top Artists (by tag count)</option>
            </select>
            <button id="sort-button">Sort</button>
            <button id="toggle-filters" type="button" class="browse-btn" aria-expanded="false">Browse Tags</button>
            <!-- Only one Top Artists button, handled by JS -->
          </div>
          <div class="top-actions"></div>
        </div>
      </div>
    </header>
  `
};
