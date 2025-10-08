const DEFAULT_INTERVAL = 15000;
const MIN_INTERVAL = 5000;
const TAG_DECAY = 0.65;
const MAX_HISTORY_TAGS = 12;

function toArray(setOrArray) {
  if (!setOrArray) return [];
  if (Array.isArray(setOrArray)) return setOrArray.slice();
  if (typeof setOrArray === 'function') {
    try {
      const result = setOrArray();
      return toArray(result);
    } catch (error) {
      console.warn('[ambience] failed to resolve tags from function', error);
      return [];
    }
  }
  if (setOrArray instanceof Set) return Array.from(setOrArray);
  if (typeof setOrArray[Symbol.iterator] === 'function') {
    return Array.from(setOrArray);
  }
  return [];
}

function clampInterval(value) {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL;
  return Math.max(MIN_INTERVAL, Math.floor(value));
}

function normaliseTag(tag) {
  if (!tag) return '';
  return String(tag).trim().toLowerCase().replace(/\s+/g, '_');
}

function buildGalleryWeights(getFilteredArtists) {
  const weights = new Map();
  if (typeof getFilteredArtists !== 'function') return weights;
  try {
    const artists = getFilteredArtists();
    if (!Array.isArray(artists) || artists.length === 0) return weights;
    const sample = artists.slice(0, 80);
    sample.forEach((artist, index) => {
      const tags = Array.isArray(artist?.kinkTags) ? artist.kinkTags : [];
      const bias = Math.max(1, sample.length - index);
      tags.forEach((tag) => {
        const key = normaliseTag(tag);
        if (!key) return;
        const prev = weights.get(key) || 0;
        weights.set(key, prev + 1 * bias);
      });
    });
  } catch (error) {
    console.warn('[ambience] failed to derive gallery weights', error);
  }
  return weights;
}

function mergeWeightMaps(base, incoming) {
  const result = new Map(base);
  incoming.forEach((value, key) => {
    const safeKey = normaliseTag(key);
    if (!safeKey) return;
    const prev = result.get(safeKey) || 0;
    result.set(safeKey, prev + value);
  });
  return result;
}

export function initAmbienceController(options = {}) {
  const state = {
    setBackground: typeof options.setBackground === 'function' ? options.setBackground : null,
    getActiveTags: typeof options.getActiveTags === 'function' ? options.getActiveTags : null,
    getFilteredArtists: typeof options.getFilteredArtists === 'function' ? options.getFilteredArtists : null,
    getPaginationInfo: typeof options.getPaginationInfo === 'function' ? options.getPaginationInfo : null,
    interval: clampInterval(options.interval ?? DEFAULT_INTERVAL),
    intensity: 2,
    motion: 'full',
    tagWeights: new Map(),
    scheduled: null,
    idleTimer: null,
    destroyed: false,
    lastRun: 0,
  };

  if (!state.setBackground) {
    console.warn('[ambience] no setBackground callback provided; aborting controller init');
    return null;
  }

  function decayWeights() {
    const next = new Map();
    let carried = 0;
    state.tagWeights.forEach((value, key) => {
      const decayed = value * TAG_DECAY;
      if (decayed > 0.01 && carried < MAX_HISTORY_TAGS) {
        next.set(key, decayed);
        carried += 1;
      }
    });
    state.tagWeights = next;
  }

  function bumpTags(activeTags) {
    decayWeights();
    const tags = toArray(activeTags);
    tags.forEach((tag, index) => {
      const key = normaliseTag(tag);
      if (!key) return;
      const rankBias = tags.length - index;
      const current = state.tagWeights.get(key) || 0;
      state.tagWeights.set(key, current + 1 + rankBias * 0.35);
    });
  }

  function buildPayload(reason) {
    const snapshot = mergeWeightMaps(
      state.tagWeights,
      buildGalleryWeights(state.getFilteredArtists),
    );
    const active = typeof state.getActiveTags === 'function' ? toArray(state.getActiveTags()) : [];
    if (active.length) {
      active.forEach((tag) => {
        const key = normaliseTag(tag);
        if (!key) return;
        const prev = snapshot.get(key) || 0;
        snapshot.set(key, prev + 2.5);
      });
    }
    return {
      reason,
      tagWeights: snapshot,
      intensity: state.intensity,
      motionMode: state.motion,
      pagination: state.getPaginationInfo ? state.getPaginationInfo() : null,
    };
  }

  function clearIdle() {
    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
  }

  function scheduleIdle() {
    clearIdle();
    state.idleTimer = setTimeout(() => {
      requestRefresh('idle');
    }, state.interval);
  }

  function performRefresh(reason) {
    if (state.destroyed) return;
    state.scheduled = null;
    state.lastRun = Date.now();
    console.log('[ambience-controller] performRefresh triggered by:', reason);
    Promise.resolve()
      .then(() => {
        const payload = buildPayload(reason);
        console.log('[ambience-controller] calling setBackground with payload:', payload);
        return state.setBackground(payload);
      })
      .catch((error) => {
        console.warn('[ambience] background refresh failed', error);
      })
      .finally(() => {
        scheduleIdle();
      });
  }

  function requestRefresh(reason, { immediate = false } = {}) {
    if (state.destroyed) return;
    const now = Date.now();
    const elapsed = now - state.lastRun;
    const delay = immediate ? 0 : Math.max(0, state.interval - elapsed);
    if (state.scheduled) {
      clearTimeout(state.scheduled);
    }
    state.scheduled = setTimeout(() => performRefresh(reason), delay);
  }

  function handleTagsUpdated(event) {
    bumpTags(event?.detail?.activeTags || []);
    requestRefresh('tags');
  }

  function handleIntensity(event) {
    const next = Number(event?.detail?.intensity);
    if (Number.isFinite(next)) {
      state.intensity = next;
      requestRefresh('intensity', { immediate: false });
    }
  }

  function handleMotion(event) {
    const mode = event?.detail?.mode;
    if (mode === 'reduced' || mode === 'full') {
      state.motion = mode;
    }
  }

  document.addEventListener('tags:updated', handleTagsUpdated);
  document.addEventListener('tts:intensity', handleIntensity);
  document.addEventListener('motion:change', handleMotion);

  requestRefresh('init', { immediate: true });

  return {
    refresh(reason = 'manual') {
      requestRefresh(reason, { immediate: true });
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      if (state.scheduled) {
        clearTimeout(state.scheduled);
        state.scheduled = null;
      }
      clearIdle();
      document.removeEventListener('tags:updated', handleTagsUpdated);
      document.removeEventListener('tts:intensity', handleIntensity);
      document.removeEventListener('motion:change', handleMotion);
    },
  };
}

export default initAmbienceController;
