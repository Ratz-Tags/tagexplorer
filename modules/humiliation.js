// Humiliation module - periodic taunt popups
import { showToast } from './sidebar.js';

let tauntPool = [];
let timer = null;

function startTauntTicker(taunts = [], intervalMs = 30000) {
  tauntPool = Array.isArray(taunts) ? taunts : [];
  if (timer) clearInterval(timer);
  if (tauntPool.length === 0) return;
  timer = setInterval(() => {
    const msg = tauntPool[Math.floor(Math.random() * tauntPool.length)];
    if (msg) showToast(msg);
  }, intervalMs);
}

export { startTauntTicker };
