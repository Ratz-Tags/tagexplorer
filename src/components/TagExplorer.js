import { ref, computed, inject } from 'vue';

export default {
  name: 'TagExplorer',
  setup() {
    const state = inject('state');
    const tagCounts = inject('tagCounts');
    const tagSearch = ref('');

    const filteredTags = computed(() => {
      const search = tagSearch.value.toLowerCase();
      return state.tags.filter((t) => {
        const label = t.replace(/_/g, ' ').toLowerCase();
        const count = tagCounts.value[t] || 0;
        if (search && !label.includes(search)) return false;
        return count > 0 || state.activeTags.has(t);
      });
    });

    function toggleTag(tag) {
      if (state.activeTags.has(tag)) state.activeTags.delete(tag);
      else state.activeTags.add(tag);
    }

    function clearTags() {
      state.activeTags.clear();
    }

    return { state, tagSearch, filteredTags, tagCounts, toggleTag, clearTags };
  },
  template: `
    <nav :class="['filter-bar', state.filtersVisible ? '' : 'collapsed']" role="navigation" aria-label="Tag filters">
      <div id="tag-filter">
        <div class="filter-inputs">
          <label for="tag-search" class="visually-hidden">Filter tags</label>
          <input type="text" id="tag-search" v-model="tagSearch" placeholder="Type to filter tags..." aria-describedby="tag-search-help" />
          <label for="artist-name-filter" class="visually-hidden">Filter by artist name</label>
          <input type="text" id="artist-name-filter" v-model="state.artistNameFilter" placeholder="Filter by artist name..." aria-describedby="artist-filter-help" />
        </div>
        <div id="tag-buttons" role="group" aria-label="Available tags">
          <button v-for="tag in filteredTags" :key="tag" class="tag-button" :class="{ active: state.activeTags.has(tag) }" @click="toggleTag(tag)">
            {{ tag.replace(/_/g, ' ') }} ({{ tagCounts[tag] || 0 }})
          </button>
        </div>
        <button id="clear-tags" v-show="state.activeTags.size" @click="clearTags" aria-label="Clear all selected tags">Clear All</button>
        <div id="tag-search-help" class="visually-hidden">
          Type to search and filter available tags
        </div>
        <div id="artist-filter-help" class="visually-hidden">
          Type to filter artists by name
        </div>
      </div>
    </nav>
  `,
};

