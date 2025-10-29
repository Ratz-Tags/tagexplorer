import { setRandomBackground } from '../gallery.js';
import { setupBackgroundRotation } from '../ui.js';
import { dispatchWhisperEvent } from '../tts-dispatcher.js';
import {
  getPressureState,
  onPressureChange,
  resetPressure,
} from '../progression/pressure-meter.js';
import type { FoldAdapter, PageInitContext, PageInitializer, PageLifecycle } from '../types.js';

const MOTION_STORAGE_KEY = 'te.motion.preference';
const MOTION_DEFAULT = 'full';
const THEME_STORAGE_KEY = 'theme';
const MISSION_STORAGE_KEY = 'te.mission.profile';
const CTA_LOCKED_CLASS = 'landing-enter--locked';
const PRESSURE_MAX_LEVEL = 100;
const PRESSURE_CAPTIONS = [
  (levelText, numeric) =>
    numeric <= 0
      ? 'Dormant sensors. No shame logged yet. Reset keeps the slate pretending to be clean.'
      : `Dormant sensors flicker at ${levelText}%. Reset is the only lie you can tell yourself.`,
  (levelText) =>
    `Needle pricks intensify at ${levelText}%. Every filter you tap pushes the glow harder. Reset if you dare.`,
  (levelText) =>
    `Archive crackle at ${levelText}%. The log is savouring every indulgence. Reset only delays the bite.`,
  (levelText) =>
    `Critical overload at ${levelText}%. Whispers stop pretending to be gentle. Reset while you can still breathe.`,
];
const PRESSURE_TIER_LABELS = ['Dormant', 'Needling', 'Fixated', 'Overload'];

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

function formatPressureLevel(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { numeric: 0, text: '00' };
  }
  const clamped = Math.max(0, Math.min(PRESSURE_MAX_LEVEL, Math.round(numericValue)));
  return { numeric: clamped, text: clamped.toString().padStart(2, '0') };
}

function resolvePressureTier(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return 0;
  const maxTier = PRESSURE_TIER_LABELS.length - 1;
  return Math.max(0, Math.min(maxTier, Math.round(numericValue)));
}

function describePressureState(level, tier) {
  const { numeric, text } = formatPressureLevel(level);
  const safeTier = resolvePressureTier(tier);
  const generator = PRESSURE_CAPTIONS[safeTier] || PRESSURE_CAPTIONS[0];
  let description = '';
  try {
    description = generator(text, numeric);
  } catch (error) {
    console.warn('[landing] failed to build pressure caption', error);
    description = 'Sensors hum impatiently. Reset keeps them quiet—for now.';
  }
  const label = PRESSURE_TIER_LABELS[safeTier] || PRESSURE_TIER_LABELS[0];
  return { numeric, text, tier: safeTier, label, description };
}

function setupPressureMeter(): () => void {
  if (typeof document === 'undefined') return () => {};
  const meter = document.querySelector<HTMLElement>('[data-pressure-meter]');
  if (!meter) return () => {};

  const gauge = meter.querySelector<HTMLElement>('[data-pressure-gauge]');
  const valueEl = meter.querySelector<HTMLElement>('[data-pressure-value]');
  const labelEl = meter.querySelector<HTMLElement>('[data-pressure-label]');
  const captionEl = meter.querySelector<HTMLElement>('[data-pressure-caption]');
  const srCaptionEl = meter.querySelector<HTMLElement>('[data-pressure-caption-live]');
  const resetButton = meter.querySelector<HTMLButtonElement>('[data-pressure-reset]');

  const reduceQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const syncReduced = () => {
    const docMotion = document.body?.dataset?.motion;
    const prefersReduced = Boolean(reduceQuery?.matches);
    const reduced = docMotion === 'reduced' || prefersReduced;
    meter.classList.toggle('landing-meter--reduced', reduced);
  };

  const applyState = (payload) => {
    const { description, numeric, text, tier, label } = describePressureState(
      payload?.level,
      payload?.tier,
    );
    meter.dataset.pressureTier = String(tier);
    meter.dataset.pressureLevel = String(numeric);
    const progress = Math.max(0, Math.min(1, numeric / PRESSURE_MAX_LEVEL));
    meter.style.setProperty('--pressure-meter-progress', progress.toFixed(3));
    if (gauge) {
      gauge.setAttribute('aria-valuemin', '0');
      gauge.setAttribute('aria-valuemax', String(PRESSURE_MAX_LEVEL));
      gauge.setAttribute('aria-valuenow', String(numeric));
      gauge.setAttribute('aria-valuetext', `${numeric}% shame pressure — ${label}`);
    }
    if (valueEl) {
      valueEl.textContent = `${text}%`;
    }
    if (labelEl) {
      labelEl.textContent = label;
    }
    if (captionEl) {
      captionEl.textContent = description;
    }
    if (srCaptionEl) {
      srCaptionEl.textContent = description;
    }
    if (resetButton) {
      const disabled = numeric === 0;
      resetButton.disabled = disabled;
      resetButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  };

  syncReduced();
  if (reduceQuery) {
    reduceQuery.addEventListener('change', syncReduced);
  }
  const handleMotionChange = () => syncReduced();
  document.addEventListener('motion:change', handleMotionChange);

  applyState(getPressureState());
  const unsubscribe =
    onPressureChange((detail) => {
      applyState(detail || getPressureState());
    }) || (() => {});

  const handleReset = () => {
    resetPressure({ source: 'landing-reset' });
  };
  if (resetButton) {
    resetButton.addEventListener('click', handleReset);
  }

  return () => {
    unsubscribe();
    if (resetButton) {
      resetButton.removeEventListener('click', handleReset);
    }
    if (reduceQuery) {
      reduceQuery.removeEventListener('change', syncReduced);
    }
    document.removeEventListener('motion:change', handleMotionChange);
  };
}

function trapFocusWithin(container: HTMLElement | null): () => void {
  if (!container) return () => {};
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
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
  const dialog = document.querySelector<HTMLDialogElement>('[data-landing-ritual]');
  const enterLink = document.querySelector<HTMLAnchorElement>('[data-landing-enter]');
  if (!dialog || !enterLink) return null;
  dialog.setAttribute('aria-hidden', 'true');
  const scheduleFrame =
    typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback) => setTimeout(callback, 16);

  let focusTrapDisposer: (() => void) | null = null;
  let selectedMission: string | null = null;
  let selectedLabel: string | null = null;
  let selectedCopy: string | null = null;
  let activeStep: 'mission' | 'consent' | 'summary' | 'confirm' = 'mission';
  let ritualComplete = false;
  const summaryEl = dialog.querySelector<HTMLElement>('[data-ritual-summary]');
  const missionButtons = Array.from(
    dialog.querySelectorAll<HTMLButtonElement>('[data-mission-option]'),
  );
  const backButtons = Array.from(
    dialog.querySelectorAll<HTMLButtonElement>('[data-ritual-back]'),
  );
  const consentButton = dialog.querySelector<HTMLButtonElement>('[data-ritual-consent]');
  const confirmButton = dialog.querySelector<HTMLButtonElement>('[data-ritual-confirm]');
  
  console.log('[landing] Ritual elements found:');
  console.log('  - Mission buttons:', missionButtons.length);
  console.log('  - Back buttons:', backButtons.length);
  console.log('  - Consent button:', !!consentButton);
  console.log('  - Confirm button:', !!confirmButton);
  console.log('  - Summary element:', !!summaryEl);
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
    console.log('[landing] Setting ritual step:', step);
    activeStep = step;
    const stages = Array.from(dialog.querySelectorAll('[data-ritual-step]'));
    console.log('[landing] Found stages:', stages.length);
    
    stages.forEach((stage) => {
      const key = stage.getAttribute('data-ritual-step');
      const isActive = key === step;
      console.log(`[landing] Stage "${key}": active=${isActive}`);
      
      // Use removeAttribute/setAttribute instead of toggleAttribute for better compatibility
      if (isActive) {
        stage.removeAttribute('hidden');
      } else {
        stage.setAttribute('hidden', '');
      }
      stage.classList.toggle('landing-ritual__stage--active', isActive);
    });
    
    dialog.setAttribute('data-ritual-stage', step);
    console.log('[landing] Dialog stage set to:', step);
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
    const currentStage = dialog.querySelector<HTMLElement>(
      `[data-ritual-step="${activeStep}"]`,
    );
    if (!currentStage) return;
    const target = currentStage.querySelector<HTMLElement>(
      'button:not([disabled]), [href]:not([tabindex="-1"])',
    );
    if (target) {
      target.focus({ preventScroll: true });
    } else {
      dialog.focus({ preventScroll: true });
    }
  }

  function openRitual(initialStep = 'mission') {
    console.log('[landing] Opening ritual with step:', initialStep);
    if (ritualComplete) {
      console.log('[landing] Ritual already complete, not opening');
      return;
    }
    
    const alreadyOpen = Boolean(dialog.open);
    console.log('[landing] Dialog already open:', alreadyOpen);
    
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
      
      // Prevent background scrolling on mobile
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
      }
      
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
    dialog.dataset.ritualState = 'complete';
    dialog.setAttribute('hidden', '');
    
    // Restore background scrolling on mobile
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
    
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

  missionButtons.forEach((button, index) => {
    console.log(`[landing] Setting up mission button ${index + 1}:`, button.dataset.missionOption);
    button.addEventListener('click', () => {
      console.log(`[landing] Mission button clicked:`, button.dataset.missionOption);
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
    dialog.classList.remove('landing-ritual--open');
    try {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    } catch {
      dialog.removeAttribute('open');
    }
    dialog.dataset.ritualState = 'complete';
    dialog.setAttribute('hidden', '');
    dialog.setAttribute('aria-hidden', 'true');
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

function setupLandingFoldModeSync({ foldAdapter }: { foldAdapter?: FoldAdapter | null }): () => void {
  const applyMode = (mode: string | null | undefined) => {
    const normalized = mode || 'default';
    console.log('[landing] Applying fold mode:', normalized);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.foldMode = normalized;
      document.body.dataset.foldMode = normalized;
      const shellRoot = document.querySelector<HTMLElement>('[data-shell]');
      if (shellRoot) {
        shellRoot.dataset.foldMode = normalized;
      }
      console.log('[landing] Fold mode applied to body:', document.body.dataset.foldMode);
    }
    updateLandingCommandStatusLabels(normalized);
  };

  const currentMode =
    (foldAdapter && typeof foldAdapter.getMode === 'function' && foldAdapter.getMode()) ||
    document.body.dataset.foldMode ||
    'default';
  applyMode(currentMode);

  if (!foldAdapter || typeof foldAdapter.subscribe !== 'function') {
    return () => {};
  }

  const unsubscribe = foldAdapter.subscribe((mode) => {
    applyMode(mode || 'default');
  });

  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
}

function updateLandingCommandStatusLabels(mode: string | null | undefined): void {
  const labels = document.querySelectorAll<HTMLElement>('.command-status__label');
  const normalized = mode || 'default';
  labels.forEach((label) => {
    const target = label?.dataset?.mode ? `fold-${label.dataset.mode}` : null;
    const isActive = target && target === normalized;
    label.classList.toggle('is-active', Boolean(isActive));
    label.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}

export async function initLandingPage({ shell, foldAdapter }: PageInitContext): Promise<PageLifecycle | void> {
  const audioButton = document.querySelector<HTMLButtonElement>('[data-landing-audio]');
  let setupPromise: Promise<void> | null = null;
  let ambienceHandle: { destroy?: () => void; dispose?: () => void } | null = null;

  applySavedTheme();
  let motionMode = applyMotionPreference(readMotionPreference());

  // Setup fold mode detection for mobile/desktop layouts
  setupLandingFoldModeSync({ foldAdapter });

  // Critical path: Setup basic UI components
  setupThemeToggles();
  const disposePressureMeter = setupPressureMeter();
  // setupMissionRitual(); // Removed - no more ritual dialog

  // Non-critical path: Background operations (defer to avoid blocking UI)
  // Use requestIdleCallback or setTimeout to defer heavy operations
  const deferBackgroundSetup = () => {
    if (window.requestIdleCallback) {
      requestIdleCallback(async () => {
        try {
          await setRandomBackground({ motionMode });
        } catch (error) {
          console.warn('[landing] failed to apply initial ambience', error);
        }
      });
    } else {
      setTimeout(async () => {
        try {
          await setRandomBackground({ motionMode });
        } catch (error) {
          console.warn('[landing] failed to apply initial ambience', error);
        }
      }, 100);
    }
  };

  const deferAmbienceSetup = () => {
    if (window.requestIdleCallback) {
      requestIdleCallback(async () => {
        try {
          ambienceHandle = await setupBackgroundRotation(setRandomBackground);
        } catch (error) {
          console.warn('[landing] failed to initialise ambience rotation', error);
        }
      });
    } else {
      setTimeout(async () => {
        try {
          ambienceHandle = await setupBackgroundRotation(setRandomBackground);
        } catch (error) {
          console.warn('[landing] failed to initialise ambience rotation', error);
        }
      }, 200);
    }
  };

  // Start background operations without blocking
  deferBackgroundSetup();
  deferAmbienceSetup();

  // Ensure listeners created inside ambience controller receive the current mode.
  motionMode = applyMotionPreference(motionMode);

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
      if (typeof disposePressureMeter === 'function') {
        try {
          disposePressureMeter();
        } catch (error) {
          console.warn('[landing] failed to dispose pressure meter', error);
        }
      }
    },
  } satisfies PageLifecycle;
}

export const initPage: PageInitializer = initLandingPage;
