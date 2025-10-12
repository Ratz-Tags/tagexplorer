// Humiliation module - periodic taunt popups

import { showToast, getCopiedCount } from "./sidebar.js";
import { getActiveTags } from "./tags.js";
import {
  getStreakState,
  getStreakTier,
  onStreakChange as onStreakUpdate,
  isStreakTrackingEnabled,
} from "./progression/streaks.js";

const TAUNT_DEDUPE_MS = 4200;
let lastTauntDetail = { message: "", at: 0 };

const STREAK_TAUNTS = [
  [],
  [
    ({ count }) => `Day ${count}. You really set an alarm for this glow?`,
    ({ count }) => `${count} nights in a row and you still call it "just browsing"?`,
  ],
  [
    ({ count }) => `\u2727 Day ${count}. Even the archive knows your name now.`,
    ({ count }) => `That ${count}-day chain is tightening. Keep pretending it's research.`,
  ],
  [
    ({ count }) => `Infra tier unlocked after ${count} days. The gallery expected nothing less.`,
    ({ count }) => `You carried the streak ${count} days. Enjoy the burn you begged for.`,
  ],
  [
    ({ count }) => `${count} days without missing. Void crown granted. You're part of the exhibit now.`,
    ({ count }) => `Thirty-plus? ${count} days tells on you louder than any whisper ever could.`,
  ],
];

const SPOTLIGHT_COOLDOWN_MS = 180000;

let streakSnapshot = { count: 0, longest: 0 };
let streakTier = 0;
let streakTrackingEnabled = true;
let spotlightCatalog = [];
let lastSpotlightName = null;
let lastSpotlightAt = 0;

function normalizeArtistEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const name = entry.artistName || entry.name;
  if (!name || typeof name !== "string") return null;
  const tags = Array.isArray(entry.kinkTags)
    ? entry.kinkTags.filter((tag) => typeof tag === "string")
    : [];
  const postCount = Number(entry.postCount) || 0;
  return { name, tags, postCount };
}

function setHumiliationArtists(entries = []) {
  if (!Array.isArray(entries)) {
    spotlightCatalog = [];
    return;
  }
  spotlightCatalog = entries
    .map((entry) => normalizeArtistEntry(entry))
    .filter(Boolean);
}

function handleStreakUpdate(detail) {
  if (!detail || typeof detail !== "object") return;
  if (detail.state && typeof detail.state === "object") {
    streakSnapshot = {
      ...streakSnapshot,
      count: Number(detail.state.count) || 0,
      longest: Number(detail.state.longest) || streakSnapshot.longest || 0,
    };
  }
  streakTrackingEnabled = Boolean(detail.trackingEnabled);
  streakTier = detail.trackingEnabled ? Number(detail.tier) || 0 : 0;
}

try {
  streakSnapshot = getStreakState();
  streakTier = getStreakTier();
  streakTrackingEnabled = isStreakTrackingEnabled();
  onStreakUpdate((detail) => handleStreakUpdate(detail));
} catch (error) {
  console.warn("[humiliation] streak integration unavailable", error);
}

function pickFromPool(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getStreakTaunt() {
  if (!streakTrackingEnabled) return null;
  const count = Number(streakSnapshot?.count) || 0;
  if (count <= 0) return null;
  const tierIndex = streakTier > 0 ? Math.min(streakTier, STREAK_TAUNTS.length - 1) : count >= 2 ? 1 : 0;
  const pool = STREAK_TAUNTS[tierIndex] || [];
  if (!pool.length) return null;
  const template = pickFromPool(pool);
  if (typeof template === "function") {
    return template({ count, tier: streakTier });
  }
  if (typeof template === "string") {
    return template.replace("{count}", count);
  }
  return null;
}

function pickSpotlightArtist() {
  if (!spotlightCatalog.length) return null;
  const highFocus = spotlightCatalog.filter((artist) => artist.postCount >= 120);
  const pool = streakTier >= 3 && highFocus.length ? highFocus : spotlightCatalog;
  let candidate = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pick = pickFromPool(pool);
    if (!pick) break;
    if (!lastSpotlightName || pick.name !== lastSpotlightName || attempt === 3) {
      candidate = pick;
      break;
    }
  }
  return candidate;
}

function getSpotlightTaunt() {
  if (!streakTrackingEnabled || streakTier < 2 || !spotlightCatalog.length) return null;
  const now = Date.now();
  if (now - lastSpotlightAt < SPOTLIGHT_COOLDOWN_MS) return null;
  const artist = pickSpotlightArtist();
  if (!artist) return null;
  lastSpotlightAt = now;
  lastSpotlightName = artist.name;
  const tags = (artist.tags || []).slice(0, 3).map((tag) => tag.replace(/_/g, " "));
  const tagLine = tags.length ? tags.join(", ") : "whatever filth you crave";
  return `Spotlight fixated on ${artist.name} — drenched in ${tagLine}.`;
}

function dispatchTauntEvent(message, detail = {}) {
  if (typeof document === "undefined" || !message) return;
  const now = Date.now();
  if (lastTauntDetail.message === message && now - lastTauntDetail.at < TAUNT_DEDUPE_MS) {
    return;
  }
  lastTauntDetail = { message, at: now };
  const payload = {
    message,
    context: detail,
    dedupeKey: `taunt:${message}`,
  };
  try {
    document.dispatchEvent(new CustomEvent("humiliation:taunt", { detail: payload }));
  } catch (error) {
    try {
      const evt = document.createEvent("CustomEvent");
      evt.initCustomEvent("humiliation:taunt", false, false, payload);
      document.dispatchEvent(evt);
    } catch (fallbackError) {
      console.warn("[humiliation] Failed to dispatch taunt event", fallbackError || error);
    }
  }
}

let tauntPool = [];
let timer = null;

function startTauntTicker(taunts = [], intervalMs = 30000) {
  tauntPool = Array.isArray(taunts) ? taunts : [];
  if (timer) clearInterval(timer);
  if (tauntPool.length === 0) return;
  timer = setInterval(() => {
    const active = getActiveTags ? getActiveTags() : new Set();
    const copies = getCopiedCount ? getCopiedCount() : 0;
    const dynamic = [];
    if (active.size > 0) {
      dynamic.push(`Still drooling over ${active.size} filthy tags?`);
    }
    if (copies > 0) {
      dynamic.push(`Copied ${copies} artists already? Desperate much?`);
    }
    const streakLine = getStreakTaunt();
    if (streakLine) {
      dynamic.push(streakLine);
    }
    const spotlightLine = getSpotlightTaunt();
    if (spotlightLine) {
      dynamic.push(spotlightLine);
    }
    const pool = tauntPool.concat(dynamic);
    const msg = pool[Math.floor(Math.random() * pool.length)];
    if (msg) {
      showToast(msg);
      dispatchTauntEvent(msg, { activeTags: active.size, copies });
    }
  }, intervalMs);
}

// All functions in this file are defined and used as follows:

// startTauntTicker: exported, used by main.js

// No unused or undefined functions in this file.

export { startTauntTicker, setHumiliationArtists };
