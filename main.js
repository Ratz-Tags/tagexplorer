import { ensureDefaultWhisperVoice } from './modules/azure-tts.js';
import { mountShell } from './modules/shell.js';
import { initRouter } from './modules/router.js';
import { initFoldAdapter } from './modules/fold-adapter.js';

const PAGE_LAZY_MODULES = {
  landing: () => import('./modules/pages/landing.js'),
  gallery: () => import('./modules/pages/gallery.js'),
  about: () => import('./modules/pages/about.js'),
  artist: () => import('./modules/pages/artist.js'),
  data: () => import('./modules/pages/data.js'),
};

const pageId = document.body.dataset.page || 'gallery';
let beforeNavigateHandler = null;
let foldAdapterInstance = null;

async function bootstrap() {
  try {
    const shell = await mountShell({ page: pageId });
    if (!foldAdapterInstance) {
      foldAdapterInstance = initFoldAdapter();
    }
    const foldAdapter = foldAdapterInstance;

    if (['landing', 'gallery', 'artist'].includes(pageId)) {
      await ensureDefaultWhisperVoice();
    }

    initRouter({
      async beforeNavigate(event) {
        if (typeof beforeNavigateHandler === 'function') {
          try {
            await beforeNavigateHandler(event);
          } catch (error) {
            console.warn('[main] beforeNavigate handler failed', error);
          }
        }
      },
    });

    const loadModule = PAGE_LAZY_MODULES[pageId];
    if (loadModule) {
      const module = await loadModule();
      const initializer = module.initPage || module.initGalleryPage || module.initLandingPage;
      if (typeof initializer === 'function') {
        const lifecycle = await initializer({ page: pageId, shell, foldAdapter });
        if (lifecycle && typeof lifecycle.beforeNavigate === 'function') {
          beforeNavigateHandler = lifecycle.beforeNavigate;
        }
        if (lifecycle && typeof lifecycle.onDispose === 'function') {
          window.addEventListener('pagehide', () => lifecycle.onDispose(), { once: true });
        }
      }
    }
  } catch (error) {
    console.error('Failed to bootstrap TagExplorer', error);
    document.body.innerHTML = `
      <div class="boot-error">
        <h1>Failed to initialize TagExplorer</h1>
        <p>${error?.message || 'An unknown error occurred.'}</p>
        <p class="boot-error__hint">Refresh or return to the <a href="/" data-router-link>landing page</a>.</p>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.addEventListener('error', (event) => {
  if (event.error && event.error.name === 'DOMException') return;
  if (event.error && event.error.message && event.error.message.includes('NetworkError')) return;
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.name === 'DOMException') return;
  if (event.reason && event.reason.message && event.reason.message.includes('NetworkError')) return;
  console.error('Unhandled promise rejection:', event.reason);
});
