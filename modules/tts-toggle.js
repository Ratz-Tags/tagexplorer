// Simple TTS toggle state and UI
let ttsEnabled = true;

function isTTSEnabled() {
  return ttsEnabled;
}

function setTTSEnabled(enabled) {
  ttsEnabled = !!enabled;
  localStorage.setItem("ttsEnabled", ttsEnabled ? "1" : "0");
  updateTTSToggleButton();
}

function loadTTSEnabled() {
  const saved = localStorage.getItem("ttsEnabled");
  ttsEnabled = saved !== "0";
}

function createTTSToggleButton() {
  let btn = document.getElementById("tts-toggle-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "tts-toggle-btn";
    btn.className = "browse-btn";
    btn.style.marginLeft = "1em";
    btn.onclick = () => setTTSEnabled(!ttsEnabled);
    const controls = document.querySelector(".audio-controls");
    if (controls) controls.appendChild(btn);
  }
  updateTTSToggleButton();
}

function updateTTSToggleButton() {
  const btn = document.getElementById("tts-toggle-btn");
  if (btn) {
    btn.textContent = ttsEnabled ? "Disable TTS" : "Enable TTS";
    btn.setAttribute("aria-pressed", ttsEnabled ? "true" : "false");
  }
}

// On load
loadTTSEnabled();

export { isTTSEnabled, setTTSEnabled, createTTSToggleButton };
