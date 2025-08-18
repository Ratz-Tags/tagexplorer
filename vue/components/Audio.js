import { initAudio, initAudioUI } from '../../modules/audio.js';

export default {
  name: 'AudioPlayer',
  mounted() {
    initAudio();
    initAudioUI();
  },
  render() {
    return null;
  }
};
