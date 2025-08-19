import {
  setSortMode,
  forceSortAndRender,
  setSortPreference,
} from '../../modules/gallery.js';

export default {
  name: 'Header',
  setup() {
    const { ref } = Vue;
    const sortPreference = ref('name');

    function handleSort() {
      if (
        sortPreference.value === 'top' &&
        window.kexplorer?.showTopArtistsByTagCount
      ) {
        window.kexplorer.showTopArtistsByTagCount();
      } else {
        setSortMode(sortPreference.value);
        forceSortAndRender();
      }
    }

    function updatePreference(event) {
      sortPreference.value = event.target.value;
      setSortPreference(sortPreference.value);
    }

    return {
      sortPreference,
      handleSort,
      updatePreference,
    };
  },
  template: `
    <header role="banner">
      <div class="container">
        <div class="top-bar">
          <h1 class="brand">Artist Explorer</h1>
          <div class="brand-sissy">✧ Welcome cutie. ✧<br>Obey, drool, and discover your next obsession~</div>
          <span class="tagline" id="tagline">Pathetic..~</span>
          <div class="sort-controls">
            <select id="sort-preference" class="fem-select" v-model="sortPreference" @change="updatePreference">
              <option value="name">Sort: Name (A-Z)</option>
              <option value="count">Sort: Tag Count</option>
              <option value="top">Top Artists (by tag count)</option>
            </select>
            <button id="sort-button" class="fem-btn" @click="handleSort">Sort</button>
            <!-- Only one Top Artists button, handled by JS -->
          </div>
          <div class="top-actions"></div>
        </div>
      </div>
    </header>
  `,
};