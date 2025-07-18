/**
 * Audio module - Handles audio controls and playback functionality
 */

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
    toggleBtn.addEventListener("click", togglePlayback);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", nextTrack);
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", previousTrack);
  }

  if (moanBtn) {
    moanBtn.addEventListener("click", toggleMoan);
  }

  if (moanToggle && moanAudio) {
    moanToggle.addEventListener("click", toggleMoanPlayback);
  }

  if (panelToggle) {
    panelToggle.addEventListener("click", togglePanel);
  }

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
    if
