import { preloadDataset } from '../api.js';
import type { PageInitializer, PageLifecycle } from '../types.js';

export async function initDataPage(): Promise<PageLifecycle | void> {
  const links = document.querySelectorAll<HTMLElement>('[data-preload]');
  links.forEach((link) => {
    link.addEventListener(
      'mouseenter',
      () => {
        const key = link.dataset.preload;
        if (key) {
          preloadDataset(key);
        }
      },
      { once: true },
    );
  });
  return {};
}

export const initPage: PageInitializer = initDataPage;
