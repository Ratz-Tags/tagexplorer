import { initializeApp } from '../core/app.js';
import { safeAnimate, stagger } from '../core/motion.js';

const versionPill = document.querySelector('[data-version-pill]');
const artistsCountEl = document.querySelector('[data-about-artists]');
const tagsCountEl = document.querySelector('[data-about-tags]');
const ttsCountEl = document.querySelector('[data-about-tts]');
const roadmap = document.querySelector('[data-roadmap]');

initializeApp('about', {
  onReady({ dataset, preferences }) {
    renderCounts(dataset);
    updateVersion(preferences);
    animateSections();
  },
  onPreferencesChange({ preferences }) {
    updateVersion(preferences);
  }
});

function renderCounts(dataset) {
  if (!dataset) {
    return;
  }
  const artistCount = dataset.artists?.length ?? 0;
  const tagCount = dataset.tags?.length ?? 0;
  const ttsCount = Object.values(dataset.tts ?? {}).reduce((total, lines) => total + lines.length, 0);

  if (artistsCountEl) artistsCountEl.textContent = artistCount.toString();
  if (tagsCountEl) tagsCountEl.textContent = tagCount.toString();
  if (ttsCountEl) ttsCountEl.textContent = ttsCount.toString();
}

function updateVersion(preferences) {
  if (!versionPill) {
    return;
  }
  const humiliationLevel = preferences?.humiliation?.intensity ?? 2;
  versionPill.textContent = `Stage 1 · Foundations · Humiliation ${humiliationLevel}`;
}

function animateSections() {
  const sections = document.querySelectorAll('.glass-panel');
  safeAnimate(sections, { opacity: [0, 1], y: [24, 0] }, { delay: stagger(0.08), duration: 0.7 });

  if (roadmap) {
    const items = roadmap.querySelectorAll('li');
    safeAnimate(items, { opacity: [0, 1], x: [-12, 0] }, { delay: stagger(0.05), duration: 0.5 });
  }
}

