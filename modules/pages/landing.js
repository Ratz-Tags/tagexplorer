import { setRandomBackground } from '../gallery.js';
import { setupBackgroundRotation } from '../ui.js';

const MOTION_STORAGE_KEY = 'te.motion.preference';
const MOTION_DEFAULT = 'full';
const THEME_STORAGE_KEY = 'theme';

function applySavedTheme() {
  if (typeof document === 'undefined') return 'fem';
  const body = document.body;
  if (!body) return 'fem';

  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    savedTheme = null;
  }

  if (savedTheme === 'incognito') {
    body.classList.add('incognito-theme');
    body.classList.remove('fem-theme');
    return 'incognito';
  }

  body.classList.add('fem-theme');
  body.classList.remove('incognito-theme');
  return 'fem';
}

function readMotionPreference() {
  if (typeof window === 'undefined') return MOTION_DEFAULT;
  try {
    const value = window.localStorage.getItem(MOTION_STORAGE_KEY);
    if (value === 'reduced' || value === 'full') {
      return value;
    }
  } catch {
    // Ignore storage errors.
  }

  if (typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return 'reduced';
      }
    } catch {
      // Ignore media query errors.
    }
  }

  return MOTION_DEFAULT;
}

function applyMotionPreference(mode) {
  const normalized = mode === 'reduced' ? 'reduced' : 'full';

  if (typeof document !== 'undefined') {
    try {
      document.documentElement.dataset.motion = normalized;
    } catch {}
    if (document.body) {
      try {
        document.body.dataset.motion = normalized;
      } catch {}
    }
  }

  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage errors.
  }

  try {
    document.dispatchEvent(
      new CustomEvent('motion:change', { detail: { mode: normalized } }),
    );
  } catch {
    // Ignore dispatch failures.
  }

  return normalized;
}

function setupThemeToggles() {
  const toggles = Array.from(document.querySelectorAll('.theme-toggle'));
  if (!toggles.length) return;

  toggles.forEach((toggleEl) => {
    toggleEl.addEventListener('click', () => {
      const body = document.body;
      if (!body) return;

      body.classList.toggle('incognito-theme');
      body.classList.toggle('fem-theme');

      const currentTheme = body.classList.contains('incognito-theme') ? 'incognito' : 'fem';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
      } catch {}

      const motionMode = (document.body && document.body.dataset.motion) || readMotionPreference();
      Promise.resolve(setRandomBackground({ motionMode })).catch((error) => {
        console.warn('[landing] failed to refresh background after theme toggle', error);
      });
    });
  });
}

export async function initLandingPage({ shell }) {
  const audioButton = document.querySelector('[data-landing-audio]');
  let setupPromise = null;
  let ambienceHandle = null;

  applySavedTheme();
  let motionMode = applyMotionPreference(readMotionPreference());

  try {
    await setRandomBackground({ motionMode });
  } catch (error) {
    console.warn('[landing] failed to apply initial ambience', error);
  }

  try {
    ambienceHandle = await setupBackgroundRotation(setRandomBackground);
  } catch (error) {
    console.warn('[landing] failed to initialise ambience rotation', error);
  }

  // Ensure listeners created inside ambience controller receive the current mode.
  motionMode = applyMotionPreference(motionMode);

  setupThemeToggles();

  function revealAudioPanel() {
    if (!shell?.audioPanel) return;
    shell.audioPanel.removeAttribute('hidden');
    const panel = shell.audioPanel.querySelector('#audio-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
    }
  }

  if (audioButton) {
    audioButton.addEventListener('click', async () => {
      audioButton.disabled = true;
      audioButton.classList.add('is-loading');
      try {
        if (!setupPromise) {
          setupPromise = (async () => {
            const [{ initAudio, initAudioUI }] = await Promise.all([
              import('../audio.js'),
            ]);
            await initAudio();
            initAudioUI();
          })();
        }
        await setupPromise;
        revealAudioPanel();
        audioButton.textContent = 'Whispers armed';
      } catch (error) {
        console.warn('[landing] Failed to initialise audio', error);
        audioButton.textContent = 'Audio unavailable';
      } finally {
        audioButton.classList.remove('is-loading');
      }
    });
  }

  return {
    onDispose() {
      if (ambienceHandle) {
        try {
          if (typeof ambienceHandle.destroy === 'function') {
            ambienceHandle.destroy();
          } else if (typeof ambienceHandle.dispose === 'function') {
            ambienceHandle.dispose();
          }
        } catch (error) {
          console.warn('[landing] failed to dispose ambience controller', error);
        }
      }
    },
  };
}

export const initPage = initLandingPage;
