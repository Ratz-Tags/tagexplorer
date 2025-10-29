import { preloadDataset } from '../api.js';
export async function initDataPage() {
    const links = document.querySelectorAll('[data-preload]');
    links.forEach((link) => {
        link.addEventListener('mouseenter', () => {
            const key = link.dataset.preload;
            if (key) {
                preloadDataset(key);
            }
        }, { once: true });
    });
    return {};
}
export const initPage = initDataPage;
