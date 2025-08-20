/**
 * Audio module - Handles audio controls and playback functionality
 */

import { vibrate } from "./ui.js";

let currentTrack = 0;
let moansMuted = false;
let moanPlaying = false;

// Audio file list
const audioFiles = [
  "Blank.mp3",
  "Filthy Habits.mp3",
  "Girl Factory.mp3",
  "Layer Zero.mp3",
  "Nipples.mp3",
  "Yes.mp3",
  // Add more audio files as needed
];

// DOM element references
let panelToggle = null;
let panel = null;
let trackName = null;
let toggleBtn = null;
let nextBtn = null;
let prevBtn = null;
let moanBtn = null;
let moanToggle = null;
let hypnoAudio = null;
let moanAudio = null;

/**
 * Gets the audio source path for a given track index (supports custom URLs).
 */
function getAudioSrc(index) {
  const name = audioFiles[index];
  if (window._customAudioUrls && window._customAudioUrls[name]) {
    return window._customAudioUrls[name];
  }
  return `audio/${name}`;
}

/**
 * Loads and plays a specific track
 */
function loadTrack(index) {
  if (!hypnoAudio || !trackName) return;
  currentTrack = index;
  saveLastTrack();
  hypnoAudio.src = getAudioSrc(index);
  trackName.textContent = audioFiles[index].replace(/\.mp3$/, "");
  hypnoAudio.play().catch(console.warn);
}

/**
 * Toggles play/pause for the main audio
 */
function togglePlayback() {
  if (!hypnoAudio || !toggleBtn) return;

  if (hypnoAudio.paused) {
    hypnoAudio.play();
    toggleBtn.textContent = "⏸️";
  } else {
    hypnoAudio.pause();
    toggleBtn.textContent = "▶️";
  }
}

/**
 * Plays the next track in the playlist
 */
function nextTrack() {
  currentTrack = (currentTrack + 1) % audioFiles.length;
  saveLastTrack();
  loadTrack(currentTrack);
}

/**
 * Plays the previous track in the playlist
 */
function previousTrack() {
  currentTrack = (currentTrack - 1 + audioFiles.length) % audioFiles.length;
  saveLastTrack();
  loadTrack(currentTrack);
}

/**
 * Toggles moan audio mute state
 */
function toggleMoan() {
  if (!moanAudio || !moanBtn) return;

  moansMuted = !moansMuted;
  moanAudio.muted = moansMuted;
  moanBtn.textContent = moansMuted ? "🔇 Moan" : "🔊 Moan";
}

/**
 * Toggles the alternative moan audio playback
 */
function toggleMoanPlayback() {
  if (!moanAudio || !moanToggle) return;

  if (moanPlaying) {
    moanAudio.pause();
    moanAudio.currentTime = 0;
    moanToggle.textContent = "🔊 Moan";
  } else {
    moanAudio.play();
    moanToggle.textContent = "🔇 Moan";
  }
  moanPlaying = !moanPlaying;
}

/**
 * Toggles the audio panel visibility
 */
function togglePanel() {
  if (!panel) return;
  panel.classList.toggle("hidden");
  const expanded = !panel.classList.contains("hidden");
  const toggler = document.getElementById("audio-panel-toggle");
  if (toggler) toggler.setAttribute("aria-expanded", String(expanded));
}

/**
 * Handles track end event by auto-playing next track
 */
function onTrackEnded() {
  currentTrack = (currentTrack + 1) % audioFiles.length;
  loadTrack(currentTrack);
}

/**
 * Initializes audio controls and sets up event listeners
 */
function initAudio() {
  // Get DOM references
  panelToggle = document.getElementById("audio-panel-toggle");
  panel = document.getElementById("audio-panel");
  trackName = document.getElementById("audio-track-name");
  toggleBtn = document.getElementById("audio-toggle");
  nextBtn = document.getElementById("audio-next");
  prevBtn = document.getElementById("audio-prev");
  moanBtn = document.getElementById("moan-mute");
  moanToggle = document.getElementById("moan-toggle");
  hypnoAudio = document.getElementById("hypnoAudio");
  moanAudio = document.getElementById("moan-audio");

  // ARIA and feedback improvements for audio controls
  const audioPlayer = document.getElementById("audio-player");
  if (audioPlayer) {
    audioPlayer.setAttribute("aria-label", "Audio player");
    audioPlayer.setAttribute("role", "region");
  }
  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) {
    muteBtn.setAttribute("aria-label", "Mute audio");
    muteBtn.setAttribute("role", "button");
  }
  const playBtn = document.getElementById("play-btn");
  if (playBtn) {
    playBtn.setAttribute("aria-label", "Play audio");
    playBtn.setAttribute("role", "button");
  }

  // Set up event listeners
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      vibrate();
      togglePlayback(e);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", (e) => {
      vibrate();
      nextTrack(e);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", (e) => {
      vibrate();
      previousTrack(e);
    });
  }

  if (moanBtn) {
    moanBtn.addEventListener("click", (e) => {
      vibrate();
      toggleMoan(e);
    });
  }

  if (moanToggle && moanAudio) {
    moanToggle.addEventListener("click", (e) => {
      vibrate();
      toggleMoanPlayback(e);
    });
  }

  if (panelToggle) {
    panelToggle.addEventListener("click", (e) => {
      vibrate();
      togglePanel(e);
    });
  }
  // Support any generic audio toggle buttons
  document.querySelectorAll('.audio-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      vibrate();
      togglePanel(e);
    });
  });

  if (hypnoAudio) {
    hypnoAudio.addEventListener("ended", onTrackEnded);
  }

  // Load last played track from localStorage
  loadLastTrack();
  // Load initial track
  loadTrack(currentTrack);

  moansMuted = true;
  if (moanAudio) {
    moanAudio.muted = true;
  }
  if (moanBtn) {
    moanBtn.textContent = "🔇 Moan";
  }

  // Keyboard shortcuts: Space (play/pause), N (next), P (prev), S (shuffle)
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.code === "Space") {
      togglePlayback();
      e.preventDefault();
    }
    if (e.key.toLowerCase() === "n") {
      nextTrack();
      e.preventDefault();
    }
    if (e.key.toLowerCase() === "p") {
      previousTrack();
      e.preventDefault();
    }
    if (e.key.toLowerCase() === "s") {
      shuffleTracks();
      e.preventDefault();
    }
  });
}

/**
 * Initializes UI controls for adding tracks by direct MP3 URL only.
 * Call this after DOM is ready.
 */
function initAudioUI() {
  // Remove any search/yt/soundcloud buttons if present
  const oldSearchBtn = document.getElementById("search-hypno-btn");
  if (oldSearchBtn) oldSearchBtn.remove();

  // Add input for adding track by URL
  let urlInput = document.getElementById("add-track-url");
  let urlBtn = document.getElementById("add-track-url-btn");
  if (!urlInput) {
    urlInput = document.createElement("input");
    urlInput.id = "add-track-url";
    urlInput.type = "url";
    urlInput.placeholder = "Paste direct MP3 URL";
    urlInput.style.margin = "0.5em 0.2em";
    urlInput.style.borderRadius = "2em";
    urlInput.style.padding = "0.5em 1em";
    urlInput.style.border = "2px solid #fd7bc5";
    urlInput.style.fontFamily = "'Hi Melody',cursive";
    urlInput.style.width = "60%";
    const panel = document.getElementById("audio-panel");
    if (panel) {
      panel.appendChild(urlInput);
    }
  }
  if (!urlBtn) {
    urlBtn = document.createElement("button");
    urlBtn.id = "add-track-url-btn";
    urlBtn.textContent = "➕ Add Track";
    urlBtn.style.marginLeft = "0.5em";
    urlBtn.style.borderRadius = "2em";
    urlBtn.style.padding = "0.5em 1em";
    urlBtn.style.backgroundColor = "#fd7bc5";
    urlBtn.style.color = "#fff";
    urlBtn.style.fontFamily = "'Hi Melody',cursive";
    urlBtn.style.cursor = "pointer";
    const panel = document.getElementById("audio-panel");
    if (panel) {
      panel.appendChild(urlBtn);
    }
  }

  // Handle track addition by URL
  if (urlBtn) {
    urlBtn.addEventListener("click", () => {
      const urlInput = document.getElementById("add-track-url");
      if (urlInput) {
        const url = urlInput.value.trim();
        if (url) {
          addTrackByUrl(url);
          urlInput.value = "";
        }
      }
    });
  }
}

/**
 * Adds a new track to the playlist from a direct MP3 URL
 */
function addTrackByUrl(url) {
  // Validate URL (basic validation, can be expanded)
  if (!url.startsWith("http") || !url.endsWith(".mp3")) {
    showAudioToast("Invalid URL. Please enter a direct MP3 URL.", "error");
    return;
  }

  // Add to audioFiles array and update current track
  audioFiles.push(url);
  currentTrack = audioFiles.length - 1;
  saveLastTrack();

  // Update UI and load the new track
  const trackName = url
    .split("/")
    .pop()
    .replace(/\.mp3$/, "");
  const option = document.createElement("option");
  option.value = url;
  option.textContent = trackName;
  const trackSelect = document.getElementById("track-select");
  if (trackSelect) {
    trackSelect.appendChild(option);
  }

  loadTrack(currentTrack);
  showAudioToast(`Track added: ${trackName}`, "success");
}

/**
 * Shows a temporary toast message for audio actions
 */
function showAudioToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `audio-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

/**
 * Loads the last played track index from localStorage
 */
function loadLastTrack() {
  const saved = localStorage.getItem("lastAudioTrack");
  if (saved !== null && !isNaN(Number(saved))) {
    currentTrack = Number(saved);
  } else {
    currentTrack = 0;
  }
}

/**
 * Saves the current track index to localStorage
 */
function saveLastTrack() {
  localStorage.setItem("lastAudioTrack", String(currentTrack));
}

// --- AUDIO PANEL TOGGLE FIX ---
// Ensure the audio bar (panel) can be toggled by clicking the bar itself or a dedicated button
function setupAudioPanelToggle() {
  // Try to get both the panel and a toggle button
  const panel = document.getElementById("audio-panel");
  const bar = document.getElementById("audio-bar");
  const toggleBtn = document.getElementById("audio-panel-toggle");
  function toggle() {
    if (panel) {
      panel.classList.toggle("hidden");
      // Debug: log panel state
      console.log(
        "Audio panel toggled. Now hidden:",
        panel.classList.contains("hidden")
      );
    }
  }
  if (bar) {
    bar.style.cursor = "pointer";
    bar.addEventListener("click", toggle);
    bar.addEventListener("touchend", toggle);
  }
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggle);
    toggleBtn.addEventListener("touchend", toggle);
  }
}

// --- HUMILIATION BAR LESS OBSTRUCTIVE ---
let humiliationMeterTimeout = null;
function updateAudioHumiliationMeter() {
  let meter = document.getElementById("audio-humiliation-meter");
  if (!meter) {
    meter = document.createElement("div");
    meter.id = "audio-humiliation-meter";
    // Move to bottom right, smaller, more transparent
    meter.style.position = "fixed";
    meter.style.right = "1.5em";
    meter.style.bottom = "1.5em";
    meter.style.left = "auto";
    meter.style.transform = "none";
    meter.style.background = "#fff0faCC";
    meter.style.border = "2px solid #fd7bc5";
    meter.style.borderRadius = "2em";
    meter.style.boxShadow = "0 2px 12px #fd7bc555";
    meter.style.zIndex = "1000";
    meter.style.padding = "0.3em 1em 0.5em 1em";
    meter.style.display = "flex";
    meter.style.flexDirection = "column";
    meter.style.alignItems = "center";
    meter.style.fontFamily = "'Hi Melody', cursive, sans-serif";
    meter.style.fontSize = "0.9em";
    meter.style.opacity = "0.85";
    meter.style.transition = "opacity 0.5s";
    meter.style.pointerEvents = "none";
    meter.innerHTML = `<div class="audio-humiliation-bar" style="width:0%;height:0.8em;background:#f9badd;border-radius:1em;margin-bottom:0.2em;transition:width 0.5s,background 0.5s;"></div>\n      <span class="audio-humiliation-taunt"></span>`;
    document.body.appendChild(meter);
  }
  // Responsive placement
  if (window.innerWidth <= 600) {
    meter.style.right = "0.5em";
    meter.style.left = "0.5em";
    meter.style.bottom = "4.5em";
    meter.style.width = "auto";
    meter.style.maxWidth = "90vw";
  } else {
    meter.style.right = "1.5em";
    meter.style.left = "auto";
    meter.style.bottom = "1.5em";
    meter.style.width = "auto";
    meter.style.maxWidth = "320px";
  }
  const count =
    (window._customAudioUrls && Object.keys(window._customAudioUrls).length) ||
    0;
  const bar = meter.querySelector(".audio-humiliation-bar");
  const taunt = meter.querySelector(".audio-humiliation-taunt");
  const percent = Math.min(100, count * 10);
  bar.style.width = percent + "%";
  bar.style.background =
    percent > 80 ? "#fd7bc5" : percent > 50 ? "#ff63a5" : "#f9badd";
  let msg = "";
  if (count === 0) msg = "Audio dignity: Intact (for now)";
  else if (count < 3) msg = "Mildly desperate for new tracks";
  else if (count < 6) msg = "Getting needy for variety...";
  else if (count < 10) msg = "Desperation rising! So many tracks!";
  else msg = "Utterly shameless audio addict!";
  taunt.textContent = msg;
  // --- Show/hide logic ---
  meter.style.opacity = "0.95";
  meter.style.visibility = "visible";
  meter.style.pointerEvents = "none";
  if (humiliationMeterTimeout) clearTimeout(humiliationMeterTimeout);
  // If high tier, keep visible
  if (count >= 10) {
    meter.style.opacity = "0.98";
    meter.style.visibility = "visible";
  } else {
    humiliationMeterTimeout = setTimeout(() => {
      meter.style.opacity = "0";
      meter.style.visibility = "hidden";
    }, 3500);
  }
}

// --- ENSURE AUDIO INITIALIZATION ---
const origInitAudio_1 = initAudio;
initAudio = function () {
  origInitAudio_1.apply(this, arguments);
  setupAudioPanelToggle();
  updateAudioHumiliationMeter();
};

// --- JOI MODE GLOBAL EXPOSURE (calls gallery.js implementation) ---
if (
  typeof window !== "undefined" &&
  typeof window.startJOIMode !== "function"
) {
  window.startJOIMode = function () {
    if (
      typeof window.kexplorer === "object" &&
      typeof window.kexplorer.startJOIMode === "function"
    ) {
      window.kexplorer.startJOIMode();
    } else if (typeof startJOIMode === "function") {
      startJOIMode();
    } else {
      alert("JOI mode is not available.");
    }
  };
}

// --- AZURE TTS VOICE SELECTOR BUTTON ---
import { showAzureVoiceSelector } from "./azure-tts.js";

function addAzureVoiceSelectorButton() {
  const controls = document.querySelector(".audio-controls");
  if (!controls || document.getElementById("azure-voice-btn")) return;
  const btn = document.createElement("button");
  btn.id = "azure-voice-btn";
  btn.textContent = "Azure Voice";
  btn.className = "browse-btn";
  btn.style.marginLeft = "1em";
  btn.onclick = showAzureVoiceSelector;
  controls.appendChild(btn);
}

// Patch into initAudio to always add the button
const origInitAudio_2 = initAudio;
initAudio = function () {
  origInitAudio_2.apply(this, arguments);
  addAzureVoiceSelectorButton();
};

// All functions in this file are defined and used as follows:

// getAudioSrc: used by loadTrack
// loadTrack: used by nextTrack, previousTrack, onTrackEnded, initAudio, shuffleTracks
// togglePlayback: used by initAudio, keyboard shortcut
// nextTrack: used by initAudio, keyboard shortcut
// previousTrack: used by initAudio, keyboard shortcut
// toggleMoan: used by initAudio
// toggleMoanPlayback: used by initAudio
// togglePanel: used by initAudio
// onTrackEnded: used by initAudio
// initAudio: called from main.js and sets up all event listeners
// initAudioUI: called from main.js, sets up the add-track UI
// addTrackByUrl: used by initAudioUI
// loadLastTrack: used by initAudio
// saveLastTrack: used by loadTrack, nextTrack, previousTrack
// showAudioToast: used by initAudioUI
// getCurrentTrack: exported, not used internally (for external use)
// getAudioFiles: exported, not used internally

export {
  initAudio,
  initAudioUI,
  // Optionally export other functions if needed elsewhere
};
