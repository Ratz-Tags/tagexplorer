import { ref, computed, inject, onMounted } from 'vue';

export default {
  name: 'AudioPlayer',
  setup() {
    const state = inject('state');
    const tracks = ref([]);
    const current = ref(0);
    const isPlaying = ref(false);
    const audioEl = ref(null);
    const moanEl = ref(null);
    const moanMuted = ref(true);

    const trackName = computed(() => {
      const t = tracks.value[current.value];
      return t ? t.replace(/\.[^/.]+$/, '') : 'No track playing';
    });

    async function loadTracks() {
      try {
        const resp = await fetch('audio/');
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        tracks.value = [...doc.querySelectorAll('a')]
          .map((a) => a.getAttribute('href'))
          .filter((h) => h && h.endsWith('.mp3'))
          .map((h) => decodeURIComponent(h));
      } catch (e) {
        tracks.value = [];
      }
    }

    function playTrack(index) {
      if (!tracks.value.length) return;
      current.value = index;
      audioEl.value.src = 'audio/' + tracks.value[current.value];
      audioEl.value.play();
      isPlaying.value = true;
      if (!moanMuted.value) moanEl.value.play();
    }

    function togglePlay() {
      if (!tracks.value.length) return;
      if (!isPlaying.value) {
        if (!audioEl.value.src) playTrack(current.value);
        else {
          audioEl.value.play();
          if (!moanMuted.value) moanEl.value.play();
        }
        isPlaying.value = true;
      } else {
        audioEl.value.pause();
        moanEl.value.pause();
        isPlaying.value = false;
      }
    }

    function nextTrack() {
      if (!tracks.value.length) return;
      playTrack((current.value + 1) % tracks.value.length);
    }

    function prevTrack() {
      if (!tracks.value.length) return;
      playTrack((current.value - 1 + tracks.value.length) % tracks.value.length);
    }

    function toggleMoan() {
      moanMuted.value = !moanMuted.value;
      moanEl.value.muted = moanMuted.value;
      if (!moanMuted.value && isPlaying.value) moanEl.value.play();
      if (moanMuted.value) moanEl.value.pause();
    }

    onMounted(() => {
      audioEl.value = document.getElementById('hypnoAudio');
      // Vue will automatically assign the DOM elements to audioEl and moanEl via template refs.
      // Make sure to add ref="audioEl" to <audio id="hypnoAudio"> and ref="moanEl" to <audio id="moan-audio"> in the template.
      loadTracks();
      audioEl.value.addEventListener('ended', nextTrack);
    });

    return {
      state,
      trackName,
      togglePlay,
      nextTrack,
      prevTrack,
      toggleMoan,
    };
  },
  template: `
    <section id="audio-section" aria-label="Audio controls">
      <div id="audio-panel" :class="['audio-panel', state.isAudioVisible ? '' : 'hidden']" role="region" aria-label="Hypnosis audio player">
        <div class="audio-header">
          <span aria-label="Audio indicator">🎧</span>
          <span id="audio-track-name">{{ trackName }}</span>
        </div>
        <div class="audio-controls" role="group" aria-label="Audio playback controls">
          <button id="audio-prev" aria-label="Previous track" @click="prevTrack">⏮️</button>
          <button id="audio-toggle" aria-label="Play/pause" @click="togglePlay">⏯️</button>
          <button id="audio-next" aria-label="Next track" @click="nextTrack">⏭️</button>
          <button id="moan-mute" aria-label="Toggle moan sound" @click="toggleMoan">🔇 Moan</button>
        </div>
      </div>
      <audio id="moan-audio" preload="auto" aria-label="Moan sound effects">
        <source src="moan.mp3" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>
      <audio id="hypnoAudio" preload="auto" aria-label="Hypnosis audio tracks">
        Your browser does not support the audio element.
      </audio>
    </section>
  `,
};

