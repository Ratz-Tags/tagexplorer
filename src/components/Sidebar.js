import { initSidebar } from '../../modules/sidebar.js';

export default {
  name: 'Sidebar',
  mounted() {
    initSidebar();
  },
  template: `
    <aside class="sidebar-wrapper" aria-label="Copied artists">
      <div id="copied-sidebar" class="sidebar-hidden" role="complementary" aria-label="Artists you've copied">
        <button class="copied-sidebar-close" aria-label="Close sidebar">×</button>
        <h2 class="visually-hidden">Copied Artists</h2>
        <!-- Copied artists will be injected here -->
      </div>
    </aside>
  `
};
