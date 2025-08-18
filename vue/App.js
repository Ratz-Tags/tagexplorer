import Header from './components/Header.js';
import FilterBar from './components/FilterBar.js';
import Gallery from './components/Gallery.js';
import Sidebar from './components/Sidebar.js';
import AudioSection from './components/Audio.js';
import Controls from './components/Controls.js';

export default {
  name: 'RootApp',
  components: {
    Header,
    FilterBar,
    Gallery,
    Sidebar,
    AudioSection,
    Controls
  },
  template: `
    <div id="background-blur" aria-hidden="true"></div>
    <Header />
    <FilterBar />
    <Gallery />
    <Sidebar />
    <div id="jrpg-bubbles" aria-live="polite" aria-label="Tag notifications"></div>
    <AudioSection />
    <Controls />
  `
};
