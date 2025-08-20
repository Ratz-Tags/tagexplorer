import { initSidebar } from '../../modules/sidebar.js';

export default {
  name: 'Sidebar',
  mounted() {
    initSidebar();
  },
  template: `
    <aside id="copied-sidebar" class="sidebar-hidden" aria-label="Copied artists sidebar"></aside>
  `
};
