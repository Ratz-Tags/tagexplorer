import {
  initSidebar,
  setAllArtists as setSidebarArtists,
} from '../sidebar.js';
import {
  initAudio,
  initAudioUI,
  syncAudioPanelLayout,
  toggleGlobalMute,
  getGlobalMuteState,
  triggerBassPulse,
} from '../audio.js';
import {
  initTags,
  setAllArtists as setTagsArtists,
  setRenderArtistsCallback,
  setRandomBackgroundCallback,
  setTagTooltips,
  setTagTaunts,
  setTaunts,
  getActiveTags,
  getArtistNameFilter,
  renderTagButtons,
  setTagSearchMode,
  hydrateTagState,
  handleArtistNameFilter,
} from '../tags.js';
import {
  initGallery,
  filterArtists,
  setRandomBackground,
  setAllArtists as setGalleryArtists,
  setGetActiveTagsCallback,
  setGetArtistNameFilterCallback,
  setSortMode,
  setSortPreference,
  getPaginationInfo,
  getCurrentPage,
  setCurrentPage,
  renderArtistsPage,
  getFilteredArtists,
} from '../gallery.js';
import {
  initUI,
  setupInfiniteScroll,
  setupBackgroundRotation,
  showToast,
  vibrate,
  vibratePattern,
} from '../ui.js';
import {
  loadAppData,
  persistGalleryState,
  restoreGalleryState,
} from '../api.js';
import { startTauntTicker, setHumiliationArtists } from '../humiliation.js';
import { createTTSToggleButton, createTTSIntensityControl } from '../tts-toggle.js';
import {
  initTagExplorer,
  toggleTagExplorer,
  setAllArtists as setExplorerArtists,
} from '../tag-explorer.js';
import { showAzureVoiceSelector } from '../azure-tts.js';
import { configureWhisperCatalog, dispatchWhisperEvent } from '../tts-dispatcher.js';
import {
  evaluateRitualTriggers,
  getRitualCatalog,
  getStateSnapshot as getRitualStateSnapshot,
  registerCompletion as registerRitualCompletion,
  registerDismissal as registerRitualDismissal,
  registerReset as registerRitualReset,
} from '../rituals/gallery-rituals.js';
import {
  initShameDossier,
  openShameDossier,
  getDossierEntries,
} from '../shame-dossier.js';
import { incrementPressure } from '../progression/pressure-meter.js';
import { setIndulgenceLevel } from '../audio/humiliation-audio.js';
import {
  recordVisit as recordStreakVisit,
  getStreakState as getStreakSnapshot,
  getStreakTier as getCurrentStreakTier,
  getStreakTierInfo,
  isStreakTrackingEnabled,
  setStreakTrackingEnabled,
  onStreakChange as onStreakUpdate,
} from '../progression/streaks.js';

const MOTION_STORAGE_KEY = 'te.motion.preference';
const MOTION_DEFAULT = 'full';
const IDLE_THRESHOLD_MS = 60000;
const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? (callback) => queueMicrotask(callback)
  : (callback) => Promise.resolve().then(callback);

const COMMAND_STORAGE_NAMESPACE = 'tx:haze:v1';
const COMMAND_STORAGE_KEY = 'commandDeck';

const COMMAND_KEYBOARD_BINDINGS = {
  KeyK: 'kneel',
  KeyC: 'confess',
  KeyS: 'siren',
  KeyE: 'escape',
};

const COMMAND_PRESETS = {
  kneel: {
    id: 'kneel',
    label: 'KNEEL',
    tagsAdd: ['leash', 'viewer_on_leash', 'restraints'],
    tagsRemove: ['humiliation', 'body_writing', 'public_nudity', 'mind_break', 'hypnosis', 'orgasm_denial'],
    asmrLevel: 2,
    pressureDelta: 8,
    minIntensity: 2,
    maxIntensity: 3,
    whisper: 'Down. Knees on the glass and leash tags locked.',
    announcement: 'Command deck engaged: Kneel preset stacked restraints and leash filters.',
    haptic: [20, 26, 20],
    bass: { intensity: 0.64, durationMs: 480 },
  },
  confess: {
    id: 'confess',
    label: 'CONFESS',
    tagsAdd: ['humiliation', 'body_writing', 'public_nudity'],
    tagsRemove: ['leash', 'viewer_on_leash', 'restraints', 'hypnosis', 'mind_break', 'orgasm_denial'],
    asmrLevel: 1,
    pressureDelta: 6,
    minIntensity: 1,
    maxIntensity: 3,
    whisper: 'Confess everything. Let the gallery read every humiliating detail.',
    announcement: 'Command deck engaged: Confess preset broadcasting humiliation filters.',
    haptic: [18, 18, 32],
    bass: { intensity: 0.52, durationMs: 420 },
  },
  siren: {
    id: 'siren',
    label: 'SIREN',
    tagsAdd: ['hypnosis', 'mind_break', 'orgasm_denial'],
    tagsRemove: ['humiliation', 'body_writing', 'public_nudity', 'leash', 'viewer_on_leash', 'restraints'],
    asmrLevel: 3,
    pressureDelta: 10,
    minIntensity: 2,
    maxIntensity: 3,
    whisper: 'Siren triggered. Hypnosis, denial, and mind-break queued on repeat.',
    announcement: 'Command deck engaged: Siren preset floods trance and denial filters.',
    haptic: [24, 18, 24, 18, 32],
    bass: { intensity: 0.82, durationMs: 640, allowInCover: true },
  },
  escape: {
    id: 'escape',
    label: 'ESCAPE',
    tagsAdd: [],
    tagsRemove: [],
    asmrLevel: 0,
    pressureDelta: -12,
    minIntensity: 1,
    maxIntensity: 2,
    whisper: 'Run then. Your shame log stays warm for when you crawl back.',
    announcement: 'Command deck cleared. Restored your saved filters and muted indulgence.',
    haptic: [18, 32, 22, 48],
    bass: { intensity: 0.42, durationMs: 420 },
  },
};

const COMMAND_DEFAULT_STATE = {
  active: null,
  baselineTags: [],
  lastManualTags: [],
  lastAppliedAt: 0,
  asmrLevel: 0,
};

let commandDeckState = { ...COMMAND_DEFAULT_STATE };
let commandButtons = new Map();
let commandAnnouncer = null;
let commandMotionPromise = null;
let commandPulseTimer = null;
let commandStorageFaultLogged = false;

let ritualHost = null;
let ritualQueue = [];
let currentRitualActivation = null;
let currentRitualElement = null;
let ritualElementCleanup = [];
let ritualFoldMode = 'default';


function sanitizeTagList(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const cleaned = [];
  tags.forEach((tag) => {
    if (typeof tag !== 'string') {
      if (tag == null) return;
      tag = String(tag);
    }
    const normalized = tag.trim().toLowerCase().replace(/\s+/g, '_');
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    cleaned.push(normalized);
  });
  return cleaned.slice(0, 32);
}

function readCommandNamespace() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(COMMAND_STORAGE_NAMESPACE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    if (!commandStorageFaultLogged) {
      console.warn('[gallery] command deck storage read failed', error);
      commandStorageFaultLogged = true;
    }
    return {};
  }
}

function loadCommandDeckState() {
  const namespace = readCommandNamespace();
  const stored = namespace?.[COMMAND_STORAGE_KEY];
  if (!stored || typeof stored !== 'object') {
    commandDeckState = { ...COMMAND_DEFAULT_STATE };
    return commandDeckState;
  }
  const activeKey = typeof stored.active === 'string' && COMMAND_PRESETS[stored.active]
    ? stored.active
    : null;
  commandDeckState = {
    active: activeKey,
    baselineTags: sanitizeTagList(stored.baselineTags),
    lastManualTags: sanitizeTagList(stored.lastManualTags),
    lastAppliedAt: Number(stored.lastAppliedAt) || 0,
    asmrLevel: Number(stored.asmrLevel) || 0,
  };
  if (!commandDeckState.baselineTags.length && commandDeckState.lastManualTags.length) {
    commandDeckState.baselineTags = commandDeckState.lastManualTags.slice();
  }
  return commandDeckState;
}

function persistCommandDeckState() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload = readCommandNamespace();
  payload[COMMAND_STORAGE_KEY] = {
    active: typeof commandDeckState.active === 'string' ? commandDeckState.active : null,
    baselineTags: sanitizeTagList(commandDeckState.baselineTags),
    lastManualTags: sanitizeTagList(commandDeckState.lastManualTags),
    lastAppliedAt: Number(commandDeckState.lastAppliedAt) || Date.now(),
    asmrLevel: Number(commandDeckState.asmrLevel) || 0,
  };
  try {
    window.localStorage.setItem(COMMAND_STORAGE_NAMESPACE, JSON.stringify(payload));
  } catch (error) {
    if (!commandStorageFaultLogged) {
      console.warn('[gallery] command deck storage write failed', error);
      commandStorageFaultLogged = true;
    }
  }
}

function applyCommandVisualState(commandId) {
  const normalized = typeof commandId === 'string' && commandId ? commandId : null;
  const assign = (node) => {
    if (!node || !node.dataset) return;
    if (normalized) {
      node.dataset.commandState = normalized;
    } else {
      delete node.dataset.commandState;
    }
  };
  assign(document.documentElement);
  assign(document.body);
  assign(document.querySelector('.command-bar-shell'));
  assign(document.querySelector('.cover-command-bar'));
  assign(document.querySelector('.command-deck'));
  assign(document.querySelector('.cover-command-deck'));
}

function updateCommandDeckButtons() {
  const active = typeof commandDeckState.active === 'string' ? commandDeckState.active : null;
  commandButtons.forEach((buttonSet, commandId) => {
    buttonSet.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const isActive = active === commandId;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.classList.toggle('is-active', isActive);
    });
  });
}

function announceCommand(message) {
  if (!commandAnnouncer) return;
  commandAnnouncer.textContent = message || '';
}

function shouldReduceMotionForCommands() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true;
  const motionDataset = document.body?.dataset?.motion || document.documentElement?.dataset?.motion;
  if (motionDataset === 'reduced') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (error) {
    return false;
  }
}

async function loadCommandMotionModule() {
  if (shouldReduceMotionForCommands()) return null;
  if (!commandMotionPromise) {
    commandMotionPromise = import('https://cdn.jsdelivr.net/npm/motion@10.16.4/+esm')
      .catch((error) => {
        console.warn('[gallery] command motion import failed', error);
        return null;
      });
  }
  try {
    return await commandMotionPromise;
  } catch (error) {
    console.warn('[gallery] command motion load failed', error);
    return null;
  }
}

function hexToRGBA(value, alpha = 1) {
  const hex = String(value || '').trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return `rgba(102, 243, 255, ${alpha})`;
  let hexValue = match[1];
  if (hexValue.length === 3) {
    hexValue = hexValue.split('').map((ch) => ch + ch).join('');
  }
  const num = parseInt(hexValue, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCommandAccentColor() {
  if (typeof document === 'undefined') return '#66f3ff';
  try {
    const computed = getComputedStyle(document.body);
    const value = computed.getPropertyValue('--command-accent');
    return value ? value.trim() || '#66f3ff' : '#66f3ff';
  } catch (error) {
    return '#66f3ff';
  }
}

function buildCommandAnimationSteps(commandId) {
  const steps = [];
  if (typeof document === 'undefined') return steps;
  const shell = document.querySelector('.command-bar-shell');
  const background = document.querySelector('.background-lattice');
  const deck = document.querySelector('.command-deck');
  const coverDeck = document.querySelector('.cover-command-deck');
  const isCover = document.body?.dataset?.foldMode === 'fold-cover';
  const deckTarget = isCover && coverDeck ? coverDeck : deck;
  const accent = getCommandAccentColor();
  const accentGlow = hexToRGBA(accent, 0.55);
  const accentSoft = hexToRGBA(accent, 0.28);

  if (deckTarget) {
    steps.push([
      deckTarget,
      {
        transform: ['scale(0.96)', 'scale(1.06)', 'scale(1)'],
        boxShadow: ['0 0 0 rgba(0,0,0,0)', `0 26px 58px -26px ${accentGlow}`, `0 16px 32px -28px ${accentSoft}`],
      },
      { duration: 0.72, easing: 'cubic-bezier(.4,-0.2,.2,1.2)' },
    ]);
  }
  if (shell) {
    steps.push([
      shell,
      {
        transform: ['translateY(-10px)', 'translateY(0)'],
        filter: ['drop-shadow(0 0 0 rgba(0,0,0,0))', `drop-shadow(0 18px 42px ${accentGlow})`],
      },
      { duration: 0.78, easing: 'cubic-bezier(.4,-0.2,.2,1.2)', at: '<' },
    ]);
  }
  if (background) {
    const filters = {
      kneel: ['saturate(0.95) brightness(0.92)', 'saturate(1.22) brightness(1.12)'],
      confess: ['saturate(0.9) brightness(0.9)', 'saturate(1.28) brightness(1.1)'],
      siren: ['saturate(1) brightness(0.9)', 'saturate(1.38) brightness(1.16)'],
      escape: ['saturate(0.9) brightness(0.88)', 'saturate(1) brightness(0.96)'],
    };
    const filterFrames = filters[commandId] || ['saturate(0.95)', 'saturate(1.1)'];
    steps.push([
      background,
      { filter: filterFrames },
      { duration: 1.1, easing: 'ease-out', at: '<' },
    ]);
  }
  if (commandId === 'siren' && deckTarget) {
    steps.push([
      deckTarget,
      {
        opacity: [1, 0.82, 1],
        filter: ['drop-shadow(0 0 0 rgba(0,0,0,0))', `drop-shadow(0 0 22px ${accentGlow})`, `drop-shadow(0 0 10px ${accentSoft})`],
      },
      { duration: 1.4, easing: 'ease-out', at: 0.08 },
    ]);
  }
  return steps;
}

function applyCommandFallbackPulse() {
  if (typeof document === 'undefined') return;
  const deck = document.querySelector('.command-deck');
  const coverDeck = document.querySelector('.cover-command-deck');
  [deck, coverDeck].forEach((node) => {
    if (!node) return;
    node.classList.add('command-deck--pulse');
  });
  if (commandPulseTimer) clearTimeout(commandPulseTimer);
  commandPulseTimer = setTimeout(() => {
    [deck, coverDeck].forEach((node) => node && node.classList.remove('command-deck--pulse'));
  }, 420);
}

async function runCommandAnimation(commandId, { silent = false } = {}) {
  if (silent) {
    applyCommandFallbackPulse();
    return;
  }
  if (!commandId || shouldReduceMotionForCommands()) {
    applyCommandFallbackPulse();
    return;
  }
  const motion = await loadCommandMotionModule();
  if (!motion || typeof motion.timeline !== 'function') {
    applyCommandFallbackPulse();
    return;
  }
  const steps = buildCommandAnimationSteps(commandId);
  if (!steps.length) {
    applyCommandFallbackPulse();
    return;
  }
  try {
    motion.timeline(steps, {
      defaultOptions: {
        duration: 0.86,
        easing: 'cubic-bezier(.4,-0.2,.2,1.2)',
        fill: 'forwards',
      },
    });
  } catch (error) {
    console.warn('[gallery] command animation failed', error);
    applyCommandFallbackPulse();
  }
}

function handleCommandEscape({ silent = false, source = 'button' } = {}) {
  const preset = COMMAND_PRESETS.escape;
  let baseline = commandDeckState.baselineTags.length
    ? commandDeckState.baselineTags.slice()
    : commandDeckState.lastManualTags.length
    ? commandDeckState.lastManualTags.slice()
    : sanitizeTagList(Array.from((typeof getActiveTags === 'function' ? getActiveTags() : []) || []));
  if (!baseline.length) {
    baseline = [];
  }
  hydrateTagState(baseline);
  if (typeof setRandomBackground === 'function') {
    setRandomBackground();
  }
  try {
    setIndulgenceLevel(preset.asmrLevel ?? 0, { source: 'command-deck' });
    commandDeckState.asmrLevel = preset.asmrLevel ?? 0;
  } catch (error) {
    if (!commandStorageFaultLogged) {
      console.warn('[gallery] command deck indulgence reset failed', error);
    }
  }
  if (!silent && Number.isFinite(preset.pressureDelta) && preset.pressureDelta !== 0) {
    incrementPressure(preset.pressureDelta, { source: 'command:escape' });
  }
  if (!silent && preset.bass) {
    try {
      triggerBassPulse({ ...preset.bass });
    } catch (error) {
      console.warn('[gallery] bass pulse failed for escape command', error);
    }
  }
  if (!silent && preset.whisper) {
    dispatchWhisperEvent('command_escape', {
      text: preset.whisper,
      minIntensity: preset.minIntensity ?? 1,
      maxIntensity: preset.maxIntensity ?? 2,
    });
  }
  if (!silent) {
    if (Array.isArray(preset.haptic)) {
      vibratePattern(preset.haptic);
    } else {
      vibrate(32);
    }
  }
  commandDeckState.active = null;
  commandDeckState.baselineTags = sanitizeTagList(baseline);
  commandDeckState.lastManualTags = commandDeckState.baselineTags.slice();
  commandDeckState.lastAppliedAt = Date.now();
  applyCommandVisualState(null);
  updateCommandDeckButtons();
  if (!silent) {
    announceCommand(preset.announcement || 'Command deck cleared.');
  }
  runCommandAnimation('escape', { silent });
  persistCommandDeckState();
}

function handleCommandAction(commandId, { silent = false, source = 'button', preserveBaseline = false } = {}) {
  const normalized = String(commandId || '').toLowerCase();
  if (!normalized) return;
  if (normalized === 'escape') {
    handleCommandEscape({ silent, source });
    return;
  }
  const preset = COMMAND_PRESETS[normalized];
  if (!preset) return;
  if (!preserveBaseline && !commandDeckState.active) {
    try {
      const snapshot = sanitizeTagList(Array.from(getActiveTags()));
      if (snapshot.length) {
        commandDeckState.baselineTags = snapshot;
        commandDeckState.lastManualTags = snapshot.slice();
      }
    } catch (error) {
      commandDeckState.baselineTags = [];
    }
  }
  const baseline = commandDeckState.baselineTags.length
    ? commandDeckState.baselineTags.slice()
    : sanitizeTagList(Array.from((typeof getActiveTags === 'function' ? getActiveTags() : []) || []));
  const nextTagsSet = new Set(baseline);
  (preset.tagsRemove || []).forEach((tag) => nextTagsSet.delete(tag));
  (preset.tagsAdd || []).forEach((tag) => nextTagsSet.add(tag));
  const nextTags = Array.from(nextTagsSet);
  hydrateTagState(nextTags);
  if (typeof setRandomBackground === 'function') {
    setRandomBackground();
  }
  try {
    const nextLevel = Number(preset.asmrLevel ?? commandDeckState.asmrLevel ?? 0);
    setIndulgenceLevel(nextLevel, { source: 'command-deck' });
    commandDeckState.asmrLevel = nextLevel;
  } catch (error) {
    if (!commandStorageFaultLogged) {
      console.warn('[gallery] command deck indulgence sync failed', error);
    }
  }
  if (!silent && Number.isFinite(preset.pressureDelta) && preset.pressureDelta !== 0) {
    incrementPressure(preset.pressureDelta, { source: `command:${normalized}` });
  }
  if (!silent && preset.bass) {
    try {
      triggerBassPulse({ ...preset.bass });
    } catch (error) {
      console.warn('[gallery] bass pulse failed for command', error);
    }
  }
  if (!silent && preset.whisper) {
    dispatchWhisperEvent(`command_${normalized}`, {
      text: preset.whisper,
      minIntensity: preset.minIntensity ?? 1,
      maxIntensity: preset.maxIntensity ?? 3,
    });
  }
  commandDeckState.active = normalized;
  commandDeckState.lastAppliedAt = Date.now();
  applyCommandVisualState(normalized);
  updateCommandDeckButtons();
  if (!silent) {
    announceCommand(preset.announcement || `${preset.label || normalized} preset engaged.`);
  }
  runCommandAnimation(normalized, { silent });
  if (!silent) {
    if (Array.isArray(preset.haptic)) {
      vibratePattern(preset.haptic);
    } else {
      vibrate(36);
    }
  }
  persistCommandDeckState();
}

async function setupCommandDeck() {
  if (typeof document === 'undefined') return () => {};
  await customElements.whenDefined('te-command-bar');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  commandAnnouncer = document.getElementById('command-deck-announcement') || null;
  commandButtons = new Map();
  const buttonCleanups = [];
  const buttonNodes = Array.from(document.querySelectorAll('[data-command-action]'));
  buttonNodes.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const commandId = String(btn.dataset.commandAction || '').toLowerCase();
    if (!commandId) return;
    if (!commandButtons.has(commandId)) {
      commandButtons.set(commandId, new Set());
    }
    commandButtons.get(commandId).add(btn);
    const onClick = () => handleCommandAction(commandId, { source: 'button' });
    btn.addEventListener('click', onClick);
    buttonCleanups.push(() => btn.removeEventListener('click', onClick));
  });
  loadCommandDeckState();
  if (!commandDeckState.lastManualTags.length) {
    try {
      const snapshot = sanitizeTagList(Array.from(getActiveTags()));
      commandDeckState.lastManualTags = snapshot;
      commandDeckState.baselineTags = snapshot.slice();
    } catch (error) {
      commandDeckState.lastManualTags = [];
      commandDeckState.baselineTags = [];
    }
  }
  if (commandDeckState.active && COMMAND_PRESETS[commandDeckState.active]) {
    applyCommandVisualState(commandDeckState.active);
    handleCommandAction(commandDeckState.active, { silent: true, source: 'hydrate', preserveBaseline: true });
  } else {
    applyCommandVisualState(null);
    updateCommandDeckButtons();
  }
  if (commandAnnouncer) {
    announceCommand('Command deck ready. Shift+K kneels, Shift+C confesses, Shift+S triggers the siren, Shift+E escapes.');
  }
  persistCommandDeckState();
  const handleTagsUpdate = (event) => {
    if (commandDeckState.active) return;
    const nextTags = Array.isArray(event?.detail?.activeTags)
      ? sanitizeTagList(event.detail.activeTags)
      : sanitizeTagList(Array.from((typeof getActiveTags === 'function' ? getActiveTags() : []) || []));
    commandDeckState.lastManualTags = nextTags;
    commandDeckState.baselineTags = nextTags.slice();
    persistCommandDeckState();
  };
  document.addEventListener('tags:updated', handleTagsUpdate);
  const handleKeydown = (event) => {
    if (!event || event.defaultPrevented) return;
    if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    const tagName = target?.tagName;
    if (tagName) {
      const normalized = tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(normalized)) return;
    }
    if (target?.isContentEditable) return;
    
    
    const commandId = COMMAND_KEYBOARD_BINDINGS[event.code];
    if (!commandId) return;
    event.preventDefault();
    handleCommandAction(commandId, { source: 'keyboard' });
  };
  document.addEventListener('keydown', handleKeydown);
  return () => {
    buttonCleanups.forEach((cleanup) => cleanup());
    document.removeEventListener('tags:updated', handleTagsUpdate);
    document.removeEventListener('keydown', handleKeydown);
    commandButtons.clear();
    commandAnnouncer = null;
  };
}

function readMotionPreference() {
  if (typeof window === 'undefined') return MOTION_DEFAULT;
  try {
    const value = window.localStorage.getItem(MOTION_STORAGE_KEY);
    if (value === 'reduced' || value === 'full') {
      return value;
    }
  } catch {
    // Ignore storage access failures.
  }
  return MOTION_DEFAULT;
}

function applyMotionPreference(mode) {
  if (typeof document === 'undefined') return MOTION_DEFAULT;
  const normalized = mode === 'reduced' ? 'reduced' : 'full';
  document.documentElement.dataset.motion = normalized;
  document.body.dataset.motion = normalized;
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }
  try {
    document.dispatchEvent(
      new CustomEvent('motion:change', { detail: { mode: normalized } }),
    );
  } catch {
    // Ignore custom event dispatch failures.
  }
  return normalized;
}

function setupPressureProgression() {
  if (typeof document === 'undefined') {
    return {
      trackDepth() {},
      resetBaseline() {},
      dispose() {},
    };
  }

  let deepestPageSeen = 0;

  const computePageMarker = (info) => {
    if (!info || typeof info !== 'object') return 0;
    const candidates = [info.lastRenderedPage, info.currentPage];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
    }
    return 0;
  };

  const resetBaseline = () => {
    const info = getPaginationInfo();
    if (!info) return;
    const marker = computePageMarker(info);
    if (typeof marker === 'number' && Number.isFinite(marker) && marker > deepestPageSeen) {
      deepestPageSeen = marker;
    }
  };

  const trackDepth = () => {
    const info = getPaginationInfo();
    if (!info) return;
    const marker = computePageMarker(info);
    if (!Number.isFinite(marker) || marker <= deepestPageSeen) return;
    const delta = marker - deepestPageSeen;
    deepestPageSeen = marker;
    const amount = Math.min(12, Math.max(3, 2 + delta * 2));
    incrementPressure(amount, { source: 'gallery-depth' });
  };

  resetBaseline();

  return {
    trackDepth,
    resetBaseline,
    dispose() {},
  };
}

function ensureRitualHost() {
  if (ritualHost && document.body && document.body.contains(ritualHost)) {
    return ritualHost;
  }
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById('ritual-overlay-host');
  if (existing) {
    ritualHost = existing;
    return ritualHost;
  }
  ritualHost = document.createElement('div');
  ritualHost.id = 'ritual-overlay-host';
  ritualHost.className = 'ritual-overlay-host';
  ritualHost.setAttribute('aria-live', 'polite');
  ritualHost.setAttribute('aria-relevant', 'additions removals');
  document.body.appendChild(ritualHost);
  return ritualHost;
}

function disposeRitualElement() {
  if (ritualElementCleanup.length) {
    ritualElementCleanup.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn('[gallery-page] ritual cleanup failed', error);
      }
    });
    ritualElementCleanup = [];
  }
  if (currentRitualElement && currentRitualElement.remove) {
    try {
      currentRitualElement.remove();
    } catch {
      if (currentRitualElement.parentElement) {
        currentRitualElement.parentElement.removeChild(currentRitualElement);
      }
    }
  }
  currentRitualElement = null;
  currentRitualActivation = null;
  if (ritualHost) {
    delete ritualHost.dataset.active;
  }
}

function updateRitualFoldMode(mode) {
  ritualFoldMode = mode || 'default';
  if (currentRitualElement && typeof currentRitualElement.setFoldMode === 'function') {
    currentRitualElement.setFoldMode(ritualFoldMode);
  }
}

function attachRitualListeners(element) {
  if (!element) return;
  const handleComplete = (event) => {
    const ritualId = event?.detail?.id || currentRitualActivation?.id;
    if (ritualId) {
      registerRitualCompletion(ritualId);
    }
    const whisper = currentRitualActivation?.ritual?.whispers?.complete;
    if (whisper) {
      dispatchWhisperEvent('ritual_complete', {
        text: whisper,
        minIntensity: 2,
      });
    }
    disposeRitualElement();
    processRitualQueue();
  };
  const handleDismiss = (event) => {
    const ritualId = event?.detail?.id || currentRitualActivation?.id;
    if (ritualId) {
      registerRitualDismissal(ritualId);
    }
    const whisper = currentRitualActivation?.ritual?.whispers?.dismiss;
    if (whisper) {
      dispatchWhisperEvent('ritual_dismiss', {
        text: whisper,
        minIntensity: 1,
      });
    }
    disposeRitualElement();
    processRitualQueue();
  };
  const handleReset = (event) => {
    const ritualId = event?.detail?.id || currentRitualActivation?.id;
    if (ritualId) {
      registerRitualReset(ritualId);
    }
    dispatchWhisperEvent('ritual_reset', {
      text: 'Fine. Resetting ritual progress. Try stacking the glow again.',
      minIntensity: 1,
      force: true,
    });
  };

  const listeners = [
    ['ritual:complete', handleComplete],
    ['ritual:dismiss', handleDismiss],
    ['ritual:reset', handleReset],
  ];

  listeners.forEach(([eventName, handler]) => {
    element.addEventListener(eventName, handler);
    ritualElementCleanup.push(() => element.removeEventListener(eventName, handler));
  });
}

function openRitualOverlay(activation) {
  if (!activation || !activation.ritual) return;
  const host = ensureRitualHost();
  if (!host) return;
  disposeRitualElement();
  currentRitualActivation = activation;
  const element = document.createElement('te-gallery-ritual');
  currentRitualElement = element;
  host.innerHTML = '';
  host.appendChild(element);
  host.dataset.active = 'true';
  attachRitualListeners(element);
  if (typeof element.setFoldMode === 'function') {
    element.setFoldMode(ritualFoldMode);
  }
  if (typeof element.configure === 'function') {
    element.configure({ ritual: activation.ritual, foldMode: ritualFoldMode });
  }
  const whisper = activation.ritual?.whispers?.unlock;
  if (whisper) {
    dispatchWhisperEvent('ritual_unlock', {
      text: whisper,
      cooldownMs: activation.ritual.cooldownMs,
      minIntensity: 2,
      forceGlobal: true,
    });
  }
  const audioCue = activation.ritual?.audio || {};
  triggerBassPulse({
    intensity: audioCue.pulseIntensity,
    durationMs: audioCue.durationMs,
    allowWhileMuted: false,
    allowInCover: false,
  });
}

function processRitualQueue() {
  if (currentRitualElement) return;
  if (!ritualQueue.length) return;
  const next = ritualQueue.shift();
  openRitualOverlay(next);
}

function queueRitualActivations(activations = []) {
  activations.forEach((activation) => {
    if (!activation?.id) return;
    if (currentRitualActivation?.id === activation.id) return;
    const alreadyQueued = ritualQueue.some((entry) => entry.id === activation.id);
    if (!alreadyQueued) {
      ritualQueue.push(activation);
    }
  });
  processRitualQueue();
}

function setupRitualObserver() {
  if (typeof document === 'undefined') {
    return () => {};
  }
  ensureRitualHost();
  const handleUpdate = () => {
    const activations = evaluateRitualTriggers();
    if (Array.isArray(activations) && activations.length) {
      queueRitualActivations(activations);
    }
  };
  document.addEventListener('tags:updated', handleUpdate);
  // Evaluate once for hydrated state
  scheduleMicrotask(() => handleUpdate());
  return () => {
    document.removeEventListener('tags:updated', handleUpdate);
    ritualQueue = [];
    disposeRitualElement();
    if (ritualHost) {
      ritualHost.innerHTML = '';
    }
  };
}

function setupVoiceSelectorButton() {
  const audioControls = document.querySelector('.audio-controls');
  if (!audioControls) return;

  let voiceBtn = document.getElementById('azure-voice-style-btn');
  if (!voiceBtn) {
    voiceBtn = document.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.id = 'azure-voice-style-btn';
    voiceBtn.className = 'audio-pill';
    voiceBtn.textContent = 'Voice & Style';
    voiceBtn.setAttribute('aria-haspopup', 'dialog');
    voiceBtn.setAttribute('aria-expanded', 'false');
    voiceBtn.addEventListener('click', () => {
      showAzureVoiceSelector();
    });
    audioControls.appendChild(voiceBtn);
  }
  if (!voiceBtn.dataset.selectorBound) {
    const updateExpandedState = (event) => {
      const isOpen = Boolean(event?.detail?.open);
      voiceBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };
    document.addEventListener('azureTTS:selector', updateExpandedState);
    voiceBtn.dataset.selectorBound = 'true';
  }
}

function setupThemeToggle() {
  const themeToggles = Array.from(document.querySelectorAll('.theme-toggle'));
  const bodyEl = document.body;
  if (!bodyEl) return;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'incognito') {
    bodyEl.classList.add('incognito-theme');
    bodyEl.classList.remove('fem-theme');
    setRandomBackground();
  } else {
    bodyEl.classList.add('fem-theme');
    bodyEl.classList.remove('incognito-theme');
  }
  if (!themeToggles.length) return;
  const handleToggle = () => {
    bodyEl.classList.toggle('incognito-theme');
    bodyEl.classList.toggle('fem-theme');
    const current = bodyEl.classList.contains('incognito-theme') ? 'incognito' : 'fem';
    localStorage.setItem('theme', current);
    setRandomBackground();
  };
  themeToggles.forEach((toggleEl) => {
    toggleEl.addEventListener('click', handleToggle);
  });
}

function setupTagSearchModeSelector() {
  const tagSearchModeSelect = document.createElement('select');
  tagSearchModeSelect.id = 'tag-search-mode';
  tagSearchModeSelect.innerHTML = `
    <option value="contains">Contains</option>
    <option value="starts">Starts with</option>
    <option value="ends">Ends with</option>
  `;
  tagSearchModeSelect.className = 'field-input mt-2 sm:mt-0 sm:w-36 text-[0.6rem] uppercase tracking-[0.3em]';
  const tagSearchInput = document.getElementById('tag-search');
  if (tagSearchInput && tagSearchInput.parentNode) {
    tagSearchInput.parentNode.insertBefore(tagSearchModeSelect, tagSearchInput.nextSibling);
    tagSearchModeSelect.addEventListener('change', (e) => {
      setTagSearchMode(e.target.value);
    });
  }
}

async function setupFavoritesButton() {
  await customElements.whenDefined('te-command-bar');
  await new Promise(resolve => setTimeout(resolve, 0));

  const favoritesBtn = document.getElementById('favorites-btn');
  const favoritesCount = document.getElementById('favorites-count');
  if (!favoritesBtn) return;

  let showingFavorites = false;

  favoritesBtn.addEventListener('click', async () => {
    const { filterGalleryToFavorites, clearGalleryFilters } = await import('../gallery.js');
    const { getFavoritesCount } = await import('../favorites.js');

    if (getFavoritesCount() === 0) {
      showToast('No trophies on your wall yet. Go star someone before begging.', 4200);
      // Ensure the command bar button keeps focus for keyboard users
      requestAnimationFrame(() => {
        if (typeof favoritesBtn.focus === 'function') {
          favoritesBtn.focus({ preventScroll: true });
        }
      });
      return;
    }

    showingFavorites = !showingFavorites;

    if (showingFavorites) {
      filterGalleryToFavorites();
      favoritesBtn.classList.add('active');
      favoritesBtn.setAttribute('aria-pressed', 'true');
    } else {
      clearGalleryFilters();
      favoritesBtn.classList.remove('active');
      favoritesBtn.setAttribute('aria-pressed', 'false');
    }
  });

  document.addEventListener('favorites:changed', (e) => {
    if (favoritesCount) {
      const count = e.detail.count;
      favoritesCount.textContent = count;
      favoritesCount.classList.toggle('hidden', count === 0);
    }

    if (favoritesBtn) {
      const count = e.detail.count;
      favoritesBtn.disabled = count === 0;
      if (count === 0 && favoritesBtn.classList.contains('active')) {
        favoritesBtn.classList.remove('active');
        favoritesBtn.setAttribute('aria-pressed', 'false');
      }
    }
  });

  (async () => {
    const { getFavoritesCount } = await import('../favorites.js');
    const count = getFavoritesCount();
    if (favoritesCount) {
      favoritesCount.textContent = count;
      favoritesCount.classList.toggle('hidden', count === 0);
    }
    favoritesBtn.disabled = count === 0;
  })();
}

function setupSidebarToggle() {
  const copiedSidebarEl = document.getElementById('copied-sidebar');
  if (!copiedSidebarEl) return;
  const sidebarWrapper = copiedSidebarEl.closest('.sidebar-wrapper');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleButtons = Array.from(document.querySelectorAll('.sidebar-toggle'));

  const setSidebarHidden = (hidden, { userInitiated = false } = {}) => {
    const isHidden = Boolean(hidden);
    
    // Move focus away from sidebar before hiding to prevent aria-hidden focus warning
    if (isHidden && copiedSidebarEl.contains(document.activeElement)) {
      document.activeElement?.blur();
      // Try to focus a safe element like the body
      document.body.focus();
    }
    
    copiedSidebarEl.classList.toggle('sidebar-hidden', isHidden);
    copiedSidebarEl.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    if (sidebarWrapper) {
      sidebarWrapper.classList.toggle('visible', !isHidden);
      sidebarWrapper.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    }
    if (overlay) {
      const foldMode = document.documentElement?.dataset?.foldMode;
      const shouldShowOverlay = !isHidden && foldMode !== 'fold-inner';
      overlay.style.display = shouldShowOverlay ? 'block' : 'none';
      overlay.setAttribute('aria-hidden', shouldShowOverlay ? 'false' : 'true');
    }
    document.body.classList.toggle('sidebar-open', !isHidden);
    if (userInitiated) {
      copiedSidebarEl.dataset.userHidden = isHidden ? 'true' : 'false';
    }
  };

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const willHide = !copiedSidebarEl.classList.contains('sidebar-hidden');
      setSidebarHidden(willHide, { userInitiated: true });
    });
  });

  // Use event delegation to handle both static and dynamically created close buttons
  copiedSidebarEl.addEventListener('click', (e) => {
    if (e.target.closest('.copied-sidebar-close')) {
      setSidebarHidden(true, { userInitiated: true });
    }
  });

  // Overlay click closes sidebar
  if (overlay) {
    overlay.addEventListener('click', () => {
      setSidebarHidden(true, { userInitiated: true });
    });
  }

  // Escape key closes sidebar
  copiedSidebarEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setSidebarHidden(true, { userInitiated: true });
    }
  });

  // Touch swipe left to close (mobile UX)
  let touchStartX = null;
  copiedSidebarEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
    }
  });
  copiedSidebarEl.addEventListener('touchend', (e) => {
    if (touchStartX !== null && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx < -60) {
        setSidebarHidden(true, { userInitiated: true });
      }
    }
    touchStartX = null;
  });

  copiedSidebarEl._setSidebarHidden = (hidden, options = {}) => {
    setSidebarHidden(hidden, options);
  };

  // Initialize visibility - start hidden by default
  // (syncSidebarForFold will handle fold-inner mode separately)
  const initiallyHidden = copiedSidebarEl.classList.contains('sidebar-hidden');
  setSidebarHidden(initiallyHidden);
}

function setupAudioToggle() {
  const audioPanelEl = document.getElementById('audio-panel');
  if (!audioPanelEl) return;
  const audioToggleButtons = Array.from(document.querySelectorAll('.audio-toggle'));

  const setAudioHidden = (hidden) => {
    const isHidden = Boolean(hidden);
    audioPanelEl.classList.toggle('hidden', isHidden);
    audioPanelEl.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
    audioToggleButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
      btn.classList.toggle('is-active', !isHidden);
    });
    syncAudioPanelLayout();
  };

  audioToggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const willHide = !audioPanelEl.classList.contains('hidden');
      setAudioHidden(willHide);
    });
  });

  setAudioHidden(audioPanelEl.classList.contains('hidden'));
}

function setupMuteToggle() {
  const muteBtn = document.getElementById('cover-mute-btn');
  if (!muteBtn) return;

  const updateButtonState = (muted) => {
    const isMuted = Boolean(muted);
    muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    muteBtn.classList.toggle('is-active', isMuted);
    muteBtn.dataset.state = isMuted ? 'muted' : 'unmuted';
    const label = muteBtn.querySelector('.cover-command-label');
    if (label) {
      label.textContent = isMuted ? 'Muted' : 'Mute';
    }
  };

  updateButtonState(typeof getGlobalMuteState === 'function' ? getGlobalMuteState() : false);

  muteBtn.addEventListener('click', () => {
    const muted = typeof toggleGlobalMute === 'function' ? toggleGlobalMute() : false;
    updateButtonState(muted);
  });

  document.addEventListener('audio:mutechange', (event) => {
    if (!event?.detail || typeof event.detail.muted === 'undefined') return;
    updateButtonState(Boolean(event.detail.muted));
  });
}

async function setupDossierButton() {
  await customElements.whenDefined('te-command-bar');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const entries = [
    { el: document.getElementById('dossier-btn'), source: 'inner' },
    { el: document.getElementById('cover-dossier-btn'), source: 'cover' },
  ].filter(({ el }) => el instanceof HTMLElement);

  if (!entries.length) {
    initShameDossier();
    return;
  }

  const setExpanded = (isOpen) => {
    entries.forEach(({ el }) => {
      if (!el) return;
      el.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      el.classList.toggle('is-active', Boolean(isOpen));
    });
  };

  const setHasEntries = (hasEntries) => {
    entries.forEach(({ el }) => {
      if (!el) return;
      if (hasEntries) {
        el.dataset.hasEntries = 'true';
      } else {
        delete el.dataset.hasEntries;
      }
    });
  };

  setHasEntries(false);
  setExpanded(false);

  entries.forEach(({ el, source }) => {
    el.addEventListener('click', () => {
      openShameDossier({ source });
    });
  });

  document.addEventListener('dossier:toggle', (event) => {
    setExpanded(Boolean(event?.detail?.open));
  });

  document.addEventListener('dossier:append', () => setHasEntries(true));
  document.addEventListener('dossier:cleared', () => setHasEntries(false));

  initShameDossier().then(() => {
    const hasAny = (getDossierEntries() || []).length > 0;
    setHasEntries(hasAny);
    setExpanded(false);
  });
}

function setupMotionToggle(initialMode) {
  const desiredMode = initialMode || readMotionPreference();
  const motionBtn = document.getElementById('cover-motion-btn');

  const updateButtonState = (mode) => {
    if (!motionBtn) return;
    const normalized = mode === 'reduced' ? 'reduced' : 'full';
    const isReduced = normalized === 'reduced';
    motionBtn.setAttribute('aria-pressed', isReduced ? 'true' : 'false');
    motionBtn.setAttribute(
      'aria-label',
      isReduced ? 'Enable motion animations' : 'Reduce motion animations',
    );
    motionBtn.classList.toggle('is-active', isReduced);
    motionBtn.dataset.state = normalized;
    const label = motionBtn.querySelector('.cover-command-label');
    if (label) {
      label.textContent = isReduced ? 'Motion Off' : 'Motion';
    }
  };

  const applyAndUpdate = (mode) => {
    const normalized = applyMotionPreference(mode);
    updateButtonState(normalized);
  };

  if (!motionBtn) {
    applyAndUpdate(desiredMode);
    return () => {};
  }

  applyAndUpdate(desiredMode);

  motionBtn.addEventListener('click', () => {
    const nextMode = motionBtn.dataset.state === 'reduced' ? 'full' : 'reduced';
    applyAndUpdate(nextMode);
  });

  document.addEventListener('motion:change', (event) => {
    if (!event?.detail?.mode) return;
    updateButtonState(event.detail.mode);
  });

  return (mode) => {
    if (mode) {
      applyAndUpdate(mode);
    }
  };
}

function formatArtistTags(artist, { limit = 2 } = {}) {
  if (!artist || !Array.isArray(artist.kinkTags) || artist.kinkTags.length === 0) {
    return '';
  }
  const safeLimit = Math.max(1, Math.min(limit, artist.kinkTags.length));
  return artist.kinkTags
    .slice(0, safeLimit)
    .map((tag) => tag.replace(/_/g, ' '))
    .join(', ');
}

function selectSpotlightForWhisper(artists = [], tier = 0) {
  if (!Array.isArray(artists) || artists.length === 0) {
    return null;
  }
  const threshold = tier >= 3 ? 180 : tier >= 2 ? 120 : 60;
  const preferred = artists.filter((artist) => Number(artist.postCount) >= threshold);
  const pool = preferred.length ? preferred : artists;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createStreakWhisperLine(detail, artists = []) {
  if (!detail || !detail.trackingEnabled || !detail.didIncrement) return null;
  const count = Number(detail.state?.count) || 0;
  const info = getStreakTierInfo(count);
  let baseLine;
  if (detail.wasReset && count === 1) {
    baseLine = 'Chain snapped and you crawled back anyway. Day one is already logged again.';
  } else if (count === 1) {
    baseLine = 'Day one recorded. You barely hesitated before indulging again.';
  } else {
    baseLine = `Day ${count}. ${info.label} tier acknowledged.`;
  }
  if ((detail.tier || 0) < 2) {
    return baseLine;
  }
  const spotlight = selectSpotlightForWhisper(artists, detail.tier || 0);
  if (!spotlight) return baseLine;
  const tagLine = formatArtistTags(spotlight, { limit: detail.tier >= 3 ? 3 : 2 });
  if (tagLine) {
    return `${baseLine} Spotlight ${spotlight.artistName} drowning in ${tagLine}.`;
  }
  return `${baseLine} Spotlight ${spotlight.artistName}.`;
}

function formatStreakToast(detail) {
  if (!detail) return null;
  if (detail.reason === 'toggle') {
    return detail.trackingEnabled
      ? 'Streak tracking resumed. Every visit counts again.'
      : 'Streak tracking paused. Ghost mode engaged.';
  }
  if (!detail.trackingEnabled) return null;
  if (detail.reason === 'opted-out' || detail.reason === 'invalid') return null;
  const count = Number(detail.state?.count) || 0;
  if (detail.wasReset && detail.didIncrement && count === 1) {
    return 'Chain snapped. Back to day one.';
  }
  if (!detail.didIncrement) return null;
  const info = getStreakTierInfo(count);
  let message = `Day ${count}: ${info.label} tier engaged.`;
  if (info.nextThreshold && info.nextThreshold > count) {
    const remaining = info.nextThreshold - count;
    const nextInfo = getStreakTierInfo(info.nextThreshold);
    message += ` ${remaining} more day${remaining === 1 ? '' : 's'} to ${nextInfo.label}.`;
  }
  return message;
}

function setupStreakBadges({ initialDetail } = {}) {
  const innerChip = document.getElementById('streak-chip');
  const coverChip = document.getElementById('cover-streak-btn');
  if (!innerChip && !coverChip) {
    return () => {};
  }

  const announcers = Array.from(document.querySelectorAll('[data-streak-announcer]'));
  const innerValue = innerChip?.querySelector('[data-streak-count]');
  const innerTier = innerChip?.querySelector('[data-streak-tier]');
  const innerLabel = innerChip?.querySelector('[data-streak-label]');
  const coverValue = coverChip?.querySelector('[data-streak-count]');

  const applyDetail = (detail) => {
    const trackingEnabled = detail?.trackingEnabled !== false && isStreakTrackingEnabled();
    const count = trackingEnabled ? Math.max(0, Number(detail?.state?.count) || 0) : 0;
    const tierInfo = trackingEnabled ? getStreakTierInfo(count) : getStreakTierInfo(0);
    const tierLabel = tierInfo?.label || 'Dormant';
    const summary = trackingEnabled
      ? `Day ${count} streak. ${tierLabel}.`
      : 'Streak tracking paused.';

    announcers.forEach((node) => {
      if (node) node.textContent = summary;
    });

    if (innerChip) {
      innerChip.setAttribute('aria-pressed', trackingEnabled ? 'true' : 'false');
      innerChip.setAttribute(
        'aria-label',
        trackingEnabled
          ? `Disable streak tracking. Day ${count} — ${tierLabel}.`
          : 'Enable streak tracking. Ghost mode active.',
      );
      if (trackingEnabled && tierInfo?.id) {
        innerChip.dataset.tier = tierInfo.id;
      } else {
        delete innerChip.dataset.tier;
      }
      if (innerValue) innerValue.textContent = trackingEnabled ? String(count) : '—';
      if (innerTier) innerTier.textContent = trackingEnabled ? tierLabel.toUpperCase() : 'GHOST MODE';
      if (innerLabel) innerLabel.textContent = count === 1 ? 'DAY CAPTURED' : 'DAY STREAK';
    }

    if (coverChip) {
      coverChip.setAttribute('aria-pressed', trackingEnabled ? 'true' : 'false');
      coverChip.setAttribute(
        'aria-label',
        trackingEnabled
          ? `Toggle streak tracking off. ${count} day chain, ${tierLabel}.`
          : 'Toggle streak tracking on. Streak tracking paused.',
      );
      if (trackingEnabled && tierInfo?.id) {
        coverChip.dataset.tier = tierInfo.id;
      } else {
        delete coverChip.dataset.tier;
      }
      if (coverValue) coverValue.textContent = trackingEnabled ? String(count) : '—';
    }
  };

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setStreakTrackingEnabled(!isStreakTrackingEnabled());
  };

  if (innerChip) innerChip.addEventListener('click', handleClick);
  if (coverChip) coverChip.addEventListener('click', handleClick);

  const unsubscribe = onStreakUpdate((detail) => applyDetail(detail));

  applyDetail(
    initialDetail || {
      state: getStreakSnapshot(),
      trackingEnabled: isStreakTrackingEnabled(),
      tier: getCurrentStreakTier(),
    },
  );

  return () => {
    if (innerChip) innerChip.removeEventListener('click', handleClick);
    if (coverChip) coverChip.removeEventListener('click', handleClick);
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}

function setupStreakSystem({ artists }) {
  const visitDetail = recordStreakVisit({ reason: 'gallery:init', emit: true });
  const badgeCleanup = setupStreakBadges({ initialDetail: visitDetail });

  const handleDetail = (detail) => {
    if (!detail) return;
    const toast = formatStreakToast(detail);
    if (toast) {
      showToast(toast);
    }
    if (detail.trackingEnabled && detail.didIncrement) {
      triggerBassPulse(Math.min(1, 0.35 + (detail.tier || 0) * 0.18));
      const whisperLine = createStreakWhisperLine(detail, artists);
      if (whisperLine) {
        dispatchWhisperEvent('streak_increment', {
          text: whisperLine,
          minIntensity: Math.max(1, detail.tier || 1),
          maxIntensity: 3,
          cooldownMs: 4600,
        });
      }
    }
  };

  if (visitDetail) {
    handleDetail(visitDetail);
  }

  const unsubscribe = onStreakUpdate((detail) => handleDetail(detail));

  return () => {
    if (typeof badgeCleanup === 'function') badgeCleanup();
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}

// Settings sheet removed - functionality now only in inner command bar

function updateCommandStatusLabels(mode) {
  const labels = document.querySelectorAll('.command-status__label');
  const normalized = mode || 'default';
  labels.forEach((label) => {
    const target = label?.dataset?.mode ? `fold-${label.dataset.mode}` : null;
    const isActive = target && target === normalized;
    label.classList.toggle('is-active', Boolean(isActive));
    label.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}

function syncSidebarForFold(mode) {
  const sidebar = document.getElementById('copied-sidebar');
  if (!sidebar || typeof sidebar._setSidebarHidden !== 'function') return;
  if (typeof sidebar.dataset.foldPrevHidden !== 'undefined') {
    delete sidebar.dataset.foldPrevHidden;
  }
  const userPreference = sidebar.dataset.userHidden;
  const isCurrentlyHidden = sidebar.classList.contains('sidebar-hidden');
  let shouldHide;
  if (userPreference === 'true') {
    shouldHide = true;
  } else if (userPreference === 'false') {
    shouldHide = false;
  } else {
    shouldHide = isCurrentlyHidden;
  }
  sidebar._setSidebarHidden(shouldHide);
}

function setupFoldModeSync({ foldAdapter, closeSettings }) {
  const applyMode = (mode) => {
    const normalized = mode || 'default';
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.foldMode = normalized;
      document.body.dataset.foldMode = normalized;
      const shellRoot = document.querySelector('[data-shell]');
      if (shellRoot) {
        shellRoot.dataset.foldMode = normalized;
      }
    }
    updateRitualFoldMode(normalized);
    updateCommandStatusLabels(normalized);
    if (normalized !== 'fold-cover' && typeof closeSettings === 'function') {
      closeSettings();
    }
    if (normalized !== 'fold-cover' && typeof document !== 'undefined') {
      document.body.classList.remove('filters-open');
    }
    syncSidebarForFold(normalized);
  };

  const currentMode =
    (foldAdapter && typeof foldAdapter.getMode === 'function' && foldAdapter.getMode()) ||
    document.body.dataset.foldMode ||
    'default';
  applyMode(currentMode);

  if (!foldAdapter || typeof foldAdapter.subscribe !== 'function') {
    return () => {};
  }

  const unsubscribe = foldAdapter.subscribe((mode) => {
    applyMode(mode || 'default');
  });

  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
}

function setupSortControls() {
  const sortSelect = document.getElementById('sort-by');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {});
  }
  const sortButtonElem = document.getElementById('sort-button');
  if (sortButtonElem && sortSelect) {
    sortButtonElem.addEventListener('click', () => {
      setSortMode(sortSelect.value);
    });
  }
  const sortPreferenceElem = document.getElementById('sort-preference');
  if (sortPreferenceElem) {
    sortPreferenceElem.addEventListener('change', (e) => {
      setSortPreference(e.target.value);
    });
  }
}

async function setupFiltersButton() {
  // Wait for command-bar web component to be defined
  await customElements.whenDefined('te-command-bar');
  
  // Small delay to ensure DOM is updated
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const filterButtons = [
    document.getElementById('filters-btn'),
    document.getElementById('cover-filters-btn'),
  ].filter(Boolean);
  if (!filterButtons.length) return;

  filterButtons.forEach((btn) => {
    if (btn.dataset.tagExplorerToggleBound === 'true') return;
    btn.addEventListener('click', toggleTagExplorer, { once: false });
    btn.dataset.tagExplorerToggleBound = 'true';
    btn.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('tagFilters:toggle', (event) => {
    const isOpen = Boolean(event?.detail?.open);
    filterButtons.forEach((btn) => {
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.body.classList.toggle('filters-open', isOpen);
  });
}

async function setupForceFetch() {
  await customElements.whenDefined('te-command-bar');
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const forceFetchBtn = document.getElementById('force-fetch-btn');
  if (forceFetchBtn) {
    forceFetchBtn.addEventListener('click', async () => {
      try {
        const { forceFetchStyleTags } = await import('../gallery.js');
        await forceFetchStyleTags({ refreshCounts: true });
      } catch (error) {
        console.error('Failed to launch force fetch', error);
      }
    });
  }
  
  // NovelAI Prompter toggle button
  const prompterToggleBtn = document.getElementById('prompter-toggle-btn');
  if (prompterToggleBtn) {
    prompterToggleBtn.addEventListener('click', async () => {
      try {
        const { togglePrompter } = await import('../components/novelai-prompter.js');
        togglePrompter();
      } catch (error) {
        console.error('[gallery] Failed to toggle prompter:', error);
      }
    });
  }
}

function setupIdleWhispers() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  let idleTimer = null;

  const schedule = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      dispatchWhisperEvent('idle', { minIntensity: 1 });
      schedule();
    }, IDLE_THRESHOLD_MS);
  };

  const handleActivity = () => {
    if (document.visibilityState === 'hidden') return;
    schedule();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (idleTimer) clearTimeout(idleTimer);
    } else {
      schedule();
    }
  };

  const events = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart', 'focus'];
  events.forEach((eventName) =>
    window.addEventListener(eventName, handleActivity, { passive: true })
  );
  document.addEventListener('visibilitychange', handleVisibility);

  schedule();

  return () => {
    if (idleTimer) clearTimeout(idleTimer);
    events.forEach((eventName) =>
      window.removeEventListener(eventName, handleActivity)
    );
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

export async function initGalleryPage({ foldAdapter } = {}) {
  const savedState = restoreGalleryState();

  const { artists, tooltips, generalTaunts, tagTaunts, ttsLines } = await loadAppData();

  initUI();
  initSidebar();
  await initAudio();
  initAudioUI();
  createTTSToggleButton();
  createTTSIntensityControl();
  setupVoiceSelectorButton();
  setupAudioToggle();
  setupMuteToggle();
  setupMotionToggle(readMotionPreference());
  const pressureProgression = setupPressureProgression();
  const foldCleanup = setupFoldModeSync({
    foldAdapter,
  });

  // Don't call setRandomBackground() here - let the controller handle it after initialization

  await initShameDossier();
  
  // Initialize tags first and ensure they're loaded before proceeding
  console.log('[gallery] Initializing tags...');
  await initTags(artists, filterArtists, setRandomBackground);
  console.log('[gallery] Tags initialized, setting up gallery...');
  
  initGallery();

  setSidebarArtists(artists);
  setTagsArtists(artists);
  setGalleryArtists(artists);
  setExplorerArtists(artists);

  setRenderArtistsCallback(filterArtists);
  setRandomBackgroundCallback(setRandomBackground);
  setGetActiveTagsCallback(getActiveTags);
  setGetArtistNameFilterCallback(getArtistNameFilter);

  setTagTooltips(tooltips);
  setTagTaunts(tagTaunts);
  setTaunts(generalTaunts);
  setHumiliationArtists(artists);
  configureWhisperCatalog({
    events: ttsLines,
    tags: tagTaunts,
    generalTaunts,
  });
  startTauntTicker(generalTaunts, 30000);
  const streakCleanup = setupStreakSystem({ artists });

  const quotes = Object.values(tooltips || {}).filter(Boolean);
  if (quotes.length > 0) {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    const taglineElem = document.getElementById('tagline');
    if (taglineElem) taglineElem.textContent = random;
  }

  let hydrated = false;
  if (savedState?.tags?.length) {
    hydrateTagState(savedState.tags, { silent: true });
    hydrated = true;
  }
  if (typeof savedState?.artistNameFilter === 'string' && savedState.artistNameFilter) {
    handleArtistNameFilter(savedState.artistNameFilter);
    const nameInput = document.getElementById('artist-name-filter');
    if (nameInput) nameInput.value = savedState.artistNameFilter;
    hydrated = true;
  }
  if (!hydrated) {
    renderTagButtons();
    filterArtists();
  }

  if (pressureProgression && typeof pressureProgression.resetBaseline === 'function') {
    pressureProgression.resetBaseline();
  }

  // Initialize tag explorer after tags are confirmed to be loaded
  console.log('[gallery] Initializing tag explorer...');
  try {
    initTagExplorer();
    console.log('[gallery] Tag explorer initialized successfully');
  } catch (error) {
    console.error('[gallery] Failed to initialize tag explorer:', error);
  }
  
  // Initialize NovelAI Prompt Generator (after tags are loaded)
  try {
    const { initNovelAIPrompter, setPrompterArtists, setPrompterKinkTags } = await import('../components/novelai-prompter.js');
    const { getKinkTags, getKinkTagsByCategory } = await import('../tags.js');
    // Wait a bit for tags to be fully loaded
    setTimeout(async () => {
      const { initNovelAIPrompter, setPrompterArtists, setPrompterKinkTags, setGetActiveTagsCallback } = await import('../components/novelai-prompter.js');
      await initNovelAIPrompter(artists, getKinkTags(), getKinkTagsByCategory());
      setPrompterArtists(artists);
      setPrompterKinkTags(getKinkTags(), getKinkTagsByCategory());
      setGetActiveTagsCallback(getActiveTags);
      console.log('[gallery] NovelAI Prompter initialized');
    }, 500);
  } catch (error) {
    console.warn('[gallery] Failed to initialize NovelAI Prompter:', error);
  }
  
  setupBackgroundRotation(setRandomBackground, {
    getActiveTags,
    getFilteredArtists,
    getPaginationInfo,
  });
  setupInfiniteScroll({
    onForward: () => {
      const info = getPaginationInfo();
      if (!info?.hasMoreForward) return;
      renderArtistsPage({ direction: 'forward' });
      if (pressureProgression && typeof pressureProgression.trackDepth === 'function') {
        pressureProgression.trackDepth();
      }
    },
    onBackward: () => {
      const info = getPaginationInfo();
      if (!info?.hasMoreBackward) return;
      renderArtistsPage({ direction: 'backward' });
      if (pressureProgression && typeof pressureProgression.resetBaseline === 'function') {
        pressureProgression.resetBaseline();
      }
    },
    infoProvider: () => getPaginationInfo(),
  });

  const ritualCleanup = setupRitualObserver();

  setupThemeToggle();
  setupTagSearchModeSelector();
  setupSidebarToggle();
  setupSortControls();
  setupFiltersButton();
  setupForceFetch();
  setupFavoritesButton();
  setupDossierButton();

  const commandDeckCleanup = await setupCommandDeck();

  const idleCleanup = setupIdleWhispers();

  window.kexplorer = {
    filterArtists,
    setRandomBackground,
    getActiveTags,
    renderTagButtons,
  };

  if (typeof window !== 'undefined') {
    window.txRituals = {
      list: () => getRitualCatalog(),
      state: () => getRitualStateSnapshot(),
      reset: (id) => registerRitualReset(id),
      dismiss: (id) => registerRitualDismissal(id),
      complete: (id) => registerRitualCompletion(id),
    };
  }

  if (typeof savedState?.scrollY === 'number') {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedState.scrollY, behavior: 'auto' });
    });
  }

  const persistState = () => {
    persistGalleryState({
      tags: Array.from(getActiveTags()),
      artistNameFilter: getArtistNameFilter(),
      scrollY: window.scrollY,
    });
  };

  return {
    beforeNavigate: persistState,
    onDispose: () => {
      persistState();
      if (typeof foldCleanup === 'function') foldCleanup();
      if (typeof idleCleanup === 'function') idleCleanup();
      if (pressureProgression && typeof pressureProgression.dispose === 'function') {
        pressureProgression.dispose();
      }
      if (typeof commandDeckCleanup === 'function') {
        commandDeckCleanup();
      }
      if (typeof ritualCleanup === 'function') {
        ritualCleanup();
      }
      if (typeof streakCleanup === 'function') {
        streakCleanup();
      }
    },
  };
}

export const initPage = initGalleryPage;
