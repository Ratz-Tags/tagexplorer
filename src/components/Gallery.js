import { inject } from 'vue';

export default {
  name: 'Gallery',
  setup() {
    const state = inject('state');
    const filteredArtists = inject('filteredArtists');

    function copyArtist(name) {
      const pretty = name.replace(/_/g, ' ');
      navigator.clipboard.writeText(pretty);
      if (!state.copiedArtists.includes(pretty)) {
        state.copiedArtists.push(pretty);
      }
    }

    return { filteredArtists, copyArtist };
  },
  template: `
    <section id="artist-gallery" aria-label="Artist gallery" role="region">
      <h2 class="visually-hidden">Artists</h2>
      <div v-for="artist in filteredArtists" :key="artist.artistName" class="artist-card">
        <button class="artist-copy" @click="copyArtist(artist.artistName)">
          {{ artist.artistName.replace(/_/g, ' ') }}
        </button>
      </div>
    </section>
  `,
};

