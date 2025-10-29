declare module '../api.js' {
  export function getArtistBySlug(...args: any[]): Promise<any>;
  export function preloadArtistBySlug(...args: any[]): Promise<any>;
  export function fetchArtistImages(...args: any[]): Promise<any>;
  export function loadAppData(...args: any[]): Promise<any>;
  export function persistGalleryState(...args: any[]): any;
  export function restoreGalleryState(...args: any[]): any;
  export function preloadDataset(...args: any[]): Promise<any>;
}

declare module './api.js' {
  export { getArtistBySlug, preloadArtistBySlug, fetchArtistImages, loadAppData, persistGalleryState, restoreGalleryState, preloadDataset } from '../api.js';
}

declare module '../favorites.js' {
  export function loadFavorites(...args: any[]): any;
  export function toggleFavorite(...args: any[]): boolean;
  export function isFavorite(...args: any[]): boolean;
}

declare module '../sidebar.js' {
  export function initSidebar(...args: any[]): any;
  export function setAllArtists(...args: any[]): any;
}

declare module '../audio.js' {
  export function initAudio(...args: any[]): Promise<any>;
  export function initAudioUI(...args: any[]): any;
  export function syncAudioPanelLayout(...args: any[]): any;
  export function toggleGlobalMute(...args: any[]): any;
  export function getGlobalMuteState(...args: any[]): boolean;
  export function triggerBassPulse(...args: any[]): any;
}

declare module '../tags.js' {
  export function initTags(...args: any[]): Promise<any>;
  export function setAllArtists(...args: any[]): any;
  export function setRenderArtistsCallback(...args: any[]): any;
  export function setRandomBackgroundCallback(...args: any[]): any;
  export function setTagTooltips(...args: any[]): any;
  export function setTagTaunts(...args: any[]): any;
  export function setTaunts(...args: any[]): any;
  export function getActiveTags(...args: any[]): any;
  export function getArtistNameFilter(...args: any[]): any;
  export function renderTagButtons(...args: any[]): any;
  export function setTagSearchMode(...args: any[]): any;
  export function hydrateTagState(...args: any[]): any;
  export function handleArtistNameFilter(...args: any[]): any;
}

declare module '../gallery.js' {
  export function initGallery(...args: any[]): any;
  export function filterArtists(...args: any[]): any;
  export function setRandomBackground(...args: any[]): any;
  export function setAllArtists(...args: any[]): any;
  export function setGetActiveTagsCallback(...args: any[]): any;
  export function setGetArtistNameFilterCallback(...args: any[]): any;
  export function setSortMode(...args: any[]): any;
  export function setSortPreference(...args: any[]): any;
  export function getPaginationInfo(...args: any[]): any;
  export function getCurrentPage(...args: any[]): any;
  export function setCurrentPage(...args: any[]): any;
  export function renderArtistsPage(...args: any[]): any;
  export function getFilteredArtists(...args: any[]): any;
  export function forceFetchStyleTags(...args: any[]): Promise<any>;
}

declare module '../ui.js' {
  export function initUI(...args: any[]): any;
  export function setupInfiniteScroll(...args: any[]): any;
  export function setupBackgroundRotation(...args: any[]): Promise<any>;
  export function showToast(...args: any[]): any;
  export function vibrate(...args: any[]): any;
  export function vibratePattern(...args: any[]): any;
}

declare module '../humiliation.js' {
  export function startTauntTicker(...args: any[]): any;
  export function setHumiliationArtists(...args: any[]): any;
}

declare module '../tts-toggle.js' {
  export function createTTSToggleButton(...args: any[]): any;
  export function createTTSIntensityControl(...args: any[]): any;
}

declare module '../tag-explorer.js' {
  export function initTagExplorer(...args: any[]): any;
  export function toggleTagExplorer(...args: any[]): any;
  export function setAllArtists(...args: any[]): any;
}

declare module '../azure-tts.js' {
  export function showAzureVoiceSelector(...args: any[]): any;
  export function ensureDefaultWhisperVoice(...args: any[]): Promise<any>;
}

declare module '../tts-dispatcher.js' {
  export function configureWhisperCatalog(...args: any[]): any;
  export function dispatchWhisperEvent(...args: any[]): any;
}

declare module '../rituals/gallery-rituals.js' {
  export function evaluateRitualTriggers(...args: any[]): any;
  export function getRitualCatalog(...args: any[]): any;
  export function getStateSnapshot(...args: any[]): any;
  export function registerCompletion(...args: any[]): any;
  export function registerDismissal(...args: any[]): any;
  export function registerReset(...args: any[]): any;
}

declare module '../shame-dossier.js' {
  export function initShameDossier(...args: any[]): any;
  export function openShameDossier(...args: any[]): any;
  export function getDossierEntries(...args: any[]): any;
}

declare module '../progression/pressure-meter.js' {
  export function getPressureState(...args: any[]): any;
  export function onPressureChange(...args: any[]): any;
  export function resetPressure(...args: any[]): any;
  export function incrementPressure(...args: any[]): any;
}

declare module '../audio/humiliation-audio.js' {
  export function setIndulgenceLevel(...args: any[]): any;
}

declare module '../progression/streaks.js' {
  export function recordVisit(...args: any[]): any;
  export function getStreakState(...args: any[]): any;
  export function getStreakTier(...args: any[]): any;
  export function getStreakTierInfo(...args: any[]): any;
  export function isStreakTrackingEnabled(...args: any[]): any;
  export function setStreakTrackingEnabled(...args: any[]): any;
  export function onStreakChange(...args: any[]): any;
}

declare module '../favorites.js';

declare module './tts-dispatcher.js' {
  export { dispatchWhisperEvent } from '../tts-dispatcher.js';
}

declare module './components/index.js' {
  export function defineShellComponents(...args: any[]): any;
}

declare module './modules/azure-tts.js' {
  export { ensureDefaultWhisperVoice } from '../modules/azure-tts.js';
}

declare module '../tts-dispatcher.js';
