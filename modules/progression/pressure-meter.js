const STORAGE_KEY = 'tx:haze:v1';
const STORAGE_LEVEL_KEY = 'pressureMeterLevel';
const PRESSURE_MAX = 100;
const ESCALATION_THRESHOLDS = [0, 28, 62, 88];

let state = { level: 0, tier: 0 };
let hasLoaded = false;
let storageFaultLogged = false;
const listeners = new Set();

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= PRESSURE_MAX) return PRESSURE_MAX;
  return Math.round(numeric);
}

function computeTier(level) {
  const numeric = clampLevel(level);
  if (numeric >= ESCALATION_THRESHOLDS[3]) return 3;
  if (numeric >= ESCALATION_THRESHOLDS[2]) return 2;
  if (numeric >= ESCALATION_THRESHOLDS[1]) return 1;
  return 0;
}

function readNamespace() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[pressure-meter] failed to read namespace', error);
      storageFaultLogged = true;
    }
    return {};
  }
}

function writeNamespace(nextLevel) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload = readNamespace();
  payload[STORAGE_LEVEL_KEY] = nextLevel;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[pressure-meter] failed to persist namespace', error);
      storageFaultLogged = true;
    }
  }
}

function ensureLoaded() {
  if (hasLoaded) return state;
  hasLoaded = true;
  const namespace = readNamespace();
  const storedLevel = clampLevel(namespace[STORAGE_LEVEL_KEY]);
  state = {
    level: storedLevel,
    tier: computeTier(storedLevel),
  };
  return state;
}

function notifyChange(nextState, previousState, { source = null, reset = false } = {}) {
  const detail = {
    level: nextState.level,
    tier: nextState.tier,
    previousLevel: previousState.level,
    previousTier: previousState.tier,
    source,
  };

  listeners.forEach((listener) => {
    try {
      listener(detail);
    } catch (error) {
      console.warn('[pressure-meter] listener failed', error);
    }
  });

  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent('pressure:level-change', { detail }));
  } catch (error) {
    console.warn('[pressure-meter] failed to dispatch level-change', error);
  }

  if (nextState.tier > previousState.tier) {
    try {
      window.dispatchEvent(new CustomEvent('pressure:escalate', { detail }));
    } catch (error) {
      console.warn('[pressure-meter] failed to dispatch escalate', error);
    }
  }

  const shouldEmitReset =
    reset || (previousState.level !== 0 && nextState.level === 0);
  if (shouldEmitReset) {
    try {
      window.dispatchEvent(new CustomEvent('pressure:reset', { detail }));
    } catch (error) {
      console.warn('[pressure-meter] failed to dispatch reset', error);
    }
  }
}

function setPressureLevel(level, { source = null, silent = false, reset = false } = {}) {
  ensureLoaded();
  const nextLevel = clampLevel(level);
  if (nextLevel === state.level) {
    return state;
  }
  const nextState = { level: nextLevel, tier: computeTier(nextLevel) };
  const previousState = state;
  state = nextState;
  writeNamespace(nextLevel);
  if (!silent) {
    notifyChange(nextState, previousState, { source, reset });
  }
  return state;
}

function syncFromSerialized(serialized) {
  if (typeof serialized !== 'string') return;
  try {
    const parsed = JSON.parse(serialized);
    const incomingLevel = clampLevel(parsed?.[STORAGE_LEVEL_KEY]);
    if (incomingLevel === state.level) return;
    const previousState = state;
    state = { level: incomingLevel, tier: computeTier(incomingLevel) };
    notifyChange(state, previousState, { source: 'storage' });
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[pressure-meter] failed to parse storage payload', error);
      storageFaultLogged = true;
    }
  }
}

function incrementPressure(amount = 1, { source = null } = {}) {
  ensureLoaded();
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta === 0) {
    return state;
  }
  const next = Math.max(0, Math.min(PRESSURE_MAX, state.level + Math.round(delta)));
  return setPressureLevel(next, { source, reset: false });
}

function resetPressure({ source = null } = {}) {
  ensureLoaded();
  if (state.level === 0) return state;
  return setPressureLevel(0, { source, reset: true });
}

function getPressureState() {
  ensureLoaded();
  return { ...state };
}

function getPressureLevel() {
  ensureLoaded();
  return state.level;
}

function getPressureTier() {
  ensureLoaded();
  return state.tier;
}

function onPressureChange(callback) {
  if (typeof callback !== 'function') return () => {};
  ensureLoaded();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

if (typeof window !== 'undefined') {
  ensureLoaded();
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === event.oldValue) return;
    if (typeof event.newValue !== 'string') return;
    syncFromSerialized(event.newValue);
  });
}

export {
  ESCALATION_THRESHOLDS,
  getPressureLevel,
  getPressureState,
  getPressureTier,
  incrementPressure,
  onPressureChange,
  resetPressure,
  setPressureLevel,
};
