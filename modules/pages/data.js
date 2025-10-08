import { preloadDataset } from '../api.js';

export async function initDataPage() {
  const links = document.querySelectorAll('[data-preload]');
  links.forEach((link) => {
    link.addEventListener('mouseenter', () => {
      preloadDataset(link.dataset.preload);
    }, { once: true });
  });
  return {};
}

export const initPage = initDataPage;
