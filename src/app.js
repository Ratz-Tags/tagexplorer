import HeaderBar from './components/Header.js';
import Gallery from './components/Gallery.js';
import Sidebar from './components/Sidebar.js';
import AudioPlayer from './components/Audio.js';
import FloatingControls from './components/FloatingControls.js';
import { reactive, computed, provide, onMounted, watch } from 'vue';

export default {
  name: 'KinkExplorerApp',
  components: { HeaderBar, Gallery, Sidebar, AudioPlayer, FloatingControls },
  setup() {
    const state = reactive({
      tags: [],
      artists: [],
      activeTags: new Set(),
      artistNameFilter: '',
      sortPreference: 'name',
      filtersVisible: false,
      isSidebarVisible: false,
      isAudioVisible: false,
      copiedArtists: JSON.parse(localStorage.getItem('copiedArtists') || '[]'),
    });

    const filteredArtists = computed(() => {
      const nameFilter = state.artistNameFilter.toLowerCase();
      let list = state.artists.filter((a) => {
        const tags = Array.isArray(a.kinkTags) ? a.kinkTags : [];
        if (![...state.activeTags].every((t) => tags.includes(t))) return false;
        if (nameFilter && !a.artistName.toLowerCase().includes(nameFilter)) return false;
        return true;
      });
      list = list.sort((a, b) => {
        if (state.sortPreference === 'count') {
          return a.kinkTags.length - b.kinkTags.length;
        }
        if (state.sortPreference === 'top') {
          return b.kinkTags.length - a.kinkTags.length;
        }
        return a.artistName.localeCompare(b.artistName);
      });
      return list;
    });

    const tagCounts = computed(() => {
      const counts = {};
      filteredArtists.value.forEach((a) => {
        (a.kinkTags || []).forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });
      return counts;
    });

    watch(
      () => state.copiedArtists,
      (val) => localStorage.setItem('copiedArtists', JSON.stringify(val)),
      { deep: true }
    );

    onMounted(() => {
      fetch('kink-tags.json')
        .then((r) => r.json())
        .then((tags) => (state.tags = tags));
      fetch('artists.json')
        .then((r) => r.json())
        .then((artists) => (state.artists = artists))
        .catch((error) => {
          console.error('Failed to load artists.json:', error);
          state.artists = [];
        });
    });

    provide('state', state);
    provide('filteredArtists', filteredArtists);
    provide('tagCounts', tagCounts);

    return {};
  },
  template: `
    <div id="background-blur" aria-hidden="true"></div>
    <HeaderBar />
    <main role="main" class="container">
      <section id="filtered-results" aria-live="polite" aria-label="Search results summary"></section>
      <Gallery />
    </main>
    <Sidebar />
    <div id="jrpg-bubbles" aria-live="polite" aria-label="Tag notifications"></div>
    <AudioPlayer />
    <FloatingControls />
  `
};
