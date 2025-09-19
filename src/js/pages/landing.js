import { initializeApp } from '../core/app.js';
import { safeAnimate, stagger } from '../core/motion.js';
import { watchFoldState } from '../core/fold.js';

const HUMILIATION_LABELS = ['Muted', 'Teasing', 'Default', 'Cruel'];
const TTS_LABELS = ['Muted', 'Soft', 'Steady', 'Persistent'];

const heroSection = document.querySelector('[data-hero]');
const statsRoot = document.querySelector('[data-stats]');
const statArtists = document.querySelector('[data-stat-artists]');
const statTags = document.querySelector('[data-stat-tags]');
const statTts = document.querySelector('[data-stat-tts]');
const form = document.querySelector('[data-preferences-form]');
const humiliationInput = document.querySelector('[data-pref-humiliation]');
const ttsInput = document.querySelector('[data-pref-tts]');
const rememberInput = document.querySelector('[data-pref-remember]');
const humiliationLabel = document.querySelector('[data-humiliation-label]');
const ttsLabel = document.querySelector('[data-tts-label]');
const humiliationPill = document.querySelector('[data-humiliation-pill]');
const humiliationLevelText = document.querySelector('[data-humiliation-level]');

let unwatchFold = null;

initializeApp('landing', {
  onReady({ dataset, preferences, updatePreferences }) {
    unwatchFold = watchFoldState(() => {});
    revealHero();
    renderStats(dataset);
    syncForm(preferences);
    bindForm(updatePreferences);
    setupScrollButtons();
  },
  onPreferencesChange({ preferences }) {
    syncForm(preferences);
  }
});

function renderStats(dataset) {
  if (!dataset) {
    return;
  }
  const artistCount = dataset.artists?.length ?? 0;
  const tagCount = dataset.tags?.length ?? 0;
  const ttsCount = Object.values(dataset.tts ?? {}).reduce((total, lines) => total + lines.length, 0);

  if (statArtists) statArtists.textContent = artistCount.toString();
  if (statTags) statTags.textContent = tagCount.toString();
  if (statTts) statTts.textContent = ttsCount.toString();

  if (statsRoot) {
    const statItems = statsRoot.querySelectorAll('div');
    safeAnimate(statItems, { opacity: [0, 1], y: [16, 0] }, { delay: stagger(0.08), duration: 0.6 });
  }
}

function revealHero() {
  if (!heroSection) {
    return;
  }
  const heroChildren = heroSection.querySelectorAll(':scope > *');
  safeAnimate(heroSection, { opacity: [0, 1], y: [24, 0] }, { duration: 0.9, easing: 'cubic-bezier(.4,-0.2,.2,1.2)' });
  safeAnimate(heroChildren, { opacity: [0, 1], y: [12, 0] }, { delay: stagger(0.06), duration: 0.7 });
}

function bindForm(updatePreferences) {
  if (!form) {
    return;
  }

  if (humiliationInput) {
    humiliationInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      updatePreferences((current) => {
        current.humiliation.intensity = value;
        current.humiliation.enabled = value > 0;
        return current;
      });
    });
  }

  if (ttsInput) {
    ttsInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      updatePreferences((current) => {
        current.tts.intensity = value;
        current.tts.muted = value === 0;
        return current;
      });
    });
  }

  if (rememberInput) {
    rememberInput.addEventListener('change', (event) => {
      const checked = Boolean(event.target.checked);
      updatePreferences({ rememberFilters: checked });
    });
  }
}

function syncForm(preferences) {
  if (!preferences) {
    return;
  }

  if (humiliationInput) {
    if (humiliationInput.value !== String(preferences.humiliation.intensity)) {
      humiliationInput.value = String(preferences.humiliation.intensity);
    }
  }

  if (humiliationLabel) {
    humiliationLabel.textContent = HUMILIATION_LABELS[preferences.humiliation.intensity] ?? 'Unknown';
  }

  if (humiliationLevelText) {
    humiliationLevelText.textContent = String(preferences.humiliation.intensity);
  }

  if (ttsInput) {
    if (ttsInput.value !== String(preferences.tts.intensity)) {
      ttsInput.value = String(preferences.tts.intensity);
    }
  }

  if (ttsLabel) {
    ttsLabel.textContent = TTS_LABELS[preferences.tts.intensity] ?? 'Unknown';
  }

  if (rememberInput) {
    rememberInput.checked = Boolean(preferences.rememberFilters);
  }

  if (humiliationPill) {
    humiliationPill.dataset.level = String(preferences.humiliation.intensity);
  }
}

function setupScrollButtons() {
  const buttons = document.querySelectorAll('[data-scroll-target]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const selector = button.getAttribute('data-scroll-target');
      if (!selector) return;
      const target = document.querySelector(selector);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

window.addEventListener('beforeunload', () => {
  unwatchFold?.();
});
