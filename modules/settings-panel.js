// Settings panel: whispered taunts (on/off, intensity, which voice), sound and
// motion in one place. Page-specific actions arrive as hooks.
import { isTTSEnabled, setTTSEnabled, getTTSIntensity, setTTSIntensity } from './tts-toggle.js';
import { mountVoiceControls, renderVoiceControls } from './whisper-voice.js';

const INTENSITIES = [
  { value: 1, label: 'Hushed' },
  { value: 2, label: 'Teasing' },
  { value: 3, label: 'Severe' },
];

let hooks = {};
let root = null;
let returnFocus = null;

// hooks: { isMuted(), toggleMute(), getMotion(), setMotion(mode), openPlayer() }
export function initSettingsPanel(options = {}) {
  hooks = options;
  const refresh = () => {
    if (root && !root.hidden) render();
  };
  ['tts:toggle', 'tts:intensity', 'audio:mutechange', 'motion:change'].forEach((name) =>
    document.addEventListener(name, refresh),
  );
}

export function toggleSettingsPanel() {
  if (root && !root.hidden) closeSettingsPanel();
  else openSettingsPanel();
}

export function openSettingsPanel() {
  ensureRoot();
  returnFocus = document.activeElement;
  root.hidden = false;
  document.documentElement.classList.add('settings-open');
  // On the document so Esc still works after a click drops focus to <body>.
  document.addEventListener('keydown', onKeydown, true);
  render();
  root.querySelector('[data-setting="tts"]')?.focus();
}

export function closeSettingsPanel() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.documentElement.classList.remove('settings-open');
  document.removeEventListener('keydown', onKeydown, true);
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
}

function onKeydown(event) {
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  closeSettingsPanel();
}

function ensureRoot() {
  if (root) return;
  root = document.createElement('div');
  root.className = 'settings';
  root.hidden = true;
  root.innerHTML = `
    <div class="settings__backdrop" data-close></div>
    <aside class="settings__panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="settings__head">
        <h2 id="settings-title" class="settings__title">Settings</h2>
        <button type="button" class="settings__close" data-close aria-label="Close settings">✕</button>
      </header>
      <section class="settings__section" aria-labelledby="settings-taunts">
        <h3 id="settings-taunts" class="settings__heading">Whispered taunts</h3>
        <label class="settings__row">
          <span class="settings__text"><strong>Speak taunts aloud</strong><small>Captions show either way.</small></span>
          <input type="checkbox" class="settings__switch" role="switch" data-setting="tts">
        </label>
        <div class="settings__row settings__row--stack">
          <span class="settings__label" id="settings-intensity">Intensity</span>
          <div class="settings__segmented" role="radiogroup" aria-labelledby="settings-intensity">
            ${INTENSITIES.map(({ value, label }) => `<button type="button" role="radio" data-intensity="${value}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="settings__voice" data-voice></div>
      </section>
      <section class="settings__section" aria-labelledby="settings-sound">
        <h3 id="settings-sound" class="settings__heading">Sound</h3>
        <label class="settings__row">
          <span class="settings__text"><strong>Mute everything</strong><small>Music, whispers and effects. Shortcut: M</small></span>
          <input type="checkbox" class="settings__switch" role="switch" data-setting="mute">
        </label>
        <div class="settings__row">
          <span class="settings__text"><strong>Music &amp; ambience</strong><small>Tracks, playlists and ASMR layers</small></span>
          <button type="button" class="settings-btn" data-act="player">Open player</button>
        </div>
      </section>
      <section class="settings__section" aria-labelledby="settings-display">
        <h3 id="settings-display" class="settings__heading">Display</h3>
        <label class="settings__row">
          <span class="settings__text"><strong>Reduce motion</strong><small>Fewer animations and effects</small></span>
          <input type="checkbox" class="settings__switch" role="switch" data-setting="motion">
        </label>
      </section>
    </aside>
  `;
  document.body.appendChild(root);
  mountVoiceControls(root.querySelector('[data-voice]'));

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) {
      closeSettingsPanel();
      return;
    }
    const intensity = event.target.closest('[data-intensity]');
    if (intensity) {
      setTTSIntensity(Number(intensity.dataset.intensity));
      return;
    }
    if (event.target.closest('[data-act="player"]')) {
      closeSettingsPanel();
      hooks.openPlayer?.();
    }
  });

  root.addEventListener('change', (event) => {
    const setting = event.target.dataset.setting;
    const on = event.target.checked;
    if (setting === 'tts') setTTSEnabled(on);
    else if (setting === 'mute' && on !== Boolean(hooks.isMuted?.())) hooks.toggleMute?.();
    else if (setting === 'motion') hooks.setMotion?.(on ? 'reduced' : 'full');
  });

  // Arrow keys move through the intensity options, as in any radio group.
  root.querySelector('.settings__segmented').addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const current = Math.max(1, getTTSIntensity());
    const next = Math.min(3, Math.max(1, current + step));
    setTTSIntensity(next);
    root.querySelector(`[data-intensity="${next}"]`)?.focus();
  });
}

function render() {
  const intensity = getTTSIntensity();
  const speaking = isTTSEnabled() && intensity > 0;
  root.querySelector('[data-setting="tts"]').checked = speaking;
  root.querySelectorAll('[data-intensity]').forEach((button) => {
    const selected = Number(button.dataset.intensity) === (intensity || 2);
    button.setAttribute('aria-checked', String(selected && speaking));
    button.tabIndex = selected ? 0 : -1;
  });
  root.querySelector('[data-setting="mute"]').checked = Boolean(hooks.isMuted?.());
  root.querySelector('[data-setting="motion"]').checked = hooks.getMotion?.() === 'reduced';
  renderVoiceControls();
}
