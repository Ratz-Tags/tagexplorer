import {
  azureSpeak,
  composeWhisperSSML,
} from './azure-tts.js';
import {
  isTTSEnabled,
  getTTSIntensity,
} from './tts-toggle.js';
import {
  incrementPressure,
  getPressureTier,
  onPressureChange as onPressureStateChange,
} from './progression/pressure-meter.js';
import {
  getStreakTier,
  onStreakChange as onStreakUpdate,
  isStreakTrackingEnabled,
} from './progression/streaks.js';

const LANE_MIN = 1;
const LANE_MAX = 3;
const CAPTION_VISIBLE_MS = 12000;
const GLOBAL_COOLDOWN_MS = 2800;
const DEFAULT_EVENT_COOLDOWN_MS = 3600;
const EVENT_COOLDOWNS = {
  idle: 90000,
  back: 8000,
  artist_open: 5200,
  stack_overflow: 6200,
  tag_add: 2600,
  tag_clear: 4200,
  dossier_open: 12000,
  dossier_revisit: 9000,
};
const PRESSURE_REWARDS = {
  tag_add: (options = {}) => (options.tag ? 4 : 2),
  stack_overflow: () => 3,
  artist_open: () => 6,
};

let eventCatalog = {};
let tagCatalog = {};
let generalFallback = [];

let captionRoot = null;
let captionTextEl = null;
let captionTimer = null;
let audioEl = null;

let lastTriggerTimes = new Map();
let globalCooldownUntil = 0;
let scrollSuppressedUntil = 0;
let lastScrollY = null;
let lastScrollEvent = 0;
let pressureTier = 0;
let streakTier = 0;

try {
  pressureTier = getPressureTier();
} catch {}

try {
  streakTier = isStreakTrackingEnabled() ? getStreakTier() : 0;
} catch {}

onPressureStateChange((detail) => {
  if (!detail || typeof detail.tier === 'undefined') return;
  const nextTier = Number(detail.tier);
  if (Number.isFinite(nextTier)) {
    pressureTier = Math.max(0, nextTier);
  }
});

onStreakUpdate((detail) => {
  if (!detail || typeof detail.tier === 'undefined') return;
  streakTier = detail.trackingEnabled ? Math.max(0, Number(detail.tier) || 0) : 0;
});

function clampLane(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return LANE_MIN;
  if (numeric <= 0) return 0;
  if (numeric >= LANE_MAX) return LANE_MAX;
  return Math.max(LANE_MIN, Math.floor(numeric));
}

function normalizeArrayLane(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function normalizeIntensityMatrix(raw) {
  const matrix = [[], [], [], []];
  if (Array.isArray(raw)) {
    raw.forEach((lane, index) => {
      if (index >= 0 && index < matrix.length) {
        matrix[index] = normalizeArrayLane(lane);
      }
    });
    return matrix;
  }
  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((key) => {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < matrix.length) {
        matrix[index] = normalizeArrayLane(raw[key]);
      }
    });
  }
  return matrix;
}

function ensureCaptionRoot() {
  if (typeof document === 'undefined') return null;
  if (captionRoot && captionTextEl && document.body.contains(captionRoot)) {
    return captionRoot;
  }
  captionRoot = document.createElement('div');
  captionRoot.id = 'whisper-caption';
  captionRoot.className = 'whisper-caption whisper-caption--hidden';
  captionRoot.setAttribute('aria-live', 'assertive');
  captionRoot.setAttribute('role', 'status');
  captionTextEl = document.createElement('span');
  captionTextEl.className = 'whisper-caption__text';
  captionRoot.appendChild(captionTextEl);
  document.body.appendChild(captionRoot);
  return captionRoot;
}

function ensureAudioElement() {
  if (typeof window === 'undefined') return null;
  if (audioEl && document.body.contains(audioEl)) return audioEl;
  audioEl = document.getElementById('whisper-audio-element');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'whisper-audio-element';
    audioEl.setAttribute('aria-hidden', 'true');
    audioEl.setAttribute('preload', 'auto');
    audioEl.className = 'whisper-audio-element hidden';
    document.body.appendChild(audioEl);
  }
  audioEl.volume = 1;
  return audioEl;
}

function hideCaptionSoon() {
  if (!captionRoot) return;
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = setTimeout(() => {
    if (captionRoot) {
      captionRoot.classList.add('whisper-caption--hidden');
      captionRoot.classList.remove('whisper-caption--muted');
    }
  }, CAPTION_VISIBLE_MS);
}

function updateCaption(text, { muted = false } = {}) {
  if (!text) {
    if (captionRoot) {
      captionRoot.classList.add('whisper-caption--hidden');
      captionRoot.classList.remove('whisper-caption--muted');
    }
    return;
  }
  ensureCaptionRoot();
  if (!captionRoot || !captionTextEl) return;
  captionTextEl.textContent = text;
  captionRoot.classList.remove('whisper-caption--hidden');
  captionRoot.classList.toggle('whisper-caption--muted', Boolean(muted));
  hideCaptionSoon();
}

function pickFromMatrix(matrix, lane) {
  if (!Array.isArray(matrix) || !matrix.length) return null;
  const targetIndex = Math.min(Math.max(lane, 0), matrix.length - 1);
  const primary = normalizeArrayLane(matrix[targetIndex]);
  if (primary.length) {
    return primary[Math.floor(Math.random() * primary.length)];
  }
  for (let i = targetIndex - 1; i >= 0; i -= 1) {
    const bucket = normalizeArrayLane(matrix[i]);
    if (bucket.length) {
      return bucket[Math.floor(Math.random() * bucket.length)];
    }
  }
  for (let i = targetIndex + 1; i < matrix.length; i += 1) {
    const bucket = normalizeArrayLane(matrix[i]);
    if (bucket.length) {
      return bucket[Math.floor(Math.random() * bucket.length)];
    }
  }
  return null;
}

function resolveLane(userLane, { intensity, minIntensity, maxIntensity } = {}) {
  const userCap = clampLane(userLane);
  if (userCap === 0) return 0;
  const pressureFloor =
    pressureTier > 0 ? Math.min(LANE_MAX, clampLane(pressureTier)) : LANE_MIN;
  const streakFloor =
    streakTier > 0 ? Math.min(LANE_MAX, clampLane(streakTier)) : LANE_MIN;
  const combinedFloor = Math.max(pressureFloor, streakFloor);
  if (typeof intensity === 'number') {
    const forced = clampLane(intensity);
    if (forced === 0) return 0;
    const enforcedFloor = Math.max(combinedFloor, forced);
    if (userCap < enforcedFloor) {
      return userCap;
    }
    return Math.min(userCap, enforcedFloor);
  }
  const requestedMin = typeof minIntensity === 'number' ? clampLane(minIntensity) : LANE_MIN;
  const requestedMax = typeof maxIntensity === 'number' ? clampLane(maxIntensity) : LANE_MAX;
  const floor = Math.max(requestedMin, combinedFloor);
  const ceiling = Math.min(userCap, requestedMax || LANE_MAX);
  if (ceiling === 0) return 0;
  if (ceiling < floor) {
    return ceiling;
  }
  return Math.max(floor || LANE_MIN, ceiling || userCap);
}

function getEventCooldown(eventKey) {
  const normalized = String(eventKey || '').toLowerCase();
  return EVENT_COOLDOWNS[normalized] ?? DEFAULT_EVENT_COOLDOWN_MS;
}

function rewardPressure(eventKey, options) {
  const key = String(eventKey || '').toLowerCase();
  const entry = PRESSURE_REWARDS[key];
  if (!entry) return;
  const value = typeof entry === 'function' ? entry(options || {}) : entry;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  incrementPressure(amount, { source: `whisper:${key}` });
}

function configureWhisperCatalog({ events, tags, generalTaunts } = {}) {
  const nextEvents = {};
  if (events && typeof events === 'object') {
    Object.entries(events).forEach(([key, value]) => {
      nextEvents[String(key || '').toLowerCase()] = normalizeIntensityMatrix(value);
    });
  }
  eventCatalog = nextEvents;
  const nextTags = {};
  if (tags && typeof tags === 'object') {
    Object.entries(tags).forEach(([key, value]) => {
      nextTags[String(key || '').toLowerCase()] = normalizeIntensityMatrix(value);
    });
  }
  tagCatalog = nextTags;
  generalFallback = Array.isArray(generalTaunts)
    ? generalTaunts.filter((line) => typeof line === 'string' && line.trim().length > 0)
    : [];
}

function getTagLineForIntensity(tag, lane, fallback) {
  const key = String(tag || '').toLowerCase();
  const matrix = tagCatalog[key];
  if (!matrix) {
    return fallback || null;
  }
  const resolvedLane = clampLane(lane || LANE_MIN);
  const line = pickFromMatrix(matrix, resolvedLane);
  if (line) return line;
  return fallback || null;
}

async function playLineThroughAzure(text, eventKey, lane) {
  try {
    const { ssml, voice, style, intensity } = composeWhisperSSML(text, {
      intensity: lane,
      event: eventKey,
      rotate: true,
    });
    const url = await azureSpeak(text, { ssml, voice, style, intensity }, {
      event: eventKey,
      intensity: lane,
    });
    if (!url) return false;
    const audio = ensureAudioElement();
    if (!audio) return false;
    if (!audio.paused) {
      try {
        audio.pause();
      } catch (error) {
        // ignore pause errors
      }
    }
    audio.currentTime = 0;
    audio.src = url;
    audio.play().catch(() => {});
    try {
      document.dispatchEvent(
        new CustomEvent('humiliationAudio:tts', {
          detail: { state: 'start', event: eventKey, lane, intensity },
        }),
      );
    } catch (error) {
      console.warn('[tts-dispatcher] failed to dispatch humiliation start', error);
    }

    const cleanup = (reason = 'ended') => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      try {
        document.dispatchEvent(
          new CustomEvent('humiliationAudio:tts', {
            detail: { state: 'stop', reason, event: eventKey, lane, intensity },
          }),
        );
      } catch (error) {
        console.warn('[tts-dispatcher] failed to dispatch humiliation stop', error);
      }
    };

    const onEnded = () => cleanup('ended');
    const onPause = () => {
      if (!audio.ended && audio.currentTime > 0) {
        cleanup('pause');
      }
    };
    const onError = () => cleanup('error');

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError, { once: true });
    return true;
  } catch (error) {
    console.warn('[tts-dispatcher] Failed to play whisper', error);
    return false;
  }
}

function shouldSuppressForScroll(now) {
  if (!scrollSuppressedUntil) return false;
  return now < scrollSuppressedUntil;
}

function recordScrollSuppression() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const currentY = window.scrollY || window.pageYOffset || 0;
  if (lastScrollY !== null) {
    const delta = Math.abs(currentY - lastScrollY);
    const deltaTime = now - lastScrollEvent;
    if (delta > 280 && deltaTime < 180) {
      scrollSuppressedUntil = now + 1400;
    }
  }
  lastScrollY = currentY;
  lastScrollEvent = now;
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => recordScrollSuppression(), {
    passive: true,
  });
}

function dispatchWhisperEvent(eventKey, options = {}) {
  const key = String(eventKey || '').toLowerCase();
  if (!key) return { skipped: true, reason: 'no-event' };
  const now = Date.now();

  if (!options.forceGlobal && globalCooldownUntil && now < globalCooldownUntil) {
    return { skipped: true, reason: 'global-cooldown' };
  }

  if (!options.ignoreScrollSuppression && shouldSuppressForScroll(now)) {
    return { skipped: true, reason: 'rapid-scroll' };
  }

  const cooldown = options.cooldownMs ?? getEventCooldown(key);
  const lastTriggered = lastTriggerTimes.get(key) || 0;
  if (!options.force && cooldown && now - lastTriggered < cooldown) {
    return { skipped: true, reason: 'event-cooldown' };
  }

  const userLane = getTTSIntensity();
  const lane = resolveLane(userLane, options);
  if (lane === 0) {
    updateCaption('Whispers muted', { muted: true });
    return { skipped: true, reason: 'intensity-zero' };
  }

  let line = options.text;
  if (!line && options.tag) {
    line = getTagLineForIntensity(options.tag, lane);
  }
  if (!line) {
    const matrix = eventCatalog[key];
    if (matrix) {
      line = pickFromMatrix(matrix, lane);
    }
  }
  if (!line && generalFallback.length) {
    line = generalFallback[Math.floor(Math.random() * generalFallback.length)];
  }
  if (!line) {
    return { skipped: true, reason: 'no-line' };
  }

  const enabled = isTTSEnabled();
  updateCaption(line, { muted: !enabled });
  lastTriggerTimes.set(key, now);
  globalCooldownUntil = now + GLOBAL_COOLDOWN_MS;
  rewardPressure(key, options);

  if (!enabled) {
    return { skipped: true, text: line, reason: 'tts-disabled' };
  }

  playLineThroughAzure(line, key, lane);
  return { text: line, intensity: lane };
}

if (
  typeof document !== 'undefined' &&
  typeof document.addEventListener === 'function'
) {
  document.addEventListener('tts:toggle', (event) => {
    const enabled = Boolean(event?.detail?.enabled);
    if (!enabled) {
      updateCaption('Whispers muted', { muted: true });
    }
  });
}

export {
  configureWhisperCatalog,
  dispatchWhisperEvent,
  getTagLineForIntensity,
};
