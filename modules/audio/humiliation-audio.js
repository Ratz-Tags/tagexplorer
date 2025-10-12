import {
  getPressureState,
  onPressureChange,
} from '../progression/pressure-meter.js';

const STORAGE_KEY = 'te.audio.indulgenceLevel';
const MANIFEST_URL = 'data/asmr-layers.json';

const INDULGENCE_LABELS = ['Off', 'Curious', 'Needy', 'Desperate'];
const CROSSFADE_MS = 1400;
const MIN_RAMP_MS = 280;
const PLAYBACK_EPSILON = 0.00001;
const DEFAULT_LAYER_PRESET = [
  {
    id: 'breath-soft',
    title: 'Soft breath loops',
    src: 'audio/asmr/breath-soft.webm',
    lane: 1,
    baseVolume: 0.26,
    rateRange: 0.08,
    baseRate: 1,
  },
  {
    id: 'whimper-mid',
    title: 'Quiet whimpers',
    src: 'audio/asmr/whimper-mid.webm',
    lane: 2,
    baseVolume: 0.34,
    rateRange: 0.12,
    baseRate: 1.02,
  },
  {
    id: 'moan-intense',
    title: 'Edge of a moan',
    src: 'audio/asmr/moan-intense.webm',
    lane: 3,
    baseVolume: 0.42,
    rateRange: 0.16,
    baseRate: 0.98,
  },
];

const LAYER_DEFAULTS = {
  baseVolume: 0.32,
  rateRange: 0.1,
  baseRate: 1,
};

let sliderEl = null;
let captionEl = null;
let srAnnounceEl = null;

let indulgenceLevel = 0;
let storedLevelLoaded = false;
let pressureLevel = 0;
let pressureTier = 0;
let ttsLane = 0;
let ttsActive = false;
let coverSuppressed = false;
let privacySuppressed = false;
let globalMute = false;
let reducedVolume = false;
let reducedMotion = false;

let manifestPromise = null;
const layers = new Map();
const layerState = new Map();

let pressureUnsubscribe = null;
let mediaMotionQuery = null;
let ttsEventsBound = false;

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 3) return 3;
  return Math.round(numeric);
}

function getLabelForLevel(level) {
  const index = clampLevel(level);
  return INDULGENCE_LABELS[index] || INDULGENCE_LABELS[0];
}

function loadStoredLevel() {
  if (storedLevelLoaded) return indulgenceLevel;
  storedLevelLoaded = true;
  if (typeof window === 'undefined' || !window.localStorage) {
    indulgenceLevel = 0;
    return indulgenceLevel;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    indulgenceLevel = clampLevel(raw);
  } catch (error) {
    console.warn('[humiliation-audio] failed to read stored level', error);
    indulgenceLevel = 0;
  }
  return indulgenceLevel;
}

function persistLevel(level) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clampLevel(level)));
  } catch (error) {
    console.warn('[humiliation-audio] failed to persist level', error);
  }
}

async function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Manifest response ${response.status}`);
      }
      const data = await response.json();
      const layersList = Array.isArray(data?.layers) ? data.layers : [];
      const normalized = layersList
        .map((entry) => normalizeLayer(entry))
        .filter(Boolean);
      if (normalized.length) {
        return normalized;
      }
    } catch (error) {
      console.warn('[humiliation-audio] manifest load failed, using fallback', error);
    }
    return DEFAULT_LAYER_PRESET.map((entry) => normalizeLayer(entry)).filter(Boolean);
  })();
  return manifestPromise;
}

function normalizeLayer(rawEntry = {}) {
  const src = typeof rawEntry.src === 'string' ? rawEntry.src.trim() : '';
  if (!src) return null;
  const id = typeof rawEntry.id === 'string' && rawEntry.id.trim()
    ? rawEntry.id.trim()
    : src.split('/').pop().replace(/\.[^/.]+$/, '') || `layer-${layers.size + 1}`;
  const lane = clampLane(rawEntry.lane ?? rawEntry.tier ?? 1);
  return {
    id,
    title: typeof rawEntry.title === 'string' ? rawEntry.title.trim() : id,
    src,
    lane,
    baseVolume: clampVolume(rawEntry.baseVolume ?? LAYER_DEFAULTS.baseVolume),
    rateRange: clampRange(rawEntry.rateRange ?? LAYER_DEFAULTS.rateRange),
    baseRate: clampPlaybackRate(rawEntry.baseRate ?? LAYER_DEFAULTS.baseRate),
  };
}

function clampLane(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  if (numeric > 3) return 3;
  return Math.round(numeric);
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0.2;
  if (numeric >= 1) return 1;
  return numeric;
}

function clampRange(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0.08;
  if (numeric >= 0.6) return 0.6;
  return numeric;
}

function clampPlaybackRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0.5) return 0.5;
  if (numeric >= 2) return 2;
  return numeric;
}

function ensureMediaQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }
  if (mediaMotionQuery) return;
  mediaMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = mediaMotionQuery.matches || reducedMotion;
  try {
    mediaMotionQuery.addEventListener('change', (event) => {
      reducedMotion = Boolean(event?.matches);
      recomputeTargets();
      updateCaption();
    });
  } catch (error) {
    console.warn('[humiliation-audio] failed to bind motion query listener', error);
  }
}

function ensureSliderAttributes() {
  if (!sliderEl) return;
  sliderEl.setAttribute('min', '0');
  sliderEl.setAttribute('max', '3');
  sliderEl.setAttribute('step', '1');
  sliderEl.setAttribute('aria-valuemin', '0');
  sliderEl.setAttribute('aria-valuemax', '3');
  sliderEl.classList.add('indulgence-slider');
}

function setSliderValue(level) {
  if (!sliderEl) return;
  const numeric = clampLevel(level);
  sliderEl.value = String(numeric);
  sliderEl.setAttribute('aria-valuenow', String(numeric));
  sliderEl.setAttribute('aria-valuetext', getLabelForLevel(numeric));
}

function updateCaption(message, { muted = false } = {}) {
  if (captionEl) {
    captionEl.textContent = message || (muted ? 'Muted' : getCaptionForState());
  }
  if (srAnnounceEl) {
    srAnnounceEl.textContent = message || getCaptionForState();
  }
}

function getCaptionForState() {
  if (coverSuppressed) return 'Muted for cover mode';
  if (privacySuppressed) return 'Muted for privacy';
  if (globalMute) return 'Global mute active';
  if (reducedVolume) return 'Muted for reduced-volume preference';
  const levelLabel = getLabelForLevel(indulgenceLevel);
  if (indulgenceLevel <= 0) {
    return `${levelLabel}. No ASMR layers.`;
  }
  const pressurePercent = Math.round(Math.max(0, Math.min(100, pressureLevel)));
  if (!layers.size) {
    return `${levelLabel}. Awaiting ASMR pack.`;
  }
  if (ttsActive) {
    return `${levelLabel}. Whisper ducked for Azure line.`;
  }
  return `${levelLabel}. Pressure ${pressurePercent}%.`;
}

function ensurePressureBinding() {
  if (pressureUnsubscribe) return;
  try {
    const state = getPressureState();
    pressureLevel = Number(state?.level) || 0;
    pressureTier = Number(state?.tier) || 0;
  } catch (error) {
    console.warn('[humiliation-audio] failed to read pressure state', error);
  }
  pressureUnsubscribe = onPressureChange((detail) => {
    if (!detail) return;
    if (typeof detail.level === 'number') {
      pressureLevel = Math.max(0, Math.min(100, Number(detail.level) || 0));
    }
    if (typeof detail.tier === 'number') {
      pressureTier = Math.max(0, Math.min(3, Number(detail.tier) || 0));
    }
    recomputeTargets();
    updateCaption();
  });
}

function computeEffectiveIntensity() {
  if (
    indulgenceLevel <= 0 ||
    globalMute ||
    coverSuppressed ||
    privacySuppressed ||
    reducedVolume
  ) {
    return 0;
  }
  const slider = indulgenceLevel;
  const pressureScalar = Math.max(0, Math.min(1, pressureLevel / 100));
  const tierBoost = pressureTier > 0 ? 0.15 * pressureTier : 0;
  const base = slider * (0.45 + 0.55 * pressureScalar) + tierBoost;
  const capped = Math.min(slider, base);
  const ttsScalar = 1 - Math.min(0.45, (ttsLane / 3) * 0.35);
  const activeScalar = ttsActive ? 0.55 : 1;
  return Math.max(0, Math.min(3, capped * ttsScalar * activeScalar));
}

function computeLayerTarget(layer, effectiveIntensity) {
  if (!layer) return 0;
  const lane = clampLane(layer.lane);
  if (effectiveIntensity <= 0) return 0;
  if (effectiveIntensity >= lane) {
    return layer.baseVolume;
  }
  const laneFloor = lane - 1;
  if (effectiveIntensity <= laneFloor) {
    return 0;
  }
  const progress = Math.min(1, effectiveIntensity - laneFloor);
  return clampVolume(layer.baseVolume * progress);
}

function ensureLayer(layer) {
  if (!layer || layers.has(layer.id)) return;
  const audio = new Audio(layer.src);
  audio.loop = true;
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.volume = 0;
  audio.playbackRate = layer.baseRate;
  layers.set(layer.id, { ...layer, audio });
  layerState.set(layer.id, {
    currentVolume: 0,
    targetVolume: 0,
    rampHandle: null,
    pendingPlay: false,
    lastUpdate: performance.now(),
  });
}

function rampLayer(layerId, targetVolume, playbackRate) {
  const entry = layers.get(layerId);
  const state = layerState.get(layerId);
  if (!entry || !state) return;
  const audio = entry.audio;
  state.targetVolume = clampVolume(targetVolume);
  const now = performance.now();
  const startVolume = state.currentVolume;
  const delta = state.targetVolume - startVolume;
  const duration = reducedMotion ? MIN_RAMP_MS : CROSSFADE_MS;
  if (Math.abs(delta) <= PLAYBACK_EPSILON) {
    state.currentVolume = state.targetVolume;
    audio.volume = state.currentVolume;
    if (state.currentVolume <= PLAYBACK_EPSILON) {
      try {
        audio.pause();
      } catch {}
    }
    return;
  }

  const update = () => {
    const progress = Math.min(1, (performance.now() - now) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    state.currentVolume = clampVolume(startVolume + delta * eased);
    audio.volume = state.currentVolume;
    if (typeof playbackRate === 'number' && Number.isFinite(playbackRate)) {
      audio.playbackRate = clampPlaybackRate(playbackRate);
    }
    if (progress < 1) {
      state.rampHandle = requestAnimationFrame(update);
    } else {
      state.rampHandle = null;
      if (state.currentVolume <= PLAYBACK_EPSILON) {
        try {
          audio.pause();
        } catch {}
      }
    }
  };

  if (state.rampHandle) {
    cancelAnimationFrame(state.rampHandle);
  }
  state.rampHandle = requestAnimationFrame(update);

  if (state.targetVolume > PLAYBACK_EPSILON) {
    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          state.pendingPlay = true;
        });
      }
    }
  }
}

function recomputeTargets() {
  const effective = computeEffectiveIntensity();
  layers.forEach((layer) => {
    const playbackRate = layer.baseRate + layer.rateRange * (pressureLevel / 100);
    const target = computeLayerTarget(layer, effective);
    rampLayer(layer.id, target, playbackRate);
  });
  updateCaption();
}

function handleSliderInput(event) {
  const value = clampLevel(event?.target?.value);
  setIndulgenceLevel(value, { source: 'slider' });
}

function attachSlider() {
  if (!sliderEl) return;
  sliderEl.addEventListener('input', handleSliderInput);
  sliderEl.addEventListener('change', handleSliderInput);
}

function detachSlider() {
  if (!sliderEl) return;
  sliderEl.removeEventListener('input', handleSliderInput);
  sliderEl.removeEventListener('change', handleSliderInput);
}

function applySuppressionAttributes(disabled) {
  if (!sliderEl) return;
  const suppressed = Boolean(disabled);
  sliderEl.toggleAttribute('disabled', suppressed);
  sliderEl.classList.toggle('indulgence-slider--disabled', suppressed);
  const container = sliderEl.closest('.audio-indulgence');
  if (container) {
    if (suppressed) {
      container.setAttribute('data-suppressed', 'true');
    } else {
      container.removeAttribute('data-suppressed');
    }
  }
}

function ensureLayersLoaded() {
  loadManifest()
    .then((manifest) => {
      manifest.forEach((layer) => ensureLayer(layer));
      if (!manifest.length) {
        updateCaption('ASMR pack missing. Drop .webm files into audio/asmr.', {
          muted: indulgenceLevel <= 0,
        });
      } else {
        recomputeTargets();
      }
    })
    .catch((error) => {
      console.warn('[humiliation-audio] manifest resolution failed', error);
    });
}

function initHumiliationAudio({
  slider,
  caption,
  announce,
  reducedMotion: motionPref = false,
  reducedVolume: volumePref = false,
} = {}) {
  sliderEl = slider instanceof HTMLElement ? slider : null;
  captionEl = caption instanceof HTMLElement ? caption : null;
  srAnnounceEl = announce instanceof HTMLElement ? announce : null;
  reducedMotion = Boolean(motionPref);
  reducedVolume = Boolean(volumePref);

  ensureMediaQuery();
  ensurePressureBinding();
  bindTTSEventBridge();
  ensureSliderAttributes();
  loadStoredLevel();
  setSliderValue(indulgenceLevel);
  updateCaption();
  attachSlider();
  ensureLayersLoaded();
  applySuppressionAttributes(shouldForceMute());
  if (sliderEl) {
    sliderEl.dataset.levelLabel = getLabelForLevel(indulgenceLevel);
  }
  dispatchLevelEvent({ source: 'init' });

  return {
    setReducedMotion(mode) {
      if (!mode) return;
      reducedMotion = mode === 'reduced';
      recomputeTargets();
    },
    setReducedVolume(enabled) {
      reducedVolume = Boolean(enabled);
      applySuppressionAttributes(shouldForceMute());
      recomputeTargets();
      updateCaption();
    },
    setCoverSuppressed(suppressed) {
      coverSuppressed = Boolean(suppressed);
      applySuppressionAttributes(shouldForceMute());
      recomputeTargets();
      updateCaption();
    },
    setPrivacySuppressed(suppressed) {
      privacySuppressed = Boolean(suppressed);
      applySuppressionAttributes(shouldForceMute());
      recomputeTargets();
      updateCaption();
    },
    setGlobalMute(muted) {
      globalMute = Boolean(muted);
      applySuppressionAttributes(shouldForceMute());
      recomputeTargets();
      updateCaption();
    },
    syncTTSLane(lane) {
      const numeric = Number(lane);
      if (Number.isFinite(numeric)) {
        ttsLane = Math.max(0, Math.min(3, numeric));
        recomputeTargets();
      }
    },
    setTTSActive(active, meta = {}) {
      ttsActive = Boolean(active);
      if (typeof meta?.lane === 'number') {
        ttsLane = Math.max(0, Math.min(3, Number(meta.lane)));
      }
      recomputeTargets();
    },
    setIndulgence(level, options) {
      setIndulgenceLevel(level, options);
    },
    getLevel() {
      return indulgenceLevel;
    },
  };
}

function shouldForceMute() {
  return globalMute || coverSuppressed || privacySuppressed || reducedVolume;
}

function setIndulgenceLevel(level, { source = 'programmatic' } = {}) {
  const numeric = clampLevel(level);
  const changed = numeric !== indulgenceLevel;
  indulgenceLevel = numeric;
  setSliderValue(numeric);
  persistLevel(numeric);
  if (sliderEl) {
    sliderEl.dataset.levelLabel = getLabelForLevel(indulgenceLevel);
  }
  applySuppressionAttributes(shouldForceMute());
  recomputeTargets();
  updateCaption();
  if (changed) {
    dispatchLevelEvent({ level: numeric, source });
  }
  return indulgenceLevel;
}

function dispatchLevelEvent(detail = {}) {
  if (typeof document === 'undefined') return;
  const payload = {
    level: indulgenceLevel,
    label: getLabelForLevel(indulgenceLevel),
    suppressed: shouldForceMute(),
    ...detail,
  };
  document.dispatchEvent(
    new CustomEvent('humiliationAudio:level', {
      detail: payload,
    }),
  );
}

function setTTSActiveState(active, meta) {
  ttsActive = Boolean(active);
  if (meta && typeof meta.lane === 'number') {
    ttsLane = Math.max(0, Math.min(3, Number(meta.lane) || 0));
  }
  recomputeTargets();
}

function syncTTSIntensity(lane) {
  const numeric = Number(lane);
  if (!Number.isFinite(numeric)) return;
  ttsLane = Math.max(0, Math.min(3, numeric));
  recomputeTargets();
}

function setCoverSuppressedState(suppressed) {
  coverSuppressed = Boolean(suppressed);
  applySuppressionAttributes(shouldForceMute());
  recomputeTargets();
  updateCaption();
}

function setPrivacySuppressedState(suppressed) {
  privacySuppressed = Boolean(suppressed);
  applySuppressionAttributes(shouldForceMute());
  recomputeTargets();
  updateCaption();
}

function setGlobalMuteState(muted) {
  globalMute = Boolean(muted);
  applySuppressionAttributes(shouldForceMute());
  recomputeTargets();
  updateCaption();
}

function setReducedVolumeState(enabled) {
  reducedVolume = Boolean(enabled);
  applySuppressionAttributes(shouldForceMute());
  recomputeTargets();
  updateCaption();
}

function setMotionMode(mode) {
  if (!mode) return;
  reducedMotion = mode === 'reduced';
  recomputeTargets();
}

function bindTTSEventBridge() {
  if (ttsEventsBound) return;
  if (typeof document === 'undefined') return;
  ttsEventsBound = true;
  document.addEventListener('humiliationAudio:tts', (event) => {
    const detail = event?.detail || {};
    if (detail.state === 'start') {
      setTTSActiveState(true, detail);
    }
    if (detail.state === 'stop') {
      setTTSActiveState(false, detail);
    }
  });
  document.addEventListener('tts:intensity', (event) => {
    const lane = Number(event?.detail?.intensity);
    if (Number.isFinite(lane)) {
      syncTTSIntensity(lane);
    }
  });
}

export {
  initHumiliationAudio,
  setGlobalMuteState,
  setIndulgenceLevel,
  setCoverSuppressedState,
  setPrivacySuppressedState,
  setReducedVolumeState,
  setMotionMode,
  setTTSActiveState,
  syncTTSIntensity,
};

