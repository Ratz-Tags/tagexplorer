const COVER_QUERY = '(max-width: 520px) and (orientation: portrait)';
const INNER_QUERY = '(min-width: 980px) and (min-height: 980px)';

function resolveMode(coverMedia, innerMedia) {
  // Fold layout is disabled in favor of a responsive phone layout
  return 'default';
}

function bindMediaChange(media, handler) {
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

export function initFoldAdapter({ onChange } = {}) {
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
  let currentMode = resolveMode(coverMedia, innerMedia);
  const listeners = new Set();

  const notify = (mode) => {
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
