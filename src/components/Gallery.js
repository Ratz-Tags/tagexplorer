import { initGallery } from '../../modules/gallery.js';

export default {
  name: 'Gallery',
  mounted() {
    initGallery();
  },
  render() {
    return null;
  }
};
