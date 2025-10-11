// Humiliation module - periodic taunt popups

import { showToast, getCopiedCount } from "./sidebar.js";
import { getActiveTags } from "./tags.js";

const TAUNT_DEDUPE_MS = 4200;
let lastTauntDetail = { message: "", at: 0 };

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

export { startTauntTicker };
