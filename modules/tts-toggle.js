// Simple TTS toggle state and UI
const STORAGE_KEY = "ttsEnabled";
const INTENSITY_STORAGE_KEY = "ttsIntensity";
const DEFAULT_INTENSITY = 2;
const INTENSITY_LABELS = [
  "Muted",
  "Hushed",
  "Teasing",
  "Severe",
];

function describeIntensity(level) {
  const index = Number.isFinite(Number(level)) ? Math.max(0, Math.min(INTENSITY_LABELS.length - 1, Math.floor(Number(level)))) : 0;
  return INTENSITY_LABELS[index] || INTENSITY_LABELS[0];
}

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
  updateTTSToggleButton();
  updateIntensityControl();
  dispatchToggleEvent(didChange);
}

function applyIntensityState(options = {}) {
  const { didChange = false } = options;
  if (typeof window !== "undefined") {
    window._ttsIntensity = ttsIntensity;
  }
  updateTTSToggleButton();
  updateIntensityControl();
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

function createTTSToggleButton() {
  if (typeof document === "undefined") return;
  const controls = document.querySelector(".audio-controls");
  if (!controls) return;

  let btn = document.getElementById("tts-toggle-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "tts-toggle-btn";
    btn.className = "audio-pill";
    btn.addEventListener("click", () => {
      setTTSEnabled(!isTTSEnabled());
    });
    controls.appendChild(btn);
  }
  updateTTSToggleButton();
}

function createTTSIntensityControl() {
  if (typeof document === "undefined") return;
  const controls = document.querySelector(".audio-controls");
  if (!controls) return;

  let btn = document.getElementById("tts-intensity-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "tts-intensity-btn";
    btn.className = "audio-pill tts-intensity-btn";
    btn.addEventListener("click", () => {
      const current = getTTSIntensity();
      const next = (current + 1) % 4;
      setTTSIntensity(next);
    });
    btn.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = Math.min(3, getTTSIntensity() + 1);
        setTTSIntensity(next);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.max(0, getTTSIntensity() - 1);
        setTTSIntensity(next);
      }
    });
    controls.appendChild(btn);
  }
  updateIntensityControl();
}

function updateIntensityControl() {
  if (typeof document === "undefined") return;
  const btn = document.getElementById("tts-intensity-btn");
  if (!btn) return;
  const enabled = isTTSEnabled();
  const intensity = getTTSIntensity();
  const readable = describeIntensity(intensity);
  const label = intensity === 0 ? "Muted" : readable;
  btn.textContent = `🎚 ${label}`;
  const ariaSuffix = !enabled ? " (muted)" : "";
  btn.setAttribute("aria-label", `Whisper intensity ${label}${ariaSuffix}`);
  btn.setAttribute("data-intensity", String(intensity));
  btn.setAttribute("title", `Whisper intensity: ${label}`);
  if (btn.classList && typeof btn.classList.toggle === "function") {
    btn.classList.toggle("is-muted", !enabled || intensity === 0);
  } else if (typeof btn.setAttribute === "function") {
    btn.setAttribute("data-muted", (!enabled || intensity === 0) ? "true" : "false");
  }
}

function updateTTSToggleButton() {
  if (typeof document === "undefined") return;
  const btn = document.getElementById("tts-toggle-btn");
  if (!btn) return;

  const enabled = isTTSEnabled();
  const intensity = getTTSIntensity();
  const readable = describeIntensity(enabled ? intensity : 0);
  const label = enabled
    ? `Disable whispered taunts (current intensity ${readable})`
    : "Enable whispered taunts";
  const text = enabled && intensity > 0 ? `🔊 Whisper ${readable}` : "🔇 Whisper Off";
  btn.textContent = text;
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
}

// On load
loadTTSPreferences();

export {
  isTTSEnabled,
  setTTSEnabled,
  createTTSToggleButton,
  createTTSIntensityControl,
  getTTSIntensity,
  setTTSIntensity,
};
