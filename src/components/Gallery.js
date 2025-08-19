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
    // Add a reactive error message property
    state.copyError = '';

    async function copyArtist(name) {
      const pretty = name.replace(/_/g, ' ');
      try {
        await navigator.clipboard.writeText(pretty);
        if (!state.copiedArtists.includes(pretty)) {
          state.copiedArtists.push(pretty);
        }
        state.copyError = ''; // Clear any previous error
      } catch (err) {
        state.copyError = 'Failed to copy artist name. Please check your browser permissions.';
      }
    }

    return { filteredArtists, copyArtist, state };
  },
  template: `
    <section id="artist-gallery" aria-label="Artist gallery" role="region">
      <h2 class="visually-hidden">Artists</h2>
      <div v-if="state.copyError" class="copy-error" style="color: red; margin-bottom: 1em;">
        {{ state.copyError }}
      </div>
      <div v-for="artist in filteredArtists" :key="artist.artistName" class="artist-card">
        <button class="artist-copy" @click="copyArtist(artist.artistName)">
          {{ artist.artistName.replace(/_/g, ' ') }}
        </button>
      </div>
    </section>
  `,
};

