import {
  activeTags,
  searchFilter,
  artistNameFilter,
  tagTooltips,
  tagTaunts,
  taunts,
  toggleTag,
  clearAllTags,
  tagSearchMode,
} from "../../modules/tags.js";

const { ref, computed } = Vue;

const tagIcons = {
  pegging: "icons/pegging.svg",
  chastity_cage: "icons/chastity_cage.svg",
  feminization: "icons/feminization.svg",
  bimbofication: "icons/bimbofication.svg",
  gagged: "icons/gagged.png",
  tentacle_sex: "icons/tentacle_sex.png",
  bukkake: "icons/bukkake.png",
  footjob: "icons/footjob.png",
  anal: "icons/anal.png",
  mind_break: "icons/mind_break.png",
  hypnosis: "icons/hypnosis.png",
  inflation: "icons/inflation.png",
  pregnant: "icons/pregnant.png",
};

export default {
  name: "TagFilter",
  props: {
    tags: {
      type: Array,
      default: () => [],
    },
  },
  setup(props) {
    const bubbles = ref([]);

    function spawnBubble(tag) {
      const pool = tagTaunts[tag] || taunts;
      const line =
        pool[Math.floor(Math.random() * pool.length)] ||
        `Still chasing '${tag}' huh? You're beyond help.`;
      const id = Date.now() + Math.random();
      bubbles.value.push({ id, line });
      setTimeout(() => {
        bubbles.value = bubbles.value.filter((b) => b.id !== id);
      }, 5000);
    }

    function handleToggle(tag) {
      const wasActive = activeTags.value.has(tag);
      toggleTag(tag);
      if (!wasActive) spawnBubble(tag);
    }

    const filteredTags = computed(() => {
      const filter = searchFilter.value.trim().toLowerCase();
      return props.tags
        .filter((tag) => {
          if (!filter) return true;
          const t = tag.toLowerCase();
          if (tagSearchMode === "starts") return t.startsWith(filter);
          if (tagSearchMode === "ends") return t.endsWith(filter);
          return t.includes(filter);
        })
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    });

    const showClear = computed(() => activeTags.value.size > 0);

    return {
      activeTags,
      searchFilter,
      artistNameFilter,
      handleToggle,
      clearAllTags,
      filteredTags,
      tagTooltips,
      tagIcons,
      bubbles,
      showClear,
    };
  },
  template: `
    <nav class="filter-bar" role="navigation" aria-label="Tag filters">
      <div id="tag-filter">
        <div class="filter-inputs">
          <label for="tag-search" class="visually-hidden">Filter tags</label>
          <input
            type="text"
            id="tag-search"
            placeholder="Type to filter tags..."
            v-model="searchFilter"
            aria-describedby="tag-search-help"
          />

          <label for="artist-name-filter" class="visually-hidden">Filter by artist name</label>
          <input
            type="text"
            id="artist-name-filter"
            placeholder="Filter by artist name..."
            v-model="artistNameFilter"
            aria-describedby="artist-filter-help"
          />
        </div>

        <div id="tag-buttons" role="group" aria-label="Available tags">
          <button
            v-for="tag in filteredTags"
            :key="tag"
            class="tag-button"
            :class="{ active: activeTags.has(tag) }"
            type="button"
            :title="tagTooltips[tag] || ''"
            @click="handleToggle(tag)"
          >
            <img
              v-if="tagIcons[tag]"
              :src="tagIcons[tag]"
              style="height:16px;margin-right:4px;"
            />
            {{ tag.replaceAll('_', ' ') }}
          </button>
        </div>

        <button
          id="clear-tags"
          v-if="showClear"
          @click="clearAllTags"
          aria-label="Clear all selected tags"
        >
          Clear All
        </button>

        <div id="tag-search-help" class="visually-hidden">
          Type to search and filter available tags
        </div>
        <div id="artist-filter-help" class="visually-hidden">
          Type to filter artists by name
        </div>
      </div>

      <div id="jrpg-bubbles" aria-live="polite" aria-label="Tag notifications">
        <div v-for="b in bubbles" :key="b.id" class="jrpg-bubble">
          <img src="icons/chibi.png" class="chibi" />
          <span>{{ b.line }}</span>
        </div>
      </div>
    </nav>
  `,
};

