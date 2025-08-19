import App from './src/App.js';
import { loadAppData } from './modules/api.js';
import { setTagTooltips, setTagTaunts, setTaunts } from './modules/tags.js';
import { setAllArtists as setGalleryArtists, filterArtists } from './modules/gallery.js';
import { setAllArtists as setExplorerArtists } from './modules/tag-explorer.js';
import { setAllArtists as setSidebarArtists } from './modules/sidebar.js';
const { createApp } = Vue;

loadAppData()
  .then(({ artists, tooltips, generalTaunts, tagTaunts }) => {
    setGalleryArtists(artists);
    setExplorerArtists(artists);
    setSidebarArtists(artists);
    setTagTooltips(tooltips);
    setTagTaunts(tagTaunts);
    setTaunts(generalTaunts);
    createApp(App).mount('#app');
    filterArtists();
  })
  .catch(() => {
    createApp(App).mount('#app');
  });
