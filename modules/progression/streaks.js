const STORAGE_KEY = 'tx:haze:v1';
const STORAGE_STREAK_KEY = 'streakState';
const STORAGE_PREF_KEY = 'streakOptOut';
const DAY_MS = 86400000;
const HISTORY_LIMIT = 32;

const STREAK_TIERS = [
  { id: 'dormant', label: 'Dormant', min: 0, a11yName: 'Dormant tier', accent: 'muted' },
  { id: 'ember', label: 'Ember Drift', min: 3, a11yName: 'Ember tier', accent: 'ember' },
  { id: 'glow', label: 'Glass Glow', min: 7, a11yName: 'Glow tier', accent: 'glow' },
  { id: 'inferno', label: 'Infra Inferno', min: 14, a11yName: 'Inferno tier', accent: 'inferno' },
  { id: 'void', label: 'Void Crown', min: 30, a11yName: 'Void Crown tier', accent: 'void' },
];

let hydrated = false;
let storageFaultLogged = false;
let listeners = new Set();
let state = {
  count: 0,
  longest: 0,
  lastVisit: null,
  history: [],
};
let trackingOptOut = false;

function cloneState(source = {}) {
  return {
    count: Number(source.count) || 0,
    longest: Number(source.longest) || 0,
    lastVisit: typeof source.lastVisit === 'number' ? source.lastVisit : null,
    history: Array.isArray(source.history)
      ? source.history
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .slice(-HISTORY_LIMIT)
      : [],
  };
}

function readNamespace() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[streaks] failed to read namespace', error);
      storageFaultLogged = true;
    }
    return {};
  }
}

function writeNamespace() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload = readNamespace();
  payload[STORAGE_STREAK_KEY] = { ...state };
  payload[STORAGE_PREF_KEY] = trackingOptOut === true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[streaks] failed to persist namespace', error);
      storageFaultLogged = true;
    }
  }
}

function getDayStart(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const normalized = date.getTime();
  return Number.isFinite(normalized) ? normalized : null;
}

function computeTierFromCount(count) {
  const numeric = Number(count) || 0;
  let tier = 0;
  for (let index = STREAK_TIERS.length - 1; index >= 0; index -= 1) {
    const entry = STREAK_TIERS[index];
    if (!entry) continue;
    if (numeric >= entry.min) {
      tier = index;
      break;
    }
  }
  return tier;
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  const namespace = readNamespace();
  const storedState = cloneState(namespace?.[STORAGE_STREAK_KEY] || {});
  state = {
    ...storedState,
    count: Math.max(0, Math.round(storedState.count || 0)),
    longest: Math.max(0, Math.round(storedState.longest || storedState.count || 0)),
  };
  trackingOptOut = namespace?.[STORAGE_PREF_KEY] === true;
}

function snapshotState(source = state) {
  return {
    count: source.count,
    longest: source.longest,
    lastVisit: source.lastVisit,
    history: Array.isArray(source.history) ? [...source.history] : [],
  };
}

function buildDetail({
  previousState = snapshotState(state),
  reason = 'update',
  timestamp = Date.now(),
  didIncrement = false,
  wasReset = false,
  deltaDays = 0,
} = {}) {
  const trackingEnabled = !trackingOptOut;
  const tier = trackingEnabled ? computeTierFromCount(state.count) : 0;
  const previousTier = computeTierFromCount(previousState.count);
  return {
    state: snapshotState(state),
    previousState: snapshotState(previousState),
    trackingEnabled,
    tier,
    previousTier: trackingEnabled ? previousTier : 0,
    didIncrement,
    wasReset,
    deltaDays,
    reason,
    optedOut: !trackingEnabled,
    timestamp,
  };
}

function notify(detail) {
  listeners.forEach((listener) => {
    try {
      listener(detail);
    } catch (error) {
      console.warn('[streaks] listener failed', error);
    }
  });
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('streaks:change', { detail }));
    } catch (error) {
      console.warn('[streaks] failed to dispatch change event', error);
    }
  }
}

function trimHistory() {
  if (!Array.isArray(state.history)) {
    state.history = [];
    return;
  }
  if (state.history.length > HISTORY_LIMIT) {
    state.history = state.history.slice(-HISTORY_LIMIT);
  }
}

function recordVisit({ timestamp = Date.now(), reason = 'visit', emit = true } = {}) {
  ensureHydrated();
  const visitAt = getDayStart(timestamp);
  if (!Number.isFinite(visitAt)) {
    return buildDetail({ reason: 'invalid', timestamp });
  }
  const previousState = snapshotState(state);
  if (trackingOptOut) {
    const detail = buildDetail({ previousState, reason: 'opted-out', timestamp, didIncrement: false, wasReset: false });
    if (emit) {
      notify(detail);
    }
    return detail;
  }

  const lastVisitDay = getDayStart(state.lastVisit);
  let didIncrement = false;
  let wasReset = false;
  let deltaDays = 0;

  if (!Number.isFinite(lastVisitDay)) {
    state.count = Math.max(1, state.count || 1);
    state.history = [visitAt];
    didIncrement = true;
  } else {
    deltaDays = Math.round((visitAt - lastVisitDay) / DAY_MS);
    if (deltaDays <= 0) {
      // Same day revisit; ensure we have a record but do not increment.
      if (!state.history.includes(visitAt)) {
        state.history.push(visitAt);
        trimHistory();
      }
    } else if (deltaDays === 1) {
      state.count = Math.max(0, state.count) + 1;
      state.history.push(visitAt);
      trimHistory();
      didIncrement = true;
    } else if (deltaDays > 1) {
      state.count = 1;
      state.history.push(visitAt);
      trimHistory();
      wasReset = true;
      didIncrement = true;
    }
  }

  state.lastVisit = visitAt;
  if (state.count > state.longest) {
    state.longest = state.count;
  }
  writeNamespace();

  const detail = buildDetail({
    previousState,
    reason,
    timestamp: visitAt,
    didIncrement,
    wasReset,
    deltaDays,
  });
  if (emit) {
    notify(detail);
  }
  return detail;
}

function setStreakTrackingEnabled(enabled, { silent = false } = {}) {
  ensureHydrated();
  const nextOptOut = !enabled;
  if (trackingOptOut === nextOptOut) {
    return buildDetail({ reason: 'noop-toggle' });
  }
  const previousState = snapshotState(state);
  trackingOptOut = nextOptOut;
  writeNamespace();
  const detail = buildDetail({
    previousState,
    reason: 'toggle',
    didIncrement: false,
    wasReset: false,
  });
  detail.toggled = true;
  detail.optedOut = nextOptOut;
  if (!silent) {
    notify(detail);
  }
  return detail;
}

function isStreakTrackingEnabled() {
  ensureHydrated();
  return !trackingOptOut;
}

function getStreakState() {
  ensureHydrated();
  return snapshotState(state);
}

function getStreakTier() {
  ensureHydrated();
  if (trackingOptOut) return 0;
  return computeTierFromCount(state.count);
}

function getStreakTierInfo(count = state.count) {
  const tierIndex = computeTierFromCount(count);
  const tier = STREAK_TIERS[tierIndex] || STREAK_TIERS[0];
  const nextTier = STREAK_TIERS[tierIndex + 1] || null;
  return {
    ...tier,
    tier: tierIndex,
    nextThreshold: nextTier ? nextTier.min : null,
  };
}

function getTierCatalog() {
  return STREAK_TIERS.map((entry, index) => ({ ...entry, tier: index }));
}

function onStreakChange(callback) {
  if (typeof callback !== 'function') return () => {};
  ensureHydrated();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function syncFromStorage(serialized) {
  if (typeof serialized !== 'string') return;
  try {
    const parsed = JSON.parse(serialized);
    const nextState = cloneState(parsed?.[STORAGE_STREAK_KEY] || {});
    const nextOptOut = parsed?.[STORAGE_PREF_KEY] === true;
    const previousState = snapshotState(state);
    const previousOptOut = trackingOptOut;
    const changed =
      nextState.count !== state.count ||
      nextState.longest !== state.longest ||
      nextState.lastVisit !== state.lastVisit ||
      nextState.history.length !== state.history.length ||
      nextOptOut !== trackingOptOut;
    state = {
      ...nextState,
      count: Math.max(0, Math.round(nextState.count || 0)),
      longest: Math.max(0, Math.round(nextState.longest || nextState.count || 0)),
    };
    trackingOptOut = nextOptOut;
    if (changed || previousOptOut !== trackingOptOut) {
      const detail = buildDetail({
        previousState,
        reason: 'storage',
        didIncrement: false,
        wasReset: false,
      });
      notify(detail);
    }
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[streaks] failed to sync storage payload', error);
      storageFaultLogged = true;
    }
  }
}

if (typeof window !== 'undefined') {
  ensureHydrated();
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === event.oldValue) return;
    syncFromStorage(event.newValue);
  });
  const namespace = readNamespace();
  if (namespace && typeof namespace === 'object') {
    syncFromStorage(JSON.stringify(namespace));
  }
  window.txStreaks = Object.assign(window.txStreaks || {}, {
    getState: () => getStreakState(),
    recordVisit: (daysAgo = 0) =>
      recordVisit({
        timestamp: Date.now() - Number(daysAgo || 0) * DAY_MS,
        reason: 'manual',
      }),
    setEnabled: (enabled) => setStreakTrackingEnabled(Boolean(enabled)),
    isEnabled: () => isStreakTrackingEnabled(),
    tiers: getTierCatalog(),
  });
}

export {
  recordVisit,
  getStreakState,
  getStreakTier,
  getStreakTierInfo,
  getTierCatalog,
  isStreakTrackingEnabled,
  setStreakTrackingEnabled,
  onStreakChange,
};
