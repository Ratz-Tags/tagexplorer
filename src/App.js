import Header from './components/Header.js';
import TagFilter from './components/TagFilter.js';
import Gallery from './components/Gallery.js';
import Sidebar from './components/Sidebar.js';
import AudioSection from './components/Audio.js';
import Controls from './components/Controls.js';

export default {
  name: 'RootApp',
  components: {
    Header,
    TagFilter,
    Gallery,
    Sidebar,
    AudioSection,
    Controls
  },
  setup() {
    const { ref, onMounted } = Vue;
    const kinkTags = ref([]);
    onMounted(async () => {
      try {
        const res = await fetch('kink-tags.json');
        const data = await res.json();
        kinkTags.value = Array.isArray(data) ? data : [];
      } catch {
        kinkTags.value = [];
      }
    });
    return { kinkTags };
  },
  template: `
    <div id="background-blur" aria-hidden="true"></div>
    <Header />
    <TagFilter :tags="kinkTags" />
    <Gallery />
    <Sidebar />
    <AudioSection />
    <Controls />
  `
};
