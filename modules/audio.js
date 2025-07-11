/**
 * Audio module - Handles audio controls and playback functionality
 */

let currentTrack = 0;
let moansMuted = true;
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
 * Gets the audio source path for a given track index
 */
function getAudioSrc(index) {
  return `audio/${audioFiles[index]}`;
}

/**
 * Loads and plays a specific track
 */
function loadTrack(index) {
  if (!hypnoAudio || !trackName) return;

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
  loadTrack(currentTrack);
}

/**
 * Plays the previous track in the playlist
 */
function previousTrack() {
  currentTrack = (currentTrack - 1 + audioFiles.length) % audioFiles.length;
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

  // Load initial track
  loadTrack(currentTrack);
}

/**
 * Gets the current track index
 */
function getCurrentTrack() {
  return currentTrack;
}

/**
 * Gets the list of available audio files
 */
function getAudioFiles() {
  return [...audioFiles];
}

// Export functions for ES modules
export {
  initAudio,
  loadTrack,
  togglePlayback,
  nextTrack,
  previousTrack,
  toggleMoan,
  toggleMoanPlayback,
  togglePanel,
  getCurrentTrack,
  getAudioFiles,
};
