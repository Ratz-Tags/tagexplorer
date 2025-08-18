import { initGallery } from '../../modules/gallery.js';

export default {
  name: 'Gallery',
  mounted() {
    initGallery();
  },
  template: `
    <main role="main" class="container">
      <!-- Filter results summary -->
      <section id="filtered-results" aria-live="polite" aria-label="Search results summary"></section>

      <!-- Artist gallery -->
      <section id="artist-gallery" aria-label="Artist gallery" role="region">
        <h2 class="visually-hidden">Artists</h2>
      </section>
    </main>
  `
};
