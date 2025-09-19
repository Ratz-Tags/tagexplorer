// Humiliation module - periodic taunt popups

import { showToast, getCopiedCount } from "./sidebar.js";
import { getActiveTags } from "./tags.js";

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
    if (msg) showToast(msg);
  }, intervalMs);
}

// All functions in this file are defined and used as follows:

// startTauntTicker: exported, used by main.js

// No unused or undefined functions in this file.

export { startTauntTicker };
