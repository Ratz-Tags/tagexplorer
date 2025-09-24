// Simple TTS toggle state and UI
const STORAGE_KEY = "ttsEnabled";
let ttsEnabled = true;

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

function applyTTSEnabledState(options = {}) {
  const { didChange = false } = options;
  if (typeof window !== "undefined") {
    window._ttsEnabled = ttsEnabled;
  }
  updateTTSToggleButton();
  dispatchToggleEvent(didChange);
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
  return ttsEnabled;
}

function loadTTSEnabled() {
  const storage = getStorage();
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === "0") {
        ttsEnabled = false;
      } else if (saved === "1") {
        ttsEnabled = true;
      }
    } catch (error) {
      // Ignore storage access issues
    }
  }
  applyTTSEnabledState({ didChange: false });
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

function updateTTSToggleButton() {
  if (typeof document === "undefined") return;
  const btn = document.getElementById("tts-toggle-btn");
  if (!btn) return;

  const enabled = isTTSEnabled();
  const label = enabled ? "Disable whispered taunts" : "Enable whispered taunts";
  btn.textContent = enabled ? "🔊 Whisper On" : "🔇 Whisper Off";
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
}

// On load
loadTTSEnabled();

export { isTTSEnabled, setTTSEnabled, createTTSToggleButton };
