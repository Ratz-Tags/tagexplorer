import { getActiveTags } from '../tags.js';

const STORAGE_KEY = 'tx:haze:v1';
const STORAGE_RITUAL_KEY = 'ritualState';
const STORAGE_UNLOCKED = 'unlocked';
const STORAGE_COMPLETED = 'completed';
const STORAGE_DISMISSED = 'dismissed';
const STORAGE_COOLDOWN = 'cooldowns';

const DEFAULT_COOLDOWN_MS = 120000;

const rituals = [
  {
    id: 'chastity_spiral',
    name: 'Chastity Spiral',
    tags: ['chastity_cage', 'hypnosis', 'mind_break'],
    glyphs: ['⌧', '⥾', '☍'],
    caption: 'Locked, spun, broken. You arranged the full spiral yourself.',
    description:
      'Layering chastity, trance, and mind break drags you into the spiral lock. The glow leans in when you stack all three.',
    cooldownMs: 180000,
    repeatable: false,
    audio: {
      pulseIntensity: 0.75,
      durationMs: 520,
    },
    whispers: {
      unlock: 'That cage, that trance, that empty stare… you really queued the spiral.',
      complete: 'Spiral acknowledged. Stay caged and keep staring.',
      dismiss: 'Backing away from the spiral glow? It will wait.',
    },
  },
  {
    id: 'pink_conversion',
    name: 'Pink Conversion',
    tags: ['feminization', 'bimbofication', 'pegging'],
    glyphs: ['✶', '❁', '✸'],
    caption: 'Three hits of synthetic pink. You practically begged for the conversion booth.',
    description:
      'Feminization, bimbofication, and pegging flag you for a full conversion session. The system leaks pink light until you submit.',
    cooldownMs: 150000,
    repeatable: true,
    audio: {
      pulseIntensity: 0.62,
      durationMs: 480,
    },
    whispers: {
      unlock: 'All that pink conditioning in one breath. Conversion chamber primed.',
      complete: 'Conversion accepted. Let it stain everything else you queue.',
      dismiss: 'Skipped the pink flood? The stains linger anyway.',
    },
  },
  {
    id: 'pet_subroutine',
    name: 'Leash Subroutine',
    tags: ['pet_play', 'leash', 'gagged'],
    glyphs: ['♘', '⤙', '⤚'],
    caption: 'Muzzled, tethered, obedient. The subroutine pings your every move now.',
    description:
      'Once the leash, gag, and pet protocol are stacked, the gallery slips into handler mode. Expect commands whispered into the glow.',
    cooldownMs: 210000,
    repeatable: true,
    audio: {
      pulseIntensity: 0.68,
      durationMs: 600,
    },
    whispers: {
      unlock: 'Collar snapped shut. Even the gallery noticed your pet routine.',
      complete: 'Good pet. Let the commands loop while you browse.',
      dismiss: 'Unclipping already? The handler still has your scent.',
    },
  },
];

let hydrated = false;
let state = {
  [STORAGE_UNLOCKED]: {},
  [STORAGE_COMPLETED]: {},
  [STORAGE_DISMISSED]: {},
  [STORAGE_COOLDOWN]: {},
};

let lastActivation = new Map();
let storageFaultLogged = false;

function getRitualById(id) {
  return rituals.find((ritual) => ritual.id === id) || null;
}

function readNamespace() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[gallery-rituals] Failed to read namespace', error);
      storageFaultLogged = true;
    }
    return {};
  }
}

function writeNamespace() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload = readNamespace();
  payload[STORAGE_RITUAL_KEY] = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    if (!storageFaultLogged) {
      console.warn('[gallery-rituals] Failed to persist namespace', error);
      storageFaultLogged = true;
    }
  }
}

function hydrateState() {
  if (hydrated) return state;
  hydrated = true;
  const namespace = readNamespace();
  const stored = namespace?.[STORAGE_RITUAL_KEY];
  if (stored && typeof stored === 'object') {
    state = {
      [STORAGE_UNLOCKED]: { ...(stored[STORAGE_UNLOCKED] || {}) },
      [STORAGE_COMPLETED]: { ...(stored[STORAGE_COMPLETED] || {}) },
      [STORAGE_DISMISSED]: { ...(stored[STORAGE_DISMISSED] || {}) },
      [STORAGE_COOLDOWN]: { ...(stored[STORAGE_COOLDOWN] || {}) },
    };
  }
  return state;
}

function getTimestamp() {
  return Date.now();
}

function setStateValue(bucket, id, value) {
  hydrateState();
  if (!bucket || !id) return;
  if (!state[bucket]) {
    state[bucket] = {};
  }
  state[bucket][id] = value;
  writeNamespace();
}

function deleteStateValue(bucket, id) {
  hydrateState();
  if (!bucket || !state[bucket]) return;
  if (typeof id === 'string') {
    delete state[bucket][id];
  } else {
    state[bucket] = {};
  }
  writeNamespace();
}

function getStateBucket(bucket) {
  hydrateState();
  return { ...(state[bucket] || {}) };
}

function getRitualState(id) {
  hydrateState();
  const unlocked = Boolean(state[STORAGE_UNLOCKED]?.[id]);
  const completed = Boolean(state[STORAGE_COMPLETED]?.[id]);
  const dismissed = Boolean(state[STORAGE_DISMISSED]?.[id]);
  const cooldownAt = Number(state[STORAGE_COOLDOWN]?.[id] || 0);
  return {
    unlocked,
    completed,
    dismissed,
    cooldownAt,
  };
}

function recordActivation(id, timestamp) {
  lastActivation.set(id, timestamp);
  setStateValue(STORAGE_COOLDOWN, id, timestamp);
}

function canTrigger(ritual, tags, now) {
  if (!ritual || !tags) return false;
  const id = ritual.id;
  const currentState = getRitualState(id);
  if (currentState.dismissed) return false;
  if (currentState.completed && !ritual.repeatable) {
    return false;
  }
  const hasAllTags = ritual.tags.every((tag) => tags.has(tag));
  if (!hasAllTags) return false;
  const cooldown = Number.isFinite(ritual.cooldownMs)
    ? Math.max(0, ritual.cooldownMs)
    : DEFAULT_COOLDOWN_MS;
  const last = Math.max(Number(currentState.cooldownAt || 0), lastActivation.get(id) || 0);
  if (cooldown && now - last < cooldown) {
    return false;
  }
  return true;
}

function markUnlocked(id, timestamp) {
  setStateValue(STORAGE_UNLOCKED, id, timestamp || getTimestamp());
}

function markCompleted(id, timestamp) {
  setStateValue(STORAGE_COMPLETED, id, timestamp || getTimestamp());
}

function markDismissed(id, timestamp) {
  setStateValue(STORAGE_DISMISSED, id, timestamp || getTimestamp());
}

function clearDismissed(id) {
  deleteStateValue(STORAGE_DISMISSED, id);
}

function resetRitual(id) {
  if (typeof id === 'string') {
    deleteStateValue(STORAGE_UNLOCKED, id);
    deleteStateValue(STORAGE_COMPLETED, id);
    deleteStateValue(STORAGE_DISMISSED, id);
    deleteStateValue(STORAGE_COOLDOWN, id);
    lastActivation.delete(id);
    return;
  }
  [
    STORAGE_UNLOCKED,
    STORAGE_COMPLETED,
    STORAGE_DISMISSED,
    STORAGE_COOLDOWN,
  ].forEach((bucket) => deleteStateValue(bucket));
  lastActivation.clear();
}

function evaluateRitualTriggers({ now = getTimestamp(), tags } = {}) {
  const activeTags = tags instanceof Set ? tags : getActiveTags();
  if (!(activeTags instanceof Set)) return [];
  const activations = [];
  rituals.forEach((ritual) => {
    if (!canTrigger(ritual, activeTags, now)) return;
    recordActivation(ritual.id, now);
    markUnlocked(ritual.id, now);
    const detail = {
      id: ritual.id,
      ritual,
      timestamp: now,
      state: getRitualState(ritual.id),
    };
    activations.push(detail);
  });
  return activations;
}

function getRitualCatalog() {
  return rituals.map((ritual) => ({ ...ritual }));
}

function getStateSnapshot() {
  hydrateState();
  return {
    unlocked: getStateBucket(STORAGE_UNLOCKED),
    completed: getStateBucket(STORAGE_COMPLETED),
    dismissed: getStateBucket(STORAGE_DISMISSED),
    cooldowns: getStateBucket(STORAGE_COOLDOWN),
  };
}

function registerCompletion(id) {
  const ritual = getRitualById(id);
  if (!ritual) return;
  markCompleted(id, getTimestamp());
}

function registerDismissal(id) {
  const ritual = getRitualById(id);
  if (!ritual) return;
  markDismissed(id, getTimestamp());
}

function registerReset(id) {
  resetRitual(id);
}

export {
  evaluateRitualTriggers,
  getRitualCatalog,
  getRitualState,
  getStateSnapshot,
  registerCompletion,
  registerDismissal,
  registerReset,
  clearDismissed,
};
