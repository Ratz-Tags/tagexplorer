import TagExplorer from './TagExplorer.js';
import { inject, ref } from 'vue';

export default {
  name: 'HeaderBar',
  components: { TagExplorer },
  setup() {
    const state = inject('state');
    const sortSelection = ref(state.sortPreference);

    function applySort() {
      state.sortPreference = sortSelection.value;
    }

    function toggleFilters() {
      state.filtersVisible = !state.filtersVisible;
    }

    return { state, sortSelection, applySort, toggleFilters };
  },
  template: `
    <header role="banner">
      <div class="container">
        <div class="top-bar">
          <h1 class="brand">Artist Explorer</h1>
          <div class="brand-sissy">✧ Welcome cutie. ✧<br>Obey, drool, and discover your next obsession~</div>
          <span class="tagline" id="tagline">Pathetic..~</span>
          <div class="sort-controls">
            <select id="sort-preference" v-model="sortSelection">
              <option value="name">Sort: Name (A-Z)</option>
              <option value="count">Sort: Tag Count</option>
              <option value="top">Top Artists (by tag count)</option>
            </select>
            <button id="sort-button" @click="applySort">Sort</button>
            <button id="toggle-filters" type="button" class="browse-btn" :aria-expanded="state.filtersVisible.toString()" @click="toggleFilters">Browse Tags</button>
          </div>
          <div class="top-actions"></div>
        </div>
        <TagExplorer/>
      </div>
    </header>
  `
};
