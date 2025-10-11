import { setRandomBackground } from '../gallery.js';
import { setupBackgroundRotation } from '../ui.js';
import { dispatchWhisperEvent } from '../tts-dispatcher.js';

const MOTION_STORAGE_KEY = 'te.motion.preference';
const MOTION_DEFAULT = 'full';
const THEME_STORAGE_KEY = 'theme';
const MISSION_STORAGE_KEY = 'te.mission.profile';
const CTA_LOCKED_CLASS = 'landing-enter--locked';

function parseMissionProfile(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const mission = typeof parsed.mission === 'string' ? parsed.mission.trim() : '';
    const timestamp = Number(parsed.timestamp);
    if (!mission || !Number.isFinite(timestamp)) return null;
    const label = typeof parsed.label === 'string' ? parsed.label.trim() : mission;
    const copy = typeof parsed.copy === 'string' ? parsed.copy.trim() : '';
    return { mission, label, copy, timestamp };
  } catch {
    return null;
  }
}

function loadMissionProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(MISSION_STORAGE_KEY);
    return parseMissionProfile(value);
  } catch {
    return null;
  }
}

function persistMissionProfile(profile) {
  if (typeof window === 'undefined') return;
  if (!profile || typeof profile !== 'object') return;
  try {
    const payload = {
      mission: profile.mission,
      label: profile.label,
      copy: profile.copy,
      timestamp: profile.timestamp,
    };
    window.localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[landing] failed to persist mission profile', error);
  }
}

function trapFocusWithin(container) {
  if (!container) return () => {};
  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        element.tabIndex !== -1,
    );
    if (!focusable.length) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  container.addEventListener('keydown', handleKeyDown);
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

function setupMissionRitual() {
  if (typeof document === 'undefined') return null;
  const dialog = document.querySelector('[data-landing-ritual]');
  const enterLink = document.querySelector('[data-landing-enter]');
  if (!dialog || !enterLink) return null;
  dialog.setAttribute('aria-hidden', 'true');
  const scheduleFrame =
    typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback) => setTimeout(callback, 16);

  let focusTrapDisposer = null;
  let selectedMission = null;
  let selectedLabel = null;
  let selectedCopy = null;
  let activeStep = 'mission';
  let ritualComplete = false;
  const summaryEl = dialog.querySelector('[data-ritual-summary]');
  const missionButtons = Array.from(dialog.querySelectorAll('[data-mission-option]'));
  const backButtons = Array.from(dialog.querySelectorAll('[data-ritual-back]'));
  const consentButton = dialog.querySelector('[data-ritual-consent]');
  const confirmButton = dialog.querySelector('[data-ritual-confirm]');
  const handleCancel = (event) => {
    if (ritualComplete) return;
    event.preventDefault();
    focusCurrentStep();
  };
  const handleClose = () => {
    if (ritualComplete) return;
    scheduleFrame(() => {
      if (!ritualComplete) {
        openRitual(activeStep);
      }
    });
  };
  const blockLinkActivation = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    openRitual();
  };

  function setStep(step) {
    activeStep = step;
    const stages = Array.from(dialog.querySelectorAll('[data-ritual-step]'));
    stages.forEach((stage) => {
      const key = stage.getAttribute('data-ritual-step');
      const isActive = key === step;
      stage.toggleAttribute('hidden', !isActive);
      stage.classList.toggle('landing-ritual__stage--active', isActive);
    });
    dialog.setAttribute('data-ritual-stage', step);
    queueMicrotask(() => focusCurrentStep());
  }

  function formatSummary() {
    if (!summaryEl) return;
    if (!selectedMission) {
      summaryEl.textContent = 'Mission ready. Confirm to let the gallery whisper about it every time you return.';
      return;
    }
    const label = selectedLabel || selectedMission;
    const copy = selectedCopy || '';
    const fragments = [`Mission "${label}" will be branded onto this device.`];
    if (copy) {
      fragments.push(copy);
    }
    summaryEl.textContent = fragments.join(' ');
  }

  function focusCurrentStep() {
    const currentStage = dialog.querySelector(`[data-ritual-step="${activeStep}"]`);
    if (!currentStage) return;
    const target = currentStage.querySelector(
      'button:not([disabled]), [href]:not([tabindex="-1"])',
    );
    if (target) {
      target.focus({ preventScroll: true });
    } else {
      dialog.focus({ preventScroll: true });
    }
  }

  function openRitual(initialStep = 'mission') {
    if (ritualComplete) return;
    const alreadyOpen = Boolean(dialog.open);
    try {
      dialog.removeAttribute('hidden');
    } catch {}
    setStep(initialStep);
    if (!alreadyOpen) {
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch (error) {
          console.warn('[landing] failed to open mission dialog via showModal', error);
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
      dialog.classList.add('landing-ritual--open');
      dialog.setAttribute('aria-hidden', 'false');
      if (focusTrapDisposer) {
        focusTrapDisposer();
      }
      focusTrapDisposer = trapFocusWithin(dialog);
      dialog.addEventListener('cancel', handleCancel);
      dialog.addEventListener('close', handleClose);
    } else {
      dialog.setAttribute('aria-hidden', 'false');
      focusCurrentStep();
    }
  }

  function closeRitual() {
    ritualComplete = true;
    dialog.removeEventListener('cancel', handleCancel);
    dialog.removeEventListener('close', handleClose);
    if (focusTrapDisposer) {
      focusTrapDisposer();
      focusTrapDisposer = null;
    }
    try {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    } catch (error) {
      dialog.removeAttribute('open');
    }
    dialog.classList.remove('landing-ritual--open');
    dialog.setAttribute('aria-hidden', 'true');
    enterLink.focus({ preventScroll: true });
  }

  function lockCTA() {
    enterLink.classList.add(CTA_LOCKED_CLASS);
    enterLink.setAttribute('aria-disabled', 'true');
    enterLink.setAttribute('tabindex', '-1');
    enterLink.dataset.missionLocked = 'true';
    enterLink.addEventListener('click', blockLinkActivation, true);
  }

  function unlockCTA(profile) {
    enterLink.classList.remove(CTA_LOCKED_CLASS);
    enterLink.removeAttribute('aria-disabled');
    enterLink.removeAttribute('tabindex');
    delete enterLink.dataset.missionLocked;
    enterLink.removeEventListener('click', blockLinkActivation, true);
    if (profile) {
      try {
        document.dispatchEvent(
          new CustomEvent('landing:mission-set', {
            detail: profile,
          }),
        );
      } catch (error) {
        console.warn('[landing] failed to dispatch mission event', error);
      }
    }
  }

  missionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedMission = button.dataset.missionOption || '';
      selectedLabel = button.dataset.missionLabel || selectedMission;
      selectedCopy = button.dataset.missionCopy || '';
      setStep('consent');
    });
  });

  backButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (activeStep === 'confirm') {
        setStep('consent');
      } else {
        setStep('mission');
      }
    });
  });

  if (consentButton) {
    consentButton.addEventListener('click', () => {
      if (!selectedMission) {
        setStep('mission');
        return;
      }
      formatSummary();
      setStep('confirm');
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener('click', () => {
      if (!selectedMission) {
        setStep('mission');
        return;
      }
      const timestamp = Date.now();
      const profile = {
        mission: selectedMission,
        label: selectedLabel || selectedMission,
        copy: selectedCopy || '',
        timestamp,
      };
      persistMissionProfile(profile);
      unlockCTA(profile);
      closeRitual();
      dispatchWhisperEvent('mission_confirm', { minIntensity: 1 });
    });
  }

  const storedProfile = loadMissionProfile();
  if (storedProfile) {
    ritualComplete = true;
    unlockCTA(storedProfile);
    return storedProfile;
  }

  lockCTA();
  // Wait a frame to avoid blocking initial rendering.
  scheduleFrame(() => {
    openRitual();
  });

  return null;
}

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
  setupMissionRitual();

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
