import type { FoldAdapter, FoldMode } from './types.js';

const COVER_QUERY = '(max-width: 520px) and (orientation: portrait)';
const INNER_QUERY = '(min-width: 980px) and (min-height: 980px)';

function resolveMode(coverMedia: MediaQueryList | null, innerMedia: MediaQueryList | null): FoldMode {
  if (coverMedia && coverMedia.matches) {
    return 'fold-cover';
  }
  if (innerMedia && innerMedia.matches) {
    return 'fold-inner';
  }
  return 'default';
}

function bindMediaChange(media: MediaQueryList | null, handler: () => void): () => void {
  if (!media) return () => {};
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }
  if (typeof media.addListener === 'function') {
    media.addListener(handler);
    return () => media.removeListener(handler);
  }
  return () => {};
}

interface FoldAdapterOptions {
  onChange?: (mode: FoldMode) => void;
}

export function initFoldAdapter({ onChange }: FoldAdapterOptions = {}): FoldAdapter {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    const fallbackMode = 'default';
    if (typeof onChange === 'function') {
      try {
        onChange(fallbackMode);
      } catch {
        // ignore callback failures
      }
    }
    return {
      getMode: () => fallbackMode,
      subscribe: () => () => {},
      destroy: () => {},
    };
  }

  const coverMedia = window.matchMedia(COVER_QUERY);
  const innerMedia = window.matchMedia(INNER_QUERY);
  let currentMode: FoldMode = resolveMode(coverMedia, innerMedia);
  const listeners = new Set<(mode: FoldMode) => void>();

  const notify = (mode: FoldMode) => {
    if (typeof onChange === 'function') {
      try {
        onChange(mode);
      } catch {
        // ignore callback errors
      }
    }
    listeners.forEach((listener) => {
      try {
        listener(mode);
      } catch (error) {
        console.warn('[fold-adapter] listener error', error);
      }
    });
  };

  const evaluate = () => {
    const nextMode = resolveMode(coverMedia, innerMedia);
    if (nextMode === currentMode) return;
    currentMode = nextMode;
    notify(currentMode);
  };

  const unbindCover = bindMediaChange(coverMedia, evaluate);
  const unbindInner = bindMediaChange(innerMedia, evaluate);
  const resizeHandler = () => evaluate();
  window.addEventListener('resize', resizeHandler);

  // Initial notification
  notify(currentMode);

  return {
    getMode: () => currentMode,
    subscribe(callback) {
      if (typeof callback !== 'function') {
        return () => {};
      }
      listeners.add(callback);
      try {
        callback(currentMode);
      } catch (error) {
        console.warn('[fold-adapter] subscriber threw during init', error);
      }
      return () => {
        listeners.delete(callback);
      };
    },
    destroy() {
      unbindCover();
      unbindInner();
      window.removeEventListener('resize', resizeHandler);
      listeners.clear();
    },
  };
}
