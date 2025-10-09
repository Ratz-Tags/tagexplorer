/**
 * Audio module - Handles audio controls and playback functionality
 */

import { vibrate } from "./ui.js";

let currentTrack = 0;
let moansMuted = false;
let moanPlaying = false;

const GLOBAL_MUTE_STORAGE_KEY = 'te.audio.globalMute';
const PLAYLIST_DATA_URL = 'data/audio-playlists.json';
const LAST_PLAYLIST_STORAGE_KEY = 'te.audio.playlist';
const AUTO_PLAYLIST_STORAGE_KEY = 'te.audio.autoPlaylist';
const INTENSITY_SYNC_STORAGE_KEY = 'te.audio.intensitySync';

let globalMute = false;

// Audio file list
const FALLBACK_AUDIO_FILES = [
  "Blank.mp3",
  "Filthy Habits.mp3",
  "Girl Factory.mp3",
  "Layer Zero.mp3",
  "Nipples.mp3",
  "Yes.mp3",
];

let baseAudioFiles = [...FALLBACK_AUDIO_FILES];
let audioFiles = [...FALLBACK_AUDIO_FILES];
let audioFileData = null;
let playlistData = null;
let playlists = [];
let currentPlaylistId = '__all__';
let autoPlaylistEnabled = true;
let intensitySyncEnabled = true;
let motionMode = 'full';
let currentTTSIntensity = 2;
let lastKnownTags = [];

let trackSelectEl = null;
let playlistSelectEl = null;
let playlistAutoToggle = null;
let intensitySyncToggle = null;

const CUSTOM_TRACK_PREFIX = 'custom-track';

function getCustomAudioRegistry() {
  if (typeof window === 'undefined') return null;
  if (!window._customAudioUrls) {
    window._customAudioUrls = {};
  }
  return window._customAudioUrls;
}

function findCustomTrackKeyByUrl(url) {
  const registry = getCustomAudioRegistry();
  if (!registry) return null;
  const keys = Object.keys(registry);
  for (let i = 0; i < keys.length; i += 1) {
    const entry = registry[keys[i]];
    if (typeof entry === 'string' && entry === url) {
      return keys[i];
    }
    if (entry && typeof entry === 'object' && entry.url === url) {
      return keys[i];
    }
  }
  return null;
}

function deriveLabelFromUrl(url) {
  if (!url) return 'Custom track';
  try {
    const sanitizedUrl = url.split('?')[0].split('#')[0];
    const fileName = sanitizedUrl.split('/').pop();
    if (!fileName) return 'Custom track';
    const decoded = decodeURIComponent(fileName);
    return decoded
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Custom track';
  } catch (error) {
    console.warn('[audio] failed to derive custom track label', error);
    return 'Custom track';
  }
}

function registerCustomAudioUrl(url) {
  const normalizedUrl = url.trim();
  const registry = getCustomAudioRegistry();
  if (!registry || !normalizedUrl) return null;
  const existingKey = findCustomTrackKeyByUrl(normalizedUrl);
  if (existingKey) {
    return existingKey;
  }
  const key = `${CUSTOM_TRACK_PREFIX}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  registry[key] = {
    url: normalizedUrl,
    label: deriveLabelFromUrl(normalizedUrl),
    addedAt: Date.now(),
  };
  return key;
}

function getCustomTrackEntry(key) {
  if (typeof window === 'undefined') return null;
  const registry = window._customAudioUrls;
  if (!registry || !key) return null;
  const value = registry[key];
  if (!value) return null;
  if (typeof value === 'string') {
    return {
      key,
      url: value,
      label: deriveLabelFromUrl(value),
    };
  }
  if (typeof value === 'object' && value.url) {
    return {
      key,
      url: value.url,
      label: value.label || deriveLabelFromUrl(value.url),
    };
  }
  return null;
}

function ensureCustomTracksAppended() {
  const registry = getCustomAudioRegistry();
  if (!registry) return;
  const customKeys = Object.keys(registry);
  if (!customKeys.length) return;
  const missingKeys = customKeys.filter((key) => !audioFiles.includes(key));
  if (!missingKeys.length) return;
  audioFiles = audioFiles.concat(missingKeys);
}

// Detect if we're in a subdirectory and need path prefix
function getPathPrefix() {
  const audioPanel = document.querySelector('te-audio-panel');
  if (audioPanel && audioPanel.hasAttribute('data-src-prefix')) {
    return audioPanel.getAttribute('data-src-prefix');
  }
  // Check if current path suggests we're in a subdirectory
  const path = window.location.pathname;
  if (path.includes('/gallery/') || path.includes('/artist/') || path.includes('/about/')) {
    return '../';
  }
  return '';
}

async function loadAudioFileData() {
  try {
    const prefix = getPathPrefix();
    const response = await fetch(`${prefix}data/audio-files.json`);
    if (!response.ok) {
      throw new Error(`Failed to load audio files: ${response.status}`);
    }
    audioFileData = await response.json();
    baseAudioFiles = audioFileData.files.map(file => file.filename);
    audioFiles = baseAudioFiles.slice();
    console.log(`Loaded ${audioFiles.length} audio files from data/audio-files.json`);
    return audioFileData;
  } catch (error) {
    console.warn('Could not load audio file data, using fallback:', error);
    baseAudioFiles = [...FALLBACK_AUDIO_FILES];
    audioFiles = [...FALLBACK_AUDIO_FILES];
    // Create fallback data structure
    const prefix = getPathPrefix();
    audioFileData = {
      generatedAt: new Date().toISOString(),
      totalFiles: audioFiles.length,
      files: audioFiles.map(filename => ({
        filename,
        title: filename.replace(/\.mp3$/i, '').replace(/_/g, ' '),
        path: `${prefix}audio/${filename}`
      }))
    };
    return audioFileData;
  }
}

function normalisePlaylistEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id || entry.slug || entry.label || '').trim();
  if (!id) return null;
  const label = String(entry.label || id).trim();
  const intensity = Number(entry.intensity);
  const tags = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => normalizeTagValue(tag)).filter(Boolean)
    : [];
  const tracks = normalizeTrackList(entry.tracks || entry.files || []);
  return {
    id,
    label,
    intensity: Number.isFinite(intensity) ? intensity : null,
    tags,
    tracks,
  };
}

async function loadPlaylistData() {
  try {
    const prefix = getPathPrefix();
    const response = await fetch(`${prefix}${PLAYLIST_DATA_URL}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load playlists: ${response.status}`);
    }
    const payload = await response.json();
    playlistData = payload;
    const source = Array.isArray(payload?.playlists) ? payload.playlists : [];
    playlists = source
      .map((entry) => normalisePlaylistEntry(entry))
      .filter(Boolean);
    return playlists;
  } catch (error) {
    console.info('[audio] playlist data unavailable, continuing with defaults', error);
    playlists = [];
    playlistData = null;
    return playlists;
  }
}

function getPlaylistById(id) {
  if (!id) return null;
  return playlists.find((playlist) => playlist.id === id) || null;
}

function computePlaylistScore(playlist, { tags = [], intensity = null } = {}) {
  let score = 0;
  const activeTags = new Set((tags || []).map((tag) => normalizeTagValue(tag)));
  if (playlist.tags && playlist.tags.length) {
    const matches = playlist.tags.filter((tag) => activeTags.has(tag)).length;
    score += matches * 4;
  } else {
    score += 1; // reward general playlists slightly
  }
  if (Number.isFinite(intensity) && Number.isFinite(playlist.intensity)) {
    const diff = Math.abs(Number(playlist.intensity) - Number(intensity));
    score -= diff * 1.5;
  }
  if (playlist.tracks && playlist.tracks.length) {
    score += playlist.tracks.length * 0.01;
  }
  return score;
}

function renderPlaylistSelector() {
  if (!playlistSelectEl) return;
  playlistSelectEl.innerHTML = '';
  const autoOption = document.createElement('option');
  autoOption.value = '__auto__';
  autoOption.textContent = 'Auto (tags & intensity)';
  playlistSelectEl.appendChild(autoOption);

  const allOption = document.createElement('option');
  allOption.value = '__all__';
  allOption.textContent = 'All tracks';
  playlistSelectEl.appendChild(allOption);

  playlists.forEach((playlist) => {
    const option = document.createElement('option');
    option.value = playlist.id;
    option.textContent = playlist.label;
    playlistSelectEl.appendChild(option);
  });

  if (autoPlaylistEnabled) {
    playlistSelectEl.value = '__auto__';
  } else {
    playlistSelectEl.value = currentPlaylistId || '__all__';
  }
}

function updatePlaylistToggles() {
  if (playlistAutoToggle) {
    playlistAutoToggle.classList.toggle('is-active', autoPlaylistEnabled);
    playlistAutoToggle.setAttribute('aria-pressed', autoPlaylistEnabled ? 'true' : 'false');
  }
  if (intensitySyncToggle) {
    intensitySyncToggle.classList.toggle('is-active', intensitySyncEnabled);
    intensitySyncToggle.setAttribute('aria-pressed', intensitySyncEnabled ? 'true' : 'false');
  }
  if (playlistSelectEl) {
    if (autoPlaylistEnabled) {
      playlistSelectEl.value = '__auto__';
    } else if (currentPlaylistId) {
      playlistSelectEl.value = currentPlaylistId;
    }
  }
}

function persistPlaylistPreferences() {
  try {
    localStorage.setItem(AUTO_PLAYLIST_STORAGE_KEY, autoPlaylistEnabled ? '1' : '0');
    localStorage.setItem(INTENSITY_SYNC_STORAGE_KEY, intensitySyncEnabled ? '1' : '0');
    if (currentPlaylistId && currentPlaylistId !== '__auto__') {
      localStorage.setItem(LAST_PLAYLIST_STORAGE_KEY, currentPlaylistId);
    }
  } catch (error) {
    // Ignore storage errors
  }
}

function hydratePlaylistPreferences() {
  try {
    const savedAuto = localStorage.getItem(AUTO_PLAYLIST_STORAGE_KEY);
    if (savedAuto === '0' || savedAuto === 'false') {
      autoPlaylistEnabled = false;
    }
    const savedIntensity = localStorage.getItem(INTENSITY_SYNC_STORAGE_KEY);
    if (savedIntensity === '0' || savedIntensity === 'false') {
      intensitySyncEnabled = false;
    }
    const savedPlaylist = localStorage.getItem(LAST_PLAYLIST_STORAGE_KEY);
    if (savedPlaylist) {
      currentPlaylistId = savedPlaylist;
    }
  } catch (error) {
    // Ignore storage errors
  }
}

function setAutoPlaylistEnabled(enabled) {
  autoPlaylistEnabled = Boolean(enabled);
  if (autoPlaylistEnabled) {
    playlistSelectEl && (playlistSelectEl.value = '__auto__');
  } else if (currentPlaylistId === '__auto__') {
    currentPlaylistId = '__all__';
  }
  updatePlaylistToggles();
  persistPlaylistPreferences();
}

function setIntensitySyncEnabled(enabled) {
  intensitySyncEnabled = Boolean(enabled);
  updatePlaylistToggles();
  persistPlaylistPreferences();
  updateAudioIntensityVolume();
}

function updateAudioIntensityVolume() {
  if (!hypnoAudio) return;
  if (globalMute) {
    hypnoAudio.volume = 0;
    if (moanAudio) moanAudio.volume = 0;
    return;
  }
  const levels = [0.0, 0.35, 0.55, 0.78];
  const base = levels[Math.max(0, Math.min(levels.length - 1, Math.floor(currentTTSIntensity)))] || 0.55;
  const motionFactor = motionMode === 'reduced' ? 0.7 : 1;
  const targetVolume = intensitySyncEnabled ? Math.max(0, Math.min(1, base * motionFactor)) : hypnoAudio.volume;
  try {
    hypnoAudio.volume = targetVolume;
    if (moanAudio) {
      moanAudio.volume = moansMuted ? 0 : targetVolume * 0.6;
    }
  } catch (error) {
    console.warn('[audio] failed to update volume', error);
  }
}

function applyPlaylist(playlistId, { reason = 'manual', preserveTrack = false } = {}) {
  let nextId = playlistId || '__all__';
  if (nextId === '__auto__') {
    nextId = currentPlaylistId;
  }
  let nextFiles = baseAudioFiles.slice();
  const playlist = getPlaylistById(nextId);
  if (playlist && playlist.tracks.length) {
    const normalized = playlist.tracks
      .map((track) => baseAudioFiles.find((file) => file.toLowerCase() === track.toLowerCase()))
      .filter(Boolean);
    if (normalized.length > 0) {
      nextFiles = normalized;
      currentPlaylistId = playlist.id;
    } else {
      currentPlaylistId = '__all__';
    }
  } else {
    currentPlaylistId = '__all__';
  }

  const currentTrackName = audioFiles[currentTrack];
  audioFiles = nextFiles;
  ensureCustomTracksAppended();
  renderTrackSelector();

  if (preserveTrack && currentTrackName) {
    const existingIndex = audioFiles.findIndex((file) => file === currentTrackName);
    if (existingIndex >= 0) {
      currentTrack = existingIndex;
    } else {
      currentTrack = 0;
    }
  } else {
    currentTrack = 0;
  }

  loadTrack(currentTrack);
  persistPlaylistPreferences();
  updatePlaylistToggles();

  if (reason === 'auto' && playlistSelectEl) {
    playlistSelectEl.value = '__auto__';
  }
  updateAudioHumiliationMeter();
}

function maybeSelectAutoPlaylist({ tags = [], intensity = null } = {}) {
  if (!autoPlaylistEnabled || playlists.length === 0) return;
  const candidates = playlists
    .map((playlist) => ({ playlist, score: computePlaylistScore(playlist, { tags, intensity }) }))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score <= 0) {
    if (currentPlaylistId !== '__all__') {
      applyPlaylist('__all__', { reason: 'auto', preserveTrack: true });
    }
    return;
  }
  if (best.playlist.id !== currentPlaylistId || currentPlaylistId === '__all__') {
    applyPlaylist(best.playlist.id, { reason: 'auto', preserveTrack: true });
  }
}

function handleTagsUpdatedForAudio(event) {
  const tags = Array.isArray(event?.detail?.activeTags)
    ? event.detail.activeTags.map((tag) => normalizeTagValue(tag))
    : [];
  lastKnownTags = tags;
  maybeSelectAutoPlaylist({ tags, intensity: currentTTSIntensity });
}

function handleTTSIntensityChange(event) {
  const intensity = Number(event?.detail?.intensity);
  if (Number.isFinite(intensity)) {
    currentTTSIntensity = Math.max(0, Math.min(3, Math.floor(intensity)));
    if (intensitySyncEnabled) {
      updateAudioIntensityVolume();
    }
    maybeSelectAutoPlaylist({ tags: lastKnownTags, intensity: currentTTSIntensity });
  }
}

function handleMotionPreference(event) {
  const mode = event?.detail?.mode;
  if (mode === 'reduced' || mode === 'full') {
    motionMode = mode;
    updateAudioIntensityVolume();
  }
}

function normalizeTrackList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const normalized = [];
  list.forEach((item) => {
    if (typeof item !== "string") return;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });
  return normalized;
}

function normalizeTagValue(tag) {
  if (!tag) return '';
  return String(tag).trim().toLowerCase().replace(/\s+/g, '_');
}

function parsePlaylistAttribute(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return normalizeTrackList(raw);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeTrackList(parsed);
      }
    } catch (error) {
      // Not JSON; fall through to comma-separated parsing.
    }
    return normalizeTrackList(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
  }
  return [];
}



function isRemoteTrack(name) {
  return /^https?:\/\//i.test(name);
}

function getTrackLabel(name) {
  if (!name) return "Untitled";

  const customEntry = getCustomTrackEntry(name);
  if (customEntry && customEntry.label) {
    return customEntry.label;
  }

  // Try to find the title from audioFileData first
  if (audioFileData && audioFileData.files) {
    const fileData = audioFileData.files.find(file => file.filename === name);
    if (fileData && fileData.title) {
      return fileData.title;
    }
  }
  
  // Fallback to extracting from filename
  const afterSlash = name.split("/").pop();
  const withoutExt = afterSlash ? afterSlash.replace(/\.[^/.]+$/, "") : name;
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureTrackSelector() {
  if (!trackSelectEl) {
    trackSelectEl = document.getElementById("audio-track-select");
  }
  return trackSelectEl;
}

function highlightActiveTrack() {
  const selector = ensureTrackSelector();
  if (!selector) return;
  selector.value = String(currentTrack);
}

function renderTrackSelector() {
  const selector = ensureTrackSelector();
  if (!selector) return;
  
  // Clear existing options
  selector.innerHTML = "";
  
  // Add default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select a track...";
  selector.appendChild(defaultOption);
  
  // Add options for each audio file
  audioFiles.forEach((file, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = getTrackLabel(file);
    selector.appendChild(option);
  });
  
  // Set current track
  selector.value = String(currentTrack);
  
  // Add change listener only once
  if (!selector.dataset.listenerAdded) {
    selector.addEventListener("change", (event) => {
      const index = parseInt(event.target.value);
      if (!isNaN(index) && index >= 0 && index < audioFiles.length) {
        loadTrack(index);
      }
    });
    selector.dataset.listenerAdded = "true";
  }
}

function safePlay(audioEl) {
  if (!audioEl || !audioEl.src || audioEl.src === "" || audioEl.src === "null") return;
  try {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch (error) {
    // Ignore playback errors caused by browser autoplay policies.
  }
}

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

function syncAudioPanelLayout() {
  if (typeof document === "undefined") return;
  if (!panel) {
    panel = document.getElementById("audio-panel");
  }
  const body = document.body;
  if (!panel || !body) return;
  const isVisible = !panel.classList.contains("hidden");
  body.classList.toggle("audio-panel-open", isVisible);
  panel.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

function updatePlaybackToggleState(isPlaying) {
  if (!toggleBtn) return;
  toggleBtn.textContent = isPlaying ? "⏸️" : "▶️";
  toggleBtn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
}

/**
 * Gets the audio source path for a given track index (supports custom URLs).
 */
function getAudioSrc(index) {
  const name = audioFiles[index];
  if (!name) return "";
  if (isRemoteTrack(name)) {
    return name;
  }
  const prefix = getPathPrefix();
  if (name.startsWith("audio/")) {
    return `${prefix}${name}`;
  }
  if (name.startsWith("./audio/")) {
    return `${prefix}${name.slice(2)}`;
  }
  const customEntry = getCustomTrackEntry(name);
  if (customEntry && customEntry.url) {
    return customEntry.url;
  }
  return `${prefix}audio/${name}`;
}

/**
 * Loads and plays a specific track
 */
function loadTrack(index, { autoplay } = {}) {
  if (!hypnoAudio || !trackName || !audioFiles.length) return;
  const trackCount = audioFiles.length;
  const normalizedIndex = ((index % trackCount) + trackCount) % trackCount;
  currentTrack = normalizedIndex;
  saveLastTrack();
  const src = getAudioSrc(currentTrack);
  if (src) {
    hypnoAudio.src = src;
  }
  trackName.textContent = getTrackLabel(audioFiles[currentTrack]);
  highlightActiveTrack();
  const shouldAutoplay =
    typeof autoplay === "boolean"
      ? autoplay
      : Boolean(hypnoAudio && !hypnoAudio.paused && !hypnoAudio.ended);
  if (shouldAutoplay) {
    safePlay(hypnoAudio);
    updatePlaybackToggleState(true);
  } else {
    try {
      hypnoAudio.pause();
    } catch {
      // Ignore pause errors when audio has not loaded yet.
    }
    updatePlaybackToggleState(false);
  }
}

/**
 * Toggles play/pause for the main audio
 */
function togglePlayback() {
  if (!hypnoAudio || !toggleBtn) return;

  if (hypnoAudio.paused) {
    safePlay(hypnoAudio);
    updatePlaybackToggleState(true);
  } else {
    hypnoAudio.pause();
    updatePlaybackToggleState(false);
  }
}

/**
 * Plays the next track in the playlist
 */
function nextTrack() {
  if (!audioFiles.length) return;
  loadTrack(currentTrack + 1);
}

/**
 * Plays the previous track in the playlist
 */
function previousTrack() {
  if (!audioFiles.length) return;
  loadTrack(currentTrack - 1);
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

function applyGlobalMuteState(muted, { persist = true } = {}) {
  globalMute = Boolean(muted);
  if (hypnoAudio) {
    hypnoAudio.muted = globalMute;
  }
  if (moanAudio) {
    moanAudio.muted = globalMute ? true : moansMuted;
  }
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('audio-muted', globalMute);
  }
  if (persist) {
    try {
      window.localStorage.setItem(
        GLOBAL_MUTE_STORAGE_KEY,
        globalMute ? 'true' : 'false',
      );
    } catch {
      // Ignore storage write failures.
    }
  }
  try {
    document.dispatchEvent(
      new CustomEvent('audio:mutechange', { detail: { muted: globalMute } }),
    );
  } catch {
    // Ignore dispatch errors.
  }
  return globalMute;
}

function toggleGlobalMute() {
  return applyGlobalMuteState(!globalMute);
}

function getGlobalMuteState() {
  return globalMute;
}

function hydrateGlobalMuteFromStorage() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(GLOBAL_MUTE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored === 'true') {
    applyGlobalMuteState(true, { persist: false });
  } else {
    applyGlobalMuteState(false, { persist: false });
  }
}

function shuffleTracks() {
  if (audioFiles.length < 2) return;
  const currentTrackName = audioFiles[currentTrack];
  const shuffled = audioFiles.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  audioFiles = shuffled;
  currentTrack = Math.max(shuffled.indexOf(currentTrackName), 0);
  renderTrackSelector();
  loadTrack(currentTrack);
  showAudioToast("Playlist shuffled", "info");
}

/**
 * Toggles the audio panel visibility
 */
function togglePanel() {
  if (!panel) return;
  panel.classList.toggle("hidden");
  syncAudioPanelLayout();
}

/**
 * Handles track end event by auto-playing next track
 */
function onTrackEnded() {
  if (!audioFiles.length) return;
  loadTrack(currentTrack + 1, { autoplay: true });
}

/**
 * Initializes audio controls and sets up event listeners
 */
async function initAudio() {
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
  playlistSelectEl = document.getElementById("audio-playlist-select");
  playlistAutoToggle = document.getElementById("playlist-autopilot");
  intensitySyncToggle = document.getElementById("audio-intensity-sync");

  await loadAudioFileData();
  await loadPlaylistData();
  hydratePlaylistPreferences();
  renderPlaylistSelector();
  updatePlaylistToggles();
  if (!autoPlaylistEnabled && currentPlaylistId && currentPlaylistId !== '__auto__') {
    applyPlaylist(currentPlaylistId, { reason: 'init', preserveTrack: true });
  }
  maybeSelectAutoPlaylist({ tags: lastKnownTags, intensity: currentTTSIntensity });
  ensureCustomTracksAppended();
  renderTrackSelector();
  syncAudioPanelLayout();

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

  hydrateGlobalMuteFromStorage();
  updateAudioIntensityVolume();

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

  if (playlistSelectEl) {
    playlistSelectEl.addEventListener('change', (event) => {
      const value = event.target.value;
      if (value === '__auto__') {
        setAutoPlaylistEnabled(true);
        maybeSelectAutoPlaylist({ tags: lastKnownTags, intensity: currentTTSIntensity });
      } else {
        setAutoPlaylistEnabled(false);
        applyPlaylist(value, { reason: 'manual' });
      }
    });
  }

  if (playlistAutoToggle) {
    playlistAutoToggle.addEventListener('click', () => {
      const next = !autoPlaylistEnabled;
      setAutoPlaylistEnabled(next);
      if (next) {
        maybeSelectAutoPlaylist({ tags: lastKnownTags, intensity: currentTTSIntensity });
      }
    });
  }

  if (intensitySyncToggle) {
    intensitySyncToggle.addEventListener('click', () => {
      setIntensitySyncEnabled(!intensitySyncEnabled);
    });
  }

  document.addEventListener('tags:updated', handleTagsUpdatedForAudio);
  document.addEventListener('tts:intensity', handleTTSIntensityChange);
  document.addEventListener('motion:change', handleMotionPreference);
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

  const normalizedUrl = url.trim();
  const customKey = registerCustomAudioUrl(normalizedUrl);
  if (!customKey) {
    showAudioToast("Couldn't store that track right now.", "error");
    return;
  }

  const alreadyInPlaylist = audioFiles.includes(customKey);
  ensureCustomTracksAppended();
  if (!alreadyInPlaylist && !audioFiles.includes(customKey)) {
    audioFiles.push(customKey);
  }
  currentTrack = audioFiles.indexOf(customKey);
  renderTrackSelector();
  loadTrack(currentTrack);
  const label = getTrackLabel(customKey);
  if (alreadyInPlaylist) {
    showAudioToast(`Track added: ${label} (already added)`, "info");
  } else {
    showAudioToast(`Track added: ${label}`, "success");
  }
  updateAudioHumiliationMeter();
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
  const saved = Number(localStorage.getItem("lastAudioTrack"));
  if (!Number.isNaN(saved) && saved >= 0) {
    const maxIndex = Math.max(audioFiles.length - 1, 0);
    currentTrack = Math.min(saved, maxIndex);
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
      syncAudioPanelLayout();
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
  const registry = getCustomAudioRegistry();
  const count = registry ? Object.keys(registry).length : 0;
  const bar = meter.querySelector(".audio-humiliation-bar");
  const taunt = meter.querySelector(".audio-humiliation-taunt");
  const percent = Math.min(100, count * 10);
  bar.style.width = percent + "%";
  bar.style.background =
    percent > 80 ? "#fd7bc5" : percent > 50 ? "#ff63a5" : "#f9badd";
  let msg = "";
  if (count === 0) {
    msg = "Audio dignity: Intact (for now).";
  } else if (count === 1) {
    msg = "One forbidden track? You just couldn't resist.";
  } else if (count < 4) {
    msg = `${count} custom cravings already? You're slipping.`;
  } else if (count < 7) {
    msg = `${count} stray moans queued. Building a whole shrine, huh?`;
  } else if (count < 10) {
    msg = `${count} custom tracks. That hunger is getting loud.`;
  } else {
    msg = `${count} custom tracks. You're practically begging for exposure.`;
  }
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
  syncAudioPanelLayout,
  toggleGlobalMute,
  getGlobalMuteState,
  // Optionally export other functions if needed elsewhere
};
