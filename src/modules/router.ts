import { preloadArtistBySlug, preloadDataset } from './api.js';
import { dispatchWhisperEvent } from './tts-dispatcher.js';
import type { RouterInitOptions, RouterNavigateEvent } from './types.js';

const ARTIST_ROUTE_REGEX = /\/artist\/([^/]+)\/?$/;

function shouldHandle(anchor: HTMLAnchorElement | null): boolean {
  if (!anchor) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.href === window.location.href) return false;
  return true;
}

function applyGlitchTransition(): void {
  document.documentElement.classList.add('is-glitching');
  document.body.classList.add('is-glitching');
}

function clearGlitch(): void {
  document.documentElement.classList.remove('is-glitching');
  document.body.classList.remove('is-glitching');
}

export function initRouter({ beforeNavigate }: RouterInitOptions = {}): void {
  document.addEventListener('click', async (event: MouseEvent) => {
    const anchor =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[data-router-link]')
        : null;
    if (!shouldHandle(anchor)) return;

    const url = new URL(anchor.href, window.location.href);
    const preloadKey = anchor.dataset.preload;
    const artistMatch = ARTIST_ROUTE_REGEX.exec(url.pathname);
    event.preventDefault();

    try {
      if (preloadKey) {
        await preloadDataset(preloadKey);
      }
      if (artistMatch) {
        await preloadArtistBySlug(artistMatch[1]);
      }
      if (typeof beforeNavigate === 'function') {
        await beforeNavigate({ url, anchor } satisfies RouterNavigateEvent);
      }
    } catch (error) {
      console.warn('[router] beforeNavigate failed', error);
    }

    const performNavigation = () => {
      applyGlitchTransition();
      window.location.href = url.href;
    };

    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    const supportsViewTransitions = typeof doc.startViewTransition === 'function';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (supportsViewTransitions && !prefersReducedMotion) {
      try {
        doc.startViewTransition?.(() => {
          performNavigation();
        });
      } catch (error) {
        console.warn('[router] startViewTransition failed', error);
        performNavigation();
      }
    } else {
      performNavigation();
    }
  });

  window.addEventListener('pageshow', () => {
    setTimeout(clearGlitch, 120);
  });

  window.addEventListener('popstate', () => {
    dispatchWhisperEvent('back', { maxIntensity: 2 });
  });
}

export function navigateTo(url: string | URL): void {
  const next = typeof url === 'string' ? new URL(url, window.location.href) : url;
  if (!next) return;
  applyGlitchTransition();
  window.location.href = next.href;
}
