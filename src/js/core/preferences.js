import { clamp, createEmitter, deepClone, deepMerge, isPlainObject } from './utils.js';

const STORAGE_KEY = 'tagexplorer.preferences.v1';
const emitter = createEmitter();

const defaultPreferences = Object.freeze({
  filters: [],
  rememberFilters: true,
  humiliation: {
    enabled: true,
    intensity: 2
  },
  tts: {
    intensity: 2,
    muted: false
  },
  motion: {
    reduced: false
  },
  featureFlags: {
    viewTransitions: true,
    glitchEffects: true,
    whisper: true,
    humiliation: true
  }
});

let preferences = sanitizePreferences(loadFromStorage());

function loadFromStorage() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return deepClone(defaultPreferences);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return deepClone(defaultPreferences);
    }
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return deepClone(defaultPreferences);
    }
    return deepMerge(defaultPreferences, parsed);
  } catch (error) {
    console.warn('Failed to load preferences, using defaults', error);
    return deepClone(defaultPreferences);
  }
}

function persist() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to persist preferences', error);
  }
}

function sanitizePreferences(input) {
  const result = deepMerge(defaultPreferences, input ?? {});
  const sanitized = {
    ...result,
    filters: Array.isArray(result.filters) ? [...new Set(result.filters.filter(Boolean))] : [],
    rememberFilters: Boolean(result.rememberFilters),
    humiliation: {
      enabled: Boolean(result.humiliation?.enabled ?? true),
      intensity: clamp(Number(result.humiliation?.intensity ?? 2), 0, 3)
    },
    tts: {
      intensity: clamp(Number(result.tts?.intensity ?? 2), 0, 3),
      muted: Boolean(result.tts?.muted ?? false)
    },
    motion: {
      reduced: Boolean(result.motion?.reduced ?? false)
    },
    featureFlags: {
      viewTransitions: Boolean(result.featureFlags?.viewTransitions ?? true),
      glitchEffects: Boolean(result.featureFlags?.glitchEffects ?? true),
      whisper: Boolean(result.featureFlags?.whisper ?? true),
      humiliation: Boolean(result.featureFlags?.humiliation ?? true)
    }
  };

  if (!sanitized.rememberFilters) {
    sanitized.filters = [];
  }

  return sanitized;
}

export function getPreferences() {
  return deepClone(preferences);
}

export function updatePreferences(updater) {
  const draft = deepClone(preferences);
  const next = typeof updater === 'function' ? updater(draft) ?? draft : deepMerge(draft, updater);
  preferences = sanitizePreferences(next);
  persist();
  emitter.emit(getPreferences());
  return getPreferences();
}

export function subscribeToPreferences(listener) {
  listener(getPreferences());
  return emitter.subscribe(listener);
}

export function resetPreferences() {
  preferences = deepClone(defaultPreferences);
  persist();
  emitter.emit(getPreferences());
}

export function getDefaultPreferences() {
  return deepClone(defaultPreferences);
}
