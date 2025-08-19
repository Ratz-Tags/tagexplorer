import { inject } from 'vue';

export default {
  name: 'Sidebar',
  setup() {
    const state = inject('state');

    function closeSidebar() {
      state.isSidebarVisible = false;
    }

    return { state, closeSidebar };
  },
  template: `
    <aside class="sidebar-wrapper" aria-label="Copied artists">
      <div id="copied-sidebar" :class="{ 'sidebar-hidden': !state.isSidebarVisible }" role="complementary" aria-label="Artists you've copied">
        <button class="copied-sidebar-close" aria-label="Close sidebar" @click="closeSidebar">×</button>
        <h2 class="visually-hidden">Copied Artists</h2>
        <div v-for="artist in state.copiedArtists" :key="artist" class="copied-artist">{{ artist }}</div>
      </div>
    </aside>
  `,
};

