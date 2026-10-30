// Whisper on/off and intensity state, persisted in localStorage. The
// controls live in the Settings panel (settings-panel.js).
const STORAGE_KEY = "ttsEnabled";
const INTENSITY_STORAGE_KEY = "ttsIntensity";
const DEFAULT_INTENSITY = 2;
let ttsEnabled = true;
let ttsIntensity = DEFAULT_INTENSITY;
let lastNonZeroIntensity = DEFAULT_INTENSITY;
let suppressToggleSync = false;
let suppressIntensitySync = false;

function getStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

function persistTTSEnabled() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, ttsEnabled ? "1" : "0");
  } catch (error) {
    // Ignore storage errors (e.g. private mode)
  }
}

function persistTTSIntensity() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(INTENSITY_STORAGE_KEY, String(ttsIntensity));
  } catch (error) {
    // Ignore storage errors
  }
}

function dispatchToggleEvent(didChange) {
  if (
    typeof document === "undefined" ||
    typeof CustomEvent !== "function" ||
    !didChange
  ) {
    return;
  }
  document.dispatchEvent(
    new CustomEvent("tts:toggle", { detail: { enabled: ttsEnabled } })
  );
}

function dispatchIntensityEvent(didChange) {
  if (
    typeof document === "undefined" ||
    typeof CustomEvent !== "function" ||
    !didChange
  ) {
    return;
  }
  document.dispatchEvent(
    new CustomEvent("tts:intensity", { detail: { intensity: ttsIntensity } })
  );
}

function applyTTSEnabledState(options = {}) {
  const { didChange = false } = options;
  if (typeof window !== "undefined") {
    window._ttsEnabled = ttsEnabled;
  }
  dispatchToggleEvent(didChange);
}

function applyIntensityState(options = {}) {
  const { didChange = false } = options;
  if (typeof window !== "undefined") {
    window._ttsIntensity = ttsIntensity;
  }
  dispatchIntensityEvent(didChange);
}

function isTTSEnabled() {
  return ttsEnabled;
}

function setTTSEnabled(enabled) {
  const normalized = Boolean(enabled);
  const didChange = normalized !== ttsEnabled;
  ttsEnabled = normalized;
  persistTTSEnabled();
  applyTTSEnabledState({ didChange });
  if (!suppressIntensitySync) {
    if (ttsEnabled && ttsIntensity === 0) {
      const fallback = lastNonZeroIntensity > 0 ? lastNonZeroIntensity : DEFAULT_INTENSITY;
      suppressToggleSync = true;
      suppressIntensitySync = true;
      setTTSIntensity(fallback);
      suppressIntensitySync = false;
      suppressToggleSync = false;
    } else if (!ttsEnabled && ttsIntensity > 0) {
      lastNonZeroIntensity = ttsIntensity;
    }
  }
  return ttsEnabled;
}

function getTTSIntensity() {
  return ttsIntensity;
}

function setTTSIntensity(value) {
  const numeric = Number(value);
  const clamped = Number.isFinite(numeric)
    ? Math.max(0, Math.min(3, Math.floor(numeric)))
    : DEFAULT_INTENSITY;
  const didChange = clamped !== ttsIntensity;
  if (!didChange) return ttsIntensity;
  ttsIntensity = clamped;
  if (clamped > 0) {
    lastNonZeroIntensity = clamped;
  }
  persistTTSIntensity();
  applyIntensityState({ didChange });

  if (!suppressToggleSync) {
    if (clamped === 0 && ttsEnabled) {
      suppressIntensitySync = true;
      setTTSEnabled(false);
      suppressIntensitySync = false;
    } else if (clamped > 0 && !ttsEnabled) {
      suppressIntensitySync = true;
      setTTSEnabled(true);
      suppressIntensitySync = false;
    }
  }

  return ttsIntensity;
}

function loadTTSPreferences() {
  const storage = getStorage();
  if (storage) {
    try {
      const savedEnabled = storage.getItem(STORAGE_KEY);
      if (savedEnabled === "0") {
        ttsEnabled = false;
      } else if (savedEnabled === "1") {
        ttsEnabled = true;
      }
      const savedIntensity = storage.getItem(INTENSITY_STORAGE_KEY);
      if (savedIntensity !== null && savedIntensity !== undefined) {
        const numeric = Number(savedIntensity);
        if (Number.isFinite(numeric)) {
          const clamped = Math.max(0, Math.min(3, Math.floor(numeric)));
          ttsIntensity = clamped;
          if (clamped > 0) {
            lastNonZeroIntensity = clamped;
          }
        }
      }
    } catch (error) {
      // Ignore storage access issues
    }
  }
  if (ttsIntensity === 0 && ttsEnabled) {
    suppressToggleSync = true;
    setTTSEnabled(false);
    suppressToggleSync = false;
  }
  applyTTSEnabledState({ didChange: false });
  applyIntensityState({ didChange: false });
}

// On load
loadTTSPreferences();

export {
  isTTSEnabled,
  setTTSEnabled,
  getTTSIntensity,
  setTTSIntensity,
};
