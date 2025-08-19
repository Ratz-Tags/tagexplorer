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
import { getFilteredCounts } from "../../modules/tag-explorer.js";

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

// Hand-picked tag categories
const tagCategories = {
  Bondage: [
    "bdsm",
    "bondage",
    "shibari",
    "restraints",
    "restrained",
    "hogtie",
    "leash",
    "spreader_bar",
    "chastity_cage",
    "chastity_cage_emission",
    "flat_chastity_cage",
    "holding_key",
    "immobilization",
  ],
  Feminization: [
    "feminization",
    "forced_feminization",
    "bimbofication",
    "crossdressing",
    "crossdressing_(mtf)",
    "trap",
  ],
  Penetration: [
    "anal_fingering",
    "anal_fisting",
    "anal_object_insertion",
    "object_insertion",
    "object_insertion_from_behind",
    "urethral_insertion",
    "prostate_milking",
    "pegging",
    "male_penetrated",
    "dildo_riding",
    "strap-on",
    "large_insertion",
    "huge_dildo",
    "sounding",
    "knotting",
    "tentacle_sex",
    "tentacle_pit",
  ],
  Oral: [
    "oral",
    "fellatio",
    "irrumatio",
    "cum_in_mouth",
    "gokkun",
    "swallowing",
    "drinking_from_condom",
    "pouring_from_condom",
    "precum",
    "cum",
    "cumdump",
    "pussy_juice",
    "ejaculating_while_penetrated",
    "handsfree_ejaculation",
    "penis_milking",
    "hand_milking",
    "milking_machine",
    "lactation",
  ],
  Control: [
    "hypnosis",
    "mind_break",
    "mind_control",
    "orgasm_denial",
    "dominatrix",
    "assertive_female",
    "sadism",
    "pet_play",
    "sex_machine",
  ],
  Humiliation: [
    "humiliation",
    "small_penis",
    "small_penis_humiliation",
    "public_nudity",
    "body_writing",
    "assisted_exposure",
    "bullying",
    "annoyed",
    "cheating_(relationship)",
  ],
  Feet: ["foot_worship", "sockjob", "toe_sucking"],
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
    const collapsed = ref(true);
    const selectedCategory = ref("All");

    const tagToCategory = computed(() => {
      const mapping = {};
      Object.entries(tagCategories).forEach(([cat, tags]) => {
        tags.forEach((t) => (mapping[t] = cat));
      });
      props.tags.forEach((t) => {
        if (!mapping[t]) mapping[t] = "Other";
      });
      return mapping;
    });

    const categories = computed(() => [
      "All",
      ...new Set(Object.values(tagToCategory.value)),
    ]);

    const tagCounts = computed(() => getFilteredCounts(activeTags.value));

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
      const counts = tagCounts.value;
      const mapping = tagToCategory.value;
      return props.tags
        .filter((tag) => {
          const cat = mapping[tag] || "Other";
          if (
            selectedCategory.value !== "All" &&
            cat !== selectedCategory.value
          )
            return false;
          if (!counts[tag] && !activeTags.value.has(tag)) return false;
          if (!filter) return true;
          const t = tag.toLowerCase();
          if (tagSearchMode === "starts") return t.startsWith(filter);
          if (tagSearchMode === "ends") return t.endsWith(filter);
          return t.includes(filter);
        })
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    });

    const showClear = computed(() => activeTags.value.size > 0);

    function toggleCollapse() {
      collapsed.value = !collapsed.value;
    }

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
      categories,
      selectedCategory,
      collapsed,
      toggleCollapse,
    };
  },
  template: `
    <nav class="filter-bar" :class="{ collapsed }" role="navigation" aria-label="Tag filters">
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

        <label for="category-select" class="visually-hidden">Tag category</label>
        <select id="category-select" v-model="selectedCategory">
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>

        <button class="filter-toggle" @click="toggleCollapse" :aria-expanded="!collapsed">
          {{ collapsed ? 'Show Tags' : 'Hide Tags' }}
        </button>
      </div>

      <div id="tag-filter" v-show="!collapsed">
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

